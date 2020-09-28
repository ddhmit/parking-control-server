// 车辆出入场
const Service = require('egg').Service;
class CarService extends Service {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Car;
  }

  /**
   * 查询车辆出入场记录
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
   * @memberof CarService
   */
  async index(
    {
      search = {},
      page = 1,
      limit = 10,
      sort = { _id: -1, 'pathway._id': -1, 'pathway.status': 1 },
    },
    specialCond = false
  ) {
    const { ctx, model } = this;
    // 组装搜索条件
    const query = ctx.helper.GMQC({
      search,
      config: {
        condition: [
          { field: '_id', cond: "ObjectId('$$')" },
          { field: 'market', cond: "ObjectId('$$')" },
          { field: 'merchant', cond: "ObjectId('$$')" },
          { field: 'operator', cond: "ObjectId('$$')" },
          { field: 'perpage_last_id', cond: "{ $lt: ObjectId('$$') }" },
          { field: 'perpage_last_pathway_id', cond: "{ $lt: ObjectId('$$') }" },
          {
            field: 'createdAt',
            cond: "{ $gte: new Date('$0'), $lte: new Date('$1 23:59:59') }",
          },
        ],
        returnDirectAndIndirect: {
          direct: ['perpage_last_id', 'market', '_id', 'createdAt'],
        },
        prefix$suffix$rename: [
          {
            suff: 'license',
            rename: 'car',
            field: ['carNo'],
          },
          {
            pref: 'pathway',
            field: ['merchant', 'operator', 'operation', 'status'],
          },
          {
            rename: '_id',
            field: ['perpage_last_id'],
          },
          {
            rename: 'pathway._id',
            field: ['perpage_last_pathway_id'],
          },
        ],
      },
    });
    let params = [
      {
        $match: query.direct,
      },
      { $unwind: { path: '$pathway', preserveNullAndEmptyArrays: true } },
      {
        $match: query.indirect,
      },
      {
        // https://stackoverflow.com/questions/50562160/select-fields-to-return-from-lookup
        $lookup: {
          from: 'merchants',
          localField: 'pathway.merchant',
          foreignField: '_id',
          // let: { merchant: '$pathway.merchant' },
          // pipeline: [
          //   {
          //     $match: {
          //       $expr: { $eq: ['$_id', '$$merchant'] },
          //     },
          //   },
          //   { $project: { name: 1 } },
          // ],
          as: 'pathway.merchant',
        },
      },
      {
        $unwind: {
          path: '$pathway.merchant',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'pathway.operator',
          foreignField: '_id',
          // let: { operator: '$pathway.operator' },
          // pipeline: [
          //   {
          //     $match: {
          //       $expr: { $eq: ['$_id', '$$operator'] },
          //     },
          //   },
          //   { $project: { name: 1, phone: 1 } },
          // ],
          as: 'pathway.operator',
        },
      },
      {
        $unwind: {
          path: '$pathway.operator',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
    if (specialCond) {
      params.push({
        $group: {
          _id: '$_id',
          car: { $first: '$car' },
          createdAt: { $first: '$createdAt' },
          market: { $first: '$market' },
          outAt: { $first: '$outAt' },
          updatedAt: { $first: '$updatedAt' },
          pathway: {
            $addToSet: {
              $cond: [{ $ne: ['$pathway', {}] }, '$pathway', null],
            },
          },
        },
      });
    }
    const aggregate = model.aggregate(params);
    return await model.aggregatePaginate(aggregate, {
      allowDiskUse: true,
      limit,
      // page,
      lean: true,
      sort,
    });
  }

  /**
   * 创建修改
   *
   * @param {*} argument
   * @returns
   * @memberof CarService
   */
  async update(...argument) {
    const { model } = this;
    return await model.findOneAndUpdate(...argument).lean();
  }

  /**
   * 删除车辆
   *
   * @param {*} ids
   * @returns
   * @memberof CarService
   */
  async delete(ids) {
    const { model } = this;
    return await model.remove({
      _id: { $in: ids },
    });
  }
}

module.exports = CarService;
