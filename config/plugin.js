'use strict';

/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  // static: {
  //   enable: true,
  // }
  mongoose: {
    enable: true,
    package: 'egg-mongoose',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
  },
  bcrypt: {
    enable: true,
    package: 'egg-bcrypt',
  },
  io: {
    enable: true,
    package: 'egg-socket.io',
  },
  downloader: {
    enable: true,
    package: 'egg-downloader',
  },
};
