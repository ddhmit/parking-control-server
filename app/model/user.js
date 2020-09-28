// 用户表
const Joi = require('@hapi/joi');
module.exports = (app) => {
  const schemaName = 'User';
  const mongoose = app.mongoose;
  const conn = app.mongooseDB.get('ddhmit');
  const Joigoose = require('joigoose')(mongoose, null, {
    _id: true,
    timestamps: true,
  });
  const ctx = app.createAnonymousContext();
  const schema = Joi.object({
    // 市场ID
    market: Joi.string()
      .meta({
        _mongoose: {
          type: 'ObjectId',
          ref: 'Market',
          immutable: true,
          // autopopulate: true, 此处不能自动填充,会和其他model形成死循环
        },
      })
      .required(),
    // 姓名
    name: Joi.string(),
    // 身份证
    idCard: Joi.object({
      number: Joi.string()
        .meta({
          _mongoose: {
            default: '',
          },
        })
        .allow(''), // 身份证号码
      photo: Joi.object({
        head: Joi.string()
          .meta({
            // 身份证照片 头像面
            _mongoose: {
              default: '',
            },
          })
          .allow(''),
        emblem: Joi.string()
          .meta({
            // 身份证照片 国徽面
            _mongoose: {
              default: '',
            },
          })
          .allow(''),
      }),
    }),
    // 用户开关
    enable: Joi.bool().meta({
      _mongoose: {
        default: true,
      },
    }),
    // 手机号
    phone: Joi.string().regex(
      /^[1](([3][0-9])|([4][5-9])|([5][0-3,5-9])|([6][5,6])|([7][0-8])|([8][0-9])|([9][1,8,9]))[0-9]{8}$/
    ),
    // 账号
    account: Joi.string(),
    // 密码
    password: Joi.string(),
  }).with('account', 'password');
  ctx.schema.set = { schemaName, schema };
  const mongooseSchema = new mongoose.Schema(Joigoose.convert(schema), {
    timestamps: true,
  });
  // 分页插件
  mongooseSchema.plugin(require('mongoose-paginate-v2'));
  // 软删除
  mongooseSchema.plugin(require('mongoose-delete'), {
    indexFields: true,
    overrideMethods: true,
  });
  // 自动populate
  // mongooseSchema.plugin(require('mongoose-autopopulate'));

  return conn.model(schemaName, mongooseSchema);
};
