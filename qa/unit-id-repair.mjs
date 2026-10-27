// idRepair 逻辑单测（不依赖浏览器）
import esbuild from 'esbuild';
import { createRequire } from 'module';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'utils/idRepair.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: '/tmp/idRepair.cjs',
  logLevel: 'silent',
});
const require = createRequire(import.meta.url);
const { repairIds, repairTreeIds, isValidId } = require('/tmp/idRepair.cjs');

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
};

const BAD = 'undefinedundefinedundefinedundefined-undefinedundefined';

console.log('[1] repairIds：重复 id');
{
  const list = [
    { id: 'aaa', n: 1 },
    { id: 'aaa', n: 2 },
    { id: 'aaa', n: 3 },
  ];
  const r = repairIds(list);
  const ids = r.list.map((x) => x.id);
  ok(r.changed === true, '标记为已改动');
  ok(new Set(ids).size === 3, '3 条 id 全部唯一', ids.join(','));
  ok(r.list.map((x) => x.n).join() === '1,2,3', '业务字段顺序原样保留');
}

console.log('[2] repairIds：假 id（undefined 串）');
{
  const r = repairIds([{ id: BAD, n: 1 }, { id: BAD, n: 2 }]);
  ok(r.list.every((x) => isValidId(x.id)), '全部替换为合法 v4');
  ok(new Set(r.list.map((x) => x.id)).size === 2, '两条不再相同');
}

console.log('[3] repairIds：全合法 → 零改动、同一引用');
{
  const list = [
    { id: '11111111-1111-4111-8111-111111111111', n: 1 },
    { id: '22222222-2222-4222-8222-222222222222', n: 2 },
  ];
  const r = repairIds(list);
  ok(r.changed === false, 'changed = false');
  ok(r.list === list, '返回同一引用（不复制）');
}

console.log('[4] repairTreeIds：子节点 parentId 跟随父节点新 id');
{
  const tree = [
    { id: BAD, parentId: null, title: 'root' },
    { id: 'child-1', parentId: BAD, title: 'c1' },
  ];
  const r = repairTreeIds(tree);
  const root = r.list[0];
  const child = r.list[1];
  ok(isValidId(root.id), '父节点拿到合法 id');
  ok(child.parentId === root.id, '子节点 parentId 指向父节点新 id', `${child.parentId} vs ${root.id}`);
  ok(child.id !== root.id, '子节点 id 不同');
}

console.log('[5] repairTreeIds：父 id 非法时子节点跟随新 id');
{
  const tree = [
    { id: BAD, parentId: null, t: 'a' },
    { id: BAD, parentId: null, t: 'b' },
    { id: 'kid', parentId: BAD, t: 'k' },
  ];
  const r = repairTreeIds(tree);
  const ids = r.list.map((x) => x.id);
  ok(new Set(ids).size === 3, '三个 id 唯一', ids.join(','));
  ok(r.list[2].parentId === ids[0], '子节点指向首个父节点的新 id', r.list[2].parentId);
}

console.log('[5b] repairTreeIds：父 id 合法但重复 → 子仍指向首个（原 id 保留）');
{
  const DUP = '33333333-3333-4333-8333-333333333333';
  const tree = [
    { id: DUP, parentId: null, t: 'a' },
    { id: DUP, parentId: null, t: 'b' },
    { id: '44444444-4444-4444-8444-444444444444', parentId: DUP, t: 'k' },
  ];
  const r = repairTreeIds(tree);
  ok(r.list[0].id === DUP, '首个节点保留原 id');
  ok(r.list[1].id !== DUP, '第二个重发号');
  ok(r.list[2].parentId === DUP, '子节点仍指向原 id', r.list[2].parentId);
}

console.log('[6] 幂等：修复结果再修一次不再变');
{
  const once = repairIds([{ id: 'x' }, { id: 'x' }]).list;
  const twice = repairIds(once);
  ok(twice.changed === false, '二次修复 changed = false');
  ok(twice.list === once, '二次修复同一引用');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
