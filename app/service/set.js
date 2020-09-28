// 市场
const Service = require('egg').Service;
class SetService extends Service {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Set;
  }

  /**
   * 查询
   *
   * @param {*} {
   *     search = {},
   *     page = 1,
   *     limit = 10,
   *     sort = {
   *       updatedAt: -1,
   *       _id: 1,
   *     },
   *   }
   * @returns
   * @memberof SetService
   */
  async index({
    search = {},
    page = 1,
    limit = 10,
    sort = { updatedAt: -1, _id: 1 },
  }) {
    const { ctx, model } = this;
    // 组装搜索条件
    const query = ctx.helper.GMQC({
      search,
      config: {
        condition: [{ field: 'market', cond: "ObjectId('$$')" }],
      },
    });
    return await model.paginate(query, {
      limit,
      page,
      lean: true,
      sort,
    });
  }

  /**
   * 创建修改
   *
   * @param {*} argument
   * @returns
   * @memberof SetService
   */
  async update(...argument) {
    const { model } = this;
    return await model.findOneAndUpdate(...argument).lean();
  }
}

module.exports = SetService;
