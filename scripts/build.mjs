import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { sources, targetAppIds, excludeAppIds, groupPolicy } from '../config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const SUB_ID = 521;
const SUB_META = {
  id: SUB_ID,
  name: 'hkx521 白名单全量订阅',
  author: 'hkx521',
  description:
    'GitHub Actions 每日从多个社区订阅源合并去重：保留全部全局规则组 + 白名单 App 的全部专项规则组（筛选策略见 config.mjs 的 groupPolicy）。',
  supportUri: 'https://github.com/hkx521/gkd-custom-subscription',
  checkUpdateUrl: 'https://raw.githubusercontent.com/hkx521/gkd-custom-subscription/main/dist/gkd.version.json5',
};

const targetSet = new Set(targetAppIds);

/** 类别词表：用于把"全局组"和"App 专项组"对到同一场景，跨源判断覆盖关系 */
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

/** 取名字里最早出现的类别词；"通知提示-开屏弹窗" 归 通知提示 而非 开屏 */
function categoryOf(name) {
  const s = String(name || '');
  let best = null;
  let bestIndex = Infinity;
  for (const c of CATEGORIES) {
    const i = s.indexOf(c);
    if (i !== -1 && i < bestIndex) {
      bestIndex = i;
      best = c;
    }
  }
  return best ?? '其他';
}

function asRules(rules) {
  if (rules == null) return [];
  return Array.isArray(rules) ? rules : [rules];
}

/** 组保留策略：include 为空即全放行（当前默认不再只提纯开屏） */
function keepGroup(group) {
  if (!group || typeof group.name !== 'string') return false;
  if (asRules(group.rules).length === 0) return false;
  const { include = [], exclude = [] } = groupPolicy;
  if (include.length && !include.some((re) => re.test(group.name))) return false;
  if (exclude.some((re) => re.test(group.name))) return false;
  return true;
}

