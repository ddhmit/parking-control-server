// 设置表
const Joi = require('@hapi/joi');
module.exports = (app) => {
  const schemaName = 'Set';
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
        },
      })
      .required(),
    // 键名
    key: Joi.string().required(),
    // 值
    value: Joi.any(),
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
