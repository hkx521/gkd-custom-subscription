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
