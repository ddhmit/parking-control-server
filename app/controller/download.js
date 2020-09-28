/*
 * @Author:
 * @Date: 2019-10-18 15:14:39
 * @LastEditors:
 * @LastEditTime: 2019-10-18 19:09:33
 * @Description: 文件下载控制器
 */
const fs = require('fs-extra');
const Controller = require('egg').Controller;
class downloadController extends Controller {
  constructor(ctx) {
    super(ctx);
  }

  async index() {
    const { ctx, service } = this;
    let { version } = ctx.params;
    if (version == 'latest') {
      const latest = await service.version.show(version);
      ctx.assert(latest, 404, `无可下载的APK`);
      version = latest.version;
    }
    const filePath = `./app/public/apk/${version}/app-release.apk`;
    const hasFile = await fs.pathExists(filePath);
    ctx.assert(hasFile, 404, `版本号错误`);
    const fileSize = String((await fs.stat(filePath)).size);
    return ctx.downloader(filePath, `zhihuipingtai_${version}.apk`, {
      'Content-Length': fileSize,
    });
  }
}

module.exports = downloadController;
