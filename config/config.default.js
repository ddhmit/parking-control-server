/* eslint valid-jsdoc: "off" */
'use strict';
const os = require('os');
const path = require('path');
/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = (appInfo) => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {});

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1585104456252_5128';

  // 无需验证token的接口
  const jwtIgnore = [
    '/home',
    '/api/pay',
    '/api/local',
    '/api/access',
    '/api/sms',
    '/api/ipCamera',
    '/api/ticket/print',
    '/api/ticket/padScan',
    '/api/download',
  ];
  config.middleware = ['errorHandler', 'expiredHandler', 'merchantInfoAudit'];
  config.bodyParser = {
    enableTypes: ['json', 'form', 'text'],
    extendTypes: {
      text: ['text/xml', 'application/xml'],
    },
  };
  config.jwt = {
    enable: true,
    secret:
      'Decryptor will be sent to prison. ©DDHMIT.COM All rights reserved.',
    ignore: jwtIgnore,
  };
  config.expiredHandler = {
    enable: true,
    ignore: [...jwtIgnore, '/api/market/index', '/api/merchant/index'],
  };
  config.merchantInfoAudit = {
    enable: true,
    ignore: [...jwtIgnore, '/api/merchant', '/api/user', '/api/upload'],
  };

  // 只对 /api 前缀的 url 路径生效
  config.errorHandler = {
    match: '/api',
  };

  config.proxy = true;
  // 避免用户通过请求头来伪造 IP 地址
  config.maxProxyCount = 1;

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  };

  config.security = {
    csrf: {
      // 内部 ip 关闭部分安全防范
      enable: false,
    },
    domainWhiteList: ['http://localhost:7001', 'http://localhost:8100'],
  };

  config.mongoose = {
    clients: {
      customer: {
        url: 'mongodb://127.0.0.1/park',
        options: {
          useNewUrlParser: true,
          useFindAndModify: false,
          useCreateIndex: true,
          useUnifiedTopology: true,
          selectPopulatedPaths: false,
        },
      },
      ddhmit: {
        url: 'mongodb://127.0.0.1/park',
        options: {
          useNewUrlParser: true,
          useFindAndModify: false,
          useCreateIndex: true,
          useUnifiedTopology: true,
          selectPopulatedPaths: false,
        },
      },
    },
  };

  config.redis = {
    client: {
      port: 6379, // Redis port
      host: '127.0.0.1', // Redis host
      password: '',
      db: 0,
    },
  };

  config.view = {
    defaultViewEngine: 'nunjucks',
  };

  config.bcrypt = {
    saltRounds: 10,
  };

  config.io = {
    namespace: {
      '/ipCamera': {
        connectionMiddleware: ['connection'],
        packetMiddleware: [],
      },
      '/payNotice': {
        connectionMiddleware: [],
        packetMiddleware: [],
      },
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
  };

  config.multipart = {
    whitelist: [
      '.jpg',
      '.jpeg',
      '.JPG', // image/jpeg
      '.png', // image/png, image/x-png
      '.gif', // image/gif
    ],
    mode: 'file',
    tmpdir: path.join(os.tmpdir(), 'egg-multipart-tmp', appInfo.name),
    cleanSchedule: {
      cron: '0 30 4 * * *',
    },
    fileSize: '5mb',
  };

  return config;
};
