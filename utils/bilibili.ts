// B 站视频：从用户粘贴的链接 / BV 号 / av 号里解析出播放器需要的标识。
// 只做客户端能做的事：b23.tv 短链需要跳转解析（跨域拿不到 Location），所以提示用户展开。

import type { BookVideo } from '../types';

const BV_RE = /BV[0-9A-Za-z]{10}/;
const AV_RE = /av(\d{4,})/i;

/** 解析用户输入（完整链接 / BV 号 / av 号 / 含 ?bvid= 的分享串）；失败返回 null */
export const parseBilibiliInput = (input: string): BookVideo | null => {
  const raw = (input || '').trim();
  if (!raw) return null;
  const bv = raw.match(BV_RE);
  if (bv) return { bvid: bv[0], page: 1, addedAt: Date.now() };
  const av = raw.match(AV_RE);
  if (av) return { aid: av[1], page: 1, addedAt: Date.now() };
  return null;
};

/** 是否像 b23.tv 短链（无法在浏览器里解跳转，需要用户先展开） */
export const isB23ShortLink = (input: string): boolean => /b23\.tv/i.test(input || '');

/** 嵌入式播放器地址（官方 iframe 播放器，支持分P） */
export const bilibiliEmbedUrl = (video: BookVideo): string => {
  const q = new URLSearchParams();
  if (video.bvid) q.set('bvid', video.bvid);
  else if (video.aid) q.set('aid', video.aid);
  q.set('page', String(video.page ?? 1));
  q.set('high_quality', '1');
  q.set('danmaku', '0');
  q.set('autoplay', '0');
  return `https://player.bilibili.com/player.html?${q.toString()}`;
};

/** 站内原链接（新窗口打开） */
export const bilibiliWatchUrl = (video: BookVideo): string =>
  video.bvid
    ? `https://www.bilibili.com/video/${video.bvid}${(video.page ?? 1) > 1 ? `?p=${video.page}` : ''}`
    : `https://www.bilibili.com/video/av${video.aid}`;

/** 展示用短标签 */
export const bilibiliLabel = (video: BookVideo): string =>
  video.bvid ? video.bvid : `av${video.aid ?? ''}`;
