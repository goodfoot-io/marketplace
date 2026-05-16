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

// ../../node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../../node_modules/ws/lib/constants.js"(exports, module) {
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

// ../../node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../../node_modules/ws/lib/buffer-util.js"(exports, module) {
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

// ../../node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../../node_modules/ws/lib/limiter.js"(exports, module) {
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

// ../../node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../../node_modules/ws/lib/permessage-deflate.js"(exports, module) {
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

// ../../node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../../node_modules/ws/lib/validation.js"(exports, module) {
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

// ../../node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../../node_modules/ws/lib/receiver.js"(exports, module) {
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

// ../../node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../../node_modules/ws/lib/sender.js"(exports, module) {
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

// ../../node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../../node_modules/ws/lib/event-target.js"(exports, module) {
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

// ../../node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../../node_modules/ws/lib/extension.js"(exports, module) {
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

// ../../node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../../node_modules/ws/lib/websocket.js"(exports, module) {
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

// ../../node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../../node_modules/ws/lib/stream.js"(exports, module) {
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

// ../../node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../../node_modules/ws/lib/subprotocol.js"(exports, module) {
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

// ../../node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../../node_modules/ws/lib/websocket-server.js"(exports, module) {
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

// ../../node_modules/zod/v3/external.js
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

// ../../node_modules/zod/v3/helpers/util.js
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

// ../../node_modules/zod/v3/ZodError.js
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

// ../../node_modules/zod/v3/locales/en.js
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

// ../../node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/zod/v3/helpers/parseUtil.js
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

// ../../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/zod/v3/types.js
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
import { createServer } from "node:http";

// ../../node_modules/ws/wrapper.mjs
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

// src/ui-dist/index.html
var ui_dist_default = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>__REALTIME_VOICE_TITLE__</title>\n    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css" />\n    <script type="module" crossorigin>(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll(\'link[rel="modulepreload"]\'))u(s);new MutationObserver(s=>{for(const h of s)if(h.type==="childList")for(const f of h.addedNodes)f.tagName==="LINK"&&f.rel==="modulepreload"&&u(f)}).observe(document,{childList:!0,subtree:!0});function r(s){const h={};return s.integrity&&(h.integrity=s.integrity),s.referrerPolicy&&(h.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?h.credentials="include":s.crossOrigin==="anonymous"?h.credentials="omit":h.credentials="same-origin",h}function u(s){if(s.ep)return;s.ep=!0;const h=r(s);fetch(s.href,h)}})();function vs(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var Lc={exports:{}},Ea={};/**\n * @license React\n * react-jsx-runtime.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Bp;function s0(){if(Bp)return Ea;Bp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.fragment");function r(u,s,h){var f=null;if(h!==void 0&&(f=""+h),s.key!==void 0&&(f=""+s.key),"key"in s){h={};for(var d in s)d!=="key"&&(h[d]=s[d])}else h=s;return s=h.ref,{$$typeof:n,type:u,key:f,ref:s!==void 0?s:null,props:h}}return Ea.Fragment=a,Ea.jsx=r,Ea.jsxs=r,Ea}var Hp;function f0(){return Hp||(Hp=1,Lc.exports=s0()),Lc.exports}var I=f0(),Uc={exports:{}},be={};/**\n * @license React\n * react.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var qp;function h0(){if(qp)return be;qp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.portal"),r=Symbol.for("react.fragment"),u=Symbol.for("react.strict_mode"),s=Symbol.for("react.profiler"),h=Symbol.for("react.consumer"),f=Symbol.for("react.context"),d=Symbol.for("react.forward_ref"),m=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),b=Symbol.for("react.lazy"),y=Symbol.for("react.activity"),E=Symbol.iterator;function S(T){return T===null||typeof T!="object"?null:(T=E&&T[E]||T["@@iterator"],typeof T=="function"?T:null)}var z={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},q=Object.assign,Q={};function R(T,C,v){this.props=T,this.context=C,this.refs=Q,this.updater=v||z}R.prototype.isReactComponent={},R.prototype.setState=function(T,C){if(typeof T!="object"&&typeof T!="function"&&T!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,T,C,"setState")},R.prototype.forceUpdate=function(T){this.updater.enqueueForceUpdate(this,T,"forceUpdate")};function K(){}K.prototype=R.prototype;function X(T,C,v){this.props=T,this.context=C,this.refs=Q,this.updater=v||z}var oe=X.prototype=new K;oe.constructor=X,q(oe,R.prototype),oe.isPureReactComponent=!0;var se=Array.isArray;function B(){}var ee={H:null,A:null,T:null,S:null},pe=Object.prototype.hasOwnProperty;function ye(T,C,v){var j=v.ref;return{$$typeof:n,type:T,key:C,ref:j!==void 0?j:null,props:v}}function L(T,C){return ye(T.type,C,T.props)}function ne(T){return typeof T=="object"&&T!==null&&T.$$typeof===n}function te(T){var C={"=":"=0",":":"=2"};return"$"+T.replace(/[=:]/g,function(v){return C[v]})}var ke=/\\/+/g;function ae(T,C){return typeof T=="object"&&T!==null&&T.key!=null?te(""+T.key):C.toString(36)}function W(T){switch(T.status){case"fulfilled":return T.value;case"rejected":throw T.reason;default:switch(typeof T.status=="string"?T.then(B,B):(T.status="pending",T.then(function(C){T.status==="pending"&&(T.status="fulfilled",T.value=C)},function(C){T.status==="pending"&&(T.status="rejected",T.reason=C)})),T.status){case"fulfilled":return T.value;case"rejected":throw T.reason}}throw T}function M(T,C,v,j,$){var Z=typeof T;(Z==="undefined"||Z==="boolean")&&(T=null);var le=!1;if(T===null)le=!0;else switch(Z){case"bigint":case"string":case"number":le=!0;break;case"object":switch(T.$$typeof){case n:case a:le=!0;break;case b:return le=T._init,M(le(T._payload),C,v,j,$)}}if(le)return $=$(T),le=j===""?"."+ae(T,0):j,se($)?(v="",le!=null&&(v=le.replace(ke,"$&/")+"/"),M($,C,v,"",function(Qe){return Qe})):$!=null&&(ne($)&&($=L($,v+($.key==null||T&&T.key===$.key?"":(""+$.key).replace(ke,"$&/")+"/")+le)),C.push($)),1;le=0;var ge=j===""?".":j+":";if(se(T))for(var fe=0;fe<T.length;fe++)j=T[fe],Z=ge+ae(j,fe),le+=M(j,C,v,Z,$);else if(fe=S(T),typeof fe=="function")for(T=fe.call(T),fe=0;!(j=T.next()).done;)j=j.value,Z=ge+ae(j,fe++),le+=M(j,C,v,Z,$);else if(Z==="object"){if(typeof T.then=="function")return M(W(T),C,v,j,$);throw C=String(T),Error("Objects are not valid as a React child (found: "+(C==="[object Object]"?"object with keys {"+Object.keys(T).join(", ")+"}":C)+"). If you meant to render a collection of children, use an array instead.")}return le}function F(T,C,v){if(T==null)return T;var j=[],$=0;return M(T,j,"","",function(Z){return C.call(v,Z,$++)}),j}function re(T){if(T._status===-1){var C=T._result;C=C(),C.then(function(v){(T._status===0||T._status===-1)&&(T._status=1,T._result=v)},function(v){(T._status===0||T._status===-1)&&(T._status=2,T._result=v)}),T._status===-1&&(T._status=0,T._result=C)}if(T._status===1)return T._result.default;throw T._result}var xe=typeof reportError=="function"?reportError:function(T){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var C=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof T=="object"&&T!==null&&typeof T.message=="string"?String(T.message):String(T),error:T});if(!window.dispatchEvent(C))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",T);return}console.error(T)},k={map:F,forEach:function(T,C,v){F(T,function(){C.apply(this,arguments)},v)},count:function(T){var C=0;return F(T,function(){C++}),C},toArray:function(T){return F(T,function(C){return C})||[]},only:function(T){if(!ne(T))throw Error("React.Children.only expected to receive a single React element child.");return T}};return be.Activity=y,be.Children=k,be.Component=R,be.Fragment=r,be.Profiler=s,be.PureComponent=X,be.StrictMode=u,be.Suspense=m,be.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=ee,be.__COMPILER_RUNTIME={__proto__:null,c:function(T){return ee.H.useMemoCache(T)}},be.cache=function(T){return function(){return T.apply(null,arguments)}},be.cacheSignal=function(){return null},be.cloneElement=function(T,C,v){if(T==null)throw Error("The argument must be a React element, but you passed "+T+".");var j=q({},T.props),$=T.key;if(C!=null)for(Z in C.key!==void 0&&($=""+C.key),C)!pe.call(C,Z)||Z==="key"||Z==="__self"||Z==="__source"||Z==="ref"&&C.ref===void 0||(j[Z]=C[Z]);var Z=arguments.length-2;if(Z===1)j.children=v;else if(1<Z){for(var le=Array(Z),ge=0;ge<Z;ge++)le[ge]=arguments[ge+2];j.children=le}return ye(T.type,$,j)},be.createContext=function(T){return T={$$typeof:f,_currentValue:T,_currentValue2:T,_threadCount:0,Provider:null,Consumer:null},T.Provider=T,T.Consumer={$$typeof:h,_context:T},T},be.createElement=function(T,C,v){var j,$={},Z=null;if(C!=null)for(j in C.key!==void 0&&(Z=""+C.key),C)pe.call(C,j)&&j!=="key"&&j!=="__self"&&j!=="__source"&&($[j]=C[j]);var le=arguments.length-2;if(le===1)$.children=v;else if(1<le){for(var ge=Array(le),fe=0;fe<le;fe++)ge[fe]=arguments[fe+2];$.children=ge}if(T&&T.defaultProps)for(j in le=T.defaultProps,le)$[j]===void 0&&($[j]=le[j]);return ye(T,Z,$)},be.createRef=function(){return{current:null}},be.forwardRef=function(T){return{$$typeof:d,render:T}},be.isValidElement=ne,be.lazy=function(T){return{$$typeof:b,_payload:{_status:-1,_result:T},_init:re}},be.memo=function(T,C){return{$$typeof:p,type:T,compare:C===void 0?null:C}},be.startTransition=function(T){var C=ee.T,v={};ee.T=v;try{var j=T(),$=ee.S;$!==null&&$(v,j),typeof j=="object"&&j!==null&&typeof j.then=="function"&&j.then(B,xe)}catch(Z){xe(Z)}finally{C!==null&&v.types!==null&&(C.types=v.types),ee.T=C}},be.unstable_useCacheRefresh=function(){return ee.H.useCacheRefresh()},be.use=function(T){return ee.H.use(T)},be.useActionState=function(T,C,v){return ee.H.useActionState(T,C,v)},be.useCallback=function(T,C){return ee.H.useCallback(T,C)},be.useContext=function(T){return ee.H.useContext(T)},be.useDebugValue=function(){},be.useDeferredValue=function(T,C){return ee.H.useDeferredValue(T,C)},be.useEffect=function(T,C){return ee.H.useEffect(T,C)},be.useEffectEvent=function(T){return ee.H.useEffectEvent(T)},be.useId=function(){return ee.H.useId()},be.useImperativeHandle=function(T,C,v){return ee.H.useImperativeHandle(T,C,v)},be.useInsertionEffect=function(T,C){return ee.H.useInsertionEffect(T,C)},be.useLayoutEffect=function(T,C){return ee.H.useLayoutEffect(T,C)},be.useMemo=function(T,C){return ee.H.useMemo(T,C)},be.useOptimistic=function(T,C){return ee.H.useOptimistic(T,C)},be.useReducer=function(T,C,v){return ee.H.useReducer(T,C,v)},be.useRef=function(T){return ee.H.useRef(T)},be.useState=function(T){return ee.H.useState(T)},be.useSyncExternalStore=function(T,C,v){return ee.H.useSyncExternalStore(T,C,v)},be.useTransition=function(){return ee.H.useTransition()},be.version="19.2.6",be}var Yp;function xs(){return Yp||(Yp=1,Uc.exports=h0()),Uc.exports}var Tt=xs();const za=vs(Tt);var jc={exports:{}},ka={},Bc={exports:{}},Hc={};/**\n * @license React\n * scheduler.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Vp;function d0(){return Vp||(Vp=1,(function(n){function a(M,F){var re=M.length;M.push(F);e:for(;0<re;){var xe=re-1>>>1,k=M[xe];if(0<s(k,F))M[xe]=F,M[re]=k,re=xe;else break e}}function r(M){return M.length===0?null:M[0]}function u(M){if(M.length===0)return null;var F=M[0],re=M.pop();if(re!==F){M[0]=re;e:for(var xe=0,k=M.length,T=k>>>1;xe<T;){var C=2*(xe+1)-1,v=M[C],j=C+1,$=M[j];if(0>s(v,re))j<k&&0>s($,v)?(M[xe]=$,M[j]=re,xe=j):(M[xe]=v,M[C]=re,xe=C);else if(j<k&&0>s($,re))M[xe]=$,M[j]=re,xe=j;else break e}}return F}function s(M,F){var re=M.sortIndex-F.sortIndex;return re!==0?re:M.id-F.id}if(n.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var h=performance;n.unstable_now=function(){return h.now()}}else{var f=Date,d=f.now();n.unstable_now=function(){return f.now()-d}}var m=[],p=[],b=1,y=null,E=3,S=!1,z=!1,q=!1,Q=!1,R=typeof setTimeout=="function"?setTimeout:null,K=typeof clearTimeout=="function"?clearTimeout:null,X=typeof setImmediate<"u"?setImmediate:null;function oe(M){for(var F=r(p);F!==null;){if(F.callback===null)u(p);else if(F.startTime<=M)u(p),F.sortIndex=F.expirationTime,a(m,F);else break;F=r(p)}}function se(M){if(q=!1,oe(M),!z)if(r(m)!==null)z=!0,B||(B=!0,te());else{var F=r(p);F!==null&&W(se,F.startTime-M)}}var B=!1,ee=-1,pe=5,ye=-1;function L(){return Q?!0:!(n.unstable_now()-ye<pe)}function ne(){if(Q=!1,B){var M=n.unstable_now();ye=M;var F=!0;try{e:{z=!1,q&&(q=!1,K(ee),ee=-1),S=!0;var re=E;try{t:{for(oe(M),y=r(m);y!==null&&!(y.expirationTime>M&&L());){var xe=y.callback;if(typeof xe=="function"){y.callback=null,E=y.priorityLevel;var k=xe(y.expirationTime<=M);if(M=n.unstable_now(),typeof k=="function"){y.callback=k,oe(M),F=!0;break t}y===r(m)&&u(m),oe(M)}else u(m);y=r(m)}if(y!==null)F=!0;else{var T=r(p);T!==null&&W(se,T.startTime-M),F=!1}}break e}finally{y=null,E=re,S=!1}F=void 0}}finally{F?te():B=!1}}}var te;if(typeof X=="function")te=function(){X(ne)};else if(typeof MessageChannel<"u"){var ke=new MessageChannel,ae=ke.port2;ke.port1.onmessage=ne,te=function(){ae.postMessage(null)}}else te=function(){R(ne,0)};function W(M,F){ee=R(function(){M(n.unstable_now())},F)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(M){M.callback=null},n.unstable_forceFrameRate=function(M){0>M||125<M?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):pe=0<M?Math.floor(1e3/M):5},n.unstable_getCurrentPriorityLevel=function(){return E},n.unstable_next=function(M){switch(E){case 1:case 2:case 3:var F=3;break;default:F=E}var re=E;E=F;try{return M()}finally{E=re}},n.unstable_requestPaint=function(){Q=!0},n.unstable_runWithPriority=function(M,F){switch(M){case 1:case 2:case 3:case 4:case 5:break;default:M=3}var re=E;E=M;try{return F()}finally{E=re}},n.unstable_scheduleCallback=function(M,F,re){var xe=n.unstable_now();switch(typeof re=="object"&&re!==null?(re=re.delay,re=typeof re=="number"&&0<re?xe+re:xe):re=xe,M){case 1:var k=-1;break;case 2:k=250;break;case 5:k=1073741823;break;case 4:k=1e4;break;default:k=5e3}return k=re+k,M={id:b++,callback:F,priorityLevel:M,startTime:re,expirationTime:k,sortIndex:-1},re>xe?(M.sortIndex=re,a(p,M),r(m)===null&&M===r(p)&&(q?(K(ee),ee=-1):q=!0,W(se,re-xe))):(M.sortIndex=k,a(m,M),z||S||(z=!0,B||(B=!0,te()))),M},n.unstable_shouldYield=L,n.unstable_wrapCallback=function(M){var F=E;return function(){var re=E;E=F;try{return M.apply(this,arguments)}finally{E=re}}}})(Hc)),Hc}var Gp;function p0(){return Gp||(Gp=1,Bc.exports=d0()),Bc.exports}var qc={exports:{}},gt={};/**\n * @license React\n * react-dom.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Xp;function m0(){if(Xp)return gt;Xp=1;var n=xs();function a(m){var p="https://react.dev/errors/"+m;if(1<arguments.length){p+="?args[]="+encodeURIComponent(arguments[1]);for(var b=2;b<arguments.length;b++)p+="&args[]="+encodeURIComponent(arguments[b])}return"Minified React error #"+m+"; visit "+p+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function r(){}var u={d:{f:r,r:function(){throw Error(a(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},s=Symbol.for("react.portal");function h(m,p,b){var y=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:s,key:y==null?null:""+y,children:m,containerInfo:p,implementation:b}}var f=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function d(m,p){if(m==="font")return"";if(typeof p=="string")return p==="use-credentials"?p:""}return gt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=u,gt.createPortal=function(m,p){var b=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!p||p.nodeType!==1&&p.nodeType!==9&&p.nodeType!==11)throw Error(a(299));return h(m,p,null,b)},gt.flushSync=function(m){var p=f.T,b=u.p;try{if(f.T=null,u.p=2,m)return m()}finally{f.T=p,u.p=b,u.d.f()}},gt.preconnect=function(m,p){typeof m=="string"&&(p?(p=p.crossOrigin,p=typeof p=="string"?p==="use-credentials"?p:"":void 0):p=null,u.d.C(m,p))},gt.prefetchDNS=function(m){typeof m=="string"&&u.d.D(m)},gt.preinit=function(m,p){if(typeof m=="string"&&p&&typeof p.as=="string"){var b=p.as,y=d(b,p.crossOrigin),E=typeof p.integrity=="string"?p.integrity:void 0,S=typeof p.fetchPriority=="string"?p.fetchPriority:void 0;b==="style"?u.d.S(m,typeof p.precedence=="string"?p.precedence:void 0,{crossOrigin:y,integrity:E,fetchPriority:S}):b==="script"&&u.d.X(m,{crossOrigin:y,integrity:E,fetchPriority:S,nonce:typeof p.nonce=="string"?p.nonce:void 0})}},gt.preinitModule=function(m,p){if(typeof m=="string")if(typeof p=="object"&&p!==null){if(p.as==null||p.as==="script"){var b=d(p.as,p.crossOrigin);u.d.M(m,{crossOrigin:b,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0})}}else p==null&&u.d.M(m)},gt.preload=function(m,p){if(typeof m=="string"&&typeof p=="object"&&p!==null&&typeof p.as=="string"){var b=p.as,y=d(b,p.crossOrigin);u.d.L(m,b,{crossOrigin:y,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0,type:typeof p.type=="string"?p.type:void 0,fetchPriority:typeof p.fetchPriority=="string"?p.fetchPriority:void 0,referrerPolicy:typeof p.referrerPolicy=="string"?p.referrerPolicy:void 0,imageSrcSet:typeof p.imageSrcSet=="string"?p.imageSrcSet:void 0,imageSizes:typeof p.imageSizes=="string"?p.imageSizes:void 0,media:typeof p.media=="string"?p.media:void 0})}},gt.preloadModule=function(m,p){if(typeof m=="string")if(p){var b=d(p.as,p.crossOrigin);u.d.m(m,{as:typeof p.as=="string"&&p.as!=="script"?p.as:void 0,crossOrigin:b,integrity:typeof p.integrity=="string"?p.integrity:void 0})}else u.d.m(m)},gt.requestFormReset=function(m){u.d.r(m)},gt.unstable_batchedUpdates=function(m,p){return m(p)},gt.useFormState=function(m,p,b){return f.H.useFormState(m,p,b)},gt.useFormStatus=function(){return f.H.useHostTransitionStatus()},gt.version="19.2.6",gt}var Qp;function g0(){if(Qp)return qc.exports;Qp=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),qc.exports=m0(),qc.exports}/**\n * @license React\n * react-dom-client.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Zp;function y0(){if(Zp)return ka;Zp=1;var n=p0(),a=xs(),r=g0();function u(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var l=2;l<arguments.length;l++)t+="&args[]="+encodeURIComponent(arguments[l])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function s(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function h(e){var t=e,l=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(l=t.return),e=t.return;while(e)}return t.tag===3?l:null}function f(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function d(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function m(e){if(h(e)!==e)throw Error(u(188))}function p(e){var t=e.alternate;if(!t){if(t=h(e),t===null)throw Error(u(188));return t!==e?null:e}for(var l=e,i=t;;){var o=l.return;if(o===null)break;var c=o.alternate;if(c===null){if(i=o.return,i!==null){l=i;continue}break}if(o.child===c.child){for(c=o.child;c;){if(c===l)return m(o),e;if(c===i)return m(o),t;c=c.sibling}throw Error(u(188))}if(l.return!==i.return)l=o,i=c;else{for(var g=!1,x=o.child;x;){if(x===l){g=!0,l=o,i=c;break}if(x===i){g=!0,i=o,l=c;break}x=x.sibling}if(!g){for(x=c.child;x;){if(x===l){g=!0,l=c,i=o;break}if(x===i){g=!0,i=c,l=o;break}x=x.sibling}if(!g)throw Error(u(189))}}if(l.alternate!==i)throw Error(u(190))}if(l.tag!==3)throw Error(u(188));return l.stateNode.current===l?e:t}function b(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=b(e),t!==null)return t;e=e.sibling}return null}var y=Object.assign,E=Symbol.for("react.element"),S=Symbol.for("react.transitional.element"),z=Symbol.for("react.portal"),q=Symbol.for("react.fragment"),Q=Symbol.for("react.strict_mode"),R=Symbol.for("react.profiler"),K=Symbol.for("react.consumer"),X=Symbol.for("react.context"),oe=Symbol.for("react.forward_ref"),se=Symbol.for("react.suspense"),B=Symbol.for("react.suspense_list"),ee=Symbol.for("react.memo"),pe=Symbol.for("react.lazy"),ye=Symbol.for("react.activity"),L=Symbol.for("react.memo_cache_sentinel"),ne=Symbol.iterator;function te(e){return e===null||typeof e!="object"?null:(e=ne&&e[ne]||e["@@iterator"],typeof e=="function"?e:null)}var ke=Symbol.for("react.client.reference");function ae(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===ke?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case q:return"Fragment";case R:return"Profiler";case Q:return"StrictMode";case se:return"Suspense";case B:return"SuspenseList";case ye:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case z:return"Portal";case X:return e.displayName||"Context";case K:return(e._context.displayName||"Context")+".Consumer";case oe:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case ee:return t=e.displayName||null,t!==null?t:ae(e.type)||"Memo";case pe:t=e._payload,e=e._init;try{return ae(e(t))}catch{}}return null}var W=Array.isArray,M=a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,F=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,re={pending:!1,data:null,method:null,action:null},xe=[],k=-1;function T(e){return{current:e}}function C(e){0>k||(e.current=xe[k],xe[k]=null,k--)}function v(e,t){k++,xe[k]=e.current,e.current=t}var j=T(null),$=T(null),Z=T(null),le=T(null);function ge(e,t){switch(v(Z,t),v($,e),v(j,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?up(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=up(t),e=op(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}C(j),v(j,e)}function fe(){C(j),C($),C(Z)}function Qe(e){e.memoizedState!==null&&v(le,e);var t=j.current,l=op(t,e.type);t!==l&&(v($,e),v(j,l))}function Fe(e){$.current===e&&(C(j),C($)),le.current===e&&(C(le),ba._currentValue=re)}var mt,Rl;function yn(e){if(mt===void 0)try{throw Error()}catch(l){var t=l.stack.trim().match(/\\n( *(at )?)/);mt=t&&t[1]||"",Rl=-1<l.stack.indexOf(`\n    at`)?" (<anonymous>)":-1<l.stack.indexOf("@")?"@unknown:0:0":""}return`\n`+mt+e+Rl}var Nl=!1;function Ll(e,t){if(!e||Nl)return"";Nl=!0;var l=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var G=function(){throw Error()};if(Object.defineProperty(G.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(G,[])}catch(U){var N=U}Reflect.construct(e,[],G)}else{try{G.call()}catch(U){N=U}e.call(G.prototype)}}else{try{throw Error()}catch(U){N=U}(G=e())&&typeof G.catch=="function"&&G.catch(function(){})}}catch(U){if(U&&N&&typeof U.stack=="string")return[U.stack,N.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var o=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");o&&o.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var c=i.DetermineComponentFrameRoot(),g=c[0],x=c[1];if(g&&x){var A=g.split(`\n`),O=x.split(`\n`);for(o=i=0;i<A.length&&!A[i].includes("DetermineComponentFrameRoot");)i++;for(;o<O.length&&!O[o].includes("DetermineComponentFrameRoot");)o++;if(i===A.length||o===O.length)for(i=A.length-1,o=O.length-1;1<=i&&0<=o&&A[i]!==O[o];)o--;for(;1<=i&&0<=o;i--,o--)if(A[i]!==O[o]){if(i!==1||o!==1)do if(i--,o--,0>o||A[i]!==O[o]){var H=`\n`+A[i].replace(" at new "," at ");return e.displayName&&H.includes("<anonymous>")&&(H=H.replace("<anonymous>",e.displayName)),H}while(1<=i&&0<=o);break}}}finally{Nl=!1,Error.prepareStackTrace=l}return(l=e?e.displayName||e.name:"")?yn(l):""}function Ba(e,t){switch(e.tag){case 26:case 27:case 5:return yn(e.type);case 16:return yn("Lazy");case 13:return e.child!==t&&t!==null?yn("Suspense Fallback"):yn("Suspense");case 19:return yn("SuspenseList");case 0:case 15:return Ll(e.type,!1);case 11:return Ll(e.type.render,!1);case 1:return Ll(e.type,!0);case 31:return yn("Activity");default:return""}}function Ha(e){try{var t="",l=null;do t+=Ba(e,l),l=e,e=e.return;while(e);return t}catch(i){return`\nError generating stack: `+i.message+`\n`+i.stack}}var Ul=Object.prototype.hasOwnProperty,jl=n.unstable_scheduleCallback,_i=n.unstable_cancelCallback,vu=n.unstable_shouldYield,xu=n.unstable_requestPaint,St=n.unstable_now,Su=n.unstable_getCurrentPriorityLevel,Y=n.unstable_ImmediatePriority,P=n.unstable_UserBlockingPriority,me=n.unstable_NormalPriority,Ae=n.unstable_LowPriority,Le=n.unstable_IdlePriority,jt=n.log,bn=n.unstable_setDisableYieldValue,Et=null,rt=null;function Ct(e){if(typeof jt=="function"&&bn(e),rt&&typeof rt.setStrictMode=="function")try{rt.setStrictMode(Et,e)}catch{}}var Ve=Math.clz32?Math.clz32:Jg,Bn=Math.log,an=Math.LN2;function Jg(e){return e>>>=0,e===0?32:31-(Bn(e)/an|0)|0}var qa=256,Ya=262144,Va=4194304;function fl(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Ga(e,t,l){var i=e.pendingLanes;if(i===0)return 0;var o=0,c=e.suspendedLanes,g=e.pingedLanes;e=e.warmLanes;var x=i&134217727;return x!==0?(i=x&~c,i!==0?o=fl(i):(g&=x,g!==0?o=fl(g):l||(l=x&~e,l!==0&&(o=fl(l))))):(x=i&~c,x!==0?o=fl(x):g!==0?o=fl(g):l||(l=i&~e,l!==0&&(o=fl(l)))),o===0?0:t!==0&&t!==o&&(t&c)===0&&(c=o&-o,l=t&-t,c>=l||c===32&&(l&4194048)!==0)?t:o}function Oi(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function $g(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Ys(){var e=Va;return Va<<=1,(Va&62914560)===0&&(Va=4194304),e}function Eu(e){for(var t=[],l=0;31>l;l++)t.push(e);return t}function Mi(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function Wg(e,t,l,i,o,c){var g=e.pendingLanes;e.pendingLanes=l,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=l,e.entangledLanes&=l,e.errorRecoveryDisabledLanes&=l,e.shellSuspendCounter=0;var x=e.entanglements,A=e.expirationTimes,O=e.hiddenUpdates;for(l=g&~l;0<l;){var H=31-Ve(l),G=1<<H;x[H]=0,A[H]=-1;var N=O[H];if(N!==null)for(O[H]=null,H=0;H<N.length;H++){var U=N[H];U!==null&&(U.lane&=-536870913)}l&=~G}i!==0&&Vs(e,i,0),c!==0&&o===0&&e.tag!==0&&(e.suspendedLanes|=c&~(g&~t))}function Vs(e,t,l){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Ve(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|l&261930}function Gs(e,t){var l=e.entangledLanes|=t;for(e=e.entanglements;l;){var i=31-Ve(l),o=1<<i;o&t|e[i]&t&&(e[i]|=t),l&=~o}}function Xs(e,t){var l=t&-t;return l=(l&42)!==0?1:ku(l),(l&(e.suspendedLanes|t))!==0?0:l}function ku(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function Au(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Qs(){var e=F.p;return e!==0?e:(e=window.event,e===void 0?32:Op(e.type))}function Zs(e,t){var l=F.p;try{return F.p=e,t()}finally{F.p=l}}var Hn=Math.random().toString(36).slice(2),st="__reactFiber$"+Hn,zt="__reactProps$"+Hn,Bl="__reactContainer$"+Hn,Tu="__reactEvents$"+Hn,Pg="__reactListeners$"+Hn,ey="__reactHandles$"+Hn,Fs="__reactResources$"+Hn,Ri="__reactMarker$"+Hn;function wu(e){delete e[st],delete e[zt],delete e[Tu],delete e[Pg],delete e[ey]}function Hl(e){var t=e[st];if(t)return t;for(var l=e.parentNode;l;){if(t=l[Bl]||l[st]){if(l=t.alternate,t.child!==null||l!==null&&l.child!==null)for(e=mp(e);e!==null;){if(l=e[st])return l;e=mp(e)}return t}e=l,l=e.parentNode}return null}function ql(e){if(e=e[st]||e[Bl]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Ni(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(u(33))}function Yl(e){var t=e[Fs];return t||(t=e[Fs]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function ot(e){e[Ri]=!0}var Is=new Set,Ks={};function hl(e,t){Vl(e,t),Vl(e+"Capture",t)}function Vl(e,t){for(Ks[e]=t,e=0;e<t.length;e++)Is.add(t[e])}var ty=RegExp("^[:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD][:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD\\\\-.0-9\\\\u00B7\\\\u0300-\\\\u036F\\\\u203F-\\\\u2040]*$"),Js={},$s={};function ny(e){return Ul.call($s,e)?!0:Ul.call(Js,e)?!1:ty.test(e)?$s[e]=!0:(Js[e]=!0,!1)}function Xa(e,t,l){if(ny(t))if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+l)}}function Qa(e,t,l){if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+l)}}function vn(e,t,l,i){if(i===null)e.removeAttribute(l);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(l);return}e.setAttributeNS(t,l,""+i)}}function Ft(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function Ws(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function ly(e,t,l){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var o=i.get,c=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(g){l=""+g,c.call(this,g)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return l},setValue:function(g){l=""+g},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Cu(e){if(!e._valueTracker){var t=Ws(e)?"checked":"value";e._valueTracker=ly(e,t,""+e[t])}}function Ps(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var l=t.getValue(),i="";return e&&(i=Ws(e)?e.checked?"true":"false":e.value),e=i,e!==l?(t.setValue(e),!0):!1}function Za(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var iy=/[\\n"\\\\]/g;function It(e){return e.replace(iy,function(t){return"\\\\"+t.charCodeAt(0).toString(16)+" "})}function zu(e,t,l,i,o,c,g,x){e.name="",g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"?e.type=g:e.removeAttribute("type"),t!=null?g==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+Ft(t)):e.value!==""+Ft(t)&&(e.value=""+Ft(t)):g!=="submit"&&g!=="reset"||e.removeAttribute("value"),t!=null?Du(e,g,Ft(t)):l!=null?Du(e,g,Ft(l)):i!=null&&e.removeAttribute("value"),o==null&&c!=null&&(e.defaultChecked=!!c),o!=null&&(e.checked=o&&typeof o!="function"&&typeof o!="symbol"),x!=null&&typeof x!="function"&&typeof x!="symbol"&&typeof x!="boolean"?e.name=""+Ft(x):e.removeAttribute("name")}function ef(e,t,l,i,o,c,g,x){if(c!=null&&typeof c!="function"&&typeof c!="symbol"&&typeof c!="boolean"&&(e.type=c),t!=null||l!=null){if(!(c!=="submit"&&c!=="reset"||t!=null)){Cu(e);return}l=l!=null?""+Ft(l):"",t=t!=null?""+Ft(t):l,x||t===e.value||(e.value=t),e.defaultValue=t}i=i??o,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=x?e.checked:!!i,e.defaultChecked=!!i,g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"&&(e.name=g),Cu(e)}function Du(e,t,l){t==="number"&&Za(e.ownerDocument)===e||e.defaultValue===""+l||(e.defaultValue=""+l)}function Gl(e,t,l,i){if(e=e.options,t){t={};for(var o=0;o<l.length;o++)t["$"+l[o]]=!0;for(l=0;l<e.length;l++)o=t.hasOwnProperty("$"+e[l].value),e[l].selected!==o&&(e[l].selected=o),o&&i&&(e[l].defaultSelected=!0)}else{for(l=""+Ft(l),t=null,o=0;o<e.length;o++){if(e[o].value===l){e[o].selected=!0,i&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function tf(e,t,l){if(t!=null&&(t=""+Ft(t),t!==e.value&&(e.value=t),l==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=l!=null?""+Ft(l):""}function nf(e,t,l,i){if(t==null){if(i!=null){if(l!=null)throw Error(u(92));if(W(i)){if(1<i.length)throw Error(u(93));i=i[0]}l=i}l==null&&(l=""),t=l}l=Ft(t),e.defaultValue=l,i=e.textContent,i===l&&i!==""&&i!==null&&(e.value=i),Cu(e)}function Xl(e,t){if(t){var l=e.firstChild;if(l&&l===e.lastChild&&l.nodeType===3){l.nodeValue=t;return}}e.textContent=t}var ay=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function lf(e,t,l){var i=t.indexOf("--")===0;l==null||typeof l=="boolean"||l===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,l):typeof l!="number"||l===0||ay.has(t)?t==="float"?e.cssFloat=l:e[t]=(""+l).trim():e[t]=l+"px"}function af(e,t,l){if(t!=null&&typeof t!="object")throw Error(u(62));if(e=e.style,l!=null){for(var i in l)!l.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var o in t)i=t[o],t.hasOwnProperty(o)&&l[o]!==i&&lf(e,o,i)}else for(var c in t)t.hasOwnProperty(c)&&lf(e,c,t[c])}function _u(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var ry=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),uy=/^[\\u0000-\\u001F ]*j[\\r\\n\\t]*a[\\r\\n\\t]*v[\\r\\n\\t]*a[\\r\\n\\t]*s[\\r\\n\\t]*c[\\r\\n\\t]*r[\\r\\n\\t]*i[\\r\\n\\t]*p[\\r\\n\\t]*t[\\r\\n\\t]*:/i;function Fa(e){return uy.test(""+e)?"javascript:throw new Error(\'React has blocked a javascript: URL as a security precaution.\')":e}function xn(){}var Ou=null;function Mu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Ql=null,Zl=null;function rf(e){var t=ql(e);if(t&&(e=t.stateNode)){var l=e[zt]||null;e:switch(e=t.stateNode,t.type){case"input":if(zu(e,l.value,l.defaultValue,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name),t=l.name,l.type==="radio"&&t!=null){for(l=e;l.parentNode;)l=l.parentNode;for(l=l.querySelectorAll(\'input[name="\'+It(""+t)+\'"][type="radio"]\'),t=0;t<l.length;t++){var i=l[t];if(i!==e&&i.form===e.form){var o=i[zt]||null;if(!o)throw Error(u(90));zu(i,o.value,o.defaultValue,o.defaultValue,o.checked,o.defaultChecked,o.type,o.name)}}for(t=0;t<l.length;t++)i=l[t],i.form===e.form&&Ps(i)}break e;case"textarea":tf(e,l.value,l.defaultValue);break e;case"select":t=l.value,t!=null&&Gl(e,!!l.multiple,t,!1)}}}var Ru=!1;function uf(e,t,l){if(Ru)return e(t,l);Ru=!0;try{var i=e(t);return i}finally{if(Ru=!1,(Ql!==null||Zl!==null)&&(Nr(),Ql&&(t=Ql,e=Zl,Zl=Ql=null,rf(t),e)))for(t=0;t<e.length;t++)rf(e[t])}}function Li(e,t){var l=e.stateNode;if(l===null)return null;var i=l[zt]||null;if(i===null)return null;l=i[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break e;default:e=!1}if(e)return null;if(l&&typeof l!="function")throw Error(u(231,t,typeof l));return l}var Sn=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Nu=!1;if(Sn)try{var Ui={};Object.defineProperty(Ui,"passive",{get:function(){Nu=!0}}),window.addEventListener("test",Ui,Ui),window.removeEventListener("test",Ui,Ui)}catch{Nu=!1}var qn=null,Lu=null,Ia=null;function of(){if(Ia)return Ia;var e,t=Lu,l=t.length,i,o="value"in qn?qn.value:qn.textContent,c=o.length;for(e=0;e<l&&t[e]===o[e];e++);var g=l-e;for(i=1;i<=g&&t[l-i]===o[c-i];i++);return Ia=o.slice(e,1<i?1-i:void 0)}function Ka(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Ja(){return!0}function cf(){return!1}function Dt(e){function t(l,i,o,c,g){this._reactName=l,this._targetInst=o,this.type=i,this.nativeEvent=c,this.target=g,this.currentTarget=null;for(var x in e)e.hasOwnProperty(x)&&(l=e[x],this[x]=l?l(c):c[x]);return this.isDefaultPrevented=(c.defaultPrevented!=null?c.defaultPrevented:c.returnValue===!1)?Ja:cf,this.isPropagationStopped=cf,this}return y(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var l=this.nativeEvent;l&&(l.preventDefault?l.preventDefault():typeof l.returnValue!="unknown"&&(l.returnValue=!1),this.isDefaultPrevented=Ja)},stopPropagation:function(){var l=this.nativeEvent;l&&(l.stopPropagation?l.stopPropagation():typeof l.cancelBubble!="unknown"&&(l.cancelBubble=!0),this.isPropagationStopped=Ja)},persist:function(){},isPersistent:Ja}),t}var dl={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},$a=Dt(dl),ji=y({},dl,{view:0,detail:0}),oy=Dt(ji),Uu,ju,Bi,Wa=y({},ji,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Hu,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Bi&&(Bi&&e.type==="mousemove"?(Uu=e.screenX-Bi.screenX,ju=e.screenY-Bi.screenY):ju=Uu=0,Bi=e),Uu)},movementY:function(e){return"movementY"in e?e.movementY:ju}}),sf=Dt(Wa),cy=y({},Wa,{dataTransfer:0}),sy=Dt(cy),fy=y({},ji,{relatedTarget:0}),Bu=Dt(fy),hy=y({},dl,{animationName:0,elapsedTime:0,pseudoElement:0}),dy=Dt(hy),py=y({},dl,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),my=Dt(py),gy=y({},dl,{data:0}),ff=Dt(gy),yy={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},by={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},vy={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function xy(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=vy[e])?!!t[e]:!1}function Hu(){return xy}var Sy=y({},ji,{key:function(e){if(e.key){var t=yy[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Ka(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?by[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Hu,charCode:function(e){return e.type==="keypress"?Ka(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Ka(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Ey=Dt(Sy),ky=y({},Wa,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),hf=Dt(ky),Ay=y({},ji,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Hu}),Ty=Dt(Ay),wy=y({},dl,{propertyName:0,elapsedTime:0,pseudoElement:0}),Cy=Dt(wy),zy=y({},Wa,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Dy=Dt(zy),_y=y({},dl,{newState:0,oldState:0}),Oy=Dt(_y),My=[9,13,27,32],qu=Sn&&"CompositionEvent"in window,Hi=null;Sn&&"documentMode"in document&&(Hi=document.documentMode);var Ry=Sn&&"TextEvent"in window&&!Hi,df=Sn&&(!qu||Hi&&8<Hi&&11>=Hi),pf=" ",mf=!1;function gf(e,t){switch(e){case"keyup":return My.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function yf(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Fl=!1;function Ny(e,t){switch(e){case"compositionend":return yf(t);case"keypress":return t.which!==32?null:(mf=!0,pf);case"textInput":return e=t.data,e===pf&&mf?null:e;default:return null}}function Ly(e,t){if(Fl)return e==="compositionend"||!qu&&gf(e,t)?(e=of(),Ia=Lu=qn=null,Fl=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return df&&t.locale!=="ko"?null:t.data;default:return null}}var Uy={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function bf(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!Uy[e.type]:t==="textarea"}function vf(e,t,l,i){Ql?Zl?Zl.push(i):Zl=[i]:Ql=i,t=Yr(t,"onChange"),0<t.length&&(l=new $a("onChange","change",null,l,i),e.push({event:l,listeners:t}))}var qi=null,Yi=null;function jy(e){tp(e,0)}function Pa(e){var t=Ni(e);if(Ps(t))return e}function xf(e,t){if(e==="change")return t}var Sf=!1;if(Sn){var Yu;if(Sn){var Vu="oninput"in document;if(!Vu){var Ef=document.createElement("div");Ef.setAttribute("oninput","return;"),Vu=typeof Ef.oninput=="function"}Yu=Vu}else Yu=!1;Sf=Yu&&(!document.documentMode||9<document.documentMode)}function kf(){qi&&(qi.detachEvent("onpropertychange",Af),Yi=qi=null)}function Af(e){if(e.propertyName==="value"&&Pa(Yi)){var t=[];vf(t,Yi,e,Mu(e)),uf(jy,t)}}function By(e,t,l){e==="focusin"?(kf(),qi=t,Yi=l,qi.attachEvent("onpropertychange",Af)):e==="focusout"&&kf()}function Hy(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Pa(Yi)}function qy(e,t){if(e==="click")return Pa(t)}function Yy(e,t){if(e==="input"||e==="change")return Pa(t)}function Vy(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Bt=typeof Object.is=="function"?Object.is:Vy;function Vi(e,t){if(Bt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var l=Object.keys(e),i=Object.keys(t);if(l.length!==i.length)return!1;for(i=0;i<l.length;i++){var o=l[i];if(!Ul.call(t,o)||!Bt(e[o],t[o]))return!1}return!0}function Tf(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function wf(e,t){var l=Tf(e);e=0;for(var i;l;){if(l.nodeType===3){if(i=e+l.textContent.length,e<=t&&i>=t)return{node:l,offset:t-e};e=i}e:{for(;l;){if(l.nextSibling){l=l.nextSibling;break e}l=l.parentNode}l=void 0}l=Tf(l)}}function Cf(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Cf(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function zf(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Za(e.document);t instanceof e.HTMLIFrameElement;){try{var l=typeof t.contentWindow.location.href=="string"}catch{l=!1}if(l)e=t.contentWindow;else break;t=Za(e.document)}return t}function Gu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var Gy=Sn&&"documentMode"in document&&11>=document.documentMode,Il=null,Xu=null,Gi=null,Qu=!1;function Df(e,t,l){var i=l.window===l?l.document:l.nodeType===9?l:l.ownerDocument;Qu||Il==null||Il!==Za(i)||(i=Il,"selectionStart"in i&&Gu(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Gi&&Vi(Gi,i)||(Gi=i,i=Yr(Xu,"onSelect"),0<i.length&&(t=new $a("onSelect","select",null,t,l),e.push({event:t,listeners:i}),t.target=Il)))}function pl(e,t){var l={};return l[e.toLowerCase()]=t.toLowerCase(),l["Webkit"+e]="webkit"+t,l["Moz"+e]="moz"+t,l}var Kl={animationend:pl("Animation","AnimationEnd"),animationiteration:pl("Animation","AnimationIteration"),animationstart:pl("Animation","AnimationStart"),transitionrun:pl("Transition","TransitionRun"),transitionstart:pl("Transition","TransitionStart"),transitioncancel:pl("Transition","TransitionCancel"),transitionend:pl("Transition","TransitionEnd")},Zu={},_f={};Sn&&(_f=document.createElement("div").style,"AnimationEvent"in window||(delete Kl.animationend.animation,delete Kl.animationiteration.animation,delete Kl.animationstart.animation),"TransitionEvent"in window||delete Kl.transitionend.transition);function ml(e){if(Zu[e])return Zu[e];if(!Kl[e])return e;var t=Kl[e],l;for(l in t)if(t.hasOwnProperty(l)&&l in _f)return Zu[e]=t[l];return e}var Of=ml("animationend"),Mf=ml("animationiteration"),Rf=ml("animationstart"),Xy=ml("transitionrun"),Qy=ml("transitionstart"),Zy=ml("transitioncancel"),Nf=ml("transitionend"),Lf=new Map,Fu="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Fu.push("scrollEnd");function rn(e,t){Lf.set(e,t),hl(t,[e])}var er=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},Kt=[],Jl=0,Iu=0;function tr(){for(var e=Jl,t=Iu=Jl=0;t<e;){var l=Kt[t];Kt[t++]=null;var i=Kt[t];Kt[t++]=null;var o=Kt[t];Kt[t++]=null;var c=Kt[t];if(Kt[t++]=null,i!==null&&o!==null){var g=i.pending;g===null?o.next=o:(o.next=g.next,g.next=o),i.pending=o}c!==0&&Uf(l,o,c)}}function nr(e,t,l,i){Kt[Jl++]=e,Kt[Jl++]=t,Kt[Jl++]=l,Kt[Jl++]=i,Iu|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Ku(e,t,l,i){return nr(e,t,l,i),lr(e)}function gl(e,t){return nr(e,null,null,t),lr(e)}function Uf(e,t,l){e.lanes|=l;var i=e.alternate;i!==null&&(i.lanes|=l);for(var o=!1,c=e.return;c!==null;)c.childLanes|=l,i=c.alternate,i!==null&&(i.childLanes|=l),c.tag===22&&(e=c.stateNode,e===null||e._visibility&1||(o=!0)),e=c,c=c.return;return e.tag===3?(c=e.stateNode,o&&t!==null&&(o=31-Ve(l),e=c.hiddenUpdates,i=e[o],i===null?e[o]=[t]:i.push(t),t.lane=l|536870912),c):null}function lr(e){if(50<fa)throw fa=0,ac=null,Error(u(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var $l={};function Fy(e,t,l,i){this.tag=e,this.key=l,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Ht(e,t,l,i){return new Fy(e,t,l,i)}function Ju(e){return e=e.prototype,!(!e||!e.isReactComponent)}function En(e,t){var l=e.alternate;return l===null?(l=Ht(e.tag,t,e.key,e.mode),l.elementType=e.elementType,l.type=e.type,l.stateNode=e.stateNode,l.alternate=e,e.alternate=l):(l.pendingProps=t,l.type=e.type,l.flags=0,l.subtreeFlags=0,l.deletions=null),l.flags=e.flags&65011712,l.childLanes=e.childLanes,l.lanes=e.lanes,l.child=e.child,l.memoizedProps=e.memoizedProps,l.memoizedState=e.memoizedState,l.updateQueue=e.updateQueue,t=e.dependencies,l.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},l.sibling=e.sibling,l.index=e.index,l.ref=e.ref,l.refCleanup=e.refCleanup,l}function jf(e,t){e.flags&=65011714;var l=e.alternate;return l===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=l.childLanes,e.lanes=l.lanes,e.child=l.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=l.memoizedProps,e.memoizedState=l.memoizedState,e.updateQueue=l.updateQueue,e.type=l.type,t=l.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function ir(e,t,l,i,o,c){var g=0;if(i=e,typeof e=="function")Ju(e)&&(g=1);else if(typeof e=="string")g=W1(e,l,j.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case ye:return e=Ht(31,l,t,o),e.elementType=ye,e.lanes=c,e;case q:return yl(l.children,o,c,t);case Q:g=8,o|=24;break;case R:return e=Ht(12,l,t,o|2),e.elementType=R,e.lanes=c,e;case se:return e=Ht(13,l,t,o),e.elementType=se,e.lanes=c,e;case B:return e=Ht(19,l,t,o),e.elementType=B,e.lanes=c,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case X:g=10;break e;case K:g=9;break e;case oe:g=11;break e;case ee:g=14;break e;case pe:g=16,i=null;break e}g=29,l=Error(u(130,e===null?"null":typeof e,"")),i=null}return t=Ht(g,l,t,o),t.elementType=e,t.type=i,t.lanes=c,t}function yl(e,t,l,i){return e=Ht(7,e,i,t),e.lanes=l,e}function $u(e,t,l){return e=Ht(6,e,null,t),e.lanes=l,e}function Bf(e){var t=Ht(18,null,null,0);return t.stateNode=e,t}function Wu(e,t,l){return t=Ht(4,e.children!==null?e.children:[],e.key,t),t.lanes=l,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Hf=new WeakMap;function Jt(e,t){if(typeof e=="object"&&e!==null){var l=Hf.get(e);return l!==void 0?l:(t={value:e,source:t,stack:Ha(t)},Hf.set(e,t),t)}return{value:e,source:t,stack:Ha(t)}}var Wl=[],Pl=0,ar=null,Xi=0,$t=[],Wt=0,Yn=null,sn=1,fn="";function kn(e,t){Wl[Pl++]=Xi,Wl[Pl++]=ar,ar=e,Xi=t}function qf(e,t,l){$t[Wt++]=sn,$t[Wt++]=fn,$t[Wt++]=Yn,Yn=e;var i=sn;e=fn;var o=32-Ve(i)-1;i&=~(1<<o),l+=1;var c=32-Ve(t)+o;if(30<c){var g=o-o%5;c=(i&(1<<g)-1).toString(32),i>>=g,o-=g,sn=1<<32-Ve(t)+o|l<<o|i,fn=c+e}else sn=1<<c|l<<o|i,fn=e}function Pu(e){e.return!==null&&(kn(e,1),qf(e,1,0))}function eo(e){for(;e===ar;)ar=Wl[--Pl],Wl[Pl]=null,Xi=Wl[--Pl],Wl[Pl]=null;for(;e===Yn;)Yn=$t[--Wt],$t[Wt]=null,fn=$t[--Wt],$t[Wt]=null,sn=$t[--Wt],$t[Wt]=null}function Yf(e,t){$t[Wt++]=sn,$t[Wt++]=fn,$t[Wt++]=Yn,sn=t.id,fn=t.overflow,Yn=e}var ft=null,Ie=null,_e=!1,Vn=null,Pt=!1,to=Error(u(519));function Gn(e){var t=Error(u(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw Qi(Jt(t,e)),to}function Vf(e){var t=e.stateNode,l=e.type,i=e.memoizedProps;switch(t[st]=e,t[zt]=i,l){case"dialog":we("cancel",t),we("close",t);break;case"iframe":case"object":case"embed":we("load",t);break;case"video":case"audio":for(l=0;l<da.length;l++)we(da[l],t);break;case"source":we("error",t);break;case"img":case"image":case"link":we("error",t),we("load",t);break;case"details":we("toggle",t);break;case"input":we("invalid",t),ef(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":we("invalid",t);break;case"textarea":we("invalid",t),nf(t,i.value,i.defaultValue,i.children)}l=i.children,typeof l!="string"&&typeof l!="number"&&typeof l!="bigint"||t.textContent===""+l||i.suppressHydrationWarning===!0||ap(t.textContent,l)?(i.popover!=null&&(we("beforetoggle",t),we("toggle",t)),i.onScroll!=null&&we("scroll",t),i.onScrollEnd!=null&&we("scrollend",t),i.onClick!=null&&(t.onclick=xn),t=!0):t=!1,t||Gn(e,!0)}function Gf(e){for(ft=e.return;ft;)switch(ft.tag){case 5:case 31:case 13:Pt=!1;return;case 27:case 3:Pt=!0;return;default:ft=ft.return}}function ei(e){if(e!==ft)return!1;if(!_e)return Gf(e),_e=!0,!1;var t=e.tag,l;if((l=t!==3&&t!==27)&&((l=t===5)&&(l=e.type,l=!(l!=="form"&&l!=="button")||xc(e.type,e.memoizedProps)),l=!l),l&&Ie&&Gn(e),Gf(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Ie=pp(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Ie=pp(e)}else t===27?(t=Ie,ll(e.type)?(e=Tc,Tc=null,Ie=e):Ie=t):Ie=ft?tn(e.stateNode.nextSibling):null;return!0}function bl(){Ie=ft=null,_e=!1}function no(){var e=Vn;return e!==null&&(Rt===null?Rt=e:Rt.push.apply(Rt,e),Vn=null),e}function Qi(e){Vn===null?Vn=[e]:Vn.push(e)}var lo=T(null),vl=null,An=null;function Xn(e,t,l){v(lo,t._currentValue),t._currentValue=l}function Tn(e){e._currentValue=lo.current,C(lo)}function io(e,t,l){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===l)break;e=e.return}}function ao(e,t,l,i){var o=e.child;for(o!==null&&(o.return=e);o!==null;){var c=o.dependencies;if(c!==null){var g=o.child;c=c.firstContext;e:for(;c!==null;){var x=c;c=o;for(var A=0;A<t.length;A++)if(x.context===t[A]){c.lanes|=l,x=c.alternate,x!==null&&(x.lanes|=l),io(c.return,l,e),i||(g=null);break e}c=x.next}}else if(o.tag===18){if(g=o.return,g===null)throw Error(u(341));g.lanes|=l,c=g.alternate,c!==null&&(c.lanes|=l),io(g,l,e),g=null}else g=o.child;if(g!==null)g.return=o;else for(g=o;g!==null;){if(g===e){g=null;break}if(o=g.sibling,o!==null){o.return=g.return,g=o;break}g=g.return}o=g}}function ti(e,t,l,i){e=null;for(var o=t,c=!1;o!==null;){if(!c){if((o.flags&524288)!==0)c=!0;else if((o.flags&262144)!==0)break}if(o.tag===10){var g=o.alternate;if(g===null)throw Error(u(387));if(g=g.memoizedProps,g!==null){var x=o.type;Bt(o.pendingProps.value,g.value)||(e!==null?e.push(x):e=[x])}}else if(o===le.current){if(g=o.alternate,g===null)throw Error(u(387));g.memoizedState.memoizedState!==o.memoizedState.memoizedState&&(e!==null?e.push(ba):e=[ba])}o=o.return}e!==null&&ao(t,e,l,i),t.flags|=262144}function rr(e){for(e=e.firstContext;e!==null;){if(!Bt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function xl(e){vl=e,An=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function ht(e){return Xf(vl,e)}function ur(e,t){return vl===null&&xl(e),Xf(e,t)}function Xf(e,t){var l=t._currentValue;if(t={context:t,memoizedValue:l,next:null},An===null){if(e===null)throw Error(u(308));An=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else An=An.next=t;return l}var Iy=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(l,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(l){return l()})}},Ky=n.unstable_scheduleCallback,Jy=n.unstable_NormalPriority,tt={$$typeof:X,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function ro(){return{controller:new Iy,data:new Map,refCount:0}}function Zi(e){e.refCount--,e.refCount===0&&Ky(Jy,function(){e.controller.abort()})}var Fi=null,uo=0,ni=0,li=null;function $y(e,t){if(Fi===null){var l=Fi=[];uo=0,ni=fc(),li={status:"pending",value:void 0,then:function(i){l.push(i)}}}return uo++,t.then(Qf,Qf),t}function Qf(){if(--uo===0&&Fi!==null){li!==null&&(li.status="fulfilled");var e=Fi;Fi=null,ni=0,li=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function Wy(e,t){var l=[],i={status:"pending",value:null,reason:null,then:function(o){l.push(o)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var o=0;o<l.length;o++)(0,l[o])(t)},function(o){for(i.status="rejected",i.reason=o,o=0;o<l.length;o++)(0,l[o])(void 0)}),i}var Zf=M.S;M.S=function(e,t){Dd=St(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&$y(e,t),Zf!==null&&Zf(e,t)};var Sl=T(null);function oo(){var e=Sl.current;return e!==null?e:Ge.pooledCache}function or(e,t){t===null?v(Sl,Sl.current):v(Sl,t.pool)}function Ff(){var e=oo();return e===null?null:{parent:tt._currentValue,pool:e}}var ii=Error(u(460)),co=Error(u(474)),cr=Error(u(542)),sr={then:function(){}};function If(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Kf(e,t,l){switch(l=e[l],l===void 0?e.push(t):l!==t&&(t.then(xn,xn),t=l),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,$f(e),e;default:if(typeof t.status=="string")t.then(xn,xn);else{if(e=Ge,e!==null&&100<e.shellSuspendCounter)throw Error(u(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var o=t;o.status="fulfilled",o.value=i}},function(i){if(t.status==="pending"){var o=t;o.status="rejected",o.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,$f(e),e}throw kl=t,ii}}function El(e){try{var t=e._init;return t(e._payload)}catch(l){throw l!==null&&typeof l=="object"&&typeof l.then=="function"?(kl=l,ii):l}}var kl=null;function Jf(){if(kl===null)throw Error(u(459));var e=kl;return kl=null,e}function $f(e){if(e===ii||e===cr)throw Error(u(483))}var ai=null,Ii=0;function fr(e){var t=Ii;return Ii+=1,ai===null&&(ai=[]),Kf(ai,e,t)}function Ki(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function hr(e,t){throw t.$$typeof===E?Error(u(525)):(e=Object.prototype.toString.call(t),Error(u(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function Wf(e){function t(D,w){if(e){var _=D.deletions;_===null?(D.deletions=[w],D.flags|=16):_.push(w)}}function l(D,w){if(!e)return null;for(;w!==null;)t(D,w),w=w.sibling;return null}function i(D){for(var w=new Map;D!==null;)D.key!==null?w.set(D.key,D):w.set(D.index,D),D=D.sibling;return w}function o(D,w){return D=En(D,w),D.index=0,D.sibling=null,D}function c(D,w,_){return D.index=_,e?(_=D.alternate,_!==null?(_=_.index,_<w?(D.flags|=67108866,w):_):(D.flags|=67108866,w)):(D.flags|=1048576,w)}function g(D){return e&&D.alternate===null&&(D.flags|=67108866),D}function x(D,w,_,V){return w===null||w.tag!==6?(w=$u(_,D.mode,V),w.return=D,w):(w=o(w,_),w.return=D,w)}function A(D,w,_,V){var ce=_.type;return ce===q?H(D,w,_.props.children,V,_.key):w!==null&&(w.elementType===ce||typeof ce=="object"&&ce!==null&&ce.$$typeof===pe&&El(ce)===w.type)?(w=o(w,_.props),Ki(w,_),w.return=D,w):(w=ir(_.type,_.key,_.props,null,D.mode,V),Ki(w,_),w.return=D,w)}function O(D,w,_,V){return w===null||w.tag!==4||w.stateNode.containerInfo!==_.containerInfo||w.stateNode.implementation!==_.implementation?(w=Wu(_,D.mode,V),w.return=D,w):(w=o(w,_.children||[]),w.return=D,w)}function H(D,w,_,V,ce){return w===null||w.tag!==7?(w=yl(_,D.mode,V,ce),w.return=D,w):(w=o(w,_),w.return=D,w)}function G(D,w,_){if(typeof w=="string"&&w!==""||typeof w=="number"||typeof w=="bigint")return w=$u(""+w,D.mode,_),w.return=D,w;if(typeof w=="object"&&w!==null){switch(w.$$typeof){case S:return _=ir(w.type,w.key,w.props,null,D.mode,_),Ki(_,w),_.return=D,_;case z:return w=Wu(w,D.mode,_),w.return=D,w;case pe:return w=El(w),G(D,w,_)}if(W(w)||te(w))return w=yl(w,D.mode,_,null),w.return=D,w;if(typeof w.then=="function")return G(D,fr(w),_);if(w.$$typeof===X)return G(D,ur(D,w),_);hr(D,w)}return null}function N(D,w,_,V){var ce=w!==null?w.key:null;if(typeof _=="string"&&_!==""||typeof _=="number"||typeof _=="bigint")return ce!==null?null:x(D,w,""+_,V);if(typeof _=="object"&&_!==null){switch(_.$$typeof){case S:return _.key===ce?A(D,w,_,V):null;case z:return _.key===ce?O(D,w,_,V):null;case pe:return _=El(_),N(D,w,_,V)}if(W(_)||te(_))return ce!==null?null:H(D,w,_,V,null);if(typeof _.then=="function")return N(D,w,fr(_),V);if(_.$$typeof===X)return N(D,w,ur(D,_),V);hr(D,_)}return null}function U(D,w,_,V,ce){if(typeof V=="string"&&V!==""||typeof V=="number"||typeof V=="bigint")return D=D.get(_)||null,x(w,D,""+V,ce);if(typeof V=="object"&&V!==null){switch(V.$$typeof){case S:return D=D.get(V.key===null?_:V.key)||null,A(w,D,V,ce);case z:return D=D.get(V.key===null?_:V.key)||null,O(w,D,V,ce);case pe:return V=El(V),U(D,w,_,V,ce)}if(W(V)||te(V))return D=D.get(_)||null,H(w,D,V,ce,null);if(typeof V.then=="function")return U(D,w,_,fr(V),ce);if(V.$$typeof===X)return U(D,w,_,ur(w,V),ce);hr(w,V)}return null}function ie(D,w,_,V){for(var ce=null,Me=null,ue=w,Se=w=0,De=null;ue!==null&&Se<_.length;Se++){ue.index>Se?(De=ue,ue=null):De=ue.sibling;var Re=N(D,ue,_[Se],V);if(Re===null){ue===null&&(ue=De);break}e&&ue&&Re.alternate===null&&t(D,ue),w=c(Re,w,Se),Me===null?ce=Re:Me.sibling=Re,Me=Re,ue=De}if(Se===_.length)return l(D,ue),_e&&kn(D,Se),ce;if(ue===null){for(;Se<_.length;Se++)ue=G(D,_[Se],V),ue!==null&&(w=c(ue,w,Se),Me===null?ce=ue:Me.sibling=ue,Me=ue);return _e&&kn(D,Se),ce}for(ue=i(ue);Se<_.length;Se++)De=U(ue,D,Se,_[Se],V),De!==null&&(e&&De.alternate!==null&&ue.delete(De.key===null?Se:De.key),w=c(De,w,Se),Me===null?ce=De:Me.sibling=De,Me=De);return e&&ue.forEach(function(ol){return t(D,ol)}),_e&&kn(D,Se),ce}function de(D,w,_,V){if(_==null)throw Error(u(151));for(var ce=null,Me=null,ue=w,Se=w=0,De=null,Re=_.next();ue!==null&&!Re.done;Se++,Re=_.next()){ue.index>Se?(De=ue,ue=null):De=ue.sibling;var ol=N(D,ue,Re.value,V);if(ol===null){ue===null&&(ue=De);break}e&&ue&&ol.alternate===null&&t(D,ue),w=c(ol,w,Se),Me===null?ce=ol:Me.sibling=ol,Me=ol,ue=De}if(Re.done)return l(D,ue),_e&&kn(D,Se),ce;if(ue===null){for(;!Re.done;Se++,Re=_.next())Re=G(D,Re.value,V),Re!==null&&(w=c(Re,w,Se),Me===null?ce=Re:Me.sibling=Re,Me=Re);return _e&&kn(D,Se),ce}for(ue=i(ue);!Re.done;Se++,Re=_.next())Re=U(ue,D,Se,Re.value,V),Re!==null&&(e&&Re.alternate!==null&&ue.delete(Re.key===null?Se:Re.key),w=c(Re,w,Se),Me===null?ce=Re:Me.sibling=Re,Me=Re);return e&&ue.forEach(function(c0){return t(D,c0)}),_e&&kn(D,Se),ce}function Ye(D,w,_,V){if(typeof _=="object"&&_!==null&&_.type===q&&_.key===null&&(_=_.props.children),typeof _=="object"&&_!==null){switch(_.$$typeof){case S:e:{for(var ce=_.key;w!==null;){if(w.key===ce){if(ce=_.type,ce===q){if(w.tag===7){l(D,w.sibling),V=o(w,_.props.children),V.return=D,D=V;break e}}else if(w.elementType===ce||typeof ce=="object"&&ce!==null&&ce.$$typeof===pe&&El(ce)===w.type){l(D,w.sibling),V=o(w,_.props),Ki(V,_),V.return=D,D=V;break e}l(D,w);break}else t(D,w);w=w.sibling}_.type===q?(V=yl(_.props.children,D.mode,V,_.key),V.return=D,D=V):(V=ir(_.type,_.key,_.props,null,D.mode,V),Ki(V,_),V.return=D,D=V)}return g(D);case z:e:{for(ce=_.key;w!==null;){if(w.key===ce)if(w.tag===4&&w.stateNode.containerInfo===_.containerInfo&&w.stateNode.implementation===_.implementation){l(D,w.sibling),V=o(w,_.children||[]),V.return=D,D=V;break e}else{l(D,w);break}else t(D,w);w=w.sibling}V=Wu(_,D.mode,V),V.return=D,D=V}return g(D);case pe:return _=El(_),Ye(D,w,_,V)}if(W(_))return ie(D,w,_,V);if(te(_)){if(ce=te(_),typeof ce!="function")throw Error(u(150));return _=ce.call(_),de(D,w,_,V)}if(typeof _.then=="function")return Ye(D,w,fr(_),V);if(_.$$typeof===X)return Ye(D,w,ur(D,_),V);hr(D,_)}return typeof _=="string"&&_!==""||typeof _=="number"||typeof _=="bigint"?(_=""+_,w!==null&&w.tag===6?(l(D,w.sibling),V=o(w,_),V.return=D,D=V):(l(D,w),V=$u(_,D.mode,V),V.return=D,D=V),g(D)):l(D,w)}return function(D,w,_,V){try{Ii=0;var ce=Ye(D,w,_,V);return ai=null,ce}catch(ue){if(ue===ii||ue===cr)throw ue;var Me=Ht(29,ue,null,D.mode);return Me.lanes=V,Me.return=D,Me}finally{}}}var Al=Wf(!0),Pf=Wf(!1),Qn=!1;function so(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function fo(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Zn(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Fn(e,t,l){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(Ne&2)!==0){var o=i.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),i.pending=t,t=lr(e),Uf(e,null,l),t}return nr(e,i,t,l),lr(e)}function Ji(e,t,l){if(t=t.updateQueue,t!==null&&(t=t.shared,(l&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Gs(e,l)}}function ho(e,t){var l=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,l===i)){var o=null,c=null;if(l=l.firstBaseUpdate,l!==null){do{var g={lane:l.lane,tag:l.tag,payload:l.payload,callback:null,next:null};c===null?o=c=g:c=c.next=g,l=l.next}while(l!==null);c===null?o=c=t:c=c.next=t}else o=c=t;l={baseState:i.baseState,firstBaseUpdate:o,lastBaseUpdate:c,shared:i.shared,callbacks:i.callbacks},e.updateQueue=l;return}e=l.lastBaseUpdate,e===null?l.firstBaseUpdate=t:e.next=t,l.lastBaseUpdate=t}var po=!1;function $i(){if(po){var e=li;if(e!==null)throw e}}function Wi(e,t,l,i){po=!1;var o=e.updateQueue;Qn=!1;var c=o.firstBaseUpdate,g=o.lastBaseUpdate,x=o.shared.pending;if(x!==null){o.shared.pending=null;var A=x,O=A.next;A.next=null,g===null?c=O:g.next=O,g=A;var H=e.alternate;H!==null&&(H=H.updateQueue,x=H.lastBaseUpdate,x!==g&&(x===null?H.firstBaseUpdate=O:x.next=O,H.lastBaseUpdate=A))}if(c!==null){var G=o.baseState;g=0,H=O=A=null,x=c;do{var N=x.lane&-536870913,U=N!==x.lane;if(U?(ze&N)===N:(i&N)===N){N!==0&&N===ni&&(po=!0),H!==null&&(H=H.next={lane:0,tag:x.tag,payload:x.payload,callback:null,next:null});e:{var ie=e,de=x;N=t;var Ye=l;switch(de.tag){case 1:if(ie=de.payload,typeof ie=="function"){G=ie.call(Ye,G,N);break e}G=ie;break e;case 3:ie.flags=ie.flags&-65537|128;case 0:if(ie=de.payload,N=typeof ie=="function"?ie.call(Ye,G,N):ie,N==null)break e;G=y({},G,N);break e;case 2:Qn=!0}}N=x.callback,N!==null&&(e.flags|=64,U&&(e.flags|=8192),U=o.callbacks,U===null?o.callbacks=[N]:U.push(N))}else U={lane:N,tag:x.tag,payload:x.payload,callback:x.callback,next:null},H===null?(O=H=U,A=G):H=H.next=U,g|=N;if(x=x.next,x===null){if(x=o.shared.pending,x===null)break;U=x,x=U.next,U.next=null,o.lastBaseUpdate=U,o.shared.pending=null}}while(!0);H===null&&(A=G),o.baseState=A,o.firstBaseUpdate=O,o.lastBaseUpdate=H,c===null&&(o.shared.lanes=0),Wn|=g,e.lanes=g,e.memoizedState=G}}function eh(e,t){if(typeof e!="function")throw Error(u(191,e));e.call(t)}function th(e,t){var l=e.callbacks;if(l!==null)for(e.callbacks=null,e=0;e<l.length;e++)eh(l[e],t)}var ri=T(null),dr=T(0);function nh(e,t){e=Nn,v(dr,e),v(ri,t),Nn=e|t.baseLanes}function mo(){v(dr,Nn),v(ri,ri.current)}function go(){Nn=dr.current,C(ri),C(dr)}var qt=T(null),en=null;function In(e){var t=e.alternate;v(Pe,Pe.current&1),v(qt,e),en===null&&(t===null||ri.current!==null||t.memoizedState!==null)&&(en=e)}function yo(e){v(Pe,Pe.current),v(qt,e),en===null&&(en=e)}function lh(e){e.tag===22?(v(Pe,Pe.current),v(qt,e),en===null&&(en=e)):Kn()}function Kn(){v(Pe,Pe.current),v(qt,qt.current)}function Yt(e){C(qt),en===e&&(en=null),C(Pe)}var Pe=T(0);function pr(e){for(var t=e;t!==null;){if(t.tag===13){var l=t.memoizedState;if(l!==null&&(l=l.dehydrated,l===null||kc(l)||Ac(l)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var wn=0,ve=null,He=null,nt=null,mr=!1,ui=!1,Tl=!1,gr=0,Pi=0,oi=null,Py=0;function $e(){throw Error(u(321))}function bo(e,t){if(t===null)return!1;for(var l=0;l<t.length&&l<e.length;l++)if(!Bt(e[l],t[l]))return!1;return!0}function vo(e,t,l,i,o,c){return wn=c,ve=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,M.H=e===null||e.memoizedState===null?qh:No,Tl=!1,c=l(i,o),Tl=!1,ui&&(c=ah(t,l,i,o)),ih(e),c}function ih(e){M.H=na;var t=He!==null&&He.next!==null;if(wn=0,nt=He=ve=null,mr=!1,Pi=0,oi=null,t)throw Error(u(300));e===null||lt||(e=e.dependencies,e!==null&&rr(e)&&(lt=!0))}function ah(e,t,l,i){ve=e;var o=0;do{if(ui&&(oi=null),Pi=0,ui=!1,25<=o)throw Error(u(301));if(o+=1,nt=He=null,e.updateQueue!=null){var c=e.updateQueue;c.lastEffect=null,c.events=null,c.stores=null,c.memoCache!=null&&(c.memoCache.index=0)}M.H=Yh,c=t(l,i)}while(ui);return c}function e1(){var e=M.H,t=e.useState()[0];return t=typeof t.then=="function"?ea(t):t,e=e.useState()[0],(He!==null?He.memoizedState:null)!==e&&(ve.flags|=1024),t}function xo(){var e=gr!==0;return gr=0,e}function So(e,t,l){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l}function Eo(e){if(mr){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}mr=!1}wn=0,nt=He=ve=null,ui=!1,Pi=gr=0,oi=null}function kt(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return nt===null?ve.memoizedState=nt=e:nt=nt.next=e,nt}function et(){if(He===null){var e=ve.alternate;e=e!==null?e.memoizedState:null}else e=He.next;var t=nt===null?ve.memoizedState:nt.next;if(t!==null)nt=t,He=e;else{if(e===null)throw ve.alternate===null?Error(u(467)):Error(u(310));He=e,e={memoizedState:He.memoizedState,baseState:He.baseState,baseQueue:He.baseQueue,queue:He.queue,next:null},nt===null?ve.memoizedState=nt=e:nt=nt.next=e}return nt}function yr(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function ea(e){var t=Pi;return Pi+=1,oi===null&&(oi=[]),e=Kf(oi,e,t),t=ve,(nt===null?t.memoizedState:nt.next)===null&&(t=t.alternate,M.H=t===null||t.memoizedState===null?qh:No),e}function br(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return ea(e);if(e.$$typeof===X)return ht(e)}throw Error(u(438,String(e)))}function ko(e){var t=null,l=ve.updateQueue;if(l!==null&&(t=l.memoCache),t==null){var i=ve.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(o){return o.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),l===null&&(l=yr(),ve.updateQueue=l),l.memoCache=t,l=t.data[t.index],l===void 0)for(l=t.data[t.index]=Array(e),i=0;i<e;i++)l[i]=L;return t.index++,l}function Cn(e,t){return typeof t=="function"?t(e):t}function vr(e){var t=et();return Ao(t,He,e)}function Ao(e,t,l){var i=e.queue;if(i===null)throw Error(u(311));i.lastRenderedReducer=l;var o=e.baseQueue,c=i.pending;if(c!==null){if(o!==null){var g=o.next;o.next=c.next,c.next=g}t.baseQueue=o=c,i.pending=null}if(c=e.baseState,o===null)e.memoizedState=c;else{t=o.next;var x=g=null,A=null,O=t,H=!1;do{var G=O.lane&-536870913;if(G!==O.lane?(ze&G)===G:(wn&G)===G){var N=O.revertLane;if(N===0)A!==null&&(A=A.next={lane:0,revertLane:0,gesture:null,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null}),G===ni&&(H=!0);else if((wn&N)===N){O=O.next,N===ni&&(H=!0);continue}else G={lane:0,revertLane:O.revertLane,gesture:null,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null},A===null?(x=A=G,g=c):A=A.next=G,ve.lanes|=N,Wn|=N;G=O.action,Tl&&l(c,G),c=O.hasEagerState?O.eagerState:l(c,G)}else N={lane:G,revertLane:O.revertLane,gesture:O.gesture,action:O.action,hasEagerState:O.hasEagerState,eagerState:O.eagerState,next:null},A===null?(x=A=N,g=c):A=A.next=N,ve.lanes|=G,Wn|=G;O=O.next}while(O!==null&&O!==t);if(A===null?g=c:A.next=x,!Bt(c,e.memoizedState)&&(lt=!0,H&&(l=li,l!==null)))throw l;e.memoizedState=c,e.baseState=g,e.baseQueue=A,i.lastRenderedState=c}return o===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function To(e){var t=et(),l=t.queue;if(l===null)throw Error(u(311));l.lastRenderedReducer=e;var i=l.dispatch,o=l.pending,c=t.memoizedState;if(o!==null){l.pending=null;var g=o=o.next;do c=e(c,g.action),g=g.next;while(g!==o);Bt(c,t.memoizedState)||(lt=!0),t.memoizedState=c,t.baseQueue===null&&(t.baseState=c),l.lastRenderedState=c}return[c,i]}function rh(e,t,l){var i=ve,o=et(),c=_e;if(c){if(l===void 0)throw Error(u(407));l=l()}else l=t();var g=!Bt((He||o).memoizedState,l);if(g&&(o.memoizedState=l,lt=!0),o=o.queue,zo(ch.bind(null,i,o,e),[e]),o.getSnapshot!==t||g||nt!==null&&nt.memoizedState.tag&1){if(i.flags|=2048,ci(9,{destroy:void 0},oh.bind(null,i,o,l,t),null),Ge===null)throw Error(u(349));c||(wn&127)!==0||uh(i,t,l)}return l}function uh(e,t,l){e.flags|=16384,e={getSnapshot:t,value:l},t=ve.updateQueue,t===null?(t=yr(),ve.updateQueue=t,t.stores=[e]):(l=t.stores,l===null?t.stores=[e]:l.push(e))}function oh(e,t,l,i){t.value=l,t.getSnapshot=i,sh(t)&&fh(e)}function ch(e,t,l){return l(function(){sh(t)&&fh(e)})}function sh(e){var t=e.getSnapshot;e=e.value;try{var l=t();return!Bt(e,l)}catch{return!0}}function fh(e){var t=gl(e,2);t!==null&&Nt(t,e,2)}function wo(e){var t=kt();if(typeof e=="function"){var l=e;if(e=l(),Tl){Ct(!0);try{l()}finally{Ct(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:e},t}function hh(e,t,l,i){return e.baseState=l,Ao(e,He,typeof i=="function"?i:Cn)}function t1(e,t,l,i,o){if(Er(e))throw Error(u(485));if(e=t.action,e!==null){var c={payload:o,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(g){c.listeners.push(g)}};M.T!==null?l(!0):c.isTransition=!1,i(c),l=t.pending,l===null?(c.next=t.pending=c,dh(t,c)):(c.next=l.next,t.pending=l.next=c)}}function dh(e,t){var l=t.action,i=t.payload,o=e.state;if(t.isTransition){var c=M.T,g={};M.T=g;try{var x=l(o,i),A=M.S;A!==null&&A(g,x),ph(e,t,x)}catch(O){Co(e,t,O)}finally{c!==null&&g.types!==null&&(c.types=g.types),M.T=c}}else try{c=l(o,i),ph(e,t,c)}catch(O){Co(e,t,O)}}function ph(e,t,l){l!==null&&typeof l=="object"&&typeof l.then=="function"?l.then(function(i){mh(e,t,i)},function(i){return Co(e,t,i)}):mh(e,t,l)}function mh(e,t,l){t.status="fulfilled",t.value=l,gh(t),e.state=l,t=e.pending,t!==null&&(l=t.next,l===t?e.pending=null:(l=l.next,t.next=l,dh(e,l)))}function Co(e,t,l){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=l,gh(t),t=t.next;while(t!==i)}e.action=null}function gh(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function yh(e,t){return t}function bh(e,t){if(_e){var l=Ge.formState;if(l!==null){e:{var i=ve;if(_e){if(Ie){t:{for(var o=Ie,c=Pt;o.nodeType!==8;){if(!c){o=null;break t}if(o=tn(o.nextSibling),o===null){o=null;break t}}c=o.data,o=c==="F!"||c==="F"?o:null}if(o){Ie=tn(o.nextSibling),i=o.data==="F!";break e}}Gn(i)}i=!1}i&&(t=l[0])}}return l=kt(),l.memoizedState=l.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:yh,lastRenderedState:t},l.queue=i,l=jh.bind(null,ve,i),i.dispatch=l,i=wo(!1),c=Ro.bind(null,ve,!1,i.queue),i=kt(),o={state:t,dispatch:null,action:e,pending:null},i.queue=o,l=t1.bind(null,ve,o,c,l),o.dispatch=l,i.memoizedState=e,[t,l,!1]}function vh(e){var t=et();return xh(t,He,e)}function xh(e,t,l){if(t=Ao(e,t,yh)[0],e=vr(Cn)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=ea(t)}catch(g){throw g===ii?cr:g}else i=t;t=et();var o=t.queue,c=o.dispatch;return l!==t.memoizedState&&(ve.flags|=2048,ci(9,{destroy:void 0},n1.bind(null,o,l),null)),[i,c,e]}function n1(e,t){e.action=t}function Sh(e){var t=et(),l=He;if(l!==null)return xh(t,l,e);et(),t=t.memoizedState,l=et();var i=l.queue.dispatch;return l.memoizedState=e,[t,i,!1]}function ci(e,t,l,i){return e={tag:e,create:l,deps:i,inst:t,next:null},t=ve.updateQueue,t===null&&(t=yr(),ve.updateQueue=t),l=t.lastEffect,l===null?t.lastEffect=e.next=e:(i=l.next,l.next=e,e.next=i,t.lastEffect=e),e}function Eh(){return et().memoizedState}function xr(e,t,l,i){var o=kt();ve.flags|=e,o.memoizedState=ci(1|t,{destroy:void 0},l,i===void 0?null:i)}function Sr(e,t,l,i){var o=et();i=i===void 0?null:i;var c=o.memoizedState.inst;He!==null&&i!==null&&bo(i,He.memoizedState.deps)?o.memoizedState=ci(t,c,l,i):(ve.flags|=e,o.memoizedState=ci(1|t,c,l,i))}function kh(e,t){xr(8390656,8,e,t)}function zo(e,t){Sr(2048,8,e,t)}function l1(e){ve.flags|=4;var t=ve.updateQueue;if(t===null)t=yr(),ve.updateQueue=t,t.events=[e];else{var l=t.events;l===null?t.events=[e]:l.push(e)}}function Ah(e){var t=et().memoizedState;return l1({ref:t,nextImpl:e}),function(){if((Ne&2)!==0)throw Error(u(440));return t.impl.apply(void 0,arguments)}}function Th(e,t){return Sr(4,2,e,t)}function wh(e,t){return Sr(4,4,e,t)}function Ch(e,t){if(typeof t=="function"){e=e();var l=t(e);return function(){typeof l=="function"?l():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function zh(e,t,l){l=l!=null?l.concat([e]):null,Sr(4,4,Ch.bind(null,t,e),l)}function Do(){}function Dh(e,t){var l=et();t=t===void 0?null:t;var i=l.memoizedState;return t!==null&&bo(t,i[1])?i[0]:(l.memoizedState=[e,t],e)}function _h(e,t){var l=et();t=t===void 0?null:t;var i=l.memoizedState;if(t!==null&&bo(t,i[1]))return i[0];if(i=e(),Tl){Ct(!0);try{e()}finally{Ct(!1)}}return l.memoizedState=[i,t],i}function _o(e,t,l){return l===void 0||(wn&1073741824)!==0&&(ze&261930)===0?e.memoizedState=t:(e.memoizedState=l,e=Od(),ve.lanes|=e,Wn|=e,l)}function Oh(e,t,l,i){return Bt(l,t)?l:ri.current!==null?(e=_o(e,l,i),Bt(e,t)||(lt=!0),e):(wn&42)===0||(wn&1073741824)!==0&&(ze&261930)===0?(lt=!0,e.memoizedState=l):(e=Od(),ve.lanes|=e,Wn|=e,t)}function Mh(e,t,l,i,o){var c=F.p;F.p=c!==0&&8>c?c:8;var g=M.T,x={};M.T=x,Ro(e,!1,t,l);try{var A=o(),O=M.S;if(O!==null&&O(x,A),A!==null&&typeof A=="object"&&typeof A.then=="function"){var H=Wy(A,i);ta(e,t,H,Xt(e))}else ta(e,t,i,Xt(e))}catch(G){ta(e,t,{then:function(){},status:"rejected",reason:G},Xt())}finally{F.p=c,g!==null&&x.types!==null&&(g.types=x.types),M.T=g}}function i1(){}function Oo(e,t,l,i){if(e.tag!==5)throw Error(u(476));var o=Rh(e).queue;Mh(e,o,t,re,l===null?i1:function(){return Nh(e),l(i)})}function Rh(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:re,baseState:re,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:re},next:null};var l={};return t.next={memoizedState:l,baseState:l,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Cn,lastRenderedState:l},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function Nh(e){var t=Rh(e);t.next===null&&(t=e.alternate.memoizedState),ta(e,t.next.queue,{},Xt())}function Mo(){return ht(ba)}function Lh(){return et().memoizedState}function Uh(){return et().memoizedState}function a1(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var l=Xt();e=Zn(l);var i=Fn(t,e,l);i!==null&&(Nt(i,t,l),Ji(i,t,l)),t={cache:ro()},e.payload=t;return}t=t.return}}function r1(e,t,l){var i=Xt();l={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null},Er(e)?Bh(t,l):(l=Ku(e,t,l,i),l!==null&&(Nt(l,e,i),Hh(l,t,i)))}function jh(e,t,l){var i=Xt();ta(e,t,l,i)}function ta(e,t,l,i){var o={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null};if(Er(e))Bh(t,o);else{var c=e.alternate;if(e.lanes===0&&(c===null||c.lanes===0)&&(c=t.lastRenderedReducer,c!==null))try{var g=t.lastRenderedState,x=c(g,l);if(o.hasEagerState=!0,o.eagerState=x,Bt(x,g))return nr(e,t,o,0),Ge===null&&tr(),!1}catch{}finally{}if(l=Ku(e,t,o,i),l!==null)return Nt(l,e,i),Hh(l,t,i),!0}return!1}function Ro(e,t,l,i){if(i={lane:2,revertLane:fc(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Er(e)){if(t)throw Error(u(479))}else t=Ku(e,l,i,2),t!==null&&Nt(t,e,2)}function Er(e){var t=e.alternate;return e===ve||t!==null&&t===ve}function Bh(e,t){ui=mr=!0;var l=e.pending;l===null?t.next=t:(t.next=l.next,l.next=t),e.pending=t}function Hh(e,t,l){if((l&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Gs(e,l)}}var na={readContext:ht,use:br,useCallback:$e,useContext:$e,useEffect:$e,useImperativeHandle:$e,useLayoutEffect:$e,useInsertionEffect:$e,useMemo:$e,useReducer:$e,useRef:$e,useState:$e,useDebugValue:$e,useDeferredValue:$e,useTransition:$e,useSyncExternalStore:$e,useId:$e,useHostTransitionStatus:$e,useFormState:$e,useActionState:$e,useOptimistic:$e,useMemoCache:$e,useCacheRefresh:$e};na.useEffectEvent=$e;var qh={readContext:ht,use:br,useCallback:function(e,t){return kt().memoizedState=[e,t===void 0?null:t],e},useContext:ht,useEffect:kh,useImperativeHandle:function(e,t,l){l=l!=null?l.concat([e]):null,xr(4194308,4,Ch.bind(null,t,e),l)},useLayoutEffect:function(e,t){return xr(4194308,4,e,t)},useInsertionEffect:function(e,t){xr(4,2,e,t)},useMemo:function(e,t){var l=kt();t=t===void 0?null:t;var i=e();if(Tl){Ct(!0);try{e()}finally{Ct(!1)}}return l.memoizedState=[i,t],i},useReducer:function(e,t,l){var i=kt();if(l!==void 0){var o=l(t);if(Tl){Ct(!0);try{l(t)}finally{Ct(!1)}}}else o=t;return i.memoizedState=i.baseState=o,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:o},i.queue=e,e=e.dispatch=r1.bind(null,ve,e),[i.memoizedState,e]},useRef:function(e){var t=kt();return e={current:e},t.memoizedState=e},useState:function(e){e=wo(e);var t=e.queue,l=jh.bind(null,ve,t);return t.dispatch=l,[e.memoizedState,l]},useDebugValue:Do,useDeferredValue:function(e,t){var l=kt();return _o(l,e,t)},useTransition:function(){var e=wo(!1);return e=Mh.bind(null,ve,e.queue,!0,!1),kt().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,l){var i=ve,o=kt();if(_e){if(l===void 0)throw Error(u(407));l=l()}else{if(l=t(),Ge===null)throw Error(u(349));(ze&127)!==0||uh(i,t,l)}o.memoizedState=l;var c={value:l,getSnapshot:t};return o.queue=c,kh(ch.bind(null,i,c,e),[e]),i.flags|=2048,ci(9,{destroy:void 0},oh.bind(null,i,c,l,t),null),l},useId:function(){var e=kt(),t=Ge.identifierPrefix;if(_e){var l=fn,i=sn;l=(i&~(1<<32-Ve(i)-1)).toString(32)+l,t="_"+t+"R_"+l,l=gr++,0<l&&(t+="H"+l.toString(32)),t+="_"}else l=Py++,t="_"+t+"r_"+l.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Mo,useFormState:bh,useActionState:bh,useOptimistic:function(e){var t=kt();t.memoizedState=t.baseState=e;var l={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=l,t=Ro.bind(null,ve,!0,l),l.dispatch=t,[e,t]},useMemoCache:ko,useCacheRefresh:function(){return kt().memoizedState=a1.bind(null,ve)},useEffectEvent:function(e){var t=kt(),l={impl:e};return t.memoizedState=l,function(){if((Ne&2)!==0)throw Error(u(440));return l.impl.apply(void 0,arguments)}}},No={readContext:ht,use:br,useCallback:Dh,useContext:ht,useEffect:zo,useImperativeHandle:zh,useInsertionEffect:Th,useLayoutEffect:wh,useMemo:_h,useReducer:vr,useRef:Eh,useState:function(){return vr(Cn)},useDebugValue:Do,useDeferredValue:function(e,t){var l=et();return Oh(l,He.memoizedState,e,t)},useTransition:function(){var e=vr(Cn)[0],t=et().memoizedState;return[typeof e=="boolean"?e:ea(e),t]},useSyncExternalStore:rh,useId:Lh,useHostTransitionStatus:Mo,useFormState:vh,useActionState:vh,useOptimistic:function(e,t){var l=et();return hh(l,He,e,t)},useMemoCache:ko,useCacheRefresh:Uh};No.useEffectEvent=Ah;var Yh={readContext:ht,use:br,useCallback:Dh,useContext:ht,useEffect:zo,useImperativeHandle:zh,useInsertionEffect:Th,useLayoutEffect:wh,useMemo:_h,useReducer:To,useRef:Eh,useState:function(){return To(Cn)},useDebugValue:Do,useDeferredValue:function(e,t){var l=et();return He===null?_o(l,e,t):Oh(l,He.memoizedState,e,t)},useTransition:function(){var e=To(Cn)[0],t=et().memoizedState;return[typeof e=="boolean"?e:ea(e),t]},useSyncExternalStore:rh,useId:Lh,useHostTransitionStatus:Mo,useFormState:Sh,useActionState:Sh,useOptimistic:function(e,t){var l=et();return He!==null?hh(l,He,e,t):(l.baseState=e,[e,l.queue.dispatch])},useMemoCache:ko,useCacheRefresh:Uh};Yh.useEffectEvent=Ah;function Lo(e,t,l,i){t=e.memoizedState,l=l(i,t),l=l==null?t:y({},t,l),e.memoizedState=l,e.lanes===0&&(e.updateQueue.baseState=l)}var Uo={enqueueSetState:function(e,t,l){e=e._reactInternals;var i=Xt(),o=Zn(i);o.payload=t,l!=null&&(o.callback=l),t=Fn(e,o,i),t!==null&&(Nt(t,e,i),Ji(t,e,i))},enqueueReplaceState:function(e,t,l){e=e._reactInternals;var i=Xt(),o=Zn(i);o.tag=1,o.payload=t,l!=null&&(o.callback=l),t=Fn(e,o,i),t!==null&&(Nt(t,e,i),Ji(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var l=Xt(),i=Zn(l);i.tag=2,t!=null&&(i.callback=t),t=Fn(e,i,l),t!==null&&(Nt(t,e,l),Ji(t,e,l))}};function Vh(e,t,l,i,o,c,g){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,c,g):t.prototype&&t.prototype.isPureReactComponent?!Vi(l,i)||!Vi(o,c):!0}function Gh(e,t,l,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(l,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(l,i),t.state!==e&&Uo.enqueueReplaceState(t,t.state,null)}function wl(e,t){var l=t;if("ref"in t){l={};for(var i in t)i!=="ref"&&(l[i]=t[i])}if(e=e.defaultProps){l===t&&(l=y({},l));for(var o in e)l[o]===void 0&&(l[o]=e[o])}return l}function Xh(e){er(e)}function Qh(e){console.error(e)}function Zh(e){er(e)}function kr(e,t){try{var l=e.onUncaughtError;l(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function Fh(e,t,l){try{var i=e.onCaughtError;i(l.value,{componentStack:l.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(o){setTimeout(function(){throw o})}}function jo(e,t,l){return l=Zn(l),l.tag=3,l.payload={element:null},l.callback=function(){kr(e,t)},l}function Ih(e){return e=Zn(e),e.tag=3,e}function Kh(e,t,l,i){var o=l.type.getDerivedStateFromError;if(typeof o=="function"){var c=i.value;e.payload=function(){return o(c)},e.callback=function(){Fh(t,l,i)}}var g=l.stateNode;g!==null&&typeof g.componentDidCatch=="function"&&(e.callback=function(){Fh(t,l,i),typeof o!="function"&&(Pn===null?Pn=new Set([this]):Pn.add(this));var x=i.stack;this.componentDidCatch(i.value,{componentStack:x!==null?x:""})})}function u1(e,t,l,i,o){if(l.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=l.alternate,t!==null&&ti(t,l,o,!0),l=qt.current,l!==null){switch(l.tag){case 31:case 13:return en===null?Lr():l.alternate===null&&We===0&&(We=3),l.flags&=-257,l.flags|=65536,l.lanes=o,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?l.updateQueue=new Set([i]):t.add(i),oc(e,i,o)),!1;case 22:return l.flags|=65536,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},l.updateQueue=t):(l=t.retryQueue,l===null?t.retryQueue=new Set([i]):l.add(i)),oc(e,i,o)),!1}throw Error(u(435,l.tag))}return oc(e,i,o),Lr(),!1}if(_e)return t=qt.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=o,i!==to&&(e=Error(u(422),{cause:i}),Qi(Jt(e,l)))):(i!==to&&(t=Error(u(423),{cause:i}),Qi(Jt(t,l))),e=e.current.alternate,e.flags|=65536,o&=-o,e.lanes|=o,i=Jt(i,l),o=jo(e.stateNode,i,o),ho(e,o),We!==4&&(We=2)),!1;var c=Error(u(520),{cause:i});if(c=Jt(c,l),sa===null?sa=[c]:sa.push(c),We!==4&&(We=2),t===null)return!0;i=Jt(i,l),l=t;do{switch(l.tag){case 3:return l.flags|=65536,e=o&-o,l.lanes|=e,e=jo(l.stateNode,i,e),ho(l,e),!1;case 1:if(t=l.type,c=l.stateNode,(l.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||c!==null&&typeof c.componentDidCatch=="function"&&(Pn===null||!Pn.has(c))))return l.flags|=65536,o&=-o,l.lanes|=o,o=Ih(o),Kh(o,e,l,i),ho(l,o),!1}l=l.return}while(l!==null);return!1}var Bo=Error(u(461)),lt=!1;function dt(e,t,l,i){t.child=e===null?Pf(t,null,l,i):Al(t,e.child,l,i)}function Jh(e,t,l,i,o){l=l.render;var c=t.ref;if("ref"in i){var g={};for(var x in i)x!=="ref"&&(g[x]=i[x])}else g=i;return xl(t),i=vo(e,t,l,g,c,o),x=xo(),e!==null&&!lt?(So(e,t,o),zn(e,t,o)):(_e&&x&&Pu(t),t.flags|=1,dt(e,t,i,o),t.child)}function $h(e,t,l,i,o){if(e===null){var c=l.type;return typeof c=="function"&&!Ju(c)&&c.defaultProps===void 0&&l.compare===null?(t.tag=15,t.type=c,Wh(e,t,c,i,o)):(e=ir(l.type,null,i,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(c=e.child,!Zo(e,o)){var g=c.memoizedProps;if(l=l.compare,l=l!==null?l:Vi,l(g,i)&&e.ref===t.ref)return zn(e,t,o)}return t.flags|=1,e=En(c,i),e.ref=t.ref,e.return=t,t.child=e}function Wh(e,t,l,i,o){if(e!==null){var c=e.memoizedProps;if(Vi(c,i)&&e.ref===t.ref)if(lt=!1,t.pendingProps=i=c,Zo(e,o))(e.flags&131072)!==0&&(lt=!0);else return t.lanes=e.lanes,zn(e,t,o)}return Ho(e,t,l,i,o)}function Ph(e,t,l,i){var o=i.children,c=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(c=c!==null?c.baseLanes|l:l,e!==null){for(i=t.child=e.child,o=0;i!==null;)o=o|i.lanes|i.childLanes,i=i.sibling;i=o&~c}else i=0,t.child=null;return ed(e,t,c,l,i)}if((l&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&or(t,c!==null?c.cachePool:null),c!==null?nh(t,c):mo(),lh(t);else return i=t.lanes=536870912,ed(e,t,c!==null?c.baseLanes|l:l,l,i)}else c!==null?(or(t,c.cachePool),nh(t,c),Kn(),t.memoizedState=null):(e!==null&&or(t,null),mo(),Kn());return dt(e,t,o,l),t.child}function la(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function ed(e,t,l,i,o){var c=oo();return c=c===null?null:{parent:tt._currentValue,pool:c},t.memoizedState={baseLanes:l,cachePool:c},e!==null&&or(t,null),mo(),lh(t),e!==null&&ti(e,t,i,!0),t.childLanes=o,null}function Ar(e,t){return t=wr({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function td(e,t,l){return Al(t,e.child,null,l),e=Ar(t,t.pendingProps),e.flags|=2,Yt(t),t.memoizedState=null,e}function o1(e,t,l){var i=t.pendingProps,o=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(_e){if(i.mode==="hidden")return e=Ar(t,i),t.lanes=536870912,la(null,e);if(yo(t),(e=Ie)?(e=dp(e,Pt),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Yn!==null?{id:sn,overflow:fn}:null,retryLane:536870912,hydrationErrors:null},l=Bf(e),l.return=t,t.child=l,ft=t,Ie=null)):e=null,e===null)throw Gn(t);return t.lanes=536870912,null}return Ar(t,i)}var c=e.memoizedState;if(c!==null){var g=c.dehydrated;if(yo(t),o)if(t.flags&256)t.flags&=-257,t=td(e,t,l);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(u(558));else if(lt||ti(e,t,l,!1),o=(l&e.childLanes)!==0,lt||o){if(i=Ge,i!==null&&(g=Xs(i,l),g!==0&&g!==c.retryLane))throw c.retryLane=g,gl(e,g),Nt(i,e,g),Bo;Lr(),t=td(e,t,l)}else e=c.treeContext,Ie=tn(g.nextSibling),ft=t,_e=!0,Vn=null,Pt=!1,e!==null&&Yf(t,e),t=Ar(t,i),t.flags|=4096;return t}return e=En(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function Tr(e,t){var l=t.ref;if(l===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof l!="function"&&typeof l!="object")throw Error(u(284));(e===null||e.ref!==l)&&(t.flags|=4194816)}}function Ho(e,t,l,i,o){return xl(t),l=vo(e,t,l,i,void 0,o),i=xo(),e!==null&&!lt?(So(e,t,o),zn(e,t,o)):(_e&&i&&Pu(t),t.flags|=1,dt(e,t,l,o),t.child)}function nd(e,t,l,i,o,c){return xl(t),t.updateQueue=null,l=ah(t,i,l,o),ih(e),i=xo(),e!==null&&!lt?(So(e,t,c),zn(e,t,c)):(_e&&i&&Pu(t),t.flags|=1,dt(e,t,l,c),t.child)}function ld(e,t,l,i,o){if(xl(t),t.stateNode===null){var c=$l,g=l.contextType;typeof g=="object"&&g!==null&&(c=ht(g)),c=new l(i,c),t.memoizedState=c.state!==null&&c.state!==void 0?c.state:null,c.updater=Uo,t.stateNode=c,c._reactInternals=t,c=t.stateNode,c.props=i,c.state=t.memoizedState,c.refs={},so(t),g=l.contextType,c.context=typeof g=="object"&&g!==null?ht(g):$l,c.state=t.memoizedState,g=l.getDerivedStateFromProps,typeof g=="function"&&(Lo(t,l,g,i),c.state=t.memoizedState),typeof l.getDerivedStateFromProps=="function"||typeof c.getSnapshotBeforeUpdate=="function"||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(g=c.state,typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount(),g!==c.state&&Uo.enqueueReplaceState(c,c.state,null),Wi(t,i,c,o),$i(),c.state=t.memoizedState),typeof c.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){c=t.stateNode;var x=t.memoizedProps,A=wl(l,x);c.props=A;var O=c.context,H=l.contextType;g=$l,typeof H=="object"&&H!==null&&(g=ht(H));var G=l.getDerivedStateFromProps;H=typeof G=="function"||typeof c.getSnapshotBeforeUpdate=="function",x=t.pendingProps!==x,H||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(x||O!==g)&&Gh(t,c,i,g),Qn=!1;var N=t.memoizedState;c.state=N,Wi(t,i,c,o),$i(),O=t.memoizedState,x||N!==O||Qn?(typeof G=="function"&&(Lo(t,l,G,i),O=t.memoizedState),(A=Qn||Vh(t,l,A,i,N,O,g))?(H||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount()),typeof c.componentDidMount=="function"&&(t.flags|=4194308)):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=O),c.props=i,c.state=O,c.context=g,i=A):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{c=t.stateNode,fo(e,t),g=t.memoizedProps,H=wl(l,g),c.props=H,G=t.pendingProps,N=c.context,O=l.contextType,A=$l,typeof O=="object"&&O!==null&&(A=ht(O)),x=l.getDerivedStateFromProps,(O=typeof x=="function"||typeof c.getSnapshotBeforeUpdate=="function")||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(g!==G||N!==A)&&Gh(t,c,i,A),Qn=!1,N=t.memoizedState,c.state=N,Wi(t,i,c,o),$i();var U=t.memoizedState;g!==G||N!==U||Qn||e!==null&&e.dependencies!==null&&rr(e.dependencies)?(typeof x=="function"&&(Lo(t,l,x,i),U=t.memoizedState),(H=Qn||Vh(t,l,H,i,N,U,A)||e!==null&&e.dependencies!==null&&rr(e.dependencies))?(O||typeof c.UNSAFE_componentWillUpdate!="function"&&typeof c.componentWillUpdate!="function"||(typeof c.componentWillUpdate=="function"&&c.componentWillUpdate(i,U,A),typeof c.UNSAFE_componentWillUpdate=="function"&&c.UNSAFE_componentWillUpdate(i,U,A)),typeof c.componentDidUpdate=="function"&&(t.flags|=4),typeof c.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof c.componentDidUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=U),c.props=i,c.state=U,c.context=A,i=H):(typeof c.componentDidUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),i=!1)}return c=i,Tr(e,t),i=(t.flags&128)!==0,c||i?(c=t.stateNode,l=i&&typeof l.getDerivedStateFromError!="function"?null:c.render(),t.flags|=1,e!==null&&i?(t.child=Al(t,e.child,null,o),t.child=Al(t,null,l,o)):dt(e,t,l,o),t.memoizedState=c.state,e=t.child):e=zn(e,t,o),e}function id(e,t,l,i){return bl(),t.flags|=256,dt(e,t,l,i),t.child}var qo={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Yo(e){return{baseLanes:e,cachePool:Ff()}}function Vo(e,t,l){return e=e!==null?e.childLanes&~l:0,t&&(e|=Gt),e}function ad(e,t,l){var i=t.pendingProps,o=!1,c=(t.flags&128)!==0,g;if((g=c)||(g=e!==null&&e.memoizedState===null?!1:(Pe.current&2)!==0),g&&(o=!0,t.flags&=-129),g=(t.flags&32)!==0,t.flags&=-33,e===null){if(_e){if(o?In(t):Kn(),(e=Ie)?(e=dp(e,Pt),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Yn!==null?{id:sn,overflow:fn}:null,retryLane:536870912,hydrationErrors:null},l=Bf(e),l.return=t,t.child=l,ft=t,Ie=null)):e=null,e===null)throw Gn(t);return Ac(e)?t.lanes=32:t.lanes=536870912,null}var x=i.children;return i=i.fallback,o?(Kn(),o=t.mode,x=wr({mode:"hidden",children:x},o),i=yl(i,o,l,null),x.return=t,i.return=t,x.sibling=i,t.child=x,i=t.child,i.memoizedState=Yo(l),i.childLanes=Vo(e,g,l),t.memoizedState=qo,la(null,i)):(In(t),Go(t,x))}var A=e.memoizedState;if(A!==null&&(x=A.dehydrated,x!==null)){if(c)t.flags&256?(In(t),t.flags&=-257,t=Xo(e,t,l)):t.memoizedState!==null?(Kn(),t.child=e.child,t.flags|=128,t=null):(Kn(),x=i.fallback,o=t.mode,i=wr({mode:"visible",children:i.children},o),x=yl(x,o,l,null),x.flags|=2,i.return=t,x.return=t,i.sibling=x,t.child=i,Al(t,e.child,null,l),i=t.child,i.memoizedState=Yo(l),i.childLanes=Vo(e,g,l),t.memoizedState=qo,t=la(null,i));else if(In(t),Ac(x)){if(g=x.nextSibling&&x.nextSibling.dataset,g)var O=g.dgst;g=O,i=Error(u(419)),i.stack="",i.digest=g,Qi({value:i,source:null,stack:null}),t=Xo(e,t,l)}else if(lt||ti(e,t,l,!1),g=(l&e.childLanes)!==0,lt||g){if(g=Ge,g!==null&&(i=Xs(g,l),i!==0&&i!==A.retryLane))throw A.retryLane=i,gl(e,i),Nt(g,e,i),Bo;kc(x)||Lr(),t=Xo(e,t,l)}else kc(x)?(t.flags|=192,t.child=e.child,t=null):(e=A.treeContext,Ie=tn(x.nextSibling),ft=t,_e=!0,Vn=null,Pt=!1,e!==null&&Yf(t,e),t=Go(t,i.children),t.flags|=4096);return t}return o?(Kn(),x=i.fallback,o=t.mode,A=e.child,O=A.sibling,i=En(A,{mode:"hidden",children:i.children}),i.subtreeFlags=A.subtreeFlags&65011712,O!==null?x=En(O,x):(x=yl(x,o,l,null),x.flags|=2),x.return=t,i.return=t,i.sibling=x,t.child=i,la(null,i),i=t.child,x=e.child.memoizedState,x===null?x=Yo(l):(o=x.cachePool,o!==null?(A=tt._currentValue,o=o.parent!==A?{parent:A,pool:A}:o):o=Ff(),x={baseLanes:x.baseLanes|l,cachePool:o}),i.memoizedState=x,i.childLanes=Vo(e,g,l),t.memoizedState=qo,la(e.child,i)):(In(t),l=e.child,e=l.sibling,l=En(l,{mode:"visible",children:i.children}),l.return=t,l.sibling=null,e!==null&&(g=t.deletions,g===null?(t.deletions=[e],t.flags|=16):g.push(e)),t.child=l,t.memoizedState=null,l)}function Go(e,t){return t=wr({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function wr(e,t){return e=Ht(22,e,null,t),e.lanes=0,e}function Xo(e,t,l){return Al(t,e.child,null,l),e=Go(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function rd(e,t,l){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),io(e.return,t,l)}function Qo(e,t,l,i,o,c){var g=e.memoizedState;g===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:l,tailMode:o,treeForkCount:c}:(g.isBackwards=t,g.rendering=null,g.renderingStartTime=0,g.last=i,g.tail=l,g.tailMode=o,g.treeForkCount=c)}function ud(e,t,l){var i=t.pendingProps,o=i.revealOrder,c=i.tail;i=i.children;var g=Pe.current,x=(g&2)!==0;if(x?(g=g&1|2,t.flags|=128):g&=1,v(Pe,g),dt(e,t,i,l),i=_e?Xi:0,!x&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&rd(e,l,t);else if(e.tag===19)rd(e,l,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(o){case"forwards":for(l=t.child,o=null;l!==null;)e=l.alternate,e!==null&&pr(e)===null&&(o=l),l=l.sibling;l=o,l===null?(o=t.child,t.child=null):(o=l.sibling,l.sibling=null),Qo(t,!1,o,l,c,i);break;case"backwards":case"unstable_legacy-backwards":for(l=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&pr(e)===null){t.child=o;break}e=o.sibling,o.sibling=l,l=o,o=e}Qo(t,!0,l,null,c,i);break;case"together":Qo(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function zn(e,t,l){if(e!==null&&(t.dependencies=e.dependencies),Wn|=t.lanes,(l&t.childLanes)===0)if(e!==null){if(ti(e,t,l,!1),(l&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(u(153));if(t.child!==null){for(e=t.child,l=En(e,e.pendingProps),t.child=l,l.return=t;e.sibling!==null;)e=e.sibling,l=l.sibling=En(e,e.pendingProps),l.return=t;l.sibling=null}return t.child}function Zo(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&rr(e)))}function c1(e,t,l){switch(t.tag){case 3:ge(t,t.stateNode.containerInfo),Xn(t,tt,e.memoizedState.cache),bl();break;case 27:case 5:Qe(t);break;case 4:ge(t,t.stateNode.containerInfo);break;case 10:Xn(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,yo(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(In(t),t.flags|=128,null):(l&t.child.childLanes)!==0?ad(e,t,l):(In(t),e=zn(e,t,l),e!==null?e.sibling:null);In(t);break;case 19:var o=(e.flags&128)!==0;if(i=(l&t.childLanes)!==0,i||(ti(e,t,l,!1),i=(l&t.childLanes)!==0),o){if(i)return ud(e,t,l);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),v(Pe,Pe.current),i)break;return null;case 22:return t.lanes=0,Ph(e,t,l,t.pendingProps);case 24:Xn(t,tt,e.memoizedState.cache)}return zn(e,t,l)}function od(e,t,l){if(e!==null)if(e.memoizedProps!==t.pendingProps)lt=!0;else{if(!Zo(e,l)&&(t.flags&128)===0)return lt=!1,c1(e,t,l);lt=(e.flags&131072)!==0}else lt=!1,_e&&(t.flags&1048576)!==0&&qf(t,Xi,t.index);switch(t.lanes=0,t.tag){case 16:e:{var i=t.pendingProps;if(e=El(t.elementType),t.type=e,typeof e=="function")Ju(e)?(i=wl(e,i),t.tag=1,t=ld(null,t,e,i,l)):(t.tag=0,t=Ho(null,t,e,i,l));else{if(e!=null){var o=e.$$typeof;if(o===oe){t.tag=11,t=Jh(null,t,e,i,l);break e}else if(o===ee){t.tag=14,t=$h(null,t,e,i,l);break e}}throw t=ae(e)||e,Error(u(306,t,""))}}return t;case 0:return Ho(e,t,t.type,t.pendingProps,l);case 1:return i=t.type,o=wl(i,t.pendingProps),ld(e,t,i,o,l);case 3:e:{if(ge(t,t.stateNode.containerInfo),e===null)throw Error(u(387));i=t.pendingProps;var c=t.memoizedState;o=c.element,fo(e,t),Wi(t,i,null,l);var g=t.memoizedState;if(i=g.cache,Xn(t,tt,i),i!==c.cache&&ao(t,[tt],l,!0),$i(),i=g.element,c.isDehydrated)if(c={element:i,isDehydrated:!1,cache:g.cache},t.updateQueue.baseState=c,t.memoizedState=c,t.flags&256){t=id(e,t,i,l);break e}else if(i!==o){o=Jt(Error(u(424)),t),Qi(o),t=id(e,t,i,l);break e}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Ie=tn(e.firstChild),ft=t,_e=!0,Vn=null,Pt=!0,l=Pf(t,null,i,l),t.child=l;l;)l.flags=l.flags&-3|4096,l=l.sibling}else{if(bl(),i===o){t=zn(e,t,l);break e}dt(e,t,i,l)}t=t.child}return t;case 26:return Tr(e,t),e===null?(l=vp(t.type,null,t.pendingProps,null))?t.memoizedState=l:_e||(l=t.type,e=t.pendingProps,i=Vr(Z.current).createElement(l),i[st]=t,i[zt]=e,pt(i,l,e),ot(i),t.stateNode=i):t.memoizedState=vp(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Qe(t),e===null&&_e&&(i=t.stateNode=gp(t.type,t.pendingProps,Z.current),ft=t,Pt=!0,o=Ie,ll(t.type)?(Tc=o,Ie=tn(i.firstChild)):Ie=o),dt(e,t,t.pendingProps.children,l),Tr(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&_e&&((o=i=Ie)&&(i=H1(i,t.type,t.pendingProps,Pt),i!==null?(t.stateNode=i,ft=t,Ie=tn(i.firstChild),Pt=!1,o=!0):o=!1),o||Gn(t)),Qe(t),o=t.type,c=t.pendingProps,g=e!==null?e.memoizedProps:null,i=c.children,xc(o,c)?i=null:g!==null&&xc(o,g)&&(t.flags|=32),t.memoizedState!==null&&(o=vo(e,t,e1,null,null,l),ba._currentValue=o),Tr(e,t),dt(e,t,i,l),t.child;case 6:return e===null&&_e&&((e=l=Ie)&&(l=q1(l,t.pendingProps,Pt),l!==null?(t.stateNode=l,ft=t,Ie=null,e=!0):e=!1),e||Gn(t)),null;case 13:return ad(e,t,l);case 4:return ge(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Al(t,null,i,l):dt(e,t,i,l),t.child;case 11:return Jh(e,t,t.type,t.pendingProps,l);case 7:return dt(e,t,t.pendingProps,l),t.child;case 8:return dt(e,t,t.pendingProps.children,l),t.child;case 12:return dt(e,t,t.pendingProps.children,l),t.child;case 10:return i=t.pendingProps,Xn(t,t.type,i.value),dt(e,t,i.children,l),t.child;case 9:return o=t.type._context,i=t.pendingProps.children,xl(t),o=ht(o),i=i(o),t.flags|=1,dt(e,t,i,l),t.child;case 14:return $h(e,t,t.type,t.pendingProps,l);case 15:return Wh(e,t,t.type,t.pendingProps,l);case 19:return ud(e,t,l);case 31:return o1(e,t,l);case 22:return Ph(e,t,l,t.pendingProps);case 24:return xl(t),i=ht(tt),e===null?(o=oo(),o===null&&(o=Ge,c=ro(),o.pooledCache=c,c.refCount++,c!==null&&(o.pooledCacheLanes|=l),o=c),t.memoizedState={parent:i,cache:o},so(t),Xn(t,tt,o)):((e.lanes&l)!==0&&(fo(e,t),Wi(t,null,null,l),$i()),o=e.memoizedState,c=t.memoizedState,o.parent!==i?(o={parent:i,cache:i},t.memoizedState=o,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=o),Xn(t,tt,i)):(i=c.cache,Xn(t,tt,i),i!==o.cache&&ao(t,[tt],l,!0))),dt(e,t,t.pendingProps.children,l),t.child;case 29:throw t.pendingProps}throw Error(u(156,t.tag))}function Dn(e){e.flags|=4}function Fo(e,t,l,i,o){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(o&335544128)===o)if(e.stateNode.complete)e.flags|=8192;else if(Ld())e.flags|=8192;else throw kl=sr,co}else e.flags&=-16777217}function cd(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!Ap(t))if(Ld())e.flags|=8192;else throw kl=sr,co}function Cr(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Ys():536870912,e.lanes|=t,di|=t)}function ia(e,t){if(!_e)switch(e.tailMode){case"hidden":t=e.tail;for(var l=null;t!==null;)t.alternate!==null&&(l=t),t=t.sibling;l===null?e.tail=null:l.sibling=null;break;case"collapsed":l=e.tail;for(var i=null;l!==null;)l.alternate!==null&&(i=l),l=l.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function Ke(e){var t=e.alternate!==null&&e.alternate.child===e.child,l=0,i=0;if(t)for(var o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags&65011712,i|=o.flags&65011712,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags,i|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=i,e.childLanes=l,t}function s1(e,t,l){var i=t.pendingProps;switch(eo(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Ke(t),null;case 1:return Ke(t),null;case 3:return l=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),Tn(tt),fe(),l.pendingContext&&(l.context=l.pendingContext,l.pendingContext=null),(e===null||e.child===null)&&(ei(t)?Dn(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,no())),Ke(t),null;case 26:var o=t.type,c=t.memoizedState;return e===null?(Dn(t),c!==null?(Ke(t),cd(t,c)):(Ke(t),Fo(t,o,null,i,l))):c?c!==e.memoizedState?(Dn(t),Ke(t),cd(t,c)):(Ke(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&Dn(t),Ke(t),Fo(t,o,e,i,l)),null;case 27:if(Fe(t),l=Z.current,o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Dn(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Ke(t),null}e=j.current,ei(t)?Vf(t):(e=gp(o,i,l),t.stateNode=e,Dn(t))}return Ke(t),null;case 5:if(Fe(t),o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Dn(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Ke(t),null}if(c=j.current,ei(t))Vf(t);else{var g=Vr(Z.current);switch(c){case 1:c=g.createElementNS("http://www.w3.org/2000/svg",o);break;case 2:c=g.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;default:switch(o){case"svg":c=g.createElementNS("http://www.w3.org/2000/svg",o);break;case"math":c=g.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;case"script":c=g.createElement("div"),c.innerHTML="<script><\\/script>",c=c.removeChild(c.firstChild);break;case"select":c=typeof i.is=="string"?g.createElement("select",{is:i.is}):g.createElement("select"),i.multiple?c.multiple=!0:i.size&&(c.size=i.size);break;default:c=typeof i.is=="string"?g.createElement(o,{is:i.is}):g.createElement(o)}}c[st]=t,c[zt]=i;e:for(g=t.child;g!==null;){if(g.tag===5||g.tag===6)c.appendChild(g.stateNode);else if(g.tag!==4&&g.tag!==27&&g.child!==null){g.child.return=g,g=g.child;continue}if(g===t)break e;for(;g.sibling===null;){if(g.return===null||g.return===t)break e;g=g.return}g.sibling.return=g.return,g=g.sibling}t.stateNode=c;e:switch(pt(c,o,i),o){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}i&&Dn(t)}}return Ke(t),Fo(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,l),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&Dn(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(u(166));if(e=Z.current,ei(t)){if(e=t.stateNode,l=t.memoizedProps,i=null,o=ft,o!==null)switch(o.tag){case 27:case 5:i=o.memoizedProps}e[st]=t,e=!!(e.nodeValue===l||i!==null&&i.suppressHydrationWarning===!0||ap(e.nodeValue,l)),e||Gn(t,!0)}else e=Vr(e).createTextNode(i),e[st]=t,t.stateNode=e}return Ke(t),null;case 31:if(l=t.memoizedState,e===null||e.memoizedState!==null){if(i=ei(t),l!==null){if(e===null){if(!i)throw Error(u(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(557));e[st]=t}else bl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Ke(t),e=!1}else l=no(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=l),e=!0;if(!e)return t.flags&256?(Yt(t),t):(Yt(t),null);if((t.flags&128)!==0)throw Error(u(558))}return Ke(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(o=ei(t),i!==null&&i.dehydrated!==null){if(e===null){if(!o)throw Error(u(318));if(o=t.memoizedState,o=o!==null?o.dehydrated:null,!o)throw Error(u(317));o[st]=t}else bl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Ke(t),o=!1}else o=no(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=o),o=!0;if(!o)return t.flags&256?(Yt(t),t):(Yt(t),null)}return Yt(t),(t.flags&128)!==0?(t.lanes=l,t):(l=i!==null,e=e!==null&&e.memoizedState!==null,l&&(i=t.child,o=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(o=i.alternate.memoizedState.cachePool.pool),c=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(c=i.memoizedState.cachePool.pool),c!==o&&(i.flags|=2048)),l!==e&&l&&(t.child.flags|=8192),Cr(t,t.updateQueue),Ke(t),null);case 4:return fe(),e===null&&mc(t.stateNode.containerInfo),Ke(t),null;case 10:return Tn(t.type),Ke(t),null;case 19:if(C(Pe),i=t.memoizedState,i===null)return Ke(t),null;if(o=(t.flags&128)!==0,c=i.rendering,c===null)if(o)ia(i,!1);else{if(We!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(c=pr(e),c!==null){for(t.flags|=128,ia(i,!1),e=c.updateQueue,t.updateQueue=e,Cr(t,e),t.subtreeFlags=0,e=l,l=t.child;l!==null;)jf(l,e),l=l.sibling;return v(Pe,Pe.current&1|2),_e&&kn(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&St()>Mr&&(t.flags|=128,o=!0,ia(i,!1),t.lanes=4194304)}else{if(!o)if(e=pr(c),e!==null){if(t.flags|=128,o=!0,e=e.updateQueue,t.updateQueue=e,Cr(t,e),ia(i,!0),i.tail===null&&i.tailMode==="hidden"&&!c.alternate&&!_e)return Ke(t),null}else 2*St()-i.renderingStartTime>Mr&&l!==536870912&&(t.flags|=128,o=!0,ia(i,!1),t.lanes=4194304);i.isBackwards?(c.sibling=t.child,t.child=c):(e=i.last,e!==null?e.sibling=c:t.child=c,i.last=c)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=St(),e.sibling=null,l=Pe.current,v(Pe,o?l&1|2:l&1),_e&&kn(t,i.treeForkCount),e):(Ke(t),null);case 22:case 23:return Yt(t),go(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(l&536870912)!==0&&(t.flags&128)===0&&(Ke(t),t.subtreeFlags&6&&(t.flags|=8192)):Ke(t),l=t.updateQueue,l!==null&&Cr(t,l.retryQueue),l=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==l&&(t.flags|=2048),e!==null&&C(Sl),null;case 24:return l=null,e!==null&&(l=e.memoizedState.cache),t.memoizedState.cache!==l&&(t.flags|=2048),Tn(tt),Ke(t),null;case 25:return null;case 30:return null}throw Error(u(156,t.tag))}function f1(e,t){switch(eo(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Tn(tt),fe(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return Fe(t),null;case 31:if(t.memoizedState!==null){if(Yt(t),t.alternate===null)throw Error(u(340));bl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Yt(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(u(340));bl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return C(Pe),null;case 4:return fe(),null;case 10:return Tn(t.type),null;case 22:case 23:return Yt(t),go(),e!==null&&C(Sl),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return Tn(tt),null;case 25:return null;default:return null}}function sd(e,t){switch(eo(t),t.tag){case 3:Tn(tt),fe();break;case 26:case 27:case 5:Fe(t);break;case 4:fe();break;case 31:t.memoizedState!==null&&Yt(t);break;case 13:Yt(t);break;case 19:C(Pe);break;case 10:Tn(t.type);break;case 22:case 23:Yt(t),go(),e!==null&&C(Sl);break;case 24:Tn(tt)}}function aa(e,t){try{var l=t.updateQueue,i=l!==null?l.lastEffect:null;if(i!==null){var o=i.next;l=o;do{if((l.tag&e)===e){i=void 0;var c=l.create,g=l.inst;i=c(),g.destroy=i}l=l.next}while(l!==o)}}catch(x){je(t,t.return,x)}}function Jn(e,t,l){try{var i=t.updateQueue,o=i!==null?i.lastEffect:null;if(o!==null){var c=o.next;i=c;do{if((i.tag&e)===e){var g=i.inst,x=g.destroy;if(x!==void 0){g.destroy=void 0,o=t;var A=l,O=x;try{O()}catch(H){je(o,A,H)}}}i=i.next}while(i!==c)}}catch(H){je(t,t.return,H)}}function fd(e){var t=e.updateQueue;if(t!==null){var l=e.stateNode;try{th(t,l)}catch(i){je(e,e.return,i)}}}function hd(e,t,l){l.props=wl(e.type,e.memoizedProps),l.state=e.memoizedState;try{l.componentWillUnmount()}catch(i){je(e,t,i)}}function ra(e,t){try{var l=e.ref;if(l!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof l=="function"?e.refCleanup=l(i):l.current=i}}catch(o){je(e,t,o)}}function hn(e,t){var l=e.ref,i=e.refCleanup;if(l!==null)if(typeof i=="function")try{i()}catch(o){je(e,t,o)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof l=="function")try{l(null)}catch(o){je(e,t,o)}else l.current=null}function dd(e){var t=e.type,l=e.memoizedProps,i=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":l.autoFocus&&i.focus();break e;case"img":l.src?i.src=l.src:l.srcSet&&(i.srcset=l.srcSet)}}catch(o){je(e,e.return,o)}}function Io(e,t,l){try{var i=e.stateNode;R1(i,e.type,l,t),i[zt]=t}catch(o){je(e,e.return,o)}}function pd(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&ll(e.type)||e.tag===4}function Ko(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||pd(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&ll(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Jo(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l).insertBefore(e,t):(t=l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l,t.appendChild(e),l=l._reactRootContainer,l!=null||t.onclick!==null||(t.onclick=xn));else if(i!==4&&(i===27&&ll(e.type)&&(l=e.stateNode,t=null),e=e.child,e!==null))for(Jo(e,t,l),e=e.sibling;e!==null;)Jo(e,t,l),e=e.sibling}function zr(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?l.insertBefore(e,t):l.appendChild(e);else if(i!==4&&(i===27&&ll(e.type)&&(l=e.stateNode),e=e.child,e!==null))for(zr(e,t,l),e=e.sibling;e!==null;)zr(e,t,l),e=e.sibling}function md(e){var t=e.stateNode,l=e.memoizedProps;try{for(var i=e.type,o=t.attributes;o.length;)t.removeAttributeNode(o[0]);pt(t,i,l),t[st]=e,t[zt]=l}catch(c){je(e,e.return,c)}}var _n=!1,it=!1,$o=!1,gd=typeof WeakSet=="function"?WeakSet:Set,ct=null;function h1(e,t){if(e=e.containerInfo,bc=Kr,e=zf(e),Gu(e)){if("selectionStart"in e)var l={start:e.selectionStart,end:e.selectionEnd};else e:{l=(l=e.ownerDocument)&&l.defaultView||window;var i=l.getSelection&&l.getSelection();if(i&&i.rangeCount!==0){l=i.anchorNode;var o=i.anchorOffset,c=i.focusNode;i=i.focusOffset;try{l.nodeType,c.nodeType}catch{l=null;break e}var g=0,x=-1,A=-1,O=0,H=0,G=e,N=null;t:for(;;){for(var U;G!==l||o!==0&&G.nodeType!==3||(x=g+o),G!==c||i!==0&&G.nodeType!==3||(A=g+i),G.nodeType===3&&(g+=G.nodeValue.length),(U=G.firstChild)!==null;)N=G,G=U;for(;;){if(G===e)break t;if(N===l&&++O===o&&(x=g),N===c&&++H===i&&(A=g),(U=G.nextSibling)!==null)break;G=N,N=G.parentNode}G=U}l=x===-1||A===-1?null:{start:x,end:A}}else l=null}l=l||{start:0,end:0}}else l=null;for(vc={focusedElem:e,selectionRange:l},Kr=!1,ct=t;ct!==null;)if(t=ct,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,ct=e;else for(;ct!==null;){switch(t=ct,c=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(l=0;l<e.length;l++)o=e[l],o.ref.impl=o.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&c!==null){e=void 0,l=t,o=c.memoizedProps,c=c.memoizedState,i=l.stateNode;try{var ie=wl(l.type,o);e=i.getSnapshotBeforeUpdate(ie,c),i.__reactInternalSnapshotBeforeUpdate=e}catch(de){je(l,l.return,de)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,l=e.nodeType,l===9)Ec(e);else if(l===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":Ec(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(u(163))}if(e=t.sibling,e!==null){e.return=t.return,ct=e;break}ct=t.return}}function yd(e,t,l){var i=l.flags;switch(l.tag){case 0:case 11:case 15:Mn(e,l),i&4&&aa(5,l);break;case 1:if(Mn(e,l),i&4)if(e=l.stateNode,t===null)try{e.componentDidMount()}catch(g){je(l,l.return,g)}else{var o=wl(l.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(o,t,e.__reactInternalSnapshotBeforeUpdate)}catch(g){je(l,l.return,g)}}i&64&&fd(l),i&512&&ra(l,l.return);break;case 3:if(Mn(e,l),i&64&&(e=l.updateQueue,e!==null)){if(t=null,l.child!==null)switch(l.child.tag){case 27:case 5:t=l.child.stateNode;break;case 1:t=l.child.stateNode}try{th(e,t)}catch(g){je(l,l.return,g)}}break;case 27:t===null&&i&4&&md(l);case 26:case 5:Mn(e,l),t===null&&i&4&&dd(l),i&512&&ra(l,l.return);break;case 12:Mn(e,l);break;case 31:Mn(e,l),i&4&&xd(e,l);break;case 13:Mn(e,l),i&4&&Sd(e,l),i&64&&(e=l.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(l=S1.bind(null,l),Y1(e,l))));break;case 22:if(i=l.memoizedState!==null||_n,!i){t=t!==null&&t.memoizedState!==null||it,o=_n;var c=it;_n=i,(it=t)&&!c?Rn(e,l,(l.subtreeFlags&8772)!==0):Mn(e,l),_n=o,it=c}break;case 30:break;default:Mn(e,l)}}function bd(e){var t=e.alternate;t!==null&&(e.alternate=null,bd(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&wu(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Je=null,_t=!1;function On(e,t,l){for(l=l.child;l!==null;)vd(e,t,l),l=l.sibling}function vd(e,t,l){if(rt&&typeof rt.onCommitFiberUnmount=="function")try{rt.onCommitFiberUnmount(Et,l)}catch{}switch(l.tag){case 26:it||hn(l,t),On(e,t,l),l.memoizedState?l.memoizedState.count--:l.stateNode&&(l=l.stateNode,l.parentNode.removeChild(l));break;case 27:it||hn(l,t);var i=Je,o=_t;ll(l.type)&&(Je=l.stateNode,_t=!1),On(e,t,l),ma(l.stateNode),Je=i,_t=o;break;case 5:it||hn(l,t);case 6:if(i=Je,o=_t,Je=null,On(e,t,l),Je=i,_t=o,Je!==null)if(_t)try{(Je.nodeType===9?Je.body:Je.nodeName==="HTML"?Je.ownerDocument.body:Je).removeChild(l.stateNode)}catch(c){je(l,t,c)}else try{Je.removeChild(l.stateNode)}catch(c){je(l,t,c)}break;case 18:Je!==null&&(_t?(e=Je,fp(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,l.stateNode),Si(e)):fp(Je,l.stateNode));break;case 4:i=Je,o=_t,Je=l.stateNode.containerInfo,_t=!0,On(e,t,l),Je=i,_t=o;break;case 0:case 11:case 14:case 15:Jn(2,l,t),it||Jn(4,l,t),On(e,t,l);break;case 1:it||(hn(l,t),i=l.stateNode,typeof i.componentWillUnmount=="function"&&hd(l,t,i)),On(e,t,l);break;case 21:On(e,t,l);break;case 22:it=(i=it)||l.memoizedState!==null,On(e,t,l),it=i;break;default:On(e,t,l)}}function xd(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Si(e)}catch(l){je(t,t.return,l)}}}function Sd(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Si(e)}catch(l){je(t,t.return,l)}}function d1(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new gd),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new gd),t;default:throw Error(u(435,e.tag))}}function Dr(e,t){var l=d1(e);t.forEach(function(i){if(!l.has(i)){l.add(i);var o=E1.bind(null,e,i);i.then(o,o)}})}function Ot(e,t){var l=t.deletions;if(l!==null)for(var i=0;i<l.length;i++){var o=l[i],c=e,g=t,x=g;e:for(;x!==null;){switch(x.tag){case 27:if(ll(x.type)){Je=x.stateNode,_t=!1;break e}break;case 5:Je=x.stateNode,_t=!1;break e;case 3:case 4:Je=x.stateNode.containerInfo,_t=!0;break e}x=x.return}if(Je===null)throw Error(u(160));vd(c,g,o),Je=null,_t=!1,c=o.alternate,c!==null&&(c.return=null),o.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Ed(t,e),t=t.sibling}var un=null;function Ed(e,t){var l=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Ot(t,e),Mt(e),i&4&&(Jn(3,e,e.return),aa(3,e),Jn(5,e,e.return));break;case 1:Ot(t,e),Mt(e),i&512&&(it||l===null||hn(l,l.return)),i&64&&_n&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(l=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=l===null?i:l.concat(i))));break;case 26:var o=un;if(Ot(t,e),Mt(e),i&512&&(it||l===null||hn(l,l.return)),i&4){var c=l!==null?l.memoizedState:null;if(i=e.memoizedState,l===null)if(i===null)if(e.stateNode===null){e:{i=e.type,l=e.memoizedProps,o=o.ownerDocument||o;t:switch(i){case"title":c=o.getElementsByTagName("title")[0],(!c||c[Ri]||c[st]||c.namespaceURI==="http://www.w3.org/2000/svg"||c.hasAttribute("itemprop"))&&(c=o.createElement(i),o.head.insertBefore(c,o.querySelector("head > title"))),pt(c,i,l),c[st]=e,ot(c),i=c;break e;case"link":var g=Ep("link","href",o).get(i+(l.href||""));if(g){for(var x=0;x<g.length;x++)if(c=g[x],c.getAttribute("href")===(l.href==null||l.href===""?null:l.href)&&c.getAttribute("rel")===(l.rel==null?null:l.rel)&&c.getAttribute("title")===(l.title==null?null:l.title)&&c.getAttribute("crossorigin")===(l.crossOrigin==null?null:l.crossOrigin)){g.splice(x,1);break t}}c=o.createElement(i),pt(c,i,l),o.head.appendChild(c);break;case"meta":if(g=Ep("meta","content",o).get(i+(l.content||""))){for(x=0;x<g.length;x++)if(c=g[x],c.getAttribute("content")===(l.content==null?null:""+l.content)&&c.getAttribute("name")===(l.name==null?null:l.name)&&c.getAttribute("property")===(l.property==null?null:l.property)&&c.getAttribute("http-equiv")===(l.httpEquiv==null?null:l.httpEquiv)&&c.getAttribute("charset")===(l.charSet==null?null:l.charSet)){g.splice(x,1);break t}}c=o.createElement(i),pt(c,i,l),o.head.appendChild(c);break;default:throw Error(u(468,i))}c[st]=e,ot(c),i=c}e.stateNode=i}else kp(o,e.type,e.stateNode);else e.stateNode=Sp(o,i,e.memoizedProps);else c!==i?(c===null?l.stateNode!==null&&(l=l.stateNode,l.parentNode.removeChild(l)):c.count--,i===null?kp(o,e.type,e.stateNode):Sp(o,i,e.memoizedProps)):i===null&&e.stateNode!==null&&Io(e,e.memoizedProps,l.memoizedProps)}break;case 27:Ot(t,e),Mt(e),i&512&&(it||l===null||hn(l,l.return)),l!==null&&i&4&&Io(e,e.memoizedProps,l.memoizedProps);break;case 5:if(Ot(t,e),Mt(e),i&512&&(it||l===null||hn(l,l.return)),e.flags&32){o=e.stateNode;try{Xl(o,"")}catch(ie){je(e,e.return,ie)}}i&4&&e.stateNode!=null&&(o=e.memoizedProps,Io(e,o,l!==null?l.memoizedProps:o)),i&1024&&($o=!0);break;case 6:if(Ot(t,e),Mt(e),i&4){if(e.stateNode===null)throw Error(u(162));i=e.memoizedProps,l=e.stateNode;try{l.nodeValue=i}catch(ie){je(e,e.return,ie)}}break;case 3:if(Qr=null,o=un,un=Gr(t.containerInfo),Ot(t,e),un=o,Mt(e),i&4&&l!==null&&l.memoizedState.isDehydrated)try{Si(t.containerInfo)}catch(ie){je(e,e.return,ie)}$o&&($o=!1,kd(e));break;case 4:i=un,un=Gr(e.stateNode.containerInfo),Ot(t,e),Mt(e),un=i;break;case 12:Ot(t,e),Mt(e);break;case 31:Ot(t,e),Mt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Dr(e,i)));break;case 13:Ot(t,e),Mt(e),e.child.flags&8192&&e.memoizedState!==null!=(l!==null&&l.memoizedState!==null)&&(Or=St()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Dr(e,i)));break;case 22:o=e.memoizedState!==null;var A=l!==null&&l.memoizedState!==null,O=_n,H=it;if(_n=O||o,it=H||A,Ot(t,e),it=H,_n=O,Mt(e),i&8192)e:for(t=e.stateNode,t._visibility=o?t._visibility&-2:t._visibility|1,o&&(l===null||A||_n||it||Cl(e)),l=null,t=e;;){if(t.tag===5||t.tag===26){if(l===null){A=l=t;try{if(c=A.stateNode,o)g=c.style,typeof g.setProperty=="function"?g.setProperty("display","none","important"):g.display="none";else{x=A.stateNode;var G=A.memoizedProps.style,N=G!=null&&G.hasOwnProperty("display")?G.display:null;x.style.display=N==null||typeof N=="boolean"?"":(""+N).trim()}}catch(ie){je(A,A.return,ie)}}}else if(t.tag===6){if(l===null){A=t;try{A.stateNode.nodeValue=o?"":A.memoizedProps}catch(ie){je(A,A.return,ie)}}}else if(t.tag===18){if(l===null){A=t;try{var U=A.stateNode;o?hp(U,!0):hp(A.stateNode,!1)}catch(ie){je(A,A.return,ie)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;l===t&&(l=null),t=t.return}l===t&&(l=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(l=i.retryQueue,l!==null&&(i.retryQueue=null,Dr(e,l))));break;case 19:Ot(t,e),Mt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Dr(e,i)));break;case 30:break;case 21:break;default:Ot(t,e),Mt(e)}}function Mt(e){var t=e.flags;if(t&2){try{for(var l,i=e.return;i!==null;){if(pd(i)){l=i;break}i=i.return}if(l==null)throw Error(u(160));switch(l.tag){case 27:var o=l.stateNode,c=Ko(e);zr(e,c,o);break;case 5:var g=l.stateNode;l.flags&32&&(Xl(g,""),l.flags&=-33);var x=Ko(e);zr(e,x,g);break;case 3:case 4:var A=l.stateNode.containerInfo,O=Ko(e);Jo(e,O,A);break;default:throw Error(u(161))}}catch(H){je(e,e.return,H)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function kd(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;kd(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Mn(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)yd(e,t.alternate,t),t=t.sibling}function Cl(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:Jn(4,t,t.return),Cl(t);break;case 1:hn(t,t.return);var l=t.stateNode;typeof l.componentWillUnmount=="function"&&hd(t,t.return,l),Cl(t);break;case 27:ma(t.stateNode);case 26:case 5:hn(t,t.return),Cl(t);break;case 22:t.memoizedState===null&&Cl(t);break;case 30:Cl(t);break;default:Cl(t)}e=e.sibling}}function Rn(e,t,l){for(l=l&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,o=e,c=t,g=c.flags;switch(c.tag){case 0:case 11:case 15:Rn(o,c,l),aa(4,c);break;case 1:if(Rn(o,c,l),i=c,o=i.stateNode,typeof o.componentDidMount=="function")try{o.componentDidMount()}catch(O){je(i,i.return,O)}if(i=c,o=i.updateQueue,o!==null){var x=i.stateNode;try{var A=o.shared.hiddenCallbacks;if(A!==null)for(o.shared.hiddenCallbacks=null,o=0;o<A.length;o++)eh(A[o],x)}catch(O){je(i,i.return,O)}}l&&g&64&&fd(c),ra(c,c.return);break;case 27:md(c);case 26:case 5:Rn(o,c,l),l&&i===null&&g&4&&dd(c),ra(c,c.return);break;case 12:Rn(o,c,l);break;case 31:Rn(o,c,l),l&&g&4&&xd(o,c);break;case 13:Rn(o,c,l),l&&g&4&&Sd(o,c);break;case 22:c.memoizedState===null&&Rn(o,c,l),ra(c,c.return);break;case 30:break;default:Rn(o,c,l)}t=t.sibling}}function Wo(e,t){var l=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==l&&(e!=null&&e.refCount++,l!=null&&Zi(l))}function Po(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Zi(e))}function on(e,t,l,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Ad(e,t,l,i),t=t.sibling}function Ad(e,t,l,i){var o=t.flags;switch(t.tag){case 0:case 11:case 15:on(e,t,l,i),o&2048&&aa(9,t);break;case 1:on(e,t,l,i);break;case 3:on(e,t,l,i),o&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Zi(e)));break;case 12:if(o&2048){on(e,t,l,i),e=t.stateNode;try{var c=t.memoizedProps,g=c.id,x=c.onPostCommit;typeof x=="function"&&x(g,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(A){je(t,t.return,A)}}else on(e,t,l,i);break;case 31:on(e,t,l,i);break;case 13:on(e,t,l,i);break;case 23:break;case 22:c=t.stateNode,g=t.alternate,t.memoizedState!==null?c._visibility&2?on(e,t,l,i):ua(e,t):c._visibility&2?on(e,t,l,i):(c._visibility|=2,si(e,t,l,i,(t.subtreeFlags&10256)!==0||!1)),o&2048&&Wo(g,t);break;case 24:on(e,t,l,i),o&2048&&Po(t.alternate,t);break;default:on(e,t,l,i)}}function si(e,t,l,i,o){for(o=o&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var c=e,g=t,x=l,A=i,O=g.flags;switch(g.tag){case 0:case 11:case 15:si(c,g,x,A,o),aa(8,g);break;case 23:break;case 22:var H=g.stateNode;g.memoizedState!==null?H._visibility&2?si(c,g,x,A,o):ua(c,g):(H._visibility|=2,si(c,g,x,A,o)),o&&O&2048&&Wo(g.alternate,g);break;case 24:si(c,g,x,A,o),o&&O&2048&&Po(g.alternate,g);break;default:si(c,g,x,A,o)}t=t.sibling}}function ua(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var l=e,i=t,o=i.flags;switch(i.tag){case 22:ua(l,i),o&2048&&Wo(i.alternate,i);break;case 24:ua(l,i),o&2048&&Po(i.alternate,i);break;default:ua(l,i)}t=t.sibling}}var oa=8192;function fi(e,t,l){if(e.subtreeFlags&oa)for(e=e.child;e!==null;)Td(e,t,l),e=e.sibling}function Td(e,t,l){switch(e.tag){case 26:fi(e,t,l),e.flags&oa&&e.memoizedState!==null&&P1(l,un,e.memoizedState,e.memoizedProps);break;case 5:fi(e,t,l);break;case 3:case 4:var i=un;un=Gr(e.stateNode.containerInfo),fi(e,t,l),un=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=oa,oa=16777216,fi(e,t,l),oa=i):fi(e,t,l));break;default:fi(e,t,l)}}function wd(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function ca(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];ct=i,zd(i,e)}wd(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Cd(e),e=e.sibling}function Cd(e){switch(e.tag){case 0:case 11:case 15:ca(e),e.flags&2048&&Jn(9,e,e.return);break;case 3:ca(e);break;case 12:ca(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,_r(e)):ca(e);break;default:ca(e)}}function _r(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];ct=i,zd(i,e)}wd(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:Jn(8,t,t.return),_r(t);break;case 22:l=t.stateNode,l._visibility&2&&(l._visibility&=-3,_r(t));break;default:_r(t)}e=e.sibling}}function zd(e,t){for(;ct!==null;){var l=ct;switch(l.tag){case 0:case 11:case 15:Jn(8,l,t);break;case 23:case 22:if(l.memoizedState!==null&&l.memoizedState.cachePool!==null){var i=l.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:Zi(l.memoizedState.cache)}if(i=l.child,i!==null)i.return=l,ct=i;else e:for(l=e;ct!==null;){i=ct;var o=i.sibling,c=i.return;if(bd(i),i===l){ct=null;break e}if(o!==null){o.return=c,ct=o;break e}ct=c}}}var p1={getCacheForType:function(e){var t=ht(tt),l=t.data.get(e);return l===void 0&&(l=e(),t.data.set(e,l)),l},cacheSignal:function(){return ht(tt).controller.signal}},m1=typeof WeakMap=="function"?WeakMap:Map,Ne=0,Ge=null,Te=null,ze=0,Ue=0,Vt=null,$n=!1,hi=!1,ec=!1,Nn=0,We=0,Wn=0,zl=0,tc=0,Gt=0,di=0,sa=null,Rt=null,nc=!1,Or=0,Dd=0,Mr=1/0,Rr=null,Pn=null,ut=0,el=null,pi=null,Ln=0,lc=0,ic=null,_d=null,fa=0,ac=null;function Xt(){return(Ne&2)!==0&&ze!==0?ze&-ze:M.T!==null?fc():Qs()}function Od(){if(Gt===0)if((ze&536870912)===0||_e){var e=Ya;Ya<<=1,(Ya&3932160)===0&&(Ya=262144),Gt=e}else Gt=536870912;return e=qt.current,e!==null&&(e.flags|=32),Gt}function Nt(e,t,l){(e===Ge&&(Ue===2||Ue===9)||e.cancelPendingCommit!==null)&&(mi(e,0),tl(e,ze,Gt,!1)),Mi(e,l),((Ne&2)===0||e!==Ge)&&(e===Ge&&((Ne&2)===0&&(zl|=l),We===4&&tl(e,ze,Gt,!1)),dn(e))}function Md(e,t,l){if((Ne&6)!==0)throw Error(u(327));var i=!l&&(t&127)===0&&(t&e.expiredLanes)===0||Oi(e,t),o=i?b1(e,t):uc(e,t,!0),c=i;do{if(o===0){hi&&!i&&tl(e,t,0,!1);break}else{if(l=e.current.alternate,c&&!g1(l)){o=uc(e,t,!1),c=!1;continue}if(o===2){if(c=t,e.errorRecoveryDisabledLanes&c)var g=0;else g=e.pendingLanes&-536870913,g=g!==0?g:g&536870912?536870912:0;if(g!==0){t=g;e:{var x=e;o=sa;var A=x.current.memoizedState.isDehydrated;if(A&&(mi(x,g).flags|=256),g=uc(x,g,!1),g!==2){if(ec&&!A){x.errorRecoveryDisabledLanes|=c,zl|=c,o=4;break e}c=Rt,Rt=o,c!==null&&(Rt===null?Rt=c:Rt.push.apply(Rt,c))}o=g}if(c=!1,o!==2)continue}}if(o===1){mi(e,0),tl(e,t,0,!0);break}e:{switch(i=e,c=o,c){case 0:case 1:throw Error(u(345));case 4:if((t&4194048)!==t)break;case 6:tl(i,t,Gt,!$n);break e;case 2:Rt=null;break;case 3:case 5:break;default:throw Error(u(329))}if((t&62914560)===t&&(o=Or+300-St(),10<o)){if(tl(i,t,Gt,!$n),Ga(i,0,!0)!==0)break e;Ln=t,i.timeoutHandle=cp(Rd.bind(null,i,l,Rt,Rr,nc,t,Gt,zl,di,$n,c,"Throttled",-0,0),o);break e}Rd(i,l,Rt,Rr,nc,t,Gt,zl,di,$n,c,null,-0,0)}}break}while(!0);dn(e)}function Rd(e,t,l,i,o,c,g,x,A,O,H,G,N,U){if(e.timeoutHandle=-1,G=t.subtreeFlags,G&8192||(G&16785408)===16785408){G={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:xn},Td(t,c,G);var ie=(c&62914560)===c?Or-St():(c&4194048)===c?Dd-St():0;if(ie=e0(G,ie),ie!==null){Ln=c,e.cancelPendingCommit=ie(Yd.bind(null,e,t,c,l,i,o,g,x,A,H,G,null,N,U)),tl(e,c,g,!O);return}}Yd(e,t,c,l,i,o,g,x,A)}function g1(e){for(var t=e;;){var l=t.tag;if((l===0||l===11||l===15)&&t.flags&16384&&(l=t.updateQueue,l!==null&&(l=l.stores,l!==null)))for(var i=0;i<l.length;i++){var o=l[i],c=o.getSnapshot;o=o.value;try{if(!Bt(c(),o))return!1}catch{return!1}}if(l=t.child,t.subtreeFlags&16384&&l!==null)l.return=t,t=l;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function tl(e,t,l,i){t&=~tc,t&=~zl,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var o=t;0<o;){var c=31-Ve(o),g=1<<c;i[c]=-1,o&=~g}l!==0&&Vs(e,l,t)}function Nr(){return(Ne&6)===0?(ha(0),!1):!0}function rc(){if(Te!==null){if(Ue===0)var e=Te.return;else e=Te,An=vl=null,Eo(e),ai=null,Ii=0,e=Te;for(;e!==null;)sd(e.alternate,e),e=e.return;Te=null}}function mi(e,t){var l=e.timeoutHandle;l!==-1&&(e.timeoutHandle=-1,U1(l)),l=e.cancelPendingCommit,l!==null&&(e.cancelPendingCommit=null,l()),Ln=0,rc(),Ge=e,Te=l=En(e.current,null),ze=t,Ue=0,Vt=null,$n=!1,hi=Oi(e,t),ec=!1,di=Gt=tc=zl=Wn=We=0,Rt=sa=null,nc=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var o=31-Ve(i),c=1<<o;t|=e[o],i&=~c}return Nn=t,tr(),l}function Nd(e,t){ve=null,M.H=na,t===ii||t===cr?(t=Jf(),Ue=3):t===co?(t=Jf(),Ue=4):Ue=t===Bo?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Vt=t,Te===null&&(We=1,kr(e,Jt(t,e.current)))}function Ld(){var e=qt.current;return e===null?!0:(ze&4194048)===ze?en===null:(ze&62914560)===ze||(ze&536870912)!==0?e===en:!1}function Ud(){var e=M.H;return M.H=na,e===null?na:e}function jd(){var e=M.A;return M.A=p1,e}function Lr(){We=4,$n||(ze&4194048)!==ze&&qt.current!==null||(hi=!0),(Wn&134217727)===0&&(zl&134217727)===0||Ge===null||tl(Ge,ze,Gt,!1)}function uc(e,t,l){var i=Ne;Ne|=2;var o=Ud(),c=jd();(Ge!==e||ze!==t)&&(Rr=null,mi(e,t)),t=!1;var g=We;e:do try{if(Ue!==0&&Te!==null){var x=Te,A=Vt;switch(Ue){case 8:rc(),g=6;break e;case 3:case 2:case 9:case 6:qt.current===null&&(t=!0);var O=Ue;if(Ue=0,Vt=null,gi(e,x,A,O),l&&hi){g=0;break e}break;default:O=Ue,Ue=0,Vt=null,gi(e,x,A,O)}}y1(),g=We;break}catch(H){Nd(e,H)}while(!0);return t&&e.shellSuspendCounter++,An=vl=null,Ne=i,M.H=o,M.A=c,Te===null&&(Ge=null,ze=0,tr()),g}function y1(){for(;Te!==null;)Bd(Te)}function b1(e,t){var l=Ne;Ne|=2;var i=Ud(),o=jd();Ge!==e||ze!==t?(Rr=null,Mr=St()+500,mi(e,t)):hi=Oi(e,t);e:do try{if(Ue!==0&&Te!==null){t=Te;var c=Vt;t:switch(Ue){case 1:Ue=0,Vt=null,gi(e,t,c,1);break;case 2:case 9:if(If(c)){Ue=0,Vt=null,Hd(t);break}t=function(){Ue!==2&&Ue!==9||Ge!==e||(Ue=7),dn(e)},c.then(t,t);break e;case 3:Ue=7;break e;case 4:Ue=5;break e;case 7:If(c)?(Ue=0,Vt=null,Hd(t)):(Ue=0,Vt=null,gi(e,t,c,7));break;case 5:var g=null;switch(Te.tag){case 26:g=Te.memoizedState;case 5:case 27:var x=Te;if(g?Ap(g):x.stateNode.complete){Ue=0,Vt=null;var A=x.sibling;if(A!==null)Te=A;else{var O=x.return;O!==null?(Te=O,Ur(O)):Te=null}break t}}Ue=0,Vt=null,gi(e,t,c,5);break;case 6:Ue=0,Vt=null,gi(e,t,c,6);break;case 8:rc(),We=6;break e;default:throw Error(u(462))}}v1();break}catch(H){Nd(e,H)}while(!0);return An=vl=null,M.H=i,M.A=o,Ne=l,Te!==null?0:(Ge=null,ze=0,tr(),We)}function v1(){for(;Te!==null&&!vu();)Bd(Te)}function Bd(e){var t=od(e.alternate,e,Nn);e.memoizedProps=e.pendingProps,t===null?Ur(e):Te=t}function Hd(e){var t=e,l=t.alternate;switch(t.tag){case 15:case 0:t=nd(l,t,t.pendingProps,t.type,void 0,ze);break;case 11:t=nd(l,t,t.pendingProps,t.type.render,t.ref,ze);break;case 5:Eo(t);default:sd(l,t),t=Te=jf(t,Nn),t=od(l,t,Nn)}e.memoizedProps=e.pendingProps,t===null?Ur(e):Te=t}function gi(e,t,l,i){An=vl=null,Eo(t),ai=null,Ii=0;var o=t.return;try{if(u1(e,o,t,l,ze)){We=1,kr(e,Jt(l,e.current)),Te=null;return}}catch(c){if(o!==null)throw Te=o,c;We=1,kr(e,Jt(l,e.current)),Te=null;return}t.flags&32768?(_e||i===1?e=!0:hi||(ze&536870912)!==0?e=!1:($n=e=!0,(i===2||i===9||i===3||i===6)&&(i=qt.current,i!==null&&i.tag===13&&(i.flags|=16384))),qd(t,e)):Ur(t)}function Ur(e){var t=e;do{if((t.flags&32768)!==0){qd(t,$n);return}e=t.return;var l=s1(t.alternate,t,Nn);if(l!==null){Te=l;return}if(t=t.sibling,t!==null){Te=t;return}Te=t=e}while(t!==null);We===0&&(We=5)}function qd(e,t){do{var l=f1(e.alternate,e);if(l!==null){l.flags&=32767,Te=l;return}if(l=e.return,l!==null&&(l.flags|=32768,l.subtreeFlags=0,l.deletions=null),!t&&(e=e.sibling,e!==null)){Te=e;return}Te=e=l}while(e!==null);We=6,Te=null}function Yd(e,t,l,i,o,c,g,x,A){e.cancelPendingCommit=null;do jr();while(ut!==0);if((Ne&6)!==0)throw Error(u(327));if(t!==null){if(t===e.current)throw Error(u(177));if(c=t.lanes|t.childLanes,c|=Iu,Wg(e,l,c,g,x,A),e===Ge&&(Te=Ge=null,ze=0),pi=t,el=e,Ln=l,lc=c,ic=o,_d=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,k1(me,function(){return Zd(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=M.T,M.T=null,o=F.p,F.p=2,g=Ne,Ne|=4;try{h1(e,t,l)}finally{Ne=g,F.p=o,M.T=i}}ut=1,Vd(),Gd(),Xd()}}function Vd(){if(ut===1){ut=0;var e=el,t=pi,l=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||l){l=M.T,M.T=null;var i=F.p;F.p=2;var o=Ne;Ne|=4;try{Ed(t,e);var c=vc,g=zf(e.containerInfo),x=c.focusedElem,A=c.selectionRange;if(g!==x&&x&&x.ownerDocument&&Cf(x.ownerDocument.documentElement,x)){if(A!==null&&Gu(x)){var O=A.start,H=A.end;if(H===void 0&&(H=O),"selectionStart"in x)x.selectionStart=O,x.selectionEnd=Math.min(H,x.value.length);else{var G=x.ownerDocument||document,N=G&&G.defaultView||window;if(N.getSelection){var U=N.getSelection(),ie=x.textContent.length,de=Math.min(A.start,ie),Ye=A.end===void 0?de:Math.min(A.end,ie);!U.extend&&de>Ye&&(g=Ye,Ye=de,de=g);var D=wf(x,de),w=wf(x,Ye);if(D&&w&&(U.rangeCount!==1||U.anchorNode!==D.node||U.anchorOffset!==D.offset||U.focusNode!==w.node||U.focusOffset!==w.offset)){var _=G.createRange();_.setStart(D.node,D.offset),U.removeAllRanges(),de>Ye?(U.addRange(_),U.extend(w.node,w.offset)):(_.setEnd(w.node,w.offset),U.addRange(_))}}}}for(G=[],U=x;U=U.parentNode;)U.nodeType===1&&G.push({element:U,left:U.scrollLeft,top:U.scrollTop});for(typeof x.focus=="function"&&x.focus(),x=0;x<G.length;x++){var V=G[x];V.element.scrollLeft=V.left,V.element.scrollTop=V.top}}Kr=!!bc,vc=bc=null}finally{Ne=o,F.p=i,M.T=l}}e.current=t,ut=2}}function Gd(){if(ut===2){ut=0;var e=el,t=pi,l=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||l){l=M.T,M.T=null;var i=F.p;F.p=2;var o=Ne;Ne|=4;try{yd(e,t.alternate,t)}finally{Ne=o,F.p=i,M.T=l}}ut=3}}function Xd(){if(ut===4||ut===3){ut=0,xu();var e=el,t=pi,l=Ln,i=_d;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?ut=5:(ut=0,pi=el=null,Qd(e,e.pendingLanes));var o=e.pendingLanes;if(o===0&&(Pn=null),Au(l),t=t.stateNode,rt&&typeof rt.onCommitFiberRoot=="function")try{rt.onCommitFiberRoot(Et,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=M.T,o=F.p,F.p=2,M.T=null;try{for(var c=e.onRecoverableError,g=0;g<i.length;g++){var x=i[g];c(x.value,{componentStack:x.stack})}}finally{M.T=t,F.p=o}}(Ln&3)!==0&&jr(),dn(e),o=e.pendingLanes,(l&261930)!==0&&(o&42)!==0?e===ac?fa++:(fa=0,ac=e):fa=0,ha(0)}}function Qd(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Zi(t)))}function jr(){return Vd(),Gd(),Xd(),Zd()}function Zd(){if(ut!==5)return!1;var e=el,t=lc;lc=0;var l=Au(Ln),i=M.T,o=F.p;try{F.p=32>l?32:l,M.T=null,l=ic,ic=null;var c=el,g=Ln;if(ut=0,pi=el=null,Ln=0,(Ne&6)!==0)throw Error(u(331));var x=Ne;if(Ne|=4,Cd(c.current),Ad(c,c.current,g,l),Ne=x,ha(0,!1),rt&&typeof rt.onPostCommitFiberRoot=="function")try{rt.onPostCommitFiberRoot(Et,c)}catch{}return!0}finally{F.p=o,M.T=i,Qd(e,t)}}function Fd(e,t,l){t=Jt(l,t),t=jo(e.stateNode,t,2),e=Fn(e,t,2),e!==null&&(Mi(e,2),dn(e))}function je(e,t,l){if(e.tag===3)Fd(e,e,l);else for(;t!==null;){if(t.tag===3){Fd(t,e,l);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(Pn===null||!Pn.has(i))){e=Jt(l,e),l=Ih(2),i=Fn(t,l,2),i!==null&&(Kh(l,i,t,e),Mi(i,2),dn(i));break}}t=t.return}}function oc(e,t,l){var i=e.pingCache;if(i===null){i=e.pingCache=new m1;var o=new Set;i.set(t,o)}else o=i.get(t),o===void 0&&(o=new Set,i.set(t,o));o.has(l)||(ec=!0,o.add(l),e=x1.bind(null,e,t,l),t.then(e,e))}function x1(e,t,l){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&l,e.warmLanes&=~l,Ge===e&&(ze&l)===l&&(We===4||We===3&&(ze&62914560)===ze&&300>St()-Or?(Ne&2)===0&&mi(e,0):tc|=l,di===ze&&(di=0)),dn(e)}function Id(e,t){t===0&&(t=Ys()),e=gl(e,t),e!==null&&(Mi(e,t),dn(e))}function S1(e){var t=e.memoizedState,l=0;t!==null&&(l=t.retryLane),Id(e,l)}function E1(e,t){var l=0;switch(e.tag){case 31:case 13:var i=e.stateNode,o=e.memoizedState;o!==null&&(l=o.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(u(314))}i!==null&&i.delete(t),Id(e,l)}function k1(e,t){return jl(e,t)}var Br=null,yi=null,cc=!1,Hr=!1,sc=!1,nl=0;function dn(e){e!==yi&&e.next===null&&(yi===null?Br=yi=e:yi=yi.next=e),Hr=!0,cc||(cc=!0,T1())}function ha(e,t){if(!sc&&Hr){sc=!0;do for(var l=!1,i=Br;i!==null;){if(e!==0){var o=i.pendingLanes;if(o===0)var c=0;else{var g=i.suspendedLanes,x=i.pingedLanes;c=(1<<31-Ve(42|e)+1)-1,c&=o&~(g&~x),c=c&201326741?c&201326741|1:c?c|2:0}c!==0&&(l=!0,Wd(i,c))}else c=ze,c=Ga(i,i===Ge?c:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(c&3)===0||Oi(i,c)||(l=!0,Wd(i,c));i=i.next}while(l);sc=!1}}function A1(){Kd()}function Kd(){Hr=cc=!1;var e=0;nl!==0&&L1()&&(e=nl);for(var t=St(),l=null,i=Br;i!==null;){var o=i.next,c=Jd(i,t);c===0?(i.next=null,l===null?Br=o:l.next=o,o===null&&(yi=l)):(l=i,(e!==0||(c&3)!==0)&&(Hr=!0)),i=o}ut!==0&&ut!==5||ha(e),nl!==0&&(nl=0)}function Jd(e,t){for(var l=e.suspendedLanes,i=e.pingedLanes,o=e.expirationTimes,c=e.pendingLanes&-62914561;0<c;){var g=31-Ve(c),x=1<<g,A=o[g];A===-1?((x&l)===0||(x&i)!==0)&&(o[g]=$g(x,t)):A<=t&&(e.expiredLanes|=x),c&=~x}if(t=Ge,l=ze,l=Ga(e,e===t?l:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,l===0||e===t&&(Ue===2||Ue===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&_i(i),e.callbackNode=null,e.callbackPriority=0;if((l&3)===0||Oi(e,l)){if(t=l&-l,t===e.callbackPriority)return t;switch(i!==null&&_i(i),Au(l)){case 2:case 8:l=P;break;case 32:l=me;break;case 268435456:l=Le;break;default:l=me}return i=$d.bind(null,e),l=jl(l,i),e.callbackPriority=t,e.callbackNode=l,t}return i!==null&&i!==null&&_i(i),e.callbackPriority=2,e.callbackNode=null,2}function $d(e,t){if(ut!==0&&ut!==5)return e.callbackNode=null,e.callbackPriority=0,null;var l=e.callbackNode;if(jr()&&e.callbackNode!==l)return null;var i=ze;return i=Ga(e,e===Ge?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(Md(e,i,t),Jd(e,St()),e.callbackNode!=null&&e.callbackNode===l?$d.bind(null,e):null)}function Wd(e,t){if(jr())return null;Md(e,t,!0)}function T1(){j1(function(){(Ne&6)!==0?jl(Y,A1):Kd()})}function fc(){if(nl===0){var e=ni;e===0&&(e=qa,qa<<=1,(qa&261888)===0&&(qa=256)),nl=e}return nl}function Pd(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Fa(""+e)}function ep(e,t){var l=t.ownerDocument.createElement("input");return l.name=t.name,l.value=t.value,e.id&&l.setAttribute("form",e.id),t.parentNode.insertBefore(l,t),e=new FormData(e),l.parentNode.removeChild(l),e}function w1(e,t,l,i,o){if(t==="submit"&&l&&l.stateNode===o){var c=Pd((o[zt]||null).action),g=i.submitter;g&&(t=(t=g[zt]||null)?Pd(t.formAction):g.getAttribute("formAction"),t!==null&&(c=t,g=null));var x=new $a("action","action",null,i,o);e.push({event:x,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(nl!==0){var A=g?ep(o,g):new FormData(o);Oo(l,{pending:!0,data:A,method:o.method,action:c},null,A)}}else typeof c=="function"&&(x.preventDefault(),A=g?ep(o,g):new FormData(o),Oo(l,{pending:!0,data:A,method:o.method,action:c},c,A))},currentTarget:o}]})}}for(var hc=0;hc<Fu.length;hc++){var dc=Fu[hc],C1=dc.toLowerCase(),z1=dc[0].toUpperCase()+dc.slice(1);rn(C1,"on"+z1)}rn(Of,"onAnimationEnd"),rn(Mf,"onAnimationIteration"),rn(Rf,"onAnimationStart"),rn("dblclick","onDoubleClick"),rn("focusin","onFocus"),rn("focusout","onBlur"),rn(Xy,"onTransitionRun"),rn(Qy,"onTransitionStart"),rn(Zy,"onTransitionCancel"),rn(Nf,"onTransitionEnd"),Vl("onMouseEnter",["mouseout","mouseover"]),Vl("onMouseLeave",["mouseout","mouseover"]),Vl("onPointerEnter",["pointerout","pointerover"]),Vl("onPointerLeave",["pointerout","pointerover"]),hl("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),hl("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),hl("onBeforeInput",["compositionend","keypress","textInput","paste"]),hl("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),hl("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),hl("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var da="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),D1=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(da));function tp(e,t){t=(t&4)!==0;for(var l=0;l<e.length;l++){var i=e[l],o=i.event;i=i.listeners;e:{var c=void 0;if(t)for(var g=i.length-1;0<=g;g--){var x=i[g],A=x.instance,O=x.currentTarget;if(x=x.listener,A!==c&&o.isPropagationStopped())break e;c=x,o.currentTarget=O;try{c(o)}catch(H){er(H)}o.currentTarget=null,c=A}else for(g=0;g<i.length;g++){if(x=i[g],A=x.instance,O=x.currentTarget,x=x.listener,A!==c&&o.isPropagationStopped())break e;c=x,o.currentTarget=O;try{c(o)}catch(H){er(H)}o.currentTarget=null,c=A}}}}function we(e,t){var l=t[Tu];l===void 0&&(l=t[Tu]=new Set);var i=e+"__bubble";l.has(i)||(np(t,e,2,!1),l.add(i))}function pc(e,t,l){var i=0;t&&(i|=4),np(l,e,i,t)}var qr="_reactListening"+Math.random().toString(36).slice(2);function mc(e){if(!e[qr]){e[qr]=!0,Is.forEach(function(l){l!=="selectionchange"&&(D1.has(l)||pc(l,!1,e),pc(l,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[qr]||(t[qr]=!0,pc("selectionchange",!1,t))}}function np(e,t,l,i){switch(Op(t)){case 2:var o=l0;break;case 8:o=i0;break;default:o=_c}l=o.bind(null,t,l,e),o=void 0,!Nu||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),i?o!==void 0?e.addEventListener(t,l,{capture:!0,passive:o}):e.addEventListener(t,l,!0):o!==void 0?e.addEventListener(t,l,{passive:o}):e.addEventListener(t,l,!1)}function gc(e,t,l,i,o){var c=i;if((t&1)===0&&(t&2)===0&&i!==null)e:for(;;){if(i===null)return;var g=i.tag;if(g===3||g===4){var x=i.stateNode.containerInfo;if(x===o)break;if(g===4)for(g=i.return;g!==null;){var A=g.tag;if((A===3||A===4)&&g.stateNode.containerInfo===o)return;g=g.return}for(;x!==null;){if(g=Hl(x),g===null)return;if(A=g.tag,A===5||A===6||A===26||A===27){i=c=g;continue e}x=x.parentNode}}i=i.return}uf(function(){var O=c,H=Mu(l),G=[];e:{var N=Lf.get(e);if(N!==void 0){var U=$a,ie=e;switch(e){case"keypress":if(Ka(l)===0)break e;case"keydown":case"keyup":U=Ey;break;case"focusin":ie="focus",U=Bu;break;case"focusout":ie="blur",U=Bu;break;case"beforeblur":case"afterblur":U=Bu;break;case"click":if(l.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":U=sf;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":U=sy;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":U=Ty;break;case Of:case Mf:case Rf:U=dy;break;case Nf:U=Cy;break;case"scroll":case"scrollend":U=oy;break;case"wheel":U=Dy;break;case"copy":case"cut":case"paste":U=my;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":U=hf;break;case"toggle":case"beforetoggle":U=Oy}var de=(t&4)!==0,Ye=!de&&(e==="scroll"||e==="scrollend"),D=de?N!==null?N+"Capture":null:N;de=[];for(var w=O,_;w!==null;){var V=w;if(_=V.stateNode,V=V.tag,V!==5&&V!==26&&V!==27||_===null||D===null||(V=Li(w,D),V!=null&&de.push(pa(w,V,_))),Ye)break;w=w.return}0<de.length&&(N=new U(N,ie,null,l,H),G.push({event:N,listeners:de}))}}if((t&7)===0){e:{if(N=e==="mouseover"||e==="pointerover",U=e==="mouseout"||e==="pointerout",N&&l!==Ou&&(ie=l.relatedTarget||l.fromElement)&&(Hl(ie)||ie[Bl]))break e;if((U||N)&&(N=H.window===H?H:(N=H.ownerDocument)?N.defaultView||N.parentWindow:window,U?(ie=l.relatedTarget||l.toElement,U=O,ie=ie?Hl(ie):null,ie!==null&&(Ye=h(ie),de=ie.tag,ie!==Ye||de!==5&&de!==27&&de!==6)&&(ie=null)):(U=null,ie=O),U!==ie)){if(de=sf,V="onMouseLeave",D="onMouseEnter",w="mouse",(e==="pointerout"||e==="pointerover")&&(de=hf,V="onPointerLeave",D="onPointerEnter",w="pointer"),Ye=U==null?N:Ni(U),_=ie==null?N:Ni(ie),N=new de(V,w+"leave",U,l,H),N.target=Ye,N.relatedTarget=_,V=null,Hl(H)===O&&(de=new de(D,w+"enter",ie,l,H),de.target=_,de.relatedTarget=Ye,V=de),Ye=V,U&&ie)t:{for(de=_1,D=U,w=ie,_=0,V=D;V;V=de(V))_++;V=0;for(var ce=w;ce;ce=de(ce))V++;for(;0<_-V;)D=de(D),_--;for(;0<V-_;)w=de(w),V--;for(;_--;){if(D===w||w!==null&&D===w.alternate){de=D;break t}D=de(D),w=de(w)}de=null}else de=null;U!==null&&lp(G,N,U,de,!1),ie!==null&&Ye!==null&&lp(G,Ye,ie,de,!0)}}e:{if(N=O?Ni(O):window,U=N.nodeName&&N.nodeName.toLowerCase(),U==="select"||U==="input"&&N.type==="file")var Me=xf;else if(bf(N))if(Sf)Me=Yy;else{Me=Hy;var ue=By}else U=N.nodeName,!U||U.toLowerCase()!=="input"||N.type!=="checkbox"&&N.type!=="radio"?O&&_u(O.elementType)&&(Me=xf):Me=qy;if(Me&&(Me=Me(e,O))){vf(G,Me,l,H);break e}ue&&ue(e,N,O),e==="focusout"&&O&&N.type==="number"&&O.memoizedProps.value!=null&&Du(N,"number",N.value)}switch(ue=O?Ni(O):window,e){case"focusin":(bf(ue)||ue.contentEditable==="true")&&(Il=ue,Xu=O,Gi=null);break;case"focusout":Gi=Xu=Il=null;break;case"mousedown":Qu=!0;break;case"contextmenu":case"mouseup":case"dragend":Qu=!1,Df(G,l,H);break;case"selectionchange":if(Gy)break;case"keydown":case"keyup":Df(G,l,H)}var Se;if(qu)e:{switch(e){case"compositionstart":var De="onCompositionStart";break e;case"compositionend":De="onCompositionEnd";break e;case"compositionupdate":De="onCompositionUpdate";break e}De=void 0}else Fl?gf(e,l)&&(De="onCompositionEnd"):e==="keydown"&&l.keyCode===229&&(De="onCompositionStart");De&&(df&&l.locale!=="ko"&&(Fl||De!=="onCompositionStart"?De==="onCompositionEnd"&&Fl&&(Se=of()):(qn=H,Lu="value"in qn?qn.value:qn.textContent,Fl=!0)),ue=Yr(O,De),0<ue.length&&(De=new ff(De,e,null,l,H),G.push({event:De,listeners:ue}),Se?De.data=Se:(Se=yf(l),Se!==null&&(De.data=Se)))),(Se=Ry?Ny(e,l):Ly(e,l))&&(De=Yr(O,"onBeforeInput"),0<De.length&&(ue=new ff("onBeforeInput","beforeinput",null,l,H),G.push({event:ue,listeners:De}),ue.data=Se)),w1(G,e,O,l,H)}tp(G,t)})}function pa(e,t,l){return{instance:e,listener:t,currentTarget:l}}function Yr(e,t){for(var l=t+"Capture",i=[];e!==null;){var o=e,c=o.stateNode;if(o=o.tag,o!==5&&o!==26&&o!==27||c===null||(o=Li(e,l),o!=null&&i.unshift(pa(e,o,c)),o=Li(e,t),o!=null&&i.push(pa(e,o,c))),e.tag===3)return i;e=e.return}return[]}function _1(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function lp(e,t,l,i,o){for(var c=t._reactName,g=[];l!==null&&l!==i;){var x=l,A=x.alternate,O=x.stateNode;if(x=x.tag,A!==null&&A===i)break;x!==5&&x!==26&&x!==27||O===null||(A=O,o?(O=Li(l,c),O!=null&&g.unshift(pa(l,O,A))):o||(O=Li(l,c),O!=null&&g.push(pa(l,O,A)))),l=l.return}g.length!==0&&e.push({event:t,listeners:g})}var O1=/\\r\\n?/g,M1=/\\u0000|\\uFFFD/g;function ip(e){return(typeof e=="string"?e:""+e).replace(O1,`\n`).replace(M1,"")}function ap(e,t){return t=ip(t),ip(e)===t}function qe(e,t,l,i,o,c){switch(l){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Xl(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Xl(e,""+i);break;case"className":Qa(e,"class",i);break;case"tabIndex":Qa(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Qa(e,l,i);break;case"style":af(e,i,c);break;case"data":if(t!=="object"){Qa(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||l!=="href")){e.removeAttribute(l);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Fa(""+i),e.setAttribute(l,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(l,"javascript:throw new Error(\'A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\\\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().\')");break}else typeof c=="function"&&(l==="formAction"?(t!=="input"&&qe(e,t,"name",o.name,o,null),qe(e,t,"formEncType",o.formEncType,o,null),qe(e,t,"formMethod",o.formMethod,o,null),qe(e,t,"formTarget",o.formTarget,o,null)):(qe(e,t,"encType",o.encType,o,null),qe(e,t,"method",o.method,o,null),qe(e,t,"target",o.target,o,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Fa(""+i),e.setAttribute(l,i);break;case"onClick":i!=null&&(e.onclick=xn);break;case"onScroll":i!=null&&we("scroll",e);break;case"onScrollEnd":i!=null&&we("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}l=Fa(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",l);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""+i):e.removeAttribute(l);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""):e.removeAttribute(l);break;case"capture":case"download":i===!0?e.setAttribute(l,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,i):e.removeAttribute(l);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(l,i):e.removeAttribute(l);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(l):e.setAttribute(l,i);break;case"popover":we("beforetoggle",e),we("toggle",e),Xa(e,"popover",i);break;case"xlinkActuate":vn(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":vn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":vn(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":vn(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":vn(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":vn(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":vn(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":vn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":vn(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Xa(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<l.length)||l[0]!=="o"&&l[0]!=="O"||l[1]!=="n"&&l[1]!=="N")&&(l=ry.get(l)||l,Xa(e,l,i))}}function yc(e,t,l,i,o,c){switch(l){case"style":af(e,i,c);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"children":typeof i=="string"?Xl(e,i):(typeof i=="number"||typeof i=="bigint")&&Xl(e,""+i);break;case"onScroll":i!=null&&we("scroll",e);break;case"onScrollEnd":i!=null&&we("scrollend",e);break;case"onClick":i!=null&&(e.onclick=xn);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!Ks.hasOwnProperty(l))e:{if(l[0]==="o"&&l[1]==="n"&&(o=l.endsWith("Capture"),t=l.slice(2,o?l.length-7:void 0),c=e[zt]||null,c=c!=null?c[l]:null,typeof c=="function"&&e.removeEventListener(t,c,o),typeof i=="function")){typeof c!="function"&&c!==null&&(l in e?e[l]=null:e.hasAttribute(l)&&e.removeAttribute(l)),e.addEventListener(t,i,o);break e}l in e?e[l]=i:i===!0?e.setAttribute(l,""):Xa(e,l,i)}}}function pt(e,t,l){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":we("error",e),we("load",e);var i=!1,o=!1,c;for(c in l)if(l.hasOwnProperty(c)){var g=l[c];if(g!=null)switch(c){case"src":i=!0;break;case"srcSet":o=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:qe(e,t,c,g,l,null)}}o&&qe(e,t,"srcSet",l.srcSet,l,null),i&&qe(e,t,"src",l.src,l,null);return;case"input":we("invalid",e);var x=c=g=o=null,A=null,O=null;for(i in l)if(l.hasOwnProperty(i)){var H=l[i];if(H!=null)switch(i){case"name":o=H;break;case"type":g=H;break;case"checked":A=H;break;case"defaultChecked":O=H;break;case"value":c=H;break;case"defaultValue":x=H;break;case"children":case"dangerouslySetInnerHTML":if(H!=null)throw Error(u(137,t));break;default:qe(e,t,i,H,l,null)}}ef(e,c,x,A,O,g,o,!1);return;case"select":we("invalid",e),i=g=c=null;for(o in l)if(l.hasOwnProperty(o)&&(x=l[o],x!=null))switch(o){case"value":c=x;break;case"defaultValue":g=x;break;case"multiple":i=x;default:qe(e,t,o,x,l,null)}t=c,l=g,e.multiple=!!i,t!=null?Gl(e,!!i,t,!1):l!=null&&Gl(e,!!i,l,!0);return;case"textarea":we("invalid",e),c=o=i=null;for(g in l)if(l.hasOwnProperty(g)&&(x=l[g],x!=null))switch(g){case"value":i=x;break;case"defaultValue":o=x;break;case"children":c=x;break;case"dangerouslySetInnerHTML":if(x!=null)throw Error(u(91));break;default:qe(e,t,g,x,l,null)}nf(e,i,o,c);return;case"option":for(A in l)if(l.hasOwnProperty(A)&&(i=l[A],i!=null))switch(A){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:qe(e,t,A,i,l,null)}return;case"dialog":we("beforetoggle",e),we("toggle",e),we("cancel",e),we("close",e);break;case"iframe":case"object":we("load",e);break;case"video":case"audio":for(i=0;i<da.length;i++)we(da[i],e);break;case"image":we("error",e),we("load",e);break;case"details":we("toggle",e);break;case"embed":case"source":case"link":we("error",e),we("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(O in l)if(l.hasOwnProperty(O)&&(i=l[O],i!=null))switch(O){case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:qe(e,t,O,i,l,null)}return;default:if(_u(t)){for(H in l)l.hasOwnProperty(H)&&(i=l[H],i!==void 0&&yc(e,t,H,i,l,void 0));return}}for(x in l)l.hasOwnProperty(x)&&(i=l[x],i!=null&&qe(e,t,x,i,l,null))}function R1(e,t,l,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var o=null,c=null,g=null,x=null,A=null,O=null,H=null;for(U in l){var G=l[U];if(l.hasOwnProperty(U)&&G!=null)switch(U){case"checked":break;case"value":break;case"defaultValue":A=G;default:i.hasOwnProperty(U)||qe(e,t,U,null,i,G)}}for(var N in i){var U=i[N];if(G=l[N],i.hasOwnProperty(N)&&(U!=null||G!=null))switch(N){case"type":c=U;break;case"name":o=U;break;case"checked":O=U;break;case"defaultChecked":H=U;break;case"value":g=U;break;case"defaultValue":x=U;break;case"children":case"dangerouslySetInnerHTML":if(U!=null)throw Error(u(137,t));break;default:U!==G&&qe(e,t,N,U,i,G)}}zu(e,g,x,A,O,H,c,o);return;case"select":U=g=x=N=null;for(c in l)if(A=l[c],l.hasOwnProperty(c)&&A!=null)switch(c){case"value":break;case"multiple":U=A;default:i.hasOwnProperty(c)||qe(e,t,c,null,i,A)}for(o in i)if(c=i[o],A=l[o],i.hasOwnProperty(o)&&(c!=null||A!=null))switch(o){case"value":N=c;break;case"defaultValue":x=c;break;case"multiple":g=c;default:c!==A&&qe(e,t,o,c,i,A)}t=x,l=g,i=U,N!=null?Gl(e,!!l,N,!1):!!i!=!!l&&(t!=null?Gl(e,!!l,t,!0):Gl(e,!!l,l?[]:"",!1));return;case"textarea":U=N=null;for(x in l)if(o=l[x],l.hasOwnProperty(x)&&o!=null&&!i.hasOwnProperty(x))switch(x){case"value":break;case"children":break;default:qe(e,t,x,null,i,o)}for(g in i)if(o=i[g],c=l[g],i.hasOwnProperty(g)&&(o!=null||c!=null))switch(g){case"value":N=o;break;case"defaultValue":U=o;break;case"children":break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(u(91));break;default:o!==c&&qe(e,t,g,o,i,c)}tf(e,N,U);return;case"option":for(var ie in l)if(N=l[ie],l.hasOwnProperty(ie)&&N!=null&&!i.hasOwnProperty(ie))switch(ie){case"selected":e.selected=!1;break;default:qe(e,t,ie,null,i,N)}for(A in i)if(N=i[A],U=l[A],i.hasOwnProperty(A)&&N!==U&&(N!=null||U!=null))switch(A){case"selected":e.selected=N&&typeof N!="function"&&typeof N!="symbol";break;default:qe(e,t,A,N,i,U)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var de in l)N=l[de],l.hasOwnProperty(de)&&N!=null&&!i.hasOwnProperty(de)&&qe(e,t,de,null,i,N);for(O in i)if(N=i[O],U=l[O],i.hasOwnProperty(O)&&N!==U&&(N!=null||U!=null))switch(O){case"children":case"dangerouslySetInnerHTML":if(N!=null)throw Error(u(137,t));break;default:qe(e,t,O,N,i,U)}return;default:if(_u(t)){for(var Ye in l)N=l[Ye],l.hasOwnProperty(Ye)&&N!==void 0&&!i.hasOwnProperty(Ye)&&yc(e,t,Ye,void 0,i,N);for(H in i)N=i[H],U=l[H],!i.hasOwnProperty(H)||N===U||N===void 0&&U===void 0||yc(e,t,H,N,i,U);return}}for(var D in l)N=l[D],l.hasOwnProperty(D)&&N!=null&&!i.hasOwnProperty(D)&&qe(e,t,D,null,i,N);for(G in i)N=i[G],U=l[G],!i.hasOwnProperty(G)||N===U||N==null&&U==null||qe(e,t,G,N,i,U)}function rp(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function N1(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,l=performance.getEntriesByType("resource"),i=0;i<l.length;i++){var o=l[i],c=o.transferSize,g=o.initiatorType,x=o.duration;if(c&&x&&rp(g)){for(g=0,x=o.responseEnd,i+=1;i<l.length;i++){var A=l[i],O=A.startTime;if(O>x)break;var H=A.transferSize,G=A.initiatorType;H&&rp(G)&&(A=A.responseEnd,g+=H*(A<x?1:(x-O)/(A-O)))}if(--i,t+=8*(c+g)/(o.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var bc=null,vc=null;function Vr(e){return e.nodeType===9?e:e.ownerDocument}function up(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function op(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function xc(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Sc=null;function L1(){var e=window.event;return e&&e.type==="popstate"?e===Sc?!1:(Sc=e,!0):(Sc=null,!1)}var cp=typeof setTimeout=="function"?setTimeout:void 0,U1=typeof clearTimeout=="function"?clearTimeout:void 0,sp=typeof Promise=="function"?Promise:void 0,j1=typeof queueMicrotask=="function"?queueMicrotask:typeof sp<"u"?function(e){return sp.resolve(null).then(e).catch(B1)}:cp;function B1(e){setTimeout(function(){throw e})}function ll(e){return e==="head"}function fp(e,t){var l=t,i=0;do{var o=l.nextSibling;if(e.removeChild(l),o&&o.nodeType===8)if(l=o.data,l==="/$"||l==="/&"){if(i===0){e.removeChild(o),Si(t);return}i--}else if(l==="$"||l==="$?"||l==="$~"||l==="$!"||l==="&")i++;else if(l==="html")ma(e.ownerDocument.documentElement);else if(l==="head"){l=e.ownerDocument.head,ma(l);for(var c=l.firstChild;c;){var g=c.nextSibling,x=c.nodeName;c[Ri]||x==="SCRIPT"||x==="STYLE"||x==="LINK"&&c.rel.toLowerCase()==="stylesheet"||l.removeChild(c),c=g}}else l==="body"&&ma(e.ownerDocument.body);l=o}while(l);Si(t)}function hp(e,t){var l=e;e=0;do{var i=l.nextSibling;if(l.nodeType===1?t?(l._stashedDisplay=l.style.display,l.style.display="none"):(l.style.display=l._stashedDisplay||"",l.getAttribute("style")===""&&l.removeAttribute("style")):l.nodeType===3&&(t?(l._stashedText=l.nodeValue,l.nodeValue=""):l.nodeValue=l._stashedText||""),i&&i.nodeType===8)if(l=i.data,l==="/$"){if(e===0)break;e--}else l!=="$"&&l!=="$?"&&l!=="$~"&&l!=="$!"||e++;l=i}while(l)}function Ec(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var l=t;switch(t=t.nextSibling,l.nodeName){case"HTML":case"HEAD":case"BODY":Ec(l),wu(l);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(l.rel.toLowerCase()==="stylesheet")continue}e.removeChild(l)}}function H1(e,t,l,i){for(;e.nodeType===1;){var o=l;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[Ri])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(c=e.getAttribute("rel"),c==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(c!==o.rel||e.getAttribute("href")!==(o.href==null||o.href===""?null:o.href)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin)||e.getAttribute("title")!==(o.title==null?null:o.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(c=e.getAttribute("src"),(c!==(o.src==null?null:o.src)||e.getAttribute("type")!==(o.type==null?null:o.type)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin))&&c&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var c=o.name==null?null:""+o.name;if(o.type==="hidden"&&e.getAttribute("name")===c)return e}else return e;if(e=tn(e.nextSibling),e===null)break}return null}function q1(e,t,l){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!l||(e=tn(e.nextSibling),e===null))return null;return e}function dp(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=tn(e.nextSibling),e===null))return null;return e}function kc(e){return e.data==="$?"||e.data==="$~"}function Ac(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function Y1(e,t){var l=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||l.readyState!=="loading")t();else{var i=function(){t(),l.removeEventListener("DOMContentLoaded",i)};l.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function tn(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var Tc=null;function pp(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="/$"||l==="/&"){if(t===0)return tn(e.nextSibling);t--}else l!=="$"&&l!=="$!"&&l!=="$?"&&l!=="$~"&&l!=="&"||t++}e=e.nextSibling}return null}function mp(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="$"||l==="$!"||l==="$?"||l==="$~"||l==="&"){if(t===0)return e;t--}else l!=="/$"&&l!=="/&"||t++}e=e.previousSibling}return null}function gp(e,t,l){switch(t=Vr(l),e){case"html":if(e=t.documentElement,!e)throw Error(u(452));return e;case"head":if(e=t.head,!e)throw Error(u(453));return e;case"body":if(e=t.body,!e)throw Error(u(454));return e;default:throw Error(u(451))}}function ma(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);wu(e)}var nn=new Map,yp=new Set;function Gr(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Un=F.d;F.d={f:V1,r:G1,D:X1,C:Q1,L:Z1,m:F1,X:K1,S:I1,M:J1};function V1(){var e=Un.f(),t=Nr();return e||t}function G1(e){var t=ql(e);t!==null&&t.tag===5&&t.type==="form"?Nh(t):Un.r(e)}var bi=typeof document>"u"?null:document;function bp(e,t,l){var i=bi;if(i&&typeof t=="string"&&t){var o=It(t);o=\'link[rel="\'+e+\'"][href="\'+o+\'"]\',typeof l=="string"&&(o+=\'[crossorigin="\'+l+\'"]\'),yp.has(o)||(yp.add(o),e={rel:e,crossOrigin:l,href:t},i.querySelector(o)===null&&(t=i.createElement("link"),pt(t,"link",e),ot(t),i.head.appendChild(t)))}}function X1(e){Un.D(e),bp("dns-prefetch",e,null)}function Q1(e,t){Un.C(e,t),bp("preconnect",e,t)}function Z1(e,t,l){Un.L(e,t,l);var i=bi;if(i&&e&&t){var o=\'link[rel="preload"][as="\'+It(t)+\'"]\';t==="image"&&l&&l.imageSrcSet?(o+=\'[imagesrcset="\'+It(l.imageSrcSet)+\'"]\',typeof l.imageSizes=="string"&&(o+=\'[imagesizes="\'+It(l.imageSizes)+\'"]\')):o+=\'[href="\'+It(e)+\'"]\';var c=o;switch(t){case"style":c=vi(e);break;case"script":c=xi(e)}nn.has(c)||(e=y({rel:"preload",href:t==="image"&&l&&l.imageSrcSet?void 0:e,as:t},l),nn.set(c,e),i.querySelector(o)!==null||t==="style"&&i.querySelector(ga(c))||t==="script"&&i.querySelector(ya(c))||(t=i.createElement("link"),pt(t,"link",e),ot(t),i.head.appendChild(t)))}}function F1(e,t){Un.m(e,t);var l=bi;if(l&&e){var i=t&&typeof t.as=="string"?t.as:"script",o=\'link[rel="modulepreload"][as="\'+It(i)+\'"][href="\'+It(e)+\'"]\',c=o;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":c=xi(e)}if(!nn.has(c)&&(e=y({rel:"modulepreload",href:e},t),nn.set(c,e),l.querySelector(o)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(l.querySelector(ya(c)))return}i=l.createElement("link"),pt(i,"link",e),ot(i),l.head.appendChild(i)}}}function I1(e,t,l){Un.S(e,t,l);var i=bi;if(i&&e){var o=Yl(i).hoistableStyles,c=vi(e);t=t||"default";var g=o.get(c);if(!g){var x={loading:0,preload:null};if(g=i.querySelector(ga(c)))x.loading=5;else{e=y({rel:"stylesheet",href:e,"data-precedence":t},l),(l=nn.get(c))&&wc(e,l);var A=g=i.createElement("link");ot(A),pt(A,"link",e),A._p=new Promise(function(O,H){A.onload=O,A.onerror=H}),A.addEventListener("load",function(){x.loading|=1}),A.addEventListener("error",function(){x.loading|=2}),x.loading|=4,Xr(g,t,i)}g={type:"stylesheet",instance:g,count:1,state:x},o.set(c,g)}}}function K1(e,t){Un.X(e,t);var l=bi;if(l&&e){var i=Yl(l).hoistableScripts,o=xi(e),c=i.get(o);c||(c=l.querySelector(ya(o)),c||(e=y({src:e,async:!0},t),(t=nn.get(o))&&Cc(e,t),c=l.createElement("script"),ot(c),pt(c,"link",e),l.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},i.set(o,c))}}function J1(e,t){Un.M(e,t);var l=bi;if(l&&e){var i=Yl(l).hoistableScripts,o=xi(e),c=i.get(o);c||(c=l.querySelector(ya(o)),c||(e=y({src:e,async:!0,type:"module"},t),(t=nn.get(o))&&Cc(e,t),c=l.createElement("script"),ot(c),pt(c,"link",e),l.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},i.set(o,c))}}function vp(e,t,l,i){var o=(o=Z.current)?Gr(o):null;if(!o)throw Error(u(446));switch(e){case"meta":case"title":return null;case"style":return typeof l.precedence=="string"&&typeof l.href=="string"?(t=vi(l.href),l=Yl(o).hoistableStyles,i=l.get(t),i||(i={type:"style",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(l.rel==="stylesheet"&&typeof l.href=="string"&&typeof l.precedence=="string"){e=vi(l.href);var c=Yl(o).hoistableStyles,g=c.get(e);if(g||(o=o.ownerDocument||o,g={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},c.set(e,g),(c=o.querySelector(ga(e)))&&!c._p&&(g.instance=c,g.state.loading=5),nn.has(e)||(l={rel:"preload",as:"style",href:l.href,crossOrigin:l.crossOrigin,integrity:l.integrity,media:l.media,hrefLang:l.hrefLang,referrerPolicy:l.referrerPolicy},nn.set(e,l),c||$1(o,e,l,g.state))),t&&i===null)throw Error(u(528,""));return g}if(t&&i!==null)throw Error(u(529,""));return null;case"script":return t=l.async,l=l.src,typeof l=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=xi(l),l=Yl(o).hoistableScripts,i=l.get(t),i||(i={type:"script",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(u(444,e))}}function vi(e){return\'href="\'+It(e)+\'"\'}function ga(e){return\'link[rel="stylesheet"][\'+e+"]"}function xp(e){return y({},e,{"data-precedence":e.precedence,precedence:null})}function $1(e,t,l,i){e.querySelector(\'link[rel="preload"][as="style"][\'+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),pt(t,"link",l),ot(t),e.head.appendChild(t))}function xi(e){return\'[src="\'+It(e)+\'"]\'}function ya(e){return"script[async]"+e}function Sp(e,t,l){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector(\'style[data-href~="\'+It(l.href)+\'"]\');if(i)return t.instance=i,ot(i),i;var o=y({},l,{"data-href":l.href,"data-precedence":l.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),ot(i),pt(i,"style",o),Xr(i,l.precedence,e),t.instance=i;case"stylesheet":o=vi(l.href);var c=e.querySelector(ga(o));if(c)return t.state.loading|=4,t.instance=c,ot(c),c;i=xp(l),(o=nn.get(o))&&wc(i,o),c=(e.ownerDocument||e).createElement("link"),ot(c);var g=c;return g._p=new Promise(function(x,A){g.onload=x,g.onerror=A}),pt(c,"link",i),t.state.loading|=4,Xr(c,l.precedence,e),t.instance=c;case"script":return c=xi(l.src),(o=e.querySelector(ya(c)))?(t.instance=o,ot(o),o):(i=l,(o=nn.get(c))&&(i=y({},l),Cc(i,o)),e=e.ownerDocument||e,o=e.createElement("script"),ot(o),pt(o,"link",i),e.head.appendChild(o),t.instance=o);case"void":return null;default:throw Error(u(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,Xr(i,l.precedence,e));return t.instance}function Xr(e,t,l){for(var i=l.querySelectorAll(\'link[rel="stylesheet"][data-precedence],style[data-precedence]\'),o=i.length?i[i.length-1]:null,c=o,g=0;g<i.length;g++){var x=i[g];if(x.dataset.precedence===t)c=x;else if(c!==o)break}c?c.parentNode.insertBefore(e,c.nextSibling):(t=l.nodeType===9?l.head:l,t.insertBefore(e,t.firstChild))}function wc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function Cc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Qr=null;function Ep(e,t,l){if(Qr===null){var i=new Map,o=Qr=new Map;o.set(l,i)}else o=Qr,i=o.get(l),i||(i=new Map,o.set(l,i));if(i.has(e))return i;for(i.set(e,null),l=l.getElementsByTagName(e),o=0;o<l.length;o++){var c=l[o];if(!(c[Ri]||c[st]||e==="link"&&c.getAttribute("rel")==="stylesheet")&&c.namespaceURI!=="http://www.w3.org/2000/svg"){var g=c.getAttribute(t)||"";g=e+g;var x=i.get(g);x?x.push(c):i.set(g,[c])}}return i}function kp(e,t,l){e=e.ownerDocument||e,e.head.insertBefore(l,t==="title"?e.querySelector("head > title"):null)}function W1(e,t,l){if(l===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function Ap(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function P1(e,t,l,i){if(l.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(l.state.loading&4)===0){if(l.instance===null){var o=vi(i.href),c=t.querySelector(ga(o));if(c){t=c._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Zr.bind(e),t.then(e,e)),l.state.loading|=4,l.instance=c,ot(c);return}c=t.ownerDocument||t,i=xp(i),(o=nn.get(o))&&wc(i,o),c=c.createElement("link"),ot(c);var g=c;g._p=new Promise(function(x,A){g.onload=x,g.onerror=A}),pt(c,"link",i),l.instance=c}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(l,t),(t=l.state.preload)&&(l.state.loading&3)===0&&(e.count++,l=Zr.bind(e),t.addEventListener("load",l),t.addEventListener("error",l))}}var zc=0;function e0(e,t){return e.stylesheets&&e.count===0&&Ir(e,e.stylesheets),0<e.count||0<e.imgCount?function(l){var i=setTimeout(function(){if(e.stylesheets&&Ir(e,e.stylesheets),e.unsuspend){var c=e.unsuspend;e.unsuspend=null,c()}},6e4+t);0<e.imgBytes&&zc===0&&(zc=62500*N1());var o=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Ir(e,e.stylesheets),e.unsuspend)){var c=e.unsuspend;e.unsuspend=null,c()}},(e.imgBytes>zc?50:800)+t);return e.unsuspend=l,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(o)}}:null}function Zr(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Ir(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Fr=null;function Ir(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Fr=new Map,t.forEach(t0,e),Fr=null,Zr.call(e))}function t0(e,t){if(!(t.state.loading&4)){var l=Fr.get(e);if(l)var i=l.get(null);else{l=new Map,Fr.set(e,l);for(var o=e.querySelectorAll("link[data-precedence],style[data-precedence]"),c=0;c<o.length;c++){var g=o[c];(g.nodeName==="LINK"||g.getAttribute("media")!=="not all")&&(l.set(g.dataset.precedence,g),i=g)}i&&l.set(null,i)}o=t.instance,g=o.getAttribute("data-precedence"),c=l.get(g)||i,c===i&&l.set(null,o),l.set(g,o),this.count++,i=Zr.bind(this),o.addEventListener("load",i),o.addEventListener("error",i),c?c.parentNode.insertBefore(o,c.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(o,e.firstChild)),t.state.loading|=4}}var ba={$$typeof:X,Provider:null,Consumer:null,_currentValue:re,_currentValue2:re,_threadCount:0};function n0(e,t,l,i,o,c,g,x,A){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Eu(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Eu(0),this.hiddenUpdates=Eu(null),this.identifierPrefix=i,this.onUncaughtError=o,this.onCaughtError=c,this.onRecoverableError=g,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=A,this.incompleteTransitions=new Map}function Tp(e,t,l,i,o,c,g,x,A,O,H,G){return e=new n0(e,t,l,g,A,O,H,G,x),t=1,c===!0&&(t|=24),c=Ht(3,null,null,t),e.current=c,c.stateNode=e,t=ro(),t.refCount++,e.pooledCache=t,t.refCount++,c.memoizedState={element:i,isDehydrated:l,cache:t},so(c),e}function wp(e){return e?(e=$l,e):$l}function Cp(e,t,l,i,o,c){o=wp(o),i.context===null?i.context=o:i.pendingContext=o,i=Zn(t),i.payload={element:l},c=c===void 0?null:c,c!==null&&(i.callback=c),l=Fn(e,i,t),l!==null&&(Nt(l,e,t),Ji(l,e,t))}function zp(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var l=e.retryLane;e.retryLane=l!==0&&l<t?l:t}}function Dc(e,t){zp(e,t),(e=e.alternate)&&zp(e,t)}function Dp(e){if(e.tag===13||e.tag===31){var t=gl(e,67108864);t!==null&&Nt(t,e,67108864),Dc(e,67108864)}}function _p(e){if(e.tag===13||e.tag===31){var t=Xt();t=ku(t);var l=gl(e,t);l!==null&&Nt(l,e,t),Dc(e,t)}}var Kr=!0;function l0(e,t,l,i){var o=M.T;M.T=null;var c=F.p;try{F.p=2,_c(e,t,l,i)}finally{F.p=c,M.T=o}}function i0(e,t,l,i){var o=M.T;M.T=null;var c=F.p;try{F.p=8,_c(e,t,l,i)}finally{F.p=c,M.T=o}}function _c(e,t,l,i){if(Kr){var o=Oc(i);if(o===null)gc(e,t,i,Jr,l),Mp(e,i);else if(r0(o,e,t,l,i))i.stopPropagation();else if(Mp(e,i),t&4&&-1<a0.indexOf(e)){for(;o!==null;){var c=ql(o);if(c!==null)switch(c.tag){case 3:if(c=c.stateNode,c.current.memoizedState.isDehydrated){var g=fl(c.pendingLanes);if(g!==0){var x=c;for(x.pendingLanes|=2,x.entangledLanes|=2;g;){var A=1<<31-Ve(g);x.entanglements[1]|=A,g&=~A}dn(c),(Ne&6)===0&&(Mr=St()+500,ha(0))}}break;case 31:case 13:x=gl(c,2),x!==null&&Nt(x,c,2),Nr(),Dc(c,2)}if(c=Oc(i),c===null&&gc(e,t,i,Jr,l),c===o)break;o=c}o!==null&&i.stopPropagation()}else gc(e,t,i,null,l)}}function Oc(e){return e=Mu(e),Mc(e)}var Jr=null;function Mc(e){if(Jr=null,e=Hl(e),e!==null){var t=h(e);if(t===null)e=null;else{var l=t.tag;if(l===13){if(e=f(t),e!==null)return e;e=null}else if(l===31){if(e=d(t),e!==null)return e;e=null}else if(l===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Jr=e,null}function Op(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(Su()){case Y:return 2;case P:return 8;case me:case Ae:return 32;case Le:return 268435456;default:return 32}default:return 32}}var Rc=!1,il=null,al=null,rl=null,va=new Map,xa=new Map,ul=[],a0="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function Mp(e,t){switch(e){case"focusin":case"focusout":il=null;break;case"dragenter":case"dragleave":al=null;break;case"mouseover":case"mouseout":rl=null;break;case"pointerover":case"pointerout":va.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":xa.delete(t.pointerId)}}function Sa(e,t,l,i,o,c){return e===null||e.nativeEvent!==c?(e={blockedOn:t,domEventName:l,eventSystemFlags:i,nativeEvent:c,targetContainers:[o]},t!==null&&(t=ql(t),t!==null&&Dp(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function r0(e,t,l,i,o){switch(t){case"focusin":return il=Sa(il,e,t,l,i,o),!0;case"dragenter":return al=Sa(al,e,t,l,i,o),!0;case"mouseover":return rl=Sa(rl,e,t,l,i,o),!0;case"pointerover":var c=o.pointerId;return va.set(c,Sa(va.get(c)||null,e,t,l,i,o)),!0;case"gotpointercapture":return c=o.pointerId,xa.set(c,Sa(xa.get(c)||null,e,t,l,i,o)),!0}return!1}function Rp(e){var t=Hl(e.target);if(t!==null){var l=h(t);if(l!==null){if(t=l.tag,t===13){if(t=f(l),t!==null){e.blockedOn=t,Zs(e.priority,function(){_p(l)});return}}else if(t===31){if(t=d(l),t!==null){e.blockedOn=t,Zs(e.priority,function(){_p(l)});return}}else if(t===3&&l.stateNode.current.memoizedState.isDehydrated){e.blockedOn=l.tag===3?l.stateNode.containerInfo:null;return}}}e.blockedOn=null}function $r(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var l=Oc(e.nativeEvent);if(l===null){l=e.nativeEvent;var i=new l.constructor(l.type,l);Ou=i,l.target.dispatchEvent(i),Ou=null}else return t=ql(l),t!==null&&Dp(t),e.blockedOn=l,!1;t.shift()}return!0}function Np(e,t,l){$r(e)&&l.delete(t)}function u0(){Rc=!1,il!==null&&$r(il)&&(il=null),al!==null&&$r(al)&&(al=null),rl!==null&&$r(rl)&&(rl=null),va.forEach(Np),xa.forEach(Np)}function Wr(e,t){e.blockedOn===t&&(e.blockedOn=null,Rc||(Rc=!0,n.unstable_scheduleCallback(n.unstable_NormalPriority,u0)))}var Pr=null;function Lp(e){Pr!==e&&(Pr=e,n.unstable_scheduleCallback(n.unstable_NormalPriority,function(){Pr===e&&(Pr=null);for(var t=0;t<e.length;t+=3){var l=e[t],i=e[t+1],o=e[t+2];if(typeof i!="function"){if(Mc(i||l)===null)continue;break}var c=ql(l);c!==null&&(e.splice(t,3),t-=3,Oo(c,{pending:!0,data:o,method:l.method,action:i},i,o))}}))}function Si(e){function t(A){return Wr(A,e)}il!==null&&Wr(il,e),al!==null&&Wr(al,e),rl!==null&&Wr(rl,e),va.forEach(t),xa.forEach(t);for(var l=0;l<ul.length;l++){var i=ul[l];i.blockedOn===e&&(i.blockedOn=null)}for(;0<ul.length&&(l=ul[0],l.blockedOn===null);)Rp(l),l.blockedOn===null&&ul.shift();if(l=(e.ownerDocument||e).$$reactFormReplay,l!=null)for(i=0;i<l.length;i+=3){var o=l[i],c=l[i+1],g=o[zt]||null;if(typeof c=="function")g||Lp(l);else if(g){var x=null;if(c&&c.hasAttribute("formAction")){if(o=c,g=c[zt]||null)x=g.formAction;else if(Mc(o)!==null)continue}else x=g.action;typeof x=="function"?l[i+1]=x:(l.splice(i,3),i-=3),Lp(l)}}}function Up(){function e(c){c.canIntercept&&c.info==="react-transition"&&c.intercept({handler:function(){return new Promise(function(g){return o=g})},focusReset:"manual",scroll:"manual"})}function t(){o!==null&&(o(),o=null),i||setTimeout(l,20)}function l(){if(!i&&!navigation.transition){var c=navigation.currentEntry;c&&c.url!=null&&navigation.navigate(c.url,{state:c.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,o=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(l,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),o!==null&&(o(),o=null)}}}function Nc(e){this._internalRoot=e}eu.prototype.render=Nc.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(u(409));var l=t.current,i=Xt();Cp(l,i,e,t,null,null)},eu.prototype.unmount=Nc.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Cp(e.current,2,null,e,null,null),Nr(),t[Bl]=null}};function eu(e){this._internalRoot=e}eu.prototype.unstable_scheduleHydration=function(e){if(e){var t=Qs();e={blockedOn:null,target:e,priority:t};for(var l=0;l<ul.length&&t!==0&&t<ul[l].priority;l++);ul.splice(l,0,e),l===0&&Rp(e)}};var jp=a.version;if(jp!=="19.2.6")throw Error(u(527,jp,"19.2.6"));F.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(u(188)):(e=Object.keys(e).join(","),Error(u(268,e)));return e=p(t),e=e!==null?b(e):null,e=e===null?null:e.stateNode,e};var o0={bundleType:0,version:"19.2.6",rendererPackageName:"react-dom",currentDispatcherRef:M,reconcilerVersion:"19.2.6"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var tu=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!tu.isDisabled&&tu.supportsFiber)try{Et=tu.inject(o0),rt=tu}catch{}}return ka.createRoot=function(e,t){if(!s(e))throw Error(u(299));var l=!1,i="",o=Xh,c=Qh,g=Zh;return t!=null&&(t.unstable_strictMode===!0&&(l=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(c=t.onCaughtError),t.onRecoverableError!==void 0&&(g=t.onRecoverableError)),t=Tp(e,1,!1,null,null,l,i,null,o,c,g,Up),e[Bl]=t.current,mc(e),new Nc(t)},ka.hydrateRoot=function(e,t,l){if(!s(e))throw Error(u(299));var i=!1,o="",c=Xh,g=Qh,x=Zh,A=null;return l!=null&&(l.unstable_strictMode===!0&&(i=!0),l.identifierPrefix!==void 0&&(o=l.identifierPrefix),l.onUncaughtError!==void 0&&(c=l.onUncaughtError),l.onCaughtError!==void 0&&(g=l.onCaughtError),l.onRecoverableError!==void 0&&(x=l.onRecoverableError),l.formState!==void 0&&(A=l.formState)),t=Tp(e,1,!0,t,l??null,i,o,A,c,g,x,Up),t.context=wp(null),l=t.current,i=Xt(),i=ku(i),o=Zn(i),o.callback=null,Fn(l,o,i),l=i,t.current.lanes=l,Mi(t,l),dn(t),e[Bl]=t.current,mc(e),new eu(t)},ka.version="19.2.6",ka}var Fp;function b0(){if(Fp)return jc.exports;Fp=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),jc.exports=y0(),jc.exports}var v0=b0();function x0(){return I.jsxs("main",{className:"duplicate-page",children:[I.jsxs("svg",{width:"48",height:"48",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:[I.jsx("circle",{cx:"12",cy:"12",r:"10"}),I.jsx("path",{d:"m4.9 4.9 14.2 14.2"})]}),I.jsx("h1",{children:"Session unavailable"}),I.jsx("p",{children:"Another browser window is already connected to this Voice Agent. Close the other session and refresh this page."})]})}const Ip=n=>Symbol.iterator in n,Kp=n=>"entries"in n,Jp=(n,a)=>{const r=n instanceof Map?n:new Map(n.entries()),u=a instanceof Map?a:new Map(a.entries());if(r.size!==u.size)return!1;for(const[s,h]of r)if(!u.has(s)||!Object.is(h,u.get(s)))return!1;return!0},S0=(n,a)=>{const r=n[Symbol.iterator](),u=a[Symbol.iterator]();let s=r.next(),h=u.next();for(;!s.done&&!h.done;){if(!Object.is(s.value,h.value))return!1;s=r.next(),h=u.next()}return!!s.done&&!!h.done};function E0(n,a){return Object.is(n,a)?!0:typeof n!="object"||n===null||typeof a!="object"||a===null||Object.getPrototypeOf(n)!==Object.getPrototypeOf(a)?!1:Ip(n)&&Ip(a)?Kp(n)&&Kp(a)?Jp(n,a):S0(n,a):Jp({entries:()=>Object.entries(n)},{entries:()=>Object.entries(a)})}function Ss(n){const a=za.useRef(void 0);return r=>{const u=n(r);return E0(a.current,u)?a.current:a.current=u}}const $p=n=>{let a;const r=new Set,u=(p,b)=>{const y=typeof p=="function"?p(a):p;if(!Object.is(y,a)){const E=a;a=b??(typeof y!="object"||y===null)?y:Object.assign({},a,y),r.forEach(S=>S(a,E))}},s=()=>a,d={setState:u,getState:s,getInitialState:()=>m,subscribe:p=>(r.add(p),()=>r.delete(p))},m=a=n(u,s,d);return d},k0=(n=>n?$p(n):$p),A0=n=>n;function T0(n,a=A0){const r=za.useSyncExternalStore(n.subscribe,za.useCallback(()=>a(n.getState()),[n,a]),za.useCallback(()=>a(n.getInitialState()),[n,a]));return za.useDebugValue(r),r}const w0=(n,a)=>(r,u,s)=>(s.dispatch=h=>(r(f=>n(f,h),!1,h),h),s.dispatchFromDevtools=!0,{dispatch:(...h)=>s.dispatch(...h),...a}),C0=w0,z0={permission:"unknown",devices:[],selectedDeviceId:null,ready:!1,autoplayAllowed:null,pendingSessionStart:!1};function D0(n,a){switch(a.type){case"browser/autoplay/probed":return{...n,autoplayAllowed:a.allowed,pendingSessionStart:!1};case"browser/devices/enumerated":return{...n,devices:a.devices};case"host/browser-audio/device-change":return{...n,devices:a.devices,selectedDeviceId:a.selectedDeviceId};case"ui/select/mic-device":return n.selectedDeviceId===a.deviceId?n:{...n,selectedDeviceId:a.deviceId};case"browser/permission/granted":return{...n,permission:"granted",ready:!0};case"browser/permission/denied":return{...n,permission:"denied"};case"browser/mic/stream-failed":return{...n,permission:"denied",ready:!1};case"host/voice/session/start":return n.autoplayAllowed===!0||n.pendingSessionStart?n:{...n,pendingSessionStart:!0};case"voice/session/in-flight":return!a.inFlight||!n.pendingSessionStart?n:{...n,pendingSessionStart:!1};default:return n}}const _0={status:"connecting",reconnectMs:250};function O0(n,a){switch(a.type){case"connection/status":return n.status===a.status?n:{...n,status:a.status};default:return n}}const M0={status:"starting",conversation:null,instructions:void 0,streamDrafts:new Map,atBottom:!0,previousConversationId:null};function R0(n,a){switch(a.type){case"host/state":{const r=a.data.conversation??null,u=r?.status??n.status,s=r?.id??null;return s!==n.previousConversationId?{...n,status:u,conversation:r,instructions:a.data.instructions,streamDrafts:new Map,atBottom:!0,previousConversationId:s}:{...n,status:u,conversation:r,instructions:a.data.instructions}}case"host/transcript/delta":{const r=new Map(n.streamDrafts);return r.set(a.delta.itemId,a.delta),{...n,streamDrafts:r}}case"ui/scroll/transcript":return n.atBottom===a.atBottom?n:{...n,atBottom:a.atBottom};default:return n}}const N0={modal:"none",moreActionsOpen:!1,duplicateClient:!1};function L0(n,a){switch(a.type){case"ui/click/transcript":return{...n,modal:"transcript",moreActionsOpen:!1};case"ui/click/instructions":return{...n,modal:"instructions",moreActionsOpen:!1};case"ui/click/modal-backdrop":case"ui/click/modal-close":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/key/escape":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/click/more-actions":return{...n,moreActionsOpen:!n.moreActionsOpen};case"host/duplicate-client":return n.duplicateClient?n:{...n,duplicateClient:!0};default:return n}}const U0={xaiOpen:!1,connectedSent:!1,sessionInFlight:!1,paused:!1,responseActive:!1,speakingItemId:null,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};function j0(n,a){switch(a.type){case"xai/ws/open":return{...n,xaiOpen:!0};case"xai/ws/close":return{...n,xaiOpen:!1,responseActive:!1,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};case"xai/response/created":return{...n,responseActive:!0,speakingItemId:null};case"xai/response/done":case"xai/response/failed":return{...n,responseActive:!1};case"xai/response/cancelled":return{...n,responseActive:!1,speakingItemId:null};case"xai/input-audio-buffer/speech-started":return{...n,speakingItemId:a.itemId||null};case"xai/input-audio-buffer/speech-stopped":case"xai/conversation/item/added":return n.speakingItemId===null?n:{...n,speakingItemId:null};case"xai/response/output-item/added":return{...n,speakingItemId:a.itemId};case"voice/session/in-flight":return n.sessionInFlight===a.inFlight?n:{...n,sessionInFlight:a.inFlight};case"voice/paused":return n.paused===a.paused?n:{...n,paused:a.paused};case"voice/playback/cursor":return{...n,nextPlaybackTime:a.nextPlaybackTime,playbackEndsAt:a.playbackEndsAt};case"voice/playback/cut":return{...n,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};case"host/voice/send":return a.gate!=="playback-drained"?n:{...n,deferredSendsPending:!0};case"voice/playback/drained":return n.deferredSendsPending?{...n,deferredSendsPending:!1}:n;default:return n}}const B0={connection:_0,conversation:M0,audio:z0,voice:U0,ui:N0};function H0(n,a){const r=O0(n.connection,a),u=R0(n.conversation,a),s=D0(n.audio,a),h=j0(n.voice,a),f=L0(n.ui,a);return r===n.connection&&u===n.conversation&&s===n.audio&&h===n.voice&&f===n.ui?n:{connection:r,conversation:u,audio:s,voice:h,ui:f}}const Es=k0(C0(H0,B0));function q0(){return Es.getState()}function bt(n){return T0(Es,n)}const uu=[],Wp=[];let Yc=!1;function yt(n){if(Yc){Wp.push(n);return}Yc=!0;try{let a=n;for(;a!==void 0;){Es.dispatch(a);for(const r of uu)r(a);a=Wp.shift()}}finally{Yc=!1}}function Y0(n){return uu.push(n),()=>{const a=uu.indexOf(n);a!==-1&&uu.splice(a,1)}}let Ti,_l;async function V0(){return navigator.mediaDevices?.enumerateDevices?(await navigator.mediaDevices.enumerateDevices()).filter(a=>a.kind==="audioinput").map(a=>({deviceId:a.deviceId,label:a.label||"Microphone",groupId:a.groupId})):[]}function Vc(n,a){if(Ti&&_l&&Ti.removeEventListener("ended",_l),Ti=n,_l=void 0,!n)return;const r=()=>{a({type:"browser/mic/track-ended"})};_l=r,n.addEventListener("ended",r)}function G0({dispatch:n}){const a=()=>{V0().then(r=>{n({type:"browser/devices/enumerated",devices:r})}).catch(r=>{n({type:"browser/window/error",message:`devicechange enumerate failed: ${String(r instanceof Error?r.message:r)}`})})};return navigator.mediaDevices?.addEventListener?.("devicechange",a),()=>{navigator.mediaDevices?.removeEventListener?.("devicechange",a),Ti&&_l&&Ti.removeEventListener("ended",_l),Ti=void 0,_l=void 0}}let mn,nu=250;const rs=[],X0=new Set(["xai/response/output-audio/delta"]);let us;function Q0(){return`${location.protocol==="https:"?"wss:":"ws:"}//${location.host}/ws`}function At(n,a){const r=JSON.stringify({type:n,data:a});if(n==="browser.debug"){mn&&mn.readyState===WebSocket.OPEN?mn.send(r):rs.push(r);return}mn&&mn.readyState===WebSocket.OPEN&&mn.send(r)}function Z0(n){switch(n.type){case"duplicate.client":return[{type:"host/duplicate-client"}];case"state":return[{type:"host/state",data:n.data}];case"transcript.item":return[{type:"host/transcript/item",item:n.data}];case"transcript.delta":return[{type:"host/transcript/delta",delta:n.data}];case"browser.audio.deviceChange":return[{type:"host/browser-audio/device-change",devices:n.data.devices.map(a=>({deviceId:a.deviceId,label:a.label,groupId:a.groupId})),selectedDeviceId:n.data.selectedDeviceId??null}];case"voice.session.start":return[{type:"host/voice/session/start"}];case"voice.session.token":return[{type:"host/voice/session/token",token:n.data}];case"voice.session.close":return[{type:"host/voice/session/close",code:n.data.code,reason:n.data.reason}];case"voice.send":return[{type:"host/voice/send",event:n.data.event,gate:n.data.gate}];case"wait_for_context.start":return[{type:"host/wait-for-context/start"}];case"wait_for_context.end":return[{type:"host/wait-for-context/end"}];case"audio.output.delta":return[];case"error":return[];default:return[]}}function F0({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,s;const h=()=>{n({type:"connection/status",status:"connecting"});const d=new WebSocket(Q0());mn=d,d.addEventListener("open",()=>{nu=250;const m=[];for(const p of rs)try{d.send(p)}catch(b){m.push(String(b instanceof Error?b.message:b))}rs.length=0,n({type:"connection/status",status:"connected"});for(const p of m)n({type:"browser/window/error",message:`debugBuffer.flush.failed: ${p}`})}),d.addEventListener("message",m=>{let p;try{p=JSON.parse(String(m.data))}catch(b){n({type:"browser/window/error",message:`ws.in.parseError: ${String(b instanceof Error?b.message:b)}`});return}for(const b of Z0(p))n(b)}),d.addEventListener("close",()=>{mn=void 0,n({type:"connection/status",status:"disconnected"}),!u&&(s=setTimeout(h,nu),nu=Math.min(nu*2,5e3))}),d.addEventListener("error",()=>{n({type:"connection/status",status:"error"})})},f=a(d=>{d.type.startsWith("xai/")&&!d.type.startsWith("xai/ws/")&&us!==void 0&&At("voice.event",{event:us}),d.type==="ui/click/download-transcript"&&K0(r),X0.has(d.type)||At("browser.debug",{label:"action",info:d,t:Date.now()})});return h(),()=>{u=!0,f(),s!==void 0&&clearTimeout(s);try{mn?.close()}catch(d){console.error("hostSocketRunner.teardown.close.failed",d)}mn=void 0}}function I0(n){us=n}function K0(n){const a=n().conversation.conversation,r=a?.transcript??[];if(r.length===0)return;const u=`${r.map(p=>JSON.stringify(p)).join(`\n`)}\n`,s=new Blob([u],{type:"application/jsonl"}),h=URL.createObjectURL(s),f=document.createElement("a"),d=new Date().toISOString().replace(/[:.]/g,"-"),m=a?.id??"conversation";f.href=h,f.download=`transcript-${m}-${d}.jsonl`,document.body.append(f),f.click(),f.remove(),URL.revokeObjectURL(h)}const ou=new Float32Array(5),J0=`\n  class Pcm16Encoder extends AudioWorkletProcessor {\n    constructor() { super(); this.buf = []; this.target = 4800; }\n    process(inputs) {\n      const ch = inputs[0] && inputs[0][0];\n      if (!ch) return true;\n      this.buf.push(new Float32Array(ch));\n      let total = 0;\n      for (const b of this.buf) total += b.length;\n      while (total >= this.target) {\n        const out = new Int16Array(this.target);\n        let written = 0;\n        while (written < this.target) {\n          const head = this.buf[0];\n          const take = Math.min(head.length, this.target - written);\n          for (let i = 0; i < take; i++) {\n            const s = Math.max(-1, Math.min(1, head[i]));\n            out[written + i] = s < 0 ? s * 0x8000 : s * 0x7fff;\n          }\n          if (take === head.length) this.buf.shift();\n          else this.buf[0] = head.subarray(take);\n          written += take;\n        }\n        total -= this.target;\n        this.port.postMessage(out.buffer, [out.buffer]);\n      }\n      return true;\n    }\n  }\n  registerProcessor("pcm16-encoder", Pcm16Encoder);\n`,$0=50,W0=500,P0=5e3,eb=3,tb=.01;function Pp(){return{nextPlaybackTime:0,playbackEndsAt:0,scheduledSources:[],pendingSends:[],preOpenAudio:[],deferredSends:[],connectedSent:!1,tokenExpiresAt:0,paused:!1}}function Be(n){return String(n instanceof Error?n.message:n)}function nb({dispatch:n,subscribeToActions:a,getState:r}){let u=Pp(),s=!1,h=0,f,d,m=0,p,b,y;const E=(C,v,j)=>{At("browser.audio.error",{code:C,message:v,suggestedAction:j}),n({type:"browser/mic/stream-failed",error:{code:C,message:v}})},S=C=>{const v={echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0};return C&&(v.deviceId={exact:C}),navigator.mediaDevices.getUserMedia({audio:v})},z=async()=>{if(!navigator.mediaDevices?.getUserMedia)return!1;try{const C=await navigator.mediaDevices.getUserMedia({audio:!0});for(const Z of C.getTracks())Z.stop();const v=(await navigator.mediaDevices.enumerateDevices()).filter(Z=>Z.kind==="audioinput").map(Z=>({deviceId:Z.deviceId,label:Z.label||"Microphone",groupId:Z.groupId})),j=r().audio.selectedDeviceId,$=v.find(Z=>Z.deviceId===j)?.deviceId??v[0]?.deviceId??null;return n({type:"browser/devices/enumerated",devices:v}),$&&n({type:"ui/select/mic-device",deviceId:$}),n({type:"browser/permission/granted"}),At("audio.device.state",{permission:"granted",devices:v,selectedDeviceId:$??void 0,ready:!0}),!0}catch{return E("MICROPHONE_DEVICE_ERROR","Could not access the selected microphone.","Allow microphone access and try again."),n({type:"browser/permission/denied"}),!1}},q=C=>{if(u.analyserCtx)try{u.analyserCtx.close()}catch(le){n({type:"browser/window/error",message:`startMeters.analyserCtx.close.failed: ${Be(le)}`})}const v=new AudioContext;v.state==="suspended"&&v.resume().catch(le=>{n({type:"browser/window/error",message:`startMeters.audioCtx.resume.failed: ${Be(le)}`})});const j=v.createAnalyser();if(j.fftSize=256,v.createMediaStreamSource(C).connect(j),u.analyser=j,u.analyserCtx=v,s)return;s=!0;const $=new Uint8Array(j.frequencyBinCount),Z=()=>{const le=u.analyser;if(le){le.getByteFrequencyData($);for(let ge=0;ge<ou.length;ge+=1)ou[ge]=Math.max(.1,($[ge*10]??0)/255)}h=requestAnimationFrame(Z)};Z()},Q=C=>{const v=atob(C),j=new Uint8Array(v.length);for(let le=0;le<v.length;le+=1)j[le]=v.charCodeAt(le);const $=new DataView(j.buffer),Z=new Float32Array(j.length/2);for(let le=0;le<Z.length;le+=1){const ge=$.getInt16(le*2,!0);Z[le]=ge<0?ge/32768:ge/32767}return Z},R=C=>{let v="";for(let $=0;$<C.length;$+=32768)v+=String.fromCharCode(...C.subarray($,$+32768));return btoa(v)},K=()=>{const C=u.outputCtx,v=u.playbackEndsAt;return!v||!C?!0:C.currentTime>=v-tb},X=()=>{if(!K()){if(u.deferredSends.length===0)return;const C=u.outputCtx,v=C?Math.max(0,(u.playbackEndsAt-C.currentTime+.015)*1e3):50;d!==void 0&&clearTimeout(d),d=setTimeout(X,v);return}d!==void 0&&(clearTimeout(d),d=void 0),u.deferredSends.length!==0&&n({type:"voice/playback/drained"})},oe=C=>{try{const v=Q(C);if(v.length===0)return;let j=u.outputCtx;j||(j=new AudioContext({sampleRate:48e3}),u.outputCtx=j),j.state==="suspended"&&j.resume().catch(Qe=>{n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Be(Qe)}`})});const $=j.createBuffer(1,v.length,48e3);$.getChannelData(0).set(v);const Z=j.createBufferSource();Z.buffer=$,Z.connect(j.destination);const le=j.currentTime,ge=Math.max(le,u.nextPlaybackTime);Z.start(ge);const fe=ge+$.duration;if(u.nextPlaybackTime=fe,u.playbackEndsAt=Math.max(u.playbackEndsAt||0,fe),u.scheduledSources.push(Z),n({type:"voice/playback/cursor",nextPlaybackTime:u.nextPlaybackTime,playbackEndsAt:u.playbackEndsAt}),Z.addEventListener("ended",()=>{const Qe=u.scheduledSources.indexOf(Z);Qe!==-1&&u.scheduledSources.splice(Qe,1),X()}),u.deferredSends.length>0){const Qe=Math.max(0,(u.playbackEndsAt-j.currentTime+.015)*1e3);d!==void 0&&clearTimeout(d),d=setTimeout(X,Qe)}}catch(v){E("AUDIO_DECODE_FAILED",Be(v),"Refresh the page; if the problem persists check audio device permissions.")}},se=()=>{for(const C of u.scheduledSources.splice(0)){try{C.stop()}catch{}try{C.disconnect()}catch(v){n({type:"browser/window/error",message:`stopScheduledPlayback.disconnect.failed: ${Be(v)}`})}}u.nextPlaybackTime=0,u.playbackEndsAt=0},B=async C=>{try{const v=new AudioContext({sampleRate:48e3});u.inputCtx=v,v.state==="suspended"&&v.resume().catch(ge=>n({type:"browser/window/error",message:`inputCtx.resume.failed: ${Be(ge)}`}));const j=v.createMediaStreamSource(C);u.micSourceNode=j;const $=new Blob([J0],{type:"application/javascript"}),Z=URL.createObjectURL($);try{await v.audioWorklet.addModule(Z)}finally{URL.revokeObjectURL(Z)}const le=new AudioWorkletNode(v,"pcm16-encoder");u.workletNode=le,le.port.onmessage=ge=>{if(!u.paused)try{const fe=R(new Uint8Array(ge.data)),Qe=u.xaiWs;Qe&&Qe.readyState===WebSocket.OPEN?Qe.send(JSON.stringify({type:"input_audio_buffer.append",audio:fe})):(u.preOpenAudio.push(fe),u.preOpenAudio.length>$0&&(u.preOpenAudio.shift(),n({type:"voice/queue/pre-open-cap-hit"})))}catch(fe){E("AUDIO_ENCODE_FAILED",Be(fe),"Refresh the page; if the problem persists check microphone permissions.")}},j.connect(le)}catch(v){E("AUDIO_ENCODER_INIT_FAILED",Be(v),"Try a different browser or device.")}},ee=(C,v)=>{At("voice.session.failed",{error:{code:C,message:v}}),k()},pe=()=>{n({type:"voice/session/in-flight",inFlight:!0}),At("conversation.start"),At("voice.session.requested")},ye=()=>{const{voice:C,audio:v}=r();v.autoplayAllowed!==null&&(C.sessionInFlight||C.xaiOpen||u.xaiWs||(n({type:"voice/session/in-flight",inFlight:!0}),At("voice.session.requested")))},L=()=>{const{voice:C,audio:v}=r();if(!C.xaiOpen&&!C.sessionInFlight){if(v.autoplayAllowed===null){n({type:"host/voice/session/start"});return}if(v.autoplayAllowed===!1){z().then(j=>{j&&pe()});return}if(!v.ready){z().then(j=>{j&&pe()});return}pe();return}if(C.xaiOpen&&!C.paused){At("conversation.pause"),W();return}C.xaiOpen&&C.paused&&(At("conversation.resume"),M())},ne=()=>{if(u.xaiWs)return!1;const{voice:C,audio:v}=r();return C.sessionInFlight&&C.xaiOpen?!1:v.ready?!0:(E("MICROPHONE_NOT_READY","Microphone is not ready.","Grant microphone access and try again."),!1)},te=async C=>{if(!C?.clientSecret||!C?.model){ee("VOICE_TOKEN_INVALID","Missing client secret or model.");return}if(!u.xaiWs){if(typeof C.expiresAt=="number"&&Date.now()>C.expiresAt*1e3-P0){if(m+=1,m>eb){m=0,n({type:"connection/status",status:"error"}),n({type:"voice/session/in-flight",inFlight:!1});return}At("voice.session.requested");return}if(m=0,u.tokenExpiresAt=C.expiresAt??0,!(!ne()&&!r().voice.sessionInFlight))try{const v=await S(r().audio.selectedDeviceId);u.micStream=v;const j=v.getAudioTracks()[0];u.micTrack=j,Vc(j,n),j&&n({type:"browser/mic/stream-acquired",deviceId:r().audio.selectedDeviceId??"",trackId:j.id}),q(v),u.preOpenAudio=[],await B(v);const $=lb(C.clientSecret,n),Z=new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(C.model)}`,[`xai-client-secret.${$}`]);u.xaiWs=Z;let le,ge="";Z.addEventListener("open",()=>{n({type:"xai/ws/open"});for(const Fe of u.pendingSends)try{Z.send(Fe)}catch(mt){n({type:"browser/window/error",message:`xaiWs.send.pending.failed: ${Be(mt)}`})}u.pendingSends=[];for(const Fe of u.preOpenAudio)try{Z.send(JSON.stringify({type:"input_audio_buffer.append",audio:Fe}))}catch(mt){n({type:"browser/window/error",message:`xaiWs.send.preOpenAudio.failed: ${Be(mt)}`})}u.preOpenAudio=[],u.connectedSent||(u.connectedSent=!0,n({type:"voice/session/in-flight",inFlight:!1}),At("voice.session.connected"))}),Z.addEventListener("message",Fe=>{let mt;try{mt=JSON.parse(String(Fe.data))}catch(Rl){n({type:"browser/window/error",message:`xaiWs.in.parseError: ${Be(Rl)}`});return}I0(mt),ib(mt,n),mt?.type==="response.output_audio.delta"&&typeof mt.delta=="string"&&!u.paused&&oe(mt.delta)});const fe=Fe=>{le=Fe.code,ge=Fe.reason,n({type:"xai/ws/close",code:Fe.code,reason:Fe.reason}),u.connectedSent?(At("voice.session.failed",{error:{code:"VOICE_WS_CLOSED",message:`xAI WS closed: code=${Fe.code}`}}),k()):ee("VOICE_WS_REJECTED",`xAI WS closed before open: code=${Fe.code} reason=${Fe.reason}`)},Qe=()=>{if(n({type:"xai/ws/error"}),!u.connectedSent){const Fe=le!==void 0?` WS close code=${le}${ge?` reason="${ge}"`:""}.`:" No close frame received before error.";ee("VOICE_WS_REJECTED",`xAI WebSocket handshake failed. Attempted: wss://api.x.ai/v1/realtime with subprotocol prefix "xai-client-secret" (token not logged).${Fe} Possible causes: CORS policy, invalid/expired token, wrong subprotocol format, or origin not allowlisted.`)}};Z.addEventListener("close",fe),Z.addEventListener("error",Qe),y=()=>{Z.removeEventListener("close",fe),Z.removeEventListener("error",Qe)}}catch(v){ee("VOICE_SETUP_FAILED",Be(v))}}},ke=(C,v)=>{if(!C)return;if(v==="playback-drained"&&!K()){u.deferredSends.push(C);return}const j=JSON.stringify(C),$=u.xaiWs;if($&&r().voice.xaiOpen){try{$.send(j)}catch(Z){n({type:"browser/window/error",message:`xaiWs.send.failed.requeue: ${Be(Z)}`}),u.pendingSends.push(j)}return}u.pendingSends.push(j)},ae=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),u.outputCtx?.state==="running"&&u.outputCtx.suspend().catch(C=>n({type:"browser/window/error",message:`outputCtx.suspend.failed: ${Be(C)}`})),u.xaiWs&&r().voice.xaiOpen&&r().voice.responseActive)try{u.xaiWs.send(JSON.stringify({type:"response.cancel"}))}catch(C){n({type:"browser/window/error",message:`xaiWs.send.responseCancel.failed: ${Be(C)}`})}},W=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),n({type:"voice/paused",paused:!0}),r().voice.responseActive){f!==void 0&&clearTimeout(f),f=setTimeout(()=>{f!==void 0&&(f=void 0,ae())},W0);return}ae()},M=()=>{f!==void 0&&(clearTimeout(f),f=void 0),u.paused=!1,u.micTrack&&(u.micTrack.enabled=!0),u.outputCtx?.state==="suspended"&&u.outputCtx.resume().catch(C=>n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Be(C)}`})),n({type:"voice/paused",paused:!1})},F=async C=>{if(At("audio.device.select",{deviceId:C}),!!u.xaiWs)try{const v=await S(C);if(u.workletNode){try{u.workletNode.port.onmessage=null,u.workletNode.disconnect()}catch(j){n({type:"browser/window/error",message:`switchMic.worklet.disconnect.failed: ${Be(j)}`})}u.workletNode=void 0}if(u.micSourceNode)try{u.micSourceNode.disconnect()}catch(j){n({type:"browser/window/error",message:`switchMic.micSource.disconnect.failed: ${Be(j)}`})}if(u.inputCtx){try{u.inputCtx.close()}catch(j){n({type:"browser/window/error",message:`switchMic.inputCtx.close.failed: ${Be(j)}`})}u.inputCtx=void 0}if(u.micStream)for(const j of u.micStream.getTracks())j.stop();u.micStream=v,u.micTrack=v.getAudioTracks()[0],Vc(u.micTrack,n),await B(v),q(v)}catch(v){E("MICROPHONE_SWITCH_FAILED",Be(v)||"Could not switch microphone.","Try a different device.")}},re=()=>{if(b)return;p||(p=new AudioContext),p.state==="suspended"&&p.resume().catch(v=>n({type:"browser/window/error",message:`metronome.resume.failed: ${Be(v)}`}));const C=()=>{const v=p;if(!v)return;const j=v.createOscillator(),$=v.createGain();j.type="sine",j.frequency.value=880;const Z=v.currentTime;$.gain.setValueAtTime(0,Z),$.gain.linearRampToValueAtTime(.05,Z+.005),$.gain.exponentialRampToValueAtTime(1e-4,Z+.08),j.connect($).connect(v.destination),j.start(Z),j.stop(Z+.1)};C(),b=setInterval(C,2e3)},xe=()=>{b&&(clearInterval(b),b=void 0)};function k(){const{xaiWs:C,micStream:v,analyserCtx:j,workletNode:$,micSourceNode:Z,inputCtx:le,outputCtx:ge}=u;if(y&&(y(),y=void 0),C)try{C.close()}catch(fe){n({type:"browser/window/error",message:`teardown.xaiWs.close.failed: ${Be(fe)}`})}if($)try{$.port.onmessage=null,$.disconnect()}catch(fe){n({type:"browser/window/error",message:`teardown.worklet.disconnect.failed: ${Be(fe)}`})}if(Z)try{Z.disconnect()}catch(fe){n({type:"browser/window/error",message:`teardown.micSource.disconnect.failed: ${Be(fe)}`})}if(le)try{le.close()}catch(fe){n({type:"browser/window/error",message:`teardown.inputCtx.close.failed: ${Be(fe)}`})}if(ge)try{ge.close()}catch(fe){n({type:"browser/window/error",message:`teardown.outputCtx.close.failed: ${Be(fe)}`})}if(v)for(const fe of v.getTracks())fe.stop();if(j)try{j.close()}catch(fe){n({type:"browser/window/error",message:`teardown.analyserCtx.close.failed: ${Be(fe)}`})}d!==void 0&&(clearTimeout(d),d=void 0),f!==void 0&&(clearTimeout(f),f=void 0),h&&(cancelAnimationFrame(h),h=0),s=!1,Vc(void 0,n),u=Pp(),ou.fill(0)}const T=a(C=>{switch(C.type){case"ui/click/primary":L();break;case"host/voice/session/start":ye();break;case"browser/autoplay/probed":C.allowed&&z();break;case"ui/click/reset":At("conversation.reset"),k(),n({type:"voice/session/in-flight",inFlight:!1});break;case"ui/select/mic-device":F(C.deviceId);break;case"host/voice/session/token":te(C.token).catch(v=>{ee("VOICE_SETUP_FAILED",Be(v))});break;case"host/voice/send":ke(C.event,C.gate);break;case"host/voice/session/close":k();break;case"host/duplicate-client":k();break;case"host/state":{const v=C.data.conversationStatus;(v==="none"||v==="ending")&&r().voice.xaiOpen&&k();break}case"host/wait-for-context/start":re();break;case"host/wait-for-context/end":xe();break;case"xai/input-audio-buffer/speech-started":case"xai/response/cancelled":n({type:"voice/playback/cut"});break;case"voice/playback/cut":se(),d!==void 0&&(clearTimeout(d),d=void 0),u.deferredSends=[];break;case"voice/playback/drained":{const v=u.xaiWs;if(v&&r().voice.xaiOpen)for(const j of u.deferredSends)try{v.send(JSON.stringify(j))}catch($){n({type:"browser/window/error",message:`xaiWs.send.deferred.failed: ${Be($)}`})}u.deferredSends=[];break}}});return()=>{T(),xe(),k()}}const em=/^[A-Za-z0-9!#$%&\'*+\\-.^_`|~]+$/;function lb(n,a){if(em.test(n))return n;const r=[...new Set(n.split("").filter(u=>!em.test(u)))].join("");return a({type:"browser/window/error",message:`voice.session.token.sanitized: unsafeChars=${r}`}),btoa(n).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")}function ib(n,a){const r=n?.type;if(typeof r!="string"){a({type:"xai/unknown",raw:n});return}const u=typeof n.item_id=="string"?n.item_id:"";switch(r){case"session.created":a({type:"xai/session/created"});return;case"session.updated":a({type:"xai/session/updated"});return;case"conversation.created":a({type:"xai/conversation/created"});return;case"conversation.item.added":{const s=n.item,h=typeof s?.role=="string"?s.role:"";a({type:"xai/conversation/item/added",itemId:u,role:h});return}case"input_audio_buffer.speech_started":a({type:"xai/input-audio-buffer/speech-started",itemId:u});return;case"input_audio_buffer.speech_stopped":a({type:"xai/input-audio-buffer/speech-stopped"});return;case"input_audio_buffer.committed":a({type:"xai/input-audio-buffer/committed"});return;case"input_audio_buffer.cleared":a({type:"xai/input-audio-buffer/cleared"});return;case"response.created":a({type:"xai/response/created"});return;case"response.done":a({type:"xai/response/done"});return;case"response.cancelled":a({type:"xai/response/cancelled"});return;case"response.failed":a({type:"xai/response/failed"});return;case"response.output_audio.delta":a({type:"xai/response/output-audio/delta",b64:""});return;case"response.output_audio.done":a({type:"xai/response/output-audio/done"});return;case"response.output_audio_transcript.delta":a({type:"xai/response/output-audio-transcript/delta",delta:""});return;case"response.output_audio_transcript.done":a({type:"xai/response/output-audio-transcript/done"});return;case"response.text.delta":a({type:"xai/response/text/delta",delta:""});return;case"response.text.done":a({type:"xai/response/text/done"});return;case"error":a({type:"xai/error",code:"",message:""});return;default:a({type:"xai/unknown",raw:n})}}function ab({dimmed:n}){const a=Tt.useRef([]);return Tt.useEffect(()=>{let r=0;const u=()=>{for(let s=0;s<a.current.length;s+=1){const h=a.current[s];h!==void 0&&h.style.setProperty("--level",String(Math.max(.1,ou[s]??.1)))}r=requestAnimationFrame(u)};return r=requestAnimationFrame(u),()=>cancelAnimationFrame(r)},[]),I.jsx("div",{className:`meters${n?" dimmed":""}`,"aria-hidden":"true",children:[0,1,2,3,4].map(r=>I.jsx("span",{className:"bar",ref:u=>{u!==null&&(a.current[r]=u)}},r))})}function rb(){const{permission:n,devices:a,selectedDeviceId:r}=bt(Ss(u=>({permission:u.audio.permission,devices:u.audio.devices,selectedDeviceId:u.audio.selectedDeviceId})));return n==="denied"?I.jsxs("div",{className:"error-block",children:[I.jsx("div",{className:"error-title",children:"Microphone error"}),I.jsx("div",{children:"Microphone access denied \u2014 allow access in browser settings."}),I.jsx("button",{className:"retry",type:"button",onClick:()=>yt({type:"ui/click/primary"}),children:"Retry"})]}):a.length===0?I.jsx("div",{className:"mic-note",children:"Microphone access is required to use voice."}):I.jsxs("div",{children:[I.jsx("label",{className:"field-label",htmlFor:"micSelect",children:"Microphone"}),I.jsx("select",{id:"micSelect",value:r??a[0]?.deviceId??"",onChange:u=>yt({type:"ui/select/mic-device",deviceId:u.target.value}),children:a.map(u=>I.jsx("option",{value:u.deviceId,children:u.label},u.deviceId))})]})}function ub(){const{xaiOpen:n,sessionInFlight:a,paused:r}=bt(Ss(y=>({xaiOpen:y.voice.xaiOpen,sessionInFlight:y.voice.sessionInFlight,paused:y.voice.paused}))),u=bt(y=>y.connection.status),s=bt(y=>y.audio.autoplayAllowed),h=bt(y=>y.ui.moreActionsOpen),f=bt(y=>(y.conversation.conversation?.transcript.length??0)>0);let d;!n&&!a?d="idle":a&&!n?d="connecting":n&&!r?d="active":d="paused";const m=d==="idle"||d==="paused",p=d==="connecting",b=s===!1;return I.jsxs("div",{className:"floating-tab",children:[I.jsxs("button",{className:"icon-btn",type:"button",disabled:p,"aria-label":m?"Start conversation":"Pause conversation",title:b&&m?"Click to enable audio.":void 0,onClick:()=>yt({type:"ui/click/primary"}),children:[I.jsx("span",{className:`codicon codicon-${m?"play":"debug-pause"}`,"aria-hidden":"true"}),b&&m?I.jsx("span",{className:"shield-badge codicon codicon-shield","aria-hidden":"true"}):null]}),d==="active"||d==="paused"?I.jsx("button",{className:"icon-btn",type:"button","aria-label":"Reset conversation",onClick:()=>yt({type:"ui/click/reset"}),children:I.jsx("span",{className:"codicon codicon-refresh","aria-hidden":"true"})}):null,I.jsx("button",{className:"icon-btn",type:"button","aria-label":"View transcript",onClick:()=>yt({type:"ui/click/transcript"}),children:I.jsx("span",{className:"codicon codicon-comment-discussion","aria-hidden":"true"})}),I.jsx("button",{className:"icon-btn",type:"button","aria-label":"View instructions",onClick:()=>yt({type:"ui/click/instructions"}),children:I.jsx("span",{className:"codicon codicon-book","aria-hidden":"true"})}),d==="active"?I.jsx(ab,{dimmed:!1}):null,I.jsxs("div",{className:"connection",children:[I.jsx("span",{className:`dot ${u}`}),u==="connecting"?I.jsx("span",{children:"Connecting..."}):u==="disconnected"?I.jsx("span",{children:"Disconnected"}):u==="error"?I.jsx("span",{children:"Connection Error"}):null]}),I.jsxs("div",{style:{position:"relative"},children:[I.jsx("button",{className:"icon-btn",type:"button","aria-label":"More actions","aria-expanded":h,onClick:()=>yt({type:"ui/click/more-actions"}),children:I.jsx("span",{className:"codicon codicon-ellipsis","aria-hidden":"true"})}),h?I.jsxs("div",{className:"more-actions-popover","data-more-actions":!0,children:[I.jsx(rb,{}),I.jsx("button",{className:"menu-item",type:"button",disabled:!f,onClick:()=>yt({type:"ui/click/download-transcript"}),children:"Download transcript (JSONL)"})]}):null]})]})}function ob(n,a){const r={};return(n[n.length-1]===""?[...n,""]:n).join((r.padRight?" ":"")+","+(r.padLeft===!1?"":" ")).trim()}const cb=/^[$_\\p{ID_Start}][$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,sb=/^[$_\\p{ID_Start}][-$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,fb={};function tm(n,a){return(fb.jsx?sb:cb).test(n)}const hb=/[ \\t\\n\\f\\r]/g;function db(n){return typeof n=="object"?n.type==="text"?nm(n.value):!1:nm(n)}function nm(n){return n.replace(hb,"")===""}class Na{constructor(a,r,u){this.normal=r,this.property=a,u&&(this.space=u)}}Na.prototype.normal={};Na.prototype.property={};Na.prototype.space=void 0;function Qm(n,a){const r={},u={};for(const s of n)Object.assign(r,s.property),Object.assign(u,s.normal);return new Na(r,u,a)}function os(n){return n.toLowerCase()}class Ut{constructor(a,r){this.attribute=r,this.property=a}}Ut.prototype.attribute="";Ut.prototype.booleanish=!1;Ut.prototype.boolean=!1;Ut.prototype.commaOrSpaceSeparated=!1;Ut.prototype.commaSeparated=!1;Ut.prototype.defined=!1;Ut.prototype.mustUseProperty=!1;Ut.prototype.number=!1;Ut.prototype.overloadedBoolean=!1;Ut.prototype.property="";Ut.prototype.spaceSeparated=!1;Ut.prototype.space=void 0;let pb=0;const Ee=Ml(),at=Ml(),cs=Ml(),J=Ml(),Ze=Ml(),wi=Ml(),Qt=Ml();function Ml(){return 2**++pb}const ss=Object.freeze(Object.defineProperty({__proto__:null,boolean:Ee,booleanish:at,commaOrSpaceSeparated:Qt,commaSeparated:wi,number:J,overloadedBoolean:cs,spaceSeparated:Ze},Symbol.toStringTag,{value:"Module"})),Gc=Object.keys(ss);class ks extends Ut{constructor(a,r,u,s){let h=-1;if(super(a,r),lm(this,"space",s),typeof u=="number")for(;++h<Gc.length;){const f=Gc[h];lm(this,Gc[h],(u&ss[f])===ss[f])}}}ks.prototype.defined=!0;function lm(n,a,r){r&&(n[a]=r)}function zi(n){const a={},r={};for(const[u,s]of Object.entries(n.properties)){const h=new ks(u,n.transform(n.attributes||{},u),s,n.space);n.mustUseProperty&&n.mustUseProperty.includes(u)&&(h.mustUseProperty=!0),a[u]=h,r[os(u)]=u,r[os(h.attribute)]=u}return new Na(a,r,n.space)}const Zm=zi({properties:{ariaActiveDescendant:null,ariaAtomic:at,ariaAutoComplete:null,ariaBusy:at,ariaChecked:at,ariaColCount:J,ariaColIndex:J,ariaColSpan:J,ariaControls:Ze,ariaCurrent:null,ariaDescribedBy:Ze,ariaDetails:null,ariaDisabled:at,ariaDropEffect:Ze,ariaErrorMessage:null,ariaExpanded:at,ariaFlowTo:Ze,ariaGrabbed:at,ariaHasPopup:null,ariaHidden:at,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:Ze,ariaLevel:J,ariaLive:null,ariaModal:at,ariaMultiLine:at,ariaMultiSelectable:at,ariaOrientation:null,ariaOwns:Ze,ariaPlaceholder:null,ariaPosInSet:J,ariaPressed:at,ariaReadOnly:at,ariaRelevant:null,ariaRequired:at,ariaRoleDescription:Ze,ariaRowCount:J,ariaRowIndex:J,ariaRowSpan:J,ariaSelected:at,ariaSetSize:J,ariaSort:null,ariaValueMax:J,ariaValueMin:J,ariaValueNow:J,ariaValueText:null,role:null},transform(n,a){return a==="role"?a:"aria-"+a.slice(4).toLowerCase()}});function Fm(n,a){return a in n?n[a]:a}function Im(n,a){return Fm(n,a.toLowerCase())}const mb=zi({attributes:{acceptcharset:"accept-charset",classname:"class",htmlfor:"for",httpequiv:"http-equiv"},mustUseProperty:["checked","multiple","muted","selected"],properties:{abbr:null,accept:wi,acceptCharset:Ze,accessKey:Ze,action:null,allow:null,allowFullScreen:Ee,allowPaymentRequest:Ee,allowUserMedia:Ee,alt:null,as:null,async:Ee,autoCapitalize:null,autoComplete:Ze,autoFocus:Ee,autoPlay:Ee,blocking:Ze,capture:null,charSet:null,checked:Ee,cite:null,className:Ze,cols:J,colSpan:null,content:null,contentEditable:at,controls:Ee,controlsList:Ze,coords:J|wi,crossOrigin:null,data:null,dateTime:null,decoding:null,default:Ee,defer:Ee,dir:null,dirName:null,disabled:Ee,download:cs,draggable:at,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:Ee,formTarget:null,headers:Ze,height:J,hidden:cs,high:J,href:null,hrefLang:null,htmlFor:Ze,httpEquiv:Ze,id:null,imageSizes:null,imageSrcSet:null,inert:Ee,inputMode:null,integrity:null,is:null,isMap:Ee,itemId:null,itemProp:Ze,itemRef:Ze,itemScope:Ee,itemType:Ze,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:Ee,low:J,manifest:null,max:null,maxLength:J,media:null,method:null,min:null,minLength:J,multiple:Ee,muted:Ee,name:null,nonce:null,noModule:Ee,noValidate:Ee,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:Ee,optimum:J,pattern:null,ping:Ze,placeholder:null,playsInline:Ee,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:Ee,referrerPolicy:null,rel:Ze,required:Ee,reversed:Ee,rows:J,rowSpan:J,sandbox:Ze,scope:null,scoped:Ee,seamless:Ee,selected:Ee,shadowRootClonable:Ee,shadowRootDelegatesFocus:Ee,shadowRootMode:null,shape:null,size:J,sizes:null,slot:null,span:J,spellCheck:at,src:null,srcDoc:null,srcLang:null,srcSet:null,start:J,step:null,style:null,tabIndex:J,target:null,title:null,translate:null,type:null,typeMustMatch:Ee,useMap:null,value:at,width:J,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:Ze,axis:null,background:null,bgColor:null,border:J,borderColor:null,bottomMargin:J,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:Ee,declare:Ee,event:null,face:null,frame:null,frameBorder:null,hSpace:J,leftMargin:J,link:null,longDesc:null,lowSrc:null,marginHeight:J,marginWidth:J,noResize:Ee,noHref:Ee,noShade:Ee,noWrap:Ee,object:null,profile:null,prompt:null,rev:null,rightMargin:J,rules:null,scheme:null,scrolling:at,standby:null,summary:null,text:null,topMargin:J,valueType:null,version:null,vAlign:null,vLink:null,vSpace:J,allowTransparency:null,autoCorrect:null,autoSave:null,disablePictureInPicture:Ee,disableRemotePlayback:Ee,prefix:null,property:null,results:J,security:null,unselectable:null},space:"html",transform:Im}),gb=zi({attributes:{accentHeight:"accent-height",alignmentBaseline:"alignment-baseline",arabicForm:"arabic-form",baselineShift:"baseline-shift",capHeight:"cap-height",className:"class",clipPath:"clip-path",clipRule:"clip-rule",colorInterpolation:"color-interpolation",colorInterpolationFilters:"color-interpolation-filters",colorProfile:"color-profile",colorRendering:"color-rendering",crossOrigin:"crossorigin",dataType:"datatype",dominantBaseline:"dominant-baseline",enableBackground:"enable-background",fillOpacity:"fill-opacity",fillRule:"fill-rule",floodColor:"flood-color",floodOpacity:"flood-opacity",fontFamily:"font-family",fontSize:"font-size",fontSizeAdjust:"font-size-adjust",fontStretch:"font-stretch",fontStyle:"font-style",fontVariant:"font-variant",fontWeight:"font-weight",glyphName:"glyph-name",glyphOrientationHorizontal:"glyph-orientation-horizontal",glyphOrientationVertical:"glyph-orientation-vertical",hrefLang:"hreflang",horizAdvX:"horiz-adv-x",horizOriginX:"horiz-origin-x",horizOriginY:"horiz-origin-y",imageRendering:"image-rendering",letterSpacing:"letter-spacing",lightingColor:"lighting-color",markerEnd:"marker-end",markerMid:"marker-mid",markerStart:"marker-start",navDown:"nav-down",navDownLeft:"nav-down-left",navDownRight:"nav-down-right",navLeft:"nav-left",navNext:"nav-next",navPrev:"nav-prev",navRight:"nav-right",navUp:"nav-up",navUpLeft:"nav-up-left",navUpRight:"nav-up-right",onAbort:"onabort",onActivate:"onactivate",onAfterPrint:"onafterprint",onBeforePrint:"onbeforeprint",onBegin:"onbegin",onCancel:"oncancel",onCanPlay:"oncanplay",onCanPlayThrough:"oncanplaythrough",onChange:"onchange",onClick:"onclick",onClose:"onclose",onCopy:"oncopy",onCueChange:"oncuechange",onCut:"oncut",onDblClick:"ondblclick",onDrag:"ondrag",onDragEnd:"ondragend",onDragEnter:"ondragenter",onDragExit:"ondragexit",onDragLeave:"ondragleave",onDragOver:"ondragover",onDragStart:"ondragstart",onDrop:"ondrop",onDurationChange:"ondurationchange",onEmptied:"onemptied",onEnd:"onend",onEnded:"onended",onError:"onerror",onFocus:"onfocus",onFocusIn:"onfocusin",onFocusOut:"onfocusout",onHashChange:"onhashchange",onInput:"oninput",onInvalid:"oninvalid",onKeyDown:"onkeydown",onKeyPress:"onkeypress",onKeyUp:"onkeyup",onLoad:"onload",onLoadedData:"onloadeddata",onLoadedMetadata:"onloadedmetadata",onLoadStart:"onloadstart",onMessage:"onmessage",onMouseDown:"onmousedown",onMouseEnter:"onmouseenter",onMouseLeave:"onmouseleave",onMouseMove:"onmousemove",onMouseOut:"onmouseout",onMouseOver:"onmouseover",onMouseUp:"onmouseup",onMouseWheel:"onmousewheel",onOffline:"onoffline",onOnline:"ononline",onPageHide:"onpagehide",onPageShow:"onpageshow",onPaste:"onpaste",onPause:"onpause",onPlay:"onplay",onPlaying:"onplaying",onPopState:"onpopstate",onProgress:"onprogress",onRateChange:"onratechange",onRepeat:"onrepeat",onReset:"onreset",onResize:"onresize",onScroll:"onscroll",onSeeked:"onseeked",onSeeking:"onseeking",onSelect:"onselect",onShow:"onshow",onStalled:"onstalled",onStorage:"onstorage",onSubmit:"onsubmit",onSuspend:"onsuspend",onTimeUpdate:"ontimeupdate",onToggle:"ontoggle",onUnload:"onunload",onVolumeChange:"onvolumechange",onWaiting:"onwaiting",onZoom:"onzoom",overlinePosition:"overline-position",overlineThickness:"overline-thickness",paintOrder:"paint-order",panose1:"panose-1",pointerEvents:"pointer-events",referrerPolicy:"referrerpolicy",renderingIntent:"rendering-intent",shapeRendering:"shape-rendering",stopColor:"stop-color",stopOpacity:"stop-opacity",strikethroughPosition:"strikethrough-position",strikethroughThickness:"strikethrough-thickness",strokeDashArray:"stroke-dasharray",strokeDashOffset:"stroke-dashoffset",strokeLineCap:"stroke-linecap",strokeLineJoin:"stroke-linejoin",strokeMiterLimit:"stroke-miterlimit",strokeOpacity:"stroke-opacity",strokeWidth:"stroke-width",tabIndex:"tabindex",textAnchor:"text-anchor",textDecoration:"text-decoration",textRendering:"text-rendering",transformOrigin:"transform-origin",typeOf:"typeof",underlinePosition:"underline-position",underlineThickness:"underline-thickness",unicodeBidi:"unicode-bidi",unicodeRange:"unicode-range",unitsPerEm:"units-per-em",vAlphabetic:"v-alphabetic",vHanging:"v-hanging",vIdeographic:"v-ideographic",vMathematical:"v-mathematical",vectorEffect:"vector-effect",vertAdvY:"vert-adv-y",vertOriginX:"vert-origin-x",vertOriginY:"vert-origin-y",wordSpacing:"word-spacing",writingMode:"writing-mode",xHeight:"x-height",playbackOrder:"playbackorder",timelineBegin:"timelinebegin"},properties:{about:Qt,accentHeight:J,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:J,amplitude:J,arabicForm:null,ascent:J,attributeName:null,attributeType:null,azimuth:J,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:J,by:null,calcMode:null,capHeight:J,className:Ze,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:J,diffuseConstant:J,direction:null,display:null,dur:null,divisor:J,dominantBaseline:null,download:Ee,dx:null,dy:null,edgeMode:null,editable:null,elevation:J,enableBackground:null,end:null,event:null,exponent:J,externalResourcesRequired:null,fill:null,fillOpacity:J,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:wi,g2:wi,glyphName:wi,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:J,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:J,horizOriginX:J,horizOriginY:J,id:null,ideographic:J,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:J,k:J,k1:J,k2:J,k3:J,k4:J,kernelMatrix:Qt,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:J,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:J,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:J,overlineThickness:J,paintOrder:null,panose1:null,path:null,pathLength:J,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:Ze,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:J,pointsAtY:J,pointsAtZ:J,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:Qt,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:Qt,rev:Qt,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:Qt,requiredFeatures:Qt,requiredFonts:Qt,requiredFormats:Qt,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:J,specularExponent:J,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:J,strikethroughThickness:J,string:null,stroke:null,strokeDashArray:Qt,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:J,strokeOpacity:J,strokeWidth:null,style:null,surfaceScale:J,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:Qt,tabIndex:J,tableValues:null,target:null,targetX:J,targetY:J,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:Qt,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:J,underlineThickness:J,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:J,values:null,vAlphabetic:J,vMathematical:J,vectorEffect:null,vHanging:J,vIdeographic:J,version:null,vertAdvY:J,vertOriginX:J,vertOriginY:J,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:J,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:"svg",transform:Fm}),Km=zi({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:"xlink",transform(n,a){return"xlink:"+a.slice(5).toLowerCase()}}),Jm=zi({attributes:{xmlnsxlink:"xmlns:xlink"},properties:{xmlnsXLink:null,xmlns:null},space:"xmlns",transform:Im}),$m=zi({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:"xml",transform(n,a){return"xml:"+a.slice(3).toLowerCase()}}),yb={classId:"classID",dataType:"datatype",itemId:"itemID",strokeDashArray:"strokeDasharray",strokeDashOffset:"strokeDashoffset",strokeLineCap:"strokeLinecap",strokeLineJoin:"strokeLinejoin",strokeMiterLimit:"strokeMiterlimit",typeOf:"typeof",xLinkActuate:"xlinkActuate",xLinkArcRole:"xlinkArcrole",xLinkHref:"xlinkHref",xLinkRole:"xlinkRole",xLinkShow:"xlinkShow",xLinkTitle:"xlinkTitle",xLinkType:"xlinkType",xmlnsXLink:"xmlnsXlink"},bb=/[A-Z]/g,im=/-[a-z]/g,vb=/^data[-\\w.:]+$/i;function xb(n,a){const r=os(a);let u=a,s=Ut;if(r in n.normal)return n.property[n.normal[r]];if(r.length>4&&r.slice(0,4)==="data"&&vb.test(a)){if(a.charAt(4)==="-"){const h=a.slice(5).replace(im,Eb);u="data"+h.charAt(0).toUpperCase()+h.slice(1)}else{const h=a.slice(4);if(!im.test(h)){let f=h.replace(bb,Sb);f.charAt(0)!=="-"&&(f="-"+f),a="data"+f}}s=ks}return new s(u,a)}function Sb(n){return"-"+n.toLowerCase()}function Eb(n){return n.charAt(1).toUpperCase()}const kb=Qm([Zm,mb,Km,Jm,$m],"html"),As=Qm([Zm,gb,Km,Jm,$m],"svg");function Ab(n){return n.join(" ").trim()}var Ei={},Xc,am;function Tb(){if(am)return Xc;am=1;var n=/\\/\\*[^*]*\\*+([^/*][^*]*\\*+)*\\//g,a=/\\n/g,r=/^\\s*/,u=/^(\\*?[-#/*\\\\\\w]+(\\[[0-9a-z_-]+\\])?)\\s*/,s=/^:\\s*/,h=/^((?:\'(?:\\\\\'|.)*?\'|"(?:\\\\"|.)*?"|\\([^)]*?\\)|[^};])+)/,f=/^[;\\s]*/,d=/^\\s+|\\s+$/g,m=`\n`,p="/",b="*",y="",E="comment",S="declaration";function z(Q,R){if(typeof Q!="string")throw new TypeError("First argument must be a string");if(!Q)return[];R=R||{};var K=1,X=1;function oe(ae){var W=ae.match(a);W&&(K+=W.length);var M=ae.lastIndexOf(m);X=~M?ae.length-M:X+ae.length}function se(){var ae={line:K,column:X};return function(W){return W.position=new B(ae),ye(),W}}function B(ae){this.start=ae,this.end={line:K,column:X},this.source=R.source}B.prototype.content=Q;function ee(ae){var W=new Error(R.source+":"+K+":"+X+": "+ae);if(W.reason=ae,W.filename=R.source,W.line=K,W.column=X,W.source=Q,!R.silent)throw W}function pe(ae){var W=ae.exec(Q);if(W){var M=W[0];return oe(M),Q=Q.slice(M.length),W}}function ye(){pe(r)}function L(ae){var W;for(ae=ae||[];W=ne();)W!==!1&&ae.push(W);return ae}function ne(){var ae=se();if(!(p!=Q.charAt(0)||b!=Q.charAt(1))){for(var W=2;y!=Q.charAt(W)&&(b!=Q.charAt(W)||p!=Q.charAt(W+1));)++W;if(W+=2,y===Q.charAt(W-1))return ee("End of comment missing");var M=Q.slice(2,W-2);return X+=2,oe(M),Q=Q.slice(W),X+=2,ae({type:E,comment:M})}}function te(){var ae=se(),W=pe(u);if(W){if(ne(),!pe(s))return ee("property missing \':\'");var M=pe(h),F=ae({type:S,property:q(W[0].replace(n,y)),value:M?q(M[0].replace(n,y)):y});return pe(f),F}}function ke(){var ae=[];L(ae);for(var W;W=te();)W!==!1&&(ae.push(W),L(ae));return ae}return ye(),ke()}function q(Q){return Q?Q.replace(d,y):y}return Xc=z,Xc}var rm;function wb(){if(rm)return Ei;rm=1;var n=Ei&&Ei.__importDefault||function(u){return u&&u.__esModule?u:{default:u}};Object.defineProperty(Ei,"__esModule",{value:!0}),Ei.default=r;const a=n(Tb());function r(u,s){let h=null;if(!u||typeof u!="string")return h;const f=(0,a.default)(u),d=typeof s=="function";return f.forEach(m=>{if(m.type!=="declaration")return;const{property:p,value:b}=m;d?s(p,b,m):b&&(h=h||{},h[p]=b)}),h}return Ei}var Aa={},um;function Cb(){if(um)return Aa;um=1,Object.defineProperty(Aa,"__esModule",{value:!0}),Aa.camelCase=void 0;var n=/^--[a-zA-Z0-9_-]+$/,a=/-([a-z])/g,r=/^[^-]+$/,u=/^-(webkit|moz|ms|o|khtml)-/,s=/^-(ms)-/,h=function(p){return!p||r.test(p)||n.test(p)},f=function(p,b){return b.toUpperCase()},d=function(p,b){return"".concat(b,"-")},m=function(p,b){return b===void 0&&(b={}),h(p)?p:(p=p.toLowerCase(),b.reactCompat?p=p.replace(s,d):p=p.replace(u,d),p.replace(a,f))};return Aa.camelCase=m,Aa}var Ta,om;function zb(){if(om)return Ta;om=1;var n=Ta&&Ta.__importDefault||function(s){return s&&s.__esModule?s:{default:s}},a=n(wb()),r=Cb();function u(s,h){var f={};return!s||typeof s!="string"||(0,a.default)(s,function(d,m){d&&m&&(f[(0,r.camelCase)(d,h)]=m)}),f}return u.default=u,Ta=u,Ta}var Db=zb();const _b=vs(Db),Wm=Pm("end"),Ts=Pm("start");function Pm(n){return a;function a(r){const u=r&&r.position&&r.position[n]||{};if(typeof u.line=="number"&&u.line>0&&typeof u.column=="number"&&u.column>0)return{line:u.line,column:u.column,offset:typeof u.offset=="number"&&u.offset>-1?u.offset:void 0}}}function Ob(n){const a=Ts(n),r=Wm(n);if(a&&r)return{start:a,end:r}}function Da(n){return!n||typeof n!="object"?"":"position"in n||"type"in n?cm(n.position):"start"in n||"end"in n?cm(n):"line"in n||"column"in n?fs(n):""}function fs(n){return sm(n&&n.line)+":"+sm(n&&n.column)}function cm(n){return fs(n&&n.start)+"-"+fs(n&&n.end)}function sm(n){return n&&typeof n=="number"?n:1}class xt extends Error{constructor(a,r,u){super(),typeof r=="string"&&(u=r,r=void 0);let s="",h={},f=!1;if(r&&("line"in r&&"column"in r?h={place:r}:"start"in r&&"end"in r?h={place:r}:"type"in r?h={ancestors:[r],place:r.position}:h={...r}),typeof a=="string"?s=a:!h.cause&&a&&(f=!0,s=a.message,h.cause=a),!h.ruleId&&!h.source&&typeof u=="string"){const m=u.indexOf(":");m===-1?h.ruleId=u:(h.source=u.slice(0,m),h.ruleId=u.slice(m+1))}if(!h.place&&h.ancestors&&h.ancestors){const m=h.ancestors[h.ancestors.length-1];m&&(h.place=m.position)}const d=h.place&&"start"in h.place?h.place.start:h.place;this.ancestors=h.ancestors||void 0,this.cause=h.cause||void 0,this.column=d?d.column:void 0,this.fatal=void 0,this.file="",this.message=s,this.line=d?d.line:void 0,this.name=Da(h.place)||"1:1",this.place=h.place||void 0,this.reason=this.message,this.ruleId=h.ruleId||void 0,this.source=h.source||void 0,this.stack=f&&h.cause&&typeof h.cause.stack=="string"?h.cause.stack:"",this.actual=void 0,this.expected=void 0,this.note=void 0,this.url=void 0}}xt.prototype.file="";xt.prototype.name="";xt.prototype.reason="";xt.prototype.message="";xt.prototype.stack="";xt.prototype.column=void 0;xt.prototype.line=void 0;xt.prototype.ancestors=void 0;xt.prototype.cause=void 0;xt.prototype.fatal=void 0;xt.prototype.place=void 0;xt.prototype.ruleId=void 0;xt.prototype.source=void 0;const ws={}.hasOwnProperty,Mb=new Map,Rb=/[A-Z]/g,Nb=new Set(["table","tbody","thead","tfoot","tr"]),Lb=new Set(["td","th"]),eg="https://github.com/syntax-tree/hast-util-to-jsx-runtime";function Ub(n,a){if(!a||a.Fragment===void 0)throw new TypeError("Expected `Fragment` in options");const r=a.filePath||void 0;let u;if(a.development){if(typeof a.jsxDEV!="function")throw new TypeError("Expected `jsxDEV` in options when `development: true`");u=Xb(r,a.jsxDEV)}else{if(typeof a.jsx!="function")throw new TypeError("Expected `jsx` in production options");if(typeof a.jsxs!="function")throw new TypeError("Expected `jsxs` in production options");u=Gb(r,a.jsx,a.jsxs)}const s={Fragment:a.Fragment,ancestors:[],components:a.components||{},create:u,elementAttributeNameCase:a.elementAttributeNameCase||"react",evaluater:a.createEvaluater?a.createEvaluater():void 0,filePath:r,ignoreInvalidStyle:a.ignoreInvalidStyle||!1,passKeys:a.passKeys!==!1,passNode:a.passNode||!1,schema:a.space==="svg"?As:kb,stylePropertyNameCase:a.stylePropertyNameCase||"dom",tableCellAlignToStyle:a.tableCellAlignToStyle!==!1},h=tg(s,n,void 0);return h&&typeof h!="string"?h:s.create(n,s.Fragment,{children:h||void 0},void 0)}function tg(n,a,r){if(a.type==="element")return jb(n,a,r);if(a.type==="mdxFlowExpression"||a.type==="mdxTextExpression")return Bb(n,a);if(a.type==="mdxJsxFlowElement"||a.type==="mdxJsxTextElement")return qb(n,a,r);if(a.type==="mdxjsEsm")return Hb(n,a);if(a.type==="root")return Yb(n,a,r);if(a.type==="text")return Vb(n,a)}function jb(n,a,r){const u=n.schema;let s=u;a.tagName.toLowerCase()==="svg"&&u.space==="html"&&(s=As,n.schema=s),n.ancestors.push(a);const h=lg(n,a.tagName,!1),f=Qb(n,a);let d=zs(n,a);return Nb.has(a.tagName)&&(d=d.filter(function(m){return typeof m=="string"?!db(m):!0})),ng(n,f,h,a),Cs(f,d),n.ancestors.pop(),n.schema=u,n.create(a,h,f,r)}function Bb(n,a){if(a.data&&a.data.estree&&n.evaluater){const u=a.data.estree.body[0];return u.type,n.evaluater.evaluateExpression(u.expression)}Ma(n,a.position)}function Hb(n,a){if(a.data&&a.data.estree&&n.evaluater)return n.evaluater.evaluateProgram(a.data.estree);Ma(n,a.position)}function qb(n,a,r){const u=n.schema;let s=u;a.name==="svg"&&u.space==="html"&&(s=As,n.schema=s),n.ancestors.push(a);const h=a.name===null?n.Fragment:lg(n,a.name,!0),f=Zb(n,a),d=zs(n,a);return ng(n,f,h,a),Cs(f,d),n.ancestors.pop(),n.schema=u,n.create(a,h,f,r)}function Yb(n,a,r){const u={};return Cs(u,zs(n,a)),n.create(a,n.Fragment,u,r)}function Vb(n,a){return a.value}function ng(n,a,r,u){typeof r!="string"&&r!==n.Fragment&&n.passNode&&(a.node=u)}function Cs(n,a){if(a.length>0){const r=a.length>1?a:a[0];r&&(n.children=r)}}function Gb(n,a,r){return u;function u(s,h,f,d){const p=Array.isArray(f.children)?r:a;return d?p(h,f,d):p(h,f)}}function Xb(n,a){return r;function r(u,s,h,f){const d=Array.isArray(h.children),m=Ts(u);return a(s,h,f,d,{columnNumber:m?m.column-1:void 0,fileName:n,lineNumber:m?m.line:void 0},void 0)}}function Qb(n,a){const r={};let u,s;for(s in a.properties)if(s!=="children"&&ws.call(a.properties,s)){const h=Fb(n,s,a.properties[s]);if(h){const[f,d]=h;n.tableCellAlignToStyle&&f==="align"&&typeof d=="string"&&Lb.has(a.tagName)?u=d:r[f]=d}}if(u){const h=r.style||(r.style={});h[n.stylePropertyNameCase==="css"?"text-align":"textAlign"]=u}return r}function Zb(n,a){const r={};for(const u of a.attributes)if(u.type==="mdxJsxExpressionAttribute")if(u.data&&u.data.estree&&n.evaluater){const h=u.data.estree.body[0];h.type;const f=h.expression;f.type;const d=f.properties[0];d.type,Object.assign(r,n.evaluater.evaluateExpression(d.argument))}else Ma(n,a.position);else{const s=u.name;let h;if(u.value&&typeof u.value=="object")if(u.value.data&&u.value.data.estree&&n.evaluater){const d=u.value.data.estree.body[0];d.type,h=n.evaluater.evaluateExpression(d.expression)}else Ma(n,a.position);else h=u.value===null?!0:u.value;r[s]=h}return r}function zs(n,a){const r=[];let u=-1;const s=n.passKeys?new Map:Mb;for(;++u<a.children.length;){const h=a.children[u];let f;if(n.passKeys){const m=h.type==="element"?h.tagName:h.type==="mdxJsxFlowElement"||h.type==="mdxJsxTextElement"?h.name:void 0;if(m){const p=s.get(m)||0;f=m+"-"+p,s.set(m,p+1)}}const d=tg(n,h,f);d!==void 0&&r.push(d)}return r}function Fb(n,a,r){const u=xb(n.schema,a);if(!(r==null||typeof r=="number"&&Number.isNaN(r))){if(Array.isArray(r)&&(r=u.commaSeparated?ob(r):Ab(r)),u.property==="style"){let s=typeof r=="object"?r:Ib(n,String(r));return n.stylePropertyNameCase==="css"&&(s=Kb(s)),["style",s]}return[n.elementAttributeNameCase==="react"&&u.space?yb[u.property]||u.property:u.attribute,r]}}function Ib(n,a){try{return _b(a,{reactCompat:!0})}catch(r){if(n.ignoreInvalidStyle)return{};const u=r,s=new xt("Cannot parse `style` attribute",{ancestors:n.ancestors,cause:u,ruleId:"style",source:"hast-util-to-jsx-runtime"});throw s.file=n.filePath||void 0,s.url=eg+"#cannot-parse-style-attribute",s}}function lg(n,a,r){let u;if(!r)u={type:"Literal",value:a};else if(a.includes(".")){const s=a.split(".");let h=-1,f;for(;++h<s.length;){const d=tm(s[h])?{type:"Identifier",name:s[h]}:{type:"Literal",value:s[h]};f=f?{type:"MemberExpression",object:f,property:d,computed:!!(h&&d.type==="Literal"),optional:!1}:d}u=f}else u=tm(a)&&!/^[a-z]/.test(a)?{type:"Identifier",name:a}:{type:"Literal",value:a};if(u.type==="Literal"){const s=u.value;return ws.call(n.components,s)?n.components[s]:s}if(n.evaluater)return n.evaluater.evaluateExpression(u);Ma(n)}function Ma(n,a){const r=new xt("Cannot handle MDX estrees without `createEvaluater`",{ancestors:n.ancestors,place:a,ruleId:"mdx-estree",source:"hast-util-to-jsx-runtime"});throw r.file=n.filePath||void 0,r.url=eg+"#cannot-handle-mdx-estrees-without-createevaluater",r}function Kb(n){const a={};let r;for(r in n)ws.call(n,r)&&(a[Jb(r)]=n[r]);return a}function Jb(n){let a=n.replace(Rb,$b);return a.slice(0,3)==="ms-"&&(a="-"+a),a}function $b(n){return"-"+n.toLowerCase()}const Qc={action:["form"],cite:["blockquote","del","ins","q"],data:["object"],formAction:["button","input"],href:["a","area","base","link"],icon:["menuitem"],itemId:null,manifest:["html"],ping:["a","area"],poster:["video"],src:["audio","embed","iframe","img","input","script","source","track","video"]},Wb={};function Ds(n,a){const r=Wb,u=typeof r.includeImageAlt=="boolean"?r.includeImageAlt:!0,s=typeof r.includeHtml=="boolean"?r.includeHtml:!0;return ig(n,u,s)}function ig(n,a,r){if(Pb(n)){if("value"in n)return n.type==="html"&&!r?"":n.value;if(a&&"alt"in n&&n.alt)return n.alt;if("children"in n)return fm(n.children,a,r)}return Array.isArray(n)?fm(n,a,r):""}function fm(n,a,r){const u=[];let s=-1;for(;++s<n.length;)u[s]=ig(n[s],a,r);return u.join("")}function Pb(n){return!!(n&&typeof n=="object")}const hm=document.createElement("i");function _s(n){const a="&"+n+";";hm.innerHTML=a;const r=hm.textContent;return r.charCodeAt(r.length-1)===59&&n!=="semi"||r===a?!1:r}function Zt(n,a,r,u){const s=n.length;let h=0,f;if(a<0?a=-a>s?0:s+a:a=a>s?s:a,r=r>0?r:0,u.length<1e4)f=Array.from(u),f.unshift(a,r),n.splice(...f);else for(r&&n.splice(a,r);h<u.length;)f=u.slice(h,h+1e4),f.unshift(a,0),n.splice(...f),h+=1e4,a+=1e4}function ln(n,a){return n.length>0?(Zt(n,n.length,0,a),n):a}const dm={}.hasOwnProperty;function ag(n){const a={};let r=-1;for(;++r<n.length;)ev(a,n[r]);return a}function ev(n,a){let r;for(r in a){const s=(dm.call(n,r)?n[r]:void 0)||(n[r]={}),h=a[r];let f;if(h)for(f in h){dm.call(s,f)||(s[f]=[]);const d=h[f];tv(s[f],Array.isArray(d)?d:d?[d]:[])}}}function tv(n,a){let r=-1;const u=[];for(;++r<a.length;)(a[r].add==="after"?n:u).push(a[r]);Zt(n,0,0,u)}function rg(n,a){const r=Number.parseInt(n,a);return r<9||r===11||r>13&&r<32||r>126&&r<160||r>55295&&r<57344||r>64975&&r<65008||(r&65535)===65535||(r&65535)===65534||r>1114111?"\uFFFD":String.fromCodePoint(r)}function cn(n){return n.replace(/[\\t\\n\\r ]+/g," ").replace(/^ | $/g,"").toLowerCase().toUpperCase()}const wt=sl(/[A-Za-z]/),vt=sl(/[\\dA-Za-z]/),nv=sl(/[#-\'*+\\--9=?A-Z^-~]/);function su(n){return n!==null&&(n<32||n===127)}const hs=sl(/\\d/),lv=sl(/[\\dA-Fa-f]/),iv=sl(/[!-/:-@[-`{-~]/);function he(n){return n!==null&&n<-2}function Xe(n){return n!==null&&(n<0||n===32)}function Ce(n){return n===-2||n===-1||n===32}const pu=sl(/\\p{P}|\\p{S}/u),Ol=sl(/\\s/);function sl(n){return a;function a(r){return r!==null&&r>-1&&n.test(String.fromCharCode(r))}}function Di(n){const a=[];let r=-1,u=0,s=0;for(;++r<n.length;){const h=n.charCodeAt(r);let f="";if(h===37&&vt(n.charCodeAt(r+1))&&vt(n.charCodeAt(r+2)))s=2;else if(h<128)/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(h))||(f=String.fromCharCode(h));else if(h>55295&&h<57344){const d=n.charCodeAt(r+1);h<56320&&d>56319&&d<57344?(f=String.fromCharCode(h,d),s=1):f="\uFFFD"}else f=String.fromCharCode(h);f&&(a.push(n.slice(u,r),encodeURIComponent(f)),u=r+s+1,f=""),s&&(r+=s,s=0)}return a.join("")+n.slice(u)}function Oe(n,a,r,u){const s=u?u-1:Number.POSITIVE_INFINITY;let h=0;return f;function f(m){return Ce(m)?(n.enter(r),d(m)):a(m)}function d(m){return Ce(m)&&h++<s?(n.consume(m),d):(n.exit(r),a(m))}}const av={tokenize:rv};function rv(n){const a=n.attempt(this.parser.constructs.contentInitial,u,s);let r;return a;function u(d){if(d===null){n.consume(d);return}return n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),Oe(n,a,"linePrefix")}function s(d){return n.enter("paragraph"),h(d)}function h(d){const m=n.enter("chunkText",{contentType:"text",previous:r});return r&&(r.next=m),r=m,f(d)}function f(d){if(d===null){n.exit("chunkText"),n.exit("paragraph"),n.consume(d);return}return he(d)?(n.consume(d),n.exit("chunkText"),h):(n.consume(d),f)}}const uv={tokenize:ov},pm={tokenize:cv};function ov(n){const a=this,r=[];let u=0,s,h,f;return d;function d(X){if(u<r.length){const oe=r[u];return a.containerState=oe[1],n.attempt(oe[0].continuation,m,p)(X)}return p(X)}function m(X){if(u++,a.containerState._closeFlow){a.containerState._closeFlow=void 0,s&&K();const oe=a.events.length;let se=oe,B;for(;se--;)if(a.events[se][0]==="exit"&&a.events[se][1].type==="chunkFlow"){B=a.events[se][1].end;break}R(u);let ee=oe;for(;ee<a.events.length;)a.events[ee][1].end={...B},ee++;return Zt(a.events,se+1,0,a.events.slice(oe)),a.events.length=ee,p(X)}return d(X)}function p(X){if(u===r.length){if(!s)return E(X);if(s.currentConstruct&&s.currentConstruct.concrete)return z(X);a.interrupt=!!(s.currentConstruct&&!s._gfmTableDynamicInterruptHack)}return a.containerState={},n.check(pm,b,y)(X)}function b(X){return s&&K(),R(u),E(X)}function y(X){return a.parser.lazy[a.now().line]=u!==r.length,f=a.now().offset,z(X)}function E(X){return a.containerState={},n.attempt(pm,S,z)(X)}function S(X){return u++,r.push([a.currentConstruct,a.containerState]),E(X)}function z(X){if(X===null){s&&K(),R(0),n.consume(X);return}return s=s||a.parser.flow(a.now()),n.enter("chunkFlow",{_tokenizer:s,contentType:"flow",previous:h}),q(X)}function q(X){if(X===null){Q(n.exit("chunkFlow"),!0),R(0),n.consume(X);return}return he(X)?(n.consume(X),Q(n.exit("chunkFlow")),u=0,a.interrupt=void 0,d):(n.consume(X),q)}function Q(X,oe){const se=a.sliceStream(X);if(oe&&se.push(null),X.previous=h,h&&(h.next=X),h=X,s.defineSkip(X.start),s.write(se),a.parser.lazy[X.start.line]){let B=s.events.length;for(;B--;)if(s.events[B][1].start.offset<f&&(!s.events[B][1].end||s.events[B][1].end.offset>f))return;const ee=a.events.length;let pe=ee,ye,L;for(;pe--;)if(a.events[pe][0]==="exit"&&a.events[pe][1].type==="chunkFlow"){if(ye){L=a.events[pe][1].end;break}ye=!0}for(R(u),B=ee;B<a.events.length;)a.events[B][1].end={...L},B++;Zt(a.events,pe+1,0,a.events.slice(ee)),a.events.length=B}}function R(X){let oe=r.length;for(;oe-- >X;){const se=r[oe];a.containerState=se[1],se[0].exit.call(a,n)}r.length=X}function K(){s.write([null]),h=void 0,s=void 0,a.containerState._closeFlow=void 0}}function cv(n,a,r){return Oe(n,n.attempt(this.parser.constructs.document,a,r),"linePrefix",this.parser.constructs.disable.null.includes("codeIndented")?void 0:4)}function Ci(n){if(n===null||Xe(n)||Ol(n))return 1;if(pu(n))return 2}function mu(n,a,r){const u=[];let s=-1;for(;++s<n.length;){const h=n[s].resolveAll;h&&!u.includes(h)&&(a=h(a,r),u.push(h))}return a}const ds={name:"attention",resolveAll:sv,tokenize:fv};function sv(n,a){let r=-1,u,s,h,f,d,m,p,b;for(;++r<n.length;)if(n[r][0]==="enter"&&n[r][1].type==="attentionSequence"&&n[r][1]._close){for(u=r;u--;)if(n[u][0]==="exit"&&n[u][1].type==="attentionSequence"&&n[u][1]._open&&a.sliceSerialize(n[u][1]).charCodeAt(0)===a.sliceSerialize(n[r][1]).charCodeAt(0)){if((n[u][1]._close||n[r][1]._open)&&(n[r][1].end.offset-n[r][1].start.offset)%3&&!((n[u][1].end.offset-n[u][1].start.offset+n[r][1].end.offset-n[r][1].start.offset)%3))continue;m=n[u][1].end.offset-n[u][1].start.offset>1&&n[r][1].end.offset-n[r][1].start.offset>1?2:1;const y={...n[u][1].end},E={...n[r][1].start};mm(y,-m),mm(E,m),f={type:m>1?"strongSequence":"emphasisSequence",start:y,end:{...n[u][1].end}},d={type:m>1?"strongSequence":"emphasisSequence",start:{...n[r][1].start},end:E},h={type:m>1?"strongText":"emphasisText",start:{...n[u][1].end},end:{...n[r][1].start}},s={type:m>1?"strong":"emphasis",start:{...f.start},end:{...d.end}},n[u][1].end={...f.start},n[r][1].start={...d.end},p=[],n[u][1].end.offset-n[u][1].start.offset&&(p=ln(p,[["enter",n[u][1],a],["exit",n[u][1],a]])),p=ln(p,[["enter",s,a],["enter",f,a],["exit",f,a],["enter",h,a]]),p=ln(p,mu(a.parser.constructs.insideSpan.null,n.slice(u+1,r),a)),p=ln(p,[["exit",h,a],["enter",d,a],["exit",d,a],["exit",s,a]]),n[r][1].end.offset-n[r][1].start.offset?(b=2,p=ln(p,[["enter",n[r][1],a],["exit",n[r][1],a]])):b=0,Zt(n,u-1,r-u+3,p),r=u+p.length-b-2;break}}for(r=-1;++r<n.length;)n[r][1].type==="attentionSequence"&&(n[r][1].type="data");return n}function fv(n,a){const r=this.parser.constructs.attentionMarkers.null,u=this.previous,s=Ci(u);let h;return f;function f(m){return h=m,n.enter("attentionSequence"),d(m)}function d(m){if(m===h)return n.consume(m),d;const p=n.exit("attentionSequence"),b=Ci(m),y=!b||b===2&&s||r.includes(m),E=!s||s===2&&b||r.includes(u);return p._open=!!(h===42?y:y&&(s||!E)),p._close=!!(h===42?E:E&&(b||!y)),a(m)}}function mm(n,a){n.column+=a,n.offset+=a,n._bufferIndex+=a}const hv={name:"autolink",tokenize:dv};function dv(n,a,r){let u=0;return s;function s(S){return n.enter("autolink"),n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.enter("autolinkProtocol"),h}function h(S){return wt(S)?(n.consume(S),f):S===64?r(S):p(S)}function f(S){return S===43||S===45||S===46||vt(S)?(u=1,d(S)):p(S)}function d(S){return S===58?(n.consume(S),u=0,m):(S===43||S===45||S===46||vt(S))&&u++<32?(n.consume(S),d):(u=0,p(S))}function m(S){return S===62?(n.exit("autolinkProtocol"),n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.exit("autolink"),a):S===null||S===32||S===60||su(S)?r(S):(n.consume(S),m)}function p(S){return S===64?(n.consume(S),b):nv(S)?(n.consume(S),p):r(S)}function b(S){return vt(S)?y(S):r(S)}function y(S){return S===46?(n.consume(S),u=0,b):S===62?(n.exit("autolinkProtocol").type="autolinkEmail",n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.exit("autolink"),a):E(S)}function E(S){if((S===45||vt(S))&&u++<63){const z=S===45?E:y;return n.consume(S),z}return r(S)}}const La={partial:!0,tokenize:pv};function pv(n,a,r){return u;function u(h){return Ce(h)?Oe(n,s,"linePrefix")(h):s(h)}function s(h){return h===null||he(h)?a(h):r(h)}}const ug={continuation:{tokenize:gv},exit:yv,name:"blockQuote",tokenize:mv};function mv(n,a,r){const u=this;return s;function s(f){if(f===62){const d=u.containerState;return d.open||(n.enter("blockQuote",{_container:!0}),d.open=!0),n.enter("blockQuotePrefix"),n.enter("blockQuoteMarker"),n.consume(f),n.exit("blockQuoteMarker"),h}return r(f)}function h(f){return Ce(f)?(n.enter("blockQuotePrefixWhitespace"),n.consume(f),n.exit("blockQuotePrefixWhitespace"),n.exit("blockQuotePrefix"),a):(n.exit("blockQuotePrefix"),a(f))}}function gv(n,a,r){const u=this;return s;function s(f){return Ce(f)?Oe(n,h,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(f):h(f)}function h(f){return n.attempt(ug,a,r)(f)}}function yv(n){n.exit("blockQuote")}const og={name:"characterEscape",tokenize:bv};function bv(n,a,r){return u;function u(h){return n.enter("characterEscape"),n.enter("escapeMarker"),n.consume(h),n.exit("escapeMarker"),s}function s(h){return iv(h)?(n.enter("characterEscapeValue"),n.consume(h),n.exit("characterEscapeValue"),n.exit("characterEscape"),a):r(h)}}const cg={name:"characterReference",tokenize:vv};function vv(n,a,r){const u=this;let s=0,h,f;return d;function d(y){return n.enter("characterReference"),n.enter("characterReferenceMarker"),n.consume(y),n.exit("characterReferenceMarker"),m}function m(y){return y===35?(n.enter("characterReferenceMarkerNumeric"),n.consume(y),n.exit("characterReferenceMarkerNumeric"),p):(n.enter("characterReferenceValue"),h=31,f=vt,b(y))}function p(y){return y===88||y===120?(n.enter("characterReferenceMarkerHexadecimal"),n.consume(y),n.exit("characterReferenceMarkerHexadecimal"),n.enter("characterReferenceValue"),h=6,f=lv,b):(n.enter("characterReferenceValue"),h=7,f=hs,b(y))}function b(y){if(y===59&&s){const E=n.exit("characterReferenceValue");return f===vt&&!_s(u.sliceSerialize(E))?r(y):(n.enter("characterReferenceMarker"),n.consume(y),n.exit("characterReferenceMarker"),n.exit("characterReference"),a)}return f(y)&&s++<h?(n.consume(y),b):r(y)}}const gm={partial:!0,tokenize:Sv},ym={concrete:!0,name:"codeFenced",tokenize:xv};function xv(n,a,r){const u=this,s={partial:!0,tokenize:se};let h=0,f=0,d;return m;function m(B){return p(B)}function p(B){const ee=u.events[u.events.length-1];return h=ee&&ee[1].type==="linePrefix"?ee[2].sliceSerialize(ee[1],!0).length:0,d=B,n.enter("codeFenced"),n.enter("codeFencedFence"),n.enter("codeFencedFenceSequence"),b(B)}function b(B){return B===d?(f++,n.consume(B),b):f<3?r(B):(n.exit("codeFencedFenceSequence"),Ce(B)?Oe(n,y,"whitespace")(B):y(B))}function y(B){return B===null||he(B)?(n.exit("codeFencedFence"),u.interrupt?a(B):n.check(gm,q,oe)(B)):(n.enter("codeFencedFenceInfo"),n.enter("chunkString",{contentType:"string"}),E(B))}function E(B){return B===null||he(B)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),y(B)):Ce(B)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),Oe(n,S,"whitespace")(B)):B===96&&B===d?r(B):(n.consume(B),E)}function S(B){return B===null||he(B)?y(B):(n.enter("codeFencedFenceMeta"),n.enter("chunkString",{contentType:"string"}),z(B))}function z(B){return B===null||he(B)?(n.exit("chunkString"),n.exit("codeFencedFenceMeta"),y(B)):B===96&&B===d?r(B):(n.consume(B),z)}function q(B){return n.attempt(s,oe,Q)(B)}function Q(B){return n.enter("lineEnding"),n.consume(B),n.exit("lineEnding"),R}function R(B){return h>0&&Ce(B)?Oe(n,K,"linePrefix",h+1)(B):K(B)}function K(B){return B===null||he(B)?n.check(gm,q,oe)(B):(n.enter("codeFlowValue"),X(B))}function X(B){return B===null||he(B)?(n.exit("codeFlowValue"),K(B)):(n.consume(B),X)}function oe(B){return n.exit("codeFenced"),a(B)}function se(B,ee,pe){let ye=0;return L;function L(W){return B.enter("lineEnding"),B.consume(W),B.exit("lineEnding"),ne}function ne(W){return B.enter("codeFencedFence"),Ce(W)?Oe(B,te,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(W):te(W)}function te(W){return W===d?(B.enter("codeFencedFenceSequence"),ke(W)):pe(W)}function ke(W){return W===d?(ye++,B.consume(W),ke):ye>=f?(B.exit("codeFencedFenceSequence"),Ce(W)?Oe(B,ae,"whitespace")(W):ae(W)):pe(W)}function ae(W){return W===null||he(W)?(B.exit("codeFencedFence"),ee(W)):pe(W)}}}function Sv(n,a,r){const u=this;return s;function s(f){return f===null?r(f):(n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),h)}function h(f){return u.parser.lazy[u.now().line]?r(f):a(f)}}const Zc={name:"codeIndented",tokenize:kv},Ev={partial:!0,tokenize:Av};function kv(n,a,r){const u=this;return s;function s(p){return n.enter("codeIndented"),Oe(n,h,"linePrefix",5)(p)}function h(p){const b=u.events[u.events.length-1];return b&&b[1].type==="linePrefix"&&b[2].sliceSerialize(b[1],!0).length>=4?f(p):r(p)}function f(p){return p===null?m(p):he(p)?n.attempt(Ev,f,m)(p):(n.enter("codeFlowValue"),d(p))}function d(p){return p===null||he(p)?(n.exit("codeFlowValue"),f(p)):(n.consume(p),d)}function m(p){return n.exit("codeIndented"),a(p)}}function Av(n,a,r){const u=this;return s;function s(f){return u.parser.lazy[u.now().line]?r(f):he(f)?(n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),s):Oe(n,h,"linePrefix",5)(f)}function h(f){const d=u.events[u.events.length-1];return d&&d[1].type==="linePrefix"&&d[2].sliceSerialize(d[1],!0).length>=4?a(f):he(f)?s(f):r(f)}}const Tv={name:"codeText",previous:Cv,resolve:wv,tokenize:zv};function wv(n){let a=n.length-4,r=3,u,s;if((n[r][1].type==="lineEnding"||n[r][1].type==="space")&&(n[a][1].type==="lineEnding"||n[a][1].type==="space")){for(u=r;++u<a;)if(n[u][1].type==="codeTextData"){n[r][1].type="codeTextPadding",n[a][1].type="codeTextPadding",r+=2,a-=2;break}}for(u=r-1,a++;++u<=a;)s===void 0?u!==a&&n[u][1].type!=="lineEnding"&&(s=u):(u===a||n[u][1].type==="lineEnding")&&(n[s][1].type="codeTextData",u!==s+2&&(n[s][1].end=n[u-1][1].end,n.splice(s+2,u-s-2),a-=u-s-2,u=s+2),s=void 0);return n}function Cv(n){return n!==96||this.events[this.events.length-1][1].type==="characterEscape"}function zv(n,a,r){let u=0,s,h;return f;function f(y){return n.enter("codeText"),n.enter("codeTextSequence"),d(y)}function d(y){return y===96?(n.consume(y),u++,d):(n.exit("codeTextSequence"),m(y))}function m(y){return y===null?r(y):y===32?(n.enter("space"),n.consume(y),n.exit("space"),m):y===96?(h=n.enter("codeTextSequence"),s=0,b(y)):he(y)?(n.enter("lineEnding"),n.consume(y),n.exit("lineEnding"),m):(n.enter("codeTextData"),p(y))}function p(y){return y===null||y===32||y===96||he(y)?(n.exit("codeTextData"),m(y)):(n.consume(y),p)}function b(y){return y===96?(n.consume(y),s++,b):s===u?(n.exit("codeTextSequence"),n.exit("codeText"),a(y)):(h.type="codeTextData",p(y))}}class Dv{constructor(a){this.left=a?[...a]:[],this.right=[]}get(a){if(a<0||a>=this.left.length+this.right.length)throw new RangeError("Cannot access index `"+a+"` in a splice buffer of size `"+(this.left.length+this.right.length)+"`");return a<this.left.length?this.left[a]:this.right[this.right.length-a+this.left.length-1]}get length(){return this.left.length+this.right.length}shift(){return this.setCursor(0),this.right.pop()}slice(a,r){const u=r??Number.POSITIVE_INFINITY;return u<this.left.length?this.left.slice(a,u):a>this.left.length?this.right.slice(this.right.length-u+this.left.length,this.right.length-a+this.left.length).reverse():this.left.slice(a).concat(this.right.slice(this.right.length-u+this.left.length).reverse())}splice(a,r,u){const s=r||0;this.setCursor(Math.trunc(a));const h=this.right.splice(this.right.length-s,Number.POSITIVE_INFINITY);return u&&wa(this.left,u),h.reverse()}pop(){return this.setCursor(Number.POSITIVE_INFINITY),this.left.pop()}push(a){this.setCursor(Number.POSITIVE_INFINITY),this.left.push(a)}pushMany(a){this.setCursor(Number.POSITIVE_INFINITY),wa(this.left,a)}unshift(a){this.setCursor(0),this.right.push(a)}unshiftMany(a){this.setCursor(0),wa(this.right,a.reverse())}setCursor(a){if(!(a===this.left.length||a>this.left.length&&this.right.length===0||a<0&&this.left.length===0))if(a<this.left.length){const r=this.left.splice(a,Number.POSITIVE_INFINITY);wa(this.right,r.reverse())}else{const r=this.right.splice(this.left.length+this.right.length-a,Number.POSITIVE_INFINITY);wa(this.left,r.reverse())}}}function wa(n,a){let r=0;if(a.length<1e4)n.push(...a);else for(;r<a.length;)n.push(...a.slice(r,r+1e4)),r+=1e4}function sg(n){const a={};let r=-1,u,s,h,f,d,m,p;const b=new Dv(n);for(;++r<b.length;){for(;r in a;)r=a[r];if(u=b.get(r),r&&u[1].type==="chunkFlow"&&b.get(r-1)[1].type==="listItemPrefix"&&(m=u[1]._tokenizer.events,h=0,h<m.length&&m[h][1].type==="lineEndingBlank"&&(h+=2),h<m.length&&m[h][1].type==="content"))for(;++h<m.length&&m[h][1].type!=="content";)m[h][1].type==="chunkText"&&(m[h][1]._isInFirstContentOfListItem=!0,h++);if(u[0]==="enter")u[1].contentType&&(Object.assign(a,_v(b,r)),r=a[r],p=!0);else if(u[1]._container){for(h=r,s=void 0;h--;)if(f=b.get(h),f[1].type==="lineEnding"||f[1].type==="lineEndingBlank")f[0]==="enter"&&(s&&(b.get(s)[1].type="lineEndingBlank"),f[1].type="lineEnding",s=h);else if(!(f[1].type==="linePrefix"||f[1].type==="listItemIndent"))break;s&&(u[1].end={...b.get(s)[1].start},d=b.slice(s,r),d.unshift(u),b.splice(s,r-s+1,d))}}return Zt(n,0,Number.POSITIVE_INFINITY,b.slice(0)),!p}function _v(n,a){const r=n.get(a)[1],u=n.get(a)[2];let s=a-1;const h=[];let f=r._tokenizer;f||(f=u.parser[r.contentType](r.start),r._contentTypeTextTrailing&&(f._contentTypeTextTrailing=!0));const d=f.events,m=[],p={};let b,y,E=-1,S=r,z=0,q=0;const Q=[q];for(;S;){for(;n.get(++s)[1]!==S;);h.push(s),S._tokenizer||(b=u.sliceStream(S),S.next||b.push(null),y&&f.defineSkip(S.start),S._isInFirstContentOfListItem&&(f._gfmTasklistFirstContentOfListItem=!0),f.write(b),S._isInFirstContentOfListItem&&(f._gfmTasklistFirstContentOfListItem=void 0)),y=S,S=S.next}for(S=r;++E<d.length;)d[E][0]==="exit"&&d[E-1][0]==="enter"&&d[E][1].type===d[E-1][1].type&&d[E][1].start.line!==d[E][1].end.line&&(q=E+1,Q.push(q),S._tokenizer=void 0,S.previous=void 0,S=S.next);for(f.events=[],S?(S._tokenizer=void 0,S.previous=void 0):Q.pop(),E=Q.length;E--;){const R=d.slice(Q[E],Q[E+1]),K=h.pop();m.push([K,K+R.length-1]),n.splice(K,2,R)}for(m.reverse(),E=-1;++E<m.length;)p[z+m[E][0]]=z+m[E][1],z+=m[E][1]-m[E][0]-1;return p}const Ov={resolve:Rv,tokenize:Nv},Mv={partial:!0,tokenize:Lv};function Rv(n){return sg(n),n}function Nv(n,a){let r;return u;function u(d){return n.enter("content"),r=n.enter("chunkContent",{contentType:"content"}),s(d)}function s(d){return d===null?h(d):he(d)?n.check(Mv,f,h)(d):(n.consume(d),s)}function h(d){return n.exit("chunkContent"),n.exit("content"),a(d)}function f(d){return n.consume(d),n.exit("chunkContent"),r.next=n.enter("chunkContent",{contentType:"content",previous:r}),r=r.next,s}}function Lv(n,a,r){const u=this;return s;function s(f){return n.exit("chunkContent"),n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),Oe(n,h,"linePrefix")}function h(f){if(f===null||he(f))return r(f);const d=u.events[u.events.length-1];return!u.parser.constructs.disable.null.includes("codeIndented")&&d&&d[1].type==="linePrefix"&&d[2].sliceSerialize(d[1],!0).length>=4?a(f):n.interrupt(u.parser.constructs.flow,r,a)(f)}}function fg(n,a,r,u,s,h,f,d,m){const p=m||Number.POSITIVE_INFINITY;let b=0;return y;function y(R){return R===60?(n.enter(u),n.enter(s),n.enter(h),n.consume(R),n.exit(h),E):R===null||R===32||R===41||su(R)?r(R):(n.enter(u),n.enter(f),n.enter(d),n.enter("chunkString",{contentType:"string"}),q(R))}function E(R){return R===62?(n.enter(h),n.consume(R),n.exit(h),n.exit(s),n.exit(u),a):(n.enter(d),n.enter("chunkString",{contentType:"string"}),S(R))}function S(R){return R===62?(n.exit("chunkString"),n.exit(d),E(R)):R===null||R===60||he(R)?r(R):(n.consume(R),R===92?z:S)}function z(R){return R===60||R===62||R===92?(n.consume(R),S):S(R)}function q(R){return!b&&(R===null||R===41||Xe(R))?(n.exit("chunkString"),n.exit(d),n.exit(f),n.exit(u),a(R)):b<p&&R===40?(n.consume(R),b++,q):R===41?(n.consume(R),b--,q):R===null||R===32||R===40||su(R)?r(R):(n.consume(R),R===92?Q:q)}function Q(R){return R===40||R===41||R===92?(n.consume(R),q):q(R)}}function hg(n,a,r,u,s,h){const f=this;let d=0,m;return p;function p(S){return n.enter(u),n.enter(s),n.consume(S),n.exit(s),n.enter(h),b}function b(S){return d>999||S===null||S===91||S===93&&!m||S===94&&!d&&"_hiddenFootnoteSupport"in f.parser.constructs?r(S):S===93?(n.exit(h),n.enter(s),n.consume(S),n.exit(s),n.exit(u),a):he(S)?(n.enter("lineEnding"),n.consume(S),n.exit("lineEnding"),b):(n.enter("chunkString",{contentType:"string"}),y(S))}function y(S){return S===null||S===91||S===93||he(S)||d++>999?(n.exit("chunkString"),b(S)):(n.consume(S),m||(m=!Ce(S)),S===92?E:y)}function E(S){return S===91||S===92||S===93?(n.consume(S),d++,y):y(S)}}function dg(n,a,r,u,s,h){let f;return d;function d(E){return E===34||E===39||E===40?(n.enter(u),n.enter(s),n.consume(E),n.exit(s),f=E===40?41:E,m):r(E)}function m(E){return E===f?(n.enter(s),n.consume(E),n.exit(s),n.exit(u),a):(n.enter(h),p(E))}function p(E){return E===f?(n.exit(h),m(f)):E===null?r(E):he(E)?(n.enter("lineEnding"),n.consume(E),n.exit("lineEnding"),Oe(n,p,"linePrefix")):(n.enter("chunkString",{contentType:"string"}),b(E))}function b(E){return E===f||E===null||he(E)?(n.exit("chunkString"),p(E)):(n.consume(E),E===92?y:b)}function y(E){return E===f||E===92?(n.consume(E),b):b(E)}}function _a(n,a){let r;return u;function u(s){return he(s)?(n.enter("lineEnding"),n.consume(s),n.exit("lineEnding"),r=!0,u):Ce(s)?Oe(n,u,r?"linePrefix":"lineSuffix")(s):a(s)}}const Uv={name:"definition",tokenize:Bv},jv={partial:!0,tokenize:Hv};function Bv(n,a,r){const u=this;let s;return h;function h(S){return n.enter("definition"),f(S)}function f(S){return hg.call(u,n,d,r,"definitionLabel","definitionLabelMarker","definitionLabelString")(S)}function d(S){return s=cn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)),S===58?(n.enter("definitionMarker"),n.consume(S),n.exit("definitionMarker"),m):r(S)}function m(S){return Xe(S)?_a(n,p)(S):p(S)}function p(S){return fg(n,b,r,"definitionDestination","definitionDestinationLiteral","definitionDestinationLiteralMarker","definitionDestinationRaw","definitionDestinationString")(S)}function b(S){return n.attempt(jv,y,y)(S)}function y(S){return Ce(S)?Oe(n,E,"whitespace")(S):E(S)}function E(S){return S===null||he(S)?(n.exit("definition"),u.parser.defined.push(s),a(S)):r(S)}}function Hv(n,a,r){return u;function u(d){return Xe(d)?_a(n,s)(d):r(d)}function s(d){return dg(n,h,r,"definitionTitle","definitionTitleMarker","definitionTitleString")(d)}function h(d){return Ce(d)?Oe(n,f,"whitespace")(d):f(d)}function f(d){return d===null||he(d)?a(d):r(d)}}const qv={name:"hardBreakEscape",tokenize:Yv};function Yv(n,a,r){return u;function u(h){return n.enter("hardBreakEscape"),n.consume(h),s}function s(h){return he(h)?(n.exit("hardBreakEscape"),a(h)):r(h)}}const Vv={name:"headingAtx",resolve:Gv,tokenize:Xv};function Gv(n,a){let r=n.length-2,u=3,s,h;return n[u][1].type==="whitespace"&&(u+=2),r-2>u&&n[r][1].type==="whitespace"&&(r-=2),n[r][1].type==="atxHeadingSequence"&&(u===r-1||r-4>u&&n[r-2][1].type==="whitespace")&&(r-=u+1===r?2:4),r>u&&(s={type:"atxHeadingText",start:n[u][1].start,end:n[r][1].end},h={type:"chunkText",start:n[u][1].start,end:n[r][1].end,contentType:"text"},Zt(n,u,r-u+1,[["enter",s,a],["enter",h,a],["exit",h,a],["exit",s,a]])),n}function Xv(n,a,r){let u=0;return s;function s(b){return n.enter("atxHeading"),h(b)}function h(b){return n.enter("atxHeadingSequence"),f(b)}function f(b){return b===35&&u++<6?(n.consume(b),f):b===null||Xe(b)?(n.exit("atxHeadingSequence"),d(b)):r(b)}function d(b){return b===35?(n.enter("atxHeadingSequence"),m(b)):b===null||he(b)?(n.exit("atxHeading"),a(b)):Ce(b)?Oe(n,d,"whitespace")(b):(n.enter("atxHeadingText"),p(b))}function m(b){return b===35?(n.consume(b),m):(n.exit("atxHeadingSequence"),d(b))}function p(b){return b===null||b===35||Xe(b)?(n.exit("atxHeadingText"),d(b)):(n.consume(b),p)}}const Qv=["address","article","aside","base","basefont","blockquote","body","caption","center","col","colgroup","dd","details","dialog","dir","div","dl","dt","fieldset","figcaption","figure","footer","form","frame","frameset","h1","h2","h3","h4","h5","h6","head","header","hr","html","iframe","legend","li","link","main","menu","menuitem","nav","noframes","ol","optgroup","option","p","param","search","section","summary","table","tbody","td","tfoot","th","thead","title","tr","track","ul"],bm=["pre","script","style","textarea"],Zv={concrete:!0,name:"htmlFlow",resolveTo:Kv,tokenize:Jv},Fv={partial:!0,tokenize:Wv},Iv={partial:!0,tokenize:$v};function Kv(n){let a=n.length;for(;a--&&!(n[a][0]==="enter"&&n[a][1].type==="htmlFlow"););return a>1&&n[a-2][1].type==="linePrefix"&&(n[a][1].start=n[a-2][1].start,n[a+1][1].start=n[a-2][1].start,n.splice(a-2,2)),n}function Jv(n,a,r){const u=this;let s,h,f,d,m;return p;function p(v){return b(v)}function b(v){return n.enter("htmlFlow"),n.enter("htmlFlowData"),n.consume(v),y}function y(v){return v===33?(n.consume(v),E):v===47?(n.consume(v),h=!0,q):v===63?(n.consume(v),s=3,u.interrupt?a:k):wt(v)?(n.consume(v),f=String.fromCharCode(v),Q):r(v)}function E(v){return v===45?(n.consume(v),s=2,S):v===91?(n.consume(v),s=5,d=0,z):wt(v)?(n.consume(v),s=4,u.interrupt?a:k):r(v)}function S(v){return v===45?(n.consume(v),u.interrupt?a:k):r(v)}function z(v){const j="CDATA[";return v===j.charCodeAt(d++)?(n.consume(v),d===j.length?u.interrupt?a:te:z):r(v)}function q(v){return wt(v)?(n.consume(v),f=String.fromCharCode(v),Q):r(v)}function Q(v){if(v===null||v===47||v===62||Xe(v)){const j=v===47,$=f.toLowerCase();return!j&&!h&&bm.includes($)?(s=1,u.interrupt?a(v):te(v)):Qv.includes(f.toLowerCase())?(s=6,j?(n.consume(v),R):u.interrupt?a(v):te(v)):(s=7,u.interrupt&&!u.parser.lazy[u.now().line]?r(v):h?K(v):X(v))}return v===45||vt(v)?(n.consume(v),f+=String.fromCharCode(v),Q):r(v)}function R(v){return v===62?(n.consume(v),u.interrupt?a:te):r(v)}function K(v){return Ce(v)?(n.consume(v),K):L(v)}function X(v){return v===47?(n.consume(v),L):v===58||v===95||wt(v)?(n.consume(v),oe):Ce(v)?(n.consume(v),X):L(v)}function oe(v){return v===45||v===46||v===58||v===95||vt(v)?(n.consume(v),oe):se(v)}function se(v){return v===61?(n.consume(v),B):Ce(v)?(n.consume(v),se):X(v)}function B(v){return v===null||v===60||v===61||v===62||v===96?r(v):v===34||v===39?(n.consume(v),m=v,ee):Ce(v)?(n.consume(v),B):pe(v)}function ee(v){return v===m?(n.consume(v),m=null,ye):v===null||he(v)?r(v):(n.consume(v),ee)}function pe(v){return v===null||v===34||v===39||v===47||v===60||v===61||v===62||v===96||Xe(v)?se(v):(n.consume(v),pe)}function ye(v){return v===47||v===62||Ce(v)?X(v):r(v)}function L(v){return v===62?(n.consume(v),ne):r(v)}function ne(v){return v===null||he(v)?te(v):Ce(v)?(n.consume(v),ne):r(v)}function te(v){return v===45&&s===2?(n.consume(v),M):v===60&&s===1?(n.consume(v),F):v===62&&s===4?(n.consume(v),T):v===63&&s===3?(n.consume(v),k):v===93&&s===5?(n.consume(v),xe):he(v)&&(s===6||s===7)?(n.exit("htmlFlowData"),n.check(Fv,C,ke)(v)):v===null||he(v)?(n.exit("htmlFlowData"),ke(v)):(n.consume(v),te)}function ke(v){return n.check(Iv,ae,C)(v)}function ae(v){return n.enter("lineEnding"),n.consume(v),n.exit("lineEnding"),W}function W(v){return v===null||he(v)?ke(v):(n.enter("htmlFlowData"),te(v))}function M(v){return v===45?(n.consume(v),k):te(v)}function F(v){return v===47?(n.consume(v),f="",re):te(v)}function re(v){if(v===62){const j=f.toLowerCase();return bm.includes(j)?(n.consume(v),T):te(v)}return wt(v)&&f.length<8?(n.consume(v),f+=String.fromCharCode(v),re):te(v)}function xe(v){return v===93?(n.consume(v),k):te(v)}function k(v){return v===62?(n.consume(v),T):v===45&&s===2?(n.consume(v),k):te(v)}function T(v){return v===null||he(v)?(n.exit("htmlFlowData"),C(v)):(n.consume(v),T)}function C(v){return n.exit("htmlFlow"),a(v)}}function $v(n,a,r){const u=this;return s;function s(f){return he(f)?(n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),h):r(f)}function h(f){return u.parser.lazy[u.now().line]?r(f):a(f)}}function Wv(n,a,r){return u;function u(s){return n.enter("lineEnding"),n.consume(s),n.exit("lineEnding"),n.attempt(La,a,r)}}const Pv={name:"htmlText",tokenize:ex};function ex(n,a,r){const u=this;let s,h,f;return d;function d(k){return n.enter("htmlText"),n.enter("htmlTextData"),n.consume(k),m}function m(k){return k===33?(n.consume(k),p):k===47?(n.consume(k),se):k===63?(n.consume(k),X):wt(k)?(n.consume(k),pe):r(k)}function p(k){return k===45?(n.consume(k),b):k===91?(n.consume(k),h=0,z):wt(k)?(n.consume(k),K):r(k)}function b(k){return k===45?(n.consume(k),S):r(k)}function y(k){return k===null?r(k):k===45?(n.consume(k),E):he(k)?(f=y,F(k)):(n.consume(k),y)}function E(k){return k===45?(n.consume(k),S):y(k)}function S(k){return k===62?M(k):k===45?E(k):y(k)}function z(k){const T="CDATA[";return k===T.charCodeAt(h++)?(n.consume(k),h===T.length?q:z):r(k)}function q(k){return k===null?r(k):k===93?(n.consume(k),Q):he(k)?(f=q,F(k)):(n.consume(k),q)}function Q(k){return k===93?(n.consume(k),R):q(k)}function R(k){return k===62?M(k):k===93?(n.consume(k),R):q(k)}function K(k){return k===null||k===62?M(k):he(k)?(f=K,F(k)):(n.consume(k),K)}function X(k){return k===null?r(k):k===63?(n.consume(k),oe):he(k)?(f=X,F(k)):(n.consume(k),X)}function oe(k){return k===62?M(k):X(k)}function se(k){return wt(k)?(n.consume(k),B):r(k)}function B(k){return k===45||vt(k)?(n.consume(k),B):ee(k)}function ee(k){return he(k)?(f=ee,F(k)):Ce(k)?(n.consume(k),ee):M(k)}function pe(k){return k===45||vt(k)?(n.consume(k),pe):k===47||k===62||Xe(k)?ye(k):r(k)}function ye(k){return k===47?(n.consume(k),M):k===58||k===95||wt(k)?(n.consume(k),L):he(k)?(f=ye,F(k)):Ce(k)?(n.consume(k),ye):M(k)}function L(k){return k===45||k===46||k===58||k===95||vt(k)?(n.consume(k),L):ne(k)}function ne(k){return k===61?(n.consume(k),te):he(k)?(f=ne,F(k)):Ce(k)?(n.consume(k),ne):ye(k)}function te(k){return k===null||k===60||k===61||k===62||k===96?r(k):k===34||k===39?(n.consume(k),s=k,ke):he(k)?(f=te,F(k)):Ce(k)?(n.consume(k),te):(n.consume(k),ae)}function ke(k){return k===s?(n.consume(k),s=void 0,W):k===null?r(k):he(k)?(f=ke,F(k)):(n.consume(k),ke)}function ae(k){return k===null||k===34||k===39||k===60||k===61||k===96?r(k):k===47||k===62||Xe(k)?ye(k):(n.consume(k),ae)}function W(k){return k===47||k===62||Xe(k)?ye(k):r(k)}function M(k){return k===62?(n.consume(k),n.exit("htmlTextData"),n.exit("htmlText"),a):r(k)}function F(k){return n.exit("htmlTextData"),n.enter("lineEnding"),n.consume(k),n.exit("lineEnding"),re}function re(k){return Ce(k)?Oe(n,xe,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(k):xe(k)}function xe(k){return n.enter("htmlTextData"),f(k)}}const Os={name:"labelEnd",resolveAll:ix,resolveTo:ax,tokenize:rx},tx={tokenize:ux},nx={tokenize:ox},lx={tokenize:cx};function ix(n){let a=-1;const r=[];for(;++a<n.length;){const u=n[a][1];if(r.push(n[a]),u.type==="labelImage"||u.type==="labelLink"||u.type==="labelEnd"){const s=u.type==="labelImage"?4:2;u.type="data",a+=s}}return n.length!==r.length&&Zt(n,0,n.length,r),n}function ax(n,a){let r=n.length,u=0,s,h,f,d;for(;r--;)if(s=n[r][1],h){if(s.type==="link"||s.type==="labelLink"&&s._inactive)break;n[r][0]==="enter"&&s.type==="labelLink"&&(s._inactive=!0)}else if(f){if(n[r][0]==="enter"&&(s.type==="labelImage"||s.type==="labelLink")&&!s._balanced&&(h=r,s.type!=="labelLink")){u=2;break}}else s.type==="labelEnd"&&(f=r);const m={type:n[h][1].type==="labelLink"?"link":"image",start:{...n[h][1].start},end:{...n[n.length-1][1].end}},p={type:"label",start:{...n[h][1].start},end:{...n[f][1].end}},b={type:"labelText",start:{...n[h+u+2][1].end},end:{...n[f-2][1].start}};return d=[["enter",m,a],["enter",p,a]],d=ln(d,n.slice(h+1,h+u+3)),d=ln(d,[["enter",b,a]]),d=ln(d,mu(a.parser.constructs.insideSpan.null,n.slice(h+u+4,f-3),a)),d=ln(d,[["exit",b,a],n[f-2],n[f-1],["exit",p,a]]),d=ln(d,n.slice(f+1)),d=ln(d,[["exit",m,a]]),Zt(n,h,n.length,d),n}function rx(n,a,r){const u=this;let s=u.events.length,h,f;for(;s--;)if((u.events[s][1].type==="labelImage"||u.events[s][1].type==="labelLink")&&!u.events[s][1]._balanced){h=u.events[s][1];break}return d;function d(E){return h?h._inactive?y(E):(f=u.parser.defined.includes(cn(u.sliceSerialize({start:h.end,end:u.now()}))),n.enter("labelEnd"),n.enter("labelMarker"),n.consume(E),n.exit("labelMarker"),n.exit("labelEnd"),m):r(E)}function m(E){return E===40?n.attempt(tx,b,f?b:y)(E):E===91?n.attempt(nx,b,f?p:y)(E):f?b(E):y(E)}function p(E){return n.attempt(lx,b,y)(E)}function b(E){return a(E)}function y(E){return h._balanced=!0,r(E)}}function ux(n,a,r){return u;function u(y){return n.enter("resource"),n.enter("resourceMarker"),n.consume(y),n.exit("resourceMarker"),s}function s(y){return Xe(y)?_a(n,h)(y):h(y)}function h(y){return y===41?b(y):fg(n,f,d,"resourceDestination","resourceDestinationLiteral","resourceDestinationLiteralMarker","resourceDestinationRaw","resourceDestinationString",32)(y)}function f(y){return Xe(y)?_a(n,m)(y):b(y)}function d(y){return r(y)}function m(y){return y===34||y===39||y===40?dg(n,p,r,"resourceTitle","resourceTitleMarker","resourceTitleString")(y):b(y)}function p(y){return Xe(y)?_a(n,b)(y):b(y)}function b(y){return y===41?(n.enter("resourceMarker"),n.consume(y),n.exit("resourceMarker"),n.exit("resource"),a):r(y)}}function ox(n,a,r){const u=this;return s;function s(d){return hg.call(u,n,h,f,"reference","referenceMarker","referenceString")(d)}function h(d){return u.parser.defined.includes(cn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)))?a(d):r(d)}function f(d){return r(d)}}function cx(n,a,r){return u;function u(h){return n.enter("reference"),n.enter("referenceMarker"),n.consume(h),n.exit("referenceMarker"),s}function s(h){return h===93?(n.enter("referenceMarker"),n.consume(h),n.exit("referenceMarker"),n.exit("reference"),a):r(h)}}const sx={name:"labelStartImage",resolveAll:Os.resolveAll,tokenize:fx};function fx(n,a,r){const u=this;return s;function s(d){return n.enter("labelImage"),n.enter("labelImageMarker"),n.consume(d),n.exit("labelImageMarker"),h}function h(d){return d===91?(n.enter("labelMarker"),n.consume(d),n.exit("labelMarker"),n.exit("labelImage"),f):r(d)}function f(d){return d===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(d):a(d)}}const hx={name:"labelStartLink",resolveAll:Os.resolveAll,tokenize:dx};function dx(n,a,r){const u=this;return s;function s(f){return n.enter("labelLink"),n.enter("labelMarker"),n.consume(f),n.exit("labelMarker"),n.exit("labelLink"),h}function h(f){return f===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(f):a(f)}}const Fc={name:"lineEnding",tokenize:px};function px(n,a){return r;function r(u){return n.enter("lineEnding"),n.consume(u),n.exit("lineEnding"),Oe(n,a,"linePrefix")}}const cu={name:"thematicBreak",tokenize:mx};function mx(n,a,r){let u=0,s;return h;function h(p){return n.enter("thematicBreak"),f(p)}function f(p){return s=p,d(p)}function d(p){return p===s?(n.enter("thematicBreakSequence"),m(p)):u>=3&&(p===null||he(p))?(n.exit("thematicBreak"),a(p)):r(p)}function m(p){return p===s?(n.consume(p),u++,m):(n.exit("thematicBreakSequence"),Ce(p)?Oe(n,d,"whitespace")(p):d(p))}}const Lt={continuation:{tokenize:vx},exit:Sx,name:"list",tokenize:bx},gx={partial:!0,tokenize:Ex},yx={partial:!0,tokenize:xx};function bx(n,a,r){const u=this,s=u.events[u.events.length-1];let h=s&&s[1].type==="linePrefix"?s[2].sliceSerialize(s[1],!0).length:0,f=0;return d;function d(S){const z=u.containerState.type||(S===42||S===43||S===45?"listUnordered":"listOrdered");if(z==="listUnordered"?!u.containerState.marker||S===u.containerState.marker:hs(S)){if(u.containerState.type||(u.containerState.type=z,n.enter(z,{_container:!0})),z==="listUnordered")return n.enter("listItemPrefix"),S===42||S===45?n.check(cu,r,p)(S):p(S);if(!u.interrupt||S===49)return n.enter("listItemPrefix"),n.enter("listItemValue"),m(S)}return r(S)}function m(S){return hs(S)&&++f<10?(n.consume(S),m):(!u.interrupt||f<2)&&(u.containerState.marker?S===u.containerState.marker:S===41||S===46)?(n.exit("listItemValue"),p(S)):r(S)}function p(S){return n.enter("listItemMarker"),n.consume(S),n.exit("listItemMarker"),u.containerState.marker=u.containerState.marker||S,n.check(La,u.interrupt?r:b,n.attempt(gx,E,y))}function b(S){return u.containerState.initialBlankLine=!0,h++,E(S)}function y(S){return Ce(S)?(n.enter("listItemPrefixWhitespace"),n.consume(S),n.exit("listItemPrefixWhitespace"),E):r(S)}function E(S){return u.containerState.size=h+u.sliceSerialize(n.exit("listItemPrefix"),!0).length,a(S)}}function vx(n,a,r){const u=this;return u.containerState._closeFlow=void 0,n.check(La,s,h);function s(d){return u.containerState.furtherBlankLines=u.containerState.furtherBlankLines||u.containerState.initialBlankLine,Oe(n,a,"listItemIndent",u.containerState.size+1)(d)}function h(d){return u.containerState.furtherBlankLines||!Ce(d)?(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,f(d)):(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,n.attempt(yx,a,f)(d))}function f(d){return u.containerState._closeFlow=!0,u.interrupt=void 0,Oe(n,n.attempt(Lt,a,r),"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(d)}}function xx(n,a,r){const u=this;return Oe(n,s,"listItemIndent",u.containerState.size+1);function s(h){const f=u.events[u.events.length-1];return f&&f[1].type==="listItemIndent"&&f[2].sliceSerialize(f[1],!0).length===u.containerState.size?a(h):r(h)}}function Sx(n){n.exit(this.containerState.type)}function Ex(n,a,r){const u=this;return Oe(n,s,"listItemPrefixWhitespace",u.parser.constructs.disable.null.includes("codeIndented")?void 0:5);function s(h){const f=u.events[u.events.length-1];return!Ce(h)&&f&&f[1].type==="listItemPrefixWhitespace"?a(h):r(h)}}const vm={name:"setextUnderline",resolveTo:kx,tokenize:Ax};function kx(n,a){let r=n.length,u,s,h;for(;r--;)if(n[r][0]==="enter"){if(n[r][1].type==="content"){u=r;break}n[r][1].type==="paragraph"&&(s=r)}else n[r][1].type==="content"&&n.splice(r,1),!h&&n[r][1].type==="definition"&&(h=r);const f={type:"setextHeading",start:{...n[u][1].start},end:{...n[n.length-1][1].end}};return n[s][1].type="setextHeadingText",h?(n.splice(s,0,["enter",f,a]),n.splice(h+1,0,["exit",n[u][1],a]),n[u][1].end={...n[h][1].end}):n[u][1]=f,n.push(["exit",f,a]),n}function Ax(n,a,r){const u=this;let s;return h;function h(p){let b=u.events.length,y;for(;b--;)if(u.events[b][1].type!=="lineEnding"&&u.events[b][1].type!=="linePrefix"&&u.events[b][1].type!=="content"){y=u.events[b][1].type==="paragraph";break}return!u.parser.lazy[u.now().line]&&(u.interrupt||y)?(n.enter("setextHeadingLine"),s=p,f(p)):r(p)}function f(p){return n.enter("setextHeadingLineSequence"),d(p)}function d(p){return p===s?(n.consume(p),d):(n.exit("setextHeadingLineSequence"),Ce(p)?Oe(n,m,"lineSuffix")(p):m(p))}function m(p){return p===null||he(p)?(n.exit("setextHeadingLine"),a(p)):r(p)}}const Tx={tokenize:wx};function wx(n){const a=this,r=n.attempt(La,u,n.attempt(this.parser.constructs.flowInitial,s,Oe(n,n.attempt(this.parser.constructs.flow,s,n.attempt(Ov,s)),"linePrefix")));return r;function u(h){if(h===null){n.consume(h);return}return n.enter("lineEndingBlank"),n.consume(h),n.exit("lineEndingBlank"),a.currentConstruct=void 0,r}function s(h){if(h===null){n.consume(h);return}return n.enter("lineEnding"),n.consume(h),n.exit("lineEnding"),a.currentConstruct=void 0,r}}const Cx={resolveAll:mg()},zx=pg("string"),Dx=pg("text");function pg(n){return{resolveAll:mg(n==="text"?_x:void 0),tokenize:a};function a(r){const u=this,s=this.parser.constructs[n],h=r.attempt(s,f,d);return f;function f(b){return p(b)?h(b):d(b)}function d(b){if(b===null){r.consume(b);return}return r.enter("data"),r.consume(b),m}function m(b){return p(b)?(r.exit("data"),h(b)):(r.consume(b),m)}function p(b){if(b===null)return!0;const y=s[b];let E=-1;if(y)for(;++E<y.length;){const S=y[E];if(!S.previous||S.previous.call(u,u.previous))return!0}return!1}}}function mg(n){return a;function a(r,u){let s=-1,h;for(;++s<=r.length;)h===void 0?r[s]&&r[s][1].type==="data"&&(h=s,s++):(!r[s]||r[s][1].type!=="data")&&(s!==h+2&&(r[h][1].end=r[s-1][1].end,r.splice(h+2,s-h-2),s=h+2),h=void 0);return n?n(r,u):r}}function _x(n,a){let r=0;for(;++r<=n.length;)if((r===n.length||n[r][1].type==="lineEnding")&&n[r-1][1].type==="data"){const u=n[r-1][1],s=a.sliceStream(u);let h=s.length,f=-1,d=0,m;for(;h--;){const p=s[h];if(typeof p=="string"){for(f=p.length;p.charCodeAt(f-1)===32;)d++,f--;if(f)break;f=-1}else if(p===-2)m=!0,d++;else if(p!==-1){h++;break}}if(a._contentTypeTextTrailing&&r===n.length&&(d=0),d){const p={type:r===n.length||m||d<2?"lineSuffix":"hardBreakTrailing",start:{_bufferIndex:h?f:u.start._bufferIndex+f,_index:u.start._index+h,line:u.end.line,column:u.end.column-d,offset:u.end.offset-d},end:{...u.end}};u.end={...p.start},u.start.offset===u.end.offset?Object.assign(u,p):(n.splice(r,0,["enter",p,a],["exit",p,a]),r+=2)}r++}return n}const Ox={42:Lt,43:Lt,45:Lt,48:Lt,49:Lt,50:Lt,51:Lt,52:Lt,53:Lt,54:Lt,55:Lt,56:Lt,57:Lt,62:ug},Mx={91:Uv},Rx={[-2]:Zc,[-1]:Zc,32:Zc},Nx={35:Vv,42:cu,45:[vm,cu],60:Zv,61:vm,95:cu,96:ym,126:ym},Lx={38:cg,92:og},Ux={[-5]:Fc,[-4]:Fc,[-3]:Fc,33:sx,38:cg,42:ds,60:[hv,Pv],91:hx,92:[qv,og],93:Os,95:ds,96:Tv},jx={null:[ds,Cx]},Bx={null:[42,95]},Hx={null:[]},qx=Object.freeze(Object.defineProperty({__proto__:null,attentionMarkers:Bx,contentInitial:Mx,disable:Hx,document:Ox,flow:Nx,flowInitial:Rx,insideSpan:jx,string:Lx,text:Ux},Symbol.toStringTag,{value:"Module"}));function Yx(n,a,r){let u={_bufferIndex:-1,_index:0,line:r&&r.line||1,column:r&&r.column||1,offset:r&&r.offset||0};const s={},h=[];let f=[],d=[];const m={attempt:ee(se),check:ee(B),consume:K,enter:X,exit:oe,interrupt:ee(B,{interrupt:!0})},p={code:null,containerState:{},defineSkip:q,events:[],now:z,parser:n,previous:null,sliceSerialize:E,sliceStream:S,write:y};let b=a.tokenize.call(p,m);return a.resolveAll&&h.push(a),p;function y(ne){return f=ln(f,ne),Q(),f[f.length-1]!==null?[]:(pe(a,0),p.events=mu(h,p.events,p),p.events)}function E(ne,te){return Gx(S(ne),te)}function S(ne){return Vx(f,ne)}function z(){const{_bufferIndex:ne,_index:te,line:ke,column:ae,offset:W}=u;return{_bufferIndex:ne,_index:te,line:ke,column:ae,offset:W}}function q(ne){s[ne.line]=ne.column,L()}function Q(){let ne;for(;u._index<f.length;){const te=f[u._index];if(typeof te=="string")for(ne=u._index,u._bufferIndex<0&&(u._bufferIndex=0);u._index===ne&&u._bufferIndex<te.length;)R(te.charCodeAt(u._bufferIndex));else R(te)}}function R(ne){b=b(ne)}function K(ne){he(ne)?(u.line++,u.column=1,u.offset+=ne===-3?2:1,L()):ne!==-1&&(u.column++,u.offset++),u._bufferIndex<0?u._index++:(u._bufferIndex++,u._bufferIndex===f[u._index].length&&(u._bufferIndex=-1,u._index++)),p.previous=ne}function X(ne,te){const ke=te||{};return ke.type=ne,ke.start=z(),p.events.push(["enter",ke,p]),d.push(ke),ke}function oe(ne){const te=d.pop();return te.end=z(),p.events.push(["exit",te,p]),te}function se(ne,te){pe(ne,te.from)}function B(ne,te){te.restore()}function ee(ne,te){return ke;function ke(ae,W,M){let F,re,xe,k;return Array.isArray(ae)?C(ae):"tokenize"in ae?C([ae]):T(ae);function T(Z){return le;function le(ge){const fe=ge!==null&&Z[ge],Qe=ge!==null&&Z.null,Fe=[...Array.isArray(fe)?fe:fe?[fe]:[],...Array.isArray(Qe)?Qe:Qe?[Qe]:[]];return C(Fe)(ge)}}function C(Z){return F=Z,re=0,Z.length===0?M:v(Z[re])}function v(Z){return le;function le(ge){return k=ye(),xe=Z,Z.partial||(p.currentConstruct=Z),Z.name&&p.parser.constructs.disable.null.includes(Z.name)?$():Z.tokenize.call(te?Object.assign(Object.create(p),te):p,m,j,$)(ge)}}function j(Z){return ne(xe,k),W}function $(Z){return k.restore(),++re<F.length?v(F[re]):M}}}function pe(ne,te){ne.resolveAll&&!h.includes(ne)&&h.push(ne),ne.resolve&&Zt(p.events,te,p.events.length-te,ne.resolve(p.events.slice(te),p)),ne.resolveTo&&(p.events=ne.resolveTo(p.events,p))}function ye(){const ne=z(),te=p.previous,ke=p.currentConstruct,ae=p.events.length,W=Array.from(d);return{from:ae,restore:M};function M(){u=ne,p.previous=te,p.currentConstruct=ke,p.events.length=ae,d=W,L()}}function L(){u.line in s&&u.column<2&&(u.column=s[u.line],u.offset+=s[u.line]-1)}}function Vx(n,a){const r=a.start._index,u=a.start._bufferIndex,s=a.end._index,h=a.end._bufferIndex;let f;if(r===s)f=[n[r].slice(u,h)];else{if(f=n.slice(r,s),u>-1){const d=f[0];typeof d=="string"?f[0]=d.slice(u):f.shift()}h>0&&f.push(n[s].slice(0,h))}return f}function Gx(n,a){let r=-1;const u=[];let s;for(;++r<n.length;){const h=n[r];let f;if(typeof h=="string")f=h;else switch(h){case-5:{f="\\r";break}case-4:{f=`\n`;break}case-3:{f=`\\r\n`;break}case-2:{f=a?" ":"	";break}case-1:{if(!a&&s)continue;f=" ";break}default:f=String.fromCharCode(h)}s=h===-2,u.push(f)}return u.join("")}function Xx(n){const u={constructs:ag([qx,...(n||{}).extensions||[]]),content:s(av),defined:[],document:s(uv),flow:s(Tx),lazy:{},string:s(zx),text:s(Dx)};return u;function s(h){return f;function f(d){return Yx(u,h,d)}}}function Qx(n){for(;!sg(n););return n}const xm=/[\\0\\t\\n\\r]/g;function Zx(){let n=1,a="",r=!0,u;return s;function s(h,f,d){const m=[];let p,b,y,E,S;for(h=a+(typeof h=="string"?h.toString():new TextDecoder(f||void 0).decode(h)),y=0,a="",r&&(h.charCodeAt(0)===65279&&y++,r=void 0);y<h.length;){if(xm.lastIndex=y,p=xm.exec(h),E=p&&p.index!==void 0?p.index:h.length,S=h.charCodeAt(E),!p){a=h.slice(y);break}if(S===10&&y===E&&u)m.push(-3),u=void 0;else switch(u&&(m.push(-5),u=void 0),y<E&&(m.push(h.slice(y,E)),n+=E-y),S){case 0:{m.push(65533),n++;break}case 9:{for(b=Math.ceil(n/4)*4,m.push(-2);n++<b;)m.push(-1);break}case 10:{m.push(-4),n=1;break}default:u=!0,n=1}y=E+1}return d&&(u&&m.push(-5),a&&m.push(a),m.push(null)),m}}const Fx=/\\\\([!-/:-@[-`{-~])|&(#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});/gi;function Ix(n){return n.replace(Fx,Kx)}function Kx(n,a,r){if(a)return a;if(r.charCodeAt(0)===35){const s=r.charCodeAt(1),h=s===120||s===88;return rg(r.slice(h?2:1),h?16:10)}return _s(r)||n}const gg={}.hasOwnProperty;function Jx(n,a,r){return a&&typeof a=="object"&&(r=a,a=void 0),$x(r)(Qx(Xx(r).document().write(Zx()(n,a,!0))))}function $x(n){const a={transforms:[],canContainEols:["emphasis","fragment","heading","paragraph","strong"],enter:{autolink:h(Ul),autolinkProtocol:ye,autolinkEmail:ye,atxHeading:h(Nl),blockQuote:h(Qe),characterEscape:ye,characterReference:ye,codeFenced:h(Fe),codeFencedFenceInfo:f,codeFencedFenceMeta:f,codeIndented:h(Fe,f),codeText:h(mt,f),codeTextData:ye,data:ye,codeFlowValue:ye,definition:h(Rl),definitionDestinationString:f,definitionLabelString:f,definitionTitleString:f,emphasis:h(yn),hardBreakEscape:h(Ll),hardBreakTrailing:h(Ll),htmlFlow:h(Ba,f),htmlFlowData:ye,htmlText:h(Ba,f),htmlTextData:ye,image:h(Ha),label:f,link:h(Ul),listItem:h(_i),listItemValue:E,listOrdered:h(jl,y),listUnordered:h(jl),paragraph:h(vu),reference:v,referenceString:f,resourceDestinationString:f,resourceTitleString:f,setextHeading:h(Nl),strong:h(xu),thematicBreak:h(Su)},exit:{atxHeading:m(),atxHeadingSequence:se,autolink:m(),autolinkEmail:fe,autolinkProtocol:ge,blockQuote:m(),characterEscapeValue:L,characterReferenceMarkerHexadecimal:$,characterReferenceMarkerNumeric:$,characterReferenceValue:Z,characterReference:le,codeFenced:m(Q),codeFencedFence:q,codeFencedFenceInfo:S,codeFencedFenceMeta:z,codeFlowValue:L,codeIndented:m(R),codeText:m(W),codeTextData:L,data:L,definition:m(),definitionDestinationString:oe,definitionLabelString:K,definitionTitleString:X,emphasis:m(),hardBreakEscape:m(te),hardBreakTrailing:m(te),htmlFlow:m(ke),htmlFlowData:L,htmlText:m(ae),htmlTextData:L,image:m(F),label:xe,labelText:re,lineEnding:ne,link:m(M),listItem:m(),listOrdered:m(),listUnordered:m(),paragraph:m(),referenceString:j,resourceDestinationString:k,resourceTitleString:T,resource:C,setextHeading:m(pe),setextHeadingLineSequence:ee,setextHeadingText:B,strong:m(),thematicBreak:m()}};yg(a,(n||{}).mdastExtensions||[]);const r={};return u;function u(Y){let P={type:"root",children:[]};const me={stack:[P],tokenStack:[],config:a,enter:d,exit:p,buffer:f,resume:b,data:r},Ae=[];let Le=-1;for(;++Le<Y.length;)if(Y[Le][1].type==="listOrdered"||Y[Le][1].type==="listUnordered")if(Y[Le][0]==="enter")Ae.push(Le);else{const jt=Ae.pop();Le=s(Y,jt,Le)}for(Le=-1;++Le<Y.length;){const jt=a[Y[Le][0]];gg.call(jt,Y[Le][1].type)&&jt[Y[Le][1].type].call(Object.assign({sliceSerialize:Y[Le][2].sliceSerialize},me),Y[Le][1])}if(me.tokenStack.length>0){const jt=me.tokenStack[me.tokenStack.length-1];(jt[1]||Sm).call(me,void 0,jt[0])}for(P.position={start:cl(Y.length>0?Y[0][1].start:{line:1,column:1,offset:0}),end:cl(Y.length>0?Y[Y.length-2][1].end:{line:1,column:1,offset:0})},Le=-1;++Le<a.transforms.length;)P=a.transforms[Le](P)||P;return P}function s(Y,P,me){let Ae=P-1,Le=-1,jt=!1,bn,Et,rt,Ct;for(;++Ae<=me;){const Ve=Y[Ae];switch(Ve[1].type){case"listUnordered":case"listOrdered":case"blockQuote":{Ve[0]==="enter"?Le++:Le--,Ct=void 0;break}case"lineEndingBlank":{Ve[0]==="enter"&&(bn&&!Ct&&!Le&&!rt&&(rt=Ae),Ct=void 0);break}case"linePrefix":case"listItemValue":case"listItemMarker":case"listItemPrefix":case"listItemPrefixWhitespace":break;default:Ct=void 0}if(!Le&&Ve[0]==="enter"&&Ve[1].type==="listItemPrefix"||Le===-1&&Ve[0]==="exit"&&(Ve[1].type==="listUnordered"||Ve[1].type==="listOrdered")){if(bn){let Bn=Ae;for(Et=void 0;Bn--;){const an=Y[Bn];if(an[1].type==="lineEnding"||an[1].type==="lineEndingBlank"){if(an[0]==="exit")continue;Et&&(Y[Et][1].type="lineEndingBlank",jt=!0),an[1].type="lineEnding",Et=Bn}else if(!(an[1].type==="linePrefix"||an[1].type==="blockQuotePrefix"||an[1].type==="blockQuotePrefixWhitespace"||an[1].type==="blockQuoteMarker"||an[1].type==="listItemIndent"))break}rt&&(!Et||rt<Et)&&(bn._spread=!0),bn.end=Object.assign({},Et?Y[Et][1].start:Ve[1].end),Y.splice(Et||Ae,0,["exit",bn,Ve[2]]),Ae++,me++}if(Ve[1].type==="listItemPrefix"){const Bn={type:"listItem",_spread:!1,start:Object.assign({},Ve[1].start),end:void 0};bn=Bn,Y.splice(Ae,0,["enter",Bn,Ve[2]]),Ae++,me++,rt=void 0,Ct=!0}}}return Y[P][1]._spread=jt,me}function h(Y,P){return me;function me(Ae){d.call(this,Y(Ae),Ae),P&&P.call(this,Ae)}}function f(){this.stack.push({type:"fragment",children:[]})}function d(Y,P,me){this.stack[this.stack.length-1].children.push(Y),this.stack.push(Y),this.tokenStack.push([P,me||void 0]),Y.position={start:cl(P.start),end:void 0}}function m(Y){return P;function P(me){Y&&Y.call(this,me),p.call(this,me)}}function p(Y,P){const me=this.stack.pop(),Ae=this.tokenStack.pop();if(Ae)Ae[0].type!==Y.type&&(P?P.call(this,Y,Ae[0]):(Ae[1]||Sm).call(this,Y,Ae[0]));else throw new Error("Cannot close `"+Y.type+"` ("+Da({start:Y.start,end:Y.end})+"): it\u2019s not open");me.position.end=cl(Y.end)}function b(){return Ds(this.stack.pop())}function y(){this.data.expectingFirstListItemValue=!0}function E(Y){if(this.data.expectingFirstListItemValue){const P=this.stack[this.stack.length-2];P.start=Number.parseInt(this.sliceSerialize(Y),10),this.data.expectingFirstListItemValue=void 0}}function S(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.lang=Y}function z(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.meta=Y}function q(){this.data.flowCodeInside||(this.buffer(),this.data.flowCodeInside=!0)}function Q(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.value=Y.replace(/^(\\r?\\n|\\r)|(\\r?\\n|\\r)$/g,""),this.data.flowCodeInside=void 0}function R(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.value=Y.replace(/(\\r?\\n|\\r)$/g,"")}function K(Y){const P=this.resume(),me=this.stack[this.stack.length-1];me.label=P,me.identifier=cn(this.sliceSerialize(Y)).toLowerCase()}function X(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.title=Y}function oe(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.url=Y}function se(Y){const P=this.stack[this.stack.length-1];if(!P.depth){const me=this.sliceSerialize(Y).length;P.depth=me}}function B(){this.data.setextHeadingSlurpLineEnding=!0}function ee(Y){const P=this.stack[this.stack.length-1];P.depth=this.sliceSerialize(Y).codePointAt(0)===61?1:2}function pe(){this.data.setextHeadingSlurpLineEnding=void 0}function ye(Y){const me=this.stack[this.stack.length-1].children;let Ae=me[me.length-1];(!Ae||Ae.type!=="text")&&(Ae=St(),Ae.position={start:cl(Y.start),end:void 0},me.push(Ae)),this.stack.push(Ae)}function L(Y){const P=this.stack.pop();P.value+=this.sliceSerialize(Y),P.position.end=cl(Y.end)}function ne(Y){const P=this.stack[this.stack.length-1];if(this.data.atHardBreak){const me=P.children[P.children.length-1];me.position.end=cl(Y.end),this.data.atHardBreak=void 0;return}!this.data.setextHeadingSlurpLineEnding&&a.canContainEols.includes(P.type)&&(ye.call(this,Y),L.call(this,Y))}function te(){this.data.atHardBreak=!0}function ke(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.value=Y}function ae(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.value=Y}function W(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.value=Y}function M(){const Y=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";Y.type+="Reference",Y.referenceType=P,delete Y.url,delete Y.title}else delete Y.identifier,delete Y.label;this.data.referenceType=void 0}function F(){const Y=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";Y.type+="Reference",Y.referenceType=P,delete Y.url,delete Y.title}else delete Y.identifier,delete Y.label;this.data.referenceType=void 0}function re(Y){const P=this.sliceSerialize(Y),me=this.stack[this.stack.length-2];me.label=Ix(P),me.identifier=cn(P).toLowerCase()}function xe(){const Y=this.stack[this.stack.length-1],P=this.resume(),me=this.stack[this.stack.length-1];if(this.data.inReference=!0,me.type==="link"){const Ae=Y.children;me.children=Ae}else me.alt=P}function k(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.url=Y}function T(){const Y=this.resume(),P=this.stack[this.stack.length-1];P.title=Y}function C(){this.data.inReference=void 0}function v(){this.data.referenceType="collapsed"}function j(Y){const P=this.resume(),me=this.stack[this.stack.length-1];me.label=P,me.identifier=cn(this.sliceSerialize(Y)).toLowerCase(),this.data.referenceType="full"}function $(Y){this.data.characterReferenceType=Y.type}function Z(Y){const P=this.sliceSerialize(Y),me=this.data.characterReferenceType;let Ae;me?(Ae=rg(P,me==="characterReferenceMarkerNumeric"?10:16),this.data.characterReferenceType=void 0):Ae=_s(P);const Le=this.stack[this.stack.length-1];Le.value+=Ae}function le(Y){const P=this.stack.pop();P.position.end=cl(Y.end)}function ge(Y){L.call(this,Y);const P=this.stack[this.stack.length-1];P.url=this.sliceSerialize(Y)}function fe(Y){L.call(this,Y);const P=this.stack[this.stack.length-1];P.url="mailto:"+this.sliceSerialize(Y)}function Qe(){return{type:"blockquote",children:[]}}function Fe(){return{type:"code",lang:null,meta:null,value:""}}function mt(){return{type:"inlineCode",value:""}}function Rl(){return{type:"definition",identifier:"",label:null,title:null,url:""}}function yn(){return{type:"emphasis",children:[]}}function Nl(){return{type:"heading",depth:0,children:[]}}function Ll(){return{type:"break"}}function Ba(){return{type:"html",value:""}}function Ha(){return{type:"image",title:null,url:"",alt:null}}function Ul(){return{type:"link",title:null,url:"",children:[]}}function jl(Y){return{type:"list",ordered:Y.type==="listOrdered",start:null,spread:Y._spread,children:[]}}function _i(Y){return{type:"listItem",spread:Y._spread,checked:null,children:[]}}function vu(){return{type:"paragraph",children:[]}}function xu(){return{type:"strong",children:[]}}function St(){return{type:"text",value:""}}function Su(){return{type:"thematicBreak"}}}function cl(n){return{line:n.line,column:n.column,offset:n.offset}}function yg(n,a){let r=-1;for(;++r<a.length;){const u=a[r];Array.isArray(u)?yg(n,u):Wx(n,u)}}function Wx(n,a){let r;for(r in a)if(gg.call(a,r))switch(r){case"canContainEols":{const u=a[r];u&&n[r].push(...u);break}case"transforms":{const u=a[r];u&&n[r].push(...u);break}case"enter":case"exit":{const u=a[r];u&&Object.assign(n[r],u);break}}}function Sm(n,a){throw n?new Error("Cannot close `"+n.type+"` ("+Da({start:n.start,end:n.end})+"): a different token (`"+a.type+"`, "+Da({start:a.start,end:a.end})+") is open"):new Error("Cannot close document, a token (`"+a.type+"`, "+Da({start:a.start,end:a.end})+") is still open")}function Px(n){const a=this;a.parser=r;function r(u){return Jx(u,{...a.data("settings"),...n,extensions:a.data("micromarkExtensions")||[],mdastExtensions:a.data("fromMarkdownExtensions")||[]})}}function eS(n,a){const r={type:"element",tagName:"blockquote",properties:{},children:n.wrap(n.all(a),!0)};return n.patch(a,r),n.applyData(a,r)}function tS(n,a){const r={type:"element",tagName:"br",properties:{},children:[]};return n.patch(a,r),[n.applyData(a,r),{type:"text",value:`\n`}]}function nS(n,a){const r=a.value?a.value+`\n`:"",u={},s=a.lang?a.lang.split(/\\s+/):[];s.length>0&&(u.className=["language-"+s[0]]);let h={type:"element",tagName:"code",properties:u,children:[{type:"text",value:r}]};return a.meta&&(h.data={meta:a.meta}),n.patch(a,h),h=n.applyData(a,h),h={type:"element",tagName:"pre",properties:{},children:[h]},n.patch(a,h),h}function lS(n,a){const r={type:"element",tagName:"del",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function iS(n,a){const r={type:"element",tagName:"em",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function aS(n,a){const r=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",u=String(a.identifier).toUpperCase(),s=Di(u.toLowerCase()),h=n.footnoteOrder.indexOf(u);let f,d=n.footnoteCounts.get(u);d===void 0?(d=0,n.footnoteOrder.push(u),f=n.footnoteOrder.length):f=h+1,d+=1,n.footnoteCounts.set(u,d);const m={type:"element",tagName:"a",properties:{href:"#"+r+"fn-"+s,id:r+"fnref-"+s+(d>1?"-"+d:""),dataFootnoteRef:!0,ariaDescribedBy:["footnote-label"]},children:[{type:"text",value:String(f)}]};n.patch(a,m);const p={type:"element",tagName:"sup",properties:{},children:[m]};return n.patch(a,p),n.applyData(a,p)}function rS(n,a){const r={type:"element",tagName:"h"+a.depth,properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function uS(n,a){if(n.options.allowDangerousHtml){const r={type:"raw",value:a.value};return n.patch(a,r),n.applyData(a,r)}}function bg(n,a){const r=a.referenceType;let u="]";if(r==="collapsed"?u+="[]":r==="full"&&(u+="["+(a.label||a.identifier)+"]"),a.type==="imageReference")return[{type:"text",value:"!["+a.alt+u}];const s=n.all(a),h=s[0];h&&h.type==="text"?h.value="["+h.value:s.unshift({type:"text",value:"["});const f=s[s.length-1];return f&&f.type==="text"?f.value+=u:s.push({type:"text",value:u}),s}function oS(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return bg(n,a);const s={src:Di(u.url||""),alt:a.alt};u.title!==null&&u.title!==void 0&&(s.title=u.title);const h={type:"element",tagName:"img",properties:s,children:[]};return n.patch(a,h),n.applyData(a,h)}function cS(n,a){const r={src:Di(a.url)};a.alt!==null&&a.alt!==void 0&&(r.alt=a.alt),a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"img",properties:r,children:[]};return n.patch(a,u),n.applyData(a,u)}function sS(n,a){const r={type:"text",value:a.value.replace(/\\r?\\n|\\r/g," ")};n.patch(a,r);const u={type:"element",tagName:"code",properties:{},children:[r]};return n.patch(a,u),n.applyData(a,u)}function fS(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return bg(n,a);const s={href:Di(u.url||"")};u.title!==null&&u.title!==void 0&&(s.title=u.title);const h={type:"element",tagName:"a",properties:s,children:n.all(a)};return n.patch(a,h),n.applyData(a,h)}function hS(n,a){const r={href:Di(a.url)};a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"a",properties:r,children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function dS(n,a,r){const u=n.all(a),s=r?pS(r):vg(a),h={},f=[];if(typeof a.checked=="boolean"){const b=u[0];let y;b&&b.type==="element"&&b.tagName==="p"?y=b:(y={type:"element",tagName:"p",properties:{},children:[]},u.unshift(y)),y.children.length>0&&y.children.unshift({type:"text",value:" "}),y.children.unshift({type:"element",tagName:"input",properties:{type:"checkbox",checked:a.checked,disabled:!0},children:[]}),h.className=["task-list-item"]}let d=-1;for(;++d<u.length;){const b=u[d];(s||d!==0||b.type!=="element"||b.tagName!=="p")&&f.push({type:"text",value:`\n`}),b.type==="element"&&b.tagName==="p"&&!s?f.push(...b.children):f.push(b)}const m=u[u.length-1];m&&(s||m.type!=="element"||m.tagName!=="p")&&f.push({type:"text",value:`\n`});const p={type:"element",tagName:"li",properties:h,children:f};return n.patch(a,p),n.applyData(a,p)}function pS(n){let a=!1;if(n.type==="list"){a=n.spread||!1;const r=n.children;let u=-1;for(;!a&&++u<r.length;)a=vg(r[u])}return a}function vg(n){const a=n.spread;return a??n.children.length>1}function mS(n,a){const r={},u=n.all(a);let s=-1;for(typeof a.start=="number"&&a.start!==1&&(r.start=a.start);++s<u.length;){const f=u[s];if(f.type==="element"&&f.tagName==="li"&&f.properties&&Array.isArray(f.properties.className)&&f.properties.className.includes("task-list-item")){r.className=["contains-task-list"];break}}const h={type:"element",tagName:a.ordered?"ol":"ul",properties:r,children:n.wrap(u,!0)};return n.patch(a,h),n.applyData(a,h)}function gS(n,a){const r={type:"element",tagName:"p",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function yS(n,a){const r={type:"root",children:n.wrap(n.all(a))};return n.patch(a,r),n.applyData(a,r)}function bS(n,a){const r={type:"element",tagName:"strong",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function vS(n,a){const r=n.all(a),u=r.shift(),s=[];if(u){const f={type:"element",tagName:"thead",properties:{},children:n.wrap([u],!0)};n.patch(a.children[0],f),s.push(f)}if(r.length>0){const f={type:"element",tagName:"tbody",properties:{},children:n.wrap(r,!0)},d=Ts(a.children[1]),m=Wm(a.children[a.children.length-1]);d&&m&&(f.position={start:d,end:m}),s.push(f)}const h={type:"element",tagName:"table",properties:{},children:n.wrap(s,!0)};return n.patch(a,h),n.applyData(a,h)}function xS(n,a,r){const u=r?r.children:void 0,h=(u?u.indexOf(a):1)===0?"th":"td",f=r&&r.type==="table"?r.align:void 0,d=f?f.length:a.children.length;let m=-1;const p=[];for(;++m<d;){const y=a.children[m],E={},S=f?f[m]:void 0;S&&(E.align=S);let z={type:"element",tagName:h,properties:E,children:[]};y&&(z.children=n.all(y),n.patch(y,z),z=n.applyData(y,z)),p.push(z)}const b={type:"element",tagName:"tr",properties:{},children:n.wrap(p,!0)};return n.patch(a,b),n.applyData(a,b)}function SS(n,a){const r={type:"element",tagName:"td",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}const Em=9,km=32;function ES(n){const a=String(n),r=/\\r?\\n|\\r/g;let u=r.exec(a),s=0;const h=[];for(;u;)h.push(Am(a.slice(s,u.index),s>0,!0),u[0]),s=u.index+u[0].length,u=r.exec(a);return h.push(Am(a.slice(s),s>0,!1)),h.join("")}function Am(n,a,r){let u=0,s=n.length;if(a){let h=n.codePointAt(u);for(;h===Em||h===km;)u++,h=n.codePointAt(u)}if(r){let h=n.codePointAt(s-1);for(;h===Em||h===km;)s--,h=n.codePointAt(s-1)}return s>u?n.slice(u,s):""}function kS(n,a){const r={type:"text",value:ES(String(a.value))};return n.patch(a,r),n.applyData(a,r)}function AS(n,a){const r={type:"element",tagName:"hr",properties:{},children:[]};return n.patch(a,r),n.applyData(a,r)}const TS={blockquote:eS,break:tS,code:nS,delete:lS,emphasis:iS,footnoteReference:aS,heading:rS,html:uS,imageReference:oS,image:cS,inlineCode:sS,linkReference:fS,link:hS,listItem:dS,list:mS,paragraph:gS,root:yS,strong:bS,table:vS,tableCell:SS,tableRow:xS,text:kS,thematicBreak:AS,toml:lu,yaml:lu,definition:lu,footnoteDefinition:lu};function lu(){}const xg=-1,gu=0,Oa=1,fu=2,Ms=3,Rs=4,Ns=5,Ls=6,Sg=7,Eg=8,wS=typeof self=="object"?self:globalThis,Tm=(n,a)=>{switch(n){case"Function":case"SharedWorker":case"Worker":case"eval":case"setInterval":case"setTimeout":throw new TypeError("unable to deserialize "+n)}return new wS[n](a)},CS=(n,a)=>{const r=(s,h)=>(n.set(h,s),s),u=s=>{if(n.has(s))return n.get(s);const[h,f]=a[s];switch(h){case gu:case xg:return r(f,s);case Oa:{const d=r([],s);for(const m of f)d.push(u(m));return d}case fu:{const d=r({},s);for(const[m,p]of f)d[u(m)]=u(p);return d}case Ms:return r(new Date(f),s);case Rs:{const{source:d,flags:m}=f;return r(new RegExp(d,m),s)}case Ns:{const d=r(new Map,s);for(const[m,p]of f)d.set(u(m),u(p));return d}case Ls:{const d=r(new Set,s);for(const m of f)d.add(u(m));return d}case Sg:{const{name:d,message:m}=f;return r(Tm(d,m),s)}case Eg:return r(BigInt(f),s);case"BigInt":return r(Object(BigInt(f)),s);case"ArrayBuffer":return r(new Uint8Array(f).buffer,f);case"DataView":{const{buffer:d}=new Uint8Array(f);return r(new DataView(d),f)}}return r(Tm(h,f),s)};return u},wm=n=>CS(new Map,n)(0),ki="",{toString:zS}={},{keys:DS}=Object,Ca=n=>{const a=typeof n;if(a!=="object"||!n)return[gu,a];const r=zS.call(n).slice(8,-1);switch(r){case"Array":return[Oa,ki];case"Object":return[fu,ki];case"Date":return[Ms,ki];case"RegExp":return[Rs,ki];case"Map":return[Ns,ki];case"Set":return[Ls,ki];case"DataView":return[Oa,r]}return r.includes("Array")?[Oa,r]:r.includes("Error")?[Sg,r]:[fu,r]},iu=([n,a])=>n===gu&&(a==="function"||a==="symbol"),_S=(n,a,r,u)=>{const s=(f,d)=>{const m=u.push(f)-1;return r.set(d,m),m},h=f=>{if(r.has(f))return r.get(f);let[d,m]=Ca(f);switch(d){case gu:{let b=f;switch(m){case"bigint":d=Eg,b=f.toString();break;case"function":case"symbol":if(n)throw new TypeError("unable to serialize "+m);b=null;break;case"undefined":return s([xg],f)}return s([d,b],f)}case Oa:{if(m){let E=f;return m==="DataView"?E=new Uint8Array(f.buffer):m==="ArrayBuffer"&&(E=new Uint8Array(f)),s([m,[...E]],f)}const b=[],y=s([d,b],f);for(const E of f)b.push(h(E));return y}case fu:{if(m)switch(m){case"BigInt":return s([m,f.toString()],f);case"Boolean":case"Number":case"String":return s([m,f.valueOf()],f)}if(a&&"toJSON"in f)return h(f.toJSON());const b=[],y=s([d,b],f);for(const E of DS(f))(n||!iu(Ca(f[E])))&&b.push([h(E),h(f[E])]);return y}case Ms:return s([d,f.toISOString()],f);case Rs:{const{source:b,flags:y}=f;return s([d,{source:b,flags:y}],f)}case Ns:{const b=[],y=s([d,b],f);for(const[E,S]of f)(n||!(iu(Ca(E))||iu(Ca(S))))&&b.push([h(E),h(S)]);return y}case Ls:{const b=[],y=s([d,b],f);for(const E of f)(n||!iu(Ca(E)))&&b.push(h(E));return y}}const{message:p}=f;return s([d,{name:m,message:p}],f)};return h},Cm=(n,{json:a,lossy:r}={})=>{const u=[];return _S(!(a||r),!!a,new Map,u)(n),u},hu=typeof structuredClone=="function"?(n,a)=>a&&("json"in a||"lossy"in a)?wm(Cm(n,a)):structuredClone(n):(n,a)=>wm(Cm(n,a));function OS(n,a){const r=[{type:"text",value:"\u21A9"}];return a>1&&r.push({type:"element",tagName:"sup",properties:{},children:[{type:"text",value:String(a)}]}),r}function MS(n,a){return"Back to reference "+(n+1)+(a>1?"-"+a:"")}function RS(n){const a=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",r=n.options.footnoteBackContent||OS,u=n.options.footnoteBackLabel||MS,s=n.options.footnoteLabel||"Footnotes",h=n.options.footnoteLabelTagName||"h2",f=n.options.footnoteLabelProperties||{className:["sr-only"]},d=[];let m=-1;for(;++m<n.footnoteOrder.length;){const p=n.footnoteById.get(n.footnoteOrder[m]);if(!p)continue;const b=n.all(p),y=String(p.identifier).toUpperCase(),E=Di(y.toLowerCase());let S=0;const z=[],q=n.footnoteCounts.get(y);for(;q!==void 0&&++S<=q;){z.length>0&&z.push({type:"text",value:" "});let K=typeof r=="string"?r:r(m,S);typeof K=="string"&&(K={type:"text",value:K}),z.push({type:"element",tagName:"a",properties:{href:"#"+a+"fnref-"+E+(S>1?"-"+S:""),dataFootnoteBackref:"",ariaLabel:typeof u=="string"?u:u(m,S),className:["data-footnote-backref"]},children:Array.isArray(K)?K:[K]})}const Q=b[b.length-1];if(Q&&Q.type==="element"&&Q.tagName==="p"){const K=Q.children[Q.children.length-1];K&&K.type==="text"?K.value+=" ":Q.children.push({type:"text",value:" "}),Q.children.push(...z)}else b.push(...z);const R={type:"element",tagName:"li",properties:{id:a+"fn-"+E},children:n.wrap(b,!0)};n.patch(p,R),d.push(R)}if(d.length!==0)return{type:"element",tagName:"section",properties:{dataFootnotes:!0,className:["footnotes"]},children:[{type:"element",tagName:h,properties:{...hu(f),id:"footnote-label"},children:[{type:"text",value:s}]},{type:"text",value:`\n`},{type:"element",tagName:"ol",properties:{},children:n.wrap(d,!0)},{type:"text",value:`\n`}]}}const yu=(function(n){if(n==null)return jS;if(typeof n=="function")return bu(n);if(typeof n=="object")return Array.isArray(n)?NS(n):LS(n);if(typeof n=="string")return US(n);throw new Error("Expected function, string, or object as test")});function NS(n){const a=[];let r=-1;for(;++r<n.length;)a[r]=yu(n[r]);return bu(u);function u(...s){let h=-1;for(;++h<a.length;)if(a[h].apply(this,s))return!0;return!1}}function LS(n){const a=n;return bu(r);function r(u){const s=u;let h;for(h in n)if(s[h]!==a[h])return!1;return!0}}function US(n){return bu(a);function a(r){return r&&r.type===n}}function bu(n){return a;function a(r,u,s){return!!(BS(r)&&n.call(this,r,typeof u=="number"?u:void 0,s||void 0))}}function jS(){return!0}function BS(n){return n!==null&&typeof n=="object"&&"type"in n}const kg=[],HS=!0,ps=!1,qS="skip";function Ag(n,a,r,u){let s;typeof a=="function"&&typeof r!="function"?(u=r,r=a):s=a;const h=yu(s),f=u?-1:1;d(n,void 0,[])();function d(m,p,b){const y=m&&typeof m=="object"?m:{};if(typeof y.type=="string"){const S=typeof y.tagName=="string"?y.tagName:typeof y.name=="string"?y.name:void 0;Object.defineProperty(E,"name",{value:"node ("+(m.type+(S?"<"+S+">":""))+")"})}return E;function E(){let S=kg,z,q,Q;if((!a||h(m,p,b[b.length-1]||void 0))&&(S=YS(r(m,b)),S[0]===ps))return S;if("children"in m&&m.children){const R=m;if(R.children&&S[0]!==qS)for(q=(u?R.children.length:-1)+f,Q=b.concat(R);q>-1&&q<R.children.length;){const K=R.children[q];if(z=d(K,q,Q)(),z[0]===ps)return z;q=typeof z[1]=="number"?z[1]:q+f}}return S}}}function YS(n){return Array.isArray(n)?n:typeof n=="number"?[HS,n]:n==null?kg:[n]}function Us(n,a,r,u){let s,h,f;typeof a=="function"&&typeof r!="function"?(h=void 0,f=a,s=r):(h=a,f=r,s=u),Ag(n,h,d,s);function d(m,p){const b=p[p.length-1],y=b?b.children.indexOf(m):void 0;return f(m,y,b)}}const ms={}.hasOwnProperty,VS={};function GS(n,a){const r=a||VS,u=new Map,s=new Map,h=new Map,f={...TS,...r.handlers},d={all:p,applyData:QS,definitionById:u,footnoteById:s,footnoteCounts:h,footnoteOrder:[],handlers:f,one:m,options:r,patch:XS,wrap:FS};return Us(n,function(b){if(b.type==="definition"||b.type==="footnoteDefinition"){const y=b.type==="definition"?u:s,E=String(b.identifier).toUpperCase();y.has(E)||y.set(E,b)}}),d;function m(b,y){const E=b.type,S=d.handlers[E];if(ms.call(d.handlers,E)&&S)return S(d,b,y);if(d.options.passThrough&&d.options.passThrough.includes(E)){if("children"in b){const{children:q,...Q}=b,R=hu(Q);return R.children=d.all(b),R}return hu(b)}return(d.options.unknownHandler||ZS)(d,b,y)}function p(b){const y=[];if("children"in b){const E=b.children;let S=-1;for(;++S<E.length;){const z=d.one(E[S],b);if(z){if(S&&E[S-1].type==="break"&&(!Array.isArray(z)&&z.type==="text"&&(z.value=zm(z.value)),!Array.isArray(z)&&z.type==="element")){const q=z.children[0];q&&q.type==="text"&&(q.value=zm(q.value))}Array.isArray(z)?y.push(...z):y.push(z)}}}return y}}function XS(n,a){n.position&&(a.position=Ob(n))}function QS(n,a){let r=a;if(n&&n.data){const u=n.data.hName,s=n.data.hChildren,h=n.data.hProperties;if(typeof u=="string")if(r.type==="element")r.tagName=u;else{const f="children"in r?r.children:[r];r={type:"element",tagName:u,properties:{},children:f}}r.type==="element"&&h&&Object.assign(r.properties,hu(h)),"children"in r&&r.children&&s!==null&&s!==void 0&&(r.children=s)}return r}function ZS(n,a){const r=a.data||{},u="value"in a&&!(ms.call(r,"hProperties")||ms.call(r,"hChildren"))?{type:"text",value:a.value}:{type:"element",tagName:"div",properties:{},children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function FS(n,a){const r=[];let u=-1;for(a&&r.push({type:"text",value:`\n`});++u<n.length;)u&&r.push({type:"text",value:`\n`}),r.push(n[u]);return a&&n.length>0&&r.push({type:"text",value:`\n`}),r}function zm(n){let a=0,r=n.charCodeAt(a);for(;r===9||r===32;)a++,r=n.charCodeAt(a);return n.slice(a)}function Dm(n,a){const r=GS(n,a),u=r.one(n,void 0),s=RS(r),h=Array.isArray(u)?{type:"root",children:u}:u||{type:"root",children:[]};return s&&h.children.push({type:"text",value:`\n`},s),h}function IS(n,a){return n&&"run"in n?async function(r,u){const s=Dm(r,{file:u,...a});await n.run(s,u)}:function(r,u){return Dm(r,{file:u,...n||a})}}function _m(n){if(n)throw n}var Ic,Om;function KS(){if(Om)return Ic;Om=1;var n=Object.prototype.hasOwnProperty,a=Object.prototype.toString,r=Object.defineProperty,u=Object.getOwnPropertyDescriptor,s=function(p){return typeof Array.isArray=="function"?Array.isArray(p):a.call(p)==="[object Array]"},h=function(p){if(!p||a.call(p)!=="[object Object]")return!1;var b=n.call(p,"constructor"),y=p.constructor&&p.constructor.prototype&&n.call(p.constructor.prototype,"isPrototypeOf");if(p.constructor&&!b&&!y)return!1;var E;for(E in p);return typeof E>"u"||n.call(p,E)},f=function(p,b){r&&b.name==="__proto__"?r(p,b.name,{enumerable:!0,configurable:!0,value:b.newValue,writable:!0}):p[b.name]=b.newValue},d=function(p,b){if(b==="__proto__")if(n.call(p,b)){if(u)return u(p,b).value}else return;return p[b]};return Ic=function m(){var p,b,y,E,S,z,q=arguments[0],Q=1,R=arguments.length,K=!1;for(typeof q=="boolean"&&(K=q,q=arguments[1]||{},Q=2),(q==null||typeof q!="object"&&typeof q!="function")&&(q={});Q<R;++Q)if(p=arguments[Q],p!=null)for(b in p)y=d(q,b),E=d(p,b),q!==E&&(K&&E&&(h(E)||(S=s(E)))?(S?(S=!1,z=y&&s(y)?y:[]):z=y&&h(y)?y:{},f(q,{name:b,newValue:m(K,z,E)})):typeof E<"u"&&f(q,{name:b,newValue:E}));return q},Ic}var JS=KS();const Kc=vs(JS);function gs(n){if(typeof n!="object"||n===null)return!1;const a=Object.getPrototypeOf(n);return(a===null||a===Object.prototype||Object.getPrototypeOf(a)===null)&&!(Symbol.toStringTag in n)&&!(Symbol.iterator in n)}function $S(){const n=[],a={run:r,use:u};return a;function r(...s){let h=-1;const f=s.pop();if(typeof f!="function")throw new TypeError("Expected function as last argument, not "+f);d(null,...s);function d(m,...p){const b=n[++h];let y=-1;if(m){f(m);return}for(;++y<s.length;)(p[y]===null||p[y]===void 0)&&(p[y]=s[y]);s=p,b?WS(b,d)(...p):f(null,...p)}}function u(s){if(typeof s!="function")throw new TypeError("Expected `middelware` to be a function, not "+s);return n.push(s),a}}function WS(n,a){let r;return u;function u(...f){const d=n.length>f.length;let m;d&&f.push(s);try{m=n.apply(this,f)}catch(p){const b=p;if(d&&r)throw b;return s(b)}d||(m&&m.then&&typeof m.then=="function"?m.then(h,s):m instanceof Error?s(m):h(m))}function s(f,...d){r||(r=!0,a(f,...d))}function h(f){s(null,f)}}const pn={basename:PS,dirname:eE,extname:tE,join:nE,sep:"/"};function PS(n,a){if(a!==void 0&&typeof a!="string")throw new TypeError(\'"ext" argument must be a string\');Ua(n);let r=0,u=-1,s=n.length,h;if(a===void 0||a.length===0||a.length>n.length){for(;s--;)if(n.codePointAt(s)===47){if(h){r=s+1;break}}else u<0&&(h=!0,u=s+1);return u<0?"":n.slice(r,u)}if(a===n)return"";let f=-1,d=a.length-1;for(;s--;)if(n.codePointAt(s)===47){if(h){r=s+1;break}}else f<0&&(h=!0,f=s+1),d>-1&&(n.codePointAt(s)===a.codePointAt(d--)?d<0&&(u=s):(d=-1,u=f));return r===u?u=f:u<0&&(u=n.length),n.slice(r,u)}function eE(n){if(Ua(n),n.length===0)return".";let a=-1,r=n.length,u;for(;--r;)if(n.codePointAt(r)===47){if(u){a=r;break}}else u||(u=!0);return a<0?n.codePointAt(0)===47?"/":".":a===1&&n.codePointAt(0)===47?"//":n.slice(0,a)}function tE(n){Ua(n);let a=n.length,r=-1,u=0,s=-1,h=0,f;for(;a--;){const d=n.codePointAt(a);if(d===47){if(f){u=a+1;break}continue}r<0&&(f=!0,r=a+1),d===46?s<0?s=a:h!==1&&(h=1):s>-1&&(h=-1)}return s<0||r<0||h===0||h===1&&s===r-1&&s===u+1?"":n.slice(s,r)}function nE(...n){let a=-1,r;for(;++a<n.length;)Ua(n[a]),n[a]&&(r=r===void 0?n[a]:r+"/"+n[a]);return r===void 0?".":lE(r)}function lE(n){Ua(n);const a=n.codePointAt(0)===47;let r=iE(n,!a);return r.length===0&&!a&&(r="."),r.length>0&&n.codePointAt(n.length-1)===47&&(r+="/"),a?"/"+r:r}function iE(n,a){let r="",u=0,s=-1,h=0,f=-1,d,m;for(;++f<=n.length;){if(f<n.length)d=n.codePointAt(f);else{if(d===47)break;d=47}if(d===47){if(!(s===f-1||h===1))if(s!==f-1&&h===2){if(r.length<2||u!==2||r.codePointAt(r.length-1)!==46||r.codePointAt(r.length-2)!==46){if(r.length>2){if(m=r.lastIndexOf("/"),m!==r.length-1){m<0?(r="",u=0):(r=r.slice(0,m),u=r.length-1-r.lastIndexOf("/")),s=f,h=0;continue}}else if(r.length>0){r="",u=0,s=f,h=0;continue}}a&&(r=r.length>0?r+"/..":"..",u=2)}else r.length>0?r+="/"+n.slice(s+1,f):r=n.slice(s+1,f),u=f-s-1;s=f,h=0}else d===46&&h>-1?h++:h=-1}return r}function Ua(n){if(typeof n!="string")throw new TypeError("Path must be a string. Received "+JSON.stringify(n))}const aE={cwd:rE};function rE(){return"/"}function ys(n){return!!(n!==null&&typeof n=="object"&&"href"in n&&n.href&&"protocol"in n&&n.protocol&&n.auth===void 0)}function uE(n){if(typeof n=="string")n=new URL(n);else if(!ys(n)){const a=new TypeError(\'The "path" argument must be of type string or an instance of URL. Received `\'+n+"`");throw a.code="ERR_INVALID_ARG_TYPE",a}if(n.protocol!=="file:"){const a=new TypeError("The URL must be of scheme file");throw a.code="ERR_INVALID_URL_SCHEME",a}return oE(n)}function oE(n){if(n.hostname!==""){const u=new TypeError(\'File URL host must be "localhost" or empty on darwin\');throw u.code="ERR_INVALID_FILE_URL_HOST",u}const a=n.pathname;let r=-1;for(;++r<a.length;)if(a.codePointAt(r)===37&&a.codePointAt(r+1)===50){const u=a.codePointAt(r+2);if(u===70||u===102){const s=new TypeError("File URL path must not include encoded / characters");throw s.code="ERR_INVALID_FILE_URL_PATH",s}}return decodeURIComponent(a)}const Jc=["history","path","basename","stem","extname","dirname"];class Tg{constructor(a){let r;a?ys(a)?r={path:a}:typeof a=="string"||cE(a)?r={value:a}:r=a:r={},this.cwd="cwd"in r?"":aE.cwd(),this.data={},this.history=[],this.messages=[],this.value,this.map,this.result,this.stored;let u=-1;for(;++u<Jc.length;){const h=Jc[u];h in r&&r[h]!==void 0&&r[h]!==null&&(this[h]=h==="history"?[...r[h]]:r[h])}let s;for(s in r)Jc.includes(s)||(this[s]=r[s])}get basename(){return typeof this.path=="string"?pn.basename(this.path):void 0}set basename(a){Wc(a,"basename"),$c(a,"basename"),this.path=pn.join(this.dirname||"",a)}get dirname(){return typeof this.path=="string"?pn.dirname(this.path):void 0}set dirname(a){Mm(this.basename,"dirname"),this.path=pn.join(a||"",this.basename)}get extname(){return typeof this.path=="string"?pn.extname(this.path):void 0}set extname(a){if($c(a,"extname"),Mm(this.dirname,"extname"),a){if(a.codePointAt(0)!==46)throw new Error("`extname` must start with `.`");if(a.includes(".",1))throw new Error("`extname` cannot contain multiple dots")}this.path=pn.join(this.dirname,this.stem+(a||""))}get path(){return this.history[this.history.length-1]}set path(a){ys(a)&&(a=uE(a)),Wc(a,"path"),this.path!==a&&this.history.push(a)}get stem(){return typeof this.path=="string"?pn.basename(this.path,this.extname):void 0}set stem(a){Wc(a,"stem"),$c(a,"stem"),this.path=pn.join(this.dirname||"",a+(this.extname||""))}fail(a,r,u){const s=this.message(a,r,u);throw s.fatal=!0,s}info(a,r,u){const s=this.message(a,r,u);return s.fatal=void 0,s}message(a,r,u){const s=new xt(a,r,u);return this.path&&(s.name=this.path+":"+s.name,s.file=this.path),s.fatal=!1,this.messages.push(s),s}toString(a){return this.value===void 0?"":typeof this.value=="string"?this.value:new TextDecoder(a||void 0).decode(this.value)}}function $c(n,a){if(n&&n.includes(pn.sep))throw new Error("`"+a+"` cannot be a path: did not expect `"+pn.sep+"`")}function Wc(n,a){if(!n)throw new Error("`"+a+"` cannot be empty")}function Mm(n,a){if(!n)throw new Error("Setting `"+a+"` requires `path` to be set too")}function cE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const sE=(function(n){const u=this.constructor.prototype,s=u[n],h=function(){return s.apply(h,arguments)};return Object.setPrototypeOf(h,u),h}),fE={}.hasOwnProperty;class js extends sE{constructor(){super("copy"),this.Compiler=void 0,this.Parser=void 0,this.attachers=[],this.compiler=void 0,this.freezeIndex=-1,this.frozen=void 0,this.namespace={},this.parser=void 0,this.transformers=$S()}copy(){const a=new js;let r=-1;for(;++r<this.attachers.length;){const u=this.attachers[r];a.use(...u)}return a.data(Kc(!0,{},this.namespace)),a}data(a,r){return typeof a=="string"?arguments.length===2?(ts("data",this.frozen),this.namespace[a]=r,this):fE.call(this.namespace,a)&&this.namespace[a]||void 0:a?(ts("data",this.frozen),this.namespace=a,this):this.namespace}freeze(){if(this.frozen)return this;const a=this;for(;++this.freezeIndex<this.attachers.length;){const[r,...u]=this.attachers[this.freezeIndex];if(u[0]===!1)continue;u[0]===!0&&(u[0]=void 0);const s=r.call(a,...u);typeof s=="function"&&this.transformers.use(s)}return this.frozen=!0,this.freezeIndex=Number.POSITIVE_INFINITY,this}parse(a){this.freeze();const r=au(a),u=this.parser||this.Parser;return Pc("parse",u),u(String(r),r)}process(a,r){const u=this;return this.freeze(),Pc("process",this.parser||this.Parser),es("process",this.compiler||this.Compiler),r?s(void 0,r):new Promise(s);function s(h,f){const d=au(a),m=u.parse(d);u.run(m,d,function(b,y,E){if(b||!y||!E)return p(b);const S=y,z=u.stringify(S,E);pE(z)?E.value=z:E.result=z,p(b,E)});function p(b,y){b||!y?f(b):h?h(y):r(void 0,y)}}}processSync(a){let r=!1,u;return this.freeze(),Pc("processSync",this.parser||this.Parser),es("processSync",this.compiler||this.Compiler),this.process(a,s),Nm("processSync","process",r),u;function s(h,f){r=!0,_m(h),u=f}}run(a,r,u){Rm(a),this.freeze();const s=this.transformers;return!u&&typeof r=="function"&&(u=r,r=void 0),u?h(void 0,u):new Promise(h);function h(f,d){const m=au(r);s.run(a,m,p);function p(b,y,E){const S=y||a;b?d(b):f?f(S):u(void 0,S,E)}}}runSync(a,r){let u=!1,s;return this.run(a,r,h),Nm("runSync","run",u),s;function h(f,d){_m(f),s=d,u=!0}}stringify(a,r){this.freeze();const u=au(r),s=this.compiler||this.Compiler;return es("stringify",s),Rm(a),s(a,u)}use(a,...r){const u=this.attachers,s=this.namespace;if(ts("use",this.frozen),a!=null)if(typeof a=="function")m(a,r);else if(typeof a=="object")Array.isArray(a)?d(a):f(a);else throw new TypeError("Expected usable value, not `"+a+"`");return this;function h(p){if(typeof p=="function")m(p,[]);else if(typeof p=="object")if(Array.isArray(p)){const[b,...y]=p;m(b,y)}else f(p);else throw new TypeError("Expected usable value, not `"+p+"`")}function f(p){if(!("plugins"in p)&&!("settings"in p))throw new Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");d(p.plugins),p.settings&&(s.settings=Kc(!0,s.settings,p.settings))}function d(p){let b=-1;if(p!=null)if(Array.isArray(p))for(;++b<p.length;){const y=p[b];h(y)}else throw new TypeError("Expected a list of plugins, not `"+p+"`")}function m(p,b){let y=-1,E=-1;for(;++y<u.length;)if(u[y][0]===p){E=y;break}if(E===-1)u.push([p,...b]);else if(b.length>0){let[S,...z]=b;const q=u[E][1];gs(q)&&gs(S)&&(S=Kc(!0,q,S)),u[E]=[p,S,...z]}}}}const hE=new js().freeze();function Pc(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `parser`")}function es(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `compiler`")}function ts(n,a){if(a)throw new Error("Cannot call `"+n+"` on a frozen processor.\\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.")}function Rm(n){if(!gs(n)||typeof n.type!="string")throw new TypeError("Expected node, got `"+n+"`")}function Nm(n,a,r){if(!r)throw new Error("`"+n+"` finished async. Use `"+a+"` instead")}function au(n){return dE(n)?n:new Tg(n)}function dE(n){return!!(n&&typeof n=="object"&&"message"in n&&"messages"in n)}function pE(n){return typeof n=="string"||mE(n)}function mE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const gE="https://github.com/remarkjs/react-markdown/blob/main/changelog.md",Lm=[],Um={allowDangerousHtml:!0},yE=/^(https?|ircs?|mailto|xmpp)$/i,bE=[{from:"astPlugins",id:"remove-buggy-html-in-markdown-parser"},{from:"allowDangerousHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"allowNode",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowElement"},{from:"allowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowedElements"},{from:"disallowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"disallowedElements"},{from:"escapeHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"includeElementIndex",id:"#remove-includeelementindex"},{from:"includeNodeIndex",id:"change-includenodeindex-to-includeelementindex"},{from:"linkTarget",id:"remove-linktarget"},{from:"plugins",id:"change-plugins-to-remarkplugins",to:"remarkPlugins"},{from:"rawSourcePos",id:"#remove-rawsourcepos"},{from:"renderers",id:"change-renderers-to-components",to:"components"},{from:"source",id:"change-source-to-children",to:"children"},{from:"sourcePos",id:"#remove-sourcepos"},{from:"transformImageUri",id:"#add-urltransform",to:"urlTransform"},{from:"transformLinkUri",id:"#add-urltransform",to:"urlTransform"}];function vE(n){const a=xE(n),r=SE(n);return EE(a.runSync(a.parse(r),r),n)}function xE(n){const a=n.rehypePlugins||Lm,r=n.remarkPlugins||Lm,u=n.remarkRehypeOptions?{...n.remarkRehypeOptions,...Um}:Um;return hE().use(Px).use(r).use(IS,u).use(a)}function SE(n){const a=n.children||"",r=new Tg;return typeof a=="string"&&(r.value=a),r}function EE(n,a){const r=a.allowedElements,u=a.allowElement,s=a.components,h=a.disallowedElements,f=a.skipHtml,d=a.unwrapDisallowed,m=a.urlTransform||kE;for(const b of bE)Object.hasOwn(a,b.from)&&(""+b.from+(b.to?"use `"+b.to+"` instead":"remove it")+gE+b.id,void 0);return a.className&&(n={type:"element",tagName:"div",properties:{className:a.className},children:n.type==="root"?n.children:[n]}),Us(n,p),Ub(n,{Fragment:I.Fragment,components:s,ignoreInvalidStyle:!0,jsx:I.jsx,jsxs:I.jsxs,passKeys:!0,passNode:!0});function p(b,y,E){if(b.type==="raw"&&E&&typeof y=="number")return f?E.children.splice(y,1):E.children[y]={type:"text",value:b.value},y;if(b.type==="element"){let S;for(S in Qc)if(Object.hasOwn(Qc,S)&&Object.hasOwn(b.properties,S)){const z=b.properties[S],q=Qc[S];(q===null||q.includes(b.tagName))&&(b.properties[S]=m(String(z||""),S,b))}}if(b.type==="element"){let S=r?!r.includes(b.tagName):h?h.includes(b.tagName):!1;if(!S&&u&&typeof y=="number"&&(S=!u(b,y,E)),S&&E&&typeof y=="number")return d&&b.children?E.children.splice(y,1,...b.children):E.children.splice(y,1),y}}}function kE(n){const a=n.indexOf(":"),r=n.indexOf("?"),u=n.indexOf("#"),s=n.indexOf("/");return a===-1||s!==-1&&a>s||r!==-1&&a>r||u!==-1&&a>u||yE.test(n.slice(0,a))?n:""}function jm(n,a){const r=String(n);if(typeof a!="string")throw new TypeError("Expected character");let u=0,s=r.indexOf(a);for(;s!==-1;)u++,s=r.indexOf(a,s+a.length);return u}function AE(n){if(typeof n!="string")throw new TypeError("Expected a string");return n.replace(/[|\\\\{}()[\\]^$+*?.]/g,"\\\\$&").replace(/-/g,"\\\\x2d")}function TE(n,a,r){const s=yu((r||{}).ignore||[]),h=wE(a);let f=-1;for(;++f<h.length;)Ag(n,"text",d);function d(p,b){let y=-1,E;for(;++y<b.length;){const S=b[y],z=E?E.children:void 0;if(s(S,z?z.indexOf(S):void 0,E))return;E=S}if(E)return m(p,b)}function m(p,b){const y=b[b.length-1],E=h[f][0],S=h[f][1];let z=0;const Q=y.children.indexOf(p);let R=!1,K=[];E.lastIndex=0;let X=E.exec(p.value);for(;X;){const oe=X.index,se={index:X.index,input:X.input,stack:[...b,p]};let B=S(...X,se);if(typeof B=="string"&&(B=B.length>0?{type:"text",value:B}:void 0),B===!1?E.lastIndex=oe+1:(z!==oe&&K.push({type:"text",value:p.value.slice(z,oe)}),Array.isArray(B)?K.push(...B):B&&K.push(B),z=oe+X[0].length,R=!0),!E.global)break;X=E.exec(p.value)}return R?(z<p.value.length&&K.push({type:"text",value:p.value.slice(z)}),y.children.splice(Q,1,...K)):K=[p],Q+K.length}}function wE(n){const a=[];if(!Array.isArray(n))throw new TypeError("Expected find and replace tuple or list of tuples");const r=!n[0]||Array.isArray(n[0])?n:[n];let u=-1;for(;++u<r.length;){const s=r[u];a.push([CE(s[0]),zE(s[1])])}return a}function CE(n){return typeof n=="string"?new RegExp(AE(n),"g"):n}function zE(n){return typeof n=="function"?n:function(){return n}}const ns="phrasing",ls=["autolink","link","image","label"];function DE(){return{transforms:[UE],enter:{literalAutolink:OE,literalAutolinkEmail:is,literalAutolinkHttp:is,literalAutolinkWww:is},exit:{literalAutolink:LE,literalAutolinkEmail:NE,literalAutolinkHttp:ME,literalAutolinkWww:RE}}}function _E(){return{unsafe:[{character:"@",before:"[+\\\\-.\\\\w]",after:"[\\\\-.\\\\w]",inConstruct:ns,notInConstruct:ls},{character:".",before:"[Ww]",after:"[\\\\-.\\\\w]",inConstruct:ns,notInConstruct:ls},{character:":",before:"[ps]",after:"\\\\/",inConstruct:ns,notInConstruct:ls}]}}function OE(n){this.enter({type:"link",title:null,url:"",children:[]},n)}function is(n){this.config.enter.autolinkProtocol.call(this,n)}function ME(n){this.config.exit.autolinkProtocol.call(this,n)}function RE(n){this.config.exit.data.call(this,n);const a=this.stack[this.stack.length-1];a.type,a.url="http://"+this.sliceSerialize(n)}function NE(n){this.config.exit.autolinkEmail.call(this,n)}function LE(n){this.exit(n)}function UE(n){TE(n,[[/(https?:\\/\\/|www(?=\\.))([-.\\w]+)([^ \\t\\r\\n]*)/gi,jE],[/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)/gu,BE]],{ignore:["link","linkReference"]})}function jE(n,a,r,u,s){let h="";if(!wg(s)||(/^w/i.test(a)&&(r=a+r,a="",h="http://"),!HE(r)))return!1;const f=qE(r+u);if(!f[0])return!1;const d={type:"link",title:null,url:h+a+f[0],children:[{type:"text",value:a+f[0]}]};return f[1]?[d,{type:"text",value:f[1]}]:d}function BE(n,a,r,u){return!wg(u,!0)||/[-\\d_]$/.test(r)?!1:{type:"link",title:null,url:"mailto:"+a+"@"+r,children:[{type:"text",value:a+"@"+r}]}}function HE(n){const a=n.split(".");return!(a.length<2||a[a.length-1]&&(/_/.test(a[a.length-1])||!/[a-zA-Z\\d]/.test(a[a.length-1]))||a[a.length-2]&&(/_/.test(a[a.length-2])||!/[a-zA-Z\\d]/.test(a[a.length-2])))}function qE(n){const a=/[!"&\'),.:;<>?\\]}]+$/.exec(n);if(!a)return[n,void 0];n=n.slice(0,a.index);let r=a[0],u=r.indexOf(")");const s=jm(n,"(");let h=jm(n,")");for(;u!==-1&&s>h;)n+=r.slice(0,u+1),r=r.slice(u+1),u=r.indexOf(")"),h++;return[n,r]}function wg(n,a){const r=n.input.charCodeAt(n.index-1);return(n.index===0||Ol(r)||pu(r))&&(!a||r!==47)}Cg.peek=KE;function YE(){this.buffer()}function VE(n){this.enter({type:"footnoteReference",identifier:"",label:""},n)}function GE(){this.buffer()}function XE(n){this.enter({type:"footnoteDefinition",identifier:"",label:"",children:[]},n)}function QE(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=cn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function ZE(n){this.exit(n)}function FE(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=cn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function IE(n){this.exit(n)}function KE(){return"["}function Cg(n,a,r,u){const s=r.createTracker(u);let h=s.move("[^");const f=r.enter("footnoteReference"),d=r.enter("reference");return h+=s.move(r.safe(r.associationId(n),{after:"]",before:h})),d(),f(),h+=s.move("]"),h}function JE(){return{enter:{gfmFootnoteCallString:YE,gfmFootnoteCall:VE,gfmFootnoteDefinitionLabelString:GE,gfmFootnoteDefinition:XE},exit:{gfmFootnoteCallString:QE,gfmFootnoteCall:ZE,gfmFootnoteDefinitionLabelString:FE,gfmFootnoteDefinition:IE}}}function $E(n){let a=!1;return n&&n.firstLineBlank&&(a=!0),{handlers:{footnoteDefinition:r,footnoteReference:Cg},unsafe:[{character:"[",inConstruct:["label","phrasing","reference"]}]};function r(u,s,h,f){const d=h.createTracker(f);let m=d.move("[^");const p=h.enter("footnoteDefinition"),b=h.enter("label");return m+=d.move(h.safe(h.associationId(u),{before:m,after:"]"})),b(),m+=d.move("]:"),u.children&&u.children.length>0&&(d.shift(4),m+=d.move((a?`\n`:" ")+h.indentLines(h.containerFlow(u,d.current()),a?zg:WE))),p(),m}}function WE(n,a,r){return a===0?n:zg(n,a,r)}function zg(n,a,r){return(r?"":"    ")+n}const PE=["autolink","destinationLiteral","destinationRaw","reference","titleQuote","titleApostrophe"];Dg.peek=i2;function e2(){return{canContainEols:["delete"],enter:{strikethrough:n2},exit:{strikethrough:l2}}}function t2(){return{unsafe:[{character:"~",inConstruct:"phrasing",notInConstruct:PE}],handlers:{delete:Dg}}}function n2(n){this.enter({type:"delete",children:[]},n)}function l2(n){this.exit(n)}function Dg(n,a,r,u){const s=r.createTracker(u),h=r.enter("strikethrough");let f=s.move("~~");return f+=r.containerPhrasing(n,{...s.current(),before:f,after:"~"}),f+=s.move("~~"),h(),f}function i2(){return"~"}function a2(n){return n.length}function r2(n,a){const r=a||{},u=(r.align||[]).concat(),s=r.stringLength||a2,h=[],f=[],d=[],m=[];let p=0,b=-1;for(;++b<n.length;){const q=[],Q=[];let R=-1;for(n[b].length>p&&(p=n[b].length);++R<n[b].length;){const K=u2(n[b][R]);if(r.alignDelimiters!==!1){const X=s(K);Q[R]=X,(m[R]===void 0||X>m[R])&&(m[R]=X)}q.push(K)}f[b]=q,d[b]=Q}let y=-1;if(typeof u=="object"&&"length"in u)for(;++y<p;)h[y]=Bm(u[y]);else{const q=Bm(u);for(;++y<p;)h[y]=q}y=-1;const E=[],S=[];for(;++y<p;){const q=h[y];let Q="",R="";q===99?(Q=":",R=":"):q===108?Q=":":q===114&&(R=":");let K=r.alignDelimiters===!1?1:Math.max(1,m[y]-Q.length-R.length);const X=Q+"-".repeat(K)+R;r.alignDelimiters!==!1&&(K=Q.length+K+R.length,K>m[y]&&(m[y]=K),S[y]=K),E[y]=X}f.splice(1,0,E),d.splice(1,0,S),b=-1;const z=[];for(;++b<f.length;){const q=f[b],Q=d[b];y=-1;const R=[];for(;++y<p;){const K=q[y]||"";let X="",oe="";if(r.alignDelimiters!==!1){const se=m[y]-(Q[y]||0),B=h[y];B===114?X=" ".repeat(se):B===99?se%2?(X=" ".repeat(se/2+.5),oe=" ".repeat(se/2-.5)):(X=" ".repeat(se/2),oe=X):oe=" ".repeat(se)}r.delimiterStart!==!1&&!y&&R.push("|"),r.padding!==!1&&!(r.alignDelimiters===!1&&K==="")&&(r.delimiterStart!==!1||y)&&R.push(" "),r.alignDelimiters!==!1&&R.push(X),R.push(K),r.alignDelimiters!==!1&&R.push(oe),r.padding!==!1&&R.push(" "),(r.delimiterEnd!==!1||y!==p-1)&&R.push("|")}z.push(r.delimiterEnd===!1?R.join("").replace(/ +$/,""):R.join(""))}return z.join(`\n`)}function u2(n){return n==null?"":String(n)}function Bm(n){const a=typeof n=="string"?n.codePointAt(0):0;return a===67||a===99?99:a===76||a===108?108:a===82||a===114?114:0}function o2(n,a,r,u){const s=r.enter("blockquote"),h=r.createTracker(u);h.move("> "),h.shift(2);const f=r.indentLines(r.containerFlow(n,h.current()),c2);return s(),f}function c2(n,a,r){return">"+(r?"":" ")+n}function s2(n,a){return Hm(n,a.inConstruct,!0)&&!Hm(n,a.notInConstruct,!1)}function Hm(n,a,r){if(typeof a=="string"&&(a=[a]),!a||a.length===0)return r;let u=-1;for(;++u<a.length;)if(n.includes(a[u]))return!0;return!1}function qm(n,a,r,u){let s=-1;for(;++s<r.unsafe.length;)if(r.unsafe[s].character===`\n`&&s2(r.stack,r.unsafe[s]))return/[ \\t]/.test(u.before)?"":" ";return`\\\\\n`}function f2(n,a){const r=String(n);let u=r.indexOf(a),s=u,h=0,f=0;if(typeof a!="string")throw new TypeError("Expected substring");for(;u!==-1;)u===s?++h>f&&(f=h):h=1,s=u+a.length,u=r.indexOf(a,s);return f}function h2(n,a){return!!(a.options.fences===!1&&n.value&&!n.lang&&/[^ \\r\\n]/.test(n.value)&&!/^[\\t ]*(?:[\\r\\n]|$)|(?:^|[\\r\\n])[\\t ]*$/.test(n.value))}function d2(n){const a=n.options.fence||"`";if(a!=="`"&&a!=="~")throw new Error("Cannot serialize code with `"+a+"` for `options.fence`, expected `` ` `` or `~`");return a}function p2(n,a,r,u){const s=d2(r),h=n.value||"",f=s==="`"?"GraveAccent":"Tilde";if(h2(n,r)){const y=r.enter("codeIndented"),E=r.indentLines(h,m2);return y(),E}const d=r.createTracker(u),m=s.repeat(Math.max(f2(h,s)+1,3)),p=r.enter("codeFenced");let b=d.move(m);if(n.lang){const y=r.enter(`codeFencedLang${f}`);b+=d.move(r.safe(n.lang,{before:b,after:" ",encode:["`"],...d.current()})),y()}if(n.lang&&n.meta){const y=r.enter(`codeFencedMeta${f}`);b+=d.move(" "),b+=d.move(r.safe(n.meta,{before:b,after:`\n`,encode:["`"],...d.current()})),y()}return b+=d.move(`\n`),h&&(b+=d.move(h+`\n`)),b+=d.move(m),p(),b}function m2(n,a,r){return(r?"":"    ")+n}function Bs(n){const a=n.options.quote||\'"\';if(a!==\'"\'&&a!=="\'")throw new Error("Cannot serialize title with `"+a+"` for `options.quote`, expected `\\"`, or `\'`");return a}function g2(n,a,r,u){const s=Bs(r),h=s===\'"\'?"Quote":"Apostrophe",f=r.enter("definition");let d=r.enter("label");const m=r.createTracker(u);let p=m.move("[");return p+=m.move(r.safe(r.associationId(n),{before:p,after:"]",...m.current()})),p+=m.move("]: "),d(),!n.url||/[\\0- \\u007F]/.test(n.url)?(d=r.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(r.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(d=r.enter("destinationRaw"),p+=m.move(r.safe(n.url,{before:p,after:n.title?" ":`\n`,...m.current()}))),d(),n.title&&(d=r.enter(`title${h}`),p+=m.move(" "+s),p+=m.move(r.safe(n.title,{before:p,after:s,...m.current()})),p+=m.move(s),d()),f(),p}function y2(n){const a=n.options.emphasis||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize emphasis with `"+a+"` for `options.emphasis`, expected `*`, or `_`");return a}function Ra(n){return"&#x"+n.toString(16).toUpperCase()+";"}function du(n,a,r){const u=Ci(n),s=Ci(a);return u===void 0?s===void 0?r==="_"?{inside:!0,outside:!0}:{inside:!1,outside:!1}:s===1?{inside:!0,outside:!0}:{inside:!1,outside:!0}:u===1?s===void 0?{inside:!1,outside:!1}:s===1?{inside:!0,outside:!0}:{inside:!1,outside:!1}:s===void 0?{inside:!1,outside:!1}:s===1?{inside:!0,outside:!1}:{inside:!1,outside:!1}}_g.peek=b2;function _g(n,a,r,u){const s=y2(r),h=r.enter("emphasis"),f=r.createTracker(u),d=f.move(s);let m=f.move(r.containerPhrasing(n,{after:s,before:d,...f.current()}));const p=m.charCodeAt(0),b=du(u.before.charCodeAt(u.before.length-1),p,s);b.inside&&(m=Ra(p)+m.slice(1));const y=m.charCodeAt(m.length-1),E=du(u.after.charCodeAt(0),y,s);E.inside&&(m=m.slice(0,-1)+Ra(y));const S=f.move(s);return h(),r.attentionEncodeSurroundingInfo={after:E.outside,before:b.outside},d+m+S}function b2(n,a,r){return r.options.emphasis||"*"}function v2(n,a){let r=!1;return Us(n,function(u){if("value"in u&&/\\r?\\n|\\r/.test(u.value)||u.type==="break")return r=!0,ps}),!!((!n.depth||n.depth<3)&&Ds(n)&&(a.options.setext||r))}function x2(n,a,r,u){const s=Math.max(Math.min(6,n.depth||1),1),h=r.createTracker(u);if(v2(n,r)){const b=r.enter("headingSetext"),y=r.enter("phrasing"),E=r.containerPhrasing(n,{...h.current(),before:`\n`,after:`\n`});return y(),b(),E+`\n`+(s===1?"=":"-").repeat(E.length-(Math.max(E.lastIndexOf("\\r"),E.lastIndexOf(`\n`))+1))}const f="#".repeat(s),d=r.enter("headingAtx"),m=r.enter("phrasing");h.move(f+" ");let p=r.containerPhrasing(n,{before:"# ",after:`\n`,...h.current()});return/^[\\t ]/.test(p)&&(p=Ra(p.charCodeAt(0))+p.slice(1)),p=p?f+" "+p:f,r.options.closeAtx&&(p+=" "+f),m(),d(),p}Og.peek=S2;function Og(n){return n.value||""}function S2(){return"<"}Mg.peek=E2;function Mg(n,a,r,u){const s=Bs(r),h=s===\'"\'?"Quote":"Apostrophe",f=r.enter("image");let d=r.enter("label");const m=r.createTracker(u);let p=m.move("![");return p+=m.move(r.safe(n.alt,{before:p,after:"]",...m.current()})),p+=m.move("]("),d(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(d=r.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(r.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(d=r.enter("destinationRaw"),p+=m.move(r.safe(n.url,{before:p,after:n.title?" ":")",...m.current()}))),d(),n.title&&(d=r.enter(`title${h}`),p+=m.move(" "+s),p+=m.move(r.safe(n.title,{before:p,after:s,...m.current()})),p+=m.move(s),d()),p+=m.move(")"),f(),p}function E2(){return"!"}Rg.peek=k2;function Rg(n,a,r,u){const s=n.referenceType,h=r.enter("imageReference");let f=r.enter("label");const d=r.createTracker(u);let m=d.move("![");const p=r.safe(n.alt,{before:m,after:"]",...d.current()});m+=d.move(p+"]["),f();const b=r.stack;r.stack=[],f=r.enter("reference");const y=r.safe(r.associationId(n),{before:m,after:"]",...d.current()});return f(),r.stack=b,h(),s==="full"||!p||p!==y?m+=d.move(y+"]"):s==="shortcut"?m=m.slice(0,-1):m+=d.move("]"),m}function k2(){return"!"}Ng.peek=A2;function Ng(n,a,r){let u=n.value||"",s="`",h=-1;for(;new RegExp("(^|[^`])"+s+"([^`]|$)").test(u);)s+="`";for(/[^ \\r\\n]/.test(u)&&(/^[ \\r\\n]/.test(u)&&/[ \\r\\n]$/.test(u)||/^`|`$/.test(u))&&(u=" "+u+" ");++h<r.unsafe.length;){const f=r.unsafe[h],d=r.compilePattern(f);let m;if(f.atBreak)for(;m=d.exec(u);){let p=m.index;u.charCodeAt(p)===10&&u.charCodeAt(p-1)===13&&p--,u=u.slice(0,p)+" "+u.slice(m.index+1)}}return s+u+s}function A2(){return"`"}function Lg(n,a){const r=Ds(n);return!!(!a.options.resourceLink&&n.url&&!n.title&&n.children&&n.children.length===1&&n.children[0].type==="text"&&(r===n.url||"mailto:"+r===n.url)&&/^[a-z][a-z+.-]+:/i.test(n.url)&&!/[\\0- <>\\u007F]/.test(n.url))}Ug.peek=T2;function Ug(n,a,r,u){const s=Bs(r),h=s===\'"\'?"Quote":"Apostrophe",f=r.createTracker(u);let d,m;if(Lg(n,r)){const b=r.stack;r.stack=[],d=r.enter("autolink");let y=f.move("<");return y+=f.move(r.containerPhrasing(n,{before:y,after:">",...f.current()})),y+=f.move(">"),d(),r.stack=b,y}d=r.enter("link"),m=r.enter("label");let p=f.move("[");return p+=f.move(r.containerPhrasing(n,{before:p,after:"](",...f.current()})),p+=f.move("]("),m(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(m=r.enter("destinationLiteral"),p+=f.move("<"),p+=f.move(r.safe(n.url,{before:p,after:">",...f.current()})),p+=f.move(">")):(m=r.enter("destinationRaw"),p+=f.move(r.safe(n.url,{before:p,after:n.title?" ":")",...f.current()}))),m(),n.title&&(m=r.enter(`title${h}`),p+=f.move(" "+s),p+=f.move(r.safe(n.title,{before:p,after:s,...f.current()})),p+=f.move(s),m()),p+=f.move(")"),d(),p}function T2(n,a,r){return Lg(n,r)?"<":"["}jg.peek=w2;function jg(n,a,r,u){const s=n.referenceType,h=r.enter("linkReference");let f=r.enter("label");const d=r.createTracker(u);let m=d.move("[");const p=r.containerPhrasing(n,{before:m,after:"]",...d.current()});m+=d.move(p+"]["),f();const b=r.stack;r.stack=[],f=r.enter("reference");const y=r.safe(r.associationId(n),{before:m,after:"]",...d.current()});return f(),r.stack=b,h(),s==="full"||!p||p!==y?m+=d.move(y+"]"):s==="shortcut"?m=m.slice(0,-1):m+=d.move("]"),m}function w2(){return"["}function Hs(n){const a=n.options.bullet||"*";if(a!=="*"&&a!=="+"&&a!=="-")throw new Error("Cannot serialize items with `"+a+"` for `options.bullet`, expected `*`, `+`, or `-`");return a}function C2(n){const a=Hs(n),r=n.options.bulletOther;if(!r)return a==="*"?"-":"*";if(r!=="*"&&r!=="+"&&r!=="-")throw new Error("Cannot serialize items with `"+r+"` for `options.bulletOther`, expected `*`, `+`, or `-`");if(r===a)throw new Error("Expected `bullet` (`"+a+"`) and `bulletOther` (`"+r+"`) to be different");return r}function z2(n){const a=n.options.bulletOrdered||".";if(a!=="."&&a!==")")throw new Error("Cannot serialize items with `"+a+"` for `options.bulletOrdered`, expected `.` or `)`");return a}function Bg(n){const a=n.options.rule||"*";if(a!=="*"&&a!=="-"&&a!=="_")throw new Error("Cannot serialize rules with `"+a+"` for `options.rule`, expected `*`, `-`, or `_`");return a}function D2(n,a,r,u){const s=r.enter("list"),h=r.bulletCurrent;let f=n.ordered?z2(r):Hs(r);const d=n.ordered?f==="."?")":".":C2(r);let m=a&&r.bulletLastUsed?f===r.bulletLastUsed:!1;if(!n.ordered){const b=n.children?n.children[0]:void 0;if((f==="*"||f==="-")&&b&&(!b.children||!b.children[0])&&r.stack[r.stack.length-1]==="list"&&r.stack[r.stack.length-2]==="listItem"&&r.stack[r.stack.length-3]==="list"&&r.stack[r.stack.length-4]==="listItem"&&r.indexStack[r.indexStack.length-1]===0&&r.indexStack[r.indexStack.length-2]===0&&r.indexStack[r.indexStack.length-3]===0&&(m=!0),Bg(r)===f&&b){let y=-1;for(;++y<n.children.length;){const E=n.children[y];if(E&&E.type==="listItem"&&E.children&&E.children[0]&&E.children[0].type==="thematicBreak"){m=!0;break}}}}m&&(f=d),r.bulletCurrent=f;const p=r.containerFlow(n,u);return r.bulletLastUsed=f,r.bulletCurrent=h,s(),p}function _2(n){const a=n.options.listItemIndent||"one";if(a!=="tab"&&a!=="one"&&a!=="mixed")throw new Error("Cannot serialize items with `"+a+"` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");return a}function O2(n,a,r,u){const s=_2(r);let h=r.bulletCurrent||Hs(r);a&&a.type==="list"&&a.ordered&&(h=(typeof a.start=="number"&&a.start>-1?a.start:1)+(r.options.incrementListMarker===!1?0:a.children.indexOf(n))+h);let f=h.length+1;(s==="tab"||s==="mixed"&&(a&&a.type==="list"&&a.spread||n.spread))&&(f=Math.ceil(f/4)*4);const d=r.createTracker(u);d.move(h+" ".repeat(f-h.length)),d.shift(f);const m=r.enter("listItem"),p=r.indentLines(r.containerFlow(n,d.current()),b);return m(),p;function b(y,E,S){return E?(S?"":" ".repeat(f))+y:(S?h:h+" ".repeat(f-h.length))+y}}function M2(n,a,r,u){const s=r.enter("paragraph"),h=r.enter("phrasing"),f=r.containerPhrasing(n,u);return h(),s(),f}const R2=yu(["break","delete","emphasis","footnote","footnoteReference","image","imageReference","inlineCode","inlineMath","link","linkReference","mdxJsxTextElement","mdxTextExpression","strong","text","textDirective"]);function N2(n,a,r,u){return(n.children.some(function(f){return R2(f)})?r.containerPhrasing:r.containerFlow).call(r,n,u)}function L2(n){const a=n.options.strong||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize strong with `"+a+"` for `options.strong`, expected `*`, or `_`");return a}Hg.peek=U2;function Hg(n,a,r,u){const s=L2(r),h=r.enter("strong"),f=r.createTracker(u),d=f.move(s+s);let m=f.move(r.containerPhrasing(n,{after:s,before:d,...f.current()}));const p=m.charCodeAt(0),b=du(u.before.charCodeAt(u.before.length-1),p,s);b.inside&&(m=Ra(p)+m.slice(1));const y=m.charCodeAt(m.length-1),E=du(u.after.charCodeAt(0),y,s);E.inside&&(m=m.slice(0,-1)+Ra(y));const S=f.move(s+s);return h(),r.attentionEncodeSurroundingInfo={after:E.outside,before:b.outside},d+m+S}function U2(n,a,r){return r.options.strong||"*"}function j2(n,a,r,u){return r.safe(n.value,u)}function B2(n){const a=n.options.ruleRepetition||3;if(a<3)throw new Error("Cannot serialize rules with repetition `"+a+"` for `options.ruleRepetition`, expected `3` or more");return a}function H2(n,a,r){const u=(Bg(r)+(r.options.ruleSpaces?" ":"")).repeat(B2(r));return r.options.ruleSpaces?u.slice(0,-1):u}const qg={blockquote:o2,break:qm,code:p2,definition:g2,emphasis:_g,hardBreak:qm,heading:x2,html:Og,image:Mg,imageReference:Rg,inlineCode:Ng,link:Ug,linkReference:jg,list:D2,listItem:O2,paragraph:M2,root:N2,strong:Hg,text:j2,thematicBreak:H2};function q2(){return{enter:{table:Y2,tableData:Ym,tableHeader:Ym,tableRow:G2},exit:{codeText:X2,table:V2,tableData:as,tableHeader:as,tableRow:as}}}function Y2(n){const a=n._align;this.enter({type:"table",align:a.map(function(r){return r==="none"?null:r}),children:[]},n),this.data.inTable=!0}function V2(n){this.exit(n),this.data.inTable=void 0}function G2(n){this.enter({type:"tableRow",children:[]},n)}function as(n){this.exit(n)}function Ym(n){this.enter({type:"tableCell",children:[]},n)}function X2(n){let a=this.resume();this.data.inTable&&(a=a.replace(/\\\\([\\\\|])/g,Q2));const r=this.stack[this.stack.length-1];r.type,r.value=a,this.exit(n)}function Q2(n,a){return a==="|"?a:n}function Z2(n){const a=n||{},r=a.tableCellPadding,u=a.tablePipeAlign,s=a.stringLength,h=r?" ":"|";return{unsafe:[{character:"\\r",inConstruct:"tableCell"},{character:`\n`,inConstruct:"tableCell"},{atBreak:!0,character:"|",after:"[	 :-]"},{character:"|",inConstruct:"tableCell"},{atBreak:!0,character:":",after:"-"},{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{inlineCode:E,table:f,tableCell:m,tableRow:d}};function f(S,z,q,Q){return p(b(S,q,Q),S.align)}function d(S,z,q,Q){const R=y(S,q,Q),K=p([R]);return K.slice(0,K.indexOf(`\n`))}function m(S,z,q,Q){const R=q.enter("tableCell"),K=q.enter("phrasing"),X=q.containerPhrasing(S,{...Q,before:h,after:h});return K(),R(),X}function p(S,z){return r2(S,{align:z,alignDelimiters:u,padding:r,stringLength:s})}function b(S,z,q){const Q=S.children;let R=-1;const K=[],X=z.enter("table");for(;++R<Q.length;)K[R]=y(Q[R],z,q);return X(),K}function y(S,z,q){const Q=S.children;let R=-1;const K=[],X=z.enter("tableRow");for(;++R<Q.length;)K[R]=m(Q[R],S,z,q);return X(),K}function E(S,z,q){let Q=qg.inlineCode(S,z,q);return q.stack.includes("tableCell")&&(Q=Q.replace(/\\|/g,"\\\\$&")),Q}}function F2(){return{exit:{taskListCheckValueChecked:Vm,taskListCheckValueUnchecked:Vm,paragraph:K2}}}function I2(){return{unsafe:[{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{listItem:J2}}}function Vm(n){const a=this.stack[this.stack.length-2];a.type,a.checked=n.type==="taskListCheckValueChecked"}function K2(n){const a=this.stack[this.stack.length-2];if(a&&a.type==="listItem"&&typeof a.checked=="boolean"){const r=this.stack[this.stack.length-1];r.type;const u=r.children[0];if(u&&u.type==="text"){const s=a.children;let h=-1,f;for(;++h<s.length;){const d=s[h];if(d.type==="paragraph"){f=d;break}}f===r&&(u.value=u.value.slice(1),u.value.length===0?r.children.shift():r.position&&u.position&&typeof u.position.start.offset=="number"&&(u.position.start.column++,u.position.start.offset++,r.position.start=Object.assign({},u.position.start)))}}this.exit(n)}function J2(n,a,r,u){const s=n.children[0],h=typeof n.checked=="boolean"&&s&&s.type==="paragraph",f="["+(n.checked?"x":" ")+"] ",d=r.createTracker(u);h&&d.move(f);let m=qg.listItem(n,a,r,{...u,...d.current()});return h&&(m=m.replace(/^(?:[*+-]|\\d+\\.)([\\r\\n]| {1,3})/,p)),m;function p(b){return b+f}}function $2(){return[DE(),JE(),e2(),q2(),F2()]}function W2(n){return{extensions:[_E(),$E(n),t2(),Z2(n),I2()]}}const P2={tokenize:ak,partial:!0},Yg={tokenize:rk,partial:!0},Vg={tokenize:uk,partial:!0},Gg={tokenize:ok,partial:!0},ek={tokenize:ck,partial:!0},Xg={name:"wwwAutolink",tokenize:lk,previous:Zg},Qg={name:"protocolAutolink",tokenize:ik,previous:Fg},jn={name:"emailAutolink",tokenize:nk,previous:Ig},gn={};function tk(){return{text:gn}}let Dl=48;for(;Dl<123;)gn[Dl]=jn,Dl++,Dl===58?Dl=65:Dl===91&&(Dl=97);gn[43]=jn;gn[45]=jn;gn[46]=jn;gn[95]=jn;gn[72]=[jn,Qg];gn[104]=[jn,Qg];gn[87]=[jn,Xg];gn[119]=[jn,Xg];function nk(n,a,r){const u=this;let s,h;return f;function f(y){return!bs(y)||!Ig.call(u,u.previous)||qs(u.events)?r(y):(n.enter("literalAutolink"),n.enter("literalAutolinkEmail"),d(y))}function d(y){return bs(y)?(n.consume(y),d):y===64?(n.consume(y),m):r(y)}function m(y){return y===46?n.check(ek,b,p)(y):y===45||y===95||vt(y)?(h=!0,n.consume(y),m):b(y)}function p(y){return n.consume(y),s=!0,m}function b(y){return h&&s&&wt(u.previous)?(n.exit("literalAutolinkEmail"),n.exit("literalAutolink"),a(y)):r(y)}}function lk(n,a,r){const u=this;return s;function s(f){return f!==87&&f!==119||!Zg.call(u,u.previous)||qs(u.events)?r(f):(n.enter("literalAutolink"),n.enter("literalAutolinkWww"),n.check(P2,n.attempt(Yg,n.attempt(Vg,h),r),r)(f))}function h(f){return n.exit("literalAutolinkWww"),n.exit("literalAutolink"),a(f)}}function ik(n,a,r){const u=this;let s="",h=!1;return f;function f(y){return(y===72||y===104)&&Fg.call(u,u.previous)&&!qs(u.events)?(n.enter("literalAutolink"),n.enter("literalAutolinkHttp"),s+=String.fromCodePoint(y),n.consume(y),d):r(y)}function d(y){if(wt(y)&&s.length<5)return s+=String.fromCodePoint(y),n.consume(y),d;if(y===58){const E=s.toLowerCase();if(E==="http"||E==="https")return n.consume(y),m}return r(y)}function m(y){return y===47?(n.consume(y),h?p:(h=!0,m)):r(y)}function p(y){return y===null||su(y)||Xe(y)||Ol(y)||pu(y)?r(y):n.attempt(Yg,n.attempt(Vg,b),r)(y)}function b(y){return n.exit("literalAutolinkHttp"),n.exit("literalAutolink"),a(y)}}function ak(n,a,r){let u=0;return s;function s(f){return(f===87||f===119)&&u<3?(u++,n.consume(f),s):f===46&&u===3?(n.consume(f),h):r(f)}function h(f){return f===null?r(f):a(f)}}function rk(n,a,r){let u,s,h;return f;function f(p){return p===46||p===95?n.check(Gg,m,d)(p):p===null||Xe(p)||Ol(p)||p!==45&&pu(p)?m(p):(h=!0,n.consume(p),f)}function d(p){return p===95?u=!0:(s=u,u=void 0),n.consume(p),f}function m(p){return s||u||!h?r(p):a(p)}}function uk(n,a){let r=0,u=0;return s;function s(f){return f===40?(r++,n.consume(f),s):f===41&&u<r?h(f):f===33||f===34||f===38||f===39||f===41||f===42||f===44||f===46||f===58||f===59||f===60||f===63||f===93||f===95||f===126?n.check(Gg,a,h)(f):f===null||Xe(f)||Ol(f)?a(f):(n.consume(f),s)}function h(f){return f===41&&u++,n.consume(f),s}}function ok(n,a,r){return u;function u(d){return d===33||d===34||d===39||d===41||d===42||d===44||d===46||d===58||d===59||d===63||d===95||d===126?(n.consume(d),u):d===38?(n.consume(d),h):d===93?(n.consume(d),s):d===60||d===null||Xe(d)||Ol(d)?a(d):r(d)}function s(d){return d===null||d===40||d===91||Xe(d)||Ol(d)?a(d):u(d)}function h(d){return wt(d)?f(d):r(d)}function f(d){return d===59?(n.consume(d),u):wt(d)?(n.consume(d),f):r(d)}}function ck(n,a,r){return u;function u(h){return n.consume(h),s}function s(h){return vt(h)?r(h):a(h)}}function Zg(n){return n===null||n===40||n===42||n===95||n===91||n===93||n===126||Xe(n)}function Fg(n){return!wt(n)}function Ig(n){return!(n===47||bs(n))}function bs(n){return n===43||n===45||n===46||n===95||vt(n)}function qs(n){let a=n.length,r=!1;for(;a--;){const u=n[a][1];if((u.type==="labelLink"||u.type==="labelImage")&&!u._balanced){r=!0;break}if(u._gfmAutolinkLiteralWalkedInto){r=!1;break}}return n.length>0&&!r&&(n[n.length-1][1]._gfmAutolinkLiteralWalkedInto=!0),r}const sk={tokenize:bk,partial:!0};function fk(){return{document:{91:{name:"gfmFootnoteDefinition",tokenize:mk,continuation:{tokenize:gk},exit:yk}},text:{91:{name:"gfmFootnoteCall",tokenize:pk},93:{name:"gfmPotentialFootnoteCall",add:"after",tokenize:hk,resolveTo:dk}}}}function hk(n,a,r){const u=this;let s=u.events.length;const h=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f;for(;s--;){const m=u.events[s][1];if(m.type==="labelImage"){f=m;break}if(m.type==="gfmFootnoteCall"||m.type==="labelLink"||m.type==="label"||m.type==="image"||m.type==="link")break}return d;function d(m){if(!f||!f._balanced)return r(m);const p=cn(u.sliceSerialize({start:f.end,end:u.now()}));return p.codePointAt(0)!==94||!h.includes(p.slice(1))?r(m):(n.enter("gfmFootnoteCallLabelMarker"),n.consume(m),n.exit("gfmFootnoteCallLabelMarker"),a(m))}}function dk(n,a){let r=n.length;for(;r--;)if(n[r][1].type==="labelImage"&&n[r][0]==="enter"){n[r][1];break}n[r+1][1].type="data",n[r+3][1].type="gfmFootnoteCallLabelMarker";const u={type:"gfmFootnoteCall",start:Object.assign({},n[r+3][1].start),end:Object.assign({},n[n.length-1][1].end)},s={type:"gfmFootnoteCallMarker",start:Object.assign({},n[r+3][1].end),end:Object.assign({},n[r+3][1].end)};s.end.column++,s.end.offset++,s.end._bufferIndex++;const h={type:"gfmFootnoteCallString",start:Object.assign({},s.end),end:Object.assign({},n[n.length-1][1].start)},f={type:"chunkString",contentType:"string",start:Object.assign({},h.start),end:Object.assign({},h.end)},d=[n[r+1],n[r+2],["enter",u,a],n[r+3],n[r+4],["enter",s,a],["exit",s,a],["enter",h,a],["enter",f,a],["exit",f,a],["exit",h,a],n[n.length-2],n[n.length-1],["exit",u,a]];return n.splice(r,n.length-r+1,...d),n}function pk(n,a,r){const u=this,s=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let h=0,f;return d;function d(y){return n.enter("gfmFootnoteCall"),n.enter("gfmFootnoteCallLabelMarker"),n.consume(y),n.exit("gfmFootnoteCallLabelMarker"),m}function m(y){return y!==94?r(y):(n.enter("gfmFootnoteCallMarker"),n.consume(y),n.exit("gfmFootnoteCallMarker"),n.enter("gfmFootnoteCallString"),n.enter("chunkString").contentType="string",p)}function p(y){if(h>999||y===93&&!f||y===null||y===91||Xe(y))return r(y);if(y===93){n.exit("chunkString");const E=n.exit("gfmFootnoteCallString");return s.includes(cn(u.sliceSerialize(E)))?(n.enter("gfmFootnoteCallLabelMarker"),n.consume(y),n.exit("gfmFootnoteCallLabelMarker"),n.exit("gfmFootnoteCall"),a):r(y)}return Xe(y)||(f=!0),h++,n.consume(y),y===92?b:p}function b(y){return y===91||y===92||y===93?(n.consume(y),h++,p):p(y)}}function mk(n,a,r){const u=this,s=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let h,f=0,d;return m;function m(z){return n.enter("gfmFootnoteDefinition")._container=!0,n.enter("gfmFootnoteDefinitionLabel"),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(z),n.exit("gfmFootnoteDefinitionLabelMarker"),p}function p(z){return z===94?(n.enter("gfmFootnoteDefinitionMarker"),n.consume(z),n.exit("gfmFootnoteDefinitionMarker"),n.enter("gfmFootnoteDefinitionLabelString"),n.enter("chunkString").contentType="string",b):r(z)}function b(z){if(f>999||z===93&&!d||z===null||z===91||Xe(z))return r(z);if(z===93){n.exit("chunkString");const q=n.exit("gfmFootnoteDefinitionLabelString");return h=cn(u.sliceSerialize(q)),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(z),n.exit("gfmFootnoteDefinitionLabelMarker"),n.exit("gfmFootnoteDefinitionLabel"),E}return Xe(z)||(d=!0),f++,n.consume(z),z===92?y:b}function y(z){return z===91||z===92||z===93?(n.consume(z),f++,b):b(z)}function E(z){return z===58?(n.enter("definitionMarker"),n.consume(z),n.exit("definitionMarker"),s.includes(h)||s.push(h),Oe(n,S,"gfmFootnoteDefinitionWhitespace")):r(z)}function S(z){return a(z)}}function gk(n,a,r){return n.check(La,a,n.attempt(sk,a,r))}function yk(n){n.exit("gfmFootnoteDefinition")}function bk(n,a,r){const u=this;return Oe(n,s,"gfmFootnoteDefinitionIndent",5);function s(h){const f=u.events[u.events.length-1];return f&&f[1].type==="gfmFootnoteDefinitionIndent"&&f[2].sliceSerialize(f[1],!0).length===4?a(h):r(h)}}function vk(n){let r=(n||{}).singleTilde;const u={name:"strikethrough",tokenize:h,resolveAll:s};return r==null&&(r=!0),{text:{126:u},insideSpan:{null:[u]},attentionMarkers:{null:[126]}};function s(f,d){let m=-1;for(;++m<f.length;)if(f[m][0]==="enter"&&f[m][1].type==="strikethroughSequenceTemporary"&&f[m][1]._close){let p=m;for(;p--;)if(f[p][0]==="exit"&&f[p][1].type==="strikethroughSequenceTemporary"&&f[p][1]._open&&f[m][1].end.offset-f[m][1].start.offset===f[p][1].end.offset-f[p][1].start.offset){f[m][1].type="strikethroughSequence",f[p][1].type="strikethroughSequence";const b={type:"strikethrough",start:Object.assign({},f[p][1].start),end:Object.assign({},f[m][1].end)},y={type:"strikethroughText",start:Object.assign({},f[p][1].end),end:Object.assign({},f[m][1].start)},E=[["enter",b,d],["enter",f[p][1],d],["exit",f[p][1],d],["enter",y,d]],S=d.parser.constructs.insideSpan.null;S&&Zt(E,E.length,0,mu(S,f.slice(p+1,m),d)),Zt(E,E.length,0,[["exit",y,d],["enter",f[m][1],d],["exit",f[m][1],d],["exit",b,d]]),Zt(f,p-1,m-p+3,E),m=p+E.length-2;break}}for(m=-1;++m<f.length;)f[m][1].type==="strikethroughSequenceTemporary"&&(f[m][1].type="data");return f}function h(f,d,m){const p=this.previous,b=this.events;let y=0;return E;function E(z){return p===126&&b[b.length-1][1].type!=="characterEscape"?m(z):(f.enter("strikethroughSequenceTemporary"),S(z))}function S(z){const q=Ci(p);if(z===126)return y>1?m(z):(f.consume(z),y++,S);if(y<2&&!r)return m(z);const Q=f.exit("strikethroughSequenceTemporary"),R=Ci(z);return Q._open=!R||R===2&&!!q,Q._close=!q||q===2&&!!R,d(z)}}}class xk{constructor(){this.map=[]}add(a,r,u){Sk(this,a,r,u)}consume(a){if(this.map.sort(function(h,f){return h[0]-f[0]}),this.map.length===0)return;let r=this.map.length;const u=[];for(;r>0;)r-=1,u.push(a.slice(this.map[r][0]+this.map[r][1]),this.map[r][2]),a.length=this.map[r][0];u.push(a.slice()),a.length=0;let s=u.pop();for(;s;){for(const h of s)a.push(h);s=u.pop()}this.map.length=0}}function Sk(n,a,r,u){let s=0;if(!(r===0&&u.length===0)){for(;s<n.map.length;){if(n.map[s][0]===a){n.map[s][1]+=r,n.map[s][2].push(...u);return}s+=1}n.map.push([a,r,u])}}function Ek(n,a){let r=!1;const u=[];for(;a<n.length;){const s=n[a];if(r){if(s[0]==="enter")s[1].type==="tableContent"&&u.push(n[a+1][1].type==="tableDelimiterMarker"?"left":"none");else if(s[1].type==="tableContent"){if(n[a-1][1].type==="tableDelimiterMarker"){const h=u.length-1;u[h]=u[h]==="left"?"center":"right"}}else if(s[1].type==="tableDelimiterRow")break}else s[0]==="enter"&&s[1].type==="tableDelimiterRow"&&(r=!0);a+=1}return u}function kk(){return{flow:{null:{name:"table",tokenize:Ak,resolveAll:Tk}}}}function Ak(n,a,r){const u=this;let s=0,h=0,f;return d;function d(L){let ne=u.events.length-1;for(;ne>-1;){const ae=u.events[ne][1].type;if(ae==="lineEnding"||ae==="linePrefix")ne--;else break}const te=ne>-1?u.events[ne][1].type:null,ke=te==="tableHead"||te==="tableRow"?B:m;return ke===B&&u.parser.lazy[u.now().line]?r(L):ke(L)}function m(L){return n.enter("tableHead"),n.enter("tableRow"),p(L)}function p(L){return L===124||(f=!0,h+=1),b(L)}function b(L){return L===null?r(L):he(L)?h>1?(h=0,u.interrupt=!0,n.exit("tableRow"),n.enter("lineEnding"),n.consume(L),n.exit("lineEnding"),S):r(L):Ce(L)?Oe(n,b,"whitespace")(L):(h+=1,f&&(f=!1,s+=1),L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),f=!0,b):(n.enter("data"),y(L)))}function y(L){return L===null||L===124||Xe(L)?(n.exit("data"),b(L)):(n.consume(L),L===92?E:y)}function E(L){return L===92||L===124?(n.consume(L),y):y(L)}function S(L){return u.interrupt=!1,u.parser.lazy[u.now().line]?r(L):(n.enter("tableDelimiterRow"),f=!1,Ce(L)?Oe(n,z,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(L):z(L))}function z(L){return L===45||L===58?Q(L):L===124?(f=!0,n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),q):se(L)}function q(L){return Ce(L)?Oe(n,Q,"whitespace")(L):Q(L)}function Q(L){return L===58?(h+=1,f=!0,n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),R):L===45?(h+=1,R(L)):L===null||he(L)?oe(L):se(L)}function R(L){return L===45?(n.enter("tableDelimiterFiller"),K(L)):se(L)}function K(L){return L===45?(n.consume(L),K):L===58?(f=!0,n.exit("tableDelimiterFiller"),n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),X):(n.exit("tableDelimiterFiller"),X(L))}function X(L){return Ce(L)?Oe(n,oe,"whitespace")(L):oe(L)}function oe(L){return L===124?z(L):L===null||he(L)?!f||s!==h?se(L):(n.exit("tableDelimiterRow"),n.exit("tableHead"),a(L)):se(L)}function se(L){return r(L)}function B(L){return n.enter("tableRow"),ee(L)}function ee(L){return L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),ee):L===null||he(L)?(n.exit("tableRow"),a(L)):Ce(L)?Oe(n,ee,"whitespace")(L):(n.enter("data"),pe(L))}function pe(L){return L===null||L===124||Xe(L)?(n.exit("data"),ee(L)):(n.consume(L),L===92?ye:pe)}function ye(L){return L===92||L===124?(n.consume(L),pe):pe(L)}}function Tk(n,a){let r=-1,u=!0,s=0,h=[0,0,0,0],f=[0,0,0,0],d=!1,m=0,p,b,y;const E=new xk;for(;++r<n.length;){const S=n[r],z=S[1];S[0]==="enter"?z.type==="tableHead"?(d=!1,m!==0&&(Gm(E,a,m,p,b),b=void 0,m=0),p={type:"table",start:Object.assign({},z.start),end:Object.assign({},z.end)},E.add(r,0,[["enter",p,a]])):z.type==="tableRow"||z.type==="tableDelimiterRow"?(u=!0,y=void 0,h=[0,0,0,0],f=[0,r+1,0,0],d&&(d=!1,b={type:"tableBody",start:Object.assign({},z.start),end:Object.assign({},z.end)},E.add(r,0,[["enter",b,a]])),s=z.type==="tableDelimiterRow"?2:b?3:1):s&&(z.type==="data"||z.type==="tableDelimiterMarker"||z.type==="tableDelimiterFiller")?(u=!1,f[2]===0&&(h[1]!==0&&(f[0]=f[1],y=ru(E,a,h,s,void 0,y),h=[0,0,0,0]),f[2]=r)):z.type==="tableCellDivider"&&(u?u=!1:(h[1]!==0&&(f[0]=f[1],y=ru(E,a,h,s,void 0,y)),h=f,f=[h[1],r,0,0])):z.type==="tableHead"?(d=!0,m=r):z.type==="tableRow"||z.type==="tableDelimiterRow"?(m=r,h[1]!==0?(f[0]=f[1],y=ru(E,a,h,s,r,y)):f[1]!==0&&(y=ru(E,a,f,s,r,y)),s=0):s&&(z.type==="data"||z.type==="tableDelimiterMarker"||z.type==="tableDelimiterFiller")&&(f[3]=r)}for(m!==0&&Gm(E,a,m,p,b),E.consume(a.events),r=-1;++r<a.events.length;){const S=a.events[r];S[0]==="enter"&&S[1].type==="table"&&(S[1]._align=Ek(a.events,r))}return n}function ru(n,a,r,u,s,h){const f=u===1?"tableHeader":u===2?"tableDelimiter":"tableData",d="tableContent";r[0]!==0&&(h.end=Object.assign({},Ai(a.events,r[0])),n.add(r[0],0,[["exit",h,a]]));const m=Ai(a.events,r[1]);if(h={type:f,start:Object.assign({},m),end:Object.assign({},m)},n.add(r[1],0,[["enter",h,a]]),r[2]!==0){const p=Ai(a.events,r[2]),b=Ai(a.events,r[3]),y={type:d,start:Object.assign({},p),end:Object.assign({},b)};if(n.add(r[2],0,[["enter",y,a]]),u!==2){const E=a.events[r[2]],S=a.events[r[3]];if(E[1].end=Object.assign({},S[1].end),E[1].type="chunkText",E[1].contentType="text",r[3]>r[2]+1){const z=r[2]+1,q=r[3]-r[2]-1;n.add(z,q,[])}}n.add(r[3]+1,0,[["exit",y,a]])}return s!==void 0&&(h.end=Object.assign({},Ai(a.events,s)),n.add(s,0,[["exit",h,a]]),h=void 0),h}function Gm(n,a,r,u,s){const h=[],f=Ai(a.events,r);s&&(s.end=Object.assign({},f),h.push(["exit",s,a])),u.end=Object.assign({},f),h.push(["exit",u,a]),n.add(r+1,0,h)}function Ai(n,a){const r=n[a],u=r[0]==="enter"?"start":"end";return r[1][u]}const wk={name:"tasklistCheck",tokenize:zk};function Ck(){return{text:{91:wk}}}function zk(n,a,r){const u=this;return s;function s(m){return u.previous!==null||!u._gfmTasklistFirstContentOfListItem?r(m):(n.enter("taskListCheck"),n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),h)}function h(m){return Xe(m)?(n.enter("taskListCheckValueUnchecked"),n.consume(m),n.exit("taskListCheckValueUnchecked"),f):m===88||m===120?(n.enter("taskListCheckValueChecked"),n.consume(m),n.exit("taskListCheckValueChecked"),f):r(m)}function f(m){return m===93?(n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),n.exit("taskListCheck"),d):r(m)}function d(m){return he(m)?a(m):Ce(m)?n.check({tokenize:Dk},a,r)(m):r(m)}}function Dk(n,a,r){return Oe(n,u,"whitespace");function u(s){return s===null?r(s):a(s)}}function _k(n){return ag([tk(),fk(),vk(n),kk(),Ck()])}const Ok={};function Mk(n){const a=this,r=n||Ok,u=a.data(),s=u.micromarkExtensions||(u.micromarkExtensions=[]),h=u.fromMarkdownExtensions||(u.fromMarkdownExtensions=[]),f=u.toMarkdownExtensions||(u.toMarkdownExtensions=[]);s.push(_k(r)),h.push($2()),f.push(W2(r))}function Rk(){const n=bt(s=>s.ui.modal==="instructions"),a=bt(s=>s.conversation.instructions),r=Tt.useRef(null),u=Tt.useRef(null);return Tt.useEffect(()=>{if(n)return u.current=document.activeElement,r.current?.focus(),()=>{u.current?.focus()}},[n]),n?I.jsx("div",{className:"modal-backdrop",onClick:()=>yt({type:"ui/click/modal-backdrop"}),children:I.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"instructions-title",tabIndex:-1,ref:r,onClick:s=>s.stopPropagation(),children:[I.jsxs("div",{className:"modal-header",children:[I.jsx("span",{className:"modal-title",id:"instructions-title",children:"Instructions"}),I.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>yt({type:"ui/click/modal-close"}),children:I.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),I.jsx("div",{className:"modal-body instructions-body",children:a===void 0?I.jsx("p",{className:"loading-state",children:"Loading instructions\u2026"}):I.jsx(vE,{remarkPlugins:[Mk],disallowedElements:["script","iframe","object","embed"],unwrapDisallowed:!0,children:a})})]})}):null}function Nk(){return I.jsxs("div",{className:"thinking","aria-live":"polite","aria-label":"Assistant is responding",children:[I.jsx("span",{className:"tdot"}),I.jsx("span",{className:"tdot"}),I.jsx("span",{className:"tdot"})]})}function Xm({item:n,speakingItemId:a}){const r=n.role==="user"&&n.id===a,u=["transcript-item",`role-${n.role}`,`source-${n.source}`,n.streaming?"streaming":"",r?"speaking":""].filter(Boolean).join(" ");return I.jsx("article",{className:u,children:n.text||(n.role==="user"?"\u2026":"")})}function Lk({tool:n}){const[a,r]=Tt.useState(!1),u=()=>r(h=>!h),s=n.status==="completed"?n.result:n.status==="failed"||n.status==="interrupted"?n.error:null;return I.jsxs("article",{className:"tool-call",tabIndex:0,onClick:u,onKeyDown:h=>{(h.key==="Enter"||h.key===" ")&&(h.preventDefault(),u())},children:[I.jsxs("div",{className:"tool-row",children:[I.jsx("span",{className:"toggle",children:a?"\u25BE":"\u25B8"}),I.jsxs("span",{children:["Tool: ",n.toolName,"(...)"]}),I.jsx("span",{className:`badge ${n.status}`,children:n.status})]}),a?I.jsxs("div",{className:"tool-call-body",children:[I.jsx("div",{className:"section-label",children:"ARGUMENTS"}),I.jsx("pre",{children:JSON.stringify(n.arguments,null,2)}),I.jsx("div",{className:"section-label",children:"RESULT"}),I.jsx("pre",{children:JSON.stringify(s,null,2)})]}):null]})}function Uk(){const{conversation:n,streamDrafts:a,speakingItemId:r}=bt(Ss(d=>({conversation:d.conversation.conversation,streamDrafts:d.conversation.streamDrafts,speakingItemId:d.voice.speakingItemId})));if(n===null)return I.jsxs("div",{className:"empty-state",children:[I.jsx("svg",{className:"empty-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:I.jsx("path",{d:"M12 2v20M5 8v8M19 8v8"})}),I.jsx("div",{children:"Ready to start"})]});if(n.status==="ended")return I.jsxs("div",{className:"ended-state",children:[I.jsx("strong",{children:"Conversation ended"}),I.jsx("span",{children:"Transcript is no longer active."})]});const u=n,s=new Map(u.transcript.map(d=>[d.id,d])),h=new Map(u.toolCalls.map(d=>[d.id,d])),f=[];for(const d of u.timeline)if(d.type==="transcript"){const m=s.get(d.transcriptItemId);m!==void 0&&f.push(I.jsx(Xm,{item:{id:m.id,role:m.role,source:m.source,text:m.text,streaming:!1},speakingItemId:r},`t-${m.id}`))}else{const m=h.get(d.toolCallId);m!==void 0&&f.push(I.jsx(Lk,{tool:m},`c-${m.id}`))}for(const d of a.values())s.has(d.itemId)||f.push(I.jsx(Xm,{item:{id:d.itemId,role:d.role,source:d.source,text:d.fullTextSoFar,streaming:!0},speakingItemId:r},`d-${d.itemId}`));return I.jsx(I.Fragment,{children:f})}function jk(){const n=bt(p=>p.ui.modal==="transcript"),a=bt(p=>p.conversation.atBottom),r=bt(p=>p.voice.responseActive),u=bt(p=>p.conversation.conversation?.transcript),s=bt(p=>p.conversation.streamDrafts),h=Tt.useRef(null),f=Tt.useRef(null),d=Tt.useRef(null);if(Tt.useEffect(()=>{if(n)return d.current=document.activeElement,h.current?.focus(),()=>{d.current?.focus()}},[n]),Tt.useEffect(()=>{n&&a&&f.current!==null&&(f.current.scrollTop=f.current.scrollHeight)},[n,a,u,s]),!n)return null;const m=p=>{if(p.key!=="Tab")return;const b=h.current;if(b===null)return;const y=b.querySelectorAll(\'button, [href], select, textarea, [tabindex]:not([tabindex="-1"])\');if(y.length===0)return;const E=y[0],S=y[y.length-1];E===void 0||S===void 0||(p.shiftKey&&document.activeElement===E?(p.preventDefault(),S.focus()):!p.shiftKey&&document.activeElement===S&&(p.preventDefault(),E.focus()))};return I.jsx("div",{className:"modal-backdrop",onClick:()=>yt({type:"ui/click/modal-backdrop"}),children:I.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"transcript-title",tabIndex:-1,ref:h,onClick:p=>p.stopPropagation(),onKeyDown:m,children:[I.jsxs("div",{className:"modal-header",children:[I.jsx("span",{className:"modal-title",id:"transcript-title",children:"Conversation"}),I.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>yt({type:"ui/click/modal-close"}),children:I.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),I.jsxs("div",{className:"modal-body",ref:f,onScroll:p=>{const b=p.currentTarget;yt({type:"ui/scroll/transcript",atBottom:b.scrollHeight-b.scrollTop-b.clientHeight<80})},children:[I.jsx(Uk,{}),r?I.jsx(Nk,{}):null]})]})})}function Bk(){const n=bt(r=>r.ui.duplicateClient),a=bt(r=>r.ui.moreActionsOpen);return Tt.useEffect(()=>{const r=u=>{u.key==="Escape"&&yt({type:"ui/key/escape"})};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[]),Tt.useEffect(()=>{if(!a)return;const r=s=>{const h=s.target;h?.closest("[data-more-actions]")===null&&h?.closest(\'[aria-label="More actions"]\')===null&&yt({type:"ui/click/modal-backdrop"})},u=window.setTimeout(()=>document.addEventListener("click",r),0);return()=>{window.clearTimeout(u),document.removeEventListener("click",r)}},[a]),n?I.jsx(x0,{}):I.jsxs(I.Fragment,{children:[I.jsx(ub,{}),I.jsx(jk,{}),I.jsx(Rk,{})]})}const Hk="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";async function qk(n){if(navigator.userActivation&&navigator.userActivation.hasBeenActive===!1)return!1;try{const a=new Audio(Hk);return a.volume=0,await a.play(),a.pause(),!0}catch(a){return n({type:"browser/window/error",message:`canAutoplay.probe.blocked: ${String(a instanceof Error?a.message:a)}`}),!1}}function Yk({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,s=!1;const h=a(f=>{f.type==="browser/autoplay/probed"&&s&&(s=!1,n({type:"ui/click/primary"}))});return qk(n).then(f=>{u||(u=!0,s=r().audio.pendingSessionStart,n({type:"browser/autoplay/probed",allowed:f}))}),h}function Vk({dispatch:n}){const a=u=>{n({type:"browser/window/error",message:u.message})},r=u=>{n({type:"browser/window/unhandled-rejection",reason:String(u.reason)})};return window.addEventListener("error",a),window.addEventListener("unhandledrejection",r),()=>{window.removeEventListener("error",a),window.removeEventListener("unhandledrejection",r)}}const ja={dispatch:yt,subscribeToActions:Y0,getState:q0};F0(ja);nb(ja);G0(ja);Vk(ja);Yk(ja);const Kg=document.getElementById("root");if(Kg===null)throw new Error("Root element #root not found");v0.createRoot(Kg).render(I.jsx(Tt.StrictMode,{children:I.jsx(Bk,{})}));</script>\n    <style rel="stylesheet" crossorigin>:root{--bg-base: #09090b;--bg-card: #18181b;--border: #27272a;--text-dim: #52525b;--text-muted: #71717a;--text-default: #a1a1aa;--text-bright: #e4e4e7;--text-white: #fafafa;--accent: #22d3ee;--role-user: #a78bfa;--role-assistant: #34d399;--role-system: #fb923c;--role-tool: #60a5fa;--state-error: #f87171;--dot-connected: #22c55e;--dot-connecting: #eab308;--dot-disconnected: #52525b;--dot-error: #f87171;--font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;--z-tab: 100;--z-backdrop: 150;--z-modal: 200}*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--bg-base);color:var(--text-default);font-family:var(--font-sans)}button,select{font:inherit}button:focus-visible,select:focus-visible,.tool-call:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:active:enabled{transform:scale(.97)}.floating-tab{position:fixed;top:16px;left:16px;z-index:var(--z-tab, 100);display:flex;align-items:center;gap:14px;pointer-events:all}.floating-tab .icon-btn{position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;padding:0;color:var(--text-white);opacity:.7;cursor:pointer;transition:opacity .15s,transform 80ms}.floating-tab .icon-btn:hover:enabled{opacity:1}.floating-tab .icon-btn:active:enabled{transform:scale(.96)}.floating-tab .icon-btn:disabled{opacity:.35;cursor:not-allowed}.shield-badge{position:absolute;right:-3px;bottom:-3px;font-size:9px;line-height:1;color:var(--dot-connecting)}.connection{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px}.dot{width:8px;height:8px;border-radius:50%;background:var(--dot-disconnected)}.dot.connected{background:var(--dot-connected)}.dot.connecting{background:var(--dot-connecting)}.dot.disconnected{background:var(--dot-disconnected)}.dot.error{background:var(--dot-error)}.meters{display:flex;align-items:flex-end;gap:2px;height:16px}.meters.dimmed{opacity:.3}.bar{width:2px;height:16px;border-radius:2px;background:#22d3ee99;transform:scaleY(var(--level, .1));transform-origin:bottom;transition:transform 50ms linear}.more-actions-popover{position:absolute;left:0;top:36px;z-index:var(--z-tab, 100);width:min(320px,calc(100vw - 32px));padding:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);box-shadow:0 12px 32px #00000059}.field-label{display:block;margin-bottom:4px;color:var(--text-muted);font-size:11px;letter-spacing:.05em;text-transform:uppercase}select{width:100%;appearance:none;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-bright);padding:6px 10px;font-size:13px}.menu-item{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-bright);font-size:13px;text-align:left;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.menu-item:hover:enabled{border-color:#3f3f46;background:#ffffff0a}.menu-item:disabled{opacity:.4;cursor:not-allowed}.mic-note{color:var(--text-muted);font-size:12px;font-style:italic}.error-block{background:#f8717112;border:1px solid rgba(248,113,113,.2);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px}.error-title{color:var(--state-error);font-size:13px;font-weight:600}.retry{height:28px;border:1px solid rgba(248,113,113,.4);background:transparent;color:var(--state-error);font-size:12px;border-radius:6px;cursor:pointer}.modal-backdrop{position:fixed;inset:0;z-index:var(--z-backdrop, 150);background:#0009;display:flex;align-items:center;justify-content:center}.modal{position:relative;z-index:var(--z-modal, 200);width:min(680px,calc(100vw - 32px));max-width:680px;max-height:80vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);box-shadow:0 24px 64px #00000080}.modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0}.modal-title{color:var(--text-bright);font-size:14px;font-weight:500}.modal-close{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:6px}.modal-close:hover{color:var(--text-bright)}.modal-body{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}.loading-state{color:var(--text-muted);font-style:italic}.instructions-body{white-space:pre-wrap}.instructions-body p,.instructions-body ul,.instructions-body ol,.instructions-body li,.instructions-body blockquote,.instructions-body h1,.instructions-body h2,.instructions-body h3,.instructions-body h4,.instructions-body h5,.instructions-body h6{white-space:normal}.empty-state,.ended-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.empty-icon{width:32px;height:32px;opacity:.5}.transcript-item{padding:8px 12px;border-radius:0 6px 6px 0;color:var(--text-bright);font-size:14px;line-height:1.55;word-break:break-word}.transcript-item.streaming{opacity:1}.transcript-item.speaking{opacity:.85}.transcript-item.speaking:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--role-user);margin-right:6px;animation:speaking-pulse 1s ease-in-out infinite;vertical-align:middle}@keyframes speaking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}.role-user{border-left:2px solid var(--role-user)}.role-assistant{border-left:2px solid var(--role-assistant)}.role-system{border-left:2px solid var(--role-system);background:#fb923c0f;color:#fb923cd9;font-size:13px;font-style:italic}.source-textInput{background:#a78bfa0a}.source-system.role-user,.source-system.role-assistant{border-left-style:dashed;color:var(--text-default)}.source-firstMessage{position:relative;border:1px solid rgba(167,139,250,.25);background:#a78bfa0f;border-radius:6px;padding-right:110px}.source-firstMessage:after{content:"first message";position:absolute;top:6px;right:8px;color:var(--text-dim);font-family:var(--font-mono);font-size:10px}.tool-call{background:#60a5fa12;border:1px solid rgba(96,165,250,.18);border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:12px;cursor:pointer;user-select:none}.tool-row{display:flex;align-items:center;gap:8px}.badge{border-radius:4px;padding:2px 7px;background:#34d3991f;color:#34d399;font-size:11px}.badge.started{background:#fbbf2426;color:#fbbf24}.badge.failed{background:#f871711f;color:#f87171}.badge.interrupted{background:#a1a1aa1f;color:#71717a}.tool-call-body{overflow:hidden}.section-label{margin:10px 0 4px;color:var(--text-dim);font-size:11px;letter-spacing:.08em}pre{margin:0 0 8px;padding:8px;overflow-x:auto;border-radius:4px;background:#00000040;color:var(--text-default);white-space:pre-wrap;word-break:break-all}.duplicate-page{min-height:100dvh;max-width:380px;margin:0 auto;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.thinking{display:flex;gap:4px;align-items:center;padding:6px 10px;margin:0 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)}.thinking .tdot{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:.4;animation:thinking-pulse 1s ease-in-out infinite}.thinking .tdot:nth-child(2){animation-delay:.15s}.thinking .tdot:nth-child(3){animation-delay:.3s}@keyframes thinking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}</style>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';

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
  #browserProxiedEmitter;
  #pendingVoiceSession;
  #lifecycleLocked = false;
  #autoResponseEnabled = true;
  #responseInFlight = false;
  #instructions;
  #pendingToolResultCount = 0;
  #activeToolAbortControllers = /* @__PURE__ */ new Map();
  #streamingAssistantText = /* @__PURE__ */ new Map();
  constructor(config) {
    super();
    validateConfig(config);
    this.#config = normalizeConfig(config);
    this.#voiceFactory = config.__voiceFactory;
    this.#tools = config.tools;
    this.#instructions = config.realtime.instructions;
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
    });
    realtime.on("response.done", () => {
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
        tools: toolsToRealtimeTools(this.#tools, this.#toolDescriptions)
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
      createdAt: item.createdAt
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
    const tool = this.#tools[toolName];
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
      createdAt: startedAt
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
      createdAt: item.createdAt
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
  #handleHttpRequest(request, response, html) {
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
        instructions: this.#instructions
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
      firstMessageRole: config.browserSession?.firstMessageRole ?? "user"
    },
    ui: {
      title: config.ui?.title ?? DEFAULT_UI_TITLE
    }
  };
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
    timeline: [...conversation.timeline]
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
var pendingResponseTimer = null;
function scheduleResponse() {
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
  if (queuedInstructionsUpdate) {
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
