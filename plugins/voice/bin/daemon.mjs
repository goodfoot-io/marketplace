#!/usr/bin/env node
import { createRequire as __banner_createRequire } from 'node:module';import { fileURLToPath as __banner_fileURLToPath } from 'node:url';import { dirname as __banner_dirname } from 'node:path';const require = __banner_createRequire(import.meta.url);const __filename = __banner_fileURLToPath(import.meta.url);const __dirname = __banner_dirname(__filename);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../../../../../../../../../workspace/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var closeTimeout = 30 * 1e3;
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      let chunk;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk = websocket._socket.read()) !== null) {
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// ../../../../../../../../../../workspace/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../../../../../../../../../../workspace/node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// src/cli/daemon.ts
import { appendFileSync, closeSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createServer2 } from "node:http";

// ../../../../../../../../../../workspace/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../../../../../../../../../workspace/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../../../../../../../../../workspace/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../../../../../../../../../workspace/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../../../../../../../../../workspace/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../../../../../../../../../workspace/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../../../../../../../../../workspace/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../../../../../../../../../workspace/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;

// src/controller.ts
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve as resolvePath } from "node:path";

// ../../../../../../../../../../workspace/node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// src/emitter.ts
var StrictEventEmitter = class {
  #handlers = /* @__PURE__ */ new Map();
  on(eventName, handler) {
    const handlers = this.#handlers.get(eventName) ?? /* @__PURE__ */ new Set();
    handlers.add(handler);
    this.#handlers.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }
  once(eventName, handler) {
    const unsubscribe = this.on(eventName, (event) => {
      unsubscribe();
      handler(event);
    });
    return unsubscribe;
  }
  off(eventName, handler) {
    this.#handlers.get(eventName)?.delete(handler);
  }
  emit(eventName, event) {
    const handlers = this.#handlers.get(eventName);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      handler(event);
    }
  }
};

// src/errors.ts
var VoiceAgentServerError = class extends Error {
  name = "VoiceAgentServerError";
  code;
  details;
  cause;
  constructor(input) {
    super(input.message, { cause: input.cause });
    this.code = input.code;
    this.details = input.details;
    this.cause = input.cause;
  }
};
function toVoiceError(code, message, details, cause) {
  return new VoiceAgentServerError({ code, message, details, cause });
}

// src/types.ts
var DEFAULT_REALTIME_MODEL = "grok-voice-latest";
var DEFAULT_REALTIME_VOICE = "eve";
var DEFAULT_UI_TITLE = "Voice Agent";
var DEFAULT_WAKE_WORD = "Hey Computer";

// ../../../../../../../../../../workspace/packages/voice/src/ui-dist/index.html
var ui_dist_default = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>__REALTIME_VOICE_TITLE__</title>\n    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css" />\n    <script type="module" crossorigin>(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const c of document.querySelectorAll(\'link[rel="modulepreload"]\'))u(c);new MutationObserver(c=>{for(const f of c)if(f.type==="childList")for(const d of f.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&u(d)}).observe(document,{childList:!0,subtree:!0});function r(c){const f={};return c.integrity&&(f.integrity=c.integrity),c.referrerPolicy&&(f.referrerPolicy=c.referrerPolicy),c.crossOrigin==="use-credentials"?f.credentials="include":c.crossOrigin==="anonymous"?f.credentials="omit":f.credentials="same-origin",f}function u(c){if(c.ep)return;c.ep=!0;const f=r(c);fetch(c.href,f)}})();function As(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var Bc={exports:{}},wa={};/**\n * @license React\n * react-jsx-runtime.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Gp;function Ev(){if(Gp)return wa;Gp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.fragment");function r(u,c,f){var d=null;if(f!==void 0&&(d=""+f),c.key!==void 0&&(d=""+c.key),"key"in c){f={};for(var h in c)h!=="key"&&(f[h]=c[h])}else f=c;return c=f.ref,{$$typeof:n,type:u,key:d,ref:c!==void 0?c:null,props:f}}return wa.Fragment=a,wa.jsx=r,wa.jsxs=r,wa}var Xp;function kv(){return Xp||(Xp=1,Bc.exports=Ev()),Bc.exports}var J=kv(),Hc={exports:{}},xe={};/**\n * @license React\n * react.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Qp;function Av(){if(Qp)return xe;Qp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.portal"),r=Symbol.for("react.fragment"),u=Symbol.for("react.strict_mode"),c=Symbol.for("react.profiler"),f=Symbol.for("react.consumer"),d=Symbol.for("react.context"),h=Symbol.for("react.forward_ref"),m=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),v=Symbol.for("react.lazy"),g=Symbol.for("react.activity"),x=Symbol.iterator;function E(w){return w===null||typeof w!="object"?null:(w=x&&w[x]||w["@@iterator"],typeof w=="function"?w:null)}var C={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},H=Object.assign,B={};function O(w,q,b){this.props=w,this.context=q,this.refs=B,this.updater=b||C}O.prototype.isReactComponent={},O.prototype.setState=function(w,q){if(typeof w!="object"&&typeof w!="function"&&w!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,w,q,"setState")},O.prototype.forceUpdate=function(w){this.updater.enqueueForceUpdate(this,w,"forceUpdate")};function K(){}K.prototype=O.prototype;function V(w,q,b){this.props=w,this.context=q,this.refs=B,this.updater=b||C}var le=V.prototype=new K;le.constructor=V,H(le,O.prototype),le.isPureReactComponent=!0;var ue=Array.isArray;function L(){}var P={H:null,A:null,T:null,S:null},se=Object.prototype.hasOwnProperty;function ge(w,q,b){var _=b.ref;return{$$typeof:n,type:w,key:q,ref:_!==void 0?_:null,props:b}}function U(w,q){return ge(w.type,q,w.props)}function ie(w){return typeof w=="object"&&w!==null&&w.$$typeof===n}function ne(w){var q={"=":"=0",":":"=2"};return"$"+w.replace(/[=:]/g,function(b){return q[b]})}var be=/\\/+/g;function ae(w,q){return typeof w=="object"&&w!==null&&w.key!=null?ne(""+w.key):q.toString(36)}function $(w){switch(w.status){case"fulfilled":return w.value;case"rejected":throw w.reason;default:switch(typeof w.status=="string"?w.then(L,L):(w.status="pending",w.then(function(q){w.status==="pending"&&(w.status="fulfilled",w.value=q)},function(q){w.status==="pending"&&(w.status="rejected",w.reason=q)})),w.status){case"fulfilled":return w.value;case"rejected":throw w.reason}}throw w}function D(w,q,b,_,G){var F=typeof w;(F==="undefined"||F==="boolean")&&(w=null);var ee=!1;if(w===null)ee=!0;else switch(F){case"bigint":case"string":case"number":ee=!0;break;case"object":switch(w.$$typeof){case n:case a:ee=!0;break;case v:return ee=w._init,D(ee(w._payload),q,b,_,G)}}if(ee)return G=G(w),ee=_===""?"."+ae(w,0):_,ue(G)?(b="",ee!=null&&(b=ee.replace(be,"$&/")+"/"),D(G,q,b,"",function(we){return we})):G!=null&&(ie(G)&&(G=U(G,b+(G.key==null||w&&w.key===G.key?"":(""+G.key).replace(be,"$&/")+"/")+ee)),q.push(G)),1;ee=0;var re=_===""?".":_+":";if(ue(w))for(var de=0;de<w.length;de++)_=w[de],F=re+ae(_,de),ee+=D(_,q,b,F,G);else if(de=E(w),typeof de=="function")for(w=de.call(w),de=0;!(_=w.next()).done;)_=_.value,F=re+ae(_,de++),ee+=D(_,q,b,F,G);else if(F==="object"){if(typeof w.then=="function")return D($(w),q,b,_,G);throw q=String(w),Error("Objects are not valid as a React child (found: "+(q==="[object Object]"?"object with keys {"+Object.keys(w).join(", ")+"}":q)+"). If you meant to render a collection of children, use an array instead.")}return ee}function Z(w,q,b){if(w==null)return w;var _=[],G=0;return D(w,_,"","",function(F){return q.call(b,F,G++)}),_}function ce(w){if(w._status===-1){var q=w._result;q=q(),q.then(function(b){(w._status===0||w._status===-1)&&(w._status=1,w._result=b)},function(b){(w._status===0||w._status===-1)&&(w._status=2,w._result=b)}),w._status===-1&&(w._status=0,w._result=q)}if(w._status===1)return w._result.default;throw w._result}var Se=typeof reportError=="function"?reportError:function(w){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var q=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof w=="object"&&w!==null&&typeof w.message=="string"?String(w.message):String(w),error:w});if(!window.dispatchEvent(q))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",w);return}console.error(w)},k={map:Z,forEach:function(w,q,b){Z(w,function(){q.apply(this,arguments)},b)},count:function(w){var q=0;return Z(w,function(){q++}),q},toArray:function(w){return Z(w,function(q){return q})||[]},only:function(w){if(!ie(w))throw Error("React.Children.only expected to receive a single React element child.");return w}};return xe.Activity=g,xe.Children=k,xe.Component=O,xe.Fragment=r,xe.Profiler=c,xe.PureComponent=V,xe.StrictMode=u,xe.Suspense=m,xe.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=P,xe.__COMPILER_RUNTIME={__proto__:null,c:function(w){return P.H.useMemoCache(w)}},xe.cache=function(w){return function(){return w.apply(null,arguments)}},xe.cacheSignal=function(){return null},xe.cloneElement=function(w,q,b){if(w==null)throw Error("The argument must be a React element, but you passed "+w+".");var _=H({},w.props),G=w.key;if(q!=null)for(F in q.key!==void 0&&(G=""+q.key),q)!se.call(q,F)||F==="key"||F==="__self"||F==="__source"||F==="ref"&&q.ref===void 0||(_[F]=q[F]);var F=arguments.length-2;if(F===1)_.children=b;else if(1<F){for(var ee=Array(F),re=0;re<F;re++)ee[re]=arguments[re+2];_.children=ee}return ge(w.type,G,_)},xe.createContext=function(w){return w={$$typeof:d,_currentValue:w,_currentValue2:w,_threadCount:0,Provider:null,Consumer:null},w.Provider=w,w.Consumer={$$typeof:f,_context:w},w},xe.createElement=function(w,q,b){var _,G={},F=null;if(q!=null)for(_ in q.key!==void 0&&(F=""+q.key),q)se.call(q,_)&&_!=="key"&&_!=="__self"&&_!=="__source"&&(G[_]=q[_]);var ee=arguments.length-2;if(ee===1)G.children=b;else if(1<ee){for(var re=Array(ee),de=0;de<ee;de++)re[de]=arguments[de+2];G.children=re}if(w&&w.defaultProps)for(_ in ee=w.defaultProps,ee)G[_]===void 0&&(G[_]=ee[_]);return ge(w,F,G)},xe.createRef=function(){return{current:null}},xe.forwardRef=function(w){return{$$typeof:h,render:w}},xe.isValidElement=ie,xe.lazy=function(w){return{$$typeof:v,_payload:{_status:-1,_result:w},_init:ce}},xe.memo=function(w,q){return{$$typeof:p,type:w,compare:q===void 0?null:q}},xe.startTransition=function(w){var q=P.T,b={};P.T=b;try{var _=w(),G=P.S;G!==null&&G(b,_),typeof _=="object"&&_!==null&&typeof _.then=="function"&&_.then(L,Se)}catch(F){Se(F)}finally{q!==null&&b.types!==null&&(q.types=b.types),P.T=q}},xe.unstable_useCacheRefresh=function(){return P.H.useCacheRefresh()},xe.use=function(w){return P.H.use(w)},xe.useActionState=function(w,q,b){return P.H.useActionState(w,q,b)},xe.useCallback=function(w,q){return P.H.useCallback(w,q)},xe.useContext=function(w){return P.H.useContext(w)},xe.useDebugValue=function(){},xe.useDeferredValue=function(w,q){return P.H.useDeferredValue(w,q)},xe.useEffect=function(w,q){return P.H.useEffect(w,q)},xe.useEffectEvent=function(w){return P.H.useEffectEvent(w)},xe.useId=function(){return P.H.useId()},xe.useImperativeHandle=function(w,q,b){return P.H.useImperativeHandle(w,q,b)},xe.useInsertionEffect=function(w,q){return P.H.useInsertionEffect(w,q)},xe.useLayoutEffect=function(w,q){return P.H.useLayoutEffect(w,q)},xe.useMemo=function(w,q){return P.H.useMemo(w,q)},xe.useOptimistic=function(w,q){return P.H.useOptimistic(w,q)},xe.useReducer=function(w,q,b){return P.H.useReducer(w,q,b)},xe.useRef=function(w){return P.H.useRef(w)},xe.useState=function(w){return P.H.useState(w)},xe.useSyncExternalStore=function(w,q,b){return P.H.useSyncExternalStore(w,q,b)},xe.useTransition=function(){return P.H.useTransition()},xe.version="19.2.6",xe}var Ip;function ws(){return Ip||(Ip=1,Hc.exports=Av()),Hc.exports}var ve=ws();const Da=As(ve);var qc={exports:{}},Ta={},Yc={exports:{}},Vc={};/**\n * @license React\n * scheduler.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Zp;function wv(){return Zp||(Zp=1,(function(n){function a(D,Z){var ce=D.length;D.push(Z);e:for(;0<ce;){var Se=ce-1>>>1,k=D[Se];if(0<c(k,Z))D[Se]=Z,D[ce]=k,ce=Se;else break e}}function r(D){return D.length===0?null:D[0]}function u(D){if(D.length===0)return null;var Z=D[0],ce=D.pop();if(ce!==Z){D[0]=ce;e:for(var Se=0,k=D.length,w=k>>>1;Se<w;){var q=2*(Se+1)-1,b=D[q],_=q+1,G=D[_];if(0>c(b,ce))_<k&&0>c(G,b)?(D[Se]=G,D[_]=ce,Se=_):(D[Se]=b,D[q]=ce,Se=q);else if(_<k&&0>c(G,ce))D[Se]=G,D[_]=ce,Se=_;else break e}}return Z}function c(D,Z){var ce=D.sortIndex-Z.sortIndex;return ce!==0?ce:D.id-Z.id}if(n.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var f=performance;n.unstable_now=function(){return f.now()}}else{var d=Date,h=d.now();n.unstable_now=function(){return d.now()-h}}var m=[],p=[],v=1,g=null,x=3,E=!1,C=!1,H=!1,B=!1,O=typeof setTimeout=="function"?setTimeout:null,K=typeof clearTimeout=="function"?clearTimeout:null,V=typeof setImmediate<"u"?setImmediate:null;function le(D){for(var Z=r(p);Z!==null;){if(Z.callback===null)u(p);else if(Z.startTime<=D)u(p),Z.sortIndex=Z.expirationTime,a(m,Z);else break;Z=r(p)}}function ue(D){if(H=!1,le(D),!C)if(r(m)!==null)C=!0,L||(L=!0,ne());else{var Z=r(p);Z!==null&&$(ue,Z.startTime-D)}}var L=!1,P=-1,se=5,ge=-1;function U(){return B?!0:!(n.unstable_now()-ge<se)}function ie(){if(B=!1,L){var D=n.unstable_now();ge=D;var Z=!0;try{e:{C=!1,H&&(H=!1,K(P),P=-1),E=!0;var ce=x;try{t:{for(le(D),g=r(m);g!==null&&!(g.expirationTime>D&&U());){var Se=g.callback;if(typeof Se=="function"){g.callback=null,x=g.priorityLevel;var k=Se(g.expirationTime<=D);if(D=n.unstable_now(),typeof k=="function"){g.callback=k,le(D),Z=!0;break t}g===r(m)&&u(m),le(D)}else u(m);g=r(m)}if(g!==null)Z=!0;else{var w=r(p);w!==null&&$(ue,w.startTime-D),Z=!1}}break e}finally{g=null,x=ce,E=!1}Z=void 0}}finally{Z?ne():L=!1}}}var ne;if(typeof V=="function")ne=function(){V(ie)};else if(typeof MessageChannel<"u"){var be=new MessageChannel,ae=be.port2;be.port1.onmessage=ie,ne=function(){ae.postMessage(null)}}else ne=function(){O(ie,0)};function $(D,Z){P=O(function(){D(n.unstable_now())},Z)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(D){D.callback=null},n.unstable_forceFrameRate=function(D){0>D||125<D?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):se=0<D?Math.floor(1e3/D):5},n.unstable_getCurrentPriorityLevel=function(){return x},n.unstable_next=function(D){switch(x){case 1:case 2:case 3:var Z=3;break;default:Z=x}var ce=x;x=Z;try{return D()}finally{x=ce}},n.unstable_requestPaint=function(){B=!0},n.unstable_runWithPriority=function(D,Z){switch(D){case 1:case 2:case 3:case 4:case 5:break;default:D=3}var ce=x;x=D;try{return Z()}finally{x=ce}},n.unstable_scheduleCallback=function(D,Z,ce){var Se=n.unstable_now();switch(typeof ce=="object"&&ce!==null?(ce=ce.delay,ce=typeof ce=="number"&&0<ce?Se+ce:Se):ce=Se,D){case 1:var k=-1;break;case 2:k=250;break;case 5:k=1073741823;break;case 4:k=1e4;break;default:k=5e3}return k=ce+k,D={id:v++,callback:Z,priorityLevel:D,startTime:ce,expirationTime:k,sortIndex:-1},ce>Se?(D.sortIndex=ce,a(p,D),r(m)===null&&D===r(p)&&(H?(K(P),P=-1):H=!0,$(ue,ce-Se))):(D.sortIndex=k,a(m,D),C||E||(C=!0,L||(L=!0,ne()))),D},n.unstable_shouldYield=U,n.unstable_wrapCallback=function(D){var Z=x;return function(){var ce=x;x=Z;try{return D.apply(this,arguments)}finally{x=ce}}}})(Vc)),Vc}var Fp;function Tv(){return Fp||(Fp=1,Yc.exports=wv()),Yc.exports}var Gc={exports:{}},Et={};/**\n * @license React\n * react-dom.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Kp;function Cv(){if(Kp)return Et;Kp=1;var n=ws();function a(m){var p="https://react.dev/errors/"+m;if(1<arguments.length){p+="?args[]="+encodeURIComponent(arguments[1]);for(var v=2;v<arguments.length;v++)p+="&args[]="+encodeURIComponent(arguments[v])}return"Minified React error #"+m+"; visit "+p+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function r(){}var u={d:{f:r,r:function(){throw Error(a(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},c=Symbol.for("react.portal");function f(m,p,v){var g=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:c,key:g==null?null:""+g,children:m,containerInfo:p,implementation:v}}var d=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function h(m,p){if(m==="font")return"";if(typeof p=="string")return p==="use-credentials"?p:""}return Et.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=u,Et.createPortal=function(m,p){var v=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!p||p.nodeType!==1&&p.nodeType!==9&&p.nodeType!==11)throw Error(a(299));return f(m,p,null,v)},Et.flushSync=function(m){var p=d.T,v=u.p;try{if(d.T=null,u.p=2,m)return m()}finally{d.T=p,u.p=v,u.d.f()}},Et.preconnect=function(m,p){typeof m=="string"&&(p?(p=p.crossOrigin,p=typeof p=="string"?p==="use-credentials"?p:"":void 0):p=null,u.d.C(m,p))},Et.prefetchDNS=function(m){typeof m=="string"&&u.d.D(m)},Et.preinit=function(m,p){if(typeof m=="string"&&p&&typeof p.as=="string"){var v=p.as,g=h(v,p.crossOrigin),x=typeof p.integrity=="string"?p.integrity:void 0,E=typeof p.fetchPriority=="string"?p.fetchPriority:void 0;v==="style"?u.d.S(m,typeof p.precedence=="string"?p.precedence:void 0,{crossOrigin:g,integrity:x,fetchPriority:E}):v==="script"&&u.d.X(m,{crossOrigin:g,integrity:x,fetchPriority:E,nonce:typeof p.nonce=="string"?p.nonce:void 0})}},Et.preinitModule=function(m,p){if(typeof m=="string")if(typeof p=="object"&&p!==null){if(p.as==null||p.as==="script"){var v=h(p.as,p.crossOrigin);u.d.M(m,{crossOrigin:v,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0})}}else p==null&&u.d.M(m)},Et.preload=function(m,p){if(typeof m=="string"&&typeof p=="object"&&p!==null&&typeof p.as=="string"){var v=p.as,g=h(v,p.crossOrigin);u.d.L(m,v,{crossOrigin:g,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0,type:typeof p.type=="string"?p.type:void 0,fetchPriority:typeof p.fetchPriority=="string"?p.fetchPriority:void 0,referrerPolicy:typeof p.referrerPolicy=="string"?p.referrerPolicy:void 0,imageSrcSet:typeof p.imageSrcSet=="string"?p.imageSrcSet:void 0,imageSizes:typeof p.imageSizes=="string"?p.imageSizes:void 0,media:typeof p.media=="string"?p.media:void 0})}},Et.preloadModule=function(m,p){if(typeof m=="string")if(p){var v=h(p.as,p.crossOrigin);u.d.m(m,{as:typeof p.as=="string"&&p.as!=="script"?p.as:void 0,crossOrigin:v,integrity:typeof p.integrity=="string"?p.integrity:void 0})}else u.d.m(m)},Et.requestFormReset=function(m){u.d.r(m)},Et.unstable_batchedUpdates=function(m,p){return m(p)},Et.useFormState=function(m,p,v){return d.H.useFormState(m,p,v)},Et.useFormStatus=function(){return d.H.useHostTransitionStatus()},Et.version="19.2.6",Et}var Jp;function zv(){if(Jp)return Gc.exports;Jp=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),Gc.exports=Cv(),Gc.exports}/**\n * @license React\n * react-dom-client.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Wp;function _v(){if(Wp)return Ta;Wp=1;var n=Tv(),a=ws(),r=zv();function u(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var l=2;l<arguments.length;l++)t+="&args[]="+encodeURIComponent(arguments[l])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function c(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function f(e){var t=e,l=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(l=t.return),e=t.return;while(e)}return t.tag===3?l:null}function d(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function h(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function m(e){if(f(e)!==e)throw Error(u(188))}function p(e){var t=e.alternate;if(!t){if(t=f(e),t===null)throw Error(u(188));return t!==e?null:e}for(var l=e,i=t;;){var o=l.return;if(o===null)break;var s=o.alternate;if(s===null){if(i=o.return,i!==null){l=i;continue}break}if(o.child===s.child){for(s=o.child;s;){if(s===l)return m(o),e;if(s===i)return m(o),t;s=s.sibling}throw Error(u(188))}if(l.return!==i.return)l=o,i=s;else{for(var y=!1,S=o.child;S;){if(S===l){y=!0,l=o,i=s;break}if(S===i){y=!0,i=o,l=s;break}S=S.sibling}if(!y){for(S=s.child;S;){if(S===l){y=!0,l=s,i=o;break}if(S===i){y=!0,i=s,l=o;break}S=S.sibling}if(!y)throw Error(u(189))}}if(l.alternate!==i)throw Error(u(190))}if(l.tag!==3)throw Error(u(188));return l.stateNode.current===l?e:t}function v(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=v(e),t!==null)return t;e=e.sibling}return null}var g=Object.assign,x=Symbol.for("react.element"),E=Symbol.for("react.transitional.element"),C=Symbol.for("react.portal"),H=Symbol.for("react.fragment"),B=Symbol.for("react.strict_mode"),O=Symbol.for("react.profiler"),K=Symbol.for("react.consumer"),V=Symbol.for("react.context"),le=Symbol.for("react.forward_ref"),ue=Symbol.for("react.suspense"),L=Symbol.for("react.suspense_list"),P=Symbol.for("react.memo"),se=Symbol.for("react.lazy"),ge=Symbol.for("react.activity"),U=Symbol.for("react.memo_cache_sentinel"),ie=Symbol.iterator;function ne(e){return e===null||typeof e!="object"?null:(e=ie&&e[ie]||e["@@iterator"],typeof e=="function"?e:null)}var be=Symbol.for("react.client.reference");function ae(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===be?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case H:return"Fragment";case O:return"Profiler";case B:return"StrictMode";case ue:return"Suspense";case L:return"SuspenseList";case ge:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case C:return"Portal";case V:return e.displayName||"Context";case K:return(e._context.displayName||"Context")+".Consumer";case le:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case P:return t=e.displayName||null,t!==null?t:ae(e.type)||"Memo";case se:t=e._payload,e=e._init;try{return ae(e(t))}catch{}}return null}var $=Array.isArray,D=a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,Z=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ce={pending:!1,data:null,method:null,action:null},Se=[],k=-1;function w(e){return{current:e}}function q(e){0>k||(e.current=Se[k],Se[k]=null,k--)}function b(e,t){k++,Se[k]=e.current,e.current=t}var _=w(null),G=w(null),F=w(null),ee=w(null);function re(e,t){switch(b(F,t),b(G,e),b(_,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?dp(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=dp(t),e=hp(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}q(_),b(_,e)}function de(){q(_),q(G),q(F)}function we(e){e.memoizedState!==null&&b(ee,e);var t=_.current,l=hp(t,e.type);t!==l&&(b(G,e),b(_,l))}function Ze(e){G.current===e&&(q(_),q(G)),ee.current===e&&(q(ee),xa._currentValue=ce)}var Te,Le;function Ue(e){if(Te===void 0)try{throw Error()}catch(l){var t=l.stack.trim().match(/\\n( *(at )?)/);Te=t&&t[1]||"",Le=-1<l.stack.indexOf(`\n    at`)?" (<anonymous>)":-1<l.stack.indexOf("@")?"@unknown:0:0":""}return`\n`+Te+e+Le}var tt=!1;function mt(e,t){if(!e||tt)return"";tt=!0;var l=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var I=function(){throw Error()};if(Object.defineProperty(I.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(I,[])}catch(j){var N=j}Reflect.construct(e,[],I)}else{try{I.call()}catch(j){N=j}e.call(I.prototype)}}else{try{throw Error()}catch(j){N=j}(I=e())&&typeof I.catch=="function"&&I.catch(function(){})}}catch(j){if(j&&N&&typeof j.stack=="string")return[j.stack,N.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var o=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");o&&o.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var s=i.DetermineComponentFrameRoot(),y=s[0],S=s[1];if(y&&S){var A=y.split(`\n`),R=S.split(`\n`);for(o=i=0;i<A.length&&!A[i].includes("DetermineComponentFrameRoot");)i++;for(;o<R.length&&!R[o].includes("DetermineComponentFrameRoot");)o++;if(i===A.length||o===R.length)for(i=A.length-1,o=R.length-1;1<=i&&0<=o&&A[i]!==R[o];)o--;for(;1<=i&&0<=o;i--,o--)if(A[i]!==R[o]){if(i!==1||o!==1)do if(i--,o--,0>o||A[i]!==R[o]){var Y=`\n`+A[i].replace(" at new "," at ");return e.displayName&&Y.includes("<anonymous>")&&(Y=Y.replace("<anonymous>",e.displayName)),Y}while(1<=i&&0<=o);break}}}finally{tt=!1,Error.prepareStackTrace=l}return(l=e?e.displayName||e.name:"")?Ue(l):""}function gt(e,t){switch(e.tag){case 26:case 27:case 5:return Ue(e.type);case 16:return Ue("Lazy");case 13:return e.child!==t&&t!==null?Ue("Suspense Fallback"):Ue("Suspense");case 19:return Ue("SuspenseList");case 0:case 15:return mt(e.type,!1);case 11:return mt(e.type.render,!1);case 1:return mt(e.type,!0);case 31:return Ue("Activity");default:return""}}function kn(e){try{var t="",l=null;do t+=gt(e,l),l=e,e=e.return;while(e);return t}catch(i){return`\nError generating stack: `+i.message+`\n`+i.stack}}var An=Object.prototype.hasOwnProperty,mn=n.unstable_scheduleCallback,Qn=n.unstable_cancelCallback,Eu=n.unstable_shouldYield,ku=n.unstable_requestPaint,Ct=n.unstable_now,Au=n.unstable_getCurrentPriorityLevel,X=n.unstable_ImmediatePriority,te=n.unstable_UserBlockingPriority,ye=n.unstable_NormalPriority,Ce=n.unstable_LowPriority,qe=n.unstable_IdlePriority,Vt=n.log,wn=n.unstable_setDisableYieldValue,zt=null,ft=null;function Mt(e){if(typeof Vt=="function"&&wn(e),ft&&typeof ft.setStrictMode=="function")try{ft.setStrictMode(zt,e)}catch{}}var Fe=Math.clz32?Math.clz32:oy,In=Math.log,sn=Math.LN2;function oy(e){return e>>>=0,e===0?32:31-(In(e)/sn|0)|0}var qa=256,Ya=262144,Va=4194304;function bl(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Ga(e,t,l){var i=e.pendingLanes;if(i===0)return 0;var o=0,s=e.suspendedLanes,y=e.pingedLanes;e=e.warmLanes;var S=i&134217727;return S!==0?(i=S&~s,i!==0?o=bl(i):(y&=S,y!==0?o=bl(y):l||(l=S&~e,l!==0&&(o=bl(l))))):(S=i&~s,S!==0?o=bl(S):y!==0?o=bl(y):l||(l=i&~e,l!==0&&(o=bl(l)))),o===0?0:t!==0&&t!==o&&(t&s)===0&&(s=o&-o,l=t&-t,s>=l||s===32&&(l&4194048)!==0)?t:o}function Ni(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function cy(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Is(){var e=Va;return Va<<=1,(Va&62914560)===0&&(Va=4194304),e}function wu(e){for(var t=[],l=0;31>l;l++)t.push(e);return t}function Li(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function sy(e,t,l,i,o,s){var y=e.pendingLanes;e.pendingLanes=l,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=l,e.entangledLanes&=l,e.errorRecoveryDisabledLanes&=l,e.shellSuspendCounter=0;var S=e.entanglements,A=e.expirationTimes,R=e.hiddenUpdates;for(l=y&~l;0<l;){var Y=31-Fe(l),I=1<<Y;S[Y]=0,A[Y]=-1;var N=R[Y];if(N!==null)for(R[Y]=null,Y=0;Y<N.length;Y++){var j=N[Y];j!==null&&(j.lane&=-536870913)}l&=~I}i!==0&&Zs(e,i,0),s!==0&&o===0&&e.tag!==0&&(e.suspendedLanes|=s&~(y&~t))}function Zs(e,t,l){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Fe(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|l&261930}function Fs(e,t){var l=e.entangledLanes|=t;for(e=e.entanglements;l;){var i=31-Fe(l),o=1<<i;o&t|e[i]&t&&(e[i]|=t),l&=~o}}function Ks(e,t){var l=t&-t;return l=(l&42)!==0?1:Tu(l),(l&(e.suspendedLanes|t))!==0?0:l}function Tu(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function Cu(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Js(){var e=Z.p;return e!==0?e:(e=window.event,e===void 0?32:Up(e.type))}function Ws(e,t){var l=Z.p;try{return Z.p=e,t()}finally{Z.p=l}}var Zn=Math.random().toString(36).slice(2),yt="__reactFiber$"+Zn,Rt="__reactProps$"+Zn,Yl="__reactContainer$"+Zn,zu="__reactEvents$"+Zn,fy="__reactListeners$"+Zn,dy="__reactHandles$"+Zn,$s="__reactResources$"+Zn,Ui="__reactMarker$"+Zn;function _u(e){delete e[yt],delete e[Rt],delete e[zu],delete e[fy],delete e[dy]}function Vl(e){var t=e[yt];if(t)return t;for(var l=e.parentNode;l;){if(t=l[Yl]||l[yt]){if(l=t.alternate,t.child!==null||l!==null&&l.child!==null)for(e=Sp(e);e!==null;){if(l=e[yt])return l;e=Sp(e)}return t}e=l,l=e.parentNode}return null}function Gl(e){if(e=e[yt]||e[Yl]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function ji(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(u(33))}function Xl(e){var t=e[$s];return t||(t=e[$s]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function ht(e){e[Ui]=!0}var Ps=new Set,ef={};function Sl(e,t){Ql(e,t),Ql(e+"Capture",t)}function Ql(e,t){for(ef[e]=t,e=0;e<t.length;e++)Ps.add(t[e])}var hy=RegExp("^[:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD][:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD\\\\-.0-9\\\\u00B7\\\\u0300-\\\\u036F\\\\u203F-\\\\u2040]*$"),tf={},nf={};function py(e){return An.call(nf,e)?!0:An.call(tf,e)?!1:hy.test(e)?nf[e]=!0:(tf[e]=!0,!1)}function Xa(e,t,l){if(py(t))if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+l)}}function Qa(e,t,l){if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+l)}}function Tn(e,t,l,i){if(i===null)e.removeAttribute(l);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(l);return}e.setAttributeNS(t,l,""+i)}}function $t(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function lf(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function my(e,t,l){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var o=i.get,s=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(y){l=""+y,s.call(this,y)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return l},setValue:function(y){l=""+y},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Ou(e){if(!e._valueTracker){var t=lf(e)?"checked":"value";e._valueTracker=my(e,t,""+e[t])}}function af(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var l=t.getValue(),i="";return e&&(i=lf(e)?e.checked?"true":"false":e.value),e=i,e!==l?(t.setValue(e),!0):!1}function Ia(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var gy=/[\\n"\\\\]/g;function Pt(e){return e.replace(gy,function(t){return"\\\\"+t.charCodeAt(0).toString(16)+" "})}function Du(e,t,l,i,o,s,y,S){e.name="",y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"?e.type=y:e.removeAttribute("type"),t!=null?y==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+$t(t)):e.value!==""+$t(t)&&(e.value=""+$t(t)):y!=="submit"&&y!=="reset"||e.removeAttribute("value"),t!=null?Mu(e,y,$t(t)):l!=null?Mu(e,y,$t(l)):i!=null&&e.removeAttribute("value"),o==null&&s!=null&&(e.defaultChecked=!!s),o!=null&&(e.checked=o&&typeof o!="function"&&typeof o!="symbol"),S!=null&&typeof S!="function"&&typeof S!="symbol"&&typeof S!="boolean"?e.name=""+$t(S):e.removeAttribute("name")}function rf(e,t,l,i,o,s,y,S){if(s!=null&&typeof s!="function"&&typeof s!="symbol"&&typeof s!="boolean"&&(e.type=s),t!=null||l!=null){if(!(s!=="submit"&&s!=="reset"||t!=null)){Ou(e);return}l=l!=null?""+$t(l):"",t=t!=null?""+$t(t):l,S||t===e.value||(e.value=t),e.defaultValue=t}i=i??o,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=S?e.checked:!!i,e.defaultChecked=!!i,y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"&&(e.name=y),Ou(e)}function Mu(e,t,l){t==="number"&&Ia(e.ownerDocument)===e||e.defaultValue===""+l||(e.defaultValue=""+l)}function Il(e,t,l,i){if(e=e.options,t){t={};for(var o=0;o<l.length;o++)t["$"+l[o]]=!0;for(l=0;l<e.length;l++)o=t.hasOwnProperty("$"+e[l].value),e[l].selected!==o&&(e[l].selected=o),o&&i&&(e[l].defaultSelected=!0)}else{for(l=""+$t(l),t=null,o=0;o<e.length;o++){if(e[o].value===l){e[o].selected=!0,i&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function uf(e,t,l){if(t!=null&&(t=""+$t(t),t!==e.value&&(e.value=t),l==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=l!=null?""+$t(l):""}function of(e,t,l,i){if(t==null){if(i!=null){if(l!=null)throw Error(u(92));if($(i)){if(1<i.length)throw Error(u(93));i=i[0]}l=i}l==null&&(l=""),t=l}l=$t(t),e.defaultValue=l,i=e.textContent,i===l&&i!==""&&i!==null&&(e.value=i),Ou(e)}function Zl(e,t){if(t){var l=e.firstChild;if(l&&l===e.lastChild&&l.nodeType===3){l.nodeValue=t;return}}e.textContent=t}var yy=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function cf(e,t,l){var i=t.indexOf("--")===0;l==null||typeof l=="boolean"||l===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,l):typeof l!="number"||l===0||yy.has(t)?t==="float"?e.cssFloat=l:e[t]=(""+l).trim():e[t]=l+"px"}function sf(e,t,l){if(t!=null&&typeof t!="object")throw Error(u(62));if(e=e.style,l!=null){for(var i in l)!l.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var o in t)i=t[o],t.hasOwnProperty(o)&&l[o]!==i&&cf(e,o,i)}else for(var s in t)t.hasOwnProperty(s)&&cf(e,s,t[s])}function Ru(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var vy=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),by=/^[\\u0000-\\u001F ]*j[\\r\\n\\t]*a[\\r\\n\\t]*v[\\r\\n\\t]*a[\\r\\n\\t]*s[\\r\\n\\t]*c[\\r\\n\\t]*r[\\r\\n\\t]*i[\\r\\n\\t]*p[\\r\\n\\t]*t[\\r\\n\\t]*:/i;function Za(e){return by.test(""+e)?"javascript:throw new Error(\'React has blocked a javascript: URL as a security precaution.\')":e}function Cn(){}var Nu=null;function Lu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Fl=null,Kl=null;function ff(e){var t=Gl(e);if(t&&(e=t.stateNode)){var l=e[Rt]||null;e:switch(e=t.stateNode,t.type){case"input":if(Du(e,l.value,l.defaultValue,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name),t=l.name,l.type==="radio"&&t!=null){for(l=e;l.parentNode;)l=l.parentNode;for(l=l.querySelectorAll(\'input[name="\'+Pt(""+t)+\'"][type="radio"]\'),t=0;t<l.length;t++){var i=l[t];if(i!==e&&i.form===e.form){var o=i[Rt]||null;if(!o)throw Error(u(90));Du(i,o.value,o.defaultValue,o.defaultValue,o.checked,o.defaultChecked,o.type,o.name)}}for(t=0;t<l.length;t++)i=l[t],i.form===e.form&&af(i)}break e;case"textarea":uf(e,l.value,l.defaultValue);break e;case"select":t=l.value,t!=null&&Il(e,!!l.multiple,t,!1)}}}var Uu=!1;function df(e,t,l){if(Uu)return e(t,l);Uu=!0;try{var i=e(t);return i}finally{if(Uu=!1,(Fl!==null||Kl!==null)&&(Nr(),Fl&&(t=Fl,e=Kl,Kl=Fl=null,ff(t),e)))for(t=0;t<e.length;t++)ff(e[t])}}function Bi(e,t){var l=e.stateNode;if(l===null)return null;var i=l[Rt]||null;if(i===null)return null;l=i[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break e;default:e=!1}if(e)return null;if(l&&typeof l!="function")throw Error(u(231,t,typeof l));return l}var zn=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),ju=!1;if(zn)try{var Hi={};Object.defineProperty(Hi,"passive",{get:function(){ju=!0}}),window.addEventListener("test",Hi,Hi),window.removeEventListener("test",Hi,Hi)}catch{ju=!1}var Fn=null,Bu=null,Fa=null;function hf(){if(Fa)return Fa;var e,t=Bu,l=t.length,i,o="value"in Fn?Fn.value:Fn.textContent,s=o.length;for(e=0;e<l&&t[e]===o[e];e++);var y=l-e;for(i=1;i<=y&&t[l-i]===o[s-i];i++);return Fa=o.slice(e,1<i?1-i:void 0)}function Ka(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Ja(){return!0}function pf(){return!1}function Nt(e){function t(l,i,o,s,y){this._reactName=l,this._targetInst=o,this.type=i,this.nativeEvent=s,this.target=y,this.currentTarget=null;for(var S in e)e.hasOwnProperty(S)&&(l=e[S],this[S]=l?l(s):s[S]);return this.isDefaultPrevented=(s.defaultPrevented!=null?s.defaultPrevented:s.returnValue===!1)?Ja:pf,this.isPropagationStopped=pf,this}return g(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var l=this.nativeEvent;l&&(l.preventDefault?l.preventDefault():typeof l.returnValue!="unknown"&&(l.returnValue=!1),this.isDefaultPrevented=Ja)},stopPropagation:function(){var l=this.nativeEvent;l&&(l.stopPropagation?l.stopPropagation():typeof l.cancelBubble!="unknown"&&(l.cancelBubble=!0),this.isPropagationStopped=Ja)},persist:function(){},isPersistent:Ja}),t}var xl={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Wa=Nt(xl),qi=g({},xl,{view:0,detail:0}),Sy=Nt(qi),Hu,qu,Yi,$a=g({},qi,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Vu,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Yi&&(Yi&&e.type==="mousemove"?(Hu=e.screenX-Yi.screenX,qu=e.screenY-Yi.screenY):qu=Hu=0,Yi=e),Hu)},movementY:function(e){return"movementY"in e?e.movementY:qu}}),mf=Nt($a),xy=g({},$a,{dataTransfer:0}),Ey=Nt(xy),ky=g({},qi,{relatedTarget:0}),Yu=Nt(ky),Ay=g({},xl,{animationName:0,elapsedTime:0,pseudoElement:0}),wy=Nt(Ay),Ty=g({},xl,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Cy=Nt(Ty),zy=g({},xl,{data:0}),gf=Nt(zy),_y={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Oy={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Dy={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function My(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Dy[e])?!!t[e]:!1}function Vu(){return My}var Ry=g({},qi,{key:function(e){if(e.key){var t=_y[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Ka(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Oy[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Vu,charCode:function(e){return e.type==="keypress"?Ka(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Ka(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Ny=Nt(Ry),Ly=g({},$a,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),yf=Nt(Ly),Uy=g({},qi,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Vu}),jy=Nt(Uy),By=g({},xl,{propertyName:0,elapsedTime:0,pseudoElement:0}),Hy=Nt(By),qy=g({},$a,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Yy=Nt(qy),Vy=g({},xl,{newState:0,oldState:0}),Gy=Nt(Vy),Xy=[9,13,27,32],Gu=zn&&"CompositionEvent"in window,Vi=null;zn&&"documentMode"in document&&(Vi=document.documentMode);var Qy=zn&&"TextEvent"in window&&!Vi,vf=zn&&(!Gu||Vi&&8<Vi&&11>=Vi),bf=" ",Sf=!1;function xf(e,t){switch(e){case"keyup":return Xy.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Ef(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Jl=!1;function Iy(e,t){switch(e){case"compositionend":return Ef(t);case"keypress":return t.which!==32?null:(Sf=!0,bf);case"textInput":return e=t.data,e===bf&&Sf?null:e;default:return null}}function Zy(e,t){if(Jl)return e==="compositionend"||!Gu&&xf(e,t)?(e=hf(),Fa=Bu=Fn=null,Jl=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return vf&&t.locale!=="ko"?null:t.data;default:return null}}var Fy={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function kf(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!Fy[e.type]:t==="textarea"}function Af(e,t,l,i){Fl?Kl?Kl.push(i):Kl=[i]:Fl=i,t=Yr(t,"onChange"),0<t.length&&(l=new Wa("onChange","change",null,l,i),e.push({event:l,listeners:t}))}var Gi=null,Xi=null;function Ky(e){rp(e,0)}function Pa(e){var t=ji(e);if(af(t))return e}function wf(e,t){if(e==="change")return t}var Tf=!1;if(zn){var Xu;if(zn){var Qu="oninput"in document;if(!Qu){var Cf=document.createElement("div");Cf.setAttribute("oninput","return;"),Qu=typeof Cf.oninput=="function"}Xu=Qu}else Xu=!1;Tf=Xu&&(!document.documentMode||9<document.documentMode)}function zf(){Gi&&(Gi.detachEvent("onpropertychange",_f),Xi=Gi=null)}function _f(e){if(e.propertyName==="value"&&Pa(Xi)){var t=[];Af(t,Xi,e,Lu(e)),df(Ky,t)}}function Jy(e,t,l){e==="focusin"?(zf(),Gi=t,Xi=l,Gi.attachEvent("onpropertychange",_f)):e==="focusout"&&zf()}function Wy(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Pa(Xi)}function $y(e,t){if(e==="click")return Pa(t)}function Py(e,t){if(e==="input"||e==="change")return Pa(t)}function e1(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Gt=typeof Object.is=="function"?Object.is:e1;function Qi(e,t){if(Gt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var l=Object.keys(e),i=Object.keys(t);if(l.length!==i.length)return!1;for(i=0;i<l.length;i++){var o=l[i];if(!An.call(t,o)||!Gt(e[o],t[o]))return!1}return!0}function Of(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Df(e,t){var l=Of(e);e=0;for(var i;l;){if(l.nodeType===3){if(i=e+l.textContent.length,e<=t&&i>=t)return{node:l,offset:t-e};e=i}e:{for(;l;){if(l.nextSibling){l=l.nextSibling;break e}l=l.parentNode}l=void 0}l=Of(l)}}function Mf(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Mf(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Rf(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Ia(e.document);t instanceof e.HTMLIFrameElement;){try{var l=typeof t.contentWindow.location.href=="string"}catch{l=!1}if(l)e=t.contentWindow;else break;t=Ia(e.document)}return t}function Iu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var t1=zn&&"documentMode"in document&&11>=document.documentMode,Wl=null,Zu=null,Ii=null,Fu=!1;function Nf(e,t,l){var i=l.window===l?l.document:l.nodeType===9?l:l.ownerDocument;Fu||Wl==null||Wl!==Ia(i)||(i=Wl,"selectionStart"in i&&Iu(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Ii&&Qi(Ii,i)||(Ii=i,i=Yr(Zu,"onSelect"),0<i.length&&(t=new Wa("onSelect","select",null,t,l),e.push({event:t,listeners:i}),t.target=Wl)))}function El(e,t){var l={};return l[e.toLowerCase()]=t.toLowerCase(),l["Webkit"+e]="webkit"+t,l["Moz"+e]="moz"+t,l}var $l={animationend:El("Animation","AnimationEnd"),animationiteration:El("Animation","AnimationIteration"),animationstart:El("Animation","AnimationStart"),transitionrun:El("Transition","TransitionRun"),transitionstart:El("Transition","TransitionStart"),transitioncancel:El("Transition","TransitionCancel"),transitionend:El("Transition","TransitionEnd")},Ku={},Lf={};zn&&(Lf=document.createElement("div").style,"AnimationEvent"in window||(delete $l.animationend.animation,delete $l.animationiteration.animation,delete $l.animationstart.animation),"TransitionEvent"in window||delete $l.transitionend.transition);function kl(e){if(Ku[e])return Ku[e];if(!$l[e])return e;var t=$l[e],l;for(l in t)if(t.hasOwnProperty(l)&&l in Lf)return Ku[e]=t[l];return e}var Uf=kl("animationend"),jf=kl("animationiteration"),Bf=kl("animationstart"),n1=kl("transitionrun"),l1=kl("transitionstart"),i1=kl("transitioncancel"),Hf=kl("transitionend"),qf=new Map,Ju="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Ju.push("scrollEnd");function fn(e,t){qf.set(e,t),Sl(t,[e])}var er=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},en=[],Pl=0,Wu=0;function tr(){for(var e=Pl,t=Wu=Pl=0;t<e;){var l=en[t];en[t++]=null;var i=en[t];en[t++]=null;var o=en[t];en[t++]=null;var s=en[t];if(en[t++]=null,i!==null&&o!==null){var y=i.pending;y===null?o.next=o:(o.next=y.next,y.next=o),i.pending=o}s!==0&&Yf(l,o,s)}}function nr(e,t,l,i){en[Pl++]=e,en[Pl++]=t,en[Pl++]=l,en[Pl++]=i,Wu|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function $u(e,t,l,i){return nr(e,t,l,i),lr(e)}function Al(e,t){return nr(e,null,null,t),lr(e)}function Yf(e,t,l){e.lanes|=l;var i=e.alternate;i!==null&&(i.lanes|=l);for(var o=!1,s=e.return;s!==null;)s.childLanes|=l,i=s.alternate,i!==null&&(i.childLanes|=l),s.tag===22&&(e=s.stateNode,e===null||e._visibility&1||(o=!0)),e=s,s=s.return;return e.tag===3?(s=e.stateNode,o&&t!==null&&(o=31-Fe(l),e=s.hiddenUpdates,i=e[o],i===null?e[o]=[t]:i.push(t),t.lane=l|536870912),s):null}function lr(e){if(50<pa)throw pa=0,oc=null,Error(u(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var ei={};function a1(e,t,l,i){this.tag=e,this.key=l,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Xt(e,t,l,i){return new a1(e,t,l,i)}function Pu(e){return e=e.prototype,!(!e||!e.isReactComponent)}function _n(e,t){var l=e.alternate;return l===null?(l=Xt(e.tag,t,e.key,e.mode),l.elementType=e.elementType,l.type=e.type,l.stateNode=e.stateNode,l.alternate=e,e.alternate=l):(l.pendingProps=t,l.type=e.type,l.flags=0,l.subtreeFlags=0,l.deletions=null),l.flags=e.flags&65011712,l.childLanes=e.childLanes,l.lanes=e.lanes,l.child=e.child,l.memoizedProps=e.memoizedProps,l.memoizedState=e.memoizedState,l.updateQueue=e.updateQueue,t=e.dependencies,l.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},l.sibling=e.sibling,l.index=e.index,l.ref=e.ref,l.refCleanup=e.refCleanup,l}function Vf(e,t){e.flags&=65011714;var l=e.alternate;return l===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=l.childLanes,e.lanes=l.lanes,e.child=l.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=l.memoizedProps,e.memoizedState=l.memoizedState,e.updateQueue=l.updateQueue,e.type=l.type,t=l.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function ir(e,t,l,i,o,s){var y=0;if(i=e,typeof e=="function")Pu(e)&&(y=1);else if(typeof e=="string")y=sv(e,l,_.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case ge:return e=Xt(31,l,t,o),e.elementType=ge,e.lanes=s,e;case H:return wl(l.children,o,s,t);case B:y=8,o|=24;break;case O:return e=Xt(12,l,t,o|2),e.elementType=O,e.lanes=s,e;case ue:return e=Xt(13,l,t,o),e.elementType=ue,e.lanes=s,e;case L:return e=Xt(19,l,t,o),e.elementType=L,e.lanes=s,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case V:y=10;break e;case K:y=9;break e;case le:y=11;break e;case P:y=14;break e;case se:y=16,i=null;break e}y=29,l=Error(u(130,e===null?"null":typeof e,"")),i=null}return t=Xt(y,l,t,o),t.elementType=e,t.type=i,t.lanes=s,t}function wl(e,t,l,i){return e=Xt(7,e,i,t),e.lanes=l,e}function eo(e,t,l){return e=Xt(6,e,null,t),e.lanes=l,e}function Gf(e){var t=Xt(18,null,null,0);return t.stateNode=e,t}function to(e,t,l){return t=Xt(4,e.children!==null?e.children:[],e.key,t),t.lanes=l,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Xf=new WeakMap;function tn(e,t){if(typeof e=="object"&&e!==null){var l=Xf.get(e);return l!==void 0?l:(t={value:e,source:t,stack:kn(t)},Xf.set(e,t),t)}return{value:e,source:t,stack:kn(t)}}var ti=[],ni=0,ar=null,Zi=0,nn=[],ln=0,Kn=null,gn=1,yn="";function On(e,t){ti[ni++]=Zi,ti[ni++]=ar,ar=e,Zi=t}function Qf(e,t,l){nn[ln++]=gn,nn[ln++]=yn,nn[ln++]=Kn,Kn=e;var i=gn;e=yn;var o=32-Fe(i)-1;i&=~(1<<o),l+=1;var s=32-Fe(t)+o;if(30<s){var y=o-o%5;s=(i&(1<<y)-1).toString(32),i>>=y,o-=y,gn=1<<32-Fe(t)+o|l<<o|i,yn=s+e}else gn=1<<s|l<<o|i,yn=e}function no(e){e.return!==null&&(On(e,1),Qf(e,1,0))}function lo(e){for(;e===ar;)ar=ti[--ni],ti[ni]=null,Zi=ti[--ni],ti[ni]=null;for(;e===Kn;)Kn=nn[--ln],nn[ln]=null,yn=nn[--ln],nn[ln]=null,gn=nn[--ln],nn[ln]=null}function If(e,t){nn[ln++]=gn,nn[ln++]=yn,nn[ln++]=Kn,gn=t.id,yn=t.overflow,Kn=e}var vt=null,$e=null,Re=!1,Jn=null,an=!1,io=Error(u(519));function Wn(e){var t=Error(u(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw Fi(tn(t,e)),io}function Zf(e){var t=e.stateNode,l=e.type,i=e.memoizedProps;switch(t[yt]=e,t[Rt]=i,l){case"dialog":_e("cancel",t),_e("close",t);break;case"iframe":case"object":case"embed":_e("load",t);break;case"video":case"audio":for(l=0;l<ga.length;l++)_e(ga[l],t);break;case"source":_e("error",t);break;case"img":case"image":case"link":_e("error",t),_e("load",t);break;case"details":_e("toggle",t);break;case"input":_e("invalid",t),rf(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":_e("invalid",t);break;case"textarea":_e("invalid",t),of(t,i.value,i.defaultValue,i.children)}l=i.children,typeof l!="string"&&typeof l!="number"&&typeof l!="bigint"||t.textContent===""+l||i.suppressHydrationWarning===!0||sp(t.textContent,l)?(i.popover!=null&&(_e("beforetoggle",t),_e("toggle",t)),i.onScroll!=null&&_e("scroll",t),i.onScrollEnd!=null&&_e("scrollend",t),i.onClick!=null&&(t.onclick=Cn),t=!0):t=!1,t||Wn(e,!0)}function Ff(e){for(vt=e.return;vt;)switch(vt.tag){case 5:case 31:case 13:an=!1;return;case 27:case 3:an=!0;return;default:vt=vt.return}}function li(e){if(e!==vt)return!1;if(!Re)return Ff(e),Re=!0,!1;var t=e.tag,l;if((l=t!==3&&t!==27)&&((l=t===5)&&(l=e.type,l=!(l!=="form"&&l!=="button")||kc(e.type,e.memoizedProps)),l=!l),l&&$e&&Wn(e),Ff(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));$e=bp(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));$e=bp(e)}else t===27?(t=$e,fl(e.type)?(e=zc,zc=null,$e=e):$e=t):$e=vt?un(e.stateNode.nextSibling):null;return!0}function Tl(){$e=vt=null,Re=!1}function ao(){var e=Jn;return e!==null&&(Bt===null?Bt=e:Bt.push.apply(Bt,e),Jn=null),e}function Fi(e){Jn===null?Jn=[e]:Jn.push(e)}var ro=w(null),Cl=null,Dn=null;function $n(e,t,l){b(ro,t._currentValue),t._currentValue=l}function Mn(e){e._currentValue=ro.current,q(ro)}function uo(e,t,l){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===l)break;e=e.return}}function oo(e,t,l,i){var o=e.child;for(o!==null&&(o.return=e);o!==null;){var s=o.dependencies;if(s!==null){var y=o.child;s=s.firstContext;e:for(;s!==null;){var S=s;s=o;for(var A=0;A<t.length;A++)if(S.context===t[A]){s.lanes|=l,S=s.alternate,S!==null&&(S.lanes|=l),uo(s.return,l,e),i||(y=null);break e}s=S.next}}else if(o.tag===18){if(y=o.return,y===null)throw Error(u(341));y.lanes|=l,s=y.alternate,s!==null&&(s.lanes|=l),uo(y,l,e),y=null}else y=o.child;if(y!==null)y.return=o;else for(y=o;y!==null;){if(y===e){y=null;break}if(o=y.sibling,o!==null){o.return=y.return,y=o;break}y=y.return}o=y}}function ii(e,t,l,i){e=null;for(var o=t,s=!1;o!==null;){if(!s){if((o.flags&524288)!==0)s=!0;else if((o.flags&262144)!==0)break}if(o.tag===10){var y=o.alternate;if(y===null)throw Error(u(387));if(y=y.memoizedProps,y!==null){var S=o.type;Gt(o.pendingProps.value,y.value)||(e!==null?e.push(S):e=[S])}}else if(o===ee.current){if(y=o.alternate,y===null)throw Error(u(387));y.memoizedState.memoizedState!==o.memoizedState.memoizedState&&(e!==null?e.push(xa):e=[xa])}o=o.return}e!==null&&oo(t,e,l,i),t.flags|=262144}function rr(e){for(e=e.firstContext;e!==null;){if(!Gt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function zl(e){Cl=e,Dn=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function bt(e){return Kf(Cl,e)}function ur(e,t){return Cl===null&&zl(e),Kf(e,t)}function Kf(e,t){var l=t._currentValue;if(t={context:t,memoizedValue:l,next:null},Dn===null){if(e===null)throw Error(u(308));Dn=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else Dn=Dn.next=t;return l}var r1=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(l,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(l){return l()})}},u1=n.unstable_scheduleCallback,o1=n.unstable_NormalPriority,rt={$$typeof:V,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function co(){return{controller:new r1,data:new Map,refCount:0}}function Ki(e){e.refCount--,e.refCount===0&&u1(o1,function(){e.controller.abort()})}var Ji=null,so=0,ai=0,ri=null;function c1(e,t){if(Ji===null){var l=Ji=[];so=0,ai=pc(),ri={status:"pending",value:void 0,then:function(i){l.push(i)}}}return so++,t.then(Jf,Jf),t}function Jf(){if(--so===0&&Ji!==null){ri!==null&&(ri.status="fulfilled");var e=Ji;Ji=null,ai=0,ri=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function s1(e,t){var l=[],i={status:"pending",value:null,reason:null,then:function(o){l.push(o)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var o=0;o<l.length;o++)(0,l[o])(t)},function(o){for(i.status="rejected",i.reason=o,o=0;o<l.length;o++)(0,l[o])(void 0)}),i}var Wf=D.S;D.S=function(e,t){Nh=Ct(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&c1(e,t),Wf!==null&&Wf(e,t)};var _l=w(null);function fo(){var e=_l.current;return e!==null?e:Ke.pooledCache}function or(e,t){t===null?b(_l,_l.current):b(_l,t.pool)}function $f(){var e=fo();return e===null?null:{parent:rt._currentValue,pool:e}}var ui=Error(u(460)),ho=Error(u(474)),cr=Error(u(542)),sr={then:function(){}};function Pf(e){return e=e.status,e==="fulfilled"||e==="rejected"}function ed(e,t,l){switch(l=e[l],l===void 0?e.push(t):l!==t&&(t.then(Cn,Cn),t=l),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,nd(e),e;default:if(typeof t.status=="string")t.then(Cn,Cn);else{if(e=Ke,e!==null&&100<e.shellSuspendCounter)throw Error(u(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var o=t;o.status="fulfilled",o.value=i}},function(i){if(t.status==="pending"){var o=t;o.status="rejected",o.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,nd(e),e}throw Dl=t,ui}}function Ol(e){try{var t=e._init;return t(e._payload)}catch(l){throw l!==null&&typeof l=="object"&&typeof l.then=="function"?(Dl=l,ui):l}}var Dl=null;function td(){if(Dl===null)throw Error(u(459));var e=Dl;return Dl=null,e}function nd(e){if(e===ui||e===cr)throw Error(u(483))}var oi=null,Wi=0;function fr(e){var t=Wi;return Wi+=1,oi===null&&(oi=[]),ed(oi,e,t)}function $i(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function dr(e,t){throw t.$$typeof===x?Error(u(525)):(e=Object.prototype.toString.call(t),Error(u(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function ld(e){function t(z,T){if(e){var M=z.deletions;M===null?(z.deletions=[T],z.flags|=16):M.push(T)}}function l(z,T){if(!e)return null;for(;T!==null;)t(z,T),T=T.sibling;return null}function i(z){for(var T=new Map;z!==null;)z.key!==null?T.set(z.key,z):T.set(z.index,z),z=z.sibling;return T}function o(z,T){return z=_n(z,T),z.index=0,z.sibling=null,z}function s(z,T,M){return z.index=M,e?(M=z.alternate,M!==null?(M=M.index,M<T?(z.flags|=67108866,T):M):(z.flags|=67108866,T)):(z.flags|=1048576,T)}function y(z){return e&&z.alternate===null&&(z.flags|=67108866),z}function S(z,T,M,Q){return T===null||T.tag!==6?(T=eo(M,z.mode,Q),T.return=z,T):(T=o(T,M),T.return=z,T)}function A(z,T,M,Q){var he=M.type;return he===H?Y(z,T,M.props.children,Q,M.key):T!==null&&(T.elementType===he||typeof he=="object"&&he!==null&&he.$$typeof===se&&Ol(he)===T.type)?(T=o(T,M.props),$i(T,M),T.return=z,T):(T=ir(M.type,M.key,M.props,null,z.mode,Q),$i(T,M),T.return=z,T)}function R(z,T,M,Q){return T===null||T.tag!==4||T.stateNode.containerInfo!==M.containerInfo||T.stateNode.implementation!==M.implementation?(T=to(M,z.mode,Q),T.return=z,T):(T=o(T,M.children||[]),T.return=z,T)}function Y(z,T,M,Q,he){return T===null||T.tag!==7?(T=wl(M,z.mode,Q,he),T.return=z,T):(T=o(T,M),T.return=z,T)}function I(z,T,M){if(typeof T=="string"&&T!==""||typeof T=="number"||typeof T=="bigint")return T=eo(""+T,z.mode,M),T.return=z,T;if(typeof T=="object"&&T!==null){switch(T.$$typeof){case E:return M=ir(T.type,T.key,T.props,null,z.mode,M),$i(M,T),M.return=z,M;case C:return T=to(T,z.mode,M),T.return=z,T;case se:return T=Ol(T),I(z,T,M)}if($(T)||ne(T))return T=wl(T,z.mode,M,null),T.return=z,T;if(typeof T.then=="function")return I(z,fr(T),M);if(T.$$typeof===V)return I(z,ur(z,T),M);dr(z,T)}return null}function N(z,T,M,Q){var he=T!==null?T.key:null;if(typeof M=="string"&&M!==""||typeof M=="number"||typeof M=="bigint")return he!==null?null:S(z,T,""+M,Q);if(typeof M=="object"&&M!==null){switch(M.$$typeof){case E:return M.key===he?A(z,T,M,Q):null;case C:return M.key===he?R(z,T,M,Q):null;case se:return M=Ol(M),N(z,T,M,Q)}if($(M)||ne(M))return he!==null?null:Y(z,T,M,Q,null);if(typeof M.then=="function")return N(z,T,fr(M),Q);if(M.$$typeof===V)return N(z,T,ur(z,M),Q);dr(z,M)}return null}function j(z,T,M,Q,he){if(typeof Q=="string"&&Q!==""||typeof Q=="number"||typeof Q=="bigint")return z=z.get(M)||null,S(T,z,""+Q,he);if(typeof Q=="object"&&Q!==null){switch(Q.$$typeof){case E:return z=z.get(Q.key===null?M:Q.key)||null,A(T,z,Q,he);case C:return z=z.get(Q.key===null?M:Q.key)||null,R(T,z,Q,he);case se:return Q=Ol(Q),j(z,T,M,Q,he)}if($(Q)||ne(Q))return z=z.get(M)||null,Y(T,z,Q,he,null);if(typeof Q.then=="function")return j(z,T,M,fr(Q),he);if(Q.$$typeof===V)return j(z,T,M,ur(T,Q),he);dr(T,Q)}return null}function oe(z,T,M,Q){for(var he=null,je=null,fe=T,ke=T=0,Me=null;fe!==null&&ke<M.length;ke++){fe.index>ke?(Me=fe,fe=null):Me=fe.sibling;var Be=N(z,fe,M[ke],Q);if(Be===null){fe===null&&(fe=Me);break}e&&fe&&Be.alternate===null&&t(z,fe),T=s(Be,T,ke),je===null?he=Be:je.sibling=Be,je=Be,fe=Me}if(ke===M.length)return l(z,fe),Re&&On(z,ke),he;if(fe===null){for(;ke<M.length;ke++)fe=I(z,M[ke],Q),fe!==null&&(T=s(fe,T,ke),je===null?he=fe:je.sibling=fe,je=fe);return Re&&On(z,ke),he}for(fe=i(fe);ke<M.length;ke++)Me=j(fe,z,ke,M[ke],Q),Me!==null&&(e&&Me.alternate!==null&&fe.delete(Me.key===null?ke:Me.key),T=s(Me,T,ke),je===null?he=Me:je.sibling=Me,je=Me);return e&&fe.forEach(function(gl){return t(z,gl)}),Re&&On(z,ke),he}function me(z,T,M,Q){if(M==null)throw Error(u(151));for(var he=null,je=null,fe=T,ke=T=0,Me=null,Be=M.next();fe!==null&&!Be.done;ke++,Be=M.next()){fe.index>ke?(Me=fe,fe=null):Me=fe.sibling;var gl=N(z,fe,Be.value,Q);if(gl===null){fe===null&&(fe=Me);break}e&&fe&&gl.alternate===null&&t(z,fe),T=s(gl,T,ke),je===null?he=gl:je.sibling=gl,je=gl,fe=Me}if(Be.done)return l(z,fe),Re&&On(z,ke),he;if(fe===null){for(;!Be.done;ke++,Be=M.next())Be=I(z,Be.value,Q),Be!==null&&(T=s(Be,T,ke),je===null?he=Be:je.sibling=Be,je=Be);return Re&&On(z,ke),he}for(fe=i(fe);!Be.done;ke++,Be=M.next())Be=j(fe,z,ke,Be.value,Q),Be!==null&&(e&&Be.alternate!==null&&fe.delete(Be.key===null?ke:Be.key),T=s(Be,T,ke),je===null?he=Be:je.sibling=Be,je=Be);return e&&fe.forEach(function(xv){return t(z,xv)}),Re&&On(z,ke),he}function Ie(z,T,M,Q){if(typeof M=="object"&&M!==null&&M.type===H&&M.key===null&&(M=M.props.children),typeof M=="object"&&M!==null){switch(M.$$typeof){case E:e:{for(var he=M.key;T!==null;){if(T.key===he){if(he=M.type,he===H){if(T.tag===7){l(z,T.sibling),Q=o(T,M.props.children),Q.return=z,z=Q;break e}}else if(T.elementType===he||typeof he=="object"&&he!==null&&he.$$typeof===se&&Ol(he)===T.type){l(z,T.sibling),Q=o(T,M.props),$i(Q,M),Q.return=z,z=Q;break e}l(z,T);break}else t(z,T);T=T.sibling}M.type===H?(Q=wl(M.props.children,z.mode,Q,M.key),Q.return=z,z=Q):(Q=ir(M.type,M.key,M.props,null,z.mode,Q),$i(Q,M),Q.return=z,z=Q)}return y(z);case C:e:{for(he=M.key;T!==null;){if(T.key===he)if(T.tag===4&&T.stateNode.containerInfo===M.containerInfo&&T.stateNode.implementation===M.implementation){l(z,T.sibling),Q=o(T,M.children||[]),Q.return=z,z=Q;break e}else{l(z,T);break}else t(z,T);T=T.sibling}Q=to(M,z.mode,Q),Q.return=z,z=Q}return y(z);case se:return M=Ol(M),Ie(z,T,M,Q)}if($(M))return oe(z,T,M,Q);if(ne(M)){if(he=ne(M),typeof he!="function")throw Error(u(150));return M=he.call(M),me(z,T,M,Q)}if(typeof M.then=="function")return Ie(z,T,fr(M),Q);if(M.$$typeof===V)return Ie(z,T,ur(z,M),Q);dr(z,M)}return typeof M=="string"&&M!==""||typeof M=="number"||typeof M=="bigint"?(M=""+M,T!==null&&T.tag===6?(l(z,T.sibling),Q=o(T,M),Q.return=z,z=Q):(l(z,T),Q=eo(M,z.mode,Q),Q.return=z,z=Q),y(z)):l(z,T)}return function(z,T,M,Q){try{Wi=0;var he=Ie(z,T,M,Q);return oi=null,he}catch(fe){if(fe===ui||fe===cr)throw fe;var je=Xt(29,fe,null,z.mode);return je.lanes=Q,je.return=z,je}finally{}}}var Ml=ld(!0),id=ld(!1),Pn=!1;function po(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function mo(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function el(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function tl(e,t,l){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(He&2)!==0){var o=i.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),i.pending=t,t=lr(e),Yf(e,null,l),t}return nr(e,i,t,l),lr(e)}function Pi(e,t,l){if(t=t.updateQueue,t!==null&&(t=t.shared,(l&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Fs(e,l)}}function go(e,t){var l=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,l===i)){var o=null,s=null;if(l=l.firstBaseUpdate,l!==null){do{var y={lane:l.lane,tag:l.tag,payload:l.payload,callback:null,next:null};s===null?o=s=y:s=s.next=y,l=l.next}while(l!==null);s===null?o=s=t:s=s.next=t}else o=s=t;l={baseState:i.baseState,firstBaseUpdate:o,lastBaseUpdate:s,shared:i.shared,callbacks:i.callbacks},e.updateQueue=l;return}e=l.lastBaseUpdate,e===null?l.firstBaseUpdate=t:e.next=t,l.lastBaseUpdate=t}var yo=!1;function ea(){if(yo){var e=ri;if(e!==null)throw e}}function ta(e,t,l,i){yo=!1;var o=e.updateQueue;Pn=!1;var s=o.firstBaseUpdate,y=o.lastBaseUpdate,S=o.shared.pending;if(S!==null){o.shared.pending=null;var A=S,R=A.next;A.next=null,y===null?s=R:y.next=R,y=A;var Y=e.alternate;Y!==null&&(Y=Y.updateQueue,S=Y.lastBaseUpdate,S!==y&&(S===null?Y.firstBaseUpdate=R:S.next=R,Y.lastBaseUpdate=A))}if(s!==null){var I=o.baseState;y=0,Y=R=A=null,S=s;do{var N=S.lane&-536870913,j=N!==S.lane;if(j?(De&N)===N:(i&N)===N){N!==0&&N===ai&&(yo=!0),Y!==null&&(Y=Y.next={lane:0,tag:S.tag,payload:S.payload,callback:null,next:null});e:{var oe=e,me=S;N=t;var Ie=l;switch(me.tag){case 1:if(oe=me.payload,typeof oe=="function"){I=oe.call(Ie,I,N);break e}I=oe;break e;case 3:oe.flags=oe.flags&-65537|128;case 0:if(oe=me.payload,N=typeof oe=="function"?oe.call(Ie,I,N):oe,N==null)break e;I=g({},I,N);break e;case 2:Pn=!0}}N=S.callback,N!==null&&(e.flags|=64,j&&(e.flags|=8192),j=o.callbacks,j===null?o.callbacks=[N]:j.push(N))}else j={lane:N,tag:S.tag,payload:S.payload,callback:S.callback,next:null},Y===null?(R=Y=j,A=I):Y=Y.next=j,y|=N;if(S=S.next,S===null){if(S=o.shared.pending,S===null)break;j=S,S=j.next,j.next=null,o.lastBaseUpdate=j,o.shared.pending=null}}while(!0);Y===null&&(A=I),o.baseState=A,o.firstBaseUpdate=R,o.lastBaseUpdate=Y,s===null&&(o.shared.lanes=0),rl|=y,e.lanes=y,e.memoizedState=I}}function ad(e,t){if(typeof e!="function")throw Error(u(191,e));e.call(t)}function rd(e,t){var l=e.callbacks;if(l!==null)for(e.callbacks=null,e=0;e<l.length;e++)ad(l[e],t)}var ci=w(null),hr=w(0);function ud(e,t){e=Yn,b(hr,e),b(ci,t),Yn=e|t.baseLanes}function vo(){b(hr,Yn),b(ci,ci.current)}function bo(){Yn=hr.current,q(ci),q(hr)}var Qt=w(null),rn=null;function nl(e){var t=e.alternate;b(it,it.current&1),b(Qt,e),rn===null&&(t===null||ci.current!==null||t.memoizedState!==null)&&(rn=e)}function So(e){b(it,it.current),b(Qt,e),rn===null&&(rn=e)}function od(e){e.tag===22?(b(it,it.current),b(Qt,e),rn===null&&(rn=e)):ll()}function ll(){b(it,it.current),b(Qt,Qt.current)}function It(e){q(Qt),rn===e&&(rn=null),q(it)}var it=w(0);function pr(e){for(var t=e;t!==null;){if(t.tag===13){var l=t.memoizedState;if(l!==null&&(l=l.dehydrated,l===null||Tc(l)||Cc(l)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Rn=0,Ee=null,Xe=null,ut=null,mr=!1,si=!1,Rl=!1,gr=0,na=0,fi=null,f1=0;function nt(){throw Error(u(321))}function xo(e,t){if(t===null)return!1;for(var l=0;l<t.length&&l<e.length;l++)if(!Gt(e[l],t[l]))return!1;return!0}function Eo(e,t,l,i,o,s){return Rn=s,Ee=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,D.H=e===null||e.memoizedState===null?Qd:jo,Rl=!1,s=l(i,o),Rl=!1,si&&(s=sd(t,l,i,o)),cd(e),s}function cd(e){D.H=aa;var t=Xe!==null&&Xe.next!==null;if(Rn=0,ut=Xe=Ee=null,mr=!1,na=0,fi=null,t)throw Error(u(300));e===null||ot||(e=e.dependencies,e!==null&&rr(e)&&(ot=!0))}function sd(e,t,l,i){Ee=e;var o=0;do{if(si&&(fi=null),na=0,si=!1,25<=o)throw Error(u(301));if(o+=1,ut=Xe=null,e.updateQueue!=null){var s=e.updateQueue;s.lastEffect=null,s.events=null,s.stores=null,s.memoCache!=null&&(s.memoCache.index=0)}D.H=Id,s=t(l,i)}while(si);return s}function d1(){var e=D.H,t=e.useState()[0];return t=typeof t.then=="function"?la(t):t,e=e.useState()[0],(Xe!==null?Xe.memoizedState:null)!==e&&(Ee.flags|=1024),t}function ko(){var e=gr!==0;return gr=0,e}function Ao(e,t,l){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l}function wo(e){if(mr){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}mr=!1}Rn=0,ut=Xe=Ee=null,si=!1,na=gr=0,fi=null}function _t(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return ut===null?Ee.memoizedState=ut=e:ut=ut.next=e,ut}function at(){if(Xe===null){var e=Ee.alternate;e=e!==null?e.memoizedState:null}else e=Xe.next;var t=ut===null?Ee.memoizedState:ut.next;if(t!==null)ut=t,Xe=e;else{if(e===null)throw Ee.alternate===null?Error(u(467)):Error(u(310));Xe=e,e={memoizedState:Xe.memoizedState,baseState:Xe.baseState,baseQueue:Xe.baseQueue,queue:Xe.queue,next:null},ut===null?Ee.memoizedState=ut=e:ut=ut.next=e}return ut}function yr(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function la(e){var t=na;return na+=1,fi===null&&(fi=[]),e=ed(fi,e,t),t=Ee,(ut===null?t.memoizedState:ut.next)===null&&(t=t.alternate,D.H=t===null||t.memoizedState===null?Qd:jo),e}function vr(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return la(e);if(e.$$typeof===V)return bt(e)}throw Error(u(438,String(e)))}function To(e){var t=null,l=Ee.updateQueue;if(l!==null&&(t=l.memoCache),t==null){var i=Ee.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(o){return o.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),l===null&&(l=yr(),Ee.updateQueue=l),l.memoCache=t,l=t.data[t.index],l===void 0)for(l=t.data[t.index]=Array(e),i=0;i<e;i++)l[i]=U;return t.index++,l}function Nn(e,t){return typeof t=="function"?t(e):t}function br(e){var t=at();return Co(t,Xe,e)}function Co(e,t,l){var i=e.queue;if(i===null)throw Error(u(311));i.lastRenderedReducer=l;var o=e.baseQueue,s=i.pending;if(s!==null){if(o!==null){var y=o.next;o.next=s.next,s.next=y}t.baseQueue=o=s,i.pending=null}if(s=e.baseState,o===null)e.memoizedState=s;else{t=o.next;var S=y=null,A=null,R=t,Y=!1;do{var I=R.lane&-536870913;if(I!==R.lane?(De&I)===I:(Rn&I)===I){var N=R.revertLane;if(N===0)A!==null&&(A=A.next={lane:0,revertLane:0,gesture:null,action:R.action,hasEagerState:R.hasEagerState,eagerState:R.eagerState,next:null}),I===ai&&(Y=!0);else if((Rn&N)===N){R=R.next,N===ai&&(Y=!0);continue}else I={lane:0,revertLane:R.revertLane,gesture:null,action:R.action,hasEagerState:R.hasEagerState,eagerState:R.eagerState,next:null},A===null?(S=A=I,y=s):A=A.next=I,Ee.lanes|=N,rl|=N;I=R.action,Rl&&l(s,I),s=R.hasEagerState?R.eagerState:l(s,I)}else N={lane:I,revertLane:R.revertLane,gesture:R.gesture,action:R.action,hasEagerState:R.hasEagerState,eagerState:R.eagerState,next:null},A===null?(S=A=N,y=s):A=A.next=N,Ee.lanes|=I,rl|=I;R=R.next}while(R!==null&&R!==t);if(A===null?y=s:A.next=S,!Gt(s,e.memoizedState)&&(ot=!0,Y&&(l=ri,l!==null)))throw l;e.memoizedState=s,e.baseState=y,e.baseQueue=A,i.lastRenderedState=s}return o===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function zo(e){var t=at(),l=t.queue;if(l===null)throw Error(u(311));l.lastRenderedReducer=e;var i=l.dispatch,o=l.pending,s=t.memoizedState;if(o!==null){l.pending=null;var y=o=o.next;do s=e(s,y.action),y=y.next;while(y!==o);Gt(s,t.memoizedState)||(ot=!0),t.memoizedState=s,t.baseQueue===null&&(t.baseState=s),l.lastRenderedState=s}return[s,i]}function fd(e,t,l){var i=Ee,o=at(),s=Re;if(s){if(l===void 0)throw Error(u(407));l=l()}else l=t();var y=!Gt((Xe||o).memoizedState,l);if(y&&(o.memoizedState=l,ot=!0),o=o.queue,Do(pd.bind(null,i,o,e),[e]),o.getSnapshot!==t||y||ut!==null&&ut.memoizedState.tag&1){if(i.flags|=2048,di(9,{destroy:void 0},hd.bind(null,i,o,l,t),null),Ke===null)throw Error(u(349));s||(Rn&127)!==0||dd(i,t,l)}return l}function dd(e,t,l){e.flags|=16384,e={getSnapshot:t,value:l},t=Ee.updateQueue,t===null?(t=yr(),Ee.updateQueue=t,t.stores=[e]):(l=t.stores,l===null?t.stores=[e]:l.push(e))}function hd(e,t,l,i){t.value=l,t.getSnapshot=i,md(t)&&gd(e)}function pd(e,t,l){return l(function(){md(t)&&gd(e)})}function md(e){var t=e.getSnapshot;e=e.value;try{var l=t();return!Gt(e,l)}catch{return!0}}function gd(e){var t=Al(e,2);t!==null&&Ht(t,e,2)}function _o(e){var t=_t();if(typeof e=="function"){var l=e;if(e=l(),Rl){Mt(!0);try{l()}finally{Mt(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Nn,lastRenderedState:e},t}function yd(e,t,l,i){return e.baseState=l,Co(e,Xe,typeof i=="function"?i:Nn)}function h1(e,t,l,i,o){if(Er(e))throw Error(u(485));if(e=t.action,e!==null){var s={payload:o,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(y){s.listeners.push(y)}};D.T!==null?l(!0):s.isTransition=!1,i(s),l=t.pending,l===null?(s.next=t.pending=s,vd(t,s)):(s.next=l.next,t.pending=l.next=s)}}function vd(e,t){var l=t.action,i=t.payload,o=e.state;if(t.isTransition){var s=D.T,y={};D.T=y;try{var S=l(o,i),A=D.S;A!==null&&A(y,S),bd(e,t,S)}catch(R){Oo(e,t,R)}finally{s!==null&&y.types!==null&&(s.types=y.types),D.T=s}}else try{s=l(o,i),bd(e,t,s)}catch(R){Oo(e,t,R)}}function bd(e,t,l){l!==null&&typeof l=="object"&&typeof l.then=="function"?l.then(function(i){Sd(e,t,i)},function(i){return Oo(e,t,i)}):Sd(e,t,l)}function Sd(e,t,l){t.status="fulfilled",t.value=l,xd(t),e.state=l,t=e.pending,t!==null&&(l=t.next,l===t?e.pending=null:(l=l.next,t.next=l,vd(e,l)))}function Oo(e,t,l){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=l,xd(t),t=t.next;while(t!==i)}e.action=null}function xd(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Ed(e,t){return t}function kd(e,t){if(Re){var l=Ke.formState;if(l!==null){e:{var i=Ee;if(Re){if($e){t:{for(var o=$e,s=an;o.nodeType!==8;){if(!s){o=null;break t}if(o=un(o.nextSibling),o===null){o=null;break t}}s=o.data,o=s==="F!"||s==="F"?o:null}if(o){$e=un(o.nextSibling),i=o.data==="F!";break e}}Wn(i)}i=!1}i&&(t=l[0])}}return l=_t(),l.memoizedState=l.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Ed,lastRenderedState:t},l.queue=i,l=Vd.bind(null,Ee,i),i.dispatch=l,i=_o(!1),s=Uo.bind(null,Ee,!1,i.queue),i=_t(),o={state:t,dispatch:null,action:e,pending:null},i.queue=o,l=h1.bind(null,Ee,o,s,l),o.dispatch=l,i.memoizedState=e,[t,l,!1]}function Ad(e){var t=at();return wd(t,Xe,e)}function wd(e,t,l){if(t=Co(e,t,Ed)[0],e=br(Nn)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=la(t)}catch(y){throw y===ui?cr:y}else i=t;t=at();var o=t.queue,s=o.dispatch;return l!==t.memoizedState&&(Ee.flags|=2048,di(9,{destroy:void 0},p1.bind(null,o,l),null)),[i,s,e]}function p1(e,t){e.action=t}function Td(e){var t=at(),l=Xe;if(l!==null)return wd(t,l,e);at(),t=t.memoizedState,l=at();var i=l.queue.dispatch;return l.memoizedState=e,[t,i,!1]}function di(e,t,l,i){return e={tag:e,create:l,deps:i,inst:t,next:null},t=Ee.updateQueue,t===null&&(t=yr(),Ee.updateQueue=t),l=t.lastEffect,l===null?t.lastEffect=e.next=e:(i=l.next,l.next=e,e.next=i,t.lastEffect=e),e}function Cd(){return at().memoizedState}function Sr(e,t,l,i){var o=_t();Ee.flags|=e,o.memoizedState=di(1|t,{destroy:void 0},l,i===void 0?null:i)}function xr(e,t,l,i){var o=at();i=i===void 0?null:i;var s=o.memoizedState.inst;Xe!==null&&i!==null&&xo(i,Xe.memoizedState.deps)?o.memoizedState=di(t,s,l,i):(Ee.flags|=e,o.memoizedState=di(1|t,s,l,i))}function zd(e,t){Sr(8390656,8,e,t)}function Do(e,t){xr(2048,8,e,t)}function m1(e){Ee.flags|=4;var t=Ee.updateQueue;if(t===null)t=yr(),Ee.updateQueue=t,t.events=[e];else{var l=t.events;l===null?t.events=[e]:l.push(e)}}function _d(e){var t=at().memoizedState;return m1({ref:t,nextImpl:e}),function(){if((He&2)!==0)throw Error(u(440));return t.impl.apply(void 0,arguments)}}function Od(e,t){return xr(4,2,e,t)}function Dd(e,t){return xr(4,4,e,t)}function Md(e,t){if(typeof t=="function"){e=e();var l=t(e);return function(){typeof l=="function"?l():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Rd(e,t,l){l=l!=null?l.concat([e]):null,xr(4,4,Md.bind(null,t,e),l)}function Mo(){}function Nd(e,t){var l=at();t=t===void 0?null:t;var i=l.memoizedState;return t!==null&&xo(t,i[1])?i[0]:(l.memoizedState=[e,t],e)}function Ld(e,t){var l=at();t=t===void 0?null:t;var i=l.memoizedState;if(t!==null&&xo(t,i[1]))return i[0];if(i=e(),Rl){Mt(!0);try{e()}finally{Mt(!1)}}return l.memoizedState=[i,t],i}function Ro(e,t,l){return l===void 0||(Rn&1073741824)!==0&&(De&261930)===0?e.memoizedState=t:(e.memoizedState=l,e=Uh(),Ee.lanes|=e,rl|=e,l)}function Ud(e,t,l,i){return Gt(l,t)?l:ci.current!==null?(e=Ro(e,l,i),Gt(e,t)||(ot=!0),e):(Rn&42)===0||(Rn&1073741824)!==0&&(De&261930)===0?(ot=!0,e.memoizedState=l):(e=Uh(),Ee.lanes|=e,rl|=e,t)}function jd(e,t,l,i,o){var s=Z.p;Z.p=s!==0&&8>s?s:8;var y=D.T,S={};D.T=S,Uo(e,!1,t,l);try{var A=o(),R=D.S;if(R!==null&&R(S,A),A!==null&&typeof A=="object"&&typeof A.then=="function"){var Y=s1(A,i);ia(e,t,Y,Kt(e))}else ia(e,t,i,Kt(e))}catch(I){ia(e,t,{then:function(){},status:"rejected",reason:I},Kt())}finally{Z.p=s,y!==null&&S.types!==null&&(y.types=S.types),D.T=y}}function g1(){}function No(e,t,l,i){if(e.tag!==5)throw Error(u(476));var o=Bd(e).queue;jd(e,o,t,ce,l===null?g1:function(){return Hd(e),l(i)})}function Bd(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:ce,baseState:ce,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Nn,lastRenderedState:ce},next:null};var l={};return t.next={memoizedState:l,baseState:l,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Nn,lastRenderedState:l},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function Hd(e){var t=Bd(e);t.next===null&&(t=e.alternate.memoizedState),ia(e,t.next.queue,{},Kt())}function Lo(){return bt(xa)}function qd(){return at().memoizedState}function Yd(){return at().memoizedState}function y1(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var l=Kt();e=el(l);var i=tl(t,e,l);i!==null&&(Ht(i,t,l),Pi(i,t,l)),t={cache:co()},e.payload=t;return}t=t.return}}function v1(e,t,l){var i=Kt();l={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null},Er(e)?Gd(t,l):(l=$u(e,t,l,i),l!==null&&(Ht(l,e,i),Xd(l,t,i)))}function Vd(e,t,l){var i=Kt();ia(e,t,l,i)}function ia(e,t,l,i){var o={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null};if(Er(e))Gd(t,o);else{var s=e.alternate;if(e.lanes===0&&(s===null||s.lanes===0)&&(s=t.lastRenderedReducer,s!==null))try{var y=t.lastRenderedState,S=s(y,l);if(o.hasEagerState=!0,o.eagerState=S,Gt(S,y))return nr(e,t,o,0),Ke===null&&tr(),!1}catch{}finally{}if(l=$u(e,t,o,i),l!==null)return Ht(l,e,i),Xd(l,t,i),!0}return!1}function Uo(e,t,l,i){if(i={lane:2,revertLane:pc(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Er(e)){if(t)throw Error(u(479))}else t=$u(e,l,i,2),t!==null&&Ht(t,e,2)}function Er(e){var t=e.alternate;return e===Ee||t!==null&&t===Ee}function Gd(e,t){si=mr=!0;var l=e.pending;l===null?t.next=t:(t.next=l.next,l.next=t),e.pending=t}function Xd(e,t,l){if((l&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Fs(e,l)}}var aa={readContext:bt,use:vr,useCallback:nt,useContext:nt,useEffect:nt,useImperativeHandle:nt,useLayoutEffect:nt,useInsertionEffect:nt,useMemo:nt,useReducer:nt,useRef:nt,useState:nt,useDebugValue:nt,useDeferredValue:nt,useTransition:nt,useSyncExternalStore:nt,useId:nt,useHostTransitionStatus:nt,useFormState:nt,useActionState:nt,useOptimistic:nt,useMemoCache:nt,useCacheRefresh:nt};aa.useEffectEvent=nt;var Qd={readContext:bt,use:vr,useCallback:function(e,t){return _t().memoizedState=[e,t===void 0?null:t],e},useContext:bt,useEffect:zd,useImperativeHandle:function(e,t,l){l=l!=null?l.concat([e]):null,Sr(4194308,4,Md.bind(null,t,e),l)},useLayoutEffect:function(e,t){return Sr(4194308,4,e,t)},useInsertionEffect:function(e,t){Sr(4,2,e,t)},useMemo:function(e,t){var l=_t();t=t===void 0?null:t;var i=e();if(Rl){Mt(!0);try{e()}finally{Mt(!1)}}return l.memoizedState=[i,t],i},useReducer:function(e,t,l){var i=_t();if(l!==void 0){var o=l(t);if(Rl){Mt(!0);try{l(t)}finally{Mt(!1)}}}else o=t;return i.memoizedState=i.baseState=o,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:o},i.queue=e,e=e.dispatch=v1.bind(null,Ee,e),[i.memoizedState,e]},useRef:function(e){var t=_t();return e={current:e},t.memoizedState=e},useState:function(e){e=_o(e);var t=e.queue,l=Vd.bind(null,Ee,t);return t.dispatch=l,[e.memoizedState,l]},useDebugValue:Mo,useDeferredValue:function(e,t){var l=_t();return Ro(l,e,t)},useTransition:function(){var e=_o(!1);return e=jd.bind(null,Ee,e.queue,!0,!1),_t().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,l){var i=Ee,o=_t();if(Re){if(l===void 0)throw Error(u(407));l=l()}else{if(l=t(),Ke===null)throw Error(u(349));(De&127)!==0||dd(i,t,l)}o.memoizedState=l;var s={value:l,getSnapshot:t};return o.queue=s,zd(pd.bind(null,i,s,e),[e]),i.flags|=2048,di(9,{destroy:void 0},hd.bind(null,i,s,l,t),null),l},useId:function(){var e=_t(),t=Ke.identifierPrefix;if(Re){var l=yn,i=gn;l=(i&~(1<<32-Fe(i)-1)).toString(32)+l,t="_"+t+"R_"+l,l=gr++,0<l&&(t+="H"+l.toString(32)),t+="_"}else l=f1++,t="_"+t+"r_"+l.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Lo,useFormState:kd,useActionState:kd,useOptimistic:function(e){var t=_t();t.memoizedState=t.baseState=e;var l={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=l,t=Uo.bind(null,Ee,!0,l),l.dispatch=t,[e,t]},useMemoCache:To,useCacheRefresh:function(){return _t().memoizedState=y1.bind(null,Ee)},useEffectEvent:function(e){var t=_t(),l={impl:e};return t.memoizedState=l,function(){if((He&2)!==0)throw Error(u(440));return l.impl.apply(void 0,arguments)}}},jo={readContext:bt,use:vr,useCallback:Nd,useContext:bt,useEffect:Do,useImperativeHandle:Rd,useInsertionEffect:Od,useLayoutEffect:Dd,useMemo:Ld,useReducer:br,useRef:Cd,useState:function(){return br(Nn)},useDebugValue:Mo,useDeferredValue:function(e,t){var l=at();return Ud(l,Xe.memoizedState,e,t)},useTransition:function(){var e=br(Nn)[0],t=at().memoizedState;return[typeof e=="boolean"?e:la(e),t]},useSyncExternalStore:fd,useId:qd,useHostTransitionStatus:Lo,useFormState:Ad,useActionState:Ad,useOptimistic:function(e,t){var l=at();return yd(l,Xe,e,t)},useMemoCache:To,useCacheRefresh:Yd};jo.useEffectEvent=_d;var Id={readContext:bt,use:vr,useCallback:Nd,useContext:bt,useEffect:Do,useImperativeHandle:Rd,useInsertionEffect:Od,useLayoutEffect:Dd,useMemo:Ld,useReducer:zo,useRef:Cd,useState:function(){return zo(Nn)},useDebugValue:Mo,useDeferredValue:function(e,t){var l=at();return Xe===null?Ro(l,e,t):Ud(l,Xe.memoizedState,e,t)},useTransition:function(){var e=zo(Nn)[0],t=at().memoizedState;return[typeof e=="boolean"?e:la(e),t]},useSyncExternalStore:fd,useId:qd,useHostTransitionStatus:Lo,useFormState:Td,useActionState:Td,useOptimistic:function(e,t){var l=at();return Xe!==null?yd(l,Xe,e,t):(l.baseState=e,[e,l.queue.dispatch])},useMemoCache:To,useCacheRefresh:Yd};Id.useEffectEvent=_d;function Bo(e,t,l,i){t=e.memoizedState,l=l(i,t),l=l==null?t:g({},t,l),e.memoizedState=l,e.lanes===0&&(e.updateQueue.baseState=l)}var Ho={enqueueSetState:function(e,t,l){e=e._reactInternals;var i=Kt(),o=el(i);o.payload=t,l!=null&&(o.callback=l),t=tl(e,o,i),t!==null&&(Ht(t,e,i),Pi(t,e,i))},enqueueReplaceState:function(e,t,l){e=e._reactInternals;var i=Kt(),o=el(i);o.tag=1,o.payload=t,l!=null&&(o.callback=l),t=tl(e,o,i),t!==null&&(Ht(t,e,i),Pi(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var l=Kt(),i=el(l);i.tag=2,t!=null&&(i.callback=t),t=tl(e,i,l),t!==null&&(Ht(t,e,l),Pi(t,e,l))}};function Zd(e,t,l,i,o,s,y){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,s,y):t.prototype&&t.prototype.isPureReactComponent?!Qi(l,i)||!Qi(o,s):!0}function Fd(e,t,l,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(l,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(l,i),t.state!==e&&Ho.enqueueReplaceState(t,t.state,null)}function Nl(e,t){var l=t;if("ref"in t){l={};for(var i in t)i!=="ref"&&(l[i]=t[i])}if(e=e.defaultProps){l===t&&(l=g({},l));for(var o in e)l[o]===void 0&&(l[o]=e[o])}return l}function Kd(e){er(e)}function Jd(e){console.error(e)}function Wd(e){er(e)}function kr(e,t){try{var l=e.onUncaughtError;l(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function $d(e,t,l){try{var i=e.onCaughtError;i(l.value,{componentStack:l.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(o){setTimeout(function(){throw o})}}function qo(e,t,l){return l=el(l),l.tag=3,l.payload={element:null},l.callback=function(){kr(e,t)},l}function Pd(e){return e=el(e),e.tag=3,e}function eh(e,t,l,i){var o=l.type.getDerivedStateFromError;if(typeof o=="function"){var s=i.value;e.payload=function(){return o(s)},e.callback=function(){$d(t,l,i)}}var y=l.stateNode;y!==null&&typeof y.componentDidCatch=="function"&&(e.callback=function(){$d(t,l,i),typeof o!="function"&&(ul===null?ul=new Set([this]):ul.add(this));var S=i.stack;this.componentDidCatch(i.value,{componentStack:S!==null?S:""})})}function b1(e,t,l,i,o){if(l.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=l.alternate,t!==null&&ii(t,l,o,!0),l=Qt.current,l!==null){switch(l.tag){case 31:case 13:return rn===null?Lr():l.alternate===null&&lt===0&&(lt=3),l.flags&=-257,l.flags|=65536,l.lanes=o,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?l.updateQueue=new Set([i]):t.add(i),fc(e,i,o)),!1;case 22:return l.flags|=65536,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},l.updateQueue=t):(l=t.retryQueue,l===null?t.retryQueue=new Set([i]):l.add(i)),fc(e,i,o)),!1}throw Error(u(435,l.tag))}return fc(e,i,o),Lr(),!1}if(Re)return t=Qt.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=o,i!==io&&(e=Error(u(422),{cause:i}),Fi(tn(e,l)))):(i!==io&&(t=Error(u(423),{cause:i}),Fi(tn(t,l))),e=e.current.alternate,e.flags|=65536,o&=-o,e.lanes|=o,i=tn(i,l),o=qo(e.stateNode,i,o),go(e,o),lt!==4&&(lt=2)),!1;var s=Error(u(520),{cause:i});if(s=tn(s,l),ha===null?ha=[s]:ha.push(s),lt!==4&&(lt=2),t===null)return!0;i=tn(i,l),l=t;do{switch(l.tag){case 3:return l.flags|=65536,e=o&-o,l.lanes|=e,e=qo(l.stateNode,i,e),go(l,e),!1;case 1:if(t=l.type,s=l.stateNode,(l.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||s!==null&&typeof s.componentDidCatch=="function"&&(ul===null||!ul.has(s))))return l.flags|=65536,o&=-o,l.lanes|=o,o=Pd(o),eh(o,e,l,i),go(l,o),!1}l=l.return}while(l!==null);return!1}var Yo=Error(u(461)),ot=!1;function St(e,t,l,i){t.child=e===null?id(t,null,l,i):Ml(t,e.child,l,i)}function th(e,t,l,i,o){l=l.render;var s=t.ref;if("ref"in i){var y={};for(var S in i)S!=="ref"&&(y[S]=i[S])}else y=i;return zl(t),i=Eo(e,t,l,y,s,o),S=ko(),e!==null&&!ot?(Ao(e,t,o),Ln(e,t,o)):(Re&&S&&no(t),t.flags|=1,St(e,t,i,o),t.child)}function nh(e,t,l,i,o){if(e===null){var s=l.type;return typeof s=="function"&&!Pu(s)&&s.defaultProps===void 0&&l.compare===null?(t.tag=15,t.type=s,lh(e,t,s,i,o)):(e=ir(l.type,null,i,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(s=e.child,!Ko(e,o)){var y=s.memoizedProps;if(l=l.compare,l=l!==null?l:Qi,l(y,i)&&e.ref===t.ref)return Ln(e,t,o)}return t.flags|=1,e=_n(s,i),e.ref=t.ref,e.return=t,t.child=e}function lh(e,t,l,i,o){if(e!==null){var s=e.memoizedProps;if(Qi(s,i)&&e.ref===t.ref)if(ot=!1,t.pendingProps=i=s,Ko(e,o))(e.flags&131072)!==0&&(ot=!0);else return t.lanes=e.lanes,Ln(e,t,o)}return Vo(e,t,l,i,o)}function ih(e,t,l,i){var o=i.children,s=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(s=s!==null?s.baseLanes|l:l,e!==null){for(i=t.child=e.child,o=0;i!==null;)o=o|i.lanes|i.childLanes,i=i.sibling;i=o&~s}else i=0,t.child=null;return ah(e,t,s,l,i)}if((l&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&or(t,s!==null?s.cachePool:null),s!==null?ud(t,s):vo(),od(t);else return i=t.lanes=536870912,ah(e,t,s!==null?s.baseLanes|l:l,l,i)}else s!==null?(or(t,s.cachePool),ud(t,s),ll(),t.memoizedState=null):(e!==null&&or(t,null),vo(),ll());return St(e,t,o,l),t.child}function ra(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function ah(e,t,l,i,o){var s=fo();return s=s===null?null:{parent:rt._currentValue,pool:s},t.memoizedState={baseLanes:l,cachePool:s},e!==null&&or(t,null),vo(),od(t),e!==null&&ii(e,t,i,!0),t.childLanes=o,null}function Ar(e,t){return t=Tr({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function rh(e,t,l){return Ml(t,e.child,null,l),e=Ar(t,t.pendingProps),e.flags|=2,It(t),t.memoizedState=null,e}function S1(e,t,l){var i=t.pendingProps,o=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(Re){if(i.mode==="hidden")return e=Ar(t,i),t.lanes=536870912,ra(null,e);if(So(t),(e=$e)?(e=vp(e,an),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Kn!==null?{id:gn,overflow:yn}:null,retryLane:536870912,hydrationErrors:null},l=Gf(e),l.return=t,t.child=l,vt=t,$e=null)):e=null,e===null)throw Wn(t);return t.lanes=536870912,null}return Ar(t,i)}var s=e.memoizedState;if(s!==null){var y=s.dehydrated;if(So(t),o)if(t.flags&256)t.flags&=-257,t=rh(e,t,l);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(u(558));else if(ot||ii(e,t,l,!1),o=(l&e.childLanes)!==0,ot||o){if(i=Ke,i!==null&&(y=Ks(i,l),y!==0&&y!==s.retryLane))throw s.retryLane=y,Al(e,y),Ht(i,e,y),Yo;Lr(),t=rh(e,t,l)}else e=s.treeContext,$e=un(y.nextSibling),vt=t,Re=!0,Jn=null,an=!1,e!==null&&If(t,e),t=Ar(t,i),t.flags|=4096;return t}return e=_n(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function wr(e,t){var l=t.ref;if(l===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof l!="function"&&typeof l!="object")throw Error(u(284));(e===null||e.ref!==l)&&(t.flags|=4194816)}}function Vo(e,t,l,i,o){return zl(t),l=Eo(e,t,l,i,void 0,o),i=ko(),e!==null&&!ot?(Ao(e,t,o),Ln(e,t,o)):(Re&&i&&no(t),t.flags|=1,St(e,t,l,o),t.child)}function uh(e,t,l,i,o,s){return zl(t),t.updateQueue=null,l=sd(t,i,l,o),cd(e),i=ko(),e!==null&&!ot?(Ao(e,t,s),Ln(e,t,s)):(Re&&i&&no(t),t.flags|=1,St(e,t,l,s),t.child)}function oh(e,t,l,i,o){if(zl(t),t.stateNode===null){var s=ei,y=l.contextType;typeof y=="object"&&y!==null&&(s=bt(y)),s=new l(i,s),t.memoizedState=s.state!==null&&s.state!==void 0?s.state:null,s.updater=Ho,t.stateNode=s,s._reactInternals=t,s=t.stateNode,s.props=i,s.state=t.memoizedState,s.refs={},po(t),y=l.contextType,s.context=typeof y=="object"&&y!==null?bt(y):ei,s.state=t.memoizedState,y=l.getDerivedStateFromProps,typeof y=="function"&&(Bo(t,l,y,i),s.state=t.memoizedState),typeof l.getDerivedStateFromProps=="function"||typeof s.getSnapshotBeforeUpdate=="function"||typeof s.UNSAFE_componentWillMount!="function"&&typeof s.componentWillMount!="function"||(y=s.state,typeof s.componentWillMount=="function"&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount=="function"&&s.UNSAFE_componentWillMount(),y!==s.state&&Ho.enqueueReplaceState(s,s.state,null),ta(t,i,s,o),ea(),s.state=t.memoizedState),typeof s.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){s=t.stateNode;var S=t.memoizedProps,A=Nl(l,S);s.props=A;var R=s.context,Y=l.contextType;y=ei,typeof Y=="object"&&Y!==null&&(y=bt(Y));var I=l.getDerivedStateFromProps;Y=typeof I=="function"||typeof s.getSnapshotBeforeUpdate=="function",S=t.pendingProps!==S,Y||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(S||R!==y)&&Fd(t,s,i,y),Pn=!1;var N=t.memoizedState;s.state=N,ta(t,i,s,o),ea(),R=t.memoizedState,S||N!==R||Pn?(typeof I=="function"&&(Bo(t,l,I,i),R=t.memoizedState),(A=Pn||Zd(t,l,A,i,N,R,y))?(Y||typeof s.UNSAFE_componentWillMount!="function"&&typeof s.componentWillMount!="function"||(typeof s.componentWillMount=="function"&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount=="function"&&s.UNSAFE_componentWillMount()),typeof s.componentDidMount=="function"&&(t.flags|=4194308)):(typeof s.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=R),s.props=i,s.state=R,s.context=y,i=A):(typeof s.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{s=t.stateNode,mo(e,t),y=t.memoizedProps,Y=Nl(l,y),s.props=Y,I=t.pendingProps,N=s.context,R=l.contextType,A=ei,typeof R=="object"&&R!==null&&(A=bt(R)),S=l.getDerivedStateFromProps,(R=typeof S=="function"||typeof s.getSnapshotBeforeUpdate=="function")||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(y!==I||N!==A)&&Fd(t,s,i,A),Pn=!1,N=t.memoizedState,s.state=N,ta(t,i,s,o),ea();var j=t.memoizedState;y!==I||N!==j||Pn||e!==null&&e.dependencies!==null&&rr(e.dependencies)?(typeof S=="function"&&(Bo(t,l,S,i),j=t.memoizedState),(Y=Pn||Zd(t,l,Y,i,N,j,A)||e!==null&&e.dependencies!==null&&rr(e.dependencies))?(R||typeof s.UNSAFE_componentWillUpdate!="function"&&typeof s.componentWillUpdate!="function"||(typeof s.componentWillUpdate=="function"&&s.componentWillUpdate(i,j,A),typeof s.UNSAFE_componentWillUpdate=="function"&&s.UNSAFE_componentWillUpdate(i,j,A)),typeof s.componentDidUpdate=="function"&&(t.flags|=4),typeof s.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof s.componentDidUpdate!="function"||y===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=j),s.props=i,s.state=j,s.context=A,i=Y):(typeof s.componentDidUpdate!="function"||y===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),i=!1)}return s=i,wr(e,t),i=(t.flags&128)!==0,s||i?(s=t.stateNode,l=i&&typeof l.getDerivedStateFromError!="function"?null:s.render(),t.flags|=1,e!==null&&i?(t.child=Ml(t,e.child,null,o),t.child=Ml(t,null,l,o)):St(e,t,l,o),t.memoizedState=s.state,e=t.child):e=Ln(e,t,o),e}function ch(e,t,l,i){return Tl(),t.flags|=256,St(e,t,l,i),t.child}var Go={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Xo(e){return{baseLanes:e,cachePool:$f()}}function Qo(e,t,l){return e=e!==null?e.childLanes&~l:0,t&&(e|=Ft),e}function sh(e,t,l){var i=t.pendingProps,o=!1,s=(t.flags&128)!==0,y;if((y=s)||(y=e!==null&&e.memoizedState===null?!1:(it.current&2)!==0),y&&(o=!0,t.flags&=-129),y=(t.flags&32)!==0,t.flags&=-33,e===null){if(Re){if(o?nl(t):ll(),(e=$e)?(e=vp(e,an),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Kn!==null?{id:gn,overflow:yn}:null,retryLane:536870912,hydrationErrors:null},l=Gf(e),l.return=t,t.child=l,vt=t,$e=null)):e=null,e===null)throw Wn(t);return Cc(e)?t.lanes=32:t.lanes=536870912,null}var S=i.children;return i=i.fallback,o?(ll(),o=t.mode,S=Tr({mode:"hidden",children:S},o),i=wl(i,o,l,null),S.return=t,i.return=t,S.sibling=i,t.child=S,i=t.child,i.memoizedState=Xo(l),i.childLanes=Qo(e,y,l),t.memoizedState=Go,ra(null,i)):(nl(t),Io(t,S))}var A=e.memoizedState;if(A!==null&&(S=A.dehydrated,S!==null)){if(s)t.flags&256?(nl(t),t.flags&=-257,t=Zo(e,t,l)):t.memoizedState!==null?(ll(),t.child=e.child,t.flags|=128,t=null):(ll(),S=i.fallback,o=t.mode,i=Tr({mode:"visible",children:i.children},o),S=wl(S,o,l,null),S.flags|=2,i.return=t,S.return=t,i.sibling=S,t.child=i,Ml(t,e.child,null,l),i=t.child,i.memoizedState=Xo(l),i.childLanes=Qo(e,y,l),t.memoizedState=Go,t=ra(null,i));else if(nl(t),Cc(S)){if(y=S.nextSibling&&S.nextSibling.dataset,y)var R=y.dgst;y=R,i=Error(u(419)),i.stack="",i.digest=y,Fi({value:i,source:null,stack:null}),t=Zo(e,t,l)}else if(ot||ii(e,t,l,!1),y=(l&e.childLanes)!==0,ot||y){if(y=Ke,y!==null&&(i=Ks(y,l),i!==0&&i!==A.retryLane))throw A.retryLane=i,Al(e,i),Ht(y,e,i),Yo;Tc(S)||Lr(),t=Zo(e,t,l)}else Tc(S)?(t.flags|=192,t.child=e.child,t=null):(e=A.treeContext,$e=un(S.nextSibling),vt=t,Re=!0,Jn=null,an=!1,e!==null&&If(t,e),t=Io(t,i.children),t.flags|=4096);return t}return o?(ll(),S=i.fallback,o=t.mode,A=e.child,R=A.sibling,i=_n(A,{mode:"hidden",children:i.children}),i.subtreeFlags=A.subtreeFlags&65011712,R!==null?S=_n(R,S):(S=wl(S,o,l,null),S.flags|=2),S.return=t,i.return=t,i.sibling=S,t.child=i,ra(null,i),i=t.child,S=e.child.memoizedState,S===null?S=Xo(l):(o=S.cachePool,o!==null?(A=rt._currentValue,o=o.parent!==A?{parent:A,pool:A}:o):o=$f(),S={baseLanes:S.baseLanes|l,cachePool:o}),i.memoizedState=S,i.childLanes=Qo(e,y,l),t.memoizedState=Go,ra(e.child,i)):(nl(t),l=e.child,e=l.sibling,l=_n(l,{mode:"visible",children:i.children}),l.return=t,l.sibling=null,e!==null&&(y=t.deletions,y===null?(t.deletions=[e],t.flags|=16):y.push(e)),t.child=l,t.memoizedState=null,l)}function Io(e,t){return t=Tr({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Tr(e,t){return e=Xt(22,e,null,t),e.lanes=0,e}function Zo(e,t,l){return Ml(t,e.child,null,l),e=Io(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function fh(e,t,l){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),uo(e.return,t,l)}function Fo(e,t,l,i,o,s){var y=e.memoizedState;y===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:l,tailMode:o,treeForkCount:s}:(y.isBackwards=t,y.rendering=null,y.renderingStartTime=0,y.last=i,y.tail=l,y.tailMode=o,y.treeForkCount=s)}function dh(e,t,l){var i=t.pendingProps,o=i.revealOrder,s=i.tail;i=i.children;var y=it.current,S=(y&2)!==0;if(S?(y=y&1|2,t.flags|=128):y&=1,b(it,y),St(e,t,i,l),i=Re?Zi:0,!S&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&fh(e,l,t);else if(e.tag===19)fh(e,l,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(o){case"forwards":for(l=t.child,o=null;l!==null;)e=l.alternate,e!==null&&pr(e)===null&&(o=l),l=l.sibling;l=o,l===null?(o=t.child,t.child=null):(o=l.sibling,l.sibling=null),Fo(t,!1,o,l,s,i);break;case"backwards":case"unstable_legacy-backwards":for(l=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&pr(e)===null){t.child=o;break}e=o.sibling,o.sibling=l,l=o,o=e}Fo(t,!0,l,null,s,i);break;case"together":Fo(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function Ln(e,t,l){if(e!==null&&(t.dependencies=e.dependencies),rl|=t.lanes,(l&t.childLanes)===0)if(e!==null){if(ii(e,t,l,!1),(l&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(u(153));if(t.child!==null){for(e=t.child,l=_n(e,e.pendingProps),t.child=l,l.return=t;e.sibling!==null;)e=e.sibling,l=l.sibling=_n(e,e.pendingProps),l.return=t;l.sibling=null}return t.child}function Ko(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&rr(e)))}function x1(e,t,l){switch(t.tag){case 3:re(t,t.stateNode.containerInfo),$n(t,rt,e.memoizedState.cache),Tl();break;case 27:case 5:we(t);break;case 4:re(t,t.stateNode.containerInfo);break;case 10:$n(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,So(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(nl(t),t.flags|=128,null):(l&t.child.childLanes)!==0?sh(e,t,l):(nl(t),e=Ln(e,t,l),e!==null?e.sibling:null);nl(t);break;case 19:var o=(e.flags&128)!==0;if(i=(l&t.childLanes)!==0,i||(ii(e,t,l,!1),i=(l&t.childLanes)!==0),o){if(i)return dh(e,t,l);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),b(it,it.current),i)break;return null;case 22:return t.lanes=0,ih(e,t,l,t.pendingProps);case 24:$n(t,rt,e.memoizedState.cache)}return Ln(e,t,l)}function hh(e,t,l){if(e!==null)if(e.memoizedProps!==t.pendingProps)ot=!0;else{if(!Ko(e,l)&&(t.flags&128)===0)return ot=!1,x1(e,t,l);ot=(e.flags&131072)!==0}else ot=!1,Re&&(t.flags&1048576)!==0&&Qf(t,Zi,t.index);switch(t.lanes=0,t.tag){case 16:e:{var i=t.pendingProps;if(e=Ol(t.elementType),t.type=e,typeof e=="function")Pu(e)?(i=Nl(e,i),t.tag=1,t=oh(null,t,e,i,l)):(t.tag=0,t=Vo(null,t,e,i,l));else{if(e!=null){var o=e.$$typeof;if(o===le){t.tag=11,t=th(null,t,e,i,l);break e}else if(o===P){t.tag=14,t=nh(null,t,e,i,l);break e}}throw t=ae(e)||e,Error(u(306,t,""))}}return t;case 0:return Vo(e,t,t.type,t.pendingProps,l);case 1:return i=t.type,o=Nl(i,t.pendingProps),oh(e,t,i,o,l);case 3:e:{if(re(t,t.stateNode.containerInfo),e===null)throw Error(u(387));i=t.pendingProps;var s=t.memoizedState;o=s.element,mo(e,t),ta(t,i,null,l);var y=t.memoizedState;if(i=y.cache,$n(t,rt,i),i!==s.cache&&oo(t,[rt],l,!0),ea(),i=y.element,s.isDehydrated)if(s={element:i,isDehydrated:!1,cache:y.cache},t.updateQueue.baseState=s,t.memoizedState=s,t.flags&256){t=ch(e,t,i,l);break e}else if(i!==o){o=tn(Error(u(424)),t),Fi(o),t=ch(e,t,i,l);break e}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for($e=un(e.firstChild),vt=t,Re=!0,Jn=null,an=!0,l=id(t,null,i,l),t.child=l;l;)l.flags=l.flags&-3|4096,l=l.sibling}else{if(Tl(),i===o){t=Ln(e,t,l);break e}St(e,t,i,l)}t=t.child}return t;case 26:return wr(e,t),e===null?(l=Ap(t.type,null,t.pendingProps,null))?t.memoizedState=l:Re||(l=t.type,e=t.pendingProps,i=Vr(F.current).createElement(l),i[yt]=t,i[Rt]=e,xt(i,l,e),ht(i),t.stateNode=i):t.memoizedState=Ap(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return we(t),e===null&&Re&&(i=t.stateNode=xp(t.type,t.pendingProps,F.current),vt=t,an=!0,o=$e,fl(t.type)?(zc=o,$e=un(i.firstChild)):$e=o),St(e,t,t.pendingProps.children,l),wr(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&Re&&((o=i=$e)&&(i=W1(i,t.type,t.pendingProps,an),i!==null?(t.stateNode=i,vt=t,$e=un(i.firstChild),an=!1,o=!0):o=!1),o||Wn(t)),we(t),o=t.type,s=t.pendingProps,y=e!==null?e.memoizedProps:null,i=s.children,kc(o,s)?i=null:y!==null&&kc(o,y)&&(t.flags|=32),t.memoizedState!==null&&(o=Eo(e,t,d1,null,null,l),xa._currentValue=o),wr(e,t),St(e,t,i,l),t.child;case 6:return e===null&&Re&&((e=l=$e)&&(l=$1(l,t.pendingProps,an),l!==null?(t.stateNode=l,vt=t,$e=null,e=!0):e=!1),e||Wn(t)),null;case 13:return sh(e,t,l);case 4:return re(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Ml(t,null,i,l):St(e,t,i,l),t.child;case 11:return th(e,t,t.type,t.pendingProps,l);case 7:return St(e,t,t.pendingProps,l),t.child;case 8:return St(e,t,t.pendingProps.children,l),t.child;case 12:return St(e,t,t.pendingProps.children,l),t.child;case 10:return i=t.pendingProps,$n(t,t.type,i.value),St(e,t,i.children,l),t.child;case 9:return o=t.type._context,i=t.pendingProps.children,zl(t),o=bt(o),i=i(o),t.flags|=1,St(e,t,i,l),t.child;case 14:return nh(e,t,t.type,t.pendingProps,l);case 15:return lh(e,t,t.type,t.pendingProps,l);case 19:return dh(e,t,l);case 31:return S1(e,t,l);case 22:return ih(e,t,l,t.pendingProps);case 24:return zl(t),i=bt(rt),e===null?(o=fo(),o===null&&(o=Ke,s=co(),o.pooledCache=s,s.refCount++,s!==null&&(o.pooledCacheLanes|=l),o=s),t.memoizedState={parent:i,cache:o},po(t),$n(t,rt,o)):((e.lanes&l)!==0&&(mo(e,t),ta(t,null,null,l),ea()),o=e.memoizedState,s=t.memoizedState,o.parent!==i?(o={parent:i,cache:i},t.memoizedState=o,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=o),$n(t,rt,i)):(i=s.cache,$n(t,rt,i),i!==o.cache&&oo(t,[rt],l,!0))),St(e,t,t.pendingProps.children,l),t.child;case 29:throw t.pendingProps}throw Error(u(156,t.tag))}function Un(e){e.flags|=4}function Jo(e,t,l,i,o){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(o&335544128)===o)if(e.stateNode.complete)e.flags|=8192;else if(qh())e.flags|=8192;else throw Dl=sr,ho}else e.flags&=-16777217}function ph(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!_p(t))if(qh())e.flags|=8192;else throw Dl=sr,ho}function Cr(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Is():536870912,e.lanes|=t,gi|=t)}function ua(e,t){if(!Re)switch(e.tailMode){case"hidden":t=e.tail;for(var l=null;t!==null;)t.alternate!==null&&(l=t),t=t.sibling;l===null?e.tail=null:l.sibling=null;break;case"collapsed":l=e.tail;for(var i=null;l!==null;)l.alternate!==null&&(i=l),l=l.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function Pe(e){var t=e.alternate!==null&&e.alternate.child===e.child,l=0,i=0;if(t)for(var o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags&65011712,i|=o.flags&65011712,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags,i|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=i,e.childLanes=l,t}function E1(e,t,l){var i=t.pendingProps;switch(lo(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Pe(t),null;case 1:return Pe(t),null;case 3:return l=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),Mn(rt),de(),l.pendingContext&&(l.context=l.pendingContext,l.pendingContext=null),(e===null||e.child===null)&&(li(t)?Un(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,ao())),Pe(t),null;case 26:var o=t.type,s=t.memoizedState;return e===null?(Un(t),s!==null?(Pe(t),ph(t,s)):(Pe(t),Jo(t,o,null,i,l))):s?s!==e.memoizedState?(Un(t),Pe(t),ph(t,s)):(Pe(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&Un(t),Pe(t),Jo(t,o,e,i,l)),null;case 27:if(Ze(t),l=F.current,o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Un(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Pe(t),null}e=_.current,li(t)?Zf(t):(e=xp(o,i,l),t.stateNode=e,Un(t))}return Pe(t),null;case 5:if(Ze(t),o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Un(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Pe(t),null}if(s=_.current,li(t))Zf(t);else{var y=Vr(F.current);switch(s){case 1:s=y.createElementNS("http://www.w3.org/2000/svg",o);break;case 2:s=y.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;default:switch(o){case"svg":s=y.createElementNS("http://www.w3.org/2000/svg",o);break;case"math":s=y.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;case"script":s=y.createElement("div"),s.innerHTML="<script><\\/script>",s=s.removeChild(s.firstChild);break;case"select":s=typeof i.is=="string"?y.createElement("select",{is:i.is}):y.createElement("select"),i.multiple?s.multiple=!0:i.size&&(s.size=i.size);break;default:s=typeof i.is=="string"?y.createElement(o,{is:i.is}):y.createElement(o)}}s[yt]=t,s[Rt]=i;e:for(y=t.child;y!==null;){if(y.tag===5||y.tag===6)s.appendChild(y.stateNode);else if(y.tag!==4&&y.tag!==27&&y.child!==null){y.child.return=y,y=y.child;continue}if(y===t)break e;for(;y.sibling===null;){if(y.return===null||y.return===t)break e;y=y.return}y.sibling.return=y.return,y=y.sibling}t.stateNode=s;e:switch(xt(s,o,i),o){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}i&&Un(t)}}return Pe(t),Jo(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,l),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&Un(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(u(166));if(e=F.current,li(t)){if(e=t.stateNode,l=t.memoizedProps,i=null,o=vt,o!==null)switch(o.tag){case 27:case 5:i=o.memoizedProps}e[yt]=t,e=!!(e.nodeValue===l||i!==null&&i.suppressHydrationWarning===!0||sp(e.nodeValue,l)),e||Wn(t,!0)}else e=Vr(e).createTextNode(i),e[yt]=t,t.stateNode=e}return Pe(t),null;case 31:if(l=t.memoizedState,e===null||e.memoizedState!==null){if(i=li(t),l!==null){if(e===null){if(!i)throw Error(u(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(557));e[yt]=t}else Tl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Pe(t),e=!1}else l=ao(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=l),e=!0;if(!e)return t.flags&256?(It(t),t):(It(t),null);if((t.flags&128)!==0)throw Error(u(558))}return Pe(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(o=li(t),i!==null&&i.dehydrated!==null){if(e===null){if(!o)throw Error(u(318));if(o=t.memoizedState,o=o!==null?o.dehydrated:null,!o)throw Error(u(317));o[yt]=t}else Tl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Pe(t),o=!1}else o=ao(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=o),o=!0;if(!o)return t.flags&256?(It(t),t):(It(t),null)}return It(t),(t.flags&128)!==0?(t.lanes=l,t):(l=i!==null,e=e!==null&&e.memoizedState!==null,l&&(i=t.child,o=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(o=i.alternate.memoizedState.cachePool.pool),s=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(s=i.memoizedState.cachePool.pool),s!==o&&(i.flags|=2048)),l!==e&&l&&(t.child.flags|=8192),Cr(t,t.updateQueue),Pe(t),null);case 4:return de(),e===null&&vc(t.stateNode.containerInfo),Pe(t),null;case 10:return Mn(t.type),Pe(t),null;case 19:if(q(it),i=t.memoizedState,i===null)return Pe(t),null;if(o=(t.flags&128)!==0,s=i.rendering,s===null)if(o)ua(i,!1);else{if(lt!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(s=pr(e),s!==null){for(t.flags|=128,ua(i,!1),e=s.updateQueue,t.updateQueue=e,Cr(t,e),t.subtreeFlags=0,e=l,l=t.child;l!==null;)Vf(l,e),l=l.sibling;return b(it,it.current&1|2),Re&&On(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&Ct()>Mr&&(t.flags|=128,o=!0,ua(i,!1),t.lanes=4194304)}else{if(!o)if(e=pr(s),e!==null){if(t.flags|=128,o=!0,e=e.updateQueue,t.updateQueue=e,Cr(t,e),ua(i,!0),i.tail===null&&i.tailMode==="hidden"&&!s.alternate&&!Re)return Pe(t),null}else 2*Ct()-i.renderingStartTime>Mr&&l!==536870912&&(t.flags|=128,o=!0,ua(i,!1),t.lanes=4194304);i.isBackwards?(s.sibling=t.child,t.child=s):(e=i.last,e!==null?e.sibling=s:t.child=s,i.last=s)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=Ct(),e.sibling=null,l=it.current,b(it,o?l&1|2:l&1),Re&&On(t,i.treeForkCount),e):(Pe(t),null);case 22:case 23:return It(t),bo(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(l&536870912)!==0&&(t.flags&128)===0&&(Pe(t),t.subtreeFlags&6&&(t.flags|=8192)):Pe(t),l=t.updateQueue,l!==null&&Cr(t,l.retryQueue),l=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==l&&(t.flags|=2048),e!==null&&q(_l),null;case 24:return l=null,e!==null&&(l=e.memoizedState.cache),t.memoizedState.cache!==l&&(t.flags|=2048),Mn(rt),Pe(t),null;case 25:return null;case 30:return null}throw Error(u(156,t.tag))}function k1(e,t){switch(lo(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Mn(rt),de(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return Ze(t),null;case 31:if(t.memoizedState!==null){if(It(t),t.alternate===null)throw Error(u(340));Tl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(It(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(u(340));Tl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return q(it),null;case 4:return de(),null;case 10:return Mn(t.type),null;case 22:case 23:return It(t),bo(),e!==null&&q(_l),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return Mn(rt),null;case 25:return null;default:return null}}function mh(e,t){switch(lo(t),t.tag){case 3:Mn(rt),de();break;case 26:case 27:case 5:Ze(t);break;case 4:de();break;case 31:t.memoizedState!==null&&It(t);break;case 13:It(t);break;case 19:q(it);break;case 10:Mn(t.type);break;case 22:case 23:It(t),bo(),e!==null&&q(_l);break;case 24:Mn(rt)}}function oa(e,t){try{var l=t.updateQueue,i=l!==null?l.lastEffect:null;if(i!==null){var o=i.next;l=o;do{if((l.tag&e)===e){i=void 0;var s=l.create,y=l.inst;i=s(),y.destroy=i}l=l.next}while(l!==o)}}catch(S){Ge(t,t.return,S)}}function il(e,t,l){try{var i=t.updateQueue,o=i!==null?i.lastEffect:null;if(o!==null){var s=o.next;i=s;do{if((i.tag&e)===e){var y=i.inst,S=y.destroy;if(S!==void 0){y.destroy=void 0,o=t;var A=l,R=S;try{R()}catch(Y){Ge(o,A,Y)}}}i=i.next}while(i!==s)}}catch(Y){Ge(t,t.return,Y)}}function gh(e){var t=e.updateQueue;if(t!==null){var l=e.stateNode;try{rd(t,l)}catch(i){Ge(e,e.return,i)}}}function yh(e,t,l){l.props=Nl(e.type,e.memoizedProps),l.state=e.memoizedState;try{l.componentWillUnmount()}catch(i){Ge(e,t,i)}}function ca(e,t){try{var l=e.ref;if(l!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof l=="function"?e.refCleanup=l(i):l.current=i}}catch(o){Ge(e,t,o)}}function vn(e,t){var l=e.ref,i=e.refCleanup;if(l!==null)if(typeof i=="function")try{i()}catch(o){Ge(e,t,o)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof l=="function")try{l(null)}catch(o){Ge(e,t,o)}else l.current=null}function vh(e){var t=e.type,l=e.memoizedProps,i=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":l.autoFocus&&i.focus();break e;case"img":l.src?i.src=l.src:l.srcSet&&(i.srcset=l.srcSet)}}catch(o){Ge(e,e.return,o)}}function Wo(e,t,l){try{var i=e.stateNode;Q1(i,e.type,l,t),i[Rt]=t}catch(o){Ge(e,e.return,o)}}function bh(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&fl(e.type)||e.tag===4}function $o(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||bh(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&fl(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Po(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l).insertBefore(e,t):(t=l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l,t.appendChild(e),l=l._reactRootContainer,l!=null||t.onclick!==null||(t.onclick=Cn));else if(i!==4&&(i===27&&fl(e.type)&&(l=e.stateNode,t=null),e=e.child,e!==null))for(Po(e,t,l),e=e.sibling;e!==null;)Po(e,t,l),e=e.sibling}function zr(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?l.insertBefore(e,t):l.appendChild(e);else if(i!==4&&(i===27&&fl(e.type)&&(l=e.stateNode),e=e.child,e!==null))for(zr(e,t,l),e=e.sibling;e!==null;)zr(e,t,l),e=e.sibling}function Sh(e){var t=e.stateNode,l=e.memoizedProps;try{for(var i=e.type,o=t.attributes;o.length;)t.removeAttributeNode(o[0]);xt(t,i,l),t[yt]=e,t[Rt]=l}catch(s){Ge(e,e.return,s)}}var jn=!1,ct=!1,ec=!1,xh=typeof WeakSet=="function"?WeakSet:Set,pt=null;function A1(e,t){if(e=e.containerInfo,xc=Kr,e=Rf(e),Iu(e)){if("selectionStart"in e)var l={start:e.selectionStart,end:e.selectionEnd};else e:{l=(l=e.ownerDocument)&&l.defaultView||window;var i=l.getSelection&&l.getSelection();if(i&&i.rangeCount!==0){l=i.anchorNode;var o=i.anchorOffset,s=i.focusNode;i=i.focusOffset;try{l.nodeType,s.nodeType}catch{l=null;break e}var y=0,S=-1,A=-1,R=0,Y=0,I=e,N=null;t:for(;;){for(var j;I!==l||o!==0&&I.nodeType!==3||(S=y+o),I!==s||i!==0&&I.nodeType!==3||(A=y+i),I.nodeType===3&&(y+=I.nodeValue.length),(j=I.firstChild)!==null;)N=I,I=j;for(;;){if(I===e)break t;if(N===l&&++R===o&&(S=y),N===s&&++Y===i&&(A=y),(j=I.nextSibling)!==null)break;I=N,N=I.parentNode}I=j}l=S===-1||A===-1?null:{start:S,end:A}}else l=null}l=l||{start:0,end:0}}else l=null;for(Ec={focusedElem:e,selectionRange:l},Kr=!1,pt=t;pt!==null;)if(t=pt,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,pt=e;else for(;pt!==null;){switch(t=pt,s=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(l=0;l<e.length;l++)o=e[l],o.ref.impl=o.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&s!==null){e=void 0,l=t,o=s.memoizedProps,s=s.memoizedState,i=l.stateNode;try{var oe=Nl(l.type,o);e=i.getSnapshotBeforeUpdate(oe,s),i.__reactInternalSnapshotBeforeUpdate=e}catch(me){Ge(l,l.return,me)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,l=e.nodeType,l===9)wc(e);else if(l===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":wc(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(u(163))}if(e=t.sibling,e!==null){e.return=t.return,pt=e;break}pt=t.return}}function Eh(e,t,l){var i=l.flags;switch(l.tag){case 0:case 11:case 15:Hn(e,l),i&4&&oa(5,l);break;case 1:if(Hn(e,l),i&4)if(e=l.stateNode,t===null)try{e.componentDidMount()}catch(y){Ge(l,l.return,y)}else{var o=Nl(l.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(o,t,e.__reactInternalSnapshotBeforeUpdate)}catch(y){Ge(l,l.return,y)}}i&64&&gh(l),i&512&&ca(l,l.return);break;case 3:if(Hn(e,l),i&64&&(e=l.updateQueue,e!==null)){if(t=null,l.child!==null)switch(l.child.tag){case 27:case 5:t=l.child.stateNode;break;case 1:t=l.child.stateNode}try{rd(e,t)}catch(y){Ge(l,l.return,y)}}break;case 27:t===null&&i&4&&Sh(l);case 26:case 5:Hn(e,l),t===null&&i&4&&vh(l),i&512&&ca(l,l.return);break;case 12:Hn(e,l);break;case 31:Hn(e,l),i&4&&wh(e,l);break;case 13:Hn(e,l),i&4&&Th(e,l),i&64&&(e=l.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(l=R1.bind(null,l),P1(e,l))));break;case 22:if(i=l.memoizedState!==null||jn,!i){t=t!==null&&t.memoizedState!==null||ct,o=jn;var s=ct;jn=i,(ct=t)&&!s?qn(e,l,(l.subtreeFlags&8772)!==0):Hn(e,l),jn=o,ct=s}break;case 30:break;default:Hn(e,l)}}function kh(e){var t=e.alternate;t!==null&&(e.alternate=null,kh(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&_u(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var et=null,Lt=!1;function Bn(e,t,l){for(l=l.child;l!==null;)Ah(e,t,l),l=l.sibling}function Ah(e,t,l){if(ft&&typeof ft.onCommitFiberUnmount=="function")try{ft.onCommitFiberUnmount(zt,l)}catch{}switch(l.tag){case 26:ct||vn(l,t),Bn(e,t,l),l.memoizedState?l.memoizedState.count--:l.stateNode&&(l=l.stateNode,l.parentNode.removeChild(l));break;case 27:ct||vn(l,t);var i=et,o=Lt;fl(l.type)&&(et=l.stateNode,Lt=!1),Bn(e,t,l),va(l.stateNode),et=i,Lt=o;break;case 5:ct||vn(l,t);case 6:if(i=et,o=Lt,et=null,Bn(e,t,l),et=i,Lt=o,et!==null)if(Lt)try{(et.nodeType===9?et.body:et.nodeName==="HTML"?et.ownerDocument.body:et).removeChild(l.stateNode)}catch(s){Ge(l,t,s)}else try{et.removeChild(l.stateNode)}catch(s){Ge(l,t,s)}break;case 18:et!==null&&(Lt?(e=et,gp(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,l.stateNode),Ai(e)):gp(et,l.stateNode));break;case 4:i=et,o=Lt,et=l.stateNode.containerInfo,Lt=!0,Bn(e,t,l),et=i,Lt=o;break;case 0:case 11:case 14:case 15:il(2,l,t),ct||il(4,l,t),Bn(e,t,l);break;case 1:ct||(vn(l,t),i=l.stateNode,typeof i.componentWillUnmount=="function"&&yh(l,t,i)),Bn(e,t,l);break;case 21:Bn(e,t,l);break;case 22:ct=(i=ct)||l.memoizedState!==null,Bn(e,t,l),ct=i;break;default:Bn(e,t,l)}}function wh(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Ai(e)}catch(l){Ge(t,t.return,l)}}}function Th(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Ai(e)}catch(l){Ge(t,t.return,l)}}function w1(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new xh),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new xh),t;default:throw Error(u(435,e.tag))}}function _r(e,t){var l=w1(e);t.forEach(function(i){if(!l.has(i)){l.add(i);var o=N1.bind(null,e,i);i.then(o,o)}})}function Ut(e,t){var l=t.deletions;if(l!==null)for(var i=0;i<l.length;i++){var o=l[i],s=e,y=t,S=y;e:for(;S!==null;){switch(S.tag){case 27:if(fl(S.type)){et=S.stateNode,Lt=!1;break e}break;case 5:et=S.stateNode,Lt=!1;break e;case 3:case 4:et=S.stateNode.containerInfo,Lt=!0;break e}S=S.return}if(et===null)throw Error(u(160));Ah(s,y,o),et=null,Lt=!1,s=o.alternate,s!==null&&(s.return=null),o.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Ch(t,e),t=t.sibling}var dn=null;function Ch(e,t){var l=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Ut(t,e),jt(e),i&4&&(il(3,e,e.return),oa(3,e),il(5,e,e.return));break;case 1:Ut(t,e),jt(e),i&512&&(ct||l===null||vn(l,l.return)),i&64&&jn&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(l=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=l===null?i:l.concat(i))));break;case 26:var o=dn;if(Ut(t,e),jt(e),i&512&&(ct||l===null||vn(l,l.return)),i&4){var s=l!==null?l.memoizedState:null;if(i=e.memoizedState,l===null)if(i===null)if(e.stateNode===null){e:{i=e.type,l=e.memoizedProps,o=o.ownerDocument||o;t:switch(i){case"title":s=o.getElementsByTagName("title")[0],(!s||s[Ui]||s[yt]||s.namespaceURI==="http://www.w3.org/2000/svg"||s.hasAttribute("itemprop"))&&(s=o.createElement(i),o.head.insertBefore(s,o.querySelector("head > title"))),xt(s,i,l),s[yt]=e,ht(s),i=s;break e;case"link":var y=Cp("link","href",o).get(i+(l.href||""));if(y){for(var S=0;S<y.length;S++)if(s=y[S],s.getAttribute("href")===(l.href==null||l.href===""?null:l.href)&&s.getAttribute("rel")===(l.rel==null?null:l.rel)&&s.getAttribute("title")===(l.title==null?null:l.title)&&s.getAttribute("crossorigin")===(l.crossOrigin==null?null:l.crossOrigin)){y.splice(S,1);break t}}s=o.createElement(i),xt(s,i,l),o.head.appendChild(s);break;case"meta":if(y=Cp("meta","content",o).get(i+(l.content||""))){for(S=0;S<y.length;S++)if(s=y[S],s.getAttribute("content")===(l.content==null?null:""+l.content)&&s.getAttribute("name")===(l.name==null?null:l.name)&&s.getAttribute("property")===(l.property==null?null:l.property)&&s.getAttribute("http-equiv")===(l.httpEquiv==null?null:l.httpEquiv)&&s.getAttribute("charset")===(l.charSet==null?null:l.charSet)){y.splice(S,1);break t}}s=o.createElement(i),xt(s,i,l),o.head.appendChild(s);break;default:throw Error(u(468,i))}s[yt]=e,ht(s),i=s}e.stateNode=i}else zp(o,e.type,e.stateNode);else e.stateNode=Tp(o,i,e.memoizedProps);else s!==i?(s===null?l.stateNode!==null&&(l=l.stateNode,l.parentNode.removeChild(l)):s.count--,i===null?zp(o,e.type,e.stateNode):Tp(o,i,e.memoizedProps)):i===null&&e.stateNode!==null&&Wo(e,e.memoizedProps,l.memoizedProps)}break;case 27:Ut(t,e),jt(e),i&512&&(ct||l===null||vn(l,l.return)),l!==null&&i&4&&Wo(e,e.memoizedProps,l.memoizedProps);break;case 5:if(Ut(t,e),jt(e),i&512&&(ct||l===null||vn(l,l.return)),e.flags&32){o=e.stateNode;try{Zl(o,"")}catch(oe){Ge(e,e.return,oe)}}i&4&&e.stateNode!=null&&(o=e.memoizedProps,Wo(e,o,l!==null?l.memoizedProps:o)),i&1024&&(ec=!0);break;case 6:if(Ut(t,e),jt(e),i&4){if(e.stateNode===null)throw Error(u(162));i=e.memoizedProps,l=e.stateNode;try{l.nodeValue=i}catch(oe){Ge(e,e.return,oe)}}break;case 3:if(Qr=null,o=dn,dn=Gr(t.containerInfo),Ut(t,e),dn=o,jt(e),i&4&&l!==null&&l.memoizedState.isDehydrated)try{Ai(t.containerInfo)}catch(oe){Ge(e,e.return,oe)}ec&&(ec=!1,zh(e));break;case 4:i=dn,dn=Gr(e.stateNode.containerInfo),Ut(t,e),jt(e),dn=i;break;case 12:Ut(t,e),jt(e);break;case 31:Ut(t,e),jt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 13:Ut(t,e),jt(e),e.child.flags&8192&&e.memoizedState!==null!=(l!==null&&l.memoizedState!==null)&&(Dr=Ct()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 22:o=e.memoizedState!==null;var A=l!==null&&l.memoizedState!==null,R=jn,Y=ct;if(jn=R||o,ct=Y||A,Ut(t,e),ct=Y,jn=R,jt(e),i&8192)e:for(t=e.stateNode,t._visibility=o?t._visibility&-2:t._visibility|1,o&&(l===null||A||jn||ct||Ll(e)),l=null,t=e;;){if(t.tag===5||t.tag===26){if(l===null){A=l=t;try{if(s=A.stateNode,o)y=s.style,typeof y.setProperty=="function"?y.setProperty("display","none","important"):y.display="none";else{S=A.stateNode;var I=A.memoizedProps.style,N=I!=null&&I.hasOwnProperty("display")?I.display:null;S.style.display=N==null||typeof N=="boolean"?"":(""+N).trim()}}catch(oe){Ge(A,A.return,oe)}}}else if(t.tag===6){if(l===null){A=t;try{A.stateNode.nodeValue=o?"":A.memoizedProps}catch(oe){Ge(A,A.return,oe)}}}else if(t.tag===18){if(l===null){A=t;try{var j=A.stateNode;o?yp(j,!0):yp(A.stateNode,!1)}catch(oe){Ge(A,A.return,oe)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;l===t&&(l=null),t=t.return}l===t&&(l=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(l=i.retryQueue,l!==null&&(i.retryQueue=null,_r(e,l))));break;case 19:Ut(t,e),jt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 30:break;case 21:break;default:Ut(t,e),jt(e)}}function jt(e){var t=e.flags;if(t&2){try{for(var l,i=e.return;i!==null;){if(bh(i)){l=i;break}i=i.return}if(l==null)throw Error(u(160));switch(l.tag){case 27:var o=l.stateNode,s=$o(e);zr(e,s,o);break;case 5:var y=l.stateNode;l.flags&32&&(Zl(y,""),l.flags&=-33);var S=$o(e);zr(e,S,y);break;case 3:case 4:var A=l.stateNode.containerInfo,R=$o(e);Po(e,R,A);break;default:throw Error(u(161))}}catch(Y){Ge(e,e.return,Y)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function zh(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;zh(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Hn(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)Eh(e,t.alternate,t),t=t.sibling}function Ll(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:il(4,t,t.return),Ll(t);break;case 1:vn(t,t.return);var l=t.stateNode;typeof l.componentWillUnmount=="function"&&yh(t,t.return,l),Ll(t);break;case 27:va(t.stateNode);case 26:case 5:vn(t,t.return),Ll(t);break;case 22:t.memoizedState===null&&Ll(t);break;case 30:Ll(t);break;default:Ll(t)}e=e.sibling}}function qn(e,t,l){for(l=l&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,o=e,s=t,y=s.flags;switch(s.tag){case 0:case 11:case 15:qn(o,s,l),oa(4,s);break;case 1:if(qn(o,s,l),i=s,o=i.stateNode,typeof o.componentDidMount=="function")try{o.componentDidMount()}catch(R){Ge(i,i.return,R)}if(i=s,o=i.updateQueue,o!==null){var S=i.stateNode;try{var A=o.shared.hiddenCallbacks;if(A!==null)for(o.shared.hiddenCallbacks=null,o=0;o<A.length;o++)ad(A[o],S)}catch(R){Ge(i,i.return,R)}}l&&y&64&&gh(s),ca(s,s.return);break;case 27:Sh(s);case 26:case 5:qn(o,s,l),l&&i===null&&y&4&&vh(s),ca(s,s.return);break;case 12:qn(o,s,l);break;case 31:qn(o,s,l),l&&y&4&&wh(o,s);break;case 13:qn(o,s,l),l&&y&4&&Th(o,s);break;case 22:s.memoizedState===null&&qn(o,s,l),ca(s,s.return);break;case 30:break;default:qn(o,s,l)}t=t.sibling}}function tc(e,t){var l=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==l&&(e!=null&&e.refCount++,l!=null&&Ki(l))}function nc(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ki(e))}function hn(e,t,l,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)_h(e,t,l,i),t=t.sibling}function _h(e,t,l,i){var o=t.flags;switch(t.tag){case 0:case 11:case 15:hn(e,t,l,i),o&2048&&oa(9,t);break;case 1:hn(e,t,l,i);break;case 3:hn(e,t,l,i),o&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ki(e)));break;case 12:if(o&2048){hn(e,t,l,i),e=t.stateNode;try{var s=t.memoizedProps,y=s.id,S=s.onPostCommit;typeof S=="function"&&S(y,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(A){Ge(t,t.return,A)}}else hn(e,t,l,i);break;case 31:hn(e,t,l,i);break;case 13:hn(e,t,l,i);break;case 23:break;case 22:s=t.stateNode,y=t.alternate,t.memoizedState!==null?s._visibility&2?hn(e,t,l,i):sa(e,t):s._visibility&2?hn(e,t,l,i):(s._visibility|=2,hi(e,t,l,i,(t.subtreeFlags&10256)!==0||!1)),o&2048&&tc(y,t);break;case 24:hn(e,t,l,i),o&2048&&nc(t.alternate,t);break;default:hn(e,t,l,i)}}function hi(e,t,l,i,o){for(o=o&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var s=e,y=t,S=l,A=i,R=y.flags;switch(y.tag){case 0:case 11:case 15:hi(s,y,S,A,o),oa(8,y);break;case 23:break;case 22:var Y=y.stateNode;y.memoizedState!==null?Y._visibility&2?hi(s,y,S,A,o):sa(s,y):(Y._visibility|=2,hi(s,y,S,A,o)),o&&R&2048&&tc(y.alternate,y);break;case 24:hi(s,y,S,A,o),o&&R&2048&&nc(y.alternate,y);break;default:hi(s,y,S,A,o)}t=t.sibling}}function sa(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var l=e,i=t,o=i.flags;switch(i.tag){case 22:sa(l,i),o&2048&&tc(i.alternate,i);break;case 24:sa(l,i),o&2048&&nc(i.alternate,i);break;default:sa(l,i)}t=t.sibling}}var fa=8192;function pi(e,t,l){if(e.subtreeFlags&fa)for(e=e.child;e!==null;)Oh(e,t,l),e=e.sibling}function Oh(e,t,l){switch(e.tag){case 26:pi(e,t,l),e.flags&fa&&e.memoizedState!==null&&fv(l,dn,e.memoizedState,e.memoizedProps);break;case 5:pi(e,t,l);break;case 3:case 4:var i=dn;dn=Gr(e.stateNode.containerInfo),pi(e,t,l),dn=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=fa,fa=16777216,pi(e,t,l),fa=i):pi(e,t,l));break;default:pi(e,t,l)}}function Dh(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function da(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];pt=i,Rh(i,e)}Dh(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Mh(e),e=e.sibling}function Mh(e){switch(e.tag){case 0:case 11:case 15:da(e),e.flags&2048&&il(9,e,e.return);break;case 3:da(e);break;case 12:da(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Or(e)):da(e);break;default:da(e)}}function Or(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];pt=i,Rh(i,e)}Dh(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:il(8,t,t.return),Or(t);break;case 22:l=t.stateNode,l._visibility&2&&(l._visibility&=-3,Or(t));break;default:Or(t)}e=e.sibling}}function Rh(e,t){for(;pt!==null;){var l=pt;switch(l.tag){case 0:case 11:case 15:il(8,l,t);break;case 23:case 22:if(l.memoizedState!==null&&l.memoizedState.cachePool!==null){var i=l.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:Ki(l.memoizedState.cache)}if(i=l.child,i!==null)i.return=l,pt=i;else e:for(l=e;pt!==null;){i=pt;var o=i.sibling,s=i.return;if(kh(i),i===l){pt=null;break e}if(o!==null){o.return=s,pt=o;break e}pt=s}}}var T1={getCacheForType:function(e){var t=bt(rt),l=t.data.get(e);return l===void 0&&(l=e(),t.data.set(e,l)),l},cacheSignal:function(){return bt(rt).controller.signal}},C1=typeof WeakMap=="function"?WeakMap:Map,He=0,Ke=null,ze=null,De=0,Ve=0,Zt=null,al=!1,mi=!1,lc=!1,Yn=0,lt=0,rl=0,Ul=0,ic=0,Ft=0,gi=0,ha=null,Bt=null,ac=!1,Dr=0,Nh=0,Mr=1/0,Rr=null,ul=null,dt=0,ol=null,yi=null,Vn=0,rc=0,uc=null,Lh=null,pa=0,oc=null;function Kt(){return(He&2)!==0&&De!==0?De&-De:D.T!==null?pc():Js()}function Uh(){if(Ft===0)if((De&536870912)===0||Re){var e=Ya;Ya<<=1,(Ya&3932160)===0&&(Ya=262144),Ft=e}else Ft=536870912;return e=Qt.current,e!==null&&(e.flags|=32),Ft}function Ht(e,t,l){(e===Ke&&(Ve===2||Ve===9)||e.cancelPendingCommit!==null)&&(vi(e,0),cl(e,De,Ft,!1)),Li(e,l),((He&2)===0||e!==Ke)&&(e===Ke&&((He&2)===0&&(Ul|=l),lt===4&&cl(e,De,Ft,!1)),bn(e))}function jh(e,t,l){if((He&6)!==0)throw Error(u(327));var i=!l&&(t&127)===0&&(t&e.expiredLanes)===0||Ni(e,t),o=i?O1(e,t):sc(e,t,!0),s=i;do{if(o===0){mi&&!i&&cl(e,t,0,!1);break}else{if(l=e.current.alternate,s&&!z1(l)){o=sc(e,t,!1),s=!1;continue}if(o===2){if(s=t,e.errorRecoveryDisabledLanes&s)var y=0;else y=e.pendingLanes&-536870913,y=y!==0?y:y&536870912?536870912:0;if(y!==0){t=y;e:{var S=e;o=ha;var A=S.current.memoizedState.isDehydrated;if(A&&(vi(S,y).flags|=256),y=sc(S,y,!1),y!==2){if(lc&&!A){S.errorRecoveryDisabledLanes|=s,Ul|=s,o=4;break e}s=Bt,Bt=o,s!==null&&(Bt===null?Bt=s:Bt.push.apply(Bt,s))}o=y}if(s=!1,o!==2)continue}}if(o===1){vi(e,0),cl(e,t,0,!0);break}e:{switch(i=e,s=o,s){case 0:case 1:throw Error(u(345));case 4:if((t&4194048)!==t)break;case 6:cl(i,t,Ft,!al);break e;case 2:Bt=null;break;case 3:case 5:break;default:throw Error(u(329))}if((t&62914560)===t&&(o=Dr+300-Ct(),10<o)){if(cl(i,t,Ft,!al),Ga(i,0,!0)!==0)break e;Vn=t,i.timeoutHandle=pp(Bh.bind(null,i,l,Bt,Rr,ac,t,Ft,Ul,gi,al,s,"Throttled",-0,0),o);break e}Bh(i,l,Bt,Rr,ac,t,Ft,Ul,gi,al,s,null,-0,0)}}break}while(!0);bn(e)}function Bh(e,t,l,i,o,s,y,S,A,R,Y,I,N,j){if(e.timeoutHandle=-1,I=t.subtreeFlags,I&8192||(I&16785408)===16785408){I={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:Cn},Oh(t,s,I);var oe=(s&62914560)===s?Dr-Ct():(s&4194048)===s?Nh-Ct():0;if(oe=dv(I,oe),oe!==null){Vn=s,e.cancelPendingCommit=oe(Ih.bind(null,e,t,s,l,i,o,y,S,A,Y,I,null,N,j)),cl(e,s,y,!R);return}}Ih(e,t,s,l,i,o,y,S,A)}function z1(e){for(var t=e;;){var l=t.tag;if((l===0||l===11||l===15)&&t.flags&16384&&(l=t.updateQueue,l!==null&&(l=l.stores,l!==null)))for(var i=0;i<l.length;i++){var o=l[i],s=o.getSnapshot;o=o.value;try{if(!Gt(s(),o))return!1}catch{return!1}}if(l=t.child,t.subtreeFlags&16384&&l!==null)l.return=t,t=l;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function cl(e,t,l,i){t&=~ic,t&=~Ul,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var o=t;0<o;){var s=31-Fe(o),y=1<<s;i[s]=-1,o&=~y}l!==0&&Zs(e,l,t)}function Nr(){return(He&6)===0?(ma(0),!1):!0}function cc(){if(ze!==null){if(Ve===0)var e=ze.return;else e=ze,Dn=Cl=null,wo(e),oi=null,Wi=0,e=ze;for(;e!==null;)mh(e.alternate,e),e=e.return;ze=null}}function vi(e,t){var l=e.timeoutHandle;l!==-1&&(e.timeoutHandle=-1,F1(l)),l=e.cancelPendingCommit,l!==null&&(e.cancelPendingCommit=null,l()),Vn=0,cc(),Ke=e,ze=l=_n(e.current,null),De=t,Ve=0,Zt=null,al=!1,mi=Ni(e,t),lc=!1,gi=Ft=ic=Ul=rl=lt=0,Bt=ha=null,ac=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var o=31-Fe(i),s=1<<o;t|=e[o],i&=~s}return Yn=t,tr(),l}function Hh(e,t){Ee=null,D.H=aa,t===ui||t===cr?(t=td(),Ve=3):t===ho?(t=td(),Ve=4):Ve=t===Yo?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Zt=t,ze===null&&(lt=1,kr(e,tn(t,e.current)))}function qh(){var e=Qt.current;return e===null?!0:(De&4194048)===De?rn===null:(De&62914560)===De||(De&536870912)!==0?e===rn:!1}function Yh(){var e=D.H;return D.H=aa,e===null?aa:e}function Vh(){var e=D.A;return D.A=T1,e}function Lr(){lt=4,al||(De&4194048)!==De&&Qt.current!==null||(mi=!0),(rl&134217727)===0&&(Ul&134217727)===0||Ke===null||cl(Ke,De,Ft,!1)}function sc(e,t,l){var i=He;He|=2;var o=Yh(),s=Vh();(Ke!==e||De!==t)&&(Rr=null,vi(e,t)),t=!1;var y=lt;e:do try{if(Ve!==0&&ze!==null){var S=ze,A=Zt;switch(Ve){case 8:cc(),y=6;break e;case 3:case 2:case 9:case 6:Qt.current===null&&(t=!0);var R=Ve;if(Ve=0,Zt=null,bi(e,S,A,R),l&&mi){y=0;break e}break;default:R=Ve,Ve=0,Zt=null,bi(e,S,A,R)}}_1(),y=lt;break}catch(Y){Hh(e,Y)}while(!0);return t&&e.shellSuspendCounter++,Dn=Cl=null,He=i,D.H=o,D.A=s,ze===null&&(Ke=null,De=0,tr()),y}function _1(){for(;ze!==null;)Gh(ze)}function O1(e,t){var l=He;He|=2;var i=Yh(),o=Vh();Ke!==e||De!==t?(Rr=null,Mr=Ct()+500,vi(e,t)):mi=Ni(e,t);e:do try{if(Ve!==0&&ze!==null){t=ze;var s=Zt;t:switch(Ve){case 1:Ve=0,Zt=null,bi(e,t,s,1);break;case 2:case 9:if(Pf(s)){Ve=0,Zt=null,Xh(t);break}t=function(){Ve!==2&&Ve!==9||Ke!==e||(Ve=7),bn(e)},s.then(t,t);break e;case 3:Ve=7;break e;case 4:Ve=5;break e;case 7:Pf(s)?(Ve=0,Zt=null,Xh(t)):(Ve=0,Zt=null,bi(e,t,s,7));break;case 5:var y=null;switch(ze.tag){case 26:y=ze.memoizedState;case 5:case 27:var S=ze;if(y?_p(y):S.stateNode.complete){Ve=0,Zt=null;var A=S.sibling;if(A!==null)ze=A;else{var R=S.return;R!==null?(ze=R,Ur(R)):ze=null}break t}}Ve=0,Zt=null,bi(e,t,s,5);break;case 6:Ve=0,Zt=null,bi(e,t,s,6);break;case 8:cc(),lt=6;break e;default:throw Error(u(462))}}D1();break}catch(Y){Hh(e,Y)}while(!0);return Dn=Cl=null,D.H=i,D.A=o,He=l,ze!==null?0:(Ke=null,De=0,tr(),lt)}function D1(){for(;ze!==null&&!Eu();)Gh(ze)}function Gh(e){var t=hh(e.alternate,e,Yn);e.memoizedProps=e.pendingProps,t===null?Ur(e):ze=t}function Xh(e){var t=e,l=t.alternate;switch(t.tag){case 15:case 0:t=uh(l,t,t.pendingProps,t.type,void 0,De);break;case 11:t=uh(l,t,t.pendingProps,t.type.render,t.ref,De);break;case 5:wo(t);default:mh(l,t),t=ze=Vf(t,Yn),t=hh(l,t,Yn)}e.memoizedProps=e.pendingProps,t===null?Ur(e):ze=t}function bi(e,t,l,i){Dn=Cl=null,wo(t),oi=null,Wi=0;var o=t.return;try{if(b1(e,o,t,l,De)){lt=1,kr(e,tn(l,e.current)),ze=null;return}}catch(s){if(o!==null)throw ze=o,s;lt=1,kr(e,tn(l,e.current)),ze=null;return}t.flags&32768?(Re||i===1?e=!0:mi||(De&536870912)!==0?e=!1:(al=e=!0,(i===2||i===9||i===3||i===6)&&(i=Qt.current,i!==null&&i.tag===13&&(i.flags|=16384))),Qh(t,e)):Ur(t)}function Ur(e){var t=e;do{if((t.flags&32768)!==0){Qh(t,al);return}e=t.return;var l=E1(t.alternate,t,Yn);if(l!==null){ze=l;return}if(t=t.sibling,t!==null){ze=t;return}ze=t=e}while(t!==null);lt===0&&(lt=5)}function Qh(e,t){do{var l=k1(e.alternate,e);if(l!==null){l.flags&=32767,ze=l;return}if(l=e.return,l!==null&&(l.flags|=32768,l.subtreeFlags=0,l.deletions=null),!t&&(e=e.sibling,e!==null)){ze=e;return}ze=e=l}while(e!==null);lt=6,ze=null}function Ih(e,t,l,i,o,s,y,S,A){e.cancelPendingCommit=null;do jr();while(dt!==0);if((He&6)!==0)throw Error(u(327));if(t!==null){if(t===e.current)throw Error(u(177));if(s=t.lanes|t.childLanes,s|=Wu,sy(e,l,s,y,S,A),e===Ke&&(ze=Ke=null,De=0),yi=t,ol=e,Vn=l,rc=s,uc=o,Lh=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,L1(ye,function(){return Wh(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=D.T,D.T=null,o=Z.p,Z.p=2,y=He,He|=4;try{A1(e,t,l)}finally{He=y,Z.p=o,D.T=i}}dt=1,Zh(),Fh(),Kh()}}function Zh(){if(dt===1){dt=0;var e=ol,t=yi,l=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||l){l=D.T,D.T=null;var i=Z.p;Z.p=2;var o=He;He|=4;try{Ch(t,e);var s=Ec,y=Rf(e.containerInfo),S=s.focusedElem,A=s.selectionRange;if(y!==S&&S&&S.ownerDocument&&Mf(S.ownerDocument.documentElement,S)){if(A!==null&&Iu(S)){var R=A.start,Y=A.end;if(Y===void 0&&(Y=R),"selectionStart"in S)S.selectionStart=R,S.selectionEnd=Math.min(Y,S.value.length);else{var I=S.ownerDocument||document,N=I&&I.defaultView||window;if(N.getSelection){var j=N.getSelection(),oe=S.textContent.length,me=Math.min(A.start,oe),Ie=A.end===void 0?me:Math.min(A.end,oe);!j.extend&&me>Ie&&(y=Ie,Ie=me,me=y);var z=Df(S,me),T=Df(S,Ie);if(z&&T&&(j.rangeCount!==1||j.anchorNode!==z.node||j.anchorOffset!==z.offset||j.focusNode!==T.node||j.focusOffset!==T.offset)){var M=I.createRange();M.setStart(z.node,z.offset),j.removeAllRanges(),me>Ie?(j.addRange(M),j.extend(T.node,T.offset)):(M.setEnd(T.node,T.offset),j.addRange(M))}}}}for(I=[],j=S;j=j.parentNode;)j.nodeType===1&&I.push({element:j,left:j.scrollLeft,top:j.scrollTop});for(typeof S.focus=="function"&&S.focus(),S=0;S<I.length;S++){var Q=I[S];Q.element.scrollLeft=Q.left,Q.element.scrollTop=Q.top}}Kr=!!xc,Ec=xc=null}finally{He=o,Z.p=i,D.T=l}}e.current=t,dt=2}}function Fh(){if(dt===2){dt=0;var e=ol,t=yi,l=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||l){l=D.T,D.T=null;var i=Z.p;Z.p=2;var o=He;He|=4;try{Eh(e,t.alternate,t)}finally{He=o,Z.p=i,D.T=l}}dt=3}}function Kh(){if(dt===4||dt===3){dt=0,ku();var e=ol,t=yi,l=Vn,i=Lh;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?dt=5:(dt=0,yi=ol=null,Jh(e,e.pendingLanes));var o=e.pendingLanes;if(o===0&&(ul=null),Cu(l),t=t.stateNode,ft&&typeof ft.onCommitFiberRoot=="function")try{ft.onCommitFiberRoot(zt,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=D.T,o=Z.p,Z.p=2,D.T=null;try{for(var s=e.onRecoverableError,y=0;y<i.length;y++){var S=i[y];s(S.value,{componentStack:S.stack})}}finally{D.T=t,Z.p=o}}(Vn&3)!==0&&jr(),bn(e),o=e.pendingLanes,(l&261930)!==0&&(o&42)!==0?e===oc?pa++:(pa=0,oc=e):pa=0,ma(0)}}function Jh(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Ki(t)))}function jr(){return Zh(),Fh(),Kh(),Wh()}function Wh(){if(dt!==5)return!1;var e=ol,t=rc;rc=0;var l=Cu(Vn),i=D.T,o=Z.p;try{Z.p=32>l?32:l,D.T=null,l=uc,uc=null;var s=ol,y=Vn;if(dt=0,yi=ol=null,Vn=0,(He&6)!==0)throw Error(u(331));var S=He;if(He|=4,Mh(s.current),_h(s,s.current,y,l),He=S,ma(0,!1),ft&&typeof ft.onPostCommitFiberRoot=="function")try{ft.onPostCommitFiberRoot(zt,s)}catch{}return!0}finally{Z.p=o,D.T=i,Jh(e,t)}}function $h(e,t,l){t=tn(l,t),t=qo(e.stateNode,t,2),e=tl(e,t,2),e!==null&&(Li(e,2),bn(e))}function Ge(e,t,l){if(e.tag===3)$h(e,e,l);else for(;t!==null;){if(t.tag===3){$h(t,e,l);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(ul===null||!ul.has(i))){e=tn(l,e),l=Pd(2),i=tl(t,l,2),i!==null&&(eh(l,i,t,e),Li(i,2),bn(i));break}}t=t.return}}function fc(e,t,l){var i=e.pingCache;if(i===null){i=e.pingCache=new C1;var o=new Set;i.set(t,o)}else o=i.get(t),o===void 0&&(o=new Set,i.set(t,o));o.has(l)||(lc=!0,o.add(l),e=M1.bind(null,e,t,l),t.then(e,e))}function M1(e,t,l){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&l,e.warmLanes&=~l,Ke===e&&(De&l)===l&&(lt===4||lt===3&&(De&62914560)===De&&300>Ct()-Dr?(He&2)===0&&vi(e,0):ic|=l,gi===De&&(gi=0)),bn(e)}function Ph(e,t){t===0&&(t=Is()),e=Al(e,t),e!==null&&(Li(e,t),bn(e))}function R1(e){var t=e.memoizedState,l=0;t!==null&&(l=t.retryLane),Ph(e,l)}function N1(e,t){var l=0;switch(e.tag){case 31:case 13:var i=e.stateNode,o=e.memoizedState;o!==null&&(l=o.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(u(314))}i!==null&&i.delete(t),Ph(e,l)}function L1(e,t){return mn(e,t)}var Br=null,Si=null,dc=!1,Hr=!1,hc=!1,sl=0;function bn(e){e!==Si&&e.next===null&&(Si===null?Br=Si=e:Si=Si.next=e),Hr=!0,dc||(dc=!0,j1())}function ma(e,t){if(!hc&&Hr){hc=!0;do for(var l=!1,i=Br;i!==null;){if(e!==0){var o=i.pendingLanes;if(o===0)var s=0;else{var y=i.suspendedLanes,S=i.pingedLanes;s=(1<<31-Fe(42|e)+1)-1,s&=o&~(y&~S),s=s&201326741?s&201326741|1:s?s|2:0}s!==0&&(l=!0,lp(i,s))}else s=De,s=Ga(i,i===Ke?s:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(s&3)===0||Ni(i,s)||(l=!0,lp(i,s));i=i.next}while(l);hc=!1}}function U1(){ep()}function ep(){Hr=dc=!1;var e=0;sl!==0&&Z1()&&(e=sl);for(var t=Ct(),l=null,i=Br;i!==null;){var o=i.next,s=tp(i,t);s===0?(i.next=null,l===null?Br=o:l.next=o,o===null&&(Si=l)):(l=i,(e!==0||(s&3)!==0)&&(Hr=!0)),i=o}dt!==0&&dt!==5||ma(e),sl!==0&&(sl=0)}function tp(e,t){for(var l=e.suspendedLanes,i=e.pingedLanes,o=e.expirationTimes,s=e.pendingLanes&-62914561;0<s;){var y=31-Fe(s),S=1<<y,A=o[y];A===-1?((S&l)===0||(S&i)!==0)&&(o[y]=cy(S,t)):A<=t&&(e.expiredLanes|=S),s&=~S}if(t=Ke,l=De,l=Ga(e,e===t?l:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,l===0||e===t&&(Ve===2||Ve===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&Qn(i),e.callbackNode=null,e.callbackPriority=0;if((l&3)===0||Ni(e,l)){if(t=l&-l,t===e.callbackPriority)return t;switch(i!==null&&Qn(i),Cu(l)){case 2:case 8:l=te;break;case 32:l=ye;break;case 268435456:l=qe;break;default:l=ye}return i=np.bind(null,e),l=mn(l,i),e.callbackPriority=t,e.callbackNode=l,t}return i!==null&&i!==null&&Qn(i),e.callbackPriority=2,e.callbackNode=null,2}function np(e,t){if(dt!==0&&dt!==5)return e.callbackNode=null,e.callbackPriority=0,null;var l=e.callbackNode;if(jr()&&e.callbackNode!==l)return null;var i=De;return i=Ga(e,e===Ke?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(jh(e,i,t),tp(e,Ct()),e.callbackNode!=null&&e.callbackNode===l?np.bind(null,e):null)}function lp(e,t){if(jr())return null;jh(e,t,!0)}function j1(){K1(function(){(He&6)!==0?mn(X,U1):ep()})}function pc(){if(sl===0){var e=ai;e===0&&(e=qa,qa<<=1,(qa&261888)===0&&(qa=256)),sl=e}return sl}function ip(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Za(""+e)}function ap(e,t){var l=t.ownerDocument.createElement("input");return l.name=t.name,l.value=t.value,e.id&&l.setAttribute("form",e.id),t.parentNode.insertBefore(l,t),e=new FormData(e),l.parentNode.removeChild(l),e}function B1(e,t,l,i,o){if(t==="submit"&&l&&l.stateNode===o){var s=ip((o[Rt]||null).action),y=i.submitter;y&&(t=(t=y[Rt]||null)?ip(t.formAction):y.getAttribute("formAction"),t!==null&&(s=t,y=null));var S=new Wa("action","action",null,i,o);e.push({event:S,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(sl!==0){var A=y?ap(o,y):new FormData(o);No(l,{pending:!0,data:A,method:o.method,action:s},null,A)}}else typeof s=="function"&&(S.preventDefault(),A=y?ap(o,y):new FormData(o),No(l,{pending:!0,data:A,method:o.method,action:s},s,A))},currentTarget:o}]})}}for(var mc=0;mc<Ju.length;mc++){var gc=Ju[mc],H1=gc.toLowerCase(),q1=gc[0].toUpperCase()+gc.slice(1);fn(H1,"on"+q1)}fn(Uf,"onAnimationEnd"),fn(jf,"onAnimationIteration"),fn(Bf,"onAnimationStart"),fn("dblclick","onDoubleClick"),fn("focusin","onFocus"),fn("focusout","onBlur"),fn(n1,"onTransitionRun"),fn(l1,"onTransitionStart"),fn(i1,"onTransitionCancel"),fn(Hf,"onTransitionEnd"),Ql("onMouseEnter",["mouseout","mouseover"]),Ql("onMouseLeave",["mouseout","mouseover"]),Ql("onPointerEnter",["pointerout","pointerover"]),Ql("onPointerLeave",["pointerout","pointerover"]),Sl("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),Sl("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),Sl("onBeforeInput",["compositionend","keypress","textInput","paste"]),Sl("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),Sl("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),Sl("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var ga="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Y1=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(ga));function rp(e,t){t=(t&4)!==0;for(var l=0;l<e.length;l++){var i=e[l],o=i.event;i=i.listeners;e:{var s=void 0;if(t)for(var y=i.length-1;0<=y;y--){var S=i[y],A=S.instance,R=S.currentTarget;if(S=S.listener,A!==s&&o.isPropagationStopped())break e;s=S,o.currentTarget=R;try{s(o)}catch(Y){er(Y)}o.currentTarget=null,s=A}else for(y=0;y<i.length;y++){if(S=i[y],A=S.instance,R=S.currentTarget,S=S.listener,A!==s&&o.isPropagationStopped())break e;s=S,o.currentTarget=R;try{s(o)}catch(Y){er(Y)}o.currentTarget=null,s=A}}}}function _e(e,t){var l=t[zu];l===void 0&&(l=t[zu]=new Set);var i=e+"__bubble";l.has(i)||(up(t,e,2,!1),l.add(i))}function yc(e,t,l){var i=0;t&&(i|=4),up(l,e,i,t)}var qr="_reactListening"+Math.random().toString(36).slice(2);function vc(e){if(!e[qr]){e[qr]=!0,Ps.forEach(function(l){l!=="selectionchange"&&(Y1.has(l)||yc(l,!1,e),yc(l,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[qr]||(t[qr]=!0,yc("selectionchange",!1,t))}}function up(e,t,l,i){switch(Up(t)){case 2:var o=mv;break;case 8:o=gv;break;default:o=Rc}l=o.bind(null,t,l,e),o=void 0,!ju||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),i?o!==void 0?e.addEventListener(t,l,{capture:!0,passive:o}):e.addEventListener(t,l,!0):o!==void 0?e.addEventListener(t,l,{passive:o}):e.addEventListener(t,l,!1)}function bc(e,t,l,i,o){var s=i;if((t&1)===0&&(t&2)===0&&i!==null)e:for(;;){if(i===null)return;var y=i.tag;if(y===3||y===4){var S=i.stateNode.containerInfo;if(S===o)break;if(y===4)for(y=i.return;y!==null;){var A=y.tag;if((A===3||A===4)&&y.stateNode.containerInfo===o)return;y=y.return}for(;S!==null;){if(y=Vl(S),y===null)return;if(A=y.tag,A===5||A===6||A===26||A===27){i=s=y;continue e}S=S.parentNode}}i=i.return}df(function(){var R=s,Y=Lu(l),I=[];e:{var N=qf.get(e);if(N!==void 0){var j=Wa,oe=e;switch(e){case"keypress":if(Ka(l)===0)break e;case"keydown":case"keyup":j=Ny;break;case"focusin":oe="focus",j=Yu;break;case"focusout":oe="blur",j=Yu;break;case"beforeblur":case"afterblur":j=Yu;break;case"click":if(l.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":j=mf;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":j=Ey;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":j=jy;break;case Uf:case jf:case Bf:j=wy;break;case Hf:j=Hy;break;case"scroll":case"scrollend":j=Sy;break;case"wheel":j=Yy;break;case"copy":case"cut":case"paste":j=Cy;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":j=yf;break;case"toggle":case"beforetoggle":j=Gy}var me=(t&4)!==0,Ie=!me&&(e==="scroll"||e==="scrollend"),z=me?N!==null?N+"Capture":null:N;me=[];for(var T=R,M;T!==null;){var Q=T;if(M=Q.stateNode,Q=Q.tag,Q!==5&&Q!==26&&Q!==27||M===null||z===null||(Q=Bi(T,z),Q!=null&&me.push(ya(T,Q,M))),Ie)break;T=T.return}0<me.length&&(N=new j(N,oe,null,l,Y),I.push({event:N,listeners:me}))}}if((t&7)===0){e:{if(N=e==="mouseover"||e==="pointerover",j=e==="mouseout"||e==="pointerout",N&&l!==Nu&&(oe=l.relatedTarget||l.fromElement)&&(Vl(oe)||oe[Yl]))break e;if((j||N)&&(N=Y.window===Y?Y:(N=Y.ownerDocument)?N.defaultView||N.parentWindow:window,j?(oe=l.relatedTarget||l.toElement,j=R,oe=oe?Vl(oe):null,oe!==null&&(Ie=f(oe),me=oe.tag,oe!==Ie||me!==5&&me!==27&&me!==6)&&(oe=null)):(j=null,oe=R),j!==oe)){if(me=mf,Q="onMouseLeave",z="onMouseEnter",T="mouse",(e==="pointerout"||e==="pointerover")&&(me=yf,Q="onPointerLeave",z="onPointerEnter",T="pointer"),Ie=j==null?N:ji(j),M=oe==null?N:ji(oe),N=new me(Q,T+"leave",j,l,Y),N.target=Ie,N.relatedTarget=M,Q=null,Vl(Y)===R&&(me=new me(z,T+"enter",oe,l,Y),me.target=M,me.relatedTarget=Ie,Q=me),Ie=Q,j&&oe)t:{for(me=V1,z=j,T=oe,M=0,Q=z;Q;Q=me(Q))M++;Q=0;for(var he=T;he;he=me(he))Q++;for(;0<M-Q;)z=me(z),M--;for(;0<Q-M;)T=me(T),Q--;for(;M--;){if(z===T||T!==null&&z===T.alternate){me=z;break t}z=me(z),T=me(T)}me=null}else me=null;j!==null&&op(I,N,j,me,!1),oe!==null&&Ie!==null&&op(I,Ie,oe,me,!0)}}e:{if(N=R?ji(R):window,j=N.nodeName&&N.nodeName.toLowerCase(),j==="select"||j==="input"&&N.type==="file")var je=wf;else if(kf(N))if(Tf)je=Py;else{je=Wy;var fe=Jy}else j=N.nodeName,!j||j.toLowerCase()!=="input"||N.type!=="checkbox"&&N.type!=="radio"?R&&Ru(R.elementType)&&(je=wf):je=$y;if(je&&(je=je(e,R))){Af(I,je,l,Y);break e}fe&&fe(e,N,R),e==="focusout"&&R&&N.type==="number"&&R.memoizedProps.value!=null&&Mu(N,"number",N.value)}switch(fe=R?ji(R):window,e){case"focusin":(kf(fe)||fe.contentEditable==="true")&&(Wl=fe,Zu=R,Ii=null);break;case"focusout":Ii=Zu=Wl=null;break;case"mousedown":Fu=!0;break;case"contextmenu":case"mouseup":case"dragend":Fu=!1,Nf(I,l,Y);break;case"selectionchange":if(t1)break;case"keydown":case"keyup":Nf(I,l,Y)}var ke;if(Gu)e:{switch(e){case"compositionstart":var Me="onCompositionStart";break e;case"compositionend":Me="onCompositionEnd";break e;case"compositionupdate":Me="onCompositionUpdate";break e}Me=void 0}else Jl?xf(e,l)&&(Me="onCompositionEnd"):e==="keydown"&&l.keyCode===229&&(Me="onCompositionStart");Me&&(vf&&l.locale!=="ko"&&(Jl||Me!=="onCompositionStart"?Me==="onCompositionEnd"&&Jl&&(ke=hf()):(Fn=Y,Bu="value"in Fn?Fn.value:Fn.textContent,Jl=!0)),fe=Yr(R,Me),0<fe.length&&(Me=new gf(Me,e,null,l,Y),I.push({event:Me,listeners:fe}),ke?Me.data=ke:(ke=Ef(l),ke!==null&&(Me.data=ke)))),(ke=Qy?Iy(e,l):Zy(e,l))&&(Me=Yr(R,"onBeforeInput"),0<Me.length&&(fe=new gf("onBeforeInput","beforeinput",null,l,Y),I.push({event:fe,listeners:Me}),fe.data=ke)),B1(I,e,R,l,Y)}rp(I,t)})}function ya(e,t,l){return{instance:e,listener:t,currentTarget:l}}function Yr(e,t){for(var l=t+"Capture",i=[];e!==null;){var o=e,s=o.stateNode;if(o=o.tag,o!==5&&o!==26&&o!==27||s===null||(o=Bi(e,l),o!=null&&i.unshift(ya(e,o,s)),o=Bi(e,t),o!=null&&i.push(ya(e,o,s))),e.tag===3)return i;e=e.return}return[]}function V1(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function op(e,t,l,i,o){for(var s=t._reactName,y=[];l!==null&&l!==i;){var S=l,A=S.alternate,R=S.stateNode;if(S=S.tag,A!==null&&A===i)break;S!==5&&S!==26&&S!==27||R===null||(A=R,o?(R=Bi(l,s),R!=null&&y.unshift(ya(l,R,A))):o||(R=Bi(l,s),R!=null&&y.push(ya(l,R,A)))),l=l.return}y.length!==0&&e.push({event:t,listeners:y})}var G1=/\\r\\n?/g,X1=/\\u0000|\\uFFFD/g;function cp(e){return(typeof e=="string"?e:""+e).replace(G1,`\n`).replace(X1,"")}function sp(e,t){return t=cp(t),cp(e)===t}function Qe(e,t,l,i,o,s){switch(l){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Zl(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Zl(e,""+i);break;case"className":Qa(e,"class",i);break;case"tabIndex":Qa(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Qa(e,l,i);break;case"style":sf(e,i,s);break;case"data":if(t!=="object"){Qa(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||l!=="href")){e.removeAttribute(l);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Za(""+i),e.setAttribute(l,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(l,"javascript:throw new Error(\'A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\\\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().\')");break}else typeof s=="function"&&(l==="formAction"?(t!=="input"&&Qe(e,t,"name",o.name,o,null),Qe(e,t,"formEncType",o.formEncType,o,null),Qe(e,t,"formMethod",o.formMethod,o,null),Qe(e,t,"formTarget",o.formTarget,o,null)):(Qe(e,t,"encType",o.encType,o,null),Qe(e,t,"method",o.method,o,null),Qe(e,t,"target",o.target,o,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Za(""+i),e.setAttribute(l,i);break;case"onClick":i!=null&&(e.onclick=Cn);break;case"onScroll":i!=null&&_e("scroll",e);break;case"onScrollEnd":i!=null&&_e("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}l=Za(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",l);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""+i):e.removeAttribute(l);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""):e.removeAttribute(l);break;case"capture":case"download":i===!0?e.setAttribute(l,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,i):e.removeAttribute(l);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(l,i):e.removeAttribute(l);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(l):e.setAttribute(l,i);break;case"popover":_e("beforetoggle",e),_e("toggle",e),Xa(e,"popover",i);break;case"xlinkActuate":Tn(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":Tn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":Tn(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":Tn(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":Tn(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":Tn(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":Tn(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":Tn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":Tn(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Xa(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<l.length)||l[0]!=="o"&&l[0]!=="O"||l[1]!=="n"&&l[1]!=="N")&&(l=vy.get(l)||l,Xa(e,l,i))}}function Sc(e,t,l,i,o,s){switch(l){case"style":sf(e,i,s);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"children":typeof i=="string"?Zl(e,i):(typeof i=="number"||typeof i=="bigint")&&Zl(e,""+i);break;case"onScroll":i!=null&&_e("scroll",e);break;case"onScrollEnd":i!=null&&_e("scrollend",e);break;case"onClick":i!=null&&(e.onclick=Cn);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!ef.hasOwnProperty(l))e:{if(l[0]==="o"&&l[1]==="n"&&(o=l.endsWith("Capture"),t=l.slice(2,o?l.length-7:void 0),s=e[Rt]||null,s=s!=null?s[l]:null,typeof s=="function"&&e.removeEventListener(t,s,o),typeof i=="function")){typeof s!="function"&&s!==null&&(l in e?e[l]=null:e.hasAttribute(l)&&e.removeAttribute(l)),e.addEventListener(t,i,o);break e}l in e?e[l]=i:i===!0?e.setAttribute(l,""):Xa(e,l,i)}}}function xt(e,t,l){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":_e("error",e),_e("load",e);var i=!1,o=!1,s;for(s in l)if(l.hasOwnProperty(s)){var y=l[s];if(y!=null)switch(s){case"src":i=!0;break;case"srcSet":o=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Qe(e,t,s,y,l,null)}}o&&Qe(e,t,"srcSet",l.srcSet,l,null),i&&Qe(e,t,"src",l.src,l,null);return;case"input":_e("invalid",e);var S=s=y=o=null,A=null,R=null;for(i in l)if(l.hasOwnProperty(i)){var Y=l[i];if(Y!=null)switch(i){case"name":o=Y;break;case"type":y=Y;break;case"checked":A=Y;break;case"defaultChecked":R=Y;break;case"value":s=Y;break;case"defaultValue":S=Y;break;case"children":case"dangerouslySetInnerHTML":if(Y!=null)throw Error(u(137,t));break;default:Qe(e,t,i,Y,l,null)}}rf(e,s,S,A,R,y,o,!1);return;case"select":_e("invalid",e),i=y=s=null;for(o in l)if(l.hasOwnProperty(o)&&(S=l[o],S!=null))switch(o){case"value":s=S;break;case"defaultValue":y=S;break;case"multiple":i=S;default:Qe(e,t,o,S,l,null)}t=s,l=y,e.multiple=!!i,t!=null?Il(e,!!i,t,!1):l!=null&&Il(e,!!i,l,!0);return;case"textarea":_e("invalid",e),s=o=i=null;for(y in l)if(l.hasOwnProperty(y)&&(S=l[y],S!=null))switch(y){case"value":i=S;break;case"defaultValue":o=S;break;case"children":s=S;break;case"dangerouslySetInnerHTML":if(S!=null)throw Error(u(91));break;default:Qe(e,t,y,S,l,null)}of(e,i,o,s);return;case"option":for(A in l)if(l.hasOwnProperty(A)&&(i=l[A],i!=null))switch(A){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:Qe(e,t,A,i,l,null)}return;case"dialog":_e("beforetoggle",e),_e("toggle",e),_e("cancel",e),_e("close",e);break;case"iframe":case"object":_e("load",e);break;case"video":case"audio":for(i=0;i<ga.length;i++)_e(ga[i],e);break;case"image":_e("error",e),_e("load",e);break;case"details":_e("toggle",e);break;case"embed":case"source":case"link":_e("error",e),_e("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(R in l)if(l.hasOwnProperty(R)&&(i=l[R],i!=null))switch(R){case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Qe(e,t,R,i,l,null)}return;default:if(Ru(t)){for(Y in l)l.hasOwnProperty(Y)&&(i=l[Y],i!==void 0&&Sc(e,t,Y,i,l,void 0));return}}for(S in l)l.hasOwnProperty(S)&&(i=l[S],i!=null&&Qe(e,t,S,i,l,null))}function Q1(e,t,l,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var o=null,s=null,y=null,S=null,A=null,R=null,Y=null;for(j in l){var I=l[j];if(l.hasOwnProperty(j)&&I!=null)switch(j){case"checked":break;case"value":break;case"defaultValue":A=I;default:i.hasOwnProperty(j)||Qe(e,t,j,null,i,I)}}for(var N in i){var j=i[N];if(I=l[N],i.hasOwnProperty(N)&&(j!=null||I!=null))switch(N){case"type":s=j;break;case"name":o=j;break;case"checked":R=j;break;case"defaultChecked":Y=j;break;case"value":y=j;break;case"defaultValue":S=j;break;case"children":case"dangerouslySetInnerHTML":if(j!=null)throw Error(u(137,t));break;default:j!==I&&Qe(e,t,N,j,i,I)}}Du(e,y,S,A,R,Y,s,o);return;case"select":j=y=S=N=null;for(s in l)if(A=l[s],l.hasOwnProperty(s)&&A!=null)switch(s){case"value":break;case"multiple":j=A;default:i.hasOwnProperty(s)||Qe(e,t,s,null,i,A)}for(o in i)if(s=i[o],A=l[o],i.hasOwnProperty(o)&&(s!=null||A!=null))switch(o){case"value":N=s;break;case"defaultValue":S=s;break;case"multiple":y=s;default:s!==A&&Qe(e,t,o,s,i,A)}t=S,l=y,i=j,N!=null?Il(e,!!l,N,!1):!!i!=!!l&&(t!=null?Il(e,!!l,t,!0):Il(e,!!l,l?[]:"",!1));return;case"textarea":j=N=null;for(S in l)if(o=l[S],l.hasOwnProperty(S)&&o!=null&&!i.hasOwnProperty(S))switch(S){case"value":break;case"children":break;default:Qe(e,t,S,null,i,o)}for(y in i)if(o=i[y],s=l[y],i.hasOwnProperty(y)&&(o!=null||s!=null))switch(y){case"value":N=o;break;case"defaultValue":j=o;break;case"children":break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(u(91));break;default:o!==s&&Qe(e,t,y,o,i,s)}uf(e,N,j);return;case"option":for(var oe in l)if(N=l[oe],l.hasOwnProperty(oe)&&N!=null&&!i.hasOwnProperty(oe))switch(oe){case"selected":e.selected=!1;break;default:Qe(e,t,oe,null,i,N)}for(A in i)if(N=i[A],j=l[A],i.hasOwnProperty(A)&&N!==j&&(N!=null||j!=null))switch(A){case"selected":e.selected=N&&typeof N!="function"&&typeof N!="symbol";break;default:Qe(e,t,A,N,i,j)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var me in l)N=l[me],l.hasOwnProperty(me)&&N!=null&&!i.hasOwnProperty(me)&&Qe(e,t,me,null,i,N);for(R in i)if(N=i[R],j=l[R],i.hasOwnProperty(R)&&N!==j&&(N!=null||j!=null))switch(R){case"children":case"dangerouslySetInnerHTML":if(N!=null)throw Error(u(137,t));break;default:Qe(e,t,R,N,i,j)}return;default:if(Ru(t)){for(var Ie in l)N=l[Ie],l.hasOwnProperty(Ie)&&N!==void 0&&!i.hasOwnProperty(Ie)&&Sc(e,t,Ie,void 0,i,N);for(Y in i)N=i[Y],j=l[Y],!i.hasOwnProperty(Y)||N===j||N===void 0&&j===void 0||Sc(e,t,Y,N,i,j);return}}for(var z in l)N=l[z],l.hasOwnProperty(z)&&N!=null&&!i.hasOwnProperty(z)&&Qe(e,t,z,null,i,N);for(I in i)N=i[I],j=l[I],!i.hasOwnProperty(I)||N===j||N==null&&j==null||Qe(e,t,I,N,i,j)}function fp(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function I1(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,l=performance.getEntriesByType("resource"),i=0;i<l.length;i++){var o=l[i],s=o.transferSize,y=o.initiatorType,S=o.duration;if(s&&S&&fp(y)){for(y=0,S=o.responseEnd,i+=1;i<l.length;i++){var A=l[i],R=A.startTime;if(R>S)break;var Y=A.transferSize,I=A.initiatorType;Y&&fp(I)&&(A=A.responseEnd,y+=Y*(A<S?1:(S-R)/(A-R)))}if(--i,t+=8*(s+y)/(o.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var xc=null,Ec=null;function Vr(e){return e.nodeType===9?e:e.ownerDocument}function dp(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function hp(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function kc(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Ac=null;function Z1(){var e=window.event;return e&&e.type==="popstate"?e===Ac?!1:(Ac=e,!0):(Ac=null,!1)}var pp=typeof setTimeout=="function"?setTimeout:void 0,F1=typeof clearTimeout=="function"?clearTimeout:void 0,mp=typeof Promise=="function"?Promise:void 0,K1=typeof queueMicrotask=="function"?queueMicrotask:typeof mp<"u"?function(e){return mp.resolve(null).then(e).catch(J1)}:pp;function J1(e){setTimeout(function(){throw e})}function fl(e){return e==="head"}function gp(e,t){var l=t,i=0;do{var o=l.nextSibling;if(e.removeChild(l),o&&o.nodeType===8)if(l=o.data,l==="/$"||l==="/&"){if(i===0){e.removeChild(o),Ai(t);return}i--}else if(l==="$"||l==="$?"||l==="$~"||l==="$!"||l==="&")i++;else if(l==="html")va(e.ownerDocument.documentElement);else if(l==="head"){l=e.ownerDocument.head,va(l);for(var s=l.firstChild;s;){var y=s.nextSibling,S=s.nodeName;s[Ui]||S==="SCRIPT"||S==="STYLE"||S==="LINK"&&s.rel.toLowerCase()==="stylesheet"||l.removeChild(s),s=y}}else l==="body"&&va(e.ownerDocument.body);l=o}while(l);Ai(t)}function yp(e,t){var l=e;e=0;do{var i=l.nextSibling;if(l.nodeType===1?t?(l._stashedDisplay=l.style.display,l.style.display="none"):(l.style.display=l._stashedDisplay||"",l.getAttribute("style")===""&&l.removeAttribute("style")):l.nodeType===3&&(t?(l._stashedText=l.nodeValue,l.nodeValue=""):l.nodeValue=l._stashedText||""),i&&i.nodeType===8)if(l=i.data,l==="/$"){if(e===0)break;e--}else l!=="$"&&l!=="$?"&&l!=="$~"&&l!=="$!"||e++;l=i}while(l)}function wc(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var l=t;switch(t=t.nextSibling,l.nodeName){case"HTML":case"HEAD":case"BODY":wc(l),_u(l);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(l.rel.toLowerCase()==="stylesheet")continue}e.removeChild(l)}}function W1(e,t,l,i){for(;e.nodeType===1;){var o=l;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[Ui])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(s=e.getAttribute("rel"),s==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(s!==o.rel||e.getAttribute("href")!==(o.href==null||o.href===""?null:o.href)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin)||e.getAttribute("title")!==(o.title==null?null:o.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(s=e.getAttribute("src"),(s!==(o.src==null?null:o.src)||e.getAttribute("type")!==(o.type==null?null:o.type)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin))&&s&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var s=o.name==null?null:""+o.name;if(o.type==="hidden"&&e.getAttribute("name")===s)return e}else return e;if(e=un(e.nextSibling),e===null)break}return null}function $1(e,t,l){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!l||(e=un(e.nextSibling),e===null))return null;return e}function vp(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=un(e.nextSibling),e===null))return null;return e}function Tc(e){return e.data==="$?"||e.data==="$~"}function Cc(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function P1(e,t){var l=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||l.readyState!=="loading")t();else{var i=function(){t(),l.removeEventListener("DOMContentLoaded",i)};l.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function un(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var zc=null;function bp(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="/$"||l==="/&"){if(t===0)return un(e.nextSibling);t--}else l!=="$"&&l!=="$!"&&l!=="$?"&&l!=="$~"&&l!=="&"||t++}e=e.nextSibling}return null}function Sp(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="$"||l==="$!"||l==="$?"||l==="$~"||l==="&"){if(t===0)return e;t--}else l!=="/$"&&l!=="/&"||t++}e=e.previousSibling}return null}function xp(e,t,l){switch(t=Vr(l),e){case"html":if(e=t.documentElement,!e)throw Error(u(452));return e;case"head":if(e=t.head,!e)throw Error(u(453));return e;case"body":if(e=t.body,!e)throw Error(u(454));return e;default:throw Error(u(451))}}function va(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);_u(e)}var on=new Map,Ep=new Set;function Gr(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Gn=Z.d;Z.d={f:ev,r:tv,D:nv,C:lv,L:iv,m:av,X:uv,S:rv,M:ov};function ev(){var e=Gn.f(),t=Nr();return e||t}function tv(e){var t=Gl(e);t!==null&&t.tag===5&&t.type==="form"?Hd(t):Gn.r(e)}var xi=typeof document>"u"?null:document;function kp(e,t,l){var i=xi;if(i&&typeof t=="string"&&t){var o=Pt(t);o=\'link[rel="\'+e+\'"][href="\'+o+\'"]\',typeof l=="string"&&(o+=\'[crossorigin="\'+l+\'"]\'),Ep.has(o)||(Ep.add(o),e={rel:e,crossOrigin:l,href:t},i.querySelector(o)===null&&(t=i.createElement("link"),xt(t,"link",e),ht(t),i.head.appendChild(t)))}}function nv(e){Gn.D(e),kp("dns-prefetch",e,null)}function lv(e,t){Gn.C(e,t),kp("preconnect",e,t)}function iv(e,t,l){Gn.L(e,t,l);var i=xi;if(i&&e&&t){var o=\'link[rel="preload"][as="\'+Pt(t)+\'"]\';t==="image"&&l&&l.imageSrcSet?(o+=\'[imagesrcset="\'+Pt(l.imageSrcSet)+\'"]\',typeof l.imageSizes=="string"&&(o+=\'[imagesizes="\'+Pt(l.imageSizes)+\'"]\')):o+=\'[href="\'+Pt(e)+\'"]\';var s=o;switch(t){case"style":s=Ei(e);break;case"script":s=ki(e)}on.has(s)||(e=g({rel:"preload",href:t==="image"&&l&&l.imageSrcSet?void 0:e,as:t},l),on.set(s,e),i.querySelector(o)!==null||t==="style"&&i.querySelector(ba(s))||t==="script"&&i.querySelector(Sa(s))||(t=i.createElement("link"),xt(t,"link",e),ht(t),i.head.appendChild(t)))}}function av(e,t){Gn.m(e,t);var l=xi;if(l&&e){var i=t&&typeof t.as=="string"?t.as:"script",o=\'link[rel="modulepreload"][as="\'+Pt(i)+\'"][href="\'+Pt(e)+\'"]\',s=o;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":s=ki(e)}if(!on.has(s)&&(e=g({rel:"modulepreload",href:e},t),on.set(s,e),l.querySelector(o)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(l.querySelector(Sa(s)))return}i=l.createElement("link"),xt(i,"link",e),ht(i),l.head.appendChild(i)}}}function rv(e,t,l){Gn.S(e,t,l);var i=xi;if(i&&e){var o=Xl(i).hoistableStyles,s=Ei(e);t=t||"default";var y=o.get(s);if(!y){var S={loading:0,preload:null};if(y=i.querySelector(ba(s)))S.loading=5;else{e=g({rel:"stylesheet",href:e,"data-precedence":t},l),(l=on.get(s))&&_c(e,l);var A=y=i.createElement("link");ht(A),xt(A,"link",e),A._p=new Promise(function(R,Y){A.onload=R,A.onerror=Y}),A.addEventListener("load",function(){S.loading|=1}),A.addEventListener("error",function(){S.loading|=2}),S.loading|=4,Xr(y,t,i)}y={type:"stylesheet",instance:y,count:1,state:S},o.set(s,y)}}}function uv(e,t){Gn.X(e,t);var l=xi;if(l&&e){var i=Xl(l).hoistableScripts,o=ki(e),s=i.get(o);s||(s=l.querySelector(Sa(o)),s||(e=g({src:e,async:!0},t),(t=on.get(o))&&Oc(e,t),s=l.createElement("script"),ht(s),xt(s,"link",e),l.head.appendChild(s)),s={type:"script",instance:s,count:1,state:null},i.set(o,s))}}function ov(e,t){Gn.M(e,t);var l=xi;if(l&&e){var i=Xl(l).hoistableScripts,o=ki(e),s=i.get(o);s||(s=l.querySelector(Sa(o)),s||(e=g({src:e,async:!0,type:"module"},t),(t=on.get(o))&&Oc(e,t),s=l.createElement("script"),ht(s),xt(s,"link",e),l.head.appendChild(s)),s={type:"script",instance:s,count:1,state:null},i.set(o,s))}}function Ap(e,t,l,i){var o=(o=F.current)?Gr(o):null;if(!o)throw Error(u(446));switch(e){case"meta":case"title":return null;case"style":return typeof l.precedence=="string"&&typeof l.href=="string"?(t=Ei(l.href),l=Xl(o).hoistableStyles,i=l.get(t),i||(i={type:"style",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(l.rel==="stylesheet"&&typeof l.href=="string"&&typeof l.precedence=="string"){e=Ei(l.href);var s=Xl(o).hoistableStyles,y=s.get(e);if(y||(o=o.ownerDocument||o,y={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},s.set(e,y),(s=o.querySelector(ba(e)))&&!s._p&&(y.instance=s,y.state.loading=5),on.has(e)||(l={rel:"preload",as:"style",href:l.href,crossOrigin:l.crossOrigin,integrity:l.integrity,media:l.media,hrefLang:l.hrefLang,referrerPolicy:l.referrerPolicy},on.set(e,l),s||cv(o,e,l,y.state))),t&&i===null)throw Error(u(528,""));return y}if(t&&i!==null)throw Error(u(529,""));return null;case"script":return t=l.async,l=l.src,typeof l=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=ki(l),l=Xl(o).hoistableScripts,i=l.get(t),i||(i={type:"script",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(u(444,e))}}function Ei(e){return\'href="\'+Pt(e)+\'"\'}function ba(e){return\'link[rel="stylesheet"][\'+e+"]"}function wp(e){return g({},e,{"data-precedence":e.precedence,precedence:null})}function cv(e,t,l,i){e.querySelector(\'link[rel="preload"][as="style"][\'+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),xt(t,"link",l),ht(t),e.head.appendChild(t))}function ki(e){return\'[src="\'+Pt(e)+\'"]\'}function Sa(e){return"script[async]"+e}function Tp(e,t,l){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector(\'style[data-href~="\'+Pt(l.href)+\'"]\');if(i)return t.instance=i,ht(i),i;var o=g({},l,{"data-href":l.href,"data-precedence":l.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),ht(i),xt(i,"style",o),Xr(i,l.precedence,e),t.instance=i;case"stylesheet":o=Ei(l.href);var s=e.querySelector(ba(o));if(s)return t.state.loading|=4,t.instance=s,ht(s),s;i=wp(l),(o=on.get(o))&&_c(i,o),s=(e.ownerDocument||e).createElement("link"),ht(s);var y=s;return y._p=new Promise(function(S,A){y.onload=S,y.onerror=A}),xt(s,"link",i),t.state.loading|=4,Xr(s,l.precedence,e),t.instance=s;case"script":return s=ki(l.src),(o=e.querySelector(Sa(s)))?(t.instance=o,ht(o),o):(i=l,(o=on.get(s))&&(i=g({},l),Oc(i,o)),e=e.ownerDocument||e,o=e.createElement("script"),ht(o),xt(o,"link",i),e.head.appendChild(o),t.instance=o);case"void":return null;default:throw Error(u(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,Xr(i,l.precedence,e));return t.instance}function Xr(e,t,l){for(var i=l.querySelectorAll(\'link[rel="stylesheet"][data-precedence],style[data-precedence]\'),o=i.length?i[i.length-1]:null,s=o,y=0;y<i.length;y++){var S=i[y];if(S.dataset.precedence===t)s=S;else if(s!==o)break}s?s.parentNode.insertBefore(e,s.nextSibling):(t=l.nodeType===9?l.head:l,t.insertBefore(e,t.firstChild))}function _c(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function Oc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Qr=null;function Cp(e,t,l){if(Qr===null){var i=new Map,o=Qr=new Map;o.set(l,i)}else o=Qr,i=o.get(l),i||(i=new Map,o.set(l,i));if(i.has(e))return i;for(i.set(e,null),l=l.getElementsByTagName(e),o=0;o<l.length;o++){var s=l[o];if(!(s[Ui]||s[yt]||e==="link"&&s.getAttribute("rel")==="stylesheet")&&s.namespaceURI!=="http://www.w3.org/2000/svg"){var y=s.getAttribute(t)||"";y=e+y;var S=i.get(y);S?S.push(s):i.set(y,[s])}}return i}function zp(e,t,l){e=e.ownerDocument||e,e.head.insertBefore(l,t==="title"?e.querySelector("head > title"):null)}function sv(e,t,l){if(l===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function _p(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function fv(e,t,l,i){if(l.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(l.state.loading&4)===0){if(l.instance===null){var o=Ei(i.href),s=t.querySelector(ba(o));if(s){t=s._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Ir.bind(e),t.then(e,e)),l.state.loading|=4,l.instance=s,ht(s);return}s=t.ownerDocument||t,i=wp(i),(o=on.get(o))&&_c(i,o),s=s.createElement("link"),ht(s);var y=s;y._p=new Promise(function(S,A){y.onload=S,y.onerror=A}),xt(s,"link",i),l.instance=s}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(l,t),(t=l.state.preload)&&(l.state.loading&3)===0&&(e.count++,l=Ir.bind(e),t.addEventListener("load",l),t.addEventListener("error",l))}}var Dc=0;function dv(e,t){return e.stylesheets&&e.count===0&&Fr(e,e.stylesheets),0<e.count||0<e.imgCount?function(l){var i=setTimeout(function(){if(e.stylesheets&&Fr(e,e.stylesheets),e.unsuspend){var s=e.unsuspend;e.unsuspend=null,s()}},6e4+t);0<e.imgBytes&&Dc===0&&(Dc=62500*I1());var o=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Fr(e,e.stylesheets),e.unsuspend)){var s=e.unsuspend;e.unsuspend=null,s()}},(e.imgBytes>Dc?50:800)+t);return e.unsuspend=l,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(o)}}:null}function Ir(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Fr(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Zr=null;function Fr(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Zr=new Map,t.forEach(hv,e),Zr=null,Ir.call(e))}function hv(e,t){if(!(t.state.loading&4)){var l=Zr.get(e);if(l)var i=l.get(null);else{l=new Map,Zr.set(e,l);for(var o=e.querySelectorAll("link[data-precedence],style[data-precedence]"),s=0;s<o.length;s++){var y=o[s];(y.nodeName==="LINK"||y.getAttribute("media")!=="not all")&&(l.set(y.dataset.precedence,y),i=y)}i&&l.set(null,i)}o=t.instance,y=o.getAttribute("data-precedence"),s=l.get(y)||i,s===i&&l.set(null,o),l.set(y,o),this.count++,i=Ir.bind(this),o.addEventListener("load",i),o.addEventListener("error",i),s?s.parentNode.insertBefore(o,s.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(o,e.firstChild)),t.state.loading|=4}}var xa={$$typeof:V,Provider:null,Consumer:null,_currentValue:ce,_currentValue2:ce,_threadCount:0};function pv(e,t,l,i,o,s,y,S,A){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=wu(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=wu(0),this.hiddenUpdates=wu(null),this.identifierPrefix=i,this.onUncaughtError=o,this.onCaughtError=s,this.onRecoverableError=y,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=A,this.incompleteTransitions=new Map}function Op(e,t,l,i,o,s,y,S,A,R,Y,I){return e=new pv(e,t,l,y,A,R,Y,I,S),t=1,s===!0&&(t|=24),s=Xt(3,null,null,t),e.current=s,s.stateNode=e,t=co(),t.refCount++,e.pooledCache=t,t.refCount++,s.memoizedState={element:i,isDehydrated:l,cache:t},po(s),e}function Dp(e){return e?(e=ei,e):ei}function Mp(e,t,l,i,o,s){o=Dp(o),i.context===null?i.context=o:i.pendingContext=o,i=el(t),i.payload={element:l},s=s===void 0?null:s,s!==null&&(i.callback=s),l=tl(e,i,t),l!==null&&(Ht(l,e,t),Pi(l,e,t))}function Rp(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var l=e.retryLane;e.retryLane=l!==0&&l<t?l:t}}function Mc(e,t){Rp(e,t),(e=e.alternate)&&Rp(e,t)}function Np(e){if(e.tag===13||e.tag===31){var t=Al(e,67108864);t!==null&&Ht(t,e,67108864),Mc(e,67108864)}}function Lp(e){if(e.tag===13||e.tag===31){var t=Kt();t=Tu(t);var l=Al(e,t);l!==null&&Ht(l,e,t),Mc(e,t)}}var Kr=!0;function mv(e,t,l,i){var o=D.T;D.T=null;var s=Z.p;try{Z.p=2,Rc(e,t,l,i)}finally{Z.p=s,D.T=o}}function gv(e,t,l,i){var o=D.T;D.T=null;var s=Z.p;try{Z.p=8,Rc(e,t,l,i)}finally{Z.p=s,D.T=o}}function Rc(e,t,l,i){if(Kr){var o=Nc(i);if(o===null)bc(e,t,i,Jr,l),jp(e,i);else if(vv(o,e,t,l,i))i.stopPropagation();else if(jp(e,i),t&4&&-1<yv.indexOf(e)){for(;o!==null;){var s=Gl(o);if(s!==null)switch(s.tag){case 3:if(s=s.stateNode,s.current.memoizedState.isDehydrated){var y=bl(s.pendingLanes);if(y!==0){var S=s;for(S.pendingLanes|=2,S.entangledLanes|=2;y;){var A=1<<31-Fe(y);S.entanglements[1]|=A,y&=~A}bn(s),(He&6)===0&&(Mr=Ct()+500,ma(0))}}break;case 31:case 13:S=Al(s,2),S!==null&&Ht(S,s,2),Nr(),Mc(s,2)}if(s=Nc(i),s===null&&bc(e,t,i,Jr,l),s===o)break;o=s}o!==null&&i.stopPropagation()}else bc(e,t,i,null,l)}}function Nc(e){return e=Lu(e),Lc(e)}var Jr=null;function Lc(e){if(Jr=null,e=Vl(e),e!==null){var t=f(e);if(t===null)e=null;else{var l=t.tag;if(l===13){if(e=d(t),e!==null)return e;e=null}else if(l===31){if(e=h(t),e!==null)return e;e=null}else if(l===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Jr=e,null}function Up(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(Au()){case X:return 2;case te:return 8;case ye:case Ce:return 32;case qe:return 268435456;default:return 32}default:return 32}}var Uc=!1,dl=null,hl=null,pl=null,Ea=new Map,ka=new Map,ml=[],yv="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function jp(e,t){switch(e){case"focusin":case"focusout":dl=null;break;case"dragenter":case"dragleave":hl=null;break;case"mouseover":case"mouseout":pl=null;break;case"pointerover":case"pointerout":Ea.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":ka.delete(t.pointerId)}}function Aa(e,t,l,i,o,s){return e===null||e.nativeEvent!==s?(e={blockedOn:t,domEventName:l,eventSystemFlags:i,nativeEvent:s,targetContainers:[o]},t!==null&&(t=Gl(t),t!==null&&Np(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function vv(e,t,l,i,o){switch(t){case"focusin":return dl=Aa(dl,e,t,l,i,o),!0;case"dragenter":return hl=Aa(hl,e,t,l,i,o),!0;case"mouseover":return pl=Aa(pl,e,t,l,i,o),!0;case"pointerover":var s=o.pointerId;return Ea.set(s,Aa(Ea.get(s)||null,e,t,l,i,o)),!0;case"gotpointercapture":return s=o.pointerId,ka.set(s,Aa(ka.get(s)||null,e,t,l,i,o)),!0}return!1}function Bp(e){var t=Vl(e.target);if(t!==null){var l=f(t);if(l!==null){if(t=l.tag,t===13){if(t=d(l),t!==null){e.blockedOn=t,Ws(e.priority,function(){Lp(l)});return}}else if(t===31){if(t=h(l),t!==null){e.blockedOn=t,Ws(e.priority,function(){Lp(l)});return}}else if(t===3&&l.stateNode.current.memoizedState.isDehydrated){e.blockedOn=l.tag===3?l.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Wr(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var l=Nc(e.nativeEvent);if(l===null){l=e.nativeEvent;var i=new l.constructor(l.type,l);Nu=i,l.target.dispatchEvent(i),Nu=null}else return t=Gl(l),t!==null&&Np(t),e.blockedOn=l,!1;t.shift()}return!0}function Hp(e,t,l){Wr(e)&&l.delete(t)}function bv(){Uc=!1,dl!==null&&Wr(dl)&&(dl=null),hl!==null&&Wr(hl)&&(hl=null),pl!==null&&Wr(pl)&&(pl=null),Ea.forEach(Hp),ka.forEach(Hp)}function $r(e,t){e.blockedOn===t&&(e.blockedOn=null,Uc||(Uc=!0,n.unstable_scheduleCallback(n.unstable_NormalPriority,bv)))}var Pr=null;function qp(e){Pr!==e&&(Pr=e,n.unstable_scheduleCallback(n.unstable_NormalPriority,function(){Pr===e&&(Pr=null);for(var t=0;t<e.length;t+=3){var l=e[t],i=e[t+1],o=e[t+2];if(typeof i!="function"){if(Lc(i||l)===null)continue;break}var s=Gl(l);s!==null&&(e.splice(t,3),t-=3,No(s,{pending:!0,data:o,method:l.method,action:i},i,o))}}))}function Ai(e){function t(A){return $r(A,e)}dl!==null&&$r(dl,e),hl!==null&&$r(hl,e),pl!==null&&$r(pl,e),Ea.forEach(t),ka.forEach(t);for(var l=0;l<ml.length;l++){var i=ml[l];i.blockedOn===e&&(i.blockedOn=null)}for(;0<ml.length&&(l=ml[0],l.blockedOn===null);)Bp(l),l.blockedOn===null&&ml.shift();if(l=(e.ownerDocument||e).$$reactFormReplay,l!=null)for(i=0;i<l.length;i+=3){var o=l[i],s=l[i+1],y=o[Rt]||null;if(typeof s=="function")y||qp(l);else if(y){var S=null;if(s&&s.hasAttribute("formAction")){if(o=s,y=s[Rt]||null)S=y.formAction;else if(Lc(o)!==null)continue}else S=y.action;typeof S=="function"?l[i+1]=S:(l.splice(i,3),i-=3),qp(l)}}}function Yp(){function e(s){s.canIntercept&&s.info==="react-transition"&&s.intercept({handler:function(){return new Promise(function(y){return o=y})},focusReset:"manual",scroll:"manual"})}function t(){o!==null&&(o(),o=null),i||setTimeout(l,20)}function l(){if(!i&&!navigation.transition){var s=navigation.currentEntry;s&&s.url!=null&&navigation.navigate(s.url,{state:s.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,o=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(l,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),o!==null&&(o(),o=null)}}}function jc(e){this._internalRoot=e}eu.prototype.render=jc.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(u(409));var l=t.current,i=Kt();Mp(l,i,e,t,null,null)},eu.prototype.unmount=jc.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Mp(e.current,2,null,e,null,null),Nr(),t[Yl]=null}};function eu(e){this._internalRoot=e}eu.prototype.unstable_scheduleHydration=function(e){if(e){var t=Js();e={blockedOn:null,target:e,priority:t};for(var l=0;l<ml.length&&t!==0&&t<ml[l].priority;l++);ml.splice(l,0,e),l===0&&Bp(e)}};var Vp=a.version;if(Vp!=="19.2.6")throw Error(u(527,Vp,"19.2.6"));Z.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(u(188)):(e=Object.keys(e).join(","),Error(u(268,e)));return e=p(t),e=e!==null?v(e):null,e=e===null?null:e.stateNode,e};var Sv={bundleType:0,version:"19.2.6",rendererPackageName:"react-dom",currentDispatcherRef:D,reconcilerVersion:"19.2.6"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var tu=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!tu.isDisabled&&tu.supportsFiber)try{zt=tu.inject(Sv),ft=tu}catch{}}return Ta.createRoot=function(e,t){if(!c(e))throw Error(u(299));var l=!1,i="",o=Kd,s=Jd,y=Wd;return t!=null&&(t.unstable_strictMode===!0&&(l=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(s=t.onCaughtError),t.onRecoverableError!==void 0&&(y=t.onRecoverableError)),t=Op(e,1,!1,null,null,l,i,null,o,s,y,Yp),e[Yl]=t.current,vc(e),new jc(t)},Ta.hydrateRoot=function(e,t,l){if(!c(e))throw Error(u(299));var i=!1,o="",s=Kd,y=Jd,S=Wd,A=null;return l!=null&&(l.unstable_strictMode===!0&&(i=!0),l.identifierPrefix!==void 0&&(o=l.identifierPrefix),l.onUncaughtError!==void 0&&(s=l.onUncaughtError),l.onCaughtError!==void 0&&(y=l.onCaughtError),l.onRecoverableError!==void 0&&(S=l.onRecoverableError),l.formState!==void 0&&(A=l.formState)),t=Op(e,1,!0,t,l??null,i,o,A,s,y,S,Yp),t.context=Dp(null),l=t.current,i=Kt(),i=Tu(i),o=el(i),o.callback=null,tl(l,o,i),l=i,t.current.lanes=l,Li(t,l),bn(t),e[Yl]=t.current,vc(e),new eu(t)},Ta.version="19.2.6",Ta}var $p;function Ov(){if($p)return qc.exports;$p=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),qc.exports=_v(),qc.exports}var Dv=Ov();function Mv(){return J.jsxs("main",{className:"duplicate-page",children:[J.jsxs("svg",{width:"48",height:"48",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:[J.jsx("circle",{cx:"12",cy:"12",r:"10"}),J.jsx("path",{d:"m4.9 4.9 14.2 14.2"})]}),J.jsx("h1",{children:"Session unavailable"}),J.jsx("p",{children:"Another browser window is already connected to this Voice Agent. Close the other session and refresh this page."})]})}const Pp=n=>Symbol.iterator in n,em=n=>"entries"in n,tm=(n,a)=>{const r=n instanceof Map?n:new Map(n.entries()),u=a instanceof Map?a:new Map(a.entries());if(r.size!==u.size)return!1;for(const[c,f]of r)if(!u.has(c)||!Object.is(f,u.get(c)))return!1;return!0},Rv=(n,a)=>{const r=n[Symbol.iterator](),u=a[Symbol.iterator]();let c=r.next(),f=u.next();for(;!c.done&&!f.done;){if(!Object.is(c.value,f.value))return!1;c=r.next(),f=u.next()}return!!c.done&&!!f.done};function Nv(n,a){return Object.is(n,a)?!0:typeof n!="object"||n===null||typeof a!="object"||a===null||Object.getPrototypeOf(n)!==Object.getPrototypeOf(a)?!1:Pp(n)&&Pp(a)?em(n)&&em(a)?tm(n,a):Rv(n,a):tm({entries:()=>Object.entries(n)},{entries:()=>Object.entries(a)})}function Ts(n){const a=Da.useRef(void 0);return r=>{const u=n(r);return Nv(a.current,u)?a.current:a.current=u}}const nm=n=>{let a;const r=new Set,u=(p,v)=>{const g=typeof p=="function"?p(a):p;if(!Object.is(g,a)){const x=a;a=v??(typeof g!="object"||g===null)?g:Object.assign({},a,g),r.forEach(E=>E(a,x))}},c=()=>a,h={setState:u,getState:c,getInitialState:()=>m,subscribe:p=>(r.add(p),()=>r.delete(p))},m=a=n(u,c,h);return h},Lv=(n=>n?nm(n):nm),Uv=n=>n;function jv(n,a=Uv){const r=Da.useSyncExternalStore(n.subscribe,Da.useCallback(()=>a(n.getState()),[n,a]),Da.useCallback(()=>a(n.getInitialState()),[n,a]));return Da.useDebugValue(r),r}const Bv=(n,a)=>(r,u,c)=>(c.dispatch=f=>(r(d=>n(d,f),!1,f),f),c.dispatchFromDevtools=!0,{dispatch:(...f)=>c.dispatch(...f),...a}),Hv=Bv;function qv(n,a){let r;try{r=n()}catch{return}return{getItem:c=>{var f;const d=m=>m===null?null:JSON.parse(m,void 0),h=(f=r.getItem(c))!=null?f:null;return h instanceof Promise?h.then(d):d(h)},setItem:(c,f)=>r.setItem(c,JSON.stringify(f,void 0)),removeItem:c=>r.removeItem(c)}}const cs=n=>a=>{try{const r=n(a);return r instanceof Promise?r:{then(u){return cs(u)(r)},catch(u){return this}}}catch(r){return{then(u){return this},catch(u){return cs(u)(r)}}}},Yv=(n,a)=>(r,u,c)=>{let f={storage:qv(()=>window.localStorage),partialize:B=>B,version:0,merge:(B,O)=>({...O,...B}),...a},d=!1,h=0;const m=new Set,p=new Set;let v=f.storage;if(!v)return n((...B)=>{console.warn(`[zustand persist middleware] Unable to update item \'${f.name}\', the given storage is currently unavailable.`),r(...B)},u,c);const g=()=>{const B=f.partialize({...u()});return v.setItem(f.name,{state:B,version:f.version})},x=c.setState;c.setState=(B,O)=>(x(B,O),g());const E=n((...B)=>(r(...B),g()),u,c);c.getInitialState=()=>E;let C;const H=()=>{var B,O;if(!v)return;const K=++h;d=!1,m.forEach(le=>{var ue;return le((ue=u())!=null?ue:E)});const V=((O=f.onRehydrateStorage)==null?void 0:O.call(f,(B=u())!=null?B:E))||void 0;return cs(v.getItem.bind(v))(f.name).then(le=>{if(le)if(typeof le.version=="number"&&le.version!==f.version){if(f.migrate){const ue=f.migrate(le.state,le.version);return ue instanceof Promise?ue.then(L=>[!0,L]):[!0,ue]}console.error("State loaded from storage couldn\'t be migrated since no migrate function was provided")}else return[!1,le.state];return[!1,void 0]}).then(le=>{var ue;if(K!==h)return;const[L,P]=le;if(C=f.merge(P,(ue=u())!=null?ue:E),r(C,!0),L)return g()}).then(()=>{K===h&&(V?.(u(),void 0),C=u(),d=!0,p.forEach(le=>le(C)))}).catch(le=>{K===h&&V?.(void 0,le)})};return c.persist={setOptions:B=>{f={...f,...B},B.storage&&(v=B.storage)},clearStorage:()=>{v?.removeItem(f.name)},getOptions:()=>f,rehydrate:()=>H(),hasHydrated:()=>d,onHydrate:B=>(m.add(B),()=>{m.delete(B)}),onFinishHydration:B=>(p.add(B),()=>{p.delete(B)})},f.skipHydration||H(),C||E},Vv=Yv,Gv={permission:"unknown",devices:[],selectedDeviceId:null,ready:!1,autoplayAllowed:null,pendingSessionStart:!1};function Xv(n,a){switch(a.type){case"browser/autoplay/probed":return{...n,autoplayAllowed:a.allowed,pendingSessionStart:!1};case"browser/devices/enumerated":return{...n,devices:a.devices};case"host/browser-audio/device-change":return{...n,devices:a.devices,selectedDeviceId:a.selectedDeviceId};case"ui/select/mic-device":return n.selectedDeviceId===a.deviceId?n:{...n,selectedDeviceId:a.deviceId};case"browser/permission/granted":return{...n,permission:"granted",ready:!0};case"browser/permission/denied":return{...n,permission:"denied"};case"browser/mic/stream-failed":return{...n,permission:"denied",ready:!1};case"host/voice/session/start":return n.autoplayAllowed===!0||n.pendingSessionStart?n:{...n,pendingSessionStart:!0};case"voice/session/in-flight":return!a.inFlight||!n.pendingSessionStart?n:{...n,pendingSessionStart:!1};default:return n}}const Qv={status:"connecting",reconnectMs:250};function Iv(n,a){switch(a.type){case"connection/status":return n.status===a.status?n:{...n,status:a.status};default:return n}}const Zv={status:"starting",conversation:null,instructions:void 0,streamDrafts:new Map,atBottom:!0,previousConversationId:null};function Fv(n,a){switch(a.type){case"host/state":{const r=a.data.conversation??null,u=r?.status??n.status,c=r?.id??null;return c!==n.previousConversationId?{...n,status:u,conversation:r,instructions:a.data.instructions,streamDrafts:new Map,atBottom:!0,previousConversationId:c}:{...n,status:u,conversation:r,instructions:a.data.instructions}}case"host/transcript/delta":{const r=new Map(n.streamDrafts);return r.set(a.delta.itemId,a.delta),{...n,streamDrafts:r}}case"ui/scroll/transcript":return n.atBottom===a.atBottom?n:{...n,atBottom:a.atBottom};default:return n}}const Kv={injectedVersion:null};function Jv(n,a){switch(a.type){case"host/state":{const r=a.data.injectedVersion??null;return r===n.injectedVersion?n:{...n,injectedVersion:r}}case"host/stage":{const r=a.data.injectedVersion;return r===n.injectedVersion?n:{...n,injectedVersion:r}}default:return n}}const Wv={modal:"none",moreActionsOpen:!1,duplicateClient:!1};function $v(n,a){switch(a.type){case"ui/click/transcript":return{...n,modal:"transcript",moreActionsOpen:!1};case"ui/click/instructions":return{...n,modal:"instructions",moreActionsOpen:!1};case"ui/click/modal-backdrop":case"ui/click/modal-close":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/key/escape":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/click/more-actions":return{...n,moreActionsOpen:!n.moreActionsOpen};case"host/duplicate-client":return n.duplicateClient?n:{...n,duplicateClient:!0};default:return n}}const Pv={xaiOpen:!1,xaiStatus:"disconnected",connectedSent:!1,sessionInFlight:!1,paused:!1,responseActive:!1,speakingItemId:null,pendingUserItemId:null,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};function e0(n,a){switch(a.type){case"xai/ws/connecting":return n.xaiStatus==="connecting"?n:{...n,xaiStatus:"connecting"};case"xai/ws/open":return{...n,xaiOpen:!0,xaiStatus:"connected"};case"xai/ws/error":return n.xaiStatus==="error"?n:{...n,xaiStatus:"error"};case"xai/ws/close":return{...n,xaiOpen:!1,xaiStatus:"disconnected",responseActive:!1,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1,pendingUserItemId:null};case"xai/response/created":return{...n,responseActive:!0,speakingItemId:null};case"xai/response/done":case"xai/response/failed":return{...n,responseActive:!1,pendingUserItemId:null};case"xai/response/cancelled":return{...n,responseActive:!1,speakingItemId:null};case"xai/input-audio-buffer/speech-started":return{...n,speakingItemId:a.itemId||null,pendingUserItemId:a.itemId||n.pendingUserItemId};case"xai/input-audio-buffer/speech-stopped":case"xai/conversation/item/added":return n.speakingItemId===null?n:{...n,speakingItemId:null};case"xai/response/output-item/added":return{...n,speakingItemId:a.itemId};case"voice/session/in-flight":return n.sessionInFlight===a.inFlight?n:{...n,sessionInFlight:a.inFlight};case"voice/paused":return n.paused===a.paused?n:{...n,paused:a.paused};case"voice/playback/cursor":return{...n,nextPlaybackTime:a.nextPlaybackTime,playbackEndsAt:a.playbackEndsAt};case"voice/playback/cut":return{...n,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};case"host/voice/send":return a.gate!=="playback-drained"?n:{...n,deferredSendsPending:!0};case"voice/playback/drained":return n.deferredSendsPending?{...n,deferredSendsPending:!1}:n;default:return n}}const t0={connection:Qv,conversation:Zv,audio:Gv,voice:Pv,ui:Wv,stage:Kv};function n0(n,a){const r=Iv(n.connection,a),u=Fv(n.conversation,a),c=Xv(n.audio,a),f=e0(n.voice,a),d=$v(n.ui,a),h=Jv(n.stage,a);return r===n.connection&&u===n.conversation&&c===n.audio&&f===n.voice&&d===n.ui&&h===n.stage?n:{connection:r,conversation:u,audio:c,voice:f,ui:d,stage:h}}const Cs=Lv(Vv(Hv(n0,t0),{name:"voice:audio",partialize:n=>({audio:{selectedDeviceId:n.audio.selectedDeviceId}}),merge:(n,a)=>{const u=n?.audio?.selectedDeviceId??a.audio.selectedDeviceId;return{...a,audio:{...a.audio,selectedDeviceId:u}}}}));function ss(){return Cs.getState()}function At(n){return jv(Cs,n)}const ou=[],lm=[];let Xc=!1;function kt(n){if(Xc){lm.push(n);return}Xc=!0;try{let a=n;for(;a!==void 0;){Cs.dispatch(a);for(const r of ou)r(a);a=lm.shift()}}finally{Xc=!1}}function ng(n){return ou.push(n),()=>{const a=ou.indexOf(n);a!==-1&&ou.splice(a,1)}}let zi,Bl;async function l0(){return navigator.mediaDevices?.enumerateDevices?(await navigator.mediaDevices.enumerateDevices()).filter(a=>a.kind==="audioinput").map(a=>({deviceId:a.deviceId,label:a.label||"Microphone",groupId:a.groupId})):[]}function Qc(n,a){if(zi&&Bl&&zi.removeEventListener("ended",Bl),zi=n,Bl=void 0,!n)return;const r=()=>{a({type:"browser/mic/track-ended"})};Bl=r,n.addEventListener("ended",r)}function i0({dispatch:n}){const a=()=>{l0().then(r=>{n({type:"browser/devices/enumerated",devices:r})}).catch(r=>{n({type:"browser/window/error",message:`devicechange enumerate failed: ${String(r instanceof Error?r.message:r)}`})})};return navigator.mediaDevices?.addEventListener?.("devicechange",a),()=>{navigator.mediaDevices?.removeEventListener?.("devicechange",a),zi&&Bl&&zi.removeEventListener("ended",Bl),zi=void 0,Bl=void 0}}let xn,nu=250;const fs=[],a0=new Set(["xai/response/output-audio/delta"]);let ds;function r0(){return`${location.protocol==="https:"?"wss:":"ws:"}//${location.host}/ws`}function Ot(n,a){const r=JSON.stringify({type:n,data:a});if(n==="browser.debug"){xn&&xn.readyState===WebSocket.OPEN?xn.send(r):fs.push(r);return}xn&&xn.readyState===WebSocket.OPEN&&xn.send(r)}function u0(n){switch(n.type){case"duplicate.client":return[{type:"host/duplicate-client"}];case"state":return[{type:"host/state",data:n.data}];case"transcript.item":return[{type:"host/transcript/item",item:n.data}];case"transcript.delta":return[{type:"host/transcript/delta",delta:n.data}];case"browser.audio.deviceChange":return[{type:"host/browser-audio/device-change",devices:n.data.devices.map(a=>({deviceId:a.deviceId,label:a.label,groupId:a.groupId})),selectedDeviceId:n.data.selectedDeviceId??null}];case"voice.session.start":return[{type:"host/voice/session/start"}];case"voice.session.token":return[{type:"host/voice/session/token",token:n.data}];case"voice.session.close":return[{type:"host/voice/session/close",code:n.data.code,reason:n.data.reason}];case"voice.send":return[{type:"host/voice/send",event:n.data.event,gate:n.data.gate}];case"stage.injected":return[{type:"host/stage",data:n.data}];case"wait_for_context.start":return[{type:"host/wait-for-context/start"}];case"wait_for_context.end":return[{type:"host/wait-for-context/end"}];case"audio.output.delta":return[];case"error":return[];default:return[]}}function o0({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,c;const f=()=>{n({type:"connection/status",status:"connecting"});const h=new WebSocket(r0());xn=h,h.addEventListener("open",()=>{nu=250;const m=[];for(const p of fs)try{h.send(p)}catch(v){m.push(String(v instanceof Error?v.message:v))}fs.length=0,n({type:"connection/status",status:"connected"});for(const p of m)n({type:"browser/window/error",message:`debugBuffer.flush.failed: ${p}`})}),h.addEventListener("message",m=>{let p;try{p=JSON.parse(String(m.data))}catch(v){n({type:"browser/window/error",message:`ws.in.parseError: ${String(v instanceof Error?v.message:v)}`});return}for(const v of u0(p))n(v)}),h.addEventListener("close",()=>{xn=void 0,n({type:"connection/status",status:"disconnected"}),!u&&(c=setTimeout(f,nu),nu=Math.min(nu*2,5e3))}),h.addEventListener("error",()=>{n({type:"connection/status",status:"error"})})},d=a(h=>{h.type.startsWith("xai/")&&!h.type.startsWith("xai/ws/")&&ds!==void 0&&Ot("voice.event",{event:ds}),h.type==="ui/click/download-transcript"&&s0(r),a0.has(h.type)||Ot("browser.debug",{label:"action",info:h,t:Date.now()})});return f(),()=>{u=!0,d(),c!==void 0&&clearTimeout(c);try{xn?.close()}catch(h){console.error("hostSocketRunner.teardown.close.failed",h)}xn=void 0}}function c0(n){ds=n}function s0(n){const a=n().conversation.conversation,r=a?.transcript??[];if(r.length===0)return;const u=`${r.map(p=>JSON.stringify(p)).join(`\n`)}\n`,c=new Blob([u],{type:"application/jsonl"}),f=URL.createObjectURL(c),d=document.createElement("a"),h=new Date().toISOString().replace(/[:.]/g,"-"),m=a?.id??"conversation";d.href=f,d.download=`transcript-${m}-${h}.jsonl`,document.body.append(d),d.click(),d.remove(),URL.revokeObjectURL(f)}const cu=new Float32Array(5),f0=`\n  class Pcm16Encoder extends AudioWorkletProcessor {\n    constructor() { super(); this.buf = []; this.target = 4800; }\n    process(inputs) {\n      const ch = inputs[0] && inputs[0][0];\n      if (!ch) return true;\n      this.buf.push(new Float32Array(ch));\n      let total = 0;\n      for (const b of this.buf) total += b.length;\n      while (total >= this.target) {\n        const out = new Int16Array(this.target);\n        let written = 0;\n        while (written < this.target) {\n          const head = this.buf[0];\n          const take = Math.min(head.length, this.target - written);\n          for (let i = 0; i < take; i++) {\n            const s = Math.max(-1, Math.min(1, head[i]));\n            out[written + i] = s < 0 ? s * 0x8000 : s * 0x7fff;\n          }\n          if (take === head.length) this.buf.shift();\n          else this.buf[0] = head.subarray(take);\n          written += take;\n        }\n        total -= this.target;\n        this.port.postMessage(out.buffer, [out.buffer]);\n      }\n      return true;\n    }\n  }\n  registerProcessor("pcm16-encoder", Pcm16Encoder);\n`,d0=50,h0=500,p0=5e3,m0=3,g0=.01;function im(){return{nextPlaybackTime:0,playbackEndsAt:0,scheduledSources:[],pendingSends:[],preOpenAudio:[],deferredSends:[],connectedSent:!1,tokenExpiresAt:0,paused:!1}}function Ye(n){return String(n instanceof Error?n.message:n)}function y0({dispatch:n,subscribeToActions:a,getState:r}){let u=im(),c=!1,f=0,d,h,m=0,p=!1,v,g,x;const E=(b,_,G)=>{Ot("browser.audio.error",{code:b,message:_,suggestedAction:G}),n({type:"browser/mic/stream-failed",error:{code:b,message:_}})},C=b=>{const _={echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0};return b&&(_.deviceId={exact:b}),navigator.mediaDevices.getUserMedia({audio:_})},H=async()=>{if(!navigator.mediaDevices?.getUserMedia)return!1;try{const b=r().audio.selectedDeviceId;let _;try{_=await C(b)}catch(re){if(!b)throw re;_=await C(null)}for(const re of _.getTracks())re.stop();const G=(await navigator.mediaDevices.enumerateDevices()).filter(re=>re.kind==="audioinput").map(re=>({deviceId:re.deviceId,label:re.label||"Microphone",groupId:re.groupId})),F=r().audio.selectedDeviceId,ee=F??G[0]?.deviceId??null;return n({type:"browser/devices/enumerated",devices:G}),ee&&ee!==F&&n({type:"ui/select/mic-device",deviceId:ee}),n({type:"browser/permission/granted"}),Ot("audio.device.state",{permission:"granted",devices:G,selectedDeviceId:ee??void 0,ready:!0}),!0}catch{return E("MICROPHONE_DEVICE_ERROR","Could not access the selected microphone.","Allow microphone access and try again."),n({type:"browser/permission/denied"}),!1}},B=b=>{if(u.analyserCtx)try{u.analyserCtx.close()}catch(re){n({type:"browser/window/error",message:`startMeters.analyserCtx.close.failed: ${Ye(re)}`})}const _=new AudioContext;_.state==="suspended"&&_.resume().catch(re=>{n({type:"browser/window/error",message:`startMeters.audioCtx.resume.failed: ${Ye(re)}`})});const G=_.createAnalyser();if(G.fftSize=256,_.createMediaStreamSource(b).connect(G),u.analyser=G,u.analyserCtx=_,c)return;c=!0;const F=new Uint8Array(G.frequencyBinCount),ee=()=>{const re=u.analyser;if(re){re.getByteFrequencyData(F);for(let de=0;de<cu.length;de+=1)cu[de]=Math.max(.1,(F[de*10]??0)/255)}f=requestAnimationFrame(ee)};ee()},O=b=>{const _=atob(b),G=new Uint8Array(_.length);for(let re=0;re<_.length;re+=1)G[re]=_.charCodeAt(re);const F=new DataView(G.buffer),ee=new Float32Array(G.length/2);for(let re=0;re<ee.length;re+=1){const de=F.getInt16(re*2,!0);ee[re]=de<0?de/32768:de/32767}return ee},K=b=>{let _="";for(let F=0;F<b.length;F+=32768)_+=String.fromCharCode(...b.subarray(F,F+32768));return btoa(_)},V=()=>{const b=u.outputCtx,_=u.playbackEndsAt;return!_||!b?!0:b.currentTime>=_-g0},le=()=>{if(!V()){if(u.deferredSends.length===0)return;const b=u.outputCtx,_=b?Math.max(0,(u.playbackEndsAt-b.currentTime+.015)*1e3):50;h!==void 0&&clearTimeout(h),h=setTimeout(le,_);return}h!==void 0&&(clearTimeout(h),h=void 0),u.deferredSends.length!==0&&n({type:"voice/playback/drained"})},ue=b=>{try{const _=O(b);if(_.length===0)return;let G=u.outputCtx;G||(G=new AudioContext({sampleRate:48e3}),u.outputCtx=G),G.state==="suspended"&&G.resume().catch(Ze=>{n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Ye(Ze)}`})});const F=G.createBuffer(1,_.length,48e3);F.getChannelData(0).set(_);const ee=G.createBufferSource();ee.buffer=F,ee.connect(G.destination);const re=G.currentTime,de=Math.max(re,u.nextPlaybackTime);ee.start(de);const we=de+F.duration;if(u.nextPlaybackTime=we,u.playbackEndsAt=Math.max(u.playbackEndsAt||0,we),u.scheduledSources.push(ee),n({type:"voice/playback/cursor",nextPlaybackTime:u.nextPlaybackTime,playbackEndsAt:u.playbackEndsAt}),ee.addEventListener("ended",()=>{const Ze=u.scheduledSources.indexOf(ee);Ze!==-1&&u.scheduledSources.splice(Ze,1),le()}),u.deferredSends.length>0){const Ze=Math.max(0,(u.playbackEndsAt-G.currentTime+.015)*1e3);h!==void 0&&clearTimeout(h),h=setTimeout(le,Ze)}}catch(_){E("AUDIO_DECODE_FAILED",Ye(_),"Refresh the page; if the problem persists check audio device permissions.")}},L=()=>{for(const b of u.scheduledSources.splice(0)){try{b.stop()}catch{}try{b.disconnect()}catch(_){n({type:"browser/window/error",message:`stopScheduledPlayback.disconnect.failed: ${Ye(_)}`})}}u.nextPlaybackTime=0,u.playbackEndsAt=0},P=async b=>{try{const _=new AudioContext({sampleRate:48e3});u.inputCtx=_,_.state==="suspended"&&_.resume().catch(de=>n({type:"browser/window/error",message:`inputCtx.resume.failed: ${Ye(de)}`}));const G=_.createMediaStreamSource(b);u.micSourceNode=G;const F=new Blob([f0],{type:"application/javascript"}),ee=URL.createObjectURL(F);try{await _.audioWorklet.addModule(ee)}finally{URL.revokeObjectURL(ee)}const re=new AudioWorkletNode(_,"pcm16-encoder");u.workletNode=re,re.port.onmessage=de=>{if(!u.paused)try{const we=K(new Uint8Array(de.data)),Ze=u.xaiWs;Ze&&Ze.readyState===WebSocket.OPEN?Ze.send(JSON.stringify({type:"input_audio_buffer.append",audio:we})):(u.preOpenAudio.push(we),u.preOpenAudio.length>d0&&(u.preOpenAudio.shift(),n({type:"voice/queue/pre-open-cap-hit"})))}catch(we){E("AUDIO_ENCODE_FAILED",Ye(we),"Refresh the page; if the problem persists check microphone permissions.")}},G.connect(re)}catch(_){E("AUDIO_ENCODER_INIT_FAILED",Ye(_),"Try a different browser or device.")}},se=(b,_)=>{Ot("voice.session.failed",{error:{code:b,message:_}}),w()},ge=()=>{n({type:"voice/session/in-flight",inFlight:!0}),Ot("conversation.start"),Ot("voice.session.requested")},U=()=>{const{voice:b,audio:_}=r();_.autoplayAllowed!==null&&(b.sessionInFlight||b.xaiOpen||u.xaiWs||(n({type:"voice/session/in-flight",inFlight:!0}),Ot("voice.session.requested")))},ie=()=>{const{voice:b,audio:_}=r();if(!b.xaiOpen&&!b.sessionInFlight){if(_.autoplayAllowed===null){n({type:"host/voice/session/start"});return}if(_.autoplayAllowed===!1){H().then(G=>{G&&ge()});return}if(!_.ready){H().then(G=>{G&&ge()});return}ge();return}if(b.xaiOpen&&!b.paused){Ot("conversation.pause"),D();return}b.xaiOpen&&b.paused&&(Ot("conversation.resume"),Z())},ne=()=>{if(u.xaiWs)return!1;const{voice:b,audio:_}=r();return b.sessionInFlight&&b.xaiOpen?!1:_.ready?!0:(E("MICROPHONE_NOT_READY","Microphone is not ready.","Grant microphone access and try again."),!1)},be=async b=>{if(!b?.clientSecret||!b?.model){se("VOICE_TOKEN_INVALID","Missing client secret or model.");return}if(!u.xaiWs){if(typeof b.expiresAt=="number"&&Date.now()>b.expiresAt*1e3-p0){if(m+=1,m>m0){m=0,n({type:"connection/status",status:"error"}),n({type:"voice/session/in-flight",inFlight:!1});return}Ot("voice.session.requested");return}if(m=0,u.tokenExpiresAt=b.expiresAt??0,!(!ne()&&!r().voice.sessionInFlight))try{const _=await C(r().audio.selectedDeviceId);u.micStream=_;const G=_.getAudioTracks()[0];u.micTrack=G,Qc(G,n),G&&n({type:"browser/mic/stream-acquired",deviceId:r().audio.selectedDeviceId??"",trackId:G.id}),B(_),u.preOpenAudio=[],await P(_);const F=v0(b.clientSecret,n);n({type:"xai/ws/connecting"});const ee=new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(b.model)}`,[`xai-client-secret.${F}`]);u.xaiWs=ee;let re,de="";ee.addEventListener("open",()=>{n({type:"xai/ws/open"});for(const Te of u.pendingSends)try{ee.send(Te)}catch(Le){n({type:"browser/window/error",message:`xaiWs.send.pending.failed: ${Ye(Le)}`})}u.pendingSends=[];for(const Te of u.preOpenAudio)try{ee.send(JSON.stringify({type:"input_audio_buffer.append",audio:Te}))}catch(Le){n({type:"browser/window/error",message:`xaiWs.send.preOpenAudio.failed: ${Ye(Le)}`})}u.preOpenAudio=[],u.connectedSent||(u.connectedSent=!0,n({type:"voice/session/in-flight",inFlight:!1}),Ot("voice.session.connected"))}),ee.addEventListener("message",Te=>{let Le;try{Le=JSON.parse(String(Te.data))}catch(Ue){n({type:"browser/window/error",message:`xaiWs.in.parseError: ${Ye(Ue)}`});return}if(Le?.type==="ping"){try{const Ue=typeof Le.event_id=="string"?Le.event_id:void 0;ee.send(JSON.stringify(Ue?{type:"pong",event_id:Ue}:{type:"pong"}))}catch(Ue){n({type:"browser/window/error",message:`xaiWs.send.pong.failed: ${Ye(Ue)}`})}return}c0(Le),b0(Le,n),Le?.type==="response.output_audio.delta"&&typeof Le.delta=="string"&&!u.paused&&ue(Le.delta)});const we=Te=>{re=Te.code,de=Te.reason,n({type:"xai/ws/close",code:Te.code,reason:Te.reason}),u.connectedSent?(Ot("voice.session.failed",{error:{code:"VOICE_WS_CLOSED",message:`xAI WS closed: code=${Te.code}`}}),w()):se("VOICE_WS_REJECTED",`xAI WS closed before open: code=${Te.code} reason=${Te.reason}`)},Ze=()=>{if(n({type:"xai/ws/error"}),!u.connectedSent){const Te=re!==void 0?` WS close code=${re}${de?` reason="${de}"`:""}.`:" No close frame received before error.";se("VOICE_WS_REJECTED",`xAI WebSocket handshake failed. Attempted: wss://api.x.ai/v1/realtime with subprotocol prefix "xai-client-secret" (token not logged).${Te} Possible causes: CORS policy, invalid/expired token, wrong subprotocol format, or origin not allowlisted.`)}};ee.addEventListener("close",we),ee.addEventListener("error",Ze),x=()=>{ee.removeEventListener("close",we),ee.removeEventListener("error",Ze)}}catch(_){se("VOICE_SETUP_FAILED",Ye(_))}}},ae=(b,_)=>{if(!b)return;if(_==="playback-drained"&&!V()){u.deferredSends.push(b);return}const G=JSON.stringify(b),F=u.xaiWs;if(F&&r().voice.xaiOpen){try{F.send(G)}catch(ee){n({type:"browser/window/error",message:`xaiWs.send.failed.requeue: ${Ye(ee)}`}),u.pendingSends.push(G)}return}u.pendingSends.push(G)},$=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),u.outputCtx?.state==="running"&&u.outputCtx.suspend().catch(b=>n({type:"browser/window/error",message:`outputCtx.suspend.failed: ${Ye(b)}`})),u.xaiWs&&r().voice.xaiOpen&&r().voice.responseActive)try{u.xaiWs.send(JSON.stringify({type:"response.cancel"}))}catch(b){n({type:"browser/window/error",message:`xaiWs.send.responseCancel.failed: ${Ye(b)}`})}},D=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),n({type:"voice/paused",paused:!0}),r().voice.responseActive){d!==void 0&&clearTimeout(d),d=setTimeout(()=>{d!==void 0&&(d=void 0,$())},h0);return}$()},Z=()=>{d!==void 0&&(clearTimeout(d),d=void 0),u.paused=!1,u.micTrack&&(u.micTrack.enabled=!0),u.outputCtx?.state==="suspended"&&u.outputCtx.resume().catch(b=>n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Ye(b)}`})),n({type:"voice/paused",paused:!1})},ce=async b=>{if(Ot("audio.device.select",{deviceId:b}),!!u.xaiWs)try{const _=await C(b);if(u.workletNode){try{u.workletNode.port.onmessage=null,u.workletNode.disconnect()}catch(G){n({type:"browser/window/error",message:`switchMic.worklet.disconnect.failed: ${Ye(G)}`})}u.workletNode=void 0}if(u.micSourceNode)try{u.micSourceNode.disconnect()}catch(G){n({type:"browser/window/error",message:`switchMic.micSource.disconnect.failed: ${Ye(G)}`})}if(u.inputCtx){try{u.inputCtx.close()}catch(G){n({type:"browser/window/error",message:`switchMic.inputCtx.close.failed: ${Ye(G)}`})}u.inputCtx=void 0}if(u.micStream)for(const G of u.micStream.getTracks())G.stop();u.micStream=_,u.micTrack=_.getAudioTracks()[0],Qc(u.micTrack,n),await P(_),B(_)}catch(_){E("MICROPHONE_SWITCH_FAILED",Ye(_)||"Could not switch microphone.","Try a different device.")}},Se=()=>{if(g)return;v||(v=new AudioContext),v.state==="suspended"&&v.resume().catch(_=>n({type:"browser/window/error",message:`metronome.resume.failed: ${Ye(_)}`}));const b=()=>{const _=v;if(!_)return;const G=_.createOscillator(),F=_.createGain();G.type="sine",G.frequency.value=880;const ee=_.currentTime;F.gain.setValueAtTime(0,ee),F.gain.linearRampToValueAtTime(.05,ee+.005),F.gain.exponentialRampToValueAtTime(1e-4,ee+.08),G.connect(F).connect(_.destination),G.start(ee),G.stop(ee+.1)};b(),g=setInterval(b,2e3)},k=()=>{g&&(clearInterval(g),g=void 0)};function w(){const{xaiWs:b,micStream:_,analyserCtx:G,workletNode:F,micSourceNode:ee,inputCtx:re,outputCtx:de}=u;if(x&&(x(),x=void 0),b)try{b.close()}catch(we){n({type:"browser/window/error",message:`teardown.xaiWs.close.failed: ${Ye(we)}`})}if(F)try{F.port.onmessage=null,F.disconnect()}catch(we){n({type:"browser/window/error",message:`teardown.worklet.disconnect.failed: ${Ye(we)}`})}if(ee)try{ee.disconnect()}catch(we){n({type:"browser/window/error",message:`teardown.micSource.disconnect.failed: ${Ye(we)}`})}if(re)try{re.close()}catch(we){n({type:"browser/window/error",message:`teardown.inputCtx.close.failed: ${Ye(we)}`})}if(de)try{de.close()}catch(we){n({type:"browser/window/error",message:`teardown.outputCtx.close.failed: ${Ye(we)}`})}if(_)for(const we of _.getTracks())we.stop();if(G)try{G.close()}catch(we){n({type:"browser/window/error",message:`teardown.analyserCtx.close.failed: ${Ye(we)}`})}h!==void 0&&(clearTimeout(h),h=void 0),d!==void 0&&(clearTimeout(d),d=void 0),f&&(cancelAnimationFrame(f),f=0),c=!1,Qc(void 0,n),u=im(),cu.fill(0)}const q=a(b=>{switch(b.type){case"ui/click/primary":ie();break;case"host/voice/session/start":U();break;case"browser/autoplay/probed":b.allowed&&H();break;case"ui/click/reset":Ot("conversation.reset"),w(),n({type:"voice/session/in-flight",inFlight:!1});break;case"ui/select/mic-device":ce(b.deviceId);break;case"host/voice/session/token":be(b.token).catch(_=>{se("VOICE_SETUP_FAILED",Ye(_))});break;case"host/voice/send":ae(b.event,b.gate);break;case"host/voice/session/close":w();break;case"host/duplicate-client":w();break;case"host/state":{const _=b.data.conversationStatus;if((_==="none"||_==="ending")&&r().voice.xaiOpen&&w(),_==="paused"&&r().voice.xaiOpen&&!r().voice.paused?D():_==="active"&&r().voice.xaiOpen&&r().voice.paused&&Z(),b.data.connectOnPageLoad&&!p){const{audio:G,voice:F}=r();!G.ready&&G.permission!=="denied"&&!F.xaiOpen&&!F.sessionInFlight&&(p=!0,H())}break}case"host/wait-for-context/start":Se();break;case"host/wait-for-context/end":k();break;case"xai/input-audio-buffer/speech-started":case"xai/response/cancelled":n({type:"voice/playback/cut"});break;case"voice/playback/cut":L(),h!==void 0&&(clearTimeout(h),h=void 0),u.deferredSends=[];break;case"voice/playback/drained":{const _=u.xaiWs;if(_&&r().voice.xaiOpen)for(const G of u.deferredSends)try{_.send(JSON.stringify(G))}catch(F){n({type:"browser/window/error",message:`xaiWs.send.deferred.failed: ${Ye(F)}`})}u.deferredSends=[];break}}});return()=>{q(),k(),w()}}const am=/^[A-Za-z0-9!#$%&\'*+\\-.^_`|~]+$/;function v0(n,a){if(am.test(n))return n;const r=[...new Set(n.split("").filter(u=>!am.test(u)))].join("");return a({type:"browser/window/error",message:`voice.session.token.sanitized: unsafeChars=${r}`}),btoa(n).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")}function b0(n,a){const r=n?.type;if(typeof r!="string"){a({type:"xai/unknown",raw:n});return}const u=typeof n.item_id=="string"?n.item_id:"";switch(r){case"session.created":a({type:"xai/session/created"});return;case"session.updated":a({type:"xai/session/updated"});return;case"conversation.created":a({type:"xai/conversation/created"});return;case"conversation.item.added":{const c=n.item,f=typeof c?.role=="string"?c.role:"";a({type:"xai/conversation/item/added",itemId:u,role:f});return}case"input_audio_buffer.speech_started":a({type:"xai/input-audio-buffer/speech-started",itemId:u});return;case"input_audio_buffer.speech_stopped":a({type:"xai/input-audio-buffer/speech-stopped"});return;case"input_audio_buffer.committed":a({type:"xai/input-audio-buffer/committed"});return;case"input_audio_buffer.cleared":a({type:"xai/input-audio-buffer/cleared"});return;case"response.created":a({type:"xai/response/created"});return;case"response.done":a({type:"xai/response/done"});return;case"response.cancelled":a({type:"xai/response/cancelled"});return;case"response.failed":a({type:"xai/response/failed"});return;case"response.output_audio.delta":a({type:"xai/response/output-audio/delta",b64:""});return;case"response.output_audio.done":a({type:"xai/response/output-audio/done"});return;case"response.output_audio_transcript.delta":a({type:"xai/response/output-audio-transcript/delta",delta:""});return;case"response.output_audio_transcript.done":a({type:"xai/response/output-audio-transcript/done"});return;case"response.text.delta":a({type:"xai/response/text/delta",delta:""});return;case"response.text.done":a({type:"xai/response/text/done"});return;case"error":a({type:"xai/error",code:"",message:""});return;default:a({type:"xai/unknown",raw:n})}}function S0({dimmed:n}){const a=ve.useRef([]);return ve.useEffect(()=>{let r=0;const u=()=>{for(let c=0;c<a.current.length;c+=1){const f=a.current[c];f!==void 0&&f.style.setProperty("--level",String(Math.max(.1,cu[c]??.1)))}r=requestAnimationFrame(u)};return r=requestAnimationFrame(u),()=>cancelAnimationFrame(r)},[]),J.jsx("div",{className:`meters${n?" dimmed":""}`,"aria-hidden":"true",children:[0,1,2,3,4].map(r=>J.jsx("span",{className:"bar",ref:u=>{u!==null&&(a.current[r]=u)}},r))})}function x0(){const{permission:n,devices:a,selectedDeviceId:r}=At(Ts(u=>({permission:u.audio.permission,devices:u.audio.devices,selectedDeviceId:u.audio.selectedDeviceId})));return n==="denied"?J.jsxs("div",{className:"error-block",children:[J.jsx("div",{className:"error-title",children:"Microphone error"}),J.jsx("div",{children:"Microphone access denied \u2014 allow access in browser settings."}),J.jsx("button",{className:"retry",type:"button",onClick:()=>kt({type:"ui/click/primary"}),children:"Retry"})]}):a.length===0?J.jsx("div",{className:"mic-note",children:"Microphone access is required to use voice."}):J.jsxs("div",{children:[J.jsx("label",{className:"field-label",htmlFor:"micSelect",children:"Microphone"}),J.jsx("select",{id:"micSelect",value:r??a[0]?.deviceId??"",onChange:u=>kt({type:"ui/select/mic-device",deviceId:u.target.value}),children:a.map(u=>J.jsx("option",{value:u.deviceId,children:u.label},u.deviceId))})]})}function E0(){const{xaiOpen:n,xaiStatus:a,sessionInFlight:r,paused:u}=At(Ts(x=>({xaiOpen:x.voice.xaiOpen,xaiStatus:x.voice.xaiStatus,sessionInFlight:x.voice.sessionInFlight,paused:x.voice.paused}))),c=At(x=>x.connection.status),f=At(x=>x.audio.autoplayAllowed),d=At(x=>x.ui.moreActionsOpen),h=At(x=>(x.conversation.conversation?.transcript.length??0)>0);let m;!n&&!r?m="idle":r&&!n?m="connecting":n&&!u?m="active":m="paused";const p=m==="idle"||m==="paused",v=m==="connecting",g=f===!1;return J.jsxs("div",{className:"floating-tab",children:[J.jsxs("button",{className:"icon-btn",type:"button",disabled:v,"aria-label":p?"Start conversation":"Pause conversation",title:g&&p?"Click to enable audio.":void 0,onClick:()=>kt({type:"ui/click/primary"}),children:[J.jsx("span",{className:`codicon codicon-${p?"play":"debug-pause"}`,"aria-hidden":"true"}),g&&p?J.jsx("span",{className:"shield-badge codicon codicon-shield","aria-hidden":"true"}):null]}),m==="active"||m==="paused"?J.jsx("button",{className:"icon-btn",type:"button","aria-label":"Reset conversation",onClick:()=>kt({type:"ui/click/reset"}),children:J.jsx("span",{className:"codicon codicon-refresh","aria-hidden":"true"})}):null,J.jsx("button",{className:"icon-btn",type:"button","aria-label":"View transcript",onClick:()=>kt({type:"ui/click/transcript"}),children:J.jsx("span",{className:"codicon codicon-comment-discussion","aria-hidden":"true"})}),J.jsx("button",{className:"icon-btn",type:"button","aria-label":"View instructions",onClick:()=>kt({type:"ui/click/instructions"}),children:J.jsx("span",{className:"codicon codicon-book","aria-hidden":"true"})}),m==="active"?J.jsx(S0,{dimmed:!1}):null,J.jsx("div",{className:"connection",title:`Local: ${c} \xB7 xAI: ${a}`,children:J.jsxs("span",{className:"split-dot",children:[J.jsx("span",{className:`split-dot-half top ${c}`}),J.jsx("span",{className:`split-dot-half bottom ${a}`})]})}),J.jsxs("div",{style:{position:"relative"},children:[J.jsx("button",{className:"icon-btn",type:"button","aria-label":"More actions","aria-expanded":d,onClick:()=>kt({type:"ui/click/more-actions"}),children:J.jsx("span",{className:"codicon codicon-ellipsis","aria-hidden":"true"})}),d?J.jsxs("div",{className:"more-actions-popover","data-more-actions":!0,children:[J.jsx(x0,{}),J.jsx("button",{className:"menu-item",type:"button",disabled:!h,onClick:()=>kt({type:"ui/click/download-transcript"}),children:"Download transcript (JSONL)"})]}):null]})]})}function k0(n,a){const r={};return(n[n.length-1]===""?[...n,""]:n).join((r.padRight?" ":"")+","+(r.padLeft===!1?"":" ")).trim()}const A0=/^[$_\\p{ID_Start}][$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,w0=/^[$_\\p{ID_Start}][-$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,T0={};function rm(n,a){return(T0.jsx?w0:A0).test(n)}const C0=/[ \\t\\n\\f\\r]/g;function z0(n){return typeof n=="object"?n.type==="text"?um(n.value):!1:um(n)}function um(n){return n.replace(C0,"")===""}class ja{constructor(a,r,u){this.normal=r,this.property=a,u&&(this.space=u)}}ja.prototype.normal={};ja.prototype.property={};ja.prototype.space=void 0;function lg(n,a){const r={},u={};for(const c of n)Object.assign(r,c.property),Object.assign(u,c.normal);return new ja(r,u,a)}function hs(n){return n.toLowerCase()}class Yt{constructor(a,r){this.attribute=r,this.property=a}}Yt.prototype.attribute="";Yt.prototype.booleanish=!1;Yt.prototype.boolean=!1;Yt.prototype.commaOrSpaceSeparated=!1;Yt.prototype.commaSeparated=!1;Yt.prototype.defined=!1;Yt.prototype.mustUseProperty=!1;Yt.prototype.number=!1;Yt.prototype.overloadedBoolean=!1;Yt.prototype.property="";Yt.prototype.spaceSeparated=!1;Yt.prototype.space=void 0;let _0=0;const Ae=ql(),st=ql(),ps=ql(),W=ql(),We=ql(),_i=ql(),Jt=ql();function ql(){return 2**++_0}const ms=Object.freeze(Object.defineProperty({__proto__:null,boolean:Ae,booleanish:st,commaOrSpaceSeparated:Jt,commaSeparated:_i,number:W,overloadedBoolean:ps,spaceSeparated:We},Symbol.toStringTag,{value:"Module"})),Ic=Object.keys(ms);class zs extends Yt{constructor(a,r,u,c){let f=-1;if(super(a,r),om(this,"space",c),typeof u=="number")for(;++f<Ic.length;){const d=Ic[f];om(this,Ic[f],(u&ms[d])===ms[d])}}}zs.prototype.defined=!0;function om(n,a,r){r&&(n[a]=r)}function Di(n){const a={},r={};for(const[u,c]of Object.entries(n.properties)){const f=new zs(u,n.transform(n.attributes||{},u),c,n.space);n.mustUseProperty&&n.mustUseProperty.includes(u)&&(f.mustUseProperty=!0),a[u]=f,r[hs(u)]=u,r[hs(f.attribute)]=u}return new ja(a,r,n.space)}const ig=Di({properties:{ariaActiveDescendant:null,ariaAtomic:st,ariaAutoComplete:null,ariaBusy:st,ariaChecked:st,ariaColCount:W,ariaColIndex:W,ariaColSpan:W,ariaControls:We,ariaCurrent:null,ariaDescribedBy:We,ariaDetails:null,ariaDisabled:st,ariaDropEffect:We,ariaErrorMessage:null,ariaExpanded:st,ariaFlowTo:We,ariaGrabbed:st,ariaHasPopup:null,ariaHidden:st,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:We,ariaLevel:W,ariaLive:null,ariaModal:st,ariaMultiLine:st,ariaMultiSelectable:st,ariaOrientation:null,ariaOwns:We,ariaPlaceholder:null,ariaPosInSet:W,ariaPressed:st,ariaReadOnly:st,ariaRelevant:null,ariaRequired:st,ariaRoleDescription:We,ariaRowCount:W,ariaRowIndex:W,ariaRowSpan:W,ariaSelected:st,ariaSetSize:W,ariaSort:null,ariaValueMax:W,ariaValueMin:W,ariaValueNow:W,ariaValueText:null,role:null},transform(n,a){return a==="role"?a:"aria-"+a.slice(4).toLowerCase()}});function ag(n,a){return a in n?n[a]:a}function rg(n,a){return ag(n,a.toLowerCase())}const O0=Di({attributes:{acceptcharset:"accept-charset",classname:"class",htmlfor:"for",httpequiv:"http-equiv"},mustUseProperty:["checked","multiple","muted","selected"],properties:{abbr:null,accept:_i,acceptCharset:We,accessKey:We,action:null,allow:null,allowFullScreen:Ae,allowPaymentRequest:Ae,allowUserMedia:Ae,alt:null,as:null,async:Ae,autoCapitalize:null,autoComplete:We,autoFocus:Ae,autoPlay:Ae,blocking:We,capture:null,charSet:null,checked:Ae,cite:null,className:We,cols:W,colSpan:null,content:null,contentEditable:st,controls:Ae,controlsList:We,coords:W|_i,crossOrigin:null,data:null,dateTime:null,decoding:null,default:Ae,defer:Ae,dir:null,dirName:null,disabled:Ae,download:ps,draggable:st,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:Ae,formTarget:null,headers:We,height:W,hidden:ps,high:W,href:null,hrefLang:null,htmlFor:We,httpEquiv:We,id:null,imageSizes:null,imageSrcSet:null,inert:Ae,inputMode:null,integrity:null,is:null,isMap:Ae,itemId:null,itemProp:We,itemRef:We,itemScope:Ae,itemType:We,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:Ae,low:W,manifest:null,max:null,maxLength:W,media:null,method:null,min:null,minLength:W,multiple:Ae,muted:Ae,name:null,nonce:null,noModule:Ae,noValidate:Ae,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:Ae,optimum:W,pattern:null,ping:We,placeholder:null,playsInline:Ae,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:Ae,referrerPolicy:null,rel:We,required:Ae,reversed:Ae,rows:W,rowSpan:W,sandbox:We,scope:null,scoped:Ae,seamless:Ae,selected:Ae,shadowRootClonable:Ae,shadowRootDelegatesFocus:Ae,shadowRootMode:null,shape:null,size:W,sizes:null,slot:null,span:W,spellCheck:st,src:null,srcDoc:null,srcLang:null,srcSet:null,start:W,step:null,style:null,tabIndex:W,target:null,title:null,translate:null,type:null,typeMustMatch:Ae,useMap:null,value:st,width:W,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:We,axis:null,background:null,bgColor:null,border:W,borderColor:null,bottomMargin:W,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:Ae,declare:Ae,event:null,face:null,frame:null,frameBorder:null,hSpace:W,leftMargin:W,link:null,longDesc:null,lowSrc:null,marginHeight:W,marginWidth:W,noResize:Ae,noHref:Ae,noShade:Ae,noWrap:Ae,object:null,profile:null,prompt:null,rev:null,rightMargin:W,rules:null,scheme:null,scrolling:st,standby:null,summary:null,text:null,topMargin:W,valueType:null,version:null,vAlign:null,vLink:null,vSpace:W,allowTransparency:null,autoCorrect:null,autoSave:null,disablePictureInPicture:Ae,disableRemotePlayback:Ae,prefix:null,property:null,results:W,security:null,unselectable:null},space:"html",transform:rg}),D0=Di({attributes:{accentHeight:"accent-height",alignmentBaseline:"alignment-baseline",arabicForm:"arabic-form",baselineShift:"baseline-shift",capHeight:"cap-height",className:"class",clipPath:"clip-path",clipRule:"clip-rule",colorInterpolation:"color-interpolation",colorInterpolationFilters:"color-interpolation-filters",colorProfile:"color-profile",colorRendering:"color-rendering",crossOrigin:"crossorigin",dataType:"datatype",dominantBaseline:"dominant-baseline",enableBackground:"enable-background",fillOpacity:"fill-opacity",fillRule:"fill-rule",floodColor:"flood-color",floodOpacity:"flood-opacity",fontFamily:"font-family",fontSize:"font-size",fontSizeAdjust:"font-size-adjust",fontStretch:"font-stretch",fontStyle:"font-style",fontVariant:"font-variant",fontWeight:"font-weight",glyphName:"glyph-name",glyphOrientationHorizontal:"glyph-orientation-horizontal",glyphOrientationVertical:"glyph-orientation-vertical",hrefLang:"hreflang",horizAdvX:"horiz-adv-x",horizOriginX:"horiz-origin-x",horizOriginY:"horiz-origin-y",imageRendering:"image-rendering",letterSpacing:"letter-spacing",lightingColor:"lighting-color",markerEnd:"marker-end",markerMid:"marker-mid",markerStart:"marker-start",navDown:"nav-down",navDownLeft:"nav-down-left",navDownRight:"nav-down-right",navLeft:"nav-left",navNext:"nav-next",navPrev:"nav-prev",navRight:"nav-right",navUp:"nav-up",navUpLeft:"nav-up-left",navUpRight:"nav-up-right",onAbort:"onabort",onActivate:"onactivate",onAfterPrint:"onafterprint",onBeforePrint:"onbeforeprint",onBegin:"onbegin",onCancel:"oncancel",onCanPlay:"oncanplay",onCanPlayThrough:"oncanplaythrough",onChange:"onchange",onClick:"onclick",onClose:"onclose",onCopy:"oncopy",onCueChange:"oncuechange",onCut:"oncut",onDblClick:"ondblclick",onDrag:"ondrag",onDragEnd:"ondragend",onDragEnter:"ondragenter",onDragExit:"ondragexit",onDragLeave:"ondragleave",onDragOver:"ondragover",onDragStart:"ondragstart",onDrop:"ondrop",onDurationChange:"ondurationchange",onEmptied:"onemptied",onEnd:"onend",onEnded:"onended",onError:"onerror",onFocus:"onfocus",onFocusIn:"onfocusin",onFocusOut:"onfocusout",onHashChange:"onhashchange",onInput:"oninput",onInvalid:"oninvalid",onKeyDown:"onkeydown",onKeyPress:"onkeypress",onKeyUp:"onkeyup",onLoad:"onload",onLoadedData:"onloadeddata",onLoadedMetadata:"onloadedmetadata",onLoadStart:"onloadstart",onMessage:"onmessage",onMouseDown:"onmousedown",onMouseEnter:"onmouseenter",onMouseLeave:"onmouseleave",onMouseMove:"onmousemove",onMouseOut:"onmouseout",onMouseOver:"onmouseover",onMouseUp:"onmouseup",onMouseWheel:"onmousewheel",onOffline:"onoffline",onOnline:"ononline",onPageHide:"onpagehide",onPageShow:"onpageshow",onPaste:"onpaste",onPause:"onpause",onPlay:"onplay",onPlaying:"onplaying",onPopState:"onpopstate",onProgress:"onprogress",onRateChange:"onratechange",onRepeat:"onrepeat",onReset:"onreset",onResize:"onresize",onScroll:"onscroll",onSeeked:"onseeked",onSeeking:"onseeking",onSelect:"onselect",onShow:"onshow",onStalled:"onstalled",onStorage:"onstorage",onSubmit:"onsubmit",onSuspend:"onsuspend",onTimeUpdate:"ontimeupdate",onToggle:"ontoggle",onUnload:"onunload",onVolumeChange:"onvolumechange",onWaiting:"onwaiting",onZoom:"onzoom",overlinePosition:"overline-position",overlineThickness:"overline-thickness",paintOrder:"paint-order",panose1:"panose-1",pointerEvents:"pointer-events",referrerPolicy:"referrerpolicy",renderingIntent:"rendering-intent",shapeRendering:"shape-rendering",stopColor:"stop-color",stopOpacity:"stop-opacity",strikethroughPosition:"strikethrough-position",strikethroughThickness:"strikethrough-thickness",strokeDashArray:"stroke-dasharray",strokeDashOffset:"stroke-dashoffset",strokeLineCap:"stroke-linecap",strokeLineJoin:"stroke-linejoin",strokeMiterLimit:"stroke-miterlimit",strokeOpacity:"stroke-opacity",strokeWidth:"stroke-width",tabIndex:"tabindex",textAnchor:"text-anchor",textDecoration:"text-decoration",textRendering:"text-rendering",transformOrigin:"transform-origin",typeOf:"typeof",underlinePosition:"underline-position",underlineThickness:"underline-thickness",unicodeBidi:"unicode-bidi",unicodeRange:"unicode-range",unitsPerEm:"units-per-em",vAlphabetic:"v-alphabetic",vHanging:"v-hanging",vIdeographic:"v-ideographic",vMathematical:"v-mathematical",vectorEffect:"vector-effect",vertAdvY:"vert-adv-y",vertOriginX:"vert-origin-x",vertOriginY:"vert-origin-y",wordSpacing:"word-spacing",writingMode:"writing-mode",xHeight:"x-height",playbackOrder:"playbackorder",timelineBegin:"timelinebegin"},properties:{about:Jt,accentHeight:W,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:W,amplitude:W,arabicForm:null,ascent:W,attributeName:null,attributeType:null,azimuth:W,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:W,by:null,calcMode:null,capHeight:W,className:We,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:W,diffuseConstant:W,direction:null,display:null,dur:null,divisor:W,dominantBaseline:null,download:Ae,dx:null,dy:null,edgeMode:null,editable:null,elevation:W,enableBackground:null,end:null,event:null,exponent:W,externalResourcesRequired:null,fill:null,fillOpacity:W,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:_i,g2:_i,glyphName:_i,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:W,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:W,horizOriginX:W,horizOriginY:W,id:null,ideographic:W,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:W,k:W,k1:W,k2:W,k3:W,k4:W,kernelMatrix:Jt,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:W,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:W,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:W,overlineThickness:W,paintOrder:null,panose1:null,path:null,pathLength:W,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:We,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:W,pointsAtY:W,pointsAtZ:W,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:Jt,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:Jt,rev:Jt,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:Jt,requiredFeatures:Jt,requiredFonts:Jt,requiredFormats:Jt,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:W,specularExponent:W,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:W,strikethroughThickness:W,string:null,stroke:null,strokeDashArray:Jt,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:W,strokeOpacity:W,strokeWidth:null,style:null,surfaceScale:W,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:Jt,tabIndex:W,tableValues:null,target:null,targetX:W,targetY:W,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:Jt,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:W,underlineThickness:W,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:W,values:null,vAlphabetic:W,vMathematical:W,vectorEffect:null,vHanging:W,vIdeographic:W,version:null,vertAdvY:W,vertOriginX:W,vertOriginY:W,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:W,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:"svg",transform:ag}),ug=Di({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:"xlink",transform(n,a){return"xlink:"+a.slice(5).toLowerCase()}}),og=Di({attributes:{xmlnsxlink:"xmlns:xlink"},properties:{xmlnsXLink:null,xmlns:null},space:"xmlns",transform:rg}),cg=Di({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:"xml",transform(n,a){return"xml:"+a.slice(3).toLowerCase()}}),M0={classId:"classID",dataType:"datatype",itemId:"itemID",strokeDashArray:"strokeDasharray",strokeDashOffset:"strokeDashoffset",strokeLineCap:"strokeLinecap",strokeLineJoin:"strokeLinejoin",strokeMiterLimit:"strokeMiterlimit",typeOf:"typeof",xLinkActuate:"xlinkActuate",xLinkArcRole:"xlinkArcrole",xLinkHref:"xlinkHref",xLinkRole:"xlinkRole",xLinkShow:"xlinkShow",xLinkTitle:"xlinkTitle",xLinkType:"xlinkType",xmlnsXLink:"xmlnsXlink"},R0=/[A-Z]/g,cm=/-[a-z]/g,N0=/^data[-\\w.:]+$/i;function L0(n,a){const r=hs(a);let u=a,c=Yt;if(r in n.normal)return n.property[n.normal[r]];if(r.length>4&&r.slice(0,4)==="data"&&N0.test(a)){if(a.charAt(4)==="-"){const f=a.slice(5).replace(cm,j0);u="data"+f.charAt(0).toUpperCase()+f.slice(1)}else{const f=a.slice(4);if(!cm.test(f)){let d=f.replace(R0,U0);d.charAt(0)!=="-"&&(d="-"+d),a="data"+d}}c=zs}return new c(u,a)}function U0(n){return"-"+n.toLowerCase()}function j0(n){return n.charAt(1).toUpperCase()}const B0=lg([ig,O0,ug,og,cg],"html"),_s=lg([ig,D0,ug,og,cg],"svg");function H0(n){return n.join(" ").trim()}var wi={},Zc,sm;function q0(){if(sm)return Zc;sm=1;var n=/\\/\\*[^*]*\\*+([^/*][^*]*\\*+)*\\//g,a=/\\n/g,r=/^\\s*/,u=/^(\\*?[-#/*\\\\\\w]+(\\[[0-9a-z_-]+\\])?)\\s*/,c=/^:\\s*/,f=/^((?:\'(?:\\\\\'|.)*?\'|"(?:\\\\"|.)*?"|\\([^)]*?\\)|[^};])+)/,d=/^[;\\s]*/,h=/^\\s+|\\s+$/g,m=`\n`,p="/",v="*",g="",x="comment",E="declaration";function C(B,O){if(typeof B!="string")throw new TypeError("First argument must be a string");if(!B)return[];O=O||{};var K=1,V=1;function le(ae){var $=ae.match(a);$&&(K+=$.length);var D=ae.lastIndexOf(m);V=~D?ae.length-D:V+ae.length}function ue(){var ae={line:K,column:V};return function($){return $.position=new L(ae),ge(),$}}function L(ae){this.start=ae,this.end={line:K,column:V},this.source=O.source}L.prototype.content=B;function P(ae){var $=new Error(O.source+":"+K+":"+V+": "+ae);if($.reason=ae,$.filename=O.source,$.line=K,$.column=V,$.source=B,!O.silent)throw $}function se(ae){var $=ae.exec(B);if($){var D=$[0];return le(D),B=B.slice(D.length),$}}function ge(){se(r)}function U(ae){var $;for(ae=ae||[];$=ie();)$!==!1&&ae.push($);return ae}function ie(){var ae=ue();if(!(p!=B.charAt(0)||v!=B.charAt(1))){for(var $=2;g!=B.charAt($)&&(v!=B.charAt($)||p!=B.charAt($+1));)++$;if($+=2,g===B.charAt($-1))return P("End of comment missing");var D=B.slice(2,$-2);return V+=2,le(D),B=B.slice($),V+=2,ae({type:x,comment:D})}}function ne(){var ae=ue(),$=se(u);if($){if(ie(),!se(c))return P("property missing \':\'");var D=se(f),Z=ae({type:E,property:H($[0].replace(n,g)),value:D?H(D[0].replace(n,g)):g});return se(d),Z}}function be(){var ae=[];U(ae);for(var $;$=ne();)$!==!1&&(ae.push($),U(ae));return ae}return ge(),be()}function H(B){return B?B.replace(h,g):g}return Zc=C,Zc}var fm;function Y0(){if(fm)return wi;fm=1;var n=wi&&wi.__importDefault||function(u){return u&&u.__esModule?u:{default:u}};Object.defineProperty(wi,"__esModule",{value:!0}),wi.default=r;const a=n(q0());function r(u,c){let f=null;if(!u||typeof u!="string")return f;const d=(0,a.default)(u),h=typeof c=="function";return d.forEach(m=>{if(m.type!=="declaration")return;const{property:p,value:v}=m;h?c(p,v,m):v&&(f=f||{},f[p]=v)}),f}return wi}var Ca={},dm;function V0(){if(dm)return Ca;dm=1,Object.defineProperty(Ca,"__esModule",{value:!0}),Ca.camelCase=void 0;var n=/^--[a-zA-Z0-9_-]+$/,a=/-([a-z])/g,r=/^[^-]+$/,u=/^-(webkit|moz|ms|o|khtml)-/,c=/^-(ms)-/,f=function(p){return!p||r.test(p)||n.test(p)},d=function(p,v){return v.toUpperCase()},h=function(p,v){return"".concat(v,"-")},m=function(p,v){return v===void 0&&(v={}),f(p)?p:(p=p.toLowerCase(),v.reactCompat?p=p.replace(c,h):p=p.replace(u,h),p.replace(a,d))};return Ca.camelCase=m,Ca}var za,hm;function G0(){if(hm)return za;hm=1;var n=za&&za.__importDefault||function(c){return c&&c.__esModule?c:{default:c}},a=n(Y0()),r=V0();function u(c,f){var d={};return!c||typeof c!="string"||(0,a.default)(c,function(h,m){h&&m&&(d[(0,r.camelCase)(h,f)]=m)}),d}return u.default=u,za=u,za}var X0=G0();const Q0=As(X0),sg=fg("end"),Os=fg("start");function fg(n){return a;function a(r){const u=r&&r.position&&r.position[n]||{};if(typeof u.line=="number"&&u.line>0&&typeof u.column=="number"&&u.column>0)return{line:u.line,column:u.column,offset:typeof u.offset=="number"&&u.offset>-1?u.offset:void 0}}}function I0(n){const a=Os(n),r=sg(n);if(a&&r)return{start:a,end:r}}function Ma(n){return!n||typeof n!="object"?"":"position"in n||"type"in n?pm(n.position):"start"in n||"end"in n?pm(n):"line"in n||"column"in n?gs(n):""}function gs(n){return mm(n&&n.line)+":"+mm(n&&n.column)}function pm(n){return gs(n&&n.start)+"-"+gs(n&&n.end)}function mm(n){return n&&typeof n=="number"?n:1}class Tt extends Error{constructor(a,r,u){super(),typeof r=="string"&&(u=r,r=void 0);let c="",f={},d=!1;if(r&&("line"in r&&"column"in r?f={place:r}:"start"in r&&"end"in r?f={place:r}:"type"in r?f={ancestors:[r],place:r.position}:f={...r}),typeof a=="string"?c=a:!f.cause&&a&&(d=!0,c=a.message,f.cause=a),!f.ruleId&&!f.source&&typeof u=="string"){const m=u.indexOf(":");m===-1?f.ruleId=u:(f.source=u.slice(0,m),f.ruleId=u.slice(m+1))}if(!f.place&&f.ancestors&&f.ancestors){const m=f.ancestors[f.ancestors.length-1];m&&(f.place=m.position)}const h=f.place&&"start"in f.place?f.place.start:f.place;this.ancestors=f.ancestors||void 0,this.cause=f.cause||void 0,this.column=h?h.column:void 0,this.fatal=void 0,this.file="",this.message=c,this.line=h?h.line:void 0,this.name=Ma(f.place)||"1:1",this.place=f.place||void 0,this.reason=this.message,this.ruleId=f.ruleId||void 0,this.source=f.source||void 0,this.stack=d&&f.cause&&typeof f.cause.stack=="string"?f.cause.stack:"",this.actual=void 0,this.expected=void 0,this.note=void 0,this.url=void 0}}Tt.prototype.file="";Tt.prototype.name="";Tt.prototype.reason="";Tt.prototype.message="";Tt.prototype.stack="";Tt.prototype.column=void 0;Tt.prototype.line=void 0;Tt.prototype.ancestors=void 0;Tt.prototype.cause=void 0;Tt.prototype.fatal=void 0;Tt.prototype.place=void 0;Tt.prototype.ruleId=void 0;Tt.prototype.source=void 0;const Ds={}.hasOwnProperty,Z0=new Map,F0=/[A-Z]/g,K0=new Set(["table","tbody","thead","tfoot","tr"]),J0=new Set(["td","th"]),dg="https://github.com/syntax-tree/hast-util-to-jsx-runtime";function W0(n,a){if(!a||a.Fragment===void 0)throw new TypeError("Expected `Fragment` in options");const r=a.filePath||void 0;let u;if(a.development){if(typeof a.jsxDEV!="function")throw new TypeError("Expected `jsxDEV` in options when `development: true`");u=ab(r,a.jsxDEV)}else{if(typeof a.jsx!="function")throw new TypeError("Expected `jsx` in production options");if(typeof a.jsxs!="function")throw new TypeError("Expected `jsxs` in production options");u=ib(r,a.jsx,a.jsxs)}const c={Fragment:a.Fragment,ancestors:[],components:a.components||{},create:u,elementAttributeNameCase:a.elementAttributeNameCase||"react",evaluater:a.createEvaluater?a.createEvaluater():void 0,filePath:r,ignoreInvalidStyle:a.ignoreInvalidStyle||!1,passKeys:a.passKeys!==!1,passNode:a.passNode||!1,schema:a.space==="svg"?_s:B0,stylePropertyNameCase:a.stylePropertyNameCase||"dom",tableCellAlignToStyle:a.tableCellAlignToStyle!==!1},f=hg(c,n,void 0);return f&&typeof f!="string"?f:c.create(n,c.Fragment,{children:f||void 0},void 0)}function hg(n,a,r){if(a.type==="element")return $0(n,a,r);if(a.type==="mdxFlowExpression"||a.type==="mdxTextExpression")return P0(n,a);if(a.type==="mdxJsxFlowElement"||a.type==="mdxJsxTextElement")return tb(n,a,r);if(a.type==="mdxjsEsm")return eb(n,a);if(a.type==="root")return nb(n,a,r);if(a.type==="text")return lb(n,a)}function $0(n,a,r){const u=n.schema;let c=u;a.tagName.toLowerCase()==="svg"&&u.space==="html"&&(c=_s,n.schema=c),n.ancestors.push(a);const f=mg(n,a.tagName,!1),d=rb(n,a);let h=Rs(n,a);return K0.has(a.tagName)&&(h=h.filter(function(m){return typeof m=="string"?!z0(m):!0})),pg(n,d,f,a),Ms(d,h),n.ancestors.pop(),n.schema=u,n.create(a,f,d,r)}function P0(n,a){if(a.data&&a.data.estree&&n.evaluater){const u=a.data.estree.body[0];return u.type,n.evaluater.evaluateExpression(u.expression)}La(n,a.position)}function eb(n,a){if(a.data&&a.data.estree&&n.evaluater)return n.evaluater.evaluateProgram(a.data.estree);La(n,a.position)}function tb(n,a,r){const u=n.schema;let c=u;a.name==="svg"&&u.space==="html"&&(c=_s,n.schema=c),n.ancestors.push(a);const f=a.name===null?n.Fragment:mg(n,a.name,!0),d=ub(n,a),h=Rs(n,a);return pg(n,d,f,a),Ms(d,h),n.ancestors.pop(),n.schema=u,n.create(a,f,d,r)}function nb(n,a,r){const u={};return Ms(u,Rs(n,a)),n.create(a,n.Fragment,u,r)}function lb(n,a){return a.value}function pg(n,a,r,u){typeof r!="string"&&r!==n.Fragment&&n.passNode&&(a.node=u)}function Ms(n,a){if(a.length>0){const r=a.length>1?a:a[0];r&&(n.children=r)}}function ib(n,a,r){return u;function u(c,f,d,h){const p=Array.isArray(d.children)?r:a;return h?p(f,d,h):p(f,d)}}function ab(n,a){return r;function r(u,c,f,d){const h=Array.isArray(f.children),m=Os(u);return a(c,f,d,h,{columnNumber:m?m.column-1:void 0,fileName:n,lineNumber:m?m.line:void 0},void 0)}}function rb(n,a){const r={};let u,c;for(c in a.properties)if(c!=="children"&&Ds.call(a.properties,c)){const f=ob(n,c,a.properties[c]);if(f){const[d,h]=f;n.tableCellAlignToStyle&&d==="align"&&typeof h=="string"&&J0.has(a.tagName)?u=h:r[d]=h}}if(u){const f=r.style||(r.style={});f[n.stylePropertyNameCase==="css"?"text-align":"textAlign"]=u}return r}function ub(n,a){const r={};for(const u of a.attributes)if(u.type==="mdxJsxExpressionAttribute")if(u.data&&u.data.estree&&n.evaluater){const f=u.data.estree.body[0];f.type;const d=f.expression;d.type;const h=d.properties[0];h.type,Object.assign(r,n.evaluater.evaluateExpression(h.argument))}else La(n,a.position);else{const c=u.name;let f;if(u.value&&typeof u.value=="object")if(u.value.data&&u.value.data.estree&&n.evaluater){const h=u.value.data.estree.body[0];h.type,f=n.evaluater.evaluateExpression(h.expression)}else La(n,a.position);else f=u.value===null?!0:u.value;r[c]=f}return r}function Rs(n,a){const r=[];let u=-1;const c=n.passKeys?new Map:Z0;for(;++u<a.children.length;){const f=a.children[u];let d;if(n.passKeys){const m=f.type==="element"?f.tagName:f.type==="mdxJsxFlowElement"||f.type==="mdxJsxTextElement"?f.name:void 0;if(m){const p=c.get(m)||0;d=m+"-"+p,c.set(m,p+1)}}const h=hg(n,f,d);h!==void 0&&r.push(h)}return r}function ob(n,a,r){const u=L0(n.schema,a);if(!(r==null||typeof r=="number"&&Number.isNaN(r))){if(Array.isArray(r)&&(r=u.commaSeparated?k0(r):H0(r)),u.property==="style"){let c=typeof r=="object"?r:cb(n,String(r));return n.stylePropertyNameCase==="css"&&(c=sb(c)),["style",c]}return[n.elementAttributeNameCase==="react"&&u.space?M0[u.property]||u.property:u.attribute,r]}}function cb(n,a){try{return Q0(a,{reactCompat:!0})}catch(r){if(n.ignoreInvalidStyle)return{};const u=r,c=new Tt("Cannot parse `style` attribute",{ancestors:n.ancestors,cause:u,ruleId:"style",source:"hast-util-to-jsx-runtime"});throw c.file=n.filePath||void 0,c.url=dg+"#cannot-parse-style-attribute",c}}function mg(n,a,r){let u;if(!r)u={type:"Literal",value:a};else if(a.includes(".")){const c=a.split(".");let f=-1,d;for(;++f<c.length;){const h=rm(c[f])?{type:"Identifier",name:c[f]}:{type:"Literal",value:c[f]};d=d?{type:"MemberExpression",object:d,property:h,computed:!!(f&&h.type==="Literal"),optional:!1}:h}u=d}else u=rm(a)&&!/^[a-z]/.test(a)?{type:"Identifier",name:a}:{type:"Literal",value:a};if(u.type==="Literal"){const c=u.value;return Ds.call(n.components,c)?n.components[c]:c}if(n.evaluater)return n.evaluater.evaluateExpression(u);La(n)}function La(n,a){const r=new Tt("Cannot handle MDX estrees without `createEvaluater`",{ancestors:n.ancestors,place:a,ruleId:"mdx-estree",source:"hast-util-to-jsx-runtime"});throw r.file=n.filePath||void 0,r.url=dg+"#cannot-handle-mdx-estrees-without-createevaluater",r}function sb(n){const a={};let r;for(r in n)Ds.call(n,r)&&(a[fb(r)]=n[r]);return a}function fb(n){let a=n.replace(F0,db);return a.slice(0,3)==="ms-"&&(a="-"+a),a}function db(n){return"-"+n.toLowerCase()}const Fc={action:["form"],cite:["blockquote","del","ins","q"],data:["object"],formAction:["button","input"],href:["a","area","base","link"],icon:["menuitem"],itemId:null,manifest:["html"],ping:["a","area"],poster:["video"],src:["audio","embed","iframe","img","input","script","source","track","video"]},hb={};function Ns(n,a){const r=hb,u=typeof r.includeImageAlt=="boolean"?r.includeImageAlt:!0,c=typeof r.includeHtml=="boolean"?r.includeHtml:!0;return gg(n,u,c)}function gg(n,a,r){if(pb(n)){if("value"in n)return n.type==="html"&&!r?"":n.value;if(a&&"alt"in n&&n.alt)return n.alt;if("children"in n)return gm(n.children,a,r)}return Array.isArray(n)?gm(n,a,r):""}function gm(n,a,r){const u=[];let c=-1;for(;++c<n.length;)u[c]=gg(n[c],a,r);return u.join("")}function pb(n){return!!(n&&typeof n=="object")}const ym=document.createElement("i");function Ls(n){const a="&"+n+";";ym.innerHTML=a;const r=ym.textContent;return r.charCodeAt(r.length-1)===59&&n!=="semi"||r===a?!1:r}function Wt(n,a,r,u){const c=n.length;let f=0,d;if(a<0?a=-a>c?0:c+a:a=a>c?c:a,r=r>0?r:0,u.length<1e4)d=Array.from(u),d.unshift(a,r),n.splice(...d);else for(r&&n.splice(a,r);f<u.length;)d=u.slice(f,f+1e4),d.unshift(a,0),n.splice(...d),f+=1e4,a+=1e4}function cn(n,a){return n.length>0?(Wt(n,n.length,0,a),n):a}const vm={}.hasOwnProperty;function yg(n){const a={};let r=-1;for(;++r<n.length;)mb(a,n[r]);return a}function mb(n,a){let r;for(r in a){const c=(vm.call(n,r)?n[r]:void 0)||(n[r]={}),f=a[r];let d;if(f)for(d in f){vm.call(c,d)||(c[d]=[]);const h=f[d];gb(c[d],Array.isArray(h)?h:h?[h]:[])}}}function gb(n,a){let r=-1;const u=[];for(;++r<a.length;)(a[r].add==="after"?n:u).push(a[r]);Wt(n,0,0,u)}function vg(n,a){const r=Number.parseInt(n,a);return r<9||r===11||r>13&&r<32||r>126&&r<160||r>55295&&r<57344||r>64975&&r<65008||(r&65535)===65535||(r&65535)===65534||r>1114111?"\uFFFD":String.fromCodePoint(r)}function pn(n){return n.replace(/[\\t\\n\\r ]+/g," ").replace(/^ | $/g,"").toLowerCase().toUpperCase()}const Dt=vl(/[A-Za-z]/),wt=vl(/[\\dA-Za-z]/),yb=vl(/[#-\'*+\\--9=?A-Z^-~]/);function hu(n){return n!==null&&(n<32||n===127)}const ys=vl(/\\d/),vb=vl(/[\\dA-Fa-f]/),bb=vl(/[!-/:-@[-`{-~]/);function pe(n){return n!==null&&n<-2}function Je(n){return n!==null&&(n<0||n===32)}function Oe(n){return n===-2||n===-1||n===32}const yu=vl(/\\p{P}|\\p{S}/u),Hl=vl(/\\s/);function vl(n){return a;function a(r){return r!==null&&r>-1&&n.test(String.fromCharCode(r))}}function Mi(n){const a=[];let r=-1,u=0,c=0;for(;++r<n.length;){const f=n.charCodeAt(r);let d="";if(f===37&&wt(n.charCodeAt(r+1))&&wt(n.charCodeAt(r+2)))c=2;else if(f<128)/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(f))||(d=String.fromCharCode(f));else if(f>55295&&f<57344){const h=n.charCodeAt(r+1);f<56320&&h>56319&&h<57344?(d=String.fromCharCode(f,h),c=1):d="\uFFFD"}else d=String.fromCharCode(f);d&&(a.push(n.slice(u,r),encodeURIComponent(d)),u=r+c+1,d=""),c&&(r+=c,c=0)}return a.join("")+n.slice(u)}function Ne(n,a,r,u){const c=u?u-1:Number.POSITIVE_INFINITY;let f=0;return d;function d(m){return Oe(m)?(n.enter(r),h(m)):a(m)}function h(m){return Oe(m)&&f++<c?(n.consume(m),h):(n.exit(r),a(m))}}const Sb={tokenize:xb};function xb(n){const a=n.attempt(this.parser.constructs.contentInitial,u,c);let r;return a;function u(h){if(h===null){n.consume(h);return}return n.enter("lineEnding"),n.consume(h),n.exit("lineEnding"),Ne(n,a,"linePrefix")}function c(h){return n.enter("paragraph"),f(h)}function f(h){const m=n.enter("chunkText",{contentType:"text",previous:r});return r&&(r.next=m),r=m,d(h)}function d(h){if(h===null){n.exit("chunkText"),n.exit("paragraph"),n.consume(h);return}return pe(h)?(n.consume(h),n.exit("chunkText"),f):(n.consume(h),d)}}const Eb={tokenize:kb},bm={tokenize:Ab};function kb(n){const a=this,r=[];let u=0,c,f,d;return h;function h(V){if(u<r.length){const le=r[u];return a.containerState=le[1],n.attempt(le[0].continuation,m,p)(V)}return p(V)}function m(V){if(u++,a.containerState._closeFlow){a.containerState._closeFlow=void 0,c&&K();const le=a.events.length;let ue=le,L;for(;ue--;)if(a.events[ue][0]==="exit"&&a.events[ue][1].type==="chunkFlow"){L=a.events[ue][1].end;break}O(u);let P=le;for(;P<a.events.length;)a.events[P][1].end={...L},P++;return Wt(a.events,ue+1,0,a.events.slice(le)),a.events.length=P,p(V)}return h(V)}function p(V){if(u===r.length){if(!c)return x(V);if(c.currentConstruct&&c.currentConstruct.concrete)return C(V);a.interrupt=!!(c.currentConstruct&&!c._gfmTableDynamicInterruptHack)}return a.containerState={},n.check(bm,v,g)(V)}function v(V){return c&&K(),O(u),x(V)}function g(V){return a.parser.lazy[a.now().line]=u!==r.length,d=a.now().offset,C(V)}function x(V){return a.containerState={},n.attempt(bm,E,C)(V)}function E(V){return u++,r.push([a.currentConstruct,a.containerState]),x(V)}function C(V){if(V===null){c&&K(),O(0),n.consume(V);return}return c=c||a.parser.flow(a.now()),n.enter("chunkFlow",{_tokenizer:c,contentType:"flow",previous:f}),H(V)}function H(V){if(V===null){B(n.exit("chunkFlow"),!0),O(0),n.consume(V);return}return pe(V)?(n.consume(V),B(n.exit("chunkFlow")),u=0,a.interrupt=void 0,h):(n.consume(V),H)}function B(V,le){const ue=a.sliceStream(V);if(le&&ue.push(null),V.previous=f,f&&(f.next=V),f=V,c.defineSkip(V.start),c.write(ue),a.parser.lazy[V.start.line]){let L=c.events.length;for(;L--;)if(c.events[L][1].start.offset<d&&(!c.events[L][1].end||c.events[L][1].end.offset>d))return;const P=a.events.length;let se=P,ge,U;for(;se--;)if(a.events[se][0]==="exit"&&a.events[se][1].type==="chunkFlow"){if(ge){U=a.events[se][1].end;break}ge=!0}for(O(u),L=P;L<a.events.length;)a.events[L][1].end={...U},L++;Wt(a.events,se+1,0,a.events.slice(P)),a.events.length=L}}function O(V){let le=r.length;for(;le-- >V;){const ue=r[le];a.containerState=ue[1],ue[0].exit.call(a,n)}r.length=V}function K(){c.write([null]),f=void 0,c=void 0,a.containerState._closeFlow=void 0}}function Ab(n,a,r){return Ne(n,n.attempt(this.parser.constructs.document,a,r),"linePrefix",this.parser.constructs.disable.null.includes("codeIndented")?void 0:4)}function Oi(n){if(n===null||Je(n)||Hl(n))return 1;if(yu(n))return 2}function vu(n,a,r){const u=[];let c=-1;for(;++c<n.length;){const f=n[c].resolveAll;f&&!u.includes(f)&&(a=f(a,r),u.push(f))}return a}const vs={name:"attention",resolveAll:wb,tokenize:Tb};function wb(n,a){let r=-1,u,c,f,d,h,m,p,v;for(;++r<n.length;)if(n[r][0]==="enter"&&n[r][1].type==="attentionSequence"&&n[r][1]._close){for(u=r;u--;)if(n[u][0]==="exit"&&n[u][1].type==="attentionSequence"&&n[u][1]._open&&a.sliceSerialize(n[u][1]).charCodeAt(0)===a.sliceSerialize(n[r][1]).charCodeAt(0)){if((n[u][1]._close||n[r][1]._open)&&(n[r][1].end.offset-n[r][1].start.offset)%3&&!((n[u][1].end.offset-n[u][1].start.offset+n[r][1].end.offset-n[r][1].start.offset)%3))continue;m=n[u][1].end.offset-n[u][1].start.offset>1&&n[r][1].end.offset-n[r][1].start.offset>1?2:1;const g={...n[u][1].end},x={...n[r][1].start};Sm(g,-m),Sm(x,m),d={type:m>1?"strongSequence":"emphasisSequence",start:g,end:{...n[u][1].end}},h={type:m>1?"strongSequence":"emphasisSequence",start:{...n[r][1].start},end:x},f={type:m>1?"strongText":"emphasisText",start:{...n[u][1].end},end:{...n[r][1].start}},c={type:m>1?"strong":"emphasis",start:{...d.start},end:{...h.end}},n[u][1].end={...d.start},n[r][1].start={...h.end},p=[],n[u][1].end.offset-n[u][1].start.offset&&(p=cn(p,[["enter",n[u][1],a],["exit",n[u][1],a]])),p=cn(p,[["enter",c,a],["enter",d,a],["exit",d,a],["enter",f,a]]),p=cn(p,vu(a.parser.constructs.insideSpan.null,n.slice(u+1,r),a)),p=cn(p,[["exit",f,a],["enter",h,a],["exit",h,a],["exit",c,a]]),n[r][1].end.offset-n[r][1].start.offset?(v=2,p=cn(p,[["enter",n[r][1],a],["exit",n[r][1],a]])):v=0,Wt(n,u-1,r-u+3,p),r=u+p.length-v-2;break}}for(r=-1;++r<n.length;)n[r][1].type==="attentionSequence"&&(n[r][1].type="data");return n}function Tb(n,a){const r=this.parser.constructs.attentionMarkers.null,u=this.previous,c=Oi(u);let f;return d;function d(m){return f=m,n.enter("attentionSequence"),h(m)}function h(m){if(m===f)return n.consume(m),h;const p=n.exit("attentionSequence"),v=Oi(m),g=!v||v===2&&c||r.includes(m),x=!c||c===2&&v||r.includes(u);return p._open=!!(f===42?g:g&&(c||!x)),p._close=!!(f===42?x:x&&(v||!g)),a(m)}}function Sm(n,a){n.column+=a,n.offset+=a,n._bufferIndex+=a}const Cb={name:"autolink",tokenize:zb};function zb(n,a,r){let u=0;return c;function c(E){return n.enter("autolink"),n.enter("autolinkMarker"),n.consume(E),n.exit("autolinkMarker"),n.enter("autolinkProtocol"),f}function f(E){return Dt(E)?(n.consume(E),d):E===64?r(E):p(E)}function d(E){return E===43||E===45||E===46||wt(E)?(u=1,h(E)):p(E)}function h(E){return E===58?(n.consume(E),u=0,m):(E===43||E===45||E===46||wt(E))&&u++<32?(n.consume(E),h):(u=0,p(E))}function m(E){return E===62?(n.exit("autolinkProtocol"),n.enter("autolinkMarker"),n.consume(E),n.exit("autolinkMarker"),n.exit("autolink"),a):E===null||E===32||E===60||hu(E)?r(E):(n.consume(E),m)}function p(E){return E===64?(n.consume(E),v):yb(E)?(n.consume(E),p):r(E)}function v(E){return wt(E)?g(E):r(E)}function g(E){return E===46?(n.consume(E),u=0,v):E===62?(n.exit("autolinkProtocol").type="autolinkEmail",n.enter("autolinkMarker"),n.consume(E),n.exit("autolinkMarker"),n.exit("autolink"),a):x(E)}function x(E){if((E===45||wt(E))&&u++<63){const C=E===45?x:g;return n.consume(E),C}return r(E)}}const Ba={partial:!0,tokenize:_b};function _b(n,a,r){return u;function u(f){return Oe(f)?Ne(n,c,"linePrefix")(f):c(f)}function c(f){return f===null||pe(f)?a(f):r(f)}}const bg={continuation:{tokenize:Db},exit:Mb,name:"blockQuote",tokenize:Ob};function Ob(n,a,r){const u=this;return c;function c(d){if(d===62){const h=u.containerState;return h.open||(n.enter("blockQuote",{_container:!0}),h.open=!0),n.enter("blockQuotePrefix"),n.enter("blockQuoteMarker"),n.consume(d),n.exit("blockQuoteMarker"),f}return r(d)}function f(d){return Oe(d)?(n.enter("blockQuotePrefixWhitespace"),n.consume(d),n.exit("blockQuotePrefixWhitespace"),n.exit("blockQuotePrefix"),a):(n.exit("blockQuotePrefix"),a(d))}}function Db(n,a,r){const u=this;return c;function c(d){return Oe(d)?Ne(n,f,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(d):f(d)}function f(d){return n.attempt(bg,a,r)(d)}}function Mb(n){n.exit("blockQuote")}const Sg={name:"characterEscape",tokenize:Rb};function Rb(n,a,r){return u;function u(f){return n.enter("characterEscape"),n.enter("escapeMarker"),n.consume(f),n.exit("escapeMarker"),c}function c(f){return bb(f)?(n.enter("characterEscapeValue"),n.consume(f),n.exit("characterEscapeValue"),n.exit("characterEscape"),a):r(f)}}const xg={name:"characterReference",tokenize:Nb};function Nb(n,a,r){const u=this;let c=0,f,d;return h;function h(g){return n.enter("characterReference"),n.enter("characterReferenceMarker"),n.consume(g),n.exit("characterReferenceMarker"),m}function m(g){return g===35?(n.enter("characterReferenceMarkerNumeric"),n.consume(g),n.exit("characterReferenceMarkerNumeric"),p):(n.enter("characterReferenceValue"),f=31,d=wt,v(g))}function p(g){return g===88||g===120?(n.enter("characterReferenceMarkerHexadecimal"),n.consume(g),n.exit("characterReferenceMarkerHexadecimal"),n.enter("characterReferenceValue"),f=6,d=vb,v):(n.enter("characterReferenceValue"),f=7,d=ys,v(g))}function v(g){if(g===59&&c){const x=n.exit("characterReferenceValue");return d===wt&&!Ls(u.sliceSerialize(x))?r(g):(n.enter("characterReferenceMarker"),n.consume(g),n.exit("characterReferenceMarker"),n.exit("characterReference"),a)}return d(g)&&c++<f?(n.consume(g),v):r(g)}}const xm={partial:!0,tokenize:Ub},Em={concrete:!0,name:"codeFenced",tokenize:Lb};function Lb(n,a,r){const u=this,c={partial:!0,tokenize:ue};let f=0,d=0,h;return m;function m(L){return p(L)}function p(L){const P=u.events[u.events.length-1];return f=P&&P[1].type==="linePrefix"?P[2].sliceSerialize(P[1],!0).length:0,h=L,n.enter("codeFenced"),n.enter("codeFencedFence"),n.enter("codeFencedFenceSequence"),v(L)}function v(L){return L===h?(d++,n.consume(L),v):d<3?r(L):(n.exit("codeFencedFenceSequence"),Oe(L)?Ne(n,g,"whitespace")(L):g(L))}function g(L){return L===null||pe(L)?(n.exit("codeFencedFence"),u.interrupt?a(L):n.check(xm,H,le)(L)):(n.enter("codeFencedFenceInfo"),n.enter("chunkString",{contentType:"string"}),x(L))}function x(L){return L===null||pe(L)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),g(L)):Oe(L)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),Ne(n,E,"whitespace")(L)):L===96&&L===h?r(L):(n.consume(L),x)}function E(L){return L===null||pe(L)?g(L):(n.enter("codeFencedFenceMeta"),n.enter("chunkString",{contentType:"string"}),C(L))}function C(L){return L===null||pe(L)?(n.exit("chunkString"),n.exit("codeFencedFenceMeta"),g(L)):L===96&&L===h?r(L):(n.consume(L),C)}function H(L){return n.attempt(c,le,B)(L)}function B(L){return n.enter("lineEnding"),n.consume(L),n.exit("lineEnding"),O}function O(L){return f>0&&Oe(L)?Ne(n,K,"linePrefix",f+1)(L):K(L)}function K(L){return L===null||pe(L)?n.check(xm,H,le)(L):(n.enter("codeFlowValue"),V(L))}function V(L){return L===null||pe(L)?(n.exit("codeFlowValue"),K(L)):(n.consume(L),V)}function le(L){return n.exit("codeFenced"),a(L)}function ue(L,P,se){let ge=0;return U;function U($){return L.enter("lineEnding"),L.consume($),L.exit("lineEnding"),ie}function ie($){return L.enter("codeFencedFence"),Oe($)?Ne(L,ne,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)($):ne($)}function ne($){return $===h?(L.enter("codeFencedFenceSequence"),be($)):se($)}function be($){return $===h?(ge++,L.consume($),be):ge>=d?(L.exit("codeFencedFenceSequence"),Oe($)?Ne(L,ae,"whitespace")($):ae($)):se($)}function ae($){return $===null||pe($)?(L.exit("codeFencedFence"),P($)):se($)}}}function Ub(n,a,r){const u=this;return c;function c(d){return d===null?r(d):(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f)}function f(d){return u.parser.lazy[u.now().line]?r(d):a(d)}}const Kc={name:"codeIndented",tokenize:Bb},jb={partial:!0,tokenize:Hb};function Bb(n,a,r){const u=this;return c;function c(p){return n.enter("codeIndented"),Ne(n,f,"linePrefix",5)(p)}function f(p){const v=u.events[u.events.length-1];return v&&v[1].type==="linePrefix"&&v[2].sliceSerialize(v[1],!0).length>=4?d(p):r(p)}function d(p){return p===null?m(p):pe(p)?n.attempt(jb,d,m)(p):(n.enter("codeFlowValue"),h(p))}function h(p){return p===null||pe(p)?(n.exit("codeFlowValue"),d(p)):(n.consume(p),h)}function m(p){return n.exit("codeIndented"),a(p)}}function Hb(n,a,r){const u=this;return c;function c(d){return u.parser.lazy[u.now().line]?r(d):pe(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),c):Ne(n,f,"linePrefix",5)(d)}function f(d){const h=u.events[u.events.length-1];return h&&h[1].type==="linePrefix"&&h[2].sliceSerialize(h[1],!0).length>=4?a(d):pe(d)?c(d):r(d)}}const qb={name:"codeText",previous:Vb,resolve:Yb,tokenize:Gb};function Yb(n){let a=n.length-4,r=3,u,c;if((n[r][1].type==="lineEnding"||n[r][1].type==="space")&&(n[a][1].type==="lineEnding"||n[a][1].type==="space")){for(u=r;++u<a;)if(n[u][1].type==="codeTextData"){n[r][1].type="codeTextPadding",n[a][1].type="codeTextPadding",r+=2,a-=2;break}}for(u=r-1,a++;++u<=a;)c===void 0?u!==a&&n[u][1].type!=="lineEnding"&&(c=u):(u===a||n[u][1].type==="lineEnding")&&(n[c][1].type="codeTextData",u!==c+2&&(n[c][1].end=n[u-1][1].end,n.splice(c+2,u-c-2),a-=u-c-2,u=c+2),c=void 0);return n}function Vb(n){return n!==96||this.events[this.events.length-1][1].type==="characterEscape"}function Gb(n,a,r){let u=0,c,f;return d;function d(g){return n.enter("codeText"),n.enter("codeTextSequence"),h(g)}function h(g){return g===96?(n.consume(g),u++,h):(n.exit("codeTextSequence"),m(g))}function m(g){return g===null?r(g):g===32?(n.enter("space"),n.consume(g),n.exit("space"),m):g===96?(f=n.enter("codeTextSequence"),c=0,v(g)):pe(g)?(n.enter("lineEnding"),n.consume(g),n.exit("lineEnding"),m):(n.enter("codeTextData"),p(g))}function p(g){return g===null||g===32||g===96||pe(g)?(n.exit("codeTextData"),m(g)):(n.consume(g),p)}function v(g){return g===96?(n.consume(g),c++,v):c===u?(n.exit("codeTextSequence"),n.exit("codeText"),a(g)):(f.type="codeTextData",p(g))}}class Xb{constructor(a){this.left=a?[...a]:[],this.right=[]}get(a){if(a<0||a>=this.left.length+this.right.length)throw new RangeError("Cannot access index `"+a+"` in a splice buffer of size `"+(this.left.length+this.right.length)+"`");return a<this.left.length?this.left[a]:this.right[this.right.length-a+this.left.length-1]}get length(){return this.left.length+this.right.length}shift(){return this.setCursor(0),this.right.pop()}slice(a,r){const u=r??Number.POSITIVE_INFINITY;return u<this.left.length?this.left.slice(a,u):a>this.left.length?this.right.slice(this.right.length-u+this.left.length,this.right.length-a+this.left.length).reverse():this.left.slice(a).concat(this.right.slice(this.right.length-u+this.left.length).reverse())}splice(a,r,u){const c=r||0;this.setCursor(Math.trunc(a));const f=this.right.splice(this.right.length-c,Number.POSITIVE_INFINITY);return u&&_a(this.left,u),f.reverse()}pop(){return this.setCursor(Number.POSITIVE_INFINITY),this.left.pop()}push(a){this.setCursor(Number.POSITIVE_INFINITY),this.left.push(a)}pushMany(a){this.setCursor(Number.POSITIVE_INFINITY),_a(this.left,a)}unshift(a){this.setCursor(0),this.right.push(a)}unshiftMany(a){this.setCursor(0),_a(this.right,a.reverse())}setCursor(a){if(!(a===this.left.length||a>this.left.length&&this.right.length===0||a<0&&this.left.length===0))if(a<this.left.length){const r=this.left.splice(a,Number.POSITIVE_INFINITY);_a(this.right,r.reverse())}else{const r=this.right.splice(this.left.length+this.right.length-a,Number.POSITIVE_INFINITY);_a(this.left,r.reverse())}}}function _a(n,a){let r=0;if(a.length<1e4)n.push(...a);else for(;r<a.length;)n.push(...a.slice(r,r+1e4)),r+=1e4}function Eg(n){const a={};let r=-1,u,c,f,d,h,m,p;const v=new Xb(n);for(;++r<v.length;){for(;r in a;)r=a[r];if(u=v.get(r),r&&u[1].type==="chunkFlow"&&v.get(r-1)[1].type==="listItemPrefix"&&(m=u[1]._tokenizer.events,f=0,f<m.length&&m[f][1].type==="lineEndingBlank"&&(f+=2),f<m.length&&m[f][1].type==="content"))for(;++f<m.length&&m[f][1].type!=="content";)m[f][1].type==="chunkText"&&(m[f][1]._isInFirstContentOfListItem=!0,f++);if(u[0]==="enter")u[1].contentType&&(Object.assign(a,Qb(v,r)),r=a[r],p=!0);else if(u[1]._container){for(f=r,c=void 0;f--;)if(d=v.get(f),d[1].type==="lineEnding"||d[1].type==="lineEndingBlank")d[0]==="enter"&&(c&&(v.get(c)[1].type="lineEndingBlank"),d[1].type="lineEnding",c=f);else if(!(d[1].type==="linePrefix"||d[1].type==="listItemIndent"))break;c&&(u[1].end={...v.get(c)[1].start},h=v.slice(c,r),h.unshift(u),v.splice(c,r-c+1,h))}}return Wt(n,0,Number.POSITIVE_INFINITY,v.slice(0)),!p}function Qb(n,a){const r=n.get(a)[1],u=n.get(a)[2];let c=a-1;const f=[];let d=r._tokenizer;d||(d=u.parser[r.contentType](r.start),r._contentTypeTextTrailing&&(d._contentTypeTextTrailing=!0));const h=d.events,m=[],p={};let v,g,x=-1,E=r,C=0,H=0;const B=[H];for(;E;){for(;n.get(++c)[1]!==E;);f.push(c),E._tokenizer||(v=u.sliceStream(E),E.next||v.push(null),g&&d.defineSkip(E.start),E._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=!0),d.write(v),E._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=void 0)),g=E,E=E.next}for(E=r;++x<h.length;)h[x][0]==="exit"&&h[x-1][0]==="enter"&&h[x][1].type===h[x-1][1].type&&h[x][1].start.line!==h[x][1].end.line&&(H=x+1,B.push(H),E._tokenizer=void 0,E.previous=void 0,E=E.next);for(d.events=[],E?(E._tokenizer=void 0,E.previous=void 0):B.pop(),x=B.length;x--;){const O=h.slice(B[x],B[x+1]),K=f.pop();m.push([K,K+O.length-1]),n.splice(K,2,O)}for(m.reverse(),x=-1;++x<m.length;)p[C+m[x][0]]=C+m[x][1],C+=m[x][1]-m[x][0]-1;return p}const Ib={resolve:Fb,tokenize:Kb},Zb={partial:!0,tokenize:Jb};function Fb(n){return Eg(n),n}function Kb(n,a){let r;return u;function u(h){return n.enter("content"),r=n.enter("chunkContent",{contentType:"content"}),c(h)}function c(h){return h===null?f(h):pe(h)?n.check(Zb,d,f)(h):(n.consume(h),c)}function f(h){return n.exit("chunkContent"),n.exit("content"),a(h)}function d(h){return n.consume(h),n.exit("chunkContent"),r.next=n.enter("chunkContent",{contentType:"content",previous:r}),r=r.next,c}}function Jb(n,a,r){const u=this;return c;function c(d){return n.exit("chunkContent"),n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),Ne(n,f,"linePrefix")}function f(d){if(d===null||pe(d))return r(d);const h=u.events[u.events.length-1];return!u.parser.constructs.disable.null.includes("codeIndented")&&h&&h[1].type==="linePrefix"&&h[2].sliceSerialize(h[1],!0).length>=4?a(d):n.interrupt(u.parser.constructs.flow,r,a)(d)}}function kg(n,a,r,u,c,f,d,h,m){const p=m||Number.POSITIVE_INFINITY;let v=0;return g;function g(O){return O===60?(n.enter(u),n.enter(c),n.enter(f),n.consume(O),n.exit(f),x):O===null||O===32||O===41||hu(O)?r(O):(n.enter(u),n.enter(d),n.enter(h),n.enter("chunkString",{contentType:"string"}),H(O))}function x(O){return O===62?(n.enter(f),n.consume(O),n.exit(f),n.exit(c),n.exit(u),a):(n.enter(h),n.enter("chunkString",{contentType:"string"}),E(O))}function E(O){return O===62?(n.exit("chunkString"),n.exit(h),x(O)):O===null||O===60||pe(O)?r(O):(n.consume(O),O===92?C:E)}function C(O){return O===60||O===62||O===92?(n.consume(O),E):E(O)}function H(O){return!v&&(O===null||O===41||Je(O))?(n.exit("chunkString"),n.exit(h),n.exit(d),n.exit(u),a(O)):v<p&&O===40?(n.consume(O),v++,H):O===41?(n.consume(O),v--,H):O===null||O===32||O===40||hu(O)?r(O):(n.consume(O),O===92?B:H)}function B(O){return O===40||O===41||O===92?(n.consume(O),H):H(O)}}function Ag(n,a,r,u,c,f){const d=this;let h=0,m;return p;function p(E){return n.enter(u),n.enter(c),n.consume(E),n.exit(c),n.enter(f),v}function v(E){return h>999||E===null||E===91||E===93&&!m||E===94&&!h&&"_hiddenFootnoteSupport"in d.parser.constructs?r(E):E===93?(n.exit(f),n.enter(c),n.consume(E),n.exit(c),n.exit(u),a):pe(E)?(n.enter("lineEnding"),n.consume(E),n.exit("lineEnding"),v):(n.enter("chunkString",{contentType:"string"}),g(E))}function g(E){return E===null||E===91||E===93||pe(E)||h++>999?(n.exit("chunkString"),v(E)):(n.consume(E),m||(m=!Oe(E)),E===92?x:g)}function x(E){return E===91||E===92||E===93?(n.consume(E),h++,g):g(E)}}function wg(n,a,r,u,c,f){let d;return h;function h(x){return x===34||x===39||x===40?(n.enter(u),n.enter(c),n.consume(x),n.exit(c),d=x===40?41:x,m):r(x)}function m(x){return x===d?(n.enter(c),n.consume(x),n.exit(c),n.exit(u),a):(n.enter(f),p(x))}function p(x){return x===d?(n.exit(f),m(d)):x===null?r(x):pe(x)?(n.enter("lineEnding"),n.consume(x),n.exit("lineEnding"),Ne(n,p,"linePrefix")):(n.enter("chunkString",{contentType:"string"}),v(x))}function v(x){return x===d||x===null||pe(x)?(n.exit("chunkString"),p(x)):(n.consume(x),x===92?g:v)}function g(x){return x===d||x===92?(n.consume(x),v):v(x)}}function Ra(n,a){let r;return u;function u(c){return pe(c)?(n.enter("lineEnding"),n.consume(c),n.exit("lineEnding"),r=!0,u):Oe(c)?Ne(n,u,r?"linePrefix":"lineSuffix")(c):a(c)}}const Wb={name:"definition",tokenize:Pb},$b={partial:!0,tokenize:eS};function Pb(n,a,r){const u=this;let c;return f;function f(E){return n.enter("definition"),d(E)}function d(E){return Ag.call(u,n,h,r,"definitionLabel","definitionLabelMarker","definitionLabelString")(E)}function h(E){return c=pn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)),E===58?(n.enter("definitionMarker"),n.consume(E),n.exit("definitionMarker"),m):r(E)}function m(E){return Je(E)?Ra(n,p)(E):p(E)}function p(E){return kg(n,v,r,"definitionDestination","definitionDestinationLiteral","definitionDestinationLiteralMarker","definitionDestinationRaw","definitionDestinationString")(E)}function v(E){return n.attempt($b,g,g)(E)}function g(E){return Oe(E)?Ne(n,x,"whitespace")(E):x(E)}function x(E){return E===null||pe(E)?(n.exit("definition"),u.parser.defined.push(c),a(E)):r(E)}}function eS(n,a,r){return u;function u(h){return Je(h)?Ra(n,c)(h):r(h)}function c(h){return wg(n,f,r,"definitionTitle","definitionTitleMarker","definitionTitleString")(h)}function f(h){return Oe(h)?Ne(n,d,"whitespace")(h):d(h)}function d(h){return h===null||pe(h)?a(h):r(h)}}const tS={name:"hardBreakEscape",tokenize:nS};function nS(n,a,r){return u;function u(f){return n.enter("hardBreakEscape"),n.consume(f),c}function c(f){return pe(f)?(n.exit("hardBreakEscape"),a(f)):r(f)}}const lS={name:"headingAtx",resolve:iS,tokenize:aS};function iS(n,a){let r=n.length-2,u=3,c,f;return n[u][1].type==="whitespace"&&(u+=2),r-2>u&&n[r][1].type==="whitespace"&&(r-=2),n[r][1].type==="atxHeadingSequence"&&(u===r-1||r-4>u&&n[r-2][1].type==="whitespace")&&(r-=u+1===r?2:4),r>u&&(c={type:"atxHeadingText",start:n[u][1].start,end:n[r][1].end},f={type:"chunkText",start:n[u][1].start,end:n[r][1].end,contentType:"text"},Wt(n,u,r-u+1,[["enter",c,a],["enter",f,a],["exit",f,a],["exit",c,a]])),n}function aS(n,a,r){let u=0;return c;function c(v){return n.enter("atxHeading"),f(v)}function f(v){return n.enter("atxHeadingSequence"),d(v)}function d(v){return v===35&&u++<6?(n.consume(v),d):v===null||Je(v)?(n.exit("atxHeadingSequence"),h(v)):r(v)}function h(v){return v===35?(n.enter("atxHeadingSequence"),m(v)):v===null||pe(v)?(n.exit("atxHeading"),a(v)):Oe(v)?Ne(n,h,"whitespace")(v):(n.enter("atxHeadingText"),p(v))}function m(v){return v===35?(n.consume(v),m):(n.exit("atxHeadingSequence"),h(v))}function p(v){return v===null||v===35||Je(v)?(n.exit("atxHeadingText"),h(v)):(n.consume(v),p)}}const rS=["address","article","aside","base","basefont","blockquote","body","caption","center","col","colgroup","dd","details","dialog","dir","div","dl","dt","fieldset","figcaption","figure","footer","form","frame","frameset","h1","h2","h3","h4","h5","h6","head","header","hr","html","iframe","legend","li","link","main","menu","menuitem","nav","noframes","ol","optgroup","option","p","param","search","section","summary","table","tbody","td","tfoot","th","thead","title","tr","track","ul"],km=["pre","script","style","textarea"],uS={concrete:!0,name:"htmlFlow",resolveTo:sS,tokenize:fS},oS={partial:!0,tokenize:hS},cS={partial:!0,tokenize:dS};function sS(n){let a=n.length;for(;a--&&!(n[a][0]==="enter"&&n[a][1].type==="htmlFlow"););return a>1&&n[a-2][1].type==="linePrefix"&&(n[a][1].start=n[a-2][1].start,n[a+1][1].start=n[a-2][1].start,n.splice(a-2,2)),n}function fS(n,a,r){const u=this;let c,f,d,h,m;return p;function p(b){return v(b)}function v(b){return n.enter("htmlFlow"),n.enter("htmlFlowData"),n.consume(b),g}function g(b){return b===33?(n.consume(b),x):b===47?(n.consume(b),f=!0,H):b===63?(n.consume(b),c=3,u.interrupt?a:k):Dt(b)?(n.consume(b),d=String.fromCharCode(b),B):r(b)}function x(b){return b===45?(n.consume(b),c=2,E):b===91?(n.consume(b),c=5,h=0,C):Dt(b)?(n.consume(b),c=4,u.interrupt?a:k):r(b)}function E(b){return b===45?(n.consume(b),u.interrupt?a:k):r(b)}function C(b){const _="CDATA[";return b===_.charCodeAt(h++)?(n.consume(b),h===_.length?u.interrupt?a:ne:C):r(b)}function H(b){return Dt(b)?(n.consume(b),d=String.fromCharCode(b),B):r(b)}function B(b){if(b===null||b===47||b===62||Je(b)){const _=b===47,G=d.toLowerCase();return!_&&!f&&km.includes(G)?(c=1,u.interrupt?a(b):ne(b)):rS.includes(d.toLowerCase())?(c=6,_?(n.consume(b),O):u.interrupt?a(b):ne(b)):(c=7,u.interrupt&&!u.parser.lazy[u.now().line]?r(b):f?K(b):V(b))}return b===45||wt(b)?(n.consume(b),d+=String.fromCharCode(b),B):r(b)}function O(b){return b===62?(n.consume(b),u.interrupt?a:ne):r(b)}function K(b){return Oe(b)?(n.consume(b),K):U(b)}function V(b){return b===47?(n.consume(b),U):b===58||b===95||Dt(b)?(n.consume(b),le):Oe(b)?(n.consume(b),V):U(b)}function le(b){return b===45||b===46||b===58||b===95||wt(b)?(n.consume(b),le):ue(b)}function ue(b){return b===61?(n.consume(b),L):Oe(b)?(n.consume(b),ue):V(b)}function L(b){return b===null||b===60||b===61||b===62||b===96?r(b):b===34||b===39?(n.consume(b),m=b,P):Oe(b)?(n.consume(b),L):se(b)}function P(b){return b===m?(n.consume(b),m=null,ge):b===null||pe(b)?r(b):(n.consume(b),P)}function se(b){return b===null||b===34||b===39||b===47||b===60||b===61||b===62||b===96||Je(b)?ue(b):(n.consume(b),se)}function ge(b){return b===47||b===62||Oe(b)?V(b):r(b)}function U(b){return b===62?(n.consume(b),ie):r(b)}function ie(b){return b===null||pe(b)?ne(b):Oe(b)?(n.consume(b),ie):r(b)}function ne(b){return b===45&&c===2?(n.consume(b),D):b===60&&c===1?(n.consume(b),Z):b===62&&c===4?(n.consume(b),w):b===63&&c===3?(n.consume(b),k):b===93&&c===5?(n.consume(b),Se):pe(b)&&(c===6||c===7)?(n.exit("htmlFlowData"),n.check(oS,q,be)(b)):b===null||pe(b)?(n.exit("htmlFlowData"),be(b)):(n.consume(b),ne)}function be(b){return n.check(cS,ae,q)(b)}function ae(b){return n.enter("lineEnding"),n.consume(b),n.exit("lineEnding"),$}function $(b){return b===null||pe(b)?be(b):(n.enter("htmlFlowData"),ne(b))}function D(b){return b===45?(n.consume(b),k):ne(b)}function Z(b){return b===47?(n.consume(b),d="",ce):ne(b)}function ce(b){if(b===62){const _=d.toLowerCase();return km.includes(_)?(n.consume(b),w):ne(b)}return Dt(b)&&d.length<8?(n.consume(b),d+=String.fromCharCode(b),ce):ne(b)}function Se(b){return b===93?(n.consume(b),k):ne(b)}function k(b){return b===62?(n.consume(b),w):b===45&&c===2?(n.consume(b),k):ne(b)}function w(b){return b===null||pe(b)?(n.exit("htmlFlowData"),q(b)):(n.consume(b),w)}function q(b){return n.exit("htmlFlow"),a(b)}}function dS(n,a,r){const u=this;return c;function c(d){return pe(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f):r(d)}function f(d){return u.parser.lazy[u.now().line]?r(d):a(d)}}function hS(n,a,r){return u;function u(c){return n.enter("lineEnding"),n.consume(c),n.exit("lineEnding"),n.attempt(Ba,a,r)}}const pS={name:"htmlText",tokenize:mS};function mS(n,a,r){const u=this;let c,f,d;return h;function h(k){return n.enter("htmlText"),n.enter("htmlTextData"),n.consume(k),m}function m(k){return k===33?(n.consume(k),p):k===47?(n.consume(k),ue):k===63?(n.consume(k),V):Dt(k)?(n.consume(k),se):r(k)}function p(k){return k===45?(n.consume(k),v):k===91?(n.consume(k),f=0,C):Dt(k)?(n.consume(k),K):r(k)}function v(k){return k===45?(n.consume(k),E):r(k)}function g(k){return k===null?r(k):k===45?(n.consume(k),x):pe(k)?(d=g,Z(k)):(n.consume(k),g)}function x(k){return k===45?(n.consume(k),E):g(k)}function E(k){return k===62?D(k):k===45?x(k):g(k)}function C(k){const w="CDATA[";return k===w.charCodeAt(f++)?(n.consume(k),f===w.length?H:C):r(k)}function H(k){return k===null?r(k):k===93?(n.consume(k),B):pe(k)?(d=H,Z(k)):(n.consume(k),H)}function B(k){return k===93?(n.consume(k),O):H(k)}function O(k){return k===62?D(k):k===93?(n.consume(k),O):H(k)}function K(k){return k===null||k===62?D(k):pe(k)?(d=K,Z(k)):(n.consume(k),K)}function V(k){return k===null?r(k):k===63?(n.consume(k),le):pe(k)?(d=V,Z(k)):(n.consume(k),V)}function le(k){return k===62?D(k):V(k)}function ue(k){return Dt(k)?(n.consume(k),L):r(k)}function L(k){return k===45||wt(k)?(n.consume(k),L):P(k)}function P(k){return pe(k)?(d=P,Z(k)):Oe(k)?(n.consume(k),P):D(k)}function se(k){return k===45||wt(k)?(n.consume(k),se):k===47||k===62||Je(k)?ge(k):r(k)}function ge(k){return k===47?(n.consume(k),D):k===58||k===95||Dt(k)?(n.consume(k),U):pe(k)?(d=ge,Z(k)):Oe(k)?(n.consume(k),ge):D(k)}function U(k){return k===45||k===46||k===58||k===95||wt(k)?(n.consume(k),U):ie(k)}function ie(k){return k===61?(n.consume(k),ne):pe(k)?(d=ie,Z(k)):Oe(k)?(n.consume(k),ie):ge(k)}function ne(k){return k===null||k===60||k===61||k===62||k===96?r(k):k===34||k===39?(n.consume(k),c=k,be):pe(k)?(d=ne,Z(k)):Oe(k)?(n.consume(k),ne):(n.consume(k),ae)}function be(k){return k===c?(n.consume(k),c=void 0,$):k===null?r(k):pe(k)?(d=be,Z(k)):(n.consume(k),be)}function ae(k){return k===null||k===34||k===39||k===60||k===61||k===96?r(k):k===47||k===62||Je(k)?ge(k):(n.consume(k),ae)}function $(k){return k===47||k===62||Je(k)?ge(k):r(k)}function D(k){return k===62?(n.consume(k),n.exit("htmlTextData"),n.exit("htmlText"),a):r(k)}function Z(k){return n.exit("htmlTextData"),n.enter("lineEnding"),n.consume(k),n.exit("lineEnding"),ce}function ce(k){return Oe(k)?Ne(n,Se,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(k):Se(k)}function Se(k){return n.enter("htmlTextData"),d(k)}}const Us={name:"labelEnd",resolveAll:bS,resolveTo:SS,tokenize:xS},gS={tokenize:ES},yS={tokenize:kS},vS={tokenize:AS};function bS(n){let a=-1;const r=[];for(;++a<n.length;){const u=n[a][1];if(r.push(n[a]),u.type==="labelImage"||u.type==="labelLink"||u.type==="labelEnd"){const c=u.type==="labelImage"?4:2;u.type="data",a+=c}}return n.length!==r.length&&Wt(n,0,n.length,r),n}function SS(n,a){let r=n.length,u=0,c,f,d,h;for(;r--;)if(c=n[r][1],f){if(c.type==="link"||c.type==="labelLink"&&c._inactive)break;n[r][0]==="enter"&&c.type==="labelLink"&&(c._inactive=!0)}else if(d){if(n[r][0]==="enter"&&(c.type==="labelImage"||c.type==="labelLink")&&!c._balanced&&(f=r,c.type!=="labelLink")){u=2;break}}else c.type==="labelEnd"&&(d=r);const m={type:n[f][1].type==="labelLink"?"link":"image",start:{...n[f][1].start},end:{...n[n.length-1][1].end}},p={type:"label",start:{...n[f][1].start},end:{...n[d][1].end}},v={type:"labelText",start:{...n[f+u+2][1].end},end:{...n[d-2][1].start}};return h=[["enter",m,a],["enter",p,a]],h=cn(h,n.slice(f+1,f+u+3)),h=cn(h,[["enter",v,a]]),h=cn(h,vu(a.parser.constructs.insideSpan.null,n.slice(f+u+4,d-3),a)),h=cn(h,[["exit",v,a],n[d-2],n[d-1],["exit",p,a]]),h=cn(h,n.slice(d+1)),h=cn(h,[["exit",m,a]]),Wt(n,f,n.length,h),n}function xS(n,a,r){const u=this;let c=u.events.length,f,d;for(;c--;)if((u.events[c][1].type==="labelImage"||u.events[c][1].type==="labelLink")&&!u.events[c][1]._balanced){f=u.events[c][1];break}return h;function h(x){return f?f._inactive?g(x):(d=u.parser.defined.includes(pn(u.sliceSerialize({start:f.end,end:u.now()}))),n.enter("labelEnd"),n.enter("labelMarker"),n.consume(x),n.exit("labelMarker"),n.exit("labelEnd"),m):r(x)}function m(x){return x===40?n.attempt(gS,v,d?v:g)(x):x===91?n.attempt(yS,v,d?p:g)(x):d?v(x):g(x)}function p(x){return n.attempt(vS,v,g)(x)}function v(x){return a(x)}function g(x){return f._balanced=!0,r(x)}}function ES(n,a,r){return u;function u(g){return n.enter("resource"),n.enter("resourceMarker"),n.consume(g),n.exit("resourceMarker"),c}function c(g){return Je(g)?Ra(n,f)(g):f(g)}function f(g){return g===41?v(g):kg(n,d,h,"resourceDestination","resourceDestinationLiteral","resourceDestinationLiteralMarker","resourceDestinationRaw","resourceDestinationString",32)(g)}function d(g){return Je(g)?Ra(n,m)(g):v(g)}function h(g){return r(g)}function m(g){return g===34||g===39||g===40?wg(n,p,r,"resourceTitle","resourceTitleMarker","resourceTitleString")(g):v(g)}function p(g){return Je(g)?Ra(n,v)(g):v(g)}function v(g){return g===41?(n.enter("resourceMarker"),n.consume(g),n.exit("resourceMarker"),n.exit("resource"),a):r(g)}}function kS(n,a,r){const u=this;return c;function c(h){return Ag.call(u,n,f,d,"reference","referenceMarker","referenceString")(h)}function f(h){return u.parser.defined.includes(pn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)))?a(h):r(h)}function d(h){return r(h)}}function AS(n,a,r){return u;function u(f){return n.enter("reference"),n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),c}function c(f){return f===93?(n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),n.exit("reference"),a):r(f)}}const wS={name:"labelStartImage",resolveAll:Us.resolveAll,tokenize:TS};function TS(n,a,r){const u=this;return c;function c(h){return n.enter("labelImage"),n.enter("labelImageMarker"),n.consume(h),n.exit("labelImageMarker"),f}function f(h){return h===91?(n.enter("labelMarker"),n.consume(h),n.exit("labelMarker"),n.exit("labelImage"),d):r(h)}function d(h){return h===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(h):a(h)}}const CS={name:"labelStartLink",resolveAll:Us.resolveAll,tokenize:zS};function zS(n,a,r){const u=this;return c;function c(d){return n.enter("labelLink"),n.enter("labelMarker"),n.consume(d),n.exit("labelMarker"),n.exit("labelLink"),f}function f(d){return d===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(d):a(d)}}const Jc={name:"lineEnding",tokenize:_S};function _S(n,a){return r;function r(u){return n.enter("lineEnding"),n.consume(u),n.exit("lineEnding"),Ne(n,a,"linePrefix")}}const su={name:"thematicBreak",tokenize:OS};function OS(n,a,r){let u=0,c;return f;function f(p){return n.enter("thematicBreak"),d(p)}function d(p){return c=p,h(p)}function h(p){return p===c?(n.enter("thematicBreakSequence"),m(p)):u>=3&&(p===null||pe(p))?(n.exit("thematicBreak"),a(p)):r(p)}function m(p){return p===c?(n.consume(p),u++,m):(n.exit("thematicBreakSequence"),Oe(p)?Ne(n,h,"whitespace")(p):h(p))}}const qt={continuation:{tokenize:NS},exit:US,name:"list",tokenize:RS},DS={partial:!0,tokenize:jS},MS={partial:!0,tokenize:LS};function RS(n,a,r){const u=this,c=u.events[u.events.length-1];let f=c&&c[1].type==="linePrefix"?c[2].sliceSerialize(c[1],!0).length:0,d=0;return h;function h(E){const C=u.containerState.type||(E===42||E===43||E===45?"listUnordered":"listOrdered");if(C==="listUnordered"?!u.containerState.marker||E===u.containerState.marker:ys(E)){if(u.containerState.type||(u.containerState.type=C,n.enter(C,{_container:!0})),C==="listUnordered")return n.enter("listItemPrefix"),E===42||E===45?n.check(su,r,p)(E):p(E);if(!u.interrupt||E===49)return n.enter("listItemPrefix"),n.enter("listItemValue"),m(E)}return r(E)}function m(E){return ys(E)&&++d<10?(n.consume(E),m):(!u.interrupt||d<2)&&(u.containerState.marker?E===u.containerState.marker:E===41||E===46)?(n.exit("listItemValue"),p(E)):r(E)}function p(E){return n.enter("listItemMarker"),n.consume(E),n.exit("listItemMarker"),u.containerState.marker=u.containerState.marker||E,n.check(Ba,u.interrupt?r:v,n.attempt(DS,x,g))}function v(E){return u.containerState.initialBlankLine=!0,f++,x(E)}function g(E){return Oe(E)?(n.enter("listItemPrefixWhitespace"),n.consume(E),n.exit("listItemPrefixWhitespace"),x):r(E)}function x(E){return u.containerState.size=f+u.sliceSerialize(n.exit("listItemPrefix"),!0).length,a(E)}}function NS(n,a,r){const u=this;return u.containerState._closeFlow=void 0,n.check(Ba,c,f);function c(h){return u.containerState.furtherBlankLines=u.containerState.furtherBlankLines||u.containerState.initialBlankLine,Ne(n,a,"listItemIndent",u.containerState.size+1)(h)}function f(h){return u.containerState.furtherBlankLines||!Oe(h)?(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,d(h)):(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,n.attempt(MS,a,d)(h))}function d(h){return u.containerState._closeFlow=!0,u.interrupt=void 0,Ne(n,n.attempt(qt,a,r),"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(h)}}function LS(n,a,r){const u=this;return Ne(n,c,"listItemIndent",u.containerState.size+1);function c(f){const d=u.events[u.events.length-1];return d&&d[1].type==="listItemIndent"&&d[2].sliceSerialize(d[1],!0).length===u.containerState.size?a(f):r(f)}}function US(n){n.exit(this.containerState.type)}function jS(n,a,r){const u=this;return Ne(n,c,"listItemPrefixWhitespace",u.parser.constructs.disable.null.includes("codeIndented")?void 0:5);function c(f){const d=u.events[u.events.length-1];return!Oe(f)&&d&&d[1].type==="listItemPrefixWhitespace"?a(f):r(f)}}const Am={name:"setextUnderline",resolveTo:BS,tokenize:HS};function BS(n,a){let r=n.length,u,c,f;for(;r--;)if(n[r][0]==="enter"){if(n[r][1].type==="content"){u=r;break}n[r][1].type==="paragraph"&&(c=r)}else n[r][1].type==="content"&&n.splice(r,1),!f&&n[r][1].type==="definition"&&(f=r);const d={type:"setextHeading",start:{...n[u][1].start},end:{...n[n.length-1][1].end}};return n[c][1].type="setextHeadingText",f?(n.splice(c,0,["enter",d,a]),n.splice(f+1,0,["exit",n[u][1],a]),n[u][1].end={...n[f][1].end}):n[u][1]=d,n.push(["exit",d,a]),n}function HS(n,a,r){const u=this;let c;return f;function f(p){let v=u.events.length,g;for(;v--;)if(u.events[v][1].type!=="lineEnding"&&u.events[v][1].type!=="linePrefix"&&u.events[v][1].type!=="content"){g=u.events[v][1].type==="paragraph";break}return!u.parser.lazy[u.now().line]&&(u.interrupt||g)?(n.enter("setextHeadingLine"),c=p,d(p)):r(p)}function d(p){return n.enter("setextHeadingLineSequence"),h(p)}function h(p){return p===c?(n.consume(p),h):(n.exit("setextHeadingLineSequence"),Oe(p)?Ne(n,m,"lineSuffix")(p):m(p))}function m(p){return p===null||pe(p)?(n.exit("setextHeadingLine"),a(p)):r(p)}}const qS={tokenize:YS};function YS(n){const a=this,r=n.attempt(Ba,u,n.attempt(this.parser.constructs.flowInitial,c,Ne(n,n.attempt(this.parser.constructs.flow,c,n.attempt(Ib,c)),"linePrefix")));return r;function u(f){if(f===null){n.consume(f);return}return n.enter("lineEndingBlank"),n.consume(f),n.exit("lineEndingBlank"),a.currentConstruct=void 0,r}function c(f){if(f===null){n.consume(f);return}return n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),a.currentConstruct=void 0,r}}const VS={resolveAll:Cg()},GS=Tg("string"),XS=Tg("text");function Tg(n){return{resolveAll:Cg(n==="text"?QS:void 0),tokenize:a};function a(r){const u=this,c=this.parser.constructs[n],f=r.attempt(c,d,h);return d;function d(v){return p(v)?f(v):h(v)}function h(v){if(v===null){r.consume(v);return}return r.enter("data"),r.consume(v),m}function m(v){return p(v)?(r.exit("data"),f(v)):(r.consume(v),m)}function p(v){if(v===null)return!0;const g=c[v];let x=-1;if(g)for(;++x<g.length;){const E=g[x];if(!E.previous||E.previous.call(u,u.previous))return!0}return!1}}}function Cg(n){return a;function a(r,u){let c=-1,f;for(;++c<=r.length;)f===void 0?r[c]&&r[c][1].type==="data"&&(f=c,c++):(!r[c]||r[c][1].type!=="data")&&(c!==f+2&&(r[f][1].end=r[c-1][1].end,r.splice(f+2,c-f-2),c=f+2),f=void 0);return n?n(r,u):r}}function QS(n,a){let r=0;for(;++r<=n.length;)if((r===n.length||n[r][1].type==="lineEnding")&&n[r-1][1].type==="data"){const u=n[r-1][1],c=a.sliceStream(u);let f=c.length,d=-1,h=0,m;for(;f--;){const p=c[f];if(typeof p=="string"){for(d=p.length;p.charCodeAt(d-1)===32;)h++,d--;if(d)break;d=-1}else if(p===-2)m=!0,h++;else if(p!==-1){f++;break}}if(a._contentTypeTextTrailing&&r===n.length&&(h=0),h){const p={type:r===n.length||m||h<2?"lineSuffix":"hardBreakTrailing",start:{_bufferIndex:f?d:u.start._bufferIndex+d,_index:u.start._index+f,line:u.end.line,column:u.end.column-h,offset:u.end.offset-h},end:{...u.end}};u.end={...p.start},u.start.offset===u.end.offset?Object.assign(u,p):(n.splice(r,0,["enter",p,a],["exit",p,a]),r+=2)}r++}return n}const IS={42:qt,43:qt,45:qt,48:qt,49:qt,50:qt,51:qt,52:qt,53:qt,54:qt,55:qt,56:qt,57:qt,62:bg},ZS={91:Wb},FS={[-2]:Kc,[-1]:Kc,32:Kc},KS={35:lS,42:su,45:[Am,su],60:uS,61:Am,95:su,96:Em,126:Em},JS={38:xg,92:Sg},WS={[-5]:Jc,[-4]:Jc,[-3]:Jc,33:wS,38:xg,42:vs,60:[Cb,pS],91:CS,92:[tS,Sg],93:Us,95:vs,96:qb},$S={null:[vs,VS]},PS={null:[42,95]},ex={null:[]},tx=Object.freeze(Object.defineProperty({__proto__:null,attentionMarkers:PS,contentInitial:ZS,disable:ex,document:IS,flow:KS,flowInitial:FS,insideSpan:$S,string:JS,text:WS},Symbol.toStringTag,{value:"Module"}));function nx(n,a,r){let u={_bufferIndex:-1,_index:0,line:r&&r.line||1,column:r&&r.column||1,offset:r&&r.offset||0};const c={},f=[];let d=[],h=[];const m={attempt:P(ue),check:P(L),consume:K,enter:V,exit:le,interrupt:P(L,{interrupt:!0})},p={code:null,containerState:{},defineSkip:H,events:[],now:C,parser:n,previous:null,sliceSerialize:x,sliceStream:E,write:g};let v=a.tokenize.call(p,m);return a.resolveAll&&f.push(a),p;function g(ie){return d=cn(d,ie),B(),d[d.length-1]!==null?[]:(se(a,0),p.events=vu(f,p.events,p),p.events)}function x(ie,ne){return ix(E(ie),ne)}function E(ie){return lx(d,ie)}function C(){const{_bufferIndex:ie,_index:ne,line:be,column:ae,offset:$}=u;return{_bufferIndex:ie,_index:ne,line:be,column:ae,offset:$}}function H(ie){c[ie.line]=ie.column,U()}function B(){let ie;for(;u._index<d.length;){const ne=d[u._index];if(typeof ne=="string")for(ie=u._index,u._bufferIndex<0&&(u._bufferIndex=0);u._index===ie&&u._bufferIndex<ne.length;)O(ne.charCodeAt(u._bufferIndex));else O(ne)}}function O(ie){v=v(ie)}function K(ie){pe(ie)?(u.line++,u.column=1,u.offset+=ie===-3?2:1,U()):ie!==-1&&(u.column++,u.offset++),u._bufferIndex<0?u._index++:(u._bufferIndex++,u._bufferIndex===d[u._index].length&&(u._bufferIndex=-1,u._index++)),p.previous=ie}function V(ie,ne){const be=ne||{};return be.type=ie,be.start=C(),p.events.push(["enter",be,p]),h.push(be),be}function le(ie){const ne=h.pop();return ne.end=C(),p.events.push(["exit",ne,p]),ne}function ue(ie,ne){se(ie,ne.from)}function L(ie,ne){ne.restore()}function P(ie,ne){return be;function be(ae,$,D){let Z,ce,Se,k;return Array.isArray(ae)?q(ae):"tokenize"in ae?q([ae]):w(ae);function w(F){return ee;function ee(re){const de=re!==null&&F[re],we=re!==null&&F.null,Ze=[...Array.isArray(de)?de:de?[de]:[],...Array.isArray(we)?we:we?[we]:[]];return q(Ze)(re)}}function q(F){return Z=F,ce=0,F.length===0?D:b(F[ce])}function b(F){return ee;function ee(re){return k=ge(),Se=F,F.partial||(p.currentConstruct=F),F.name&&p.parser.constructs.disable.null.includes(F.name)?G():F.tokenize.call(ne?Object.assign(Object.create(p),ne):p,m,_,G)(re)}}function _(F){return ie(Se,k),$}function G(F){return k.restore(),++ce<Z.length?b(Z[ce]):D}}}function se(ie,ne){ie.resolveAll&&!f.includes(ie)&&f.push(ie),ie.resolve&&Wt(p.events,ne,p.events.length-ne,ie.resolve(p.events.slice(ne),p)),ie.resolveTo&&(p.events=ie.resolveTo(p.events,p))}function ge(){const ie=C(),ne=p.previous,be=p.currentConstruct,ae=p.events.length,$=Array.from(h);return{from:ae,restore:D};function D(){u=ie,p.previous=ne,p.currentConstruct=be,p.events.length=ae,h=$,U()}}function U(){u.line in c&&u.column<2&&(u.column=c[u.line],u.offset+=c[u.line]-1)}}function lx(n,a){const r=a.start._index,u=a.start._bufferIndex,c=a.end._index,f=a.end._bufferIndex;let d;if(r===c)d=[n[r].slice(u,f)];else{if(d=n.slice(r,c),u>-1){const h=d[0];typeof h=="string"?d[0]=h.slice(u):d.shift()}f>0&&d.push(n[c].slice(0,f))}return d}function ix(n,a){let r=-1;const u=[];let c;for(;++r<n.length;){const f=n[r];let d;if(typeof f=="string")d=f;else switch(f){case-5:{d="\\r";break}case-4:{d=`\n`;break}case-3:{d=`\\r\n`;break}case-2:{d=a?" ":"	";break}case-1:{if(!a&&c)continue;d=" ";break}default:d=String.fromCharCode(f)}c=f===-2,u.push(d)}return u.join("")}function ax(n){const u={constructs:yg([tx,...(n||{}).extensions||[]]),content:c(Sb),defined:[],document:c(Eb),flow:c(qS),lazy:{},string:c(GS),text:c(XS)};return u;function c(f){return d;function d(h){return nx(u,f,h)}}}function rx(n){for(;!Eg(n););return n}const wm=/[\\0\\t\\n\\r]/g;function ux(){let n=1,a="",r=!0,u;return c;function c(f,d,h){const m=[];let p,v,g,x,E;for(f=a+(typeof f=="string"?f.toString():new TextDecoder(d||void 0).decode(f)),g=0,a="",r&&(f.charCodeAt(0)===65279&&g++,r=void 0);g<f.length;){if(wm.lastIndex=g,p=wm.exec(f),x=p&&p.index!==void 0?p.index:f.length,E=f.charCodeAt(x),!p){a=f.slice(g);break}if(E===10&&g===x&&u)m.push(-3),u=void 0;else switch(u&&(m.push(-5),u=void 0),g<x&&(m.push(f.slice(g,x)),n+=x-g),E){case 0:{m.push(65533),n++;break}case 9:{for(v=Math.ceil(n/4)*4,m.push(-2);n++<v;)m.push(-1);break}case 10:{m.push(-4),n=1;break}default:u=!0,n=1}g=x+1}return h&&(u&&m.push(-5),a&&m.push(a),m.push(null)),m}}const ox=/\\\\([!-/:-@[-`{-~])|&(#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});/gi;function cx(n){return n.replace(ox,sx)}function sx(n,a,r){if(a)return a;if(r.charCodeAt(0)===35){const c=r.charCodeAt(1),f=c===120||c===88;return vg(r.slice(f?2:1),f?16:10)}return Ls(r)||n}const zg={}.hasOwnProperty;function fx(n,a,r){return a&&typeof a=="object"&&(r=a,a=void 0),dx(r)(rx(ax(r).document().write(ux()(n,a,!0))))}function dx(n){const a={transforms:[],canContainEols:["emphasis","fragment","heading","paragraph","strong"],enter:{autolink:f(An),autolinkProtocol:ge,autolinkEmail:ge,atxHeading:f(tt),blockQuote:f(we),characterEscape:ge,characterReference:ge,codeFenced:f(Ze),codeFencedFenceInfo:d,codeFencedFenceMeta:d,codeIndented:f(Ze,d),codeText:f(Te,d),codeTextData:ge,data:ge,codeFlowValue:ge,definition:f(Le),definitionDestinationString:d,definitionLabelString:d,definitionTitleString:d,emphasis:f(Ue),hardBreakEscape:f(mt),hardBreakTrailing:f(mt),htmlFlow:f(gt,d),htmlFlowData:ge,htmlText:f(gt,d),htmlTextData:ge,image:f(kn),label:d,link:f(An),listItem:f(Qn),listItemValue:x,listOrdered:f(mn,g),listUnordered:f(mn),paragraph:f(Eu),reference:b,referenceString:d,resourceDestinationString:d,resourceTitleString:d,setextHeading:f(tt),strong:f(ku),thematicBreak:f(Au)},exit:{atxHeading:m(),atxHeadingSequence:ue,autolink:m(),autolinkEmail:de,autolinkProtocol:re,blockQuote:m(),characterEscapeValue:U,characterReferenceMarkerHexadecimal:G,characterReferenceMarkerNumeric:G,characterReferenceValue:F,characterReference:ee,codeFenced:m(B),codeFencedFence:H,codeFencedFenceInfo:E,codeFencedFenceMeta:C,codeFlowValue:U,codeIndented:m(O),codeText:m($),codeTextData:U,data:U,definition:m(),definitionDestinationString:le,definitionLabelString:K,definitionTitleString:V,emphasis:m(),hardBreakEscape:m(ne),hardBreakTrailing:m(ne),htmlFlow:m(be),htmlFlowData:U,htmlText:m(ae),htmlTextData:U,image:m(Z),label:Se,labelText:ce,lineEnding:ie,link:m(D),listItem:m(),listOrdered:m(),listUnordered:m(),paragraph:m(),referenceString:_,resourceDestinationString:k,resourceTitleString:w,resource:q,setextHeading:m(se),setextHeadingLineSequence:P,setextHeadingText:L,strong:m(),thematicBreak:m()}};_g(a,(n||{}).mdastExtensions||[]);const r={};return u;function u(X){let te={type:"root",children:[]};const ye={stack:[te],tokenStack:[],config:a,enter:h,exit:p,buffer:d,resume:v,data:r},Ce=[];let qe=-1;for(;++qe<X.length;)if(X[qe][1].type==="listOrdered"||X[qe][1].type==="listUnordered")if(X[qe][0]==="enter")Ce.push(qe);else{const Vt=Ce.pop();qe=c(X,Vt,qe)}for(qe=-1;++qe<X.length;){const Vt=a[X[qe][0]];zg.call(Vt,X[qe][1].type)&&Vt[X[qe][1].type].call(Object.assign({sliceSerialize:X[qe][2].sliceSerialize},ye),X[qe][1])}if(ye.tokenStack.length>0){const Vt=ye.tokenStack[ye.tokenStack.length-1];(Vt[1]||Tm).call(ye,void 0,Vt[0])}for(te.position={start:yl(X.length>0?X[0][1].start:{line:1,column:1,offset:0}),end:yl(X.length>0?X[X.length-2][1].end:{line:1,column:1,offset:0})},qe=-1;++qe<a.transforms.length;)te=a.transforms[qe](te)||te;return te}function c(X,te,ye){let Ce=te-1,qe=-1,Vt=!1,wn,zt,ft,Mt;for(;++Ce<=ye;){const Fe=X[Ce];switch(Fe[1].type){case"listUnordered":case"listOrdered":case"blockQuote":{Fe[0]==="enter"?qe++:qe--,Mt=void 0;break}case"lineEndingBlank":{Fe[0]==="enter"&&(wn&&!Mt&&!qe&&!ft&&(ft=Ce),Mt=void 0);break}case"linePrefix":case"listItemValue":case"listItemMarker":case"listItemPrefix":case"listItemPrefixWhitespace":break;default:Mt=void 0}if(!qe&&Fe[0]==="enter"&&Fe[1].type==="listItemPrefix"||qe===-1&&Fe[0]==="exit"&&(Fe[1].type==="listUnordered"||Fe[1].type==="listOrdered")){if(wn){let In=Ce;for(zt=void 0;In--;){const sn=X[In];if(sn[1].type==="lineEnding"||sn[1].type==="lineEndingBlank"){if(sn[0]==="exit")continue;zt&&(X[zt][1].type="lineEndingBlank",Vt=!0),sn[1].type="lineEnding",zt=In}else if(!(sn[1].type==="linePrefix"||sn[1].type==="blockQuotePrefix"||sn[1].type==="blockQuotePrefixWhitespace"||sn[1].type==="blockQuoteMarker"||sn[1].type==="listItemIndent"))break}ft&&(!zt||ft<zt)&&(wn._spread=!0),wn.end=Object.assign({},zt?X[zt][1].start:Fe[1].end),X.splice(zt||Ce,0,["exit",wn,Fe[2]]),Ce++,ye++}if(Fe[1].type==="listItemPrefix"){const In={type:"listItem",_spread:!1,start:Object.assign({},Fe[1].start),end:void 0};wn=In,X.splice(Ce,0,["enter",In,Fe[2]]),Ce++,ye++,ft=void 0,Mt=!0}}}return X[te][1]._spread=Vt,ye}function f(X,te){return ye;function ye(Ce){h.call(this,X(Ce),Ce),te&&te.call(this,Ce)}}function d(){this.stack.push({type:"fragment",children:[]})}function h(X,te,ye){this.stack[this.stack.length-1].children.push(X),this.stack.push(X),this.tokenStack.push([te,ye||void 0]),X.position={start:yl(te.start),end:void 0}}function m(X){return te;function te(ye){X&&X.call(this,ye),p.call(this,ye)}}function p(X,te){const ye=this.stack.pop(),Ce=this.tokenStack.pop();if(Ce)Ce[0].type!==X.type&&(te?te.call(this,X,Ce[0]):(Ce[1]||Tm).call(this,X,Ce[0]));else throw new Error("Cannot close `"+X.type+"` ("+Ma({start:X.start,end:X.end})+"): it\u2019s not open");ye.position.end=yl(X.end)}function v(){return Ns(this.stack.pop())}function g(){this.data.expectingFirstListItemValue=!0}function x(X){if(this.data.expectingFirstListItemValue){const te=this.stack[this.stack.length-2];te.start=Number.parseInt(this.sliceSerialize(X),10),this.data.expectingFirstListItemValue=void 0}}function E(){const X=this.resume(),te=this.stack[this.stack.length-1];te.lang=X}function C(){const X=this.resume(),te=this.stack[this.stack.length-1];te.meta=X}function H(){this.data.flowCodeInside||(this.buffer(),this.data.flowCodeInside=!0)}function B(){const X=this.resume(),te=this.stack[this.stack.length-1];te.value=X.replace(/^(\\r?\\n|\\r)|(\\r?\\n|\\r)$/g,""),this.data.flowCodeInside=void 0}function O(){const X=this.resume(),te=this.stack[this.stack.length-1];te.value=X.replace(/(\\r?\\n|\\r)$/g,"")}function K(X){const te=this.resume(),ye=this.stack[this.stack.length-1];ye.label=te,ye.identifier=pn(this.sliceSerialize(X)).toLowerCase()}function V(){const X=this.resume(),te=this.stack[this.stack.length-1];te.title=X}function le(){const X=this.resume(),te=this.stack[this.stack.length-1];te.url=X}function ue(X){const te=this.stack[this.stack.length-1];if(!te.depth){const ye=this.sliceSerialize(X).length;te.depth=ye}}function L(){this.data.setextHeadingSlurpLineEnding=!0}function P(X){const te=this.stack[this.stack.length-1];te.depth=this.sliceSerialize(X).codePointAt(0)===61?1:2}function se(){this.data.setextHeadingSlurpLineEnding=void 0}function ge(X){const ye=this.stack[this.stack.length-1].children;let Ce=ye[ye.length-1];(!Ce||Ce.type!=="text")&&(Ce=Ct(),Ce.position={start:yl(X.start),end:void 0},ye.push(Ce)),this.stack.push(Ce)}function U(X){const te=this.stack.pop();te.value+=this.sliceSerialize(X),te.position.end=yl(X.end)}function ie(X){const te=this.stack[this.stack.length-1];if(this.data.atHardBreak){const ye=te.children[te.children.length-1];ye.position.end=yl(X.end),this.data.atHardBreak=void 0;return}!this.data.setextHeadingSlurpLineEnding&&a.canContainEols.includes(te.type)&&(ge.call(this,X),U.call(this,X))}function ne(){this.data.atHardBreak=!0}function be(){const X=this.resume(),te=this.stack[this.stack.length-1];te.value=X}function ae(){const X=this.resume(),te=this.stack[this.stack.length-1];te.value=X}function $(){const X=this.resume(),te=this.stack[this.stack.length-1];te.value=X}function D(){const X=this.stack[this.stack.length-1];if(this.data.inReference){const te=this.data.referenceType||"shortcut";X.type+="Reference",X.referenceType=te,delete X.url,delete X.title}else delete X.identifier,delete X.label;this.data.referenceType=void 0}function Z(){const X=this.stack[this.stack.length-1];if(this.data.inReference){const te=this.data.referenceType||"shortcut";X.type+="Reference",X.referenceType=te,delete X.url,delete X.title}else delete X.identifier,delete X.label;this.data.referenceType=void 0}function ce(X){const te=this.sliceSerialize(X),ye=this.stack[this.stack.length-2];ye.label=cx(te),ye.identifier=pn(te).toLowerCase()}function Se(){const X=this.stack[this.stack.length-1],te=this.resume(),ye=this.stack[this.stack.length-1];if(this.data.inReference=!0,ye.type==="link"){const Ce=X.children;ye.children=Ce}else ye.alt=te}function k(){const X=this.resume(),te=this.stack[this.stack.length-1];te.url=X}function w(){const X=this.resume(),te=this.stack[this.stack.length-1];te.title=X}function q(){this.data.inReference=void 0}function b(){this.data.referenceType="collapsed"}function _(X){const te=this.resume(),ye=this.stack[this.stack.length-1];ye.label=te,ye.identifier=pn(this.sliceSerialize(X)).toLowerCase(),this.data.referenceType="full"}function G(X){this.data.characterReferenceType=X.type}function F(X){const te=this.sliceSerialize(X),ye=this.data.characterReferenceType;let Ce;ye?(Ce=vg(te,ye==="characterReferenceMarkerNumeric"?10:16),this.data.characterReferenceType=void 0):Ce=Ls(te);const qe=this.stack[this.stack.length-1];qe.value+=Ce}function ee(X){const te=this.stack.pop();te.position.end=yl(X.end)}function re(X){U.call(this,X);const te=this.stack[this.stack.length-1];te.url=this.sliceSerialize(X)}function de(X){U.call(this,X);const te=this.stack[this.stack.length-1];te.url="mailto:"+this.sliceSerialize(X)}function we(){return{type:"blockquote",children:[]}}function Ze(){return{type:"code",lang:null,meta:null,value:""}}function Te(){return{type:"inlineCode",value:""}}function Le(){return{type:"definition",identifier:"",label:null,title:null,url:""}}function Ue(){return{type:"emphasis",children:[]}}function tt(){return{type:"heading",depth:0,children:[]}}function mt(){return{type:"break"}}function gt(){return{type:"html",value:""}}function kn(){return{type:"image",title:null,url:"",alt:null}}function An(){return{type:"link",title:null,url:"",children:[]}}function mn(X){return{type:"list",ordered:X.type==="listOrdered",start:null,spread:X._spread,children:[]}}function Qn(X){return{type:"listItem",spread:X._spread,checked:null,children:[]}}function Eu(){return{type:"paragraph",children:[]}}function ku(){return{type:"strong",children:[]}}function Ct(){return{type:"text",value:""}}function Au(){return{type:"thematicBreak"}}}function yl(n){return{line:n.line,column:n.column,offset:n.offset}}function _g(n,a){let r=-1;for(;++r<a.length;){const u=a[r];Array.isArray(u)?_g(n,u):hx(n,u)}}function hx(n,a){let r;for(r in a)if(zg.call(a,r))switch(r){case"canContainEols":{const u=a[r];u&&n[r].push(...u);break}case"transforms":{const u=a[r];u&&n[r].push(...u);break}case"enter":case"exit":{const u=a[r];u&&Object.assign(n[r],u);break}}}function Tm(n,a){throw n?new Error("Cannot close `"+n.type+"` ("+Ma({start:n.start,end:n.end})+"): a different token (`"+a.type+"`, "+Ma({start:a.start,end:a.end})+") is open"):new Error("Cannot close document, a token (`"+a.type+"`, "+Ma({start:a.start,end:a.end})+") is still open")}function px(n){const a=this;a.parser=r;function r(u){return fx(u,{...a.data("settings"),...n,extensions:a.data("micromarkExtensions")||[],mdastExtensions:a.data("fromMarkdownExtensions")||[]})}}function mx(n,a){const r={type:"element",tagName:"blockquote",properties:{},children:n.wrap(n.all(a),!0)};return n.patch(a,r),n.applyData(a,r)}function gx(n,a){const r={type:"element",tagName:"br",properties:{},children:[]};return n.patch(a,r),[n.applyData(a,r),{type:"text",value:`\n`}]}function yx(n,a){const r=a.value?a.value+`\n`:"",u={},c=a.lang?a.lang.split(/\\s+/):[];c.length>0&&(u.className=["language-"+c[0]]);let f={type:"element",tagName:"code",properties:u,children:[{type:"text",value:r}]};return a.meta&&(f.data={meta:a.meta}),n.patch(a,f),f=n.applyData(a,f),f={type:"element",tagName:"pre",properties:{},children:[f]},n.patch(a,f),f}function vx(n,a){const r={type:"element",tagName:"del",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function bx(n,a){const r={type:"element",tagName:"em",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function Sx(n,a){const r=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",u=String(a.identifier).toUpperCase(),c=Mi(u.toLowerCase()),f=n.footnoteOrder.indexOf(u);let d,h=n.footnoteCounts.get(u);h===void 0?(h=0,n.footnoteOrder.push(u),d=n.footnoteOrder.length):d=f+1,h+=1,n.footnoteCounts.set(u,h);const m={type:"element",tagName:"a",properties:{href:"#"+r+"fn-"+c,id:r+"fnref-"+c+(h>1?"-"+h:""),dataFootnoteRef:!0,ariaDescribedBy:["footnote-label"]},children:[{type:"text",value:String(d)}]};n.patch(a,m);const p={type:"element",tagName:"sup",properties:{},children:[m]};return n.patch(a,p),n.applyData(a,p)}function xx(n,a){const r={type:"element",tagName:"h"+a.depth,properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function Ex(n,a){if(n.options.allowDangerousHtml){const r={type:"raw",value:a.value};return n.patch(a,r),n.applyData(a,r)}}function Og(n,a){const r=a.referenceType;let u="]";if(r==="collapsed"?u+="[]":r==="full"&&(u+="["+(a.label||a.identifier)+"]"),a.type==="imageReference")return[{type:"text",value:"!["+a.alt+u}];const c=n.all(a),f=c[0];f&&f.type==="text"?f.value="["+f.value:c.unshift({type:"text",value:"["});const d=c[c.length-1];return d&&d.type==="text"?d.value+=u:c.push({type:"text",value:u}),c}function kx(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return Og(n,a);const c={src:Mi(u.url||""),alt:a.alt};u.title!==null&&u.title!==void 0&&(c.title=u.title);const f={type:"element",tagName:"img",properties:c,children:[]};return n.patch(a,f),n.applyData(a,f)}function Ax(n,a){const r={src:Mi(a.url)};a.alt!==null&&a.alt!==void 0&&(r.alt=a.alt),a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"img",properties:r,children:[]};return n.patch(a,u),n.applyData(a,u)}function wx(n,a){const r={type:"text",value:a.value.replace(/\\r?\\n|\\r/g," ")};n.patch(a,r);const u={type:"element",tagName:"code",properties:{},children:[r]};return n.patch(a,u),n.applyData(a,u)}function Tx(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return Og(n,a);const c={href:Mi(u.url||"")};u.title!==null&&u.title!==void 0&&(c.title=u.title);const f={type:"element",tagName:"a",properties:c,children:n.all(a)};return n.patch(a,f),n.applyData(a,f)}function Cx(n,a){const r={href:Mi(a.url)};a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"a",properties:r,children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function zx(n,a,r){const u=n.all(a),c=r?_x(r):Dg(a),f={},d=[];if(typeof a.checked=="boolean"){const v=u[0];let g;v&&v.type==="element"&&v.tagName==="p"?g=v:(g={type:"element",tagName:"p",properties:{},children:[]},u.unshift(g)),g.children.length>0&&g.children.unshift({type:"text",value:" "}),g.children.unshift({type:"element",tagName:"input",properties:{type:"checkbox",checked:a.checked,disabled:!0},children:[]}),f.className=["task-list-item"]}let h=-1;for(;++h<u.length;){const v=u[h];(c||h!==0||v.type!=="element"||v.tagName!=="p")&&d.push({type:"text",value:`\n`}),v.type==="element"&&v.tagName==="p"&&!c?d.push(...v.children):d.push(v)}const m=u[u.length-1];m&&(c||m.type!=="element"||m.tagName!=="p")&&d.push({type:"text",value:`\n`});const p={type:"element",tagName:"li",properties:f,children:d};return n.patch(a,p),n.applyData(a,p)}function _x(n){let a=!1;if(n.type==="list"){a=n.spread||!1;const r=n.children;let u=-1;for(;!a&&++u<r.length;)a=Dg(r[u])}return a}function Dg(n){const a=n.spread;return a??n.children.length>1}function Ox(n,a){const r={},u=n.all(a);let c=-1;for(typeof a.start=="number"&&a.start!==1&&(r.start=a.start);++c<u.length;){const d=u[c];if(d.type==="element"&&d.tagName==="li"&&d.properties&&Array.isArray(d.properties.className)&&d.properties.className.includes("task-list-item")){r.className=["contains-task-list"];break}}const f={type:"element",tagName:a.ordered?"ol":"ul",properties:r,children:n.wrap(u,!0)};return n.patch(a,f),n.applyData(a,f)}function Dx(n,a){const r={type:"element",tagName:"p",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function Mx(n,a){const r={type:"root",children:n.wrap(n.all(a))};return n.patch(a,r),n.applyData(a,r)}function Rx(n,a){const r={type:"element",tagName:"strong",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function Nx(n,a){const r=n.all(a),u=r.shift(),c=[];if(u){const d={type:"element",tagName:"thead",properties:{},children:n.wrap([u],!0)};n.patch(a.children[0],d),c.push(d)}if(r.length>0){const d={type:"element",tagName:"tbody",properties:{},children:n.wrap(r,!0)},h=Os(a.children[1]),m=sg(a.children[a.children.length-1]);h&&m&&(d.position={start:h,end:m}),c.push(d)}const f={type:"element",tagName:"table",properties:{},children:n.wrap(c,!0)};return n.patch(a,f),n.applyData(a,f)}function Lx(n,a,r){const u=r?r.children:void 0,f=(u?u.indexOf(a):1)===0?"th":"td",d=r&&r.type==="table"?r.align:void 0,h=d?d.length:a.children.length;let m=-1;const p=[];for(;++m<h;){const g=a.children[m],x={},E=d?d[m]:void 0;E&&(x.align=E);let C={type:"element",tagName:f,properties:x,children:[]};g&&(C.children=n.all(g),n.patch(g,C),C=n.applyData(g,C)),p.push(C)}const v={type:"element",tagName:"tr",properties:{},children:n.wrap(p,!0)};return n.patch(a,v),n.applyData(a,v)}function Ux(n,a){const r={type:"element",tagName:"td",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}const Cm=9,zm=32;function jx(n){const a=String(n),r=/\\r?\\n|\\r/g;let u=r.exec(a),c=0;const f=[];for(;u;)f.push(_m(a.slice(c,u.index),c>0,!0),u[0]),c=u.index+u[0].length,u=r.exec(a);return f.push(_m(a.slice(c),c>0,!1)),f.join("")}function _m(n,a,r){let u=0,c=n.length;if(a){let f=n.codePointAt(u);for(;f===Cm||f===zm;)u++,f=n.codePointAt(u)}if(r){let f=n.codePointAt(c-1);for(;f===Cm||f===zm;)c--,f=n.codePointAt(c-1)}return c>u?n.slice(u,c):""}function Bx(n,a){const r={type:"text",value:jx(String(a.value))};return n.patch(a,r),n.applyData(a,r)}function Hx(n,a){const r={type:"element",tagName:"hr",properties:{},children:[]};return n.patch(a,r),n.applyData(a,r)}const qx={blockquote:mx,break:gx,code:yx,delete:vx,emphasis:bx,footnoteReference:Sx,heading:xx,html:Ex,imageReference:kx,image:Ax,inlineCode:wx,linkReference:Tx,link:Cx,listItem:zx,list:Ox,paragraph:Dx,root:Mx,strong:Rx,table:Nx,tableCell:Ux,tableRow:Lx,text:Bx,thematicBreak:Hx,toml:lu,yaml:lu,definition:lu,footnoteDefinition:lu};function lu(){}const Mg=-1,bu=0,Na=1,pu=2,js=3,Bs=4,Hs=5,qs=6,Rg=7,Ng=8,Yx=typeof self=="object"?self:globalThis,Om=(n,a)=>{switch(n){case"Function":case"SharedWorker":case"Worker":case"eval":case"setInterval":case"setTimeout":throw new TypeError("unable to deserialize "+n)}return new Yx[n](a)},Vx=(n,a)=>{const r=(c,f)=>(n.set(f,c),c),u=c=>{if(n.has(c))return n.get(c);const[f,d]=a[c];switch(f){case bu:case Mg:return r(d,c);case Na:{const h=r([],c);for(const m of d)h.push(u(m));return h}case pu:{const h=r({},c);for(const[m,p]of d)h[u(m)]=u(p);return h}case js:return r(new Date(d),c);case Bs:{const{source:h,flags:m}=d;return r(new RegExp(h,m),c)}case Hs:{const h=r(new Map,c);for(const[m,p]of d)h.set(u(m),u(p));return h}case qs:{const h=r(new Set,c);for(const m of d)h.add(u(m));return h}case Rg:{const{name:h,message:m}=d;return r(Om(h,m),c)}case Ng:return r(BigInt(d),c);case"BigInt":return r(Object(BigInt(d)),c);case"ArrayBuffer":return r(new Uint8Array(d).buffer,d);case"DataView":{const{buffer:h}=new Uint8Array(d);return r(new DataView(h),d)}}return r(Om(f,d),c)};return u},Dm=n=>Vx(new Map,n)(0),Ti="",{toString:Gx}={},{keys:Xx}=Object,Oa=n=>{const a=typeof n;if(a!=="object"||!n)return[bu,a];const r=Gx.call(n).slice(8,-1);switch(r){case"Array":return[Na,Ti];case"Object":return[pu,Ti];case"Date":return[js,Ti];case"RegExp":return[Bs,Ti];case"Map":return[Hs,Ti];case"Set":return[qs,Ti];case"DataView":return[Na,r]}return r.includes("Array")?[Na,r]:r.includes("Error")?[Rg,r]:[pu,r]},iu=([n,a])=>n===bu&&(a==="function"||a==="symbol"),Qx=(n,a,r,u)=>{const c=(d,h)=>{const m=u.push(d)-1;return r.set(h,m),m},f=d=>{if(r.has(d))return r.get(d);let[h,m]=Oa(d);switch(h){case bu:{let v=d;switch(m){case"bigint":h=Ng,v=d.toString();break;case"function":case"symbol":if(n)throw new TypeError("unable to serialize "+m);v=null;break;case"undefined":return c([Mg],d)}return c([h,v],d)}case Na:{if(m){let x=d;return m==="DataView"?x=new Uint8Array(d.buffer):m==="ArrayBuffer"&&(x=new Uint8Array(d)),c([m,[...x]],d)}const v=[],g=c([h,v],d);for(const x of d)v.push(f(x));return g}case pu:{if(m)switch(m){case"BigInt":return c([m,d.toString()],d);case"Boolean":case"Number":case"String":return c([m,d.valueOf()],d)}if(a&&"toJSON"in d)return f(d.toJSON());const v=[],g=c([h,v],d);for(const x of Xx(d))(n||!iu(Oa(d[x])))&&v.push([f(x),f(d[x])]);return g}case js:return c([h,d.toISOString()],d);case Bs:{const{source:v,flags:g}=d;return c([h,{source:v,flags:g}],d)}case Hs:{const v=[],g=c([h,v],d);for(const[x,E]of d)(n||!(iu(Oa(x))||iu(Oa(E))))&&v.push([f(x),f(E)]);return g}case qs:{const v=[],g=c([h,v],d);for(const x of d)(n||!iu(Oa(x)))&&v.push(f(x));return g}}const{message:p}=d;return c([h,{name:m,message:p}],d)};return f},Mm=(n,{json:a,lossy:r}={})=>{const u=[];return Qx(!(a||r),!!a,new Map,u)(n),u},mu=typeof structuredClone=="function"?(n,a)=>a&&("json"in a||"lossy"in a)?Dm(Mm(n,a)):structuredClone(n):(n,a)=>Dm(Mm(n,a));function Ix(n,a){const r=[{type:"text",value:"\u21A9"}];return a>1&&r.push({type:"element",tagName:"sup",properties:{},children:[{type:"text",value:String(a)}]}),r}function Zx(n,a){return"Back to reference "+(n+1)+(a>1?"-"+a:"")}function Fx(n){const a=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",r=n.options.footnoteBackContent||Ix,u=n.options.footnoteBackLabel||Zx,c=n.options.footnoteLabel||"Footnotes",f=n.options.footnoteLabelTagName||"h2",d=n.options.footnoteLabelProperties||{className:["sr-only"]},h=[];let m=-1;for(;++m<n.footnoteOrder.length;){const p=n.footnoteById.get(n.footnoteOrder[m]);if(!p)continue;const v=n.all(p),g=String(p.identifier).toUpperCase(),x=Mi(g.toLowerCase());let E=0;const C=[],H=n.footnoteCounts.get(g);for(;H!==void 0&&++E<=H;){C.length>0&&C.push({type:"text",value:" "});let K=typeof r=="string"?r:r(m,E);typeof K=="string"&&(K={type:"text",value:K}),C.push({type:"element",tagName:"a",properties:{href:"#"+a+"fnref-"+x+(E>1?"-"+E:""),dataFootnoteBackref:"",ariaLabel:typeof u=="string"?u:u(m,E),className:["data-footnote-backref"]},children:Array.isArray(K)?K:[K]})}const B=v[v.length-1];if(B&&B.type==="element"&&B.tagName==="p"){const K=B.children[B.children.length-1];K&&K.type==="text"?K.value+=" ":B.children.push({type:"text",value:" "}),B.children.push(...C)}else v.push(...C);const O={type:"element",tagName:"li",properties:{id:a+"fn-"+x},children:n.wrap(v,!0)};n.patch(p,O),h.push(O)}if(h.length!==0)return{type:"element",tagName:"section",properties:{dataFootnotes:!0,className:["footnotes"]},children:[{type:"element",tagName:f,properties:{...mu(d),id:"footnote-label"},children:[{type:"text",value:c}]},{type:"text",value:`\n`},{type:"element",tagName:"ol",properties:{},children:n.wrap(h,!0)},{type:"text",value:`\n`}]}}const Su=(function(n){if(n==null)return $x;if(typeof n=="function")return xu(n);if(typeof n=="object")return Array.isArray(n)?Kx(n):Jx(n);if(typeof n=="string")return Wx(n);throw new Error("Expected function, string, or object as test")});function Kx(n){const a=[];let r=-1;for(;++r<n.length;)a[r]=Su(n[r]);return xu(u);function u(...c){let f=-1;for(;++f<a.length;)if(a[f].apply(this,c))return!0;return!1}}function Jx(n){const a=n;return xu(r);function r(u){const c=u;let f;for(f in n)if(c[f]!==a[f])return!1;return!0}}function Wx(n){return xu(a);function a(r){return r&&r.type===n}}function xu(n){return a;function a(r,u,c){return!!(Px(r)&&n.call(this,r,typeof u=="number"?u:void 0,c||void 0))}}function $x(){return!0}function Px(n){return n!==null&&typeof n=="object"&&"type"in n}const Lg=[],eE=!0,bs=!1,tE="skip";function Ug(n,a,r,u){let c;typeof a=="function"&&typeof r!="function"?(u=r,r=a):c=a;const f=Su(c),d=u?-1:1;h(n,void 0,[])();function h(m,p,v){const g=m&&typeof m=="object"?m:{};if(typeof g.type=="string"){const E=typeof g.tagName=="string"?g.tagName:typeof g.name=="string"?g.name:void 0;Object.defineProperty(x,"name",{value:"node ("+(m.type+(E?"<"+E+">":""))+")"})}return x;function x(){let E=Lg,C,H,B;if((!a||f(m,p,v[v.length-1]||void 0))&&(E=nE(r(m,v)),E[0]===bs))return E;if("children"in m&&m.children){const O=m;if(O.children&&E[0]!==tE)for(H=(u?O.children.length:-1)+d,B=v.concat(O);H>-1&&H<O.children.length;){const K=O.children[H];if(C=h(K,H,B)(),C[0]===bs)return C;H=typeof C[1]=="number"?C[1]:H+d}}return E}}}function nE(n){return Array.isArray(n)?n:typeof n=="number"?[eE,n]:n==null?Lg:[n]}function Ys(n,a,r,u){let c,f,d;typeof a=="function"&&typeof r!="function"?(f=void 0,d=a,c=r):(f=a,d=r,c=u),Ug(n,f,h,c);function h(m,p){const v=p[p.length-1],g=v?v.children.indexOf(m):void 0;return d(m,g,v)}}const Ss={}.hasOwnProperty,lE={};function iE(n,a){const r=a||lE,u=new Map,c=new Map,f=new Map,d={...qx,...r.handlers},h={all:p,applyData:rE,definitionById:u,footnoteById:c,footnoteCounts:f,footnoteOrder:[],handlers:d,one:m,options:r,patch:aE,wrap:oE};return Ys(n,function(v){if(v.type==="definition"||v.type==="footnoteDefinition"){const g=v.type==="definition"?u:c,x=String(v.identifier).toUpperCase();g.has(x)||g.set(x,v)}}),h;function m(v,g){const x=v.type,E=h.handlers[x];if(Ss.call(h.handlers,x)&&E)return E(h,v,g);if(h.options.passThrough&&h.options.passThrough.includes(x)){if("children"in v){const{children:H,...B}=v,O=mu(B);return O.children=h.all(v),O}return mu(v)}return(h.options.unknownHandler||uE)(h,v,g)}function p(v){const g=[];if("children"in v){const x=v.children;let E=-1;for(;++E<x.length;){const C=h.one(x[E],v);if(C){if(E&&x[E-1].type==="break"&&(!Array.isArray(C)&&C.type==="text"&&(C.value=Rm(C.value)),!Array.isArray(C)&&C.type==="element")){const H=C.children[0];H&&H.type==="text"&&(H.value=Rm(H.value))}Array.isArray(C)?g.push(...C):g.push(C)}}}return g}}function aE(n,a){n.position&&(a.position=I0(n))}function rE(n,a){let r=a;if(n&&n.data){const u=n.data.hName,c=n.data.hChildren,f=n.data.hProperties;if(typeof u=="string")if(r.type==="element")r.tagName=u;else{const d="children"in r?r.children:[r];r={type:"element",tagName:u,properties:{},children:d}}r.type==="element"&&f&&Object.assign(r.properties,mu(f)),"children"in r&&r.children&&c!==null&&c!==void 0&&(r.children=c)}return r}function uE(n,a){const r=a.data||{},u="value"in a&&!(Ss.call(r,"hProperties")||Ss.call(r,"hChildren"))?{type:"text",value:a.value}:{type:"element",tagName:"div",properties:{},children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function oE(n,a){const r=[];let u=-1;for(a&&r.push({type:"text",value:`\n`});++u<n.length;)u&&r.push({type:"text",value:`\n`}),r.push(n[u]);return a&&n.length>0&&r.push({type:"text",value:`\n`}),r}function Rm(n){let a=0,r=n.charCodeAt(a);for(;r===9||r===32;)a++,r=n.charCodeAt(a);return n.slice(a)}function Nm(n,a){const r=iE(n,a),u=r.one(n,void 0),c=Fx(r),f=Array.isArray(u)?{type:"root",children:u}:u||{type:"root",children:[]};return c&&f.children.push({type:"text",value:`\n`},c),f}function cE(n,a){return n&&"run"in n?async function(r,u){const c=Nm(r,{file:u,...a});await n.run(c,u)}:function(r,u){return Nm(r,{file:u,...n||a})}}function Lm(n){if(n)throw n}var Wc,Um;function sE(){if(Um)return Wc;Um=1;var n=Object.prototype.hasOwnProperty,a=Object.prototype.toString,r=Object.defineProperty,u=Object.getOwnPropertyDescriptor,c=function(p){return typeof Array.isArray=="function"?Array.isArray(p):a.call(p)==="[object Array]"},f=function(p){if(!p||a.call(p)!=="[object Object]")return!1;var v=n.call(p,"constructor"),g=p.constructor&&p.constructor.prototype&&n.call(p.constructor.prototype,"isPrototypeOf");if(p.constructor&&!v&&!g)return!1;var x;for(x in p);return typeof x>"u"||n.call(p,x)},d=function(p,v){r&&v.name==="__proto__"?r(p,v.name,{enumerable:!0,configurable:!0,value:v.newValue,writable:!0}):p[v.name]=v.newValue},h=function(p,v){if(v==="__proto__")if(n.call(p,v)){if(u)return u(p,v).value}else return;return p[v]};return Wc=function m(){var p,v,g,x,E,C,H=arguments[0],B=1,O=arguments.length,K=!1;for(typeof H=="boolean"&&(K=H,H=arguments[1]||{},B=2),(H==null||typeof H!="object"&&typeof H!="function")&&(H={});B<O;++B)if(p=arguments[B],p!=null)for(v in p)g=h(H,v),x=h(p,v),H!==x&&(K&&x&&(f(x)||(E=c(x)))?(E?(E=!1,C=g&&c(g)?g:[]):C=g&&f(g)?g:{},d(H,{name:v,newValue:m(K,C,x)})):typeof x<"u"&&d(H,{name:v,newValue:x}));return H},Wc}var fE=sE();const $c=As(fE);function xs(n){if(typeof n!="object"||n===null)return!1;const a=Object.getPrototypeOf(n);return(a===null||a===Object.prototype||Object.getPrototypeOf(a)===null)&&!(Symbol.toStringTag in n)&&!(Symbol.iterator in n)}function dE(){const n=[],a={run:r,use:u};return a;function r(...c){let f=-1;const d=c.pop();if(typeof d!="function")throw new TypeError("Expected function as last argument, not "+d);h(null,...c);function h(m,...p){const v=n[++f];let g=-1;if(m){d(m);return}for(;++g<c.length;)(p[g]===null||p[g]===void 0)&&(p[g]=c[g]);c=p,v?hE(v,h)(...p):d(null,...p)}}function u(c){if(typeof c!="function")throw new TypeError("Expected `middelware` to be a function, not "+c);return n.push(c),a}}function hE(n,a){let r;return u;function u(...d){const h=n.length>d.length;let m;h&&d.push(c);try{m=n.apply(this,d)}catch(p){const v=p;if(h&&r)throw v;return c(v)}h||(m&&m.then&&typeof m.then=="function"?m.then(f,c):m instanceof Error?c(m):f(m))}function c(d,...h){r||(r=!0,a(d,...h))}function f(d){c(null,d)}}const Sn={basename:pE,dirname:mE,extname:gE,join:yE,sep:"/"};function pE(n,a){if(a!==void 0&&typeof a!="string")throw new TypeError(\'"ext" argument must be a string\');Ha(n);let r=0,u=-1,c=n.length,f;if(a===void 0||a.length===0||a.length>n.length){for(;c--;)if(n.codePointAt(c)===47){if(f){r=c+1;break}}else u<0&&(f=!0,u=c+1);return u<0?"":n.slice(r,u)}if(a===n)return"";let d=-1,h=a.length-1;for(;c--;)if(n.codePointAt(c)===47){if(f){r=c+1;break}}else d<0&&(f=!0,d=c+1),h>-1&&(n.codePointAt(c)===a.codePointAt(h--)?h<0&&(u=c):(h=-1,u=d));return r===u?u=d:u<0&&(u=n.length),n.slice(r,u)}function mE(n){if(Ha(n),n.length===0)return".";let a=-1,r=n.length,u;for(;--r;)if(n.codePointAt(r)===47){if(u){a=r;break}}else u||(u=!0);return a<0?n.codePointAt(0)===47?"/":".":a===1&&n.codePointAt(0)===47?"//":n.slice(0,a)}function gE(n){Ha(n);let a=n.length,r=-1,u=0,c=-1,f=0,d;for(;a--;){const h=n.codePointAt(a);if(h===47){if(d){u=a+1;break}continue}r<0&&(d=!0,r=a+1),h===46?c<0?c=a:f!==1&&(f=1):c>-1&&(f=-1)}return c<0||r<0||f===0||f===1&&c===r-1&&c===u+1?"":n.slice(c,r)}function yE(...n){let a=-1,r;for(;++a<n.length;)Ha(n[a]),n[a]&&(r=r===void 0?n[a]:r+"/"+n[a]);return r===void 0?".":vE(r)}function vE(n){Ha(n);const a=n.codePointAt(0)===47;let r=bE(n,!a);return r.length===0&&!a&&(r="."),r.length>0&&n.codePointAt(n.length-1)===47&&(r+="/"),a?"/"+r:r}function bE(n,a){let r="",u=0,c=-1,f=0,d=-1,h,m;for(;++d<=n.length;){if(d<n.length)h=n.codePointAt(d);else{if(h===47)break;h=47}if(h===47){if(!(c===d-1||f===1))if(c!==d-1&&f===2){if(r.length<2||u!==2||r.codePointAt(r.length-1)!==46||r.codePointAt(r.length-2)!==46){if(r.length>2){if(m=r.lastIndexOf("/"),m!==r.length-1){m<0?(r="",u=0):(r=r.slice(0,m),u=r.length-1-r.lastIndexOf("/")),c=d,f=0;continue}}else if(r.length>0){r="",u=0,c=d,f=0;continue}}a&&(r=r.length>0?r+"/..":"..",u=2)}else r.length>0?r+="/"+n.slice(c+1,d):r=n.slice(c+1,d),u=d-c-1;c=d,f=0}else h===46&&f>-1?f++:f=-1}return r}function Ha(n){if(typeof n!="string")throw new TypeError("Path must be a string. Received "+JSON.stringify(n))}const SE={cwd:xE};function xE(){return"/"}function Es(n){return!!(n!==null&&typeof n=="object"&&"href"in n&&n.href&&"protocol"in n&&n.protocol&&n.auth===void 0)}function EE(n){if(typeof n=="string")n=new URL(n);else if(!Es(n)){const a=new TypeError(\'The "path" argument must be of type string or an instance of URL. Received `\'+n+"`");throw a.code="ERR_INVALID_ARG_TYPE",a}if(n.protocol!=="file:"){const a=new TypeError("The URL must be of scheme file");throw a.code="ERR_INVALID_URL_SCHEME",a}return kE(n)}function kE(n){if(n.hostname!==""){const u=new TypeError(\'File URL host must be "localhost" or empty on darwin\');throw u.code="ERR_INVALID_FILE_URL_HOST",u}const a=n.pathname;let r=-1;for(;++r<a.length;)if(a.codePointAt(r)===37&&a.codePointAt(r+1)===50){const u=a.codePointAt(r+2);if(u===70||u===102){const c=new TypeError("File URL path must not include encoded / characters");throw c.code="ERR_INVALID_FILE_URL_PATH",c}}return decodeURIComponent(a)}const Pc=["history","path","basename","stem","extname","dirname"];class jg{constructor(a){let r;a?Es(a)?r={path:a}:typeof a=="string"||AE(a)?r={value:a}:r=a:r={},this.cwd="cwd"in r?"":SE.cwd(),this.data={},this.history=[],this.messages=[],this.value,this.map,this.result,this.stored;let u=-1;for(;++u<Pc.length;){const f=Pc[u];f in r&&r[f]!==void 0&&r[f]!==null&&(this[f]=f==="history"?[...r[f]]:r[f])}let c;for(c in r)Pc.includes(c)||(this[c]=r[c])}get basename(){return typeof this.path=="string"?Sn.basename(this.path):void 0}set basename(a){ts(a,"basename"),es(a,"basename"),this.path=Sn.join(this.dirname||"",a)}get dirname(){return typeof this.path=="string"?Sn.dirname(this.path):void 0}set dirname(a){jm(this.basename,"dirname"),this.path=Sn.join(a||"",this.basename)}get extname(){return typeof this.path=="string"?Sn.extname(this.path):void 0}set extname(a){if(es(a,"extname"),jm(this.dirname,"extname"),a){if(a.codePointAt(0)!==46)throw new Error("`extname` must start with `.`");if(a.includes(".",1))throw new Error("`extname` cannot contain multiple dots")}this.path=Sn.join(this.dirname,this.stem+(a||""))}get path(){return this.history[this.history.length-1]}set path(a){Es(a)&&(a=EE(a)),ts(a,"path"),this.path!==a&&this.history.push(a)}get stem(){return typeof this.path=="string"?Sn.basename(this.path,this.extname):void 0}set stem(a){ts(a,"stem"),es(a,"stem"),this.path=Sn.join(this.dirname||"",a+(this.extname||""))}fail(a,r,u){const c=this.message(a,r,u);throw c.fatal=!0,c}info(a,r,u){const c=this.message(a,r,u);return c.fatal=void 0,c}message(a,r,u){const c=new Tt(a,r,u);return this.path&&(c.name=this.path+":"+c.name,c.file=this.path),c.fatal=!1,this.messages.push(c),c}toString(a){return this.value===void 0?"":typeof this.value=="string"?this.value:new TextDecoder(a||void 0).decode(this.value)}}function es(n,a){if(n&&n.includes(Sn.sep))throw new Error("`"+a+"` cannot be a path: did not expect `"+Sn.sep+"`")}function ts(n,a){if(!n)throw new Error("`"+a+"` cannot be empty")}function jm(n,a){if(!n)throw new Error("Setting `"+a+"` requires `path` to be set too")}function AE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const wE=(function(n){const u=this.constructor.prototype,c=u[n],f=function(){return c.apply(f,arguments)};return Object.setPrototypeOf(f,u),f}),TE={}.hasOwnProperty;class Vs extends wE{constructor(){super("copy"),this.Compiler=void 0,this.Parser=void 0,this.attachers=[],this.compiler=void 0,this.freezeIndex=-1,this.frozen=void 0,this.namespace={},this.parser=void 0,this.transformers=dE()}copy(){const a=new Vs;let r=-1;for(;++r<this.attachers.length;){const u=this.attachers[r];a.use(...u)}return a.data($c(!0,{},this.namespace)),a}data(a,r){return typeof a=="string"?arguments.length===2?(is("data",this.frozen),this.namespace[a]=r,this):TE.call(this.namespace,a)&&this.namespace[a]||void 0:a?(is("data",this.frozen),this.namespace=a,this):this.namespace}freeze(){if(this.frozen)return this;const a=this;for(;++this.freezeIndex<this.attachers.length;){const[r,...u]=this.attachers[this.freezeIndex];if(u[0]===!1)continue;u[0]===!0&&(u[0]=void 0);const c=r.call(a,...u);typeof c=="function"&&this.transformers.use(c)}return this.frozen=!0,this.freezeIndex=Number.POSITIVE_INFINITY,this}parse(a){this.freeze();const r=au(a),u=this.parser||this.Parser;return ns("parse",u),u(String(r),r)}process(a,r){const u=this;return this.freeze(),ns("process",this.parser||this.Parser),ls("process",this.compiler||this.Compiler),r?c(void 0,r):new Promise(c);function c(f,d){const h=au(a),m=u.parse(h);u.run(m,h,function(v,g,x){if(v||!g||!x)return p(v);const E=g,C=u.stringify(E,x);_E(C)?x.value=C:x.result=C,p(v,x)});function p(v,g){v||!g?d(v):f?f(g):r(void 0,g)}}}processSync(a){let r=!1,u;return this.freeze(),ns("processSync",this.parser||this.Parser),ls("processSync",this.compiler||this.Compiler),this.process(a,c),Hm("processSync","process",r),u;function c(f,d){r=!0,Lm(f),u=d}}run(a,r,u){Bm(a),this.freeze();const c=this.transformers;return!u&&typeof r=="function"&&(u=r,r=void 0),u?f(void 0,u):new Promise(f);function f(d,h){const m=au(r);c.run(a,m,p);function p(v,g,x){const E=g||a;v?h(v):d?d(E):u(void 0,E,x)}}}runSync(a,r){let u=!1,c;return this.run(a,r,f),Hm("runSync","run",u),c;function f(d,h){Lm(d),c=h,u=!0}}stringify(a,r){this.freeze();const u=au(r),c=this.compiler||this.Compiler;return ls("stringify",c),Bm(a),c(a,u)}use(a,...r){const u=this.attachers,c=this.namespace;if(is("use",this.frozen),a!=null)if(typeof a=="function")m(a,r);else if(typeof a=="object")Array.isArray(a)?h(a):d(a);else throw new TypeError("Expected usable value, not `"+a+"`");return this;function f(p){if(typeof p=="function")m(p,[]);else if(typeof p=="object")if(Array.isArray(p)){const[v,...g]=p;m(v,g)}else d(p);else throw new TypeError("Expected usable value, not `"+p+"`")}function d(p){if(!("plugins"in p)&&!("settings"in p))throw new Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");h(p.plugins),p.settings&&(c.settings=$c(!0,c.settings,p.settings))}function h(p){let v=-1;if(p!=null)if(Array.isArray(p))for(;++v<p.length;){const g=p[v];f(g)}else throw new TypeError("Expected a list of plugins, not `"+p+"`")}function m(p,v){let g=-1,x=-1;for(;++g<u.length;)if(u[g][0]===p){x=g;break}if(x===-1)u.push([p,...v]);else if(v.length>0){let[E,...C]=v;const H=u[x][1];xs(H)&&xs(E)&&(E=$c(!0,H,E)),u[x]=[p,E,...C]}}}}const CE=new Vs().freeze();function ns(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `parser`")}function ls(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `compiler`")}function is(n,a){if(a)throw new Error("Cannot call `"+n+"` on a frozen processor.\\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.")}function Bm(n){if(!xs(n)||typeof n.type!="string")throw new TypeError("Expected node, got `"+n+"`")}function Hm(n,a,r){if(!r)throw new Error("`"+n+"` finished async. Use `"+a+"` instead")}function au(n){return zE(n)?n:new jg(n)}function zE(n){return!!(n&&typeof n=="object"&&"message"in n&&"messages"in n)}function _E(n){return typeof n=="string"||OE(n)}function OE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const DE="https://github.com/remarkjs/react-markdown/blob/main/changelog.md",qm=[],Ym={allowDangerousHtml:!0},ME=/^(https?|ircs?|mailto|xmpp)$/i,RE=[{from:"astPlugins",id:"remove-buggy-html-in-markdown-parser"},{from:"allowDangerousHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"allowNode",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowElement"},{from:"allowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowedElements"},{from:"disallowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"disallowedElements"},{from:"escapeHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"includeElementIndex",id:"#remove-includeelementindex"},{from:"includeNodeIndex",id:"change-includenodeindex-to-includeelementindex"},{from:"linkTarget",id:"remove-linktarget"},{from:"plugins",id:"change-plugins-to-remarkplugins",to:"remarkPlugins"},{from:"rawSourcePos",id:"#remove-rawsourcepos"},{from:"renderers",id:"change-renderers-to-components",to:"components"},{from:"source",id:"change-source-to-children",to:"children"},{from:"sourcePos",id:"#remove-sourcepos"},{from:"transformImageUri",id:"#add-urltransform",to:"urlTransform"},{from:"transformLinkUri",id:"#add-urltransform",to:"urlTransform"}];function NE(n){const a=LE(n),r=UE(n);return jE(a.runSync(a.parse(r),r),n)}function LE(n){const a=n.rehypePlugins||qm,r=n.remarkPlugins||qm,u=n.remarkRehypeOptions?{...n.remarkRehypeOptions,...Ym}:Ym;return CE().use(px).use(r).use(cE,u).use(a)}function UE(n){const a=n.children||"",r=new jg;return typeof a=="string"&&(r.value=a),r}function jE(n,a){const r=a.allowedElements,u=a.allowElement,c=a.components,f=a.disallowedElements,d=a.skipHtml,h=a.unwrapDisallowed,m=a.urlTransform||BE;for(const v of RE)Object.hasOwn(a,v.from)&&(""+v.from+(v.to?"use `"+v.to+"` instead":"remove it")+DE+v.id,void 0);return a.className&&(n={type:"element",tagName:"div",properties:{className:a.className},children:n.type==="root"?n.children:[n]}),Ys(n,p),W0(n,{Fragment:J.Fragment,components:c,ignoreInvalidStyle:!0,jsx:J.jsx,jsxs:J.jsxs,passKeys:!0,passNode:!0});function p(v,g,x){if(v.type==="raw"&&x&&typeof g=="number")return d?x.children.splice(g,1):x.children[g]={type:"text",value:v.value},g;if(v.type==="element"){let E;for(E in Fc)if(Object.hasOwn(Fc,E)&&Object.hasOwn(v.properties,E)){const C=v.properties[E],H=Fc[E];(H===null||H.includes(v.tagName))&&(v.properties[E]=m(String(C||""),E,v))}}if(v.type==="element"){let E=r?!r.includes(v.tagName):f?f.includes(v.tagName):!1;if(!E&&u&&typeof g=="number"&&(E=!u(v,g,x)),E&&x&&typeof g=="number")return h&&v.children?x.children.splice(g,1,...v.children):x.children.splice(g,1),g}}}function BE(n){const a=n.indexOf(":"),r=n.indexOf("?"),u=n.indexOf("#"),c=n.indexOf("/");return a===-1||c!==-1&&a>c||r!==-1&&a>r||u!==-1&&a>u||ME.test(n.slice(0,a))?n:""}function Vm(n,a){const r=String(n);if(typeof a!="string")throw new TypeError("Expected character");let u=0,c=r.indexOf(a);for(;c!==-1;)u++,c=r.indexOf(a,c+a.length);return u}function HE(n){if(typeof n!="string")throw new TypeError("Expected a string");return n.replace(/[|\\\\{}()[\\]^$+*?.]/g,"\\\\$&").replace(/-/g,"\\\\x2d")}function qE(n,a,r){const c=Su((r||{}).ignore||[]),f=YE(a);let d=-1;for(;++d<f.length;)Ug(n,"text",h);function h(p,v){let g=-1,x;for(;++g<v.length;){const E=v[g],C=x?x.children:void 0;if(c(E,C?C.indexOf(E):void 0,x))return;x=E}if(x)return m(p,v)}function m(p,v){const g=v[v.length-1],x=f[d][0],E=f[d][1];let C=0;const B=g.children.indexOf(p);let O=!1,K=[];x.lastIndex=0;let V=x.exec(p.value);for(;V;){const le=V.index,ue={index:V.index,input:V.input,stack:[...v,p]};let L=E(...V,ue);if(typeof L=="string"&&(L=L.length>0?{type:"text",value:L}:void 0),L===!1?x.lastIndex=le+1:(C!==le&&K.push({type:"text",value:p.value.slice(C,le)}),Array.isArray(L)?K.push(...L):L&&K.push(L),C=le+V[0].length,O=!0),!x.global)break;V=x.exec(p.value)}return O?(C<p.value.length&&K.push({type:"text",value:p.value.slice(C)}),g.children.splice(B,1,...K)):K=[p],B+K.length}}function YE(n){const a=[];if(!Array.isArray(n))throw new TypeError("Expected find and replace tuple or list of tuples");const r=!n[0]||Array.isArray(n[0])?n:[n];let u=-1;for(;++u<r.length;){const c=r[u];a.push([VE(c[0]),GE(c[1])])}return a}function VE(n){return typeof n=="string"?new RegExp(HE(n),"g"):n}function GE(n){return typeof n=="function"?n:function(){return n}}const as="phrasing",rs=["autolink","link","image","label"];function XE(){return{transforms:[WE],enter:{literalAutolink:IE,literalAutolinkEmail:us,literalAutolinkHttp:us,literalAutolinkWww:us},exit:{literalAutolink:JE,literalAutolinkEmail:KE,literalAutolinkHttp:ZE,literalAutolinkWww:FE}}}function QE(){return{unsafe:[{character:"@",before:"[+\\\\-.\\\\w]",after:"[\\\\-.\\\\w]",inConstruct:as,notInConstruct:rs},{character:".",before:"[Ww]",after:"[\\\\-.\\\\w]",inConstruct:as,notInConstruct:rs},{character:":",before:"[ps]",after:"\\\\/",inConstruct:as,notInConstruct:rs}]}}function IE(n){this.enter({type:"link",title:null,url:"",children:[]},n)}function us(n){this.config.enter.autolinkProtocol.call(this,n)}function ZE(n){this.config.exit.autolinkProtocol.call(this,n)}function FE(n){this.config.exit.data.call(this,n);const a=this.stack[this.stack.length-1];a.type,a.url="http://"+this.sliceSerialize(n)}function KE(n){this.config.exit.autolinkEmail.call(this,n)}function JE(n){this.exit(n)}function WE(n){qE(n,[[/(https?:\\/\\/|www(?=\\.))([-.\\w]+)([^ \\t\\r\\n]*)/gi,$E],[/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)/gu,PE]],{ignore:["link","linkReference"]})}function $E(n,a,r,u,c){let f="";if(!Bg(c)||(/^w/i.test(a)&&(r=a+r,a="",f="http://"),!ek(r)))return!1;const d=tk(r+u);if(!d[0])return!1;const h={type:"link",title:null,url:f+a+d[0],children:[{type:"text",value:a+d[0]}]};return d[1]?[h,{type:"text",value:d[1]}]:h}function PE(n,a,r,u){return!Bg(u,!0)||/[-\\d_]$/.test(r)?!1:{type:"link",title:null,url:"mailto:"+a+"@"+r,children:[{type:"text",value:a+"@"+r}]}}function ek(n){const a=n.split(".");return!(a.length<2||a[a.length-1]&&(/_/.test(a[a.length-1])||!/[a-zA-Z\\d]/.test(a[a.length-1]))||a[a.length-2]&&(/_/.test(a[a.length-2])||!/[a-zA-Z\\d]/.test(a[a.length-2])))}function tk(n){const a=/[!"&\'),.:;<>?\\]}]+$/.exec(n);if(!a)return[n,void 0];n=n.slice(0,a.index);let r=a[0],u=r.indexOf(")");const c=Vm(n,"(");let f=Vm(n,")");for(;u!==-1&&c>f;)n+=r.slice(0,u+1),r=r.slice(u+1),u=r.indexOf(")"),f++;return[n,r]}function Bg(n,a){const r=n.input.charCodeAt(n.index-1);return(n.index===0||Hl(r)||yu(r))&&(!a||r!==47)}Hg.peek=sk;function nk(){this.buffer()}function lk(n){this.enter({type:"footnoteReference",identifier:"",label:""},n)}function ik(){this.buffer()}function ak(n){this.enter({type:"footnoteDefinition",identifier:"",label:"",children:[]},n)}function rk(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=pn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function uk(n){this.exit(n)}function ok(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=pn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function ck(n){this.exit(n)}function sk(){return"["}function Hg(n,a,r,u){const c=r.createTracker(u);let f=c.move("[^");const d=r.enter("footnoteReference"),h=r.enter("reference");return f+=c.move(r.safe(r.associationId(n),{after:"]",before:f})),h(),d(),f+=c.move("]"),f}function fk(){return{enter:{gfmFootnoteCallString:nk,gfmFootnoteCall:lk,gfmFootnoteDefinitionLabelString:ik,gfmFootnoteDefinition:ak},exit:{gfmFootnoteCallString:rk,gfmFootnoteCall:uk,gfmFootnoteDefinitionLabelString:ok,gfmFootnoteDefinition:ck}}}function dk(n){let a=!1;return n&&n.firstLineBlank&&(a=!0),{handlers:{footnoteDefinition:r,footnoteReference:Hg},unsafe:[{character:"[",inConstruct:["label","phrasing","reference"]}]};function r(u,c,f,d){const h=f.createTracker(d);let m=h.move("[^");const p=f.enter("footnoteDefinition"),v=f.enter("label");return m+=h.move(f.safe(f.associationId(u),{before:m,after:"]"})),v(),m+=h.move("]:"),u.children&&u.children.length>0&&(h.shift(4),m+=h.move((a?`\n`:" ")+f.indentLines(f.containerFlow(u,h.current()),a?qg:hk))),p(),m}}function hk(n,a,r){return a===0?n:qg(n,a,r)}function qg(n,a,r){return(r?"":"    ")+n}const pk=["autolink","destinationLiteral","destinationRaw","reference","titleQuote","titleApostrophe"];Yg.peek=bk;function mk(){return{canContainEols:["delete"],enter:{strikethrough:yk},exit:{strikethrough:vk}}}function gk(){return{unsafe:[{character:"~",inConstruct:"phrasing",notInConstruct:pk}],handlers:{delete:Yg}}}function yk(n){this.enter({type:"delete",children:[]},n)}function vk(n){this.exit(n)}function Yg(n,a,r,u){const c=r.createTracker(u),f=r.enter("strikethrough");let d=c.move("~~");return d+=r.containerPhrasing(n,{...c.current(),before:d,after:"~"}),d+=c.move("~~"),f(),d}function bk(){return"~"}function Sk(n){return n.length}function xk(n,a){const r=a||{},u=(r.align||[]).concat(),c=r.stringLength||Sk,f=[],d=[],h=[],m=[];let p=0,v=-1;for(;++v<n.length;){const H=[],B=[];let O=-1;for(n[v].length>p&&(p=n[v].length);++O<n[v].length;){const K=Ek(n[v][O]);if(r.alignDelimiters!==!1){const V=c(K);B[O]=V,(m[O]===void 0||V>m[O])&&(m[O]=V)}H.push(K)}d[v]=H,h[v]=B}let g=-1;if(typeof u=="object"&&"length"in u)for(;++g<p;)f[g]=Gm(u[g]);else{const H=Gm(u);for(;++g<p;)f[g]=H}g=-1;const x=[],E=[];for(;++g<p;){const H=f[g];let B="",O="";H===99?(B=":",O=":"):H===108?B=":":H===114&&(O=":");let K=r.alignDelimiters===!1?1:Math.max(1,m[g]-B.length-O.length);const V=B+"-".repeat(K)+O;r.alignDelimiters!==!1&&(K=B.length+K+O.length,K>m[g]&&(m[g]=K),E[g]=K),x[g]=V}d.splice(1,0,x),h.splice(1,0,E),v=-1;const C=[];for(;++v<d.length;){const H=d[v],B=h[v];g=-1;const O=[];for(;++g<p;){const K=H[g]||"";let V="",le="";if(r.alignDelimiters!==!1){const ue=m[g]-(B[g]||0),L=f[g];L===114?V=" ".repeat(ue):L===99?ue%2?(V=" ".repeat(ue/2+.5),le=" ".repeat(ue/2-.5)):(V=" ".repeat(ue/2),le=V):le=" ".repeat(ue)}r.delimiterStart!==!1&&!g&&O.push("|"),r.padding!==!1&&!(r.alignDelimiters===!1&&K==="")&&(r.delimiterStart!==!1||g)&&O.push(" "),r.alignDelimiters!==!1&&O.push(V),O.push(K),r.alignDelimiters!==!1&&O.push(le),r.padding!==!1&&O.push(" "),(r.delimiterEnd!==!1||g!==p-1)&&O.push("|")}C.push(r.delimiterEnd===!1?O.join("").replace(/ +$/,""):O.join(""))}return C.join(`\n`)}function Ek(n){return n==null?"":String(n)}function Gm(n){const a=typeof n=="string"?n.codePointAt(0):0;return a===67||a===99?99:a===76||a===108?108:a===82||a===114?114:0}function kk(n,a,r,u){const c=r.enter("blockquote"),f=r.createTracker(u);f.move("> "),f.shift(2);const d=r.indentLines(r.containerFlow(n,f.current()),Ak);return c(),d}function Ak(n,a,r){return">"+(r?"":" ")+n}function wk(n,a){return Xm(n,a.inConstruct,!0)&&!Xm(n,a.notInConstruct,!1)}function Xm(n,a,r){if(typeof a=="string"&&(a=[a]),!a||a.length===0)return r;let u=-1;for(;++u<a.length;)if(n.includes(a[u]))return!0;return!1}function Qm(n,a,r,u){let c=-1;for(;++c<r.unsafe.length;)if(r.unsafe[c].character===`\n`&&wk(r.stack,r.unsafe[c]))return/[ \\t]/.test(u.before)?"":" ";return`\\\\\n`}function Tk(n,a){const r=String(n);let u=r.indexOf(a),c=u,f=0,d=0;if(typeof a!="string")throw new TypeError("Expected substring");for(;u!==-1;)u===c?++f>d&&(d=f):f=1,c=u+a.length,u=r.indexOf(a,c);return d}function Ck(n,a){return!!(a.options.fences===!1&&n.value&&!n.lang&&/[^ \\r\\n]/.test(n.value)&&!/^[\\t ]*(?:[\\r\\n]|$)|(?:^|[\\r\\n])[\\t ]*$/.test(n.value))}function zk(n){const a=n.options.fence||"`";if(a!=="`"&&a!=="~")throw new Error("Cannot serialize code with `"+a+"` for `options.fence`, expected `` ` `` or `~`");return a}function _k(n,a,r,u){const c=zk(r),f=n.value||"",d=c==="`"?"GraveAccent":"Tilde";if(Ck(n,r)){const g=r.enter("codeIndented"),x=r.indentLines(f,Ok);return g(),x}const h=r.createTracker(u),m=c.repeat(Math.max(Tk(f,c)+1,3)),p=r.enter("codeFenced");let v=h.move(m);if(n.lang){const g=r.enter(`codeFencedLang${d}`);v+=h.move(r.safe(n.lang,{before:v,after:" ",encode:["`"],...h.current()})),g()}if(n.lang&&n.meta){const g=r.enter(`codeFencedMeta${d}`);v+=h.move(" "),v+=h.move(r.safe(n.meta,{before:v,after:`\n`,encode:["`"],...h.current()})),g()}return v+=h.move(`\n`),f&&(v+=h.move(f+`\n`)),v+=h.move(m),p(),v}function Ok(n,a,r){return(r?"":"    ")+n}function Gs(n){const a=n.options.quote||\'"\';if(a!==\'"\'&&a!=="\'")throw new Error("Cannot serialize title with `"+a+"` for `options.quote`, expected `\\"`, or `\'`");return a}function Dk(n,a,r,u){const c=Gs(r),f=c===\'"\'?"Quote":"Apostrophe",d=r.enter("definition");let h=r.enter("label");const m=r.createTracker(u);let p=m.move("[");return p+=m.move(r.safe(r.associationId(n),{before:p,after:"]",...m.current()})),p+=m.move("]: "),h(),!n.url||/[\\0- \\u007F]/.test(n.url)?(h=r.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(r.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(h=r.enter("destinationRaw"),p+=m.move(r.safe(n.url,{before:p,after:n.title?" ":`\n`,...m.current()}))),h(),n.title&&(h=r.enter(`title${f}`),p+=m.move(" "+c),p+=m.move(r.safe(n.title,{before:p,after:c,...m.current()})),p+=m.move(c),h()),d(),p}function Mk(n){const a=n.options.emphasis||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize emphasis with `"+a+"` for `options.emphasis`, expected `*`, or `_`");return a}function Ua(n){return"&#x"+n.toString(16).toUpperCase()+";"}function gu(n,a,r){const u=Oi(n),c=Oi(a);return u===void 0?c===void 0?r==="_"?{inside:!0,outside:!0}:{inside:!1,outside:!1}:c===1?{inside:!0,outside:!0}:{inside:!1,outside:!0}:u===1?c===void 0?{inside:!1,outside:!1}:c===1?{inside:!0,outside:!0}:{inside:!1,outside:!1}:c===void 0?{inside:!1,outside:!1}:c===1?{inside:!0,outside:!1}:{inside:!1,outside:!1}}Vg.peek=Rk;function Vg(n,a,r,u){const c=Mk(r),f=r.enter("emphasis"),d=r.createTracker(u),h=d.move(c);let m=d.move(r.containerPhrasing(n,{after:c,before:h,...d.current()}));const p=m.charCodeAt(0),v=gu(u.before.charCodeAt(u.before.length-1),p,c);v.inside&&(m=Ua(p)+m.slice(1));const g=m.charCodeAt(m.length-1),x=gu(u.after.charCodeAt(0),g,c);x.inside&&(m=m.slice(0,-1)+Ua(g));const E=d.move(c);return f(),r.attentionEncodeSurroundingInfo={after:x.outside,before:v.outside},h+m+E}function Rk(n,a,r){return r.options.emphasis||"*"}function Nk(n,a){let r=!1;return Ys(n,function(u){if("value"in u&&/\\r?\\n|\\r/.test(u.value)||u.type==="break")return r=!0,bs}),!!((!n.depth||n.depth<3)&&Ns(n)&&(a.options.setext||r))}function Lk(n,a,r,u){const c=Math.max(Math.min(6,n.depth||1),1),f=r.createTracker(u);if(Nk(n,r)){const v=r.enter("headingSetext"),g=r.enter("phrasing"),x=r.containerPhrasing(n,{...f.current(),before:`\n`,after:`\n`});return g(),v(),x+`\n`+(c===1?"=":"-").repeat(x.length-(Math.max(x.lastIndexOf("\\r"),x.lastIndexOf(`\n`))+1))}const d="#".repeat(c),h=r.enter("headingAtx"),m=r.enter("phrasing");f.move(d+" ");let p=r.containerPhrasing(n,{before:"# ",after:`\n`,...f.current()});return/^[\\t ]/.test(p)&&(p=Ua(p.charCodeAt(0))+p.slice(1)),p=p?d+" "+p:d,r.options.closeAtx&&(p+=" "+d),m(),h(),p}Gg.peek=Uk;function Gg(n){return n.value||""}function Uk(){return"<"}Xg.peek=jk;function Xg(n,a,r,u){const c=Gs(r),f=c===\'"\'?"Quote":"Apostrophe",d=r.enter("image");let h=r.enter("label");const m=r.createTracker(u);let p=m.move("![");return p+=m.move(r.safe(n.alt,{before:p,after:"]",...m.current()})),p+=m.move("]("),h(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(h=r.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(r.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(h=r.enter("destinationRaw"),p+=m.move(r.safe(n.url,{before:p,after:n.title?" ":")",...m.current()}))),h(),n.title&&(h=r.enter(`title${f}`),p+=m.move(" "+c),p+=m.move(r.safe(n.title,{before:p,after:c,...m.current()})),p+=m.move(c),h()),p+=m.move(")"),d(),p}function jk(){return"!"}Qg.peek=Bk;function Qg(n,a,r,u){const c=n.referenceType,f=r.enter("imageReference");let d=r.enter("label");const h=r.createTracker(u);let m=h.move("![");const p=r.safe(n.alt,{before:m,after:"]",...h.current()});m+=h.move(p+"]["),d();const v=r.stack;r.stack=[],d=r.enter("reference");const g=r.safe(r.associationId(n),{before:m,after:"]",...h.current()});return d(),r.stack=v,f(),c==="full"||!p||p!==g?m+=h.move(g+"]"):c==="shortcut"?m=m.slice(0,-1):m+=h.move("]"),m}function Bk(){return"!"}Ig.peek=Hk;function Ig(n,a,r){let u=n.value||"",c="`",f=-1;for(;new RegExp("(^|[^`])"+c+"([^`]|$)").test(u);)c+="`";for(/[^ \\r\\n]/.test(u)&&(/^[ \\r\\n]/.test(u)&&/[ \\r\\n]$/.test(u)||/^`|`$/.test(u))&&(u=" "+u+" ");++f<r.unsafe.length;){const d=r.unsafe[f],h=r.compilePattern(d);let m;if(d.atBreak)for(;m=h.exec(u);){let p=m.index;u.charCodeAt(p)===10&&u.charCodeAt(p-1)===13&&p--,u=u.slice(0,p)+" "+u.slice(m.index+1)}}return c+u+c}function Hk(){return"`"}function Zg(n,a){const r=Ns(n);return!!(!a.options.resourceLink&&n.url&&!n.title&&n.children&&n.children.length===1&&n.children[0].type==="text"&&(r===n.url||"mailto:"+r===n.url)&&/^[a-z][a-z+.-]+:/i.test(n.url)&&!/[\\0- <>\\u007F]/.test(n.url))}Fg.peek=qk;function Fg(n,a,r,u){const c=Gs(r),f=c===\'"\'?"Quote":"Apostrophe",d=r.createTracker(u);let h,m;if(Zg(n,r)){const v=r.stack;r.stack=[],h=r.enter("autolink");let g=d.move("<");return g+=d.move(r.containerPhrasing(n,{before:g,after:">",...d.current()})),g+=d.move(">"),h(),r.stack=v,g}h=r.enter("link"),m=r.enter("label");let p=d.move("[");return p+=d.move(r.containerPhrasing(n,{before:p,after:"](",...d.current()})),p+=d.move("]("),m(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(m=r.enter("destinationLiteral"),p+=d.move("<"),p+=d.move(r.safe(n.url,{before:p,after:">",...d.current()})),p+=d.move(">")):(m=r.enter("destinationRaw"),p+=d.move(r.safe(n.url,{before:p,after:n.title?" ":")",...d.current()}))),m(),n.title&&(m=r.enter(`title${f}`),p+=d.move(" "+c),p+=d.move(r.safe(n.title,{before:p,after:c,...d.current()})),p+=d.move(c),m()),p+=d.move(")"),h(),p}function qk(n,a,r){return Zg(n,r)?"<":"["}Kg.peek=Yk;function Kg(n,a,r,u){const c=n.referenceType,f=r.enter("linkReference");let d=r.enter("label");const h=r.createTracker(u);let m=h.move("[");const p=r.containerPhrasing(n,{before:m,after:"]",...h.current()});m+=h.move(p+"]["),d();const v=r.stack;r.stack=[],d=r.enter("reference");const g=r.safe(r.associationId(n),{before:m,after:"]",...h.current()});return d(),r.stack=v,f(),c==="full"||!p||p!==g?m+=h.move(g+"]"):c==="shortcut"?m=m.slice(0,-1):m+=h.move("]"),m}function Yk(){return"["}function Xs(n){const a=n.options.bullet||"*";if(a!=="*"&&a!=="+"&&a!=="-")throw new Error("Cannot serialize items with `"+a+"` for `options.bullet`, expected `*`, `+`, or `-`");return a}function Vk(n){const a=Xs(n),r=n.options.bulletOther;if(!r)return a==="*"?"-":"*";if(r!=="*"&&r!=="+"&&r!=="-")throw new Error("Cannot serialize items with `"+r+"` for `options.bulletOther`, expected `*`, `+`, or `-`");if(r===a)throw new Error("Expected `bullet` (`"+a+"`) and `bulletOther` (`"+r+"`) to be different");return r}function Gk(n){const a=n.options.bulletOrdered||".";if(a!=="."&&a!==")")throw new Error("Cannot serialize items with `"+a+"` for `options.bulletOrdered`, expected `.` or `)`");return a}function Jg(n){const a=n.options.rule||"*";if(a!=="*"&&a!=="-"&&a!=="_")throw new Error("Cannot serialize rules with `"+a+"` for `options.rule`, expected `*`, `-`, or `_`");return a}function Xk(n,a,r,u){const c=r.enter("list"),f=r.bulletCurrent;let d=n.ordered?Gk(r):Xs(r);const h=n.ordered?d==="."?")":".":Vk(r);let m=a&&r.bulletLastUsed?d===r.bulletLastUsed:!1;if(!n.ordered){const v=n.children?n.children[0]:void 0;if((d==="*"||d==="-")&&v&&(!v.children||!v.children[0])&&r.stack[r.stack.length-1]==="list"&&r.stack[r.stack.length-2]==="listItem"&&r.stack[r.stack.length-3]==="list"&&r.stack[r.stack.length-4]==="listItem"&&r.indexStack[r.indexStack.length-1]===0&&r.indexStack[r.indexStack.length-2]===0&&r.indexStack[r.indexStack.length-3]===0&&(m=!0),Jg(r)===d&&v){let g=-1;for(;++g<n.children.length;){const x=n.children[g];if(x&&x.type==="listItem"&&x.children&&x.children[0]&&x.children[0].type==="thematicBreak"){m=!0;break}}}}m&&(d=h),r.bulletCurrent=d;const p=r.containerFlow(n,u);return r.bulletLastUsed=d,r.bulletCurrent=f,c(),p}function Qk(n){const a=n.options.listItemIndent||"one";if(a!=="tab"&&a!=="one"&&a!=="mixed")throw new Error("Cannot serialize items with `"+a+"` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");return a}function Ik(n,a,r,u){const c=Qk(r);let f=r.bulletCurrent||Xs(r);a&&a.type==="list"&&a.ordered&&(f=(typeof a.start=="number"&&a.start>-1?a.start:1)+(r.options.incrementListMarker===!1?0:a.children.indexOf(n))+f);let d=f.length+1;(c==="tab"||c==="mixed"&&(a&&a.type==="list"&&a.spread||n.spread))&&(d=Math.ceil(d/4)*4);const h=r.createTracker(u);h.move(f+" ".repeat(d-f.length)),h.shift(d);const m=r.enter("listItem"),p=r.indentLines(r.containerFlow(n,h.current()),v);return m(),p;function v(g,x,E){return x?(E?"":" ".repeat(d))+g:(E?f:f+" ".repeat(d-f.length))+g}}function Zk(n,a,r,u){const c=r.enter("paragraph"),f=r.enter("phrasing"),d=r.containerPhrasing(n,u);return f(),c(),d}const Fk=Su(["break","delete","emphasis","footnote","footnoteReference","image","imageReference","inlineCode","inlineMath","link","linkReference","mdxJsxTextElement","mdxTextExpression","strong","text","textDirective"]);function Kk(n,a,r,u){return(n.children.some(function(d){return Fk(d)})?r.containerPhrasing:r.containerFlow).call(r,n,u)}function Jk(n){const a=n.options.strong||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize strong with `"+a+"` for `options.strong`, expected `*`, or `_`");return a}Wg.peek=Wk;function Wg(n,a,r,u){const c=Jk(r),f=r.enter("strong"),d=r.createTracker(u),h=d.move(c+c);let m=d.move(r.containerPhrasing(n,{after:c,before:h,...d.current()}));const p=m.charCodeAt(0),v=gu(u.before.charCodeAt(u.before.length-1),p,c);v.inside&&(m=Ua(p)+m.slice(1));const g=m.charCodeAt(m.length-1),x=gu(u.after.charCodeAt(0),g,c);x.inside&&(m=m.slice(0,-1)+Ua(g));const E=d.move(c+c);return f(),r.attentionEncodeSurroundingInfo={after:x.outside,before:v.outside},h+m+E}function Wk(n,a,r){return r.options.strong||"*"}function $k(n,a,r,u){return r.safe(n.value,u)}function Pk(n){const a=n.options.ruleRepetition||3;if(a<3)throw new Error("Cannot serialize rules with repetition `"+a+"` for `options.ruleRepetition`, expected `3` or more");return a}function e2(n,a,r){const u=(Jg(r)+(r.options.ruleSpaces?" ":"")).repeat(Pk(r));return r.options.ruleSpaces?u.slice(0,-1):u}const $g={blockquote:kk,break:Qm,code:_k,definition:Dk,emphasis:Vg,hardBreak:Qm,heading:Lk,html:Gg,image:Xg,imageReference:Qg,inlineCode:Ig,link:Fg,linkReference:Kg,list:Xk,listItem:Ik,paragraph:Zk,root:Kk,strong:Wg,text:$k,thematicBreak:e2};function t2(){return{enter:{table:n2,tableData:Im,tableHeader:Im,tableRow:i2},exit:{codeText:a2,table:l2,tableData:os,tableHeader:os,tableRow:os}}}function n2(n){const a=n._align;this.enter({type:"table",align:a.map(function(r){return r==="none"?null:r}),children:[]},n),this.data.inTable=!0}function l2(n){this.exit(n),this.data.inTable=void 0}function i2(n){this.enter({type:"tableRow",children:[]},n)}function os(n){this.exit(n)}function Im(n){this.enter({type:"tableCell",children:[]},n)}function a2(n){let a=this.resume();this.data.inTable&&(a=a.replace(/\\\\([\\\\|])/g,r2));const r=this.stack[this.stack.length-1];r.type,r.value=a,this.exit(n)}function r2(n,a){return a==="|"?a:n}function u2(n){const a=n||{},r=a.tableCellPadding,u=a.tablePipeAlign,c=a.stringLength,f=r?" ":"|";return{unsafe:[{character:"\\r",inConstruct:"tableCell"},{character:`\n`,inConstruct:"tableCell"},{atBreak:!0,character:"|",after:"[	 :-]"},{character:"|",inConstruct:"tableCell"},{atBreak:!0,character:":",after:"-"},{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{inlineCode:x,table:d,tableCell:m,tableRow:h}};function d(E,C,H,B){return p(v(E,H,B),E.align)}function h(E,C,H,B){const O=g(E,H,B),K=p([O]);return K.slice(0,K.indexOf(`\n`))}function m(E,C,H,B){const O=H.enter("tableCell"),K=H.enter("phrasing"),V=H.containerPhrasing(E,{...B,before:f,after:f});return K(),O(),V}function p(E,C){return xk(E,{align:C,alignDelimiters:u,padding:r,stringLength:c})}function v(E,C,H){const B=E.children;let O=-1;const K=[],V=C.enter("table");for(;++O<B.length;)K[O]=g(B[O],C,H);return V(),K}function g(E,C,H){const B=E.children;let O=-1;const K=[],V=C.enter("tableRow");for(;++O<B.length;)K[O]=m(B[O],E,C,H);return V(),K}function x(E,C,H){let B=$g.inlineCode(E,C,H);return H.stack.includes("tableCell")&&(B=B.replace(/\\|/g,"\\\\$&")),B}}function o2(){return{exit:{taskListCheckValueChecked:Zm,taskListCheckValueUnchecked:Zm,paragraph:s2}}}function c2(){return{unsafe:[{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{listItem:f2}}}function Zm(n){const a=this.stack[this.stack.length-2];a.type,a.checked=n.type==="taskListCheckValueChecked"}function s2(n){const a=this.stack[this.stack.length-2];if(a&&a.type==="listItem"&&typeof a.checked=="boolean"){const r=this.stack[this.stack.length-1];r.type;const u=r.children[0];if(u&&u.type==="text"){const c=a.children;let f=-1,d;for(;++f<c.length;){const h=c[f];if(h.type==="paragraph"){d=h;break}}d===r&&(u.value=u.value.slice(1),u.value.length===0?r.children.shift():r.position&&u.position&&typeof u.position.start.offset=="number"&&(u.position.start.column++,u.position.start.offset++,r.position.start=Object.assign({},u.position.start)))}}this.exit(n)}function f2(n,a,r,u){const c=n.children[0],f=typeof n.checked=="boolean"&&c&&c.type==="paragraph",d="["+(n.checked?"x":" ")+"] ",h=r.createTracker(u);f&&h.move(d);let m=$g.listItem(n,a,r,{...u,...h.current()});return f&&(m=m.replace(/^(?:[*+-]|\\d+\\.)([\\r\\n]| {1,3})/,p)),m;function p(v){return v+d}}function d2(){return[XE(),fk(),mk(),t2(),o2()]}function h2(n){return{extensions:[QE(),dk(n),gk(),u2(n),c2()]}}const p2={tokenize:S2,partial:!0},Pg={tokenize:x2,partial:!0},ey={tokenize:E2,partial:!0},ty={tokenize:k2,partial:!0},m2={tokenize:A2,partial:!0},ny={name:"wwwAutolink",tokenize:v2,previous:iy},ly={name:"protocolAutolink",tokenize:b2,previous:ay},Xn={name:"emailAutolink",tokenize:y2,previous:ry},En={};function g2(){return{text:En}}let jl=48;for(;jl<123;)En[jl]=Xn,jl++,jl===58?jl=65:jl===91&&(jl=97);En[43]=Xn;En[45]=Xn;En[46]=Xn;En[95]=Xn;En[72]=[Xn,ly];En[104]=[Xn,ly];En[87]=[Xn,ny];En[119]=[Xn,ny];function y2(n,a,r){const u=this;let c,f;return d;function d(g){return!ks(g)||!ry.call(u,u.previous)||Qs(u.events)?r(g):(n.enter("literalAutolink"),n.enter("literalAutolinkEmail"),h(g))}function h(g){return ks(g)?(n.consume(g),h):g===64?(n.consume(g),m):r(g)}function m(g){return g===46?n.check(m2,v,p)(g):g===45||g===95||wt(g)?(f=!0,n.consume(g),m):v(g)}function p(g){return n.consume(g),c=!0,m}function v(g){return f&&c&&Dt(u.previous)?(n.exit("literalAutolinkEmail"),n.exit("literalAutolink"),a(g)):r(g)}}function v2(n,a,r){const u=this;return c;function c(d){return d!==87&&d!==119||!iy.call(u,u.previous)||Qs(u.events)?r(d):(n.enter("literalAutolink"),n.enter("literalAutolinkWww"),n.check(p2,n.attempt(Pg,n.attempt(ey,f),r),r)(d))}function f(d){return n.exit("literalAutolinkWww"),n.exit("literalAutolink"),a(d)}}function b2(n,a,r){const u=this;let c="",f=!1;return d;function d(g){return(g===72||g===104)&&ay.call(u,u.previous)&&!Qs(u.events)?(n.enter("literalAutolink"),n.enter("literalAutolinkHttp"),c+=String.fromCodePoint(g),n.consume(g),h):r(g)}function h(g){if(Dt(g)&&c.length<5)return c+=String.fromCodePoint(g),n.consume(g),h;if(g===58){const x=c.toLowerCase();if(x==="http"||x==="https")return n.consume(g),m}return r(g)}function m(g){return g===47?(n.consume(g),f?p:(f=!0,m)):r(g)}function p(g){return g===null||hu(g)||Je(g)||Hl(g)||yu(g)?r(g):n.attempt(Pg,n.attempt(ey,v),r)(g)}function v(g){return n.exit("literalAutolinkHttp"),n.exit("literalAutolink"),a(g)}}function S2(n,a,r){let u=0;return c;function c(d){return(d===87||d===119)&&u<3?(u++,n.consume(d),c):d===46&&u===3?(n.consume(d),f):r(d)}function f(d){return d===null?r(d):a(d)}}function x2(n,a,r){let u,c,f;return d;function d(p){return p===46||p===95?n.check(ty,m,h)(p):p===null||Je(p)||Hl(p)||p!==45&&yu(p)?m(p):(f=!0,n.consume(p),d)}function h(p){return p===95?u=!0:(c=u,u=void 0),n.consume(p),d}function m(p){return c||u||!f?r(p):a(p)}}function E2(n,a){let r=0,u=0;return c;function c(d){return d===40?(r++,n.consume(d),c):d===41&&u<r?f(d):d===33||d===34||d===38||d===39||d===41||d===42||d===44||d===46||d===58||d===59||d===60||d===63||d===93||d===95||d===126?n.check(ty,a,f)(d):d===null||Je(d)||Hl(d)?a(d):(n.consume(d),c)}function f(d){return d===41&&u++,n.consume(d),c}}function k2(n,a,r){return u;function u(h){return h===33||h===34||h===39||h===41||h===42||h===44||h===46||h===58||h===59||h===63||h===95||h===126?(n.consume(h),u):h===38?(n.consume(h),f):h===93?(n.consume(h),c):h===60||h===null||Je(h)||Hl(h)?a(h):r(h)}function c(h){return h===null||h===40||h===91||Je(h)||Hl(h)?a(h):u(h)}function f(h){return Dt(h)?d(h):r(h)}function d(h){return h===59?(n.consume(h),u):Dt(h)?(n.consume(h),d):r(h)}}function A2(n,a,r){return u;function u(f){return n.consume(f),c}function c(f){return wt(f)?r(f):a(f)}}function iy(n){return n===null||n===40||n===42||n===95||n===91||n===93||n===126||Je(n)}function ay(n){return!Dt(n)}function ry(n){return!(n===47||ks(n))}function ks(n){return n===43||n===45||n===46||n===95||wt(n)}function Qs(n){let a=n.length,r=!1;for(;a--;){const u=n[a][1];if((u.type==="labelLink"||u.type==="labelImage")&&!u._balanced){r=!0;break}if(u._gfmAutolinkLiteralWalkedInto){r=!1;break}}return n.length>0&&!r&&(n[n.length-1][1]._gfmAutolinkLiteralWalkedInto=!0),r}const w2={tokenize:R2,partial:!0};function T2(){return{document:{91:{name:"gfmFootnoteDefinition",tokenize:O2,continuation:{tokenize:D2},exit:M2}},text:{91:{name:"gfmFootnoteCall",tokenize:_2},93:{name:"gfmPotentialFootnoteCall",add:"after",tokenize:C2,resolveTo:z2}}}}function C2(n,a,r){const u=this;let c=u.events.length;const f=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let d;for(;c--;){const m=u.events[c][1];if(m.type==="labelImage"){d=m;break}if(m.type==="gfmFootnoteCall"||m.type==="labelLink"||m.type==="label"||m.type==="image"||m.type==="link")break}return h;function h(m){if(!d||!d._balanced)return r(m);const p=pn(u.sliceSerialize({start:d.end,end:u.now()}));return p.codePointAt(0)!==94||!f.includes(p.slice(1))?r(m):(n.enter("gfmFootnoteCallLabelMarker"),n.consume(m),n.exit("gfmFootnoteCallLabelMarker"),a(m))}}function z2(n,a){let r=n.length;for(;r--;)if(n[r][1].type==="labelImage"&&n[r][0]==="enter"){n[r][1];break}n[r+1][1].type="data",n[r+3][1].type="gfmFootnoteCallLabelMarker";const u={type:"gfmFootnoteCall",start:Object.assign({},n[r+3][1].start),end:Object.assign({},n[n.length-1][1].end)},c={type:"gfmFootnoteCallMarker",start:Object.assign({},n[r+3][1].end),end:Object.assign({},n[r+3][1].end)};c.end.column++,c.end.offset++,c.end._bufferIndex++;const f={type:"gfmFootnoteCallString",start:Object.assign({},c.end),end:Object.assign({},n[n.length-1][1].start)},d={type:"chunkString",contentType:"string",start:Object.assign({},f.start),end:Object.assign({},f.end)},h=[n[r+1],n[r+2],["enter",u,a],n[r+3],n[r+4],["enter",c,a],["exit",c,a],["enter",f,a],["enter",d,a],["exit",d,a],["exit",f,a],n[n.length-2],n[n.length-1],["exit",u,a]];return n.splice(r,n.length-r+1,...h),n}function _2(n,a,r){const u=this,c=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f=0,d;return h;function h(g){return n.enter("gfmFootnoteCall"),n.enter("gfmFootnoteCallLabelMarker"),n.consume(g),n.exit("gfmFootnoteCallLabelMarker"),m}function m(g){return g!==94?r(g):(n.enter("gfmFootnoteCallMarker"),n.consume(g),n.exit("gfmFootnoteCallMarker"),n.enter("gfmFootnoteCallString"),n.enter("chunkString").contentType="string",p)}function p(g){if(f>999||g===93&&!d||g===null||g===91||Je(g))return r(g);if(g===93){n.exit("chunkString");const x=n.exit("gfmFootnoteCallString");return c.includes(pn(u.sliceSerialize(x)))?(n.enter("gfmFootnoteCallLabelMarker"),n.consume(g),n.exit("gfmFootnoteCallLabelMarker"),n.exit("gfmFootnoteCall"),a):r(g)}return Je(g)||(d=!0),f++,n.consume(g),g===92?v:p}function v(g){return g===91||g===92||g===93?(n.consume(g),f++,p):p(g)}}function O2(n,a,r){const u=this,c=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f,d=0,h;return m;function m(C){return n.enter("gfmFootnoteDefinition")._container=!0,n.enter("gfmFootnoteDefinitionLabel"),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),p}function p(C){return C===94?(n.enter("gfmFootnoteDefinitionMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionMarker"),n.enter("gfmFootnoteDefinitionLabelString"),n.enter("chunkString").contentType="string",v):r(C)}function v(C){if(d>999||C===93&&!h||C===null||C===91||Je(C))return r(C);if(C===93){n.exit("chunkString");const H=n.exit("gfmFootnoteDefinitionLabelString");return f=pn(u.sliceSerialize(H)),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),n.exit("gfmFootnoteDefinitionLabel"),x}return Je(C)||(h=!0),d++,n.consume(C),C===92?g:v}function g(C){return C===91||C===92||C===93?(n.consume(C),d++,v):v(C)}function x(C){return C===58?(n.enter("definitionMarker"),n.consume(C),n.exit("definitionMarker"),c.includes(f)||c.push(f),Ne(n,E,"gfmFootnoteDefinitionWhitespace")):r(C)}function E(C){return a(C)}}function D2(n,a,r){return n.check(Ba,a,n.attempt(w2,a,r))}function M2(n){n.exit("gfmFootnoteDefinition")}function R2(n,a,r){const u=this;return Ne(n,c,"gfmFootnoteDefinitionIndent",5);function c(f){const d=u.events[u.events.length-1];return d&&d[1].type==="gfmFootnoteDefinitionIndent"&&d[2].sliceSerialize(d[1],!0).length===4?a(f):r(f)}}function N2(n){let r=(n||{}).singleTilde;const u={name:"strikethrough",tokenize:f,resolveAll:c};return r==null&&(r=!0),{text:{126:u},insideSpan:{null:[u]},attentionMarkers:{null:[126]}};function c(d,h){let m=-1;for(;++m<d.length;)if(d[m][0]==="enter"&&d[m][1].type==="strikethroughSequenceTemporary"&&d[m][1]._close){let p=m;for(;p--;)if(d[p][0]==="exit"&&d[p][1].type==="strikethroughSequenceTemporary"&&d[p][1]._open&&d[m][1].end.offset-d[m][1].start.offset===d[p][1].end.offset-d[p][1].start.offset){d[m][1].type="strikethroughSequence",d[p][1].type="strikethroughSequence";const v={type:"strikethrough",start:Object.assign({},d[p][1].start),end:Object.assign({},d[m][1].end)},g={type:"strikethroughText",start:Object.assign({},d[p][1].end),end:Object.assign({},d[m][1].start)},x=[["enter",v,h],["enter",d[p][1],h],["exit",d[p][1],h],["enter",g,h]],E=h.parser.constructs.insideSpan.null;E&&Wt(x,x.length,0,vu(E,d.slice(p+1,m),h)),Wt(x,x.length,0,[["exit",g,h],["enter",d[m][1],h],["exit",d[m][1],h],["exit",v,h]]),Wt(d,p-1,m-p+3,x),m=p+x.length-2;break}}for(m=-1;++m<d.length;)d[m][1].type==="strikethroughSequenceTemporary"&&(d[m][1].type="data");return d}function f(d,h,m){const p=this.previous,v=this.events;let g=0;return x;function x(C){return p===126&&v[v.length-1][1].type!=="characterEscape"?m(C):(d.enter("strikethroughSequenceTemporary"),E(C))}function E(C){const H=Oi(p);if(C===126)return g>1?m(C):(d.consume(C),g++,E);if(g<2&&!r)return m(C);const B=d.exit("strikethroughSequenceTemporary"),O=Oi(C);return B._open=!O||O===2&&!!H,B._close=!H||H===2&&!!O,h(C)}}}class L2{constructor(){this.map=[]}add(a,r,u){U2(this,a,r,u)}consume(a){if(this.map.sort(function(f,d){return f[0]-d[0]}),this.map.length===0)return;let r=this.map.length;const u=[];for(;r>0;)r-=1,u.push(a.slice(this.map[r][0]+this.map[r][1]),this.map[r][2]),a.length=this.map[r][0];u.push(a.slice()),a.length=0;let c=u.pop();for(;c;){for(const f of c)a.push(f);c=u.pop()}this.map.length=0}}function U2(n,a,r,u){let c=0;if(!(r===0&&u.length===0)){for(;c<n.map.length;){if(n.map[c][0]===a){n.map[c][1]+=r,n.map[c][2].push(...u);return}c+=1}n.map.push([a,r,u])}}function j2(n,a){let r=!1;const u=[];for(;a<n.length;){const c=n[a];if(r){if(c[0]==="enter")c[1].type==="tableContent"&&u.push(n[a+1][1].type==="tableDelimiterMarker"?"left":"none");else if(c[1].type==="tableContent"){if(n[a-1][1].type==="tableDelimiterMarker"){const f=u.length-1;u[f]=u[f]==="left"?"center":"right"}}else if(c[1].type==="tableDelimiterRow")break}else c[0]==="enter"&&c[1].type==="tableDelimiterRow"&&(r=!0);a+=1}return u}function B2(){return{flow:{null:{name:"table",tokenize:H2,resolveAll:q2}}}}function H2(n,a,r){const u=this;let c=0,f=0,d;return h;function h(U){let ie=u.events.length-1;for(;ie>-1;){const ae=u.events[ie][1].type;if(ae==="lineEnding"||ae==="linePrefix")ie--;else break}const ne=ie>-1?u.events[ie][1].type:null,be=ne==="tableHead"||ne==="tableRow"?L:m;return be===L&&u.parser.lazy[u.now().line]?r(U):be(U)}function m(U){return n.enter("tableHead"),n.enter("tableRow"),p(U)}function p(U){return U===124||(d=!0,f+=1),v(U)}function v(U){return U===null?r(U):pe(U)?f>1?(f=0,u.interrupt=!0,n.exit("tableRow"),n.enter("lineEnding"),n.consume(U),n.exit("lineEnding"),E):r(U):Oe(U)?Ne(n,v,"whitespace")(U):(f+=1,d&&(d=!1,c+=1),U===124?(n.enter("tableCellDivider"),n.consume(U),n.exit("tableCellDivider"),d=!0,v):(n.enter("data"),g(U)))}function g(U){return U===null||U===124||Je(U)?(n.exit("data"),v(U)):(n.consume(U),U===92?x:g)}function x(U){return U===92||U===124?(n.consume(U),g):g(U)}function E(U){return u.interrupt=!1,u.parser.lazy[u.now().line]?r(U):(n.enter("tableDelimiterRow"),d=!1,Oe(U)?Ne(n,C,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(U):C(U))}function C(U){return U===45||U===58?B(U):U===124?(d=!0,n.enter("tableCellDivider"),n.consume(U),n.exit("tableCellDivider"),H):ue(U)}function H(U){return Oe(U)?Ne(n,B,"whitespace")(U):B(U)}function B(U){return U===58?(f+=1,d=!0,n.enter("tableDelimiterMarker"),n.consume(U),n.exit("tableDelimiterMarker"),O):U===45?(f+=1,O(U)):U===null||pe(U)?le(U):ue(U)}function O(U){return U===45?(n.enter("tableDelimiterFiller"),K(U)):ue(U)}function K(U){return U===45?(n.consume(U),K):U===58?(d=!0,n.exit("tableDelimiterFiller"),n.enter("tableDelimiterMarker"),n.consume(U),n.exit("tableDelimiterMarker"),V):(n.exit("tableDelimiterFiller"),V(U))}function V(U){return Oe(U)?Ne(n,le,"whitespace")(U):le(U)}function le(U){return U===124?C(U):U===null||pe(U)?!d||c!==f?ue(U):(n.exit("tableDelimiterRow"),n.exit("tableHead"),a(U)):ue(U)}function ue(U){return r(U)}function L(U){return n.enter("tableRow"),P(U)}function P(U){return U===124?(n.enter("tableCellDivider"),n.consume(U),n.exit("tableCellDivider"),P):U===null||pe(U)?(n.exit("tableRow"),a(U)):Oe(U)?Ne(n,P,"whitespace")(U):(n.enter("data"),se(U))}function se(U){return U===null||U===124||Je(U)?(n.exit("data"),P(U)):(n.consume(U),U===92?ge:se)}function ge(U){return U===92||U===124?(n.consume(U),se):se(U)}}function q2(n,a){let r=-1,u=!0,c=0,f=[0,0,0,0],d=[0,0,0,0],h=!1,m=0,p,v,g;const x=new L2;for(;++r<n.length;){const E=n[r],C=E[1];E[0]==="enter"?C.type==="tableHead"?(h=!1,m!==0&&(Fm(x,a,m,p,v),v=void 0,m=0),p={type:"table",start:Object.assign({},C.start),end:Object.assign({},C.end)},x.add(r,0,[["enter",p,a]])):C.type==="tableRow"||C.type==="tableDelimiterRow"?(u=!0,g=void 0,f=[0,0,0,0],d=[0,r+1,0,0],h&&(h=!1,v={type:"tableBody",start:Object.assign({},C.start),end:Object.assign({},C.end)},x.add(r,0,[["enter",v,a]])),c=C.type==="tableDelimiterRow"?2:v?3:1):c&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")?(u=!1,d[2]===0&&(f[1]!==0&&(d[0]=d[1],g=ru(x,a,f,c,void 0,g),f=[0,0,0,0]),d[2]=r)):C.type==="tableCellDivider"&&(u?u=!1:(f[1]!==0&&(d[0]=d[1],g=ru(x,a,f,c,void 0,g)),f=d,d=[f[1],r,0,0])):C.type==="tableHead"?(h=!0,m=r):C.type==="tableRow"||C.type==="tableDelimiterRow"?(m=r,f[1]!==0?(d[0]=d[1],g=ru(x,a,f,c,r,g)):d[1]!==0&&(g=ru(x,a,d,c,r,g)),c=0):c&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")&&(d[3]=r)}for(m!==0&&Fm(x,a,m,p,v),x.consume(a.events),r=-1;++r<a.events.length;){const E=a.events[r];E[0]==="enter"&&E[1].type==="table"&&(E[1]._align=j2(a.events,r))}return n}function ru(n,a,r,u,c,f){const d=u===1?"tableHeader":u===2?"tableDelimiter":"tableData",h="tableContent";r[0]!==0&&(f.end=Object.assign({},Ci(a.events,r[0])),n.add(r[0],0,[["exit",f,a]]));const m=Ci(a.events,r[1]);if(f={type:d,start:Object.assign({},m),end:Object.assign({},m)},n.add(r[1],0,[["enter",f,a]]),r[2]!==0){const p=Ci(a.events,r[2]),v=Ci(a.events,r[3]),g={type:h,start:Object.assign({},p),end:Object.assign({},v)};if(n.add(r[2],0,[["enter",g,a]]),u!==2){const x=a.events[r[2]],E=a.events[r[3]];if(x[1].end=Object.assign({},E[1].end),x[1].type="chunkText",x[1].contentType="text",r[3]>r[2]+1){const C=r[2]+1,H=r[3]-r[2]-1;n.add(C,H,[])}}n.add(r[3]+1,0,[["exit",g,a]])}return c!==void 0&&(f.end=Object.assign({},Ci(a.events,c)),n.add(c,0,[["exit",f,a]]),f=void 0),f}function Fm(n,a,r,u,c){const f=[],d=Ci(a.events,r);c&&(c.end=Object.assign({},d),f.push(["exit",c,a])),u.end=Object.assign({},d),f.push(["exit",u,a]),n.add(r+1,0,f)}function Ci(n,a){const r=n[a],u=r[0]==="enter"?"start":"end";return r[1][u]}const Y2={name:"tasklistCheck",tokenize:G2};function V2(){return{text:{91:Y2}}}function G2(n,a,r){const u=this;return c;function c(m){return u.previous!==null||!u._gfmTasklistFirstContentOfListItem?r(m):(n.enter("taskListCheck"),n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),f)}function f(m){return Je(m)?(n.enter("taskListCheckValueUnchecked"),n.consume(m),n.exit("taskListCheckValueUnchecked"),d):m===88||m===120?(n.enter("taskListCheckValueChecked"),n.consume(m),n.exit("taskListCheckValueChecked"),d):r(m)}function d(m){return m===93?(n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),n.exit("taskListCheck"),h):r(m)}function h(m){return pe(m)?a(m):Oe(m)?n.check({tokenize:X2},a,r)(m):r(m)}}function X2(n,a,r){return Ne(n,u,"whitespace");function u(c){return c===null?r(c):a(c)}}function Q2(n){return yg([g2(),T2(),N2(n),B2(),V2()])}const I2={};function Z2(n){const a=this,r=n||I2,u=a.data(),c=u.micromarkExtensions||(u.micromarkExtensions=[]),f=u.fromMarkdownExtensions||(u.fromMarkdownExtensions=[]),d=u.toMarkdownExtensions||(u.toMarkdownExtensions=[]);c.push(Q2(r)),f.push(d2()),d.push(h2(r))}function F2(){const n=At(c=>c.ui.modal==="instructions"),a=At(c=>c.conversation.instructions),r=ve.useRef(null),u=ve.useRef(null);return ve.useEffect(()=>{if(n)return u.current=document.activeElement,r.current?.focus(),()=>{u.current?.focus()}},[n]),n?J.jsx("div",{className:"modal-backdrop",onClick:()=>kt({type:"ui/click/modal-backdrop"}),children:J.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"instructions-title",tabIndex:-1,ref:r,onClick:c=>c.stopPropagation(),children:[J.jsxs("div",{className:"modal-header",children:[J.jsx("span",{className:"modal-title",id:"instructions-title",children:"Instructions"}),J.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>kt({type:"ui/click/modal-close"}),children:J.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),J.jsx("div",{className:"modal-body instructions-body",children:a===void 0?J.jsx("p",{className:"loading-state",children:"Loading instructions\u2026"}):J.jsx(NE,{remarkPlugins:[Z2],disallowedElements:["script","iframe","object","embed"],unwrapDisallowed:!0,children:a})})]})}):null}function uu({item:n,speakingItemId:a,forceSpeaking:r=!1}){const u=r||n.role==="user"&&n.id===a,c=["transcript-item",`role-${n.role}`,`source-${n.source}`,n.streaming?"streaming":"",u?"speaking":""].filter(Boolean).join(" ");return J.jsx("article",{className:c,children:n.text})}function K2({tool:n}){const[a,r]=ve.useState(!1),u=()=>r(f=>!f),c=n.status==="completed"?n.result:n.status==="failed"||n.status==="interrupted"?n.error:null;return J.jsxs("article",{className:"tool-call",tabIndex:0,onClick:u,onKeyDown:f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),u())},children:[J.jsxs("div",{className:"tool-row",children:[J.jsx("span",{className:"toggle",children:a?"\u25BE":"\u25B8"}),J.jsxs("span",{children:["Tool: ",n.toolName,"(...)"]}),J.jsx("span",{className:`badge ${n.status}`,children:n.status})]}),a?J.jsxs("div",{className:"tool-call-body",children:[J.jsx("div",{className:"section-label",children:"ARGUMENTS"}),J.jsx("pre",{children:JSON.stringify(n.arguments,null,2)}),J.jsx("div",{className:"section-label",children:"RESULT"}),J.jsx("pre",{children:JSON.stringify(c,null,2)})]}):null]})}function J2(){const{conversation:n,streamDrafts:a,speakingItemId:r,pendingUserItemId:u,responseActive:c}=At(Ts(g=>({conversation:g.conversation.conversation,streamDrafts:g.conversation.streamDrafts,speakingItemId:g.voice.speakingItemId,pendingUserItemId:g.voice.pendingUserItemId,responseActive:g.voice.responseActive})));if(n===null)return J.jsxs("div",{className:"empty-state",children:[J.jsx("svg",{className:"empty-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:J.jsx("path",{d:"M12 2v20M5 8v8M19 8v8"})}),J.jsx("div",{children:"Ready to start"})]});if(n.status==="ended")return J.jsxs("div",{className:"ended-state",children:[J.jsx("strong",{children:"Conversation ended"}),J.jsx("span",{children:"Transcript is no longer active."})]});const f=n,d=new Map(f.transcript.map(g=>[g.id,g])),h=new Map(f.toolCalls.map(g=>[g.id,g])),m=[];for(const g of f.timeline)if(g.type==="transcript"){const x=d.get(g.transcriptItemId);x!==void 0&&m.push(J.jsx(uu,{item:{id:x.id,role:x.role,source:x.source,text:x.text,streaming:!1},speakingItemId:r},`t-${x.id}`))}else{const x=h.get(g.toolCallId);x!==void 0&&m.push(J.jsx(K2,{tool:x},`c-${x.id}`))}let p=!1;for(const g of a.values())if(!d.has(g.itemId)&&g.itemId===u){p=!0;break}u!==null&&!p&&!d.has(u)&&m.push(J.jsx(uu,{item:{id:u,role:"user",source:"microphone",text:"",streaming:!1},speakingItemId:r,forceSpeaking:!0},`pending-${u}`));let v=!1;for(const g of a.values())d.has(g.itemId)||(g.role==="assistant"&&(v=!0),m.push(J.jsx(uu,{item:{id:g.itemId,role:g.role,source:g.source,text:g.fullTextSoFar,streaming:!0},speakingItemId:r},`d-${g.itemId}`)));return c&&!v&&m.push(J.jsx(uu,{item:{id:"pending-assistant",role:"assistant",source:"assistantAudio",text:"",streaming:!1},speakingItemId:r,forceSpeaking:!0},"pending-assistant")),J.jsx(J.Fragment,{children:m})}function W2(){const n=At(m=>m.ui.modal==="transcript"),a=At(m=>m.conversation.atBottom),r=At(m=>m.conversation.conversation?.transcript),u=At(m=>m.conversation.streamDrafts),c=ve.useRef(null),f=ve.useRef(null),d=ve.useRef(null);if(ve.useEffect(()=>{if(n)return d.current=document.activeElement,c.current?.focus(),()=>{d.current?.focus()}},[n]),ve.useEffect(()=>{n&&a&&f.current!==null&&(f.current.scrollTop=f.current.scrollHeight)},[n,a,r,u]),!n)return null;const h=m=>{if(m.key!=="Tab")return;const p=c.current;if(p===null)return;const v=p.querySelectorAll(\'button, [href], select, textarea, [tabindex]:not([tabindex="-1"])\');if(v.length===0)return;const g=v[0],x=v[v.length-1];g===void 0||x===void 0||(m.shiftKey&&document.activeElement===g?(m.preventDefault(),x.focus()):!m.shiftKey&&document.activeElement===x&&(m.preventDefault(),g.focus()))};return J.jsx("div",{className:"modal-backdrop",onClick:()=>kt({type:"ui/click/modal-backdrop"}),children:J.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"transcript-title",tabIndex:-1,ref:c,onClick:m=>m.stopPropagation(),onKeyDown:h,children:[J.jsxs("div",{className:"modal-header",children:[J.jsx("span",{className:"modal-title",id:"transcript-title",children:"Conversation"}),J.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>kt({type:"ui/click/modal-close"}),children:J.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),J.jsx("div",{className:"modal-body",ref:f,onScroll:m=>{const p=m.currentTarget;kt({type:"ui/scroll/transcript",atBottom:p.scrollHeight-p.scrollTop-p.clientHeight<80})},children:J.jsx(J2,{})})]})})}var Km=()=>typeof window>"u"?null:window.SpeechRecognition||window.webkitSpeechRecognition||null,$2=()=>{if(typeof window>"u")return null;try{const n=new AudioContext,a=n.createOscillator(),r=n.createGain();return r.gain.value=.001,a.frequency.value=20,a.connect(r),r.connect(n.destination),a.start(),{context:n,oscillator:a,gain:r}}catch{return null}},Jm=n=>{try{n.oscillator.stop(),n.oscillator.disconnect(),n.gain.disconnect(),n.context.close()}catch{}},Wm=(n,a)=>n.map(r=>typeof r=="string"?{word:r,language:a}:r),P2=n=>[...new Set(n.map(a=>a.language))],$m=async()=>{if(typeof navigator>"u"||!("wakeLock"in navigator))return null;try{return await navigator.wakeLock.request("screen")}catch{return null}},Pm=async n=>{if(n)try{await n.release()}catch{}},eA=n=>n.replace(/\\s+/g,"").normalize("NFKC").replace(/[\u30A1-\u30F6]/g,a=>String.fromCharCode(a.charCodeAt(0)-96)).replace(/\u3092/g,"\u304A"),eg=(n,a)=>{const r=n.length,u=a.length;if(r===0)return u;if(u===0)return r;let c=new Array(u+1),f=new Array(u+1);for(let d=0;d<=u;d++)c[d]=d;for(let d=1;d<=r;d++){f[0]=d;for(let h=1;h<=u;h++){const m=n[d-1]===a[h-1]?0:1;f[h]=Math.min(c[h]+1,f[h-1]+1,c[h-1]+m)}[c,f]=[f,c]}return c[u]},tA=(n,a,r)=>{if(n.includes(a))return!0;const u=a.length;if(u===0)return!1;const c=u<=3?Math.max(r,.9):r;if(n.length<u)return 1-eg(n,a)/u>=c;const f=Math.max(1,u-1),d=u+1;for(let h=f;h<=d;h++)if(!(n.length<h))for(let m=0;m<=n.length-h;m++){const p=n.slice(m,m+h);if(1-eg(p,a)/Math.max(p.length,u)>=c)return!0}return!1};function nA(n){const{wakeWords:a,onWakeWord:r,stopWords:u=[],onStopWord:c,continuous:f=!0,language:d="ja-JP",caseSensitive:h=!1,keepAlive:m=!0,screenLock:p=!1,maxAlternatives:v=3,normalize:g=!0,similarityThreshold:x,onTranscript:E}=n,[C,H]=ve.useState(!1),[B,O]=ve.useState(!1),[K,V]=ve.useState(null),[le,ue]=ve.useState(""),L=ve.useRef(null),P=ve.useRef(null),se=ve.useRef(null),ge=ve.useRef(r),U=ve.useRef(c),ie=ve.useRef(E),ne=ve.useRef(0),be=ve.useRef(!1),ae=ve.useRef(new Set),$=ve.useRef(-1),D=Wm(a,d),Z=Wm(u,d),ce=[...D,...Z],Se=P2(ce),k=ve.useRef(D),w=ve.useRef(Z),q=ve.useRef(Se);ve.useEffect(()=>{ge.current=r,U.current=c,ie.current=E,k.current=D,w.current=Z,q.current=Se},[r,c,E,D,Z,Se]),ve.useEffect(()=>{O(!0)},[]);const b=B&&Km()!==null,_=ve.useRef(()=>{}),G=ve.useCallback(Te=>{let Le=h?Te:Te.toLowerCase();return g&&(Le=eA(Le)),Le},[h,g]),F=ve.useCallback((Te,Le)=>typeof x=="number"&&x>0&&x<=1?tA(Te,Le,x):Te.includes(Le),[x]),ee=ve.useCallback((Te,Le)=>{for(const Ue of w.current){const tt=G(Ue.word),mt=`stop:${Le}:${tt}`;if(!ae.current.has(mt)){for(const gt of Te)if(F(G(gt),tt))return ae.current.add(mt),U.current?.(Ue.word,gt),_.current(),!0}}return!1},[G,F]),re=ve.useCallback((Te,Le)=>{if(ee(Te,Le))return!1;for(const Ue of k.current){const tt=G(Ue.word),mt=`wake:${Le}:${tt}`;if(!ae.current.has(mt)){for(const gt of Te)if(F(G(gt),tt))return ae.current.add(mt),ge.current(Ue.word,gt),!0}}return!1},[G,ee,F]),de=ve.useCallback(Te=>{const Le=Km();if(!Le){V(new Error("SpeechRecognition is not supported in this browser"));return}L.current&&L.current.stop();const Ue=new Le;Ue.continuous=f,Ue.interimResults=!0,Ue.lang=Te,Ue.maxAlternatives=Math.max(1,v),Ue.onstart=()=>{H(!0),V(null)},Ue.onresult=tt=>{const mt=tt.resultIndex,gt=tt.results[mt];if(gt){const kn=[];for(let mn=0;mn<gt.length;mn++){const Qn=gt[mn];Qn?.transcript&&kn.push(Qn.transcript)}const An=kn[0]??"";ue(An),ie.current&&ie.current(An,{alternatives:kn.slice(1),isFinal:gt.isFinal}),(gt.isFinal||mt>$.current)&&(re(kn,mt),gt.isFinal&&($.current=mt))}},Ue.onerror=tt=>{V(new Error(`Speech recognition error: ${tt.error}`)),H(!1)},Ue.onend=()=>{if(be.current&&f){ne.current=(ne.current+1)%q.current.length;const tt=q.current[ne.current];ae.current.clear(),$.current=-1,setTimeout(()=>{be.current&&de(tt)},100)}else H(!1)},L.current=Ue;try{Ue.start()}catch(tt){V(tt instanceof Error?tt:new Error("Failed to start recognition"))}},[f,v,re]),we=ve.useCallback(async()=>{be.current=!0,ne.current=0,ae.current.clear(),$.current=-1,m&&!P.current&&(P.current=$2()),p&&!se.current&&(se.current=await $m());const Te=q.current[0]||d;de(Te)},[m,p,d,de]),Ze=ve.useCallback(async()=>{be.current=!1,L.current&&(L.current.stop(),L.current=null),P.current&&(Jm(P.current),P.current=null),se.current&&(await Pm(se.current),se.current=null),H(!1)},[]);return ve.useEffect(()=>{_.current=Ze},[Ze]),ve.useEffect(()=>{if(!p)return;const Te=async()=>{document.visibilityState==="visible"&&be.current&&!se.current&&(se.current=await $m())};return document.addEventListener("visibilitychange",Te),()=>{document.removeEventListener("visibilitychange",Te)}},[p]),ve.useEffect(()=>()=>{be.current=!1,L.current&&(L.current.stop(),L.current=null),P.current&&(Jm(P.current),P.current=null),se.current&&(Pm(se.current),se.current=null)},[]),{isListening:C,isSupported:b,start:we,stop:Ze,error:K,transcript:le}}const tg="Hey Computer";let fu;function lA(){return fu}function iA({dispatch:n,subscribeToActions:a,getState:r}){let u=tg,c=!1,f={active:!1,phrase:tg};const d=new Set,h=()=>{const v=u!==null&&c,g=u??f.phrase;if(!(f.active===v&&f.phrase===g)){f={active:v,phrase:g};for(const x of d)x(f)}},m={getIntent:()=>f,subscribe:v=>(d.add(v),()=>{d.delete(v)}),onWakeWordDetected:()=>{u!==null&&r().voice.paused&&n({type:"ui/click/primary"})}};fu=m;const p=a(v=>{switch(v.type){case"host/state":{const g=v.data.wakeWord;g!==u&&(u=g,h());break}case"voice/paused":{v.paused!==c&&(c=v.paused,h());break}}});return()=>{p(),d.clear(),fu===m&&(fu=void 0),f={active:!1,phrase:f.phrase}}}function aA(){const n=lA(),[a,r]=ve.useState(()=>n?.getIntent()??{active:!1,phrase:""});return ve.useEffect(()=>{if(n)return r(n.getIntent()),n.subscribe(r)},[n]),!n||!a.active||a.phrase.length===0?null:J.jsx(rA,{phrase:a.phrase,onDetected:n.onWakeWordDetected},a.phrase)}function rA({phrase:n,onDetected:a}){const{start:r,stop:u,isSupported:c}=nA({wakeWords:[n],onWakeWord:()=>{a()},language:"en-US",similarityThreshold:.75,continuous:!0,keepAlive:!0});return ve.useEffect(()=>{if(c)return r(),()=>{u()}},[c,r,u]),null}function uA(){const n=At(u=>u.ui.duplicateClient),a=At(u=>u.ui.moreActionsOpen);ve.useEffect(()=>{const u=c=>{c.key==="Escape"&&kt({type:"ui/key/escape"})};return window.addEventListener("keydown",u),()=>window.removeEventListener("keydown",u)},[]),ve.useEffect(()=>{if(!a)return;const u=f=>{const d=f.target;d?.closest("[data-more-actions]")===null&&d?.closest(\'[aria-label="More actions"]\')===null&&kt({type:"ui/click/modal-backdrop"})},c=window.setTimeout(()=>document.addEventListener("click",u),0);return()=>{window.clearTimeout(c),document.removeEventListener("click",u)}},[a]);const r=At(u=>u.stage.injectedVersion);return n?J.jsx(Mv,{}):J.jsxs(J.Fragment,{children:[r!=null&&J.jsx("iframe",{className:"injected-stage",src:`/__injected?v=${r}`}),J.jsx(E0,{}),J.jsx(W2,{}),J.jsx(F2,{}),J.jsx(aA,{})]})}const oA="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";async function cA(n){if(navigator.userActivation&&navigator.userActivation.hasBeenActive===!1)return!1;try{const a=new Audio(oA);return a.volume=0,await a.play(),a.pause(),!0}catch(a){return n({type:"browser/window/error",message:`canAutoplay.probe.blocked: ${String(a instanceof Error?a.message:a)}`}),!1}}function sA({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,c=!1;const f=a(d=>{d.type==="browser/autoplay/probed"&&c&&(c=!1,n({type:"ui/click/primary"}))});return cA(n).then(d=>{u||(u=!0,c=r().audio.pendingSessionStart,n({type:"browser/autoplay/probed",allowed:d}))}),f}function fA({dispatch:n}){const a=u=>{n({type:"browser/window/error",message:u.message})},r=u=>{n({type:"browser/window/unhandled-rejection",reason:String(u.reason)})};return window.addEventListener("error",a),window.addEventListener("unhandledrejection",r),()=>{window.removeEventListener("error",a),window.removeEventListener("unhandledrejection",r)}}const Ri={dispatch:kt,subscribeToActions:ng,getState:ss};o0(Ri);y0(Ri);i0(Ri);fA(Ri);sA(Ri);iA(Ri);const dA=200,du=[];ng(n=>{du.push({t:Date.now(),type:n.type}),du.length>dA&&du.shift()});window.__voice={state:()=>{try{return JSON.parse(JSON.stringify(ss()))}catch{return ss()}},actions:()=>du.slice()};const uy=document.getElementById("root");if(uy===null)throw new Error("Root element #root not found");Dv.createRoot(uy).render(J.jsx(ve.StrictMode,{children:J.jsx(uA,{})}));</script>\n    <style rel="stylesheet" crossorigin>:root{--bg-base: #09090b;--bg-card: #18181b;--border: #27272a;--text-dim: #52525b;--text-muted: #71717a;--text-default: #a1a1aa;--text-bright: #e4e4e7;--text-white: #fafafa;--accent: #22d3ee;--role-user: #a78bfa;--role-assistant: #34d399;--role-system: #fb923c;--role-tool: #60a5fa;--state-error: #f87171;--dot-connected: #22c55e;--dot-connecting: #eab308;--dot-disconnected: #52525b;--dot-error: #f87171;--font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;--z-stage: 50;--z-tab: 100;--z-backdrop: 150;--z-modal: 200}*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--bg-base);color:var(--text-default);font-family:var(--font-sans)}button,select{font:inherit}button:focus-visible,select:focus-visible,.tool-call:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:active:enabled{transform:scale(.97)}.injected-stage{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:var(--z-stage, 50)}.floating-tab{position:fixed;top:16px;left:16px;z-index:var(--z-tab, 100);display:flex;align-items:center;gap:14px;pointer-events:all}.floating-tab .icon-btn{position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;padding:0;color:var(--text-white);opacity:.7;cursor:pointer;transition:opacity .15s,transform 80ms}.floating-tab .icon-btn:hover:enabled{opacity:1}.floating-tab .icon-btn:active:enabled{transform:scale(.96)}.floating-tab .icon-btn:disabled{opacity:.35;cursor:not-allowed}.shield-badge{position:absolute;right:-3px;bottom:-3px;font-size:9px;line-height:1;color:var(--dot-connecting)}.connection{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px}.dot{width:8px;height:8px;border-radius:50%;background:var(--dot-disconnected)}.dot.connected{background:var(--dot-connected)}.dot.connecting{background:var(--dot-connecting)}.dot.disconnected{background:var(--dot-disconnected)}.dot.error{background:var(--dot-error)}.split-dot{display:inline-block;width:8px;height:8px;border-radius:50%;overflow:hidden;line-height:0}.split-dot-half{display:block;width:8px;height:4px;background:var(--dot-disconnected)}.split-dot-half.connected{background:var(--dot-connected)}.split-dot-half.connecting{background:var(--dot-connecting)}.split-dot-half.disconnected{background:var(--dot-disconnected)}.split-dot-half.error{background:var(--dot-error)}.meters{display:flex;align-items:flex-end;gap:2px;height:16px}.meters.dimmed{opacity:.3}.bar{width:2px;height:16px;border-radius:2px;background:#22d3ee99;transform:scaleY(var(--level, .1));transform-origin:bottom;transition:transform 50ms linear}.more-actions-popover{position:absolute;left:0;top:36px;z-index:var(--z-tab, 100);width:min(320px,calc(100vw - 32px));padding:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);box-shadow:0 12px 32px #00000059}.field-label{display:block;margin-bottom:4px;color:var(--text-muted);font-size:11px;letter-spacing:.05em;text-transform:uppercase}select{width:100%;appearance:none;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-bright);padding:6px 10px;font-size:13px}.menu-item{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-bright);font-size:13px;text-align:left;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.menu-item:hover:enabled{border-color:#3f3f46;background:#ffffff0a}.menu-item:disabled{opacity:.4;cursor:not-allowed}.mic-note{color:var(--text-muted);font-size:12px;font-style:italic}.error-block{background:#f8717112;border:1px solid rgba(248,113,113,.2);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px}.error-title{color:var(--state-error);font-size:13px;font-weight:600}.retry{height:28px;border:1px solid rgba(248,113,113,.4);background:transparent;color:var(--state-error);font-size:12px;border-radius:6px;cursor:pointer}.modal-backdrop{position:fixed;inset:0;z-index:var(--z-backdrop, 150);background:#0009;display:flex;align-items:center;justify-content:center}.modal{position:relative;z-index:var(--z-modal, 200);width:min(680px,calc(100vw - 32px));max-width:680px;max-height:80vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);box-shadow:0 24px 64px #00000080}.modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0}.modal-title{color:var(--text-bright);font-size:14px;font-weight:500}.modal-close{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:6px}.modal-close:hover{color:var(--text-bright)}.modal-body{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}.loading-state{color:var(--text-muted);font-style:italic}.instructions-body{white-space:pre-wrap}.instructions-body p,.instructions-body ul,.instructions-body ol,.instructions-body li,.instructions-body blockquote,.instructions-body h1,.instructions-body h2,.instructions-body h3,.instructions-body h4,.instructions-body h5,.instructions-body h6{white-space:normal}.empty-state,.ended-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.empty-icon{width:32px;height:32px;opacity:.5}.transcript-item{padding:8px 12px;border-radius:0 6px 6px 0;color:var(--text-bright);font-size:14px;line-height:1.55;word-break:break-word}.transcript-item.streaming{opacity:1}.transcript-item.speaking{opacity:.85}.transcript-item.speaking:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--role-user);margin-right:6px;animation:speaking-pulse 1s ease-in-out infinite;vertical-align:middle}.transcript-item.role-assistant.speaking:before{background:var(--role-assistant)}@keyframes speaking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}.role-user{border-left:2px solid var(--role-user)}.role-assistant{border-left:2px solid var(--role-assistant)}.role-system{border-left:2px solid var(--role-system);background:#fb923c0f;color:#fb923cd9;font-size:13px;font-style:italic}.source-textInput{background:#a78bfa0a}.source-system.role-user,.source-system.role-assistant{border-left-style:dashed;color:var(--text-default)}.source-firstMessage{position:relative;border:1px solid rgba(167,139,250,.25);background:#a78bfa0f;border-radius:6px;padding-right:110px}.source-firstMessage:after{content:"first message";position:absolute;top:6px;right:8px;color:var(--text-dim);font-family:var(--font-mono);font-size:10px}.tool-call{background:#60a5fa12;border:1px solid rgba(96,165,250,.18);border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:12px;cursor:pointer;user-select:none}.tool-row{display:flex;align-items:center;gap:8px}.badge{border-radius:4px;padding:2px 7px;background:#34d3991f;color:#34d399;font-size:11px}.badge.started{background:#fbbf2426;color:#fbbf24}.badge.failed{background:#f871711f;color:#f87171}.badge.interrupted{background:#a1a1aa1f;color:#71717a}.tool-call-body{overflow:hidden}.section-label{margin:10px 0 4px;color:var(--text-dim);font-size:11px;letter-spacing:.08em}pre{margin:0 0 8px;padding:8px;overflow-x:auto;border-radius:4px;background:#00000040;color:var(--text-default);white-space:pre-wrap;word-break:break-all}.duplicate-page{min-height:100dvh;max-width:380px;margin:0 auto;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.thinking{display:flex;gap:4px;align-items:center;padding:6px 10px;margin:0 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)}.thinking .tdot{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:.4;animation:thinking-pulse 1s ease-in-out infinite}.thinking .tdot:nth-child(2){animation-delay:.15s}.thinking .tdot:nth-child(3){animation-delay:.3s}@keyframes thinking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}</style>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';

// src/controller.ts
var XAI_CLIENT_SECRET_URL = "https://api.x.ai/v1/realtime/client_secrets";
var VOICE_CONNECT_TIMEOUT_MS = 3e4;
var BrowserProxiedVoiceConnection = class {
  socket;
  #handlers = /* @__PURE__ */ new Map();
  #sendToBrowser;
  #closed = false;
  constructor(input) {
    this.#sendToBrowser = input.sendToBrowser;
    this.socket = input.socket;
  }
  send(event, gate) {
    if (this.#closed) return;
    this.#sendToBrowser({ type: "voice.send", data: gate ? { event, gate } : { event } });
  }
  close(props) {
    if (this.#closed) return;
    this.#closed = true;
    this.#sendToBrowser({
      type: "voice.session.close",
      data: { code: props?.code ?? 1e3, reason: props?.reason ?? "closed" }
    });
  }
  on(eventName, handler) {
    const list = this.#handlers.get(eventName) ?? [];
    list.push(handler);
    this.#handlers.set(eventName, list);
    return () => {
      const current = this.#handlers.get(eventName);
      if (!current) return;
      const next = current.filter((entry) => entry !== handler);
      if (next.length === 0) this.#handlers.delete(eventName);
      else this.#handlers.set(eventName, next);
    };
  }
  controller() {
    return {
      emit: (eventName, payload) => {
        const list = this.#handlers.get(eventName);
        if (!list) return;
        for (const handler of [...list]) {
          try {
            handler(payload);
          } catch (cause) {
            queueMicrotask(() => {
              throw cause instanceof Error ? cause : new Error(String(cause));
            });
          }
        }
      },
      emitClose: () => {
        this.#closed = true;
      }
    };
  }
};
function createVoiceAgentServer(config) {
  return new VoiceAgentServerControllerImpl(config);
}
var VoiceAgentServerControllerImpl = class extends StrictEventEmitter {
  #config;
  #voiceFactory;
  #tools;
  #toolDescriptions = /* @__PURE__ */ new Map();
  #toolExecutors = /* @__PURE__ */ new Map();
  #previousConversations = {};
  #browserClient = { connected: false };
  #status = { server: "stopped", browserClient: "none", conversation: "none" };
  #conversation;
  #server;
  #wss;
  #browserSocket;
  #realtime;
  // Tracks whether the realtime connection can currently carry a
  // `response.create`. The realtime `error` handler does NOT transition
  // conversation status (status stays "active" after a session error), so a
  // proactive opening gated only on status would `send()` into a dead
  // browser-proxied socket and resolve silently. This flips false on close and
  // on a surfaced session error so callers can detect that condition.
  #realtimeLive = false;
  #browserProxiedEmitter;
  #pendingVoiceSession;
  #lifecycleLocked = false;
  #autoResponseEnabled = true;
  #responseInFlight = false;
  #instructions;
  #pendingToolResultCount = 0;
  #injectedHtml = null;
  #injectedVersion = 0;
  #injectedWatcher;
  #injectedGeneration = 0;
  #injectedWatchDebounce;
  #injectedPoll;
  // True while the watched path is absent/unreadable and the error document is
  // already served — used to de-duplicate the error render/broadcast/event so a
  // file that stays missing does not produce a per-poll storm.
  #injectedAbsent = false;
  #activeToolAbortControllers = /* @__PURE__ */ new Map();
  #streamingAssistantText = /* @__PURE__ */ new Map();
  // Monotonic logical clock for timeline ordering. Decoupled from xAI event
  // arrival time so a late ASR/user-slot event still lands in its true
  // conversational slot. See `#nextSequence` / `#assignSequence`.
  #sequenceCounter = 0;
  // Open while an assistant response is in flight. `response.created` reserves
  // a sequence slot for the (possibly late) user turn that triggered the
  // response and one for the assistant reply itself; anything else appended
  // during the window (injections, tool calls) slots strictly between them.
  #responseWindow = null;
  // SDK built-in tools — always advertised to the model and dispatchable,
  // independent of the CLI/daemon. `pause_conversation` has exactly the same
  // effect as the user pressing the pause control (mic + audio output stop
  // until resumed). A user-supplied tool of the same name overrides the
  // built-in (built-ins are registered before config tools in the ctor).
  #builtinTools = {
    pause_conversation: {
      description: "Pause the voice conversation now \u2014 exactly as if the user pressed the pause control: the microphone stops capturing and audio output halts until the user resumes. Call this when the user asks to pause, hold on, take a break, or wants silence; not for ordinary turn-taking.",
      parameters: external_exports.object({}),
      execute: async () => {
        if (this.#status.conversation !== "active") {
          return { ok: false, reason: `conversation is ${this.#status.conversation}` };
        }
        await this.pauseConversation();
        return { ok: true, paused: true };
      }
    }
  };
  // Built-ins first so an explicit user tool of the same name overrides.
  #allTools() {
    return { ...this.#builtinTools, ...this.#tools };
  }
  constructor(config) {
    super();
    validateConfig(config);
    this.#config = normalizeConfig(config);
    this.#voiceFactory = config.__voiceFactory;
    this.#tools = config.tools;
    this.#instructions = config.realtime.instructions;
    for (const [name, definition] of Object.entries(this.#builtinTools)) {
      this.#toolDescriptions.set(name, definition.description);
      this.#toolExecutors.set(name, definition.execute);
    }
    for (const [name, definition] of Object.entries(config.tools)) {
      this.#toolDescriptions.set(name, definition.description);
      this.#toolExecutors.set(name, definition.execute);
    }
  }
  get status() {
    return { ...this.#status };
  }
  get responseInFlight() {
    return this.#responseInFlight;
  }
  get realtimeConnected() {
    return this.#realtimeLive && this.#realtime !== void 0;
  }
  get currentConversation() {
    return this.#conversation ? snapshotConversation(this.#conversation) : void 0;
  }
  get previousConversations() {
    return { ...this.#previousConversations };
  }
  get browserClient() {
    return cloneBrowserClient(this.#browserClient);
  }
  async start() {
    if (this.#status.server !== "stopped") {
      throw this.#fail("SERVER_ALREADY_STARTED", "Server can only be started from the stopped state.", {
        server: this.#status.server
      });
    }
    this.#setServerStatus("starting");
    try {
      const html = await this.#loadUi();
      const server = createServer((request, response) => this.#handleHttpRequest(request, response, html));
      const wss = new import_websocket_server.default({ noServer: true });
      server.on("upgrade", (request, socket, head) => {
        if (request.url !== "/ws") {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
      });
      wss.on("connection", (socket) => this.#handleBrowserConnection(socket));
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.#config.port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      this.#server = server;
      this.#wss = wss;
      this.#setServerStatus("active");
      this.emit("server.started", {
        port: this.#config.port,
        url: `http://localhost:${this.#config.port}`,
        createdAt: /* @__PURE__ */ new Date()
      });
    } catch (cause) {
      this.#setServerStatus("error");
      throw this.#fail("SERVER_START_FAILED", "Failed to start the Voice Agent server.", void 0, cause);
    }
  }
  async stop(options) {
    this.#assertLifecycleUnlocked();
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Server can only be stopped from the active state.", {
        server: this.#status.server
      });
    }
    this.#setServerStatus("stopping");
    try {
      if (this.#conversation) {
        await this.#endConversationLocked(options?.conversationShutdownTimeoutMs);
      }
      this.#closeRealtime("server stopped");
      await new Promise((resolve, reject) => {
        for (const client of this.#wss?.clients ?? []) {
          client.terminate();
        }
        this.#wss?.close();
        this.#browserSocket?.terminate();
        this.#server?.closeAllConnections?.();
        this.#server?.close((error) => error ? reject(error) : resolve());
      });
      this.#teardownInjected();
      this.#server = void 0;
      this.#wss = void 0;
      this.#clearBrowserClient();
      this.#setServerStatus("stopped");
      this.emit("server.stopped", { port: this.#config.port, createdAt: /* @__PURE__ */ new Date() });
    } catch (cause) {
      this.#setServerStatus("error");
      throw this.#fail("SERVER_STOP_FAILED", "Failed to stop the Voice Agent server cleanly.", void 0, cause);
    }
  }
  async startConversation() {
    this.#assertLifecycleUnlocked();
    await this.#startConversationLocked();
  }
  async pauseConversation() {
    this.#assertLifecycleUnlocked();
    const conversation = this.#requireConversation("CONVERSATION_NOT_ACTIVE");
    if (conversation.status !== "active") {
      throw this.#fail("CONVERSATION_NOT_ACTIVE", "Conversation must be active to pause.", {
        conversation: conversation.status
      });
    }
    conversation.status = "paused";
    this.#setConversationStatus("paused");
    this.#broadcastState();
    this.emit("conversation.paused", { conversationId: conversation.id, createdAt: /* @__PURE__ */ new Date() });
  }
  async resumeConversation() {
    this.#assertLifecycleUnlocked();
    const conversation = this.#requireConversation("CONVERSATION_NOT_PAUSED");
    if (conversation.status !== "paused") {
      throw this.#fail("CONVERSATION_NOT_PAUSED", "Conversation must be paused to resume.", {
        conversation: conversation.status
      });
    }
    conversation.status = "active";
    this.#setConversationStatus("active");
    this.#broadcastState();
    this.emit("conversation.resumed", { conversationId: conversation.id, createdAt: /* @__PURE__ */ new Date() });
  }
  async requestResponse() {
    await this.#requestModelResponse();
  }
  async setAutoResponse(enabled) {
    this.#autoResponseEnabled = enabled;
  }
  async endConversation(options) {
    this.#assertLifecycleUnlocked();
    try {
      await this.#endConversationLocked(options?.shutdownTimeoutMs);
    } catch (error) {
      if (error instanceof VoiceAgentServerError) {
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error,
          createdAt: /* @__PURE__ */ new Date()
        });
      }
      throw error;
    }
  }
  async resetConversation(options) {
    this.#assertLifecycleUnlocked();
    this.#lifecycleLocked = true;
    try {
      const previous = await this.#endConversationLocked(options?.shutdownTimeoutMs, "resetting");
      await this.#startConversationLocked();
      const current = this.currentConversation;
      if (!current) {
        throw this.#fail("INTERNAL_INVARIANT_VIOLATION", "Reset completed without a current conversation.");
      }
      this.emit("conversation.reset", {
        previousConversation: previous,
        currentConversation: current,
        createdAt: /* @__PURE__ */ new Date()
      });
    } catch (cause) {
      const error = cause instanceof VoiceAgentServerError ? cause : this.#fail("CONVERSATION_RESET_FAILED", "Failed to reset the conversation.", void 0, cause);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error,
        createdAt: /* @__PURE__ */ new Date()
      });
      throw error;
    } finally {
      this.#lifecycleLocked = false;
    }
  }
  async injectUserMessage(input) {
    const source = input.source ?? "system";
    const text = normalizeText(input.text);
    if (!text) {
      throw this.#fail("MESSAGE_INJECTION_EMPTY_TEXT", "Injected message text must be non-empty.");
    }
    const item = this.#injectMessage("user", source, text, "MESSAGE_INJECTION_INVALID_STATE");
    if (input.triggerResponse !== false) await this.#requestModelResponse();
    return item;
  }
  async injectAssistantMessage(input) {
    return this.#injectMessage("assistant", input.source ?? "system", input.text, "MESSAGE_INJECTION_INVALID_STATE");
  }
  async injectSystemMessage(input) {
    const item = this.#injectMessage("system", "system", input.text, "MESSAGE_INJECTION_INVALID_STATE");
    if (input.triggerResponse === true) await this.#requestModelResponse();
    return item;
  }
  async setHtml(input) {
    this.#teardownInjected();
    this.#injectedGeneration += 1;
    const gen = this.#injectedGeneration;
    if (input === null) {
      this.#injectedHtml = null;
      this.#injectedVersion += 1;
      this.#broadcastInjected();
      return;
    }
    if (typeof input === "object" && "html" in input && typeof input.html === "string") {
      this.#injectedHtml = input.html;
      this.#injectedVersion += 1;
      this.#broadcastInjected();
      return;
    }
    if (typeof input === "object" && "path" in input && typeof input.path === "string") {
      const abs = resolvePath(input.path);
      let body;
      try {
        body = await readFile(abs, "utf-8");
      } catch (cause) {
        if (gen !== this.#injectedGeneration) return;
        this.#serveInjectedError(abs, cause);
        this.#pollForInjectedFile(abs, gen);
        return;
      }
      if (gen !== this.#injectedGeneration) return;
      this.#injectedAbsent = false;
      this.#injectedHtml = body;
      this.#injectedVersion += 1;
      this.#broadcastInjected();
      this.#installInjectedWatcher(abs, gen);
      return;
    }
    throw this.#fail("CONFIG_INVALID", "setHtml() requires { html }, { path }, or null.", {
      received: input === null ? "null" : typeof input
    });
  }
  #teardownInjected() {
    if (this.#injectedWatchDebounce) {
      clearTimeout(this.#injectedWatchDebounce);
      this.#injectedWatchDebounce = void 0;
    }
    if (this.#injectedPoll) {
      clearInterval(this.#injectedPoll);
      this.#injectedPoll = void 0;
    }
    if (this.#injectedWatcher) {
      this.#injectedWatcher.close();
      this.#injectedWatcher = void 0;
    }
    this.#injectedAbsent = false;
  }
  #serveInjectedError(abs, cause) {
    if (this.#injectedAbsent) return;
    this.#injectedAbsent = true;
    const error = this.#fail(
      "INJECTED_FILE_UNREADABLE",
      `Injected HTML file is unreadable: ${abs}`,
      { path: abs },
      cause
    );
    this.#injectedHtml = this.#injectedErrorDocument(abs, error);
    this.#injectedVersion += 1;
    this.#broadcastInjected();
    this.emit("injected.error", {
      path: abs,
      code: error.code,
      message: error.message,
      error,
      createdAt: /* @__PURE__ */ new Date()
    });
  }
  #installInjectedWatcher(abs, gen) {
    if (gen !== this.#injectedGeneration) return;
    const rerun = () => {
      if (this.#injectedWatchDebounce) clearTimeout(this.#injectedWatchDebounce);
      this.#injectedWatchDebounce = setTimeout(() => {
        this.#injectedWatchDebounce = void 0;
        void this.#reloadInjectedFile(abs, gen);
      }, 75);
    };
    const arm = () => {
      if (gen !== this.#injectedGeneration) return;
      let watcher;
      try {
        watcher = watch(abs);
      } catch (cause) {
        this.#serveInjectedError(abs, cause);
        this.#pollForInjectedFile(abs, gen);
        return;
      }
      this.#injectedWatcher = watcher;
      watcher.on("change", rerun);
      watcher.on("error", () => {
        watcher.close();
        rerun();
      });
      watcher.on("close", () => {
        if (gen === this.#injectedGeneration && this.#injectedWatcher === watcher) rerun();
      });
    };
    arm();
  }
  async #reloadInjectedFile(abs, gen) {
    if (gen !== this.#injectedGeneration) return;
    let body;
    try {
      body = await readFile(abs, "utf-8");
    } catch (cause) {
      if (gen !== this.#injectedGeneration) return;
      this.#serveInjectedError(abs, cause);
      this.#pollForInjectedFile(abs, gen);
      return;
    }
    if (gen !== this.#injectedGeneration) return;
    this.#injectedAbsent = false;
    this.#injectedHtml = body;
    this.#injectedVersion += 1;
    this.#broadcastInjected();
    this.#rearmInjectedWatcher(abs, gen);
  }
  #rearmInjectedWatcher(abs, gen) {
    if (gen !== this.#injectedGeneration) return;
    if (this.#injectedWatcher) {
      this.#injectedWatcher.close();
      this.#injectedWatcher = void 0;
    }
    this.#installInjectedWatcher(abs, gen);
  }
  // Quiet recovery path for a missing/unreadable watched file. The error
  // document has already been served exactly once (#serveInjectedError is
  // idempotent via #injectedAbsent). Here we drop the dead fs.watch
  // handle/debounce and poll at a low frequency: each tick only does anything
  // when the file becomes readable again, at which point we re-render once and
  // hand back to the normal fs.watch happy path. While the file stays absent a
  // tick is a single failed readFile with no version bump, broadcast, or event.
  #pollForInjectedFile(abs, gen) {
    if (gen !== this.#injectedGeneration) return;
    if (this.#injectedWatchDebounce) {
      clearTimeout(this.#injectedWatchDebounce);
      this.#injectedWatchDebounce = void 0;
    }
    if (this.#injectedWatcher) {
      this.#injectedWatcher.close();
      this.#injectedWatcher = void 0;
    }
    if (this.#injectedPoll) clearInterval(this.#injectedPoll);
    this.#injectedPoll = setInterval(() => {
      void (async () => {
        if (gen !== this.#injectedGeneration) return;
        let body;
        try {
          body = await readFile(abs, "utf-8");
        } catch {
          return;
        }
        if (gen !== this.#injectedGeneration) return;
        if (this.#injectedPoll) {
          clearInterval(this.#injectedPoll);
          this.#injectedPoll = void 0;
        }
        this.#injectedAbsent = false;
        this.#injectedHtml = body;
        this.#injectedVersion += 1;
        this.#broadcastInjected();
        this.#installInjectedWatcher(abs, gen);
      })();
    }, 1e3);
  }
  #broadcastInjected() {
    this.#broadcastState();
    this.#broadcast({
      type: "stage.injected",
      data: { injectedVersion: this.#injectedHtml === null ? null : this.#injectedVersion }
    });
  }
  #injectedErrorDocument(path, error) {
    const safePath = escapeHtml(path);
    const safeCode = escapeHtml(error.code);
    const safeMessage = escapeHtml(error.message);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Injected HTML error</title></head><body style="margin:0;font-family:system-ui,sans-serif;background:#1a1a1a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="max-width:40rem;padding:2rem;"><h1 style="font-size:1.25rem;margin:0 0 1rem;color:#ff6b6b;">Injected HTML unavailable</h1><p style="margin:0 0 0.5rem;">Could not read the injected HTML file:</p><pre style="background:#000;padding:0.75rem;border-radius:0.25rem;overflow:auto;">${safePath}</pre><p style="margin:1rem 0 0;opacity:0.8;">${safeCode}: ${safeMessage}</p></div></body></html>`;
  }
  async cancelToolCall(callId) {
    const conversation = this.#requireInjectableConversation("CONVERSATION_INVALID_STATE");
    const toolCall = conversation.toolCalls.find((record) => record.callId === callId);
    if (!toolCall || toolCall.status !== "started") {
      throw this.#fail("TOOL_CALL_INTERRUPTED", "No in-flight tool call exists for the provided callId.", {
        callId
      });
    }
    this.#activeToolAbortControllers.get(callId)?.abort("cancelToolCall");
    this.#markToolInterrupted(conversation, toolCall.id, toolCall.callId, toolCall.toolName, "cancelToolCall");
    this.#broadcastState();
  }
  async updateVoiceSession(input) {
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Realtime updates require an active server.", {
        server: this.#status.server
      });
    }
    const knownKeys = /* @__PURE__ */ new Set(["instructions", "tools"]);
    const unknownKeys = Object.keys(input).filter((k) => !knownKeys.has(k));
    if (unknownKeys.length > 0) {
      throw this.#fail("SESSION_UPDATE_FAILED", "Realtime update input contains unknown keys.", {
        unknownKeys
      });
    }
    const toolEntries = Object.entries(input.tools ?? {});
    if (input.instructions === void 0 && toolEntries.length === 0) {
      throw this.#fail("SESSION_UPDATE_FAILED", "Realtime update input cannot be empty.");
    }
    for (const [toolName] of toolEntries) {
      if (!(toolName in this.#tools)) {
        throw this.#fail("TOOL_NOT_FOUND", "Realtime update referenced an unknown tool.", { toolName });
      }
    }
    if (input.instructions !== void 0) this.#instructions = input.instructions;
    const updatedTools = [];
    for (const [toolName, patch] of toolEntries) {
      if (!patch) continue;
      if (patch.description !== void 0) this.#toolDescriptions.set(toolName, patch.description);
      if (patch.execute !== void 0) this.#toolExecutors.set(toolName, patch.execute);
      updatedTools.push(toolName);
    }
    try {
      this.#sendSessionUpdate();
    } catch (cause) {
      throw this.#fail("SESSION_UPDATE_FAILED", "Voice session rejected the update.", void 0, cause);
    }
    this.emit("voice.session.updated", {
      instructionsUpdated: input.instructions !== void 0,
      toolsUpdated: updatedTools,
      createdAt: /* @__PURE__ */ new Date()
    });
  }
  async #createRealtimeConnection() {
    try {
      if (this.#voiceFactory) {
        return await this.#voiceFactory({ apiKey: this.#config.apiKey, model: this.#config.realtime.model });
      }
      const socketRef = {
        readyState: 0
        /* CONNECTING */
      };
      const connection = new BrowserProxiedVoiceConnection({
        sendToBrowser: (envelope) => this.#broadcast(envelope),
        socket: socketRef
      });
      this.#browserProxiedEmitter = connection.controller();
      const connected = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.#pendingVoiceSession = void 0;
          reject(new Error("Timed out waiting for browser voice.session.connected."));
        }, VOICE_CONNECT_TIMEOUT_MS);
        this.#pendingVoiceSession = { resolve, reject, timeout };
      });
      this.#broadcast({ type: "voice.session.start" });
      try {
        await connected;
      } catch (cause) {
        this.#browserProxiedEmitter = void 0;
        throw cause;
      }
      socketRef.readyState = 1;
      return connection;
    } catch (cause) {
      const error = this.#fail(
        "CONVERSATION_START_FAILED",
        "Failed to connect to the xAI Voice Agent.",
        void 0,
        cause
      );
      this.emit("conversation.error", { conversationId: this.#conversation?.id, error, createdAt: /* @__PURE__ */ new Date() });
      throw error;
    }
  }
  async #mintEphemeralClientSecret() {
    const model2 = this.#config.realtime.model;
    const response = await fetch(XAI_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.#config.apiKey}`
      },
      // xAI mint endpoint accepts only expires_after; model and session config
      // go over the WebSocket via session.update after connect.
      body: JSON.stringify({ expires_after: { seconds: 300 } })
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`xAI client_secrets returned ${response.status}: ${bodyText}`);
    }
    const json = await response.json();
    const cs = json.client_secret;
    const csObj = cs !== null && typeof cs === "object" ? cs : void 0;
    const token = (typeof json.value === "string" ? json.value : void 0) ?? (typeof json.token === "string" ? json.token : void 0) ?? (typeof cs === "string" ? cs : void 0) ?? (typeof csObj?.value === "string" ? csObj.value : void 0) ?? (typeof csObj?.token === "string" ? csObj.token : void 0);
    const rawExpiry = (typeof json.expires_at === "number" ? json.expires_at : void 0) ?? (typeof csObj?.expires_at === "number" ? csObj.expires_at : void 0);
    if (typeof token !== "string" || typeof rawExpiry !== "number") {
      throw new Error(`xAI client_secrets response has unexpected shape. Raw body: ${JSON.stringify(json)}`);
    }
    const expiresAt = rawExpiry > 1e12 ? rawExpiry / 1e3 : rawExpiry;
    const unitApplied = rawExpiry > 1e12 ? "milliseconds \u2192 normalized to seconds" : "seconds";
    this.emit("log", {
      level: "info",
      code: "SESSION_ERROR",
      message: `xAI client_secrets expires_at interpreted as ${unitApplied} (raw=${rawExpiry}, normalized=${expiresAt}).`,
      details: { rawExpiry, expiresAt, unitApplied },
      createdAt: /* @__PURE__ */ new Date()
    });
    return { clientSecret: token, model: model2, expiresAt };
  }
  #wireRealtimeConnection(realtime) {
    realtime.on("error", (error) => {
      if (error.error?.code === "response_cancel_not_active") return;
      this.#realtimeLive = false;
      const wrapped = toVoiceError("SESSION_ERROR", "Voice Agent session reported an error.", void 0, error);
      this.#log("error", wrapped);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error: wrapped,
        createdAt: /* @__PURE__ */ new Date()
      });
    });
    realtime.on(
      "conversation.item.input_audio_transcription.completed",
      (event) => this.#handleUserTranscriptCompleted(event)
    );
    realtime.on("conversation.item.added", (event) => this.#handleConversationItemAdded(event));
    realtime.on("response.created", () => {
      this.#responseInFlight = true;
      this.#openResponseWindow();
    });
    realtime.on("response.done", () => {
      this.#closeResponseWindow();
      if (!this.#responseInFlight) return;
      this.#responseInFlight = false;
      this.emit("response.completed", {
        conversationId: this.#conversation?.id,
        createdAt: /* @__PURE__ */ new Date()
      });
    });
    realtime.on(
      "response.output_audio_transcript.delta",
      (event) => this.#handleAssistantTranscriptDelta(event, "assistantAudio")
    );
    realtime.on(
      "response.output_audio_transcript.done",
      (event) => this.#handleAssistantTranscriptDone(event, "assistantAudio")
    );
    realtime.on("response.text.delta", (event) => this.#handleAssistantTranscriptDelta(event, "assistantText"));
    realtime.on("response.text.done", (event) => this.#handleAssistantTranscriptDone(event, "assistantText"));
    realtime.on(
      "response.output_audio.delta",
      (event) => (
        // Relay to browser for visualizer only. Playback is driven by the
        // browser's xAI WS message handler directly — not by this relay.
        this.#broadcast({ type: "audio.output.delta", data: { audio: event.delta } })
      )
    );
    realtime.on("response.function_call_arguments.done", (event) => {
      void this.#handleToolCall(event);
    });
    const knownEventTypes = /* @__PURE__ */ new Set([
      "error",
      "session.created",
      "conversation.created",
      "session.updated",
      "input_audio_buffer.speech_started",
      "input_audio_buffer.speech_stopped",
      "input_audio_buffer.committed",
      "input_audio_buffer.cleared",
      "conversation.item.deleted",
      "conversation.item.added",
      "conversation.item.input_audio_transcription.completed",
      "response.created",
      "response.output_item.added",
      "response.output_item.done",
      "response.content_part.added",
      "response.content_part.done",
      "response.output_audio_transcript.delta",
      "response.output_audio_transcript.done",
      "response.output_audio.delta",
      "response.output_audio.done",
      "response.text.delta",
      "response.text.done",
      "response.function_call_arguments.delta",
      "response.function_call_arguments.done",
      "response.cancelled",
      "response.failed",
      "mcp_list_tools.in_progress",
      "mcp_list_tools.completed",
      "mcp_list_tools.failed",
      "response.mcp_call_arguments.delta",
      "response.mcp_call_arguments.done",
      "response.mcp_call.in_progress",
      "response.mcp_call.completed",
      "response.mcp_call.failed",
      "response.done"
    ]);
    realtime.on("*", (event) => {
      if (!knownEventTypes.has(event.type)) {
        this.emit("log", {
          level: "warn",
          code: "VOICE_UNKNOWN_EVENT",
          message: `Unrecognized xAI event type: ${event.type}`,
          details: { eventType: event.type },
          createdAt: /* @__PURE__ */ new Date()
        });
      }
    });
  }
  #sendSessionUpdate() {
    if (!this.#realtime) return;
    this.#realtime.send({
      type: "session.update",
      session: {
        instructions: this.#instructions,
        model: this.#config.realtime.model,
        voice: this.#config.realtime.voice,
        audio: {
          input: { format: { type: "audio/pcm", rate: 48e3 } },
          output: { format: { type: "audio/pcm", rate: 48e3 } }
        },
        turn_detection: {
          type: "server_vad"
        },
        tools: toolsToRealtimeTools(this.#allTools(), this.#toolDescriptions)
      }
    });
  }
  #sendTranscriptItemToRealtime(item) {
    if (!this.#realtime) return;
    const contentType = item.role === "assistant" ? "output_text" : "input_text";
    this.#realtime.send({
      type: "conversation.item.create",
      item: {
        id: item.id,
        type: "message",
        role: item.role,
        status: "completed",
        content: [{ type: contentType, text: item.text }]
      }
    });
  }
  #closeRealtime(reason) {
    for (const abortController of this.#activeToolAbortControllers.values()) {
      abortController.abort(reason);
    }
    this.#activeToolAbortControllers.clear();
    this.#streamingAssistantText.clear();
    this.#pendingToolResultCount = 0;
    this.#realtime?.close({ code: 1e3, reason });
    this.#realtime = void 0;
    this.#realtimeLive = false;
    this.#browserProxiedEmitter = void 0;
    this.#failPendingVoiceSession(new Error(`Voice connection closed: ${reason}`));
  }
  #failPendingVoiceSession(cause) {
    const pending = this.#pendingVoiceSession;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.#pendingVoiceSession = void 0;
    pending.reject(cause);
  }
  #handleAssistantTranscriptDelta(event, source) {
    const conversation = this.#conversation;
    if (!conversation) return;
    if (!event.item_id || event.delta === void 0) return;
    const fullTextSoFar = (this.#streamingAssistantText.get(event.item_id) ?? "") + event.delta;
    this.#streamingAssistantText.set(event.item_id, fullTextSoFar);
    this.emit("transcript.delta", {
      conversationId: conversation.id,
      itemId: event.item_id,
      role: "assistant",
      source,
      delta: event.delta,
      fullTextSoFar,
      createdAt: /* @__PURE__ */ new Date()
    });
    this.#broadcast({
      type: "transcript.delta",
      data: {
        itemId: event.item_id,
        role: "assistant",
        source,
        delta: event.delta,
        fullTextSoFar
      }
    });
  }
  #handleAssistantTranscriptDone(event, source) {
    const conversation = this.#conversation;
    if (!conversation || !event.item_id) return;
    const accumulated = this.#streamingAssistantText.get(event.item_id);
    this.#streamingAssistantText.delete(event.item_id);
    const text = normalizeText(event.transcript ?? event.text ?? "") || (accumulated ? normalizeText(accumulated) : "");
    if (!text && accumulated === void 0) return;
    this.#appendTranscriptItemWithId(conversation, event.item_id, "assistant", source, text);
    this.#broadcastState();
  }
  // xAI's authoritative slot-creation event. Fires BEFORE response.created
  // for the assistant turn that follows, so creating the user transcript
  // slot here locks chronological order — transcription.completed (which
  // arrives later, ASR-bound) just fills in the text by item.id.
  #handleConversationItemAdded(event) {
    const conversation = this.#conversation;
    const item = event.item;
    if (!conversation || !item?.id || item.role !== "user") return;
    const initialText = normalizeText(
      item.content?.find((c) => c?.type === "input_audio")?.transcript ?? item.content?.find((c) => c?.type === "input_text")?.text ?? ""
    );
    this.#upsertUserTranscript(conversation, item.id, initialText);
  }
  #handleUserTranscriptCompleted(event) {
    const conversation = this.#conversation;
    if (!conversation || !event.item_id) return;
    const text = normalizeText(event.transcript ?? event.text ?? "");
    if (!text) return;
    this.#upsertUserTranscript(conversation, event.item_id, text);
  }
  // xAI emits `conversation.item.input_audio_transcription.completed` for both
  // partial and final transcripts under the same item_id. The first completed
  // creates the item; subsequent completeds must overwrite `text` in place and
  // re-broadcast so the UI re-renders the updated value.
  #upsertUserTranscript(conversation, id, text) {
    const existing = conversation.transcript.find((item) => item.id === id);
    if (existing) {
      if (existing.text === text) return existing;
      if (!text && existing.text) return existing;
      existing.text = text;
      this.emit("transcript.item", { item: existing, createdAt: /* @__PURE__ */ new Date() });
      this.#broadcast({ type: "transcript.item", data: existing });
      return existing;
    }
    return this.#appendTranscriptItemWithId(conversation, id, "user", "microphone", text);
  }
  #nextSequence() {
    this.#sequenceCounter += 1;
    return this.#sequenceCounter;
  }
  // Open the ordering window for a new assistant turn. Reserves a slot for the
  // user turn that triggered it (which may arrive late, after the assistant
  // transcript) and a strictly-later slot for the assistant reply. The two
  // reserved integers are adjacent, so window-internal inserts (injections,
  // tool calls) fall in the open interval between them via fractional offsets.
  #openResponseWindow() {
    if (this.#responseWindow) return;
    this.#responseWindow = {
      userSeq: this.#nextSequence(),
      assistantSeq: this.#nextSequence(),
      userAssigned: false,
      assistantAssigned: false,
      midCount: 0,
      draining: false
    };
  }
  // Called on `response.done`. If the triggering user slot already arrived the
  // turn is fully settled and the window closes. If the user
  // `conversation.item.added` is still in flight (late ASR race), keep the
  // window open and mark it draining so it closes the moment the user slot is
  // assigned — that late user turn must still sort ahead of this reply.
  #closeResponseWindow() {
    const window = this.#responseWindow;
    if (!window) return;
    if (window.userAssigned) {
      this.#responseWindow = null;
      return;
    }
    window.draining = true;
  }
  // Resolve the logical sequence for a freshly-appended timeline item.
  // - The user transcript slot is the reserved low value (regardless of how
  //   late `conversation.item.added` arrives).
  // - The assistant transcript slot is the reserved high value.
  // - Anything else during the window slots strictly between the two.
  #assignSequence(kind) {
    const window = this.#responseWindow;
    if (!window) return this.#nextSequence();
    if (kind === "user" && !window.userAssigned) {
      window.userAssigned = true;
      const seq2 = window.userSeq;
      if (window.draining) this.#responseWindow = null;
      return seq2;
    }
    if (kind === "assistant" && !window.assistantAssigned) {
      window.assistantAssigned = true;
      return window.assistantSeq;
    }
    window.midCount += 1;
    return window.userSeq + window.midCount / (window.midCount + 1);
  }
  #appendTranscriptItemWithId(conversation, id, role, source, text) {
    const existing = conversation.transcript.find((item2) => item2.id === id);
    if (existing) return existing;
    const item = {
      id,
      conversationId: conversation.id,
      role,
      source,
      text,
      createdAt: /* @__PURE__ */ new Date()
    };
    conversation.transcript.push(item);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "transcript",
      transcriptItemId: item.id,
      createdAt: item.createdAt,
      sequence: this.#assignSequence(role === "user" ? "user" : role === "assistant" ? "assistant" : "other")
    });
    this.emit("transcript.item", { item, createdAt: /* @__PURE__ */ new Date() });
    this.#broadcast({ type: "transcript.item", data: item });
    return item;
  }
  #removeTranscriptItem(conversation, itemId) {
    conversation.transcript = conversation.transcript.filter((item) => item.id !== itemId);
    conversation.timeline = conversation.timeline.filter(
      (item) => item.type !== "transcript" || item.transcriptItemId !== itemId
    );
  }
  async #handleToolCall(event) {
    const conversation = this.#conversation;
    if (!conversation) return;
    if (!event.item_id || !event.call_id || !event.name || event.arguments === void 0) return;
    const toolName = event.name;
    const tool = this.#allTools()[toolName];
    const failedAt = /* @__PURE__ */ new Date();
    if (!tool) {
      const error = toVoiceError("TOOL_NOT_FOUND", "Voice Agent requested an unknown tool.", { toolName });
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName,
        error,
        failedAt
      });
      this.#log("error", error);
      return;
    }
    let parsedJson;
    try {
      parsedJson = JSON.parse(event.arguments);
    } catch (cause) {
      const error = toVoiceError(
        "TOOL_ARGUMENT_VALIDATION_FAILED",
        "Tool arguments were not valid JSON.",
        {
          toolName,
          callId: event.call_id
        },
        cause
      );
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName,
        error,
        failedAt
      });
      this.#log("error", error);
      return;
    }
    const validation = tool.parameters.safeParse(parsedJson);
    if (!validation.success) {
      const error = toVoiceError("TOOL_ARGUMENT_VALIDATION_FAILED", "Tool arguments failed schema validation.", {
        toolName,
        callId: event.call_id,
        issues: validation.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
      this.emit("tool.call.failed", {
        phase: "validation",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName,
        arguments: parsedJson,
        error,
        failedAt
      });
      this.#log("error", error);
      return;
    }
    const startedAt = /* @__PURE__ */ new Date();
    const abortController = new AbortController();
    const typedToolName = toolName;
    const typedArguments = validation.data;
    const record = {
      id: event.item_id,
      conversationId: conversation.id,
      toolName: typedToolName,
      callId: event.call_id,
      arguments: typedArguments,
      startedAt,
      status: "started"
    };
    conversation.toolCalls.push(record);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "toolCall",
      toolCallId: record.id,
      createdAt: startedAt,
      sequence: this.#assignSequence("other")
    });
    this.#activeToolAbortControllers.set(event.call_id, abortController);
    this.#pendingToolResultCount += 1;
    let cleanedUpEarly = false;
    this.emit("tool.call.started", {
      conversationId: conversation.id,
      toolCallId: event.item_id,
      callId: event.call_id,
      toolName: typedToolName,
      arguments: typedArguments,
      startedAt
    });
    this.#broadcastState();
    const executor = this.#toolExecutors.get(toolName);
    try {
      const result = await executor?.(validation.data, {
        conversationId: conversation.id,
        callId: event.call_id,
        toolName,
        transcript: [...conversation.transcript],
        signal: abortController.signal
      });
      if (abortController.signal.aborted) {
        this.#markToolInterrupted(conversation, event.item_id, event.call_id, toolName, "aborted");
        return;
      }
      let serialized;
      if (!isJsonValue(result)) {
        serialized = void 0;
      } else {
        try {
          serialized = JSON.stringify(result);
        } catch {
          serialized = void 0;
        }
      }
      if (serialized === void 0) {
        const error = toVoiceError("TOOL_RESULT_SERIALIZATION_FAILED", "Tool result must be JSON-serializable.", {
          toolName,
          callId: event.call_id
        });
        Object.assign(record, { status: "failed", error, completedAt: /* @__PURE__ */ new Date() });
        this.emit("tool.call.failed", {
          phase: "serialization",
          conversationId: conversation.id,
          toolCallId: event.item_id,
          callId: event.call_id,
          toolName: typedToolName,
          arguments: typedArguments,
          error,
          startedAt,
          failedAt: /* @__PURE__ */ new Date()
        });
        this.#log("error", error);
        return;
      }
      const completedAt = /* @__PURE__ */ new Date();
      Object.assign(record, { status: "completed", result, completedAt });
      this.emit("tool.call.completed", {
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName,
        arguments: typedArguments,
        result,
        startedAt,
        completedAt
      });
      this.#pendingToolResultCount -= 1;
      this.#activeToolAbortControllers.delete(event.call_id);
      cleanedUpEarly = true;
      this.#sendToolResult(event.call_id, serialized);
    } catch (cause) {
      if (abortController.signal.aborted) {
        this.#markToolInterrupted(conversation, event.item_id, event.call_id, toolName, "aborted");
        return;
      }
      const error = toVoiceError(
        "TOOL_EXECUTION_FAILED",
        "Tool execution failed.",
        { toolName, callId: event.call_id },
        cause
      );
      Object.assign(record, { status: "failed", error, completedAt: /* @__PURE__ */ new Date() });
      this.emit("tool.call.failed", {
        phase: "execution",
        conversationId: conversation.id,
        toolCallId: event.item_id,
        callId: event.call_id,
        toolName: typedToolName,
        arguments: typedArguments,
        error,
        startedAt,
        failedAt: /* @__PURE__ */ new Date()
      });
      this.#log("error", error);
    } finally {
      if (!cleanedUpEarly) {
        this.#pendingToolResultCount -= 1;
        this.#activeToolAbortControllers.delete(event.call_id);
      }
      this.#broadcastState();
    }
  }
  #sendToolResult(callId, serialized) {
    this.#realtime?.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: serialized
      }
    });
    if (this.#status.conversation === "active" && this.#autoResponseEnabled && this.#pendingToolResultCount === 0) {
      this.#realtime?.send({ type: "response.create" }, "playback-drained");
    }
  }
  #markToolInterrupted(conversation, toolCallId, callId, toolName, reason) {
    const record = conversation.toolCalls.find((toolCall) => toolCall.id === toolCallId);
    if (record && record.status !== "started") return;
    const interruptedAt = /* @__PURE__ */ new Date();
    const error = toVoiceError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted.", { callId, reason });
    if (record) Object.assign(record, { status: "interrupted", error, completedAt: interruptedAt });
    this.emit("tool.call.interrupted", {
      conversationId: conversation.id,
      toolCallId,
      callId,
      toolName,
      reason,
      interruptedAt
    });
  }
  async #startConversationLocked() {
    if (this.#status.server !== "active") {
      throw this.#fail("SERVER_NOT_STARTED", "Conversation start requires an active server.", {
        server: this.#status.server
      });
    }
    if (!this.#browserClient.connected || !this.#browserSocket || this.#browserSocket.readyState !== this.#browserSocket.OPEN) {
      throw this.#fail(
        "BROWSER_CLIENT_REQUIRED",
        "Exactly one browser client must be connected before conversation start."
      );
    }
    if (this.#conversation) {
      throw this.#fail("CONVERSATION_ALREADY_ACTIVE", "A current conversation already exists.", {
        conversationId: this.#conversation.id,
        status: this.#conversation.status
      });
    }
    if (!this.#browserClient.audio?.ready) {
      const error = this.#fail(
        "MICROPHONE_DEVICE_UNAVAILABLE",
        "Microphone permission and device readiness are required."
      );
      this.emit("browser.audio.error", { clientId: this.#browserClient.clientId, error, createdAt: /* @__PURE__ */ new Date() });
      throw error;
    }
    this.#setConversationStatus("starting");
    this.#broadcastState();
    try {
      const realtime = await this.#createRealtimeConnection();
      this.#realtime = realtime;
      this.#realtimeLive = true;
      this.#wireRealtimeConnection(realtime);
      this.#sendSessionUpdate();
      const conversation = {
        id: createId("conv"),
        status: "starting",
        startedAt: /* @__PURE__ */ new Date(),
        transcript: [],
        toolCalls: [],
        timeline: []
      };
      this.#conversation = conversation;
      this.#sequenceCounter = 0;
      this.#responseWindow = null;
      this.#pendingToolResultCount = 0;
      conversation.status = "active";
      this.#setConversationStatus("active");
      if (this.#config.browserSession.firstMessage) {
        const role = this.#config.browserSession.firstMessageRole;
        const firstMessage = this.#appendTranscriptItem(
          conversation,
          role,
          "firstMessage",
          this.#config.browserSession.firstMessage
        );
        this.#sendTranscriptItemToRealtime(firstMessage);
        await this.#requestModelResponse();
      }
      this.#broadcastState();
      this.emit("conversation.started", { conversation: snapshotConversation(conversation), createdAt: /* @__PURE__ */ new Date() });
    } catch (cause) {
      this.#setConversationStatus("none");
      this.#broadcastState();
      throw cause;
    }
  }
  async #endConversationLocked(_timeoutMs, transitionalStatus = "ending") {
    const conversation = this.#requireConversation("NO_CURRENT_CONVERSATION");
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail("CONVERSATION_INVALID_STATE", "Conversation must be active or paused to end.", {
        conversation: conversation.status
      });
    }
    conversation.status = transitionalStatus;
    this.#setConversationStatus(transitionalStatus === "resetting" ? "resetting" : "ending");
    this.#interruptInFlightToolCalls(conversation, transitionalStatus);
    this.#closeRealtime(`conversation ${transitionalStatus}`);
    this.#autoResponseEnabled = true;
    this.#responseInFlight = false;
    this.#pendingToolResultCount = 0;
    conversation.status = "ended";
    conversation.endedAt = /* @__PURE__ */ new Date();
    const archived = snapshotConversation(conversation);
    this.#previousConversations[conversation.id] = archived;
    this.#conversation = void 0;
    this.#setConversationStatus("none");
    this.#broadcastState();
    this.emit("conversation.ended", { conversation: archived, createdAt: /* @__PURE__ */ new Date() });
    return archived;
  }
  #appendTranscriptItem(conversation, role, source, text) {
    const item = {
      id: createId("msg"),
      conversationId: conversation.id,
      role,
      source,
      text,
      createdAt: /* @__PURE__ */ new Date()
    };
    conversation.transcript.push(item);
    conversation.timeline.push({
      id: createId("timeline"),
      type: "transcript",
      transcriptItemId: item.id,
      createdAt: item.createdAt,
      // Injected turns carry no xAI item id; "other" slots them between the
      // triggering user turn and the assistant reply when a response is in
      // flight, otherwise at the next monotonic position.
      sequence: this.#assignSequence("other")
    });
    this.emit("transcript.item", { item, createdAt: /* @__PURE__ */ new Date() });
    this.#broadcast({ type: "transcript.item", data: item });
    return item;
  }
  #injectMessage(role, source, text, invalidStateCode) {
    let conversation;
    try {
      conversation = this.#requireInjectableConversation(invalidStateCode);
    } catch (error) {
      if (error instanceof VoiceAgentServerError) {
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error,
          createdAt: /* @__PURE__ */ new Date()
        });
      }
      throw error;
    }
    const normalized = normalizeText(text);
    if (!normalized) {
      throw this.#fail("MESSAGE_INJECTION_EMPTY_TEXT", "Injected message text must be non-empty.");
    }
    let item;
    try {
      item = this.#appendTranscriptItem(conversation, role, source, normalized);
      this.#sendTranscriptItemToRealtime(item);
      this.#broadcastState();
      return item;
    } catch (cause) {
      if (item) this.#removeTranscriptItem(conversation, item.id);
      const error = this.#fail(
        "MESSAGE_INJECTION_FAILED",
        "Failed to inject message into the current conversation.",
        void 0,
        cause
      );
      this.emit("conversation.error", {
        conversationId: conversation.id,
        error,
        createdAt: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  async #requestModelResponse() {
    const conversation = this.#requireInjectableConversation("MESSAGE_INJECTION_INVALID_STATE");
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail("MESSAGE_RESPONSE_TRIGGER_FAILED", "Cannot trigger a model response in the current state.", {
        conversation: conversation.status
      });
    }
    try {
      this.#realtime?.send({ type: "response.create" });
    } catch (cause) {
      throw this.#fail(
        "MESSAGE_RESPONSE_TRIGGER_FAILED",
        "Voice session rejected the response request.",
        void 0,
        cause
      );
    }
  }
  #requireConversation(code) {
    if (!this.#conversation) {
      throw this.#fail(code, "There is no current conversation.");
    }
    return this.#conversation;
  }
  #requireInjectableConversation(code) {
    const conversation = this.#requireConversation(code);
    if (conversation.status !== "active" && conversation.status !== "paused") {
      throw this.#fail(code, "Current conversation is not active or paused.", {
        conversation: conversation.status
      });
    }
    return conversation;
  }
  #assertLifecycleUnlocked() {
    if (this.#lifecycleLocked) {
      throw this.#fail("CONVERSATION_INVALID_STATE", "Another conversation lifecycle operation is in progress.");
    }
  }
  #interruptInFlightToolCalls(conversation, reason) {
    for (const toolCall of conversation.toolCalls) {
      if (toolCall.status !== "started") continue;
      const interruptedAt = /* @__PURE__ */ new Date();
      const error = toVoiceError("TOOL_CALL_INTERRUPTED", "Tool call was interrupted by conversation cleanup.", {
        callId: toolCall.callId,
        reason
      });
      Object.assign(toolCall, { status: "interrupted", error, completedAt: interruptedAt });
      this.emit("tool.call.interrupted", {
        conversationId: conversation.id,
        toolCallId: toolCall.id,
        callId: toolCall.callId,
        toolName: toolCall.toolName,
        arguments: toolCall.arguments,
        reason,
        interruptedAt
      });
    }
  }
  async #loadUi() {
    return ui_dist_default;
  }
  #requestPath(url) {
    try {
      return new URL(url ?? "/", "http://localhost").pathname;
    } catch {
      return url ?? "/";
    }
  }
  #handleHttpRequest(request, response, html) {
    if (request.method === "GET" && this.#requestPath(request.url) === "/__injected") {
      if (this.#injectedHtml === null) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(this.#injectedHtml);
      return;
    }
    if (request.method !== "GET" || request.url !== "/" && request.url !== "/index.html") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html.replaceAll("__REALTIME_VOICE_TITLE__", escapeHtml(this.#config.ui.title)));
  }
  #handleBrowserConnection(socket) {
    const attemptedClientId = createId("client");
    if (this.#browserSocket && this.#browserSocket.readyState === socket.OPEN) {
      const error = toVoiceError("BROWSER_CLIENT_ALREADY_CONNECTED", "Another browser client is already connected.", {
        activeClientId: this.#browserClient.clientId ?? "",
        attemptedClientId
      });
      socket.send(JSON.stringify({ type: "duplicate.client" }));
      socket.close(1008, "duplicate client");
      this.emit("browser.client.rejected", {
        attemptedClientId,
        activeClientId: this.#browserClient.clientId ?? "",
        error,
        createdAt: /* @__PURE__ */ new Date()
      });
      this.#log("warn", error);
      return;
    }
    this.#browserSocket = socket;
    this.#browserClient.connected = true;
    this.#browserClient.clientId = attemptedClientId;
    this.#browserClient.connectedAt = /* @__PURE__ */ new Date();
    this.#browserClient.audio = { permission: "unknown", devices: [], ready: false };
    this.#setBrowserStatus("connected");
    this.emit("browser.client.connected", {
      clientId: attemptedClientId,
      connectedAt: this.#browserClient.connectedAt
    });
    this.#broadcastState();
    socket.on("message", (message) => {
      void this.#handleBrowserMessage(String(message)).catch((error) => {
        const normalized = error instanceof VoiceAgentServerError ? error : toVoiceError("INTERNAL_INVARIANT_VIOLATION", "Browser message handling failed.", void 0, error);
        socket.send(JSON.stringify({ type: "error", data: serializeError(normalized) }));
      });
    });
    socket.on("close", () => {
      const clientId = this.#browserClient.clientId;
      this.#clearBrowserClient();
      const conversation = this.#conversation;
      if (conversation && (conversation.status === "active" || conversation.status === "paused")) {
        this.#endConversationLocked(void 0, "ending").catch((error) => {
          this.#log(
            "warn",
            error instanceof VoiceAgentServerError ? error : toVoiceError(
              "INTERNAL_INVARIANT_VIOLATION",
              "Conversation teardown on browser disconnect failed.",
              void 0,
              error
            )
          );
        });
      }
      this.#broadcastState();
      if (clientId) this.emit("browser.client.disconnected", { clientId, disconnectedAt: /* @__PURE__ */ new Date() });
    });
  }
  async #handleBrowserMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (cause) {
      throw this.#fail("CONFIG_INVALID", "Browser message was not valid JSON.", void 0, cause);
    }
    switch (message.type) {
      case "conversation.start":
        await this.startConversation();
        break;
      case "conversation.pause":
        await this.pauseConversation();
        break;
      case "conversation.resume":
        await this.resumeConversation();
        break;
      case "conversation.reset":
        await this.resetConversation();
        break;
      case "conversation.end":
        await this.endConversation();
        break;
      case "message.text": {
        const text = typeof message.data?.text === "string" ? message.data.text : "";
        if (this.#status.conversation === "none") await this.startConversation();
        await this.injectUserMessage({ text, source: "textInput" });
        break;
      }
      case "voice.session.requested": {
        try {
          const token = await this.#mintEphemeralClientSecret();
          this.#broadcast({
            type: "voice.session.token",
            data: {
              clientSecret: token.clientSecret,
              model: token.model,
              expiresAt: token.expiresAt
            }
          });
        } catch (cause) {
          const error = this.#fail(
            "CONVERSATION_START_FAILED",
            "Failed to mint xAI ephemeral client secret.",
            void 0,
            cause
          );
          this.#failPendingVoiceSession(error);
          this.emit("conversation.error", {
            conversationId: this.#conversation?.id,
            error,
            createdAt: /* @__PURE__ */ new Date()
          });
        }
        break;
      }
      case "voice.session.connected": {
        const pending = this.#pendingVoiceSession;
        if (pending) {
          clearTimeout(pending.timeout);
          this.#pendingVoiceSession = void 0;
          pending.resolve();
        }
        break;
      }
      case "voice.session.failed": {
        const code = String(message.data?.error?.code ?? "VOICE_SESSION_FAILED");
        const text = String(message.data?.error?.message ?? "Browser reported a Voice Agent session failure.");
        const error = toVoiceError("CONVERSATION_START_FAILED", text, { code });
        this.#failPendingVoiceSession(error);
        this.#browserProxiedEmitter?.emit("error", {
          type: "error",
          error: { message: error.message, code: error.code }
        });
        break;
      }
      case "voice.event": {
        const event = message.data?.event;
        if (event && typeof event === "object") {
          const eventRecord = event;
          const eventType = typeof eventRecord.type === "string" ? eventRecord.type : void 0;
          if (eventType) this.#browserProxiedEmitter?.emit(eventType, eventRecord);
        }
        break;
      }
      case "audio.device.select":
        if (this.#browserClient.audio && typeof message.data?.deviceId === "string") {
          this.#browserClient.audio = { ...this.#browserClient.audio, selectedDeviceId: message.data.deviceId };
          this.#emitAudioChange();
        }
        break;
      case "audio.device.state":
        if (message.data) {
          this.#browserClient.audio = message.data;
          this.#emitAudioChange();
        }
        break;
      case "browser.debug": {
        let details;
        try {
          details = JSON.parse(JSON.stringify({ info: message.data?.info, t: message.data?.t }));
        } catch {
          details = void 0;
        }
        this.emit("log", {
          level: "debug",
          code: "BROWSER_DEBUG",
          message: typeof message.data?.label === "string" ? message.data.label : "browser.debug",
          details,
          createdAt: /* @__PURE__ */ new Date()
        });
        break;
      }
      case "browser.audio.error": {
        const error = toVoiceError("MICROPHONE_DEVICE_ERROR", "Browser reported a microphone error.", {
          code: String(message.data?.code ?? "unknown"),
          message: String(message.data?.message ?? "Unknown microphone error."),
          suggestedAction: String(message.data?.suggestedAction ?? "Check microphone access and try again.")
        });
        this.emit("browser.audio.error", { clientId: this.#browserClient.clientId, error, createdAt: /* @__PURE__ */ new Date() });
        this.#log("error", error);
        break;
      }
    }
  }
  #emitAudioChange() {
    const clientId = this.#browserClient.clientId;
    const audio = this.#browserClient.audio;
    if (!clientId || !audio) return;
    this.emit("browser.audio.deviceChange", { clientId, audio, createdAt: /* @__PURE__ */ new Date() });
    this.#broadcast({
      type: "browser.audio.deviceChange",
      data: { devices: audio.devices, selectedDeviceId: audio.selectedDeviceId }
    });
    this.#broadcastState();
    if (this.#config.browserSession.connectOnPageLoad && audio.ready && this.#status.conversation === "none") {
      void this.startConversation().catch((error) => {
        const wrapped = error instanceof VoiceAgentServerError ? error : toVoiceError("CONVERSATION_START_FAILED", "connectOnPageLoad failed.", void 0, error);
        this.emit("conversation.error", {
          conversationId: this.#conversation?.id,
          error: wrapped,
          createdAt: /* @__PURE__ */ new Date()
        });
      });
    }
  }
  #clearBrowserClient() {
    this.#browserSocket = void 0;
    this.#browserClient.connected = false;
    delete this.#browserClient.clientId;
    delete this.#browserClient.connectedAt;
    delete this.#browserClient.audio;
    this.#setBrowserStatus("none");
  }
  #setServerStatus(server) {
    this.#status = { ...this.#status, server };
  }
  #setBrowserStatus(browserClient) {
    this.#status = { ...this.#status, browserClient };
  }
  #setConversationStatus(conversation) {
    this.#status = { ...this.#status, conversation };
  }
  #broadcastState() {
    this.#broadcast({
      type: "state",
      data: {
        ...this.status,
        // Include controller-level conversation status separately so the
        // browser sees transitional states (e.g. "starting") even when
        // currentConversation is not yet populated.
        conversationStatus: this.#status.conversation,
        conversation: this.currentConversation,
        instructions: this.#instructions,
        connectOnPageLoad: this.#config.browserSession.connectOnPageLoad,
        wakeWord: this.#config.browserSession.wakeWord,
        injectedVersion: this.#injectedHtml === null ? null : this.#injectedVersion
      }
    });
  }
  broadcastToBrowser(envelope) {
    this.#broadcast(envelope);
  }
  #broadcast(payload) {
    if (this.#browserSocket?.readyState === import_websocket.default.OPEN) {
      this.#browserSocket.send(JSON.stringify(payload));
    }
  }
  #fail(code, message, details, cause) {
    const error = toVoiceError(code, message, details, cause);
    this.#log("error", error);
    return error;
  }
  #log(level, error) {
    this.emit("log", {
      level,
      code: error.code,
      message: error.message,
      details: error.details,
      error,
      createdAt: /* @__PURE__ */ new Date()
    });
  }
};
function normalizeConfig(config) {
  return {
    ...config,
    realtime: {
      instructions: config.realtime.instructions,
      model: config.realtime.model ?? DEFAULT_REALTIME_MODEL,
      voice: config.realtime.voice ?? DEFAULT_REALTIME_VOICE
    },
    browserSession: {
      connectOnPageLoad: config.browserSession?.connectOnPageLoad ?? false,
      firstMessage: config.browserSession?.firstMessage ?? "",
      firstMessageRole: config.browserSession?.firstMessageRole ?? "user",
      // `undefined` (omitted) → the default phrase; an explicit `null`
      // disables wake-word listening. A blank/whitespace-only string is
      // treated as disabled (an unmatchable phrase would just spin the
      // recognizer for nothing).
      wakeWord: normalizeWakeWord(config.browserSession?.wakeWord)
    },
    ui: {
      title: config.ui?.title ?? DEFAULT_UI_TITLE
    }
  };
}
function normalizeWakeWord(wakeWord) {
  if (wakeWord === void 0) return DEFAULT_WAKE_WORD;
  if (wakeWord === null) return null;
  const trimmed = wakeWord.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function validateConfig(config) {
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw toVoiceError("CONFIG_INVALID", "port must be an integer between 1 and 65535.", { port: config.port });
  }
  if (!config.apiKey) {
    throw toVoiceError("CONFIG_INVALID", "apiKey is required.");
  }
  if (!normalizeText(config.realtime?.instructions)) {
    throw toVoiceError("CONFIG_INVALID", "realtime.instructions is required.");
  }
  for (const [name, tool] of Object.entries(config.tools)) {
    if (!name || !tool.description || !tool.parameters || typeof tool.execute !== "function") {
      throw toVoiceError("CONFIG_INVALID", "Each tool requires a name, description, parameters, and execute.", {
        name
      });
    }
  }
}
function snapshotConversation(conversation) {
  return {
    id: conversation.id,
    status: conversation.status,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    transcript: [...conversation.transcript],
    toolCalls: [...conversation.toolCalls],
    // Render in true conversational order. `sequence` is the logical position
    // assigned when the item was appended (reserved at assistant-turn start),
    // so a late ASR/user-slot event still sorts into its real slot regardless
    // of xAI event arrival order. Ties fall back to arrival time for stability.
    timeline: [...conversation.timeline].sort(
      (a, b) => a.sequence - b.sequence || a.createdAt.getTime() - b.createdAt.getTime()
    )
  };
}
function cloneBrowserClient(input) {
  return {
    connected: input.connected,
    clientId: input.clientId,
    connectedAt: input.connectedAt,
    audio: input.audio ? {
      ...input.audio,
      devices: [...input.audio.devices],
      error: input.audio.error ? { ...input.audio.error } : void 0
    } : void 0
  };
}
function normalizeText(text) {
  return typeof text === "string" ? text.trim() : "";
}
function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function serializeError(error) {
  return { name: error.name, code: error.code, message: error.message, details: error.details ?? null };
}
function toolsToRealtimeTools(tools, descriptions) {
  return Object.entries(tools).map(([name, definition]) => ({
    type: "function",
    name,
    description: descriptions.get(name) ?? definition.description,
    parameters: zodToJsonSchema(definition.parameters)
  }));
}
function zodToJsonSchema(schema) {
  if (schema instanceof external_exports.ZodObject) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const [key, child] of Object.entries(shape)) {
      const childSchema = child;
      properties[key] = zodToJsonSchema(unwrapOptional(childSchema));
      if (!(childSchema instanceof external_exports.ZodOptional) && !(childSchema instanceof external_exports.ZodDefault)) required.push(key);
    }
    return { type: "object", properties, required, additionalProperties: false };
  }
  if (schema instanceof external_exports.ZodString) return { type: "string" };
  if (schema instanceof external_exports.ZodNumber) return { type: "number" };
  if (schema instanceof external_exports.ZodBoolean) return { type: "boolean" };
  if (schema instanceof external_exports.ZodArray) return { type: "array", items: zodToJsonSchema(schema.element) };
  if (schema instanceof external_exports.ZodEnum) return { type: "string", enum: [...schema.options] };
  if (schema instanceof external_exports.ZodLiteral) {
    const value = schema.value;
    return { const: value, type: typeof value };
  }
  if (schema instanceof external_exports.ZodNullable) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof external_exports.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof external_exports.ZodDefault) return zodToJsonSchema(schema.removeDefault());
  return { type: "object", additionalProperties: true };
}
function unwrapOptional(schema) {
  if (schema instanceof external_exports.ZodOptional) return schema.unwrap();
  if (schema instanceof external_exports.ZodDefault) return schema.removeDefault();
  return schema;
}
function isJsonValue(value) {
  if (value === null) return true;
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return Number.isFinite(value) || valueType !== "number";
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (valueType !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every(isJsonValue);
}

// src/cli/daemon.ts
try {
  for (const name of readdirSync("/proc/self/fd")) {
    const fd = Number(name);
    if (Number.isFinite(fd) && fd > 19) {
      try {
        closeSync(fd);
      } catch (err) {
      }
    }
  }
} catch (err) {
}
var port = parseInt(process.env.VOICE_PORT ?? "3000", 10);
var apiKey = process.env.VOICE_API_KEY ?? "";
var instructions = process.env.VOICE_INSTRUCTIONS ?? "";
var title = process.env.VOICE_TITLE;
var model = process.env.VOICE_MODEL;
var voice = process.env.VOICE_VOICE;
var controlPort = port + 1;
var tmpDir = `/tmp/voice-${port}`;
var eventsFile = `${tmpDir}/events.jsonl`;
var cursorFile = `${tmpDir}/cursor`;
var pidFile = `${tmpDir}/daemon.pid`;
var seq = 0;
function appendEvent(event, data) {
  seq += 1;
  const line = `${JSON.stringify({ seq, event, timestamp: (/* @__PURE__ */ new Date()).toISOString(), data: serializeData(data) })}
`;
  appendFileSync(eventsFile, line, "utf8");
}
function serializeData(value) {
  if (value === null || value === void 0) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeData);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeData(v);
    }
    return out;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}
var stagedSystemMessages = [];
var latestContext = null;
var latestTopics = null;
var queuedInstructionsUpdate = false;
function rebuildInstructions() {
  let result = instructions;
  if (latestContext !== null) result += `

<context>${latestContext}</context>`;
  if (latestTopics !== null) result += `

<topics>${latestTopics}</topics>`;
  return result;
}
function flushStagedInstructions() {
  if (latestContext === null && latestTopics === null) return;
  controller.updateVoiceSession({ instructions: rebuildInstructions() }).then(() => {
    scheduleResponse();
  }).catch((err) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}
var registeredClients = /* @__PURE__ */ new Map();
var clientIdCounter = 0;
var firstRegisterDeadline = null;
var clientGraceDeadline = null;
function startFirstRegisterTimer() {
  firstRegisterDeadline = setTimeout(() => {
    if (registeredClients.size === 0) {
      shutdown();
    }
  }, 3e4);
}
function startClientGraceTimer() {
  if (clientGraceDeadline !== null) return;
  clientGraceDeadline = setTimeout(() => {
    if (registeredClients.size === 0) {
      shutdown();
    }
  }, 12e4);
}
function cancelClientGraceTimer() {
  if (clientGraceDeadline !== null) {
    clearTimeout(clientGraceDeadline);
    clientGraceDeadline = null;
  }
}
function checkClients() {
  for (const [clientId, client] of registeredClients) {
    try {
      process.kill(client.pid, 0);
    } catch {
      registeredClients.delete(clientId);
    }
  }
  if (registeredClients.size === 0 && firstRegisterDeadline === null) {
    startClientGraceTimer();
  }
}
function shutdown() {
  controller.stop().finally(() => {
    cleanup();
    process.exit(0);
  });
}
function cleanup() {
  try {
    rmSync(pidFile);
  } catch (_err) {
  }
}
var realtimeConfig = {
  instructions,
  ...model !== void 0 ? { model } : {},
  ...voice !== void 0 ? { voice } : {}
};
var uiConfig = title !== void 0 ? { title } : {};
var waitingForContext = false;
var waitForContextTool = {
  description: "Signal that the user has asked about something not covered by current <context> or <topics>. Call this instead of guessing or saying you don't have enough information.",
  parameters: external_exports.object({}),
  execute: async () => {
    appendEvent("wait_for_context", {});
    waitingForContext = true;
    controller.broadcastToBrowser({ type: "wait_for_context.start" });
    if (controller.status.conversation === "active") {
      try {
        await controller.setAutoResponse(false);
      } catch (err) {
        appendEvent("conversation.error", { error: String(err) });
      }
    }
    return { ok: true };
  }
};
var controller = createVoiceAgentServer({
  port,
  apiKey,
  realtime: realtimeConfig,
  tools: { wait_for_context: waitForContextTool },
  ui: uiConfig,
  browserSession: {
    connectOnPageLoad: true
  }
});
var knownEvents = [
  "server.started",
  "server.stopped",
  "browser.client.connected",
  "browser.client.disconnected",
  "browser.client.rejected",
  "browser.audio.error",
  "browser.audio.deviceChange",
  "conversation.started",
  "conversation.paused",
  "conversation.resumed",
  "conversation.ended",
  "conversation.reset",
  "conversation.error",
  "response.completed",
  "voice.session.updated",
  "transcript.delta",
  "transcript.item",
  "tool.call.started",
  "tool.call.completed",
  "tool.call.failed",
  "tool.call.interrupted",
  "log"
];
for (const eventName of knownEvents) {
  controller.on(eventName, (data) => {
    appendEvent(eventName, data);
  });
}
process.on("uncaughtException", (err) => {
  process.stderr.write(`uncaughtException: ${String(err)}
`);
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`unhandledRejection: ${String(reason)}
`);
});
var RESPONSE_DEBOUNCE_MS = 250;
var RESET_RESPONSE_DELAY_MS = 600;
var pendingResponseTimer = null;
var resetOpeningPending = false;
var resetOpeningTimer = null;
var resetOpeningInFlight = false;
var resetEpisodeRefreshPending = false;
var resetOpeningWatchdog = null;
var RESET_OPENING_WATCHDOG_MS = 3e4;
function clearResetOpening() {
  resetOpeningPending = false;
  if (resetOpeningTimer) {
    clearTimeout(resetOpeningTimer);
    resetOpeningTimer = null;
  }
}
function clearResetEpisode() {
  resetOpeningInFlight = false;
  resetEpisodeRefreshPending = false;
  queuedInstructionsUpdate = false;
  if (resetOpeningWatchdog) {
    clearTimeout(resetOpeningWatchdog);
    resetOpeningWatchdog = null;
  }
  clearResetErrorSkipTimer();
}
function refreshInstructionsOnly() {
  controller.updateVoiceSession({ instructions: rebuildInstructions() }).then(() => {
    appendEvent("conversation.opening.coalesced", { reason: "post-reset segment folded into reset episode" });
  }).catch((err) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}
function postResetInstructionsOwed() {
  return queuedInstructionsUpdate || resetEpisodeRefreshPending;
}
function flushOwedPostResetInstructions(owed) {
  if (!owed) return;
  queuedInstructionsUpdate = false;
  controller.updateVoiceSession({ instructions: rebuildInstructions() }).then(() => {
    appendEvent("conversation.opening.coalesced", {
      reason: "queued post-reset context delivered on episode teardown (no opening)"
    });
  }).catch((err) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}
function flushOwedResetEpisodeInstructions() {
  queuedInstructionsUpdate = false;
  resetEpisodeRefreshPending = false;
  controller.updateVoiceSession({ instructions: rebuildInstructions() }).then(() => {
    appendEvent("conversation.opening.coalesced", {
      reason: "owed reset-episode context delivered on resume (no opening)"
    });
  }).catch((err) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}
function scheduleResponse() {
  if (resetOpeningPending) clearResetOpening();
  if (resetOpeningInFlight) {
    refreshInstructionsOnly();
    return;
  }
  if (pendingResponseTimer) clearTimeout(pendingResponseTimer);
  pendingResponseTimer = setTimeout(() => {
    pendingResponseTimer = null;
    const status = controller.status.conversation;
    if (status !== "active" && status !== "paused") return;
    controller.requestResponse().catch((err) => {
      appendEvent("conversation.error", { error: String(err) });
    });
  }, RESPONSE_DEBOUNCE_MS);
}
function cancelPendingResponse() {
  if (pendingResponseTimer) {
    clearTimeout(pendingResponseTimer);
    pendingResponseTimer = null;
  }
}
controller.on("conversation.ended", cancelPendingResponse);
controller.on("conversation.reset", cancelPendingResponse);
var queuedInjections = [];
function clearQueuedInjections() {
  queuedInjections.length = 0;
}
controller.on("conversation.ended", clearQueuedInjections);
controller.on("conversation.reset", clearQueuedInjections);
controller.on("conversation.reset", () => {
  queuedInstructionsUpdate = false;
  clearResetOpening();
  clearResetEpisode();
  if (latestContext === null && latestTopics === null) return;
  resetOpeningPending = true;
  resetOpeningTimer = setTimeout(() => {
    resetOpeningTimer = null;
    if (!resetOpeningPending) return;
    resetOpeningPending = false;
    const status = controller.status.conversation;
    if (status !== "active") {
      appendEvent("conversation.opening.skipped", { reason: `conversation ${status}` });
      return;
    }
    if (!controller.realtimeConnected) {
      appendEvent("conversation.opening.skipped", { reason: "realtime connection not live" });
      return;
    }
    appendEvent("conversation.opening.requested", {});
    resetOpeningInFlight = true;
    if (resetOpeningWatchdog) clearTimeout(resetOpeningWatchdog);
    resetOpeningWatchdog = setTimeout(() => {
      resetOpeningWatchdog = null;
      if (!resetOpeningInFlight) return;
      const owed = postResetInstructionsOwed();
      clearResetEpisode();
      appendEvent("conversation.opening.skipped", { reason: "reset opening watchdog timeout \u2014 no response.completed" });
      flushOwedPostResetInstructions(owed);
    }, RESET_OPENING_WATCHDOG_MS);
    controller.requestResponse().catch((err) => {
      const owed = postResetInstructionsOwed();
      clearResetEpisode();
      appendEvent("conversation.error", { error: String(err) });
      flushOwedPostResetInstructions(owed);
    });
  }, RESET_RESPONSE_DELAY_MS);
});
controller.on("conversation.paused", () => {
  if (resetOpeningPending) {
    clearResetOpening();
    appendEvent("conversation.opening.skipped", { reason: "conversation paused during reset window" });
  }
  if (resetOpeningInFlight) {
    const owed = postResetInstructionsOwed();
    clearResetEpisode();
    appendEvent("conversation.opening.skipped", { reason: "conversation paused during in-flight reset opening" });
    flushOwedPostResetInstructions(owed);
  }
});
var FATAL_ERROR_RECHECK_MS = 750;
var resetErrorSkipTimer = null;
function clearResetErrorSkipTimer() {
  if (resetErrorSkipTimer) {
    clearTimeout(resetErrorSkipTimer);
    resetErrorSkipTimer = null;
  }
}
controller.on("conversation.error", () => {
  if (!resetOpeningInFlight || controller.realtimeConnected) return;
  if (resetErrorSkipTimer) return;
  resetErrorSkipTimer = setTimeout(() => {
    resetErrorSkipTimer = null;
    if (!resetOpeningInFlight) return;
    if (controller.responseInFlight || controller.realtimeConnected) return;
    const owed = postResetInstructionsOwed();
    clearResetEpisode();
    appendEvent("conversation.opening.skipped", {
      reason: "realtime connection failed during in-flight reset opening"
    });
    flushOwedPostResetInstructions(owed);
  }, FATAL_ERROR_RECHECK_MS);
});
controller.on("conversation.resumed", () => {
  if (!resetEpisodeRefreshPending) return;
  flushOwedResetEpisodeInstructions();
});
controller.on("conversation.ended", clearResetOpening);
controller.on("conversation.ended", clearResetEpisode);
controller.on("response.completed", () => {
  const hadInjections = queuedInjections.length > 0;
  if (hadInjections) {
    const drained = queuedInjections.splice(0);
    for (const text of drained) {
      controller.injectSystemMessage({ text, triggerResponse: false }).catch((err) => {
        appendEvent("conversation.error", { error: String(err) });
      });
    }
  }
  const wasResetOpening = resetOpeningInFlight;
  const hadEpisodeRefresh = resetEpisodeRefreshPending;
  const hadQueuedInstructions = queuedInstructionsUpdate;
  clearResetEpisode();
  if (wasResetOpening && (hadQueuedInstructions || hadEpisodeRefresh)) {
    queuedInstructionsUpdate = false;
    refreshInstructionsOnly();
    return;
  }
  if (hadQueuedInstructions) {
    queuedInstructionsUpdate = false;
    controller.updateVoiceSession({ instructions: rebuildInstructions() }).then(() => {
      scheduleResponse();
    }).catch((err) => {
      appendEvent("conversation.error", { error: String(err) });
    });
  } else if (hadInjections) {
    scheduleResponse();
  }
});
controller.on("conversation.started", () => {
  const pending = stagedSystemMessages.splice(0);
  let anyTrigger = false;
  for (const msg of pending) {
    if (msg.triggerResponse) anyTrigger = true;
    controller.injectSystemMessage({ text: msg.text, triggerResponse: false }).catch((err) => {
      appendEvent("conversation.error", { error: String(err) });
    });
  }
  if (anyTrigger) scheduleResponse();
  flushStagedInstructions();
});
function tryAutoStartForStaged() {
  const hasStagedInstructions = latestContext !== null || latestTopics !== null;
  if (stagedSystemMessages.length === 0 && !hasStagedInstructions) return;
  if (controller.status.conversation !== "none") return;
  controller.startConversation().catch((err) => {
    appendEvent("conversation.error", { error: String(err) });
  });
}
controller.on("browser.client.connected", () => {
  tryAutoStartForStaged();
});
controller.on("browser.audio.deviceChange", (event) => {
  if (event.audio.ready) tryAutoStartForStaged();
});
mkdirSync(tmpDir, { recursive: true });
writeFileSync(pidFile, String(process.pid), "utf8");
writeFileSync(eventsFile, "", "utf8");
try {
  rmSync(cursorFile);
} catch (err) {
}
controller.on("server.started", (event) => {
  const line = JSON.stringify({ port: event.port, url: event.url, createdAt: event.createdAt.toISOString() });
  process.stdout.write(`${line}
`);
});
controller.start().catch((err) => {
  process.stderr.write(`${JSON.stringify({ error: String(err) })}
`);
  cleanup();
  process.exit(1);
});
startFirstRegisterTimer();
setInterval(checkClients, 5e3);
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}
function serializeStatus() {
  return serializeData(controller.status);
}
var controlServer = createServer2(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://localhost:${controlPort}`);
  const pathname = url.pathname;
  try {
    if (method === "GET" && pathname === "/status") {
      sendJson(res, 200, serializeStatus());
      return;
    }
    if (method === "POST" && pathname === "/server/stop") {
      sendJson(res, 200, { ok: true });
      setImmediate(() => shutdown());
      return;
    }
    if (method === "POST" && pathname === "/conversation/start") {
      await controller.startConversation();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/conversation/pause") {
      await controller.pauseConversation();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/conversation/resume") {
      await controller.resumeConversation();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/conversation/end") {
      await controller.endConversation();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/conversation/reset") {
      await controller.resetConversation();
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/inject/user") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const item = await controller.injectUserMessage({
        text: parsed.text,
        source: parsed.source,
        triggerResponse: parsed.triggerResponse
      });
      sendJson(res, 200, serializeData(item));
      return;
    }
    if (method === "POST" && pathname === "/inject/assistant") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const item = await controller.injectAssistantMessage({
        text: parsed.text,
        source: parsed.source
      });
      sendJson(res, 200, serializeData(item));
      return;
    }
    if (method === "POST" && pathname === "/inject/system") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      let convStatus = controller.status.conversation;
      const isTopicsOrContext = /^\s*<(topics|context)>/.test(parsed.text);
      if (isTopicsOrContext && convStatus === "none") {
        try {
          await controller.startConversation();
          convStatus = controller.status.conversation;
        } catch (err) {
          stagedSystemMessages.push({ text: parsed.text, triggerResponse: parsed.triggerResponse });
          sendJson(res, 200, { staged: true, startError: String(err) });
          return;
        }
      }
      if (convStatus !== "active" && convStatus !== "paused") {
        stagedSystemMessages.push({ text: parsed.text, triggerResponse: parsed.triggerResponse });
        sendJson(res, 200, { staged: true });
        return;
      }
      if (waitingForContext && isTopicsOrContext) {
        waitingForContext = false;
        controller.broadcastToBrowser({ type: "wait_for_context.end" });
        try {
          await controller.setAutoResponse(true);
        } catch (err) {
          appendEvent("conversation.error", { error: String(err) });
        }
      }
      if (controller.responseInFlight) {
        queuedInjections.push(parsed.text);
        sendJson(res, 200, { queued: true });
        return;
      }
      const item = await controller.injectSystemMessage({
        text: parsed.text,
        triggerResponse: false
      });
      if (parsed.triggerResponse === true) scheduleResponse();
      sendJson(res, 200, serializeData(item));
      return;
    }
    if (method === "POST" && pathname === "/html/set") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      let injectedError;
      const onInjectedError = (evt) => {
        injectedError = { code: evt.code, message: evt.message };
      };
      controller.once("injected.error", onInjectedError);
      try {
        await controller.setHtml(
          parsed.path !== void 0 ? { path: parsed.path } : parsed.clear === true ? null : { html: parsed.html ?? "" }
        );
      } finally {
        controller.off("injected.error", onInjectedError);
      }
      if (injectedError !== void 0) {
        sendJson(res, 200, { ok: false, error: { code: injectedError.code, message: injectedError.message } });
      } else {
        sendJson(res, 200, { ok: true });
      }
      return;
    }
    if (method === "POST" && pathname === "/instructions/segment") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      if (parsed.kind !== "context" && parsed.kind !== "topics") {
        sendJson(res, 400, { error: "invalid kind" });
        return;
      }
      if (typeof parsed.text !== "string") {
        sendJson(res, 400, { error: "text must be a string" });
        return;
      }
      const kind = parsed.kind;
      const trimmed = parsed.text.trim();
      if (trimmed.length === 0) {
        if (kind === "context") latestContext = null;
        else latestTopics = null;
      } else {
        if (kind === "context") latestContext = trimmed;
        else latestTopics = trimmed;
      }
      let convStatus = controller.status.conversation;
      if (convStatus === "none") {
        try {
          await controller.startConversation();
          convStatus = controller.status.conversation;
        } catch (err) {
          sendJson(res, 200, { staged: true, startError: String(err) });
          return;
        }
      }
      if (convStatus !== "active" && convStatus !== "paused") {
        sendJson(res, 200, { staged: true });
        return;
      }
      if (waitingForContext && (latestContext !== null || latestTopics !== null)) {
        waitingForContext = false;
        controller.broadcastToBrowser({ type: "wait_for_context.end" });
        try {
          await controller.setAutoResponse(true);
        } catch (err) {
          appendEvent("conversation.error", { error: String(err) });
        }
      }
      if (controller.responseInFlight) {
        queuedInstructionsUpdate = true;
        if (resetOpeningInFlight) resetEpisodeRefreshPending = true;
        sendJson(res, 200, {
          queued: true,
          kind,
          latestContext: latestContext !== null,
          latestTopics: latestTopics !== null
        });
        return;
      }
      try {
        await controller.updateVoiceSession({ instructions: rebuildInstructions() });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
        return;
      }
      if (parsed.triggerResponse !== false) scheduleResponse();
      sendJson(res, 200, {
        ok: true,
        kind,
        latestContext: latestContext !== null,
        latestTopics: latestTopics !== null
      });
      return;
    }
    if (method === "POST" && pathname === "/tool/cancel") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      await controller.cancelToolCall(parsed.callId);
      sendJson(res, 200, { ok: true });
      return;
    }
    if (method === "POST" && pathname === "/client/register") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const clientId = `client-${++clientIdCounter}`;
      registeredClients.set(clientId, { clientId, pid: parsed.pid });
      if (firstRegisterDeadline !== null) {
        clearTimeout(firstRegisterDeadline);
        firstRegisterDeadline = null;
      }
      cancelClientGraceTimer();
      sendJson(res, 200, { clientId });
      return;
    }
    if (method === "POST" && pathname === "/client/unregister") {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      registeredClients.delete(parsed.clientId);
      sendJson(res, 200, { ok: true });
      if (registeredClients.size === 0) {
        startClientGraceTimer();
      }
      return;
    }
    if (method === "GET" && pathname === "/watch") {
      const eventsParam = url.searchParams.get("events");
      const afterParam = url.searchParams.get("after");
      const filterEvents = eventsParam ? eventsParam.split(",").filter(Boolean) : [];
      const after = afterParam ? parseInt(afterParam, 10) : 0;
      let content;
      try {
        content = readFileSync(eventsFile, "utf8");
      } catch {
        content = "";
      }
      const lines = content.split("\n").filter(Boolean);
      const matching = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.seq > after) {
            if (filterEvents.length === 0 || filterEvents.includes(parsed.event)) {
              if (parsed.event === "transcript.item" && parsed.data?.item?.source === "system") {
                continue;
              }
              matching.push(line);
            }
          }
        } catch (_err) {
        }
      }
      const responseBody = matching.join("\n") + (matching.length > 0 ? "\n" : "");
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Length": Buffer.byteLength(responseBody)
      });
      res.end(responseBody);
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
});
controlServer.listen(controlPort, "localhost");
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
