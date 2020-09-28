// 订单表
module.exports = (app) => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;
  const ObjectId = mongoose.Schema.Types.ObjectId;
  const conn = app.mongooseDB.get('ddhmit');

  const OrderSchema = new Schema(
    {
      market: { type: ObjectId, ref: 'Market' }, // 市场ID
      money: {
        // 订单金额
        type: Number,
      },
      orderType: {
        // 订单类型
        type: String, // 商户套餐充值，商户余额扣除，停车缴费
      },
      paymentOrder: {
        // 三方支付返回的订单号
        type: String,
      },
      payment: {
        // 缴费方式 微信，支付宝，余额
        type: String,
        default: 'weixin',
      },
    },
    {
      timestamps: true,
    }
  );

  return conn.model('Order', OrderSchema);
};
