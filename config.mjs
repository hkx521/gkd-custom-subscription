/**
 * 上游订阅源列表 —— 数组顺序即优先级（去重时靠前的源胜出）。
 * url 必须是可直接 JSON5 解析的完整订阅文件（dist/*.json5 或 *.json）。
 */
export const sources = [
  {
    name: 'Lin-arm/GKD_subscription',
    url: 'https://raw.githubusercontent.com/Lin-arm/GKD_subscription/main/dist/gkd.json5',
  },
  {
    name: 'ganlinte/GKD-subscription',
    url: 'https://raw.githubusercontent.com/ganlinte/GKD-subscription/main/dist/ganlin_gkd.json5',
  },
  {
    name: 'AIsouler/GKD_subscription',
    url: 'https://raw.githubusercontent.com/AIsouler/GKD_subscription/main/dist/AIsouler_gkd.json5',
  },
  {
    name: 'YaChengMu/gkd_subscription_min',
    url: 'https://raw.githubusercontent.com/YaChengMu/gkd_subscription_min/main/dist/gkd.json5',
  },
  {
    name: 'VolcanoSAhrimp/gkd-rule',
    url: 'https://raw.githubusercontent.com/VolcanoSAhrimp/gkd-rule/main/dist/gkd.json5',
  },
  {
    name: 'mrlctate/gkd-mrlc',
    url: 'https://raw.githubusercontent.com/mrlctate/gkd-mrlc/main/dist/gkd.json5',
  },
  {
    name: 'AIsouler/gkd-subscription',
    url: 'https://raw.githubusercontent.com/AIsouler/gkd-subscription/main/dist/gkd.json5',
  },
  {
    name: 'MengNianxiaoyao/gkd-subscription',
    url: 'https://raw.githubusercontent.com/MengNianxiaoyao/gkd-subscription/main/dist/gkd.json5',
  },
  {
    name: 'gkd-kit/subscription',
    url: 'https://raw.githubusercontent.com/gkd-kit/subscription/main/dist/gkd.json5',
  },
];

/**
 * 组保留策略（作用于全局组与白名单 App 的专项组）
 * - include: RegExp[]，空 = 不做类别限制、全部保留；非空 = 组名命中其一才保留
 * - exclude: RegExp[]，命中即剔除（优先级高于 include）
 * - globalGroupsPerCategory: 每个场景类别最多保留几个"规则不重复"的全局组。
 *   各源的全局组高度重合，堆太多会让同一次启动重复查询多套规则。
 *
 * 想退回"只提纯开屏"：
 *   include: [/开屏/],
 *   exclude: [/(连代理|误触|会员|协议|提示)/],
 *   globalGroupsPerCategory: 3
 */
export const groupPolicy = {
  include: [],
  exclude: [],
  globalGroupsPerCategory: 2,
};

/**
 * 白名单 App 包名配置
 * 仅保留你手机上安装且可能存在开屏广告的目标应用
 */
export const targetAppIds = [
  'cn.com.bodivis.mybody',               // 体脂秤 bodivis
  'com.eg.android.AlipayGphone',          // 支付宝
  'com.taobao.taobao',                    // 淘宝
  'com.jingdong.app.mall',                // 京东
  'com.xunmeng.pinduoduo',                // 拼多多
  'com.taobao.idlefish',                  // 闲鱼
  'com.sina.weibo',                       // 微博
  'com.zhihu.android',                    // 知乎
  'com.xingin.xhs',                       // 小红书
  'com.bilibili.app.in',                  // 哔哩哔哩 (国际版/概念版)
  'tv.danmaku.bili',                      // 哔哩哔哩 (标准版预留)
  'com.ss.android.ugc.aweme',             // 抖音
  'com.baidu.tieba',                      // 百度贴吧
  'com.coolapk.market',                   // 酷安
  'com.autonavi.minimap',                 // 高德地图
  'com.baidu.BaiduMap',                   // 百度地图
  'com.baidu.netdisk',                    // 百度网盘
  'com.quark.clouddrive',                 // 夸克网盘
  'com.qidian.QDReader',                  // 起点读书
  'com.MobileTicket',                     // 铁路12306
  'com.ct.client',                        // 中国电信
  'com.greenpoint.android.mc10086.activity', // 中国移动
  'com.icbc',                             // 中国工商银行
  'cmb.pb',                               // 招商银行
  'com.unionpay',                         // 云闪付
  'com.chinamworld.bocmbci'               // 中国银行
];

/**
 * 明确禁用的应用列表（就算全局开屏匹配到了也跳过）
 */
export const excludeAppIds = [
  'com.tencent.mm',                       // 微信
  'com.tencent.mobileqq',                 // QQ
  'li.songe.gkd',                         // GKD自身
  'mark.via',                             // Via浏览器
  'mark.via.gp',
  'com.android.chrome',                   // Chrome
  'org.telegram.messenger',               // Telegram
  'fork.risin42.nagramx'                  // NagramX
];
