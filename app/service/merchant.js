// 商户
const Service = require('egg').Service;

class MerchantService extends Service {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Merchant;
  }

  /**
   * 校验商户合法性
   *
   * @param {*} { marketId, userId }
   * @returns
   * @memberof MerchantService
   */
  async valid({ marketId, userId }) {
    const { ctx, model } = this;
    // 查询商户
    const res = await model
      .findOne({
        market: marketId,
        $or: [{ user: userId }, { 'staff.user': userId }],
      })
      .lean();
    // 是商户
    if (res) {
      // 存入商户信息
      ctx.store({ marketId, userId }, 'merchant').value = res;
      // 状态是否正常 enable是否为true
      ctx.assert(res.enable, 403, '当前商户已被禁用');
      // 如果当前账号是员工
      const staff = res.staff.find((item) => item.user.equals(userId));
      if (staff) {
        ctx.assert(
          res.status == '正常',
          403,
          `当前商户${res.status}，暂不可用！`
        );
        ctx.assert(staff.status == '正常', 403, `${staff.status}，暂不可用！`);
      }
    }
    return res;
  }

  /**
   * 商户列表
   *
   * @param {*} {
   *     search = {},
   *     page = 1,
   *     limit = 10,
   *     sort = { updatedAt: -1, _id: 1 },
   *   }
   * @returns
   * @memberof MerchantService
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
    const query = ctx.helper.GMQC({
      search,
      config: {
        condition: [
          { field: 'name', cond: '{ $regex: /$$/ }' },
          { field: 'market', cond: "ObjectId('$$')" },
          { field: '_id', cond: "ObjectId('$$')" },
        ],
      },
    });
    return await model.paginate(query, {
      populate: {
        path: 'user',
        select: { name: 1, phone: 1 },
      },
      limit,
      page,
      sort,
      lean: true,
      select,
    });
  }

  /**
   * 修改商户
   *
   * @param {*} argument
   * @returns
   * @memberof MerchantService
   */
  async update(...argument) {
    const { model } = this;
    return await model.findOneAndUpdate(...argument).lean();
  }

  /**
   * 删除商户
   *
   * @param {*} ids
   * @returns
   * @memberof MerchantService
   */
  async delete(ids) {
    const { model } = this;
    return await model.delete({
      _id: { $in: ids },
    });
  }
}

module.exports = MerchantService;
