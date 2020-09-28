const Joi = require('@hapi/joi');
module.exports = {
  // schema 存储器
  schema: {
    Query: Joi.object({
      page: Joi.number().integer(),
      limit: Joi.number().integer(),
      search: Joi.object(),
      sort: Joi.object(),
    }),
    set set({ schemaName, schema }) {
      return (this[schemaName] = schema);
    },
  },

  // 数据寄存器
  store(stateUser = null, key) {
    const that = this;
    const { userId, marketId } = stateUser;
    const redisKey = `PARK:${marketId}User:${userId}Store:${key}`;
    return {
      get value() {
        return (async () => {
          return JSON.parse(await that.app.redis.get(redisKey));
        })();
      },
      set value(obj) {
        return (async () => {
          return await that.app.redis.set(redisKey, JSON.stringify(obj));
        })();
      },
    };
  },
};
