
// 书籍文件导入：EPUB（jszip 解包 + DOMParser 提取正文）/ PDF（pdfjs-dist 逐页抽文本）。
// 两个解析库都动态 import 懒加载，避免打进首屏 bundle。
// 同时提取封面（EPUB cover-image / PDF 第一页渲染）和作者（OPF dc:creator）。

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface BookImportResult {
    text: string;
    cover?: string;    // data URL（image/jpeg），存进 localStorage 用于卡片展示
    author?: string;   // EPUB 从 OPF metadata 提取，PDF 一般无元数据
}

// 提取 HTML/XHTML 正文文本：去脚本/样式/导航，块级元素换行，压缩空行
function extractTextFromHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, nav, noscript, head').forEach((el) => el.remove());
    const body = doc.body;
    if (!body) return '';
    const text = body.innerText || body.textContent || '';
    return text
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 把图片 Blob 压缩为 data URL（缩放到 maxWidth，JPEG 质量 quality）。
// 控制 localStorage 体积（data URL 会进 localStorage）。
function compressImage(blob: Blob, maxWidth = 400, quality = 0.75): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxWidth / img.width);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas 2d 不可用')); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('封面图片解码失败')); };
        img.src = url;
    });
}

export async function parseEpub(file: File): Promise<BookImportResult> {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);

    // 1. container.xml → OPF 路径
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) throw new Error('无效的 EPUB：缺少 META-INF/container.xml');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfile = containerDoc.querySelector('rootfile');
    const opfPath = rootfile?.getAttribute('full-path');
    if (!opfPath) throw new Error('无效的 EPUB：找不到 OPF 文件路径');

    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfXml = await zip.file(opfPath)?.async('string');
    if (!opfXml) throw new Error('无效的 EPUB：找不到 OPF 文件');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

    // 2. manifest：id → item（保留 properties 找封面）
    const manifest = new Map<string, Element>();
    opfDoc.querySelectorAll('manifest item, item').forEach((item) => {
        const id = item.getAttribute('id');
        if (id) manifest.set(id, item);
    });

    // 3. 作者（dc:creator 优先 meta name="author"）
    const authorMeta = opfDoc.querySelector('metadata meta[name="author"]') || opfDoc.querySelector('metadata dc\\:creator, metadata creator');
    const author = authorMeta?.textContent?.trim() || undefined;

    // 4. spine
    const spineIds: string[] = [];
    opfDoc.querySelectorAll('spine itemref, itemref').forEach((ref) => {
        const idref = ref.getAttribute('idref');
        if (idref) spineIds.push(idref);
    });

    // 5. 提取章节正文
    const chapters: string[] = [];
    for (const id of spineIds) {
        const item = manifest.get(id);
        if (!item) continue;
        const href = item.getAttribute('href');
        if (!href) continue;
        const chapterPath = opfDir + href.split('#')[0];
        const html = await zip.file(chapterPath)?.async('string');
        if (!html) continue;
        const text = extractTextFromHtml(html);
        if (text) chapters.push(text);
    }
    if (chapters.length === 0) throw new Error('未能从 EPUB 中提取到正文');
    const text = chapters.join('\n\n');

    // 6. 封面（优先级：properties=cover-image → meta cover → 第一个 image/*）
    let cover: string | undefined;
    try {
        let coverItem: Element | undefined;
        // EPUB3: properties="cover-image"
        for (const item of Array.from(manifest.values())) {
            const props = item.getAttribute('properties') || '';
            if (/\bcover-image\b/.test(props)) { coverItem = item; break; }
        }
        // EPUB2: <meta name="cover" content="cover-id">
        if (!coverItem) {
            const metaCover = opfDoc.querySelector('metadata meta[name="cover"]');
            const coverId = metaCover?.getAttribute('content');
            if (coverId) coverItem = manifest.get(coverId);
        }
        // Fallback: 第一个 image/* manifest item
        if (!coverItem) {
            for (const item of Array.from(manifest.values())) {
                const mt = (item.getAttribute('media-type') || '').toLowerCase();
                if (mt.startsWith('image/')) { coverItem = item; break; }
            }
        }
        if (coverItem) {
            const href = coverItem.getAttribute('href');
            if (href) {
                const coverPath = opfDir + href.split('#')[0];
                const coverBlob = await zip.file(coverPath)?.async('blob');
                if (coverBlob) cover = await compressImage(coverBlob);
            }
        }
    } catch {
        // 封面失败不阻塞文本导入
    }

    return { text, cover, author };
}

export async function parsePdf(file: File): Promise<BookImportResult> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;

    // 文本逐页
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item) => ('str' in item ? (item as { str: string }).str : ''))
            .join(' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
        if (pageText) pages.push(pageText);
    }
    if (pages.length === 0) throw new Error('未能从 PDF 中提取到文本（可能是扫描版图片 PDF）');
    const text = pages.join('\n\n');

    // 封面 = 第一页渲染
    let cover: string | undefined;
    try {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.6 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            cover = canvas.toDataURL('image/jpeg', 0.75);
        }
    } catch {
        // 封面失败不阻塞
    }

    return { text, cover };
}
