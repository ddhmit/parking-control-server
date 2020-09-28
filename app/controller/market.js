'use strict';
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;

class MarketController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Market;
    this.schema = ctx.schema.Market;
    // 创建市场主体责任人schema
    this.updateAdminSchema = Joi.object({
      // 市场ID
      market: Joi.string().required(),
      // 账号
      account: Joi.string().required(),
      // 密码
      password: Joi.string().required(),
      // 确认密码
      confirmPassword: Joi.ref('password'),
    }).with('password', 'confirmPassword');
    // 修改或新增市场员工schema
    this.updateStaffSchema = Joi.object({
      // 账号
      account: Joi.string().required(),
      // 密码
      password: Joi.string().required(),
      // 角色
      role: Joi.string().valid('普通员工', '普通保安').required(),
    });
    // 刪除市场员工
    this.deleteStaffSchema = Joi.object({
      // 员工ID
      user: Joi.string().required(),
    });
    // 新增车辆
    this.updateCarSchema = Joi.object({
      // 车牌号
      num: Joi.string()
        .regex(
          /^(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-HJ-NP-Z]{1}(?:(?:[0-9]{5}[DF])|(?:[DF](?:[A-HJ-NP-Z0-9])[0-9]{4})))|(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9 挂学警港澳]{1})$/
        )
        .required(),
      // 车辆过期时间
      expired: Joi.date().allow(''),
    });
  }

  // 查询市场信息
  async index() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 本地查询
    if (ctx.request.host == 'localhost:7002') {
      const res = await service.market.index(payload);
      return ctx.helper.success({ ctx, res });
    }
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 市场负责人查询
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'] || identity['市场保安'],
      403,
      '当前账号无权操作'
    );
    const res = await service.market.index({
      search: {
        _id: [store.market._id],
      },
    });
    ctx.helper.success({ ctx, res }).logger(store, '查询市场信息');
  }

  // 创建市场
  async update() {
    const { ctx, service } = this;
    // 该接口仅允许本地调用
    ctx.assert(
      ctx.request.host == 'localhost:7002',
      403,
      `非法操作，IP:${ctx.ip}`
    );
    // 参数验证
    const payload = ctx.helper.validate(this.schema, {
      expired: moment().add(1, 'years').format(),
      ...ctx.request.body,
    });
    // 创建修改市场
    const res = await service.market.update(
      {
        $or: [{ name: payload.name }, { _id: payload._id }],
      },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    ctx.helper.success({ ctx, res });
  }

  // 创建市场主体责任人
  async updateAdmin() {
    const { ctx, service } = this;
    // 该接口仅允许本地调用
    ctx.assert(
      ctx.request.host == 'localhost:7002',
      403,
      `非法操作，IP:${ctx.ip}`
    );
    // 参数验证
    const payload = ctx.helper.validate(
      this.updateAdminSchema,
      ctx.request.body
    );
    // 密码加密
    payload.password = await ctx.genHash(payload.password);
    // 创建用户
    const user = await service.user.update(
      { account: payload.account },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    // 向市场添加责任人
    const res = await service.market.update(
      { _id: payload.market },
      {
        $set: {
          user: user._id,
        },
      },
      { new: true }
    );
    ctx.helper.success({ ctx, res });
  }

  // 修改员工密码或新增市场员工
  async updateStaff() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(
      this.updateStaffSchema,
      ctx.request.body
    );
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户是否为市场责任人
    ctx.assert(identity['市场责任人'], 403, `当前账号，无权操作！`);
    // 密码加密
    payload.password = await ctx.genHash(payload.password);
    payload.market = store.market._id;
    // 判断当前市场是否有权限修改用户
    const hasUser = await ctx.model.User.findOne({
      market: payload.market,
      account: payload.account,
    });
    if (hasUser) {
      const marketStaff = await ctx.model.Market.findOne({
        _id: payload.market,
        'staff.user': hasUser._id,
      });
      ctx.assert(marketStaff, 403, `无权添加该用户，请修改账号后重试`);
    }
    // 创建用户
    const user = await service.user.update(
      { account: payload.account, market: payload.market },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    // 向市场添加员工 有就修改 没有就新增
    const res =
      (await service.market.update(
        { _id: store.market._id, 'staff.user': user._id },
        {
          $set: {
            'staff.$.role': payload.role,
          },
        },
        { new: true }
      )) ||
      (await service.market.update(
        { _id: store.market._id, 'staff.user': { $ne: user._id } },
        {
          $push: {
            staff: {
              $each: [
                {
                  user: user._id,
                  role: payload.role,
                },
              ],
              $position: 0,
            },
          },
        },
        { new: true }
      ));

    ctx.helper
      .success({ ctx, res })
      .logger(store, '修改员工密码或新增市场员工');
  }

  // 删除员工
  async deleteStaff() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(
      this.deleteStaffSchema,
      ctx.request.body
    );
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户是否为市场责任人
    ctx.assert(identity['市场责任人'], 403, `当前账号，无权操作！`);
    // 删除用户
    await service.user.delete([payload.user]);
    // 删除市场员工
    const res = await service.market.update(
      { _id: store.market._id },
      {
        $pull: {
          staff: {
            user: payload.user,
          },
        },
      },
      { new: true }
    );
    ctx.helper.success({ ctx, res }).logger(store, '删除市场员工');
  }

  // 查询市场员工
  async indexStaff() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market'],
    });
    // 市场负责人查询
    const identity = store.user.identity;
    ctx.assert(identity['市场责任人'], 403, `当前账号，无权操作！`);
    // 查询负责人所在的市场，取出员工ID
    const staff = (
      await service.market.index({
        search: { _id: [store.market._id] },
      })
    ).docs[0].staff;
    let res = [];
    if (staff.length) {
      // 根据员工ID查询用户
      res = await service.user.index({
        ...payload,
        search: {
          ...payload.search,
          _id: staff.map((item) => item.user),
        },
        select: { password: 0 },
      });
      // 渲染角色字段
      res.docs = res.docs.map((item) => {
        item.role = staff.find((i) => i.user.equals(item._id)).role;
        return item;
      });
    }
    return ctx.helper
      .success({ ctx, res })
      .logger(store, '市场负责人查询市场员工');
  }

  // 绑定车辆
  async updateCar() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.updateCarSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户身份
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      `当前账号，无权操作！`
    );
    // 判断车辆是否已经被绑定
    const judgeCar = async (num) => {
      const merchantCar = await service.merchant.index({
        search: {
          'car.num': [num],
          market: [store.market._id],
        },
      });
      const marketCar = await service.market.index({
        search: {
          'car.num': [num],
          _id: [store.market._id],
        },
      });
      ctx.assert(
        !merchantCar.totalDocs && !marketCar.totalDocs,
        403,
        `该车辆已被绑定`
      );
    };
    // 向市场添加车辆
    const res =
      (await service.market.update(
        // 修改
        { _id: store.market._id, 'car.num': payload.num },
        {
          $set: {
            'car.$.num': payload.num,
            'car.$.expired': payload.expired,
          },
        },
        { new: true }
      )) ||
      (await (async () => {
        // 新增
        await judgeCar(payload.num);
        return await service.market.update(
          { _id: store.market._id, 'car.num': { $ne: payload.num } },
          {
            $push: {
              car: {
                $each: [
                  {
                    num: payload.num,
                    expired: payload.expired,
                  },
                ],
                $position: 0,
              },
            },
          },
          { new: true }
        );
      })());

    ctx.helper.success({ ctx, res }).logger(store, '绑定市场车辆');
  }

  // 删除车辆
  async deleteCar() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.updateCarSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户身份
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      `当前账号，无权操作！`
    );
    // 删除市场车辆
    const res = await service.market.update(
      { _id: store.market._id },
      {
        $pull: {
          car: {
            num: payload.num,
          },
        },
      },
      { new: true }
    );
    ctx.helper.success({ ctx, res }).logger(store, '删除市场车辆');
  }
}

module.exports = MarketController;
