// 市场
const Service = require('egg').Service;
const moment = require('moment');
class MarketService extends Service {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Market;
  }

  /**
   * 校验市场合法性
   *
   * @param {*} marketId
   * @returns
   * @memberof MarketService
   */
  async valid({ marketId, userId }) {
    const { ctx, model } = this;
    // 查询市场
    const res = await model.findById(marketId).lean();
    // 存储市场信息
    ctx.store({ marketId, userId }, 'market').value = res;
    // 市场是否存在
    ctx.assert(res, 404, '市场密钥错误');
    // 市场状态是否正常 enable是否为true
    ctx.assert(res.enable, 403, '目前市场处于关闭状态');
    return res;
  }

  /**
   * 查询市场
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
   * @memberof MarketService
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
        condition: [
          { field: 'name', cond: '{ $regex: /$$/ }' },
          { field: '_id', cond: "ObjectId('$$')" },
        ],
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
   * 创建修改市场
   *
   * @param {*} argument
   * @returns
   * @memberof MarketService
   */
  async update(...argument) {
    const { model } = this;
    return await model.findOneAndUpdate(...argument).lean();
  }
}

module.exports = MarketService;
