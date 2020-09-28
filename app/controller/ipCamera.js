'use strict';
const { isEmpty } = require('lodash');
const Controller = require('egg').Controller;
const PlateType = new Map([
  [0, '未知'],
  [1, '普通蓝牌'],
  [2, '普通黑牌'],
  [3, '普通黄牌'],
  [4, '双层黄牌'],
  [5, '警察车牌'],
  [6, '武警车牌'],
  [7, '双层武警'],
  [8, '单层军牌'],
  [9, '双层军牌'],
  [10, '个性车牌'],
  [11, '新能源小车牌'],
  [12, '新能源大车牌'],
  [13, '大使馆车牌'],
  [14, '领事馆车牌'],
  [15, '民航车牌'],
  [16, '应急车牌'],
]);
class IpCameraController extends Controller {
  constructor(ctx) {
    super(ctx);
  }

  // 车牌识别结果交互
  async alarmInfoPlate() {
    const { ctx, app, service } = this;
    const { AlarmInfoPlate } = ctx.request.body;
    const license = AlarmInfoPlate.result.PlateResult.license;
    app.io.of('/ipCamera').emit('alarmInfoPlate', AlarmInfoPlate);
    const market = ctx.app.mongoose.Types.ObjectId('5eba3a8c835b0e003e8d7456');
    // 当前时间
    const nowDate = Date.now();
    // 军警车判断
    const govCarJugde = () => {
      try {
        return (
          PlateType.get(AlarmInfoPlate.result.PlateResult.type).search(
            /警|军|使|领|应急/
          ) != -1
        );
      } catch (error) {
        return false;
      }
    };
    // 月租车判断
    const vipCarJugde = async () => {
      const params = {
        search: {
          car: [
            {
              $elemMatch: {
                num: license,
                $or: [
                  {
                    expired: { $gte: new Date() },
                  },
                  { expired: { $eq: '' } },
                  { expired: { $eq: null } },
                ],
              },
            },
          ],
        },
      };
      // 如果是市场月租车
      const marketCar = await service.market.index({
        search: {
          ...params.search,
          _id: [market],
        },
      });
      // 如果是商户月租车
      const merchantCar = await service.merchant.index({
        search: {
          ...params.search,
          market: [market],
        },
      });

      const vipArr = [...marketCar.docs, ...merchantCar.docs];
      if (vipArr.length) {
        for (let i = 0, len = vipArr.length; i < len; i++) {
          const car = vipArr[i].car.find((item) => item.num == license);
          if (car) {
            return car;
          }
        }
      }
      return false;
    };
    // 创建车辆入场记录
    const inLog = async () => {
      // 创建车辆出入场记录
      return await service.car.update(
        { _id: ctx.app.mongoose.Types.ObjectId() },
        {
          market,
          car: {
            license,
            type: '非三轮车',
            info: AlarmInfoPlate,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );
    };
    // 创建车辆出场记录
    const outLog = async (query) => {
      return await service.car.update(
        {
          ...query,
          market,
          outAt: null,
        },
        {
          $set: {
            outAt: new Date(),
          },
        }
      );
    };
    let redisParams = {
      status: 'no',
      voice: `一路平安`,
      text: `祝您一路平安`,
    };
    // // 不是小票机摄像头序列号 (2020年5月27日 说的三轮车道同时要过小车，所以取消掉了判断)
    // if (
    //   !['23d022da94b8469b', 'd0c72e4742703228'].includes(
    //     AlarmInfoPlate.serialno
    //   )
    // ) {

    // }

    // 如果是入场
    if (AlarmInfoPlate.deviceName.includes('IN')) {
      // 特殊牌照直接放行
      if (govCarJugde()) {
        redisParams.status = 'ok';
        redisParams.text = redisParams.voice = `军警车免费通行`;
        // 创建车辆出入场记录
        await inLog();
      } else {
        if (
          /^(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-HJ-NP-Z]{1}(?:(?:[0-9]{5}[DF])|(?:[DF](?:[A-HJ-NP-Z0-9])[0-9]{4})))|(?:[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领 A-Z]{1}[A-Z]{1}[A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9 挂学警港澳]{1})$/.test(
            license
          )
        ) {
          redisParams.status = 'ok';
          redisParams.text = redisParams.voice = `临时车,欢迎光临`;
          const _vipCarJugde = await vipCarJugde();
          if (_vipCarJugde) {
            // 格式化时间
            const _preciseDiff = ctx.helper.preciseDiff(
              _vipCarJugde.expired,
              nowDate
            );
            redisParams.text = redisParams.voice = `月租车,欢迎光临`;
            if (
              !_preciseDiff.years &&
              !_preciseDiff.months &&
              _preciseDiff.days <= 10
            ) {
              redisParams.text = redisParams.voice = `月租车剩余${_preciseDiff.days}天${_preciseDiff.hours}小时${_preciseDiff.minutes}分钟`;
            }
          }
          // 创建车辆出入场记录
          await inLog();
        } else {
          redisParams.status = 'no';
          redisParams.text = redisParams.voice = `车辆匹配异常,禁止通行`;
        }
      }
    }
    // 如果是出场
    if (AlarmInfoPlate.deviceName.includes('OUT')) {
      // 特殊牌照直接放行
      if (govCarJugde()) {
        redisParams.status = 'ok';
        redisParams.text = redisParams.voice = `军警车免费通行`;
        // 保存出场时间
        await outLog({ 'car.license': license });
      } else {
        // 判断车牌号是否正确
        const hasCar = await service.car.index({
          search: {
            carNo: [license],
            market: [market],
            outAt: [null],
          },
        });
        if (!hasCar.totalDocs) {
          redisParams.text = `无入场记录,车辆禁止出场`;
          redisParams.voice = `无入场记录,车辆禁止出场`;
        } else {
          // if (hasCar.docs.every((item) => isEmpty(item.pathway))) {
          //   redisParams.text = `该车未经过任何商户`;
          //   redisParams.voice = '车辆禁止出场';
          // }
          // 判断能否出去
          const carCanOut = hasCar.docs.filter(
            (item) => item.pathway.status == '进行中'
          );
          // 不允许通行
          if (carCanOut.length) {
            redisParams.text = `请通知${carCanOut[0].pathway.merchant.name}放行`;
            redisParams.voice = `车辆禁止出场,请等待人工放行`;
          } else {
            const _vipCarJugde = await vipCarJugde();
            if (_vipCarJugde) {
              // 格式化时间
              const _preciseDiff = ctx.helper.preciseDiff(
                _vipCarJugde.expired,
                nowDate
              );
              redisParams.text = redisParams.voice = `月租车,祝您一路平安`;
              if (
                !_preciseDiff.years &&
                !_preciseDiff.months &&
                _preciseDiff.days <= 10
              ) {
                redisParams.text = redisParams.voice = `月租车剩余${_preciseDiff.days}天${_preciseDiff.hours}小时${_preciseDiff.minutes}分钟`;
              }
              redisParams.status = 'ok';
              // 保存出场时间
              await outLog({ _id: hasCar.docs[0]._id });
            } else {
              const carType =
                PlateType.get(AlarmInfoPlate.result.PlateResult.type).search(
                  /蓝牌|小车/
                ) != -1
                  ? '小车'
                  : '大车';
              // 停车缴费计算
              redisParams = await service.parkingCosts.calc({
                serialno: AlarmInfoPlate.serialno,
                hasCar: hasCar.docs[0],
                carType,
              });
              if (redisParams.status == 'ok') {
                // 保存出场时间
                await outLog({ _id: hasCar.docs[0]._id });
                // 删除订单数据
                await app.redis.del(`ParkPaying:${AlarmInfoPlate.serialno}`);
              }
            }
          }
        }
      }
    }

    const serialText = await ctx.helper
      .generateSerialData(`${license},${redisParams.text}`)
      .text();
    const serialVoice = await ctx.helper
      .generateSerialData(`${license},${redisParams.voice}`)
      .voice();
    const res = {
      Response_AlarmInfoPlate: {
        info: redisParams.status,
        content: 'retransfer_stop',
        is_pay: 'true',
        serialData: [
          {
            serialChannel: 0,
            data: serialText.toString('base64'),
            dataLen: serialText.length,
          },
          {
            serialChannel: 0,
            data: serialVoice.toString('base64'),
            dataLen: serialVoice.length,
          },
        ],
      },
    };
    ctx.body = res;
    ctx.status = 200;
    ctx.logger.info('alarmInfoPlate', {
      ...redisParams,
      license,
      serialText,
      serialVoice,
      reqBody: ctx.request.body,
    });
  }

  // 心跳交互数据0064FFFF300B01C7EBBDBBB7D13130D4AA431E
  async heartbeat() {
    const { ctx, app } = this;
    const { heartbeat } = ctx.request.body;
    const redisKey = `IpCameraHeartbeat:${heartbeat.serialno}`;
    // 向socket客户端下发本次心跳
    app.io.of('/ipCamera').emit('heartbeat', heartbeat);
    const hb = await app.redis.get(redisKey);
    const hbJson = hb ? JSON.parse(hb) : {};
    const serialText = await ctx.helper.generateSerialData(hbJson.text).text();
    const serialVoice = await ctx.helper
      .generateSerialData(hbJson.voice)
      .voice();
    const res = {
      Response_Heartbeat: {
        info: hbJson.status || 'no',
        serialData: [
          {
            serialChannel: 0,
            data: hbJson.text && serialText.toString('base64'),
            dataLen: serialText.length,
          },
          {
            serialChannel: 0,
            data: hbJson.voice && serialVoice.toString('base64'),
            dataLen: serialVoice.length,
          },
        ],
        // snapnow: 'yes', // 抓拍
      },
    };
    // 将心跳存放到redis
    await app.redis.set(redisKey, JSON.stringify({ status: 'no' }), 'EX', 30);
    ctx.body = res;
    ctx.status = 200;
    ctx.logger.info('heartbeat', {
      ...hbJson,
      serialText,
      serialVoice,
      reqBody: ctx.request.body,
    });
  }
}

module.exports = IpCameraController;
