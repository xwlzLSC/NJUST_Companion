/** @maintenance
 * 校历地址、校园功能入口与默认开学日期的共享配置，修改后要同步三个副本并运行项目检查。
 * fallbackStart 是没有自定义日期时的备用值；calendar.imageUrl 仅决定展示哪张官方图片，不触发日期读取。
 * revision 用于维护配置版本，不代表应用安装包版本或云环境 ID。
 */
/* Calendar is an image viewer only. Never infer or set semester dates from it. */
(function(root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.NJUSTCampusConfig = value;
})(typeof window === 'object' ? window : globalThis, function() {
  return {
    revision: '2026-10-03-review-1', fallbackStart: '2026-08-24',
    calendar: {
      academicYear: '2026-2027', verifiedAt: '2026-10-02',
      sourceUrl: 'https://jwc.njust.edu.cn/xnxl/list.htm',
      imageUrl: 'https://jwc.njust.edu.cn/_upload/article/images/dc/b2/da3b8a634f6bbe262c04e6dc4901/8de1ece8-09ae-4ea6-9f1c-758503b1e9ef_d.jpg'
    },
    services: [
      { id: 'review', title: '主修学业审查', icon: '学', description: '学校审查结果 · 未获得课程明细' },
      { id: 'calendar', title: '校历图片', icon: '历', description: '查看官方校历 · 放大原图' }
    ]
  };
});
