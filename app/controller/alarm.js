'use strict';
const { v4: uuidv4 } = require('uuid');
const Joi = require('@hapi/joi');
const Controller = require('egg').Controller;
class AlarmController extends Controller {
  constructor(ctx) {
    super(ctx);
    // 发送报警
    this.createSchema = Joi.object({
      // 类型
      type: Joi.string(),
      // 详细信息
      details: Joi.string().required(),
      // 正文
      content: Joi.array().required(),
    });
  }

  // 发送报警
  async create() {
    const { ctx, service } = this;
    // 参数验证
    const payload = ctx.helper.validate(this.createSchema, ctx.request.body);
    await service.dingtalk.send(payload);
    // 设置响应内容和响应状态码
    ctx.helper.success({ ctx });
  }
}

module.exports = AlarmController;
