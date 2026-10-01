# 🚀 个人专属 GKD 订阅（多源合并 · 白名单全量）

专为 **hkx521** 定制的 GKD 规则订阅：合并多个社区订阅源、跨源去重，只保留自己用的 App。

## 🌟 核心设计
1. **多源合并 + 跨源去重**：
   * 9 个上游源，同一 App 下同名或规则完全相同的组只保留一份（取规则更多的那份）；
   * 全局组按「场景类别 + 规则签名」去重，每类最多保留 `globalGroupsPerCategory` 个。
2. **白名单全量规则**（不再只提纯开屏）：
   * 白名单 App 的**所有**专项组都保留（开屏、全屏/局部/分段广告、更新/评价/通知/权限提示、功能类等）；
   * 全局组对所有已安装 App 生效，不受白名单限制——白名单只决定"哪些 App 额外带专项组"；
   * 黑名单 App（微信、QQ、浏览器、GKD 自身等）在每个全局组里写 `enable: false` 彻底免检。
3. **每日全自动同步**：
   * GitHub Actions 每天拉取上游、合并去重后自动发布；
   * 上游内容无变化时 `version` 不变、不产生空提交；有变化时 `version` 单调 +1；
   * 任一源失败只告警，全部失败或合并结果为空则构建失败并中止发布；
   * 产物再过一遍 `scripts/verify.mjs`（key 唯一性、引用有效性、幽灵关闭项、黑名单覆盖），不通过就红。

## ⚙️ 筛选策略（`config.mjs` 的 `groupPolicy`）

默认全放行。想收紧随时改，不用动 `build.mjs`：

```js
export const groupPolicy = {
  include: [],                    // RegExp[]：只保留组名命中其一的组，例 [/开屏/]
  exclude: [],                    // RegExp[]：命中即剔除，优先级高于 include
  globalGroupsPerCategory: 2,     // 每个场景类别保留几个不重复的全局组
};
```

例：退回"只提纯开屏"就是 `include: [/开屏/]` + `exclude: [/(连代理|误触|会员|协议|提示)/]`。

## 📊 当前构建结果

* 24/26 个白名单 App 有专项组，共 593 组；13 个全局组（9 个类别）；约 1061 条规则；产物约 789 KB。
* 其余靠全局组通配，体脂秤和夸克网盘在所有源里都没有任何规则。

---

## 📚 数据源（数组顺序即合并优先级，见 `config.mjs`）

| 优先级 | 源 | 规模 |
| --- | --- | --- |
| 1 | Lin-arm/GKD_subscription | 1205 KB / 982 App（覆盖最广） |
| 2 | ganlinte/GKD-subscription | 543 KB / 610 App |
| 3 | AIsouler/GKD_subscription | 1012 KB / 886 App |
| 4 | YaChengMu/gkd_subscription_min | 294 KB / 69 App（精选） |
| 5 | VolcanoSAhrimp/gkd-rule | 775 KB / 793 App |
| 6 | mrlctate/gkd-mrlc | 764 KB / 693 App |
| 7 | AIsouler/gkd-subscription | 112 KB / 74 App（自用精简） |
| 8 | MengNianxiaoyao/gkd-subscription | 527 KB / 285 App |
| 9 | gkd-kit/subscription | 502 KB / 610 App（官方默认，兜底） |

其余可调项（`config.mjs`）：
* `targetAppIds`：决定哪些 App 额外带**专项组**（App 数量 26 个，改这里即可）；
* `excludeAppIds`：写进每个全局组的 `enable: false`，彻底免检。

### ⚠️ 一个必须知道的取舍

上游全局组里绝大多数 `enable: false` 条目，含义是"该 App 已有同场景专项组，因此关闭全局组避免重复"。本订阅只保留白名单 App 的专项组，若照抄这些关闭项，被联动排除的 App 会**彻底失去该场景防护**（实测 13 个全局组共 1955 条这类幽灵关闭项）。构建时会按本订阅的实际覆盖结果重算：只有确实保留了**同类别**专项组的 App 才维持关闭，其余一律丢弃。副作用是——若上游是因"该 App 会误点"而非"已有专项组"而关闭全局组，这里会重新启用它。

---

## 📲 GKD 订阅导入方法

在手机上打开 **GKD** -> 点击 **「订阅」** -> 点击右上角 **「+」** -> 选择 **「添加链接」**，粘贴下方任一链接：

### 推荐链接 (国内直连加速 / jsDelivr)
```text
https://fastly.jsdelivr.net/gh/hkx521/gkd-custom-subscription@main/dist/gkd.json5
```
备用 jsDelivr 源：
```text
https://cdn.jsdelivr.net/gh/hkx521/gkd-custom-subscription@main/dist/gkd.json5
```

### GitHub 原生链接 (有代理环境)
```text
https://raw.githubusercontent.com/hkx521/gkd-custom-subscription/main/dist/gkd.json5
```

> GKD 客户端没有订阅定时自更新（源码里只有手动 `refresh()` 路径，无后台调度任务），
> 仓库每天发布新规则后，需要在 **订阅页手动点刷新** 才会拉取。
