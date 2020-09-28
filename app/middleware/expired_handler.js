const sleep = require('system-sleep');
const moment = require('moment');
const { random } = require('lodash');
// 市场维护期是否截止
module.exports = () => {
  return async function (ctx, next) {
    // 市场维护期是否截止了 expired 是否大于当前时间
    const now = moment(Date.now());
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['market'],
    });
    const expired = moment(store.market.expired);
    // 维护期到了，速度变慢
    if (expired.diff(now, 'seconds') <= 0) {
      sleep(random(3, 10) * 1000);
    }
    await next();
  };
};
