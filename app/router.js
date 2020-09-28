'use strict';
const tenpay = require('tenpay');
/**
 * @param {Egg.Application} app - egg application
 */
module.exports = (app) => {
  const { router, controller, io, config } = app;
  /* 
    CRUD 路由结构 router.resources
    GET	    /any	         any	    app.controllers.any.index
    GET	    /any/new	     new_post	  app.controllers.any.new
    GET	    /any/:id	     post	      app.controllers.any.show
    GET	    /any/:id/edit	 edit_post	app.controllers.any.edit
    POST	  /any	         any	    app.controllers.any.create
    PUT	    /any/:id	     post	      app.controllers.any.update
    DELETE	/any/:id	     post	      app.controllers.any.destroy 
  */

  // 本地接口
  router.post('/api/local/market', controller.market.update); // 创建市场
  router.post('/api/local/market/updateAdmin', controller.market.updateAdmin); // 创建市场主体责任人

  // 安装页
  router.get('/home', controller.home.index); // 安装界面
  router.get('/home/install', controller.home.install); // 安装界面

  // 市场
  router.post('/api/market/index', controller.market.index);

  // 市场车辆管理
  router.post('/api/market/car/update', controller.market.updateCar); // 新增修改
  router.post('/api/market/car/delete', controller.market.deleteCar); // 删除

  // 市场员工
  router.post('/api/market/staff/update', controller.market.updateStaff); // 新增修改
  router.post('/api/market/staff/delete', controller.market.deleteStaff); // 删除
  router.post('/api/market/staff/index', controller.market.indexStaff); // 查询

  // 商户
  router.post('/api/merchant/index', controller.merchant.index); // 查询
  router.post('/api/merchant/audit', controller.merchant.audit); // 审核
  router.post('/api/merchant/delete', controller.merchant.delete); // 删除
  router.post('/api/merchant', controller.merchant.update); // 商户自己修改信息
  router.post('/api/merchant/integral', controller.merchant.integral); // 超管增减商户积分

  // 商户车辆管理
  router.post('/api/merchant/car/update', controller.merchant.updateCar); // 新增修改
  router.post('/api/merchant/car/delete', controller.merchant.deleteCar); // 删除

  // 商户员工
  router.post('/api/merchant/staff/index', controller.merchant.indexStaff); // 查询
  router.post('/api/merchant/staff/audit', controller.merchant.auditStaff); // 审核员工
  router.post('/api/merchant/staff/update', controller.merchant.updateStaff); // 新增修改
  router.post('/api/merchant/staff/delete', controller.merchant.deleteStaff); // 删除

  // 查询用户
  router.post('/api/user/index', controller.user.index); // 查询
  router.post('/api/user', controller.user.update); // 修改
  router.post('/api/user/changePwd', controller.user.changePwd); // 重置密码

  // 登录相关
  router.post('/api/access/login', controller.access.login); // 登录
  router.post('/api/access/refreshToken', controller.access.refreshToken); // 刷新令牌
  router.post('/api/sms', controller.sms.create);

  // 相机请求接口
  router.post('/api/ipCamera/heartbeat', controller.ipCamera.heartbeat); // 心跳
  // 车牌识别结果
  router.post(
    '/api/ipCamera/alarmInfoPlate',
    controller.ipCamera.alarmInfoPlate
  );

  // 图片上传
  router.post('/api/upload', controller.upload.create);

  // 小票获取
  router.post('/api/ticket/print', controller.ticket.print);
  router.post('/api/ticket/padScan', controller.ticket.padScan);

  // apk 下载
  router.get('/api/download/:version', controller.download.index); // 下载
  router.post('/api/version/index', controller.version.index); // 获取版本

  // 车辆出入记录
  router.post('/api/car/inAndOut/index', controller.car.index); // 车辆出入记录
  router.post('/api/car/loadAndUnload/index', controller.car.index); // 装卸记录
  router.post('/api/car/operation', controller.car.operation); // 装卸车，放行
  router.post('/api/car/delete', controller.car.delete); // 删除
  router.post('/api/car/inAndOut/manual', controller.car.manual); // 手动录入入场记录

  // 后台设置
  router.post('/api/set', controller.set.update); // 新增修改
  router.post('/api/set/index', controller.set.index); // 查询

  // app报错上报
  router.post('/api/alarm/create', controller.alarm.create); // 上报

  // 支付
  router.post('/api/pay/wechat/create', controller.pay.wechatCreate); // 下单
  router.post(
    '/api/pay/wechat/callback',
    new tenpay(config.wechatPay).middleware('pay'),
    controller.pay.wechatCallback
  ); // 微信支付回调

  // socket.io
  io.of('/ipCamera').route('gateOpen', io.controller.nsp.gateOpen); // 开闸
};
