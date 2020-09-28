const glob = require('glob');
const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
module.exports = {
  schedule: {
    cron: '0 0 2 * * *', // 每天凌晨两点
    type: 'worker',
  },
  async task(ctx) {
    glob(
      path.join(ctx.app.baseDir, 'app/public/uploads/temp/**/**/*.*'),
      (er, files) => {
        files.map((item) => {
          const timestamps = +item.split('/').pop().split('.')[0];
          const isClean =
            moment(Date.now()).diff(moment(timestamps), 'days') >= 7;
          if (isClean) {
            fs.remove(item);
          }
        });
      }
    );
  },
};
