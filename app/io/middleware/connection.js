module.exports = (app) => {
  return async (ctx, next) => {
    const { app, socket, logger, helper } = ctx;
    const token = socket.handshake.query.token;
    if (!token) {
      return socket.disconnect();
    }
    try {
      const decoded = app.jwt.verify(token, app.config.jwt.secret);
      const state = helper.REtokenDecode(decoded.data);
      // 获取当前登录用户的数据
      const store = await helper.getStore({
        state,
        field: ['user'],
      });
      // 获取当前用户身份
      const identity = store.user.identity;
      if (
        !(
          identity['市场责任人'] ||
          identity['市场员工'] ||
          identity['市场保安']
        )
      ) {
        return socket.disconnect();
      }
    } catch (error) {
      return socket.disconnect();
    }
    await next();
  };
};
