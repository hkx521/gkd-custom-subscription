import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { targetAppIds, excludeAppIds } from '../config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const SOURCE_URL = 'https://raw.githubusercontent.com/MengNianxiaoyao/gkd-subscription/main/dist/gkd.json5';

async function fetchSourceSubscription() {
  console.log('Fetching upstream subscription from:', SOURCE_URL);
  const resp = await fetch(SOURCE_URL);
  if (!resp.ok) {
    throw new Error(`Failed to fetch upstream subscription: ${resp.status} ${resp.statusText}`);
  }
  const rawText = await resp.text();
  console.log(`Fetched upstream subscription (${(rawText.length / 1024).toFixed(1)} KB)`);
  return JSON5.parse(rawText);
}

function isSplashScreenRule(group) {
  if (!group || !group.name) return false;
  const name = group.name;
  return name.includes('开屏') || name.includes('开屏广告') || group.key === 0 || group.key === -1;
}

async function main() {
  const upstream = await fetchSourceSubscription();

  // 1. 处理全局规则 (globalGroups)：只保留【开屏广告】(key: 0)
  const globalGroups = [];
  if (Array.isArray(upstream.globalGroups)) {
    for (const g of upstream.globalGroups) {
      if (g.key === 0 || isSplashScreenRule(g)) {
        const clonedG = { ...g };
        // 排除应用列表
        const apps = [...(clonedG.apps || [])];
        for (const excId of excludeAppIds) {
          if (!apps.some((a) => a.id === excId)) {
            apps.push({ id: excId, enable: false });
          }
        }
        clonedG.apps = apps;
        globalGroups.push(clonedG);
      }
    }
  }

  // 2. 筛选专项 App 规则 (apps)
  const targetSet = new Set(targetAppIds);
  const filteredApps = [];

  if (Array.isArray(upstream.apps)) {
    for (const app of upstream.apps) {
      if (!targetSet.has(app.id)) {
        continue;
      }
      // 过滤只保留开屏广告组
      const splashGroups = (app.groups || []).filter(isSplashScreenRule);
      if (splashGroups.length > 0) {
        filteredApps.push({
          ...app,
          groups: splashGroups
        });
      }
    }
  }

  // 3. 构造自定订阅对象
  // 保持订阅标识为自定义唯一 ID，版本号基于时间戳自增，保证 GKD 每次都能顺利刷新
  const now = new Date();
  const versionNum = Math.floor(now.getTime() / 1000);

  const customSub = {
    id: 521,
    name: '极简开屏专精订阅 (A 选项)',
    version: versionNum,
    author: 'hkx521',
    description: '自动由 GitHub Actions 每日从优质上游提纯，仅保留白名单 App 与全局开屏广告，0 后台监听，极致省电。',
    supportUri: 'https://github.com/hkx521/gkd-custom-subscription',
    checkUpdateUrl: 'https://raw.githubusercontent.com/hkx521/gkd-custom-subscription/main/dist/gkd.version.json5',
    globalGroups,
    apps: filteredApps
  };

  const versionObj = {
    id: customSub.id,
    version: customSub.version
  };

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const json5Path = path.resolve(distDir, 'gkd.json5');
  const jsonPath = path.resolve(distDir, 'gkd.json');
  const versionPath = path.resolve(distDir, 'gkd.version.json5');

  fs.writeFileSync(json5Path, JSON5.stringify(customSub, null, 2), 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(customSub, null, 2), 'utf8');
  fs.writeFileSync(versionPath, JSON5.stringify(versionObj), 'utf8');

  console.log(`\n🎉 Build Success!`);
  console.log(`- Filtered Apps count: ${filteredApps.length}`);
  console.log(`- Global groups count: ${globalGroups.length}`);
  console.log(`- Dist JSON5 file size: ${(fs.statSync(json5Path).size / 1024).toFixed(2)} KB`);
  console.log(`- Output saved to: ${distDir}`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
