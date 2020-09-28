// 开闸
const Service = require('egg').Service;
class GateService extends Service {
  constructor(ctx) {
    super(ctx);
  }
  async open(serialno, redisParams, carUpdate) {
    const { app, service } = this;
    // 出场保存出场时间
    if (carUpdate && redisParams.status == 'ok') {
      await service.car.update(carUpdate, {
        $set: {
          outAt: new Date(),
        },
      });
      // 删除订单数据
      await app.redis.del(`ParkPaying:${serialno}`);
    }
    // 开闸放行
    const redisKey = `IpCameraHeartbeat:${serialno}`;
    // 查询当前抓拍机是否存在心跳
    const heartbeat = await app.redis.get(redisKey);
    if (heartbeat) {
      await app.redis.set(redisKey, JSON.stringify(redisParams), 'EX', 10);
    }
    return redisParams;
  }
}

module.exports = GateService;
