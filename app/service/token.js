// 市场
const Service = require('egg').Service;
const moment = require('moment');
// 过期时间配置
const accTokenExp = moment().add(24, 'hours').valueOf(); // accessToken 过期时间 2小时后 毫秒
const refTokenExp = moment().add(30, 'days').valueOf(); // refreshToken 过期时间 30天后 毫秒
const dateNow = Date.now();
// refreshToken 过期时间
const refExp = refTokenExp - dateNow;
// accessToken 过期时间
const accExp = accTokenExp - dateNow;

class TokenService extends Service {
  constructor(ctx) {
    super(ctx);
    // 记录生产token的时间
    this.timestamps = Date.now();
  }

  // 生产accessToken
  async accessToken({ marketId, userId }) {
    const { ctx, service, app } = this;
    // 判断用户是否正常
    await service.user.valid({ marketId, userId });
    // 判断市场是否正常
    await service.market.valid({ marketId, userId });
    // 判断商户信息是否正常
    await service.merchant.valid({ marketId, userId });
    // 签发token
    return app.jwt.sign(
      {
        data: ctx.helper.REtokenEncrypt({
          marketId,
          userId,
          timestamps: this.timestamps,
        }),
      },
      app.config.jwt.secret,
      {
        expiresIn: String(accExp),
      }
    );
  }

  // 生产refreshToken
  async refreshToken({ marketId, userId }) {
    const { ctx, app } = this;
    const token = ctx.helper.REtokenEncrypt({
      marketId,
      userId,
      timestamps: this.timestamps,
    });
    // 存储refreshToken
    await app.redis.set(
      `PARK:${marketId}RefreshToken:${userId}`,
      token,
      'PX',
      refExp
    );
    return token;
  }
}

module.exports = TokenService;
