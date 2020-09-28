// 车辆入场出场记录
const Joi = require('@hapi/joi');
module.exports = (app) => {
  const schemaName = 'Car';
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
        },
      })
      .required(),
    // 经过的商户
    pathway: Joi.array().items(
      Joi.object({
        merchant: Joi.string()
          .meta({
            _mongoose: {
              type: 'ObjectId',
              ref: 'Merchant',
            },
          })
          .required(),
        // 操作人
        operator: Joi.string()
          .meta({
            _mongoose: {
              type: 'ObjectId',
              ref: 'User',
            },
          })
          .required(),
        operation: Joi.string()
          .meta({
            _mongoose: {
              index: true,
            },
          })
          .valid('装车', '卸车')
          .required(),
        status: Joi.string()
          .valid('进行中', '放行')
          .meta({
            _mongoose: {
              default: '进行中',
              index: true,
            },
          }),
      })
    ),
    // 车辆信息
    car: Joi.object({
      license: Joi.string().meta({
        _mongoose: {
          index: true,
        },
      }),
      type: Joi.string()
        .meta({
          _mongoose: {
            index: true,
          },
        })
        .valid('三轮车', '非三轮车')
        .required(),
      info: Joi.any(),
    }).required(),
    // 手机号
    phone: Joi.string().regex(
      /^[1](([3][0-9])|([4][5-9])|([5][0-3,5-9])|([6][5,6])|([7][0-8])|([8][0-9])|([9][1,8,9]))[0-9]{8}$/
    ),
    // 出场时间
    outAt: Joi.date().meta({
      _mongoose: {
        index: true,
      },
    }),
  });

  ctx.schema.set = { schemaName, schema };
  const mongooseSchema = new mongoose.Schema(Joigoose.convert(schema), {
    timestamps: true,
  });
  // 自动删除15天前的数据
  mongooseSchema.index(
    {
      createdAt: 1,
    },
    { expireAfterSeconds: 60 * 60 * 24 * 15 }
  );
  // 分页插件
  // mongooseSchema.plugin(require('mongoose-paginate-v2'));
  mongooseSchema.plugin(require('mongoose-aggregate-paginate-v2'));
  // 自动populate
  // mongooseSchema.plugin(require('mongoose-autopopulate'));

  return conn.model(schemaName, mongooseSchema);
};
