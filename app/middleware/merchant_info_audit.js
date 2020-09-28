// 接口能否连接的验证
module.exports = () => {
  return async function (ctx, next) {
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'merchant'],
    });
    // 获取用户身份
    const identity = store.user.identity;
    if (identity['商户责任人']) {
      ctx.assert(
        store.merchant.status == '正常',
        403,
        `${store.merchant.status}，暂不可用！`
      );
    }
    await next();
  };
};
