import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { excludeAppIds, targetAppIds } from '../config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const sub = JSON5.parse(fs.readFileSync(path.resolve(rootDir, 'dist/gkd.json5'), 'utf8'));
const asRules = (r) => (r == null ? [] : Array.isArray(r) ? r : [r]);
const CATEGORIES = [
  '开屏',
  '全屏广告',
  '局部广告',
  '分段广告',
  '更新提示',
  '评价提示',
  '通知提示',
  '权限提示',
  '定位提示',
  '青少年模式',
  '功能类',
  '其他',
];
const categoryOf = (name) => {
  const s = String(name || '');
  let best = null;
  let bi = Infinity;
  for (const c of CATEGORIES) {
    const i = s.indexOf(c);
    if (i !== -1 && i < bi) {
      bi = i;
      best = c;
    }
  }
  return best ?? '其他';
};

const problems = [];
const blacklist = new Set(excludeAppIds);
const ruleKeys = new Set();
const walk = (rules, where) => {
  for (const r of rules) {
    if (r.key !== undefined && r.key !== null) {
      if (ruleKeys.has(r.key)) problems.push(`规则 key 重复: ${r.key} @ ${where}`);
      ruleKeys.add(r.key);
    }
    const nested = asRules(r.rules);
    if (nested.length) walk(nested, where);
  }
};
const groupRuleKeys = (g) => {
  const set = new Set();
  const w = (rs) => {
    for (const r of rs) {
      set.add(r.key);
      const n = asRules(r.rules);
      if (n.length) w(n);
    }
  };
  w(asRules(g.rules));
  return set;
};
const checkRefs = (g, where, allowedGroupKeys) => {
  const keys = groupRuleKeys(g);
  const items = [g, ...asRules(g.rules)];
  for (const it of items) {
    for (const f of ['actionMaximumKey', 'actionCdKey']) {
      if (it[f] != null && !keys.has(it[f])) problems.push(`${where} 的 ${f}=${it[f]} 指向不存在的规则 key`);
    }
  }
  if (Array.isArray(g.scopeKeys)) {
    const bad = g.scopeKeys.filter((k) => !allowedGroupKeys.has(k));
    if (bad.length) problems.push(`${where} 的 scopeKeys 指向不存在的组 key: ${bad.join(',')}`);
  }
};

if (!Number.isInteger(sub.version) || sub.version <= 0) problems.push('缺少合法 version（GKD 解析会直接 error）');
if (!sub.id || !sub.name) problems.push('缺少 id/name');
if (!sub.checkUpdateUrl) problems.push('缺少 checkUpdateUrl');
if (!Array.isArray(sub.globalGroups) || sub.globalGroups.length === 0) problems.push('全局组为空');
if (!Array.isArray(sub.apps) || sub.apps.length === 0) problems.push('apps 为空');

const coveredCategories = new Map();
const appIds = sub.apps.map((a) => a.id);
if (new Set(appIds).size !== appIds.length) problems.push('apps 存在重复 id（GKD 会丢弃后面的）');
for (const id of appIds) if (!targetAppIds.includes(id)) problems.push(`apps 出现白名单外的 id: ${id}`);

for (const a of sub.apps) {
  const ks = a.groups.map((g) => g.key);
  if (new Set(ks).size !== ks.length) problems.push(`App ${a.id} 组 key 重复: ${ks}`);
  if (!a.groups.length) problems.push(`App ${a.id} 组为空（GKD 会丢弃整个条目）`);
  const names = a.groups.map((g) => g.name);
  if (new Set(names).size !== names.length) problems.push(`App ${a.id} 存在同名重复组: ${names.join(', ')}`);
  coveredCategories.set(a.id, new Set(a.groups.map((g) => categoryOf(g.name))));
  for (const g of a.groups) {
    if (typeof g.name !== 'string' || !g.name) problems.push(`App ${a.id} 存在无名字组`);
    if (!asRules(g.rules).length) problems.push(`App ${a.id} 组 ${g.name} 无规则`);
    checkRefs(g, `App ${a.id} 组 ${g.name}`, new Set(a.groups.map((x) => x.key)));
    walk(asRules(g.rules), `${a.id}:${g.name}`);
  }
}

const gk = sub.globalGroups.map((g) => g.key);
if (new Set(gk).size !== gk.length) problems.push(`全局组 key 重复: ${gk}`);
for (const g of sub.globalGroups) {
  if (typeof g.name !== 'string' || !g.name) problems.push('存在无名字全局组');
  if (!asRules(g.rules).length) problems.push(`全局组 ${g.name} 无规则`);
  const cat = categoryOf(g.name);
  checkRefs(g, `全局组 ${g.name}`, new Set(gk));
  walk(asRules(g.rules), `global:${g.name}`);
  const off = new Set((g.apps || []).filter((a) => a.enable === false).map((a) => a.id));
  const missingBlacklist = excludeAppIds.filter((i) => !off.has(i));
  if (missingBlacklist.length) problems.push(`全局组 ${g.name} 缺少黑名单: ${missingBlacklist.join(',')}`);
  const phantom = [...off].filter((id) => !blacklist.has(id) && !coveredCategories.get(id)?.has(cat));
  if (phantom.length)
    problems.push(`全局组 ${g.name}(${cat}) 残留幽灵关闭项 ${phantom.length} 个，例: ${phantom.slice(0, 3).join(', ')}`);
}

const appRuleTotal = sub.apps.reduce((s, a) => s + a.groups.reduce((x, g) => x + groupRuleKeys(g).size, 0), 0);
console.log(
  `verify: apps=${sub.apps.length}/${targetAppIds.length} 专项组=${sub.apps.reduce((s, a) => s + a.groups.length, 0)}` +
    ` 全局组=${sub.globalGroups.length} 规则key=${ruleKeys.size} app规则≈${appRuleTotal}` +
    ` version=${sub.version} size=${(fs.statSync(path.resolve(rootDir, 'dist/gkd.json5')).size / 1024).toFixed(1)}KB`
);
console.log(
  '全局组: ' +
    sub.globalGroups.map((g) => `${g.key}:${g.name}(覆盖开关${(g.apps || []).length})`).join('  ')
);
console.log(
  `白名单里无专项组的 App（完全靠全局组通配）: ${targetAppIds.filter((i) => !appIds.includes(i)).join(', ') || '无'}`
);

if (problems.length) {
  console.error('\n❌ 产物校验失败:');
  for (const p of [...new Set(problems)]) console.error('  - ' + p);
  process.exit(1);
}
console.log('✅ 产物校验通过');
