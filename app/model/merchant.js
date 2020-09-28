// 商户表
const Joi = require('@hapi/joi');
module.exports = (app) => {
  const schemaName = 'Merchant';
  const mongoose = app.mongoose;
  const conn = app.mongooseDB.get('ddhmit');
  const Joigoose = require('joigoose')(mongoose, null, {
    _id: true,
    timestamps: true,
  });
  const ctx = app.createAnonymousContext();
  const schema = Joi.object({
    // 市场
    market: Joi.custom(ctx.helper.joiObjectIdValid())
      .meta({
        _mongoose: {
          type: 'ObjectId',
          ref: 'Market',
          immutable: true,
        },
      })
      .required(),
    // 余额
    balance: Joi.number().meta({
      _mongoose: {
        default: 0,
      },
    }),
    // 商户名称
    name: Joi.string()
      .meta({
        _mongoose: {
          unique: true,
          trim: true,
          immutable: true,
        },
      })
      .required(),
    // 主体责任人
    user: Joi.custom(ctx.helper.joiObjectIdValid())
      .meta({
        _mongoose: {
          type: 'ObjectId',
          ref: 'User',
          immutable: true,
        },
      })
      .required(),
    // 积分
    integral: Joi.number().meta({
      _mongoose: {
        default: 0,
      },
    }),
    // 营业执照
    businessLicense: Joi.object({
      creditCode: Joi.string(), // 统一社会信用代码
      photo: Joi.string()
        .meta({
          // 营业执照照片
          _mongoose: {
            default: '',
          },
        })
        .allow(''),
    }),
    // 租房合同
    rentalContract: Joi.object({
      page1: Joi.string()
        .meta({
          // 第一页
          _mongoose: {
            default: '',
          },
        })
        .allow(''),
      page999: Joi.string()
        .meta({
          // 最后一页
          _mongoose: {
            default: '',
          },
        })
        .allow(''),
    }),
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
        status: Joi.string()
          .meta({
            _mongoose: {
              default: '审核中',
            },
          })
          .valid('审核中', '正常', '审核不通过'),
        role: Joi.string()
          .valid('普通员工')
          .meta({
            _mongoose: {
              default: '普通员工',
            },
          }),
      })
    ),
    // 商户开关
    enable: Joi.bool().meta({
      _mongoose: {
        default: true,
      },
    }),
    // 绑定的车辆
    car: Joi.array().items(
      Joi.object({
        // 车牌号
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
    // 状态
    status: Joi.string()
      .meta({
        _mongoose: {
          default: '审核中',
        },
      })
      .valid('审核不通过', '正常', '审核中'),
  });
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
