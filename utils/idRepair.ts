/**
 * 历史脏 id 修复。
 *
 * 背景：`utils/uuid.ts` 早期的非 HTTPS 降级分支写错了（HEX 只有 16 个字符，
 * 却用整字节 0–255 做索引），在 `http://<IP>` 下生成的是
 * `"undefinedundefined-…"` 这种 140 字符假 id，且碰撞率极高
 * （实测 5000 次只有 1268 个唯一值）。
 *
 * 线上正好是 http://IP（非 secure context），`crypto.randomUUID` 不可用，
 * 所以**用户已有数据里存在大量重复 id**。凡按 id 定位再回写的逻辑
 * （SRS 复习、删一条、编辑某节点）都会改到别的那条。
 *
 * 这里的策略是「读时修复」：id 非法或重复就重发号，写回原存储，
 * 业务字段（进度 / 内容 / 时间）一律不动。修复是幂等的。
 */

import { uuid } from './uuid';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 是否为合法的 v4 UUID 字符串。 */
export const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && UUID_V4_RE.test(id);

const freshId = (taken: Set<string>): string => {
  let id = uuid();
  // uuid() 已保证唯一性，这里只是防御（例如极端降级环境）
  while (taken.has(id)) id = uuid();
  return id;
};

/**
 * 给列表里「非法或重复」的 id 重发号，其余项原样返回。
 * 返回的 `list` 在无改动时与入参同一引用，方便调用方判断。
 */
export const repairIds = <T extends { id: string }>(
  list: T[]
): { list: T[]; changed: boolean } => {
  if (!Array.isArray(list)) return { list, changed: false };
  const seen = new Set<string>();
  let changed = false;
  const out = list.map((item) => {
    const id = item?.id;
    if (!isValidId(id) || seen.has(id)) {
      changed = true;
      const nid = freshId(seen);
      seen.add(nid);
      return { ...item, id: nid };
    }
    seen.add(id);
    return item;
  });
  return { list: changed ? out : list, changed };
};

/**
 * 树形结构（如写作树）：重发号的同时，把子节点的 `parentId` 跟随到父节点的新 id。
 *
 * 注意：若同一个 id 出现多次，子节点会被挂到「首个出现」的那个节点上 ——
 * 重复 id 本身已经无法区分归属，这是能做的最合理修复。
 */
export const repairTreeIds = <T extends { id: string; parentId?: string | null }>(
  nodes: T[]
): { list: T[]; changed: boolean } => {
  if (!Array.isArray(nodes)) return { list: nodes, changed: false };
  const seen = new Set<string>();
  /** oldId → 该 oldId 首个节点修复后的 id */
  const firstNewIdOf = new Map<string, string>();
  let changed = false;

  const pass1 = nodes.map((n) => {
    const oldId = n.id;
    let nid = oldId;
    if (!isValidId(oldId) || seen.has(oldId)) {
      nid = freshId(seen);
      changed = true;
    }
    seen.add(nid);
    if (!firstNewIdOf.has(oldId)) firstNewIdOf.set(oldId, nid);
    return { node: { ...n, id: nid }, parentId: n.parentId };
  });

  const pass2 = pass1.map(({ node }) => {
    const p = node.parentId;
    if (!p) return node;
    const mapped = firstNewIdOf.get(p);
    if (mapped && mapped !== p) {
      changed = true;
      return { ...node, parentId: mapped };
    }
    return node;
  });

  return { list: changed ? pass2 : nodes, changed };
};
