'use strict';
const Joi = require('@hapi/joi');
const path = require('path');
const Controller = require('egg').Controller;
class MerchantController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.Merchant;
    this.schema = ctx.schema.Merchant;
    // 审核商户
    this.auditSchema = Joi.object({
      // 商户ID
      merchant: Joi.string().required(),
      // 备注
      remark: Joi.string(),
      // 状态
      status: Joi.string().valid('审核不通过', '正常', '审核中').required(),
    });
    // 新增修改员工
    this.updateStaffSchema = Joi.object({
      // 员工手机
      phone: Joi.string().required(),
      // 员工姓名
      name: Joi.string(),
    });
    // 审核商户员工
    this.auditStaffSchema = Joi.object({
      // 员工ID
      staff: Joi.string().required(),
      // 备注
      remark: Joi.string(),
      // 状态
      status: Joi.string().valid('审核不通过', '正常', '审核中').required(),
    });
    // 删除商户
    this.deleteSchema = Joi.object({
      // 商户ID
      merchants: Joi.array().items(Joi.string().required()).required(),
    });
    // 刪除商户员工
    this.deleteStaffSchema = Joi.object({
      // 员工ID
      user: Joi.string().required(),
    });
    // 新增车辆
    this.updateCarSchema = Joi.object({
      // 商户ID
      merchant: Joi.string().required(),
      // 车牌号
      num: Joi.string()
        .regex(
          /^(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-HJ-NP-Z]{1}(?:(?:[0-9]{5}[DF])|(?:[DF](?:[A-HJ-NP-Z0-9])[0-9]{4})))|(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9 挂学警港澳]{1})$/
        )
        .required(),
      // 车辆过期时间
      expired: Joi.date().allow(''),
    });
    // 积分管理
    this.integralSchema = Joi.object({
      // 商户ID
      merchant: Joi.string().required(),
      // 积分
      integral: Joi.number().required(),
    });
  }

  // 商户列表
  async index() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 本地查询
    // if (ctx.request.host == 'localhost:7002') {
    //   const res = await service.merchant.index(payload);
    //   return ctx.helper.success({ ctx, res });
    // }
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取当前用户身份
    const identity = store.user.identity;
    // 市场负责人查询
    if (identity['市场责任人'] || identity['市场员工']) {
      const res = await service.merchant.index({
        ...payload,
        search: {
          ...payload.search,
          market: [store.market._id],
        },
      });
      return ctx.helper
        .success({ ctx, res })
        .logger(store, '市场负责人查询商户列表');
    } else {
      // 查询自己所在商户的信息
      const search = {
        market: [store.market._id],
        $or: [[{ user: store.user._id }, { 'staff.user': store.user._id }]],
      };
      let select = {};
      if (identity['商户员工']) {
        select = { name: 1, _id: 0 };
      }
      const res = await service.merchant.index({ search, select });
      return ctx.helper
        .success({ ctx, res })
        .logger(store, '查询自己所在商户的信息');
    }
  }

  // 创建修改商户
  async update() {
    const { ctx, service, schema } = this;
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 参数验证
    const payload = ctx.helper.validate(schema, {
      ...ctx.request.body,
      market: store.market._id,
      user: store.user._id,
    });
    // 如果是首次创建商户
    if (!store.merchant) {
      // 检查商户名称是否被占用
      const merchantTotalDocs = (
        await service.merchant.index({
          search: {
            name: [payload.name],
          },
        })
      ).totalDocs;
      ctx.assert(!merchantTotalDocs, 422, '商户名被占用');
      // 生成一个ObjectId
      store.merchant = {
        _id: ctx.app.mongoose.Types.ObjectId(),
      };
    }

    // 压缩并放置图片
    const imagePath = `/public/uploads/formal/market/${store.market._id}/merchant/${store.merchant._id}`;
    payload.businessLicense.photo =
      payload.businessLicense.photo &&
      (await ctx.helper.copyAndCompress(
        path.join(ctx.app.baseDir, 'app', payload.businessLicense.photo),
        imagePath,
        '营业执照照片',
        true
      ));
    payload.rentalContract.page1 =
      payload.rentalContract.page1 &&
      (await ctx.helper.copyAndCompress(
        path.join(ctx.app.baseDir, 'app', payload.rentalContract.page1),
        imagePath,
        '租房合同首页',
        true
      ));
    payload.rentalContract.page999 =
      payload.rentalContract.page999 &&
      (await ctx.helper.copyAndCompress(
        path.join(ctx.app.baseDir, 'app', payload.rentalContract.page999),
        imagePath,
        '租房合同尾页',
        true
      ));

    // 创建商户
    const res = await service.merchant.update(
      {
        _id: store.merchant._id,
        market: store.market._id,
        user: store.user._id,
      },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '修改商户');
  }

  // 审核商户
  async audit() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.auditSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取当前用户身份
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      `当前账号，无权操作！`
    );
    // 修改商户
    const res = await service.merchant.update(
      {
        market: store.market._id,
        _id: payload.merchant,
      },
      {
        $set: {
          status: payload.status,
        },
      },
      {
        new: true,
      }
    );
    let smsScene = '';
    switch (payload.status) {
      case '审核不通过':
        smsScene = '未通过审核';
        break;
      case '正常':
        smsScene = '审核成功';
        break;
    }
    // 获取用户手机
    const user = (
      await service.user.index({
        search: {
          market: [store.market._id],
          _id: [res.user],
        },
      })
    ).docs[0];
    ctx.assert(user, 404, `当前用户不存在`);
    // 发送短信
    await service.sms.send({
      phone: user.phone,
      type: 603936,
      smsScene,
      market: store.market._id,
    });
    ctx.helper.success({ ctx, res }).logger(store, '审核商户');
  }

  // 删除商户
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
      identity['市场责任人'] || identity['市场员工'],
      403,
      `当前账号，无权操作！`
    );
    // 删除商户
    const res = await service.merchant.delete(payload.merchants);
    ctx.helper.success({ ctx, res }).logger(store, '删除商户');
  }

  // 查询商户员工
  async indexStaff() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 当前登录用户身份查询
    const identity = store.user.identity;
    let staff = [];
    if (identity['市场责任人'] || identity['市场员工']) {
      // 参数
      const cond =
        payload.search && payload.search.merchantId
          ? {
              search: {
                _id: [payload.search.merchantId],
                market: [store.market._id],
              },
            }
          : {};
      // 查询负责人所在的市场，取出员工ID
      staff = (await service.merchant.index(cond)).docs[0].staff;
      // 删除多余的merchantId参数
      if (payload.search && payload.search.merchantId)
        delete payload.search.merchantId;
    } else if (identity['商户责任人']) {
      staff = (
        await service.merchant.index({
          search: {
            _id: [store.merchant._id],
            market: [store.market._id],
          },
        })
      ).docs[0].staff;
    } else {
      ctx.assert(false, 403, `当前账号，无权操作！`);
    }
    // 根据员工ID查询用户
    let res = [];
    if (staff.length) {
      res = await service.user.index({
        ...payload,
        search: {
          ...payload.search,
          _id: staff.map((item) => item.user),
          market: [store.market._id],
        },
        select: { password: 0 },
      });
      // 渲染角色字段
      res.docs = res.docs.map((item) => {
        item.role = staff.find((i) => i.user.equals(item._id)).role;
        return item;
      });
      // 渲染审核状态字段
      res.docs = res.docs.map((item) => {
        item.status = staff.find((i) => i.user.equals(item._id)).status;
        return item;
      });
    }
    return ctx.helper.success({ ctx, res }).logger(store, '查询员工');
  }

  // 审核商户员工
  async auditStaff() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(
      this.auditStaffSchema,
      ctx.request.body
    );
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取当前用户身份
    const identity = store.user.identity;
    ctx.assert(
      identity['市场责任人'] || identity['市场员工'],
      403,
      `当前账号，无权操作！`
    );
    // 修改员工审核状态
    const res = await service.merchant.update(
      {
        market: store.market._id,
        'staff.user': payload.staff,
      },
      {
        $set: {
          'staff.$.status': payload.status,
        },
      },
      {
        new: true,
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '审核商户员工');
  }

  // 新增修改商户员工
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
    // 判断当前用户是否为商户责任人
    ctx.assert(identity['商户责任人'], 403, `当前账号，无权操作！`);
    payload.market = store.market._id;
    // 判断当前商户是否有权限修改用户
    const hasUser = await ctx.model.User.findOne({
      market: payload.market,
      phone: payload.phone,
    });
    if (hasUser) {
      const merchantStaff = await ctx.model.Merchant.findOne({
        market: payload.market,
        'staff.user': hasUser._id,
      });
      ctx.assert(
        merchantStaff && merchantStaff._id.equals(store.merchant._id),
        403,
        `无权添加该用户，请修改手机号后重试`
      );
    }
    // 创建用户
    const user = await service.user.update(
      { phone: payload.phone, market: payload.market },
      payload,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
    // 向商户添加员工
    const res = await service.merchant.update(
      {
        _id: store.merchant._id,
        'staff.user': { $ne: user._id },
      },
      {
        $push: {
          staff: {
            $each: [
              {
                user: user._id,
              },
            ],
            $position: 0,
          },
        },
      },
      { new: true }
    );
    ctx.helper.success({ ctx, res }).logger(store, '新增修改商户员工');
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
    // 判断当前用户是否为商户责任人
    ctx.assert(identity['商户责任人'], 403, `当前账号，无权操作！`);
    // 删除商户员工
    const res = await service.merchant.update(
      { _id: store.merchant._id },
      {
        $pull: {
          staff: {
            user: payload.user,
          },
        },
      },
      { new: true }
    );
    ctx.helper.success({ ctx, res }).logger(store, '删除商户员工');
  }

  // 绑定车辆
  async updateCar() {
    const { ctx, service } = this;
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
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
        !(merchantCar.totalDocs || marketCar.totalDocs),
        403,
        `该车辆已被绑定`
      );
    };
    // 判断当前用户身份
    if (identity['市场责任人'] || identity['市场员工']) {
      // 参数验证
      const payload = ctx.helper.validate(
        this.updateCarSchema,
        ctx.request.body
      );
      // 向商户添加车辆
      const res =
        (await service.merchant.update(
          // 修改
          { _id: payload.merchant, 'car.num': payload.num },
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
          return await service.merchant.update(
            { _id: payload.merchant, 'car.num': { $ne: payload.num } },
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
      return ctx.helper
        .success({ ctx, res })
        .logger(store, '市场协助商户绑定车辆');
    }
    // if (identity['商户责任人']) {
    //   // 参数验证
    //   const payload = ctx.helper.validate(this.updateCarSchema, {
    //     ...ctx.request.body,
    //     merchant: store.merchant._id,
    //   });
    //   await judgeCar(payload.num)
    //   // 向商户添加车辆
    //   const res = await service.merchant.update(
    //     { _id: payload.merchant, 'car.num': { $ne: payload.num } },
    //     {
    //       $push: {
    //         car: {
    //           num: payload.num,
    //         },
    //       },
    //     },
    //     { new: true }
    //   );
    //   return ctx.helper.success({ ctx, res }).logger(store, '商户绑定车辆');
    // }
    ctx.assert(false, 403, `当前账号，无权操作！`);
  }

  // 删除车辆
  async deleteCar() {
    const { ctx, service } = this;
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    // 判断当前用户身份
    if (identity['市场责任人'] || identity['市场员工']) {
      // 参数验证
      const payload = ctx.helper.validate(
        this.updateCarSchema,
        ctx.request.body
      );
      // 删除车辆
      const res = await service.merchant.update(
        { _id: payload.merchant },
        {
          $pull: {
            car: {
              num: payload.num,
            },
          },
        },
        { new: true }
      );
      return ctx.helper.success({ ctx, res }).logger(store, '市场删除商户车辆');
    }
    if (identity['商户责任人']) {
      // 参数验证
      const payload = ctx.helper.validate(this.updateCarSchema, {
        ...ctx.request.body,
        merchant: store.merchant._id,
      });
      // 删除车辆
      const res = await service.merchant.update(
        { _id: payload.merchant },
        {
          $pull: {
            car: {
              num: payload.num,
            },
          },
        },
        { new: true }
      );
      return ctx.helper.success({ ctx, res }).logger(store, '商户删除车辆');
    }
    ctx.assert(false, 403, `当前账号，无权操作！`);
  }

  // 积分
  async integral() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.integralSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    ctx.assert(identity['市场责任人'], 403, '当前账号，无权操作');
    const res = await service.merchant.update(
      {
        market: store.market._id,
        _id: payload.merchant,
      },
      {
        $inc: {
          integral: payload.integral,
        },
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '市场责任人增减清空积分');
  }
}

module.exports = MerchantController;
