'use strict';
const Controller = require('egg').Controller;
class SetController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.schema = ctx.schema.Set;
  }

  // 查询
  async index() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 市场负责人查询
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      '当前账号无权操作'
    );
    const res = await service.set.index({
      ...payload,
      search: {
        ...payload.search,
        market: [store.market._id],
      },
    });
    ctx.helper.success({ ctx, res }).logger(store, '查询设置');
  }

  // 新增修改设置
  async update() {
    const { ctx, schema, service } = this;
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      '当前账号无权操作'
    );
    // 参数验证
    const payload = ctx.helper.validate(schema, {
      ...ctx.request.body,
      market: store.market._id,
    });
    // 创建修改
    const res = await service.set.update(
      {
        market: store.market._id,
        key: payload.key,
      },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '新增修改设置');
  }
}

module.exports = SetController;