function normName(name) {
  return String(name || '').replace(/[\s\-—_【】\[\]（）()「」,，。.、]/g, '');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** 递归剥离 key，用于跨源比较规则是否等价 */
function stripKeys(rules) {
  return asRules(rules).map((r) => {
    const { key, rules: nested, ...rest } = r;
    return nested ? { ...rest, rules: stripKeys(nested) } : rest;
  });
}

function ruleSignature(group) {
  return sha256(stableStringify(stripKeys(asRules(group.rules))));
}

let ruleKeySeq = 1_000_000;
const nextRuleKey = () => ++ruleKeySeq;

/** 重编组内所有（含嵌套）规则的 key，并同步重写引用了 rule key 的字段 */
function rekeyGroupRules(group, newGroupKey, groupKeyMap) {
  const ruleKeyMap = new Map();

  const walk = (rules) =>
    rules.map((r) => {
      const out = { ...r };
      const nk = nextRuleKey();
      if (r.key !== undefined && r.key !== null) ruleKeyMap.set(r.key, nk);
      out.key = nk;
      const nested = asRules(r.rules);
      if (nested.length) out.rules = walk(nested);
      remapRuleRefs(out, ruleKeyMap);
      return out;
    });

  const out = { ...group, key: newGroupKey };
  out.rules = walk(asRules(group.rules));
  remapRuleRefs(out, ruleKeyMap);
  if (Array.isArray(out.scopeKeys)) {
    const mapped = out.scopeKeys.map((k) => groupKeyMap?.get(k)).filter((k) => k !== undefined);
    if (mapped.length) out.scopeKeys = mapped;
    else delete out.scopeKeys;
  } else {
    delete out.scopeKeys;
  }
  return out;
}

/** actionMaximumKey / actionCdKey / preKeys 都指向同组内的 rule key */
function remapRuleRefs(obj, ruleKeyMap) {
  for (const field of ['actionMaximumKey', 'actionCdKey']) {
    if (obj[field] !== undefined && obj[field] !== null) {
      const mapped = ruleKeyMap.get(obj[field]);
      if (mapped === undefined) delete obj[field];
      else obj[field] = mapped;
    }
  }
  if (Array.isArray(obj.preKeys)) {
    const mapped = obj.preKeys.map((k) => ruleKeyMap.get(k)).filter((k) => k !== undefined);
    if (mapped.length) obj.preKeys = mapped;
    else delete obj.preKeys;
  }
}

/**
 * 重写全局组的 apps 覆盖表。
 * 上游全局组里绝大多数 enable:false 是"该 App 已有同场景专项组，故关闭全局组"的联动产物；
 * 我们的订阅只保留白名单 App 的专项组，照抄这些 false 会让其余 App 失去该场景防护。
 * 因此：仅当该 App 在我们的订阅里确实有同类别专项组时才保留关闭项，其余丢弃，最后按黑名单补回。
 */
function applyExclusions(appEntries, category, coveredCategories) {
  const byId = new Map();
  for (const a of appEntries || []) {
    if (!a || !a.id || byId.has(a.id)) continue;
    if (a.enable === false && !coveredCategories.get(a.id)?.has(category)) continue;
    byId.set(a.id, { ...a });
  }
  for (const id of excludeAppIds) {
    const existing = byId.get(id);
    if (existing) existing.enable = false;
    else byId.set(id, { id, enable: false });
  }
  return [...byId.values()];
}

async function fetchText(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
      if (!resp.ok) throw new Error(`http ${resp.status} ${resp.statusText}`);
      return await resp.text();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

function collectAppGroups(sub, sourceIndex) {
  const out = [];
  for (const app of sub.apps || []) {
    if (!targetSet.has(app.id)) continue;
    for (const g of app.groups || []) {
      if (keepGroup(g)) out.push({ appId: app.id, appName: app.name, group: g, sourceIndex });
    }
  }
  return out;
}

/**
 * 同一 App 内跨源去重：
 * 1) 规则签名完全相同 -> 同一组，保留规则更多的；
 * 2) 归一化组名相同 -> 同一组，保留规则更多的。
 * 不再剥离类别前缀：现在保留全部类别，"全屏广告-X" 与 "局部广告-X" 是两个不同场景，不能合并。
 */
function dedupeAppGroups(candidates) {
  const byName = new Map();
  for (const c of candidates) {
    const k = normName(c.group.name);
    const prev = byName.get(k);
    if (!prev || ruleCount(c) > ruleCount(prev)) byName.set(k, c);
  }
  const bySig = new Map();
  for (const c of byName.values()) {
    const k = ruleSignature(c.group);
    const prev = bySig.get(k);
    if (!prev || ruleCount(c) > ruleCount(prev)) bySig.set(k, c);
  }
  return [...bySig.values()];
}

function ruleCount(c) {
  return countRules(c.group.rules).n;
}

function countRules(rules, acc = { n: 0 }) {
  for (const r of asRules(rules)) {
    acc.n++;
    const nested = asRules(r.rules);
    if (nested.length) countRules(nested, acc);
  }
  return acc.n;
}

async function main() {
  const fetched = [];
  const sourceReports = [];

  for (const [i, src] of sources.entries()) {
    try {
      const text = await fetchText(src.url);
      const sub = JSON5.parse(text);
      if (!sub || (!Array.isArray(sub.globalGroups) && !Array.isArray(sub.apps))) {
        throw new Error('unexpected shape: no globalGroups/apps');
      }
      fetched.push({ src, sub, i });
      sourceReports.push({
        name: src.name,
        ok: true,
        upstreamVersion: sub.version ?? null,
        kb: Math.round(text.length / 1024),
      });
      console.log(`[ok]   ${src.name} ${(text.length / 1024) | 0}KB ver=${sub.version}`);
    } catch (e) {
      sourceReports.push({ name: src.name, ok: false, error: String(e.message || e).slice(0, 120) });
      console.warn(`[FAIL] ${src.name}: ${e.message}`);
    }
  }

  if (fetched.length === 0) throw new Error('所有上游源都拉取失败，拒绝发布空订阅');

  // 1) App 级专项组：白名单 + 跨源去重（先算，全局组需要它的覆盖结果）
  const candidatesByApp = new Map();
  for (const { sub, i } of fetched) {
    for (const c of collectAppGroups(sub, i)) {
      if (!candidatesByApp.has(c.appId)) candidatesByApp.set(c.appId, []);
      candidatesByApp.get(c.appId).push(c);
    }
  }

  const apps = [];
  const coveredCategories = new Map();
  let keptGroups = 0;
  for (const id of [...candidatesByApp.keys()].sort()) {
    const deduped = dedupeAppGroups(candidatesByApp.get(id)).sort(
      (a, b) => a.sourceIndex - b.sourceIndex || Number(a.group.key) - Number(b.group.key)
    );
    if (!deduped.length) continue;
    const groupKeyMap = new Map();
    deduped.forEach((c, idx) => groupKeyMap.set(c.group.key, idx));
    const groups = deduped.map((c, idx) => rekeyGroupRules(c.group, idx, groupKeyMap));
    keptGroups += groups.length;
    coveredCategories.set(id, new Set(groups.map((g) => categoryOf(g.name))));
    apps.push({
      id,
      name: deduped.find((c) => c.appName)?.appName ?? null,
      groups,
    });
  }

  // 2) 全局组：按类别 + 规则签名去重，每类最多保留 globalGroupsPerCategory 个
  const perCat = groupPolicy.globalGroupsPerCategory ?? 2;
  const globalGroups = [];
  const seenSigByCat = new Map();
  const keptSigByCat = new Map();
  const globalContributors = new Map();
  let phantomDisables = 0;
  for (const { src, sub } of fetched) {
    for (const g of sub.globalGroups || []) {
      if (!keepGroup(g)) continue;
      const cat = categoryOf(g.name);
      const seen = seenSigByCat.get(cat) || new Set();
      seenSigByCat.set(cat, seen);
      const sig = ruleSignature(g);
      if (seen.has(sig)) continue;
      seen.add(sig);
      const keptCount = keptSigByCat.get(cat) || 0;
      if (keptCount >= perCat) {
        console.log(`[skip] 全局组「${cat}」已达上限 ${perCat}: ${src.name} / ${g.name}`);
        continue;
      }
      keptSigByCat.set(cat, keptCount + 1);
      globalContributors.set(globalGroups.length, `${src.name} :: ${g.name}`);
      const originalDisables = new Set(
        (g.apps || []).filter((a) => a && a.enable === false).map((a) => a.id)
      );
      const appsOut = applyExclusions(g.apps, cat, coveredCategories);
      phantomDisables +=
        originalDisables.size - appsOut.filter((a) => a.enable === false).length;
      const groupKeyMap = new Map([[g.key, globalGroups.length]]);
      globalGroups.push(
        rekeyGroupRules({ ...g, apps: appsOut }, globalGroups.length, groupKeyMap)
      );
    }
  }

  // 3) 唯一性断言（GKD 会对重复 key 做 distinctBy 静默丢弃，见 RawSubscription.kt）
  assertUniqueKeys(globalGroups, apps);

  if (globalGroups.length === 0) throw new Error('合并后 0 个全局组，筛选策略或上游结构已变化');
  if (apps.length === 0) throw new Error('合并后 0 个白名单 App 有规则，筛选策略或白名单已失效');

  // version 不参与哈希：内容不变 -> 版本号不变 -> 文件字节不变 -> CI 无 diff 不提交
  const contentHash = sha256(stableStringify({ ...SUB_META, globalGroups, apps }));

  const prev = readPrevious();
  const version = prev.hash === contentHash && prev.version > 0 ? prev.version : prev.version + 1;

  if (!Number.isInteger(version) || version <= 0) throw new Error(`非法 version: ${version}`);

  const finalPayload = { ...SUB_META, version, globalGroups, apps };
  const versionObj = { id: SUB_ID, version };

  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const byCategory = {};
  for (const g of globalGroups) byCategory[categoryOf(g.name)] = (byCategory[categoryOf(g.name)] || 0) + 1;
  const appCategoryCount = {};
  for (const a of apps)
    for (const g of a.groups) appCategoryCount[categoryOf(g.name)] = (appCategoryCount[categoryOf(g.name)] || 0) + 1;

  const report = {
    policy: {
      include: groupPolicy.include.map(String),
      exclude: groupPolicy.exclude.map(String),
      globalGroupsPerCategory: perCat,
      whitelistApps: targetAppIds.length,
    },
    sources: sourceReports,
    merged: {
      phantomDisableEntriesDropped: phantomDisables,
      globalGroupsByCategory: byCategory,
      appGroupsByCategory: appCategoryCount,
      globalGroups: globalGroups.map((g, i) => ({
        key: g.key,
        name: g.name,
        rules: countRules(g.rules).n,
        appOverrides: (g.apps || []).length,
        from: globalContributors.get(i) ?? null,
      })),
      apps: apps.map((a) => ({
        id: a.id,
        groups: a.groups.map((g) => ({ key: g.key, name: g.name, rules: countRules(g.rules).n })),
      })),
    },
  };

  fs.writeFileSync(path.resolve(distDir, 'gkd.json5'), JSON5.stringify(finalPayload, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(distDir, 'gkd.json'), JSON.stringify(finalPayload, null, 2), 'utf8');
  fs.writeFileSync(path.resolve(distDir, 'gkd.version.json5'), JSON5.stringify(versionObj), 'utf8');
  fs.writeFileSync(path.resolve(distDir, 'content_hash.txt'), `${contentHash}\n`, 'utf8');
  fs.writeFileSync(path.resolve(distDir, 'build-report.json'), JSON.stringify(report, null, 2), 'utf8');

  let totalRules = 0;
  const walkAll = (rs) => {
    for (const r of asRules(rs)) {
      totalRules++;
      walkAll(r.rules);
    }
  };
  for (const g of globalGroups) walkAll(g.rules);
  for (const a of apps) for (const g of a.groups) walkAll(g.rules);

  console.log(`\n🎉 Build Success!`);
  console.log(`- 源: ${fetched.length}/${sources.length} 成功`);
  console.log(`- 全局组: ${globalGroups.length} (${Object.entries(byCategory).map(([k, v]) => `${k}:${v}`).join(' ')})`);
  console.log(`  其中丢弃上游联动关闭项 ${phantomDisables} 条，避免 App 失去对应场景防护`);
  console.log(`- 白名单 App: ${apps.length}/${targetAppIds.length}，专项组 ${keptGroups} 个`);
  console.log(`- 规则总数: ${totalRules}`);
  console.log(`- version: ${prev.version} -> ${version} (内容${prev.hash === contentHash ? '未变化' : '已变化'})`);
  console.log(`- gkd.json5: ${(fs.statSync(path.resolve(distDir, 'gkd.json5')).size / 1024).toFixed(2)} KB`);
}

function assertUniqueKeys(globalGroups, apps) {
  const gk = new Set();
  for (const g of globalGroups) {
    if (gk.has(g.key)) throw new Error(`全局组 key 重复: ${g.key}`);
    gk.add(g.key);
  }
  const rk = new Set();
  const walkRules = (rules, where) => {
    for (const r of rules) {
      if (r.key !== undefined && r.key !== null) {
        if (rk.has(r.key)) throw new Error(`规则 key 重复: ${r.key} @ ${where}`);
        rk.add(r.key);
      }
      const nested = asRules(r.rules);
      if (nested.length) walkRules(nested, where);
    }
  };
  for (const g of globalGroups) walkRules(asRules(g.rules), `global:${g.name}`);
  for (const a of apps) {
    const ks = new Set();
    for (const g of a.groups) {
      if (ks.has(g.key)) throw new Error(`App ${a.id} 组 key 重复: ${g.key}`);
      ks.add(g.key);
      walkRules(asRules(g.rules), `${a.id}:${g.name}`);
    }
  }
}

function readPrevious() {
  let version = 0;
  let hash = '';
  try {
    const v = JSON5.parse(fs.readFileSync(path.resolve(distDir, 'gkd.version.json5'), 'utf8'));
    version = Number(v.version) || 0;
  } catch {
    /* 首次构建 */
  }
  try {
    hash = fs.readFileSync(path.resolve(distDir, 'content_hash.txt'), 'utf8').trim();
  } catch {
    /* 首次构建 */
  }
  return { version, hash };
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
