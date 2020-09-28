// 停车缴费
const moment = require('moment');
const Service = require('egg').Service;
class ParkingCostsService extends Service {
  constructor(ctx) {
    super(ctx);
  }

  async calc({ serialno, hasCar, carType }) {
    const { ctx, app, service } = this;

    // 默认响应
    let res = {
      text: '一路平安',
      voice: '祝您一路平安',
      price: 0,
      status: 'no',
    };

    // 当前时间
    const nowDate = Date.now();

    // 停车总时间 分钟
    const parkingTime = moment(nowDate).diff(
      moment(hasCar.createdAt),
      'minutes'
    );

    // 获取收费标准
    const charge = (
      await service.set.index({
        search: {
          key: ['收费标准'],
          market: [hasCar.market],
        },
      })
    ).docs[0].value.find((item) => {
      return (
        item.enable &&
        item.type == carType &&
        item.effectCycle.includes(moment().weekday()) &&
        ctx.helper.checkTimeIsBetween({
          beforeTime: item.effectTime[0],
          afterTime: item.effectTime[1],
        })
      );
    });

    // 如果没有该车型的收费标准直接放行
    if (!charge) {
      res.status = 'ok';
      res.text = res.voice = '免费通行';
      return res;
    }

    //////////////////////////////////////////////////////////////////////////////////////

    // 开始计费
    const {
        freeDuration, //免费时长
        billingCycle, //计费周期
        cycleChargeAmount, //周期收费金额
        startTime, //起步时长
        startMoney, //起步金额;
        capMoney, //封顶金额;
      } = charge,
      dayMinutes = 24 * 60; // 一天的分钟数

    // 停车时长小于等于 免费时长 不收费
    if (parkingTime <= freeDuration) {
      res.status = 'ok';
      res.text = '免费时间内,请通行';
      res.voice = '免费通行';
      return res;
    }
    // 单日金额计算
    const dayMoneyCalc = ({ calcTime, in24Hours = 0 }) => {
      // 计费周期只能为正整数
      let dayPrice = 0;
      if (billingCycle) {
        dayPrice =
          Math.trunc(
            (calcTime - (in24Hours && startTime) + billingCycle - 1) /
              billingCycle
          ) *
            cycleChargeAmount +
          (in24Hours && startMoney);
      }
      return {
        isCap: dayPrice >= capMoney,
        price: Math.min(dayPrice, capMoney),
      };
    };

    // 多日封顶与不封顶的处理方式
    const dayMoneyIsCap = ({ isCap, price, integerDays, decimalDayMinus }) => {
      const _decimalPrice = dayMoneyCalc({ calcTime: decimalDayMinus }).price;
      if (!isCap) {
        return (
          price +
          (integerDays - 1) *
            dayMoneyCalc({
              calcTime: dayMinutes,
            }).price +
          _decimalPrice
        );
      }
      return price * integerDays + _decimalPrice;
    };

    // 应缴费
    res.price = (() => {
      let total = 0;
      const minPrice = Math.min(startMoney, capMoney);
      if (parkingTime <= startTime) {
        return minPrice;
      }
      const startTimeOverDayMinutes = startTime > dayMinutes;
      const _dayMoneyCalc = dayMoneyCalc({
        calcTime: Math.min(parkingTime, dayMinutes),
        in24Hours: startTimeOverDayMinutes ? 0 : 1,
      });
      if (parkingTime > dayMinutes) {
        const lackParkingTime = startTimeOverDayMinutes
          ? parkingTime - startTime
          : parkingTime;
        total = dayMoneyIsCap({
          ..._dayMoneyCalc,
          integerDays: Math.trunc(lackParkingTime / dayMinutes), // 整数部分天,
          decimalDayMinus: lackParkingTime % dayMinutes, // 剩余分钟数,
        });
      } else {
        total = _dayMoneyCalc.price;
      }
      if (startTimeOverDayMinutes) {
        total += minPrice;
      }
      return total;
    })();

    // 格式化时间
    const _preciseDiff = ctx.helper.preciseDiff(nowDate, hasCar.createdAt);
    res.text = res.voice = `停车时长${_preciseDiff.days}天${_preciseDiff.hours}小时${_preciseDiff.minutes}分钟,请缴费${res.price}元`;
    res = { ...res, ..._preciseDiff };

    // 过滤掉car
    let { car, ...otherCarInfo } = hasCar;
    // 向redis中存入 等待支付的车辆信息
    await app.redis.set(
      `ParkPaying:${serialno}`,
      JSON.stringify({
        car: {
          serialno,
          ...otherCarInfo,
          ...hasCar.car,
        },
        payInfo: res,
      }),
      'EX',
      10 * 60
    );
    return res;
  }
}

module.exports = ParkingCostsService;
