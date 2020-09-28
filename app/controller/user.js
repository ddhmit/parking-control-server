'use strict';
const path = require('path');
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class UserController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.User;
    this.schema = ctx.schema.User;
    this.changePwdSchema = Joi.object({
      password: Joi.string().required(),
      newPassword: Joi.string().required(),
      confirmPassword: Joi.ref('newPassword'),
    });
  }

  // 用户列表
  async index() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(ctx.schema.Query, ctx.request.body);
    // 本地查询
    // if (ctx.request.host == 'localhost:7002') {
    //   const res = await service.user.index(payload);
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
      const res = await service.user.index({
        ...payload,
        search: {
          ...payload.search,
          market: [store.market._id],
        },
      });
      return ctx.helper
        .success({ ctx, res })
        .logger(store, '市场负责人查询用户列表');
    } else {
      // 查询自己的信息
      const search = {
        _id: [store.user._id],
      };
      const res = await service.user.index({ search });
      return ctx.helper.success({ ctx, res }).logger(store, '查询自己的信息');
    }
  }

  // 完善资料
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
    });
    // 压缩并放置图片
    const imagePath = `/public/uploads/formal/market/${store.market._id}/user/${store.user._id}`;
    payload.idCard.photo.head =
      payload.idCard.photo.head &&
      (await ctx.helper.copyAndCompress(
        path.join(ctx.app.baseDir, 'app', payload.idCard.photo.head),
        imagePath,
        '身份证头像面',
        true
      ));
    payload.idCard.photo.emblem =
      payload.idCard.photo.emblem &&
      (await ctx.helper.copyAndCompress(
        path.join(ctx.app.baseDir, 'app', payload.idCard.photo.emblem),
        imagePath,
        '身份证国徽面',
        true
      ));
    // 修改用户
    const res = await service.user.update(
      {
        market: store.market._id,
        _id: store.user._id,
      },
      payload,
      {
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '完善用户资料');
  }

  // 重置密码
  async changePwd() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.changePwdSchema, ctx.request.body);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market'],
    });
    // 市场负责人查询
    const identity = store.user.identity;
    ctx.assert(identity['市场责任人'], 403, `当前账号，无权操作！`);
    // 判断传递的老密码是否正确 和 两次密码是否一致
    const user = (
      await service.user.index({
        search: {
          market: [store.market._id],
          _id: [store.user._id],
        },
      })
    ).docs[0];
    const verifyPsw = await ctx.compare(payload.password, user.password);
    ctx.assert(verifyPsw, 422, '旧密码错误');
    const password = await ctx.genHash(payload.confirmPassword);
    const res = await service.user.update(
      { _id: store.user._id, market: store.market._id },
      {
        $set: { password },
      },
      {
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    ctx.helper.success({ ctx, res }).logger(store, '市场责任人修改自身密码');
  }
}

module.exports = UserController;
