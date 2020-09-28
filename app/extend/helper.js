// 工具函数
const {
  random,
  isEmpty,
  isArray,
  omit,
  mapKeys,
  mapValues,
  isString,
  drop,
  omitBy,
} = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const iconv = require('iconv-lite');
const moment = require('moment');
require('moment-precise-range-plugin');
const { crc16modbus } = require('crc');
module.exports = {
  /**
   * 获取store的值
   *
   * @param {*} [state=null]
   * @param {*} [field=[]]
   * @returns
   */
  async getStore({ state = this.REtokenDecode(), field = [] }) {
    const stores = {};
    for (let i = 0, len = field.length; i < len; i++) {
      const key = field[i];
      stores[key] = await this.ctx.store(state, key).value;
    }
    // 如果redis被清空，则强制客户端退出
    if (Object.values(stores).every((item) => !item)) {
      return this.ctx.throw(410, '密钥有误');
    }
    return stores;
  },

  /**
   * 处理成功响应
   * 默认过滤 password
   * @param {*} { ctx, res = null, msg = '请求成功' }
   */
  success({ ctx, res = null, msg = '请求成功' }) {
    const body = (data) => {
      ctx.body = {
        // code: 0,
        data,
        msg,
      };
      ctx.status = 200;
    };
    body(res);
    const that = {};
    // 过滤
    Object.defineProperty(that, 'filter', {
      value: (...field) => {
        const defField = ['password', ...field];
        if (res.docs) {
          res.docs = res.docs.map((item) => omit(item, defField));
          body(res);
        }
        body(omit(res, defField));
        return that;
      },
    });
    // 日志
    Object.defineProperty(that, 'logger', {
      value: (store = {}, name) => {
        // 输出日志
        ctx.logger.info(name, {
          ...store,
          reqBody: ctx.request.body,
        });
        return that;
      },
    });
    return that;
  },
  /**
   * 验证器
   *
   * @param {*} schema
   * @param {*} payload
   * @param {boolean} [callback=(valid) => {
   *       return this.ctx.assert(false, 422, valid.error);
   *     }]
   * @returns
   */
  validate(
    schema,
    payload,
    callback = (valid) => {
      this.ctx.throw(422, valid.error);
    }
  ) {
    const valid = schema.validate(payload);
    if (valid.error) {
      return callback(valid);
    }
    return valid.value;
  },
  /**
   * token 再加密
   *
   * @param {*} obj
   * @returns
   */
  REtokenEncrypt(obj) {
    const key = String(random(9));
    let arr = Buffer.from(JSON.stringify(obj)).toString('hex').split(key);
    arr.splice(arr.length - 1, 0, arr.length + key);
    return Buffer.from(String(arr)).toString('base64');
  },
  /**
   * token 再解密
   *
   * @param {*} str
   * @returns
   */
  REtokenDecode(str) {
    try {
      str = str || this.ctx.state.user.data;
      let arr = Buffer(str, 'base64').toString().split(',');
      const key = arr[arr.length - 2].slice(-1);
      arr.splice(arr.length - 2, 1);
      return JSON.parse(Buffer(arr.join(key), 'hex').toString('utf8') || '{}');
    } catch (error) {
      this.ctx.throw(410, '密钥有误', error);
      return;
    }
  },
  /**
   * 生成mongoose查询条件
   *
   * @param {*} {
   *     search = {}, // 查询参数
   *     config = {}, // 配置
   *     callback = (query) => query, // 回调
   *   }
   * @returns
   */
  GMQC({
    search = {}, // 查询参数
    config = {}, // 配置
    callback = (query) => query, // 回调
  }) {
    let _search = {};
    // 将参数拼接为mongoose认识的参数
    // $and: [
    //   {
    //     'user.sex.value': 1
    //   },
    //   {
    //     $or: [
    //       { 'dream.salary.value': { $gte: 8800, $lte: 10000 } },
    //       { 'dream.salary.value': { $gte: 10000, $lte: 10000 } },
    //     ],
    //   },
    // ]
    const and$or = (obj) => {
      const toFilterObjects = ([key, values]) => {
        this.ctx.assert(
          isArray(values),
          422,
          'search对象中key的值需为一个数组'
        );
        return values.map((value) => ({ [key]: value }));
      };
      const combine = (key) => (arr) => {
        if (arr.length) {
          if (arr.length === 1) return arr[0];
          return {
            [key]: arr,
          };
        }
        return {};
      };
      return combine('$and')(
        Object.entries(obj)
          .map(toFilterObjects)
          .map(combine('$or'))
          .filter((value) => Object.keys(value).length)
      );
    };

    // search 字段特殊条件配置 示例：
    // const condition = [
    //   { field: 'salary', cond: "{ $gt: $0, $lt: $1 }" }
    // ]
    // 输出
    // { 'dream.salary.value': { $gte: 1000, $lte: 3000 } }
    config.condition &&
      (() => {
        // 用户ID的传递 不能删 eval 会用到
        const ObjectId = this.ctx.app.mongoose.Types.ObjectId;
        const reg = (idx) => {
          return new RegExp('(\\$' + idx + '+|\\$\\$)', 'g');
        };
        config.condition.map((item) => {
          search = mapValues(search, (value, key) => {
            if (key == item.field) {
              this.ctx.assert(
                isString(item.cond),
                500,
                'GMQC config.condition配置：item.cond 必须为字符串'
              );
              return value.map((vi, idx) => {
                if (isArray(vi)) {
                  if (!vi.length) return vi;
                  let tempCond = item.cond;
                  vi.map((i, d) => {
                    tempCond = tempCond.replace(reg(d), i);
                  });
                  return eval('(' + tempCond + ')');
                } else {
                  item.cond = item.cond.replace(reg(idx), vi);
                  return eval('(' + item.cond + ')');
                }
              });
            }
            return value;
          });
        });
      })();

    // search 对象输出 直接 和间接参数 示例：
    // const returnDirectAndIndirect = {
    //   direct: ['applyStatus', 'maritalStatus', 'highestEdu'],
    //   // indirect 只传一个的话，默认第二个为剩余的参数
    // }
    config.returnDirectAndIndirect &&
      (() => {
        const rdai = config.returnDirectAndIndirect;
        const ps = (v, b) => {
          return omitBy(search, (value, key) => {
            let r = v.includes(key);
            return (r ^= b);
          });
        };
        if (rdai.direct && rdai.indirect) {
          mapKeys(rdai, (value, key) => {
            _search[key] = ps(value, true);
          });
        } else if (rdai.direct) {
          _search.direct = ps(rdai.direct, true);
          _search.indirect = ps(rdai.direct, false);
        } else if (rdai.indirect) {
          _search.indirect = ps(rdai.indirect, true);
          _search.direct = ps(rdai.indirect, false);
        } else {
          return;
        }
      })();

    // search 字段前缀后缀配置 示例：
    // const prefix$suffix$rename = [
    //   { pref: 'user', suff: 'value', field: ['sex', 'review'] },
    //   { pref: 'dream', suff: 'value', field: ['jobCategory', 'salary'] },
    //   { suff: 'value', field: ['applyStatus', 'maritalStatus', 'highestEdu'] }
    //   { suff: 'info.result.PlateResult.license', rename: 'car', field: ['carNo'], },
    // ];
    config.prefix$suffix$rename &&
      (() => {
        const structureField = (k, item) => {
          if (item.pref && item.suff) {
            return `${item.pref}.${k}.${item.suff}`;
          } else if (item.pref) {
            return `${item.pref}.${k}`;
          } else if (item.suff) {
            return `${k}.${item.suff}`;
          } else {
            return k;
          }
        };
        const prefix$suffix$rename = (obj) => {
          const psr = config.prefix$suffix$rename;
          for (let i = 0, len = psr.length; i < len; i++) {
            obj = mapKeys(obj, (value, key) => {
              if (!psr[i].field.includes(key)) {
                return key;
              }
              if (psr[i].rename) {
                return structureField(psr[i].rename, psr[i]);
              } else {
                return structureField(key, psr[i]);
              }
            });
          }
          return obj;
        };
        if (!isEmpty(_search)) {
          _search = mapValues(_search, (value, key) => {
            return prefix$suffix$rename(value);
          });
        } else {
          search = prefix$suffix$rename(search);
        }
      })();

    // 输出查询结果
    const query = () => {
      const res = callback(and$or(search));
      const opt = { writable: true, enumerable: false, configurable: true };
      if (!isEmpty(_search)) {
        Object.defineProperty(res, 'direct', {
          value: and$or(_search.direct),
          ...opt,
        });
        Object.defineProperty(res, 'indirect', {
          value: and$or(_search.indirect),
          ...opt,
        });
      }
      return res;
    };

    return query();
  },

  /**
   * 压缩文件到指定大小并存储到新目录
   *
   * @param {*} file
   * @param {*} savePath
   * @param {number} [quality=80]
   * @param {number} [drop=2]
   * @returns
   */
  async constraintImage(file, savePath, quality = 80, drop = 2) {
    if (file == savePath) {
      return;
    }
    const done = sharp(file).jpeg({ quality });
    const buf = await done.toBuffer();
    // 控制图片质量为1024kb
    if (buf.byteLength > 1024 * 1024 && quality > 2) {
      return await this.constraintImage(buf, savePath, quality - drop);
    }
    return done.toFile(savePath);
  },

  /**
   * 文件的复制和压缩
   *
   * @param {*} targetFile
   * @param {*} newPath
   * @param {*} filename
   * @param {boolean} [constraintImage=false]
   * @returns
   */
  async copyAndCompress(
    targetFile,
    newPath,
    filename,
    constraintImage = false
  ) {
    const { ctx } = this;
    try {
      const extname = path.extname(targetFile).toLowerCase(); // 后缀名
      const url = `${newPath}/${filename}${extname}`; // 最终返回的文件url
      const savePath = path.join(ctx.app.baseDir, 'app', url); // 最新存放的地址
      if (constraintImage) {
        await fs.ensureFile(savePath);
        await this.constraintImage(targetFile, savePath);
      } else {
        await fs.copy(targetFile, savePath);
      }
      return url;
    } catch (err) {
      ctx.logger.error(err);
      return;
    }
  },

  /**
   * 生成串口16进制buffer数据
   *
   * @returns
   */
  generateSerialData(TEXT = '') {
    let s16 = ['0064FFFF'], // 存放16进制数的字符串数组
      i = 1; // 数组下标
    const textLen = TEXT.replace(/[\u4e00-\u9fa5]/g, 'aa').length;
    const result = (_s16) => {
      let serial = _s16.join('');
      // 计算crc
      const crc = crc16modbus(Buffer.from(serial, 'hex')).toString(16);
      // 颠倒crc并拼接
      serial += Buffer.from(crc, 'hex').reverse().toString('hex');
      return Buffer.from(serial, 'hex');
    };
    return {
      text: async () => {
        s16[i++] = '62'; // 显示临时文本
        s16[i++] = Buffer.from([19 + textLen], 'hex').toString('hex'); // DL 等于 19 +文本长度
        s16[i++] = '00'; // 第几行
        s16[i++] = '15'; // 连续左移
        s16[i++] = '01000215010300FF00000000000000'; // 固定参数
        s16[i++] = Buffer.from([textLen], 'hex').toString('hex') + '00'; // TL文本长度
        s16[i++] = iconv.encode(TEXT, 'GB2312').toString('hex'); // 文本
        return result(s16);
      },
      voice: async () => {
        s16[i++] = '30'; // 播放语音
        s16[i++] = Buffer.from([1 + textLen], 'hex').toString('hex'); // DL 等于 1 + 文本长度
        s16[i++] = '02'; // 先清除队列，再添加新语音到队列，然后开始播放
        s16[i++] = iconv.encode(TEXT, 'GB2312').toString('hex'); // 文本
        return result(s16);
      },
    };
  },

  /**
   * 强制分页 一般用于mongoose插件无法进行分页的情况
   *
   * @param {*} items
   * @param {*} page
   * @param {*} limit
   * @returns
   */
  forcePaginate(items, page, limit) {
    const offset = (page - 1) * limit,
      docs = drop(items, offset).slice(0, limit);
    const totalDocs = items.length,
      totalPages = (totalDocs + limit - 1) / limit,
      nextPage = page + 1 >= totalPages ? null : page + 1,
      prevPage = page - 1 || null,
      hasNextPage = nextPage ? true : false,
      hasPrevPage = prevPage ? true : false;
    return {
      docs,
      hasNextPage,
      hasPrevPage,
      limit,
      nextPage,
      page,
      pagingCounter: 1,
      prevPage,
      totalDocs,
      totalPages,
    };
  },

  /**
   * joi ObjectId 验证
   *
   * @returns
   */
  joiObjectIdValid() {
    const that = this;
    return (value, helpers) => {
      if (!that.ctx.app.mongoose.Types.ObjectId.isValid(value)) {
        return helpers.message('识别码传递错误');
      }
      return value;
    };
  },

  /**
   * 判断 某个时分秒 是否在 一个时分秒区间内
   *
   * @param {*} [nowTime=new Date()]
   * @param {*} beforeTime
   * @param {*} afterTime
   * @returns
   */
  checkTimeIsBetween({ nowTime = new Date(), beforeTime, afterTime }) {
    const format = 'hh:mm:ss';
    const _nowTime = moment(nowTime, format),
      _beforeTime = moment(beforeTime, format),
      _afterTime = moment(afterTime, format);
    if (_nowTime.isBetween(_beforeTime, _afterTime, null, '[]')) {
      return true;
    } else {
      return false;
    }
  },

  /**
   * 格式化时间 几天 几小时 几分
   *
   * @param {*} date1
   * @param {*} date2
   * @param {boolean} [opt=true]
   * @returns
   */
  preciseDiff(date1, date2, opt = true) {
    return moment.preciseDiff(moment(date1), moment(date2), opt);
  },
};
