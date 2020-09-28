'use strict';
const { v4: uuidv4 } = require('uuid');
const Controller = require('egg').Controller;
class UploadController extends Controller {
  constructor(ctx) {
    super(ctx);
  }

  // 上传文件
  async create() {
    const { ctx } = this;
    // 获取当前登录用户的数据
    const store = await ctx.helper.getStore({
      field: ['user', 'market', 'merchant'],
    });
    let res = {};
    for (const file of ctx.request.files) {
      const newImage = await ctx.helper.copyAndCompress(
        file.filepath,
        `/public/uploads/temp/market/${store.market._id}/user/${store.user._id}`,
        `${Date.now()}.${uuidv4()}`
      );
      ctx.cleanupRequestFiles([file]);
      res[file.fieldname] = newImage;
    }
    ctx.helper.success({ ctx, res }).logger(store, '上传图片');
  }
}

module.exports = UploadController;
