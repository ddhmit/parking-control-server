'use strict';

const Controller = require('egg').Controller;

class NspController extends Controller {
  async gateOpen() {
    const { ctx, app } = this;
    // socket 传递的参数
    const serialno = ctx.args[0];
    const redisKey = `IpCameraHeartbeat:${serialno}`;
    // 查询当前抓拍机是否存在心跳
    const heartbeat = await app.redis.get(redisKey);
    if (heartbeat) {
      await app.redis.set(
        redisKey,
        JSON.stringify({
          status: 'ok',
          text: '手动开闸,操作成功,道闸已开启',
          voice: '手动开闸,操作成功,道闸已开启',
        }),
        'EX',
        10
      );
    }
    ctx.socket.emit(
      'res',
      heartbeat
        ? {
            serialno,
            msg: '手动开闸,操作成功,道闸已开启',
          }
        : {
            serialno,
            msg: '当前抓拍机已断开',
          }
    );
  }
}

module.exports = NspController;
