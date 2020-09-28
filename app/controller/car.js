'use strict';
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class CarController extends Controller {
  constructor(ctx) {
    super(ctx);
    // 商户操作车辆 装/卸车、放行
    this.carInOutUpdateSchema = Joi.object({
      carInOutId: Joi.string().required(),
      operation: Joi.string().valid('装车', '卸车').required(),
      status: Joi.string().valid('进行中', '放行').default('进行中'),
      // 手机号
      phone: Joi.string()
        .regex(
          /^[1](([3][0-9])|([4][5-9])|([5][0-3,5-9])|([6][5,6])|([7][0-8])|([8][0-9])|([9][1,8,9]))[0-9]{8}$/
        )
        .allow(''),
    });
    // 删除车辆
    this.deleteSchema = Joi.object({
      // 车辆ID
      cars: Joi.array().items(Joi.string().required()).required(),
    });
    // 手动录入入场记录
    this.manualSchema = Joi.object({
      car: Joi.object({
        license: Joi.string()
          .regex(
            /^(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-HJ-NP-Z]{1}(?:(?:[0-9]{5}[DF])|(?:[DF](?:[A-HJ-NP-Z0-9])[0-9]{4})))|(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9 挂学警港澳]{1})$/
          )
          .required(),
        type: Joi.string().valid('非三轮车').required(),
        info: Joi.any(),
      }).required(),
    });
  }

  // 车辆出入场，装卸货列表
  async index() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    let params = {
        ...payload,
        search: {
          ...payload.search,
          market: [store.market._id],
        },
      },
      specialCond = false;
    // 装卸货列表
    if (ctx.url.includes('loadAndUnload')) {
      params.search['pathway'] = [{ $ne: null }];
      if (identity['商户责任人'] || identity['商户员工']) {
        params.search['merchant'] = [store.merchant._id];
        params.search['operator'] = [store.user._id];
      }
    } else {
      // 出入场列表 将所有pathway 展开
      specialCond = true;
    }
    const res = await service.car.index(params, specialCond);
    if (
      specialCond &&
      res.docs.length &&
      (identity['商户责任人'] || identity['商户员工'])
    ) {
      res.docs[0].pathway.map((item) => {
        if (
          item &&
          !item.operator._id.equals(store.user._id) &&
          item.merchant._id.equals(store.merchant._id) &&
          item.status != '放行'
        ) {
          ctx.throw(
            403,
            `此车辆已锁定，${
              item.operator.name || item.operator.phone
            }正在操作当前车辆`
          );
        }
      });
    }
    return ctx.helper
      .success({ ctx, res })
      .logger(store, '查询车辆出入场，装卸货列表');
  }

  // 商户操作车辆 装/卸车、放行
  async operation() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(
      this.carInOutUpdateSchema,
      ctx.request.body
    );
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户是否为市场责任人
    ctx.assert(
      identity['商户责任人'] || identity['商户员工'],
      403,
      `当前账号，无权操作！`
    );
    // 删除车辆在redis中的收费订单
    const ParkPayingArr = await ctx.app.redis.keys('ParkPaying:*');
    for (let i = 0, len = ParkPayingArr.length; i < len; i++) {
      const carId = JSON.parse(await ctx.app.redis.get(ParkPayingArr[i])).car
        ._id;
      if (carId == payload.carInOutId) {
        await ctx.app.redis.del(ParkPayingArr[i]);
      }
    }
    // 修改车辆入场记录
    const setStatus = await service.car.update(
      { _id: payload.carInOutId, 'pathway.operator': store.user._id },
      {
        $set: {
          phone: payload.phone,
          'pathway.$.status': payload.status,
        },
      },
      {
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    if (payload.status == '放行' && setStatus) {
      // 增加积分
      await service.merchant.update(
        {
          market: store.market._id,
          _id: store.merchant._id,
        },
        {
          $inc: {
            integral: 1,
          },
        }
      );
      ctx.helper
        .success({ ctx, res: setStatus })
        .logger(store, '修改车辆入场装卸货放行记录');
    } else {
      // 新车入场
      const res = await service.car.update(
        {
          _id: payload.carInOutId,
          'pathway.operator': { $ne: store.user._id },
        },
        {
          $push: {
            pathway: {
              $each: [
                {
                  merchant: store.merchant._id,
                  operator: store.user._id,
                  operation: payload.operation,
                  status: payload.status,
                },
              ],
              $position: 0,
            },
          },
        },
        {
          new: true,
          setDefaultsOnInsert: true,
        }
      );
      ctx.helper.success({ ctx, res }).logger(store, '新车入场记录');
    }
  }

  // 删除车辆
  async delete() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.deleteSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取当前用户身份
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'] || identity['市场保安'],
      403,
      `当前账号，无权操作！`
    );
    // 删除车辆
    const res = await service.car.delete(payload.cars);
    ctx.helper.success({ ctx, res }).logger(store, '删除车辆');
  }

  // 手动录入车牌
  async manual() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.manualSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market'],
    });
    // 获取当前用户身份
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'] || identity['市场保安'],
      403,
      `当前账号，无权操作！`
    );
    // 创建车辆出入场记录
    const res = await service.car.update(
      { _id: ctx.app.mongoose.Types.ObjectId() },
      {
        market: store.market._id,
        ...payload,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    return ctx.helper.success({ ctx, res }).logger(store, '创建车辆出入场记录');
  }
}

module.exports = CarController;
