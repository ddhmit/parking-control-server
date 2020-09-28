// 获取版本号
const glob = require('glob');
const path = require('path');
const fs = require('fs-extra');
const Service = require('egg').Service;
class VersionService extends Service {
  constructor(ctx) {
    super(ctx);
  }

  async show(version) {
    const { ctx } = this;
    const apk = await Promise.all(
      glob
        .sync(
          path.join(
            ctx.app.baseDir,
            `app/public/apk/${!version || version == 'latest' ? '*' : version}`
          )
        )
        .map(async (item) => {
          const _version = item.split('/').pop();
          const _log = await fs.readJson(`${item}/log.json`, { throws: false });
          return { ..._log, version: _version };
        })
    );
    if (version) {
      return apk[apk.length - 1];
    }
    return apk;
  }
}

module.exports = VersionService;
