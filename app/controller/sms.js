'use strict';
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class SmsController extends Controller {
  constructor(ctx) {
    super(ctx);
    this.schema = Joi.object({
      // 短信模板ID
      type: Joi.number().valid(603935, 603936).required(),
      // 市场ID
      market: Joi.string().required(),
      // 短信环境
      smsScene: Joi.string()
        .valid('注册', '登录', '重置密码', '审核成功', '未通过审核')
        .required(),
      // 手机号
      phone: Joi.string()
        .regex(
          /^[1](([3][0-9])|([4][5-9])|([5][0-3,5-9])|([6][5,6])|([7][0-8])|([8][0-9])|([9][1,8,9]))[0-9]{8}$/
        )
        .required(),
    });
  }

  // 获取验证码
  async create() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.schema, ctx.request.body);
    // 发送短信
    await service.sms.send(payload);
    ctx.helper.success({ ctx });
  }
}

module.exports = SmsController;
