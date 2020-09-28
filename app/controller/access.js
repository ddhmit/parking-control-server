'use strict';
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class AccessController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.model = ctx.model.User;
    this.schema = Joi.object({
      // 验证码
      code: Joi.string(),
      // 手机号
      phone: Joi.string().regex(
        /^[1](([3][0-9])|([4][5-9])|([5][0-3,5-9])|([6][5,6])|([7][0-8])|([8][0-9])|([9][1,8,9]))[0-9]{8}$/
      ),
      // 账号
      account: Joi.string(),
      // 密码
      password: Joi.string(),
      // 市场ID
      market: Joi.string().required(),
      // app版本号
      version: Joi.string(),
    })
      .without('phone', ['account', 'password'])
      .with('phone', ['code'])
      .without('account', ['phone', 'code', 'version'])
      .with('account', ['password']);

    this.refreshTokenSchema = Joi.object({
      refreshToken: Joi.string().required(),
    });
  }

  async login() {
    const { ctx, service, schema } = this;
    // 参数验证
    const payload = ctx.helper.validate(schema, ctx.request.body);
    // 用户信息
    let user = {};
    // 如果是账号密码登录
    if (payload.account) {
      // 判断当前账号是否已注册
      user = (
        await service.user.index({
          search: {
            market: [payload.market],
            account: [payload.account],
          },
        })
      ).docs[0];
      ctx.assert(user, 404, '未找到用户，账号或市场密钥错误');
      // 判断密码是否正确
      const verifyPsw = await ctx.compare(payload.password, user.password);
      ctx.assert(verifyPsw, 403, '账号或密码错误');
    }
    // 如果是手机号验证码登录
    if (payload.phone) {
      // 最新版本号 判断APP版本
      const latest = await service.version.show('latest');
      ctx.assert(
        // payload.version && payload.version >= latest.version,
        payload.version && payload.version >= '1.1.3',
        406,
        // 前端通过空格分割获取的链接，此处请不要去掉空格
        '低版本已停止维护，请从以下网址获取最新版本 https://park.ddhmit.com/home'
      );
      // 校验验证码
      await service.sms.check(payload);
      // 保存并修改用户
      user = await service.user.update(
        { phone: payload.phone, market: payload.market },
        payload,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
    }
    // 生产token
    const state = { marketId: user.market, userId: user._id };
    const accessToken = await service.token.accessToken(state);
    const refreshToken = await service.token.refreshToken(state);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      state,
      field: ['user', 'market', 'merchant'],
    });
    // 返回token
    ctx.helper
      .success({
        ctx,
        res: {
          ...user,
          accessToken,
          refreshToken,
          identity: store.user.identity,
        },
      })
      .filter()
      .logger(store, '登录');
  }

  async refreshToken() {
    const { app, ctx, service, refreshTokenSchema } = this;
    // 参数验证
    const payload = ctx.helper.validate(
      refreshTokenSchema,
      ctx.request.body,
      () => {
        ctx.assert(false, 410, '身份验证过期，请重新登录');
      }
    );
    // 解密refreshToken
    const { marketId, userId } = ctx.helper.REtokenDecode(payload.refreshToken);
    // 从redis中读取refreshToken
    const refTokenData = await app.redis.get(
      `PARK:${marketId}RefreshToken:${userId}`
    );
    // 比较传过来的和redis中的refreshToken是否一致
    ctx.assert(
      refTokenData === payload.refreshToken,
      410,
      '身份验证过期，请重新登录'
    );
    // 生产token
    const state = { marketId, userId };
    const accessToken = await service.token.accessToken(state);
    const refreshToken = await service.token.refreshToken(state);
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      state,
      field: ['user', 'market', 'merchant'],
    });
    // 返回token
    ctx.helper
      .success({
        ctx,
        res: {
          user: state.user,
          accessToken,
          refreshToken,
          identity: store.user.identity,
        },
      })
      .logger(store, '刷新令牌');
  }
}

module.exports = AccessController;
