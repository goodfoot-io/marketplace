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
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve as resolvePath } from "node:path";

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
var ui_dist_default = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>__REALTIME_VOICE_TITLE__</title>\n    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css" />\n    <script type="module" crossorigin>(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll(\'link[rel="modulepreload"]\'))u(s);new MutationObserver(s=>{for(const f of s)if(f.type==="childList")for(const d of f.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&u(d)}).observe(document,{childList:!0,subtree:!0});function r(s){const f={};return s.integrity&&(f.integrity=s.integrity),s.referrerPolicy&&(f.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?f.credentials="include":s.crossOrigin==="anonymous"?f.credentials="omit":f.credentials="same-origin",f}function u(s){if(s.ep)return;s.ep=!0;const f=r(s);fetch(s.href,f)}})();function ks(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var jc={exports:{}},Ea={};/**\n * @license React\n * react-jsx-runtime.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Vp;function pv(){if(Vp)return Ea;Vp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.fragment");function r(u,s,f){var d=null;if(f!==void 0&&(d=""+f),s.key!==void 0&&(d=""+s.key),"key"in s){f={};for(var p in s)p!=="key"&&(f[p]=s[p])}else f=s;return s=f.ref,{$$typeof:n,type:u,key:d,ref:s!==void 0?s:null,props:f}}return Ea.Fragment=a,Ea.jsx=r,Ea.jsxs=r,Ea}var Gp;function mv(){return Gp||(Gp=1,jc.exports=pv()),jc.exports}var J=mv(),Bc={exports:{}},ve={};/**\n * @license React\n * react.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Xp;function gv(){if(Xp)return ve;Xp=1;var n=Symbol.for("react.transitional.element"),a=Symbol.for("react.portal"),r=Symbol.for("react.fragment"),u=Symbol.for("react.strict_mode"),s=Symbol.for("react.profiler"),f=Symbol.for("react.consumer"),d=Symbol.for("react.context"),p=Symbol.for("react.forward_ref"),m=Symbol.for("react.suspense"),h=Symbol.for("react.memo"),v=Symbol.for("react.lazy"),y=Symbol.for("react.activity"),E=Symbol.iterator;function x(T){return T===null||typeof T!="object"?null:(T=E&&T[E]||T["@@iterator"],typeof T=="function"?T:null)}var C={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},H=Object.assign,j={};function O(T,Y,b){this.props=T,this.context=Y,this.refs=j,this.updater=b||C}O.prototype.isReactComponent={},O.prototype.setState=function(T,Y){if(typeof T!="object"&&typeof T!="function"&&T!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,T,Y,"setState")},O.prototype.forceUpdate=function(T){this.updater.enqueueForceUpdate(this,T,"forceUpdate")};function F(){}F.prototype=O.prototype;function X(T,Y,b){this.props=T,this.context=Y,this.refs=j,this.updater=b||C}var ne=X.prototype=new F;ne.constructor=X,H(ne,O.prototype),ne.isPureReactComponent=!0;var re=Array.isArray;function B(){}var te={H:null,A:null,T:null,S:null},de=Object.prototype.hasOwnProperty;function ye(T,Y,b){var _=b.ref;return{$$typeof:n,type:T,key:Y,ref:_!==void 0?_:null,props:b}}function L(T,Y){return ye(T.type,Y,T.props)}function ie(T){return typeof T=="object"&&T!==null&&T.$$typeof===n}function le(T){var Y={"=":"=0",":":"=2"};return"$"+T.replace(/[=:]/g,function(b){return Y[b]})}var ke=/\\/+/g;function oe(T,Y){return typeof T=="object"&&T!==null&&T.key!=null?le(""+T.key):Y.toString(36)}function W(T){switch(T.status){case"fulfilled":return T.value;case"rejected":throw T.reason;default:switch(typeof T.status=="string"?T.then(B,B):(T.status="pending",T.then(function(Y){T.status==="pending"&&(T.status="fulfilled",T.value=Y)},function(Y){T.status==="pending"&&(T.status="rejected",T.reason=Y)})),T.status){case"fulfilled":return T.value;case"rejected":throw T.reason}}throw T}function R(T,Y,b,_,Q){var K=typeof T;(K==="undefined"||K==="boolean")&&(T=null);var ee=!1;if(T===null)ee=!0;else switch(K){case"bigint":case"string":case"number":ee=!0;break;case"object":switch(T.$$typeof){case n:case a:ee=!0;break;case v:return ee=T._init,R(ee(T._payload),Y,b,_,Q)}}if(ee)return Q=Q(T),ee=_===""?"."+oe(T,0):_,re(Q)?(b="",ee!=null&&(b=ee.replace(ke,"$&/")+"/"),R(Q,Y,b,"",function(Ae){return Ae})):Q!=null&&(ie(Q)&&(Q=L(Q,b+(Q.key==null||T&&T.key===Q.key?"":(""+Q.key).replace(ke,"$&/")+"/")+ee)),Y.push(Q)),1;ee=0;var ue=_===""?".":_+":";if(re(T))for(var pe=0;pe<T.length;pe++)_=T[pe],K=ue+oe(_,pe),ee+=R(_,Y,b,K,Q);else if(pe=x(T),typeof pe=="function")for(T=pe.call(T),pe=0;!(_=T.next()).done;)_=_.value,K=ue+oe(_,pe++),ee+=R(_,Y,b,K,Q);else if(K==="object"){if(typeof T.then=="function")return R(W(T),Y,b,_,Q);throw Y=String(T),Error("Objects are not valid as a React child (found: "+(Y==="[object Object]"?"object with keys {"+Object.keys(T).join(", ")+"}":Y)+"). If you meant to render a collection of children, use an array instead.")}return ee}function I(T,Y,b){if(T==null)return T;var _=[],Q=0;return R(T,_,"","",function(K){return Y.call(b,K,Q++)}),_}function ce(T){if(T._status===-1){var Y=T._result;Y=Y(),Y.then(function(b){(T._status===0||T._status===-1)&&(T._status=1,T._result=b)},function(b){(T._status===0||T._status===-1)&&(T._status=2,T._result=b)}),T._status===-1&&(T._status=0,T._result=Y)}if(T._status===1)return T._result.default;throw T._result}var Ee=typeof reportError=="function"?reportError:function(T){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var Y=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof T=="object"&&T!==null&&typeof T.message=="string"?String(T.message):String(T),error:T});if(!window.dispatchEvent(Y))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",T);return}console.error(T)},k={map:I,forEach:function(T,Y,b){I(T,function(){Y.apply(this,arguments)},b)},count:function(T){var Y=0;return I(T,function(){Y++}),Y},toArray:function(T){return I(T,function(Y){return Y})||[]},only:function(T){if(!ie(T))throw Error("React.Children.only expected to receive a single React element child.");return T}};return ve.Activity=y,ve.Children=k,ve.Component=O,ve.Fragment=r,ve.Profiler=s,ve.PureComponent=X,ve.StrictMode=u,ve.Suspense=m,ve.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=te,ve.__COMPILER_RUNTIME={__proto__:null,c:function(T){return te.H.useMemoCache(T)}},ve.cache=function(T){return function(){return T.apply(null,arguments)}},ve.cacheSignal=function(){return null},ve.cloneElement=function(T,Y,b){if(T==null)throw Error("The argument must be a React element, but you passed "+T+".");var _=H({},T.props),Q=T.key;if(Y!=null)for(K in Y.key!==void 0&&(Q=""+Y.key),Y)!de.call(Y,K)||K==="key"||K==="__self"||K==="__source"||K==="ref"&&Y.ref===void 0||(_[K]=Y[K]);var K=arguments.length-2;if(K===1)_.children=b;else if(1<K){for(var ee=Array(K),ue=0;ue<K;ue++)ee[ue]=arguments[ue+2];_.children=ee}return ye(T.type,Q,_)},ve.createContext=function(T){return T={$$typeof:d,_currentValue:T,_currentValue2:T,_threadCount:0,Provider:null,Consumer:null},T.Provider=T,T.Consumer={$$typeof:f,_context:T},T},ve.createElement=function(T,Y,b){var _,Q={},K=null;if(Y!=null)for(_ in Y.key!==void 0&&(K=""+Y.key),Y)de.call(Y,_)&&_!=="key"&&_!=="__self"&&_!=="__source"&&(Q[_]=Y[_]);var ee=arguments.length-2;if(ee===1)Q.children=b;else if(1<ee){for(var ue=Array(ee),pe=0;pe<ee;pe++)ue[pe]=arguments[pe+2];Q.children=ue}if(T&&T.defaultProps)for(_ in ee=T.defaultProps,ee)Q[_]===void 0&&(Q[_]=ee[_]);return ye(T,K,Q)},ve.createRef=function(){return{current:null}},ve.forwardRef=function(T){return{$$typeof:p,render:T}},ve.isValidElement=ie,ve.lazy=function(T){return{$$typeof:v,_payload:{_status:-1,_result:T},_init:ce}},ve.memo=function(T,Y){return{$$typeof:h,type:T,compare:Y===void 0?null:Y}},ve.startTransition=function(T){var Y=te.T,b={};te.T=b;try{var _=T(),Q=te.S;Q!==null&&Q(b,_),typeof _=="object"&&_!==null&&typeof _.then=="function"&&_.then(B,Ee)}catch(K){Ee(K)}finally{Y!==null&&b.types!==null&&(Y.types=b.types),te.T=Y}},ve.unstable_useCacheRefresh=function(){return te.H.useCacheRefresh()},ve.use=function(T){return te.H.use(T)},ve.useActionState=function(T,Y,b){return te.H.useActionState(T,Y,b)},ve.useCallback=function(T,Y){return te.H.useCallback(T,Y)},ve.useContext=function(T){return te.H.useContext(T)},ve.useDebugValue=function(){},ve.useDeferredValue=function(T,Y){return te.H.useDeferredValue(T,Y)},ve.useEffect=function(T,Y){return te.H.useEffect(T,Y)},ve.useEffectEvent=function(T){return te.H.useEffectEvent(T)},ve.useId=function(){return te.H.useId()},ve.useImperativeHandle=function(T,Y,b){return te.H.useImperativeHandle(T,Y,b)},ve.useInsertionEffect=function(T,Y){return te.H.useInsertionEffect(T,Y)},ve.useLayoutEffect=function(T,Y){return te.H.useLayoutEffect(T,Y)},ve.useMemo=function(T,Y){return te.H.useMemo(T,Y)},ve.useOptimistic=function(T,Y){return te.H.useOptimistic(T,Y)},ve.useReducer=function(T,Y,b){return te.H.useReducer(T,Y,b)},ve.useRef=function(T){return te.H.useRef(T)},ve.useState=function(T){return te.H.useState(T)},ve.useSyncExternalStore=function(T,Y,b){return te.H.useSyncExternalStore(T,Y,b)},ve.useTransition=function(){return te.H.useTransition()},ve.version="19.2.6",ve}var Qp;function As(){return Qp||(Qp=1,Bc.exports=gv()),Bc.exports}var Ct=As();const za=ks(Ct);var Hc={exports:{}},ka={},qc={exports:{}},Yc={};/**\n * @license React\n * scheduler.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Zp;function yv(){return Zp||(Zp=1,(function(n){function a(R,I){var ce=R.length;R.push(I);e:for(;0<ce;){var Ee=ce-1>>>1,k=R[Ee];if(0<s(k,I))R[Ee]=I,R[ce]=k,ce=Ee;else break e}}function r(R){return R.length===0?null:R[0]}function u(R){if(R.length===0)return null;var I=R[0],ce=R.pop();if(ce!==I){R[0]=ce;e:for(var Ee=0,k=R.length,T=k>>>1;Ee<T;){var Y=2*(Ee+1)-1,b=R[Y],_=Y+1,Q=R[_];if(0>s(b,ce))_<k&&0>s(Q,b)?(R[Ee]=Q,R[_]=ce,Ee=_):(R[Ee]=b,R[Y]=ce,Ee=Y);else if(_<k&&0>s(Q,ce))R[Ee]=Q,R[_]=ce,Ee=_;else break e}}return I}function s(R,I){var ce=R.sortIndex-I.sortIndex;return ce!==0?ce:R.id-I.id}if(n.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var f=performance;n.unstable_now=function(){return f.now()}}else{var d=Date,p=d.now();n.unstable_now=function(){return d.now()-p}}var m=[],h=[],v=1,y=null,E=3,x=!1,C=!1,H=!1,j=!1,O=typeof setTimeout=="function"?setTimeout:null,F=typeof clearTimeout=="function"?clearTimeout:null,X=typeof setImmediate<"u"?setImmediate:null;function ne(R){for(var I=r(h);I!==null;){if(I.callback===null)u(h);else if(I.startTime<=R)u(h),I.sortIndex=I.expirationTime,a(m,I);else break;I=r(h)}}function re(R){if(H=!1,ne(R),!C)if(r(m)!==null)C=!0,B||(B=!0,le());else{var I=r(h);I!==null&&W(re,I.startTime-R)}}var B=!1,te=-1,de=5,ye=-1;function L(){return j?!0:!(n.unstable_now()-ye<de)}function ie(){if(j=!1,B){var R=n.unstable_now();ye=R;var I=!0;try{e:{C=!1,H&&(H=!1,F(te),te=-1),x=!0;var ce=E;try{t:{for(ne(R),y=r(m);y!==null&&!(y.expirationTime>R&&L());){var Ee=y.callback;if(typeof Ee=="function"){y.callback=null,E=y.priorityLevel;var k=Ee(y.expirationTime<=R);if(R=n.unstable_now(),typeof k=="function"){y.callback=k,ne(R),I=!0;break t}y===r(m)&&u(m),ne(R)}else u(m);y=r(m)}if(y!==null)I=!0;else{var T=r(h);T!==null&&W(re,T.startTime-R),I=!1}}break e}finally{y=null,E=ce,x=!1}I=void 0}}finally{I?le():B=!1}}}var le;if(typeof X=="function")le=function(){X(ie)};else if(typeof MessageChannel<"u"){var ke=new MessageChannel,oe=ke.port2;ke.port1.onmessage=ie,le=function(){oe.postMessage(null)}}else le=function(){O(ie,0)};function W(R,I){te=O(function(){R(n.unstable_now())},I)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(R){R.callback=null},n.unstable_forceFrameRate=function(R){0>R||125<R?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):de=0<R?Math.floor(1e3/R):5},n.unstable_getCurrentPriorityLevel=function(){return E},n.unstable_next=function(R){switch(E){case 1:case 2:case 3:var I=3;break;default:I=E}var ce=E;E=I;try{return R()}finally{E=ce}},n.unstable_requestPaint=function(){j=!0},n.unstable_runWithPriority=function(R,I){switch(R){case 1:case 2:case 3:case 4:case 5:break;default:R=3}var ce=E;E=R;try{return I()}finally{E=ce}},n.unstable_scheduleCallback=function(R,I,ce){var Ee=n.unstable_now();switch(typeof ce=="object"&&ce!==null?(ce=ce.delay,ce=typeof ce=="number"&&0<ce?Ee+ce:Ee):ce=Ee,R){case 1:var k=-1;break;case 2:k=250;break;case 5:k=1073741823;break;case 4:k=1e4;break;default:k=5e3}return k=ce+k,R={id:v++,callback:I,priorityLevel:R,startTime:ce,expirationTime:k,sortIndex:-1},ce>Ee?(R.sortIndex=ce,a(h,R),r(m)===null&&R===r(h)&&(H?(F(te),te=-1):H=!0,W(re,ce-Ee))):(R.sortIndex=k,a(m,R),C||x||(C=!0,B||(B=!0,le()))),R},n.unstable_shouldYield=L,n.unstable_wrapCallback=function(R){var I=E;return function(){var ce=E;E=I;try{return R.apply(this,arguments)}finally{E=ce}}}})(Yc)),Yc}var Ip;function vv(){return Ip||(Ip=1,qc.exports=yv()),qc.exports}var Vc={exports:{}},vt={};/**\n * @license React\n * react-dom.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Fp;function bv(){if(Fp)return vt;Fp=1;var n=As();function a(m){var h="https://react.dev/errors/"+m;if(1<arguments.length){h+="?args[]="+encodeURIComponent(arguments[1]);for(var v=2;v<arguments.length;v++)h+="&args[]="+encodeURIComponent(arguments[v])}return"Minified React error #"+m+"; visit "+h+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function r(){}var u={d:{f:r,r:function(){throw Error(a(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},s=Symbol.for("react.portal");function f(m,h,v){var y=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:s,key:y==null?null:""+y,children:m,containerInfo:h,implementation:v}}var d=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function p(m,h){if(m==="font")return"";if(typeof h=="string")return h==="use-credentials"?h:""}return vt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=u,vt.createPortal=function(m,h){var v=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!h||h.nodeType!==1&&h.nodeType!==9&&h.nodeType!==11)throw Error(a(299));return f(m,h,null,v)},vt.flushSync=function(m){var h=d.T,v=u.p;try{if(d.T=null,u.p=2,m)return m()}finally{d.T=h,u.p=v,u.d.f()}},vt.preconnect=function(m,h){typeof m=="string"&&(h?(h=h.crossOrigin,h=typeof h=="string"?h==="use-credentials"?h:"":void 0):h=null,u.d.C(m,h))},vt.prefetchDNS=function(m){typeof m=="string"&&u.d.D(m)},vt.preinit=function(m,h){if(typeof m=="string"&&h&&typeof h.as=="string"){var v=h.as,y=p(v,h.crossOrigin),E=typeof h.integrity=="string"?h.integrity:void 0,x=typeof h.fetchPriority=="string"?h.fetchPriority:void 0;v==="style"?u.d.S(m,typeof h.precedence=="string"?h.precedence:void 0,{crossOrigin:y,integrity:E,fetchPriority:x}):v==="script"&&u.d.X(m,{crossOrigin:y,integrity:E,fetchPriority:x,nonce:typeof h.nonce=="string"?h.nonce:void 0})}},vt.preinitModule=function(m,h){if(typeof m=="string")if(typeof h=="object"&&h!==null){if(h.as==null||h.as==="script"){var v=p(h.as,h.crossOrigin);u.d.M(m,{crossOrigin:v,integrity:typeof h.integrity=="string"?h.integrity:void 0,nonce:typeof h.nonce=="string"?h.nonce:void 0})}}else h==null&&u.d.M(m)},vt.preload=function(m,h){if(typeof m=="string"&&typeof h=="object"&&h!==null&&typeof h.as=="string"){var v=h.as,y=p(v,h.crossOrigin);u.d.L(m,v,{crossOrigin:y,integrity:typeof h.integrity=="string"?h.integrity:void 0,nonce:typeof h.nonce=="string"?h.nonce:void 0,type:typeof h.type=="string"?h.type:void 0,fetchPriority:typeof h.fetchPriority=="string"?h.fetchPriority:void 0,referrerPolicy:typeof h.referrerPolicy=="string"?h.referrerPolicy:void 0,imageSrcSet:typeof h.imageSrcSet=="string"?h.imageSrcSet:void 0,imageSizes:typeof h.imageSizes=="string"?h.imageSizes:void 0,media:typeof h.media=="string"?h.media:void 0})}},vt.preloadModule=function(m,h){if(typeof m=="string")if(h){var v=p(h.as,h.crossOrigin);u.d.m(m,{as:typeof h.as=="string"&&h.as!=="script"?h.as:void 0,crossOrigin:v,integrity:typeof h.integrity=="string"?h.integrity:void 0})}else u.d.m(m)},vt.requestFormReset=function(m){u.d.r(m)},vt.unstable_batchedUpdates=function(m,h){return m(h)},vt.useFormState=function(m,h,v){return d.H.useFormState(m,h,v)},vt.useFormStatus=function(){return d.H.useHostTransitionStatus()},vt.version="19.2.6",vt}var Kp;function Sv(){if(Kp)return Vc.exports;Kp=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),Vc.exports=bv(),Vc.exports}/**\n * @license React\n * react-dom-client.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Jp;function xv(){if(Jp)return ka;Jp=1;var n=vv(),a=As(),r=Sv();function u(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var l=2;l<arguments.length;l++)t+="&args[]="+encodeURIComponent(arguments[l])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function s(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function f(e){var t=e,l=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(l=t.return),e=t.return;while(e)}return t.tag===3?l:null}function d(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function p(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function m(e){if(f(e)!==e)throw Error(u(188))}function h(e){var t=e.alternate;if(!t){if(t=f(e),t===null)throw Error(u(188));return t!==e?null:e}for(var l=e,i=t;;){var o=l.return;if(o===null)break;var c=o.alternate;if(c===null){if(i=o.return,i!==null){l=i;continue}break}if(o.child===c.child){for(c=o.child;c;){if(c===l)return m(o),e;if(c===i)return m(o),t;c=c.sibling}throw Error(u(188))}if(l.return!==i.return)l=o,i=c;else{for(var g=!1,S=o.child;S;){if(S===l){g=!0,l=o,i=c;break}if(S===i){g=!0,i=o,l=c;break}S=S.sibling}if(!g){for(S=c.child;S;){if(S===l){g=!0,l=c,i=o;break}if(S===i){g=!0,i=c,l=o;break}S=S.sibling}if(!g)throw Error(u(189))}}if(l.alternate!==i)throw Error(u(190))}if(l.tag!==3)throw Error(u(188));return l.stateNode.current===l?e:t}function v(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=v(e),t!==null)return t;e=e.sibling}return null}var y=Object.assign,E=Symbol.for("react.element"),x=Symbol.for("react.transitional.element"),C=Symbol.for("react.portal"),H=Symbol.for("react.fragment"),j=Symbol.for("react.strict_mode"),O=Symbol.for("react.profiler"),F=Symbol.for("react.consumer"),X=Symbol.for("react.context"),ne=Symbol.for("react.forward_ref"),re=Symbol.for("react.suspense"),B=Symbol.for("react.suspense_list"),te=Symbol.for("react.memo"),de=Symbol.for("react.lazy"),ye=Symbol.for("react.activity"),L=Symbol.for("react.memo_cache_sentinel"),ie=Symbol.iterator;function le(e){return e===null||typeof e!="object"?null:(e=ie&&e[ie]||e["@@iterator"],typeof e=="function"?e:null)}var ke=Symbol.for("react.client.reference");function oe(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===ke?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case H:return"Fragment";case O:return"Profiler";case j:return"StrictMode";case re:return"Suspense";case B:return"SuspenseList";case ye:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case C:return"Portal";case X:return e.displayName||"Context";case F:return(e._context.displayName||"Context")+".Consumer";case ne:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case te:return t=e.displayName||null,t!==null?t:oe(e.type)||"Memo";case de:t=e._payload,e=e._init;try{return oe(e(t))}catch{}}return null}var W=Array.isArray,R=a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,I=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ce={pending:!1,data:null,method:null,action:null},Ee=[],k=-1;function T(e){return{current:e}}function Y(e){0>k||(e.current=Ee[k],Ee[k]=null,k--)}function b(e,t){k++,Ee[k]=e.current,e.current=t}var _=T(null),Q=T(null),K=T(null),ee=T(null);function ue(e,t){switch(b(K,t),b(Q,e),b(_,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?fp(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=fp(t),e=dp(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}Y(_),b(_,e)}function pe(){Y(_),Y(Q),Y(K)}function Ae(e){e.memoizedState!==null&&b(ee,e);var t=_.current,l=dp(t,e.type);t!==l&&(b(Q,e),b(_,l))}function Je(e){Q.current===e&&(Y(_),Y(Q)),ee.current===e&&(Y(ee),va._currentValue=ce)}var Pe,ct;function yt(e){if(Pe===void 0)try{throw Error()}catch(l){var t=l.stack.trim().match(/\\n( *(at )?)/);Pe=t&&t[1]||"",ct=-1<l.stack.indexOf(`\n    at`)?" (<anonymous>)":-1<l.stack.indexOf("@")?"@unknown:0:0":""}return`\n`+Pe+e+ct}var Nl=!1;function Ll(e,t){if(!e||Nl)return"";Nl=!0;var l=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var Z=function(){throw Error()};if(Object.defineProperty(Z.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(Z,[])}catch(U){var N=U}Reflect.construct(e,[],Z)}else{try{Z.call()}catch(U){N=U}e.call(Z.prototype)}}else{try{throw Error()}catch(U){N=U}(Z=e())&&typeof Z.catch=="function"&&Z.catch(function(){})}}catch(U){if(U&&N&&typeof U.stack=="string")return[U.stack,N.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var o=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");o&&o.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var c=i.DetermineComponentFrameRoot(),g=c[0],S=c[1];if(g&&S){var A=g.split(`\n`),M=S.split(`\n`);for(o=i=0;i<A.length&&!A[i].includes("DetermineComponentFrameRoot");)i++;for(;o<M.length&&!M[o].includes("DetermineComponentFrameRoot");)o++;if(i===A.length||o===M.length)for(i=A.length-1,o=M.length-1;1<=i&&0<=o&&A[i]!==M[o];)o--;for(;1<=i&&0<=o;i--,o--)if(A[i]!==M[o]){if(i!==1||o!==1)do if(i--,o--,0>o||A[i]!==M[o]){var q=`\n`+A[i].replace(" at new "," at ");return e.displayName&&q.includes("<anonymous>")&&(q=q.replace("<anonymous>",e.displayName)),q}while(1<=i&&0<=o);break}}}finally{Nl=!1,Error.prepareStackTrace=l}return(l=e?e.displayName||e.name:"")?yt(l):""}function Ba(e,t){switch(e.tag){case 26:case 27:case 5:return yt(e.type);case 16:return yt("Lazy");case 13:return e.child!==t&&t!==null?yt("Suspense Fallback"):yt("Suspense");case 19:return yt("SuspenseList");case 0:case 15:return Ll(e.type,!1);case 11:return Ll(e.type.render,!1);case 1:return Ll(e.type,!0);case 31:return yt("Activity");default:return""}}function Ha(e){try{var t="",l=null;do t+=Ba(e,l),l=e,e=e.return;while(e);return t}catch(i){return`\nError generating stack: `+i.message+`\n`+i.stack}}var Ul=Object.prototype.hasOwnProperty,jl=n.unstable_scheduleCallback,Oi=n.unstable_cancelCallback,xu=n.unstable_shouldYield,Eu=n.unstable_requestPaint,kt=n.unstable_now,ku=n.unstable_getCurrentPriorityLevel,V=n.unstable_ImmediatePriority,P=n.unstable_UserBlockingPriority,ge=n.unstable_NormalPriority,Te=n.unstable_LowPriority,Ue=n.unstable_IdlePriority,Ht=n.log,bn=n.unstable_setDisableYieldValue,At=null,ut=null;function _t(e){if(typeof Ht=="function"&&bn(e),ut&&typeof ut.setStrictMode=="function")try{ut.setStrictMode(At,e)}catch{}}var Ge=Math.clz32?Math.clz32:ey,Hn=Math.log,un=Math.LN2;function ey(e){return e>>>=0,e===0?32:31-(Hn(e)/un|0)|0}var qa=256,Ya=262144,Va=4194304;function dl(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Ga(e,t,l){var i=e.pendingLanes;if(i===0)return 0;var o=0,c=e.suspendedLanes,g=e.pingedLanes;e=e.warmLanes;var S=i&134217727;return S!==0?(i=S&~c,i!==0?o=dl(i):(g&=S,g!==0?o=dl(g):l||(l=S&~e,l!==0&&(o=dl(l))))):(S=i&~c,S!==0?o=dl(S):g!==0?o=dl(g):l||(l=i&~e,l!==0&&(o=dl(l)))),o===0?0:t!==0&&t!==o&&(t&c)===0&&(c=o&-o,l=t&-t,c>=l||c===32&&(l&4194048)!==0)?t:o}function Di(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function ty(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Qs(){var e=Va;return Va<<=1,(Va&62914560)===0&&(Va=4194304),e}function Au(e){for(var t=[],l=0;31>l;l++)t.push(e);return t}function Mi(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function ny(e,t,l,i,o,c){var g=e.pendingLanes;e.pendingLanes=l,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=l,e.entangledLanes&=l,e.errorRecoveryDisabledLanes&=l,e.shellSuspendCounter=0;var S=e.entanglements,A=e.expirationTimes,M=e.hiddenUpdates;for(l=g&~l;0<l;){var q=31-Ge(l),Z=1<<q;S[q]=0,A[q]=-1;var N=M[q];if(N!==null)for(M[q]=null,q=0;q<N.length;q++){var U=N[q];U!==null&&(U.lane&=-536870913)}l&=~Z}i!==0&&Zs(e,i,0),c!==0&&o===0&&e.tag!==0&&(e.suspendedLanes|=c&~(g&~t))}function Zs(e,t,l){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-Ge(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|l&261930}function Is(e,t){var l=e.entangledLanes|=t;for(e=e.entanglements;l;){var i=31-Ge(l),o=1<<i;o&t|e[i]&t&&(e[i]|=t),l&=~o}}function Fs(e,t){var l=t&-t;return l=(l&42)!==0?1:Tu(l),(l&(e.suspendedLanes|t))!==0?0:l}function Tu(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function wu(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Ks(){var e=I.p;return e!==0?e:(e=window.event,e===void 0?32:Lp(e.type))}function Js(e,t){var l=I.p;try{return I.p=e,t()}finally{I.p=l}}var qn=Math.random().toString(36).slice(2),dt="__reactFiber$"+qn,Ot="__reactProps$"+qn,Bl="__reactContainer$"+qn,Cu="__reactEvents$"+qn,ly="__reactListeners$"+qn,iy="__reactHandles$"+qn,$s="__reactResources$"+qn,Ri="__reactMarker$"+qn;function zu(e){delete e[dt],delete e[Ot],delete e[Cu],delete e[ly],delete e[iy]}function Hl(e){var t=e[dt];if(t)return t;for(var l=e.parentNode;l;){if(t=l[Bl]||l[dt]){if(l=t.alternate,t.child!==null||l!==null&&l.child!==null)for(e=bp(e);e!==null;){if(l=e[dt])return l;e=bp(e)}return t}e=l,l=e.parentNode}return null}function ql(e){if(e=e[dt]||e[Bl]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Ni(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(u(33))}function Yl(e){var t=e[$s];return t||(t=e[$s]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function st(e){e[Ri]=!0}var Ws=new Set,Ps={};function hl(e,t){Vl(e,t),Vl(e+"Capture",t)}function Vl(e,t){for(Ps[e]=t,e=0;e<t.length;e++)Ws.add(t[e])}var ay=RegExp("^[:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD][:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD\\\\-.0-9\\\\u00B7\\\\u0300-\\\\u036F\\\\u203F-\\\\u2040]*$"),ef={},tf={};function ry(e){return Ul.call(tf,e)?!0:Ul.call(ef,e)?!1:ay.test(e)?tf[e]=!0:(ef[e]=!0,!1)}function Xa(e,t,l){if(ry(t))if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+l)}}function Qa(e,t,l){if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+l)}}function Sn(e,t,l,i){if(i===null)e.removeAttribute(l);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(l);return}e.setAttributeNS(t,l,""+i)}}function Kt(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function nf(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function uy(e,t,l){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var o=i.get,c=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(g){l=""+g,c.call(this,g)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return l},setValue:function(g){l=""+g},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function _u(e){if(!e._valueTracker){var t=nf(e)?"checked":"value";e._valueTracker=uy(e,t,""+e[t])}}function lf(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var l=t.getValue(),i="";return e&&(i=nf(e)?e.checked?"true":"false":e.value),e=i,e!==l?(t.setValue(e),!0):!1}function Za(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var oy=/[\\n"\\\\]/g;function Jt(e){return e.replace(oy,function(t){return"\\\\"+t.charCodeAt(0).toString(16)+" "})}function Ou(e,t,l,i,o,c,g,S){e.name="",g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"?e.type=g:e.removeAttribute("type"),t!=null?g==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+Kt(t)):e.value!==""+Kt(t)&&(e.value=""+Kt(t)):g!=="submit"&&g!=="reset"||e.removeAttribute("value"),t!=null?Du(e,g,Kt(t)):l!=null?Du(e,g,Kt(l)):i!=null&&e.removeAttribute("value"),o==null&&c!=null&&(e.defaultChecked=!!c),o!=null&&(e.checked=o&&typeof o!="function"&&typeof o!="symbol"),S!=null&&typeof S!="function"&&typeof S!="symbol"&&typeof S!="boolean"?e.name=""+Kt(S):e.removeAttribute("name")}function af(e,t,l,i,o,c,g,S){if(c!=null&&typeof c!="function"&&typeof c!="symbol"&&typeof c!="boolean"&&(e.type=c),t!=null||l!=null){if(!(c!=="submit"&&c!=="reset"||t!=null)){_u(e);return}l=l!=null?""+Kt(l):"",t=t!=null?""+Kt(t):l,S||t===e.value||(e.value=t),e.defaultValue=t}i=i??o,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=S?e.checked:!!i,e.defaultChecked=!!i,g!=null&&typeof g!="function"&&typeof g!="symbol"&&typeof g!="boolean"&&(e.name=g),_u(e)}function Du(e,t,l){t==="number"&&Za(e.ownerDocument)===e||e.defaultValue===""+l||(e.defaultValue=""+l)}function Gl(e,t,l,i){if(e=e.options,t){t={};for(var o=0;o<l.length;o++)t["$"+l[o]]=!0;for(l=0;l<e.length;l++)o=t.hasOwnProperty("$"+e[l].value),e[l].selected!==o&&(e[l].selected=o),o&&i&&(e[l].defaultSelected=!0)}else{for(l=""+Kt(l),t=null,o=0;o<e.length;o++){if(e[o].value===l){e[o].selected=!0,i&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function rf(e,t,l){if(t!=null&&(t=""+Kt(t),t!==e.value&&(e.value=t),l==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=l!=null?""+Kt(l):""}function uf(e,t,l,i){if(t==null){if(i!=null){if(l!=null)throw Error(u(92));if(W(i)){if(1<i.length)throw Error(u(93));i=i[0]}l=i}l==null&&(l=""),t=l}l=Kt(t),e.defaultValue=l,i=e.textContent,i===l&&i!==""&&i!==null&&(e.value=i),_u(e)}function Xl(e,t){if(t){var l=e.firstChild;if(l&&l===e.lastChild&&l.nodeType===3){l.nodeValue=t;return}}e.textContent=t}var cy=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function of(e,t,l){var i=t.indexOf("--")===0;l==null||typeof l=="boolean"||l===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,l):typeof l!="number"||l===0||cy.has(t)?t==="float"?e.cssFloat=l:e[t]=(""+l).trim():e[t]=l+"px"}function cf(e,t,l){if(t!=null&&typeof t!="object")throw Error(u(62));if(e=e.style,l!=null){for(var i in l)!l.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var o in t)i=t[o],t.hasOwnProperty(o)&&l[o]!==i&&of(e,o,i)}else for(var c in t)t.hasOwnProperty(c)&&of(e,c,t[c])}function Mu(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var sy=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),fy=/^[\\u0000-\\u001F ]*j[\\r\\n\\t]*a[\\r\\n\\t]*v[\\r\\n\\t]*a[\\r\\n\\t]*s[\\r\\n\\t]*c[\\r\\n\\t]*r[\\r\\n\\t]*i[\\r\\n\\t]*p[\\r\\n\\t]*t[\\r\\n\\t]*:/i;function Ia(e){return fy.test(""+e)?"javascript:throw new Error(\'React has blocked a javascript: URL as a security precaution.\')":e}function xn(){}var Ru=null;function Nu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Ql=null,Zl=null;function sf(e){var t=ql(e);if(t&&(e=t.stateNode)){var l=e[Ot]||null;e:switch(e=t.stateNode,t.type){case"input":if(Ou(e,l.value,l.defaultValue,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name),t=l.name,l.type==="radio"&&t!=null){for(l=e;l.parentNode;)l=l.parentNode;for(l=l.querySelectorAll(\'input[name="\'+Jt(""+t)+\'"][type="radio"]\'),t=0;t<l.length;t++){var i=l[t];if(i!==e&&i.form===e.form){var o=i[Ot]||null;if(!o)throw Error(u(90));Ou(i,o.value,o.defaultValue,o.defaultValue,o.checked,o.defaultChecked,o.type,o.name)}}for(t=0;t<l.length;t++)i=l[t],i.form===e.form&&lf(i)}break e;case"textarea":rf(e,l.value,l.defaultValue);break e;case"select":t=l.value,t!=null&&Gl(e,!!l.multiple,t,!1)}}}var Lu=!1;function ff(e,t,l){if(Lu)return e(t,l);Lu=!0;try{var i=e(t);return i}finally{if(Lu=!1,(Ql!==null||Zl!==null)&&(Nr(),Ql&&(t=Ql,e=Zl,Zl=Ql=null,sf(t),e)))for(t=0;t<e.length;t++)sf(e[t])}}function Li(e,t){var l=e.stateNode;if(l===null)return null;var i=l[Ot]||null;if(i===null)return null;l=i[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break e;default:e=!1}if(e)return null;if(l&&typeof l!="function")throw Error(u(231,t,typeof l));return l}var En=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Uu=!1;if(En)try{var Ui={};Object.defineProperty(Ui,"passive",{get:function(){Uu=!0}}),window.addEventListener("test",Ui,Ui),window.removeEventListener("test",Ui,Ui)}catch{Uu=!1}var Yn=null,ju=null,Fa=null;function df(){if(Fa)return Fa;var e,t=ju,l=t.length,i,o="value"in Yn?Yn.value:Yn.textContent,c=o.length;for(e=0;e<l&&t[e]===o[e];e++);var g=l-e;for(i=1;i<=g&&t[l-i]===o[c-i];i++);return Fa=o.slice(e,1<i?1-i:void 0)}function Ka(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Ja(){return!0}function hf(){return!1}function Dt(e){function t(l,i,o,c,g){this._reactName=l,this._targetInst=o,this.type=i,this.nativeEvent=c,this.target=g,this.currentTarget=null;for(var S in e)e.hasOwnProperty(S)&&(l=e[S],this[S]=l?l(c):c[S]);return this.isDefaultPrevented=(c.defaultPrevented!=null?c.defaultPrevented:c.returnValue===!1)?Ja:hf,this.isPropagationStopped=hf,this}return y(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var l=this.nativeEvent;l&&(l.preventDefault?l.preventDefault():typeof l.returnValue!="unknown"&&(l.returnValue=!1),this.isDefaultPrevented=Ja)},stopPropagation:function(){var l=this.nativeEvent;l&&(l.stopPropagation?l.stopPropagation():typeof l.cancelBubble!="unknown"&&(l.cancelBubble=!0),this.isPropagationStopped=Ja)},persist:function(){},isPersistent:Ja}),t}var pl={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},$a=Dt(pl),ji=y({},pl,{view:0,detail:0}),dy=Dt(ji),Bu,Hu,Bi,Wa=y({},ji,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Yu,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Bi&&(Bi&&e.type==="mousemove"?(Bu=e.screenX-Bi.screenX,Hu=e.screenY-Bi.screenY):Hu=Bu=0,Bi=e),Bu)},movementY:function(e){return"movementY"in e?e.movementY:Hu}}),pf=Dt(Wa),hy=y({},Wa,{dataTransfer:0}),py=Dt(hy),my=y({},ji,{relatedTarget:0}),qu=Dt(my),gy=y({},pl,{animationName:0,elapsedTime:0,pseudoElement:0}),yy=Dt(gy),vy=y({},pl,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),by=Dt(vy),Sy=y({},pl,{data:0}),mf=Dt(Sy),xy={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Ey={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},ky={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Ay(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=ky[e])?!!t[e]:!1}function Yu(){return Ay}var Ty=y({},ji,{key:function(e){if(e.key){var t=xy[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Ka(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Ey[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Yu,charCode:function(e){return e.type==="keypress"?Ka(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Ka(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),wy=Dt(Ty),Cy=y({},Wa,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),gf=Dt(Cy),zy=y({},ji,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Yu}),_y=Dt(zy),Oy=y({},pl,{propertyName:0,elapsedTime:0,pseudoElement:0}),Dy=Dt(Oy),My=y({},Wa,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Ry=Dt(My),Ny=y({},pl,{newState:0,oldState:0}),Ly=Dt(Ny),Uy=[9,13,27,32],Vu=En&&"CompositionEvent"in window,Hi=null;En&&"documentMode"in document&&(Hi=document.documentMode);var jy=En&&"TextEvent"in window&&!Hi,yf=En&&(!Vu||Hi&&8<Hi&&11>=Hi),vf=" ",bf=!1;function Sf(e,t){switch(e){case"keyup":return Uy.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function xf(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Il=!1;function By(e,t){switch(e){case"compositionend":return xf(t);case"keypress":return t.which!==32?null:(bf=!0,vf);case"textInput":return e=t.data,e===vf&&bf?null:e;default:return null}}function Hy(e,t){if(Il)return e==="compositionend"||!Vu&&Sf(e,t)?(e=df(),Fa=ju=Yn=null,Il=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return yf&&t.locale!=="ko"?null:t.data;default:return null}}var qy={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Ef(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!qy[e.type]:t==="textarea"}function kf(e,t,l,i){Ql?Zl?Zl.push(i):Zl=[i]:Ql=i,t=Yr(t,"onChange"),0<t.length&&(l=new $a("onChange","change",null,l,i),e.push({event:l,listeners:t}))}var qi=null,Yi=null;function Yy(e){ap(e,0)}function Pa(e){var t=Ni(e);if(lf(t))return e}function Af(e,t){if(e==="change")return t}var Tf=!1;if(En){var Gu;if(En){var Xu="oninput"in document;if(!Xu){var wf=document.createElement("div");wf.setAttribute("oninput","return;"),Xu=typeof wf.oninput=="function"}Gu=Xu}else Gu=!1;Tf=Gu&&(!document.documentMode||9<document.documentMode)}function Cf(){qi&&(qi.detachEvent("onpropertychange",zf),Yi=qi=null)}function zf(e){if(e.propertyName==="value"&&Pa(Yi)){var t=[];kf(t,Yi,e,Nu(e)),ff(Yy,t)}}function Vy(e,t,l){e==="focusin"?(Cf(),qi=t,Yi=l,qi.attachEvent("onpropertychange",zf)):e==="focusout"&&Cf()}function Gy(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Pa(Yi)}function Xy(e,t){if(e==="click")return Pa(t)}function Qy(e,t){if(e==="input"||e==="change")return Pa(t)}function Zy(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var qt=typeof Object.is=="function"?Object.is:Zy;function Vi(e,t){if(qt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var l=Object.keys(e),i=Object.keys(t);if(l.length!==i.length)return!1;for(i=0;i<l.length;i++){var o=l[i];if(!Ul.call(t,o)||!qt(e[o],t[o]))return!1}return!0}function _f(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Of(e,t){var l=_f(e);e=0;for(var i;l;){if(l.nodeType===3){if(i=e+l.textContent.length,e<=t&&i>=t)return{node:l,offset:t-e};e=i}e:{for(;l;){if(l.nextSibling){l=l.nextSibling;break e}l=l.parentNode}l=void 0}l=_f(l)}}function Df(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Df(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Mf(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Za(e.document);t instanceof e.HTMLIFrameElement;){try{var l=typeof t.contentWindow.location.href=="string"}catch{l=!1}if(l)e=t.contentWindow;else break;t=Za(e.document)}return t}function Qu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var Iy=En&&"documentMode"in document&&11>=document.documentMode,Fl=null,Zu=null,Gi=null,Iu=!1;function Rf(e,t,l){var i=l.window===l?l.document:l.nodeType===9?l:l.ownerDocument;Iu||Fl==null||Fl!==Za(i)||(i=Fl,"selectionStart"in i&&Qu(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Gi&&Vi(Gi,i)||(Gi=i,i=Yr(Zu,"onSelect"),0<i.length&&(t=new $a("onSelect","select",null,t,l),e.push({event:t,listeners:i}),t.target=Fl)))}function ml(e,t){var l={};return l[e.toLowerCase()]=t.toLowerCase(),l["Webkit"+e]="webkit"+t,l["Moz"+e]="moz"+t,l}var Kl={animationend:ml("Animation","AnimationEnd"),animationiteration:ml("Animation","AnimationIteration"),animationstart:ml("Animation","AnimationStart"),transitionrun:ml("Transition","TransitionRun"),transitionstart:ml("Transition","TransitionStart"),transitioncancel:ml("Transition","TransitionCancel"),transitionend:ml("Transition","TransitionEnd")},Fu={},Nf={};En&&(Nf=document.createElement("div").style,"AnimationEvent"in window||(delete Kl.animationend.animation,delete Kl.animationiteration.animation,delete Kl.animationstart.animation),"TransitionEvent"in window||delete Kl.transitionend.transition);function gl(e){if(Fu[e])return Fu[e];if(!Kl[e])return e;var t=Kl[e],l;for(l in t)if(t.hasOwnProperty(l)&&l in Nf)return Fu[e]=t[l];return e}var Lf=gl("animationend"),Uf=gl("animationiteration"),jf=gl("animationstart"),Fy=gl("transitionrun"),Ky=gl("transitionstart"),Jy=gl("transitioncancel"),Bf=gl("transitionend"),Hf=new Map,Ku="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Ku.push("scrollEnd");function on(e,t){Hf.set(e,t),hl(t,[e])}var er=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},$t=[],Jl=0,Ju=0;function tr(){for(var e=Jl,t=Ju=Jl=0;t<e;){var l=$t[t];$t[t++]=null;var i=$t[t];$t[t++]=null;var o=$t[t];$t[t++]=null;var c=$t[t];if($t[t++]=null,i!==null&&o!==null){var g=i.pending;g===null?o.next=o:(o.next=g.next,g.next=o),i.pending=o}c!==0&&qf(l,o,c)}}function nr(e,t,l,i){$t[Jl++]=e,$t[Jl++]=t,$t[Jl++]=l,$t[Jl++]=i,Ju|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function $u(e,t,l,i){return nr(e,t,l,i),lr(e)}function yl(e,t){return nr(e,null,null,t),lr(e)}function qf(e,t,l){e.lanes|=l;var i=e.alternate;i!==null&&(i.lanes|=l);for(var o=!1,c=e.return;c!==null;)c.childLanes|=l,i=c.alternate,i!==null&&(i.childLanes|=l),c.tag===22&&(e=c.stateNode,e===null||e._visibility&1||(o=!0)),e=c,c=c.return;return e.tag===3?(c=e.stateNode,o&&t!==null&&(o=31-Ge(l),e=c.hiddenUpdates,i=e[o],i===null?e[o]=[t]:i.push(t),t.lane=l|536870912),c):null}function lr(e){if(50<fa)throw fa=0,uc=null,Error(u(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var $l={};function $y(e,t,l,i){this.tag=e,this.key=l,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Yt(e,t,l,i){return new $y(e,t,l,i)}function Wu(e){return e=e.prototype,!(!e||!e.isReactComponent)}function kn(e,t){var l=e.alternate;return l===null?(l=Yt(e.tag,t,e.key,e.mode),l.elementType=e.elementType,l.type=e.type,l.stateNode=e.stateNode,l.alternate=e,e.alternate=l):(l.pendingProps=t,l.type=e.type,l.flags=0,l.subtreeFlags=0,l.deletions=null),l.flags=e.flags&65011712,l.childLanes=e.childLanes,l.lanes=e.lanes,l.child=e.child,l.memoizedProps=e.memoizedProps,l.memoizedState=e.memoizedState,l.updateQueue=e.updateQueue,t=e.dependencies,l.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},l.sibling=e.sibling,l.index=e.index,l.ref=e.ref,l.refCleanup=e.refCleanup,l}function Yf(e,t){e.flags&=65011714;var l=e.alternate;return l===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=l.childLanes,e.lanes=l.lanes,e.child=l.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=l.memoizedProps,e.memoizedState=l.memoizedState,e.updateQueue=l.updateQueue,e.type=l.type,t=l.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function ir(e,t,l,i,o,c){var g=0;if(i=e,typeof e=="function")Wu(e)&&(g=1);else if(typeof e=="string")g=nv(e,l,_.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case ye:return e=Yt(31,l,t,o),e.elementType=ye,e.lanes=c,e;case H:return vl(l.children,o,c,t);case j:g=8,o|=24;break;case O:return e=Yt(12,l,t,o|2),e.elementType=O,e.lanes=c,e;case re:return e=Yt(13,l,t,o),e.elementType=re,e.lanes=c,e;case B:return e=Yt(19,l,t,o),e.elementType=B,e.lanes=c,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case X:g=10;break e;case F:g=9;break e;case ne:g=11;break e;case te:g=14;break e;case de:g=16,i=null;break e}g=29,l=Error(u(130,e===null?"null":typeof e,"")),i=null}return t=Yt(g,l,t,o),t.elementType=e,t.type=i,t.lanes=c,t}function vl(e,t,l,i){return e=Yt(7,e,i,t),e.lanes=l,e}function Pu(e,t,l){return e=Yt(6,e,null,t),e.lanes=l,e}function Vf(e){var t=Yt(18,null,null,0);return t.stateNode=e,t}function eo(e,t,l){return t=Yt(4,e.children!==null?e.children:[],e.key,t),t.lanes=l,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Gf=new WeakMap;function Wt(e,t){if(typeof e=="object"&&e!==null){var l=Gf.get(e);return l!==void 0?l:(t={value:e,source:t,stack:Ha(t)},Gf.set(e,t),t)}return{value:e,source:t,stack:Ha(t)}}var Wl=[],Pl=0,ar=null,Xi=0,Pt=[],en=0,Vn=null,dn=1,hn="";function An(e,t){Wl[Pl++]=Xi,Wl[Pl++]=ar,ar=e,Xi=t}function Xf(e,t,l){Pt[en++]=dn,Pt[en++]=hn,Pt[en++]=Vn,Vn=e;var i=dn;e=hn;var o=32-Ge(i)-1;i&=~(1<<o),l+=1;var c=32-Ge(t)+o;if(30<c){var g=o-o%5;c=(i&(1<<g)-1).toString(32),i>>=g,o-=g,dn=1<<32-Ge(t)+o|l<<o|i,hn=c+e}else dn=1<<c|l<<o|i,hn=e}function to(e){e.return!==null&&(An(e,1),Xf(e,1,0))}function no(e){for(;e===ar;)ar=Wl[--Pl],Wl[Pl]=null,Xi=Wl[--Pl],Wl[Pl]=null;for(;e===Vn;)Vn=Pt[--en],Pt[en]=null,hn=Pt[--en],Pt[en]=null,dn=Pt[--en],Pt[en]=null}function Qf(e,t){Pt[en++]=dn,Pt[en++]=hn,Pt[en++]=Vn,dn=t.id,hn=t.overflow,Vn=e}var ht=null,Ie=null,De=!1,Gn=null,tn=!1,lo=Error(u(519));function Xn(e){var t=Error(u(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw Qi(Wt(t,e)),lo}function Zf(e){var t=e.stateNode,l=e.type,i=e.memoizedProps;switch(t[dt]=e,t[Ot]=i,l){case"dialog":Ce("cancel",t),Ce("close",t);break;case"iframe":case"object":case"embed":Ce("load",t);break;case"video":case"audio":for(l=0;l<ha.length;l++)Ce(ha[l],t);break;case"source":Ce("error",t);break;case"img":case"image":case"link":Ce("error",t),Ce("load",t);break;case"details":Ce("toggle",t);break;case"input":Ce("invalid",t),af(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":Ce("invalid",t);break;case"textarea":Ce("invalid",t),uf(t,i.value,i.defaultValue,i.children)}l=i.children,typeof l!="string"&&typeof l!="number"&&typeof l!="bigint"||t.textContent===""+l||i.suppressHydrationWarning===!0||cp(t.textContent,l)?(i.popover!=null&&(Ce("beforetoggle",t),Ce("toggle",t)),i.onScroll!=null&&Ce("scroll",t),i.onScrollEnd!=null&&Ce("scrollend",t),i.onClick!=null&&(t.onclick=xn),t=!0):t=!1,t||Xn(e,!0)}function If(e){for(ht=e.return;ht;)switch(ht.tag){case 5:case 31:case 13:tn=!1;return;case 27:case 3:tn=!0;return;default:ht=ht.return}}function ei(e){if(e!==ht)return!1;if(!De)return If(e),De=!0,!1;var t=e.tag,l;if((l=t!==3&&t!==27)&&((l=t===5)&&(l=e.type,l=!(l!=="form"&&l!=="button")||Ec(e.type,e.memoizedProps)),l=!l),l&&Ie&&Xn(e),If(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Ie=vp(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));Ie=vp(e)}else t===27?(t=Ie,il(e.type)?(e=Cc,Cc=null,Ie=e):Ie=t):Ie=ht?ln(e.stateNode.nextSibling):null;return!0}function bl(){Ie=ht=null,De=!1}function io(){var e=Gn;return e!==null&&(Lt===null?Lt=e:Lt.push.apply(Lt,e),Gn=null),e}function Qi(e){Gn===null?Gn=[e]:Gn.push(e)}var ao=T(null),Sl=null,Tn=null;function Qn(e,t,l){b(ao,t._currentValue),t._currentValue=l}function wn(e){e._currentValue=ao.current,Y(ao)}function ro(e,t,l){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===l)break;e=e.return}}function uo(e,t,l,i){var o=e.child;for(o!==null&&(o.return=e);o!==null;){var c=o.dependencies;if(c!==null){var g=o.child;c=c.firstContext;e:for(;c!==null;){var S=c;c=o;for(var A=0;A<t.length;A++)if(S.context===t[A]){c.lanes|=l,S=c.alternate,S!==null&&(S.lanes|=l),ro(c.return,l,e),i||(g=null);break e}c=S.next}}else if(o.tag===18){if(g=o.return,g===null)throw Error(u(341));g.lanes|=l,c=g.alternate,c!==null&&(c.lanes|=l),ro(g,l,e),g=null}else g=o.child;if(g!==null)g.return=o;else for(g=o;g!==null;){if(g===e){g=null;break}if(o=g.sibling,o!==null){o.return=g.return,g=o;break}g=g.return}o=g}}function ti(e,t,l,i){e=null;for(var o=t,c=!1;o!==null;){if(!c){if((o.flags&524288)!==0)c=!0;else if((o.flags&262144)!==0)break}if(o.tag===10){var g=o.alternate;if(g===null)throw Error(u(387));if(g=g.memoizedProps,g!==null){var S=o.type;qt(o.pendingProps.value,g.value)||(e!==null?e.push(S):e=[S])}}else if(o===ee.current){if(g=o.alternate,g===null)throw Error(u(387));g.memoizedState.memoizedState!==o.memoizedState.memoizedState&&(e!==null?e.push(va):e=[va])}o=o.return}e!==null&&uo(t,e,l,i),t.flags|=262144}function rr(e){for(e=e.firstContext;e!==null;){if(!qt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function xl(e){Sl=e,Tn=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function pt(e){return Ff(Sl,e)}function ur(e,t){return Sl===null&&xl(e),Ff(e,t)}function Ff(e,t){var l=t._currentValue;if(t={context:t,memoizedValue:l,next:null},Tn===null){if(e===null)throw Error(u(308));Tn=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else Tn=Tn.next=t;return l}var Wy=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(l,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(l){return l()})}},Py=n.unstable_scheduleCallback,e1=n.unstable_NormalPriority,nt={$$typeof:X,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function oo(){return{controller:new Wy,data:new Map,refCount:0}}function Zi(e){e.refCount--,e.refCount===0&&Py(e1,function(){e.controller.abort()})}var Ii=null,co=0,ni=0,li=null;function t1(e,t){if(Ii===null){var l=Ii=[];co=0,ni=hc(),li={status:"pending",value:void 0,then:function(i){l.push(i)}}}return co++,t.then(Kf,Kf),t}function Kf(){if(--co===0&&Ii!==null){li!==null&&(li.status="fulfilled");var e=Ii;Ii=null,ni=0,li=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function n1(e,t){var l=[],i={status:"pending",value:null,reason:null,then:function(o){l.push(o)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var o=0;o<l.length;o++)(0,l[o])(t)},function(o){for(i.status="rejected",i.reason=o,o=0;o<l.length;o++)(0,l[o])(void 0)}),i}var Jf=R.S;R.S=function(e,t){Rh=kt(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&t1(e,t),Jf!==null&&Jf(e,t)};var El=T(null);function so(){var e=El.current;return e!==null?e:Xe.pooledCache}function or(e,t){t===null?b(El,El.current):b(El,t.pool)}function $f(){var e=so();return e===null?null:{parent:nt._currentValue,pool:e}}var ii=Error(u(460)),fo=Error(u(474)),cr=Error(u(542)),sr={then:function(){}};function Wf(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Pf(e,t,l){switch(l=e[l],l===void 0?e.push(t):l!==t&&(t.then(xn,xn),t=l),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,td(e),e;default:if(typeof t.status=="string")t.then(xn,xn);else{if(e=Xe,e!==null&&100<e.shellSuspendCounter)throw Error(u(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var o=t;o.status="fulfilled",o.value=i}},function(i){if(t.status==="pending"){var o=t;o.status="rejected",o.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,td(e),e}throw Al=t,ii}}function kl(e){try{var t=e._init;return t(e._payload)}catch(l){throw l!==null&&typeof l=="object"&&typeof l.then=="function"?(Al=l,ii):l}}var Al=null;function ed(){if(Al===null)throw Error(u(459));var e=Al;return Al=null,e}function td(e){if(e===ii||e===cr)throw Error(u(483))}var ai=null,Fi=0;function fr(e){var t=Fi;return Fi+=1,ai===null&&(ai=[]),Pf(ai,e,t)}function Ki(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function dr(e,t){throw t.$$typeof===E?Error(u(525)):(e=Object.prototype.toString.call(t),Error(u(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function nd(e){function t(z,w){if(e){var D=z.deletions;D===null?(z.deletions=[w],z.flags|=16):D.push(w)}}function l(z,w){if(!e)return null;for(;w!==null;)t(z,w),w=w.sibling;return null}function i(z){for(var w=new Map;z!==null;)z.key!==null?w.set(z.key,z):w.set(z.index,z),z=z.sibling;return w}function o(z,w){return z=kn(z,w),z.index=0,z.sibling=null,z}function c(z,w,D){return z.index=D,e?(D=z.alternate,D!==null?(D=D.index,D<w?(z.flags|=67108866,w):D):(z.flags|=67108866,w)):(z.flags|=1048576,w)}function g(z){return e&&z.alternate===null&&(z.flags|=67108866),z}function S(z,w,D,G){return w===null||w.tag!==6?(w=Pu(D,z.mode,G),w.return=z,w):(w=o(w,D),w.return=z,w)}function A(z,w,D,G){var fe=D.type;return fe===H?q(z,w,D.props.children,G,D.key):w!==null&&(w.elementType===fe||typeof fe=="object"&&fe!==null&&fe.$$typeof===de&&kl(fe)===w.type)?(w=o(w,D.props),Ki(w,D),w.return=z,w):(w=ir(D.type,D.key,D.props,null,z.mode,G),Ki(w,D),w.return=z,w)}function M(z,w,D,G){return w===null||w.tag!==4||w.stateNode.containerInfo!==D.containerInfo||w.stateNode.implementation!==D.implementation?(w=eo(D,z.mode,G),w.return=z,w):(w=o(w,D.children||[]),w.return=z,w)}function q(z,w,D,G,fe){return w===null||w.tag!==7?(w=vl(D,z.mode,G,fe),w.return=z,w):(w=o(w,D),w.return=z,w)}function Z(z,w,D){if(typeof w=="string"&&w!==""||typeof w=="number"||typeof w=="bigint")return w=Pu(""+w,z.mode,D),w.return=z,w;if(typeof w=="object"&&w!==null){switch(w.$$typeof){case x:return D=ir(w.type,w.key,w.props,null,z.mode,D),Ki(D,w),D.return=z,D;case C:return w=eo(w,z.mode,D),w.return=z,w;case de:return w=kl(w),Z(z,w,D)}if(W(w)||le(w))return w=vl(w,z.mode,D,null),w.return=z,w;if(typeof w.then=="function")return Z(z,fr(w),D);if(w.$$typeof===X)return Z(z,ur(z,w),D);dr(z,w)}return null}function N(z,w,D,G){var fe=w!==null?w.key:null;if(typeof D=="string"&&D!==""||typeof D=="number"||typeof D=="bigint")return fe!==null?null:S(z,w,""+D,G);if(typeof D=="object"&&D!==null){switch(D.$$typeof){case x:return D.key===fe?A(z,w,D,G):null;case C:return D.key===fe?M(z,w,D,G):null;case de:return D=kl(D),N(z,w,D,G)}if(W(D)||le(D))return fe!==null?null:q(z,w,D,G,null);if(typeof D.then=="function")return N(z,w,fr(D),G);if(D.$$typeof===X)return N(z,w,ur(z,D),G);dr(z,D)}return null}function U(z,w,D,G,fe){if(typeof G=="string"&&G!==""||typeof G=="number"||typeof G=="bigint")return z=z.get(D)||null,S(w,z,""+G,fe);if(typeof G=="object"&&G!==null){switch(G.$$typeof){case x:return z=z.get(G.key===null?D:G.key)||null,A(w,z,G,fe);case C:return z=z.get(G.key===null?D:G.key)||null,M(w,z,G,fe);case de:return G=kl(G),U(z,w,D,G,fe)}if(W(G)||le(G))return z=z.get(D)||null,q(w,z,G,fe,null);if(typeof G.then=="function")return U(z,w,D,fr(G),fe);if(G.$$typeof===X)return U(z,w,D,ur(w,G),fe);dr(w,G)}return null}function ae(z,w,D,G){for(var fe=null,Re=null,se=w,Se=w=0,Oe=null;se!==null&&Se<D.length;Se++){se.index>Se?(Oe=se,se=null):Oe=se.sibling;var Ne=N(z,se,D[Se],G);if(Ne===null){se===null&&(se=Oe);break}e&&se&&Ne.alternate===null&&t(z,se),w=c(Ne,w,Se),Re===null?fe=Ne:Re.sibling=Ne,Re=Ne,se=Oe}if(Se===D.length)return l(z,se),De&&An(z,Se),fe;if(se===null){for(;Se<D.length;Se++)se=Z(z,D[Se],G),se!==null&&(w=c(se,w,Se),Re===null?fe=se:Re.sibling=se,Re=se);return De&&An(z,Se),fe}for(se=i(se);Se<D.length;Se++)Oe=U(se,z,Se,D[Se],G),Oe!==null&&(e&&Oe.alternate!==null&&se.delete(Oe.key===null?Se:Oe.key),w=c(Oe,w,Se),Re===null?fe=Oe:Re.sibling=Oe,Re=Oe);return e&&se.forEach(function(cl){return t(z,cl)}),De&&An(z,Se),fe}function me(z,w,D,G){if(D==null)throw Error(u(151));for(var fe=null,Re=null,se=w,Se=w=0,Oe=null,Ne=D.next();se!==null&&!Ne.done;Se++,Ne=D.next()){se.index>Se?(Oe=se,se=null):Oe=se.sibling;var cl=N(z,se,Ne.value,G);if(cl===null){se===null&&(se=Oe);break}e&&se&&cl.alternate===null&&t(z,se),w=c(cl,w,Se),Re===null?fe=cl:Re.sibling=cl,Re=cl,se=Oe}if(Ne.done)return l(z,se),De&&An(z,Se),fe;if(se===null){for(;!Ne.done;Se++,Ne=D.next())Ne=Z(z,Ne.value,G),Ne!==null&&(w=c(Ne,w,Se),Re===null?fe=Ne:Re.sibling=Ne,Re=Ne);return De&&An(z,Se),fe}for(se=i(se);!Ne.done;Se++,Ne=D.next())Ne=U(se,z,Se,Ne.value,G),Ne!==null&&(e&&Ne.alternate!==null&&se.delete(Ne.key===null?Se:Ne.key),w=c(Ne,w,Se),Re===null?fe=Ne:Re.sibling=Ne,Re=Ne);return e&&se.forEach(function(hv){return t(z,hv)}),De&&An(z,Se),fe}function Ve(z,w,D,G){if(typeof D=="object"&&D!==null&&D.type===H&&D.key===null&&(D=D.props.children),typeof D=="object"&&D!==null){switch(D.$$typeof){case x:e:{for(var fe=D.key;w!==null;){if(w.key===fe){if(fe=D.type,fe===H){if(w.tag===7){l(z,w.sibling),G=o(w,D.props.children),G.return=z,z=G;break e}}else if(w.elementType===fe||typeof fe=="object"&&fe!==null&&fe.$$typeof===de&&kl(fe)===w.type){l(z,w.sibling),G=o(w,D.props),Ki(G,D),G.return=z,z=G;break e}l(z,w);break}else t(z,w);w=w.sibling}D.type===H?(G=vl(D.props.children,z.mode,G,D.key),G.return=z,z=G):(G=ir(D.type,D.key,D.props,null,z.mode,G),Ki(G,D),G.return=z,z=G)}return g(z);case C:e:{for(fe=D.key;w!==null;){if(w.key===fe)if(w.tag===4&&w.stateNode.containerInfo===D.containerInfo&&w.stateNode.implementation===D.implementation){l(z,w.sibling),G=o(w,D.children||[]),G.return=z,z=G;break e}else{l(z,w);break}else t(z,w);w=w.sibling}G=eo(D,z.mode,G),G.return=z,z=G}return g(z);case de:return D=kl(D),Ve(z,w,D,G)}if(W(D))return ae(z,w,D,G);if(le(D)){if(fe=le(D),typeof fe!="function")throw Error(u(150));return D=fe.call(D),me(z,w,D,G)}if(typeof D.then=="function")return Ve(z,w,fr(D),G);if(D.$$typeof===X)return Ve(z,w,ur(z,D),G);dr(z,D)}return typeof D=="string"&&D!==""||typeof D=="number"||typeof D=="bigint"?(D=""+D,w!==null&&w.tag===6?(l(z,w.sibling),G=o(w,D),G.return=z,z=G):(l(z,w),G=Pu(D,z.mode,G),G.return=z,z=G),g(z)):l(z,w)}return function(z,w,D,G){try{Fi=0;var fe=Ve(z,w,D,G);return ai=null,fe}catch(se){if(se===ii||se===cr)throw se;var Re=Yt(29,se,null,z.mode);return Re.lanes=G,Re.return=z,Re}finally{}}}var Tl=nd(!0),ld=nd(!1),Zn=!1;function ho(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function po(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function In(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Fn(e,t,l){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(Le&2)!==0){var o=i.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),i.pending=t,t=lr(e),qf(e,null,l),t}return nr(e,i,t,l),lr(e)}function Ji(e,t,l){if(t=t.updateQueue,t!==null&&(t=t.shared,(l&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Is(e,l)}}function mo(e,t){var l=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,l===i)){var o=null,c=null;if(l=l.firstBaseUpdate,l!==null){do{var g={lane:l.lane,tag:l.tag,payload:l.payload,callback:null,next:null};c===null?o=c=g:c=c.next=g,l=l.next}while(l!==null);c===null?o=c=t:c=c.next=t}else o=c=t;l={baseState:i.baseState,firstBaseUpdate:o,lastBaseUpdate:c,shared:i.shared,callbacks:i.callbacks},e.updateQueue=l;return}e=l.lastBaseUpdate,e===null?l.firstBaseUpdate=t:e.next=t,l.lastBaseUpdate=t}var go=!1;function $i(){if(go){var e=li;if(e!==null)throw e}}function Wi(e,t,l,i){go=!1;var o=e.updateQueue;Zn=!1;var c=o.firstBaseUpdate,g=o.lastBaseUpdate,S=o.shared.pending;if(S!==null){o.shared.pending=null;var A=S,M=A.next;A.next=null,g===null?c=M:g.next=M,g=A;var q=e.alternate;q!==null&&(q=q.updateQueue,S=q.lastBaseUpdate,S!==g&&(S===null?q.firstBaseUpdate=M:S.next=M,q.lastBaseUpdate=A))}if(c!==null){var Z=o.baseState;g=0,q=M=A=null,S=c;do{var N=S.lane&-536870913,U=N!==S.lane;if(U?(_e&N)===N:(i&N)===N){N!==0&&N===ni&&(go=!0),q!==null&&(q=q.next={lane:0,tag:S.tag,payload:S.payload,callback:null,next:null});e:{var ae=e,me=S;N=t;var Ve=l;switch(me.tag){case 1:if(ae=me.payload,typeof ae=="function"){Z=ae.call(Ve,Z,N);break e}Z=ae;break e;case 3:ae.flags=ae.flags&-65537|128;case 0:if(ae=me.payload,N=typeof ae=="function"?ae.call(Ve,Z,N):ae,N==null)break e;Z=y({},Z,N);break e;case 2:Zn=!0}}N=S.callback,N!==null&&(e.flags|=64,U&&(e.flags|=8192),U=o.callbacks,U===null?o.callbacks=[N]:U.push(N))}else U={lane:N,tag:S.tag,payload:S.payload,callback:S.callback,next:null},q===null?(M=q=U,A=Z):q=q.next=U,g|=N;if(S=S.next,S===null){if(S=o.shared.pending,S===null)break;U=S,S=U.next,U.next=null,o.lastBaseUpdate=U,o.shared.pending=null}}while(!0);q===null&&(A=Z),o.baseState=A,o.firstBaseUpdate=M,o.lastBaseUpdate=q,c===null&&(o.shared.lanes=0),Pn|=g,e.lanes=g,e.memoizedState=Z}}function id(e,t){if(typeof e!="function")throw Error(u(191,e));e.call(t)}function ad(e,t){var l=e.callbacks;if(l!==null)for(e.callbacks=null,e=0;e<l.length;e++)id(l[e],t)}var ri=T(null),hr=T(0);function rd(e,t){e=Ln,b(hr,e),b(ri,t),Ln=e|t.baseLanes}function yo(){b(hr,Ln),b(ri,ri.current)}function vo(){Ln=hr.current,Y(ri),Y(hr)}var Vt=T(null),nn=null;function Kn(e){var t=e.alternate;b(et,et.current&1),b(Vt,e),nn===null&&(t===null||ri.current!==null||t.memoizedState!==null)&&(nn=e)}function bo(e){b(et,et.current),b(Vt,e),nn===null&&(nn=e)}function ud(e){e.tag===22?(b(et,et.current),b(Vt,e),nn===null&&(nn=e)):Jn()}function Jn(){b(et,et.current),b(Vt,Vt.current)}function Gt(e){Y(Vt),nn===e&&(nn=null),Y(et)}var et=T(0);function pr(e){for(var t=e;t!==null;){if(t.tag===13){var l=t.memoizedState;if(l!==null&&(l=l.dehydrated,l===null||Tc(l)||wc(l)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Cn=0,be=null,qe=null,lt=null,mr=!1,ui=!1,wl=!1,gr=0,Pi=0,oi=null,l1=0;function $e(){throw Error(u(321))}function So(e,t){if(t===null)return!1;for(var l=0;l<t.length&&l<e.length;l++)if(!qt(e[l],t[l]))return!1;return!0}function xo(e,t,l,i,o,c){return Cn=c,be=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,R.H=e===null||e.memoizedState===null?Xd:Uo,wl=!1,c=l(i,o),wl=!1,ui&&(c=cd(t,l,i,o)),od(e),c}function od(e){R.H=na;var t=qe!==null&&qe.next!==null;if(Cn=0,lt=qe=be=null,mr=!1,Pi=0,oi=null,t)throw Error(u(300));e===null||it||(e=e.dependencies,e!==null&&rr(e)&&(it=!0))}function cd(e,t,l,i){be=e;var o=0;do{if(ui&&(oi=null),Pi=0,ui=!1,25<=o)throw Error(u(301));if(o+=1,lt=qe=null,e.updateQueue!=null){var c=e.updateQueue;c.lastEffect=null,c.events=null,c.stores=null,c.memoCache!=null&&(c.memoCache.index=0)}R.H=Qd,c=t(l,i)}while(ui);return c}function i1(){var e=R.H,t=e.useState()[0];return t=typeof t.then=="function"?ea(t):t,e=e.useState()[0],(qe!==null?qe.memoizedState:null)!==e&&(be.flags|=1024),t}function Eo(){var e=gr!==0;return gr=0,e}function ko(e,t,l){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l}function Ao(e){if(mr){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}mr=!1}Cn=0,lt=qe=be=null,ui=!1,Pi=gr=0,oi=null}function Tt(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return lt===null?be.memoizedState=lt=e:lt=lt.next=e,lt}function tt(){if(qe===null){var e=be.alternate;e=e!==null?e.memoizedState:null}else e=qe.next;var t=lt===null?be.memoizedState:lt.next;if(t!==null)lt=t,qe=e;else{if(e===null)throw be.alternate===null?Error(u(467)):Error(u(310));qe=e,e={memoizedState:qe.memoizedState,baseState:qe.baseState,baseQueue:qe.baseQueue,queue:qe.queue,next:null},lt===null?be.memoizedState=lt=e:lt=lt.next=e}return lt}function yr(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function ea(e){var t=Pi;return Pi+=1,oi===null&&(oi=[]),e=Pf(oi,e,t),t=be,(lt===null?t.memoizedState:lt.next)===null&&(t=t.alternate,R.H=t===null||t.memoizedState===null?Xd:Uo),e}function vr(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return ea(e);if(e.$$typeof===X)return pt(e)}throw Error(u(438,String(e)))}function To(e){var t=null,l=be.updateQueue;if(l!==null&&(t=l.memoCache),t==null){var i=be.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(o){return o.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),l===null&&(l=yr(),be.updateQueue=l),l.memoCache=t,l=t.data[t.index],l===void 0)for(l=t.data[t.index]=Array(e),i=0;i<e;i++)l[i]=L;return t.index++,l}function zn(e,t){return typeof t=="function"?t(e):t}function br(e){var t=tt();return wo(t,qe,e)}function wo(e,t,l){var i=e.queue;if(i===null)throw Error(u(311));i.lastRenderedReducer=l;var o=e.baseQueue,c=i.pending;if(c!==null){if(o!==null){var g=o.next;o.next=c.next,c.next=g}t.baseQueue=o=c,i.pending=null}if(c=e.baseState,o===null)e.memoizedState=c;else{t=o.next;var S=g=null,A=null,M=t,q=!1;do{var Z=M.lane&-536870913;if(Z!==M.lane?(_e&Z)===Z:(Cn&Z)===Z){var N=M.revertLane;if(N===0)A!==null&&(A=A.next={lane:0,revertLane:0,gesture:null,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null}),Z===ni&&(q=!0);else if((Cn&N)===N){M=M.next,N===ni&&(q=!0);continue}else Z={lane:0,revertLane:M.revertLane,gesture:null,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null},A===null?(S=A=Z,g=c):A=A.next=Z,be.lanes|=N,Pn|=N;Z=M.action,wl&&l(c,Z),c=M.hasEagerState?M.eagerState:l(c,Z)}else N={lane:Z,revertLane:M.revertLane,gesture:M.gesture,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null},A===null?(S=A=N,g=c):A=A.next=N,be.lanes|=Z,Pn|=Z;M=M.next}while(M!==null&&M!==t);if(A===null?g=c:A.next=S,!qt(c,e.memoizedState)&&(it=!0,q&&(l=li,l!==null)))throw l;e.memoizedState=c,e.baseState=g,e.baseQueue=A,i.lastRenderedState=c}return o===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function Co(e){var t=tt(),l=t.queue;if(l===null)throw Error(u(311));l.lastRenderedReducer=e;var i=l.dispatch,o=l.pending,c=t.memoizedState;if(o!==null){l.pending=null;var g=o=o.next;do c=e(c,g.action),g=g.next;while(g!==o);qt(c,t.memoizedState)||(it=!0),t.memoizedState=c,t.baseQueue===null&&(t.baseState=c),l.lastRenderedState=c}return[c,i]}function sd(e,t,l){var i=be,o=tt(),c=De;if(c){if(l===void 0)throw Error(u(407));l=l()}else l=t();var g=!qt((qe||o).memoizedState,l);if(g&&(o.memoizedState=l,it=!0),o=o.queue,Oo(hd.bind(null,i,o,e),[e]),o.getSnapshot!==t||g||lt!==null&&lt.memoizedState.tag&1){if(i.flags|=2048,ci(9,{destroy:void 0},dd.bind(null,i,o,l,t),null),Xe===null)throw Error(u(349));c||(Cn&127)!==0||fd(i,t,l)}return l}function fd(e,t,l){e.flags|=16384,e={getSnapshot:t,value:l},t=be.updateQueue,t===null?(t=yr(),be.updateQueue=t,t.stores=[e]):(l=t.stores,l===null?t.stores=[e]:l.push(e))}function dd(e,t,l,i){t.value=l,t.getSnapshot=i,pd(t)&&md(e)}function hd(e,t,l){return l(function(){pd(t)&&md(e)})}function pd(e){var t=e.getSnapshot;e=e.value;try{var l=t();return!qt(e,l)}catch{return!0}}function md(e){var t=yl(e,2);t!==null&&Ut(t,e,2)}function zo(e){var t=Tt();if(typeof e=="function"){var l=e;if(e=l(),wl){_t(!0);try{l()}finally{_t(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:zn,lastRenderedState:e},t}function gd(e,t,l,i){return e.baseState=l,wo(e,qe,typeof i=="function"?i:zn)}function a1(e,t,l,i,o){if(Er(e))throw Error(u(485));if(e=t.action,e!==null){var c={payload:o,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(g){c.listeners.push(g)}};R.T!==null?l(!0):c.isTransition=!1,i(c),l=t.pending,l===null?(c.next=t.pending=c,yd(t,c)):(c.next=l.next,t.pending=l.next=c)}}function yd(e,t){var l=t.action,i=t.payload,o=e.state;if(t.isTransition){var c=R.T,g={};R.T=g;try{var S=l(o,i),A=R.S;A!==null&&A(g,S),vd(e,t,S)}catch(M){_o(e,t,M)}finally{c!==null&&g.types!==null&&(c.types=g.types),R.T=c}}else try{c=l(o,i),vd(e,t,c)}catch(M){_o(e,t,M)}}function vd(e,t,l){l!==null&&typeof l=="object"&&typeof l.then=="function"?l.then(function(i){bd(e,t,i)},function(i){return _o(e,t,i)}):bd(e,t,l)}function bd(e,t,l){t.status="fulfilled",t.value=l,Sd(t),e.state=l,t=e.pending,t!==null&&(l=t.next,l===t?e.pending=null:(l=l.next,t.next=l,yd(e,l)))}function _o(e,t,l){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=l,Sd(t),t=t.next;while(t!==i)}e.action=null}function Sd(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function xd(e,t){return t}function Ed(e,t){if(De){var l=Xe.formState;if(l!==null){e:{var i=be;if(De){if(Ie){t:{for(var o=Ie,c=tn;o.nodeType!==8;){if(!c){o=null;break t}if(o=ln(o.nextSibling),o===null){o=null;break t}}c=o.data,o=c==="F!"||c==="F"?o:null}if(o){Ie=ln(o.nextSibling),i=o.data==="F!";break e}}Xn(i)}i=!1}i&&(t=l[0])}}return l=Tt(),l.memoizedState=l.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:xd,lastRenderedState:t},l.queue=i,l=Yd.bind(null,be,i),i.dispatch=l,i=zo(!1),c=Lo.bind(null,be,!1,i.queue),i=Tt(),o={state:t,dispatch:null,action:e,pending:null},i.queue=o,l=a1.bind(null,be,o,c,l),o.dispatch=l,i.memoizedState=e,[t,l,!1]}function kd(e){var t=tt();return Ad(t,qe,e)}function Ad(e,t,l){if(t=wo(e,t,xd)[0],e=br(zn)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=ea(t)}catch(g){throw g===ii?cr:g}else i=t;t=tt();var o=t.queue,c=o.dispatch;return l!==t.memoizedState&&(be.flags|=2048,ci(9,{destroy:void 0},r1.bind(null,o,l),null)),[i,c,e]}function r1(e,t){e.action=t}function Td(e){var t=tt(),l=qe;if(l!==null)return Ad(t,l,e);tt(),t=t.memoizedState,l=tt();var i=l.queue.dispatch;return l.memoizedState=e,[t,i,!1]}function ci(e,t,l,i){return e={tag:e,create:l,deps:i,inst:t,next:null},t=be.updateQueue,t===null&&(t=yr(),be.updateQueue=t),l=t.lastEffect,l===null?t.lastEffect=e.next=e:(i=l.next,l.next=e,e.next=i,t.lastEffect=e),e}function wd(){return tt().memoizedState}function Sr(e,t,l,i){var o=Tt();be.flags|=e,o.memoizedState=ci(1|t,{destroy:void 0},l,i===void 0?null:i)}function xr(e,t,l,i){var o=tt();i=i===void 0?null:i;var c=o.memoizedState.inst;qe!==null&&i!==null&&So(i,qe.memoizedState.deps)?o.memoizedState=ci(t,c,l,i):(be.flags|=e,o.memoizedState=ci(1|t,c,l,i))}function Cd(e,t){Sr(8390656,8,e,t)}function Oo(e,t){xr(2048,8,e,t)}function u1(e){be.flags|=4;var t=be.updateQueue;if(t===null)t=yr(),be.updateQueue=t,t.events=[e];else{var l=t.events;l===null?t.events=[e]:l.push(e)}}function zd(e){var t=tt().memoizedState;return u1({ref:t,nextImpl:e}),function(){if((Le&2)!==0)throw Error(u(440));return t.impl.apply(void 0,arguments)}}function _d(e,t){return xr(4,2,e,t)}function Od(e,t){return xr(4,4,e,t)}function Dd(e,t){if(typeof t=="function"){e=e();var l=t(e);return function(){typeof l=="function"?l():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Md(e,t,l){l=l!=null?l.concat([e]):null,xr(4,4,Dd.bind(null,t,e),l)}function Do(){}function Rd(e,t){var l=tt();t=t===void 0?null:t;var i=l.memoizedState;return t!==null&&So(t,i[1])?i[0]:(l.memoizedState=[e,t],e)}function Nd(e,t){var l=tt();t=t===void 0?null:t;var i=l.memoizedState;if(t!==null&&So(t,i[1]))return i[0];if(i=e(),wl){_t(!0);try{e()}finally{_t(!1)}}return l.memoizedState=[i,t],i}function Mo(e,t,l){return l===void 0||(Cn&1073741824)!==0&&(_e&261930)===0?e.memoizedState=t:(e.memoizedState=l,e=Lh(),be.lanes|=e,Pn|=e,l)}function Ld(e,t,l,i){return qt(l,t)?l:ri.current!==null?(e=Mo(e,l,i),qt(e,t)||(it=!0),e):(Cn&42)===0||(Cn&1073741824)!==0&&(_e&261930)===0?(it=!0,e.memoizedState=l):(e=Lh(),be.lanes|=e,Pn|=e,t)}function Ud(e,t,l,i,o){var c=I.p;I.p=c!==0&&8>c?c:8;var g=R.T,S={};R.T=S,Lo(e,!1,t,l);try{var A=o(),M=R.S;if(M!==null&&M(S,A),A!==null&&typeof A=="object"&&typeof A.then=="function"){var q=n1(A,i);ta(e,t,q,Zt(e))}else ta(e,t,i,Zt(e))}catch(Z){ta(e,t,{then:function(){},status:"rejected",reason:Z},Zt())}finally{I.p=c,g!==null&&S.types!==null&&(g.types=S.types),R.T=g}}function o1(){}function Ro(e,t,l,i){if(e.tag!==5)throw Error(u(476));var o=jd(e).queue;Ud(e,o,t,ce,l===null?o1:function(){return Bd(e),l(i)})}function jd(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:ce,baseState:ce,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:zn,lastRenderedState:ce},next:null};var l={};return t.next={memoizedState:l,baseState:l,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:zn,lastRenderedState:l},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function Bd(e){var t=jd(e);t.next===null&&(t=e.alternate.memoizedState),ta(e,t.next.queue,{},Zt())}function No(){return pt(va)}function Hd(){return tt().memoizedState}function qd(){return tt().memoizedState}function c1(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var l=Zt();e=In(l);var i=Fn(t,e,l);i!==null&&(Ut(i,t,l),Ji(i,t,l)),t={cache:oo()},e.payload=t;return}t=t.return}}function s1(e,t,l){var i=Zt();l={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null},Er(e)?Vd(t,l):(l=$u(e,t,l,i),l!==null&&(Ut(l,e,i),Gd(l,t,i)))}function Yd(e,t,l){var i=Zt();ta(e,t,l,i)}function ta(e,t,l,i){var o={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null};if(Er(e))Vd(t,o);else{var c=e.alternate;if(e.lanes===0&&(c===null||c.lanes===0)&&(c=t.lastRenderedReducer,c!==null))try{var g=t.lastRenderedState,S=c(g,l);if(o.hasEagerState=!0,o.eagerState=S,qt(S,g))return nr(e,t,o,0),Xe===null&&tr(),!1}catch{}finally{}if(l=$u(e,t,o,i),l!==null)return Ut(l,e,i),Gd(l,t,i),!0}return!1}function Lo(e,t,l,i){if(i={lane:2,revertLane:hc(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Er(e)){if(t)throw Error(u(479))}else t=$u(e,l,i,2),t!==null&&Ut(t,e,2)}function Er(e){var t=e.alternate;return e===be||t!==null&&t===be}function Vd(e,t){ui=mr=!0;var l=e.pending;l===null?t.next=t:(t.next=l.next,l.next=t),e.pending=t}function Gd(e,t,l){if((l&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Is(e,l)}}var na={readContext:pt,use:vr,useCallback:$e,useContext:$e,useEffect:$e,useImperativeHandle:$e,useLayoutEffect:$e,useInsertionEffect:$e,useMemo:$e,useReducer:$e,useRef:$e,useState:$e,useDebugValue:$e,useDeferredValue:$e,useTransition:$e,useSyncExternalStore:$e,useId:$e,useHostTransitionStatus:$e,useFormState:$e,useActionState:$e,useOptimistic:$e,useMemoCache:$e,useCacheRefresh:$e};na.useEffectEvent=$e;var Xd={readContext:pt,use:vr,useCallback:function(e,t){return Tt().memoizedState=[e,t===void 0?null:t],e},useContext:pt,useEffect:Cd,useImperativeHandle:function(e,t,l){l=l!=null?l.concat([e]):null,Sr(4194308,4,Dd.bind(null,t,e),l)},useLayoutEffect:function(e,t){return Sr(4194308,4,e,t)},useInsertionEffect:function(e,t){Sr(4,2,e,t)},useMemo:function(e,t){var l=Tt();t=t===void 0?null:t;var i=e();if(wl){_t(!0);try{e()}finally{_t(!1)}}return l.memoizedState=[i,t],i},useReducer:function(e,t,l){var i=Tt();if(l!==void 0){var o=l(t);if(wl){_t(!0);try{l(t)}finally{_t(!1)}}}else o=t;return i.memoizedState=i.baseState=o,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:o},i.queue=e,e=e.dispatch=s1.bind(null,be,e),[i.memoizedState,e]},useRef:function(e){var t=Tt();return e={current:e},t.memoizedState=e},useState:function(e){e=zo(e);var t=e.queue,l=Yd.bind(null,be,t);return t.dispatch=l,[e.memoizedState,l]},useDebugValue:Do,useDeferredValue:function(e,t){var l=Tt();return Mo(l,e,t)},useTransition:function(){var e=zo(!1);return e=Ud.bind(null,be,e.queue,!0,!1),Tt().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,l){var i=be,o=Tt();if(De){if(l===void 0)throw Error(u(407));l=l()}else{if(l=t(),Xe===null)throw Error(u(349));(_e&127)!==0||fd(i,t,l)}o.memoizedState=l;var c={value:l,getSnapshot:t};return o.queue=c,Cd(hd.bind(null,i,c,e),[e]),i.flags|=2048,ci(9,{destroy:void 0},dd.bind(null,i,c,l,t),null),l},useId:function(){var e=Tt(),t=Xe.identifierPrefix;if(De){var l=hn,i=dn;l=(i&~(1<<32-Ge(i)-1)).toString(32)+l,t="_"+t+"R_"+l,l=gr++,0<l&&(t+="H"+l.toString(32)),t+="_"}else l=l1++,t="_"+t+"r_"+l.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:No,useFormState:Ed,useActionState:Ed,useOptimistic:function(e){var t=Tt();t.memoizedState=t.baseState=e;var l={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=l,t=Lo.bind(null,be,!0,l),l.dispatch=t,[e,t]},useMemoCache:To,useCacheRefresh:function(){return Tt().memoizedState=c1.bind(null,be)},useEffectEvent:function(e){var t=Tt(),l={impl:e};return t.memoizedState=l,function(){if((Le&2)!==0)throw Error(u(440));return l.impl.apply(void 0,arguments)}}},Uo={readContext:pt,use:vr,useCallback:Rd,useContext:pt,useEffect:Oo,useImperativeHandle:Md,useInsertionEffect:_d,useLayoutEffect:Od,useMemo:Nd,useReducer:br,useRef:wd,useState:function(){return br(zn)},useDebugValue:Do,useDeferredValue:function(e,t){var l=tt();return Ld(l,qe.memoizedState,e,t)},useTransition:function(){var e=br(zn)[0],t=tt().memoizedState;return[typeof e=="boolean"?e:ea(e),t]},useSyncExternalStore:sd,useId:Hd,useHostTransitionStatus:No,useFormState:kd,useActionState:kd,useOptimistic:function(e,t){var l=tt();return gd(l,qe,e,t)},useMemoCache:To,useCacheRefresh:qd};Uo.useEffectEvent=zd;var Qd={readContext:pt,use:vr,useCallback:Rd,useContext:pt,useEffect:Oo,useImperativeHandle:Md,useInsertionEffect:_d,useLayoutEffect:Od,useMemo:Nd,useReducer:Co,useRef:wd,useState:function(){return Co(zn)},useDebugValue:Do,useDeferredValue:function(e,t){var l=tt();return qe===null?Mo(l,e,t):Ld(l,qe.memoizedState,e,t)},useTransition:function(){var e=Co(zn)[0],t=tt().memoizedState;return[typeof e=="boolean"?e:ea(e),t]},useSyncExternalStore:sd,useId:Hd,useHostTransitionStatus:No,useFormState:Td,useActionState:Td,useOptimistic:function(e,t){var l=tt();return qe!==null?gd(l,qe,e,t):(l.baseState=e,[e,l.queue.dispatch])},useMemoCache:To,useCacheRefresh:qd};Qd.useEffectEvent=zd;function jo(e,t,l,i){t=e.memoizedState,l=l(i,t),l=l==null?t:y({},t,l),e.memoizedState=l,e.lanes===0&&(e.updateQueue.baseState=l)}var Bo={enqueueSetState:function(e,t,l){e=e._reactInternals;var i=Zt(),o=In(i);o.payload=t,l!=null&&(o.callback=l),t=Fn(e,o,i),t!==null&&(Ut(t,e,i),Ji(t,e,i))},enqueueReplaceState:function(e,t,l){e=e._reactInternals;var i=Zt(),o=In(i);o.tag=1,o.payload=t,l!=null&&(o.callback=l),t=Fn(e,o,i),t!==null&&(Ut(t,e,i),Ji(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var l=Zt(),i=In(l);i.tag=2,t!=null&&(i.callback=t),t=Fn(e,i,l),t!==null&&(Ut(t,e,l),Ji(t,e,l))}};function Zd(e,t,l,i,o,c,g){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,c,g):t.prototype&&t.prototype.isPureReactComponent?!Vi(l,i)||!Vi(o,c):!0}function Id(e,t,l,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(l,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(l,i),t.state!==e&&Bo.enqueueReplaceState(t,t.state,null)}function Cl(e,t){var l=t;if("ref"in t){l={};for(var i in t)i!=="ref"&&(l[i]=t[i])}if(e=e.defaultProps){l===t&&(l=y({},l));for(var o in e)l[o]===void 0&&(l[o]=e[o])}return l}function Fd(e){er(e)}function Kd(e){console.error(e)}function Jd(e){er(e)}function kr(e,t){try{var l=e.onUncaughtError;l(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function $d(e,t,l){try{var i=e.onCaughtError;i(l.value,{componentStack:l.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(o){setTimeout(function(){throw o})}}function Ho(e,t,l){return l=In(l),l.tag=3,l.payload={element:null},l.callback=function(){kr(e,t)},l}function Wd(e){return e=In(e),e.tag=3,e}function Pd(e,t,l,i){var o=l.type.getDerivedStateFromError;if(typeof o=="function"){var c=i.value;e.payload=function(){return o(c)},e.callback=function(){$d(t,l,i)}}var g=l.stateNode;g!==null&&typeof g.componentDidCatch=="function"&&(e.callback=function(){$d(t,l,i),typeof o!="function"&&(el===null?el=new Set([this]):el.add(this));var S=i.stack;this.componentDidCatch(i.value,{componentStack:S!==null?S:""})})}function f1(e,t,l,i,o){if(l.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=l.alternate,t!==null&&ti(t,l,o,!0),l=Vt.current,l!==null){switch(l.tag){case 31:case 13:return nn===null?Lr():l.alternate===null&&We===0&&(We=3),l.flags&=-257,l.flags|=65536,l.lanes=o,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?l.updateQueue=new Set([i]):t.add(i),sc(e,i,o)),!1;case 22:return l.flags|=65536,i===sr?l.flags|=16384:(t=l.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},l.updateQueue=t):(l=t.retryQueue,l===null?t.retryQueue=new Set([i]):l.add(i)),sc(e,i,o)),!1}throw Error(u(435,l.tag))}return sc(e,i,o),Lr(),!1}if(De)return t=Vt.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=o,i!==lo&&(e=Error(u(422),{cause:i}),Qi(Wt(e,l)))):(i!==lo&&(t=Error(u(423),{cause:i}),Qi(Wt(t,l))),e=e.current.alternate,e.flags|=65536,o&=-o,e.lanes|=o,i=Wt(i,l),o=Ho(e.stateNode,i,o),mo(e,o),We!==4&&(We=2)),!1;var c=Error(u(520),{cause:i});if(c=Wt(c,l),sa===null?sa=[c]:sa.push(c),We!==4&&(We=2),t===null)return!0;i=Wt(i,l),l=t;do{switch(l.tag){case 3:return l.flags|=65536,e=o&-o,l.lanes|=e,e=Ho(l.stateNode,i,e),mo(l,e),!1;case 1:if(t=l.type,c=l.stateNode,(l.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||c!==null&&typeof c.componentDidCatch=="function"&&(el===null||!el.has(c))))return l.flags|=65536,o&=-o,l.lanes|=o,o=Wd(o),Pd(o,e,l,i),mo(l,o),!1}l=l.return}while(l!==null);return!1}var qo=Error(u(461)),it=!1;function mt(e,t,l,i){t.child=e===null?ld(t,null,l,i):Tl(t,e.child,l,i)}function eh(e,t,l,i,o){l=l.render;var c=t.ref;if("ref"in i){var g={};for(var S in i)S!=="ref"&&(g[S]=i[S])}else g=i;return xl(t),i=xo(e,t,l,g,c,o),S=Eo(),e!==null&&!it?(ko(e,t,o),_n(e,t,o)):(De&&S&&to(t),t.flags|=1,mt(e,t,i,o),t.child)}function th(e,t,l,i,o){if(e===null){var c=l.type;return typeof c=="function"&&!Wu(c)&&c.defaultProps===void 0&&l.compare===null?(t.tag=15,t.type=c,nh(e,t,c,i,o)):(e=ir(l.type,null,i,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(c=e.child,!Fo(e,o)){var g=c.memoizedProps;if(l=l.compare,l=l!==null?l:Vi,l(g,i)&&e.ref===t.ref)return _n(e,t,o)}return t.flags|=1,e=kn(c,i),e.ref=t.ref,e.return=t,t.child=e}function nh(e,t,l,i,o){if(e!==null){var c=e.memoizedProps;if(Vi(c,i)&&e.ref===t.ref)if(it=!1,t.pendingProps=i=c,Fo(e,o))(e.flags&131072)!==0&&(it=!0);else return t.lanes=e.lanes,_n(e,t,o)}return Yo(e,t,l,i,o)}function lh(e,t,l,i){var o=i.children,c=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(c=c!==null?c.baseLanes|l:l,e!==null){for(i=t.child=e.child,o=0;i!==null;)o=o|i.lanes|i.childLanes,i=i.sibling;i=o&~c}else i=0,t.child=null;return ih(e,t,c,l,i)}if((l&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&or(t,c!==null?c.cachePool:null),c!==null?rd(t,c):yo(),ud(t);else return i=t.lanes=536870912,ih(e,t,c!==null?c.baseLanes|l:l,l,i)}else c!==null?(or(t,c.cachePool),rd(t,c),Jn(),t.memoizedState=null):(e!==null&&or(t,null),yo(),Jn());return mt(e,t,o,l),t.child}function la(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function ih(e,t,l,i,o){var c=so();return c=c===null?null:{parent:nt._currentValue,pool:c},t.memoizedState={baseLanes:l,cachePool:c},e!==null&&or(t,null),yo(),ud(t),e!==null&&ti(e,t,i,!0),t.childLanes=o,null}function Ar(e,t){return t=wr({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function ah(e,t,l){return Tl(t,e.child,null,l),e=Ar(t,t.pendingProps),e.flags|=2,Gt(t),t.memoizedState=null,e}function d1(e,t,l){var i=t.pendingProps,o=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(De){if(i.mode==="hidden")return e=Ar(t,i),t.lanes=536870912,la(null,e);if(bo(t),(e=Ie)?(e=yp(e,tn),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Vn!==null?{id:dn,overflow:hn}:null,retryLane:536870912,hydrationErrors:null},l=Vf(e),l.return=t,t.child=l,ht=t,Ie=null)):e=null,e===null)throw Xn(t);return t.lanes=536870912,null}return Ar(t,i)}var c=e.memoizedState;if(c!==null){var g=c.dehydrated;if(bo(t),o)if(t.flags&256)t.flags&=-257,t=ah(e,t,l);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(u(558));else if(it||ti(e,t,l,!1),o=(l&e.childLanes)!==0,it||o){if(i=Xe,i!==null&&(g=Fs(i,l),g!==0&&g!==c.retryLane))throw c.retryLane=g,yl(e,g),Ut(i,e,g),qo;Lr(),t=ah(e,t,l)}else e=c.treeContext,Ie=ln(g.nextSibling),ht=t,De=!0,Gn=null,tn=!1,e!==null&&Qf(t,e),t=Ar(t,i),t.flags|=4096;return t}return e=kn(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function Tr(e,t){var l=t.ref;if(l===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof l!="function"&&typeof l!="object")throw Error(u(284));(e===null||e.ref!==l)&&(t.flags|=4194816)}}function Yo(e,t,l,i,o){return xl(t),l=xo(e,t,l,i,void 0,o),i=Eo(),e!==null&&!it?(ko(e,t,o),_n(e,t,o)):(De&&i&&to(t),t.flags|=1,mt(e,t,l,o),t.child)}function rh(e,t,l,i,o,c){return xl(t),t.updateQueue=null,l=cd(t,i,l,o),od(e),i=Eo(),e!==null&&!it?(ko(e,t,c),_n(e,t,c)):(De&&i&&to(t),t.flags|=1,mt(e,t,l,c),t.child)}function uh(e,t,l,i,o){if(xl(t),t.stateNode===null){var c=$l,g=l.contextType;typeof g=="object"&&g!==null&&(c=pt(g)),c=new l(i,c),t.memoizedState=c.state!==null&&c.state!==void 0?c.state:null,c.updater=Bo,t.stateNode=c,c._reactInternals=t,c=t.stateNode,c.props=i,c.state=t.memoizedState,c.refs={},ho(t),g=l.contextType,c.context=typeof g=="object"&&g!==null?pt(g):$l,c.state=t.memoizedState,g=l.getDerivedStateFromProps,typeof g=="function"&&(jo(t,l,g,i),c.state=t.memoizedState),typeof l.getDerivedStateFromProps=="function"||typeof c.getSnapshotBeforeUpdate=="function"||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(g=c.state,typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount(),g!==c.state&&Bo.enqueueReplaceState(c,c.state,null),Wi(t,i,c,o),$i(),c.state=t.memoizedState),typeof c.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){c=t.stateNode;var S=t.memoizedProps,A=Cl(l,S);c.props=A;var M=c.context,q=l.contextType;g=$l,typeof q=="object"&&q!==null&&(g=pt(q));var Z=l.getDerivedStateFromProps;q=typeof Z=="function"||typeof c.getSnapshotBeforeUpdate=="function",S=t.pendingProps!==S,q||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(S||M!==g)&&Id(t,c,i,g),Zn=!1;var N=t.memoizedState;c.state=N,Wi(t,i,c,o),$i(),M=t.memoizedState,S||N!==M||Zn?(typeof Z=="function"&&(jo(t,l,Z,i),M=t.memoizedState),(A=Zn||Zd(t,l,A,i,N,M,g))?(q||typeof c.UNSAFE_componentWillMount!="function"&&typeof c.componentWillMount!="function"||(typeof c.componentWillMount=="function"&&c.componentWillMount(),typeof c.UNSAFE_componentWillMount=="function"&&c.UNSAFE_componentWillMount()),typeof c.componentDidMount=="function"&&(t.flags|=4194308)):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=M),c.props=i,c.state=M,c.context=g,i=A):(typeof c.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{c=t.stateNode,po(e,t),g=t.memoizedProps,q=Cl(l,g),c.props=q,Z=t.pendingProps,N=c.context,M=l.contextType,A=$l,typeof M=="object"&&M!==null&&(A=pt(M)),S=l.getDerivedStateFromProps,(M=typeof S=="function"||typeof c.getSnapshotBeforeUpdate=="function")||typeof c.UNSAFE_componentWillReceiveProps!="function"&&typeof c.componentWillReceiveProps!="function"||(g!==Z||N!==A)&&Id(t,c,i,A),Zn=!1,N=t.memoizedState,c.state=N,Wi(t,i,c,o),$i();var U=t.memoizedState;g!==Z||N!==U||Zn||e!==null&&e.dependencies!==null&&rr(e.dependencies)?(typeof S=="function"&&(jo(t,l,S,i),U=t.memoizedState),(q=Zn||Zd(t,l,q,i,N,U,A)||e!==null&&e.dependencies!==null&&rr(e.dependencies))?(M||typeof c.UNSAFE_componentWillUpdate!="function"&&typeof c.componentWillUpdate!="function"||(typeof c.componentWillUpdate=="function"&&c.componentWillUpdate(i,U,A),typeof c.UNSAFE_componentWillUpdate=="function"&&c.UNSAFE_componentWillUpdate(i,U,A)),typeof c.componentDidUpdate=="function"&&(t.flags|=4),typeof c.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof c.componentDidUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=U),c.props=i,c.state=U,c.context=A,i=q):(typeof c.componentDidUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=4),typeof c.getSnapshotBeforeUpdate!="function"||g===e.memoizedProps&&N===e.memoizedState||(t.flags|=1024),i=!1)}return c=i,Tr(e,t),i=(t.flags&128)!==0,c||i?(c=t.stateNode,l=i&&typeof l.getDerivedStateFromError!="function"?null:c.render(),t.flags|=1,e!==null&&i?(t.child=Tl(t,e.child,null,o),t.child=Tl(t,null,l,o)):mt(e,t,l,o),t.memoizedState=c.state,e=t.child):e=_n(e,t,o),e}function oh(e,t,l,i){return bl(),t.flags|=256,mt(e,t,l,i),t.child}var Vo={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Go(e){return{baseLanes:e,cachePool:$f()}}function Xo(e,t,l){return e=e!==null?e.childLanes&~l:0,t&&(e|=Qt),e}function ch(e,t,l){var i=t.pendingProps,o=!1,c=(t.flags&128)!==0,g;if((g=c)||(g=e!==null&&e.memoizedState===null?!1:(et.current&2)!==0),g&&(o=!0,t.flags&=-129),g=(t.flags&32)!==0,t.flags&=-33,e===null){if(De){if(o?Kn(t):Jn(),(e=Ie)?(e=yp(e,tn),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Vn!==null?{id:dn,overflow:hn}:null,retryLane:536870912,hydrationErrors:null},l=Vf(e),l.return=t,t.child=l,ht=t,Ie=null)):e=null,e===null)throw Xn(t);return wc(e)?t.lanes=32:t.lanes=536870912,null}var S=i.children;return i=i.fallback,o?(Jn(),o=t.mode,S=wr({mode:"hidden",children:S},o),i=vl(i,o,l,null),S.return=t,i.return=t,S.sibling=i,t.child=S,i=t.child,i.memoizedState=Go(l),i.childLanes=Xo(e,g,l),t.memoizedState=Vo,la(null,i)):(Kn(t),Qo(t,S))}var A=e.memoizedState;if(A!==null&&(S=A.dehydrated,S!==null)){if(c)t.flags&256?(Kn(t),t.flags&=-257,t=Zo(e,t,l)):t.memoizedState!==null?(Jn(),t.child=e.child,t.flags|=128,t=null):(Jn(),S=i.fallback,o=t.mode,i=wr({mode:"visible",children:i.children},o),S=vl(S,o,l,null),S.flags|=2,i.return=t,S.return=t,i.sibling=S,t.child=i,Tl(t,e.child,null,l),i=t.child,i.memoizedState=Go(l),i.childLanes=Xo(e,g,l),t.memoizedState=Vo,t=la(null,i));else if(Kn(t),wc(S)){if(g=S.nextSibling&&S.nextSibling.dataset,g)var M=g.dgst;g=M,i=Error(u(419)),i.stack="",i.digest=g,Qi({value:i,source:null,stack:null}),t=Zo(e,t,l)}else if(it||ti(e,t,l,!1),g=(l&e.childLanes)!==0,it||g){if(g=Xe,g!==null&&(i=Fs(g,l),i!==0&&i!==A.retryLane))throw A.retryLane=i,yl(e,i),Ut(g,e,i),qo;Tc(S)||Lr(),t=Zo(e,t,l)}else Tc(S)?(t.flags|=192,t.child=e.child,t=null):(e=A.treeContext,Ie=ln(S.nextSibling),ht=t,De=!0,Gn=null,tn=!1,e!==null&&Qf(t,e),t=Qo(t,i.children),t.flags|=4096);return t}return o?(Jn(),S=i.fallback,o=t.mode,A=e.child,M=A.sibling,i=kn(A,{mode:"hidden",children:i.children}),i.subtreeFlags=A.subtreeFlags&65011712,M!==null?S=kn(M,S):(S=vl(S,o,l,null),S.flags|=2),S.return=t,i.return=t,i.sibling=S,t.child=i,la(null,i),i=t.child,S=e.child.memoizedState,S===null?S=Go(l):(o=S.cachePool,o!==null?(A=nt._currentValue,o=o.parent!==A?{parent:A,pool:A}:o):o=$f(),S={baseLanes:S.baseLanes|l,cachePool:o}),i.memoizedState=S,i.childLanes=Xo(e,g,l),t.memoizedState=Vo,la(e.child,i)):(Kn(t),l=e.child,e=l.sibling,l=kn(l,{mode:"visible",children:i.children}),l.return=t,l.sibling=null,e!==null&&(g=t.deletions,g===null?(t.deletions=[e],t.flags|=16):g.push(e)),t.child=l,t.memoizedState=null,l)}function Qo(e,t){return t=wr({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function wr(e,t){return e=Yt(22,e,null,t),e.lanes=0,e}function Zo(e,t,l){return Tl(t,e.child,null,l),e=Qo(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function sh(e,t,l){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),ro(e.return,t,l)}function Io(e,t,l,i,o,c){var g=e.memoizedState;g===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:l,tailMode:o,treeForkCount:c}:(g.isBackwards=t,g.rendering=null,g.renderingStartTime=0,g.last=i,g.tail=l,g.tailMode=o,g.treeForkCount=c)}function fh(e,t,l){var i=t.pendingProps,o=i.revealOrder,c=i.tail;i=i.children;var g=et.current,S=(g&2)!==0;if(S?(g=g&1|2,t.flags|=128):g&=1,b(et,g),mt(e,t,i,l),i=De?Xi:0,!S&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&sh(e,l,t);else if(e.tag===19)sh(e,l,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(o){case"forwards":for(l=t.child,o=null;l!==null;)e=l.alternate,e!==null&&pr(e)===null&&(o=l),l=l.sibling;l=o,l===null?(o=t.child,t.child=null):(o=l.sibling,l.sibling=null),Io(t,!1,o,l,c,i);break;case"backwards":case"unstable_legacy-backwards":for(l=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&pr(e)===null){t.child=o;break}e=o.sibling,o.sibling=l,l=o,o=e}Io(t,!0,l,null,c,i);break;case"together":Io(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function _n(e,t,l){if(e!==null&&(t.dependencies=e.dependencies),Pn|=t.lanes,(l&t.childLanes)===0)if(e!==null){if(ti(e,t,l,!1),(l&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(u(153));if(t.child!==null){for(e=t.child,l=kn(e,e.pendingProps),t.child=l,l.return=t;e.sibling!==null;)e=e.sibling,l=l.sibling=kn(e,e.pendingProps),l.return=t;l.sibling=null}return t.child}function Fo(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&rr(e)))}function h1(e,t,l){switch(t.tag){case 3:ue(t,t.stateNode.containerInfo),Qn(t,nt,e.memoizedState.cache),bl();break;case 27:case 5:Ae(t);break;case 4:ue(t,t.stateNode.containerInfo);break;case 10:Qn(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,bo(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(Kn(t),t.flags|=128,null):(l&t.child.childLanes)!==0?ch(e,t,l):(Kn(t),e=_n(e,t,l),e!==null?e.sibling:null);Kn(t);break;case 19:var o=(e.flags&128)!==0;if(i=(l&t.childLanes)!==0,i||(ti(e,t,l,!1),i=(l&t.childLanes)!==0),o){if(i)return fh(e,t,l);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),b(et,et.current),i)break;return null;case 22:return t.lanes=0,lh(e,t,l,t.pendingProps);case 24:Qn(t,nt,e.memoizedState.cache)}return _n(e,t,l)}function dh(e,t,l){if(e!==null)if(e.memoizedProps!==t.pendingProps)it=!0;else{if(!Fo(e,l)&&(t.flags&128)===0)return it=!1,h1(e,t,l);it=(e.flags&131072)!==0}else it=!1,De&&(t.flags&1048576)!==0&&Xf(t,Xi,t.index);switch(t.lanes=0,t.tag){case 16:e:{var i=t.pendingProps;if(e=kl(t.elementType),t.type=e,typeof e=="function")Wu(e)?(i=Cl(e,i),t.tag=1,t=uh(null,t,e,i,l)):(t.tag=0,t=Yo(null,t,e,i,l));else{if(e!=null){var o=e.$$typeof;if(o===ne){t.tag=11,t=eh(null,t,e,i,l);break e}else if(o===te){t.tag=14,t=th(null,t,e,i,l);break e}}throw t=oe(e)||e,Error(u(306,t,""))}}return t;case 0:return Yo(e,t,t.type,t.pendingProps,l);case 1:return i=t.type,o=Cl(i,t.pendingProps),uh(e,t,i,o,l);case 3:e:{if(ue(t,t.stateNode.containerInfo),e===null)throw Error(u(387));i=t.pendingProps;var c=t.memoizedState;o=c.element,po(e,t),Wi(t,i,null,l);var g=t.memoizedState;if(i=g.cache,Qn(t,nt,i),i!==c.cache&&uo(t,[nt],l,!0),$i(),i=g.element,c.isDehydrated)if(c={element:i,isDehydrated:!1,cache:g.cache},t.updateQueue.baseState=c,t.memoizedState=c,t.flags&256){t=oh(e,t,i,l);break e}else if(i!==o){o=Wt(Error(u(424)),t),Qi(o),t=oh(e,t,i,l);break e}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(Ie=ln(e.firstChild),ht=t,De=!0,Gn=null,tn=!0,l=ld(t,null,i,l),t.child=l;l;)l.flags=l.flags&-3|4096,l=l.sibling}else{if(bl(),i===o){t=_n(e,t,l);break e}mt(e,t,i,l)}t=t.child}return t;case 26:return Tr(e,t),e===null?(l=kp(t.type,null,t.pendingProps,null))?t.memoizedState=l:De||(l=t.type,e=t.pendingProps,i=Vr(K.current).createElement(l),i[dt]=t,i[Ot]=e,gt(i,l,e),st(i),t.stateNode=i):t.memoizedState=kp(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Ae(t),e===null&&De&&(i=t.stateNode=Sp(t.type,t.pendingProps,K.current),ht=t,tn=!0,o=Ie,il(t.type)?(Cc=o,Ie=ln(i.firstChild)):Ie=o),mt(e,t,t.pendingProps.children,l),Tr(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&De&&((o=i=Ie)&&(i=G1(i,t.type,t.pendingProps,tn),i!==null?(t.stateNode=i,ht=t,Ie=ln(i.firstChild),tn=!1,o=!0):o=!1),o||Xn(t)),Ae(t),o=t.type,c=t.pendingProps,g=e!==null?e.memoizedProps:null,i=c.children,Ec(o,c)?i=null:g!==null&&Ec(o,g)&&(t.flags|=32),t.memoizedState!==null&&(o=xo(e,t,i1,null,null,l),va._currentValue=o),Tr(e,t),mt(e,t,i,l),t.child;case 6:return e===null&&De&&((e=l=Ie)&&(l=X1(l,t.pendingProps,tn),l!==null?(t.stateNode=l,ht=t,Ie=null,e=!0):e=!1),e||Xn(t)),null;case 13:return ch(e,t,l);case 4:return ue(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Tl(t,null,i,l):mt(e,t,i,l),t.child;case 11:return eh(e,t,t.type,t.pendingProps,l);case 7:return mt(e,t,t.pendingProps,l),t.child;case 8:return mt(e,t,t.pendingProps.children,l),t.child;case 12:return mt(e,t,t.pendingProps.children,l),t.child;case 10:return i=t.pendingProps,Qn(t,t.type,i.value),mt(e,t,i.children,l),t.child;case 9:return o=t.type._context,i=t.pendingProps.children,xl(t),o=pt(o),i=i(o),t.flags|=1,mt(e,t,i,l),t.child;case 14:return th(e,t,t.type,t.pendingProps,l);case 15:return nh(e,t,t.type,t.pendingProps,l);case 19:return fh(e,t,l);case 31:return d1(e,t,l);case 22:return lh(e,t,l,t.pendingProps);case 24:return xl(t),i=pt(nt),e===null?(o=so(),o===null&&(o=Xe,c=oo(),o.pooledCache=c,c.refCount++,c!==null&&(o.pooledCacheLanes|=l),o=c),t.memoizedState={parent:i,cache:o},ho(t),Qn(t,nt,o)):((e.lanes&l)!==0&&(po(e,t),Wi(t,null,null,l),$i()),o=e.memoizedState,c=t.memoizedState,o.parent!==i?(o={parent:i,cache:i},t.memoizedState=o,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=o),Qn(t,nt,i)):(i=c.cache,Qn(t,nt,i),i!==o.cache&&uo(t,[nt],l,!0))),mt(e,t,t.pendingProps.children,l),t.child;case 29:throw t.pendingProps}throw Error(u(156,t.tag))}function On(e){e.flags|=4}function Ko(e,t,l,i,o){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(o&335544128)===o)if(e.stateNode.complete)e.flags|=8192;else if(Hh())e.flags|=8192;else throw Al=sr,fo}else e.flags&=-16777217}function hh(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!zp(t))if(Hh())e.flags|=8192;else throw Al=sr,fo}function Cr(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Qs():536870912,e.lanes|=t,hi|=t)}function ia(e,t){if(!De)switch(e.tailMode){case"hidden":t=e.tail;for(var l=null;t!==null;)t.alternate!==null&&(l=t),t=t.sibling;l===null?e.tail=null:l.sibling=null;break;case"collapsed":l=e.tail;for(var i=null;l!==null;)l.alternate!==null&&(i=l),l=l.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function Fe(e){var t=e.alternate!==null&&e.alternate.child===e.child,l=0,i=0;if(t)for(var o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags&65011712,i|=o.flags&65011712,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags,i|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=i,e.childLanes=l,t}function p1(e,t,l){var i=t.pendingProps;switch(no(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Fe(t),null;case 1:return Fe(t),null;case 3:return l=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),wn(nt),pe(),l.pendingContext&&(l.context=l.pendingContext,l.pendingContext=null),(e===null||e.child===null)&&(ei(t)?On(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,io())),Fe(t),null;case 26:var o=t.type,c=t.memoizedState;return e===null?(On(t),c!==null?(Fe(t),hh(t,c)):(Fe(t),Ko(t,o,null,i,l))):c?c!==e.memoizedState?(On(t),Fe(t),hh(t,c)):(Fe(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&On(t),Fe(t),Ko(t,o,e,i,l)),null;case 27:if(Je(t),l=K.current,o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&On(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Fe(t),null}e=_.current,ei(t)?Zf(t):(e=Sp(o,i,l),t.stateNode=e,On(t))}return Fe(t),null;case 5:if(Je(t),o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&On(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return Fe(t),null}if(c=_.current,ei(t))Zf(t);else{var g=Vr(K.current);switch(c){case 1:c=g.createElementNS("http://www.w3.org/2000/svg",o);break;case 2:c=g.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;default:switch(o){case"svg":c=g.createElementNS("http://www.w3.org/2000/svg",o);break;case"math":c=g.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;case"script":c=g.createElement("div"),c.innerHTML="<script><\\/script>",c=c.removeChild(c.firstChild);break;case"select":c=typeof i.is=="string"?g.createElement("select",{is:i.is}):g.createElement("select"),i.multiple?c.multiple=!0:i.size&&(c.size=i.size);break;default:c=typeof i.is=="string"?g.createElement(o,{is:i.is}):g.createElement(o)}}c[dt]=t,c[Ot]=i;e:for(g=t.child;g!==null;){if(g.tag===5||g.tag===6)c.appendChild(g.stateNode);else if(g.tag!==4&&g.tag!==27&&g.child!==null){g.child.return=g,g=g.child;continue}if(g===t)break e;for(;g.sibling===null;){if(g.return===null||g.return===t)break e;g=g.return}g.sibling.return=g.return,g=g.sibling}t.stateNode=c;e:switch(gt(c,o,i),o){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}i&&On(t)}}return Fe(t),Ko(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,l),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&On(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(u(166));if(e=K.current,ei(t)){if(e=t.stateNode,l=t.memoizedProps,i=null,o=ht,o!==null)switch(o.tag){case 27:case 5:i=o.memoizedProps}e[dt]=t,e=!!(e.nodeValue===l||i!==null&&i.suppressHydrationWarning===!0||cp(e.nodeValue,l)),e||Xn(t,!0)}else e=Vr(e).createTextNode(i),e[dt]=t,t.stateNode=e}return Fe(t),null;case 31:if(l=t.memoizedState,e===null||e.memoizedState!==null){if(i=ei(t),l!==null){if(e===null){if(!i)throw Error(u(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(557));e[dt]=t}else bl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Fe(t),e=!1}else l=io(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=l),e=!0;if(!e)return t.flags&256?(Gt(t),t):(Gt(t),null);if((t.flags&128)!==0)throw Error(u(558))}return Fe(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(o=ei(t),i!==null&&i.dehydrated!==null){if(e===null){if(!o)throw Error(u(318));if(o=t.memoizedState,o=o!==null?o.dehydrated:null,!o)throw Error(u(317));o[dt]=t}else bl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;Fe(t),o=!1}else o=io(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=o),o=!0;if(!o)return t.flags&256?(Gt(t),t):(Gt(t),null)}return Gt(t),(t.flags&128)!==0?(t.lanes=l,t):(l=i!==null,e=e!==null&&e.memoizedState!==null,l&&(i=t.child,o=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(o=i.alternate.memoizedState.cachePool.pool),c=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(c=i.memoizedState.cachePool.pool),c!==o&&(i.flags|=2048)),l!==e&&l&&(t.child.flags|=8192),Cr(t,t.updateQueue),Fe(t),null);case 4:return pe(),e===null&&yc(t.stateNode.containerInfo),Fe(t),null;case 10:return wn(t.type),Fe(t),null;case 19:if(Y(et),i=t.memoizedState,i===null)return Fe(t),null;if(o=(t.flags&128)!==0,c=i.rendering,c===null)if(o)ia(i,!1);else{if(We!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(c=pr(e),c!==null){for(t.flags|=128,ia(i,!1),e=c.updateQueue,t.updateQueue=e,Cr(t,e),t.subtreeFlags=0,e=l,l=t.child;l!==null;)Yf(l,e),l=l.sibling;return b(et,et.current&1|2),De&&An(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&kt()>Mr&&(t.flags|=128,o=!0,ia(i,!1),t.lanes=4194304)}else{if(!o)if(e=pr(c),e!==null){if(t.flags|=128,o=!0,e=e.updateQueue,t.updateQueue=e,Cr(t,e),ia(i,!0),i.tail===null&&i.tailMode==="hidden"&&!c.alternate&&!De)return Fe(t),null}else 2*kt()-i.renderingStartTime>Mr&&l!==536870912&&(t.flags|=128,o=!0,ia(i,!1),t.lanes=4194304);i.isBackwards?(c.sibling=t.child,t.child=c):(e=i.last,e!==null?e.sibling=c:t.child=c,i.last=c)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=kt(),e.sibling=null,l=et.current,b(et,o?l&1|2:l&1),De&&An(t,i.treeForkCount),e):(Fe(t),null);case 22:case 23:return Gt(t),vo(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(l&536870912)!==0&&(t.flags&128)===0&&(Fe(t),t.subtreeFlags&6&&(t.flags|=8192)):Fe(t),l=t.updateQueue,l!==null&&Cr(t,l.retryQueue),l=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==l&&(t.flags|=2048),e!==null&&Y(El),null;case 24:return l=null,e!==null&&(l=e.memoizedState.cache),t.memoizedState.cache!==l&&(t.flags|=2048),wn(nt),Fe(t),null;case 25:return null;case 30:return null}throw Error(u(156,t.tag))}function m1(e,t){switch(no(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return wn(nt),pe(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return Je(t),null;case 31:if(t.memoizedState!==null){if(Gt(t),t.alternate===null)throw Error(u(340));bl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Gt(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(u(340));bl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return Y(et),null;case 4:return pe(),null;case 10:return wn(t.type),null;case 22:case 23:return Gt(t),vo(),e!==null&&Y(El),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return wn(nt),null;case 25:return null;default:return null}}function ph(e,t){switch(no(t),t.tag){case 3:wn(nt),pe();break;case 26:case 27:case 5:Je(t);break;case 4:pe();break;case 31:t.memoizedState!==null&&Gt(t);break;case 13:Gt(t);break;case 19:Y(et);break;case 10:wn(t.type);break;case 22:case 23:Gt(t),vo(),e!==null&&Y(El);break;case 24:wn(nt)}}function aa(e,t){try{var l=t.updateQueue,i=l!==null?l.lastEffect:null;if(i!==null){var o=i.next;l=o;do{if((l.tag&e)===e){i=void 0;var c=l.create,g=l.inst;i=c(),g.destroy=i}l=l.next}while(l!==o)}}catch(S){He(t,t.return,S)}}function $n(e,t,l){try{var i=t.updateQueue,o=i!==null?i.lastEffect:null;if(o!==null){var c=o.next;i=c;do{if((i.tag&e)===e){var g=i.inst,S=g.destroy;if(S!==void 0){g.destroy=void 0,o=t;var A=l,M=S;try{M()}catch(q){He(o,A,q)}}}i=i.next}while(i!==c)}}catch(q){He(t,t.return,q)}}function mh(e){var t=e.updateQueue;if(t!==null){var l=e.stateNode;try{ad(t,l)}catch(i){He(e,e.return,i)}}}function gh(e,t,l){l.props=Cl(e.type,e.memoizedProps),l.state=e.memoizedState;try{l.componentWillUnmount()}catch(i){He(e,t,i)}}function ra(e,t){try{var l=e.ref;if(l!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof l=="function"?e.refCleanup=l(i):l.current=i}}catch(o){He(e,t,o)}}function pn(e,t){var l=e.ref,i=e.refCleanup;if(l!==null)if(typeof i=="function")try{i()}catch(o){He(e,t,o)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof l=="function")try{l(null)}catch(o){He(e,t,o)}else l.current=null}function yh(e){var t=e.type,l=e.memoizedProps,i=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":l.autoFocus&&i.focus();break e;case"img":l.src?i.src=l.src:l.srcSet&&(i.srcset=l.srcSet)}}catch(o){He(e,e.return,o)}}function Jo(e,t,l){try{var i=e.stateNode;j1(i,e.type,l,t),i[Ot]=t}catch(o){He(e,e.return,o)}}function vh(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&il(e.type)||e.tag===4}function $o(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||vh(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&il(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Wo(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l).insertBefore(e,t):(t=l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l,t.appendChild(e),l=l._reactRootContainer,l!=null||t.onclick!==null||(t.onclick=xn));else if(i!==4&&(i===27&&il(e.type)&&(l=e.stateNode,t=null),e=e.child,e!==null))for(Wo(e,t,l),e=e.sibling;e!==null;)Wo(e,t,l),e=e.sibling}function zr(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?l.insertBefore(e,t):l.appendChild(e);else if(i!==4&&(i===27&&il(e.type)&&(l=e.stateNode),e=e.child,e!==null))for(zr(e,t,l),e=e.sibling;e!==null;)zr(e,t,l),e=e.sibling}function bh(e){var t=e.stateNode,l=e.memoizedProps;try{for(var i=e.type,o=t.attributes;o.length;)t.removeAttributeNode(o[0]);gt(t,i,l),t[dt]=e,t[Ot]=l}catch(c){He(e,e.return,c)}}var Dn=!1,at=!1,Po=!1,Sh=typeof WeakSet=="function"?WeakSet:Set,ft=null;function g1(e,t){if(e=e.containerInfo,Sc=Kr,e=Mf(e),Qu(e)){if("selectionStart"in e)var l={start:e.selectionStart,end:e.selectionEnd};else e:{l=(l=e.ownerDocument)&&l.defaultView||window;var i=l.getSelection&&l.getSelection();if(i&&i.rangeCount!==0){l=i.anchorNode;var o=i.anchorOffset,c=i.focusNode;i=i.focusOffset;try{l.nodeType,c.nodeType}catch{l=null;break e}var g=0,S=-1,A=-1,M=0,q=0,Z=e,N=null;t:for(;;){for(var U;Z!==l||o!==0&&Z.nodeType!==3||(S=g+o),Z!==c||i!==0&&Z.nodeType!==3||(A=g+i),Z.nodeType===3&&(g+=Z.nodeValue.length),(U=Z.firstChild)!==null;)N=Z,Z=U;for(;;){if(Z===e)break t;if(N===l&&++M===o&&(S=g),N===c&&++q===i&&(A=g),(U=Z.nextSibling)!==null)break;Z=N,N=Z.parentNode}Z=U}l=S===-1||A===-1?null:{start:S,end:A}}else l=null}l=l||{start:0,end:0}}else l=null;for(xc={focusedElem:e,selectionRange:l},Kr=!1,ft=t;ft!==null;)if(t=ft,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,ft=e;else for(;ft!==null;){switch(t=ft,c=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(l=0;l<e.length;l++)o=e[l],o.ref.impl=o.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&c!==null){e=void 0,l=t,o=c.memoizedProps,c=c.memoizedState,i=l.stateNode;try{var ae=Cl(l.type,o);e=i.getSnapshotBeforeUpdate(ae,c),i.__reactInternalSnapshotBeforeUpdate=e}catch(me){He(l,l.return,me)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,l=e.nodeType,l===9)Ac(e);else if(l===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":Ac(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(u(163))}if(e=t.sibling,e!==null){e.return=t.return,ft=e;break}ft=t.return}}function xh(e,t,l){var i=l.flags;switch(l.tag){case 0:case 11:case 15:Rn(e,l),i&4&&aa(5,l);break;case 1:if(Rn(e,l),i&4)if(e=l.stateNode,t===null)try{e.componentDidMount()}catch(g){He(l,l.return,g)}else{var o=Cl(l.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(o,t,e.__reactInternalSnapshotBeforeUpdate)}catch(g){He(l,l.return,g)}}i&64&&mh(l),i&512&&ra(l,l.return);break;case 3:if(Rn(e,l),i&64&&(e=l.updateQueue,e!==null)){if(t=null,l.child!==null)switch(l.child.tag){case 27:case 5:t=l.child.stateNode;break;case 1:t=l.child.stateNode}try{ad(e,t)}catch(g){He(l,l.return,g)}}break;case 27:t===null&&i&4&&bh(l);case 26:case 5:Rn(e,l),t===null&&i&4&&yh(l),i&512&&ra(l,l.return);break;case 12:Rn(e,l);break;case 31:Rn(e,l),i&4&&Ah(e,l);break;case 13:Rn(e,l),i&4&&Th(e,l),i&64&&(e=l.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(l=T1.bind(null,l),Q1(e,l))));break;case 22:if(i=l.memoizedState!==null||Dn,!i){t=t!==null&&t.memoizedState!==null||at,o=Dn;var c=at;Dn=i,(at=t)&&!c?Nn(e,l,(l.subtreeFlags&8772)!==0):Rn(e,l),Dn=o,at=c}break;case 30:break;default:Rn(e,l)}}function Eh(e){var t=e.alternate;t!==null&&(e.alternate=null,Eh(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&zu(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var Ke=null,Mt=!1;function Mn(e,t,l){for(l=l.child;l!==null;)kh(e,t,l),l=l.sibling}function kh(e,t,l){if(ut&&typeof ut.onCommitFiberUnmount=="function")try{ut.onCommitFiberUnmount(At,l)}catch{}switch(l.tag){case 26:at||pn(l,t),Mn(e,t,l),l.memoizedState?l.memoizedState.count--:l.stateNode&&(l=l.stateNode,l.parentNode.removeChild(l));break;case 27:at||pn(l,t);var i=Ke,o=Mt;il(l.type)&&(Ke=l.stateNode,Mt=!1),Mn(e,t,l),ma(l.stateNode),Ke=i,Mt=o;break;case 5:at||pn(l,t);case 6:if(i=Ke,o=Mt,Ke=null,Mn(e,t,l),Ke=i,Mt=o,Ke!==null)if(Mt)try{(Ke.nodeType===9?Ke.body:Ke.nodeName==="HTML"?Ke.ownerDocument.body:Ke).removeChild(l.stateNode)}catch(c){He(l,t,c)}else try{Ke.removeChild(l.stateNode)}catch(c){He(l,t,c)}break;case 18:Ke!==null&&(Mt?(e=Ke,mp(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,l.stateNode),xi(e)):mp(Ke,l.stateNode));break;case 4:i=Ke,o=Mt,Ke=l.stateNode.containerInfo,Mt=!0,Mn(e,t,l),Ke=i,Mt=o;break;case 0:case 11:case 14:case 15:$n(2,l,t),at||$n(4,l,t),Mn(e,t,l);break;case 1:at||(pn(l,t),i=l.stateNode,typeof i.componentWillUnmount=="function"&&gh(l,t,i)),Mn(e,t,l);break;case 21:Mn(e,t,l);break;case 22:at=(i=at)||l.memoizedState!==null,Mn(e,t,l),at=i;break;default:Mn(e,t,l)}}function Ah(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{xi(e)}catch(l){He(t,t.return,l)}}}function Th(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{xi(e)}catch(l){He(t,t.return,l)}}function y1(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new Sh),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new Sh),t;default:throw Error(u(435,e.tag))}}function _r(e,t){var l=y1(e);t.forEach(function(i){if(!l.has(i)){l.add(i);var o=w1.bind(null,e,i);i.then(o,o)}})}function Rt(e,t){var l=t.deletions;if(l!==null)for(var i=0;i<l.length;i++){var o=l[i],c=e,g=t,S=g;e:for(;S!==null;){switch(S.tag){case 27:if(il(S.type)){Ke=S.stateNode,Mt=!1;break e}break;case 5:Ke=S.stateNode,Mt=!1;break e;case 3:case 4:Ke=S.stateNode.containerInfo,Mt=!0;break e}S=S.return}if(Ke===null)throw Error(u(160));kh(c,g,o),Ke=null,Mt=!1,c=o.alternate,c!==null&&(c.return=null),o.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)wh(t,e),t=t.sibling}var cn=null;function wh(e,t){var l=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Rt(t,e),Nt(e),i&4&&($n(3,e,e.return),aa(3,e),$n(5,e,e.return));break;case 1:Rt(t,e),Nt(e),i&512&&(at||l===null||pn(l,l.return)),i&64&&Dn&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(l=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=l===null?i:l.concat(i))));break;case 26:var o=cn;if(Rt(t,e),Nt(e),i&512&&(at||l===null||pn(l,l.return)),i&4){var c=l!==null?l.memoizedState:null;if(i=e.memoizedState,l===null)if(i===null)if(e.stateNode===null){e:{i=e.type,l=e.memoizedProps,o=o.ownerDocument||o;t:switch(i){case"title":c=o.getElementsByTagName("title")[0],(!c||c[Ri]||c[dt]||c.namespaceURI==="http://www.w3.org/2000/svg"||c.hasAttribute("itemprop"))&&(c=o.createElement(i),o.head.insertBefore(c,o.querySelector("head > title"))),gt(c,i,l),c[dt]=e,st(c),i=c;break e;case"link":var g=wp("link","href",o).get(i+(l.href||""));if(g){for(var S=0;S<g.length;S++)if(c=g[S],c.getAttribute("href")===(l.href==null||l.href===""?null:l.href)&&c.getAttribute("rel")===(l.rel==null?null:l.rel)&&c.getAttribute("title")===(l.title==null?null:l.title)&&c.getAttribute("crossorigin")===(l.crossOrigin==null?null:l.crossOrigin)){g.splice(S,1);break t}}c=o.createElement(i),gt(c,i,l),o.head.appendChild(c);break;case"meta":if(g=wp("meta","content",o).get(i+(l.content||""))){for(S=0;S<g.length;S++)if(c=g[S],c.getAttribute("content")===(l.content==null?null:""+l.content)&&c.getAttribute("name")===(l.name==null?null:l.name)&&c.getAttribute("property")===(l.property==null?null:l.property)&&c.getAttribute("http-equiv")===(l.httpEquiv==null?null:l.httpEquiv)&&c.getAttribute("charset")===(l.charSet==null?null:l.charSet)){g.splice(S,1);break t}}c=o.createElement(i),gt(c,i,l),o.head.appendChild(c);break;default:throw Error(u(468,i))}c[dt]=e,st(c),i=c}e.stateNode=i}else Cp(o,e.type,e.stateNode);else e.stateNode=Tp(o,i,e.memoizedProps);else c!==i?(c===null?l.stateNode!==null&&(l=l.stateNode,l.parentNode.removeChild(l)):c.count--,i===null?Cp(o,e.type,e.stateNode):Tp(o,i,e.memoizedProps)):i===null&&e.stateNode!==null&&Jo(e,e.memoizedProps,l.memoizedProps)}break;case 27:Rt(t,e),Nt(e),i&512&&(at||l===null||pn(l,l.return)),l!==null&&i&4&&Jo(e,e.memoizedProps,l.memoizedProps);break;case 5:if(Rt(t,e),Nt(e),i&512&&(at||l===null||pn(l,l.return)),e.flags&32){o=e.stateNode;try{Xl(o,"")}catch(ae){He(e,e.return,ae)}}i&4&&e.stateNode!=null&&(o=e.memoizedProps,Jo(e,o,l!==null?l.memoizedProps:o)),i&1024&&(Po=!0);break;case 6:if(Rt(t,e),Nt(e),i&4){if(e.stateNode===null)throw Error(u(162));i=e.memoizedProps,l=e.stateNode;try{l.nodeValue=i}catch(ae){He(e,e.return,ae)}}break;case 3:if(Qr=null,o=cn,cn=Gr(t.containerInfo),Rt(t,e),cn=o,Nt(e),i&4&&l!==null&&l.memoizedState.isDehydrated)try{xi(t.containerInfo)}catch(ae){He(e,e.return,ae)}Po&&(Po=!1,Ch(e));break;case 4:i=cn,cn=Gr(e.stateNode.containerInfo),Rt(t,e),Nt(e),cn=i;break;case 12:Rt(t,e),Nt(e);break;case 31:Rt(t,e),Nt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 13:Rt(t,e),Nt(e),e.child.flags&8192&&e.memoizedState!==null!=(l!==null&&l.memoizedState!==null)&&(Dr=kt()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 22:o=e.memoizedState!==null;var A=l!==null&&l.memoizedState!==null,M=Dn,q=at;if(Dn=M||o,at=q||A,Rt(t,e),at=q,Dn=M,Nt(e),i&8192)e:for(t=e.stateNode,t._visibility=o?t._visibility&-2:t._visibility|1,o&&(l===null||A||Dn||at||zl(e)),l=null,t=e;;){if(t.tag===5||t.tag===26){if(l===null){A=l=t;try{if(c=A.stateNode,o)g=c.style,typeof g.setProperty=="function"?g.setProperty("display","none","important"):g.display="none";else{S=A.stateNode;var Z=A.memoizedProps.style,N=Z!=null&&Z.hasOwnProperty("display")?Z.display:null;S.style.display=N==null||typeof N=="boolean"?"":(""+N).trim()}}catch(ae){He(A,A.return,ae)}}}else if(t.tag===6){if(l===null){A=t;try{A.stateNode.nodeValue=o?"":A.memoizedProps}catch(ae){He(A,A.return,ae)}}}else if(t.tag===18){if(l===null){A=t;try{var U=A.stateNode;o?gp(U,!0):gp(A.stateNode,!1)}catch(ae){He(A,A.return,ae)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;l===t&&(l=null),t=t.return}l===t&&(l=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(l=i.retryQueue,l!==null&&(i.retryQueue=null,_r(e,l))));break;case 19:Rt(t,e),Nt(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,_r(e,i)));break;case 30:break;case 21:break;default:Rt(t,e),Nt(e)}}function Nt(e){var t=e.flags;if(t&2){try{for(var l,i=e.return;i!==null;){if(vh(i)){l=i;break}i=i.return}if(l==null)throw Error(u(160));switch(l.tag){case 27:var o=l.stateNode,c=$o(e);zr(e,c,o);break;case 5:var g=l.stateNode;l.flags&32&&(Xl(g,""),l.flags&=-33);var S=$o(e);zr(e,S,g);break;case 3:case 4:var A=l.stateNode.containerInfo,M=$o(e);Wo(e,M,A);break;default:throw Error(u(161))}}catch(q){He(e,e.return,q)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function Ch(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;Ch(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Rn(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)xh(e,t.alternate,t),t=t.sibling}function zl(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:$n(4,t,t.return),zl(t);break;case 1:pn(t,t.return);var l=t.stateNode;typeof l.componentWillUnmount=="function"&&gh(t,t.return,l),zl(t);break;case 27:ma(t.stateNode);case 26:case 5:pn(t,t.return),zl(t);break;case 22:t.memoizedState===null&&zl(t);break;case 30:zl(t);break;default:zl(t)}e=e.sibling}}function Nn(e,t,l){for(l=l&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,o=e,c=t,g=c.flags;switch(c.tag){case 0:case 11:case 15:Nn(o,c,l),aa(4,c);break;case 1:if(Nn(o,c,l),i=c,o=i.stateNode,typeof o.componentDidMount=="function")try{o.componentDidMount()}catch(M){He(i,i.return,M)}if(i=c,o=i.updateQueue,o!==null){var S=i.stateNode;try{var A=o.shared.hiddenCallbacks;if(A!==null)for(o.shared.hiddenCallbacks=null,o=0;o<A.length;o++)id(A[o],S)}catch(M){He(i,i.return,M)}}l&&g&64&&mh(c),ra(c,c.return);break;case 27:bh(c);case 26:case 5:Nn(o,c,l),l&&i===null&&g&4&&yh(c),ra(c,c.return);break;case 12:Nn(o,c,l);break;case 31:Nn(o,c,l),l&&g&4&&Ah(o,c);break;case 13:Nn(o,c,l),l&&g&4&&Th(o,c);break;case 22:c.memoizedState===null&&Nn(o,c,l),ra(c,c.return);break;case 30:break;default:Nn(o,c,l)}t=t.sibling}}function ec(e,t){var l=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==l&&(e!=null&&e.refCount++,l!=null&&Zi(l))}function tc(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Zi(e))}function sn(e,t,l,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)zh(e,t,l,i),t=t.sibling}function zh(e,t,l,i){var o=t.flags;switch(t.tag){case 0:case 11:case 15:sn(e,t,l,i),o&2048&&aa(9,t);break;case 1:sn(e,t,l,i);break;case 3:sn(e,t,l,i),o&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Zi(e)));break;case 12:if(o&2048){sn(e,t,l,i),e=t.stateNode;try{var c=t.memoizedProps,g=c.id,S=c.onPostCommit;typeof S=="function"&&S(g,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(A){He(t,t.return,A)}}else sn(e,t,l,i);break;case 31:sn(e,t,l,i);break;case 13:sn(e,t,l,i);break;case 23:break;case 22:c=t.stateNode,g=t.alternate,t.memoizedState!==null?c._visibility&2?sn(e,t,l,i):ua(e,t):c._visibility&2?sn(e,t,l,i):(c._visibility|=2,si(e,t,l,i,(t.subtreeFlags&10256)!==0||!1)),o&2048&&ec(g,t);break;case 24:sn(e,t,l,i),o&2048&&tc(t.alternate,t);break;default:sn(e,t,l,i)}}function si(e,t,l,i,o){for(o=o&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var c=e,g=t,S=l,A=i,M=g.flags;switch(g.tag){case 0:case 11:case 15:si(c,g,S,A,o),aa(8,g);break;case 23:break;case 22:var q=g.stateNode;g.memoizedState!==null?q._visibility&2?si(c,g,S,A,o):ua(c,g):(q._visibility|=2,si(c,g,S,A,o)),o&&M&2048&&ec(g.alternate,g);break;case 24:si(c,g,S,A,o),o&&M&2048&&tc(g.alternate,g);break;default:si(c,g,S,A,o)}t=t.sibling}}function ua(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var l=e,i=t,o=i.flags;switch(i.tag){case 22:ua(l,i),o&2048&&ec(i.alternate,i);break;case 24:ua(l,i),o&2048&&tc(i.alternate,i);break;default:ua(l,i)}t=t.sibling}}var oa=8192;function fi(e,t,l){if(e.subtreeFlags&oa)for(e=e.child;e!==null;)_h(e,t,l),e=e.sibling}function _h(e,t,l){switch(e.tag){case 26:fi(e,t,l),e.flags&oa&&e.memoizedState!==null&&lv(l,cn,e.memoizedState,e.memoizedProps);break;case 5:fi(e,t,l);break;case 3:case 4:var i=cn;cn=Gr(e.stateNode.containerInfo),fi(e,t,l),cn=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=oa,oa=16777216,fi(e,t,l),oa=i):fi(e,t,l));break;default:fi(e,t,l)}}function Oh(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function ca(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];ft=i,Mh(i,e)}Oh(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Dh(e),e=e.sibling}function Dh(e){switch(e.tag){case 0:case 11:case 15:ca(e),e.flags&2048&&$n(9,e,e.return);break;case 3:ca(e);break;case 12:ca(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Or(e)):ca(e);break;default:ca(e)}}function Or(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];ft=i,Mh(i,e)}Oh(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:$n(8,t,t.return),Or(t);break;case 22:l=t.stateNode,l._visibility&2&&(l._visibility&=-3,Or(t));break;default:Or(t)}e=e.sibling}}function Mh(e,t){for(;ft!==null;){var l=ft;switch(l.tag){case 0:case 11:case 15:$n(8,l,t);break;case 23:case 22:if(l.memoizedState!==null&&l.memoizedState.cachePool!==null){var i=l.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:Zi(l.memoizedState.cache)}if(i=l.child,i!==null)i.return=l,ft=i;else e:for(l=e;ft!==null;){i=ft;var o=i.sibling,c=i.return;if(Eh(i),i===l){ft=null;break e}if(o!==null){o.return=c,ft=o;break e}ft=c}}}var v1={getCacheForType:function(e){var t=pt(nt),l=t.data.get(e);return l===void 0&&(l=e(),t.data.set(e,l)),l},cacheSignal:function(){return pt(nt).controller.signal}},b1=typeof WeakMap=="function"?WeakMap:Map,Le=0,Xe=null,we=null,_e=0,Be=0,Xt=null,Wn=!1,di=!1,nc=!1,Ln=0,We=0,Pn=0,_l=0,lc=0,Qt=0,hi=0,sa=null,Lt=null,ic=!1,Dr=0,Rh=0,Mr=1/0,Rr=null,el=null,ot=0,tl=null,pi=null,Un=0,ac=0,rc=null,Nh=null,fa=0,uc=null;function Zt(){return(Le&2)!==0&&_e!==0?_e&-_e:R.T!==null?hc():Ks()}function Lh(){if(Qt===0)if((_e&536870912)===0||De){var e=Ya;Ya<<=1,(Ya&3932160)===0&&(Ya=262144),Qt=e}else Qt=536870912;return e=Vt.current,e!==null&&(e.flags|=32),Qt}function Ut(e,t,l){(e===Xe&&(Be===2||Be===9)||e.cancelPendingCommit!==null)&&(mi(e,0),nl(e,_e,Qt,!1)),Mi(e,l),((Le&2)===0||e!==Xe)&&(e===Xe&&((Le&2)===0&&(_l|=l),We===4&&nl(e,_e,Qt,!1)),mn(e))}function Uh(e,t,l){if((Le&6)!==0)throw Error(u(327));var i=!l&&(t&127)===0&&(t&e.expiredLanes)===0||Di(e,t),o=i?E1(e,t):cc(e,t,!0),c=i;do{if(o===0){di&&!i&&nl(e,t,0,!1);break}else{if(l=e.current.alternate,c&&!S1(l)){o=cc(e,t,!1),c=!1;continue}if(o===2){if(c=t,e.errorRecoveryDisabledLanes&c)var g=0;else g=e.pendingLanes&-536870913,g=g!==0?g:g&536870912?536870912:0;if(g!==0){t=g;e:{var S=e;o=sa;var A=S.current.memoizedState.isDehydrated;if(A&&(mi(S,g).flags|=256),g=cc(S,g,!1),g!==2){if(nc&&!A){S.errorRecoveryDisabledLanes|=c,_l|=c,o=4;break e}c=Lt,Lt=o,c!==null&&(Lt===null?Lt=c:Lt.push.apply(Lt,c))}o=g}if(c=!1,o!==2)continue}}if(o===1){mi(e,0),nl(e,t,0,!0);break}e:{switch(i=e,c=o,c){case 0:case 1:throw Error(u(345));case 4:if((t&4194048)!==t)break;case 6:nl(i,t,Qt,!Wn);break e;case 2:Lt=null;break;case 3:case 5:break;default:throw Error(u(329))}if((t&62914560)===t&&(o=Dr+300-kt(),10<o)){if(nl(i,t,Qt,!Wn),Ga(i,0,!0)!==0)break e;Un=t,i.timeoutHandle=hp(jh.bind(null,i,l,Lt,Rr,ic,t,Qt,_l,hi,Wn,c,"Throttled",-0,0),o);break e}jh(i,l,Lt,Rr,ic,t,Qt,_l,hi,Wn,c,null,-0,0)}}break}while(!0);mn(e)}function jh(e,t,l,i,o,c,g,S,A,M,q,Z,N,U){if(e.timeoutHandle=-1,Z=t.subtreeFlags,Z&8192||(Z&16785408)===16785408){Z={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:xn},_h(t,c,Z);var ae=(c&62914560)===c?Dr-kt():(c&4194048)===c?Rh-kt():0;if(ae=iv(Z,ae),ae!==null){Un=c,e.cancelPendingCommit=ae(Qh.bind(null,e,t,c,l,i,o,g,S,A,q,Z,null,N,U)),nl(e,c,g,!M);return}}Qh(e,t,c,l,i,o,g,S,A)}function S1(e){for(var t=e;;){var l=t.tag;if((l===0||l===11||l===15)&&t.flags&16384&&(l=t.updateQueue,l!==null&&(l=l.stores,l!==null)))for(var i=0;i<l.length;i++){var o=l[i],c=o.getSnapshot;o=o.value;try{if(!qt(c(),o))return!1}catch{return!1}}if(l=t.child,t.subtreeFlags&16384&&l!==null)l.return=t,t=l;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function nl(e,t,l,i){t&=~lc,t&=~_l,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var o=t;0<o;){var c=31-Ge(o),g=1<<c;i[c]=-1,o&=~g}l!==0&&Zs(e,l,t)}function Nr(){return(Le&6)===0?(da(0),!1):!0}function oc(){if(we!==null){if(Be===0)var e=we.return;else e=we,Tn=Sl=null,Ao(e),ai=null,Fi=0,e=we;for(;e!==null;)ph(e.alternate,e),e=e.return;we=null}}function mi(e,t){var l=e.timeoutHandle;l!==-1&&(e.timeoutHandle=-1,q1(l)),l=e.cancelPendingCommit,l!==null&&(e.cancelPendingCommit=null,l()),Un=0,oc(),Xe=e,we=l=kn(e.current,null),_e=t,Be=0,Xt=null,Wn=!1,di=Di(e,t),nc=!1,hi=Qt=lc=_l=Pn=We=0,Lt=sa=null,ic=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var o=31-Ge(i),c=1<<o;t|=e[o],i&=~c}return Ln=t,tr(),l}function Bh(e,t){be=null,R.H=na,t===ii||t===cr?(t=ed(),Be=3):t===fo?(t=ed(),Be=4):Be=t===qo?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Xt=t,we===null&&(We=1,kr(e,Wt(t,e.current)))}function Hh(){var e=Vt.current;return e===null?!0:(_e&4194048)===_e?nn===null:(_e&62914560)===_e||(_e&536870912)!==0?e===nn:!1}function qh(){var e=R.H;return R.H=na,e===null?na:e}function Yh(){var e=R.A;return R.A=v1,e}function Lr(){We=4,Wn||(_e&4194048)!==_e&&Vt.current!==null||(di=!0),(Pn&134217727)===0&&(_l&134217727)===0||Xe===null||nl(Xe,_e,Qt,!1)}function cc(e,t,l){var i=Le;Le|=2;var o=qh(),c=Yh();(Xe!==e||_e!==t)&&(Rr=null,mi(e,t)),t=!1;var g=We;e:do try{if(Be!==0&&we!==null){var S=we,A=Xt;switch(Be){case 8:oc(),g=6;break e;case 3:case 2:case 9:case 6:Vt.current===null&&(t=!0);var M=Be;if(Be=0,Xt=null,gi(e,S,A,M),l&&di){g=0;break e}break;default:M=Be,Be=0,Xt=null,gi(e,S,A,M)}}x1(),g=We;break}catch(q){Bh(e,q)}while(!0);return t&&e.shellSuspendCounter++,Tn=Sl=null,Le=i,R.H=o,R.A=c,we===null&&(Xe=null,_e=0,tr()),g}function x1(){for(;we!==null;)Vh(we)}function E1(e,t){var l=Le;Le|=2;var i=qh(),o=Yh();Xe!==e||_e!==t?(Rr=null,Mr=kt()+500,mi(e,t)):di=Di(e,t);e:do try{if(Be!==0&&we!==null){t=we;var c=Xt;t:switch(Be){case 1:Be=0,Xt=null,gi(e,t,c,1);break;case 2:case 9:if(Wf(c)){Be=0,Xt=null,Gh(t);break}t=function(){Be!==2&&Be!==9||Xe!==e||(Be=7),mn(e)},c.then(t,t);break e;case 3:Be=7;break e;case 4:Be=5;break e;case 7:Wf(c)?(Be=0,Xt=null,Gh(t)):(Be=0,Xt=null,gi(e,t,c,7));break;case 5:var g=null;switch(we.tag){case 26:g=we.memoizedState;case 5:case 27:var S=we;if(g?zp(g):S.stateNode.complete){Be=0,Xt=null;var A=S.sibling;if(A!==null)we=A;else{var M=S.return;M!==null?(we=M,Ur(M)):we=null}break t}}Be=0,Xt=null,gi(e,t,c,5);break;case 6:Be=0,Xt=null,gi(e,t,c,6);break;case 8:oc(),We=6;break e;default:throw Error(u(462))}}k1();break}catch(q){Bh(e,q)}while(!0);return Tn=Sl=null,R.H=i,R.A=o,Le=l,we!==null?0:(Xe=null,_e=0,tr(),We)}function k1(){for(;we!==null&&!xu();)Vh(we)}function Vh(e){var t=dh(e.alternate,e,Ln);e.memoizedProps=e.pendingProps,t===null?Ur(e):we=t}function Gh(e){var t=e,l=t.alternate;switch(t.tag){case 15:case 0:t=rh(l,t,t.pendingProps,t.type,void 0,_e);break;case 11:t=rh(l,t,t.pendingProps,t.type.render,t.ref,_e);break;case 5:Ao(t);default:ph(l,t),t=we=Yf(t,Ln),t=dh(l,t,Ln)}e.memoizedProps=e.pendingProps,t===null?Ur(e):we=t}function gi(e,t,l,i){Tn=Sl=null,Ao(t),ai=null,Fi=0;var o=t.return;try{if(f1(e,o,t,l,_e)){We=1,kr(e,Wt(l,e.current)),we=null;return}}catch(c){if(o!==null)throw we=o,c;We=1,kr(e,Wt(l,e.current)),we=null;return}t.flags&32768?(De||i===1?e=!0:di||(_e&536870912)!==0?e=!1:(Wn=e=!0,(i===2||i===9||i===3||i===6)&&(i=Vt.current,i!==null&&i.tag===13&&(i.flags|=16384))),Xh(t,e)):Ur(t)}function Ur(e){var t=e;do{if((t.flags&32768)!==0){Xh(t,Wn);return}e=t.return;var l=p1(t.alternate,t,Ln);if(l!==null){we=l;return}if(t=t.sibling,t!==null){we=t;return}we=t=e}while(t!==null);We===0&&(We=5)}function Xh(e,t){do{var l=m1(e.alternate,e);if(l!==null){l.flags&=32767,we=l;return}if(l=e.return,l!==null&&(l.flags|=32768,l.subtreeFlags=0,l.deletions=null),!t&&(e=e.sibling,e!==null)){we=e;return}we=e=l}while(e!==null);We=6,we=null}function Qh(e,t,l,i,o,c,g,S,A){e.cancelPendingCommit=null;do jr();while(ot!==0);if((Le&6)!==0)throw Error(u(327));if(t!==null){if(t===e.current)throw Error(u(177));if(c=t.lanes|t.childLanes,c|=Ju,ny(e,l,c,g,S,A),e===Xe&&(we=Xe=null,_e=0),pi=t,tl=e,Un=l,ac=c,rc=o,Nh=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,C1(ge,function(){return Jh(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=R.T,R.T=null,o=I.p,I.p=2,g=Le,Le|=4;try{g1(e,t,l)}finally{Le=g,I.p=o,R.T=i}}ot=1,Zh(),Ih(),Fh()}}function Zh(){if(ot===1){ot=0;var e=tl,t=pi,l=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||l){l=R.T,R.T=null;var i=I.p;I.p=2;var o=Le;Le|=4;try{wh(t,e);var c=xc,g=Mf(e.containerInfo),S=c.focusedElem,A=c.selectionRange;if(g!==S&&S&&S.ownerDocument&&Df(S.ownerDocument.documentElement,S)){if(A!==null&&Qu(S)){var M=A.start,q=A.end;if(q===void 0&&(q=M),"selectionStart"in S)S.selectionStart=M,S.selectionEnd=Math.min(q,S.value.length);else{var Z=S.ownerDocument||document,N=Z&&Z.defaultView||window;if(N.getSelection){var U=N.getSelection(),ae=S.textContent.length,me=Math.min(A.start,ae),Ve=A.end===void 0?me:Math.min(A.end,ae);!U.extend&&me>Ve&&(g=Ve,Ve=me,me=g);var z=Of(S,me),w=Of(S,Ve);if(z&&w&&(U.rangeCount!==1||U.anchorNode!==z.node||U.anchorOffset!==z.offset||U.focusNode!==w.node||U.focusOffset!==w.offset)){var D=Z.createRange();D.setStart(z.node,z.offset),U.removeAllRanges(),me>Ve?(U.addRange(D),U.extend(w.node,w.offset)):(D.setEnd(w.node,w.offset),U.addRange(D))}}}}for(Z=[],U=S;U=U.parentNode;)U.nodeType===1&&Z.push({element:U,left:U.scrollLeft,top:U.scrollTop});for(typeof S.focus=="function"&&S.focus(),S=0;S<Z.length;S++){var G=Z[S];G.element.scrollLeft=G.left,G.element.scrollTop=G.top}}Kr=!!Sc,xc=Sc=null}finally{Le=o,I.p=i,R.T=l}}e.current=t,ot=2}}function Ih(){if(ot===2){ot=0;var e=tl,t=pi,l=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||l){l=R.T,R.T=null;var i=I.p;I.p=2;var o=Le;Le|=4;try{xh(e,t.alternate,t)}finally{Le=o,I.p=i,R.T=l}}ot=3}}function Fh(){if(ot===4||ot===3){ot=0,Eu();var e=tl,t=pi,l=Un,i=Nh;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?ot=5:(ot=0,pi=tl=null,Kh(e,e.pendingLanes));var o=e.pendingLanes;if(o===0&&(el=null),wu(l),t=t.stateNode,ut&&typeof ut.onCommitFiberRoot=="function")try{ut.onCommitFiberRoot(At,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=R.T,o=I.p,I.p=2,R.T=null;try{for(var c=e.onRecoverableError,g=0;g<i.length;g++){var S=i[g];c(S.value,{componentStack:S.stack})}}finally{R.T=t,I.p=o}}(Un&3)!==0&&jr(),mn(e),o=e.pendingLanes,(l&261930)!==0&&(o&42)!==0?e===uc?fa++:(fa=0,uc=e):fa=0,da(0)}}function Kh(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Zi(t)))}function jr(){return Zh(),Ih(),Fh(),Jh()}function Jh(){if(ot!==5)return!1;var e=tl,t=ac;ac=0;var l=wu(Un),i=R.T,o=I.p;try{I.p=32>l?32:l,R.T=null,l=rc,rc=null;var c=tl,g=Un;if(ot=0,pi=tl=null,Un=0,(Le&6)!==0)throw Error(u(331));var S=Le;if(Le|=4,Dh(c.current),zh(c,c.current,g,l),Le=S,da(0,!1),ut&&typeof ut.onPostCommitFiberRoot=="function")try{ut.onPostCommitFiberRoot(At,c)}catch{}return!0}finally{I.p=o,R.T=i,Kh(e,t)}}function $h(e,t,l){t=Wt(l,t),t=Ho(e.stateNode,t,2),e=Fn(e,t,2),e!==null&&(Mi(e,2),mn(e))}function He(e,t,l){if(e.tag===3)$h(e,e,l);else for(;t!==null;){if(t.tag===3){$h(t,e,l);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(el===null||!el.has(i))){e=Wt(l,e),l=Wd(2),i=Fn(t,l,2),i!==null&&(Pd(l,i,t,e),Mi(i,2),mn(i));break}}t=t.return}}function sc(e,t,l){var i=e.pingCache;if(i===null){i=e.pingCache=new b1;var o=new Set;i.set(t,o)}else o=i.get(t),o===void 0&&(o=new Set,i.set(t,o));o.has(l)||(nc=!0,o.add(l),e=A1.bind(null,e,t,l),t.then(e,e))}function A1(e,t,l){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&l,e.warmLanes&=~l,Xe===e&&(_e&l)===l&&(We===4||We===3&&(_e&62914560)===_e&&300>kt()-Dr?(Le&2)===0&&mi(e,0):lc|=l,hi===_e&&(hi=0)),mn(e)}function Wh(e,t){t===0&&(t=Qs()),e=yl(e,t),e!==null&&(Mi(e,t),mn(e))}function T1(e){var t=e.memoizedState,l=0;t!==null&&(l=t.retryLane),Wh(e,l)}function w1(e,t){var l=0;switch(e.tag){case 31:case 13:var i=e.stateNode,o=e.memoizedState;o!==null&&(l=o.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(u(314))}i!==null&&i.delete(t),Wh(e,l)}function C1(e,t){return jl(e,t)}var Br=null,yi=null,fc=!1,Hr=!1,dc=!1,ll=0;function mn(e){e!==yi&&e.next===null&&(yi===null?Br=yi=e:yi=yi.next=e),Hr=!0,fc||(fc=!0,_1())}function da(e,t){if(!dc&&Hr){dc=!0;do for(var l=!1,i=Br;i!==null;){if(e!==0){var o=i.pendingLanes;if(o===0)var c=0;else{var g=i.suspendedLanes,S=i.pingedLanes;c=(1<<31-Ge(42|e)+1)-1,c&=o&~(g&~S),c=c&201326741?c&201326741|1:c?c|2:0}c!==0&&(l=!0,np(i,c))}else c=_e,c=Ga(i,i===Xe?c:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(c&3)===0||Di(i,c)||(l=!0,np(i,c));i=i.next}while(l);dc=!1}}function z1(){Ph()}function Ph(){Hr=fc=!1;var e=0;ll!==0&&H1()&&(e=ll);for(var t=kt(),l=null,i=Br;i!==null;){var o=i.next,c=ep(i,t);c===0?(i.next=null,l===null?Br=o:l.next=o,o===null&&(yi=l)):(l=i,(e!==0||(c&3)!==0)&&(Hr=!0)),i=o}ot!==0&&ot!==5||da(e),ll!==0&&(ll=0)}function ep(e,t){for(var l=e.suspendedLanes,i=e.pingedLanes,o=e.expirationTimes,c=e.pendingLanes&-62914561;0<c;){var g=31-Ge(c),S=1<<g,A=o[g];A===-1?((S&l)===0||(S&i)!==0)&&(o[g]=ty(S,t)):A<=t&&(e.expiredLanes|=S),c&=~S}if(t=Xe,l=_e,l=Ga(e,e===t?l:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,l===0||e===t&&(Be===2||Be===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&Oi(i),e.callbackNode=null,e.callbackPriority=0;if((l&3)===0||Di(e,l)){if(t=l&-l,t===e.callbackPriority)return t;switch(i!==null&&Oi(i),wu(l)){case 2:case 8:l=P;break;case 32:l=ge;break;case 268435456:l=Ue;break;default:l=ge}return i=tp.bind(null,e),l=jl(l,i),e.callbackPriority=t,e.callbackNode=l,t}return i!==null&&i!==null&&Oi(i),e.callbackPriority=2,e.callbackNode=null,2}function tp(e,t){if(ot!==0&&ot!==5)return e.callbackNode=null,e.callbackPriority=0,null;var l=e.callbackNode;if(jr()&&e.callbackNode!==l)return null;var i=_e;return i=Ga(e,e===Xe?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(Uh(e,i,t),ep(e,kt()),e.callbackNode!=null&&e.callbackNode===l?tp.bind(null,e):null)}function np(e,t){if(jr())return null;Uh(e,t,!0)}function _1(){Y1(function(){(Le&6)!==0?jl(V,z1):Ph()})}function hc(){if(ll===0){var e=ni;e===0&&(e=qa,qa<<=1,(qa&261888)===0&&(qa=256)),ll=e}return ll}function lp(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Ia(""+e)}function ip(e,t){var l=t.ownerDocument.createElement("input");return l.name=t.name,l.value=t.value,e.id&&l.setAttribute("form",e.id),t.parentNode.insertBefore(l,t),e=new FormData(e),l.parentNode.removeChild(l),e}function O1(e,t,l,i,o){if(t==="submit"&&l&&l.stateNode===o){var c=lp((o[Ot]||null).action),g=i.submitter;g&&(t=(t=g[Ot]||null)?lp(t.formAction):g.getAttribute("formAction"),t!==null&&(c=t,g=null));var S=new $a("action","action",null,i,o);e.push({event:S,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(ll!==0){var A=g?ip(o,g):new FormData(o);Ro(l,{pending:!0,data:A,method:o.method,action:c},null,A)}}else typeof c=="function"&&(S.preventDefault(),A=g?ip(o,g):new FormData(o),Ro(l,{pending:!0,data:A,method:o.method,action:c},c,A))},currentTarget:o}]})}}for(var pc=0;pc<Ku.length;pc++){var mc=Ku[pc],D1=mc.toLowerCase(),M1=mc[0].toUpperCase()+mc.slice(1);on(D1,"on"+M1)}on(Lf,"onAnimationEnd"),on(Uf,"onAnimationIteration"),on(jf,"onAnimationStart"),on("dblclick","onDoubleClick"),on("focusin","onFocus"),on("focusout","onBlur"),on(Fy,"onTransitionRun"),on(Ky,"onTransitionStart"),on(Jy,"onTransitionCancel"),on(Bf,"onTransitionEnd"),Vl("onMouseEnter",["mouseout","mouseover"]),Vl("onMouseLeave",["mouseout","mouseover"]),Vl("onPointerEnter",["pointerout","pointerover"]),Vl("onPointerLeave",["pointerout","pointerover"]),hl("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),hl("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),hl("onBeforeInput",["compositionend","keypress","textInput","paste"]),hl("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),hl("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),hl("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var ha="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),R1=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(ha));function ap(e,t){t=(t&4)!==0;for(var l=0;l<e.length;l++){var i=e[l],o=i.event;i=i.listeners;e:{var c=void 0;if(t)for(var g=i.length-1;0<=g;g--){var S=i[g],A=S.instance,M=S.currentTarget;if(S=S.listener,A!==c&&o.isPropagationStopped())break e;c=S,o.currentTarget=M;try{c(o)}catch(q){er(q)}o.currentTarget=null,c=A}else for(g=0;g<i.length;g++){if(S=i[g],A=S.instance,M=S.currentTarget,S=S.listener,A!==c&&o.isPropagationStopped())break e;c=S,o.currentTarget=M;try{c(o)}catch(q){er(q)}o.currentTarget=null,c=A}}}}function Ce(e,t){var l=t[Cu];l===void 0&&(l=t[Cu]=new Set);var i=e+"__bubble";l.has(i)||(rp(t,e,2,!1),l.add(i))}function gc(e,t,l){var i=0;t&&(i|=4),rp(l,e,i,t)}var qr="_reactListening"+Math.random().toString(36).slice(2);function yc(e){if(!e[qr]){e[qr]=!0,Ws.forEach(function(l){l!=="selectionchange"&&(R1.has(l)||gc(l,!1,e),gc(l,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[qr]||(t[qr]=!0,gc("selectionchange",!1,t))}}function rp(e,t,l,i){switch(Lp(t)){case 2:var o=uv;break;case 8:o=ov;break;default:o=Mc}l=o.bind(null,t,l,e),o=void 0,!Uu||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),i?o!==void 0?e.addEventListener(t,l,{capture:!0,passive:o}):e.addEventListener(t,l,!0):o!==void 0?e.addEventListener(t,l,{passive:o}):e.addEventListener(t,l,!1)}function vc(e,t,l,i,o){var c=i;if((t&1)===0&&(t&2)===0&&i!==null)e:for(;;){if(i===null)return;var g=i.tag;if(g===3||g===4){var S=i.stateNode.containerInfo;if(S===o)break;if(g===4)for(g=i.return;g!==null;){var A=g.tag;if((A===3||A===4)&&g.stateNode.containerInfo===o)return;g=g.return}for(;S!==null;){if(g=Hl(S),g===null)return;if(A=g.tag,A===5||A===6||A===26||A===27){i=c=g;continue e}S=S.parentNode}}i=i.return}ff(function(){var M=c,q=Nu(l),Z=[];e:{var N=Hf.get(e);if(N!==void 0){var U=$a,ae=e;switch(e){case"keypress":if(Ka(l)===0)break e;case"keydown":case"keyup":U=wy;break;case"focusin":ae="focus",U=qu;break;case"focusout":ae="blur",U=qu;break;case"beforeblur":case"afterblur":U=qu;break;case"click":if(l.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":U=pf;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":U=py;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":U=_y;break;case Lf:case Uf:case jf:U=yy;break;case Bf:U=Dy;break;case"scroll":case"scrollend":U=dy;break;case"wheel":U=Ry;break;case"copy":case"cut":case"paste":U=by;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":U=gf;break;case"toggle":case"beforetoggle":U=Ly}var me=(t&4)!==0,Ve=!me&&(e==="scroll"||e==="scrollend"),z=me?N!==null?N+"Capture":null:N;me=[];for(var w=M,D;w!==null;){var G=w;if(D=G.stateNode,G=G.tag,G!==5&&G!==26&&G!==27||D===null||z===null||(G=Li(w,z),G!=null&&me.push(pa(w,G,D))),Ve)break;w=w.return}0<me.length&&(N=new U(N,ae,null,l,q),Z.push({event:N,listeners:me}))}}if((t&7)===0){e:{if(N=e==="mouseover"||e==="pointerover",U=e==="mouseout"||e==="pointerout",N&&l!==Ru&&(ae=l.relatedTarget||l.fromElement)&&(Hl(ae)||ae[Bl]))break e;if((U||N)&&(N=q.window===q?q:(N=q.ownerDocument)?N.defaultView||N.parentWindow:window,U?(ae=l.relatedTarget||l.toElement,U=M,ae=ae?Hl(ae):null,ae!==null&&(Ve=f(ae),me=ae.tag,ae!==Ve||me!==5&&me!==27&&me!==6)&&(ae=null)):(U=null,ae=M),U!==ae)){if(me=pf,G="onMouseLeave",z="onMouseEnter",w="mouse",(e==="pointerout"||e==="pointerover")&&(me=gf,G="onPointerLeave",z="onPointerEnter",w="pointer"),Ve=U==null?N:Ni(U),D=ae==null?N:Ni(ae),N=new me(G,w+"leave",U,l,q),N.target=Ve,N.relatedTarget=D,G=null,Hl(q)===M&&(me=new me(z,w+"enter",ae,l,q),me.target=D,me.relatedTarget=Ve,G=me),Ve=G,U&&ae)t:{for(me=N1,z=U,w=ae,D=0,G=z;G;G=me(G))D++;G=0;for(var fe=w;fe;fe=me(fe))G++;for(;0<D-G;)z=me(z),D--;for(;0<G-D;)w=me(w),G--;for(;D--;){if(z===w||w!==null&&z===w.alternate){me=z;break t}z=me(z),w=me(w)}me=null}else me=null;U!==null&&up(Z,N,U,me,!1),ae!==null&&Ve!==null&&up(Z,Ve,ae,me,!0)}}e:{if(N=M?Ni(M):window,U=N.nodeName&&N.nodeName.toLowerCase(),U==="select"||U==="input"&&N.type==="file")var Re=Af;else if(Ef(N))if(Tf)Re=Qy;else{Re=Gy;var se=Vy}else U=N.nodeName,!U||U.toLowerCase()!=="input"||N.type!=="checkbox"&&N.type!=="radio"?M&&Mu(M.elementType)&&(Re=Af):Re=Xy;if(Re&&(Re=Re(e,M))){kf(Z,Re,l,q);break e}se&&se(e,N,M),e==="focusout"&&M&&N.type==="number"&&M.memoizedProps.value!=null&&Du(N,"number",N.value)}switch(se=M?Ni(M):window,e){case"focusin":(Ef(se)||se.contentEditable==="true")&&(Fl=se,Zu=M,Gi=null);break;case"focusout":Gi=Zu=Fl=null;break;case"mousedown":Iu=!0;break;case"contextmenu":case"mouseup":case"dragend":Iu=!1,Rf(Z,l,q);break;case"selectionchange":if(Iy)break;case"keydown":case"keyup":Rf(Z,l,q)}var Se;if(Vu)e:{switch(e){case"compositionstart":var Oe="onCompositionStart";break e;case"compositionend":Oe="onCompositionEnd";break e;case"compositionupdate":Oe="onCompositionUpdate";break e}Oe=void 0}else Il?Sf(e,l)&&(Oe="onCompositionEnd"):e==="keydown"&&l.keyCode===229&&(Oe="onCompositionStart");Oe&&(yf&&l.locale!=="ko"&&(Il||Oe!=="onCompositionStart"?Oe==="onCompositionEnd"&&Il&&(Se=df()):(Yn=q,ju="value"in Yn?Yn.value:Yn.textContent,Il=!0)),se=Yr(M,Oe),0<se.length&&(Oe=new mf(Oe,e,null,l,q),Z.push({event:Oe,listeners:se}),Se?Oe.data=Se:(Se=xf(l),Se!==null&&(Oe.data=Se)))),(Se=jy?By(e,l):Hy(e,l))&&(Oe=Yr(M,"onBeforeInput"),0<Oe.length&&(se=new mf("onBeforeInput","beforeinput",null,l,q),Z.push({event:se,listeners:Oe}),se.data=Se)),O1(Z,e,M,l,q)}ap(Z,t)})}function pa(e,t,l){return{instance:e,listener:t,currentTarget:l}}function Yr(e,t){for(var l=t+"Capture",i=[];e!==null;){var o=e,c=o.stateNode;if(o=o.tag,o!==5&&o!==26&&o!==27||c===null||(o=Li(e,l),o!=null&&i.unshift(pa(e,o,c)),o=Li(e,t),o!=null&&i.push(pa(e,o,c))),e.tag===3)return i;e=e.return}return[]}function N1(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function up(e,t,l,i,o){for(var c=t._reactName,g=[];l!==null&&l!==i;){var S=l,A=S.alternate,M=S.stateNode;if(S=S.tag,A!==null&&A===i)break;S!==5&&S!==26&&S!==27||M===null||(A=M,o?(M=Li(l,c),M!=null&&g.unshift(pa(l,M,A))):o||(M=Li(l,c),M!=null&&g.push(pa(l,M,A)))),l=l.return}g.length!==0&&e.push({event:t,listeners:g})}var L1=/\\r\\n?/g,U1=/\\u0000|\\uFFFD/g;function op(e){return(typeof e=="string"?e:""+e).replace(L1,`\n`).replace(U1,"")}function cp(e,t){return t=op(t),op(e)===t}function Ye(e,t,l,i,o,c){switch(l){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Xl(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Xl(e,""+i);break;case"className":Qa(e,"class",i);break;case"tabIndex":Qa(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Qa(e,l,i);break;case"style":cf(e,i,c);break;case"data":if(t!=="object"){Qa(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||l!=="href")){e.removeAttribute(l);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Ia(""+i),e.setAttribute(l,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(l,"javascript:throw new Error(\'A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\\\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().\')");break}else typeof c=="function"&&(l==="formAction"?(t!=="input"&&Ye(e,t,"name",o.name,o,null),Ye(e,t,"formEncType",o.formEncType,o,null),Ye(e,t,"formMethod",o.formMethod,o,null),Ye(e,t,"formTarget",o.formTarget,o,null)):(Ye(e,t,"encType",o.encType,o,null),Ye(e,t,"method",o.method,o,null),Ye(e,t,"target",o.target,o,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Ia(""+i),e.setAttribute(l,i);break;case"onClick":i!=null&&(e.onclick=xn);break;case"onScroll":i!=null&&Ce("scroll",e);break;case"onScrollEnd":i!=null&&Ce("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}l=Ia(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",l);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""+i):e.removeAttribute(l);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""):e.removeAttribute(l);break;case"capture":case"download":i===!0?e.setAttribute(l,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,i):e.removeAttribute(l);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(l,i):e.removeAttribute(l);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(l):e.setAttribute(l,i);break;case"popover":Ce("beforetoggle",e),Ce("toggle",e),Xa(e,"popover",i);break;case"xlinkActuate":Sn(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":Sn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":Sn(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":Sn(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":Sn(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":Sn(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":Sn(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":Sn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":Sn(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Xa(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<l.length)||l[0]!=="o"&&l[0]!=="O"||l[1]!=="n"&&l[1]!=="N")&&(l=sy.get(l)||l,Xa(e,l,i))}}function bc(e,t,l,i,o,c){switch(l){case"style":cf(e,i,c);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"children":typeof i=="string"?Xl(e,i):(typeof i=="number"||typeof i=="bigint")&&Xl(e,""+i);break;case"onScroll":i!=null&&Ce("scroll",e);break;case"onScrollEnd":i!=null&&Ce("scrollend",e);break;case"onClick":i!=null&&(e.onclick=xn);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!Ps.hasOwnProperty(l))e:{if(l[0]==="o"&&l[1]==="n"&&(o=l.endsWith("Capture"),t=l.slice(2,o?l.length-7:void 0),c=e[Ot]||null,c=c!=null?c[l]:null,typeof c=="function"&&e.removeEventListener(t,c,o),typeof i=="function")){typeof c!="function"&&c!==null&&(l in e?e[l]=null:e.hasAttribute(l)&&e.removeAttribute(l)),e.addEventListener(t,i,o);break e}l in e?e[l]=i:i===!0?e.setAttribute(l,""):Xa(e,l,i)}}}function gt(e,t,l){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":Ce("error",e),Ce("load",e);var i=!1,o=!1,c;for(c in l)if(l.hasOwnProperty(c)){var g=l[c];if(g!=null)switch(c){case"src":i=!0;break;case"srcSet":o=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Ye(e,t,c,g,l,null)}}o&&Ye(e,t,"srcSet",l.srcSet,l,null),i&&Ye(e,t,"src",l.src,l,null);return;case"input":Ce("invalid",e);var S=c=g=o=null,A=null,M=null;for(i in l)if(l.hasOwnProperty(i)){var q=l[i];if(q!=null)switch(i){case"name":o=q;break;case"type":g=q;break;case"checked":A=q;break;case"defaultChecked":M=q;break;case"value":c=q;break;case"defaultValue":S=q;break;case"children":case"dangerouslySetInnerHTML":if(q!=null)throw Error(u(137,t));break;default:Ye(e,t,i,q,l,null)}}af(e,c,S,A,M,g,o,!1);return;case"select":Ce("invalid",e),i=g=c=null;for(o in l)if(l.hasOwnProperty(o)&&(S=l[o],S!=null))switch(o){case"value":c=S;break;case"defaultValue":g=S;break;case"multiple":i=S;default:Ye(e,t,o,S,l,null)}t=c,l=g,e.multiple=!!i,t!=null?Gl(e,!!i,t,!1):l!=null&&Gl(e,!!i,l,!0);return;case"textarea":Ce("invalid",e),c=o=i=null;for(g in l)if(l.hasOwnProperty(g)&&(S=l[g],S!=null))switch(g){case"value":i=S;break;case"defaultValue":o=S;break;case"children":c=S;break;case"dangerouslySetInnerHTML":if(S!=null)throw Error(u(91));break;default:Ye(e,t,g,S,l,null)}uf(e,i,o,c);return;case"option":for(A in l)if(l.hasOwnProperty(A)&&(i=l[A],i!=null))switch(A){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:Ye(e,t,A,i,l,null)}return;case"dialog":Ce("beforetoggle",e),Ce("toggle",e),Ce("cancel",e),Ce("close",e);break;case"iframe":case"object":Ce("load",e);break;case"video":case"audio":for(i=0;i<ha.length;i++)Ce(ha[i],e);break;case"image":Ce("error",e),Ce("load",e);break;case"details":Ce("toggle",e);break;case"embed":case"source":case"link":Ce("error",e),Ce("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(M in l)if(l.hasOwnProperty(M)&&(i=l[M],i!=null))switch(M){case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Ye(e,t,M,i,l,null)}return;default:if(Mu(t)){for(q in l)l.hasOwnProperty(q)&&(i=l[q],i!==void 0&&bc(e,t,q,i,l,void 0));return}}for(S in l)l.hasOwnProperty(S)&&(i=l[S],i!=null&&Ye(e,t,S,i,l,null))}function j1(e,t,l,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var o=null,c=null,g=null,S=null,A=null,M=null,q=null;for(U in l){var Z=l[U];if(l.hasOwnProperty(U)&&Z!=null)switch(U){case"checked":break;case"value":break;case"defaultValue":A=Z;default:i.hasOwnProperty(U)||Ye(e,t,U,null,i,Z)}}for(var N in i){var U=i[N];if(Z=l[N],i.hasOwnProperty(N)&&(U!=null||Z!=null))switch(N){case"type":c=U;break;case"name":o=U;break;case"checked":M=U;break;case"defaultChecked":q=U;break;case"value":g=U;break;case"defaultValue":S=U;break;case"children":case"dangerouslySetInnerHTML":if(U!=null)throw Error(u(137,t));break;default:U!==Z&&Ye(e,t,N,U,i,Z)}}Ou(e,g,S,A,M,q,c,o);return;case"select":U=g=S=N=null;for(c in l)if(A=l[c],l.hasOwnProperty(c)&&A!=null)switch(c){case"value":break;case"multiple":U=A;default:i.hasOwnProperty(c)||Ye(e,t,c,null,i,A)}for(o in i)if(c=i[o],A=l[o],i.hasOwnProperty(o)&&(c!=null||A!=null))switch(o){case"value":N=c;break;case"defaultValue":S=c;break;case"multiple":g=c;default:c!==A&&Ye(e,t,o,c,i,A)}t=S,l=g,i=U,N!=null?Gl(e,!!l,N,!1):!!i!=!!l&&(t!=null?Gl(e,!!l,t,!0):Gl(e,!!l,l?[]:"",!1));return;case"textarea":U=N=null;for(S in l)if(o=l[S],l.hasOwnProperty(S)&&o!=null&&!i.hasOwnProperty(S))switch(S){case"value":break;case"children":break;default:Ye(e,t,S,null,i,o)}for(g in i)if(o=i[g],c=l[g],i.hasOwnProperty(g)&&(o!=null||c!=null))switch(g){case"value":N=o;break;case"defaultValue":U=o;break;case"children":break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(u(91));break;default:o!==c&&Ye(e,t,g,o,i,c)}rf(e,N,U);return;case"option":for(var ae in l)if(N=l[ae],l.hasOwnProperty(ae)&&N!=null&&!i.hasOwnProperty(ae))switch(ae){case"selected":e.selected=!1;break;default:Ye(e,t,ae,null,i,N)}for(A in i)if(N=i[A],U=l[A],i.hasOwnProperty(A)&&N!==U&&(N!=null||U!=null))switch(A){case"selected":e.selected=N&&typeof N!="function"&&typeof N!="symbol";break;default:Ye(e,t,A,N,i,U)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var me in l)N=l[me],l.hasOwnProperty(me)&&N!=null&&!i.hasOwnProperty(me)&&Ye(e,t,me,null,i,N);for(M in i)if(N=i[M],U=l[M],i.hasOwnProperty(M)&&N!==U&&(N!=null||U!=null))switch(M){case"children":case"dangerouslySetInnerHTML":if(N!=null)throw Error(u(137,t));break;default:Ye(e,t,M,N,i,U)}return;default:if(Mu(t)){for(var Ve in l)N=l[Ve],l.hasOwnProperty(Ve)&&N!==void 0&&!i.hasOwnProperty(Ve)&&bc(e,t,Ve,void 0,i,N);for(q in i)N=i[q],U=l[q],!i.hasOwnProperty(q)||N===U||N===void 0&&U===void 0||bc(e,t,q,N,i,U);return}}for(var z in l)N=l[z],l.hasOwnProperty(z)&&N!=null&&!i.hasOwnProperty(z)&&Ye(e,t,z,null,i,N);for(Z in i)N=i[Z],U=l[Z],!i.hasOwnProperty(Z)||N===U||N==null&&U==null||Ye(e,t,Z,N,i,U)}function sp(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function B1(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,l=performance.getEntriesByType("resource"),i=0;i<l.length;i++){var o=l[i],c=o.transferSize,g=o.initiatorType,S=o.duration;if(c&&S&&sp(g)){for(g=0,S=o.responseEnd,i+=1;i<l.length;i++){var A=l[i],M=A.startTime;if(M>S)break;var q=A.transferSize,Z=A.initiatorType;q&&sp(Z)&&(A=A.responseEnd,g+=q*(A<S?1:(S-M)/(A-M)))}if(--i,t+=8*(c+g)/(o.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var Sc=null,xc=null;function Vr(e){return e.nodeType===9?e:e.ownerDocument}function fp(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function dp(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function Ec(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var kc=null;function H1(){var e=window.event;return e&&e.type==="popstate"?e===kc?!1:(kc=e,!0):(kc=null,!1)}var hp=typeof setTimeout=="function"?setTimeout:void 0,q1=typeof clearTimeout=="function"?clearTimeout:void 0,pp=typeof Promise=="function"?Promise:void 0,Y1=typeof queueMicrotask=="function"?queueMicrotask:typeof pp<"u"?function(e){return pp.resolve(null).then(e).catch(V1)}:hp;function V1(e){setTimeout(function(){throw e})}function il(e){return e==="head"}function mp(e,t){var l=t,i=0;do{var o=l.nextSibling;if(e.removeChild(l),o&&o.nodeType===8)if(l=o.data,l==="/$"||l==="/&"){if(i===0){e.removeChild(o),xi(t);return}i--}else if(l==="$"||l==="$?"||l==="$~"||l==="$!"||l==="&")i++;else if(l==="html")ma(e.ownerDocument.documentElement);else if(l==="head"){l=e.ownerDocument.head,ma(l);for(var c=l.firstChild;c;){var g=c.nextSibling,S=c.nodeName;c[Ri]||S==="SCRIPT"||S==="STYLE"||S==="LINK"&&c.rel.toLowerCase()==="stylesheet"||l.removeChild(c),c=g}}else l==="body"&&ma(e.ownerDocument.body);l=o}while(l);xi(t)}function gp(e,t){var l=e;e=0;do{var i=l.nextSibling;if(l.nodeType===1?t?(l._stashedDisplay=l.style.display,l.style.display="none"):(l.style.display=l._stashedDisplay||"",l.getAttribute("style")===""&&l.removeAttribute("style")):l.nodeType===3&&(t?(l._stashedText=l.nodeValue,l.nodeValue=""):l.nodeValue=l._stashedText||""),i&&i.nodeType===8)if(l=i.data,l==="/$"){if(e===0)break;e--}else l!=="$"&&l!=="$?"&&l!=="$~"&&l!=="$!"||e++;l=i}while(l)}function Ac(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var l=t;switch(t=t.nextSibling,l.nodeName){case"HTML":case"HEAD":case"BODY":Ac(l),zu(l);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(l.rel.toLowerCase()==="stylesheet")continue}e.removeChild(l)}}function G1(e,t,l,i){for(;e.nodeType===1;){var o=l;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[Ri])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(c=e.getAttribute("rel"),c==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(c!==o.rel||e.getAttribute("href")!==(o.href==null||o.href===""?null:o.href)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin)||e.getAttribute("title")!==(o.title==null?null:o.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(c=e.getAttribute("src"),(c!==(o.src==null?null:o.src)||e.getAttribute("type")!==(o.type==null?null:o.type)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin))&&c&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var c=o.name==null?null:""+o.name;if(o.type==="hidden"&&e.getAttribute("name")===c)return e}else return e;if(e=ln(e.nextSibling),e===null)break}return null}function X1(e,t,l){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!l||(e=ln(e.nextSibling),e===null))return null;return e}function yp(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=ln(e.nextSibling),e===null))return null;return e}function Tc(e){return e.data==="$?"||e.data==="$~"}function wc(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function Q1(e,t){var l=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||l.readyState!=="loading")t();else{var i=function(){t(),l.removeEventListener("DOMContentLoaded",i)};l.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function ln(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var Cc=null;function vp(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="/$"||l==="/&"){if(t===0)return ln(e.nextSibling);t--}else l!=="$"&&l!=="$!"&&l!=="$?"&&l!=="$~"&&l!=="&"||t++}e=e.nextSibling}return null}function bp(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="$"||l==="$!"||l==="$?"||l==="$~"||l==="&"){if(t===0)return e;t--}else l!=="/$"&&l!=="/&"||t++}e=e.previousSibling}return null}function Sp(e,t,l){switch(t=Vr(l),e){case"html":if(e=t.documentElement,!e)throw Error(u(452));return e;case"head":if(e=t.head,!e)throw Error(u(453));return e;case"body":if(e=t.body,!e)throw Error(u(454));return e;default:throw Error(u(451))}}function ma(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);zu(e)}var an=new Map,xp=new Set;function Gr(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var jn=I.d;I.d={f:Z1,r:I1,D:F1,C:K1,L:J1,m:$1,X:P1,S:W1,M:ev};function Z1(){var e=jn.f(),t=Nr();return e||t}function I1(e){var t=ql(e);t!==null&&t.tag===5&&t.type==="form"?Bd(t):jn.r(e)}var vi=typeof document>"u"?null:document;function Ep(e,t,l){var i=vi;if(i&&typeof t=="string"&&t){var o=Jt(t);o=\'link[rel="\'+e+\'"][href="\'+o+\'"]\',typeof l=="string"&&(o+=\'[crossorigin="\'+l+\'"]\'),xp.has(o)||(xp.add(o),e={rel:e,crossOrigin:l,href:t},i.querySelector(o)===null&&(t=i.createElement("link"),gt(t,"link",e),st(t),i.head.appendChild(t)))}}function F1(e){jn.D(e),Ep("dns-prefetch",e,null)}function K1(e,t){jn.C(e,t),Ep("preconnect",e,t)}function J1(e,t,l){jn.L(e,t,l);var i=vi;if(i&&e&&t){var o=\'link[rel="preload"][as="\'+Jt(t)+\'"]\';t==="image"&&l&&l.imageSrcSet?(o+=\'[imagesrcset="\'+Jt(l.imageSrcSet)+\'"]\',typeof l.imageSizes=="string"&&(o+=\'[imagesizes="\'+Jt(l.imageSizes)+\'"]\')):o+=\'[href="\'+Jt(e)+\'"]\';var c=o;switch(t){case"style":c=bi(e);break;case"script":c=Si(e)}an.has(c)||(e=y({rel:"preload",href:t==="image"&&l&&l.imageSrcSet?void 0:e,as:t},l),an.set(c,e),i.querySelector(o)!==null||t==="style"&&i.querySelector(ga(c))||t==="script"&&i.querySelector(ya(c))||(t=i.createElement("link"),gt(t,"link",e),st(t),i.head.appendChild(t)))}}function $1(e,t){jn.m(e,t);var l=vi;if(l&&e){var i=t&&typeof t.as=="string"?t.as:"script",o=\'link[rel="modulepreload"][as="\'+Jt(i)+\'"][href="\'+Jt(e)+\'"]\',c=o;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":c=Si(e)}if(!an.has(c)&&(e=y({rel:"modulepreload",href:e},t),an.set(c,e),l.querySelector(o)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(l.querySelector(ya(c)))return}i=l.createElement("link"),gt(i,"link",e),st(i),l.head.appendChild(i)}}}function W1(e,t,l){jn.S(e,t,l);var i=vi;if(i&&e){var o=Yl(i).hoistableStyles,c=bi(e);t=t||"default";var g=o.get(c);if(!g){var S={loading:0,preload:null};if(g=i.querySelector(ga(c)))S.loading=5;else{e=y({rel:"stylesheet",href:e,"data-precedence":t},l),(l=an.get(c))&&zc(e,l);var A=g=i.createElement("link");st(A),gt(A,"link",e),A._p=new Promise(function(M,q){A.onload=M,A.onerror=q}),A.addEventListener("load",function(){S.loading|=1}),A.addEventListener("error",function(){S.loading|=2}),S.loading|=4,Xr(g,t,i)}g={type:"stylesheet",instance:g,count:1,state:S},o.set(c,g)}}}function P1(e,t){jn.X(e,t);var l=vi;if(l&&e){var i=Yl(l).hoistableScripts,o=Si(e),c=i.get(o);c||(c=l.querySelector(ya(o)),c||(e=y({src:e,async:!0},t),(t=an.get(o))&&_c(e,t),c=l.createElement("script"),st(c),gt(c,"link",e),l.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},i.set(o,c))}}function ev(e,t){jn.M(e,t);var l=vi;if(l&&e){var i=Yl(l).hoistableScripts,o=Si(e),c=i.get(o);c||(c=l.querySelector(ya(o)),c||(e=y({src:e,async:!0,type:"module"},t),(t=an.get(o))&&_c(e,t),c=l.createElement("script"),st(c),gt(c,"link",e),l.head.appendChild(c)),c={type:"script",instance:c,count:1,state:null},i.set(o,c))}}function kp(e,t,l,i){var o=(o=K.current)?Gr(o):null;if(!o)throw Error(u(446));switch(e){case"meta":case"title":return null;case"style":return typeof l.precedence=="string"&&typeof l.href=="string"?(t=bi(l.href),l=Yl(o).hoistableStyles,i=l.get(t),i||(i={type:"style",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(l.rel==="stylesheet"&&typeof l.href=="string"&&typeof l.precedence=="string"){e=bi(l.href);var c=Yl(o).hoistableStyles,g=c.get(e);if(g||(o=o.ownerDocument||o,g={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},c.set(e,g),(c=o.querySelector(ga(e)))&&!c._p&&(g.instance=c,g.state.loading=5),an.has(e)||(l={rel:"preload",as:"style",href:l.href,crossOrigin:l.crossOrigin,integrity:l.integrity,media:l.media,hrefLang:l.hrefLang,referrerPolicy:l.referrerPolicy},an.set(e,l),c||tv(o,e,l,g.state))),t&&i===null)throw Error(u(528,""));return g}if(t&&i!==null)throw Error(u(529,""));return null;case"script":return t=l.async,l=l.src,typeof l=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Si(l),l=Yl(o).hoistableScripts,i=l.get(t),i||(i={type:"script",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(u(444,e))}}function bi(e){return\'href="\'+Jt(e)+\'"\'}function ga(e){return\'link[rel="stylesheet"][\'+e+"]"}function Ap(e){return y({},e,{"data-precedence":e.precedence,precedence:null})}function tv(e,t,l,i){e.querySelector(\'link[rel="preload"][as="style"][\'+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),gt(t,"link",l),st(t),e.head.appendChild(t))}function Si(e){return\'[src="\'+Jt(e)+\'"]\'}function ya(e){return"script[async]"+e}function Tp(e,t,l){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector(\'style[data-href~="\'+Jt(l.href)+\'"]\');if(i)return t.instance=i,st(i),i;var o=y({},l,{"data-href":l.href,"data-precedence":l.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),st(i),gt(i,"style",o),Xr(i,l.precedence,e),t.instance=i;case"stylesheet":o=bi(l.href);var c=e.querySelector(ga(o));if(c)return t.state.loading|=4,t.instance=c,st(c),c;i=Ap(l),(o=an.get(o))&&zc(i,o),c=(e.ownerDocument||e).createElement("link"),st(c);var g=c;return g._p=new Promise(function(S,A){g.onload=S,g.onerror=A}),gt(c,"link",i),t.state.loading|=4,Xr(c,l.precedence,e),t.instance=c;case"script":return c=Si(l.src),(o=e.querySelector(ya(c)))?(t.instance=o,st(o),o):(i=l,(o=an.get(c))&&(i=y({},l),_c(i,o)),e=e.ownerDocument||e,o=e.createElement("script"),st(o),gt(o,"link",i),e.head.appendChild(o),t.instance=o);case"void":return null;default:throw Error(u(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,Xr(i,l.precedence,e));return t.instance}function Xr(e,t,l){for(var i=l.querySelectorAll(\'link[rel="stylesheet"][data-precedence],style[data-precedence]\'),o=i.length?i[i.length-1]:null,c=o,g=0;g<i.length;g++){var S=i[g];if(S.dataset.precedence===t)c=S;else if(c!==o)break}c?c.parentNode.insertBefore(e,c.nextSibling):(t=l.nodeType===9?l.head:l,t.insertBefore(e,t.firstChild))}function zc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function _c(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Qr=null;function wp(e,t,l){if(Qr===null){var i=new Map,o=Qr=new Map;o.set(l,i)}else o=Qr,i=o.get(l),i||(i=new Map,o.set(l,i));if(i.has(e))return i;for(i.set(e,null),l=l.getElementsByTagName(e),o=0;o<l.length;o++){var c=l[o];if(!(c[Ri]||c[dt]||e==="link"&&c.getAttribute("rel")==="stylesheet")&&c.namespaceURI!=="http://www.w3.org/2000/svg"){var g=c.getAttribute(t)||"";g=e+g;var S=i.get(g);S?S.push(c):i.set(g,[c])}}return i}function Cp(e,t,l){e=e.ownerDocument||e,e.head.insertBefore(l,t==="title"?e.querySelector("head > title"):null)}function nv(e,t,l){if(l===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function zp(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function lv(e,t,l,i){if(l.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(l.state.loading&4)===0){if(l.instance===null){var o=bi(i.href),c=t.querySelector(ga(o));if(c){t=c._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Zr.bind(e),t.then(e,e)),l.state.loading|=4,l.instance=c,st(c);return}c=t.ownerDocument||t,i=Ap(i),(o=an.get(o))&&zc(i,o),c=c.createElement("link"),st(c);var g=c;g._p=new Promise(function(S,A){g.onload=S,g.onerror=A}),gt(c,"link",i),l.instance=c}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(l,t),(t=l.state.preload)&&(l.state.loading&3)===0&&(e.count++,l=Zr.bind(e),t.addEventListener("load",l),t.addEventListener("error",l))}}var Oc=0;function iv(e,t){return e.stylesheets&&e.count===0&&Fr(e,e.stylesheets),0<e.count||0<e.imgCount?function(l){var i=setTimeout(function(){if(e.stylesheets&&Fr(e,e.stylesheets),e.unsuspend){var c=e.unsuspend;e.unsuspend=null,c()}},6e4+t);0<e.imgBytes&&Oc===0&&(Oc=62500*B1());var o=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Fr(e,e.stylesheets),e.unsuspend)){var c=e.unsuspend;e.unsuspend=null,c()}},(e.imgBytes>Oc?50:800)+t);return e.unsuspend=l,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(o)}}:null}function Zr(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Fr(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Ir=null;function Fr(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Ir=new Map,t.forEach(av,e),Ir=null,Zr.call(e))}function av(e,t){if(!(t.state.loading&4)){var l=Ir.get(e);if(l)var i=l.get(null);else{l=new Map,Ir.set(e,l);for(var o=e.querySelectorAll("link[data-precedence],style[data-precedence]"),c=0;c<o.length;c++){var g=o[c];(g.nodeName==="LINK"||g.getAttribute("media")!=="not all")&&(l.set(g.dataset.precedence,g),i=g)}i&&l.set(null,i)}o=t.instance,g=o.getAttribute("data-precedence"),c=l.get(g)||i,c===i&&l.set(null,o),l.set(g,o),this.count++,i=Zr.bind(this),o.addEventListener("load",i),o.addEventListener("error",i),c?c.parentNode.insertBefore(o,c.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(o,e.firstChild)),t.state.loading|=4}}var va={$$typeof:X,Provider:null,Consumer:null,_currentValue:ce,_currentValue2:ce,_threadCount:0};function rv(e,t,l,i,o,c,g,S,A){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Au(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Au(0),this.hiddenUpdates=Au(null),this.identifierPrefix=i,this.onUncaughtError=o,this.onCaughtError=c,this.onRecoverableError=g,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=A,this.incompleteTransitions=new Map}function _p(e,t,l,i,o,c,g,S,A,M,q,Z){return e=new rv(e,t,l,g,A,M,q,Z,S),t=1,c===!0&&(t|=24),c=Yt(3,null,null,t),e.current=c,c.stateNode=e,t=oo(),t.refCount++,e.pooledCache=t,t.refCount++,c.memoizedState={element:i,isDehydrated:l,cache:t},ho(c),e}function Op(e){return e?(e=$l,e):$l}function Dp(e,t,l,i,o,c){o=Op(o),i.context===null?i.context=o:i.pendingContext=o,i=In(t),i.payload={element:l},c=c===void 0?null:c,c!==null&&(i.callback=c),l=Fn(e,i,t),l!==null&&(Ut(l,e,t),Ji(l,e,t))}function Mp(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var l=e.retryLane;e.retryLane=l!==0&&l<t?l:t}}function Dc(e,t){Mp(e,t),(e=e.alternate)&&Mp(e,t)}function Rp(e){if(e.tag===13||e.tag===31){var t=yl(e,67108864);t!==null&&Ut(t,e,67108864),Dc(e,67108864)}}function Np(e){if(e.tag===13||e.tag===31){var t=Zt();t=Tu(t);var l=yl(e,t);l!==null&&Ut(l,e,t),Dc(e,t)}}var Kr=!0;function uv(e,t,l,i){var o=R.T;R.T=null;var c=I.p;try{I.p=2,Mc(e,t,l,i)}finally{I.p=c,R.T=o}}function ov(e,t,l,i){var o=R.T;R.T=null;var c=I.p;try{I.p=8,Mc(e,t,l,i)}finally{I.p=c,R.T=o}}function Mc(e,t,l,i){if(Kr){var o=Rc(i);if(o===null)vc(e,t,i,Jr,l),Up(e,i);else if(sv(o,e,t,l,i))i.stopPropagation();else if(Up(e,i),t&4&&-1<cv.indexOf(e)){for(;o!==null;){var c=ql(o);if(c!==null)switch(c.tag){case 3:if(c=c.stateNode,c.current.memoizedState.isDehydrated){var g=dl(c.pendingLanes);if(g!==0){var S=c;for(S.pendingLanes|=2,S.entangledLanes|=2;g;){var A=1<<31-Ge(g);S.entanglements[1]|=A,g&=~A}mn(c),(Le&6)===0&&(Mr=kt()+500,da(0))}}break;case 31:case 13:S=yl(c,2),S!==null&&Ut(S,c,2),Nr(),Dc(c,2)}if(c=Rc(i),c===null&&vc(e,t,i,Jr,l),c===o)break;o=c}o!==null&&i.stopPropagation()}else vc(e,t,i,null,l)}}function Rc(e){return e=Nu(e),Nc(e)}var Jr=null;function Nc(e){if(Jr=null,e=Hl(e),e!==null){var t=f(e);if(t===null)e=null;else{var l=t.tag;if(l===13){if(e=d(t),e!==null)return e;e=null}else if(l===31){if(e=p(t),e!==null)return e;e=null}else if(l===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Jr=e,null}function Lp(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(ku()){case V:return 2;case P:return 8;case ge:case Te:return 32;case Ue:return 268435456;default:return 32}default:return 32}}var Lc=!1,al=null,rl=null,ul=null,ba=new Map,Sa=new Map,ol=[],cv="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function Up(e,t){switch(e){case"focusin":case"focusout":al=null;break;case"dragenter":case"dragleave":rl=null;break;case"mouseover":case"mouseout":ul=null;break;case"pointerover":case"pointerout":ba.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":Sa.delete(t.pointerId)}}function xa(e,t,l,i,o,c){return e===null||e.nativeEvent!==c?(e={blockedOn:t,domEventName:l,eventSystemFlags:i,nativeEvent:c,targetContainers:[o]},t!==null&&(t=ql(t),t!==null&&Rp(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function sv(e,t,l,i,o){switch(t){case"focusin":return al=xa(al,e,t,l,i,o),!0;case"dragenter":return rl=xa(rl,e,t,l,i,o),!0;case"mouseover":return ul=xa(ul,e,t,l,i,o),!0;case"pointerover":var c=o.pointerId;return ba.set(c,xa(ba.get(c)||null,e,t,l,i,o)),!0;case"gotpointercapture":return c=o.pointerId,Sa.set(c,xa(Sa.get(c)||null,e,t,l,i,o)),!0}return!1}function jp(e){var t=Hl(e.target);if(t!==null){var l=f(t);if(l!==null){if(t=l.tag,t===13){if(t=d(l),t!==null){e.blockedOn=t,Js(e.priority,function(){Np(l)});return}}else if(t===31){if(t=p(l),t!==null){e.blockedOn=t,Js(e.priority,function(){Np(l)});return}}else if(t===3&&l.stateNode.current.memoizedState.isDehydrated){e.blockedOn=l.tag===3?l.stateNode.containerInfo:null;return}}}e.blockedOn=null}function $r(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var l=Rc(e.nativeEvent);if(l===null){l=e.nativeEvent;var i=new l.constructor(l.type,l);Ru=i,l.target.dispatchEvent(i),Ru=null}else return t=ql(l),t!==null&&Rp(t),e.blockedOn=l,!1;t.shift()}return!0}function Bp(e,t,l){$r(e)&&l.delete(t)}function fv(){Lc=!1,al!==null&&$r(al)&&(al=null),rl!==null&&$r(rl)&&(rl=null),ul!==null&&$r(ul)&&(ul=null),ba.forEach(Bp),Sa.forEach(Bp)}function Wr(e,t){e.blockedOn===t&&(e.blockedOn=null,Lc||(Lc=!0,n.unstable_scheduleCallback(n.unstable_NormalPriority,fv)))}var Pr=null;function Hp(e){Pr!==e&&(Pr=e,n.unstable_scheduleCallback(n.unstable_NormalPriority,function(){Pr===e&&(Pr=null);for(var t=0;t<e.length;t+=3){var l=e[t],i=e[t+1],o=e[t+2];if(typeof i!="function"){if(Nc(i||l)===null)continue;break}var c=ql(l);c!==null&&(e.splice(t,3),t-=3,Ro(c,{pending:!0,data:o,method:l.method,action:i},i,o))}}))}function xi(e){function t(A){return Wr(A,e)}al!==null&&Wr(al,e),rl!==null&&Wr(rl,e),ul!==null&&Wr(ul,e),ba.forEach(t),Sa.forEach(t);for(var l=0;l<ol.length;l++){var i=ol[l];i.blockedOn===e&&(i.blockedOn=null)}for(;0<ol.length&&(l=ol[0],l.blockedOn===null);)jp(l),l.blockedOn===null&&ol.shift();if(l=(e.ownerDocument||e).$$reactFormReplay,l!=null)for(i=0;i<l.length;i+=3){var o=l[i],c=l[i+1],g=o[Ot]||null;if(typeof c=="function")g||Hp(l);else if(g){var S=null;if(c&&c.hasAttribute("formAction")){if(o=c,g=c[Ot]||null)S=g.formAction;else if(Nc(o)!==null)continue}else S=g.action;typeof S=="function"?l[i+1]=S:(l.splice(i,3),i-=3),Hp(l)}}}function qp(){function e(c){c.canIntercept&&c.info==="react-transition"&&c.intercept({handler:function(){return new Promise(function(g){return o=g})},focusReset:"manual",scroll:"manual"})}function t(){o!==null&&(o(),o=null),i||setTimeout(l,20)}function l(){if(!i&&!navigation.transition){var c=navigation.currentEntry;c&&c.url!=null&&navigation.navigate(c.url,{state:c.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,o=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(l,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),o!==null&&(o(),o=null)}}}function Uc(e){this._internalRoot=e}eu.prototype.render=Uc.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(u(409));var l=t.current,i=Zt();Dp(l,i,e,t,null,null)},eu.prototype.unmount=Uc.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Dp(e.current,2,null,e,null,null),Nr(),t[Bl]=null}};function eu(e){this._internalRoot=e}eu.prototype.unstable_scheduleHydration=function(e){if(e){var t=Ks();e={blockedOn:null,target:e,priority:t};for(var l=0;l<ol.length&&t!==0&&t<ol[l].priority;l++);ol.splice(l,0,e),l===0&&jp(e)}};var Yp=a.version;if(Yp!=="19.2.6")throw Error(u(527,Yp,"19.2.6"));I.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(u(188)):(e=Object.keys(e).join(","),Error(u(268,e)));return e=h(t),e=e!==null?v(e):null,e=e===null?null:e.stateNode,e};var dv={bundleType:0,version:"19.2.6",rendererPackageName:"react-dom",currentDispatcherRef:R,reconcilerVersion:"19.2.6"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var tu=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!tu.isDisabled&&tu.supportsFiber)try{At=tu.inject(dv),ut=tu}catch{}}return ka.createRoot=function(e,t){if(!s(e))throw Error(u(299));var l=!1,i="",o=Fd,c=Kd,g=Jd;return t!=null&&(t.unstable_strictMode===!0&&(l=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(c=t.onCaughtError),t.onRecoverableError!==void 0&&(g=t.onRecoverableError)),t=_p(e,1,!1,null,null,l,i,null,o,c,g,qp),e[Bl]=t.current,yc(e),new Uc(t)},ka.hydrateRoot=function(e,t,l){if(!s(e))throw Error(u(299));var i=!1,o="",c=Fd,g=Kd,S=Jd,A=null;return l!=null&&(l.unstable_strictMode===!0&&(i=!0),l.identifierPrefix!==void 0&&(o=l.identifierPrefix),l.onUncaughtError!==void 0&&(c=l.onUncaughtError),l.onCaughtError!==void 0&&(g=l.onCaughtError),l.onRecoverableError!==void 0&&(S=l.onRecoverableError),l.formState!==void 0&&(A=l.formState)),t=_p(e,1,!0,t,l??null,i,o,A,c,g,S,qp),t.context=Op(null),l=t.current,i=Zt(),i=Tu(i),o=In(i),o.callback=null,Fn(l,o,i),l=i,t.current.lanes=l,Mi(t,l),mn(t),e[Bl]=t.current,yc(e),new eu(t)},ka.version="19.2.6",ka}var $p;function Ev(){if($p)return Hc.exports;$p=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(a){console.error(a)}}return n(),Hc.exports=xv(),Hc.exports}var kv=Ev();function Av(){return J.jsxs("main",{className:"duplicate-page",children:[J.jsxs("svg",{width:"48",height:"48",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:[J.jsx("circle",{cx:"12",cy:"12",r:"10"}),J.jsx("path",{d:"m4.9 4.9 14.2 14.2"})]}),J.jsx("h1",{children:"Session unavailable"}),J.jsx("p",{children:"Another browser window is already connected to this Voice Agent. Close the other session and refresh this page."})]})}const Wp=n=>Symbol.iterator in n,Pp=n=>"entries"in n,em=(n,a)=>{const r=n instanceof Map?n:new Map(n.entries()),u=a instanceof Map?a:new Map(a.entries());if(r.size!==u.size)return!1;for(const[s,f]of r)if(!u.has(s)||!Object.is(f,u.get(s)))return!1;return!0},Tv=(n,a)=>{const r=n[Symbol.iterator](),u=a[Symbol.iterator]();let s=r.next(),f=u.next();for(;!s.done&&!f.done;){if(!Object.is(s.value,f.value))return!1;s=r.next(),f=u.next()}return!!s.done&&!!f.done};function wv(n,a){return Object.is(n,a)?!0:typeof n!="object"||n===null||typeof a!="object"||a===null||Object.getPrototypeOf(n)!==Object.getPrototypeOf(a)?!1:Wp(n)&&Wp(a)?Pp(n)&&Pp(a)?em(n,a):Tv(n,a):em({entries:()=>Object.entries(n)},{entries:()=>Object.entries(a)})}function Ts(n){const a=za.useRef(void 0);return r=>{const u=n(r);return wv(a.current,u)?a.current:a.current=u}}const tm=n=>{let a;const r=new Set,u=(h,v)=>{const y=typeof h=="function"?h(a):h;if(!Object.is(y,a)){const E=a;a=v??(typeof y!="object"||y===null)?y:Object.assign({},a,y),r.forEach(x=>x(a,E))}},s=()=>a,p={setState:u,getState:s,getInitialState:()=>m,subscribe:h=>(r.add(h),()=>r.delete(h))},m=a=n(u,s,p);return p},Cv=(n=>n?tm(n):tm),zv=n=>n;function _v(n,a=zv){const r=za.useSyncExternalStore(n.subscribe,za.useCallback(()=>a(n.getState()),[n,a]),za.useCallback(()=>a(n.getInitialState()),[n,a]));return za.useDebugValue(r),r}const Ov=(n,a)=>(r,u,s)=>(s.dispatch=f=>(r(d=>n(d,f),!1,f),f),s.dispatchFromDevtools=!0,{dispatch:(...f)=>s.dispatch(...f),...a}),Dv=Ov;function Mv(n,a){let r;try{r=n()}catch{return}return{getItem:s=>{var f;const d=m=>m===null?null:JSON.parse(m,void 0),p=(f=r.getItem(s))!=null?f:null;return p instanceof Promise?p.then(d):d(p)},setItem:(s,f)=>r.setItem(s,JSON.stringify(f,void 0)),removeItem:s=>r.removeItem(s)}}const os=n=>a=>{try{const r=n(a);return r instanceof Promise?r:{then(u){return os(u)(r)},catch(u){return this}}}catch(r){return{then(u){return this},catch(u){return os(u)(r)}}}},Rv=(n,a)=>(r,u,s)=>{let f={storage:Mv(()=>window.localStorage),partialize:j=>j,version:0,merge:(j,O)=>({...O,...j}),...a},d=!1,p=0;const m=new Set,h=new Set;let v=f.storage;if(!v)return n((...j)=>{console.warn(`[zustand persist middleware] Unable to update item \'${f.name}\', the given storage is currently unavailable.`),r(...j)},u,s);const y=()=>{const j=f.partialize({...u()});return v.setItem(f.name,{state:j,version:f.version})},E=s.setState;s.setState=(j,O)=>(E(j,O),y());const x=n((...j)=>(r(...j),y()),u,s);s.getInitialState=()=>x;let C;const H=()=>{var j,O;if(!v)return;const F=++p;d=!1,m.forEach(ne=>{var re;return ne((re=u())!=null?re:x)});const X=((O=f.onRehydrateStorage)==null?void 0:O.call(f,(j=u())!=null?j:x))||void 0;return os(v.getItem.bind(v))(f.name).then(ne=>{if(ne)if(typeof ne.version=="number"&&ne.version!==f.version){if(f.migrate){const re=f.migrate(ne.state,ne.version);return re instanceof Promise?re.then(B=>[!0,B]):[!0,re]}console.error("State loaded from storage couldn\'t be migrated since no migrate function was provided")}else return[!1,ne.state];return[!1,void 0]}).then(ne=>{var re;if(F!==p)return;const[B,te]=ne;if(C=f.merge(te,(re=u())!=null?re:x),r(C,!0),B)return y()}).then(()=>{F===p&&(X?.(u(),void 0),C=u(),d=!0,h.forEach(ne=>ne(C)))}).catch(ne=>{F===p&&X?.(void 0,ne)})};return s.persist={setOptions:j=>{f={...f,...j},j.storage&&(v=j.storage)},clearStorage:()=>{v?.removeItem(f.name)},getOptions:()=>f,rehydrate:()=>H(),hasHydrated:()=>d,onHydrate:j=>(m.add(j),()=>{m.delete(j)}),onFinishHydration:j=>(h.add(j),()=>{h.delete(j)})},f.skipHydration||H(),C||x},Nv=Rv,Lv={permission:"unknown",devices:[],selectedDeviceId:null,ready:!1,autoplayAllowed:null,pendingSessionStart:!1};function Uv(n,a){switch(a.type){case"browser/autoplay/probed":return{...n,autoplayAllowed:a.allowed,pendingSessionStart:!1};case"browser/devices/enumerated":return{...n,devices:a.devices};case"host/browser-audio/device-change":return{...n,devices:a.devices,selectedDeviceId:a.selectedDeviceId};case"ui/select/mic-device":return n.selectedDeviceId===a.deviceId?n:{...n,selectedDeviceId:a.deviceId};case"browser/permission/granted":return{...n,permission:"granted",ready:!0};case"browser/permission/denied":return{...n,permission:"denied"};case"browser/mic/stream-failed":return{...n,permission:"denied",ready:!1};case"host/voice/session/start":return n.autoplayAllowed===!0||n.pendingSessionStart?n:{...n,pendingSessionStart:!0};case"voice/session/in-flight":return!a.inFlight||!n.pendingSessionStart?n:{...n,pendingSessionStart:!1};default:return n}}const jv={status:"connecting",reconnectMs:250};function Bv(n,a){switch(a.type){case"connection/status":return n.status===a.status?n:{...n,status:a.status};default:return n}}const Hv={status:"starting",conversation:null,instructions:void 0,streamDrafts:new Map,atBottom:!0,previousConversationId:null};function qv(n,a){switch(a.type){case"host/state":{const r=a.data.conversation??null,u=r?.status??n.status,s=r?.id??null;return s!==n.previousConversationId?{...n,status:u,conversation:r,instructions:a.data.instructions,streamDrafts:new Map,atBottom:!0,previousConversationId:s}:{...n,status:u,conversation:r,instructions:a.data.instructions}}case"host/transcript/delta":{const r=new Map(n.streamDrafts);return r.set(a.delta.itemId,a.delta),{...n,streamDrafts:r}}case"ui/scroll/transcript":return n.atBottom===a.atBottom?n:{...n,atBottom:a.atBottom};default:return n}}const Yv={injectedVersion:null};function Vv(n,a){switch(a.type){case"host/state":{const r=a.data.injectedVersion??null;return r===n.injectedVersion?n:{...n,injectedVersion:r}}case"host/stage":{const r=a.data.injectedVersion;return r===n.injectedVersion?n:{...n,injectedVersion:r}}default:return n}}const Gv={modal:"none",moreActionsOpen:!1,duplicateClient:!1};function Xv(n,a){switch(a.type){case"ui/click/transcript":return{...n,modal:"transcript",moreActionsOpen:!1};case"ui/click/instructions":return{...n,modal:"instructions",moreActionsOpen:!1};case"ui/click/modal-backdrop":case"ui/click/modal-close":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/key/escape":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/click/more-actions":return{...n,moreActionsOpen:!n.moreActionsOpen};case"host/duplicate-client":return n.duplicateClient?n:{...n,duplicateClient:!0};default:return n}}const Qv={xaiOpen:!1,xaiStatus:"disconnected",connectedSent:!1,sessionInFlight:!1,paused:!1,responseActive:!1,speakingItemId:null,pendingUserItemId:null,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};function Zv(n,a){switch(a.type){case"xai/ws/connecting":return n.xaiStatus==="connecting"?n:{...n,xaiStatus:"connecting"};case"xai/ws/open":return{...n,xaiOpen:!0,xaiStatus:"connected"};case"xai/ws/error":return n.xaiStatus==="error"?n:{...n,xaiStatus:"error"};case"xai/ws/close":return{...n,xaiOpen:!1,xaiStatus:"disconnected",responseActive:!1,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1,pendingUserItemId:null};case"xai/response/created":return{...n,responseActive:!0,speakingItemId:null};case"xai/response/done":case"xai/response/failed":return{...n,responseActive:!1,pendingUserItemId:null};case"xai/response/cancelled":return{...n,responseActive:!1,speakingItemId:null};case"xai/input-audio-buffer/speech-started":return{...n,speakingItemId:a.itemId||null,pendingUserItemId:a.itemId||n.pendingUserItemId};case"xai/input-audio-buffer/speech-stopped":case"xai/conversation/item/added":return n.speakingItemId===null?n:{...n,speakingItemId:null};case"xai/response/output-item/added":return{...n,speakingItemId:a.itemId};case"voice/session/in-flight":return n.sessionInFlight===a.inFlight?n:{...n,sessionInFlight:a.inFlight};case"voice/paused":return n.paused===a.paused?n:{...n,paused:a.paused};case"voice/playback/cursor":return{...n,nextPlaybackTime:a.nextPlaybackTime,playbackEndsAt:a.playbackEndsAt};case"voice/playback/cut":return{...n,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};case"host/voice/send":return a.gate!=="playback-drained"?n:{...n,deferredSendsPending:!0};case"voice/playback/drained":return n.deferredSendsPending?{...n,deferredSendsPending:!1}:n;default:return n}}const Iv={connection:jv,conversation:Hv,audio:Lv,voice:Qv,ui:Gv,stage:Yv};function Fv(n,a){const r=Bv(n.connection,a),u=qv(n.conversation,a),s=Uv(n.audio,a),f=Zv(n.voice,a),d=Xv(n.ui,a),p=Vv(n.stage,a);return r===n.connection&&u===n.conversation&&s===n.audio&&f===n.voice&&d===n.ui&&p===n.stage?n:{connection:r,conversation:u,audio:s,voice:f,ui:d,stage:p}}const ws=Cv(Nv(Dv(Fv,Iv),{name:"voice:audio",partialize:n=>({audio:{selectedDeviceId:n.audio.selectedDeviceId}}),merge:(n,a)=>{const u=n?.audio?.selectedDeviceId??a.audio.selectedDeviceId;return{...a,audio:{...a.audio,selectedDeviceId:u}}}}));function cs(){return ws.getState()}function St(n){return _v(ws,n)}const ou=[],nm=[];let Gc=!1;function bt(n){if(Gc){nm.push(n);return}Gc=!0;try{let a=n;for(;a!==void 0;){ws.dispatch(a);for(const r of ou)r(a);a=nm.shift()}}finally{Gc=!1}}function Fm(n){return ou.push(n),()=>{const a=ou.indexOf(n);a!==-1&&ou.splice(a,1)}}let Ti,Dl;async function Kv(){return navigator.mediaDevices?.enumerateDevices?(await navigator.mediaDevices.enumerateDevices()).filter(a=>a.kind==="audioinput").map(a=>({deviceId:a.deviceId,label:a.label||"Microphone",groupId:a.groupId})):[]}function Xc(n,a){if(Ti&&Dl&&Ti.removeEventListener("ended",Dl),Ti=n,Dl=void 0,!n)return;const r=()=>{a({type:"browser/mic/track-ended"})};Dl=r,n.addEventListener("ended",r)}function Jv({dispatch:n}){const a=()=>{Kv().then(r=>{n({type:"browser/devices/enumerated",devices:r})}).catch(r=>{n({type:"browser/window/error",message:`devicechange enumerate failed: ${String(r instanceof Error?r.message:r)}`})})};return navigator.mediaDevices?.addEventListener?.("devicechange",a),()=>{navigator.mediaDevices?.removeEventListener?.("devicechange",a),Ti&&Dl&&Ti.removeEventListener("ended",Dl),Ti=void 0,Dl=void 0}}let yn,nu=250;const ss=[],$v=new Set(["xai/response/output-audio/delta"]);let fs;function Wv(){return`${location.protocol==="https:"?"wss:":"ws:"}//${location.host}/ws`}function wt(n,a){const r=JSON.stringify({type:n,data:a});if(n==="browser.debug"){yn&&yn.readyState===WebSocket.OPEN?yn.send(r):ss.push(r);return}yn&&yn.readyState===WebSocket.OPEN&&yn.send(r)}function Pv(n){switch(n.type){case"duplicate.client":return[{type:"host/duplicate-client"}];case"state":return[{type:"host/state",data:n.data}];case"transcript.item":return[{type:"host/transcript/item",item:n.data}];case"transcript.delta":return[{type:"host/transcript/delta",delta:n.data}];case"browser.audio.deviceChange":return[{type:"host/browser-audio/device-change",devices:n.data.devices.map(a=>({deviceId:a.deviceId,label:a.label,groupId:a.groupId})),selectedDeviceId:n.data.selectedDeviceId??null}];case"voice.session.start":return[{type:"host/voice/session/start"}];case"voice.session.token":return[{type:"host/voice/session/token",token:n.data}];case"voice.session.close":return[{type:"host/voice/session/close",code:n.data.code,reason:n.data.reason}];case"voice.send":return[{type:"host/voice/send",event:n.data.event,gate:n.data.gate}];case"stage.injected":return[{type:"host/stage",data:n.data}];case"wait_for_context.start":return[{type:"host/wait-for-context/start"}];case"wait_for_context.end":return[{type:"host/wait-for-context/end"}];case"audio.output.delta":return[];case"error":return[];default:return[]}}function e0({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,s;const f=()=>{n({type:"connection/status",status:"connecting"});const p=new WebSocket(Wv());yn=p,p.addEventListener("open",()=>{nu=250;const m=[];for(const h of ss)try{p.send(h)}catch(v){m.push(String(v instanceof Error?v.message:v))}ss.length=0,n({type:"connection/status",status:"connected"});for(const h of m)n({type:"browser/window/error",message:`debugBuffer.flush.failed: ${h}`})}),p.addEventListener("message",m=>{let h;try{h=JSON.parse(String(m.data))}catch(v){n({type:"browser/window/error",message:`ws.in.parseError: ${String(v instanceof Error?v.message:v)}`});return}for(const v of Pv(h))n(v)}),p.addEventListener("close",()=>{yn=void 0,n({type:"connection/status",status:"disconnected"}),!u&&(s=setTimeout(f,nu),nu=Math.min(nu*2,5e3))}),p.addEventListener("error",()=>{n({type:"connection/status",status:"error"})})},d=a(p=>{p.type.startsWith("xai/")&&!p.type.startsWith("xai/ws/")&&fs!==void 0&&wt("voice.event",{event:fs}),p.type==="ui/click/download-transcript"&&n0(r),$v.has(p.type)||wt("browser.debug",{label:"action",info:p,t:Date.now()})});return f(),()=>{u=!0,d(),s!==void 0&&clearTimeout(s);try{yn?.close()}catch(p){console.error("hostSocketRunner.teardown.close.failed",p)}yn=void 0}}function t0(n){fs=n}function n0(n){const a=n().conversation.conversation,r=a?.transcript??[];if(r.length===0)return;const u=`${r.map(h=>JSON.stringify(h)).join(`\n`)}\n`,s=new Blob([u],{type:"application/jsonl"}),f=URL.createObjectURL(s),d=document.createElement("a"),p=new Date().toISOString().replace(/[:.]/g,"-"),m=a?.id??"conversation";d.href=f,d.download=`transcript-${m}-${p}.jsonl`,document.body.append(d),d.click(),d.remove(),URL.revokeObjectURL(f)}const cu=new Float32Array(5),l0=`\n  class Pcm16Encoder extends AudioWorkletProcessor {\n    constructor() { super(); this.buf = []; this.target = 4800; }\n    process(inputs) {\n      const ch = inputs[0] && inputs[0][0];\n      if (!ch) return true;\n      this.buf.push(new Float32Array(ch));\n      let total = 0;\n      for (const b of this.buf) total += b.length;\n      while (total >= this.target) {\n        const out = new Int16Array(this.target);\n        let written = 0;\n        while (written < this.target) {\n          const head = this.buf[0];\n          const take = Math.min(head.length, this.target - written);\n          for (let i = 0; i < take; i++) {\n            const s = Math.max(-1, Math.min(1, head[i]));\n            out[written + i] = s < 0 ? s * 0x8000 : s * 0x7fff;\n          }\n          if (take === head.length) this.buf.shift();\n          else this.buf[0] = head.subarray(take);\n          written += take;\n        }\n        total -= this.target;\n        this.port.postMessage(out.buffer, [out.buffer]);\n      }\n      return true;\n    }\n  }\n  registerProcessor("pcm16-encoder", Pcm16Encoder);\n`,i0=50,a0=500,r0=5e3,u0=3,o0=.01;function lm(){return{nextPlaybackTime:0,playbackEndsAt:0,scheduledSources:[],pendingSends:[],preOpenAudio:[],deferredSends:[],connectedSent:!1,tokenExpiresAt:0,paused:!1}}function je(n){return String(n instanceof Error?n.message:n)}function c0({dispatch:n,subscribeToActions:a,getState:r}){let u=lm(),s=!1,f=0,d,p,m=0,h=!1,v,y,E;const x=(b,_,Q)=>{wt("browser.audio.error",{code:b,message:_,suggestedAction:Q}),n({type:"browser/mic/stream-failed",error:{code:b,message:_}})},C=b=>{const _={echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0};return b&&(_.deviceId={exact:b}),navigator.mediaDevices.getUserMedia({audio:_})},H=async()=>{if(!navigator.mediaDevices?.getUserMedia)return!1;try{const b=r().audio.selectedDeviceId;let _;try{_=await C(b)}catch(ue){if(!b)throw ue;_=await C(null)}for(const ue of _.getTracks())ue.stop();const Q=(await navigator.mediaDevices.enumerateDevices()).filter(ue=>ue.kind==="audioinput").map(ue=>({deviceId:ue.deviceId,label:ue.label||"Microphone",groupId:ue.groupId})),K=r().audio.selectedDeviceId,ee=K??Q[0]?.deviceId??null;return n({type:"browser/devices/enumerated",devices:Q}),ee&&ee!==K&&n({type:"ui/select/mic-device",deviceId:ee}),n({type:"browser/permission/granted"}),wt("audio.device.state",{permission:"granted",devices:Q,selectedDeviceId:ee??void 0,ready:!0}),!0}catch{return x("MICROPHONE_DEVICE_ERROR","Could not access the selected microphone.","Allow microphone access and try again."),n({type:"browser/permission/denied"}),!1}},j=b=>{if(u.analyserCtx)try{u.analyserCtx.close()}catch(ue){n({type:"browser/window/error",message:`startMeters.analyserCtx.close.failed: ${je(ue)}`})}const _=new AudioContext;_.state==="suspended"&&_.resume().catch(ue=>{n({type:"browser/window/error",message:`startMeters.audioCtx.resume.failed: ${je(ue)}`})});const Q=_.createAnalyser();if(Q.fftSize=256,_.createMediaStreamSource(b).connect(Q),u.analyser=Q,u.analyserCtx=_,s)return;s=!0;const K=new Uint8Array(Q.frequencyBinCount),ee=()=>{const ue=u.analyser;if(ue){ue.getByteFrequencyData(K);for(let pe=0;pe<cu.length;pe+=1)cu[pe]=Math.max(.1,(K[pe*10]??0)/255)}f=requestAnimationFrame(ee)};ee()},O=b=>{const _=atob(b),Q=new Uint8Array(_.length);for(let ue=0;ue<_.length;ue+=1)Q[ue]=_.charCodeAt(ue);const K=new DataView(Q.buffer),ee=new Float32Array(Q.length/2);for(let ue=0;ue<ee.length;ue+=1){const pe=K.getInt16(ue*2,!0);ee[ue]=pe<0?pe/32768:pe/32767}return ee},F=b=>{let _="";for(let K=0;K<b.length;K+=32768)_+=String.fromCharCode(...b.subarray(K,K+32768));return btoa(_)},X=()=>{const b=u.outputCtx,_=u.playbackEndsAt;return!_||!b?!0:b.currentTime>=_-o0},ne=()=>{if(!X()){if(u.deferredSends.length===0)return;const b=u.outputCtx,_=b?Math.max(0,(u.playbackEndsAt-b.currentTime+.015)*1e3):50;p!==void 0&&clearTimeout(p),p=setTimeout(ne,_);return}p!==void 0&&(clearTimeout(p),p=void 0),u.deferredSends.length!==0&&n({type:"voice/playback/drained"})},re=b=>{try{const _=O(b);if(_.length===0)return;let Q=u.outputCtx;Q||(Q=new AudioContext({sampleRate:48e3}),u.outputCtx=Q),Q.state==="suspended"&&Q.resume().catch(Je=>{n({type:"browser/window/error",message:`outputCtx.resume.failed: ${je(Je)}`})});const K=Q.createBuffer(1,_.length,48e3);K.getChannelData(0).set(_);const ee=Q.createBufferSource();ee.buffer=K,ee.connect(Q.destination);const ue=Q.currentTime,pe=Math.max(ue,u.nextPlaybackTime);ee.start(pe);const Ae=pe+K.duration;if(u.nextPlaybackTime=Ae,u.playbackEndsAt=Math.max(u.playbackEndsAt||0,Ae),u.scheduledSources.push(ee),n({type:"voice/playback/cursor",nextPlaybackTime:u.nextPlaybackTime,playbackEndsAt:u.playbackEndsAt}),ee.addEventListener("ended",()=>{const Je=u.scheduledSources.indexOf(ee);Je!==-1&&u.scheduledSources.splice(Je,1),ne()}),u.deferredSends.length>0){const Je=Math.max(0,(u.playbackEndsAt-Q.currentTime+.015)*1e3);p!==void 0&&clearTimeout(p),p=setTimeout(ne,Je)}}catch(_){x("AUDIO_DECODE_FAILED",je(_),"Refresh the page; if the problem persists check audio device permissions.")}},B=()=>{for(const b of u.scheduledSources.splice(0)){try{b.stop()}catch{}try{b.disconnect()}catch(_){n({type:"browser/window/error",message:`stopScheduledPlayback.disconnect.failed: ${je(_)}`})}}u.nextPlaybackTime=0,u.playbackEndsAt=0},te=async b=>{try{const _=new AudioContext({sampleRate:48e3});u.inputCtx=_,_.state==="suspended"&&_.resume().catch(pe=>n({type:"browser/window/error",message:`inputCtx.resume.failed: ${je(pe)}`}));const Q=_.createMediaStreamSource(b);u.micSourceNode=Q;const K=new Blob([l0],{type:"application/javascript"}),ee=URL.createObjectURL(K);try{await _.audioWorklet.addModule(ee)}finally{URL.revokeObjectURL(ee)}const ue=new AudioWorkletNode(_,"pcm16-encoder");u.workletNode=ue,ue.port.onmessage=pe=>{if(!u.paused)try{const Ae=F(new Uint8Array(pe.data)),Je=u.xaiWs;Je&&Je.readyState===WebSocket.OPEN?Je.send(JSON.stringify({type:"input_audio_buffer.append",audio:Ae})):(u.preOpenAudio.push(Ae),u.preOpenAudio.length>i0&&(u.preOpenAudio.shift(),n({type:"voice/queue/pre-open-cap-hit"})))}catch(Ae){x("AUDIO_ENCODE_FAILED",je(Ae),"Refresh the page; if the problem persists check microphone permissions.")}},Q.connect(ue)}catch(_){x("AUDIO_ENCODER_INIT_FAILED",je(_),"Try a different browser or device.")}},de=(b,_)=>{wt("voice.session.failed",{error:{code:b,message:_}}),T()},ye=()=>{n({type:"voice/session/in-flight",inFlight:!0}),wt("conversation.start"),wt("voice.session.requested")},L=()=>{const{voice:b,audio:_}=r();_.autoplayAllowed!==null&&(b.sessionInFlight||b.xaiOpen||u.xaiWs||(n({type:"voice/session/in-flight",inFlight:!0}),wt("voice.session.requested")))},ie=()=>{const{voice:b,audio:_}=r();if(!b.xaiOpen&&!b.sessionInFlight){if(_.autoplayAllowed===null){n({type:"host/voice/session/start"});return}if(_.autoplayAllowed===!1){H().then(Q=>{Q&&ye()});return}if(!_.ready){H().then(Q=>{Q&&ye()});return}ye();return}if(b.xaiOpen&&!b.paused){wt("conversation.pause"),R();return}b.xaiOpen&&b.paused&&(wt("conversation.resume"),I())},le=()=>{if(u.xaiWs)return!1;const{voice:b,audio:_}=r();return b.sessionInFlight&&b.xaiOpen?!1:_.ready?!0:(x("MICROPHONE_NOT_READY","Microphone is not ready.","Grant microphone access and try again."),!1)},ke=async b=>{if(!b?.clientSecret||!b?.model){de("VOICE_TOKEN_INVALID","Missing client secret or model.");return}if(!u.xaiWs){if(typeof b.expiresAt=="number"&&Date.now()>b.expiresAt*1e3-r0){if(m+=1,m>u0){m=0,n({type:"connection/status",status:"error"}),n({type:"voice/session/in-flight",inFlight:!1});return}wt("voice.session.requested");return}if(m=0,u.tokenExpiresAt=b.expiresAt??0,!(!le()&&!r().voice.sessionInFlight))try{const _=await C(r().audio.selectedDeviceId);u.micStream=_;const Q=_.getAudioTracks()[0];u.micTrack=Q,Xc(Q,n),Q&&n({type:"browser/mic/stream-acquired",deviceId:r().audio.selectedDeviceId??"",trackId:Q.id}),j(_),u.preOpenAudio=[],await te(_);const K=s0(b.clientSecret,n);n({type:"xai/ws/connecting"});const ee=new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(b.model)}`,[`xai-client-secret.${K}`]);u.xaiWs=ee;let ue,pe="";ee.addEventListener("open",()=>{n({type:"xai/ws/open"});for(const Pe of u.pendingSends)try{ee.send(Pe)}catch(ct){n({type:"browser/window/error",message:`xaiWs.send.pending.failed: ${je(ct)}`})}u.pendingSends=[];for(const Pe of u.preOpenAudio)try{ee.send(JSON.stringify({type:"input_audio_buffer.append",audio:Pe}))}catch(ct){n({type:"browser/window/error",message:`xaiWs.send.preOpenAudio.failed: ${je(ct)}`})}u.preOpenAudio=[],u.connectedSent||(u.connectedSent=!0,n({type:"voice/session/in-flight",inFlight:!1}),wt("voice.session.connected"))}),ee.addEventListener("message",Pe=>{let ct;try{ct=JSON.parse(String(Pe.data))}catch(yt){n({type:"browser/window/error",message:`xaiWs.in.parseError: ${je(yt)}`});return}if(ct?.type==="ping"){try{const yt=typeof ct.event_id=="string"?ct.event_id:void 0;ee.send(JSON.stringify(yt?{type:"pong",event_id:yt}:{type:"pong"}))}catch(yt){n({type:"browser/window/error",message:`xaiWs.send.pong.failed: ${je(yt)}`})}return}t0(ct),f0(ct,n),ct?.type==="response.output_audio.delta"&&typeof ct.delta=="string"&&!u.paused&&re(ct.delta)});const Ae=Pe=>{ue=Pe.code,pe=Pe.reason,n({type:"xai/ws/close",code:Pe.code,reason:Pe.reason}),u.connectedSent?(wt("voice.session.failed",{error:{code:"VOICE_WS_CLOSED",message:`xAI WS closed: code=${Pe.code}`}}),T()):de("VOICE_WS_REJECTED",`xAI WS closed before open: code=${Pe.code} reason=${Pe.reason}`)},Je=()=>{if(n({type:"xai/ws/error"}),!u.connectedSent){const Pe=ue!==void 0?` WS close code=${ue}${pe?` reason="${pe}"`:""}.`:" No close frame received before error.";de("VOICE_WS_REJECTED",`xAI WebSocket handshake failed. Attempted: wss://api.x.ai/v1/realtime with subprotocol prefix "xai-client-secret" (token not logged).${Pe} Possible causes: CORS policy, invalid/expired token, wrong subprotocol format, or origin not allowlisted.`)}};ee.addEventListener("close",Ae),ee.addEventListener("error",Je),E=()=>{ee.removeEventListener("close",Ae),ee.removeEventListener("error",Je)}}catch(_){de("VOICE_SETUP_FAILED",je(_))}}},oe=(b,_)=>{if(!b)return;if(_==="playback-drained"&&!X()){u.deferredSends.push(b);return}const Q=JSON.stringify(b),K=u.xaiWs;if(K&&r().voice.xaiOpen){try{K.send(Q)}catch(ee){n({type:"browser/window/error",message:`xaiWs.send.failed.requeue: ${je(ee)}`}),u.pendingSends.push(Q)}return}u.pendingSends.push(Q)},W=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),u.outputCtx?.state==="running"&&u.outputCtx.suspend().catch(b=>n({type:"browser/window/error",message:`outputCtx.suspend.failed: ${je(b)}`})),u.xaiWs&&r().voice.xaiOpen&&r().voice.responseActive)try{u.xaiWs.send(JSON.stringify({type:"response.cancel"}))}catch(b){n({type:"browser/window/error",message:`xaiWs.send.responseCancel.failed: ${je(b)}`})}},R=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),n({type:"voice/paused",paused:!0}),r().voice.responseActive){d!==void 0&&clearTimeout(d),d=setTimeout(()=>{d!==void 0&&(d=void 0,W())},a0);return}W()},I=()=>{d!==void 0&&(clearTimeout(d),d=void 0),u.paused=!1,u.micTrack&&(u.micTrack.enabled=!0),u.outputCtx?.state==="suspended"&&u.outputCtx.resume().catch(b=>n({type:"browser/window/error",message:`outputCtx.resume.failed: ${je(b)}`})),n({type:"voice/paused",paused:!1})},ce=async b=>{if(wt("audio.device.select",{deviceId:b}),!!u.xaiWs)try{const _=await C(b);if(u.workletNode){try{u.workletNode.port.onmessage=null,u.workletNode.disconnect()}catch(Q){n({type:"browser/window/error",message:`switchMic.worklet.disconnect.failed: ${je(Q)}`})}u.workletNode=void 0}if(u.micSourceNode)try{u.micSourceNode.disconnect()}catch(Q){n({type:"browser/window/error",message:`switchMic.micSource.disconnect.failed: ${je(Q)}`})}if(u.inputCtx){try{u.inputCtx.close()}catch(Q){n({type:"browser/window/error",message:`switchMic.inputCtx.close.failed: ${je(Q)}`})}u.inputCtx=void 0}if(u.micStream)for(const Q of u.micStream.getTracks())Q.stop();u.micStream=_,u.micTrack=_.getAudioTracks()[0],Xc(u.micTrack,n),await te(_),j(_)}catch(_){x("MICROPHONE_SWITCH_FAILED",je(_)||"Could not switch microphone.","Try a different device.")}},Ee=()=>{if(y)return;v||(v=new AudioContext),v.state==="suspended"&&v.resume().catch(_=>n({type:"browser/window/error",message:`metronome.resume.failed: ${je(_)}`}));const b=()=>{const _=v;if(!_)return;const Q=_.createOscillator(),K=_.createGain();Q.type="sine",Q.frequency.value=880;const ee=_.currentTime;K.gain.setValueAtTime(0,ee),K.gain.linearRampToValueAtTime(.05,ee+.005),K.gain.exponentialRampToValueAtTime(1e-4,ee+.08),Q.connect(K).connect(_.destination),Q.start(ee),Q.stop(ee+.1)};b(),y=setInterval(b,2e3)},k=()=>{y&&(clearInterval(y),y=void 0)};function T(){const{xaiWs:b,micStream:_,analyserCtx:Q,workletNode:K,micSourceNode:ee,inputCtx:ue,outputCtx:pe}=u;if(E&&(E(),E=void 0),b)try{b.close()}catch(Ae){n({type:"browser/window/error",message:`teardown.xaiWs.close.failed: ${je(Ae)}`})}if(K)try{K.port.onmessage=null,K.disconnect()}catch(Ae){n({type:"browser/window/error",message:`teardown.worklet.disconnect.failed: ${je(Ae)}`})}if(ee)try{ee.disconnect()}catch(Ae){n({type:"browser/window/error",message:`teardown.micSource.disconnect.failed: ${je(Ae)}`})}if(ue)try{ue.close()}catch(Ae){n({type:"browser/window/error",message:`teardown.inputCtx.close.failed: ${je(Ae)}`})}if(pe)try{pe.close()}catch(Ae){n({type:"browser/window/error",message:`teardown.outputCtx.close.failed: ${je(Ae)}`})}if(_)for(const Ae of _.getTracks())Ae.stop();if(Q)try{Q.close()}catch(Ae){n({type:"browser/window/error",message:`teardown.analyserCtx.close.failed: ${je(Ae)}`})}p!==void 0&&(clearTimeout(p),p=void 0),d!==void 0&&(clearTimeout(d),d=void 0),f&&(cancelAnimationFrame(f),f=0),s=!1,Xc(void 0,n),u=lm(),cu.fill(0)}const Y=a(b=>{switch(b.type){case"ui/click/primary":ie();break;case"host/voice/session/start":L();break;case"browser/autoplay/probed":b.allowed&&H();break;case"ui/click/reset":wt("conversation.reset"),T(),n({type:"voice/session/in-flight",inFlight:!1});break;case"ui/select/mic-device":ce(b.deviceId);break;case"host/voice/session/token":ke(b.token).catch(_=>{de("VOICE_SETUP_FAILED",je(_))});break;case"host/voice/send":oe(b.event,b.gate);break;case"host/voice/session/close":T();break;case"host/duplicate-client":T();break;case"host/state":{const _=b.data.conversationStatus;if((_==="none"||_==="ending")&&r().voice.xaiOpen&&T(),b.data.connectOnPageLoad&&!h){const{audio:Q,voice:K}=r();!Q.ready&&Q.permission!=="denied"&&!K.xaiOpen&&!K.sessionInFlight&&(h=!0,H())}break}case"host/wait-for-context/start":Ee();break;case"host/wait-for-context/end":k();break;case"xai/input-audio-buffer/speech-started":case"xai/response/cancelled":n({type:"voice/playback/cut"});break;case"voice/playback/cut":B(),p!==void 0&&(clearTimeout(p),p=void 0),u.deferredSends=[];break;case"voice/playback/drained":{const _=u.xaiWs;if(_&&r().voice.xaiOpen)for(const Q of u.deferredSends)try{_.send(JSON.stringify(Q))}catch(K){n({type:"browser/window/error",message:`xaiWs.send.deferred.failed: ${je(K)}`})}u.deferredSends=[];break}}});return()=>{Y(),k(),T()}}const im=/^[A-Za-z0-9!#$%&\'*+\\-.^_`|~]+$/;function s0(n,a){if(im.test(n))return n;const r=[...new Set(n.split("").filter(u=>!im.test(u)))].join("");return a({type:"browser/window/error",message:`voice.session.token.sanitized: unsafeChars=${r}`}),btoa(n).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")}function f0(n,a){const r=n?.type;if(typeof r!="string"){a({type:"xai/unknown",raw:n});return}const u=typeof n.item_id=="string"?n.item_id:"";switch(r){case"session.created":a({type:"xai/session/created"});return;case"session.updated":a({type:"xai/session/updated"});return;case"conversation.created":a({type:"xai/conversation/created"});return;case"conversation.item.added":{const s=n.item,f=typeof s?.role=="string"?s.role:"";a({type:"xai/conversation/item/added",itemId:u,role:f});return}case"input_audio_buffer.speech_started":a({type:"xai/input-audio-buffer/speech-started",itemId:u});return;case"input_audio_buffer.speech_stopped":a({type:"xai/input-audio-buffer/speech-stopped"});return;case"input_audio_buffer.committed":a({type:"xai/input-audio-buffer/committed"});return;case"input_audio_buffer.cleared":a({type:"xai/input-audio-buffer/cleared"});return;case"response.created":a({type:"xai/response/created"});return;case"response.done":a({type:"xai/response/done"});return;case"response.cancelled":a({type:"xai/response/cancelled"});return;case"response.failed":a({type:"xai/response/failed"});return;case"response.output_audio.delta":a({type:"xai/response/output-audio/delta",b64:""});return;case"response.output_audio.done":a({type:"xai/response/output-audio/done"});return;case"response.output_audio_transcript.delta":a({type:"xai/response/output-audio-transcript/delta",delta:""});return;case"response.output_audio_transcript.done":a({type:"xai/response/output-audio-transcript/done"});return;case"response.text.delta":a({type:"xai/response/text/delta",delta:""});return;case"response.text.done":a({type:"xai/response/text/done"});return;case"error":a({type:"xai/error",code:"",message:""});return;default:a({type:"xai/unknown",raw:n})}}function d0({dimmed:n}){const a=Ct.useRef([]);return Ct.useEffect(()=>{let r=0;const u=()=>{for(let s=0;s<a.current.length;s+=1){const f=a.current[s];f!==void 0&&f.style.setProperty("--level",String(Math.max(.1,cu[s]??.1)))}r=requestAnimationFrame(u)};return r=requestAnimationFrame(u),()=>cancelAnimationFrame(r)},[]),J.jsx("div",{className:`meters${n?" dimmed":""}`,"aria-hidden":"true",children:[0,1,2,3,4].map(r=>J.jsx("span",{className:"bar",ref:u=>{u!==null&&(a.current[r]=u)}},r))})}function h0(){const{permission:n,devices:a,selectedDeviceId:r}=St(Ts(u=>({permission:u.audio.permission,devices:u.audio.devices,selectedDeviceId:u.audio.selectedDeviceId})));return n==="denied"?J.jsxs("div",{className:"error-block",children:[J.jsx("div",{className:"error-title",children:"Microphone error"}),J.jsx("div",{children:"Microphone access denied \u2014 allow access in browser settings."}),J.jsx("button",{className:"retry",type:"button",onClick:()=>bt({type:"ui/click/primary"}),children:"Retry"})]}):a.length===0?J.jsx("div",{className:"mic-note",children:"Microphone access is required to use voice."}):J.jsxs("div",{children:[J.jsx("label",{className:"field-label",htmlFor:"micSelect",children:"Microphone"}),J.jsx("select",{id:"micSelect",value:r??a[0]?.deviceId??"",onChange:u=>bt({type:"ui/select/mic-device",deviceId:u.target.value}),children:a.map(u=>J.jsx("option",{value:u.deviceId,children:u.label},u.deviceId))})]})}function p0(){const{xaiOpen:n,xaiStatus:a,sessionInFlight:r,paused:u}=St(Ts(E=>({xaiOpen:E.voice.xaiOpen,xaiStatus:E.voice.xaiStatus,sessionInFlight:E.voice.sessionInFlight,paused:E.voice.paused}))),s=St(E=>E.connection.status),f=St(E=>E.audio.autoplayAllowed),d=St(E=>E.ui.moreActionsOpen),p=St(E=>(E.conversation.conversation?.transcript.length??0)>0);let m;!n&&!r?m="idle":r&&!n?m="connecting":n&&!u?m="active":m="paused";const h=m==="idle"||m==="paused",v=m==="connecting",y=f===!1;return J.jsxs("div",{className:"floating-tab",children:[J.jsxs("button",{className:"icon-btn",type:"button",disabled:v,"aria-label":h?"Start conversation":"Pause conversation",title:y&&h?"Click to enable audio.":void 0,onClick:()=>bt({type:"ui/click/primary"}),children:[J.jsx("span",{className:`codicon codicon-${h?"play":"debug-pause"}`,"aria-hidden":"true"}),y&&h?J.jsx("span",{className:"shield-badge codicon codicon-shield","aria-hidden":"true"}):null]}),m==="active"||m==="paused"?J.jsx("button",{className:"icon-btn",type:"button","aria-label":"Reset conversation",onClick:()=>bt({type:"ui/click/reset"}),children:J.jsx("span",{className:"codicon codicon-refresh","aria-hidden":"true"})}):null,J.jsx("button",{className:"icon-btn",type:"button","aria-label":"View transcript",onClick:()=>bt({type:"ui/click/transcript"}),children:J.jsx("span",{className:"codicon codicon-comment-discussion","aria-hidden":"true"})}),J.jsx("button",{className:"icon-btn",type:"button","aria-label":"View instructions",onClick:()=>bt({type:"ui/click/instructions"}),children:J.jsx("span",{className:"codicon codicon-book","aria-hidden":"true"})}),m==="active"?J.jsx(d0,{dimmed:!1}):null,J.jsx("div",{className:"connection",title:`Local: ${s} \xB7 xAI: ${a}`,children:J.jsxs("span",{className:"split-dot",children:[J.jsx("span",{className:`split-dot-half top ${s}`}),J.jsx("span",{className:`split-dot-half bottom ${a}`})]})}),J.jsxs("div",{style:{position:"relative"},children:[J.jsx("button",{className:"icon-btn",type:"button","aria-label":"More actions","aria-expanded":d,onClick:()=>bt({type:"ui/click/more-actions"}),children:J.jsx("span",{className:"codicon codicon-ellipsis","aria-hidden":"true"})}),d?J.jsxs("div",{className:"more-actions-popover","data-more-actions":!0,children:[J.jsx(h0,{}),J.jsx("button",{className:"menu-item",type:"button",disabled:!p,onClick:()=>bt({type:"ui/click/download-transcript"}),children:"Download transcript (JSONL)"})]}):null]})]})}function m0(n,a){const r={};return(n[n.length-1]===""?[...n,""]:n).join((r.padRight?" ":"")+","+(r.padLeft===!1?"":" ")).trim()}const g0=/^[$_\\p{ID_Start}][$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,y0=/^[$_\\p{ID_Start}][-$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,v0={};function am(n,a){return(v0.jsx?y0:g0).test(n)}const b0=/[ \\t\\n\\f\\r]/g;function S0(n){return typeof n=="object"?n.type==="text"?rm(n.value):!1:rm(n)}function rm(n){return n.replace(b0,"")===""}class Na{constructor(a,r,u){this.normal=r,this.property=a,u&&(this.space=u)}}Na.prototype.normal={};Na.prototype.property={};Na.prototype.space=void 0;function Km(n,a){const r={},u={};for(const s of n)Object.assign(r,s.property),Object.assign(u,s.normal);return new Na(r,u,a)}function ds(n){return n.toLowerCase()}class Bt{constructor(a,r){this.attribute=r,this.property=a}}Bt.prototype.attribute="";Bt.prototype.booleanish=!1;Bt.prototype.boolean=!1;Bt.prototype.commaOrSpaceSeparated=!1;Bt.prototype.commaSeparated=!1;Bt.prototype.defined=!1;Bt.prototype.mustUseProperty=!1;Bt.prototype.number=!1;Bt.prototype.overloadedBoolean=!1;Bt.prototype.property="";Bt.prototype.spaceSeparated=!1;Bt.prototype.space=void 0;let x0=0;const xe=Rl(),rt=Rl(),hs=Rl(),$=Rl(),Ze=Rl(),wi=Rl(),It=Rl();function Rl(){return 2**++x0}const ps=Object.freeze(Object.defineProperty({__proto__:null,boolean:xe,booleanish:rt,commaOrSpaceSeparated:It,commaSeparated:wi,number:$,overloadedBoolean:hs,spaceSeparated:Ze},Symbol.toStringTag,{value:"Module"})),Qc=Object.keys(ps);class Cs extends Bt{constructor(a,r,u,s){let f=-1;if(super(a,r),um(this,"space",s),typeof u=="number")for(;++f<Qc.length;){const d=Qc[f];um(this,Qc[f],(u&ps[d])===ps[d])}}}Cs.prototype.defined=!0;function um(n,a,r){r&&(n[a]=r)}function zi(n){const a={},r={};for(const[u,s]of Object.entries(n.properties)){const f=new Cs(u,n.transform(n.attributes||{},u),s,n.space);n.mustUseProperty&&n.mustUseProperty.includes(u)&&(f.mustUseProperty=!0),a[u]=f,r[ds(u)]=u,r[ds(f.attribute)]=u}return new Na(a,r,n.space)}const Jm=zi({properties:{ariaActiveDescendant:null,ariaAtomic:rt,ariaAutoComplete:null,ariaBusy:rt,ariaChecked:rt,ariaColCount:$,ariaColIndex:$,ariaColSpan:$,ariaControls:Ze,ariaCurrent:null,ariaDescribedBy:Ze,ariaDetails:null,ariaDisabled:rt,ariaDropEffect:Ze,ariaErrorMessage:null,ariaExpanded:rt,ariaFlowTo:Ze,ariaGrabbed:rt,ariaHasPopup:null,ariaHidden:rt,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:Ze,ariaLevel:$,ariaLive:null,ariaModal:rt,ariaMultiLine:rt,ariaMultiSelectable:rt,ariaOrientation:null,ariaOwns:Ze,ariaPlaceholder:null,ariaPosInSet:$,ariaPressed:rt,ariaReadOnly:rt,ariaRelevant:null,ariaRequired:rt,ariaRoleDescription:Ze,ariaRowCount:$,ariaRowIndex:$,ariaRowSpan:$,ariaSelected:rt,ariaSetSize:$,ariaSort:null,ariaValueMax:$,ariaValueMin:$,ariaValueNow:$,ariaValueText:null,role:null},transform(n,a){return a==="role"?a:"aria-"+a.slice(4).toLowerCase()}});function $m(n,a){return a in n?n[a]:a}function Wm(n,a){return $m(n,a.toLowerCase())}const E0=zi({attributes:{acceptcharset:"accept-charset",classname:"class",htmlfor:"for",httpequiv:"http-equiv"},mustUseProperty:["checked","multiple","muted","selected"],properties:{abbr:null,accept:wi,acceptCharset:Ze,accessKey:Ze,action:null,allow:null,allowFullScreen:xe,allowPaymentRequest:xe,allowUserMedia:xe,alt:null,as:null,async:xe,autoCapitalize:null,autoComplete:Ze,autoFocus:xe,autoPlay:xe,blocking:Ze,capture:null,charSet:null,checked:xe,cite:null,className:Ze,cols:$,colSpan:null,content:null,contentEditable:rt,controls:xe,controlsList:Ze,coords:$|wi,crossOrigin:null,data:null,dateTime:null,decoding:null,default:xe,defer:xe,dir:null,dirName:null,disabled:xe,download:hs,draggable:rt,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:xe,formTarget:null,headers:Ze,height:$,hidden:hs,high:$,href:null,hrefLang:null,htmlFor:Ze,httpEquiv:Ze,id:null,imageSizes:null,imageSrcSet:null,inert:xe,inputMode:null,integrity:null,is:null,isMap:xe,itemId:null,itemProp:Ze,itemRef:Ze,itemScope:xe,itemType:Ze,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:xe,low:$,manifest:null,max:null,maxLength:$,media:null,method:null,min:null,minLength:$,multiple:xe,muted:xe,name:null,nonce:null,noModule:xe,noValidate:xe,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:xe,optimum:$,pattern:null,ping:Ze,placeholder:null,playsInline:xe,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:xe,referrerPolicy:null,rel:Ze,required:xe,reversed:xe,rows:$,rowSpan:$,sandbox:Ze,scope:null,scoped:xe,seamless:xe,selected:xe,shadowRootClonable:xe,shadowRootDelegatesFocus:xe,shadowRootMode:null,shape:null,size:$,sizes:null,slot:null,span:$,spellCheck:rt,src:null,srcDoc:null,srcLang:null,srcSet:null,start:$,step:null,style:null,tabIndex:$,target:null,title:null,translate:null,type:null,typeMustMatch:xe,useMap:null,value:rt,width:$,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:Ze,axis:null,background:null,bgColor:null,border:$,borderColor:null,bottomMargin:$,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:xe,declare:xe,event:null,face:null,frame:null,frameBorder:null,hSpace:$,leftMargin:$,link:null,longDesc:null,lowSrc:null,marginHeight:$,marginWidth:$,noResize:xe,noHref:xe,noShade:xe,noWrap:xe,object:null,profile:null,prompt:null,rev:null,rightMargin:$,rules:null,scheme:null,scrolling:rt,standby:null,summary:null,text:null,topMargin:$,valueType:null,version:null,vAlign:null,vLink:null,vSpace:$,allowTransparency:null,autoCorrect:null,autoSave:null,disablePictureInPicture:xe,disableRemotePlayback:xe,prefix:null,property:null,results:$,security:null,unselectable:null},space:"html",transform:Wm}),k0=zi({attributes:{accentHeight:"accent-height",alignmentBaseline:"alignment-baseline",arabicForm:"arabic-form",baselineShift:"baseline-shift",capHeight:"cap-height",className:"class",clipPath:"clip-path",clipRule:"clip-rule",colorInterpolation:"color-interpolation",colorInterpolationFilters:"color-interpolation-filters",colorProfile:"color-profile",colorRendering:"color-rendering",crossOrigin:"crossorigin",dataType:"datatype",dominantBaseline:"dominant-baseline",enableBackground:"enable-background",fillOpacity:"fill-opacity",fillRule:"fill-rule",floodColor:"flood-color",floodOpacity:"flood-opacity",fontFamily:"font-family",fontSize:"font-size",fontSizeAdjust:"font-size-adjust",fontStretch:"font-stretch",fontStyle:"font-style",fontVariant:"font-variant",fontWeight:"font-weight",glyphName:"glyph-name",glyphOrientationHorizontal:"glyph-orientation-horizontal",glyphOrientationVertical:"glyph-orientation-vertical",hrefLang:"hreflang",horizAdvX:"horiz-adv-x",horizOriginX:"horiz-origin-x",horizOriginY:"horiz-origin-y",imageRendering:"image-rendering",letterSpacing:"letter-spacing",lightingColor:"lighting-color",markerEnd:"marker-end",markerMid:"marker-mid",markerStart:"marker-start",navDown:"nav-down",navDownLeft:"nav-down-left",navDownRight:"nav-down-right",navLeft:"nav-left",navNext:"nav-next",navPrev:"nav-prev",navRight:"nav-right",navUp:"nav-up",navUpLeft:"nav-up-left",navUpRight:"nav-up-right",onAbort:"onabort",onActivate:"onactivate",onAfterPrint:"onafterprint",onBeforePrint:"onbeforeprint",onBegin:"onbegin",onCancel:"oncancel",onCanPlay:"oncanplay",onCanPlayThrough:"oncanplaythrough",onChange:"onchange",onClick:"onclick",onClose:"onclose",onCopy:"oncopy",onCueChange:"oncuechange",onCut:"oncut",onDblClick:"ondblclick",onDrag:"ondrag",onDragEnd:"ondragend",onDragEnter:"ondragenter",onDragExit:"ondragexit",onDragLeave:"ondragleave",onDragOver:"ondragover",onDragStart:"ondragstart",onDrop:"ondrop",onDurationChange:"ondurationchange",onEmptied:"onemptied",onEnd:"onend",onEnded:"onended",onError:"onerror",onFocus:"onfocus",onFocusIn:"onfocusin",onFocusOut:"onfocusout",onHashChange:"onhashchange",onInput:"oninput",onInvalid:"oninvalid",onKeyDown:"onkeydown",onKeyPress:"onkeypress",onKeyUp:"onkeyup",onLoad:"onload",onLoadedData:"onloadeddata",onLoadedMetadata:"onloadedmetadata",onLoadStart:"onloadstart",onMessage:"onmessage",onMouseDown:"onmousedown",onMouseEnter:"onmouseenter",onMouseLeave:"onmouseleave",onMouseMove:"onmousemove",onMouseOut:"onmouseout",onMouseOver:"onmouseover",onMouseUp:"onmouseup",onMouseWheel:"onmousewheel",onOffline:"onoffline",onOnline:"ononline",onPageHide:"onpagehide",onPageShow:"onpageshow",onPaste:"onpaste",onPause:"onpause",onPlay:"onplay",onPlaying:"onplaying",onPopState:"onpopstate",onProgress:"onprogress",onRateChange:"onratechange",onRepeat:"onrepeat",onReset:"onreset",onResize:"onresize",onScroll:"onscroll",onSeeked:"onseeked",onSeeking:"onseeking",onSelect:"onselect",onShow:"onshow",onStalled:"onstalled",onStorage:"onstorage",onSubmit:"onsubmit",onSuspend:"onsuspend",onTimeUpdate:"ontimeupdate",onToggle:"ontoggle",onUnload:"onunload",onVolumeChange:"onvolumechange",onWaiting:"onwaiting",onZoom:"onzoom",overlinePosition:"overline-position",overlineThickness:"overline-thickness",paintOrder:"paint-order",panose1:"panose-1",pointerEvents:"pointer-events",referrerPolicy:"referrerpolicy",renderingIntent:"rendering-intent",shapeRendering:"shape-rendering",stopColor:"stop-color",stopOpacity:"stop-opacity",strikethroughPosition:"strikethrough-position",strikethroughThickness:"strikethrough-thickness",strokeDashArray:"stroke-dasharray",strokeDashOffset:"stroke-dashoffset",strokeLineCap:"stroke-linecap",strokeLineJoin:"stroke-linejoin",strokeMiterLimit:"stroke-miterlimit",strokeOpacity:"stroke-opacity",strokeWidth:"stroke-width",tabIndex:"tabindex",textAnchor:"text-anchor",textDecoration:"text-decoration",textRendering:"text-rendering",transformOrigin:"transform-origin",typeOf:"typeof",underlinePosition:"underline-position",underlineThickness:"underline-thickness",unicodeBidi:"unicode-bidi",unicodeRange:"unicode-range",unitsPerEm:"units-per-em",vAlphabetic:"v-alphabetic",vHanging:"v-hanging",vIdeographic:"v-ideographic",vMathematical:"v-mathematical",vectorEffect:"vector-effect",vertAdvY:"vert-adv-y",vertOriginX:"vert-origin-x",vertOriginY:"vert-origin-y",wordSpacing:"word-spacing",writingMode:"writing-mode",xHeight:"x-height",playbackOrder:"playbackorder",timelineBegin:"timelinebegin"},properties:{about:It,accentHeight:$,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:$,amplitude:$,arabicForm:null,ascent:$,attributeName:null,attributeType:null,azimuth:$,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:$,by:null,calcMode:null,capHeight:$,className:Ze,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:$,diffuseConstant:$,direction:null,display:null,dur:null,divisor:$,dominantBaseline:null,download:xe,dx:null,dy:null,edgeMode:null,editable:null,elevation:$,enableBackground:null,end:null,event:null,exponent:$,externalResourcesRequired:null,fill:null,fillOpacity:$,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:wi,g2:wi,glyphName:wi,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:$,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:$,horizOriginX:$,horizOriginY:$,id:null,ideographic:$,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:$,k:$,k1:$,k2:$,k3:$,k4:$,kernelMatrix:It,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:$,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:$,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:$,overlineThickness:$,paintOrder:null,panose1:null,path:null,pathLength:$,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:Ze,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:$,pointsAtY:$,pointsAtZ:$,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:It,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:It,rev:It,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:It,requiredFeatures:It,requiredFonts:It,requiredFormats:It,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:$,specularExponent:$,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:$,strikethroughThickness:$,string:null,stroke:null,strokeDashArray:It,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:$,strokeOpacity:$,strokeWidth:null,style:null,surfaceScale:$,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:It,tabIndex:$,tableValues:null,target:null,targetX:$,targetY:$,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:It,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:$,underlineThickness:$,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:$,values:null,vAlphabetic:$,vMathematical:$,vectorEffect:null,vHanging:$,vIdeographic:$,version:null,vertAdvY:$,vertOriginX:$,vertOriginY:$,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:$,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:"svg",transform:$m}),Pm=zi({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:"xlink",transform(n,a){return"xlink:"+a.slice(5).toLowerCase()}}),eg=zi({attributes:{xmlnsxlink:"xmlns:xlink"},properties:{xmlnsXLink:null,xmlns:null},space:"xmlns",transform:Wm}),tg=zi({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:"xml",transform(n,a){return"xml:"+a.slice(3).toLowerCase()}}),A0={classId:"classID",dataType:"datatype",itemId:"itemID",strokeDashArray:"strokeDasharray",strokeDashOffset:"strokeDashoffset",strokeLineCap:"strokeLinecap",strokeLineJoin:"strokeLinejoin",strokeMiterLimit:"strokeMiterlimit",typeOf:"typeof",xLinkActuate:"xlinkActuate",xLinkArcRole:"xlinkArcrole",xLinkHref:"xlinkHref",xLinkRole:"xlinkRole",xLinkShow:"xlinkShow",xLinkTitle:"xlinkTitle",xLinkType:"xlinkType",xmlnsXLink:"xmlnsXlink"},T0=/[A-Z]/g,om=/-[a-z]/g,w0=/^data[-\\w.:]+$/i;function C0(n,a){const r=ds(a);let u=a,s=Bt;if(r in n.normal)return n.property[n.normal[r]];if(r.length>4&&r.slice(0,4)==="data"&&w0.test(a)){if(a.charAt(4)==="-"){const f=a.slice(5).replace(om,_0);u="data"+f.charAt(0).toUpperCase()+f.slice(1)}else{const f=a.slice(4);if(!om.test(f)){let d=f.replace(T0,z0);d.charAt(0)!=="-"&&(d="-"+d),a="data"+d}}s=Cs}return new s(u,a)}function z0(n){return"-"+n.toLowerCase()}function _0(n){return n.charAt(1).toUpperCase()}const O0=Km([Jm,E0,Pm,eg,tg],"html"),zs=Km([Jm,k0,Pm,eg,tg],"svg");function D0(n){return n.join(" ").trim()}var Ei={},Zc,cm;function M0(){if(cm)return Zc;cm=1;var n=/\\/\\*[^*]*\\*+([^/*][^*]*\\*+)*\\//g,a=/\\n/g,r=/^\\s*/,u=/^(\\*?[-#/*\\\\\\w]+(\\[[0-9a-z_-]+\\])?)\\s*/,s=/^:\\s*/,f=/^((?:\'(?:\\\\\'|.)*?\'|"(?:\\\\"|.)*?"|\\([^)]*?\\)|[^};])+)/,d=/^[;\\s]*/,p=/^\\s+|\\s+$/g,m=`\n`,h="/",v="*",y="",E="comment",x="declaration";function C(j,O){if(typeof j!="string")throw new TypeError("First argument must be a string");if(!j)return[];O=O||{};var F=1,X=1;function ne(oe){var W=oe.match(a);W&&(F+=W.length);var R=oe.lastIndexOf(m);X=~R?oe.length-R:X+oe.length}function re(){var oe={line:F,column:X};return function(W){return W.position=new B(oe),ye(),W}}function B(oe){this.start=oe,this.end={line:F,column:X},this.source=O.source}B.prototype.content=j;function te(oe){var W=new Error(O.source+":"+F+":"+X+": "+oe);if(W.reason=oe,W.filename=O.source,W.line=F,W.column=X,W.source=j,!O.silent)throw W}function de(oe){var W=oe.exec(j);if(W){var R=W[0];return ne(R),j=j.slice(R.length),W}}function ye(){de(r)}function L(oe){var W;for(oe=oe||[];W=ie();)W!==!1&&oe.push(W);return oe}function ie(){var oe=re();if(!(h!=j.charAt(0)||v!=j.charAt(1))){for(var W=2;y!=j.charAt(W)&&(v!=j.charAt(W)||h!=j.charAt(W+1));)++W;if(W+=2,y===j.charAt(W-1))return te("End of comment missing");var R=j.slice(2,W-2);return X+=2,ne(R),j=j.slice(W),X+=2,oe({type:E,comment:R})}}function le(){var oe=re(),W=de(u);if(W){if(ie(),!de(s))return te("property missing \':\'");var R=de(f),I=oe({type:x,property:H(W[0].replace(n,y)),value:R?H(R[0].replace(n,y)):y});return de(d),I}}function ke(){var oe=[];L(oe);for(var W;W=le();)W!==!1&&(oe.push(W),L(oe));return oe}return ye(),ke()}function H(j){return j?j.replace(p,y):y}return Zc=C,Zc}var sm;function R0(){if(sm)return Ei;sm=1;var n=Ei&&Ei.__importDefault||function(u){return u&&u.__esModule?u:{default:u}};Object.defineProperty(Ei,"__esModule",{value:!0}),Ei.default=r;const a=n(M0());function r(u,s){let f=null;if(!u||typeof u!="string")return f;const d=(0,a.default)(u),p=typeof s=="function";return d.forEach(m=>{if(m.type!=="declaration")return;const{property:h,value:v}=m;p?s(h,v,m):v&&(f=f||{},f[h]=v)}),f}return Ei}var Aa={},fm;function N0(){if(fm)return Aa;fm=1,Object.defineProperty(Aa,"__esModule",{value:!0}),Aa.camelCase=void 0;var n=/^--[a-zA-Z0-9_-]+$/,a=/-([a-z])/g,r=/^[^-]+$/,u=/^-(webkit|moz|ms|o|khtml)-/,s=/^-(ms)-/,f=function(h){return!h||r.test(h)||n.test(h)},d=function(h,v){return v.toUpperCase()},p=function(h,v){return"".concat(v,"-")},m=function(h,v){return v===void 0&&(v={}),f(h)?h:(h=h.toLowerCase(),v.reactCompat?h=h.replace(s,p):h=h.replace(u,p),h.replace(a,d))};return Aa.camelCase=m,Aa}var Ta,dm;function L0(){if(dm)return Ta;dm=1;var n=Ta&&Ta.__importDefault||function(s){return s&&s.__esModule?s:{default:s}},a=n(R0()),r=N0();function u(s,f){var d={};return!s||typeof s!="string"||(0,a.default)(s,function(p,m){p&&m&&(d[(0,r.camelCase)(p,f)]=m)}),d}return u.default=u,Ta=u,Ta}var U0=L0();const j0=ks(U0),ng=lg("end"),_s=lg("start");function lg(n){return a;function a(r){const u=r&&r.position&&r.position[n]||{};if(typeof u.line=="number"&&u.line>0&&typeof u.column=="number"&&u.column>0)return{line:u.line,column:u.column,offset:typeof u.offset=="number"&&u.offset>-1?u.offset:void 0}}}function B0(n){const a=_s(n),r=ng(n);if(a&&r)return{start:a,end:r}}function _a(n){return!n||typeof n!="object"?"":"position"in n||"type"in n?hm(n.position):"start"in n||"end"in n?hm(n):"line"in n||"column"in n?ms(n):""}function ms(n){return pm(n&&n.line)+":"+pm(n&&n.column)}function hm(n){return ms(n&&n.start)+"-"+ms(n&&n.end)}function pm(n){return n&&typeof n=="number"?n:1}class Et extends Error{constructor(a,r,u){super(),typeof r=="string"&&(u=r,r=void 0);let s="",f={},d=!1;if(r&&("line"in r&&"column"in r?f={place:r}:"start"in r&&"end"in r?f={place:r}:"type"in r?f={ancestors:[r],place:r.position}:f={...r}),typeof a=="string"?s=a:!f.cause&&a&&(d=!0,s=a.message,f.cause=a),!f.ruleId&&!f.source&&typeof u=="string"){const m=u.indexOf(":");m===-1?f.ruleId=u:(f.source=u.slice(0,m),f.ruleId=u.slice(m+1))}if(!f.place&&f.ancestors&&f.ancestors){const m=f.ancestors[f.ancestors.length-1];m&&(f.place=m.position)}const p=f.place&&"start"in f.place?f.place.start:f.place;this.ancestors=f.ancestors||void 0,this.cause=f.cause||void 0,this.column=p?p.column:void 0,this.fatal=void 0,this.file="",this.message=s,this.line=p?p.line:void 0,this.name=_a(f.place)||"1:1",this.place=f.place||void 0,this.reason=this.message,this.ruleId=f.ruleId||void 0,this.source=f.source||void 0,this.stack=d&&f.cause&&typeof f.cause.stack=="string"?f.cause.stack:"",this.actual=void 0,this.expected=void 0,this.note=void 0,this.url=void 0}}Et.prototype.file="";Et.prototype.name="";Et.prototype.reason="";Et.prototype.message="";Et.prototype.stack="";Et.prototype.column=void 0;Et.prototype.line=void 0;Et.prototype.ancestors=void 0;Et.prototype.cause=void 0;Et.prototype.fatal=void 0;Et.prototype.place=void 0;Et.prototype.ruleId=void 0;Et.prototype.source=void 0;const Os={}.hasOwnProperty,H0=new Map,q0=/[A-Z]/g,Y0=new Set(["table","tbody","thead","tfoot","tr"]),V0=new Set(["td","th"]),ig="https://github.com/syntax-tree/hast-util-to-jsx-runtime";function G0(n,a){if(!a||a.Fragment===void 0)throw new TypeError("Expected `Fragment` in options");const r=a.filePath||void 0;let u;if(a.development){if(typeof a.jsxDEV!="function")throw new TypeError("Expected `jsxDEV` in options when `development: true`");u=$0(r,a.jsxDEV)}else{if(typeof a.jsx!="function")throw new TypeError("Expected `jsx` in production options");if(typeof a.jsxs!="function")throw new TypeError("Expected `jsxs` in production options");u=J0(r,a.jsx,a.jsxs)}const s={Fragment:a.Fragment,ancestors:[],components:a.components||{},create:u,elementAttributeNameCase:a.elementAttributeNameCase||"react",evaluater:a.createEvaluater?a.createEvaluater():void 0,filePath:r,ignoreInvalidStyle:a.ignoreInvalidStyle||!1,passKeys:a.passKeys!==!1,passNode:a.passNode||!1,schema:a.space==="svg"?zs:O0,stylePropertyNameCase:a.stylePropertyNameCase||"dom",tableCellAlignToStyle:a.tableCellAlignToStyle!==!1},f=ag(s,n,void 0);return f&&typeof f!="string"?f:s.create(n,s.Fragment,{children:f||void 0},void 0)}function ag(n,a,r){if(a.type==="element")return X0(n,a,r);if(a.type==="mdxFlowExpression"||a.type==="mdxTextExpression")return Q0(n,a);if(a.type==="mdxJsxFlowElement"||a.type==="mdxJsxTextElement")return I0(n,a,r);if(a.type==="mdxjsEsm")return Z0(n,a);if(a.type==="root")return F0(n,a,r);if(a.type==="text")return K0(n,a)}function X0(n,a,r){const u=n.schema;let s=u;a.tagName.toLowerCase()==="svg"&&u.space==="html"&&(s=zs,n.schema=s),n.ancestors.push(a);const f=ug(n,a.tagName,!1),d=W0(n,a);let p=Ms(n,a);return Y0.has(a.tagName)&&(p=p.filter(function(m){return typeof m=="string"?!S0(m):!0})),rg(n,d,f,a),Ds(d,p),n.ancestors.pop(),n.schema=u,n.create(a,f,d,r)}function Q0(n,a){if(a.data&&a.data.estree&&n.evaluater){const u=a.data.estree.body[0];return u.type,n.evaluater.evaluateExpression(u.expression)}Ma(n,a.position)}function Z0(n,a){if(a.data&&a.data.estree&&n.evaluater)return n.evaluater.evaluateProgram(a.data.estree);Ma(n,a.position)}function I0(n,a,r){const u=n.schema;let s=u;a.name==="svg"&&u.space==="html"&&(s=zs,n.schema=s),n.ancestors.push(a);const f=a.name===null?n.Fragment:ug(n,a.name,!0),d=P0(n,a),p=Ms(n,a);return rg(n,d,f,a),Ds(d,p),n.ancestors.pop(),n.schema=u,n.create(a,f,d,r)}function F0(n,a,r){const u={};return Ds(u,Ms(n,a)),n.create(a,n.Fragment,u,r)}function K0(n,a){return a.value}function rg(n,a,r,u){typeof r!="string"&&r!==n.Fragment&&n.passNode&&(a.node=u)}function Ds(n,a){if(a.length>0){const r=a.length>1?a:a[0];r&&(n.children=r)}}function J0(n,a,r){return u;function u(s,f,d,p){const h=Array.isArray(d.children)?r:a;return p?h(f,d,p):h(f,d)}}function $0(n,a){return r;function r(u,s,f,d){const p=Array.isArray(f.children),m=_s(u);return a(s,f,d,p,{columnNumber:m?m.column-1:void 0,fileName:n,lineNumber:m?m.line:void 0},void 0)}}function W0(n,a){const r={};let u,s;for(s in a.properties)if(s!=="children"&&Os.call(a.properties,s)){const f=eb(n,s,a.properties[s]);if(f){const[d,p]=f;n.tableCellAlignToStyle&&d==="align"&&typeof p=="string"&&V0.has(a.tagName)?u=p:r[d]=p}}if(u){const f=r.style||(r.style={});f[n.stylePropertyNameCase==="css"?"text-align":"textAlign"]=u}return r}function P0(n,a){const r={};for(const u of a.attributes)if(u.type==="mdxJsxExpressionAttribute")if(u.data&&u.data.estree&&n.evaluater){const f=u.data.estree.body[0];f.type;const d=f.expression;d.type;const p=d.properties[0];p.type,Object.assign(r,n.evaluater.evaluateExpression(p.argument))}else Ma(n,a.position);else{const s=u.name;let f;if(u.value&&typeof u.value=="object")if(u.value.data&&u.value.data.estree&&n.evaluater){const p=u.value.data.estree.body[0];p.type,f=n.evaluater.evaluateExpression(p.expression)}else Ma(n,a.position);else f=u.value===null?!0:u.value;r[s]=f}return r}function Ms(n,a){const r=[];let u=-1;const s=n.passKeys?new Map:H0;for(;++u<a.children.length;){const f=a.children[u];let d;if(n.passKeys){const m=f.type==="element"?f.tagName:f.type==="mdxJsxFlowElement"||f.type==="mdxJsxTextElement"?f.name:void 0;if(m){const h=s.get(m)||0;d=m+"-"+h,s.set(m,h+1)}}const p=ag(n,f,d);p!==void 0&&r.push(p)}return r}function eb(n,a,r){const u=C0(n.schema,a);if(!(r==null||typeof r=="number"&&Number.isNaN(r))){if(Array.isArray(r)&&(r=u.commaSeparated?m0(r):D0(r)),u.property==="style"){let s=typeof r=="object"?r:tb(n,String(r));return n.stylePropertyNameCase==="css"&&(s=nb(s)),["style",s]}return[n.elementAttributeNameCase==="react"&&u.space?A0[u.property]||u.property:u.attribute,r]}}function tb(n,a){try{return j0(a,{reactCompat:!0})}catch(r){if(n.ignoreInvalidStyle)return{};const u=r,s=new Et("Cannot parse `style` attribute",{ancestors:n.ancestors,cause:u,ruleId:"style",source:"hast-util-to-jsx-runtime"});throw s.file=n.filePath||void 0,s.url=ig+"#cannot-parse-style-attribute",s}}function ug(n,a,r){let u;if(!r)u={type:"Literal",value:a};else if(a.includes(".")){const s=a.split(".");let f=-1,d;for(;++f<s.length;){const p=am(s[f])?{type:"Identifier",name:s[f]}:{type:"Literal",value:s[f]};d=d?{type:"MemberExpression",object:d,property:p,computed:!!(f&&p.type==="Literal"),optional:!1}:p}u=d}else u=am(a)&&!/^[a-z]/.test(a)?{type:"Identifier",name:a}:{type:"Literal",value:a};if(u.type==="Literal"){const s=u.value;return Os.call(n.components,s)?n.components[s]:s}if(n.evaluater)return n.evaluater.evaluateExpression(u);Ma(n)}function Ma(n,a){const r=new Et("Cannot handle MDX estrees without `createEvaluater`",{ancestors:n.ancestors,place:a,ruleId:"mdx-estree",source:"hast-util-to-jsx-runtime"});throw r.file=n.filePath||void 0,r.url=ig+"#cannot-handle-mdx-estrees-without-createevaluater",r}function nb(n){const a={};let r;for(r in n)Os.call(n,r)&&(a[lb(r)]=n[r]);return a}function lb(n){let a=n.replace(q0,ib);return a.slice(0,3)==="ms-"&&(a="-"+a),a}function ib(n){return"-"+n.toLowerCase()}const Ic={action:["form"],cite:["blockquote","del","ins","q"],data:["object"],formAction:["button","input"],href:["a","area","base","link"],icon:["menuitem"],itemId:null,manifest:["html"],ping:["a","area"],poster:["video"],src:["audio","embed","iframe","img","input","script","source","track","video"]},ab={};function Rs(n,a){const r=ab,u=typeof r.includeImageAlt=="boolean"?r.includeImageAlt:!0,s=typeof r.includeHtml=="boolean"?r.includeHtml:!0;return og(n,u,s)}function og(n,a,r){if(rb(n)){if("value"in n)return n.type==="html"&&!r?"":n.value;if(a&&"alt"in n&&n.alt)return n.alt;if("children"in n)return mm(n.children,a,r)}return Array.isArray(n)?mm(n,a,r):""}function mm(n,a,r){const u=[];let s=-1;for(;++s<n.length;)u[s]=og(n[s],a,r);return u.join("")}function rb(n){return!!(n&&typeof n=="object")}const gm=document.createElement("i");function Ns(n){const a="&"+n+";";gm.innerHTML=a;const r=gm.textContent;return r.charCodeAt(r.length-1)===59&&n!=="semi"||r===a?!1:r}function Ft(n,a,r,u){const s=n.length;let f=0,d;if(a<0?a=-a>s?0:s+a:a=a>s?s:a,r=r>0?r:0,u.length<1e4)d=Array.from(u),d.unshift(a,r),n.splice(...d);else for(r&&n.splice(a,r);f<u.length;)d=u.slice(f,f+1e4),d.unshift(a,0),n.splice(...d),f+=1e4,a+=1e4}function rn(n,a){return n.length>0?(Ft(n,n.length,0,a),n):a}const ym={}.hasOwnProperty;function cg(n){const a={};let r=-1;for(;++r<n.length;)ub(a,n[r]);return a}function ub(n,a){let r;for(r in a){const s=(ym.call(n,r)?n[r]:void 0)||(n[r]={}),f=a[r];let d;if(f)for(d in f){ym.call(s,d)||(s[d]=[]);const p=f[d];ob(s[d],Array.isArray(p)?p:p?[p]:[])}}}function ob(n,a){let r=-1;const u=[];for(;++r<a.length;)(a[r].add==="after"?n:u).push(a[r]);Ft(n,0,0,u)}function sg(n,a){const r=Number.parseInt(n,a);return r<9||r===11||r>13&&r<32||r>126&&r<160||r>55295&&r<57344||r>64975&&r<65008||(r&65535)===65535||(r&65535)===65534||r>1114111?"\uFFFD":String.fromCodePoint(r)}function fn(n){return n.replace(/[\\t\\n\\r ]+/g," ").replace(/^ | $/g,"").toLowerCase().toUpperCase()}const zt=fl(/[A-Za-z]/),xt=fl(/[\\dA-Za-z]/),cb=fl(/[#-\'*+\\--9=?A-Z^-~]/);function du(n){return n!==null&&(n<32||n===127)}const gs=fl(/\\d/),sb=fl(/[\\dA-Fa-f]/),fb=fl(/[!-/:-@[-`{-~]/);function he(n){return n!==null&&n<-2}function Qe(n){return n!==null&&(n<0||n===32)}function ze(n){return n===-2||n===-1||n===32}const gu=fl(/\\p{P}|\\p{S}/u),Ml=fl(/\\s/);function fl(n){return a;function a(r){return r!==null&&r>-1&&n.test(String.fromCharCode(r))}}function _i(n){const a=[];let r=-1,u=0,s=0;for(;++r<n.length;){const f=n.charCodeAt(r);let d="";if(f===37&&xt(n.charCodeAt(r+1))&&xt(n.charCodeAt(r+2)))s=2;else if(f<128)/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(f))||(d=String.fromCharCode(f));else if(f>55295&&f<57344){const p=n.charCodeAt(r+1);f<56320&&p>56319&&p<57344?(d=String.fromCharCode(f,p),s=1):d="\uFFFD"}else d=String.fromCharCode(f);d&&(a.push(n.slice(u,r),encodeURIComponent(d)),u=r+s+1,d=""),s&&(r+=s,s=0)}return a.join("")+n.slice(u)}function Me(n,a,r,u){const s=u?u-1:Number.POSITIVE_INFINITY;let f=0;return d;function d(m){return ze(m)?(n.enter(r),p(m)):a(m)}function p(m){return ze(m)&&f++<s?(n.consume(m),p):(n.exit(r),a(m))}}const db={tokenize:hb};function hb(n){const a=n.attempt(this.parser.constructs.contentInitial,u,s);let r;return a;function u(p){if(p===null){n.consume(p);return}return n.enter("lineEnding"),n.consume(p),n.exit("lineEnding"),Me(n,a,"linePrefix")}function s(p){return n.enter("paragraph"),f(p)}function f(p){const m=n.enter("chunkText",{contentType:"text",previous:r});return r&&(r.next=m),r=m,d(p)}function d(p){if(p===null){n.exit("chunkText"),n.exit("paragraph"),n.consume(p);return}return he(p)?(n.consume(p),n.exit("chunkText"),f):(n.consume(p),d)}}const pb={tokenize:mb},vm={tokenize:gb};function mb(n){const a=this,r=[];let u=0,s,f,d;return p;function p(X){if(u<r.length){const ne=r[u];return a.containerState=ne[1],n.attempt(ne[0].continuation,m,h)(X)}return h(X)}function m(X){if(u++,a.containerState._closeFlow){a.containerState._closeFlow=void 0,s&&F();const ne=a.events.length;let re=ne,B;for(;re--;)if(a.events[re][0]==="exit"&&a.events[re][1].type==="chunkFlow"){B=a.events[re][1].end;break}O(u);let te=ne;for(;te<a.events.length;)a.events[te][1].end={...B},te++;return Ft(a.events,re+1,0,a.events.slice(ne)),a.events.length=te,h(X)}return p(X)}function h(X){if(u===r.length){if(!s)return E(X);if(s.currentConstruct&&s.currentConstruct.concrete)return C(X);a.interrupt=!!(s.currentConstruct&&!s._gfmTableDynamicInterruptHack)}return a.containerState={},n.check(vm,v,y)(X)}function v(X){return s&&F(),O(u),E(X)}function y(X){return a.parser.lazy[a.now().line]=u!==r.length,d=a.now().offset,C(X)}function E(X){return a.containerState={},n.attempt(vm,x,C)(X)}function x(X){return u++,r.push([a.currentConstruct,a.containerState]),E(X)}function C(X){if(X===null){s&&F(),O(0),n.consume(X);return}return s=s||a.parser.flow(a.now()),n.enter("chunkFlow",{_tokenizer:s,contentType:"flow",previous:f}),H(X)}function H(X){if(X===null){j(n.exit("chunkFlow"),!0),O(0),n.consume(X);return}return he(X)?(n.consume(X),j(n.exit("chunkFlow")),u=0,a.interrupt=void 0,p):(n.consume(X),H)}function j(X,ne){const re=a.sliceStream(X);if(ne&&re.push(null),X.previous=f,f&&(f.next=X),f=X,s.defineSkip(X.start),s.write(re),a.parser.lazy[X.start.line]){let B=s.events.length;for(;B--;)if(s.events[B][1].start.offset<d&&(!s.events[B][1].end||s.events[B][1].end.offset>d))return;const te=a.events.length;let de=te,ye,L;for(;de--;)if(a.events[de][0]==="exit"&&a.events[de][1].type==="chunkFlow"){if(ye){L=a.events[de][1].end;break}ye=!0}for(O(u),B=te;B<a.events.length;)a.events[B][1].end={...L},B++;Ft(a.events,de+1,0,a.events.slice(te)),a.events.length=B}}function O(X){let ne=r.length;for(;ne-- >X;){const re=r[ne];a.containerState=re[1],re[0].exit.call(a,n)}r.length=X}function F(){s.write([null]),f=void 0,s=void 0,a.containerState._closeFlow=void 0}}function gb(n,a,r){return Me(n,n.attempt(this.parser.constructs.document,a,r),"linePrefix",this.parser.constructs.disable.null.includes("codeIndented")?void 0:4)}function Ci(n){if(n===null||Qe(n)||Ml(n))return 1;if(gu(n))return 2}function yu(n,a,r){const u=[];let s=-1;for(;++s<n.length;){const f=n[s].resolveAll;f&&!u.includes(f)&&(a=f(a,r),u.push(f))}return a}const ys={name:"attention",resolveAll:yb,tokenize:vb};function yb(n,a){let r=-1,u,s,f,d,p,m,h,v;for(;++r<n.length;)if(n[r][0]==="enter"&&n[r][1].type==="attentionSequence"&&n[r][1]._close){for(u=r;u--;)if(n[u][0]==="exit"&&n[u][1].type==="attentionSequence"&&n[u][1]._open&&a.sliceSerialize(n[u][1]).charCodeAt(0)===a.sliceSerialize(n[r][1]).charCodeAt(0)){if((n[u][1]._close||n[r][1]._open)&&(n[r][1].end.offset-n[r][1].start.offset)%3&&!((n[u][1].end.offset-n[u][1].start.offset+n[r][1].end.offset-n[r][1].start.offset)%3))continue;m=n[u][1].end.offset-n[u][1].start.offset>1&&n[r][1].end.offset-n[r][1].start.offset>1?2:1;const y={...n[u][1].end},E={...n[r][1].start};bm(y,-m),bm(E,m),d={type:m>1?"strongSequence":"emphasisSequence",start:y,end:{...n[u][1].end}},p={type:m>1?"strongSequence":"emphasisSequence",start:{...n[r][1].start},end:E},f={type:m>1?"strongText":"emphasisText",start:{...n[u][1].end},end:{...n[r][1].start}},s={type:m>1?"strong":"emphasis",start:{...d.start},end:{...p.end}},n[u][1].end={...d.start},n[r][1].start={...p.end},h=[],n[u][1].end.offset-n[u][1].start.offset&&(h=rn(h,[["enter",n[u][1],a],["exit",n[u][1],a]])),h=rn(h,[["enter",s,a],["enter",d,a],["exit",d,a],["enter",f,a]]),h=rn(h,yu(a.parser.constructs.insideSpan.null,n.slice(u+1,r),a)),h=rn(h,[["exit",f,a],["enter",p,a],["exit",p,a],["exit",s,a]]),n[r][1].end.offset-n[r][1].start.offset?(v=2,h=rn(h,[["enter",n[r][1],a],["exit",n[r][1],a]])):v=0,Ft(n,u-1,r-u+3,h),r=u+h.length-v-2;break}}for(r=-1;++r<n.length;)n[r][1].type==="attentionSequence"&&(n[r][1].type="data");return n}function vb(n,a){const r=this.parser.constructs.attentionMarkers.null,u=this.previous,s=Ci(u);let f;return d;function d(m){return f=m,n.enter("attentionSequence"),p(m)}function p(m){if(m===f)return n.consume(m),p;const h=n.exit("attentionSequence"),v=Ci(m),y=!v||v===2&&s||r.includes(m),E=!s||s===2&&v||r.includes(u);return h._open=!!(f===42?y:y&&(s||!E)),h._close=!!(f===42?E:E&&(v||!y)),a(m)}}function bm(n,a){n.column+=a,n.offset+=a,n._bufferIndex+=a}const bb={name:"autolink",tokenize:Sb};function Sb(n,a,r){let u=0;return s;function s(x){return n.enter("autolink"),n.enter("autolinkMarker"),n.consume(x),n.exit("autolinkMarker"),n.enter("autolinkProtocol"),f}function f(x){return zt(x)?(n.consume(x),d):x===64?r(x):h(x)}function d(x){return x===43||x===45||x===46||xt(x)?(u=1,p(x)):h(x)}function p(x){return x===58?(n.consume(x),u=0,m):(x===43||x===45||x===46||xt(x))&&u++<32?(n.consume(x),p):(u=0,h(x))}function m(x){return x===62?(n.exit("autolinkProtocol"),n.enter("autolinkMarker"),n.consume(x),n.exit("autolinkMarker"),n.exit("autolink"),a):x===null||x===32||x===60||du(x)?r(x):(n.consume(x),m)}function h(x){return x===64?(n.consume(x),v):cb(x)?(n.consume(x),h):r(x)}function v(x){return xt(x)?y(x):r(x)}function y(x){return x===46?(n.consume(x),u=0,v):x===62?(n.exit("autolinkProtocol").type="autolinkEmail",n.enter("autolinkMarker"),n.consume(x),n.exit("autolinkMarker"),n.exit("autolink"),a):E(x)}function E(x){if((x===45||xt(x))&&u++<63){const C=x===45?E:y;return n.consume(x),C}return r(x)}}const La={partial:!0,tokenize:xb};function xb(n,a,r){return u;function u(f){return ze(f)?Me(n,s,"linePrefix")(f):s(f)}function s(f){return f===null||he(f)?a(f):r(f)}}const fg={continuation:{tokenize:kb},exit:Ab,name:"blockQuote",tokenize:Eb};function Eb(n,a,r){const u=this;return s;function s(d){if(d===62){const p=u.containerState;return p.open||(n.enter("blockQuote",{_container:!0}),p.open=!0),n.enter("blockQuotePrefix"),n.enter("blockQuoteMarker"),n.consume(d),n.exit("blockQuoteMarker"),f}return r(d)}function f(d){return ze(d)?(n.enter("blockQuotePrefixWhitespace"),n.consume(d),n.exit("blockQuotePrefixWhitespace"),n.exit("blockQuotePrefix"),a):(n.exit("blockQuotePrefix"),a(d))}}function kb(n,a,r){const u=this;return s;function s(d){return ze(d)?Me(n,f,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(d):f(d)}function f(d){return n.attempt(fg,a,r)(d)}}function Ab(n){n.exit("blockQuote")}const dg={name:"characterEscape",tokenize:Tb};function Tb(n,a,r){return u;function u(f){return n.enter("characterEscape"),n.enter("escapeMarker"),n.consume(f),n.exit("escapeMarker"),s}function s(f){return fb(f)?(n.enter("characterEscapeValue"),n.consume(f),n.exit("characterEscapeValue"),n.exit("characterEscape"),a):r(f)}}const hg={name:"characterReference",tokenize:wb};function wb(n,a,r){const u=this;let s=0,f,d;return p;function p(y){return n.enter("characterReference"),n.enter("characterReferenceMarker"),n.consume(y),n.exit("characterReferenceMarker"),m}function m(y){return y===35?(n.enter("characterReferenceMarkerNumeric"),n.consume(y),n.exit("characterReferenceMarkerNumeric"),h):(n.enter("characterReferenceValue"),f=31,d=xt,v(y))}function h(y){return y===88||y===120?(n.enter("characterReferenceMarkerHexadecimal"),n.consume(y),n.exit("characterReferenceMarkerHexadecimal"),n.enter("characterReferenceValue"),f=6,d=sb,v):(n.enter("characterReferenceValue"),f=7,d=gs,v(y))}function v(y){if(y===59&&s){const E=n.exit("characterReferenceValue");return d===xt&&!Ns(u.sliceSerialize(E))?r(y):(n.enter("characterReferenceMarker"),n.consume(y),n.exit("characterReferenceMarker"),n.exit("characterReference"),a)}return d(y)&&s++<f?(n.consume(y),v):r(y)}}const Sm={partial:!0,tokenize:zb},xm={concrete:!0,name:"codeFenced",tokenize:Cb};function Cb(n,a,r){const u=this,s={partial:!0,tokenize:re};let f=0,d=0,p;return m;function m(B){return h(B)}function h(B){const te=u.events[u.events.length-1];return f=te&&te[1].type==="linePrefix"?te[2].sliceSerialize(te[1],!0).length:0,p=B,n.enter("codeFenced"),n.enter("codeFencedFence"),n.enter("codeFencedFenceSequence"),v(B)}function v(B){return B===p?(d++,n.consume(B),v):d<3?r(B):(n.exit("codeFencedFenceSequence"),ze(B)?Me(n,y,"whitespace")(B):y(B))}function y(B){return B===null||he(B)?(n.exit("codeFencedFence"),u.interrupt?a(B):n.check(Sm,H,ne)(B)):(n.enter("codeFencedFenceInfo"),n.enter("chunkString",{contentType:"string"}),E(B))}function E(B){return B===null||he(B)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),y(B)):ze(B)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),Me(n,x,"whitespace")(B)):B===96&&B===p?r(B):(n.consume(B),E)}function x(B){return B===null||he(B)?y(B):(n.enter("codeFencedFenceMeta"),n.enter("chunkString",{contentType:"string"}),C(B))}function C(B){return B===null||he(B)?(n.exit("chunkString"),n.exit("codeFencedFenceMeta"),y(B)):B===96&&B===p?r(B):(n.consume(B),C)}function H(B){return n.attempt(s,ne,j)(B)}function j(B){return n.enter("lineEnding"),n.consume(B),n.exit("lineEnding"),O}function O(B){return f>0&&ze(B)?Me(n,F,"linePrefix",f+1)(B):F(B)}function F(B){return B===null||he(B)?n.check(Sm,H,ne)(B):(n.enter("codeFlowValue"),X(B))}function X(B){return B===null||he(B)?(n.exit("codeFlowValue"),F(B)):(n.consume(B),X)}function ne(B){return n.exit("codeFenced"),a(B)}function re(B,te,de){let ye=0;return L;function L(W){return B.enter("lineEnding"),B.consume(W),B.exit("lineEnding"),ie}function ie(W){return B.enter("codeFencedFence"),ze(W)?Me(B,le,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(W):le(W)}function le(W){return W===p?(B.enter("codeFencedFenceSequence"),ke(W)):de(W)}function ke(W){return W===p?(ye++,B.consume(W),ke):ye>=d?(B.exit("codeFencedFenceSequence"),ze(W)?Me(B,oe,"whitespace")(W):oe(W)):de(W)}function oe(W){return W===null||he(W)?(B.exit("codeFencedFence"),te(W)):de(W)}}}function zb(n,a,r){const u=this;return s;function s(d){return d===null?r(d):(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f)}function f(d){return u.parser.lazy[u.now().line]?r(d):a(d)}}const Fc={name:"codeIndented",tokenize:Ob},_b={partial:!0,tokenize:Db};function Ob(n,a,r){const u=this;return s;function s(h){return n.enter("codeIndented"),Me(n,f,"linePrefix",5)(h)}function f(h){const v=u.events[u.events.length-1];return v&&v[1].type==="linePrefix"&&v[2].sliceSerialize(v[1],!0).length>=4?d(h):r(h)}function d(h){return h===null?m(h):he(h)?n.attempt(_b,d,m)(h):(n.enter("codeFlowValue"),p(h))}function p(h){return h===null||he(h)?(n.exit("codeFlowValue"),d(h)):(n.consume(h),p)}function m(h){return n.exit("codeIndented"),a(h)}}function Db(n,a,r){const u=this;return s;function s(d){return u.parser.lazy[u.now().line]?r(d):he(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),s):Me(n,f,"linePrefix",5)(d)}function f(d){const p=u.events[u.events.length-1];return p&&p[1].type==="linePrefix"&&p[2].sliceSerialize(p[1],!0).length>=4?a(d):he(d)?s(d):r(d)}}const Mb={name:"codeText",previous:Nb,resolve:Rb,tokenize:Lb};function Rb(n){let a=n.length-4,r=3,u,s;if((n[r][1].type==="lineEnding"||n[r][1].type==="space")&&(n[a][1].type==="lineEnding"||n[a][1].type==="space")){for(u=r;++u<a;)if(n[u][1].type==="codeTextData"){n[r][1].type="codeTextPadding",n[a][1].type="codeTextPadding",r+=2,a-=2;break}}for(u=r-1,a++;++u<=a;)s===void 0?u!==a&&n[u][1].type!=="lineEnding"&&(s=u):(u===a||n[u][1].type==="lineEnding")&&(n[s][1].type="codeTextData",u!==s+2&&(n[s][1].end=n[u-1][1].end,n.splice(s+2,u-s-2),a-=u-s-2,u=s+2),s=void 0);return n}function Nb(n){return n!==96||this.events[this.events.length-1][1].type==="characterEscape"}function Lb(n,a,r){let u=0,s,f;return d;function d(y){return n.enter("codeText"),n.enter("codeTextSequence"),p(y)}function p(y){return y===96?(n.consume(y),u++,p):(n.exit("codeTextSequence"),m(y))}function m(y){return y===null?r(y):y===32?(n.enter("space"),n.consume(y),n.exit("space"),m):y===96?(f=n.enter("codeTextSequence"),s=0,v(y)):he(y)?(n.enter("lineEnding"),n.consume(y),n.exit("lineEnding"),m):(n.enter("codeTextData"),h(y))}function h(y){return y===null||y===32||y===96||he(y)?(n.exit("codeTextData"),m(y)):(n.consume(y),h)}function v(y){return y===96?(n.consume(y),s++,v):s===u?(n.exit("codeTextSequence"),n.exit("codeText"),a(y)):(f.type="codeTextData",h(y))}}class Ub{constructor(a){this.left=a?[...a]:[],this.right=[]}get(a){if(a<0||a>=this.left.length+this.right.length)throw new RangeError("Cannot access index `"+a+"` in a splice buffer of size `"+(this.left.length+this.right.length)+"`");return a<this.left.length?this.left[a]:this.right[this.right.length-a+this.left.length-1]}get length(){return this.left.length+this.right.length}shift(){return this.setCursor(0),this.right.pop()}slice(a,r){const u=r??Number.POSITIVE_INFINITY;return u<this.left.length?this.left.slice(a,u):a>this.left.length?this.right.slice(this.right.length-u+this.left.length,this.right.length-a+this.left.length).reverse():this.left.slice(a).concat(this.right.slice(this.right.length-u+this.left.length).reverse())}splice(a,r,u){const s=r||0;this.setCursor(Math.trunc(a));const f=this.right.splice(this.right.length-s,Number.POSITIVE_INFINITY);return u&&wa(this.left,u),f.reverse()}pop(){return this.setCursor(Number.POSITIVE_INFINITY),this.left.pop()}push(a){this.setCursor(Number.POSITIVE_INFINITY),this.left.push(a)}pushMany(a){this.setCursor(Number.POSITIVE_INFINITY),wa(this.left,a)}unshift(a){this.setCursor(0),this.right.push(a)}unshiftMany(a){this.setCursor(0),wa(this.right,a.reverse())}setCursor(a){if(!(a===this.left.length||a>this.left.length&&this.right.length===0||a<0&&this.left.length===0))if(a<this.left.length){const r=this.left.splice(a,Number.POSITIVE_INFINITY);wa(this.right,r.reverse())}else{const r=this.right.splice(this.left.length+this.right.length-a,Number.POSITIVE_INFINITY);wa(this.left,r.reverse())}}}function wa(n,a){let r=0;if(a.length<1e4)n.push(...a);else for(;r<a.length;)n.push(...a.slice(r,r+1e4)),r+=1e4}function pg(n){const a={};let r=-1,u,s,f,d,p,m,h;const v=new Ub(n);for(;++r<v.length;){for(;r in a;)r=a[r];if(u=v.get(r),r&&u[1].type==="chunkFlow"&&v.get(r-1)[1].type==="listItemPrefix"&&(m=u[1]._tokenizer.events,f=0,f<m.length&&m[f][1].type==="lineEndingBlank"&&(f+=2),f<m.length&&m[f][1].type==="content"))for(;++f<m.length&&m[f][1].type!=="content";)m[f][1].type==="chunkText"&&(m[f][1]._isInFirstContentOfListItem=!0,f++);if(u[0]==="enter")u[1].contentType&&(Object.assign(a,jb(v,r)),r=a[r],h=!0);else if(u[1]._container){for(f=r,s=void 0;f--;)if(d=v.get(f),d[1].type==="lineEnding"||d[1].type==="lineEndingBlank")d[0]==="enter"&&(s&&(v.get(s)[1].type="lineEndingBlank"),d[1].type="lineEnding",s=f);else if(!(d[1].type==="linePrefix"||d[1].type==="listItemIndent"))break;s&&(u[1].end={...v.get(s)[1].start},p=v.slice(s,r),p.unshift(u),v.splice(s,r-s+1,p))}}return Ft(n,0,Number.POSITIVE_INFINITY,v.slice(0)),!h}function jb(n,a){const r=n.get(a)[1],u=n.get(a)[2];let s=a-1;const f=[];let d=r._tokenizer;d||(d=u.parser[r.contentType](r.start),r._contentTypeTextTrailing&&(d._contentTypeTextTrailing=!0));const p=d.events,m=[],h={};let v,y,E=-1,x=r,C=0,H=0;const j=[H];for(;x;){for(;n.get(++s)[1]!==x;);f.push(s),x._tokenizer||(v=u.sliceStream(x),x.next||v.push(null),y&&d.defineSkip(x.start),x._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=!0),d.write(v),x._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=void 0)),y=x,x=x.next}for(x=r;++E<p.length;)p[E][0]==="exit"&&p[E-1][0]==="enter"&&p[E][1].type===p[E-1][1].type&&p[E][1].start.line!==p[E][1].end.line&&(H=E+1,j.push(H),x._tokenizer=void 0,x.previous=void 0,x=x.next);for(d.events=[],x?(x._tokenizer=void 0,x.previous=void 0):j.pop(),E=j.length;E--;){const O=p.slice(j[E],j[E+1]),F=f.pop();m.push([F,F+O.length-1]),n.splice(F,2,O)}for(m.reverse(),E=-1;++E<m.length;)h[C+m[E][0]]=C+m[E][1],C+=m[E][1]-m[E][0]-1;return h}const Bb={resolve:qb,tokenize:Yb},Hb={partial:!0,tokenize:Vb};function qb(n){return pg(n),n}function Yb(n,a){let r;return u;function u(p){return n.enter("content"),r=n.enter("chunkContent",{contentType:"content"}),s(p)}function s(p){return p===null?f(p):he(p)?n.check(Hb,d,f)(p):(n.consume(p),s)}function f(p){return n.exit("chunkContent"),n.exit("content"),a(p)}function d(p){return n.consume(p),n.exit("chunkContent"),r.next=n.enter("chunkContent",{contentType:"content",previous:r}),r=r.next,s}}function Vb(n,a,r){const u=this;return s;function s(d){return n.exit("chunkContent"),n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),Me(n,f,"linePrefix")}function f(d){if(d===null||he(d))return r(d);const p=u.events[u.events.length-1];return!u.parser.constructs.disable.null.includes("codeIndented")&&p&&p[1].type==="linePrefix"&&p[2].sliceSerialize(p[1],!0).length>=4?a(d):n.interrupt(u.parser.constructs.flow,r,a)(d)}}function mg(n,a,r,u,s,f,d,p,m){const h=m||Number.POSITIVE_INFINITY;let v=0;return y;function y(O){return O===60?(n.enter(u),n.enter(s),n.enter(f),n.consume(O),n.exit(f),E):O===null||O===32||O===41||du(O)?r(O):(n.enter(u),n.enter(d),n.enter(p),n.enter("chunkString",{contentType:"string"}),H(O))}function E(O){return O===62?(n.enter(f),n.consume(O),n.exit(f),n.exit(s),n.exit(u),a):(n.enter(p),n.enter("chunkString",{contentType:"string"}),x(O))}function x(O){return O===62?(n.exit("chunkString"),n.exit(p),E(O)):O===null||O===60||he(O)?r(O):(n.consume(O),O===92?C:x)}function C(O){return O===60||O===62||O===92?(n.consume(O),x):x(O)}function H(O){return!v&&(O===null||O===41||Qe(O))?(n.exit("chunkString"),n.exit(p),n.exit(d),n.exit(u),a(O)):v<h&&O===40?(n.consume(O),v++,H):O===41?(n.consume(O),v--,H):O===null||O===32||O===40||du(O)?r(O):(n.consume(O),O===92?j:H)}function j(O){return O===40||O===41||O===92?(n.consume(O),H):H(O)}}function gg(n,a,r,u,s,f){const d=this;let p=0,m;return h;function h(x){return n.enter(u),n.enter(s),n.consume(x),n.exit(s),n.enter(f),v}function v(x){return p>999||x===null||x===91||x===93&&!m||x===94&&!p&&"_hiddenFootnoteSupport"in d.parser.constructs?r(x):x===93?(n.exit(f),n.enter(s),n.consume(x),n.exit(s),n.exit(u),a):he(x)?(n.enter("lineEnding"),n.consume(x),n.exit("lineEnding"),v):(n.enter("chunkString",{contentType:"string"}),y(x))}function y(x){return x===null||x===91||x===93||he(x)||p++>999?(n.exit("chunkString"),v(x)):(n.consume(x),m||(m=!ze(x)),x===92?E:y)}function E(x){return x===91||x===92||x===93?(n.consume(x),p++,y):y(x)}}function yg(n,a,r,u,s,f){let d;return p;function p(E){return E===34||E===39||E===40?(n.enter(u),n.enter(s),n.consume(E),n.exit(s),d=E===40?41:E,m):r(E)}function m(E){return E===d?(n.enter(s),n.consume(E),n.exit(s),n.exit(u),a):(n.enter(f),h(E))}function h(E){return E===d?(n.exit(f),m(d)):E===null?r(E):he(E)?(n.enter("lineEnding"),n.consume(E),n.exit("lineEnding"),Me(n,h,"linePrefix")):(n.enter("chunkString",{contentType:"string"}),v(E))}function v(E){return E===d||E===null||he(E)?(n.exit("chunkString"),h(E)):(n.consume(E),E===92?y:v)}function y(E){return E===d||E===92?(n.consume(E),v):v(E)}}function Oa(n,a){let r;return u;function u(s){return he(s)?(n.enter("lineEnding"),n.consume(s),n.exit("lineEnding"),r=!0,u):ze(s)?Me(n,u,r?"linePrefix":"lineSuffix")(s):a(s)}}const Gb={name:"definition",tokenize:Qb},Xb={partial:!0,tokenize:Zb};function Qb(n,a,r){const u=this;let s;return f;function f(x){return n.enter("definition"),d(x)}function d(x){return gg.call(u,n,p,r,"definitionLabel","definitionLabelMarker","definitionLabelString")(x)}function p(x){return s=fn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)),x===58?(n.enter("definitionMarker"),n.consume(x),n.exit("definitionMarker"),m):r(x)}function m(x){return Qe(x)?Oa(n,h)(x):h(x)}function h(x){return mg(n,v,r,"definitionDestination","definitionDestinationLiteral","definitionDestinationLiteralMarker","definitionDestinationRaw","definitionDestinationString")(x)}function v(x){return n.attempt(Xb,y,y)(x)}function y(x){return ze(x)?Me(n,E,"whitespace")(x):E(x)}function E(x){return x===null||he(x)?(n.exit("definition"),u.parser.defined.push(s),a(x)):r(x)}}function Zb(n,a,r){return u;function u(p){return Qe(p)?Oa(n,s)(p):r(p)}function s(p){return yg(n,f,r,"definitionTitle","definitionTitleMarker","definitionTitleString")(p)}function f(p){return ze(p)?Me(n,d,"whitespace")(p):d(p)}function d(p){return p===null||he(p)?a(p):r(p)}}const Ib={name:"hardBreakEscape",tokenize:Fb};function Fb(n,a,r){return u;function u(f){return n.enter("hardBreakEscape"),n.consume(f),s}function s(f){return he(f)?(n.exit("hardBreakEscape"),a(f)):r(f)}}const Kb={name:"headingAtx",resolve:Jb,tokenize:$b};function Jb(n,a){let r=n.length-2,u=3,s,f;return n[u][1].type==="whitespace"&&(u+=2),r-2>u&&n[r][1].type==="whitespace"&&(r-=2),n[r][1].type==="atxHeadingSequence"&&(u===r-1||r-4>u&&n[r-2][1].type==="whitespace")&&(r-=u+1===r?2:4),r>u&&(s={type:"atxHeadingText",start:n[u][1].start,end:n[r][1].end},f={type:"chunkText",start:n[u][1].start,end:n[r][1].end,contentType:"text"},Ft(n,u,r-u+1,[["enter",s,a],["enter",f,a],["exit",f,a],["exit",s,a]])),n}function $b(n,a,r){let u=0;return s;function s(v){return n.enter("atxHeading"),f(v)}function f(v){return n.enter("atxHeadingSequence"),d(v)}function d(v){return v===35&&u++<6?(n.consume(v),d):v===null||Qe(v)?(n.exit("atxHeadingSequence"),p(v)):r(v)}function p(v){return v===35?(n.enter("atxHeadingSequence"),m(v)):v===null||he(v)?(n.exit("atxHeading"),a(v)):ze(v)?Me(n,p,"whitespace")(v):(n.enter("atxHeadingText"),h(v))}function m(v){return v===35?(n.consume(v),m):(n.exit("atxHeadingSequence"),p(v))}function h(v){return v===null||v===35||Qe(v)?(n.exit("atxHeadingText"),p(v)):(n.consume(v),h)}}const Wb=["address","article","aside","base","basefont","blockquote","body","caption","center","col","colgroup","dd","details","dialog","dir","div","dl","dt","fieldset","figcaption","figure","footer","form","frame","frameset","h1","h2","h3","h4","h5","h6","head","header","hr","html","iframe","legend","li","link","main","menu","menuitem","nav","noframes","ol","optgroup","option","p","param","search","section","summary","table","tbody","td","tfoot","th","thead","title","tr","track","ul"],Em=["pre","script","style","textarea"],Pb={concrete:!0,name:"htmlFlow",resolveTo:nS,tokenize:lS},eS={partial:!0,tokenize:aS},tS={partial:!0,tokenize:iS};function nS(n){let a=n.length;for(;a--&&!(n[a][0]==="enter"&&n[a][1].type==="htmlFlow"););return a>1&&n[a-2][1].type==="linePrefix"&&(n[a][1].start=n[a-2][1].start,n[a+1][1].start=n[a-2][1].start,n.splice(a-2,2)),n}function lS(n,a,r){const u=this;let s,f,d,p,m;return h;function h(b){return v(b)}function v(b){return n.enter("htmlFlow"),n.enter("htmlFlowData"),n.consume(b),y}function y(b){return b===33?(n.consume(b),E):b===47?(n.consume(b),f=!0,H):b===63?(n.consume(b),s=3,u.interrupt?a:k):zt(b)?(n.consume(b),d=String.fromCharCode(b),j):r(b)}function E(b){return b===45?(n.consume(b),s=2,x):b===91?(n.consume(b),s=5,p=0,C):zt(b)?(n.consume(b),s=4,u.interrupt?a:k):r(b)}function x(b){return b===45?(n.consume(b),u.interrupt?a:k):r(b)}function C(b){const _="CDATA[";return b===_.charCodeAt(p++)?(n.consume(b),p===_.length?u.interrupt?a:le:C):r(b)}function H(b){return zt(b)?(n.consume(b),d=String.fromCharCode(b),j):r(b)}function j(b){if(b===null||b===47||b===62||Qe(b)){const _=b===47,Q=d.toLowerCase();return!_&&!f&&Em.includes(Q)?(s=1,u.interrupt?a(b):le(b)):Wb.includes(d.toLowerCase())?(s=6,_?(n.consume(b),O):u.interrupt?a(b):le(b)):(s=7,u.interrupt&&!u.parser.lazy[u.now().line]?r(b):f?F(b):X(b))}return b===45||xt(b)?(n.consume(b),d+=String.fromCharCode(b),j):r(b)}function O(b){return b===62?(n.consume(b),u.interrupt?a:le):r(b)}function F(b){return ze(b)?(n.consume(b),F):L(b)}function X(b){return b===47?(n.consume(b),L):b===58||b===95||zt(b)?(n.consume(b),ne):ze(b)?(n.consume(b),X):L(b)}function ne(b){return b===45||b===46||b===58||b===95||xt(b)?(n.consume(b),ne):re(b)}function re(b){return b===61?(n.consume(b),B):ze(b)?(n.consume(b),re):X(b)}function B(b){return b===null||b===60||b===61||b===62||b===96?r(b):b===34||b===39?(n.consume(b),m=b,te):ze(b)?(n.consume(b),B):de(b)}function te(b){return b===m?(n.consume(b),m=null,ye):b===null||he(b)?r(b):(n.consume(b),te)}function de(b){return b===null||b===34||b===39||b===47||b===60||b===61||b===62||b===96||Qe(b)?re(b):(n.consume(b),de)}function ye(b){return b===47||b===62||ze(b)?X(b):r(b)}function L(b){return b===62?(n.consume(b),ie):r(b)}function ie(b){return b===null||he(b)?le(b):ze(b)?(n.consume(b),ie):r(b)}function le(b){return b===45&&s===2?(n.consume(b),R):b===60&&s===1?(n.consume(b),I):b===62&&s===4?(n.consume(b),T):b===63&&s===3?(n.consume(b),k):b===93&&s===5?(n.consume(b),Ee):he(b)&&(s===6||s===7)?(n.exit("htmlFlowData"),n.check(eS,Y,ke)(b)):b===null||he(b)?(n.exit("htmlFlowData"),ke(b)):(n.consume(b),le)}function ke(b){return n.check(tS,oe,Y)(b)}function oe(b){return n.enter("lineEnding"),n.consume(b),n.exit("lineEnding"),W}function W(b){return b===null||he(b)?ke(b):(n.enter("htmlFlowData"),le(b))}function R(b){return b===45?(n.consume(b),k):le(b)}function I(b){return b===47?(n.consume(b),d="",ce):le(b)}function ce(b){if(b===62){const _=d.toLowerCase();return Em.includes(_)?(n.consume(b),T):le(b)}return zt(b)&&d.length<8?(n.consume(b),d+=String.fromCharCode(b),ce):le(b)}function Ee(b){return b===93?(n.consume(b),k):le(b)}function k(b){return b===62?(n.consume(b),T):b===45&&s===2?(n.consume(b),k):le(b)}function T(b){return b===null||he(b)?(n.exit("htmlFlowData"),Y(b)):(n.consume(b),T)}function Y(b){return n.exit("htmlFlow"),a(b)}}function iS(n,a,r){const u=this;return s;function s(d){return he(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f):r(d)}function f(d){return u.parser.lazy[u.now().line]?r(d):a(d)}}function aS(n,a,r){return u;function u(s){return n.enter("lineEnding"),n.consume(s),n.exit("lineEnding"),n.attempt(La,a,r)}}const rS={name:"htmlText",tokenize:uS};function uS(n,a,r){const u=this;let s,f,d;return p;function p(k){return n.enter("htmlText"),n.enter("htmlTextData"),n.consume(k),m}function m(k){return k===33?(n.consume(k),h):k===47?(n.consume(k),re):k===63?(n.consume(k),X):zt(k)?(n.consume(k),de):r(k)}function h(k){return k===45?(n.consume(k),v):k===91?(n.consume(k),f=0,C):zt(k)?(n.consume(k),F):r(k)}function v(k){return k===45?(n.consume(k),x):r(k)}function y(k){return k===null?r(k):k===45?(n.consume(k),E):he(k)?(d=y,I(k)):(n.consume(k),y)}function E(k){return k===45?(n.consume(k),x):y(k)}function x(k){return k===62?R(k):k===45?E(k):y(k)}function C(k){const T="CDATA[";return k===T.charCodeAt(f++)?(n.consume(k),f===T.length?H:C):r(k)}function H(k){return k===null?r(k):k===93?(n.consume(k),j):he(k)?(d=H,I(k)):(n.consume(k),H)}function j(k){return k===93?(n.consume(k),O):H(k)}function O(k){return k===62?R(k):k===93?(n.consume(k),O):H(k)}function F(k){return k===null||k===62?R(k):he(k)?(d=F,I(k)):(n.consume(k),F)}function X(k){return k===null?r(k):k===63?(n.consume(k),ne):he(k)?(d=X,I(k)):(n.consume(k),X)}function ne(k){return k===62?R(k):X(k)}function re(k){return zt(k)?(n.consume(k),B):r(k)}function B(k){return k===45||xt(k)?(n.consume(k),B):te(k)}function te(k){return he(k)?(d=te,I(k)):ze(k)?(n.consume(k),te):R(k)}function de(k){return k===45||xt(k)?(n.consume(k),de):k===47||k===62||Qe(k)?ye(k):r(k)}function ye(k){return k===47?(n.consume(k),R):k===58||k===95||zt(k)?(n.consume(k),L):he(k)?(d=ye,I(k)):ze(k)?(n.consume(k),ye):R(k)}function L(k){return k===45||k===46||k===58||k===95||xt(k)?(n.consume(k),L):ie(k)}function ie(k){return k===61?(n.consume(k),le):he(k)?(d=ie,I(k)):ze(k)?(n.consume(k),ie):ye(k)}function le(k){return k===null||k===60||k===61||k===62||k===96?r(k):k===34||k===39?(n.consume(k),s=k,ke):he(k)?(d=le,I(k)):ze(k)?(n.consume(k),le):(n.consume(k),oe)}function ke(k){return k===s?(n.consume(k),s=void 0,W):k===null?r(k):he(k)?(d=ke,I(k)):(n.consume(k),ke)}function oe(k){return k===null||k===34||k===39||k===60||k===61||k===96?r(k):k===47||k===62||Qe(k)?ye(k):(n.consume(k),oe)}function W(k){return k===47||k===62||Qe(k)?ye(k):r(k)}function R(k){return k===62?(n.consume(k),n.exit("htmlTextData"),n.exit("htmlText"),a):r(k)}function I(k){return n.exit("htmlTextData"),n.enter("lineEnding"),n.consume(k),n.exit("lineEnding"),ce}function ce(k){return ze(k)?Me(n,Ee,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(k):Ee(k)}function Ee(k){return n.enter("htmlTextData"),d(k)}}const Ls={name:"labelEnd",resolveAll:fS,resolveTo:dS,tokenize:hS},oS={tokenize:pS},cS={tokenize:mS},sS={tokenize:gS};function fS(n){let a=-1;const r=[];for(;++a<n.length;){const u=n[a][1];if(r.push(n[a]),u.type==="labelImage"||u.type==="labelLink"||u.type==="labelEnd"){const s=u.type==="labelImage"?4:2;u.type="data",a+=s}}return n.length!==r.length&&Ft(n,0,n.length,r),n}function dS(n,a){let r=n.length,u=0,s,f,d,p;for(;r--;)if(s=n[r][1],f){if(s.type==="link"||s.type==="labelLink"&&s._inactive)break;n[r][0]==="enter"&&s.type==="labelLink"&&(s._inactive=!0)}else if(d){if(n[r][0]==="enter"&&(s.type==="labelImage"||s.type==="labelLink")&&!s._balanced&&(f=r,s.type!=="labelLink")){u=2;break}}else s.type==="labelEnd"&&(d=r);const m={type:n[f][1].type==="labelLink"?"link":"image",start:{...n[f][1].start},end:{...n[n.length-1][1].end}},h={type:"label",start:{...n[f][1].start},end:{...n[d][1].end}},v={type:"labelText",start:{...n[f+u+2][1].end},end:{...n[d-2][1].start}};return p=[["enter",m,a],["enter",h,a]],p=rn(p,n.slice(f+1,f+u+3)),p=rn(p,[["enter",v,a]]),p=rn(p,yu(a.parser.constructs.insideSpan.null,n.slice(f+u+4,d-3),a)),p=rn(p,[["exit",v,a],n[d-2],n[d-1],["exit",h,a]]),p=rn(p,n.slice(d+1)),p=rn(p,[["exit",m,a]]),Ft(n,f,n.length,p),n}function hS(n,a,r){const u=this;let s=u.events.length,f,d;for(;s--;)if((u.events[s][1].type==="labelImage"||u.events[s][1].type==="labelLink")&&!u.events[s][1]._balanced){f=u.events[s][1];break}return p;function p(E){return f?f._inactive?y(E):(d=u.parser.defined.includes(fn(u.sliceSerialize({start:f.end,end:u.now()}))),n.enter("labelEnd"),n.enter("labelMarker"),n.consume(E),n.exit("labelMarker"),n.exit("labelEnd"),m):r(E)}function m(E){return E===40?n.attempt(oS,v,d?v:y)(E):E===91?n.attempt(cS,v,d?h:y)(E):d?v(E):y(E)}function h(E){return n.attempt(sS,v,y)(E)}function v(E){return a(E)}function y(E){return f._balanced=!0,r(E)}}function pS(n,a,r){return u;function u(y){return n.enter("resource"),n.enter("resourceMarker"),n.consume(y),n.exit("resourceMarker"),s}function s(y){return Qe(y)?Oa(n,f)(y):f(y)}function f(y){return y===41?v(y):mg(n,d,p,"resourceDestination","resourceDestinationLiteral","resourceDestinationLiteralMarker","resourceDestinationRaw","resourceDestinationString",32)(y)}function d(y){return Qe(y)?Oa(n,m)(y):v(y)}function p(y){return r(y)}function m(y){return y===34||y===39||y===40?yg(n,h,r,"resourceTitle","resourceTitleMarker","resourceTitleString")(y):v(y)}function h(y){return Qe(y)?Oa(n,v)(y):v(y)}function v(y){return y===41?(n.enter("resourceMarker"),n.consume(y),n.exit("resourceMarker"),n.exit("resource"),a):r(y)}}function mS(n,a,r){const u=this;return s;function s(p){return gg.call(u,n,f,d,"reference","referenceMarker","referenceString")(p)}function f(p){return u.parser.defined.includes(fn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)))?a(p):r(p)}function d(p){return r(p)}}function gS(n,a,r){return u;function u(f){return n.enter("reference"),n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),s}function s(f){return f===93?(n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),n.exit("reference"),a):r(f)}}const yS={name:"labelStartImage",resolveAll:Ls.resolveAll,tokenize:vS};function vS(n,a,r){const u=this;return s;function s(p){return n.enter("labelImage"),n.enter("labelImageMarker"),n.consume(p),n.exit("labelImageMarker"),f}function f(p){return p===91?(n.enter("labelMarker"),n.consume(p),n.exit("labelMarker"),n.exit("labelImage"),d):r(p)}function d(p){return p===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(p):a(p)}}const bS={name:"labelStartLink",resolveAll:Ls.resolveAll,tokenize:SS};function SS(n,a,r){const u=this;return s;function s(d){return n.enter("labelLink"),n.enter("labelMarker"),n.consume(d),n.exit("labelMarker"),n.exit("labelLink"),f}function f(d){return d===94&&"_hiddenFootnoteSupport"in u.parser.constructs?r(d):a(d)}}const Kc={name:"lineEnding",tokenize:xS};function xS(n,a){return r;function r(u){return n.enter("lineEnding"),n.consume(u),n.exit("lineEnding"),Me(n,a,"linePrefix")}}const su={name:"thematicBreak",tokenize:ES};function ES(n,a,r){let u=0,s;return f;function f(h){return n.enter("thematicBreak"),d(h)}function d(h){return s=h,p(h)}function p(h){return h===s?(n.enter("thematicBreakSequence"),m(h)):u>=3&&(h===null||he(h))?(n.exit("thematicBreak"),a(h)):r(h)}function m(h){return h===s?(n.consume(h),u++,m):(n.exit("thematicBreakSequence"),ze(h)?Me(n,p,"whitespace")(h):p(h))}}const jt={continuation:{tokenize:wS},exit:zS,name:"list",tokenize:TS},kS={partial:!0,tokenize:_S},AS={partial:!0,tokenize:CS};function TS(n,a,r){const u=this,s=u.events[u.events.length-1];let f=s&&s[1].type==="linePrefix"?s[2].sliceSerialize(s[1],!0).length:0,d=0;return p;function p(x){const C=u.containerState.type||(x===42||x===43||x===45?"listUnordered":"listOrdered");if(C==="listUnordered"?!u.containerState.marker||x===u.containerState.marker:gs(x)){if(u.containerState.type||(u.containerState.type=C,n.enter(C,{_container:!0})),C==="listUnordered")return n.enter("listItemPrefix"),x===42||x===45?n.check(su,r,h)(x):h(x);if(!u.interrupt||x===49)return n.enter("listItemPrefix"),n.enter("listItemValue"),m(x)}return r(x)}function m(x){return gs(x)&&++d<10?(n.consume(x),m):(!u.interrupt||d<2)&&(u.containerState.marker?x===u.containerState.marker:x===41||x===46)?(n.exit("listItemValue"),h(x)):r(x)}function h(x){return n.enter("listItemMarker"),n.consume(x),n.exit("listItemMarker"),u.containerState.marker=u.containerState.marker||x,n.check(La,u.interrupt?r:v,n.attempt(kS,E,y))}function v(x){return u.containerState.initialBlankLine=!0,f++,E(x)}function y(x){return ze(x)?(n.enter("listItemPrefixWhitespace"),n.consume(x),n.exit("listItemPrefixWhitespace"),E):r(x)}function E(x){return u.containerState.size=f+u.sliceSerialize(n.exit("listItemPrefix"),!0).length,a(x)}}function wS(n,a,r){const u=this;return u.containerState._closeFlow=void 0,n.check(La,s,f);function s(p){return u.containerState.furtherBlankLines=u.containerState.furtherBlankLines||u.containerState.initialBlankLine,Me(n,a,"listItemIndent",u.containerState.size+1)(p)}function f(p){return u.containerState.furtherBlankLines||!ze(p)?(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,d(p)):(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,n.attempt(AS,a,d)(p))}function d(p){return u.containerState._closeFlow=!0,u.interrupt=void 0,Me(n,n.attempt(jt,a,r),"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(p)}}function CS(n,a,r){const u=this;return Me(n,s,"listItemIndent",u.containerState.size+1);function s(f){const d=u.events[u.events.length-1];return d&&d[1].type==="listItemIndent"&&d[2].sliceSerialize(d[1],!0).length===u.containerState.size?a(f):r(f)}}function zS(n){n.exit(this.containerState.type)}function _S(n,a,r){const u=this;return Me(n,s,"listItemPrefixWhitespace",u.parser.constructs.disable.null.includes("codeIndented")?void 0:5);function s(f){const d=u.events[u.events.length-1];return!ze(f)&&d&&d[1].type==="listItemPrefixWhitespace"?a(f):r(f)}}const km={name:"setextUnderline",resolveTo:OS,tokenize:DS};function OS(n,a){let r=n.length,u,s,f;for(;r--;)if(n[r][0]==="enter"){if(n[r][1].type==="content"){u=r;break}n[r][1].type==="paragraph"&&(s=r)}else n[r][1].type==="content"&&n.splice(r,1),!f&&n[r][1].type==="definition"&&(f=r);const d={type:"setextHeading",start:{...n[u][1].start},end:{...n[n.length-1][1].end}};return n[s][1].type="setextHeadingText",f?(n.splice(s,0,["enter",d,a]),n.splice(f+1,0,["exit",n[u][1],a]),n[u][1].end={...n[f][1].end}):n[u][1]=d,n.push(["exit",d,a]),n}function DS(n,a,r){const u=this;let s;return f;function f(h){let v=u.events.length,y;for(;v--;)if(u.events[v][1].type!=="lineEnding"&&u.events[v][1].type!=="linePrefix"&&u.events[v][1].type!=="content"){y=u.events[v][1].type==="paragraph";break}return!u.parser.lazy[u.now().line]&&(u.interrupt||y)?(n.enter("setextHeadingLine"),s=h,d(h)):r(h)}function d(h){return n.enter("setextHeadingLineSequence"),p(h)}function p(h){return h===s?(n.consume(h),p):(n.exit("setextHeadingLineSequence"),ze(h)?Me(n,m,"lineSuffix")(h):m(h))}function m(h){return h===null||he(h)?(n.exit("setextHeadingLine"),a(h)):r(h)}}const MS={tokenize:RS};function RS(n){const a=this,r=n.attempt(La,u,n.attempt(this.parser.constructs.flowInitial,s,Me(n,n.attempt(this.parser.constructs.flow,s,n.attempt(Bb,s)),"linePrefix")));return r;function u(f){if(f===null){n.consume(f);return}return n.enter("lineEndingBlank"),n.consume(f),n.exit("lineEndingBlank"),a.currentConstruct=void 0,r}function s(f){if(f===null){n.consume(f);return}return n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),a.currentConstruct=void 0,r}}const NS={resolveAll:bg()},LS=vg("string"),US=vg("text");function vg(n){return{resolveAll:bg(n==="text"?jS:void 0),tokenize:a};function a(r){const u=this,s=this.parser.constructs[n],f=r.attempt(s,d,p);return d;function d(v){return h(v)?f(v):p(v)}function p(v){if(v===null){r.consume(v);return}return r.enter("data"),r.consume(v),m}function m(v){return h(v)?(r.exit("data"),f(v)):(r.consume(v),m)}function h(v){if(v===null)return!0;const y=s[v];let E=-1;if(y)for(;++E<y.length;){const x=y[E];if(!x.previous||x.previous.call(u,u.previous))return!0}return!1}}}function bg(n){return a;function a(r,u){let s=-1,f;for(;++s<=r.length;)f===void 0?r[s]&&r[s][1].type==="data"&&(f=s,s++):(!r[s]||r[s][1].type!=="data")&&(s!==f+2&&(r[f][1].end=r[s-1][1].end,r.splice(f+2,s-f-2),s=f+2),f=void 0);return n?n(r,u):r}}function jS(n,a){let r=0;for(;++r<=n.length;)if((r===n.length||n[r][1].type==="lineEnding")&&n[r-1][1].type==="data"){const u=n[r-1][1],s=a.sliceStream(u);let f=s.length,d=-1,p=0,m;for(;f--;){const h=s[f];if(typeof h=="string"){for(d=h.length;h.charCodeAt(d-1)===32;)p++,d--;if(d)break;d=-1}else if(h===-2)m=!0,p++;else if(h!==-1){f++;break}}if(a._contentTypeTextTrailing&&r===n.length&&(p=0),p){const h={type:r===n.length||m||p<2?"lineSuffix":"hardBreakTrailing",start:{_bufferIndex:f?d:u.start._bufferIndex+d,_index:u.start._index+f,line:u.end.line,column:u.end.column-p,offset:u.end.offset-p},end:{...u.end}};u.end={...h.start},u.start.offset===u.end.offset?Object.assign(u,h):(n.splice(r,0,["enter",h,a],["exit",h,a]),r+=2)}r++}return n}const BS={42:jt,43:jt,45:jt,48:jt,49:jt,50:jt,51:jt,52:jt,53:jt,54:jt,55:jt,56:jt,57:jt,62:fg},HS={91:Gb},qS={[-2]:Fc,[-1]:Fc,32:Fc},YS={35:Kb,42:su,45:[km,su],60:Pb,61:km,95:su,96:xm,126:xm},VS={38:hg,92:dg},GS={[-5]:Kc,[-4]:Kc,[-3]:Kc,33:yS,38:hg,42:ys,60:[bb,rS],91:bS,92:[Ib,dg],93:Ls,95:ys,96:Mb},XS={null:[ys,NS]},QS={null:[42,95]},ZS={null:[]},IS=Object.freeze(Object.defineProperty({__proto__:null,attentionMarkers:QS,contentInitial:HS,disable:ZS,document:BS,flow:YS,flowInitial:qS,insideSpan:XS,string:VS,text:GS},Symbol.toStringTag,{value:"Module"}));function FS(n,a,r){let u={_bufferIndex:-1,_index:0,line:r&&r.line||1,column:r&&r.column||1,offset:r&&r.offset||0};const s={},f=[];let d=[],p=[];const m={attempt:te(re),check:te(B),consume:F,enter:X,exit:ne,interrupt:te(B,{interrupt:!0})},h={code:null,containerState:{},defineSkip:H,events:[],now:C,parser:n,previous:null,sliceSerialize:E,sliceStream:x,write:y};let v=a.tokenize.call(h,m);return a.resolveAll&&f.push(a),h;function y(ie){return d=rn(d,ie),j(),d[d.length-1]!==null?[]:(de(a,0),h.events=yu(f,h.events,h),h.events)}function E(ie,le){return JS(x(ie),le)}function x(ie){return KS(d,ie)}function C(){const{_bufferIndex:ie,_index:le,line:ke,column:oe,offset:W}=u;return{_bufferIndex:ie,_index:le,line:ke,column:oe,offset:W}}function H(ie){s[ie.line]=ie.column,L()}function j(){let ie;for(;u._index<d.length;){const le=d[u._index];if(typeof le=="string")for(ie=u._index,u._bufferIndex<0&&(u._bufferIndex=0);u._index===ie&&u._bufferIndex<le.length;)O(le.charCodeAt(u._bufferIndex));else O(le)}}function O(ie){v=v(ie)}function F(ie){he(ie)?(u.line++,u.column=1,u.offset+=ie===-3?2:1,L()):ie!==-1&&(u.column++,u.offset++),u._bufferIndex<0?u._index++:(u._bufferIndex++,u._bufferIndex===d[u._index].length&&(u._bufferIndex=-1,u._index++)),h.previous=ie}function X(ie,le){const ke=le||{};return ke.type=ie,ke.start=C(),h.events.push(["enter",ke,h]),p.push(ke),ke}function ne(ie){const le=p.pop();return le.end=C(),h.events.push(["exit",le,h]),le}function re(ie,le){de(ie,le.from)}function B(ie,le){le.restore()}function te(ie,le){return ke;function ke(oe,W,R){let I,ce,Ee,k;return Array.isArray(oe)?Y(oe):"tokenize"in oe?Y([oe]):T(oe);function T(K){return ee;function ee(ue){const pe=ue!==null&&K[ue],Ae=ue!==null&&K.null,Je=[...Array.isArray(pe)?pe:pe?[pe]:[],...Array.isArray(Ae)?Ae:Ae?[Ae]:[]];return Y(Je)(ue)}}function Y(K){return I=K,ce=0,K.length===0?R:b(K[ce])}function b(K){return ee;function ee(ue){return k=ye(),Ee=K,K.partial||(h.currentConstruct=K),K.name&&h.parser.constructs.disable.null.includes(K.name)?Q():K.tokenize.call(le?Object.assign(Object.create(h),le):h,m,_,Q)(ue)}}function _(K){return ie(Ee,k),W}function Q(K){return k.restore(),++ce<I.length?b(I[ce]):R}}}function de(ie,le){ie.resolveAll&&!f.includes(ie)&&f.push(ie),ie.resolve&&Ft(h.events,le,h.events.length-le,ie.resolve(h.events.slice(le),h)),ie.resolveTo&&(h.events=ie.resolveTo(h.events,h))}function ye(){const ie=C(),le=h.previous,ke=h.currentConstruct,oe=h.events.length,W=Array.from(p);return{from:oe,restore:R};function R(){u=ie,h.previous=le,h.currentConstruct=ke,h.events.length=oe,p=W,L()}}function L(){u.line in s&&u.column<2&&(u.column=s[u.line],u.offset+=s[u.line]-1)}}function KS(n,a){const r=a.start._index,u=a.start._bufferIndex,s=a.end._index,f=a.end._bufferIndex;let d;if(r===s)d=[n[r].slice(u,f)];else{if(d=n.slice(r,s),u>-1){const p=d[0];typeof p=="string"?d[0]=p.slice(u):d.shift()}f>0&&d.push(n[s].slice(0,f))}return d}function JS(n,a){let r=-1;const u=[];let s;for(;++r<n.length;){const f=n[r];let d;if(typeof f=="string")d=f;else switch(f){case-5:{d="\\r";break}case-4:{d=`\n`;break}case-3:{d=`\\r\n`;break}case-2:{d=a?" ":"	";break}case-1:{if(!a&&s)continue;d=" ";break}default:d=String.fromCharCode(f)}s=f===-2,u.push(d)}return u.join("")}function $S(n){const u={constructs:cg([IS,...(n||{}).extensions||[]]),content:s(db),defined:[],document:s(pb),flow:s(MS),lazy:{},string:s(LS),text:s(US)};return u;function s(f){return d;function d(p){return FS(u,f,p)}}}function WS(n){for(;!pg(n););return n}const Am=/[\\0\\t\\n\\r]/g;function PS(){let n=1,a="",r=!0,u;return s;function s(f,d,p){const m=[];let h,v,y,E,x;for(f=a+(typeof f=="string"?f.toString():new TextDecoder(d||void 0).decode(f)),y=0,a="",r&&(f.charCodeAt(0)===65279&&y++,r=void 0);y<f.length;){if(Am.lastIndex=y,h=Am.exec(f),E=h&&h.index!==void 0?h.index:f.length,x=f.charCodeAt(E),!h){a=f.slice(y);break}if(x===10&&y===E&&u)m.push(-3),u=void 0;else switch(u&&(m.push(-5),u=void 0),y<E&&(m.push(f.slice(y,E)),n+=E-y),x){case 0:{m.push(65533),n++;break}case 9:{for(v=Math.ceil(n/4)*4,m.push(-2);n++<v;)m.push(-1);break}case 10:{m.push(-4),n=1;break}default:u=!0,n=1}y=E+1}return p&&(u&&m.push(-5),a&&m.push(a),m.push(null)),m}}const ex=/\\\\([!-/:-@[-`{-~])|&(#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});/gi;function tx(n){return n.replace(ex,nx)}function nx(n,a,r){if(a)return a;if(r.charCodeAt(0)===35){const s=r.charCodeAt(1),f=s===120||s===88;return sg(r.slice(f?2:1),f?16:10)}return Ns(r)||n}const Sg={}.hasOwnProperty;function lx(n,a,r){return a&&typeof a=="object"&&(r=a,a=void 0),ix(r)(WS($S(r).document().write(PS()(n,a,!0))))}function ix(n){const a={transforms:[],canContainEols:["emphasis","fragment","heading","paragraph","strong"],enter:{autolink:f(Ul),autolinkProtocol:ye,autolinkEmail:ye,atxHeading:f(Nl),blockQuote:f(Ae),characterEscape:ye,characterReference:ye,codeFenced:f(Je),codeFencedFenceInfo:d,codeFencedFenceMeta:d,codeIndented:f(Je,d),codeText:f(Pe,d),codeTextData:ye,data:ye,codeFlowValue:ye,definition:f(ct),definitionDestinationString:d,definitionLabelString:d,definitionTitleString:d,emphasis:f(yt),hardBreakEscape:f(Ll),hardBreakTrailing:f(Ll),htmlFlow:f(Ba,d),htmlFlowData:ye,htmlText:f(Ba,d),htmlTextData:ye,image:f(Ha),label:d,link:f(Ul),listItem:f(Oi),listItemValue:E,listOrdered:f(jl,y),listUnordered:f(jl),paragraph:f(xu),reference:b,referenceString:d,resourceDestinationString:d,resourceTitleString:d,setextHeading:f(Nl),strong:f(Eu),thematicBreak:f(ku)},exit:{atxHeading:m(),atxHeadingSequence:re,autolink:m(),autolinkEmail:pe,autolinkProtocol:ue,blockQuote:m(),characterEscapeValue:L,characterReferenceMarkerHexadecimal:Q,characterReferenceMarkerNumeric:Q,characterReferenceValue:K,characterReference:ee,codeFenced:m(j),codeFencedFence:H,codeFencedFenceInfo:x,codeFencedFenceMeta:C,codeFlowValue:L,codeIndented:m(O),codeText:m(W),codeTextData:L,data:L,definition:m(),definitionDestinationString:ne,definitionLabelString:F,definitionTitleString:X,emphasis:m(),hardBreakEscape:m(le),hardBreakTrailing:m(le),htmlFlow:m(ke),htmlFlowData:L,htmlText:m(oe),htmlTextData:L,image:m(I),label:Ee,labelText:ce,lineEnding:ie,link:m(R),listItem:m(),listOrdered:m(),listUnordered:m(),paragraph:m(),referenceString:_,resourceDestinationString:k,resourceTitleString:T,resource:Y,setextHeading:m(de),setextHeadingLineSequence:te,setextHeadingText:B,strong:m(),thematicBreak:m()}};xg(a,(n||{}).mdastExtensions||[]);const r={};return u;function u(V){let P={type:"root",children:[]};const ge={stack:[P],tokenStack:[],config:a,enter:p,exit:h,buffer:d,resume:v,data:r},Te=[];let Ue=-1;for(;++Ue<V.length;)if(V[Ue][1].type==="listOrdered"||V[Ue][1].type==="listUnordered")if(V[Ue][0]==="enter")Te.push(Ue);else{const Ht=Te.pop();Ue=s(V,Ht,Ue)}for(Ue=-1;++Ue<V.length;){const Ht=a[V[Ue][0]];Sg.call(Ht,V[Ue][1].type)&&Ht[V[Ue][1].type].call(Object.assign({sliceSerialize:V[Ue][2].sliceSerialize},ge),V[Ue][1])}if(ge.tokenStack.length>0){const Ht=ge.tokenStack[ge.tokenStack.length-1];(Ht[1]||Tm).call(ge,void 0,Ht[0])}for(P.position={start:sl(V.length>0?V[0][1].start:{line:1,column:1,offset:0}),end:sl(V.length>0?V[V.length-2][1].end:{line:1,column:1,offset:0})},Ue=-1;++Ue<a.transforms.length;)P=a.transforms[Ue](P)||P;return P}function s(V,P,ge){let Te=P-1,Ue=-1,Ht=!1,bn,At,ut,_t;for(;++Te<=ge;){const Ge=V[Te];switch(Ge[1].type){case"listUnordered":case"listOrdered":case"blockQuote":{Ge[0]==="enter"?Ue++:Ue--,_t=void 0;break}case"lineEndingBlank":{Ge[0]==="enter"&&(bn&&!_t&&!Ue&&!ut&&(ut=Te),_t=void 0);break}case"linePrefix":case"listItemValue":case"listItemMarker":case"listItemPrefix":case"listItemPrefixWhitespace":break;default:_t=void 0}if(!Ue&&Ge[0]==="enter"&&Ge[1].type==="listItemPrefix"||Ue===-1&&Ge[0]==="exit"&&(Ge[1].type==="listUnordered"||Ge[1].type==="listOrdered")){if(bn){let Hn=Te;for(At=void 0;Hn--;){const un=V[Hn];if(un[1].type==="lineEnding"||un[1].type==="lineEndingBlank"){if(un[0]==="exit")continue;At&&(V[At][1].type="lineEndingBlank",Ht=!0),un[1].type="lineEnding",At=Hn}else if(!(un[1].type==="linePrefix"||un[1].type==="blockQuotePrefix"||un[1].type==="blockQuotePrefixWhitespace"||un[1].type==="blockQuoteMarker"||un[1].type==="listItemIndent"))break}ut&&(!At||ut<At)&&(bn._spread=!0),bn.end=Object.assign({},At?V[At][1].start:Ge[1].end),V.splice(At||Te,0,["exit",bn,Ge[2]]),Te++,ge++}if(Ge[1].type==="listItemPrefix"){const Hn={type:"listItem",_spread:!1,start:Object.assign({},Ge[1].start),end:void 0};bn=Hn,V.splice(Te,0,["enter",Hn,Ge[2]]),Te++,ge++,ut=void 0,_t=!0}}}return V[P][1]._spread=Ht,ge}function f(V,P){return ge;function ge(Te){p.call(this,V(Te),Te),P&&P.call(this,Te)}}function d(){this.stack.push({type:"fragment",children:[]})}function p(V,P,ge){this.stack[this.stack.length-1].children.push(V),this.stack.push(V),this.tokenStack.push([P,ge||void 0]),V.position={start:sl(P.start),end:void 0}}function m(V){return P;function P(ge){V&&V.call(this,ge),h.call(this,ge)}}function h(V,P){const ge=this.stack.pop(),Te=this.tokenStack.pop();if(Te)Te[0].type!==V.type&&(P?P.call(this,V,Te[0]):(Te[1]||Tm).call(this,V,Te[0]));else throw new Error("Cannot close `"+V.type+"` ("+_a({start:V.start,end:V.end})+"): it\u2019s not open");ge.position.end=sl(V.end)}function v(){return Rs(this.stack.pop())}function y(){this.data.expectingFirstListItemValue=!0}function E(V){if(this.data.expectingFirstListItemValue){const P=this.stack[this.stack.length-2];P.start=Number.parseInt(this.sliceSerialize(V),10),this.data.expectingFirstListItemValue=void 0}}function x(){const V=this.resume(),P=this.stack[this.stack.length-1];P.lang=V}function C(){const V=this.resume(),P=this.stack[this.stack.length-1];P.meta=V}function H(){this.data.flowCodeInside||(this.buffer(),this.data.flowCodeInside=!0)}function j(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V.replace(/^(\\r?\\n|\\r)|(\\r?\\n|\\r)$/g,""),this.data.flowCodeInside=void 0}function O(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V.replace(/(\\r?\\n|\\r)$/g,"")}function F(V){const P=this.resume(),ge=this.stack[this.stack.length-1];ge.label=P,ge.identifier=fn(this.sliceSerialize(V)).toLowerCase()}function X(){const V=this.resume(),P=this.stack[this.stack.length-1];P.title=V}function ne(){const V=this.resume(),P=this.stack[this.stack.length-1];P.url=V}function re(V){const P=this.stack[this.stack.length-1];if(!P.depth){const ge=this.sliceSerialize(V).length;P.depth=ge}}function B(){this.data.setextHeadingSlurpLineEnding=!0}function te(V){const P=this.stack[this.stack.length-1];P.depth=this.sliceSerialize(V).codePointAt(0)===61?1:2}function de(){this.data.setextHeadingSlurpLineEnding=void 0}function ye(V){const ge=this.stack[this.stack.length-1].children;let Te=ge[ge.length-1];(!Te||Te.type!=="text")&&(Te=kt(),Te.position={start:sl(V.start),end:void 0},ge.push(Te)),this.stack.push(Te)}function L(V){const P=this.stack.pop();P.value+=this.sliceSerialize(V),P.position.end=sl(V.end)}function ie(V){const P=this.stack[this.stack.length-1];if(this.data.atHardBreak){const ge=P.children[P.children.length-1];ge.position.end=sl(V.end),this.data.atHardBreak=void 0;return}!this.data.setextHeadingSlurpLineEnding&&a.canContainEols.includes(P.type)&&(ye.call(this,V),L.call(this,V))}function le(){this.data.atHardBreak=!0}function ke(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function oe(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function W(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function R(){const V=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";V.type+="Reference",V.referenceType=P,delete V.url,delete V.title}else delete V.identifier,delete V.label;this.data.referenceType=void 0}function I(){const V=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";V.type+="Reference",V.referenceType=P,delete V.url,delete V.title}else delete V.identifier,delete V.label;this.data.referenceType=void 0}function ce(V){const P=this.sliceSerialize(V),ge=this.stack[this.stack.length-2];ge.label=tx(P),ge.identifier=fn(P).toLowerCase()}function Ee(){const V=this.stack[this.stack.length-1],P=this.resume(),ge=this.stack[this.stack.length-1];if(this.data.inReference=!0,ge.type==="link"){const Te=V.children;ge.children=Te}else ge.alt=P}function k(){const V=this.resume(),P=this.stack[this.stack.length-1];P.url=V}function T(){const V=this.resume(),P=this.stack[this.stack.length-1];P.title=V}function Y(){this.data.inReference=void 0}function b(){this.data.referenceType="collapsed"}function _(V){const P=this.resume(),ge=this.stack[this.stack.length-1];ge.label=P,ge.identifier=fn(this.sliceSerialize(V)).toLowerCase(),this.data.referenceType="full"}function Q(V){this.data.characterReferenceType=V.type}function K(V){const P=this.sliceSerialize(V),ge=this.data.characterReferenceType;let Te;ge?(Te=sg(P,ge==="characterReferenceMarkerNumeric"?10:16),this.data.characterReferenceType=void 0):Te=Ns(P);const Ue=this.stack[this.stack.length-1];Ue.value+=Te}function ee(V){const P=this.stack.pop();P.position.end=sl(V.end)}function ue(V){L.call(this,V);const P=this.stack[this.stack.length-1];P.url=this.sliceSerialize(V)}function pe(V){L.call(this,V);const P=this.stack[this.stack.length-1];P.url="mailto:"+this.sliceSerialize(V)}function Ae(){return{type:"blockquote",children:[]}}function Je(){return{type:"code",lang:null,meta:null,value:""}}function Pe(){return{type:"inlineCode",value:""}}function ct(){return{type:"definition",identifier:"",label:null,title:null,url:""}}function yt(){return{type:"emphasis",children:[]}}function Nl(){return{type:"heading",depth:0,children:[]}}function Ll(){return{type:"break"}}function Ba(){return{type:"html",value:""}}function Ha(){return{type:"image",title:null,url:"",alt:null}}function Ul(){return{type:"link",title:null,url:"",children:[]}}function jl(V){return{type:"list",ordered:V.type==="listOrdered",start:null,spread:V._spread,children:[]}}function Oi(V){return{type:"listItem",spread:V._spread,checked:null,children:[]}}function xu(){return{type:"paragraph",children:[]}}function Eu(){return{type:"strong",children:[]}}function kt(){return{type:"text",value:""}}function ku(){return{type:"thematicBreak"}}}function sl(n){return{line:n.line,column:n.column,offset:n.offset}}function xg(n,a){let r=-1;for(;++r<a.length;){const u=a[r];Array.isArray(u)?xg(n,u):ax(n,u)}}function ax(n,a){let r;for(r in a)if(Sg.call(a,r))switch(r){case"canContainEols":{const u=a[r];u&&n[r].push(...u);break}case"transforms":{const u=a[r];u&&n[r].push(...u);break}case"enter":case"exit":{const u=a[r];u&&Object.assign(n[r],u);break}}}function Tm(n,a){throw n?new Error("Cannot close `"+n.type+"` ("+_a({start:n.start,end:n.end})+"): a different token (`"+a.type+"`, "+_a({start:a.start,end:a.end})+") is open"):new Error("Cannot close document, a token (`"+a.type+"`, "+_a({start:a.start,end:a.end})+") is still open")}function rx(n){const a=this;a.parser=r;function r(u){return lx(u,{...a.data("settings"),...n,extensions:a.data("micromarkExtensions")||[],mdastExtensions:a.data("fromMarkdownExtensions")||[]})}}function ux(n,a){const r={type:"element",tagName:"blockquote",properties:{},children:n.wrap(n.all(a),!0)};return n.patch(a,r),n.applyData(a,r)}function ox(n,a){const r={type:"element",tagName:"br",properties:{},children:[]};return n.patch(a,r),[n.applyData(a,r),{type:"text",value:`\n`}]}function cx(n,a){const r=a.value?a.value+`\n`:"",u={},s=a.lang?a.lang.split(/\\s+/):[];s.length>0&&(u.className=["language-"+s[0]]);let f={type:"element",tagName:"code",properties:u,children:[{type:"text",value:r}]};return a.meta&&(f.data={meta:a.meta}),n.patch(a,f),f=n.applyData(a,f),f={type:"element",tagName:"pre",properties:{},children:[f]},n.patch(a,f),f}function sx(n,a){const r={type:"element",tagName:"del",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function fx(n,a){const r={type:"element",tagName:"em",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function dx(n,a){const r=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",u=String(a.identifier).toUpperCase(),s=_i(u.toLowerCase()),f=n.footnoteOrder.indexOf(u);let d,p=n.footnoteCounts.get(u);p===void 0?(p=0,n.footnoteOrder.push(u),d=n.footnoteOrder.length):d=f+1,p+=1,n.footnoteCounts.set(u,p);const m={type:"element",tagName:"a",properties:{href:"#"+r+"fn-"+s,id:r+"fnref-"+s+(p>1?"-"+p:""),dataFootnoteRef:!0,ariaDescribedBy:["footnote-label"]},children:[{type:"text",value:String(d)}]};n.patch(a,m);const h={type:"element",tagName:"sup",properties:{},children:[m]};return n.patch(a,h),n.applyData(a,h)}function hx(n,a){const r={type:"element",tagName:"h"+a.depth,properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function px(n,a){if(n.options.allowDangerousHtml){const r={type:"raw",value:a.value};return n.patch(a,r),n.applyData(a,r)}}function Eg(n,a){const r=a.referenceType;let u="]";if(r==="collapsed"?u+="[]":r==="full"&&(u+="["+(a.label||a.identifier)+"]"),a.type==="imageReference")return[{type:"text",value:"!["+a.alt+u}];const s=n.all(a),f=s[0];f&&f.type==="text"?f.value="["+f.value:s.unshift({type:"text",value:"["});const d=s[s.length-1];return d&&d.type==="text"?d.value+=u:s.push({type:"text",value:u}),s}function mx(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return Eg(n,a);const s={src:_i(u.url||""),alt:a.alt};u.title!==null&&u.title!==void 0&&(s.title=u.title);const f={type:"element",tagName:"img",properties:s,children:[]};return n.patch(a,f),n.applyData(a,f)}function gx(n,a){const r={src:_i(a.url)};a.alt!==null&&a.alt!==void 0&&(r.alt=a.alt),a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"img",properties:r,children:[]};return n.patch(a,u),n.applyData(a,u)}function yx(n,a){const r={type:"text",value:a.value.replace(/\\r?\\n|\\r/g," ")};n.patch(a,r);const u={type:"element",tagName:"code",properties:{},children:[r]};return n.patch(a,u),n.applyData(a,u)}function vx(n,a){const r=String(a.identifier).toUpperCase(),u=n.definitionById.get(r);if(!u)return Eg(n,a);const s={href:_i(u.url||"")};u.title!==null&&u.title!==void 0&&(s.title=u.title);const f={type:"element",tagName:"a",properties:s,children:n.all(a)};return n.patch(a,f),n.applyData(a,f)}function bx(n,a){const r={href:_i(a.url)};a.title!==null&&a.title!==void 0&&(r.title=a.title);const u={type:"element",tagName:"a",properties:r,children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function Sx(n,a,r){const u=n.all(a),s=r?xx(r):kg(a),f={},d=[];if(typeof a.checked=="boolean"){const v=u[0];let y;v&&v.type==="element"&&v.tagName==="p"?y=v:(y={type:"element",tagName:"p",properties:{},children:[]},u.unshift(y)),y.children.length>0&&y.children.unshift({type:"text",value:" "}),y.children.unshift({type:"element",tagName:"input",properties:{type:"checkbox",checked:a.checked,disabled:!0},children:[]}),f.className=["task-list-item"]}let p=-1;for(;++p<u.length;){const v=u[p];(s||p!==0||v.type!=="element"||v.tagName!=="p")&&d.push({type:"text",value:`\n`}),v.type==="element"&&v.tagName==="p"&&!s?d.push(...v.children):d.push(v)}const m=u[u.length-1];m&&(s||m.type!=="element"||m.tagName!=="p")&&d.push({type:"text",value:`\n`});const h={type:"element",tagName:"li",properties:f,children:d};return n.patch(a,h),n.applyData(a,h)}function xx(n){let a=!1;if(n.type==="list"){a=n.spread||!1;const r=n.children;let u=-1;for(;!a&&++u<r.length;)a=kg(r[u])}return a}function kg(n){const a=n.spread;return a??n.children.length>1}function Ex(n,a){const r={},u=n.all(a);let s=-1;for(typeof a.start=="number"&&a.start!==1&&(r.start=a.start);++s<u.length;){const d=u[s];if(d.type==="element"&&d.tagName==="li"&&d.properties&&Array.isArray(d.properties.className)&&d.properties.className.includes("task-list-item")){r.className=["contains-task-list"];break}}const f={type:"element",tagName:a.ordered?"ol":"ul",properties:r,children:n.wrap(u,!0)};return n.patch(a,f),n.applyData(a,f)}function kx(n,a){const r={type:"element",tagName:"p",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function Ax(n,a){const r={type:"root",children:n.wrap(n.all(a))};return n.patch(a,r),n.applyData(a,r)}function Tx(n,a){const r={type:"element",tagName:"strong",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}function wx(n,a){const r=n.all(a),u=r.shift(),s=[];if(u){const d={type:"element",tagName:"thead",properties:{},children:n.wrap([u],!0)};n.patch(a.children[0],d),s.push(d)}if(r.length>0){const d={type:"element",tagName:"tbody",properties:{},children:n.wrap(r,!0)},p=_s(a.children[1]),m=ng(a.children[a.children.length-1]);p&&m&&(d.position={start:p,end:m}),s.push(d)}const f={type:"element",tagName:"table",properties:{},children:n.wrap(s,!0)};return n.patch(a,f),n.applyData(a,f)}function Cx(n,a,r){const u=r?r.children:void 0,f=(u?u.indexOf(a):1)===0?"th":"td",d=r&&r.type==="table"?r.align:void 0,p=d?d.length:a.children.length;let m=-1;const h=[];for(;++m<p;){const y=a.children[m],E={},x=d?d[m]:void 0;x&&(E.align=x);let C={type:"element",tagName:f,properties:E,children:[]};y&&(C.children=n.all(y),n.patch(y,C),C=n.applyData(y,C)),h.push(C)}const v={type:"element",tagName:"tr",properties:{},children:n.wrap(h,!0)};return n.patch(a,v),n.applyData(a,v)}function zx(n,a){const r={type:"element",tagName:"td",properties:{},children:n.all(a)};return n.patch(a,r),n.applyData(a,r)}const wm=9,Cm=32;function _x(n){const a=String(n),r=/\\r?\\n|\\r/g;let u=r.exec(a),s=0;const f=[];for(;u;)f.push(zm(a.slice(s,u.index),s>0,!0),u[0]),s=u.index+u[0].length,u=r.exec(a);return f.push(zm(a.slice(s),s>0,!1)),f.join("")}function zm(n,a,r){let u=0,s=n.length;if(a){let f=n.codePointAt(u);for(;f===wm||f===Cm;)u++,f=n.codePointAt(u)}if(r){let f=n.codePointAt(s-1);for(;f===wm||f===Cm;)s--,f=n.codePointAt(s-1)}return s>u?n.slice(u,s):""}function Ox(n,a){const r={type:"text",value:_x(String(a.value))};return n.patch(a,r),n.applyData(a,r)}function Dx(n,a){const r={type:"element",tagName:"hr",properties:{},children:[]};return n.patch(a,r),n.applyData(a,r)}const Mx={blockquote:ux,break:ox,code:cx,delete:sx,emphasis:fx,footnoteReference:dx,heading:hx,html:px,imageReference:mx,image:gx,inlineCode:yx,linkReference:vx,link:bx,listItem:Sx,list:Ex,paragraph:kx,root:Ax,strong:Tx,table:wx,tableCell:zx,tableRow:Cx,text:Ox,thematicBreak:Dx,toml:lu,yaml:lu,definition:lu,footnoteDefinition:lu};function lu(){}const Ag=-1,vu=0,Da=1,hu=2,Us=3,js=4,Bs=5,Hs=6,Tg=7,wg=8,Rx=typeof self=="object"?self:globalThis,_m=(n,a)=>{switch(n){case"Function":case"SharedWorker":case"Worker":case"eval":case"setInterval":case"setTimeout":throw new TypeError("unable to deserialize "+n)}return new Rx[n](a)},Nx=(n,a)=>{const r=(s,f)=>(n.set(f,s),s),u=s=>{if(n.has(s))return n.get(s);const[f,d]=a[s];switch(f){case vu:case Ag:return r(d,s);case Da:{const p=r([],s);for(const m of d)p.push(u(m));return p}case hu:{const p=r({},s);for(const[m,h]of d)p[u(m)]=u(h);return p}case Us:return r(new Date(d),s);case js:{const{source:p,flags:m}=d;return r(new RegExp(p,m),s)}case Bs:{const p=r(new Map,s);for(const[m,h]of d)p.set(u(m),u(h));return p}case Hs:{const p=r(new Set,s);for(const m of d)p.add(u(m));return p}case Tg:{const{name:p,message:m}=d;return r(_m(p,m),s)}case wg:return r(BigInt(d),s);case"BigInt":return r(Object(BigInt(d)),s);case"ArrayBuffer":return r(new Uint8Array(d).buffer,d);case"DataView":{const{buffer:p}=new Uint8Array(d);return r(new DataView(p),d)}}return r(_m(f,d),s)};return u},Om=n=>Nx(new Map,n)(0),ki="",{toString:Lx}={},{keys:Ux}=Object,Ca=n=>{const a=typeof n;if(a!=="object"||!n)return[vu,a];const r=Lx.call(n).slice(8,-1);switch(r){case"Array":return[Da,ki];case"Object":return[hu,ki];case"Date":return[Us,ki];case"RegExp":return[js,ki];case"Map":return[Bs,ki];case"Set":return[Hs,ki];case"DataView":return[Da,r]}return r.includes("Array")?[Da,r]:r.includes("Error")?[Tg,r]:[hu,r]},iu=([n,a])=>n===vu&&(a==="function"||a==="symbol"),jx=(n,a,r,u)=>{const s=(d,p)=>{const m=u.push(d)-1;return r.set(p,m),m},f=d=>{if(r.has(d))return r.get(d);let[p,m]=Ca(d);switch(p){case vu:{let v=d;switch(m){case"bigint":p=wg,v=d.toString();break;case"function":case"symbol":if(n)throw new TypeError("unable to serialize "+m);v=null;break;case"undefined":return s([Ag],d)}return s([p,v],d)}case Da:{if(m){let E=d;return m==="DataView"?E=new Uint8Array(d.buffer):m==="ArrayBuffer"&&(E=new Uint8Array(d)),s([m,[...E]],d)}const v=[],y=s([p,v],d);for(const E of d)v.push(f(E));return y}case hu:{if(m)switch(m){case"BigInt":return s([m,d.toString()],d);case"Boolean":case"Number":case"String":return s([m,d.valueOf()],d)}if(a&&"toJSON"in d)return f(d.toJSON());const v=[],y=s([p,v],d);for(const E of Ux(d))(n||!iu(Ca(d[E])))&&v.push([f(E),f(d[E])]);return y}case Us:return s([p,d.toISOString()],d);case js:{const{source:v,flags:y}=d;return s([p,{source:v,flags:y}],d)}case Bs:{const v=[],y=s([p,v],d);for(const[E,x]of d)(n||!(iu(Ca(E))||iu(Ca(x))))&&v.push([f(E),f(x)]);return y}case Hs:{const v=[],y=s([p,v],d);for(const E of d)(n||!iu(Ca(E)))&&v.push(f(E));return y}}const{message:h}=d;return s([p,{name:m,message:h}],d)};return f},Dm=(n,{json:a,lossy:r}={})=>{const u=[];return jx(!(a||r),!!a,new Map,u)(n),u},pu=typeof structuredClone=="function"?(n,a)=>a&&("json"in a||"lossy"in a)?Om(Dm(n,a)):structuredClone(n):(n,a)=>Om(Dm(n,a));function Bx(n,a){const r=[{type:"text",value:"\u21A9"}];return a>1&&r.push({type:"element",tagName:"sup",properties:{},children:[{type:"text",value:String(a)}]}),r}function Hx(n,a){return"Back to reference "+(n+1)+(a>1?"-"+a:"")}function qx(n){const a=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",r=n.options.footnoteBackContent||Bx,u=n.options.footnoteBackLabel||Hx,s=n.options.footnoteLabel||"Footnotes",f=n.options.footnoteLabelTagName||"h2",d=n.options.footnoteLabelProperties||{className:["sr-only"]},p=[];let m=-1;for(;++m<n.footnoteOrder.length;){const h=n.footnoteById.get(n.footnoteOrder[m]);if(!h)continue;const v=n.all(h),y=String(h.identifier).toUpperCase(),E=_i(y.toLowerCase());let x=0;const C=[],H=n.footnoteCounts.get(y);for(;H!==void 0&&++x<=H;){C.length>0&&C.push({type:"text",value:" "});let F=typeof r=="string"?r:r(m,x);typeof F=="string"&&(F={type:"text",value:F}),C.push({type:"element",tagName:"a",properties:{href:"#"+a+"fnref-"+E+(x>1?"-"+x:""),dataFootnoteBackref:"",ariaLabel:typeof u=="string"?u:u(m,x),className:["data-footnote-backref"]},children:Array.isArray(F)?F:[F]})}const j=v[v.length-1];if(j&&j.type==="element"&&j.tagName==="p"){const F=j.children[j.children.length-1];F&&F.type==="text"?F.value+=" ":j.children.push({type:"text",value:" "}),j.children.push(...C)}else v.push(...C);const O={type:"element",tagName:"li",properties:{id:a+"fn-"+E},children:n.wrap(v,!0)};n.patch(h,O),p.push(O)}if(p.length!==0)return{type:"element",tagName:"section",properties:{dataFootnotes:!0,className:["footnotes"]},children:[{type:"element",tagName:f,properties:{...pu(d),id:"footnote-label"},children:[{type:"text",value:s}]},{type:"text",value:`\n`},{type:"element",tagName:"ol",properties:{},children:n.wrap(p,!0)},{type:"text",value:`\n`}]}}const bu=(function(n){if(n==null)return Xx;if(typeof n=="function")return Su(n);if(typeof n=="object")return Array.isArray(n)?Yx(n):Vx(n);if(typeof n=="string")return Gx(n);throw new Error("Expected function, string, or object as test")});function Yx(n){const a=[];let r=-1;for(;++r<n.length;)a[r]=bu(n[r]);return Su(u);function u(...s){let f=-1;for(;++f<a.length;)if(a[f].apply(this,s))return!0;return!1}}function Vx(n){const a=n;return Su(r);function r(u){const s=u;let f;for(f in n)if(s[f]!==a[f])return!1;return!0}}function Gx(n){return Su(a);function a(r){return r&&r.type===n}}function Su(n){return a;function a(r,u,s){return!!(Qx(r)&&n.call(this,r,typeof u=="number"?u:void 0,s||void 0))}}function Xx(){return!0}function Qx(n){return n!==null&&typeof n=="object"&&"type"in n}const Cg=[],Zx=!0,vs=!1,Ix="skip";function zg(n,a,r,u){let s;typeof a=="function"&&typeof r!="function"?(u=r,r=a):s=a;const f=bu(s),d=u?-1:1;p(n,void 0,[])();function p(m,h,v){const y=m&&typeof m=="object"?m:{};if(typeof y.type=="string"){const x=typeof y.tagName=="string"?y.tagName:typeof y.name=="string"?y.name:void 0;Object.defineProperty(E,"name",{value:"node ("+(m.type+(x?"<"+x+">":""))+")"})}return E;function E(){let x=Cg,C,H,j;if((!a||f(m,h,v[v.length-1]||void 0))&&(x=Fx(r(m,v)),x[0]===vs))return x;if("children"in m&&m.children){const O=m;if(O.children&&x[0]!==Ix)for(H=(u?O.children.length:-1)+d,j=v.concat(O);H>-1&&H<O.children.length;){const F=O.children[H];if(C=p(F,H,j)(),C[0]===vs)return C;H=typeof C[1]=="number"?C[1]:H+d}}return x}}}function Fx(n){return Array.isArray(n)?n:typeof n=="number"?[Zx,n]:n==null?Cg:[n]}function qs(n,a,r,u){let s,f,d;typeof a=="function"&&typeof r!="function"?(f=void 0,d=a,s=r):(f=a,d=r,s=u),zg(n,f,p,s);function p(m,h){const v=h[h.length-1],y=v?v.children.indexOf(m):void 0;return d(m,y,v)}}const bs={}.hasOwnProperty,Kx={};function Jx(n,a){const r=a||Kx,u=new Map,s=new Map,f=new Map,d={...Mx,...r.handlers},p={all:h,applyData:Wx,definitionById:u,footnoteById:s,footnoteCounts:f,footnoteOrder:[],handlers:d,one:m,options:r,patch:$x,wrap:eE};return qs(n,function(v){if(v.type==="definition"||v.type==="footnoteDefinition"){const y=v.type==="definition"?u:s,E=String(v.identifier).toUpperCase();y.has(E)||y.set(E,v)}}),p;function m(v,y){const E=v.type,x=p.handlers[E];if(bs.call(p.handlers,E)&&x)return x(p,v,y);if(p.options.passThrough&&p.options.passThrough.includes(E)){if("children"in v){const{children:H,...j}=v,O=pu(j);return O.children=p.all(v),O}return pu(v)}return(p.options.unknownHandler||Px)(p,v,y)}function h(v){const y=[];if("children"in v){const E=v.children;let x=-1;for(;++x<E.length;){const C=p.one(E[x],v);if(C){if(x&&E[x-1].type==="break"&&(!Array.isArray(C)&&C.type==="text"&&(C.value=Mm(C.value)),!Array.isArray(C)&&C.type==="element")){const H=C.children[0];H&&H.type==="text"&&(H.value=Mm(H.value))}Array.isArray(C)?y.push(...C):y.push(C)}}}return y}}function $x(n,a){n.position&&(a.position=B0(n))}function Wx(n,a){let r=a;if(n&&n.data){const u=n.data.hName,s=n.data.hChildren,f=n.data.hProperties;if(typeof u=="string")if(r.type==="element")r.tagName=u;else{const d="children"in r?r.children:[r];r={type:"element",tagName:u,properties:{},children:d}}r.type==="element"&&f&&Object.assign(r.properties,pu(f)),"children"in r&&r.children&&s!==null&&s!==void 0&&(r.children=s)}return r}function Px(n,a){const r=a.data||{},u="value"in a&&!(bs.call(r,"hProperties")||bs.call(r,"hChildren"))?{type:"text",value:a.value}:{type:"element",tagName:"div",properties:{},children:n.all(a)};return n.patch(a,u),n.applyData(a,u)}function eE(n,a){const r=[];let u=-1;for(a&&r.push({type:"text",value:`\n`});++u<n.length;)u&&r.push({type:"text",value:`\n`}),r.push(n[u]);return a&&n.length>0&&r.push({type:"text",value:`\n`}),r}function Mm(n){let a=0,r=n.charCodeAt(a);for(;r===9||r===32;)a++,r=n.charCodeAt(a);return n.slice(a)}function Rm(n,a){const r=Jx(n,a),u=r.one(n,void 0),s=qx(r),f=Array.isArray(u)?{type:"root",children:u}:u||{type:"root",children:[]};return s&&f.children.push({type:"text",value:`\n`},s),f}function tE(n,a){return n&&"run"in n?async function(r,u){const s=Rm(r,{file:u,...a});await n.run(s,u)}:function(r,u){return Rm(r,{file:u,...n||a})}}function Nm(n){if(n)throw n}var Jc,Lm;function nE(){if(Lm)return Jc;Lm=1;var n=Object.prototype.hasOwnProperty,a=Object.prototype.toString,r=Object.defineProperty,u=Object.getOwnPropertyDescriptor,s=function(h){return typeof Array.isArray=="function"?Array.isArray(h):a.call(h)==="[object Array]"},f=function(h){if(!h||a.call(h)!=="[object Object]")return!1;var v=n.call(h,"constructor"),y=h.constructor&&h.constructor.prototype&&n.call(h.constructor.prototype,"isPrototypeOf");if(h.constructor&&!v&&!y)return!1;var E;for(E in h);return typeof E>"u"||n.call(h,E)},d=function(h,v){r&&v.name==="__proto__"?r(h,v.name,{enumerable:!0,configurable:!0,value:v.newValue,writable:!0}):h[v.name]=v.newValue},p=function(h,v){if(v==="__proto__")if(n.call(h,v)){if(u)return u(h,v).value}else return;return h[v]};return Jc=function m(){var h,v,y,E,x,C,H=arguments[0],j=1,O=arguments.length,F=!1;for(typeof H=="boolean"&&(F=H,H=arguments[1]||{},j=2),(H==null||typeof H!="object"&&typeof H!="function")&&(H={});j<O;++j)if(h=arguments[j],h!=null)for(v in h)y=p(H,v),E=p(h,v),H!==E&&(F&&E&&(f(E)||(x=s(E)))?(x?(x=!1,C=y&&s(y)?y:[]):C=y&&f(y)?y:{},d(H,{name:v,newValue:m(F,C,E)})):typeof E<"u"&&d(H,{name:v,newValue:E}));return H},Jc}var lE=nE();const $c=ks(lE);function Ss(n){if(typeof n!="object"||n===null)return!1;const a=Object.getPrototypeOf(n);return(a===null||a===Object.prototype||Object.getPrototypeOf(a)===null)&&!(Symbol.toStringTag in n)&&!(Symbol.iterator in n)}function iE(){const n=[],a={run:r,use:u};return a;function r(...s){let f=-1;const d=s.pop();if(typeof d!="function")throw new TypeError("Expected function as last argument, not "+d);p(null,...s);function p(m,...h){const v=n[++f];let y=-1;if(m){d(m);return}for(;++y<s.length;)(h[y]===null||h[y]===void 0)&&(h[y]=s[y]);s=h,v?aE(v,p)(...h):d(null,...h)}}function u(s){if(typeof s!="function")throw new TypeError("Expected `middelware` to be a function, not "+s);return n.push(s),a}}function aE(n,a){let r;return u;function u(...d){const p=n.length>d.length;let m;p&&d.push(s);try{m=n.apply(this,d)}catch(h){const v=h;if(p&&r)throw v;return s(v)}p||(m&&m.then&&typeof m.then=="function"?m.then(f,s):m instanceof Error?s(m):f(m))}function s(d,...p){r||(r=!0,a(d,...p))}function f(d){s(null,d)}}const gn={basename:rE,dirname:uE,extname:oE,join:cE,sep:"/"};function rE(n,a){if(a!==void 0&&typeof a!="string")throw new TypeError(\'"ext" argument must be a string\');Ua(n);let r=0,u=-1,s=n.length,f;if(a===void 0||a.length===0||a.length>n.length){for(;s--;)if(n.codePointAt(s)===47){if(f){r=s+1;break}}else u<0&&(f=!0,u=s+1);return u<0?"":n.slice(r,u)}if(a===n)return"";let d=-1,p=a.length-1;for(;s--;)if(n.codePointAt(s)===47){if(f){r=s+1;break}}else d<0&&(f=!0,d=s+1),p>-1&&(n.codePointAt(s)===a.codePointAt(p--)?p<0&&(u=s):(p=-1,u=d));return r===u?u=d:u<0&&(u=n.length),n.slice(r,u)}function uE(n){if(Ua(n),n.length===0)return".";let a=-1,r=n.length,u;for(;--r;)if(n.codePointAt(r)===47){if(u){a=r;break}}else u||(u=!0);return a<0?n.codePointAt(0)===47?"/":".":a===1&&n.codePointAt(0)===47?"//":n.slice(0,a)}function oE(n){Ua(n);let a=n.length,r=-1,u=0,s=-1,f=0,d;for(;a--;){const p=n.codePointAt(a);if(p===47){if(d){u=a+1;break}continue}r<0&&(d=!0,r=a+1),p===46?s<0?s=a:f!==1&&(f=1):s>-1&&(f=-1)}return s<0||r<0||f===0||f===1&&s===r-1&&s===u+1?"":n.slice(s,r)}function cE(...n){let a=-1,r;for(;++a<n.length;)Ua(n[a]),n[a]&&(r=r===void 0?n[a]:r+"/"+n[a]);return r===void 0?".":sE(r)}function sE(n){Ua(n);const a=n.codePointAt(0)===47;let r=fE(n,!a);return r.length===0&&!a&&(r="."),r.length>0&&n.codePointAt(n.length-1)===47&&(r+="/"),a?"/"+r:r}function fE(n,a){let r="",u=0,s=-1,f=0,d=-1,p,m;for(;++d<=n.length;){if(d<n.length)p=n.codePointAt(d);else{if(p===47)break;p=47}if(p===47){if(!(s===d-1||f===1))if(s!==d-1&&f===2){if(r.length<2||u!==2||r.codePointAt(r.length-1)!==46||r.codePointAt(r.length-2)!==46){if(r.length>2){if(m=r.lastIndexOf("/"),m!==r.length-1){m<0?(r="",u=0):(r=r.slice(0,m),u=r.length-1-r.lastIndexOf("/")),s=d,f=0;continue}}else if(r.length>0){r="",u=0,s=d,f=0;continue}}a&&(r=r.length>0?r+"/..":"..",u=2)}else r.length>0?r+="/"+n.slice(s+1,d):r=n.slice(s+1,d),u=d-s-1;s=d,f=0}else p===46&&f>-1?f++:f=-1}return r}function Ua(n){if(typeof n!="string")throw new TypeError("Path must be a string. Received "+JSON.stringify(n))}const dE={cwd:hE};function hE(){return"/"}function xs(n){return!!(n!==null&&typeof n=="object"&&"href"in n&&n.href&&"protocol"in n&&n.protocol&&n.auth===void 0)}function pE(n){if(typeof n=="string")n=new URL(n);else if(!xs(n)){const a=new TypeError(\'The "path" argument must be of type string or an instance of URL. Received `\'+n+"`");throw a.code="ERR_INVALID_ARG_TYPE",a}if(n.protocol!=="file:"){const a=new TypeError("The URL must be of scheme file");throw a.code="ERR_INVALID_URL_SCHEME",a}return mE(n)}function mE(n){if(n.hostname!==""){const u=new TypeError(\'File URL host must be "localhost" or empty on darwin\');throw u.code="ERR_INVALID_FILE_URL_HOST",u}const a=n.pathname;let r=-1;for(;++r<a.length;)if(a.codePointAt(r)===37&&a.codePointAt(r+1)===50){const u=a.codePointAt(r+2);if(u===70||u===102){const s=new TypeError("File URL path must not include encoded / characters");throw s.code="ERR_INVALID_FILE_URL_PATH",s}}return decodeURIComponent(a)}const Wc=["history","path","basename","stem","extname","dirname"];class _g{constructor(a){let r;a?xs(a)?r={path:a}:typeof a=="string"||gE(a)?r={value:a}:r=a:r={},this.cwd="cwd"in r?"":dE.cwd(),this.data={},this.history=[],this.messages=[],this.value,this.map,this.result,this.stored;let u=-1;for(;++u<Wc.length;){const f=Wc[u];f in r&&r[f]!==void 0&&r[f]!==null&&(this[f]=f==="history"?[...r[f]]:r[f])}let s;for(s in r)Wc.includes(s)||(this[s]=r[s])}get basename(){return typeof this.path=="string"?gn.basename(this.path):void 0}set basename(a){es(a,"basename"),Pc(a,"basename"),this.path=gn.join(this.dirname||"",a)}get dirname(){return typeof this.path=="string"?gn.dirname(this.path):void 0}set dirname(a){Um(this.basename,"dirname"),this.path=gn.join(a||"",this.basename)}get extname(){return typeof this.path=="string"?gn.extname(this.path):void 0}set extname(a){if(Pc(a,"extname"),Um(this.dirname,"extname"),a){if(a.codePointAt(0)!==46)throw new Error("`extname` must start with `.`");if(a.includes(".",1))throw new Error("`extname` cannot contain multiple dots")}this.path=gn.join(this.dirname,this.stem+(a||""))}get path(){return this.history[this.history.length-1]}set path(a){xs(a)&&(a=pE(a)),es(a,"path"),this.path!==a&&this.history.push(a)}get stem(){return typeof this.path=="string"?gn.basename(this.path,this.extname):void 0}set stem(a){es(a,"stem"),Pc(a,"stem"),this.path=gn.join(this.dirname||"",a+(this.extname||""))}fail(a,r,u){const s=this.message(a,r,u);throw s.fatal=!0,s}info(a,r,u){const s=this.message(a,r,u);return s.fatal=void 0,s}message(a,r,u){const s=new Et(a,r,u);return this.path&&(s.name=this.path+":"+s.name,s.file=this.path),s.fatal=!1,this.messages.push(s),s}toString(a){return this.value===void 0?"":typeof this.value=="string"?this.value:new TextDecoder(a||void 0).decode(this.value)}}function Pc(n,a){if(n&&n.includes(gn.sep))throw new Error("`"+a+"` cannot be a path: did not expect `"+gn.sep+"`")}function es(n,a){if(!n)throw new Error("`"+a+"` cannot be empty")}function Um(n,a){if(!n)throw new Error("Setting `"+a+"` requires `path` to be set too")}function gE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const yE=(function(n){const u=this.constructor.prototype,s=u[n],f=function(){return s.apply(f,arguments)};return Object.setPrototypeOf(f,u),f}),vE={}.hasOwnProperty;class Ys extends yE{constructor(){super("copy"),this.Compiler=void 0,this.Parser=void 0,this.attachers=[],this.compiler=void 0,this.freezeIndex=-1,this.frozen=void 0,this.namespace={},this.parser=void 0,this.transformers=iE()}copy(){const a=new Ys;let r=-1;for(;++r<this.attachers.length;){const u=this.attachers[r];a.use(...u)}return a.data($c(!0,{},this.namespace)),a}data(a,r){return typeof a=="string"?arguments.length===2?(ls("data",this.frozen),this.namespace[a]=r,this):vE.call(this.namespace,a)&&this.namespace[a]||void 0:a?(ls("data",this.frozen),this.namespace=a,this):this.namespace}freeze(){if(this.frozen)return this;const a=this;for(;++this.freezeIndex<this.attachers.length;){const[r,...u]=this.attachers[this.freezeIndex];if(u[0]===!1)continue;u[0]===!0&&(u[0]=void 0);const s=r.call(a,...u);typeof s=="function"&&this.transformers.use(s)}return this.frozen=!0,this.freezeIndex=Number.POSITIVE_INFINITY,this}parse(a){this.freeze();const r=au(a),u=this.parser||this.Parser;return ts("parse",u),u(String(r),r)}process(a,r){const u=this;return this.freeze(),ts("process",this.parser||this.Parser),ns("process",this.compiler||this.Compiler),r?s(void 0,r):new Promise(s);function s(f,d){const p=au(a),m=u.parse(p);u.run(m,p,function(v,y,E){if(v||!y||!E)return h(v);const x=y,C=u.stringify(x,E);xE(C)?E.value=C:E.result=C,h(v,E)});function h(v,y){v||!y?d(v):f?f(y):r(void 0,y)}}}processSync(a){let r=!1,u;return this.freeze(),ts("processSync",this.parser||this.Parser),ns("processSync",this.compiler||this.Compiler),this.process(a,s),Bm("processSync","process",r),u;function s(f,d){r=!0,Nm(f),u=d}}run(a,r,u){jm(a),this.freeze();const s=this.transformers;return!u&&typeof r=="function"&&(u=r,r=void 0),u?f(void 0,u):new Promise(f);function f(d,p){const m=au(r);s.run(a,m,h);function h(v,y,E){const x=y||a;v?p(v):d?d(x):u(void 0,x,E)}}}runSync(a,r){let u=!1,s;return this.run(a,r,f),Bm("runSync","run",u),s;function f(d,p){Nm(d),s=p,u=!0}}stringify(a,r){this.freeze();const u=au(r),s=this.compiler||this.Compiler;return ns("stringify",s),jm(a),s(a,u)}use(a,...r){const u=this.attachers,s=this.namespace;if(ls("use",this.frozen),a!=null)if(typeof a=="function")m(a,r);else if(typeof a=="object")Array.isArray(a)?p(a):d(a);else throw new TypeError("Expected usable value, not `"+a+"`");return this;function f(h){if(typeof h=="function")m(h,[]);else if(typeof h=="object")if(Array.isArray(h)){const[v,...y]=h;m(v,y)}else d(h);else throw new TypeError("Expected usable value, not `"+h+"`")}function d(h){if(!("plugins"in h)&&!("settings"in h))throw new Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");p(h.plugins),h.settings&&(s.settings=$c(!0,s.settings,h.settings))}function p(h){let v=-1;if(h!=null)if(Array.isArray(h))for(;++v<h.length;){const y=h[v];f(y)}else throw new TypeError("Expected a list of plugins, not `"+h+"`")}function m(h,v){let y=-1,E=-1;for(;++y<u.length;)if(u[y][0]===h){E=y;break}if(E===-1)u.push([h,...v]);else if(v.length>0){let[x,...C]=v;const H=u[E][1];Ss(H)&&Ss(x)&&(x=$c(!0,H,x)),u[E]=[h,x,...C]}}}}const bE=new Ys().freeze();function ts(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `parser`")}function ns(n,a){if(typeof a!="function")throw new TypeError("Cannot `"+n+"` without `compiler`")}function ls(n,a){if(a)throw new Error("Cannot call `"+n+"` on a frozen processor.\\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.")}function jm(n){if(!Ss(n)||typeof n.type!="string")throw new TypeError("Expected node, got `"+n+"`")}function Bm(n,a,r){if(!r)throw new Error("`"+n+"` finished async. Use `"+a+"` instead")}function au(n){return SE(n)?n:new _g(n)}function SE(n){return!!(n&&typeof n=="object"&&"message"in n&&"messages"in n)}function xE(n){return typeof n=="string"||EE(n)}function EE(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const kE="https://github.com/remarkjs/react-markdown/blob/main/changelog.md",Hm=[],qm={allowDangerousHtml:!0},AE=/^(https?|ircs?|mailto|xmpp)$/i,TE=[{from:"astPlugins",id:"remove-buggy-html-in-markdown-parser"},{from:"allowDangerousHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"allowNode",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowElement"},{from:"allowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowedElements"},{from:"disallowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"disallowedElements"},{from:"escapeHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"includeElementIndex",id:"#remove-includeelementindex"},{from:"includeNodeIndex",id:"change-includenodeindex-to-includeelementindex"},{from:"linkTarget",id:"remove-linktarget"},{from:"plugins",id:"change-plugins-to-remarkplugins",to:"remarkPlugins"},{from:"rawSourcePos",id:"#remove-rawsourcepos"},{from:"renderers",id:"change-renderers-to-components",to:"components"},{from:"source",id:"change-source-to-children",to:"children"},{from:"sourcePos",id:"#remove-sourcepos"},{from:"transformImageUri",id:"#add-urltransform",to:"urlTransform"},{from:"transformLinkUri",id:"#add-urltransform",to:"urlTransform"}];function wE(n){const a=CE(n),r=zE(n);return _E(a.runSync(a.parse(r),r),n)}function CE(n){const a=n.rehypePlugins||Hm,r=n.remarkPlugins||Hm,u=n.remarkRehypeOptions?{...n.remarkRehypeOptions,...qm}:qm;return bE().use(rx).use(r).use(tE,u).use(a)}function zE(n){const a=n.children||"",r=new _g;return typeof a=="string"&&(r.value=a),r}function _E(n,a){const r=a.allowedElements,u=a.allowElement,s=a.components,f=a.disallowedElements,d=a.skipHtml,p=a.unwrapDisallowed,m=a.urlTransform||OE;for(const v of TE)Object.hasOwn(a,v.from)&&(""+v.from+(v.to?"use `"+v.to+"` instead":"remove it")+kE+v.id,void 0);return a.className&&(n={type:"element",tagName:"div",properties:{className:a.className},children:n.type==="root"?n.children:[n]}),qs(n,h),G0(n,{Fragment:J.Fragment,components:s,ignoreInvalidStyle:!0,jsx:J.jsx,jsxs:J.jsxs,passKeys:!0,passNode:!0});function h(v,y,E){if(v.type==="raw"&&E&&typeof y=="number")return d?E.children.splice(y,1):E.children[y]={type:"text",value:v.value},y;if(v.type==="element"){let x;for(x in Ic)if(Object.hasOwn(Ic,x)&&Object.hasOwn(v.properties,x)){const C=v.properties[x],H=Ic[x];(H===null||H.includes(v.tagName))&&(v.properties[x]=m(String(C||""),x,v))}}if(v.type==="element"){let x=r?!r.includes(v.tagName):f?f.includes(v.tagName):!1;if(!x&&u&&typeof y=="number"&&(x=!u(v,y,E)),x&&E&&typeof y=="number")return p&&v.children?E.children.splice(y,1,...v.children):E.children.splice(y,1),y}}}function OE(n){const a=n.indexOf(":"),r=n.indexOf("?"),u=n.indexOf("#"),s=n.indexOf("/");return a===-1||s!==-1&&a>s||r!==-1&&a>r||u!==-1&&a>u||AE.test(n.slice(0,a))?n:""}function Ym(n,a){const r=String(n);if(typeof a!="string")throw new TypeError("Expected character");let u=0,s=r.indexOf(a);for(;s!==-1;)u++,s=r.indexOf(a,s+a.length);return u}function DE(n){if(typeof n!="string")throw new TypeError("Expected a string");return n.replace(/[|\\\\{}()[\\]^$+*?.]/g,"\\\\$&").replace(/-/g,"\\\\x2d")}function ME(n,a,r){const s=bu((r||{}).ignore||[]),f=RE(a);let d=-1;for(;++d<f.length;)zg(n,"text",p);function p(h,v){let y=-1,E;for(;++y<v.length;){const x=v[y],C=E?E.children:void 0;if(s(x,C?C.indexOf(x):void 0,E))return;E=x}if(E)return m(h,v)}function m(h,v){const y=v[v.length-1],E=f[d][0],x=f[d][1];let C=0;const j=y.children.indexOf(h);let O=!1,F=[];E.lastIndex=0;let X=E.exec(h.value);for(;X;){const ne=X.index,re={index:X.index,input:X.input,stack:[...v,h]};let B=x(...X,re);if(typeof B=="string"&&(B=B.length>0?{type:"text",value:B}:void 0),B===!1?E.lastIndex=ne+1:(C!==ne&&F.push({type:"text",value:h.value.slice(C,ne)}),Array.isArray(B)?F.push(...B):B&&F.push(B),C=ne+X[0].length,O=!0),!E.global)break;X=E.exec(h.value)}return O?(C<h.value.length&&F.push({type:"text",value:h.value.slice(C)}),y.children.splice(j,1,...F)):F=[h],j+F.length}}function RE(n){const a=[];if(!Array.isArray(n))throw new TypeError("Expected find and replace tuple or list of tuples");const r=!n[0]||Array.isArray(n[0])?n:[n];let u=-1;for(;++u<r.length;){const s=r[u];a.push([NE(s[0]),LE(s[1])])}return a}function NE(n){return typeof n=="string"?new RegExp(DE(n),"g"):n}function LE(n){return typeof n=="function"?n:function(){return n}}const is="phrasing",as=["autolink","link","image","label"];function UE(){return{transforms:[GE],enter:{literalAutolink:BE,literalAutolinkEmail:rs,literalAutolinkHttp:rs,literalAutolinkWww:rs},exit:{literalAutolink:VE,literalAutolinkEmail:YE,literalAutolinkHttp:HE,literalAutolinkWww:qE}}}function jE(){return{unsafe:[{character:"@",before:"[+\\\\-.\\\\w]",after:"[\\\\-.\\\\w]",inConstruct:is,notInConstruct:as},{character:".",before:"[Ww]",after:"[\\\\-.\\\\w]",inConstruct:is,notInConstruct:as},{character:":",before:"[ps]",after:"\\\\/",inConstruct:is,notInConstruct:as}]}}function BE(n){this.enter({type:"link",title:null,url:"",children:[]},n)}function rs(n){this.config.enter.autolinkProtocol.call(this,n)}function HE(n){this.config.exit.autolinkProtocol.call(this,n)}function qE(n){this.config.exit.data.call(this,n);const a=this.stack[this.stack.length-1];a.type,a.url="http://"+this.sliceSerialize(n)}function YE(n){this.config.exit.autolinkEmail.call(this,n)}function VE(n){this.exit(n)}function GE(n){ME(n,[[/(https?:\\/\\/|www(?=\\.))([-.\\w]+)([^ \\t\\r\\n]*)/gi,XE],[/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)/gu,QE]],{ignore:["link","linkReference"]})}function XE(n,a,r,u,s){let f="";if(!Og(s)||(/^w/i.test(a)&&(r=a+r,a="",f="http://"),!ZE(r)))return!1;const d=IE(r+u);if(!d[0])return!1;const p={type:"link",title:null,url:f+a+d[0],children:[{type:"text",value:a+d[0]}]};return d[1]?[p,{type:"text",value:d[1]}]:p}function QE(n,a,r,u){return!Og(u,!0)||/[-\\d_]$/.test(r)?!1:{type:"link",title:null,url:"mailto:"+a+"@"+r,children:[{type:"text",value:a+"@"+r}]}}function ZE(n){const a=n.split(".");return!(a.length<2||a[a.length-1]&&(/_/.test(a[a.length-1])||!/[a-zA-Z\\d]/.test(a[a.length-1]))||a[a.length-2]&&(/_/.test(a[a.length-2])||!/[a-zA-Z\\d]/.test(a[a.length-2])))}function IE(n){const a=/[!"&\'),.:;<>?\\]}]+$/.exec(n);if(!a)return[n,void 0];n=n.slice(0,a.index);let r=a[0],u=r.indexOf(")");const s=Ym(n,"(");let f=Ym(n,")");for(;u!==-1&&s>f;)n+=r.slice(0,u+1),r=r.slice(u+1),u=r.indexOf(")"),f++;return[n,r]}function Og(n,a){const r=n.input.charCodeAt(n.index-1);return(n.index===0||Ml(r)||gu(r))&&(!a||r!==47)}Dg.peek=nk;function FE(){this.buffer()}function KE(n){this.enter({type:"footnoteReference",identifier:"",label:""},n)}function JE(){this.buffer()}function $E(n){this.enter({type:"footnoteDefinition",identifier:"",label:"",children:[]},n)}function WE(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=fn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function PE(n){this.exit(n)}function ek(n){const a=this.resume(),r=this.stack[this.stack.length-1];r.type,r.identifier=fn(this.sliceSerialize(n)).toLowerCase(),r.label=a}function tk(n){this.exit(n)}function nk(){return"["}function Dg(n,a,r,u){const s=r.createTracker(u);let f=s.move("[^");const d=r.enter("footnoteReference"),p=r.enter("reference");return f+=s.move(r.safe(r.associationId(n),{after:"]",before:f})),p(),d(),f+=s.move("]"),f}function lk(){return{enter:{gfmFootnoteCallString:FE,gfmFootnoteCall:KE,gfmFootnoteDefinitionLabelString:JE,gfmFootnoteDefinition:$E},exit:{gfmFootnoteCallString:WE,gfmFootnoteCall:PE,gfmFootnoteDefinitionLabelString:ek,gfmFootnoteDefinition:tk}}}function ik(n){let a=!1;return n&&n.firstLineBlank&&(a=!0),{handlers:{footnoteDefinition:r,footnoteReference:Dg},unsafe:[{character:"[",inConstruct:["label","phrasing","reference"]}]};function r(u,s,f,d){const p=f.createTracker(d);let m=p.move("[^");const h=f.enter("footnoteDefinition"),v=f.enter("label");return m+=p.move(f.safe(f.associationId(u),{before:m,after:"]"})),v(),m+=p.move("]:"),u.children&&u.children.length>0&&(p.shift(4),m+=p.move((a?`\n`:" ")+f.indentLines(f.containerFlow(u,p.current()),a?Mg:ak))),h(),m}}function ak(n,a,r){return a===0?n:Mg(n,a,r)}function Mg(n,a,r){return(r?"":"    ")+n}const rk=["autolink","destinationLiteral","destinationRaw","reference","titleQuote","titleApostrophe"];Rg.peek=fk;function uk(){return{canContainEols:["delete"],enter:{strikethrough:ck},exit:{strikethrough:sk}}}function ok(){return{unsafe:[{character:"~",inConstruct:"phrasing",notInConstruct:rk}],handlers:{delete:Rg}}}function ck(n){this.enter({type:"delete",children:[]},n)}function sk(n){this.exit(n)}function Rg(n,a,r,u){const s=r.createTracker(u),f=r.enter("strikethrough");let d=s.move("~~");return d+=r.containerPhrasing(n,{...s.current(),before:d,after:"~"}),d+=s.move("~~"),f(),d}function fk(){return"~"}function dk(n){return n.length}function hk(n,a){const r=a||{},u=(r.align||[]).concat(),s=r.stringLength||dk,f=[],d=[],p=[],m=[];let h=0,v=-1;for(;++v<n.length;){const H=[],j=[];let O=-1;for(n[v].length>h&&(h=n[v].length);++O<n[v].length;){const F=pk(n[v][O]);if(r.alignDelimiters!==!1){const X=s(F);j[O]=X,(m[O]===void 0||X>m[O])&&(m[O]=X)}H.push(F)}d[v]=H,p[v]=j}let y=-1;if(typeof u=="object"&&"length"in u)for(;++y<h;)f[y]=Vm(u[y]);else{const H=Vm(u);for(;++y<h;)f[y]=H}y=-1;const E=[],x=[];for(;++y<h;){const H=f[y];let j="",O="";H===99?(j=":",O=":"):H===108?j=":":H===114&&(O=":");let F=r.alignDelimiters===!1?1:Math.max(1,m[y]-j.length-O.length);const X=j+"-".repeat(F)+O;r.alignDelimiters!==!1&&(F=j.length+F+O.length,F>m[y]&&(m[y]=F),x[y]=F),E[y]=X}d.splice(1,0,E),p.splice(1,0,x),v=-1;const C=[];for(;++v<d.length;){const H=d[v],j=p[v];y=-1;const O=[];for(;++y<h;){const F=H[y]||"";let X="",ne="";if(r.alignDelimiters!==!1){const re=m[y]-(j[y]||0),B=f[y];B===114?X=" ".repeat(re):B===99?re%2?(X=" ".repeat(re/2+.5),ne=" ".repeat(re/2-.5)):(X=" ".repeat(re/2),ne=X):ne=" ".repeat(re)}r.delimiterStart!==!1&&!y&&O.push("|"),r.padding!==!1&&!(r.alignDelimiters===!1&&F==="")&&(r.delimiterStart!==!1||y)&&O.push(" "),r.alignDelimiters!==!1&&O.push(X),O.push(F),r.alignDelimiters!==!1&&O.push(ne),r.padding!==!1&&O.push(" "),(r.delimiterEnd!==!1||y!==h-1)&&O.push("|")}C.push(r.delimiterEnd===!1?O.join("").replace(/ +$/,""):O.join(""))}return C.join(`\n`)}function pk(n){return n==null?"":String(n)}function Vm(n){const a=typeof n=="string"?n.codePointAt(0):0;return a===67||a===99?99:a===76||a===108?108:a===82||a===114?114:0}function mk(n,a,r,u){const s=r.enter("blockquote"),f=r.createTracker(u);f.move("> "),f.shift(2);const d=r.indentLines(r.containerFlow(n,f.current()),gk);return s(),d}function gk(n,a,r){return">"+(r?"":" ")+n}function yk(n,a){return Gm(n,a.inConstruct,!0)&&!Gm(n,a.notInConstruct,!1)}function Gm(n,a,r){if(typeof a=="string"&&(a=[a]),!a||a.length===0)return r;let u=-1;for(;++u<a.length;)if(n.includes(a[u]))return!0;return!1}function Xm(n,a,r,u){let s=-1;for(;++s<r.unsafe.length;)if(r.unsafe[s].character===`\n`&&yk(r.stack,r.unsafe[s]))return/[ \\t]/.test(u.before)?"":" ";return`\\\\\n`}function vk(n,a){const r=String(n);let u=r.indexOf(a),s=u,f=0,d=0;if(typeof a!="string")throw new TypeError("Expected substring");for(;u!==-1;)u===s?++f>d&&(d=f):f=1,s=u+a.length,u=r.indexOf(a,s);return d}function bk(n,a){return!!(a.options.fences===!1&&n.value&&!n.lang&&/[^ \\r\\n]/.test(n.value)&&!/^[\\t ]*(?:[\\r\\n]|$)|(?:^|[\\r\\n])[\\t ]*$/.test(n.value))}function Sk(n){const a=n.options.fence||"`";if(a!=="`"&&a!=="~")throw new Error("Cannot serialize code with `"+a+"` for `options.fence`, expected `` ` `` or `~`");return a}function xk(n,a,r,u){const s=Sk(r),f=n.value||"",d=s==="`"?"GraveAccent":"Tilde";if(bk(n,r)){const y=r.enter("codeIndented"),E=r.indentLines(f,Ek);return y(),E}const p=r.createTracker(u),m=s.repeat(Math.max(vk(f,s)+1,3)),h=r.enter("codeFenced");let v=p.move(m);if(n.lang){const y=r.enter(`codeFencedLang${d}`);v+=p.move(r.safe(n.lang,{before:v,after:" ",encode:["`"],...p.current()})),y()}if(n.lang&&n.meta){const y=r.enter(`codeFencedMeta${d}`);v+=p.move(" "),v+=p.move(r.safe(n.meta,{before:v,after:`\n`,encode:["`"],...p.current()})),y()}return v+=p.move(`\n`),f&&(v+=p.move(f+`\n`)),v+=p.move(m),h(),v}function Ek(n,a,r){return(r?"":"    ")+n}function Vs(n){const a=n.options.quote||\'"\';if(a!==\'"\'&&a!=="\'")throw new Error("Cannot serialize title with `"+a+"` for `options.quote`, expected `\\"`, or `\'`");return a}function kk(n,a,r,u){const s=Vs(r),f=s===\'"\'?"Quote":"Apostrophe",d=r.enter("definition");let p=r.enter("label");const m=r.createTracker(u);let h=m.move("[");return h+=m.move(r.safe(r.associationId(n),{before:h,after:"]",...m.current()})),h+=m.move("]: "),p(),!n.url||/[\\0- \\u007F]/.test(n.url)?(p=r.enter("destinationLiteral"),h+=m.move("<"),h+=m.move(r.safe(n.url,{before:h,after:">",...m.current()})),h+=m.move(">")):(p=r.enter("destinationRaw"),h+=m.move(r.safe(n.url,{before:h,after:n.title?" ":`\n`,...m.current()}))),p(),n.title&&(p=r.enter(`title${f}`),h+=m.move(" "+s),h+=m.move(r.safe(n.title,{before:h,after:s,...m.current()})),h+=m.move(s),p()),d(),h}function Ak(n){const a=n.options.emphasis||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize emphasis with `"+a+"` for `options.emphasis`, expected `*`, or `_`");return a}function Ra(n){return"&#x"+n.toString(16).toUpperCase()+";"}function mu(n,a,r){const u=Ci(n),s=Ci(a);return u===void 0?s===void 0?r==="_"?{inside:!0,outside:!0}:{inside:!1,outside:!1}:s===1?{inside:!0,outside:!0}:{inside:!1,outside:!0}:u===1?s===void 0?{inside:!1,outside:!1}:s===1?{inside:!0,outside:!0}:{inside:!1,outside:!1}:s===void 0?{inside:!1,outside:!1}:s===1?{inside:!0,outside:!1}:{inside:!1,outside:!1}}Ng.peek=Tk;function Ng(n,a,r,u){const s=Ak(r),f=r.enter("emphasis"),d=r.createTracker(u),p=d.move(s);let m=d.move(r.containerPhrasing(n,{after:s,before:p,...d.current()}));const h=m.charCodeAt(0),v=mu(u.before.charCodeAt(u.before.length-1),h,s);v.inside&&(m=Ra(h)+m.slice(1));const y=m.charCodeAt(m.length-1),E=mu(u.after.charCodeAt(0),y,s);E.inside&&(m=m.slice(0,-1)+Ra(y));const x=d.move(s);return f(),r.attentionEncodeSurroundingInfo={after:E.outside,before:v.outside},p+m+x}function Tk(n,a,r){return r.options.emphasis||"*"}function wk(n,a){let r=!1;return qs(n,function(u){if("value"in u&&/\\r?\\n|\\r/.test(u.value)||u.type==="break")return r=!0,vs}),!!((!n.depth||n.depth<3)&&Rs(n)&&(a.options.setext||r))}function Ck(n,a,r,u){const s=Math.max(Math.min(6,n.depth||1),1),f=r.createTracker(u);if(wk(n,r)){const v=r.enter("headingSetext"),y=r.enter("phrasing"),E=r.containerPhrasing(n,{...f.current(),before:`\n`,after:`\n`});return y(),v(),E+`\n`+(s===1?"=":"-").repeat(E.length-(Math.max(E.lastIndexOf("\\r"),E.lastIndexOf(`\n`))+1))}const d="#".repeat(s),p=r.enter("headingAtx"),m=r.enter("phrasing");f.move(d+" ");let h=r.containerPhrasing(n,{before:"# ",after:`\n`,...f.current()});return/^[\\t ]/.test(h)&&(h=Ra(h.charCodeAt(0))+h.slice(1)),h=h?d+" "+h:d,r.options.closeAtx&&(h+=" "+d),m(),p(),h}Lg.peek=zk;function Lg(n){return n.value||""}function zk(){return"<"}Ug.peek=_k;function Ug(n,a,r,u){const s=Vs(r),f=s===\'"\'?"Quote":"Apostrophe",d=r.enter("image");let p=r.enter("label");const m=r.createTracker(u);let h=m.move("![");return h+=m.move(r.safe(n.alt,{before:h,after:"]",...m.current()})),h+=m.move("]("),p(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(p=r.enter("destinationLiteral"),h+=m.move("<"),h+=m.move(r.safe(n.url,{before:h,after:">",...m.current()})),h+=m.move(">")):(p=r.enter("destinationRaw"),h+=m.move(r.safe(n.url,{before:h,after:n.title?" ":")",...m.current()}))),p(),n.title&&(p=r.enter(`title${f}`),h+=m.move(" "+s),h+=m.move(r.safe(n.title,{before:h,after:s,...m.current()})),h+=m.move(s),p()),h+=m.move(")"),d(),h}function _k(){return"!"}jg.peek=Ok;function jg(n,a,r,u){const s=n.referenceType,f=r.enter("imageReference");let d=r.enter("label");const p=r.createTracker(u);let m=p.move("![");const h=r.safe(n.alt,{before:m,after:"]",...p.current()});m+=p.move(h+"]["),d();const v=r.stack;r.stack=[],d=r.enter("reference");const y=r.safe(r.associationId(n),{before:m,after:"]",...p.current()});return d(),r.stack=v,f(),s==="full"||!h||h!==y?m+=p.move(y+"]"):s==="shortcut"?m=m.slice(0,-1):m+=p.move("]"),m}function Ok(){return"!"}Bg.peek=Dk;function Bg(n,a,r){let u=n.value||"",s="`",f=-1;for(;new RegExp("(^|[^`])"+s+"([^`]|$)").test(u);)s+="`";for(/[^ \\r\\n]/.test(u)&&(/^[ \\r\\n]/.test(u)&&/[ \\r\\n]$/.test(u)||/^`|`$/.test(u))&&(u=" "+u+" ");++f<r.unsafe.length;){const d=r.unsafe[f],p=r.compilePattern(d);let m;if(d.atBreak)for(;m=p.exec(u);){let h=m.index;u.charCodeAt(h)===10&&u.charCodeAt(h-1)===13&&h--,u=u.slice(0,h)+" "+u.slice(m.index+1)}}return s+u+s}function Dk(){return"`"}function Hg(n,a){const r=Rs(n);return!!(!a.options.resourceLink&&n.url&&!n.title&&n.children&&n.children.length===1&&n.children[0].type==="text"&&(r===n.url||"mailto:"+r===n.url)&&/^[a-z][a-z+.-]+:/i.test(n.url)&&!/[\\0- <>\\u007F]/.test(n.url))}qg.peek=Mk;function qg(n,a,r,u){const s=Vs(r),f=s===\'"\'?"Quote":"Apostrophe",d=r.createTracker(u);let p,m;if(Hg(n,r)){const v=r.stack;r.stack=[],p=r.enter("autolink");let y=d.move("<");return y+=d.move(r.containerPhrasing(n,{before:y,after:">",...d.current()})),y+=d.move(">"),p(),r.stack=v,y}p=r.enter("link"),m=r.enter("label");let h=d.move("[");return h+=d.move(r.containerPhrasing(n,{before:h,after:"](",...d.current()})),h+=d.move("]("),m(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(m=r.enter("destinationLiteral"),h+=d.move("<"),h+=d.move(r.safe(n.url,{before:h,after:">",...d.current()})),h+=d.move(">")):(m=r.enter("destinationRaw"),h+=d.move(r.safe(n.url,{before:h,after:n.title?" ":")",...d.current()}))),m(),n.title&&(m=r.enter(`title${f}`),h+=d.move(" "+s),h+=d.move(r.safe(n.title,{before:h,after:s,...d.current()})),h+=d.move(s),m()),h+=d.move(")"),p(),h}function Mk(n,a,r){return Hg(n,r)?"<":"["}Yg.peek=Rk;function Yg(n,a,r,u){const s=n.referenceType,f=r.enter("linkReference");let d=r.enter("label");const p=r.createTracker(u);let m=p.move("[");const h=r.containerPhrasing(n,{before:m,after:"]",...p.current()});m+=p.move(h+"]["),d();const v=r.stack;r.stack=[],d=r.enter("reference");const y=r.safe(r.associationId(n),{before:m,after:"]",...p.current()});return d(),r.stack=v,f(),s==="full"||!h||h!==y?m+=p.move(y+"]"):s==="shortcut"?m=m.slice(0,-1):m+=p.move("]"),m}function Rk(){return"["}function Gs(n){const a=n.options.bullet||"*";if(a!=="*"&&a!=="+"&&a!=="-")throw new Error("Cannot serialize items with `"+a+"` for `options.bullet`, expected `*`, `+`, or `-`");return a}function Nk(n){const a=Gs(n),r=n.options.bulletOther;if(!r)return a==="*"?"-":"*";if(r!=="*"&&r!=="+"&&r!=="-")throw new Error("Cannot serialize items with `"+r+"` for `options.bulletOther`, expected `*`, `+`, or `-`");if(r===a)throw new Error("Expected `bullet` (`"+a+"`) and `bulletOther` (`"+r+"`) to be different");return r}function Lk(n){const a=n.options.bulletOrdered||".";if(a!=="."&&a!==")")throw new Error("Cannot serialize items with `"+a+"` for `options.bulletOrdered`, expected `.` or `)`");return a}function Vg(n){const a=n.options.rule||"*";if(a!=="*"&&a!=="-"&&a!=="_")throw new Error("Cannot serialize rules with `"+a+"` for `options.rule`, expected `*`, `-`, or `_`");return a}function Uk(n,a,r,u){const s=r.enter("list"),f=r.bulletCurrent;let d=n.ordered?Lk(r):Gs(r);const p=n.ordered?d==="."?")":".":Nk(r);let m=a&&r.bulletLastUsed?d===r.bulletLastUsed:!1;if(!n.ordered){const v=n.children?n.children[0]:void 0;if((d==="*"||d==="-")&&v&&(!v.children||!v.children[0])&&r.stack[r.stack.length-1]==="list"&&r.stack[r.stack.length-2]==="listItem"&&r.stack[r.stack.length-3]==="list"&&r.stack[r.stack.length-4]==="listItem"&&r.indexStack[r.indexStack.length-1]===0&&r.indexStack[r.indexStack.length-2]===0&&r.indexStack[r.indexStack.length-3]===0&&(m=!0),Vg(r)===d&&v){let y=-1;for(;++y<n.children.length;){const E=n.children[y];if(E&&E.type==="listItem"&&E.children&&E.children[0]&&E.children[0].type==="thematicBreak"){m=!0;break}}}}m&&(d=p),r.bulletCurrent=d;const h=r.containerFlow(n,u);return r.bulletLastUsed=d,r.bulletCurrent=f,s(),h}function jk(n){const a=n.options.listItemIndent||"one";if(a!=="tab"&&a!=="one"&&a!=="mixed")throw new Error("Cannot serialize items with `"+a+"` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");return a}function Bk(n,a,r,u){const s=jk(r);let f=r.bulletCurrent||Gs(r);a&&a.type==="list"&&a.ordered&&(f=(typeof a.start=="number"&&a.start>-1?a.start:1)+(r.options.incrementListMarker===!1?0:a.children.indexOf(n))+f);let d=f.length+1;(s==="tab"||s==="mixed"&&(a&&a.type==="list"&&a.spread||n.spread))&&(d=Math.ceil(d/4)*4);const p=r.createTracker(u);p.move(f+" ".repeat(d-f.length)),p.shift(d);const m=r.enter("listItem"),h=r.indentLines(r.containerFlow(n,p.current()),v);return m(),h;function v(y,E,x){return E?(x?"":" ".repeat(d))+y:(x?f:f+" ".repeat(d-f.length))+y}}function Hk(n,a,r,u){const s=r.enter("paragraph"),f=r.enter("phrasing"),d=r.containerPhrasing(n,u);return f(),s(),d}const qk=bu(["break","delete","emphasis","footnote","footnoteReference","image","imageReference","inlineCode","inlineMath","link","linkReference","mdxJsxTextElement","mdxTextExpression","strong","text","textDirective"]);function Yk(n,a,r,u){return(n.children.some(function(d){return qk(d)})?r.containerPhrasing:r.containerFlow).call(r,n,u)}function Vk(n){const a=n.options.strong||"*";if(a!=="*"&&a!=="_")throw new Error("Cannot serialize strong with `"+a+"` for `options.strong`, expected `*`, or `_`");return a}Gg.peek=Gk;function Gg(n,a,r,u){const s=Vk(r),f=r.enter("strong"),d=r.createTracker(u),p=d.move(s+s);let m=d.move(r.containerPhrasing(n,{after:s,before:p,...d.current()}));const h=m.charCodeAt(0),v=mu(u.before.charCodeAt(u.before.length-1),h,s);v.inside&&(m=Ra(h)+m.slice(1));const y=m.charCodeAt(m.length-1),E=mu(u.after.charCodeAt(0),y,s);E.inside&&(m=m.slice(0,-1)+Ra(y));const x=d.move(s+s);return f(),r.attentionEncodeSurroundingInfo={after:E.outside,before:v.outside},p+m+x}function Gk(n,a,r){return r.options.strong||"*"}function Xk(n,a,r,u){return r.safe(n.value,u)}function Qk(n){const a=n.options.ruleRepetition||3;if(a<3)throw new Error("Cannot serialize rules with repetition `"+a+"` for `options.ruleRepetition`, expected `3` or more");return a}function Zk(n,a,r){const u=(Vg(r)+(r.options.ruleSpaces?" ":"")).repeat(Qk(r));return r.options.ruleSpaces?u.slice(0,-1):u}const Xg={blockquote:mk,break:Xm,code:xk,definition:kk,emphasis:Ng,hardBreak:Xm,heading:Ck,html:Lg,image:Ug,imageReference:jg,inlineCode:Bg,link:qg,linkReference:Yg,list:Uk,listItem:Bk,paragraph:Hk,root:Yk,strong:Gg,text:Xk,thematicBreak:Zk};function Ik(){return{enter:{table:Fk,tableData:Qm,tableHeader:Qm,tableRow:Jk},exit:{codeText:$k,table:Kk,tableData:us,tableHeader:us,tableRow:us}}}function Fk(n){const a=n._align;this.enter({type:"table",align:a.map(function(r){return r==="none"?null:r}),children:[]},n),this.data.inTable=!0}function Kk(n){this.exit(n),this.data.inTable=void 0}function Jk(n){this.enter({type:"tableRow",children:[]},n)}function us(n){this.exit(n)}function Qm(n){this.enter({type:"tableCell",children:[]},n)}function $k(n){let a=this.resume();this.data.inTable&&(a=a.replace(/\\\\([\\\\|])/g,Wk));const r=this.stack[this.stack.length-1];r.type,r.value=a,this.exit(n)}function Wk(n,a){return a==="|"?a:n}function Pk(n){const a=n||{},r=a.tableCellPadding,u=a.tablePipeAlign,s=a.stringLength,f=r?" ":"|";return{unsafe:[{character:"\\r",inConstruct:"tableCell"},{character:`\n`,inConstruct:"tableCell"},{atBreak:!0,character:"|",after:"[	 :-]"},{character:"|",inConstruct:"tableCell"},{atBreak:!0,character:":",after:"-"},{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{inlineCode:E,table:d,tableCell:m,tableRow:p}};function d(x,C,H,j){return h(v(x,H,j),x.align)}function p(x,C,H,j){const O=y(x,H,j),F=h([O]);return F.slice(0,F.indexOf(`\n`))}function m(x,C,H,j){const O=H.enter("tableCell"),F=H.enter("phrasing"),X=H.containerPhrasing(x,{...j,before:f,after:f});return F(),O(),X}function h(x,C){return hk(x,{align:C,alignDelimiters:u,padding:r,stringLength:s})}function v(x,C,H){const j=x.children;let O=-1;const F=[],X=C.enter("table");for(;++O<j.length;)F[O]=y(j[O],C,H);return X(),F}function y(x,C,H){const j=x.children;let O=-1;const F=[],X=C.enter("tableRow");for(;++O<j.length;)F[O]=m(j[O],x,C,H);return X(),F}function E(x,C,H){let j=Xg.inlineCode(x,C,H);return H.stack.includes("tableCell")&&(j=j.replace(/\\|/g,"\\\\$&")),j}}function e2(){return{exit:{taskListCheckValueChecked:Zm,taskListCheckValueUnchecked:Zm,paragraph:n2}}}function t2(){return{unsafe:[{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{listItem:l2}}}function Zm(n){const a=this.stack[this.stack.length-2];a.type,a.checked=n.type==="taskListCheckValueChecked"}function n2(n){const a=this.stack[this.stack.length-2];if(a&&a.type==="listItem"&&typeof a.checked=="boolean"){const r=this.stack[this.stack.length-1];r.type;const u=r.children[0];if(u&&u.type==="text"){const s=a.children;let f=-1,d;for(;++f<s.length;){const p=s[f];if(p.type==="paragraph"){d=p;break}}d===r&&(u.value=u.value.slice(1),u.value.length===0?r.children.shift():r.position&&u.position&&typeof u.position.start.offset=="number"&&(u.position.start.column++,u.position.start.offset++,r.position.start=Object.assign({},u.position.start)))}}this.exit(n)}function l2(n,a,r,u){const s=n.children[0],f=typeof n.checked=="boolean"&&s&&s.type==="paragraph",d="["+(n.checked?"x":" ")+"] ",p=r.createTracker(u);f&&p.move(d);let m=Xg.listItem(n,a,r,{...u,...p.current()});return f&&(m=m.replace(/^(?:[*+-]|\\d+\\.)([\\r\\n]| {1,3})/,h)),m;function h(v){return v+d}}function i2(){return[UE(),lk(),uk(),Ik(),e2()]}function a2(n){return{extensions:[jE(),ik(n),ok(),Pk(n),t2()]}}const r2={tokenize:d2,partial:!0},Qg={tokenize:h2,partial:!0},Zg={tokenize:p2,partial:!0},Ig={tokenize:m2,partial:!0},u2={tokenize:g2,partial:!0},Fg={name:"wwwAutolink",tokenize:s2,previous:Jg},Kg={name:"protocolAutolink",tokenize:f2,previous:$g},Bn={name:"emailAutolink",tokenize:c2,previous:Wg},vn={};function o2(){return{text:vn}}let Ol=48;for(;Ol<123;)vn[Ol]=Bn,Ol++,Ol===58?Ol=65:Ol===91&&(Ol=97);vn[43]=Bn;vn[45]=Bn;vn[46]=Bn;vn[95]=Bn;vn[72]=[Bn,Kg];vn[104]=[Bn,Kg];vn[87]=[Bn,Fg];vn[119]=[Bn,Fg];function c2(n,a,r){const u=this;let s,f;return d;function d(y){return!Es(y)||!Wg.call(u,u.previous)||Xs(u.events)?r(y):(n.enter("literalAutolink"),n.enter("literalAutolinkEmail"),p(y))}function p(y){return Es(y)?(n.consume(y),p):y===64?(n.consume(y),m):r(y)}function m(y){return y===46?n.check(u2,v,h)(y):y===45||y===95||xt(y)?(f=!0,n.consume(y),m):v(y)}function h(y){return n.consume(y),s=!0,m}function v(y){return f&&s&&zt(u.previous)?(n.exit("literalAutolinkEmail"),n.exit("literalAutolink"),a(y)):r(y)}}function s2(n,a,r){const u=this;return s;function s(d){return d!==87&&d!==119||!Jg.call(u,u.previous)||Xs(u.events)?r(d):(n.enter("literalAutolink"),n.enter("literalAutolinkWww"),n.check(r2,n.attempt(Qg,n.attempt(Zg,f),r),r)(d))}function f(d){return n.exit("literalAutolinkWww"),n.exit("literalAutolink"),a(d)}}function f2(n,a,r){const u=this;let s="",f=!1;return d;function d(y){return(y===72||y===104)&&$g.call(u,u.previous)&&!Xs(u.events)?(n.enter("literalAutolink"),n.enter("literalAutolinkHttp"),s+=String.fromCodePoint(y),n.consume(y),p):r(y)}function p(y){if(zt(y)&&s.length<5)return s+=String.fromCodePoint(y),n.consume(y),p;if(y===58){const E=s.toLowerCase();if(E==="http"||E==="https")return n.consume(y),m}return r(y)}function m(y){return y===47?(n.consume(y),f?h:(f=!0,m)):r(y)}function h(y){return y===null||du(y)||Qe(y)||Ml(y)||gu(y)?r(y):n.attempt(Qg,n.attempt(Zg,v),r)(y)}function v(y){return n.exit("literalAutolinkHttp"),n.exit("literalAutolink"),a(y)}}function d2(n,a,r){let u=0;return s;function s(d){return(d===87||d===119)&&u<3?(u++,n.consume(d),s):d===46&&u===3?(n.consume(d),f):r(d)}function f(d){return d===null?r(d):a(d)}}function h2(n,a,r){let u,s,f;return d;function d(h){return h===46||h===95?n.check(Ig,m,p)(h):h===null||Qe(h)||Ml(h)||h!==45&&gu(h)?m(h):(f=!0,n.consume(h),d)}function p(h){return h===95?u=!0:(s=u,u=void 0),n.consume(h),d}function m(h){return s||u||!f?r(h):a(h)}}function p2(n,a){let r=0,u=0;return s;function s(d){return d===40?(r++,n.consume(d),s):d===41&&u<r?f(d):d===33||d===34||d===38||d===39||d===41||d===42||d===44||d===46||d===58||d===59||d===60||d===63||d===93||d===95||d===126?n.check(Ig,a,f)(d):d===null||Qe(d)||Ml(d)?a(d):(n.consume(d),s)}function f(d){return d===41&&u++,n.consume(d),s}}function m2(n,a,r){return u;function u(p){return p===33||p===34||p===39||p===41||p===42||p===44||p===46||p===58||p===59||p===63||p===95||p===126?(n.consume(p),u):p===38?(n.consume(p),f):p===93?(n.consume(p),s):p===60||p===null||Qe(p)||Ml(p)?a(p):r(p)}function s(p){return p===null||p===40||p===91||Qe(p)||Ml(p)?a(p):u(p)}function f(p){return zt(p)?d(p):r(p)}function d(p){return p===59?(n.consume(p),u):zt(p)?(n.consume(p),d):r(p)}}function g2(n,a,r){return u;function u(f){return n.consume(f),s}function s(f){return xt(f)?r(f):a(f)}}function Jg(n){return n===null||n===40||n===42||n===95||n===91||n===93||n===126||Qe(n)}function $g(n){return!zt(n)}function Wg(n){return!(n===47||Es(n))}function Es(n){return n===43||n===45||n===46||n===95||xt(n)}function Xs(n){let a=n.length,r=!1;for(;a--;){const u=n[a][1];if((u.type==="labelLink"||u.type==="labelImage")&&!u._balanced){r=!0;break}if(u._gfmAutolinkLiteralWalkedInto){r=!1;break}}return n.length>0&&!r&&(n[n.length-1][1]._gfmAutolinkLiteralWalkedInto=!0),r}const y2={tokenize:T2,partial:!0};function v2(){return{document:{91:{name:"gfmFootnoteDefinition",tokenize:E2,continuation:{tokenize:k2},exit:A2}},text:{91:{name:"gfmFootnoteCall",tokenize:x2},93:{name:"gfmPotentialFootnoteCall",add:"after",tokenize:b2,resolveTo:S2}}}}function b2(n,a,r){const u=this;let s=u.events.length;const f=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let d;for(;s--;){const m=u.events[s][1];if(m.type==="labelImage"){d=m;break}if(m.type==="gfmFootnoteCall"||m.type==="labelLink"||m.type==="label"||m.type==="image"||m.type==="link")break}return p;function p(m){if(!d||!d._balanced)return r(m);const h=fn(u.sliceSerialize({start:d.end,end:u.now()}));return h.codePointAt(0)!==94||!f.includes(h.slice(1))?r(m):(n.enter("gfmFootnoteCallLabelMarker"),n.consume(m),n.exit("gfmFootnoteCallLabelMarker"),a(m))}}function S2(n,a){let r=n.length;for(;r--;)if(n[r][1].type==="labelImage"&&n[r][0]==="enter"){n[r][1];break}n[r+1][1].type="data",n[r+3][1].type="gfmFootnoteCallLabelMarker";const u={type:"gfmFootnoteCall",start:Object.assign({},n[r+3][1].start),end:Object.assign({},n[n.length-1][1].end)},s={type:"gfmFootnoteCallMarker",start:Object.assign({},n[r+3][1].end),end:Object.assign({},n[r+3][1].end)};s.end.column++,s.end.offset++,s.end._bufferIndex++;const f={type:"gfmFootnoteCallString",start:Object.assign({},s.end),end:Object.assign({},n[n.length-1][1].start)},d={type:"chunkString",contentType:"string",start:Object.assign({},f.start),end:Object.assign({},f.end)},p=[n[r+1],n[r+2],["enter",u,a],n[r+3],n[r+4],["enter",s,a],["exit",s,a],["enter",f,a],["enter",d,a],["exit",d,a],["exit",f,a],n[n.length-2],n[n.length-1],["exit",u,a]];return n.splice(r,n.length-r+1,...p),n}function x2(n,a,r){const u=this,s=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f=0,d;return p;function p(y){return n.enter("gfmFootnoteCall"),n.enter("gfmFootnoteCallLabelMarker"),n.consume(y),n.exit("gfmFootnoteCallLabelMarker"),m}function m(y){return y!==94?r(y):(n.enter("gfmFootnoteCallMarker"),n.consume(y),n.exit("gfmFootnoteCallMarker"),n.enter("gfmFootnoteCallString"),n.enter("chunkString").contentType="string",h)}function h(y){if(f>999||y===93&&!d||y===null||y===91||Qe(y))return r(y);if(y===93){n.exit("chunkString");const E=n.exit("gfmFootnoteCallString");return s.includes(fn(u.sliceSerialize(E)))?(n.enter("gfmFootnoteCallLabelMarker"),n.consume(y),n.exit("gfmFootnoteCallLabelMarker"),n.exit("gfmFootnoteCall"),a):r(y)}return Qe(y)||(d=!0),f++,n.consume(y),y===92?v:h}function v(y){return y===91||y===92||y===93?(n.consume(y),f++,h):h(y)}}function E2(n,a,r){const u=this,s=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f,d=0,p;return m;function m(C){return n.enter("gfmFootnoteDefinition")._container=!0,n.enter("gfmFootnoteDefinitionLabel"),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),h}function h(C){return C===94?(n.enter("gfmFootnoteDefinitionMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionMarker"),n.enter("gfmFootnoteDefinitionLabelString"),n.enter("chunkString").contentType="string",v):r(C)}function v(C){if(d>999||C===93&&!p||C===null||C===91||Qe(C))return r(C);if(C===93){n.exit("chunkString");const H=n.exit("gfmFootnoteDefinitionLabelString");return f=fn(u.sliceSerialize(H)),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),n.exit("gfmFootnoteDefinitionLabel"),E}return Qe(C)||(p=!0),d++,n.consume(C),C===92?y:v}function y(C){return C===91||C===92||C===93?(n.consume(C),d++,v):v(C)}function E(C){return C===58?(n.enter("definitionMarker"),n.consume(C),n.exit("definitionMarker"),s.includes(f)||s.push(f),Me(n,x,"gfmFootnoteDefinitionWhitespace")):r(C)}function x(C){return a(C)}}function k2(n,a,r){return n.check(La,a,n.attempt(y2,a,r))}function A2(n){n.exit("gfmFootnoteDefinition")}function T2(n,a,r){const u=this;return Me(n,s,"gfmFootnoteDefinitionIndent",5);function s(f){const d=u.events[u.events.length-1];return d&&d[1].type==="gfmFootnoteDefinitionIndent"&&d[2].sliceSerialize(d[1],!0).length===4?a(f):r(f)}}function w2(n){let r=(n||{}).singleTilde;const u={name:"strikethrough",tokenize:f,resolveAll:s};return r==null&&(r=!0),{text:{126:u},insideSpan:{null:[u]},attentionMarkers:{null:[126]}};function s(d,p){let m=-1;for(;++m<d.length;)if(d[m][0]==="enter"&&d[m][1].type==="strikethroughSequenceTemporary"&&d[m][1]._close){let h=m;for(;h--;)if(d[h][0]==="exit"&&d[h][1].type==="strikethroughSequenceTemporary"&&d[h][1]._open&&d[m][1].end.offset-d[m][1].start.offset===d[h][1].end.offset-d[h][1].start.offset){d[m][1].type="strikethroughSequence",d[h][1].type="strikethroughSequence";const v={type:"strikethrough",start:Object.assign({},d[h][1].start),end:Object.assign({},d[m][1].end)},y={type:"strikethroughText",start:Object.assign({},d[h][1].end),end:Object.assign({},d[m][1].start)},E=[["enter",v,p],["enter",d[h][1],p],["exit",d[h][1],p],["enter",y,p]],x=p.parser.constructs.insideSpan.null;x&&Ft(E,E.length,0,yu(x,d.slice(h+1,m),p)),Ft(E,E.length,0,[["exit",y,p],["enter",d[m][1],p],["exit",d[m][1],p],["exit",v,p]]),Ft(d,h-1,m-h+3,E),m=h+E.length-2;break}}for(m=-1;++m<d.length;)d[m][1].type==="strikethroughSequenceTemporary"&&(d[m][1].type="data");return d}function f(d,p,m){const h=this.previous,v=this.events;let y=0;return E;function E(C){return h===126&&v[v.length-1][1].type!=="characterEscape"?m(C):(d.enter("strikethroughSequenceTemporary"),x(C))}function x(C){const H=Ci(h);if(C===126)return y>1?m(C):(d.consume(C),y++,x);if(y<2&&!r)return m(C);const j=d.exit("strikethroughSequenceTemporary"),O=Ci(C);return j._open=!O||O===2&&!!H,j._close=!H||H===2&&!!O,p(C)}}}class C2{constructor(){this.map=[]}add(a,r,u){z2(this,a,r,u)}consume(a){if(this.map.sort(function(f,d){return f[0]-d[0]}),this.map.length===0)return;let r=this.map.length;const u=[];for(;r>0;)r-=1,u.push(a.slice(this.map[r][0]+this.map[r][1]),this.map[r][2]),a.length=this.map[r][0];u.push(a.slice()),a.length=0;let s=u.pop();for(;s;){for(const f of s)a.push(f);s=u.pop()}this.map.length=0}}function z2(n,a,r,u){let s=0;if(!(r===0&&u.length===0)){for(;s<n.map.length;){if(n.map[s][0]===a){n.map[s][1]+=r,n.map[s][2].push(...u);return}s+=1}n.map.push([a,r,u])}}function _2(n,a){let r=!1;const u=[];for(;a<n.length;){const s=n[a];if(r){if(s[0]==="enter")s[1].type==="tableContent"&&u.push(n[a+1][1].type==="tableDelimiterMarker"?"left":"none");else if(s[1].type==="tableContent"){if(n[a-1][1].type==="tableDelimiterMarker"){const f=u.length-1;u[f]=u[f]==="left"?"center":"right"}}else if(s[1].type==="tableDelimiterRow")break}else s[0]==="enter"&&s[1].type==="tableDelimiterRow"&&(r=!0);a+=1}return u}function O2(){return{flow:{null:{name:"table",tokenize:D2,resolveAll:M2}}}}function D2(n,a,r){const u=this;let s=0,f=0,d;return p;function p(L){let ie=u.events.length-1;for(;ie>-1;){const oe=u.events[ie][1].type;if(oe==="lineEnding"||oe==="linePrefix")ie--;else break}const le=ie>-1?u.events[ie][1].type:null,ke=le==="tableHead"||le==="tableRow"?B:m;return ke===B&&u.parser.lazy[u.now().line]?r(L):ke(L)}function m(L){return n.enter("tableHead"),n.enter("tableRow"),h(L)}function h(L){return L===124||(d=!0,f+=1),v(L)}function v(L){return L===null?r(L):he(L)?f>1?(f=0,u.interrupt=!0,n.exit("tableRow"),n.enter("lineEnding"),n.consume(L),n.exit("lineEnding"),x):r(L):ze(L)?Me(n,v,"whitespace")(L):(f+=1,d&&(d=!1,s+=1),L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),d=!0,v):(n.enter("data"),y(L)))}function y(L){return L===null||L===124||Qe(L)?(n.exit("data"),v(L)):(n.consume(L),L===92?E:y)}function E(L){return L===92||L===124?(n.consume(L),y):y(L)}function x(L){return u.interrupt=!1,u.parser.lazy[u.now().line]?r(L):(n.enter("tableDelimiterRow"),d=!1,ze(L)?Me(n,C,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(L):C(L))}function C(L){return L===45||L===58?j(L):L===124?(d=!0,n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),H):re(L)}function H(L){return ze(L)?Me(n,j,"whitespace")(L):j(L)}function j(L){return L===58?(f+=1,d=!0,n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),O):L===45?(f+=1,O(L)):L===null||he(L)?ne(L):re(L)}function O(L){return L===45?(n.enter("tableDelimiterFiller"),F(L)):re(L)}function F(L){return L===45?(n.consume(L),F):L===58?(d=!0,n.exit("tableDelimiterFiller"),n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),X):(n.exit("tableDelimiterFiller"),X(L))}function X(L){return ze(L)?Me(n,ne,"whitespace")(L):ne(L)}function ne(L){return L===124?C(L):L===null||he(L)?!d||s!==f?re(L):(n.exit("tableDelimiterRow"),n.exit("tableHead"),a(L)):re(L)}function re(L){return r(L)}function B(L){return n.enter("tableRow"),te(L)}function te(L){return L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),te):L===null||he(L)?(n.exit("tableRow"),a(L)):ze(L)?Me(n,te,"whitespace")(L):(n.enter("data"),de(L))}function de(L){return L===null||L===124||Qe(L)?(n.exit("data"),te(L)):(n.consume(L),L===92?ye:de)}function ye(L){return L===92||L===124?(n.consume(L),de):de(L)}}function M2(n,a){let r=-1,u=!0,s=0,f=[0,0,0,0],d=[0,0,0,0],p=!1,m=0,h,v,y;const E=new C2;for(;++r<n.length;){const x=n[r],C=x[1];x[0]==="enter"?C.type==="tableHead"?(p=!1,m!==0&&(Im(E,a,m,h,v),v=void 0,m=0),h={type:"table",start:Object.assign({},C.start),end:Object.assign({},C.end)},E.add(r,0,[["enter",h,a]])):C.type==="tableRow"||C.type==="tableDelimiterRow"?(u=!0,y=void 0,f=[0,0,0,0],d=[0,r+1,0,0],p&&(p=!1,v={type:"tableBody",start:Object.assign({},C.start),end:Object.assign({},C.end)},E.add(r,0,[["enter",v,a]])),s=C.type==="tableDelimiterRow"?2:v?3:1):s&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")?(u=!1,d[2]===0&&(f[1]!==0&&(d[0]=d[1],y=ru(E,a,f,s,void 0,y),f=[0,0,0,0]),d[2]=r)):C.type==="tableCellDivider"&&(u?u=!1:(f[1]!==0&&(d[0]=d[1],y=ru(E,a,f,s,void 0,y)),f=d,d=[f[1],r,0,0])):C.type==="tableHead"?(p=!0,m=r):C.type==="tableRow"||C.type==="tableDelimiterRow"?(m=r,f[1]!==0?(d[0]=d[1],y=ru(E,a,f,s,r,y)):d[1]!==0&&(y=ru(E,a,d,s,r,y)),s=0):s&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")&&(d[3]=r)}for(m!==0&&Im(E,a,m,h,v),E.consume(a.events),r=-1;++r<a.events.length;){const x=a.events[r];x[0]==="enter"&&x[1].type==="table"&&(x[1]._align=_2(a.events,r))}return n}function ru(n,a,r,u,s,f){const d=u===1?"tableHeader":u===2?"tableDelimiter":"tableData",p="tableContent";r[0]!==0&&(f.end=Object.assign({},Ai(a.events,r[0])),n.add(r[0],0,[["exit",f,a]]));const m=Ai(a.events,r[1]);if(f={type:d,start:Object.assign({},m),end:Object.assign({},m)},n.add(r[1],0,[["enter",f,a]]),r[2]!==0){const h=Ai(a.events,r[2]),v=Ai(a.events,r[3]),y={type:p,start:Object.assign({},h),end:Object.assign({},v)};if(n.add(r[2],0,[["enter",y,a]]),u!==2){const E=a.events[r[2]],x=a.events[r[3]];if(E[1].end=Object.assign({},x[1].end),E[1].type="chunkText",E[1].contentType="text",r[3]>r[2]+1){const C=r[2]+1,H=r[3]-r[2]-1;n.add(C,H,[])}}n.add(r[3]+1,0,[["exit",y,a]])}return s!==void 0&&(f.end=Object.assign({},Ai(a.events,s)),n.add(s,0,[["exit",f,a]]),f=void 0),f}function Im(n,a,r,u,s){const f=[],d=Ai(a.events,r);s&&(s.end=Object.assign({},d),f.push(["exit",s,a])),u.end=Object.assign({},d),f.push(["exit",u,a]),n.add(r+1,0,f)}function Ai(n,a){const r=n[a],u=r[0]==="enter"?"start":"end";return r[1][u]}const R2={name:"tasklistCheck",tokenize:L2};function N2(){return{text:{91:R2}}}function L2(n,a,r){const u=this;return s;function s(m){return u.previous!==null||!u._gfmTasklistFirstContentOfListItem?r(m):(n.enter("taskListCheck"),n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),f)}function f(m){return Qe(m)?(n.enter("taskListCheckValueUnchecked"),n.consume(m),n.exit("taskListCheckValueUnchecked"),d):m===88||m===120?(n.enter("taskListCheckValueChecked"),n.consume(m),n.exit("taskListCheckValueChecked"),d):r(m)}function d(m){return m===93?(n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),n.exit("taskListCheck"),p):r(m)}function p(m){return he(m)?a(m):ze(m)?n.check({tokenize:U2},a,r)(m):r(m)}}function U2(n,a,r){return Me(n,u,"whitespace");function u(s){return s===null?r(s):a(s)}}function j2(n){return cg([o2(),v2(),w2(n),O2(),N2()])}const B2={};function H2(n){const a=this,r=n||B2,u=a.data(),s=u.micromarkExtensions||(u.micromarkExtensions=[]),f=u.fromMarkdownExtensions||(u.fromMarkdownExtensions=[]),d=u.toMarkdownExtensions||(u.toMarkdownExtensions=[]);s.push(j2(r)),f.push(i2()),d.push(a2(r))}function q2(){const n=St(s=>s.ui.modal==="instructions"),a=St(s=>s.conversation.instructions),r=Ct.useRef(null),u=Ct.useRef(null);return Ct.useEffect(()=>{if(n)return u.current=document.activeElement,r.current?.focus(),()=>{u.current?.focus()}},[n]),n?J.jsx("div",{className:"modal-backdrop",onClick:()=>bt({type:"ui/click/modal-backdrop"}),children:J.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"instructions-title",tabIndex:-1,ref:r,onClick:s=>s.stopPropagation(),children:[J.jsxs("div",{className:"modal-header",children:[J.jsx("span",{className:"modal-title",id:"instructions-title",children:"Instructions"}),J.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>bt({type:"ui/click/modal-close"}),children:J.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),J.jsx("div",{className:"modal-body instructions-body",children:a===void 0?J.jsx("p",{className:"loading-state",children:"Loading instructions\u2026"}):J.jsx(wE,{remarkPlugins:[H2],disallowedElements:["script","iframe","object","embed"],unwrapDisallowed:!0,children:a})})]})}):null}function uu({item:n,speakingItemId:a,forceSpeaking:r=!1}){const u=r||n.role==="user"&&n.id===a,s=["transcript-item",`role-${n.role}`,`source-${n.source}`,n.streaming?"streaming":"",u?"speaking":""].filter(Boolean).join(" ");return J.jsx("article",{className:s,children:n.text})}function Y2({tool:n}){const[a,r]=Ct.useState(!1),u=()=>r(f=>!f),s=n.status==="completed"?n.result:n.status==="failed"||n.status==="interrupted"?n.error:null;return J.jsxs("article",{className:"tool-call",tabIndex:0,onClick:u,onKeyDown:f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),u())},children:[J.jsxs("div",{className:"tool-row",children:[J.jsx("span",{className:"toggle",children:a?"\u25BE":"\u25B8"}),J.jsxs("span",{children:["Tool: ",n.toolName,"(...)"]}),J.jsx("span",{className:`badge ${n.status}`,children:n.status})]}),a?J.jsxs("div",{className:"tool-call-body",children:[J.jsx("div",{className:"section-label",children:"ARGUMENTS"}),J.jsx("pre",{children:JSON.stringify(n.arguments,null,2)}),J.jsx("div",{className:"section-label",children:"RESULT"}),J.jsx("pre",{children:JSON.stringify(s,null,2)})]}):null]})}function V2(){const{conversation:n,streamDrafts:a,speakingItemId:r,pendingUserItemId:u,responseActive:s}=St(Ts(y=>({conversation:y.conversation.conversation,streamDrafts:y.conversation.streamDrafts,speakingItemId:y.voice.speakingItemId,pendingUserItemId:y.voice.pendingUserItemId,responseActive:y.voice.responseActive})));if(n===null)return J.jsxs("div",{className:"empty-state",children:[J.jsx("svg",{className:"empty-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:J.jsx("path",{d:"M12 2v20M5 8v8M19 8v8"})}),J.jsx("div",{children:"Ready to start"})]});if(n.status==="ended")return J.jsxs("div",{className:"ended-state",children:[J.jsx("strong",{children:"Conversation ended"}),J.jsx("span",{children:"Transcript is no longer active."})]});const f=n,d=new Map(f.transcript.map(y=>[y.id,y])),p=new Map(f.toolCalls.map(y=>[y.id,y])),m=[];for(const y of f.timeline)if(y.type==="transcript"){const E=d.get(y.transcriptItemId);E!==void 0&&m.push(J.jsx(uu,{item:{id:E.id,role:E.role,source:E.source,text:E.text,streaming:!1},speakingItemId:r},`t-${E.id}`))}else{const E=p.get(y.toolCallId);E!==void 0&&m.push(J.jsx(Y2,{tool:E},`c-${E.id}`))}let h=!1;for(const y of a.values())if(!d.has(y.itemId)&&y.itemId===u){h=!0;break}u!==null&&!h&&!d.has(u)&&m.push(J.jsx(uu,{item:{id:u,role:"user",source:"microphone",text:"",streaming:!1},speakingItemId:r,forceSpeaking:!0},`pending-${u}`));let v=!1;for(const y of a.values())d.has(y.itemId)||(y.role==="assistant"&&(v=!0),m.push(J.jsx(uu,{item:{id:y.itemId,role:y.role,source:y.source,text:y.fullTextSoFar,streaming:!0},speakingItemId:r},`d-${y.itemId}`)));return s&&!v&&m.push(J.jsx(uu,{item:{id:"pending-assistant",role:"assistant",source:"assistantAudio",text:"",streaming:!1},speakingItemId:r,forceSpeaking:!0},"pending-assistant")),J.jsx(J.Fragment,{children:m})}function G2(){const n=St(m=>m.ui.modal==="transcript"),a=St(m=>m.conversation.atBottom),r=St(m=>m.conversation.conversation?.transcript),u=St(m=>m.conversation.streamDrafts),s=Ct.useRef(null),f=Ct.useRef(null),d=Ct.useRef(null);if(Ct.useEffect(()=>{if(n)return d.current=document.activeElement,s.current?.focus(),()=>{d.current?.focus()}},[n]),Ct.useEffect(()=>{n&&a&&f.current!==null&&(f.current.scrollTop=f.current.scrollHeight)},[n,a,r,u]),!n)return null;const p=m=>{if(m.key!=="Tab")return;const h=s.current;if(h===null)return;const v=h.querySelectorAll(\'button, [href], select, textarea, [tabindex]:not([tabindex="-1"])\');if(v.length===0)return;const y=v[0],E=v[v.length-1];y===void 0||E===void 0||(m.shiftKey&&document.activeElement===y?(m.preventDefault(),E.focus()):!m.shiftKey&&document.activeElement===E&&(m.preventDefault(),y.focus()))};return J.jsx("div",{className:"modal-backdrop",onClick:()=>bt({type:"ui/click/modal-backdrop"}),children:J.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"transcript-title",tabIndex:-1,ref:s,onClick:m=>m.stopPropagation(),onKeyDown:p,children:[J.jsxs("div",{className:"modal-header",children:[J.jsx("span",{className:"modal-title",id:"transcript-title",children:"Conversation"}),J.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>bt({type:"ui/click/modal-close"}),children:J.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),J.jsx("div",{className:"modal-body",ref:f,onScroll:m=>{const h=m.currentTarget;bt({type:"ui/scroll/transcript",atBottom:h.scrollHeight-h.scrollTop-h.clientHeight<80})},children:J.jsx(V2,{})})]})})}function X2(){const n=St(u=>u.ui.duplicateClient),a=St(u=>u.ui.moreActionsOpen);Ct.useEffect(()=>{const u=s=>{s.key==="Escape"&&bt({type:"ui/key/escape"})};return window.addEventListener("keydown",u),()=>window.removeEventListener("keydown",u)},[]),Ct.useEffect(()=>{if(!a)return;const u=f=>{const d=f.target;d?.closest("[data-more-actions]")===null&&d?.closest(\'[aria-label="More actions"]\')===null&&bt({type:"ui/click/modal-backdrop"})},s=window.setTimeout(()=>document.addEventListener("click",u),0);return()=>{window.clearTimeout(s),document.removeEventListener("click",u)}},[a]);const r=St(u=>u.stage.injectedVersion);return n?J.jsx(Av,{}):J.jsxs(J.Fragment,{children:[r!=null&&J.jsx("iframe",{className:"injected-stage",src:`/__injected?v=${r}`}),J.jsx(p0,{}),J.jsx(G2,{}),J.jsx(q2,{})]})}const Q2="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";async function Z2(n){if(navigator.userActivation&&navigator.userActivation.hasBeenActive===!1)return!1;try{const a=new Audio(Q2);return a.volume=0,await a.play(),a.pause(),!0}catch(a){return n({type:"browser/window/error",message:`canAutoplay.probe.blocked: ${String(a instanceof Error?a.message:a)}`}),!1}}function I2({dispatch:n,subscribeToActions:a,getState:r}){let u=!1,s=!1;const f=a(d=>{d.type==="browser/autoplay/probed"&&s&&(s=!1,n({type:"ui/click/primary"}))});return Z2(n).then(d=>{u||(u=!0,s=r().audio.pendingSessionStart,n({type:"browser/autoplay/probed",allowed:d}))}),f}function F2({dispatch:n}){const a=u=>{n({type:"browser/window/error",message:u.message})},r=u=>{n({type:"browser/window/unhandled-rejection",reason:String(u.reason)})};return window.addEventListener("error",a),window.addEventListener("unhandledrejection",r),()=>{window.removeEventListener("error",a),window.removeEventListener("unhandledrejection",r)}}const ja={dispatch:bt,subscribeToActions:Fm,getState:cs};e0(ja);c0(ja);Jv(ja);F2(ja);I2(ja);const K2=200,fu=[];Fm(n=>{fu.push({t:Date.now(),type:n.type}),fu.length>K2&&fu.shift()});window.__voice={state:()=>{try{return JSON.parse(JSON.stringify(cs()))}catch{return cs()}},actions:()=>fu.slice()};const Pg=document.getElementById("root");if(Pg===null)throw new Error("Root element #root not found");kv.createRoot(Pg).render(J.jsx(Ct.StrictMode,{children:J.jsx(X2,{})}));</script>\n    <style rel="stylesheet" crossorigin>:root{--bg-base: #09090b;--bg-card: #18181b;--border: #27272a;--text-dim: #52525b;--text-muted: #71717a;--text-default: #a1a1aa;--text-bright: #e4e4e7;--text-white: #fafafa;--accent: #22d3ee;--role-user: #a78bfa;--role-assistant: #34d399;--role-system: #fb923c;--role-tool: #60a5fa;--state-error: #f87171;--dot-connected: #22c55e;--dot-connecting: #eab308;--dot-disconnected: #52525b;--dot-error: #f87171;--font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;--z-stage: 50;--z-tab: 100;--z-backdrop: 150;--z-modal: 200}*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--bg-base);color:var(--text-default);font-family:var(--font-sans)}button,select{font:inherit}button:focus-visible,select:focus-visible,.tool-call:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:active:enabled{transform:scale(.97)}.injected-stage{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:var(--z-stage, 50)}.floating-tab{position:fixed;top:16px;left:16px;z-index:var(--z-tab, 100);display:flex;align-items:center;gap:14px;pointer-events:all}.floating-tab .icon-btn{position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;padding:0;color:var(--text-white);opacity:.7;cursor:pointer;transition:opacity .15s,transform 80ms}.floating-tab .icon-btn:hover:enabled{opacity:1}.floating-tab .icon-btn:active:enabled{transform:scale(.96)}.floating-tab .icon-btn:disabled{opacity:.35;cursor:not-allowed}.shield-badge{position:absolute;right:-3px;bottom:-3px;font-size:9px;line-height:1;color:var(--dot-connecting)}.connection{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px}.dot{width:8px;height:8px;border-radius:50%;background:var(--dot-disconnected)}.dot.connected{background:var(--dot-connected)}.dot.connecting{background:var(--dot-connecting)}.dot.disconnected{background:var(--dot-disconnected)}.dot.error{background:var(--dot-error)}.split-dot{display:inline-block;width:8px;height:8px;border-radius:50%;overflow:hidden;line-height:0}.split-dot-half{display:block;width:8px;height:4px;background:var(--dot-disconnected)}.split-dot-half.connected{background:var(--dot-connected)}.split-dot-half.connecting{background:var(--dot-connecting)}.split-dot-half.disconnected{background:var(--dot-disconnected)}.split-dot-half.error{background:var(--dot-error)}.meters{display:flex;align-items:flex-end;gap:2px;height:16px}.meters.dimmed{opacity:.3}.bar{width:2px;height:16px;border-radius:2px;background:#22d3ee99;transform:scaleY(var(--level, .1));transform-origin:bottom;transition:transform 50ms linear}.more-actions-popover{position:absolute;left:0;top:36px;z-index:var(--z-tab, 100);width:min(320px,calc(100vw - 32px));padding:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);box-shadow:0 12px 32px #00000059}.field-label{display:block;margin-bottom:4px;color:var(--text-muted);font-size:11px;letter-spacing:.05em;text-transform:uppercase}select{width:100%;appearance:none;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-bright);padding:6px 10px;font-size:13px}.menu-item{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-bright);font-size:13px;text-align:left;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.menu-item:hover:enabled{border-color:#3f3f46;background:#ffffff0a}.menu-item:disabled{opacity:.4;cursor:not-allowed}.mic-note{color:var(--text-muted);font-size:12px;font-style:italic}.error-block{background:#f8717112;border:1px solid rgba(248,113,113,.2);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px}.error-title{color:var(--state-error);font-size:13px;font-weight:600}.retry{height:28px;border:1px solid rgba(248,113,113,.4);background:transparent;color:var(--state-error);font-size:12px;border-radius:6px;cursor:pointer}.modal-backdrop{position:fixed;inset:0;z-index:var(--z-backdrop, 150);background:#0009;display:flex;align-items:center;justify-content:center}.modal{position:relative;z-index:var(--z-modal, 200);width:min(680px,calc(100vw - 32px));max-width:680px;max-height:80vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);box-shadow:0 24px 64px #00000080}.modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0}.modal-title{color:var(--text-bright);font-size:14px;font-weight:500}.modal-close{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:6px}.modal-close:hover{color:var(--text-bright)}.modal-body{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}.loading-state{color:var(--text-muted);font-style:italic}.instructions-body{white-space:pre-wrap}.instructions-body p,.instructions-body ul,.instructions-body ol,.instructions-body li,.instructions-body blockquote,.instructions-body h1,.instructions-body h2,.instructions-body h3,.instructions-body h4,.instructions-body h5,.instructions-body h6{white-space:normal}.empty-state,.ended-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.empty-icon{width:32px;height:32px;opacity:.5}.transcript-item{padding:8px 12px;border-radius:0 6px 6px 0;color:var(--text-bright);font-size:14px;line-height:1.55;word-break:break-word}.transcript-item.streaming{opacity:1}.transcript-item.speaking{opacity:.85}.transcript-item.speaking:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--role-user);margin-right:6px;animation:speaking-pulse 1s ease-in-out infinite;vertical-align:middle}.transcript-item.role-assistant.speaking:before{background:var(--role-assistant)}@keyframes speaking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}.role-user{border-left:2px solid var(--role-user)}.role-assistant{border-left:2px solid var(--role-assistant)}.role-system{border-left:2px solid var(--role-system);background:#fb923c0f;color:#fb923cd9;font-size:13px;font-style:italic}.source-textInput{background:#a78bfa0a}.source-system.role-user,.source-system.role-assistant{border-left-style:dashed;color:var(--text-default)}.source-firstMessage{position:relative;border:1px solid rgba(167,139,250,.25);background:#a78bfa0f;border-radius:6px;padding-right:110px}.source-firstMessage:after{content:"first message";position:absolute;top:6px;right:8px;color:var(--text-dim);font-family:var(--font-mono);font-size:10px}.tool-call{background:#60a5fa12;border:1px solid rgba(96,165,250,.18);border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:12px;cursor:pointer;user-select:none}.tool-row{display:flex;align-items:center;gap:8px}.badge{border-radius:4px;padding:2px 7px;background:#34d3991f;color:#34d399;font-size:11px}.badge.started{background:#fbbf2426;color:#fbbf24}.badge.failed{background:#f871711f;color:#f87171}.badge.interrupted{background:#a1a1aa1f;color:#71717a}.tool-call-body{overflow:hidden}.section-label{margin:10px 0 4px;color:var(--text-dim);font-size:11px;letter-spacing:.08em}pre{margin:0 0 8px;padding:8px;overflow-x:auto;border-radius:4px;background:#00000040;color:var(--text-default);white-space:pre-wrap;word-break:break-all}.duplicate-page{min-height:100dvh;max-width:380px;margin:0 auto;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.thinking{display:flex;gap:4px;align-items:center;padding:6px 10px;margin:0 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)}.thinking .tdot{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:.4;animation:thinking-pulse 1s ease-in-out infinite}.thinking .tdot:nth-child(2){animation-delay:.15s}.thinking .tdot:nth-child(3){animation-delay:.3s}@keyframes thinking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}</style>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';

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
