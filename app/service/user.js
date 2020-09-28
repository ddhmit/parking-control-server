// 用户
const Service = require('egg').Service;

class UserService extends Service {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.User;
  }

  /**
   * 校验用户合法性
   *
   * @param {*} { marketId, userId }
   * @returns
   * @memberof UserService
   */
  async valid({ marketId, userId }) {
    const { ctx, model } = this;
    // 查询用户
    const res = await model.findById(userId).lean();
    // 获取用户角色
    const identity = await this.identity({
      marketId,
      userId,
    });
    // 存储用户信息
    ctx.store({ marketId, userId }, 'user').value = {
      ...res,
      identity,
    };
    // 用户是否存在
    ctx.assert(res, 404, '当前用户不存在');
    // 用户状态是否正常 enable是否为true
    ctx.assert(res.enable, 403, '当前用户已被禁止登陆');
    return res;
  }

  /**
   * 获取用户身份
   *
   * @param {*} state
   * @returns
   * @memberof UserService
   */
  async identity({ marketId, userId }) {
    const { ctx } = this;
    const marketAdmin = await ctx.model.Market.findOne({
      _id: marketId,
      user: userId,
    });
    const marketStaff1 = await ctx.model.Market.findOne({
      _id: marketId,
      staff: { $elemMatch: { user: userId, role: '普通员工' } },
    });
    const marketStaff2 = await ctx.model.Market.findOne({
      _id: marketId,
      staff: { $elemMatch: { user: userId, role: '普通保安' } },
    });
    const merchantAdmin = await ctx.model.Merchant.findOne({
      market: marketId,
      user: userId,
    });
    const merchantStaff = await ctx.model.Merchant.findOne({
      market: marketId,
      'staff.user': userId,
    });
    return {
      市场责任人: marketAdmin ? true : false,
      市场员工: marketStaff2 ? false : marketStaff1 ? true : false,
      市场保安: marketStaff2 ? true : false,
      商户责任人: merchantAdmin ? true : false,
      商户员工: merchantStaff ? true : false,
    };
  }

  /**
   * 查询用户
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
    select = {},
  }) {
    const { ctx, model } = this;
    // 组装搜索条件
    const query = ctx.helper.GMQC({ search });
    return await model.paginate(query, {
      limit,
      page,
      sort,
      lean: true,
      select,
    });
  }

  /**
   * 完善资料
   *
   * @param {*} argument
   * @returns
   * @memberof UserService
   */
  async update(...argument) {
    const { model } = this;
    return await model.findOneAndUpdate(...argument).lean();
  }

  /**
   * 删除用户
   *
   * @param {*} ids
   * @returns
   * @memberof UserService
   */
  async delete(ids) {
    const { model } = this;
    return await model.delete({
      _id: { $in: ids },
    });
  }
}

module.exports = UserService;
