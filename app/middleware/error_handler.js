const stackTrace = require('stack-trace');
module.exports = () => {
  return async function errorHandler(ctx, next) {
    try {
      await next();
    } catch (err) {
      // 所有的异常都在 app 上触发一个 error 事件，框架会记录一条错误日志
      ctx.app.emit('error', err, ctx);
      const status = err.status || 500;
      if (ctx.app.config.env === 'prod' && status == 500) {
        await ctx.service.dingtalk.send({
          type: `服务端 ${err.name}`,
          details: err.message,
          content: stackTrace.parse(err).slice(0, 3),
        });
      }
      // 生产环境时 500 错误的详细错误内容不返回给客户端，因为可能包含敏感信息
      const error =
        status === 500 && ctx.app.config.env === 'prod'
          ? '网络异常，请稍后再试'
          : err.message;
      // 从 error 对象上读出各个属性，设置到响应中
      ctx.body = {
        // code: status,
        msg: error,
      };
      ctx.status = status;
    }
  };
};
