# 🚀 个人专属精炼 GKD 订阅 (A 选项 - 极致省电)

专为 **hkx521** 定制的极致轻量 GKD 规则订阅。

## 🌟 核心设计
1. **0 后台发热与耗电**：
   * 剔除所有应用内滑动卡片、长按选择、信息流监听；
   * 剔除全局弹窗、更新检测、评价提示、权限提醒；
   * **仅保留【开屏广告】匹配规则**（App 启动 5~9 秒后 GKD 立即休眠，彻底不占 CPU）。
2. **双重开屏保障**：
   * **通配全局开屏规则**：精准匹配绝大多数商业 App（涵盖穿山甲、优量汇、快手联盟及各类原生「跳过」控件）；
   * **专项 App 补充规则**：包含白名单中针对复杂对抗 App 的专属规则；
   * **黑名单彻底免检**：微信、QQ、浏览器等明确无广告的工具直接拉入排除名单，不产生任何事件开销。
3. **每日全自动同步**：
   * 每天自动拉取上游社区最新活跃源，过滤提纯后自动发布，无需手动更新维护。

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
