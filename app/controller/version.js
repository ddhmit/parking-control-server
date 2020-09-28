/*
 * @Author:
 * @Date: 2019-10-18 15:14:39
 * @LastEditors:
 * @LastEditTime: 2019-10-18 19:09:33
 * @Description: 文件下载控制器
 */
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class versionController extends Controller {
  constructor(ctx) {
    super(ctx);
    // 版本号查询
    this.versionIndexSchema = Joi.object({
      // 版本号
      version: Joi.string(),
    });
  }

  async index() {
    const { ctx, service } = this;
    // 校验参数
    const { version } = ctx.helper.validate(
      this.versionIndexSchema,
      ctx.request.body
    );
    const res = await service.version.show(version);
    ctx.helper.success({ ctx, res });
  }
}

module.exports = versionController;
