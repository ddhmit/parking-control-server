// 市场表
const Joi = require('@hapi/joi');
module.exports = (app) => {
  const schemaName = 'Market';
  const mongoose = app.mongoose;
  const conn = app.mongooseDB.get('ddhmit');
  const Joigoose = require('joigoose')(mongoose, null, {
    _id: true,
    timestamps: true,
  });
  const ctx = app.createAnonymousContext();
  const schema = Joi.object({
    // 市场名称
    name: Joi.string()
      .min(5)
      .max(30)
      .meta({
        _mongoose: {
          unique: true,
          trim: true,
          immutable: true,
        },
      })
      .required(),
    // 营业执照
    businessLicense: Joi.object({
      // 统一社会信用代码
      creditCode: Joi.string().required(),
      // 营业执照照片
      photo: Joi.string()
        .regex(
          /^(?:(?:https?|ftp):\/\/)?(?:[\da-z.-]+)\.(?:[a-z.]{2,6})(?:\/\w\.-]*)*\/?\S+\.(gif|jpeg|png|jpg|JPG|bmp)/
        )
        .required(),
    }),
    // 开关
    enable: Joi.bool().meta({
      _mongoose: {
        default: true,
      },
    }),
    // 主体责任人
    user: Joi.string().meta({
      _mongoose: {
        type: 'ObjectId',
        ref: 'User',
      },
    }),
    // 绑定的车辆
    car: Joi.array().items(
      Joi.object({
        num: Joi.string().regex(
          /^(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-HJ-NP-Z]{1}(?:(?:[0-9]{5}[DF])|(?:[DF](?:[A-HJ-NP-Z0-9])[0-9]{4})))|(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9 挂学警港澳]{1})$/
        ),
        // 车辆过期时间
        expired: Joi.date()
          .meta({
            _mongoose: {
              default: '',
            },
          })
          .allow(''),
      })
    ),
    // 员工
    staff: Joi.array().items(
      Joi.object({
        user: Joi.string()
          .meta({
            _mongoose: {
              type: 'ObjectId',
              ref: 'User',
            },
          })
          .required(),
        role: Joi.string()
          .valid('普通员工', '普通保安')
          .meta({
            _mongoose: {
              default: '普通员工',
            },
          }),
      }).required()
    ),
    // 维护过期时间
    expired: Joi.date().required(),
  });
  ctx.schema.set = { schemaName, schema };
  const mongooseSchema = new mongoose.Schema(Joigoose.convert(schema), {
    timestamps: true,
  });
  // 分页插件
  mongooseSchema.plugin(require('mongoose-paginate-v2'));
  // 自动populate
  // mongooseSchema.plugin(require('mongoose-autopopulate'));
  return conn.model(schemaName, mongooseSchema);
};
