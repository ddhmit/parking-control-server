'use strict';
const Controller = require('egg').Controller;
class HomeController extends Controller {
  constructor(ctx) {
    super(ctx);
  }

  async index() {
    const { ctx } = this;
    await ctx.render('download');
  }

  // 安装
  async install() {
    const { ctx } = this;
    const { name, account, password, confirmPassword } = ctx.request.body;
    // 创建市场
    const market = await ctx.curl(`${ctx.request.host}/api/market`, {
      method: 'POST',
      contentType: 'json',
      data: { name },
      dataType: 'json',
    });
    ctx.assert(market.status == 200, market.status, market.data);
    // 创建超管
    const admin = await ctx.curl(`${ctx.request.host}/api/market/updateAdmin`, {
      method: 'POST',
      contentType: 'json',
      data: {
        market: market.data.data._id,
        account,
        password,
        confirmPassword,
      },
      dataType: 'json',
    });
    ctx.assert(admin.status == 200, admin.status, admin.data);
    ctx.helper.success({ ctx, res: admin.data.data });
  }
}

module.exports = HomeController;
