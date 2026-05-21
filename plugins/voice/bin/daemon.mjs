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
var DEFAULT_WAKE_WORD = "Hey Computer";

// src/ui-dist/index.html
var ui_dist_default = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>__REALTIME_VOICE_TITLE__</title>\n    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css" />\n    <script type="module" crossorigin>(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const c of document.querySelectorAll(\'link[rel="modulepreload"]\'))u(c);new MutationObserver(c=>{for(const f of c)if(f.type==="childList")for(const d of f.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&u(d)}).observe(document,{childList:!0,subtree:!0});function a(c){const f={};return c.integrity&&(f.integrity=c.integrity),c.referrerPolicy&&(f.referrerPolicy=c.referrerPolicy),c.crossOrigin==="use-credentials"?f.credentials="include":c.crossOrigin==="anonymous"?f.credentials="omit":f.credentials="same-origin",f}function u(c){if(c.ep)return;c.ep=!0;const f=a(c);fetch(c.href,f)}})();function ws(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var Hc={exports:{}},Tr={};/**\n * @license React\n * react-jsx-runtime.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Gp;function kv(){if(Gp)return Tr;Gp=1;var n=Symbol.for("react.transitional.element"),r=Symbol.for("react.fragment");function a(u,c,f){var d=null;if(f!==void 0&&(d=""+f),c.key!==void 0&&(d=""+c.key),"key"in c){f={};for(var h in c)h!=="key"&&(f[h]=c[h])}else f=c;return c=f.ref,{$$typeof:n,type:u,key:d,ref:c!==void 0?c:null,props:f}}return Tr.Fragment=r,Tr.jsx=a,Tr.jsxs=a,Tr}var Xp;function Ev(){return Xp||(Xp=1,Hc.exports=kv()),Hc.exports}var I=Ev(),qc={exports:{}},Te={};/**\n * @license React\n * react.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Qp;function Av(){if(Qp)return Te;Qp=1;var n=Symbol.for("react.transitional.element"),r=Symbol.for("react.portal"),a=Symbol.for("react.fragment"),u=Symbol.for("react.strict_mode"),c=Symbol.for("react.profiler"),f=Symbol.for("react.consumer"),d=Symbol.for("react.context"),h=Symbol.for("react.forward_ref"),m=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),v=Symbol.for("react.lazy"),g=Symbol.for("react.activity"),x=Symbol.iterator;function S(w){return w===null||typeof w!="object"?null:(w=x&&w[x]||w["@@iterator"],typeof w=="function"?w:null)}var C={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},B=Object.assign,j={};function _(w,H,k){this.props=w,this.context=H,this.refs=j,this.updater=k||C}_.prototype.isReactComponent={},_.prototype.setState=function(w,H){if(typeof w!="object"&&typeof w!="function"&&w!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,w,H,"setState")},_.prototype.forceUpdate=function(w){this.updater.enqueueForceUpdate(this,w,"forceUpdate")};function F(){}F.prototype=_.prototype;function Y(w,H,k){this.props=w,this.context=H,this.refs=j,this.updater=k||C}var le=Y.prototype=new F;le.constructor=Y,B(le,_.prototype),le.isPureReactComponent=!0;var ue=Array.isArray;function N(){}var $={H:null,A:null,T:null,S:null},he=Object.prototype.hasOwnProperty;function Se(w,H,k){var te=k.ref;return{$$typeof:n,type:w,key:H,ref:te!==void 0?te:null,props:k}}function L(w,H){return Se(w.type,H,w.props)}function ie(w){return typeof w=="object"&&w!==null&&w.$$typeof===n}function ee(w){var H={"=":"=0",":":"=2"};return"$"+w.replace(/[=:]/g,function(k){return H[k]})}var ke=/\\/+/g;function re(w,H){return typeof w=="object"&&w!==null&&w.key!=null?ee(""+w.key):H.toString(36)}function W(w){switch(w.status){case"fulfilled":return w.value;case"rejected":throw w.reason;default:switch(typeof w.status=="string"?w.then(N,N):(w.status="pending",w.then(function(H){w.status==="pending"&&(w.status="fulfilled",w.value=H)},function(H){w.status==="pending"&&(w.status="rejected",w.reason=H)})),w.status){case"fulfilled":return w.value;case"rejected":throw w.reason}}throw w}function D(w,H,k,te,me){var fe=typeof w;(fe==="undefined"||fe==="boolean")&&(w=null);var Ae=!1;if(w===null)Ae=!0;else switch(fe){case"bigint":case"string":case"number":Ae=!0;break;case"object":switch(w.$$typeof){case n:case r:Ae=!0;break;case v:return Ae=w._init,D(Ae(w._payload),H,k,te,me)}}if(Ae)return me=me(w),Ae=te===""?"."+re(w,0):te,ue(me)?(k="",Ae!=null&&(k=Ae.replace(ke,"$&/")+"/"),D(me,H,k,"",function(Z){return Z})):me!=null&&(ie(me)&&(me=L(me,k+(me.key==null||w&&w.key===me.key?"":(""+me.key).replace(ke,"$&/")+"/")+Ae)),H.push(me)),1;Ae=0;var Qe=te===""?".":te+":";if(ue(w))for(var X=0;X<w.length;X++)te=w[X],fe=Qe+re(te,X),Ae+=D(te,H,k,fe,me);else if(X=S(w),typeof X=="function")for(w=X.call(w),X=0;!(te=w.next()).done;)te=te.value,fe=Qe+re(te,X++),Ae+=D(te,H,k,fe,me);else if(fe==="object"){if(typeof w.then=="function")return D(W(w),H,k,te,me);throw H=String(w),Error("Objects are not valid as a React child (found: "+(H==="[object Object]"?"object with keys {"+Object.keys(w).join(", ")+"}":H)+"). If you meant to render a collection of children, use an array instead.")}return Ae}function K(w,H,k){if(w==null)return w;var te=[],me=0;return D(w,te,"","",function(fe){return H.call(k,fe,me++)}),te}function ce(w){if(w._status===-1){var H=w._result;H=H(),H.then(function(k){(w._status===0||w._status===-1)&&(w._status=1,w._result=k)},function(k){(w._status===0||w._status===-1)&&(w._status=2,w._result=k)}),w._status===-1&&(w._status=0,w._result=H)}if(w._status===1)return w._result.default;throw w._result}var we=typeof reportError=="function"?reportError:function(w){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var H=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof w=="object"&&w!==null&&typeof w.message=="string"?String(w.message):String(w),error:w});if(!window.dispatchEvent(H))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",w);return}console.error(w)},E={map:K,forEach:function(w,H,k){K(w,function(){H.apply(this,arguments)},k)},count:function(w){var H=0;return K(w,function(){H++}),H},toArray:function(w){return K(w,function(H){return H})||[]},only:function(w){if(!ie(w))throw Error("React.Children.only expected to receive a single React element child.");return w}};return Te.Activity=g,Te.Children=E,Te.Component=_,Te.Fragment=a,Te.Profiler=c,Te.PureComponent=Y,Te.StrictMode=u,Te.Suspense=m,Te.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=$,Te.__COMPILER_RUNTIME={__proto__:null,c:function(w){return $.H.useMemoCache(w)}},Te.cache=function(w){return function(){return w.apply(null,arguments)}},Te.cacheSignal=function(){return null},Te.cloneElement=function(w,H,k){if(w==null)throw Error("The argument must be a React element, but you passed "+w+".");var te=B({},w.props),me=w.key;if(H!=null)for(fe in H.key!==void 0&&(me=""+H.key),H)!he.call(H,fe)||fe==="key"||fe==="__self"||fe==="__source"||fe==="ref"&&H.ref===void 0||(te[fe]=H[fe]);var fe=arguments.length-2;if(fe===1)te.children=k;else if(1<fe){for(var Ae=Array(fe),Qe=0;Qe<fe;Qe++)Ae[Qe]=arguments[Qe+2];te.children=Ae}return Se(w.type,me,te)},Te.createContext=function(w){return w={$$typeof:d,_currentValue:w,_currentValue2:w,_threadCount:0,Provider:null,Consumer:null},w.Provider=w,w.Consumer={$$typeof:f,_context:w},w},Te.createElement=function(w,H,k){var te,me={},fe=null;if(H!=null)for(te in H.key!==void 0&&(fe=""+H.key),H)he.call(H,te)&&te!=="key"&&te!=="__self"&&te!=="__source"&&(me[te]=H[te]);var Ae=arguments.length-2;if(Ae===1)me.children=k;else if(1<Ae){for(var Qe=Array(Ae),X=0;X<Ae;X++)Qe[X]=arguments[X+2];me.children=Qe}if(w&&w.defaultProps)for(te in Ae=w.defaultProps,Ae)me[te]===void 0&&(me[te]=Ae[te]);return Se(w,fe,me)},Te.createRef=function(){return{current:null}},Te.forwardRef=function(w){return{$$typeof:h,render:w}},Te.isValidElement=ie,Te.lazy=function(w){return{$$typeof:v,_payload:{_status:-1,_result:w},_init:ce}},Te.memo=function(w,H){return{$$typeof:p,type:w,compare:H===void 0?null:H}},Te.startTransition=function(w){var H=$.T,k={};$.T=k;try{var te=w(),me=$.S;me!==null&&me(k,te),typeof te=="object"&&te!==null&&typeof te.then=="function"&&te.then(N,we)}catch(fe){we(fe)}finally{H!==null&&k.types!==null&&(H.types=k.types),$.T=H}},Te.unstable_useCacheRefresh=function(){return $.H.useCacheRefresh()},Te.use=function(w){return $.H.use(w)},Te.useActionState=function(w,H,k){return $.H.useActionState(w,H,k)},Te.useCallback=function(w,H){return $.H.useCallback(w,H)},Te.useContext=function(w){return $.H.useContext(w)},Te.useDebugValue=function(){},Te.useDeferredValue=function(w,H){return $.H.useDeferredValue(w,H)},Te.useEffect=function(w,H){return $.H.useEffect(w,H)},Te.useEffectEvent=function(w){return $.H.useEffectEvent(w)},Te.useId=function(){return $.H.useId()},Te.useImperativeHandle=function(w,H,k){return $.H.useImperativeHandle(w,H,k)},Te.useInsertionEffect=function(w,H){return $.H.useInsertionEffect(w,H)},Te.useLayoutEffect=function(w,H){return $.H.useLayoutEffect(w,H)},Te.useMemo=function(w,H){return $.H.useMemo(w,H)},Te.useOptimistic=function(w,H){return $.H.useOptimistic(w,H)},Te.useReducer=function(w,H,k){return $.H.useReducer(w,H,k)},Te.useRef=function(w){return $.H.useRef(w)},Te.useState=function(w){return $.H.useState(w)},Te.useSyncExternalStore=function(w,H,k){return $.H.useSyncExternalStore(w,H,k)},Te.useTransition=function(){return $.H.useTransition()},Te.version="19.2.6",Te}var Ip;function Ts(){return Ip||(Ip=1,qc.exports=Av()),qc.exports}var ve=Ts();const Mr=ws(ve);var Yc={exports:{}},Cr={},Vc={exports:{}},Gc={};/**\n * @license React\n * scheduler.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Zp;function wv(){return Zp||(Zp=1,(function(n){function r(D,K){var ce=D.length;D.push(K);e:for(;0<ce;){var we=ce-1>>>1,E=D[we];if(0<c(E,K))D[we]=K,D[ce]=E,ce=we;else break e}}function a(D){return D.length===0?null:D[0]}function u(D){if(D.length===0)return null;var K=D[0],ce=D.pop();if(ce!==K){D[0]=ce;e:for(var we=0,E=D.length,w=E>>>1;we<w;){var H=2*(we+1)-1,k=D[H],te=H+1,me=D[te];if(0>c(k,ce))te<E&&0>c(me,k)?(D[we]=me,D[te]=ce,we=te):(D[we]=k,D[H]=ce,we=H);else if(te<E&&0>c(me,ce))D[we]=me,D[te]=ce,we=te;else break e}}return K}function c(D,K){var ce=D.sortIndex-K.sortIndex;return ce!==0?ce:D.id-K.id}if(n.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var f=performance;n.unstable_now=function(){return f.now()}}else{var d=Date,h=d.now();n.unstable_now=function(){return d.now()-h}}var m=[],p=[],v=1,g=null,x=3,S=!1,C=!1,B=!1,j=!1,_=typeof setTimeout=="function"?setTimeout:null,F=typeof clearTimeout=="function"?clearTimeout:null,Y=typeof setImmediate<"u"?setImmediate:null;function le(D){for(var K=a(p);K!==null;){if(K.callback===null)u(p);else if(K.startTime<=D)u(p),K.sortIndex=K.expirationTime,r(m,K);else break;K=a(p)}}function ue(D){if(B=!1,le(D),!C)if(a(m)!==null)C=!0,N||(N=!0,ee());else{var K=a(p);K!==null&&W(ue,K.startTime-D)}}var N=!1,$=-1,he=5,Se=-1;function L(){return j?!0:!(n.unstable_now()-Se<he)}function ie(){if(j=!1,N){var D=n.unstable_now();Se=D;var K=!0;try{e:{C=!1,B&&(B=!1,F($),$=-1),S=!0;var ce=x;try{t:{for(le(D),g=a(m);g!==null&&!(g.expirationTime>D&&L());){var we=g.callback;if(typeof we=="function"){g.callback=null,x=g.priorityLevel;var E=we(g.expirationTime<=D);if(D=n.unstable_now(),typeof E=="function"){g.callback=E,le(D),K=!0;break t}g===a(m)&&u(m),le(D)}else u(m);g=a(m)}if(g!==null)K=!0;else{var w=a(p);w!==null&&W(ue,w.startTime-D),K=!1}}break e}finally{g=null,x=ce,S=!1}K=void 0}}finally{K?ee():N=!1}}}var ee;if(typeof Y=="function")ee=function(){Y(ie)};else if(typeof MessageChannel<"u"){var ke=new MessageChannel,re=ke.port2;ke.port1.onmessage=ie,ee=function(){re.postMessage(null)}}else ee=function(){_(ie,0)};function W(D,K){$=_(function(){D(n.unstable_now())},K)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(D){D.callback=null},n.unstable_forceFrameRate=function(D){0>D||125<D?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):he=0<D?Math.floor(1e3/D):5},n.unstable_getCurrentPriorityLevel=function(){return x},n.unstable_next=function(D){switch(x){case 1:case 2:case 3:var K=3;break;default:K=x}var ce=x;x=K;try{return D()}finally{x=ce}},n.unstable_requestPaint=function(){j=!0},n.unstable_runWithPriority=function(D,K){switch(D){case 1:case 2:case 3:case 4:case 5:break;default:D=3}var ce=x;x=D;try{return K()}finally{x=ce}},n.unstable_scheduleCallback=function(D,K,ce){var we=n.unstable_now();switch(typeof ce=="object"&&ce!==null?(ce=ce.delay,ce=typeof ce=="number"&&0<ce?we+ce:we):ce=we,D){case 1:var E=-1;break;case 2:E=250;break;case 5:E=1073741823;break;case 4:E=1e4;break;default:E=5e3}return E=ce+E,D={id:v++,callback:K,priorityLevel:D,startTime:ce,expirationTime:E,sortIndex:-1},ce>we?(D.sortIndex=ce,r(p,D),a(m)===null&&D===a(p)&&(B?(F($),$=-1):B=!0,W(ue,ce-we))):(D.sortIndex=E,r(m,D),C||S||(C=!0,N||(N=!0,ee()))),D},n.unstable_shouldYield=L,n.unstable_wrapCallback=function(D){var K=x;return function(){var ce=x;x=K;try{return D.apply(this,arguments)}finally{x=ce}}}})(Gc)),Gc}var Fp;function Tv(){return Fp||(Fp=1,Vc.exports=wv()),Vc.exports}var Xc={exports:{}},Ct={};/**\n * @license React\n * react-dom.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Kp;function Cv(){if(Kp)return Ct;Kp=1;var n=Ts();function r(m){var p="https://react.dev/errors/"+m;if(1<arguments.length){p+="?args[]="+encodeURIComponent(arguments[1]);for(var v=2;v<arguments.length;v++)p+="&args[]="+encodeURIComponent(arguments[v])}return"Minified React error #"+m+"; visit "+p+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function a(){}var u={d:{f:a,r:function(){throw Error(r(522))},D:a,C:a,L:a,m:a,X:a,S:a,M:a},p:0,findDOMNode:null},c=Symbol.for("react.portal");function f(m,p,v){var g=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:c,key:g==null?null:""+g,children:m,containerInfo:p,implementation:v}}var d=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function h(m,p){if(m==="font")return"";if(typeof p=="string")return p==="use-credentials"?p:""}return Ct.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=u,Ct.createPortal=function(m,p){var v=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!p||p.nodeType!==1&&p.nodeType!==9&&p.nodeType!==11)throw Error(r(299));return f(m,p,null,v)},Ct.flushSync=function(m){var p=d.T,v=u.p;try{if(d.T=null,u.p=2,m)return m()}finally{d.T=p,u.p=v,u.d.f()}},Ct.preconnect=function(m,p){typeof m=="string"&&(p?(p=p.crossOrigin,p=typeof p=="string"?p==="use-credentials"?p:"":void 0):p=null,u.d.C(m,p))},Ct.prefetchDNS=function(m){typeof m=="string"&&u.d.D(m)},Ct.preinit=function(m,p){if(typeof m=="string"&&p&&typeof p.as=="string"){var v=p.as,g=h(v,p.crossOrigin),x=typeof p.integrity=="string"?p.integrity:void 0,S=typeof p.fetchPriority=="string"?p.fetchPriority:void 0;v==="style"?u.d.S(m,typeof p.precedence=="string"?p.precedence:void 0,{crossOrigin:g,integrity:x,fetchPriority:S}):v==="script"&&u.d.X(m,{crossOrigin:g,integrity:x,fetchPriority:S,nonce:typeof p.nonce=="string"?p.nonce:void 0})}},Ct.preinitModule=function(m,p){if(typeof m=="string")if(typeof p=="object"&&p!==null){if(p.as==null||p.as==="script"){var v=h(p.as,p.crossOrigin);u.d.M(m,{crossOrigin:v,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0})}}else p==null&&u.d.M(m)},Ct.preload=function(m,p){if(typeof m=="string"&&typeof p=="object"&&p!==null&&typeof p.as=="string"){var v=p.as,g=h(v,p.crossOrigin);u.d.L(m,v,{crossOrigin:g,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0,type:typeof p.type=="string"?p.type:void 0,fetchPriority:typeof p.fetchPriority=="string"?p.fetchPriority:void 0,referrerPolicy:typeof p.referrerPolicy=="string"?p.referrerPolicy:void 0,imageSrcSet:typeof p.imageSrcSet=="string"?p.imageSrcSet:void 0,imageSizes:typeof p.imageSizes=="string"?p.imageSizes:void 0,media:typeof p.media=="string"?p.media:void 0})}},Ct.preloadModule=function(m,p){if(typeof m=="string")if(p){var v=h(p.as,p.crossOrigin);u.d.m(m,{as:typeof p.as=="string"&&p.as!=="script"?p.as:void 0,crossOrigin:v,integrity:typeof p.integrity=="string"?p.integrity:void 0})}else u.d.m(m)},Ct.requestFormReset=function(m){u.d.r(m)},Ct.unstable_batchedUpdates=function(m,p){return m(p)},Ct.useFormState=function(m,p,v){return d.H.useFormState(m,p,v)},Ct.useFormStatus=function(){return d.H.useHostTransitionStatus()},Ct.version="19.2.6",Ct}var Jp;function zv(){if(Jp)return Xc.exports;Jp=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(r){console.error(r)}}return n(),Xc.exports=Cv(),Xc.exports}/**\n * @license React\n * react-dom-client.production.js\n *\n * Copyright (c) Meta Platforms, Inc. and affiliates.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */var Wp;function _v(){if(Wp)return Cr;Wp=1;var n=Tv(),r=Ts(),a=zv();function u(e){var t="https://react.dev/errors/"+e;if(1<arguments.length){t+="?args[]="+encodeURIComponent(arguments[1]);for(var l=2;l<arguments.length;l++)t+="&args[]="+encodeURIComponent(arguments[l])}return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function c(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function f(e){var t=e,l=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,(t.flags&4098)!==0&&(l=t.return),e=t.return;while(e)}return t.tag===3?l:null}function d(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function h(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function m(e){if(f(e)!==e)throw Error(u(188))}function p(e){var t=e.alternate;if(!t){if(t=f(e),t===null)throw Error(u(188));return t!==e?null:e}for(var l=e,i=t;;){var o=l.return;if(o===null)break;var s=o.alternate;if(s===null){if(i=o.return,i!==null){l=i;continue}break}if(o.child===s.child){for(s=o.child;s;){if(s===l)return m(o),e;if(s===i)return m(o),t;s=s.sibling}throw Error(u(188))}if(l.return!==i.return)l=o,i=s;else{for(var y=!1,b=o.child;b;){if(b===l){y=!0,l=o,i=s;break}if(b===i){y=!0,i=o,l=s;break}b=b.sibling}if(!y){for(b=s.child;b;){if(b===l){y=!0,l=s,i=o;break}if(b===i){y=!0,i=s,l=o;break}b=b.sibling}if(!y)throw Error(u(189))}}if(l.alternate!==i)throw Error(u(190))}if(l.tag!==3)throw Error(u(188));return l.stateNode.current===l?e:t}function v(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=v(e),t!==null)return t;e=e.sibling}return null}var g=Object.assign,x=Symbol.for("react.element"),S=Symbol.for("react.transitional.element"),C=Symbol.for("react.portal"),B=Symbol.for("react.fragment"),j=Symbol.for("react.strict_mode"),_=Symbol.for("react.profiler"),F=Symbol.for("react.consumer"),Y=Symbol.for("react.context"),le=Symbol.for("react.forward_ref"),ue=Symbol.for("react.suspense"),N=Symbol.for("react.suspense_list"),$=Symbol.for("react.memo"),he=Symbol.for("react.lazy"),Se=Symbol.for("react.activity"),L=Symbol.for("react.memo_cache_sentinel"),ie=Symbol.iterator;function ee(e){return e===null||typeof e!="object"?null:(e=ie&&e[ie]||e["@@iterator"],typeof e=="function"?e:null)}var ke=Symbol.for("react.client.reference");function re(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===ke?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case B:return"Fragment";case _:return"Profiler";case j:return"StrictMode";case ue:return"Suspense";case N:return"SuspenseList";case Se:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case C:return"Portal";case Y:return e.displayName||"Context";case F:return(e._context.displayName||"Context")+".Consumer";case le:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case $:return t=e.displayName||null,t!==null?t:re(e.type)||"Memo";case he:t=e._payload,e=e._init;try{return re(e(t))}catch{}}return null}var W=Array.isArray,D=r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,K=a.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ce={pending:!1,data:null,method:null,action:null},we=[],E=-1;function w(e){return{current:e}}function H(e){0>E||(e.current=we[E],we[E]=null,E--)}function k(e,t){E++,we[E]=e.current,e.current=t}var te=w(null),me=w(null),fe=w(null),Ae=w(null);function Qe(e,t){switch(k(fe,t),k(me,e),k(te,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?dp(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=dp(t),e=hp(t,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}H(te),k(te,e)}function X(){H(te),H(me),H(fe)}function Z(e){e.memoizedState!==null&&k(Ae,e);var t=te.current,l=hp(t,e.type);t!==l&&(k(me,e),k(te,l))}function ne(e){me.current===e&&(H(te),H(me)),Ae.current===e&&(H(Ae),kr._currentValue=ce)}var ae,pe;function oe(e){if(ae===void 0)try{throw Error()}catch(l){var t=l.stack.trim().match(/\\n( *(at )?)/);ae=t&&t[1]||"",pe=-1<l.stack.indexOf(`\n    at`)?" (<anonymous>)":-1<l.stack.indexOf("@")?"@unknown:0:0":""}return`\n`+ae+e+pe}var ye=!1;function Ce(e,t){if(!e||ye)return"";ye=!0;var l=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var i={DetermineComponentFrameRoot:function(){try{if(t){var Q=function(){throw Error()};if(Object.defineProperty(Q.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(Q,[])}catch(U){var R=U}Reflect.construct(e,[],Q)}else{try{Q.call()}catch(U){R=U}e.call(Q.prototype)}}else{try{throw Error()}catch(U){R=U}(Q=e())&&typeof Q.catch=="function"&&Q.catch(function(){})}}catch(U){if(U&&R&&typeof U.stack=="string")return[U.stack,R.stack]}return[null,null]}};i.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var o=Object.getOwnPropertyDescriptor(i.DetermineComponentFrameRoot,"name");o&&o.configurable&&Object.defineProperty(i.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var s=i.DetermineComponentFrameRoot(),y=s[0],b=s[1];if(y&&b){var A=y.split(`\n`),M=b.split(`\n`);for(o=i=0;i<A.length&&!A[i].includes("DetermineComponentFrameRoot");)i++;for(;o<M.length&&!M[o].includes("DetermineComponentFrameRoot");)o++;if(i===A.length||o===M.length)for(i=A.length-1,o=M.length-1;1<=i&&0<=o&&A[i]!==M[o];)o--;for(;1<=i&&0<=o;i--,o--)if(A[i]!==M[o]){if(i!==1||o!==1)do if(i--,o--,0>o||A[i]!==M[o]){var q=`\n`+A[i].replace(" at new "," at ");return e.displayName&&q.includes("<anonymous>")&&(q=q.replace("<anonymous>",e.displayName)),q}while(1<=i&&0<=o);break}}}finally{ye=!1,Error.prepareStackTrace=l}return(l=e?e.displayName||e.name:"")?oe(l):""}function He(e,t){switch(e.tag){case 26:case 27:case 5:return oe(e.type);case 16:return oe("Lazy");case 13:return e.child!==t&&t!==null?oe("Suspense Fallback"):oe("Suspense");case 19:return oe("SuspenseList");case 0:case 15:return Ce(e.type,!1);case 11:return Ce(e.type.render,!1);case 1:return Ce(e.type,!0);case 31:return oe("Activity");default:return""}}function en(e){try{var t="",l=null;do t+=He(e,l),l=e,e=e.return;while(e);return t}catch(i){return`\nError generating stack: `+i.message+`\n`+i.stack}}var tn=Object.prototype.hasOwnProperty,et=n.unstable_scheduleCallback,ct=n.unstable_cancelCallback,bn=n.unstable_shouldYield,Au=n.unstable_requestPaint,Ot=n.unstable_now,wu=n.unstable_getCurrentPriorityLevel,V=n.unstable_ImmediatePriority,P=n.unstable_UserBlockingPriority,Ee=n.unstable_NormalPriority,De=n.unstable_LowPriority,Ge=n.unstable_IdlePriority,Xt=n.log,Cn=n.unstable_setDisableYieldValue,Dt=null,mt=null;function Nt(e){if(typeof Xt=="function"&&Cn(e),mt&&typeof mt.setStrictMode=="function")try{mt.setStrictMode(Dt,e)}catch{}}var We=Math.clz32?Math.clz32:oy,Zn=Math.log,pn=Math.LN2;function oy(e){return e>>>=0,e===0?32:31-(Zn(e)/pn|0)|0}var Yr=256,Vr=262144,Gr=4194304;function xl(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Xr(e,t,l){var i=e.pendingLanes;if(i===0)return 0;var o=0,s=e.suspendedLanes,y=e.pingedLanes;e=e.warmLanes;var b=i&134217727;return b!==0?(i=b&~s,i!==0?o=xl(i):(y&=b,y!==0?o=xl(y):l||(l=b&~e,l!==0&&(o=xl(l))))):(b=i&~s,b!==0?o=xl(b):y!==0?o=xl(y):l||(l=i&~e,l!==0&&(o=xl(l)))),o===0?0:t!==0&&t!==o&&(t&s)===0&&(s=o&-o,l=t&-t,s>=l||s===32&&(l&4194048)!==0)?t:o}function Li(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function cy(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Is(){var e=Gr;return Gr<<=1,(Gr&62914560)===0&&(Gr=4194304),e}function Tu(e){for(var t=[],l=0;31>l;l++)t.push(e);return t}function Ui(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function sy(e,t,l,i,o,s){var y=e.pendingLanes;e.pendingLanes=l,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=l,e.entangledLanes&=l,e.errorRecoveryDisabledLanes&=l,e.shellSuspendCounter=0;var b=e.entanglements,A=e.expirationTimes,M=e.hiddenUpdates;for(l=y&~l;0<l;){var q=31-We(l),Q=1<<q;b[q]=0,A[q]=-1;var R=M[q];if(R!==null)for(M[q]=null,q=0;q<R.length;q++){var U=R[q];U!==null&&(U.lane&=-536870913)}l&=~Q}i!==0&&Zs(e,i,0),s!==0&&o===0&&e.tag!==0&&(e.suspendedLanes|=s&~(y&~t))}function Zs(e,t,l){e.pendingLanes|=t,e.suspendedLanes&=~t;var i=31-We(t);e.entangledLanes|=t,e.entanglements[i]=e.entanglements[i]|1073741824|l&261930}function Fs(e,t){var l=e.entangledLanes|=t;for(e=e.entanglements;l;){var i=31-We(l),o=1<<i;o&t|e[i]&t&&(e[i]|=t),l&=~o}}function Ks(e,t){var l=t&-t;return l=(l&42)!==0?1:Cu(l),(l&(e.suspendedLanes|t))!==0?0:l}function Cu(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function zu(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Js(){var e=K.p;return e!==0?e:(e=window.event,e===void 0?32:Up(e.type))}function Ws(e,t){var l=K.p;try{return K.p=e,t()}finally{K.p=l}}var Fn=Math.random().toString(36).slice(2),xt="__reactFiber$"+Fn,Lt="__reactProps$"+Fn,Vl="__reactContainer$"+Fn,_u="__reactEvents$"+Fn,fy="__reactListeners$"+Fn,dy="__reactHandles$"+Fn,$s="__reactResources$"+Fn,ji="__reactMarker$"+Fn;function Ou(e){delete e[xt],delete e[Lt],delete e[_u],delete e[fy],delete e[dy]}function Gl(e){var t=e[xt];if(t)return t;for(var l=e.parentNode;l;){if(t=l[Vl]||l[xt]){if(l=t.alternate,t.child!==null||l!==null&&l.child!==null)for(e=xp(e);e!==null;){if(l=e[xt])return l;e=xp(e)}return t}e=l,l=e.parentNode}return null}function Xl(e){if(e=e[xt]||e[Vl]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Bi(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(u(33))}function Ql(e){var t=e[$s];return t||(t=e[$s]={hoistableStyles:new Map,hoistableScripts:new Map}),t}function yt(e){e[ji]=!0}var Ps=new Set,ef={};function Sl(e,t){Il(e,t),Il(e+"Capture",t)}function Il(e,t){for(ef[e]=t,e=0;e<t.length;e++)Ps.add(t[e])}var hy=RegExp("^[:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD][:A-Z_a-z\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02FF\\\\u0370-\\\\u037D\\\\u037F-\\\\u1FFF\\\\u200C-\\\\u200D\\\\u2070-\\\\u218F\\\\u2C00-\\\\u2FEF\\\\u3001-\\\\uD7FF\\\\uF900-\\\\uFDCF\\\\uFDF0-\\\\uFFFD\\\\-.0-9\\\\u00B7\\\\u0300-\\\\u036F\\\\u203F-\\\\u2040]*$"),tf={},nf={};function py(e){return tn.call(nf,e)?!0:tn.call(tf,e)?!1:hy.test(e)?nf[e]=!0:(tf[e]=!0,!1)}function Qr(e,t,l){if(py(t))if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":e.removeAttribute(t);return;case"boolean":var i=t.toLowerCase().slice(0,5);if(i!=="data-"&&i!=="aria-"){e.removeAttribute(t);return}}e.setAttribute(t,""+l)}}function Ir(e,t,l){if(l===null)e.removeAttribute(t);else{switch(typeof l){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(t);return}e.setAttribute(t,""+l)}}function zn(e,t,l,i){if(i===null)e.removeAttribute(l);else{switch(typeof i){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(l);return}e.setAttributeNS(t,l,""+i)}}function nn(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function lf(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function my(e,t,l){var i=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&typeof i<"u"&&typeof i.get=="function"&&typeof i.set=="function"){var o=i.get,s=i.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(y){l=""+y,s.call(this,y)}}),Object.defineProperty(e,t,{enumerable:i.enumerable}),{getValue:function(){return l},setValue:function(y){l=""+y},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Du(e){if(!e._valueTracker){var t=lf(e)?"checked":"value";e._valueTracker=my(e,t,""+e[t])}}function rf(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var l=t.getValue(),i="";return e&&(i=lf(e)?e.checked?"true":"false":e.value),e=i,e!==l?(t.setValue(e),!0):!1}function Zr(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var gy=/[\\n"\\\\]/g;function ln(e){return e.replace(gy,function(t){return"\\\\"+t.charCodeAt(0).toString(16)+" "})}function Mu(e,t,l,i,o,s,y,b){e.name="",y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"?e.type=y:e.removeAttribute("type"),t!=null?y==="number"?(t===0&&e.value===""||e.value!=t)&&(e.value=""+nn(t)):e.value!==""+nn(t)&&(e.value=""+nn(t)):y!=="submit"&&y!=="reset"||e.removeAttribute("value"),t!=null?Ru(e,y,nn(t)):l!=null?Ru(e,y,nn(l)):i!=null&&e.removeAttribute("value"),o==null&&s!=null&&(e.defaultChecked=!!s),o!=null&&(e.checked=o&&typeof o!="function"&&typeof o!="symbol"),b!=null&&typeof b!="function"&&typeof b!="symbol"&&typeof b!="boolean"?e.name=""+nn(b):e.removeAttribute("name")}function af(e,t,l,i,o,s,y,b){if(s!=null&&typeof s!="function"&&typeof s!="symbol"&&typeof s!="boolean"&&(e.type=s),t!=null||l!=null){if(!(s!=="submit"&&s!=="reset"||t!=null)){Du(e);return}l=l!=null?""+nn(l):"",t=t!=null?""+nn(t):l,b||t===e.value||(e.value=t),e.defaultValue=t}i=i??o,i=typeof i!="function"&&typeof i!="symbol"&&!!i,e.checked=b?e.checked:!!i,e.defaultChecked=!!i,y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"&&(e.name=y),Du(e)}function Ru(e,t,l){t==="number"&&Zr(e.ownerDocument)===e||e.defaultValue===""+l||(e.defaultValue=""+l)}function Zl(e,t,l,i){if(e=e.options,t){t={};for(var o=0;o<l.length;o++)t["$"+l[o]]=!0;for(l=0;l<e.length;l++)o=t.hasOwnProperty("$"+e[l].value),e[l].selected!==o&&(e[l].selected=o),o&&i&&(e[l].defaultSelected=!0)}else{for(l=""+nn(l),t=null,o=0;o<e.length;o++){if(e[o].value===l){e[o].selected=!0,i&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function uf(e,t,l){if(t!=null&&(t=""+nn(t),t!==e.value&&(e.value=t),l==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=l!=null?""+nn(l):""}function of(e,t,l,i){if(t==null){if(i!=null){if(l!=null)throw Error(u(92));if(W(i)){if(1<i.length)throw Error(u(93));i=i[0]}l=i}l==null&&(l=""),t=l}l=nn(t),e.defaultValue=l,i=e.textContent,i===l&&i!==""&&i!==null&&(e.value=i),Du(e)}function Fl(e,t){if(t){var l=e.firstChild;if(l&&l===e.lastChild&&l.nodeType===3){l.nodeValue=t;return}}e.textContent=t}var yy=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function cf(e,t,l){var i=t.indexOf("--")===0;l==null||typeof l=="boolean"||l===""?i?e.setProperty(t,""):t==="float"?e.cssFloat="":e[t]="":i?e.setProperty(t,l):typeof l!="number"||l===0||yy.has(t)?t==="float"?e.cssFloat=l:e[t]=(""+l).trim():e[t]=l+"px"}function sf(e,t,l){if(t!=null&&typeof t!="object")throw Error(u(62));if(e=e.style,l!=null){for(var i in l)!l.hasOwnProperty(i)||t!=null&&t.hasOwnProperty(i)||(i.indexOf("--")===0?e.setProperty(i,""):i==="float"?e.cssFloat="":e[i]="");for(var o in t)i=t[o],t.hasOwnProperty(o)&&l[o]!==i&&cf(e,o,i)}else for(var s in t)t.hasOwnProperty(s)&&cf(e,s,t[s])}function Nu(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var vy=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),by=/^[\\u0000-\\u001F ]*j[\\r\\n\\t]*a[\\r\\n\\t]*v[\\r\\n\\t]*a[\\r\\n\\t]*s[\\r\\n\\t]*c[\\r\\n\\t]*r[\\r\\n\\t]*i[\\r\\n\\t]*p[\\r\\n\\t]*t[\\r\\n\\t]*:/i;function Fr(e){return by.test(""+e)?"javascript:throw new Error(\'React has blocked a javascript: URL as a security precaution.\')":e}function _n(){}var Lu=null;function Uu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Kl=null,Jl=null;function ff(e){var t=Xl(e);if(t&&(e=t.stateNode)){var l=e[Lt]||null;e:switch(e=t.stateNode,t.type){case"input":if(Mu(e,l.value,l.defaultValue,l.defaultValue,l.checked,l.defaultChecked,l.type,l.name),t=l.name,l.type==="radio"&&t!=null){for(l=e;l.parentNode;)l=l.parentNode;for(l=l.querySelectorAll(\'input[name="\'+ln(""+t)+\'"][type="radio"]\'),t=0;t<l.length;t++){var i=l[t];if(i!==e&&i.form===e.form){var o=i[Lt]||null;if(!o)throw Error(u(90));Mu(i,o.value,o.defaultValue,o.defaultValue,o.checked,o.defaultChecked,o.type,o.name)}}for(t=0;t<l.length;t++)i=l[t],i.form===e.form&&rf(i)}break e;case"textarea":uf(e,l.value,l.defaultValue);break e;case"select":t=l.value,t!=null&&Zl(e,!!l.multiple,t,!1)}}}var ju=!1;function df(e,t,l){if(ju)return e(t,l);ju=!0;try{var i=e(t);return i}finally{if(ju=!1,(Kl!==null||Jl!==null)&&(La(),Kl&&(t=Kl,e=Jl,Jl=Kl=null,ff(t),e)))for(t=0;t<e.length;t++)ff(e[t])}}function Hi(e,t){var l=e.stateNode;if(l===null)return null;var i=l[Lt]||null;if(i===null)return null;l=i[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(i=!i.disabled)||(e=e.type,i=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!i;break e;default:e=!1}if(e)return null;if(l&&typeof l!="function")throw Error(u(231,t,typeof l));return l}var On=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Bu=!1;if(On)try{var qi={};Object.defineProperty(qi,"passive",{get:function(){Bu=!0}}),window.addEventListener("test",qi,qi),window.removeEventListener("test",qi,qi)}catch{Bu=!1}var Kn=null,Hu=null,Kr=null;function hf(){if(Kr)return Kr;var e,t=Hu,l=t.length,i,o="value"in Kn?Kn.value:Kn.textContent,s=o.length;for(e=0;e<l&&t[e]===o[e];e++);var y=l-e;for(i=1;i<=y&&t[l-i]===o[s-i];i++);return Kr=o.slice(e,1<i?1-i:void 0)}function Jr(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Wr(){return!0}function pf(){return!1}function Ut(e){function t(l,i,o,s,y){this._reactName=l,this._targetInst=o,this.type=i,this.nativeEvent=s,this.target=y,this.currentTarget=null;for(var b in e)e.hasOwnProperty(b)&&(l=e[b],this[b]=l?l(s):s[b]);return this.isDefaultPrevented=(s.defaultPrevented!=null?s.defaultPrevented:s.returnValue===!1)?Wr:pf,this.isPropagationStopped=pf,this}return g(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var l=this.nativeEvent;l&&(l.preventDefault?l.preventDefault():typeof l.returnValue!="unknown"&&(l.returnValue=!1),this.isDefaultPrevented=Wr)},stopPropagation:function(){var l=this.nativeEvent;l&&(l.stopPropagation?l.stopPropagation():typeof l.cancelBubble!="unknown"&&(l.cancelBubble=!0),this.isPropagationStopped=Wr)},persist:function(){},isPersistent:Wr}),t}var kl={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},$r=Ut(kl),Yi=g({},kl,{view:0,detail:0}),xy=Ut(Yi),qu,Yu,Vi,Pr=g({},Yi,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Gu,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==Vi&&(Vi&&e.type==="mousemove"?(qu=e.screenX-Vi.screenX,Yu=e.screenY-Vi.screenY):Yu=qu=0,Vi=e),qu)},movementY:function(e){return"movementY"in e?e.movementY:Yu}}),mf=Ut(Pr),Sy=g({},Pr,{dataTransfer:0}),ky=Ut(Sy),Ey=g({},Yi,{relatedTarget:0}),Vu=Ut(Ey),Ay=g({},kl,{animationName:0,elapsedTime:0,pseudoElement:0}),wy=Ut(Ay),Ty=g({},kl,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Cy=Ut(Ty),zy=g({},kl,{data:0}),gf=Ut(zy),_y={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Oy={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},Dy={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function My(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Dy[e])?!!t[e]:!1}function Gu(){return My}var Ry=g({},Yi,{key:function(e){if(e.key){var t=_y[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=Jr(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Oy[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Gu,charCode:function(e){return e.type==="keypress"?Jr(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Jr(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),Ny=Ut(Ry),Ly=g({},Pr,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),yf=Ut(Ly),Uy=g({},Yi,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Gu}),jy=Ut(Uy),By=g({},kl,{propertyName:0,elapsedTime:0,pseudoElement:0}),Hy=Ut(By),qy=g({},Pr,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Yy=Ut(qy),Vy=g({},kl,{newState:0,oldState:0}),Gy=Ut(Vy),Xy=[9,13,27,32],Xu=On&&"CompositionEvent"in window,Gi=null;On&&"documentMode"in document&&(Gi=document.documentMode);var Qy=On&&"TextEvent"in window&&!Gi,vf=On&&(!Xu||Gi&&8<Gi&&11>=Gi),bf=" ",xf=!1;function Sf(e,t){switch(e){case"keyup":return Xy.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function kf(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Wl=!1;function Iy(e,t){switch(e){case"compositionend":return kf(t);case"keypress":return t.which!==32?null:(xf=!0,bf);case"textInput":return e=t.data,e===bf&&xf?null:e;default:return null}}function Zy(e,t){if(Wl)return e==="compositionend"||!Xu&&Sf(e,t)?(e=hf(),Kr=Hu=Kn=null,Wl=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return vf&&t.locale!=="ko"?null:t.data;default:return null}}var Fy={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Ef(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!Fy[e.type]:t==="textarea"}function Af(e,t,l,i){Kl?Jl?Jl.push(i):Jl=[i]:Kl=i,t=Va(t,"onChange"),0<t.length&&(l=new $r("onChange","change",null,l,i),e.push({event:l,listeners:t}))}var Xi=null,Qi=null;function Ky(e){ap(e,0)}function ea(e){var t=Bi(e);if(rf(t))return e}function wf(e,t){if(e==="change")return t}var Tf=!1;if(On){var Qu;if(On){var Iu="oninput"in document;if(!Iu){var Cf=document.createElement("div");Cf.setAttribute("oninput","return;"),Iu=typeof Cf.oninput=="function"}Qu=Iu}else Qu=!1;Tf=Qu&&(!document.documentMode||9<document.documentMode)}function zf(){Xi&&(Xi.detachEvent("onpropertychange",_f),Qi=Xi=null)}function _f(e){if(e.propertyName==="value"&&ea(Qi)){var t=[];Af(t,Qi,e,Uu(e)),df(Ky,t)}}function Jy(e,t,l){e==="focusin"?(zf(),Xi=t,Qi=l,Xi.attachEvent("onpropertychange",_f)):e==="focusout"&&zf()}function Wy(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return ea(Qi)}function $y(e,t){if(e==="click")return ea(t)}function Py(e,t){if(e==="input"||e==="change")return ea(t)}function e1(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Qt=typeof Object.is=="function"?Object.is:e1;function Ii(e,t){if(Qt(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var l=Object.keys(e),i=Object.keys(t);if(l.length!==i.length)return!1;for(i=0;i<l.length;i++){var o=l[i];if(!tn.call(t,o)||!Qt(e[o],t[o]))return!1}return!0}function Of(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Df(e,t){var l=Of(e);e=0;for(var i;l;){if(l.nodeType===3){if(i=e+l.textContent.length,e<=t&&i>=t)return{node:l,offset:t-e};e=i}e:{for(;l;){if(l.nextSibling){l=l.nextSibling;break e}l=l.parentNode}l=void 0}l=Of(l)}}function Mf(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Mf(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Rf(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Zr(e.document);t instanceof e.HTMLIFrameElement;){try{var l=typeof t.contentWindow.location.href=="string"}catch{l=!1}if(l)e=t.contentWindow;else break;t=Zr(e.document)}return t}function Zu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}var t1=On&&"documentMode"in document&&11>=document.documentMode,$l=null,Fu=null,Zi=null,Ku=!1;function Nf(e,t,l){var i=l.window===l?l.document:l.nodeType===9?l:l.ownerDocument;Ku||$l==null||$l!==Zr(i)||(i=$l,"selectionStart"in i&&Zu(i)?i={start:i.selectionStart,end:i.selectionEnd}:(i=(i.ownerDocument&&i.ownerDocument.defaultView||window).getSelection(),i={anchorNode:i.anchorNode,anchorOffset:i.anchorOffset,focusNode:i.focusNode,focusOffset:i.focusOffset}),Zi&&Ii(Zi,i)||(Zi=i,i=Va(Fu,"onSelect"),0<i.length&&(t=new $r("onSelect","select",null,t,l),e.push({event:t,listeners:i}),t.target=$l)))}function El(e,t){var l={};return l[e.toLowerCase()]=t.toLowerCase(),l["Webkit"+e]="webkit"+t,l["Moz"+e]="moz"+t,l}var Pl={animationend:El("Animation","AnimationEnd"),animationiteration:El("Animation","AnimationIteration"),animationstart:El("Animation","AnimationStart"),transitionrun:El("Transition","TransitionRun"),transitionstart:El("Transition","TransitionStart"),transitioncancel:El("Transition","TransitionCancel"),transitionend:El("Transition","TransitionEnd")},Ju={},Lf={};On&&(Lf=document.createElement("div").style,"AnimationEvent"in window||(delete Pl.animationend.animation,delete Pl.animationiteration.animation,delete Pl.animationstart.animation),"TransitionEvent"in window||delete Pl.transitionend.transition);function Al(e){if(Ju[e])return Ju[e];if(!Pl[e])return e;var t=Pl[e],l;for(l in t)if(t.hasOwnProperty(l)&&l in Lf)return Ju[e]=t[l];return e}var Uf=Al("animationend"),jf=Al("animationiteration"),Bf=Al("animationstart"),n1=Al("transitionrun"),l1=Al("transitionstart"),i1=Al("transitioncancel"),Hf=Al("transitionend"),qf=new Map,Wu="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Wu.push("scrollEnd");function mn(e,t){qf.set(e,t),Sl(t,[e])}var ta=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var t=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},rn=[],ei=0,$u=0;function na(){for(var e=ei,t=$u=ei=0;t<e;){var l=rn[t];rn[t++]=null;var i=rn[t];rn[t++]=null;var o=rn[t];rn[t++]=null;var s=rn[t];if(rn[t++]=null,i!==null&&o!==null){var y=i.pending;y===null?o.next=o:(o.next=y.next,y.next=o),i.pending=o}s!==0&&Yf(l,o,s)}}function la(e,t,l,i){rn[ei++]=e,rn[ei++]=t,rn[ei++]=l,rn[ei++]=i,$u|=i,e.lanes|=i,e=e.alternate,e!==null&&(e.lanes|=i)}function Pu(e,t,l,i){return la(e,t,l,i),ia(e)}function wl(e,t){return la(e,null,null,t),ia(e)}function Yf(e,t,l){e.lanes|=l;var i=e.alternate;i!==null&&(i.lanes|=l);for(var o=!1,s=e.return;s!==null;)s.childLanes|=l,i=s.alternate,i!==null&&(i.childLanes|=l),s.tag===22&&(e=s.stateNode,e===null||e._visibility&1||(o=!0)),e=s,s=s.return;return e.tag===3?(s=e.stateNode,o&&t!==null&&(o=31-We(l),e=s.hiddenUpdates,i=e[o],i===null?e[o]=[t]:i.push(t),t.lane=l|536870912),s):null}function ia(e){if(50<mr)throw mr=0,cc=null,Error(u(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var ti={};function r1(e,t,l,i){this.tag=e,this.key=l,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=i,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function It(e,t,l,i){return new r1(e,t,l,i)}function eo(e){return e=e.prototype,!(!e||!e.isReactComponent)}function Dn(e,t){var l=e.alternate;return l===null?(l=It(e.tag,t,e.key,e.mode),l.elementType=e.elementType,l.type=e.type,l.stateNode=e.stateNode,l.alternate=e,e.alternate=l):(l.pendingProps=t,l.type=e.type,l.flags=0,l.subtreeFlags=0,l.deletions=null),l.flags=e.flags&65011712,l.childLanes=e.childLanes,l.lanes=e.lanes,l.child=e.child,l.memoizedProps=e.memoizedProps,l.memoizedState=e.memoizedState,l.updateQueue=e.updateQueue,t=e.dependencies,l.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},l.sibling=e.sibling,l.index=e.index,l.ref=e.ref,l.refCleanup=e.refCleanup,l}function Vf(e,t){e.flags&=65011714;var l=e.alternate;return l===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=l.childLanes,e.lanes=l.lanes,e.child=l.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=l.memoizedProps,e.memoizedState=l.memoizedState,e.updateQueue=l.updateQueue,e.type=l.type,t=l.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function ra(e,t,l,i,o,s){var y=0;if(i=e,typeof e=="function")eo(e)&&(y=1);else if(typeof e=="string")y=sv(e,l,te.current)?26:e==="html"||e==="head"||e==="body"?27:5;else e:switch(e){case Se:return e=It(31,l,t,o),e.elementType=Se,e.lanes=s,e;case B:return Tl(l.children,o,s,t);case j:y=8,o|=24;break;case _:return e=It(12,l,t,o|2),e.elementType=_,e.lanes=s,e;case ue:return e=It(13,l,t,o),e.elementType=ue,e.lanes=s,e;case N:return e=It(19,l,t,o),e.elementType=N,e.lanes=s,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case Y:y=10;break e;case F:y=9;break e;case le:y=11;break e;case $:y=14;break e;case he:y=16,i=null;break e}y=29,l=Error(u(130,e===null?"null":typeof e,"")),i=null}return t=It(y,l,t,o),t.elementType=e,t.type=i,t.lanes=s,t}function Tl(e,t,l,i){return e=It(7,e,i,t),e.lanes=l,e}function to(e,t,l){return e=It(6,e,null,t),e.lanes=l,e}function Gf(e){var t=It(18,null,null,0);return t.stateNode=e,t}function no(e,t,l){return t=It(4,e.children!==null?e.children:[],e.key,t),t.lanes=l,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Xf=new WeakMap;function an(e,t){if(typeof e=="object"&&e!==null){var l=Xf.get(e);return l!==void 0?l:(t={value:e,source:t,stack:en(t)},Xf.set(e,t),t)}return{value:e,source:t,stack:en(t)}}var ni=[],li=0,aa=null,Fi=0,un=[],on=0,Jn=null,xn=1,Sn="";function Mn(e,t){ni[li++]=Fi,ni[li++]=aa,aa=e,Fi=t}function Qf(e,t,l){un[on++]=xn,un[on++]=Sn,un[on++]=Jn,Jn=e;var i=xn;e=Sn;var o=32-We(i)-1;i&=~(1<<o),l+=1;var s=32-We(t)+o;if(30<s){var y=o-o%5;s=(i&(1<<y)-1).toString(32),i>>=y,o-=y,xn=1<<32-We(t)+o|l<<o|i,Sn=s+e}else xn=1<<s|l<<o|i,Sn=e}function lo(e){e.return!==null&&(Mn(e,1),Qf(e,1,0))}function io(e){for(;e===aa;)aa=ni[--li],ni[li]=null,Fi=ni[--li],ni[li]=null;for(;e===Jn;)Jn=un[--on],un[on]=null,Sn=un[--on],un[on]=null,xn=un[--on],un[on]=null}function If(e,t){un[on++]=xn,un[on++]=Sn,un[on++]=Jn,xn=t.id,Sn=t.overflow,Jn=e}var St=null,nt=null,je=!1,Wn=null,cn=!1,ro=Error(u(519));function $n(e){var t=Error(u(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw Ki(an(t,e)),ro}function Zf(e){var t=e.stateNode,l=e.type,i=e.memoizedProps;switch(t[xt]=e,t[Lt]=i,l){case"dialog":Re("cancel",t),Re("close",t);break;case"iframe":case"object":case"embed":Re("load",t);break;case"video":case"audio":for(l=0;l<yr.length;l++)Re(yr[l],t);break;case"source":Re("error",t);break;case"img":case"image":case"link":Re("error",t),Re("load",t);break;case"details":Re("toggle",t);break;case"input":Re("invalid",t),af(t,i.value,i.defaultValue,i.checked,i.defaultChecked,i.type,i.name,!0);break;case"select":Re("invalid",t);break;case"textarea":Re("invalid",t),of(t,i.value,i.defaultValue,i.children)}l=i.children,typeof l!="string"&&typeof l!="number"&&typeof l!="bigint"||t.textContent===""+l||i.suppressHydrationWarning===!0||sp(t.textContent,l)?(i.popover!=null&&(Re("beforetoggle",t),Re("toggle",t)),i.onScroll!=null&&Re("scroll",t),i.onScrollEnd!=null&&Re("scrollend",t),i.onClick!=null&&(t.onclick=_n),t=!0):t=!1,t||$n(e,!0)}function Ff(e){for(St=e.return;St;)switch(St.tag){case 5:case 31:case 13:cn=!1;return;case 27:case 3:cn=!0;return;default:St=St.return}}function ii(e){if(e!==St)return!1;if(!je)return Ff(e),je=!0,!1;var t=e.tag,l;if((l=t!==3&&t!==27)&&((l=t===5)&&(l=e.type,l=!(l!=="form"&&l!=="button")||Ac(e.type,e.memoizedProps)),l=!l),l&&nt&&$n(e),Ff(e),t===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));nt=bp(e)}else if(t===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(317));nt=bp(e)}else t===27?(t=nt,dl(e.type)?(e=_c,_c=null,nt=e):nt=t):nt=St?fn(e.stateNode.nextSibling):null;return!0}function Cl(){nt=St=null,je=!1}function ao(){var e=Wn;return e!==null&&(qt===null?qt=e:qt.push.apply(qt,e),Wn=null),e}function Ki(e){Wn===null?Wn=[e]:Wn.push(e)}var uo=w(null),zl=null,Rn=null;function Pn(e,t,l){k(uo,t._currentValue),t._currentValue=l}function Nn(e){e._currentValue=uo.current,H(uo)}function oo(e,t,l){for(;e!==null;){var i=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,i!==null&&(i.childLanes|=t)):i!==null&&(i.childLanes&t)!==t&&(i.childLanes|=t),e===l)break;e=e.return}}function co(e,t,l,i){var o=e.child;for(o!==null&&(o.return=e);o!==null;){var s=o.dependencies;if(s!==null){var y=o.child;s=s.firstContext;e:for(;s!==null;){var b=s;s=o;for(var A=0;A<t.length;A++)if(b.context===t[A]){s.lanes|=l,b=s.alternate,b!==null&&(b.lanes|=l),oo(s.return,l,e),i||(y=null);break e}s=b.next}}else if(o.tag===18){if(y=o.return,y===null)throw Error(u(341));y.lanes|=l,s=y.alternate,s!==null&&(s.lanes|=l),oo(y,l,e),y=null}else y=o.child;if(y!==null)y.return=o;else for(y=o;y!==null;){if(y===e){y=null;break}if(o=y.sibling,o!==null){o.return=y.return,y=o;break}y=y.return}o=y}}function ri(e,t,l,i){e=null;for(var o=t,s=!1;o!==null;){if(!s){if((o.flags&524288)!==0)s=!0;else if((o.flags&262144)!==0)break}if(o.tag===10){var y=o.alternate;if(y===null)throw Error(u(387));if(y=y.memoizedProps,y!==null){var b=o.type;Qt(o.pendingProps.value,y.value)||(e!==null?e.push(b):e=[b])}}else if(o===Ae.current){if(y=o.alternate,y===null)throw Error(u(387));y.memoizedState.memoizedState!==o.memoizedState.memoizedState&&(e!==null?e.push(kr):e=[kr])}o=o.return}e!==null&&co(t,e,l,i),t.flags|=262144}function ua(e){for(e=e.firstContext;e!==null;){if(!Qt(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function _l(e){zl=e,Rn=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function kt(e){return Kf(zl,e)}function oa(e,t){return zl===null&&_l(e),Kf(e,t)}function Kf(e,t){var l=t._currentValue;if(t={context:t,memoizedValue:l,next:null},Rn===null){if(e===null)throw Error(u(308));Rn=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else Rn=Rn.next=t;return l}var a1=typeof AbortController<"u"?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(l,i){e.push(i)}};this.abort=function(){t.aborted=!0,e.forEach(function(l){return l()})}},u1=n.unstable_scheduleCallback,o1=n.unstable_NormalPriority,st={$$typeof:Y,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function so(){return{controller:new a1,data:new Map,refCount:0}}function Ji(e){e.refCount--,e.refCount===0&&u1(o1,function(){e.controller.abort()})}var Wi=null,fo=0,ai=0,ui=null;function c1(e,t){if(Wi===null){var l=Wi=[];fo=0,ai=mc(),ui={status:"pending",value:void 0,then:function(i){l.push(i)}}}return fo++,t.then(Jf,Jf),t}function Jf(){if(--fo===0&&Wi!==null){ui!==null&&(ui.status="fulfilled");var e=Wi;Wi=null,ai=0,ui=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function s1(e,t){var l=[],i={status:"pending",value:null,reason:null,then:function(o){l.push(o)}};return e.then(function(){i.status="fulfilled",i.value=t;for(var o=0;o<l.length;o++)(0,l[o])(t)},function(o){for(i.status="rejected",i.reason=o,o=0;o<l.length;o++)(0,l[o])(void 0)}),i}var Wf=D.S;D.S=function(e,t){Nh=Ot(),typeof t=="object"&&t!==null&&typeof t.then=="function"&&c1(e,t),Wf!==null&&Wf(e,t)};var Ol=w(null);function ho(){var e=Ol.current;return e!==null?e:$e.pooledCache}function ca(e,t){t===null?k(Ol,Ol.current):k(Ol,t.pool)}function $f(){var e=ho();return e===null?null:{parent:st._currentValue,pool:e}}var oi=Error(u(460)),po=Error(u(474)),sa=Error(u(542)),fa={then:function(){}};function Pf(e){return e=e.status,e==="fulfilled"||e==="rejected"}function ed(e,t,l){switch(l=e[l],l===void 0?e.push(t):l!==t&&(t.then(_n,_n),t=l),t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,nd(e),e;default:if(typeof t.status=="string")t.then(_n,_n);else{if(e=$e,e!==null&&100<e.shellSuspendCounter)throw Error(u(482));e=t,e.status="pending",e.then(function(i){if(t.status==="pending"){var o=t;o.status="fulfilled",o.value=i}},function(i){if(t.status==="pending"){var o=t;o.status="rejected",o.reason=i}})}switch(t.status){case"fulfilled":return t.value;case"rejected":throw e=t.reason,nd(e),e}throw Ml=t,oi}}function Dl(e){try{var t=e._init;return t(e._payload)}catch(l){throw l!==null&&typeof l=="object"&&typeof l.then=="function"?(Ml=l,oi):l}}var Ml=null;function td(){if(Ml===null)throw Error(u(459));var e=Ml;return Ml=null,e}function nd(e){if(e===oi||e===sa)throw Error(u(483))}var ci=null,$i=0;function da(e){var t=$i;return $i+=1,ci===null&&(ci=[]),ed(ci,e,t)}function Pi(e,t){t=t.props.ref,e.ref=t!==void 0?t:null}function ha(e,t){throw t.$$typeof===x?Error(u(525)):(e=Object.prototype.toString.call(t),Error(u(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e)))}function ld(e){function t(z,T){if(e){var O=z.deletions;O===null?(z.deletions=[T],z.flags|=16):O.push(T)}}function l(z,T){if(!e)return null;for(;T!==null;)t(z,T),T=T.sibling;return null}function i(z){for(var T=new Map;z!==null;)z.key!==null?T.set(z.key,z):T.set(z.index,z),z=z.sibling;return T}function o(z,T){return z=Dn(z,T),z.index=0,z.sibling=null,z}function s(z,T,O){return z.index=O,e?(O=z.alternate,O!==null?(O=O.index,O<T?(z.flags|=67108866,T):O):(z.flags|=67108866,T)):(z.flags|=1048576,T)}function y(z){return e&&z.alternate===null&&(z.flags|=67108866),z}function b(z,T,O,G){return T===null||T.tag!==6?(T=to(O,z.mode,G),T.return=z,T):(T=o(T,O),T.return=z,T)}function A(z,T,O,G){var ge=O.type;return ge===B?q(z,T,O.props.children,G,O.key):T!==null&&(T.elementType===ge||typeof ge=="object"&&ge!==null&&ge.$$typeof===he&&Dl(ge)===T.type)?(T=o(T,O.props),Pi(T,O),T.return=z,T):(T=ra(O.type,O.key,O.props,null,z.mode,G),Pi(T,O),T.return=z,T)}function M(z,T,O,G){return T===null||T.tag!==4||T.stateNode.containerInfo!==O.containerInfo||T.stateNode.implementation!==O.implementation?(T=no(O,z.mode,G),T.return=z,T):(T=o(T,O.children||[]),T.return=z,T)}function q(z,T,O,G,ge){return T===null||T.tag!==7?(T=Tl(O,z.mode,G,ge),T.return=z,T):(T=o(T,O),T.return=z,T)}function Q(z,T,O){if(typeof T=="string"&&T!==""||typeof T=="number"||typeof T=="bigint")return T=to(""+T,z.mode,O),T.return=z,T;if(typeof T=="object"&&T!==null){switch(T.$$typeof){case S:return O=ra(T.type,T.key,T.props,null,z.mode,O),Pi(O,T),O.return=z,O;case C:return T=no(T,z.mode,O),T.return=z,T;case he:return T=Dl(T),Q(z,T,O)}if(W(T)||ee(T))return T=Tl(T,z.mode,O,null),T.return=z,T;if(typeof T.then=="function")return Q(z,da(T),O);if(T.$$typeof===Y)return Q(z,oa(z,T),O);ha(z,T)}return null}function R(z,T,O,G){var ge=T!==null?T.key:null;if(typeof O=="string"&&O!==""||typeof O=="number"||typeof O=="bigint")return ge!==null?null:b(z,T,""+O,G);if(typeof O=="object"&&O!==null){switch(O.$$typeof){case S:return O.key===ge?A(z,T,O,G):null;case C:return O.key===ge?M(z,T,O,G):null;case he:return O=Dl(O),R(z,T,O,G)}if(W(O)||ee(O))return ge!==null?null:q(z,T,O,G,null);if(typeof O.then=="function")return R(z,T,da(O),G);if(O.$$typeof===Y)return R(z,T,oa(z,O),G);ha(z,O)}return null}function U(z,T,O,G,ge){if(typeof G=="string"&&G!==""||typeof G=="number"||typeof G=="bigint")return z=z.get(O)||null,b(T,z,""+G,ge);if(typeof G=="object"&&G!==null){switch(G.$$typeof){case S:return z=z.get(G.key===null?O:G.key)||null,A(T,z,G,ge);case C:return z=z.get(G.key===null?O:G.key)||null,M(T,z,G,ge);case he:return G=Dl(G),U(z,T,O,G,ge)}if(W(G)||ee(G))return z=z.get(O)||null,q(T,z,G,ge,null);if(typeof G.then=="function")return U(z,T,O,da(G),ge);if(G.$$typeof===Y)return U(z,T,O,oa(T,G),ge);ha(T,G)}return null}function se(z,T,O,G){for(var ge=null,qe=null,de=T,_e=T=0,Ue=null;de!==null&&_e<O.length;_e++){de.index>_e?(Ue=de,de=null):Ue=de.sibling;var Ye=R(z,de,O[_e],G);if(Ye===null){de===null&&(de=Ue);break}e&&de&&Ye.alternate===null&&t(z,de),T=s(Ye,T,_e),qe===null?ge=Ye:qe.sibling=Ye,qe=Ye,de=Ue}if(_e===O.length)return l(z,de),je&&Mn(z,_e),ge;if(de===null){for(;_e<O.length;_e++)de=Q(z,O[_e],G),de!==null&&(T=s(de,T,_e),qe===null?ge=de:qe.sibling=de,qe=de);return je&&Mn(z,_e),ge}for(de=i(de);_e<O.length;_e++)Ue=U(de,z,_e,O[_e],G),Ue!==null&&(e&&Ue.alternate!==null&&de.delete(Ue.key===null?_e:Ue.key),T=s(Ue,T,_e),qe===null?ge=Ue:qe.sibling=Ue,qe=Ue);return e&&de.forEach(function(yl){return t(z,yl)}),je&&Mn(z,_e),ge}function xe(z,T,O,G){if(O==null)throw Error(u(151));for(var ge=null,qe=null,de=T,_e=T=0,Ue=null,Ye=O.next();de!==null&&!Ye.done;_e++,Ye=O.next()){de.index>_e?(Ue=de,de=null):Ue=de.sibling;var yl=R(z,de,Ye.value,G);if(yl===null){de===null&&(de=Ue);break}e&&de&&yl.alternate===null&&t(z,de),T=s(yl,T,_e),qe===null?ge=yl:qe.sibling=yl,qe=yl,de=Ue}if(Ye.done)return l(z,de),je&&Mn(z,_e),ge;if(de===null){for(;!Ye.done;_e++,Ye=O.next())Ye=Q(z,Ye.value,G),Ye!==null&&(T=s(Ye,T,_e),qe===null?ge=Ye:qe.sibling=Ye,qe=Ye);return je&&Mn(z,_e),ge}for(de=i(de);!Ye.done;_e++,Ye=O.next())Ye=U(de,z,_e,Ye.value,G),Ye!==null&&(e&&Ye.alternate!==null&&de.delete(Ye.key===null?_e:Ye.key),T=s(Ye,T,_e),qe===null?ge=Ye:qe.sibling=Ye,qe=Ye);return e&&de.forEach(function(Sv){return t(z,Sv)}),je&&Mn(z,_e),ge}function Je(z,T,O,G){if(typeof O=="object"&&O!==null&&O.type===B&&O.key===null&&(O=O.props.children),typeof O=="object"&&O!==null){switch(O.$$typeof){case S:e:{for(var ge=O.key;T!==null;){if(T.key===ge){if(ge=O.type,ge===B){if(T.tag===7){l(z,T.sibling),G=o(T,O.props.children),G.return=z,z=G;break e}}else if(T.elementType===ge||typeof ge=="object"&&ge!==null&&ge.$$typeof===he&&Dl(ge)===T.type){l(z,T.sibling),G=o(T,O.props),Pi(G,O),G.return=z,z=G;break e}l(z,T);break}else t(z,T);T=T.sibling}O.type===B?(G=Tl(O.props.children,z.mode,G,O.key),G.return=z,z=G):(G=ra(O.type,O.key,O.props,null,z.mode,G),Pi(G,O),G.return=z,z=G)}return y(z);case C:e:{for(ge=O.key;T!==null;){if(T.key===ge)if(T.tag===4&&T.stateNode.containerInfo===O.containerInfo&&T.stateNode.implementation===O.implementation){l(z,T.sibling),G=o(T,O.children||[]),G.return=z,z=G;break e}else{l(z,T);break}else t(z,T);T=T.sibling}G=no(O,z.mode,G),G.return=z,z=G}return y(z);case he:return O=Dl(O),Je(z,T,O,G)}if(W(O))return se(z,T,O,G);if(ee(O)){if(ge=ee(O),typeof ge!="function")throw Error(u(150));return O=ge.call(O),xe(z,T,O,G)}if(typeof O.then=="function")return Je(z,T,da(O),G);if(O.$$typeof===Y)return Je(z,T,oa(z,O),G);ha(z,O)}return typeof O=="string"&&O!==""||typeof O=="number"||typeof O=="bigint"?(O=""+O,T!==null&&T.tag===6?(l(z,T.sibling),G=o(T,O),G.return=z,z=G):(l(z,T),G=to(O,z.mode,G),G.return=z,z=G),y(z)):l(z,T)}return function(z,T,O,G){try{$i=0;var ge=Je(z,T,O,G);return ci=null,ge}catch(de){if(de===oi||de===sa)throw de;var qe=It(29,de,null,z.mode);return qe.lanes=G,qe.return=z,qe}finally{}}}var Rl=ld(!0),id=ld(!1),el=!1;function mo(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function go(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function tl(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function nl(e,t,l){var i=e.updateQueue;if(i===null)return null;if(i=i.shared,(Ve&2)!==0){var o=i.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),i.pending=t,t=ia(e),Yf(e,null,l),t}return la(e,i,t,l),ia(e)}function er(e,t,l){if(t=t.updateQueue,t!==null&&(t=t.shared,(l&4194048)!==0)){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Fs(e,l)}}function yo(e,t){var l=e.updateQueue,i=e.alternate;if(i!==null&&(i=i.updateQueue,l===i)){var o=null,s=null;if(l=l.firstBaseUpdate,l!==null){do{var y={lane:l.lane,tag:l.tag,payload:l.payload,callback:null,next:null};s===null?o=s=y:s=s.next=y,l=l.next}while(l!==null);s===null?o=s=t:s=s.next=t}else o=s=t;l={baseState:i.baseState,firstBaseUpdate:o,lastBaseUpdate:s,shared:i.shared,callbacks:i.callbacks},e.updateQueue=l;return}e=l.lastBaseUpdate,e===null?l.firstBaseUpdate=t:e.next=t,l.lastBaseUpdate=t}var vo=!1;function tr(){if(vo){var e=ui;if(e!==null)throw e}}function nr(e,t,l,i){vo=!1;var o=e.updateQueue;el=!1;var s=o.firstBaseUpdate,y=o.lastBaseUpdate,b=o.shared.pending;if(b!==null){o.shared.pending=null;var A=b,M=A.next;A.next=null,y===null?s=M:y.next=M,y=A;var q=e.alternate;q!==null&&(q=q.updateQueue,b=q.lastBaseUpdate,b!==y&&(b===null?q.firstBaseUpdate=M:b.next=M,q.lastBaseUpdate=A))}if(s!==null){var Q=o.baseState;y=0,q=M=A=null,b=s;do{var R=b.lane&-536870913,U=R!==b.lane;if(U?(Le&R)===R:(i&R)===R){R!==0&&R===ai&&(vo=!0),q!==null&&(q=q.next={lane:0,tag:b.tag,payload:b.payload,callback:null,next:null});e:{var se=e,xe=b;R=t;var Je=l;switch(xe.tag){case 1:if(se=xe.payload,typeof se=="function"){Q=se.call(Je,Q,R);break e}Q=se;break e;case 3:se.flags=se.flags&-65537|128;case 0:if(se=xe.payload,R=typeof se=="function"?se.call(Je,Q,R):se,R==null)break e;Q=g({},Q,R);break e;case 2:el=!0}}R=b.callback,R!==null&&(e.flags|=64,U&&(e.flags|=8192),U=o.callbacks,U===null?o.callbacks=[R]:U.push(R))}else U={lane:R,tag:b.tag,payload:b.payload,callback:b.callback,next:null},q===null?(M=q=U,A=Q):q=q.next=U,y|=R;if(b=b.next,b===null){if(b=o.shared.pending,b===null)break;U=b,b=U.next,U.next=null,o.lastBaseUpdate=U,o.shared.pending=null}}while(!0);q===null&&(A=Q),o.baseState=A,o.firstBaseUpdate=M,o.lastBaseUpdate=q,s===null&&(o.shared.lanes=0),ul|=y,e.lanes=y,e.memoizedState=Q}}function rd(e,t){if(typeof e!="function")throw Error(u(191,e));e.call(t)}function ad(e,t){var l=e.callbacks;if(l!==null)for(e.callbacks=null,e=0;e<l.length;e++)rd(l[e],t)}var si=w(null),pa=w(0);function ud(e,t){e=Gn,k(pa,e),k(si,t),Gn=e|t.baseLanes}function bo(){k(pa,Gn),k(si,si.current)}function xo(){Gn=pa.current,H(si),H(pa)}var Zt=w(null),sn=null;function ll(e){var t=e.alternate;k(ut,ut.current&1),k(Zt,e),sn===null&&(t===null||si.current!==null||t.memoizedState!==null)&&(sn=e)}function So(e){k(ut,ut.current),k(Zt,e),sn===null&&(sn=e)}function od(e){e.tag===22?(k(ut,ut.current),k(Zt,e),sn===null&&(sn=e)):il()}function il(){k(ut,ut.current),k(Zt,Zt.current)}function Ft(e){H(Zt),sn===e&&(sn=null),H(ut)}var ut=w(0);function ma(e){for(var t=e;t!==null;){if(t.tag===13){var l=t.memoizedState;if(l!==null&&(l=l.dehydrated,l===null||Cc(l)||zc(l)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder==="forwards"||t.memoizedProps.revealOrder==="backwards"||t.memoizedProps.revealOrder==="unstable_legacy-backwards"||t.memoizedProps.revealOrder==="together")){if((t.flags&128)!==0)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var Ln=0,ze=null,Fe=null,ft=null,ga=!1,fi=!1,Nl=!1,ya=0,lr=0,di=null,f1=0;function rt(){throw Error(u(321))}function ko(e,t){if(t===null)return!1;for(var l=0;l<t.length&&l<e.length;l++)if(!Qt(e[l],t[l]))return!1;return!0}function Eo(e,t,l,i,o,s){return Ln=s,ze=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,D.H=e===null||e.memoizedState===null?Qd:Bo,Nl=!1,s=l(i,o),Nl=!1,fi&&(s=sd(t,l,i,o)),cd(e),s}function cd(e){D.H=ar;var t=Fe!==null&&Fe.next!==null;if(Ln=0,ft=Fe=ze=null,ga=!1,lr=0,di=null,t)throw Error(u(300));e===null||dt||(e=e.dependencies,e!==null&&ua(e)&&(dt=!0))}function sd(e,t,l,i){ze=e;var o=0;do{if(fi&&(di=null),lr=0,fi=!1,25<=o)throw Error(u(301));if(o+=1,ft=Fe=null,e.updateQueue!=null){var s=e.updateQueue;s.lastEffect=null,s.events=null,s.stores=null,s.memoCache!=null&&(s.memoCache.index=0)}D.H=Id,s=t(l,i)}while(fi);return s}function d1(){var e=D.H,t=e.useState()[0];return t=typeof t.then=="function"?ir(t):t,e=e.useState()[0],(Fe!==null?Fe.memoizedState:null)!==e&&(ze.flags|=1024),t}function Ao(){var e=ya!==0;return ya=0,e}function wo(e,t,l){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~l}function To(e){if(ga){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}ga=!1}Ln=0,ft=Fe=ze=null,fi=!1,lr=ya=0,di=null}function Mt(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return ft===null?ze.memoizedState=ft=e:ft=ft.next=e,ft}function ot(){if(Fe===null){var e=ze.alternate;e=e!==null?e.memoizedState:null}else e=Fe.next;var t=ft===null?ze.memoizedState:ft.next;if(t!==null)ft=t,Fe=e;else{if(e===null)throw ze.alternate===null?Error(u(467)):Error(u(310));Fe=e,e={memoizedState:Fe.memoizedState,baseState:Fe.baseState,baseQueue:Fe.baseQueue,queue:Fe.queue,next:null},ft===null?ze.memoizedState=ft=e:ft=ft.next=e}return ft}function va(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function ir(e){var t=lr;return lr+=1,di===null&&(di=[]),e=ed(di,e,t),t=ze,(ft===null?t.memoizedState:ft.next)===null&&(t=t.alternate,D.H=t===null||t.memoizedState===null?Qd:Bo),e}function ba(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return ir(e);if(e.$$typeof===Y)return kt(e)}throw Error(u(438,String(e)))}function Co(e){var t=null,l=ze.updateQueue;if(l!==null&&(t=l.memoCache),t==null){var i=ze.alternate;i!==null&&(i=i.updateQueue,i!==null&&(i=i.memoCache,i!=null&&(t={data:i.data.map(function(o){return o.slice()}),index:0})))}if(t==null&&(t={data:[],index:0}),l===null&&(l=va(),ze.updateQueue=l),l.memoCache=t,l=t.data[t.index],l===void 0)for(l=t.data[t.index]=Array(e),i=0;i<e;i++)l[i]=L;return t.index++,l}function Un(e,t){return typeof t=="function"?t(e):t}function xa(e){var t=ot();return zo(t,Fe,e)}function zo(e,t,l){var i=e.queue;if(i===null)throw Error(u(311));i.lastRenderedReducer=l;var o=e.baseQueue,s=i.pending;if(s!==null){if(o!==null){var y=o.next;o.next=s.next,s.next=y}t.baseQueue=o=s,i.pending=null}if(s=e.baseState,o===null)e.memoizedState=s;else{t=o.next;var b=y=null,A=null,M=t,q=!1;do{var Q=M.lane&-536870913;if(Q!==M.lane?(Le&Q)===Q:(Ln&Q)===Q){var R=M.revertLane;if(R===0)A!==null&&(A=A.next={lane:0,revertLane:0,gesture:null,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null}),Q===ai&&(q=!0);else if((Ln&R)===R){M=M.next,R===ai&&(q=!0);continue}else Q={lane:0,revertLane:M.revertLane,gesture:null,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null},A===null?(b=A=Q,y=s):A=A.next=Q,ze.lanes|=R,ul|=R;Q=M.action,Nl&&l(s,Q),s=M.hasEagerState?M.eagerState:l(s,Q)}else R={lane:Q,revertLane:M.revertLane,gesture:M.gesture,action:M.action,hasEagerState:M.hasEagerState,eagerState:M.eagerState,next:null},A===null?(b=A=R,y=s):A=A.next=R,ze.lanes|=Q,ul|=Q;M=M.next}while(M!==null&&M!==t);if(A===null?y=s:A.next=b,!Qt(s,e.memoizedState)&&(dt=!0,q&&(l=ui,l!==null)))throw l;e.memoizedState=s,e.baseState=y,e.baseQueue=A,i.lastRenderedState=s}return o===null&&(i.lanes=0),[e.memoizedState,i.dispatch]}function _o(e){var t=ot(),l=t.queue;if(l===null)throw Error(u(311));l.lastRenderedReducer=e;var i=l.dispatch,o=l.pending,s=t.memoizedState;if(o!==null){l.pending=null;var y=o=o.next;do s=e(s,y.action),y=y.next;while(y!==o);Qt(s,t.memoizedState)||(dt=!0),t.memoizedState=s,t.baseQueue===null&&(t.baseState=s),l.lastRenderedState=s}return[s,i]}function fd(e,t,l){var i=ze,o=ot(),s=je;if(s){if(l===void 0)throw Error(u(407));l=l()}else l=t();var y=!Qt((Fe||o).memoizedState,l);if(y&&(o.memoizedState=l,dt=!0),o=o.queue,Mo(pd.bind(null,i,o,e),[e]),o.getSnapshot!==t||y||ft!==null&&ft.memoizedState.tag&1){if(i.flags|=2048,hi(9,{destroy:void 0},hd.bind(null,i,o,l,t),null),$e===null)throw Error(u(349));s||(Ln&127)!==0||dd(i,t,l)}return l}function dd(e,t,l){e.flags|=16384,e={getSnapshot:t,value:l},t=ze.updateQueue,t===null?(t=va(),ze.updateQueue=t,t.stores=[e]):(l=t.stores,l===null?t.stores=[e]:l.push(e))}function hd(e,t,l,i){t.value=l,t.getSnapshot=i,md(t)&&gd(e)}function pd(e,t,l){return l(function(){md(t)&&gd(e)})}function md(e){var t=e.getSnapshot;e=e.value;try{var l=t();return!Qt(e,l)}catch{return!0}}function gd(e){var t=wl(e,2);t!==null&&Yt(t,e,2)}function Oo(e){var t=Mt();if(typeof e=="function"){var l=e;if(e=l(),Nl){Nt(!0);try{l()}finally{Nt(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Un,lastRenderedState:e},t}function yd(e,t,l,i){return e.baseState=l,zo(e,Fe,typeof i=="function"?i:Un)}function h1(e,t,l,i,o){if(Ea(e))throw Error(u(485));if(e=t.action,e!==null){var s={payload:o,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(y){s.listeners.push(y)}};D.T!==null?l(!0):s.isTransition=!1,i(s),l=t.pending,l===null?(s.next=t.pending=s,vd(t,s)):(s.next=l.next,t.pending=l.next=s)}}function vd(e,t){var l=t.action,i=t.payload,o=e.state;if(t.isTransition){var s=D.T,y={};D.T=y;try{var b=l(o,i),A=D.S;A!==null&&A(y,b),bd(e,t,b)}catch(M){Do(e,t,M)}finally{s!==null&&y.types!==null&&(s.types=y.types),D.T=s}}else try{s=l(o,i),bd(e,t,s)}catch(M){Do(e,t,M)}}function bd(e,t,l){l!==null&&typeof l=="object"&&typeof l.then=="function"?l.then(function(i){xd(e,t,i)},function(i){return Do(e,t,i)}):xd(e,t,l)}function xd(e,t,l){t.status="fulfilled",t.value=l,Sd(t),e.state=l,t=e.pending,t!==null&&(l=t.next,l===t?e.pending=null:(l=l.next,t.next=l,vd(e,l)))}function Do(e,t,l){var i=e.pending;if(e.pending=null,i!==null){i=i.next;do t.status="rejected",t.reason=l,Sd(t),t=t.next;while(t!==i)}e.action=null}function Sd(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function kd(e,t){return t}function Ed(e,t){if(je){var l=$e.formState;if(l!==null){e:{var i=ze;if(je){if(nt){t:{for(var o=nt,s=cn;o.nodeType!==8;){if(!s){o=null;break t}if(o=fn(o.nextSibling),o===null){o=null;break t}}s=o.data,o=s==="F!"||s==="F"?o:null}if(o){nt=fn(o.nextSibling),i=o.data==="F!";break e}}$n(i)}i=!1}i&&(t=l[0])}}return l=Mt(),l.memoizedState=l.baseState=t,i={pending:null,lanes:0,dispatch:null,lastRenderedReducer:kd,lastRenderedState:t},l.queue=i,l=Vd.bind(null,ze,i),i.dispatch=l,i=Oo(!1),s=jo.bind(null,ze,!1,i.queue),i=Mt(),o={state:t,dispatch:null,action:e,pending:null},i.queue=o,l=h1.bind(null,ze,o,s,l),o.dispatch=l,i.memoizedState=e,[t,l,!1]}function Ad(e){var t=ot();return wd(t,Fe,e)}function wd(e,t,l){if(t=zo(e,t,kd)[0],e=xa(Un)[0],typeof t=="object"&&t!==null&&typeof t.then=="function")try{var i=ir(t)}catch(y){throw y===oi?sa:y}else i=t;t=ot();var o=t.queue,s=o.dispatch;return l!==t.memoizedState&&(ze.flags|=2048,hi(9,{destroy:void 0},p1.bind(null,o,l),null)),[i,s,e]}function p1(e,t){e.action=t}function Td(e){var t=ot(),l=Fe;if(l!==null)return wd(t,l,e);ot(),t=t.memoizedState,l=ot();var i=l.queue.dispatch;return l.memoizedState=e,[t,i,!1]}function hi(e,t,l,i){return e={tag:e,create:l,deps:i,inst:t,next:null},t=ze.updateQueue,t===null&&(t=va(),ze.updateQueue=t),l=t.lastEffect,l===null?t.lastEffect=e.next=e:(i=l.next,l.next=e,e.next=i,t.lastEffect=e),e}function Cd(){return ot().memoizedState}function Sa(e,t,l,i){var o=Mt();ze.flags|=e,o.memoizedState=hi(1|t,{destroy:void 0},l,i===void 0?null:i)}function ka(e,t,l,i){var o=ot();i=i===void 0?null:i;var s=o.memoizedState.inst;Fe!==null&&i!==null&&ko(i,Fe.memoizedState.deps)?o.memoizedState=hi(t,s,l,i):(ze.flags|=e,o.memoizedState=hi(1|t,s,l,i))}function zd(e,t){Sa(8390656,8,e,t)}function Mo(e,t){ka(2048,8,e,t)}function m1(e){ze.flags|=4;var t=ze.updateQueue;if(t===null)t=va(),ze.updateQueue=t,t.events=[e];else{var l=t.events;l===null?t.events=[e]:l.push(e)}}function _d(e){var t=ot().memoizedState;return m1({ref:t,nextImpl:e}),function(){if((Ve&2)!==0)throw Error(u(440));return t.impl.apply(void 0,arguments)}}function Od(e,t){return ka(4,2,e,t)}function Dd(e,t){return ka(4,4,e,t)}function Md(e,t){if(typeof t=="function"){e=e();var l=t(e);return function(){typeof l=="function"?l():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Rd(e,t,l){l=l!=null?l.concat([e]):null,ka(4,4,Md.bind(null,t,e),l)}function Ro(){}function Nd(e,t){var l=ot();t=t===void 0?null:t;var i=l.memoizedState;return t!==null&&ko(t,i[1])?i[0]:(l.memoizedState=[e,t],e)}function Ld(e,t){var l=ot();t=t===void 0?null:t;var i=l.memoizedState;if(t!==null&&ko(t,i[1]))return i[0];if(i=e(),Nl){Nt(!0);try{e()}finally{Nt(!1)}}return l.memoizedState=[i,t],i}function No(e,t,l){return l===void 0||(Ln&1073741824)!==0&&(Le&261930)===0?e.memoizedState=t:(e.memoizedState=l,e=Uh(),ze.lanes|=e,ul|=e,l)}function Ud(e,t,l,i){return Qt(l,t)?l:si.current!==null?(e=No(e,l,i),Qt(e,t)||(dt=!0),e):(Ln&42)===0||(Ln&1073741824)!==0&&(Le&261930)===0?(dt=!0,e.memoizedState=l):(e=Uh(),ze.lanes|=e,ul|=e,t)}function jd(e,t,l,i,o){var s=K.p;K.p=s!==0&&8>s?s:8;var y=D.T,b={};D.T=b,jo(e,!1,t,l);try{var A=o(),M=D.S;if(M!==null&&M(b,A),A!==null&&typeof A=="object"&&typeof A.then=="function"){var q=s1(A,i);rr(e,t,q,Wt(e))}else rr(e,t,i,Wt(e))}catch(Q){rr(e,t,{then:function(){},status:"rejected",reason:Q},Wt())}finally{K.p=s,y!==null&&b.types!==null&&(y.types=b.types),D.T=y}}function g1(){}function Lo(e,t,l,i){if(e.tag!==5)throw Error(u(476));var o=Bd(e).queue;jd(e,o,t,ce,l===null?g1:function(){return Hd(e),l(i)})}function Bd(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:ce,baseState:ce,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Un,lastRenderedState:ce},next:null};var l={};return t.next={memoizedState:l,baseState:l,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:Un,lastRenderedState:l},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function Hd(e){var t=Bd(e);t.next===null&&(t=e.alternate.memoizedState),rr(e,t.next.queue,{},Wt())}function Uo(){return kt(kr)}function qd(){return ot().memoizedState}function Yd(){return ot().memoizedState}function y1(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var l=Wt();e=tl(l);var i=nl(t,e,l);i!==null&&(Yt(i,t,l),er(i,t,l)),t={cache:so()},e.payload=t;return}t=t.return}}function v1(e,t,l){var i=Wt();l={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null},Ea(e)?Gd(t,l):(l=Pu(e,t,l,i),l!==null&&(Yt(l,e,i),Xd(l,t,i)))}function Vd(e,t,l){var i=Wt();rr(e,t,l,i)}function rr(e,t,l,i){var o={lane:i,revertLane:0,gesture:null,action:l,hasEagerState:!1,eagerState:null,next:null};if(Ea(e))Gd(t,o);else{var s=e.alternate;if(e.lanes===0&&(s===null||s.lanes===0)&&(s=t.lastRenderedReducer,s!==null))try{var y=t.lastRenderedState,b=s(y,l);if(o.hasEagerState=!0,o.eagerState=b,Qt(b,y))return la(e,t,o,0),$e===null&&na(),!1}catch{}finally{}if(l=Pu(e,t,o,i),l!==null)return Yt(l,e,i),Xd(l,t,i),!0}return!1}function jo(e,t,l,i){if(i={lane:2,revertLane:mc(),gesture:null,action:i,hasEagerState:!1,eagerState:null,next:null},Ea(e)){if(t)throw Error(u(479))}else t=Pu(e,l,i,2),t!==null&&Yt(t,e,2)}function Ea(e){var t=e.alternate;return e===ze||t!==null&&t===ze}function Gd(e,t){fi=ga=!0;var l=e.pending;l===null?t.next=t:(t.next=l.next,l.next=t),e.pending=t}function Xd(e,t,l){if((l&4194048)!==0){var i=t.lanes;i&=e.pendingLanes,l|=i,t.lanes=l,Fs(e,l)}}var ar={readContext:kt,use:ba,useCallback:rt,useContext:rt,useEffect:rt,useImperativeHandle:rt,useLayoutEffect:rt,useInsertionEffect:rt,useMemo:rt,useReducer:rt,useRef:rt,useState:rt,useDebugValue:rt,useDeferredValue:rt,useTransition:rt,useSyncExternalStore:rt,useId:rt,useHostTransitionStatus:rt,useFormState:rt,useActionState:rt,useOptimistic:rt,useMemoCache:rt,useCacheRefresh:rt};ar.useEffectEvent=rt;var Qd={readContext:kt,use:ba,useCallback:function(e,t){return Mt().memoizedState=[e,t===void 0?null:t],e},useContext:kt,useEffect:zd,useImperativeHandle:function(e,t,l){l=l!=null?l.concat([e]):null,Sa(4194308,4,Md.bind(null,t,e),l)},useLayoutEffect:function(e,t){return Sa(4194308,4,e,t)},useInsertionEffect:function(e,t){Sa(4,2,e,t)},useMemo:function(e,t){var l=Mt();t=t===void 0?null:t;var i=e();if(Nl){Nt(!0);try{e()}finally{Nt(!1)}}return l.memoizedState=[i,t],i},useReducer:function(e,t,l){var i=Mt();if(l!==void 0){var o=l(t);if(Nl){Nt(!0);try{l(t)}finally{Nt(!1)}}}else o=t;return i.memoizedState=i.baseState=o,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:o},i.queue=e,e=e.dispatch=v1.bind(null,ze,e),[i.memoizedState,e]},useRef:function(e){var t=Mt();return e={current:e},t.memoizedState=e},useState:function(e){e=Oo(e);var t=e.queue,l=Vd.bind(null,ze,t);return t.dispatch=l,[e.memoizedState,l]},useDebugValue:Ro,useDeferredValue:function(e,t){var l=Mt();return No(l,e,t)},useTransition:function(){var e=Oo(!1);return e=jd.bind(null,ze,e.queue,!0,!1),Mt().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,l){var i=ze,o=Mt();if(je){if(l===void 0)throw Error(u(407));l=l()}else{if(l=t(),$e===null)throw Error(u(349));(Le&127)!==0||dd(i,t,l)}o.memoizedState=l;var s={value:l,getSnapshot:t};return o.queue=s,zd(pd.bind(null,i,s,e),[e]),i.flags|=2048,hi(9,{destroy:void 0},hd.bind(null,i,s,l,t),null),l},useId:function(){var e=Mt(),t=$e.identifierPrefix;if(je){var l=Sn,i=xn;l=(i&~(1<<32-We(i)-1)).toString(32)+l,t="_"+t+"R_"+l,l=ya++,0<l&&(t+="H"+l.toString(32)),t+="_"}else l=f1++,t="_"+t+"r_"+l.toString(32)+"_";return e.memoizedState=t},useHostTransitionStatus:Uo,useFormState:Ed,useActionState:Ed,useOptimistic:function(e){var t=Mt();t.memoizedState=t.baseState=e;var l={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=l,t=jo.bind(null,ze,!0,l),l.dispatch=t,[e,t]},useMemoCache:Co,useCacheRefresh:function(){return Mt().memoizedState=y1.bind(null,ze)},useEffectEvent:function(e){var t=Mt(),l={impl:e};return t.memoizedState=l,function(){if((Ve&2)!==0)throw Error(u(440));return l.impl.apply(void 0,arguments)}}},Bo={readContext:kt,use:ba,useCallback:Nd,useContext:kt,useEffect:Mo,useImperativeHandle:Rd,useInsertionEffect:Od,useLayoutEffect:Dd,useMemo:Ld,useReducer:xa,useRef:Cd,useState:function(){return xa(Un)},useDebugValue:Ro,useDeferredValue:function(e,t){var l=ot();return Ud(l,Fe.memoizedState,e,t)},useTransition:function(){var e=xa(Un)[0],t=ot().memoizedState;return[typeof e=="boolean"?e:ir(e),t]},useSyncExternalStore:fd,useId:qd,useHostTransitionStatus:Uo,useFormState:Ad,useActionState:Ad,useOptimistic:function(e,t){var l=ot();return yd(l,Fe,e,t)},useMemoCache:Co,useCacheRefresh:Yd};Bo.useEffectEvent=_d;var Id={readContext:kt,use:ba,useCallback:Nd,useContext:kt,useEffect:Mo,useImperativeHandle:Rd,useInsertionEffect:Od,useLayoutEffect:Dd,useMemo:Ld,useReducer:_o,useRef:Cd,useState:function(){return _o(Un)},useDebugValue:Ro,useDeferredValue:function(e,t){var l=ot();return Fe===null?No(l,e,t):Ud(l,Fe.memoizedState,e,t)},useTransition:function(){var e=_o(Un)[0],t=ot().memoizedState;return[typeof e=="boolean"?e:ir(e),t]},useSyncExternalStore:fd,useId:qd,useHostTransitionStatus:Uo,useFormState:Td,useActionState:Td,useOptimistic:function(e,t){var l=ot();return Fe!==null?yd(l,Fe,e,t):(l.baseState=e,[e,l.queue.dispatch])},useMemoCache:Co,useCacheRefresh:Yd};Id.useEffectEvent=_d;function Ho(e,t,l,i){t=e.memoizedState,l=l(i,t),l=l==null?t:g({},t,l),e.memoizedState=l,e.lanes===0&&(e.updateQueue.baseState=l)}var qo={enqueueSetState:function(e,t,l){e=e._reactInternals;var i=Wt(),o=tl(i);o.payload=t,l!=null&&(o.callback=l),t=nl(e,o,i),t!==null&&(Yt(t,e,i),er(t,e,i))},enqueueReplaceState:function(e,t,l){e=e._reactInternals;var i=Wt(),o=tl(i);o.tag=1,o.payload=t,l!=null&&(o.callback=l),t=nl(e,o,i),t!==null&&(Yt(t,e,i),er(t,e,i))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var l=Wt(),i=tl(l);i.tag=2,t!=null&&(i.callback=t),t=nl(e,i,l),t!==null&&(Yt(t,e,l),er(t,e,l))}};function Zd(e,t,l,i,o,s,y){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(i,s,y):t.prototype&&t.prototype.isPureReactComponent?!Ii(l,i)||!Ii(o,s):!0}function Fd(e,t,l,i){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(l,i),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(l,i),t.state!==e&&qo.enqueueReplaceState(t,t.state,null)}function Ll(e,t){var l=t;if("ref"in t){l={};for(var i in t)i!=="ref"&&(l[i]=t[i])}if(e=e.defaultProps){l===t&&(l=g({},l));for(var o in e)l[o]===void 0&&(l[o]=e[o])}return l}function Kd(e){ta(e)}function Jd(e){console.error(e)}function Wd(e){ta(e)}function Aa(e,t){try{var l=e.onUncaughtError;l(t.value,{componentStack:t.stack})}catch(i){setTimeout(function(){throw i})}}function $d(e,t,l){try{var i=e.onCaughtError;i(l.value,{componentStack:l.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(o){setTimeout(function(){throw o})}}function Yo(e,t,l){return l=tl(l),l.tag=3,l.payload={element:null},l.callback=function(){Aa(e,t)},l}function Pd(e){return e=tl(e),e.tag=3,e}function eh(e,t,l,i){var o=l.type.getDerivedStateFromError;if(typeof o=="function"){var s=i.value;e.payload=function(){return o(s)},e.callback=function(){$d(t,l,i)}}var y=l.stateNode;y!==null&&typeof y.componentDidCatch=="function"&&(e.callback=function(){$d(t,l,i),typeof o!="function"&&(ol===null?ol=new Set([this]):ol.add(this));var b=i.stack;this.componentDidCatch(i.value,{componentStack:b!==null?b:""})})}function b1(e,t,l,i,o){if(l.flags|=32768,i!==null&&typeof i=="object"&&typeof i.then=="function"){if(t=l.alternate,t!==null&&ri(t,l,o,!0),l=Zt.current,l!==null){switch(l.tag){case 31:case 13:return sn===null?Ua():l.alternate===null&&at===0&&(at=3),l.flags&=-257,l.flags|=65536,l.lanes=o,i===fa?l.flags|=16384:(t=l.updateQueue,t===null?l.updateQueue=new Set([i]):t.add(i),dc(e,i,o)),!1;case 22:return l.flags|=65536,i===fa?l.flags|=16384:(t=l.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([i])},l.updateQueue=t):(l=t.retryQueue,l===null?t.retryQueue=new Set([i]):l.add(i)),dc(e,i,o)),!1}throw Error(u(435,l.tag))}return dc(e,i,o),Ua(),!1}if(je)return t=Zt.current,t!==null?((t.flags&65536)===0&&(t.flags|=256),t.flags|=65536,t.lanes=o,i!==ro&&(e=Error(u(422),{cause:i}),Ki(an(e,l)))):(i!==ro&&(t=Error(u(423),{cause:i}),Ki(an(t,l))),e=e.current.alternate,e.flags|=65536,o&=-o,e.lanes|=o,i=an(i,l),o=Yo(e.stateNode,i,o),yo(e,o),at!==4&&(at=2)),!1;var s=Error(u(520),{cause:i});if(s=an(s,l),pr===null?pr=[s]:pr.push(s),at!==4&&(at=2),t===null)return!0;i=an(i,l),l=t;do{switch(l.tag){case 3:return l.flags|=65536,e=o&-o,l.lanes|=e,e=Yo(l.stateNode,i,e),yo(l,e),!1;case 1:if(t=l.type,s=l.stateNode,(l.flags&128)===0&&(typeof t.getDerivedStateFromError=="function"||s!==null&&typeof s.componentDidCatch=="function"&&(ol===null||!ol.has(s))))return l.flags|=65536,o&=-o,l.lanes|=o,o=Pd(o),eh(o,e,l,i),yo(l,o),!1}l=l.return}while(l!==null);return!1}var Vo=Error(u(461)),dt=!1;function Et(e,t,l,i){t.child=e===null?id(t,null,l,i):Rl(t,e.child,l,i)}function th(e,t,l,i,o){l=l.render;var s=t.ref;if("ref"in i){var y={};for(var b in i)b!=="ref"&&(y[b]=i[b])}else y=i;return _l(t),i=Eo(e,t,l,y,s,o),b=Ao(),e!==null&&!dt?(wo(e,t,o),jn(e,t,o)):(je&&b&&lo(t),t.flags|=1,Et(e,t,i,o),t.child)}function nh(e,t,l,i,o){if(e===null){var s=l.type;return typeof s=="function"&&!eo(s)&&s.defaultProps===void 0&&l.compare===null?(t.tag=15,t.type=s,lh(e,t,s,i,o)):(e=ra(l.type,null,i,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(s=e.child,!Jo(e,o)){var y=s.memoizedProps;if(l=l.compare,l=l!==null?l:Ii,l(y,i)&&e.ref===t.ref)return jn(e,t,o)}return t.flags|=1,e=Dn(s,i),e.ref=t.ref,e.return=t,t.child=e}function lh(e,t,l,i,o){if(e!==null){var s=e.memoizedProps;if(Ii(s,i)&&e.ref===t.ref)if(dt=!1,t.pendingProps=i=s,Jo(e,o))(e.flags&131072)!==0&&(dt=!0);else return t.lanes=e.lanes,jn(e,t,o)}return Go(e,t,l,i,o)}function ih(e,t,l,i){var o=i.children,s=e!==null?e.memoizedState:null;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),i.mode==="hidden"){if((t.flags&128)!==0){if(s=s!==null?s.baseLanes|l:l,e!==null){for(i=t.child=e.child,o=0;i!==null;)o=o|i.lanes|i.childLanes,i=i.sibling;i=o&~s}else i=0,t.child=null;return rh(e,t,s,l,i)}if((l&536870912)!==0)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&ca(t,s!==null?s.cachePool:null),s!==null?ud(t,s):bo(),od(t);else return i=t.lanes=536870912,rh(e,t,s!==null?s.baseLanes|l:l,l,i)}else s!==null?(ca(t,s.cachePool),ud(t,s),il(),t.memoizedState=null):(e!==null&&ca(t,null),bo(),il());return Et(e,t,o,l),t.child}function ur(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function rh(e,t,l,i,o){var s=ho();return s=s===null?null:{parent:st._currentValue,pool:s},t.memoizedState={baseLanes:l,cachePool:s},e!==null&&ca(t,null),bo(),od(t),e!==null&&ri(e,t,i,!0),t.childLanes=o,null}function wa(e,t){return t=Ca({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function ah(e,t,l){return Rl(t,e.child,null,l),e=wa(t,t.pendingProps),e.flags|=2,Ft(t),t.memoizedState=null,e}function x1(e,t,l){var i=t.pendingProps,o=(t.flags&128)!==0;if(t.flags&=-129,e===null){if(je){if(i.mode==="hidden")return e=wa(t,i),t.lanes=536870912,ur(null,e);if(So(t),(e=nt)?(e=vp(e,cn),e=e!==null&&e.data==="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Jn!==null?{id:xn,overflow:Sn}:null,retryLane:536870912,hydrationErrors:null},l=Gf(e),l.return=t,t.child=l,St=t,nt=null)):e=null,e===null)throw $n(t);return t.lanes=536870912,null}return wa(t,i)}var s=e.memoizedState;if(s!==null){var y=s.dehydrated;if(So(t),o)if(t.flags&256)t.flags&=-257,t=ah(e,t,l);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(u(558));else if(dt||ri(e,t,l,!1),o=(l&e.childLanes)!==0,dt||o){if(i=$e,i!==null&&(y=Ks(i,l),y!==0&&y!==s.retryLane))throw s.retryLane=y,wl(e,y),Yt(i,e,y),Vo;Ua(),t=ah(e,t,l)}else e=s.treeContext,nt=fn(y.nextSibling),St=t,je=!0,Wn=null,cn=!1,e!==null&&If(t,e),t=wa(t,i),t.flags|=4096;return t}return e=Dn(e.child,{mode:i.mode,children:i.children}),e.ref=t.ref,t.child=e,e.return=t,e}function Ta(e,t){var l=t.ref;if(l===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof l!="function"&&typeof l!="object")throw Error(u(284));(e===null||e.ref!==l)&&(t.flags|=4194816)}}function Go(e,t,l,i,o){return _l(t),l=Eo(e,t,l,i,void 0,o),i=Ao(),e!==null&&!dt?(wo(e,t,o),jn(e,t,o)):(je&&i&&lo(t),t.flags|=1,Et(e,t,l,o),t.child)}function uh(e,t,l,i,o,s){return _l(t),t.updateQueue=null,l=sd(t,i,l,o),cd(e),i=Ao(),e!==null&&!dt?(wo(e,t,s),jn(e,t,s)):(je&&i&&lo(t),t.flags|=1,Et(e,t,l,s),t.child)}function oh(e,t,l,i,o){if(_l(t),t.stateNode===null){var s=ti,y=l.contextType;typeof y=="object"&&y!==null&&(s=kt(y)),s=new l(i,s),t.memoizedState=s.state!==null&&s.state!==void 0?s.state:null,s.updater=qo,t.stateNode=s,s._reactInternals=t,s=t.stateNode,s.props=i,s.state=t.memoizedState,s.refs={},mo(t),y=l.contextType,s.context=typeof y=="object"&&y!==null?kt(y):ti,s.state=t.memoizedState,y=l.getDerivedStateFromProps,typeof y=="function"&&(Ho(t,l,y,i),s.state=t.memoizedState),typeof l.getDerivedStateFromProps=="function"||typeof s.getSnapshotBeforeUpdate=="function"||typeof s.UNSAFE_componentWillMount!="function"&&typeof s.componentWillMount!="function"||(y=s.state,typeof s.componentWillMount=="function"&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount=="function"&&s.UNSAFE_componentWillMount(),y!==s.state&&qo.enqueueReplaceState(s,s.state,null),nr(t,i,s,o),tr(),s.state=t.memoizedState),typeof s.componentDidMount=="function"&&(t.flags|=4194308),i=!0}else if(e===null){s=t.stateNode;var b=t.memoizedProps,A=Ll(l,b);s.props=A;var M=s.context,q=l.contextType;y=ti,typeof q=="object"&&q!==null&&(y=kt(q));var Q=l.getDerivedStateFromProps;q=typeof Q=="function"||typeof s.getSnapshotBeforeUpdate=="function",b=t.pendingProps!==b,q||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(b||M!==y)&&Fd(t,s,i,y),el=!1;var R=t.memoizedState;s.state=R,nr(t,i,s,o),tr(),M=t.memoizedState,b||R!==M||el?(typeof Q=="function"&&(Ho(t,l,Q,i),M=t.memoizedState),(A=el||Zd(t,l,A,i,R,M,y))?(q||typeof s.UNSAFE_componentWillMount!="function"&&typeof s.componentWillMount!="function"||(typeof s.componentWillMount=="function"&&s.componentWillMount(),typeof s.UNSAFE_componentWillMount=="function"&&s.UNSAFE_componentWillMount()),typeof s.componentDidMount=="function"&&(t.flags|=4194308)):(typeof s.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=i,t.memoizedState=M),s.props=i,s.state=M,s.context=y,i=A):(typeof s.componentDidMount=="function"&&(t.flags|=4194308),i=!1)}else{s=t.stateNode,go(e,t),y=t.memoizedProps,q=Ll(l,y),s.props=q,Q=t.pendingProps,R=s.context,M=l.contextType,A=ti,typeof M=="object"&&M!==null&&(A=kt(M)),b=l.getDerivedStateFromProps,(M=typeof b=="function"||typeof s.getSnapshotBeforeUpdate=="function")||typeof s.UNSAFE_componentWillReceiveProps!="function"&&typeof s.componentWillReceiveProps!="function"||(y!==Q||R!==A)&&Fd(t,s,i,A),el=!1,R=t.memoizedState,s.state=R,nr(t,i,s,o),tr();var U=t.memoizedState;y!==Q||R!==U||el||e!==null&&e.dependencies!==null&&ua(e.dependencies)?(typeof b=="function"&&(Ho(t,l,b,i),U=t.memoizedState),(q=el||Zd(t,l,q,i,R,U,A)||e!==null&&e.dependencies!==null&&ua(e.dependencies))?(M||typeof s.UNSAFE_componentWillUpdate!="function"&&typeof s.componentWillUpdate!="function"||(typeof s.componentWillUpdate=="function"&&s.componentWillUpdate(i,U,A),typeof s.UNSAFE_componentWillUpdate=="function"&&s.UNSAFE_componentWillUpdate(i,U,A)),typeof s.componentDidUpdate=="function"&&(t.flags|=4),typeof s.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof s.componentDidUpdate!="function"||y===e.memoizedProps&&R===e.memoizedState||(t.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&R===e.memoizedState||(t.flags|=1024),t.memoizedProps=i,t.memoizedState=U),s.props=i,s.state=U,s.context=A,i=q):(typeof s.componentDidUpdate!="function"||y===e.memoizedProps&&R===e.memoizedState||(t.flags|=4),typeof s.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&R===e.memoizedState||(t.flags|=1024),i=!1)}return s=i,Ta(e,t),i=(t.flags&128)!==0,s||i?(s=t.stateNode,l=i&&typeof l.getDerivedStateFromError!="function"?null:s.render(),t.flags|=1,e!==null&&i?(t.child=Rl(t,e.child,null,o),t.child=Rl(t,null,l,o)):Et(e,t,l,o),t.memoizedState=s.state,e=t.child):e=jn(e,t,o),e}function ch(e,t,l,i){return Cl(),t.flags|=256,Et(e,t,l,i),t.child}var Xo={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Qo(e){return{baseLanes:e,cachePool:$f()}}function Io(e,t,l){return e=e!==null?e.childLanes&~l:0,t&&(e|=Jt),e}function sh(e,t,l){var i=t.pendingProps,o=!1,s=(t.flags&128)!==0,y;if((y=s)||(y=e!==null&&e.memoizedState===null?!1:(ut.current&2)!==0),y&&(o=!0,t.flags&=-129),y=(t.flags&32)!==0,t.flags&=-33,e===null){if(je){if(o?ll(t):il(),(e=nt)?(e=vp(e,cn),e=e!==null&&e.data!=="&"?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Jn!==null?{id:xn,overflow:Sn}:null,retryLane:536870912,hydrationErrors:null},l=Gf(e),l.return=t,t.child=l,St=t,nt=null)):e=null,e===null)throw $n(t);return zc(e)?t.lanes=32:t.lanes=536870912,null}var b=i.children;return i=i.fallback,o?(il(),o=t.mode,b=Ca({mode:"hidden",children:b},o),i=Tl(i,o,l,null),b.return=t,i.return=t,b.sibling=i,t.child=b,i=t.child,i.memoizedState=Qo(l),i.childLanes=Io(e,y,l),t.memoizedState=Xo,ur(null,i)):(ll(t),Zo(t,b))}var A=e.memoizedState;if(A!==null&&(b=A.dehydrated,b!==null)){if(s)t.flags&256?(ll(t),t.flags&=-257,t=Fo(e,t,l)):t.memoizedState!==null?(il(),t.child=e.child,t.flags|=128,t=null):(il(),b=i.fallback,o=t.mode,i=Ca({mode:"visible",children:i.children},o),b=Tl(b,o,l,null),b.flags|=2,i.return=t,b.return=t,i.sibling=b,t.child=i,Rl(t,e.child,null,l),i=t.child,i.memoizedState=Qo(l),i.childLanes=Io(e,y,l),t.memoizedState=Xo,t=ur(null,i));else if(ll(t),zc(b)){if(y=b.nextSibling&&b.nextSibling.dataset,y)var M=y.dgst;y=M,i=Error(u(419)),i.stack="",i.digest=y,Ki({value:i,source:null,stack:null}),t=Fo(e,t,l)}else if(dt||ri(e,t,l,!1),y=(l&e.childLanes)!==0,dt||y){if(y=$e,y!==null&&(i=Ks(y,l),i!==0&&i!==A.retryLane))throw A.retryLane=i,wl(e,i),Yt(y,e,i),Vo;Cc(b)||Ua(),t=Fo(e,t,l)}else Cc(b)?(t.flags|=192,t.child=e.child,t=null):(e=A.treeContext,nt=fn(b.nextSibling),St=t,je=!0,Wn=null,cn=!1,e!==null&&If(t,e),t=Zo(t,i.children),t.flags|=4096);return t}return o?(il(),b=i.fallback,o=t.mode,A=e.child,M=A.sibling,i=Dn(A,{mode:"hidden",children:i.children}),i.subtreeFlags=A.subtreeFlags&65011712,M!==null?b=Dn(M,b):(b=Tl(b,o,l,null),b.flags|=2),b.return=t,i.return=t,i.sibling=b,t.child=i,ur(null,i),i=t.child,b=e.child.memoizedState,b===null?b=Qo(l):(o=b.cachePool,o!==null?(A=st._currentValue,o=o.parent!==A?{parent:A,pool:A}:o):o=$f(),b={baseLanes:b.baseLanes|l,cachePool:o}),i.memoizedState=b,i.childLanes=Io(e,y,l),t.memoizedState=Xo,ur(e.child,i)):(ll(t),l=e.child,e=l.sibling,l=Dn(l,{mode:"visible",children:i.children}),l.return=t,l.sibling=null,e!==null&&(y=t.deletions,y===null?(t.deletions=[e],t.flags|=16):y.push(e)),t.child=l,t.memoizedState=null,l)}function Zo(e,t){return t=Ca({mode:"visible",children:t},e.mode),t.return=e,e.child=t}function Ca(e,t){return e=It(22,e,null,t),e.lanes=0,e}function Fo(e,t,l){return Rl(t,e.child,null,l),e=Zo(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function fh(e,t,l){e.lanes|=t;var i=e.alternate;i!==null&&(i.lanes|=t),oo(e.return,t,l)}function Ko(e,t,l,i,o,s){var y=e.memoizedState;y===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:i,tail:l,tailMode:o,treeForkCount:s}:(y.isBackwards=t,y.rendering=null,y.renderingStartTime=0,y.last=i,y.tail=l,y.tailMode=o,y.treeForkCount=s)}function dh(e,t,l){var i=t.pendingProps,o=i.revealOrder,s=i.tail;i=i.children;var y=ut.current,b=(y&2)!==0;if(b?(y=y&1|2,t.flags|=128):y&=1,k(ut,y),Et(e,t,i,l),i=je?Fi:0,!b&&e!==null&&(e.flags&128)!==0)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&fh(e,l,t);else if(e.tag===19)fh(e,l,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(o){case"forwards":for(l=t.child,o=null;l!==null;)e=l.alternate,e!==null&&ma(e)===null&&(o=l),l=l.sibling;l=o,l===null?(o=t.child,t.child=null):(o=l.sibling,l.sibling=null),Ko(t,!1,o,l,s,i);break;case"backwards":case"unstable_legacy-backwards":for(l=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&ma(e)===null){t.child=o;break}e=o.sibling,o.sibling=l,l=o,o=e}Ko(t,!0,l,null,s,i);break;case"together":Ko(t,!1,null,null,void 0,i);break;default:t.memoizedState=null}return t.child}function jn(e,t,l){if(e!==null&&(t.dependencies=e.dependencies),ul|=t.lanes,(l&t.childLanes)===0)if(e!==null){if(ri(e,t,l,!1),(l&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(u(153));if(t.child!==null){for(e=t.child,l=Dn(e,e.pendingProps),t.child=l,l.return=t;e.sibling!==null;)e=e.sibling,l=l.sibling=Dn(e,e.pendingProps),l.return=t;l.sibling=null}return t.child}function Jo(e,t){return(e.lanes&t)!==0?!0:(e=e.dependencies,!!(e!==null&&ua(e)))}function S1(e,t,l){switch(t.tag){case 3:Qe(t,t.stateNode.containerInfo),Pn(t,st,e.memoizedState.cache),Cl();break;case 27:case 5:Z(t);break;case 4:Qe(t,t.stateNode.containerInfo);break;case 10:Pn(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,So(t),null;break;case 13:var i=t.memoizedState;if(i!==null)return i.dehydrated!==null?(ll(t),t.flags|=128,null):(l&t.child.childLanes)!==0?sh(e,t,l):(ll(t),e=jn(e,t,l),e!==null?e.sibling:null);ll(t);break;case 19:var o=(e.flags&128)!==0;if(i=(l&t.childLanes)!==0,i||(ri(e,t,l,!1),i=(l&t.childLanes)!==0),o){if(i)return dh(e,t,l);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),k(ut,ut.current),i)break;return null;case 22:return t.lanes=0,ih(e,t,l,t.pendingProps);case 24:Pn(t,st,e.memoizedState.cache)}return jn(e,t,l)}function hh(e,t,l){if(e!==null)if(e.memoizedProps!==t.pendingProps)dt=!0;else{if(!Jo(e,l)&&(t.flags&128)===0)return dt=!1,S1(e,t,l);dt=(e.flags&131072)!==0}else dt=!1,je&&(t.flags&1048576)!==0&&Qf(t,Fi,t.index);switch(t.lanes=0,t.tag){case 16:e:{var i=t.pendingProps;if(e=Dl(t.elementType),t.type=e,typeof e=="function")eo(e)?(i=Ll(e,i),t.tag=1,t=oh(null,t,e,i,l)):(t.tag=0,t=Go(null,t,e,i,l));else{if(e!=null){var o=e.$$typeof;if(o===le){t.tag=11,t=th(null,t,e,i,l);break e}else if(o===$){t.tag=14,t=nh(null,t,e,i,l);break e}}throw t=re(e)||e,Error(u(306,t,""))}}return t;case 0:return Go(e,t,t.type,t.pendingProps,l);case 1:return i=t.type,o=Ll(i,t.pendingProps),oh(e,t,i,o,l);case 3:e:{if(Qe(t,t.stateNode.containerInfo),e===null)throw Error(u(387));i=t.pendingProps;var s=t.memoizedState;o=s.element,go(e,t),nr(t,i,null,l);var y=t.memoizedState;if(i=y.cache,Pn(t,st,i),i!==s.cache&&co(t,[st],l,!0),tr(),i=y.element,s.isDehydrated)if(s={element:i,isDehydrated:!1,cache:y.cache},t.updateQueue.baseState=s,t.memoizedState=s,t.flags&256){t=ch(e,t,i,l);break e}else if(i!==o){o=an(Error(u(424)),t),Ki(o),t=ch(e,t,i,l);break e}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(nt=fn(e.firstChild),St=t,je=!0,Wn=null,cn=!0,l=id(t,null,i,l),t.child=l;l;)l.flags=l.flags&-3|4096,l=l.sibling}else{if(Cl(),i===o){t=jn(e,t,l);break e}Et(e,t,i,l)}t=t.child}return t;case 26:return Ta(e,t),e===null?(l=Ap(t.type,null,t.pendingProps,null))?t.memoizedState=l:je||(l=t.type,e=t.pendingProps,i=Ga(fe.current).createElement(l),i[xt]=t,i[Lt]=e,At(i,l,e),yt(i),t.stateNode=i):t.memoizedState=Ap(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return Z(t),e===null&&je&&(i=t.stateNode=Sp(t.type,t.pendingProps,fe.current),St=t,cn=!0,o=nt,dl(t.type)?(_c=o,nt=fn(i.firstChild)):nt=o),Et(e,t,t.pendingProps.children,l),Ta(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&je&&((o=i=nt)&&(i=W1(i,t.type,t.pendingProps,cn),i!==null?(t.stateNode=i,St=t,nt=fn(i.firstChild),cn=!1,o=!0):o=!1),o||$n(t)),Z(t),o=t.type,s=t.pendingProps,y=e!==null?e.memoizedProps:null,i=s.children,Ac(o,s)?i=null:y!==null&&Ac(o,y)&&(t.flags|=32),t.memoizedState!==null&&(o=Eo(e,t,d1,null,null,l),kr._currentValue=o),Ta(e,t),Et(e,t,i,l),t.child;case 6:return e===null&&je&&((e=l=nt)&&(l=$1(l,t.pendingProps,cn),l!==null?(t.stateNode=l,St=t,nt=null,e=!0):e=!1),e||$n(t)),null;case 13:return sh(e,t,l);case 4:return Qe(t,t.stateNode.containerInfo),i=t.pendingProps,e===null?t.child=Rl(t,null,i,l):Et(e,t,i,l),t.child;case 11:return th(e,t,t.type,t.pendingProps,l);case 7:return Et(e,t,t.pendingProps,l),t.child;case 8:return Et(e,t,t.pendingProps.children,l),t.child;case 12:return Et(e,t,t.pendingProps.children,l),t.child;case 10:return i=t.pendingProps,Pn(t,t.type,i.value),Et(e,t,i.children,l),t.child;case 9:return o=t.type._context,i=t.pendingProps.children,_l(t),o=kt(o),i=i(o),t.flags|=1,Et(e,t,i,l),t.child;case 14:return nh(e,t,t.type,t.pendingProps,l);case 15:return lh(e,t,t.type,t.pendingProps,l);case 19:return dh(e,t,l);case 31:return x1(e,t,l);case 22:return ih(e,t,l,t.pendingProps);case 24:return _l(t),i=kt(st),e===null?(o=ho(),o===null&&(o=$e,s=so(),o.pooledCache=s,s.refCount++,s!==null&&(o.pooledCacheLanes|=l),o=s),t.memoizedState={parent:i,cache:o},mo(t),Pn(t,st,o)):((e.lanes&l)!==0&&(go(e,t),nr(t,null,null,l),tr()),o=e.memoizedState,s=t.memoizedState,o.parent!==i?(o={parent:i,cache:i},t.memoizedState=o,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=o),Pn(t,st,i)):(i=s.cache,Pn(t,st,i),i!==o.cache&&co(t,[st],l,!0))),Et(e,t,t.pendingProps.children,l),t.child;case 29:throw t.pendingProps}throw Error(u(156,t.tag))}function Bn(e){e.flags|=4}function Wo(e,t,l,i,o){if((t=(e.mode&32)!==0)&&(t=!1),t){if(e.flags|=16777216,(o&335544128)===o)if(e.stateNode.complete)e.flags|=8192;else if(qh())e.flags|=8192;else throw Ml=fa,po}else e.flags&=-16777217}function ph(e,t){if(t.type!=="stylesheet"||(t.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!_p(t))if(qh())e.flags|=8192;else throw Ml=fa,po}function za(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag!==22?Is():536870912,e.lanes|=t,yi|=t)}function or(e,t){if(!je)switch(e.tailMode){case"hidden":t=e.tail;for(var l=null;t!==null;)t.alternate!==null&&(l=t),t=t.sibling;l===null?e.tail=null:l.sibling=null;break;case"collapsed":l=e.tail;for(var i=null;l!==null;)l.alternate!==null&&(i=l),l=l.sibling;i===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:i.sibling=null}}function lt(e){var t=e.alternate!==null&&e.alternate.child===e.child,l=0,i=0;if(t)for(var o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags&65011712,i|=o.flags&65011712,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)l|=o.lanes|o.childLanes,i|=o.subtreeFlags,i|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=i,e.childLanes=l,t}function k1(e,t,l){var i=t.pendingProps;switch(io(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return lt(t),null;case 1:return lt(t),null;case 3:return l=t.stateNode,i=null,e!==null&&(i=e.memoizedState.cache),t.memoizedState.cache!==i&&(t.flags|=2048),Nn(st),X(),l.pendingContext&&(l.context=l.pendingContext,l.pendingContext=null),(e===null||e.child===null)&&(ii(t)?Bn(t):e===null||e.memoizedState.isDehydrated&&(t.flags&256)===0||(t.flags|=1024,ao())),lt(t),null;case 26:var o=t.type,s=t.memoizedState;return e===null?(Bn(t),s!==null?(lt(t),ph(t,s)):(lt(t),Wo(t,o,null,i,l))):s?s!==e.memoizedState?(Bn(t),lt(t),ph(t,s)):(lt(t),t.flags&=-16777217):(e=e.memoizedProps,e!==i&&Bn(t),lt(t),Wo(t,o,e,i,l)),null;case 27:if(ne(t),l=fe.current,o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Bn(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return lt(t),null}e=te.current,ii(t)?Zf(t):(e=Sp(o,i,l),t.stateNode=e,Bn(t))}return lt(t),null;case 5:if(ne(t),o=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==i&&Bn(t);else{if(!i){if(t.stateNode===null)throw Error(u(166));return lt(t),null}if(s=te.current,ii(t))Zf(t);else{var y=Ga(fe.current);switch(s){case 1:s=y.createElementNS("http://www.w3.org/2000/svg",o);break;case 2:s=y.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;default:switch(o){case"svg":s=y.createElementNS("http://www.w3.org/2000/svg",o);break;case"math":s=y.createElementNS("http://www.w3.org/1998/Math/MathML",o);break;case"script":s=y.createElement("div"),s.innerHTML="<script><\\/script>",s=s.removeChild(s.firstChild);break;case"select":s=typeof i.is=="string"?y.createElement("select",{is:i.is}):y.createElement("select"),i.multiple?s.multiple=!0:i.size&&(s.size=i.size);break;default:s=typeof i.is=="string"?y.createElement(o,{is:i.is}):y.createElement(o)}}s[xt]=t,s[Lt]=i;e:for(y=t.child;y!==null;){if(y.tag===5||y.tag===6)s.appendChild(y.stateNode);else if(y.tag!==4&&y.tag!==27&&y.child!==null){y.child.return=y,y=y.child;continue}if(y===t)break e;for(;y.sibling===null;){if(y.return===null||y.return===t)break e;y=y.return}y.sibling.return=y.return,y=y.sibling}t.stateNode=s;e:switch(At(s,o,i),o){case"button":case"input":case"select":case"textarea":i=!!i.autoFocus;break e;case"img":i=!0;break e;default:i=!1}i&&Bn(t)}}return lt(t),Wo(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,l),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==i&&Bn(t);else{if(typeof i!="string"&&t.stateNode===null)throw Error(u(166));if(e=fe.current,ii(t)){if(e=t.stateNode,l=t.memoizedProps,i=null,o=St,o!==null)switch(o.tag){case 27:case 5:i=o.memoizedProps}e[xt]=t,e=!!(e.nodeValue===l||i!==null&&i.suppressHydrationWarning===!0||sp(e.nodeValue,l)),e||$n(t,!0)}else e=Ga(e).createTextNode(i),e[xt]=t,t.stateNode=e}return lt(t),null;case 31:if(l=t.memoizedState,e===null||e.memoizedState!==null){if(i=ii(t),l!==null){if(e===null){if(!i)throw Error(u(318));if(e=t.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(u(557));e[xt]=t}else Cl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;lt(t),e=!1}else l=ao(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=l),e=!0;if(!e)return t.flags&256?(Ft(t),t):(Ft(t),null);if((t.flags&128)!==0)throw Error(u(558))}return lt(t),null;case 13:if(i=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(o=ii(t),i!==null&&i.dehydrated!==null){if(e===null){if(!o)throw Error(u(318));if(o=t.memoizedState,o=o!==null?o.dehydrated:null,!o)throw Error(u(317));o[xt]=t}else Cl(),(t.flags&128)===0&&(t.memoizedState=null),t.flags|=4;lt(t),o=!1}else o=ao(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=o),o=!0;if(!o)return t.flags&256?(Ft(t),t):(Ft(t),null)}return Ft(t),(t.flags&128)!==0?(t.lanes=l,t):(l=i!==null,e=e!==null&&e.memoizedState!==null,l&&(i=t.child,o=null,i.alternate!==null&&i.alternate.memoizedState!==null&&i.alternate.memoizedState.cachePool!==null&&(o=i.alternate.memoizedState.cachePool.pool),s=null,i.memoizedState!==null&&i.memoizedState.cachePool!==null&&(s=i.memoizedState.cachePool.pool),s!==o&&(i.flags|=2048)),l!==e&&l&&(t.child.flags|=8192),za(t,t.updateQueue),lt(t),null);case 4:return X(),e===null&&bc(t.stateNode.containerInfo),lt(t),null;case 10:return Nn(t.type),lt(t),null;case 19:if(H(ut),i=t.memoizedState,i===null)return lt(t),null;if(o=(t.flags&128)!==0,s=i.rendering,s===null)if(o)or(i,!1);else{if(at!==0||e!==null&&(e.flags&128)!==0)for(e=t.child;e!==null;){if(s=ma(e),s!==null){for(t.flags|=128,or(i,!1),e=s.updateQueue,t.updateQueue=e,za(t,e),t.subtreeFlags=0,e=l,l=t.child;l!==null;)Vf(l,e),l=l.sibling;return k(ut,ut.current&1|2),je&&Mn(t,i.treeForkCount),t.child}e=e.sibling}i.tail!==null&&Ot()>Ra&&(t.flags|=128,o=!0,or(i,!1),t.lanes=4194304)}else{if(!o)if(e=ma(s),e!==null){if(t.flags|=128,o=!0,e=e.updateQueue,t.updateQueue=e,za(t,e),or(i,!0),i.tail===null&&i.tailMode==="hidden"&&!s.alternate&&!je)return lt(t),null}else 2*Ot()-i.renderingStartTime>Ra&&l!==536870912&&(t.flags|=128,o=!0,or(i,!1),t.lanes=4194304);i.isBackwards?(s.sibling=t.child,t.child=s):(e=i.last,e!==null?e.sibling=s:t.child=s,i.last=s)}return i.tail!==null?(e=i.tail,i.rendering=e,i.tail=e.sibling,i.renderingStartTime=Ot(),e.sibling=null,l=ut.current,k(ut,o?l&1|2:l&1),je&&Mn(t,i.treeForkCount),e):(lt(t),null);case 22:case 23:return Ft(t),xo(),i=t.memoizedState!==null,e!==null?e.memoizedState!==null!==i&&(t.flags|=8192):i&&(t.flags|=8192),i?(l&536870912)!==0&&(t.flags&128)===0&&(lt(t),t.subtreeFlags&6&&(t.flags|=8192)):lt(t),l=t.updateQueue,l!==null&&za(t,l.retryQueue),l=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),i=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(i=t.memoizedState.cachePool.pool),i!==l&&(t.flags|=2048),e!==null&&H(Ol),null;case 24:return l=null,e!==null&&(l=e.memoizedState.cache),t.memoizedState.cache!==l&&(t.flags|=2048),Nn(st),lt(t),null;case 25:return null;case 30:return null}throw Error(u(156,t.tag))}function E1(e,t){switch(io(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Nn(st),X(),e=t.flags,(e&65536)!==0&&(e&128)===0?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return ne(t),null;case 31:if(t.memoizedState!==null){if(Ft(t),t.alternate===null)throw Error(u(340));Cl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(Ft(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(u(340));Cl()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return H(ut),null;case 4:return X(),null;case 10:return Nn(t.type),null;case 22:case 23:return Ft(t),xo(),e!==null&&H(Ol),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return Nn(st),null;case 25:return null;default:return null}}function mh(e,t){switch(io(t),t.tag){case 3:Nn(st),X();break;case 26:case 27:case 5:ne(t);break;case 4:X();break;case 31:t.memoizedState!==null&&Ft(t);break;case 13:Ft(t);break;case 19:H(ut);break;case 10:Nn(t.type);break;case 22:case 23:Ft(t),xo(),e!==null&&H(Ol);break;case 24:Nn(st)}}function cr(e,t){try{var l=t.updateQueue,i=l!==null?l.lastEffect:null;if(i!==null){var o=i.next;l=o;do{if((l.tag&e)===e){i=void 0;var s=l.create,y=l.inst;i=s(),y.destroy=i}l=l.next}while(l!==o)}}catch(b){Ze(t,t.return,b)}}function rl(e,t,l){try{var i=t.updateQueue,o=i!==null?i.lastEffect:null;if(o!==null){var s=o.next;i=s;do{if((i.tag&e)===e){var y=i.inst,b=y.destroy;if(b!==void 0){y.destroy=void 0,o=t;var A=l,M=b;try{M()}catch(q){Ze(o,A,q)}}}i=i.next}while(i!==s)}}catch(q){Ze(t,t.return,q)}}function gh(e){var t=e.updateQueue;if(t!==null){var l=e.stateNode;try{ad(t,l)}catch(i){Ze(e,e.return,i)}}}function yh(e,t,l){l.props=Ll(e.type,e.memoizedProps),l.state=e.memoizedState;try{l.componentWillUnmount()}catch(i){Ze(e,t,i)}}function sr(e,t){try{var l=e.ref;if(l!==null){switch(e.tag){case 26:case 27:case 5:var i=e.stateNode;break;case 30:i=e.stateNode;break;default:i=e.stateNode}typeof l=="function"?e.refCleanup=l(i):l.current=i}}catch(o){Ze(e,t,o)}}function kn(e,t){var l=e.ref,i=e.refCleanup;if(l!==null)if(typeof i=="function")try{i()}catch(o){Ze(e,t,o)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof l=="function")try{l(null)}catch(o){Ze(e,t,o)}else l.current=null}function vh(e){var t=e.type,l=e.memoizedProps,i=e.stateNode;try{e:switch(t){case"button":case"input":case"select":case"textarea":l.autoFocus&&i.focus();break e;case"img":l.src?i.src=l.src:l.srcSet&&(i.srcset=l.srcSet)}}catch(o){Ze(e,e.return,o)}}function $o(e,t,l){try{var i=e.stateNode;Q1(i,e.type,l,t),i[Lt]=t}catch(o){Ze(e,e.return,o)}}function bh(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&dl(e.type)||e.tag===4}function Po(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||bh(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&dl(e.type)||e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function ec(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?(l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l).insertBefore(e,t):(t=l.nodeType===9?l.body:l.nodeName==="HTML"?l.ownerDocument.body:l,t.appendChild(e),l=l._reactRootContainer,l!=null||t.onclick!==null||(t.onclick=_n));else if(i!==4&&(i===27&&dl(e.type)&&(l=e.stateNode,t=null),e=e.child,e!==null))for(ec(e,t,l),e=e.sibling;e!==null;)ec(e,t,l),e=e.sibling}function _a(e,t,l){var i=e.tag;if(i===5||i===6)e=e.stateNode,t?l.insertBefore(e,t):l.appendChild(e);else if(i!==4&&(i===27&&dl(e.type)&&(l=e.stateNode),e=e.child,e!==null))for(_a(e,t,l),e=e.sibling;e!==null;)_a(e,t,l),e=e.sibling}function xh(e){var t=e.stateNode,l=e.memoizedProps;try{for(var i=e.type,o=t.attributes;o.length;)t.removeAttributeNode(o[0]);At(t,i,l),t[xt]=e,t[Lt]=l}catch(s){Ze(e,e.return,s)}}var Hn=!1,ht=!1,tc=!1,Sh=typeof WeakSet=="function"?WeakSet:Set,vt=null;function A1(e,t){if(e=e.containerInfo,kc=Ja,e=Rf(e),Zu(e)){if("selectionStart"in e)var l={start:e.selectionStart,end:e.selectionEnd};else e:{l=(l=e.ownerDocument)&&l.defaultView||window;var i=l.getSelection&&l.getSelection();if(i&&i.rangeCount!==0){l=i.anchorNode;var o=i.anchorOffset,s=i.focusNode;i=i.focusOffset;try{l.nodeType,s.nodeType}catch{l=null;break e}var y=0,b=-1,A=-1,M=0,q=0,Q=e,R=null;t:for(;;){for(var U;Q!==l||o!==0&&Q.nodeType!==3||(b=y+o),Q!==s||i!==0&&Q.nodeType!==3||(A=y+i),Q.nodeType===3&&(y+=Q.nodeValue.length),(U=Q.firstChild)!==null;)R=Q,Q=U;for(;;){if(Q===e)break t;if(R===l&&++M===o&&(b=y),R===s&&++q===i&&(A=y),(U=Q.nextSibling)!==null)break;Q=R,R=Q.parentNode}Q=U}l=b===-1||A===-1?null:{start:b,end:A}}else l=null}l=l||{start:0,end:0}}else l=null;for(Ec={focusedElem:e,selectionRange:l},Ja=!1,vt=t;vt!==null;)if(t=vt,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,vt=e;else for(;vt!==null;){switch(t=vt,s=t.alternate,e=t.flags,t.tag){case 0:if((e&4)!==0&&(e=t.updateQueue,e=e!==null?e.events:null,e!==null))for(l=0;l<e.length;l++)o=e[l],o.ref.impl=o.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&s!==null){e=void 0,l=t,o=s.memoizedProps,s=s.memoizedState,i=l.stateNode;try{var se=Ll(l.type,o);e=i.getSnapshotBeforeUpdate(se,s),i.__reactInternalSnapshotBeforeUpdate=e}catch(xe){Ze(l,l.return,xe)}}break;case 3:if((e&1024)!==0){if(e=t.stateNode.containerInfo,l=e.nodeType,l===9)Tc(e);else if(l===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":Tc(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(u(163))}if(e=t.sibling,e!==null){e.return=t.return,vt=e;break}vt=t.return}}function kh(e,t,l){var i=l.flags;switch(l.tag){case 0:case 11:case 15:Yn(e,l),i&4&&cr(5,l);break;case 1:if(Yn(e,l),i&4)if(e=l.stateNode,t===null)try{e.componentDidMount()}catch(y){Ze(l,l.return,y)}else{var o=Ll(l.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(o,t,e.__reactInternalSnapshotBeforeUpdate)}catch(y){Ze(l,l.return,y)}}i&64&&gh(l),i&512&&sr(l,l.return);break;case 3:if(Yn(e,l),i&64&&(e=l.updateQueue,e!==null)){if(t=null,l.child!==null)switch(l.child.tag){case 27:case 5:t=l.child.stateNode;break;case 1:t=l.child.stateNode}try{ad(e,t)}catch(y){Ze(l,l.return,y)}}break;case 27:t===null&&i&4&&xh(l);case 26:case 5:Yn(e,l),t===null&&i&4&&vh(l),i&512&&sr(l,l.return);break;case 12:Yn(e,l);break;case 31:Yn(e,l),i&4&&wh(e,l);break;case 13:Yn(e,l),i&4&&Th(e,l),i&64&&(e=l.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(l=R1.bind(null,l),P1(e,l))));break;case 22:if(i=l.memoizedState!==null||Hn,!i){t=t!==null&&t.memoizedState!==null||ht,o=Hn;var s=ht;Hn=i,(ht=t)&&!s?Vn(e,l,(l.subtreeFlags&8772)!==0):Yn(e,l),Hn=o,ht=s}break;case 30:break;default:Yn(e,l)}}function Eh(e){var t=e.alternate;t!==null&&(e.alternate=null,Eh(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&Ou(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var it=null,jt=!1;function qn(e,t,l){for(l=l.child;l!==null;)Ah(e,t,l),l=l.sibling}function Ah(e,t,l){if(mt&&typeof mt.onCommitFiberUnmount=="function")try{mt.onCommitFiberUnmount(Dt,l)}catch{}switch(l.tag){case 26:ht||kn(l,t),qn(e,t,l),l.memoizedState?l.memoizedState.count--:l.stateNode&&(l=l.stateNode,l.parentNode.removeChild(l));break;case 27:ht||kn(l,t);var i=it,o=jt;dl(l.type)&&(it=l.stateNode,jt=!1),qn(e,t,l),br(l.stateNode),it=i,jt=o;break;case 5:ht||kn(l,t);case 6:if(i=it,o=jt,it=null,qn(e,t,l),it=i,jt=o,it!==null)if(jt)try{(it.nodeType===9?it.body:it.nodeName==="HTML"?it.ownerDocument.body:it).removeChild(l.stateNode)}catch(s){Ze(l,t,s)}else try{it.removeChild(l.stateNode)}catch(s){Ze(l,t,s)}break;case 18:it!==null&&(jt?(e=it,gp(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,l.stateNode),wi(e)):gp(it,l.stateNode));break;case 4:i=it,o=jt,it=l.stateNode.containerInfo,jt=!0,qn(e,t,l),it=i,jt=o;break;case 0:case 11:case 14:case 15:rl(2,l,t),ht||rl(4,l,t),qn(e,t,l);break;case 1:ht||(kn(l,t),i=l.stateNode,typeof i.componentWillUnmount=="function"&&yh(l,t,i)),qn(e,t,l);break;case 21:qn(e,t,l);break;case 22:ht=(i=ht)||l.memoizedState!==null,qn(e,t,l),ht=i;break;default:qn(e,t,l)}}function wh(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{wi(e)}catch(l){Ze(t,t.return,l)}}}function Th(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{wi(e)}catch(l){Ze(t,t.return,l)}}function w1(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new Sh),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new Sh),t;default:throw Error(u(435,e.tag))}}function Oa(e,t){var l=w1(e);t.forEach(function(i){if(!l.has(i)){l.add(i);var o=N1.bind(null,e,i);i.then(o,o)}})}function Bt(e,t){var l=t.deletions;if(l!==null)for(var i=0;i<l.length;i++){var o=l[i],s=e,y=t,b=y;e:for(;b!==null;){switch(b.tag){case 27:if(dl(b.type)){it=b.stateNode,jt=!1;break e}break;case 5:it=b.stateNode,jt=!1;break e;case 3:case 4:it=b.stateNode.containerInfo,jt=!0;break e}b=b.return}if(it===null)throw Error(u(160));Ah(s,y,o),it=null,jt=!1,s=o.alternate,s!==null&&(s.return=null),o.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)Ch(t,e),t=t.sibling}var gn=null;function Ch(e,t){var l=e.alternate,i=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Bt(t,e),Ht(e),i&4&&(rl(3,e,e.return),cr(3,e),rl(5,e,e.return));break;case 1:Bt(t,e),Ht(e),i&512&&(ht||l===null||kn(l,l.return)),i&64&&Hn&&(e=e.updateQueue,e!==null&&(i=e.callbacks,i!==null&&(l=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=l===null?i:l.concat(i))));break;case 26:var o=gn;if(Bt(t,e),Ht(e),i&512&&(ht||l===null||kn(l,l.return)),i&4){var s=l!==null?l.memoizedState:null;if(i=e.memoizedState,l===null)if(i===null)if(e.stateNode===null){e:{i=e.type,l=e.memoizedProps,o=o.ownerDocument||o;t:switch(i){case"title":s=o.getElementsByTagName("title")[0],(!s||s[ji]||s[xt]||s.namespaceURI==="http://www.w3.org/2000/svg"||s.hasAttribute("itemprop"))&&(s=o.createElement(i),o.head.insertBefore(s,o.querySelector("head > title"))),At(s,i,l),s[xt]=e,yt(s),i=s;break e;case"link":var y=Cp("link","href",o).get(i+(l.href||""));if(y){for(var b=0;b<y.length;b++)if(s=y[b],s.getAttribute("href")===(l.href==null||l.href===""?null:l.href)&&s.getAttribute("rel")===(l.rel==null?null:l.rel)&&s.getAttribute("title")===(l.title==null?null:l.title)&&s.getAttribute("crossorigin")===(l.crossOrigin==null?null:l.crossOrigin)){y.splice(b,1);break t}}s=o.createElement(i),At(s,i,l),o.head.appendChild(s);break;case"meta":if(y=Cp("meta","content",o).get(i+(l.content||""))){for(b=0;b<y.length;b++)if(s=y[b],s.getAttribute("content")===(l.content==null?null:""+l.content)&&s.getAttribute("name")===(l.name==null?null:l.name)&&s.getAttribute("property")===(l.property==null?null:l.property)&&s.getAttribute("http-equiv")===(l.httpEquiv==null?null:l.httpEquiv)&&s.getAttribute("charset")===(l.charSet==null?null:l.charSet)){y.splice(b,1);break t}}s=o.createElement(i),At(s,i,l),o.head.appendChild(s);break;default:throw Error(u(468,i))}s[xt]=e,yt(s),i=s}e.stateNode=i}else zp(o,e.type,e.stateNode);else e.stateNode=Tp(o,i,e.memoizedProps);else s!==i?(s===null?l.stateNode!==null&&(l=l.stateNode,l.parentNode.removeChild(l)):s.count--,i===null?zp(o,e.type,e.stateNode):Tp(o,i,e.memoizedProps)):i===null&&e.stateNode!==null&&$o(e,e.memoizedProps,l.memoizedProps)}break;case 27:Bt(t,e),Ht(e),i&512&&(ht||l===null||kn(l,l.return)),l!==null&&i&4&&$o(e,e.memoizedProps,l.memoizedProps);break;case 5:if(Bt(t,e),Ht(e),i&512&&(ht||l===null||kn(l,l.return)),e.flags&32){o=e.stateNode;try{Fl(o,"")}catch(se){Ze(e,e.return,se)}}i&4&&e.stateNode!=null&&(o=e.memoizedProps,$o(e,o,l!==null?l.memoizedProps:o)),i&1024&&(tc=!0);break;case 6:if(Bt(t,e),Ht(e),i&4){if(e.stateNode===null)throw Error(u(162));i=e.memoizedProps,l=e.stateNode;try{l.nodeValue=i}catch(se){Ze(e,e.return,se)}}break;case 3:if(Ia=null,o=gn,gn=Xa(t.containerInfo),Bt(t,e),gn=o,Ht(e),i&4&&l!==null&&l.memoizedState.isDehydrated)try{wi(t.containerInfo)}catch(se){Ze(e,e.return,se)}tc&&(tc=!1,zh(e));break;case 4:i=gn,gn=Xa(e.stateNode.containerInfo),Bt(t,e),Ht(e),gn=i;break;case 12:Bt(t,e),Ht(e);break;case 31:Bt(t,e),Ht(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Oa(e,i)));break;case 13:Bt(t,e),Ht(e),e.child.flags&8192&&e.memoizedState!==null!=(l!==null&&l.memoizedState!==null)&&(Ma=Ot()),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Oa(e,i)));break;case 22:o=e.memoizedState!==null;var A=l!==null&&l.memoizedState!==null,M=Hn,q=ht;if(Hn=M||o,ht=q||A,Bt(t,e),ht=q,Hn=M,Ht(e),i&8192)e:for(t=e.stateNode,t._visibility=o?t._visibility&-2:t._visibility|1,o&&(l===null||A||Hn||ht||Ul(e)),l=null,t=e;;){if(t.tag===5||t.tag===26){if(l===null){A=l=t;try{if(s=A.stateNode,o)y=s.style,typeof y.setProperty=="function"?y.setProperty("display","none","important"):y.display="none";else{b=A.stateNode;var Q=A.memoizedProps.style,R=Q!=null&&Q.hasOwnProperty("display")?Q.display:null;b.style.display=R==null||typeof R=="boolean"?"":(""+R).trim()}}catch(se){Ze(A,A.return,se)}}}else if(t.tag===6){if(l===null){A=t;try{A.stateNode.nodeValue=o?"":A.memoizedProps}catch(se){Ze(A,A.return,se)}}}else if(t.tag===18){if(l===null){A=t;try{var U=A.stateNode;o?yp(U,!0):yp(A.stateNode,!1)}catch(se){Ze(A,A.return,se)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break e;for(;t.sibling===null;){if(t.return===null||t.return===e)break e;l===t&&(l=null),t=t.return}l===t&&(l=null),t.sibling.return=t.return,t=t.sibling}i&4&&(i=e.updateQueue,i!==null&&(l=i.retryQueue,l!==null&&(i.retryQueue=null,Oa(e,l))));break;case 19:Bt(t,e),Ht(e),i&4&&(i=e.updateQueue,i!==null&&(e.updateQueue=null,Oa(e,i)));break;case 30:break;case 21:break;default:Bt(t,e),Ht(e)}}function Ht(e){var t=e.flags;if(t&2){try{for(var l,i=e.return;i!==null;){if(bh(i)){l=i;break}i=i.return}if(l==null)throw Error(u(160));switch(l.tag){case 27:var o=l.stateNode,s=Po(e);_a(e,s,o);break;case 5:var y=l.stateNode;l.flags&32&&(Fl(y,""),l.flags&=-33);var b=Po(e);_a(e,b,y);break;case 3:case 4:var A=l.stateNode.containerInfo,M=Po(e);ec(e,M,A);break;default:throw Error(u(161))}}catch(q){Ze(e,e.return,q)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function zh(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;zh(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Yn(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)kh(e,t.alternate,t),t=t.sibling}function Ul(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:rl(4,t,t.return),Ul(t);break;case 1:kn(t,t.return);var l=t.stateNode;typeof l.componentWillUnmount=="function"&&yh(t,t.return,l),Ul(t);break;case 27:br(t.stateNode);case 26:case 5:kn(t,t.return),Ul(t);break;case 22:t.memoizedState===null&&Ul(t);break;case 30:Ul(t);break;default:Ul(t)}e=e.sibling}}function Vn(e,t,l){for(l=l&&(t.subtreeFlags&8772)!==0,t=t.child;t!==null;){var i=t.alternate,o=e,s=t,y=s.flags;switch(s.tag){case 0:case 11:case 15:Vn(o,s,l),cr(4,s);break;case 1:if(Vn(o,s,l),i=s,o=i.stateNode,typeof o.componentDidMount=="function")try{o.componentDidMount()}catch(M){Ze(i,i.return,M)}if(i=s,o=i.updateQueue,o!==null){var b=i.stateNode;try{var A=o.shared.hiddenCallbacks;if(A!==null)for(o.shared.hiddenCallbacks=null,o=0;o<A.length;o++)rd(A[o],b)}catch(M){Ze(i,i.return,M)}}l&&y&64&&gh(s),sr(s,s.return);break;case 27:xh(s);case 26:case 5:Vn(o,s,l),l&&i===null&&y&4&&vh(s),sr(s,s.return);break;case 12:Vn(o,s,l);break;case 31:Vn(o,s,l),l&&y&4&&wh(o,s);break;case 13:Vn(o,s,l),l&&y&4&&Th(o,s);break;case 22:s.memoizedState===null&&Vn(o,s,l),sr(s,s.return);break;case 30:break;default:Vn(o,s,l)}t=t.sibling}}function nc(e,t){var l=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(l=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==l&&(e!=null&&e.refCount++,l!=null&&Ji(l))}function lc(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ji(e))}function yn(e,t,l,i){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)_h(e,t,l,i),t=t.sibling}function _h(e,t,l,i){var o=t.flags;switch(t.tag){case 0:case 11:case 15:yn(e,t,l,i),o&2048&&cr(9,t);break;case 1:yn(e,t,l,i);break;case 3:yn(e,t,l,i),o&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&Ji(e)));break;case 12:if(o&2048){yn(e,t,l,i),e=t.stateNode;try{var s=t.memoizedProps,y=s.id,b=s.onPostCommit;typeof b=="function"&&b(y,t.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(A){Ze(t,t.return,A)}}else yn(e,t,l,i);break;case 31:yn(e,t,l,i);break;case 13:yn(e,t,l,i);break;case 23:break;case 22:s=t.stateNode,y=t.alternate,t.memoizedState!==null?s._visibility&2?yn(e,t,l,i):fr(e,t):s._visibility&2?yn(e,t,l,i):(s._visibility|=2,pi(e,t,l,i,(t.subtreeFlags&10256)!==0||!1)),o&2048&&nc(y,t);break;case 24:yn(e,t,l,i),o&2048&&lc(t.alternate,t);break;default:yn(e,t,l,i)}}function pi(e,t,l,i,o){for(o=o&&((t.subtreeFlags&10256)!==0||!1),t=t.child;t!==null;){var s=e,y=t,b=l,A=i,M=y.flags;switch(y.tag){case 0:case 11:case 15:pi(s,y,b,A,o),cr(8,y);break;case 23:break;case 22:var q=y.stateNode;y.memoizedState!==null?q._visibility&2?pi(s,y,b,A,o):fr(s,y):(q._visibility|=2,pi(s,y,b,A,o)),o&&M&2048&&nc(y.alternate,y);break;case 24:pi(s,y,b,A,o),o&&M&2048&&lc(y.alternate,y);break;default:pi(s,y,b,A,o)}t=t.sibling}}function fr(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var l=e,i=t,o=i.flags;switch(i.tag){case 22:fr(l,i),o&2048&&nc(i.alternate,i);break;case 24:fr(l,i),o&2048&&lc(i.alternate,i);break;default:fr(l,i)}t=t.sibling}}var dr=8192;function mi(e,t,l){if(e.subtreeFlags&dr)for(e=e.child;e!==null;)Oh(e,t,l),e=e.sibling}function Oh(e,t,l){switch(e.tag){case 26:mi(e,t,l),e.flags&dr&&e.memoizedState!==null&&fv(l,gn,e.memoizedState,e.memoizedProps);break;case 5:mi(e,t,l);break;case 3:case 4:var i=gn;gn=Xa(e.stateNode.containerInfo),mi(e,t,l),gn=i;break;case 22:e.memoizedState===null&&(i=e.alternate,i!==null&&i.memoizedState!==null?(i=dr,dr=16777216,mi(e,t,l),dr=i):mi(e,t,l));break;default:mi(e,t,l)}}function Dh(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function hr(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];vt=i,Rh(i,e)}Dh(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Mh(e),e=e.sibling}function Mh(e){switch(e.tag){case 0:case 11:case 15:hr(e),e.flags&2048&&rl(9,e,e.return);break;case 3:hr(e);break;case 12:hr(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Da(e)):hr(e);break;default:hr(e)}}function Da(e){var t=e.deletions;if((e.flags&16)!==0){if(t!==null)for(var l=0;l<t.length;l++){var i=t[l];vt=i,Rh(i,e)}Dh(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:rl(8,t,t.return),Da(t);break;case 22:l=t.stateNode,l._visibility&2&&(l._visibility&=-3,Da(t));break;default:Da(t)}e=e.sibling}}function Rh(e,t){for(;vt!==null;){var l=vt;switch(l.tag){case 0:case 11:case 15:rl(8,l,t);break;case 23:case 22:if(l.memoizedState!==null&&l.memoizedState.cachePool!==null){var i=l.memoizedState.cachePool.pool;i!=null&&i.refCount++}break;case 24:Ji(l.memoizedState.cache)}if(i=l.child,i!==null)i.return=l,vt=i;else e:for(l=e;vt!==null;){i=vt;var o=i.sibling,s=i.return;if(Eh(i),i===l){vt=null;break e}if(o!==null){o.return=s,vt=o;break e}vt=s}}}var T1={getCacheForType:function(e){var t=kt(st),l=t.data.get(e);return l===void 0&&(l=e(),t.data.set(e,l)),l},cacheSignal:function(){return kt(st).controller.signal}},C1=typeof WeakMap=="function"?WeakMap:Map,Ve=0,$e=null,Me=null,Le=0,Ie=0,Kt=null,al=!1,gi=!1,ic=!1,Gn=0,at=0,ul=0,jl=0,rc=0,Jt=0,yi=0,pr=null,qt=null,ac=!1,Ma=0,Nh=0,Ra=1/0,Na=null,ol=null,gt=0,cl=null,vi=null,Xn=0,uc=0,oc=null,Lh=null,mr=0,cc=null;function Wt(){return(Ve&2)!==0&&Le!==0?Le&-Le:D.T!==null?mc():Js()}function Uh(){if(Jt===0)if((Le&536870912)===0||je){var e=Vr;Vr<<=1,(Vr&3932160)===0&&(Vr=262144),Jt=e}else Jt=536870912;return e=Zt.current,e!==null&&(e.flags|=32),Jt}function Yt(e,t,l){(e===$e&&(Ie===2||Ie===9)||e.cancelPendingCommit!==null)&&(bi(e,0),sl(e,Le,Jt,!1)),Ui(e,l),((Ve&2)===0||e!==$e)&&(e===$e&&((Ve&2)===0&&(jl|=l),at===4&&sl(e,Le,Jt,!1)),En(e))}function jh(e,t,l){if((Ve&6)!==0)throw Error(u(327));var i=!l&&(t&127)===0&&(t&e.expiredLanes)===0||Li(e,t),o=i?O1(e,t):fc(e,t,!0),s=i;do{if(o===0){gi&&!i&&sl(e,t,0,!1);break}else{if(l=e.current.alternate,s&&!z1(l)){o=fc(e,t,!1),s=!1;continue}if(o===2){if(s=t,e.errorRecoveryDisabledLanes&s)var y=0;else y=e.pendingLanes&-536870913,y=y!==0?y:y&536870912?536870912:0;if(y!==0){t=y;e:{var b=e;o=pr;var A=b.current.memoizedState.isDehydrated;if(A&&(bi(b,y).flags|=256),y=fc(b,y,!1),y!==2){if(ic&&!A){b.errorRecoveryDisabledLanes|=s,jl|=s,o=4;break e}s=qt,qt=o,s!==null&&(qt===null?qt=s:qt.push.apply(qt,s))}o=y}if(s=!1,o!==2)continue}}if(o===1){bi(e,0),sl(e,t,0,!0);break}e:{switch(i=e,s=o,s){case 0:case 1:throw Error(u(345));case 4:if((t&4194048)!==t)break;case 6:sl(i,t,Jt,!al);break e;case 2:qt=null;break;case 3:case 5:break;default:throw Error(u(329))}if((t&62914560)===t&&(o=Ma+300-Ot(),10<o)){if(sl(i,t,Jt,!al),Xr(i,0,!0)!==0)break e;Xn=t,i.timeoutHandle=pp(Bh.bind(null,i,l,qt,Na,ac,t,Jt,jl,yi,al,s,"Throttled",-0,0),o);break e}Bh(i,l,qt,Na,ac,t,Jt,jl,yi,al,s,null,-0,0)}}break}while(!0);En(e)}function Bh(e,t,l,i,o,s,y,b,A,M,q,Q,R,U){if(e.timeoutHandle=-1,Q=t.subtreeFlags,Q&8192||(Q&16785408)===16785408){Q={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:_n},Oh(t,s,Q);var se=(s&62914560)===s?Ma-Ot():(s&4194048)===s?Nh-Ot():0;if(se=dv(Q,se),se!==null){Xn=s,e.cancelPendingCommit=se(Ih.bind(null,e,t,s,l,i,o,y,b,A,q,Q,null,R,U)),sl(e,s,y,!M);return}}Ih(e,t,s,l,i,o,y,b,A)}function z1(e){for(var t=e;;){var l=t.tag;if((l===0||l===11||l===15)&&t.flags&16384&&(l=t.updateQueue,l!==null&&(l=l.stores,l!==null)))for(var i=0;i<l.length;i++){var o=l[i],s=o.getSnapshot;o=o.value;try{if(!Qt(s(),o))return!1}catch{return!1}}if(l=t.child,t.subtreeFlags&16384&&l!==null)l.return=t,t=l;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function sl(e,t,l,i){t&=~rc,t&=~jl,e.suspendedLanes|=t,e.pingedLanes&=~t,i&&(e.warmLanes|=t),i=e.expirationTimes;for(var o=t;0<o;){var s=31-We(o),y=1<<s;i[s]=-1,o&=~y}l!==0&&Zs(e,l,t)}function La(){return(Ve&6)===0?(gr(0),!1):!0}function sc(){if(Me!==null){if(Ie===0)var e=Me.return;else e=Me,Rn=zl=null,To(e),ci=null,$i=0,e=Me;for(;e!==null;)mh(e.alternate,e),e=e.return;Me=null}}function bi(e,t){var l=e.timeoutHandle;l!==-1&&(e.timeoutHandle=-1,F1(l)),l=e.cancelPendingCommit,l!==null&&(e.cancelPendingCommit=null,l()),Xn=0,sc(),$e=e,Me=l=Dn(e.current,null),Le=t,Ie=0,Kt=null,al=!1,gi=Li(e,t),ic=!1,yi=Jt=rc=jl=ul=at=0,qt=pr=null,ac=!1,(t&8)!==0&&(t|=t&32);var i=e.entangledLanes;if(i!==0)for(e=e.entanglements,i&=t;0<i;){var o=31-We(i),s=1<<o;t|=e[o],i&=~s}return Gn=t,na(),l}function Hh(e,t){ze=null,D.H=ar,t===oi||t===sa?(t=td(),Ie=3):t===po?(t=td(),Ie=4):Ie=t===Vo?8:t!==null&&typeof t=="object"&&typeof t.then=="function"?6:1,Kt=t,Me===null&&(at=1,Aa(e,an(t,e.current)))}function qh(){var e=Zt.current;return e===null?!0:(Le&4194048)===Le?sn===null:(Le&62914560)===Le||(Le&536870912)!==0?e===sn:!1}function Yh(){var e=D.H;return D.H=ar,e===null?ar:e}function Vh(){var e=D.A;return D.A=T1,e}function Ua(){at=4,al||(Le&4194048)!==Le&&Zt.current!==null||(gi=!0),(ul&134217727)===0&&(jl&134217727)===0||$e===null||sl($e,Le,Jt,!1)}function fc(e,t,l){var i=Ve;Ve|=2;var o=Yh(),s=Vh();($e!==e||Le!==t)&&(Na=null,bi(e,t)),t=!1;var y=at;e:do try{if(Ie!==0&&Me!==null){var b=Me,A=Kt;switch(Ie){case 8:sc(),y=6;break e;case 3:case 2:case 9:case 6:Zt.current===null&&(t=!0);var M=Ie;if(Ie=0,Kt=null,xi(e,b,A,M),l&&gi){y=0;break e}break;default:M=Ie,Ie=0,Kt=null,xi(e,b,A,M)}}_1(),y=at;break}catch(q){Hh(e,q)}while(!0);return t&&e.shellSuspendCounter++,Rn=zl=null,Ve=i,D.H=o,D.A=s,Me===null&&($e=null,Le=0,na()),y}function _1(){for(;Me!==null;)Gh(Me)}function O1(e,t){var l=Ve;Ve|=2;var i=Yh(),o=Vh();$e!==e||Le!==t?(Na=null,Ra=Ot()+500,bi(e,t)):gi=Li(e,t);e:do try{if(Ie!==0&&Me!==null){t=Me;var s=Kt;t:switch(Ie){case 1:Ie=0,Kt=null,xi(e,t,s,1);break;case 2:case 9:if(Pf(s)){Ie=0,Kt=null,Xh(t);break}t=function(){Ie!==2&&Ie!==9||$e!==e||(Ie=7),En(e)},s.then(t,t);break e;case 3:Ie=7;break e;case 4:Ie=5;break e;case 7:Pf(s)?(Ie=0,Kt=null,Xh(t)):(Ie=0,Kt=null,xi(e,t,s,7));break;case 5:var y=null;switch(Me.tag){case 26:y=Me.memoizedState;case 5:case 27:var b=Me;if(y?_p(y):b.stateNode.complete){Ie=0,Kt=null;var A=b.sibling;if(A!==null)Me=A;else{var M=b.return;M!==null?(Me=M,ja(M)):Me=null}break t}}Ie=0,Kt=null,xi(e,t,s,5);break;case 6:Ie=0,Kt=null,xi(e,t,s,6);break;case 8:sc(),at=6;break e;default:throw Error(u(462))}}D1();break}catch(q){Hh(e,q)}while(!0);return Rn=zl=null,D.H=i,D.A=o,Ve=l,Me!==null?0:($e=null,Le=0,na(),at)}function D1(){for(;Me!==null&&!bn();)Gh(Me)}function Gh(e){var t=hh(e.alternate,e,Gn);e.memoizedProps=e.pendingProps,t===null?ja(e):Me=t}function Xh(e){var t=e,l=t.alternate;switch(t.tag){case 15:case 0:t=uh(l,t,t.pendingProps,t.type,void 0,Le);break;case 11:t=uh(l,t,t.pendingProps,t.type.render,t.ref,Le);break;case 5:To(t);default:mh(l,t),t=Me=Vf(t,Gn),t=hh(l,t,Gn)}e.memoizedProps=e.pendingProps,t===null?ja(e):Me=t}function xi(e,t,l,i){Rn=zl=null,To(t),ci=null,$i=0;var o=t.return;try{if(b1(e,o,t,l,Le)){at=1,Aa(e,an(l,e.current)),Me=null;return}}catch(s){if(o!==null)throw Me=o,s;at=1,Aa(e,an(l,e.current)),Me=null;return}t.flags&32768?(je||i===1?e=!0:gi||(Le&536870912)!==0?e=!1:(al=e=!0,(i===2||i===9||i===3||i===6)&&(i=Zt.current,i!==null&&i.tag===13&&(i.flags|=16384))),Qh(t,e)):ja(t)}function ja(e){var t=e;do{if((t.flags&32768)!==0){Qh(t,al);return}e=t.return;var l=k1(t.alternate,t,Gn);if(l!==null){Me=l;return}if(t=t.sibling,t!==null){Me=t;return}Me=t=e}while(t!==null);at===0&&(at=5)}function Qh(e,t){do{var l=E1(e.alternate,e);if(l!==null){l.flags&=32767,Me=l;return}if(l=e.return,l!==null&&(l.flags|=32768,l.subtreeFlags=0,l.deletions=null),!t&&(e=e.sibling,e!==null)){Me=e;return}Me=e=l}while(e!==null);at=6,Me=null}function Ih(e,t,l,i,o,s,y,b,A){e.cancelPendingCommit=null;do Ba();while(gt!==0);if((Ve&6)!==0)throw Error(u(327));if(t!==null){if(t===e.current)throw Error(u(177));if(s=t.lanes|t.childLanes,s|=$u,sy(e,l,s,y,b,A),e===$e&&(Me=$e=null,Le=0),vi=t,cl=e,Xn=l,uc=s,oc=o,Lh=i,(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,L1(Ee,function(){return Wh(),null})):(e.callbackNode=null,e.callbackPriority=0),i=(t.flags&13878)!==0,(t.subtreeFlags&13878)!==0||i){i=D.T,D.T=null,o=K.p,K.p=2,y=Ve,Ve|=4;try{A1(e,t,l)}finally{Ve=y,K.p=o,D.T=i}}gt=1,Zh(),Fh(),Kh()}}function Zh(){if(gt===1){gt=0;var e=cl,t=vi,l=(t.flags&13878)!==0;if((t.subtreeFlags&13878)!==0||l){l=D.T,D.T=null;var i=K.p;K.p=2;var o=Ve;Ve|=4;try{Ch(t,e);var s=Ec,y=Rf(e.containerInfo),b=s.focusedElem,A=s.selectionRange;if(y!==b&&b&&b.ownerDocument&&Mf(b.ownerDocument.documentElement,b)){if(A!==null&&Zu(b)){var M=A.start,q=A.end;if(q===void 0&&(q=M),"selectionStart"in b)b.selectionStart=M,b.selectionEnd=Math.min(q,b.value.length);else{var Q=b.ownerDocument||document,R=Q&&Q.defaultView||window;if(R.getSelection){var U=R.getSelection(),se=b.textContent.length,xe=Math.min(A.start,se),Je=A.end===void 0?xe:Math.min(A.end,se);!U.extend&&xe>Je&&(y=Je,Je=xe,xe=y);var z=Df(b,xe),T=Df(b,Je);if(z&&T&&(U.rangeCount!==1||U.anchorNode!==z.node||U.anchorOffset!==z.offset||U.focusNode!==T.node||U.focusOffset!==T.offset)){var O=Q.createRange();O.setStart(z.node,z.offset),U.removeAllRanges(),xe>Je?(U.addRange(O),U.extend(T.node,T.offset)):(O.setEnd(T.node,T.offset),U.addRange(O))}}}}for(Q=[],U=b;U=U.parentNode;)U.nodeType===1&&Q.push({element:U,left:U.scrollLeft,top:U.scrollTop});for(typeof b.focus=="function"&&b.focus(),b=0;b<Q.length;b++){var G=Q[b];G.element.scrollLeft=G.left,G.element.scrollTop=G.top}}Ja=!!kc,Ec=kc=null}finally{Ve=o,K.p=i,D.T=l}}e.current=t,gt=2}}function Fh(){if(gt===2){gt=0;var e=cl,t=vi,l=(t.flags&8772)!==0;if((t.subtreeFlags&8772)!==0||l){l=D.T,D.T=null;var i=K.p;K.p=2;var o=Ve;Ve|=4;try{kh(e,t.alternate,t)}finally{Ve=o,K.p=i,D.T=l}}gt=3}}function Kh(){if(gt===4||gt===3){gt=0,Au();var e=cl,t=vi,l=Xn,i=Lh;(t.subtreeFlags&10256)!==0||(t.flags&10256)!==0?gt=5:(gt=0,vi=cl=null,Jh(e,e.pendingLanes));var o=e.pendingLanes;if(o===0&&(ol=null),zu(l),t=t.stateNode,mt&&typeof mt.onCommitFiberRoot=="function")try{mt.onCommitFiberRoot(Dt,t,void 0,(t.current.flags&128)===128)}catch{}if(i!==null){t=D.T,o=K.p,K.p=2,D.T=null;try{for(var s=e.onRecoverableError,y=0;y<i.length;y++){var b=i[y];s(b.value,{componentStack:b.stack})}}finally{D.T=t,K.p=o}}(Xn&3)!==0&&Ba(),En(e),o=e.pendingLanes,(l&261930)!==0&&(o&42)!==0?e===cc?mr++:(mr=0,cc=e):mr=0,gr(0)}}function Jh(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,Ji(t)))}function Ba(){return Zh(),Fh(),Kh(),Wh()}function Wh(){if(gt!==5)return!1;var e=cl,t=uc;uc=0;var l=zu(Xn),i=D.T,o=K.p;try{K.p=32>l?32:l,D.T=null,l=oc,oc=null;var s=cl,y=Xn;if(gt=0,vi=cl=null,Xn=0,(Ve&6)!==0)throw Error(u(331));var b=Ve;if(Ve|=4,Mh(s.current),_h(s,s.current,y,l),Ve=b,gr(0,!1),mt&&typeof mt.onPostCommitFiberRoot=="function")try{mt.onPostCommitFiberRoot(Dt,s)}catch{}return!0}finally{K.p=o,D.T=i,Jh(e,t)}}function $h(e,t,l){t=an(l,t),t=Yo(e.stateNode,t,2),e=nl(e,t,2),e!==null&&(Ui(e,2),En(e))}function Ze(e,t,l){if(e.tag===3)$h(e,e,l);else for(;t!==null;){if(t.tag===3){$h(t,e,l);break}else if(t.tag===1){var i=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof i.componentDidCatch=="function"&&(ol===null||!ol.has(i))){e=an(l,e),l=Pd(2),i=nl(t,l,2),i!==null&&(eh(l,i,t,e),Ui(i,2),En(i));break}}t=t.return}}function dc(e,t,l){var i=e.pingCache;if(i===null){i=e.pingCache=new C1;var o=new Set;i.set(t,o)}else o=i.get(t),o===void 0&&(o=new Set,i.set(t,o));o.has(l)||(ic=!0,o.add(l),e=M1.bind(null,e,t,l),t.then(e,e))}function M1(e,t,l){var i=e.pingCache;i!==null&&i.delete(t),e.pingedLanes|=e.suspendedLanes&l,e.warmLanes&=~l,$e===e&&(Le&l)===l&&(at===4||at===3&&(Le&62914560)===Le&&300>Ot()-Ma?(Ve&2)===0&&bi(e,0):rc|=l,yi===Le&&(yi=0)),En(e)}function Ph(e,t){t===0&&(t=Is()),e=wl(e,t),e!==null&&(Ui(e,t),En(e))}function R1(e){var t=e.memoizedState,l=0;t!==null&&(l=t.retryLane),Ph(e,l)}function N1(e,t){var l=0;switch(e.tag){case 31:case 13:var i=e.stateNode,o=e.memoizedState;o!==null&&(l=o.retryLane);break;case 19:i=e.stateNode;break;case 22:i=e.stateNode._retryCache;break;default:throw Error(u(314))}i!==null&&i.delete(t),Ph(e,l)}function L1(e,t){return et(e,t)}var Ha=null,Si=null,hc=!1,qa=!1,pc=!1,fl=0;function En(e){e!==Si&&e.next===null&&(Si===null?Ha=Si=e:Si=Si.next=e),qa=!0,hc||(hc=!0,j1())}function gr(e,t){if(!pc&&qa){pc=!0;do for(var l=!1,i=Ha;i!==null;){if(e!==0){var o=i.pendingLanes;if(o===0)var s=0;else{var y=i.suspendedLanes,b=i.pingedLanes;s=(1<<31-We(42|e)+1)-1,s&=o&~(y&~b),s=s&201326741?s&201326741|1:s?s|2:0}s!==0&&(l=!0,lp(i,s))}else s=Le,s=Xr(i,i===$e?s:0,i.cancelPendingCommit!==null||i.timeoutHandle!==-1),(s&3)===0||Li(i,s)||(l=!0,lp(i,s));i=i.next}while(l);pc=!1}}function U1(){ep()}function ep(){qa=hc=!1;var e=0;fl!==0&&Z1()&&(e=fl);for(var t=Ot(),l=null,i=Ha;i!==null;){var o=i.next,s=tp(i,t);s===0?(i.next=null,l===null?Ha=o:l.next=o,o===null&&(Si=l)):(l=i,(e!==0||(s&3)!==0)&&(qa=!0)),i=o}gt!==0&&gt!==5||gr(e),fl!==0&&(fl=0)}function tp(e,t){for(var l=e.suspendedLanes,i=e.pingedLanes,o=e.expirationTimes,s=e.pendingLanes&-62914561;0<s;){var y=31-We(s),b=1<<y,A=o[y];A===-1?((b&l)===0||(b&i)!==0)&&(o[y]=cy(b,t)):A<=t&&(e.expiredLanes|=b),s&=~b}if(t=$e,l=Le,l=Xr(e,e===t?l:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i=e.callbackNode,l===0||e===t&&(Ie===2||Ie===9)||e.cancelPendingCommit!==null)return i!==null&&i!==null&&ct(i),e.callbackNode=null,e.callbackPriority=0;if((l&3)===0||Li(e,l)){if(t=l&-l,t===e.callbackPriority)return t;switch(i!==null&&ct(i),zu(l)){case 2:case 8:l=P;break;case 32:l=Ee;break;case 268435456:l=Ge;break;default:l=Ee}return i=np.bind(null,e),l=et(l,i),e.callbackPriority=t,e.callbackNode=l,t}return i!==null&&i!==null&&ct(i),e.callbackPriority=2,e.callbackNode=null,2}function np(e,t){if(gt!==0&&gt!==5)return e.callbackNode=null,e.callbackPriority=0,null;var l=e.callbackNode;if(Ba()&&e.callbackNode!==l)return null;var i=Le;return i=Xr(e,e===$e?i:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),i===0?null:(jh(e,i,t),tp(e,Ot()),e.callbackNode!=null&&e.callbackNode===l?np.bind(null,e):null)}function lp(e,t){if(Ba())return null;jh(e,t,!0)}function j1(){K1(function(){(Ve&6)!==0?et(V,U1):ep()})}function mc(){if(fl===0){var e=ai;e===0&&(e=Yr,Yr<<=1,(Yr&261888)===0&&(Yr=256)),fl=e}return fl}function ip(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Fr(""+e)}function rp(e,t){var l=t.ownerDocument.createElement("input");return l.name=t.name,l.value=t.value,e.id&&l.setAttribute("form",e.id),t.parentNode.insertBefore(l,t),e=new FormData(e),l.parentNode.removeChild(l),e}function B1(e,t,l,i,o){if(t==="submit"&&l&&l.stateNode===o){var s=ip((o[Lt]||null).action),y=i.submitter;y&&(t=(t=y[Lt]||null)?ip(t.formAction):y.getAttribute("formAction"),t!==null&&(s=t,y=null));var b=new $r("action","action",null,i,o);e.push({event:b,listeners:[{instance:null,listener:function(){if(i.defaultPrevented){if(fl!==0){var A=y?rp(o,y):new FormData(o);Lo(l,{pending:!0,data:A,method:o.method,action:s},null,A)}}else typeof s=="function"&&(b.preventDefault(),A=y?rp(o,y):new FormData(o),Lo(l,{pending:!0,data:A,method:o.method,action:s},s,A))},currentTarget:o}]})}}for(var gc=0;gc<Wu.length;gc++){var yc=Wu[gc],H1=yc.toLowerCase(),q1=yc[0].toUpperCase()+yc.slice(1);mn(H1,"on"+q1)}mn(Uf,"onAnimationEnd"),mn(jf,"onAnimationIteration"),mn(Bf,"onAnimationStart"),mn("dblclick","onDoubleClick"),mn("focusin","onFocus"),mn("focusout","onBlur"),mn(n1,"onTransitionRun"),mn(l1,"onTransitionStart"),mn(i1,"onTransitionCancel"),mn(Hf,"onTransitionEnd"),Il("onMouseEnter",["mouseout","mouseover"]),Il("onMouseLeave",["mouseout","mouseover"]),Il("onPointerEnter",["pointerout","pointerover"]),Il("onPointerLeave",["pointerout","pointerover"]),Sl("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),Sl("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),Sl("onBeforeInput",["compositionend","keypress","textInput","paste"]),Sl("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),Sl("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),Sl("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var yr="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Y1=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(yr));function ap(e,t){t=(t&4)!==0;for(var l=0;l<e.length;l++){var i=e[l],o=i.event;i=i.listeners;e:{var s=void 0;if(t)for(var y=i.length-1;0<=y;y--){var b=i[y],A=b.instance,M=b.currentTarget;if(b=b.listener,A!==s&&o.isPropagationStopped())break e;s=b,o.currentTarget=M;try{s(o)}catch(q){ta(q)}o.currentTarget=null,s=A}else for(y=0;y<i.length;y++){if(b=i[y],A=b.instance,M=b.currentTarget,b=b.listener,A!==s&&o.isPropagationStopped())break e;s=b,o.currentTarget=M;try{s(o)}catch(q){ta(q)}o.currentTarget=null,s=A}}}}function Re(e,t){var l=t[_u];l===void 0&&(l=t[_u]=new Set);var i=e+"__bubble";l.has(i)||(up(t,e,2,!1),l.add(i))}function vc(e,t,l){var i=0;t&&(i|=4),up(l,e,i,t)}var Ya="_reactListening"+Math.random().toString(36).slice(2);function bc(e){if(!e[Ya]){e[Ya]=!0,Ps.forEach(function(l){l!=="selectionchange"&&(Y1.has(l)||vc(l,!1,e),vc(l,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[Ya]||(t[Ya]=!0,vc("selectionchange",!1,t))}}function up(e,t,l,i){switch(Up(t)){case 2:var o=mv;break;case 8:o=gv;break;default:o=Nc}l=o.bind(null,t,l,e),o=void 0,!Bu||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),i?o!==void 0?e.addEventListener(t,l,{capture:!0,passive:o}):e.addEventListener(t,l,!0):o!==void 0?e.addEventListener(t,l,{passive:o}):e.addEventListener(t,l,!1)}function xc(e,t,l,i,o){var s=i;if((t&1)===0&&(t&2)===0&&i!==null)e:for(;;){if(i===null)return;var y=i.tag;if(y===3||y===4){var b=i.stateNode.containerInfo;if(b===o)break;if(y===4)for(y=i.return;y!==null;){var A=y.tag;if((A===3||A===4)&&y.stateNode.containerInfo===o)return;y=y.return}for(;b!==null;){if(y=Gl(b),y===null)return;if(A=y.tag,A===5||A===6||A===26||A===27){i=s=y;continue e}b=b.parentNode}}i=i.return}df(function(){var M=s,q=Uu(l),Q=[];e:{var R=qf.get(e);if(R!==void 0){var U=$r,se=e;switch(e){case"keypress":if(Jr(l)===0)break e;case"keydown":case"keyup":U=Ny;break;case"focusin":se="focus",U=Vu;break;case"focusout":se="blur",U=Vu;break;case"beforeblur":case"afterblur":U=Vu;break;case"click":if(l.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":U=mf;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":U=ky;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":U=jy;break;case Uf:case jf:case Bf:U=wy;break;case Hf:U=Hy;break;case"scroll":case"scrollend":U=xy;break;case"wheel":U=Yy;break;case"copy":case"cut":case"paste":U=Cy;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":U=yf;break;case"toggle":case"beforetoggle":U=Gy}var xe=(t&4)!==0,Je=!xe&&(e==="scroll"||e==="scrollend"),z=xe?R!==null?R+"Capture":null:R;xe=[];for(var T=M,O;T!==null;){var G=T;if(O=G.stateNode,G=G.tag,G!==5&&G!==26&&G!==27||O===null||z===null||(G=Hi(T,z),G!=null&&xe.push(vr(T,G,O))),Je)break;T=T.return}0<xe.length&&(R=new U(R,se,null,l,q),Q.push({event:R,listeners:xe}))}}if((t&7)===0){e:{if(R=e==="mouseover"||e==="pointerover",U=e==="mouseout"||e==="pointerout",R&&l!==Lu&&(se=l.relatedTarget||l.fromElement)&&(Gl(se)||se[Vl]))break e;if((U||R)&&(R=q.window===q?q:(R=q.ownerDocument)?R.defaultView||R.parentWindow:window,U?(se=l.relatedTarget||l.toElement,U=M,se=se?Gl(se):null,se!==null&&(Je=f(se),xe=se.tag,se!==Je||xe!==5&&xe!==27&&xe!==6)&&(se=null)):(U=null,se=M),U!==se)){if(xe=mf,G="onMouseLeave",z="onMouseEnter",T="mouse",(e==="pointerout"||e==="pointerover")&&(xe=yf,G="onPointerLeave",z="onPointerEnter",T="pointer"),Je=U==null?R:Bi(U),O=se==null?R:Bi(se),R=new xe(G,T+"leave",U,l,q),R.target=Je,R.relatedTarget=O,G=null,Gl(q)===M&&(xe=new xe(z,T+"enter",se,l,q),xe.target=O,xe.relatedTarget=Je,G=xe),Je=G,U&&se)t:{for(xe=V1,z=U,T=se,O=0,G=z;G;G=xe(G))O++;G=0;for(var ge=T;ge;ge=xe(ge))G++;for(;0<O-G;)z=xe(z),O--;for(;0<G-O;)T=xe(T),G--;for(;O--;){if(z===T||T!==null&&z===T.alternate){xe=z;break t}z=xe(z),T=xe(T)}xe=null}else xe=null;U!==null&&op(Q,R,U,xe,!1),se!==null&&Je!==null&&op(Q,Je,se,xe,!0)}}e:{if(R=M?Bi(M):window,U=R.nodeName&&R.nodeName.toLowerCase(),U==="select"||U==="input"&&R.type==="file")var qe=wf;else if(Ef(R))if(Tf)qe=Py;else{qe=Wy;var de=Jy}else U=R.nodeName,!U||U.toLowerCase()!=="input"||R.type!=="checkbox"&&R.type!=="radio"?M&&Nu(M.elementType)&&(qe=wf):qe=$y;if(qe&&(qe=qe(e,M))){Af(Q,qe,l,q);break e}de&&de(e,R,M),e==="focusout"&&M&&R.type==="number"&&M.memoizedProps.value!=null&&Ru(R,"number",R.value)}switch(de=M?Bi(M):window,e){case"focusin":(Ef(de)||de.contentEditable==="true")&&($l=de,Fu=M,Zi=null);break;case"focusout":Zi=Fu=$l=null;break;case"mousedown":Ku=!0;break;case"contextmenu":case"mouseup":case"dragend":Ku=!1,Nf(Q,l,q);break;case"selectionchange":if(t1)break;case"keydown":case"keyup":Nf(Q,l,q)}var _e;if(Xu)e:{switch(e){case"compositionstart":var Ue="onCompositionStart";break e;case"compositionend":Ue="onCompositionEnd";break e;case"compositionupdate":Ue="onCompositionUpdate";break e}Ue=void 0}else Wl?Sf(e,l)&&(Ue="onCompositionEnd"):e==="keydown"&&l.keyCode===229&&(Ue="onCompositionStart");Ue&&(vf&&l.locale!=="ko"&&(Wl||Ue!=="onCompositionStart"?Ue==="onCompositionEnd"&&Wl&&(_e=hf()):(Kn=q,Hu="value"in Kn?Kn.value:Kn.textContent,Wl=!0)),de=Va(M,Ue),0<de.length&&(Ue=new gf(Ue,e,null,l,q),Q.push({event:Ue,listeners:de}),_e?Ue.data=_e:(_e=kf(l),_e!==null&&(Ue.data=_e)))),(_e=Qy?Iy(e,l):Zy(e,l))&&(Ue=Va(M,"onBeforeInput"),0<Ue.length&&(de=new gf("onBeforeInput","beforeinput",null,l,q),Q.push({event:de,listeners:Ue}),de.data=_e)),B1(Q,e,M,l,q)}ap(Q,t)})}function vr(e,t,l){return{instance:e,listener:t,currentTarget:l}}function Va(e,t){for(var l=t+"Capture",i=[];e!==null;){var o=e,s=o.stateNode;if(o=o.tag,o!==5&&o!==26&&o!==27||s===null||(o=Hi(e,l),o!=null&&i.unshift(vr(e,o,s)),o=Hi(e,t),o!=null&&i.push(vr(e,o,s))),e.tag===3)return i;e=e.return}return[]}function V1(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function op(e,t,l,i,o){for(var s=t._reactName,y=[];l!==null&&l!==i;){var b=l,A=b.alternate,M=b.stateNode;if(b=b.tag,A!==null&&A===i)break;b!==5&&b!==26&&b!==27||M===null||(A=M,o?(M=Hi(l,s),M!=null&&y.unshift(vr(l,M,A))):o||(M=Hi(l,s),M!=null&&y.push(vr(l,M,A)))),l=l.return}y.length!==0&&e.push({event:t,listeners:y})}var G1=/\\r\\n?/g,X1=/\\u0000|\\uFFFD/g;function cp(e){return(typeof e=="string"?e:""+e).replace(G1,`\n`).replace(X1,"")}function sp(e,t){return t=cp(t),cp(e)===t}function Ke(e,t,l,i,o,s){switch(l){case"children":typeof i=="string"?t==="body"||t==="textarea"&&i===""||Fl(e,i):(typeof i=="number"||typeof i=="bigint")&&t!=="body"&&Fl(e,""+i);break;case"className":Ir(e,"class",i);break;case"tabIndex":Ir(e,"tabindex",i);break;case"dir":case"role":case"viewBox":case"width":case"height":Ir(e,l,i);break;case"style":sf(e,i,s);break;case"data":if(t!=="object"){Ir(e,"data",i);break}case"src":case"href":if(i===""&&(t!=="a"||l!=="href")){e.removeAttribute(l);break}if(i==null||typeof i=="function"||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Fr(""+i),e.setAttribute(l,i);break;case"action":case"formAction":if(typeof i=="function"){e.setAttribute(l,"javascript:throw new Error(\'A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\\\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().\')");break}else typeof s=="function"&&(l==="formAction"?(t!=="input"&&Ke(e,t,"name",o.name,o,null),Ke(e,t,"formEncType",o.formEncType,o,null),Ke(e,t,"formMethod",o.formMethod,o,null),Ke(e,t,"formTarget",o.formTarget,o,null)):(Ke(e,t,"encType",o.encType,o,null),Ke(e,t,"method",o.method,o,null),Ke(e,t,"target",o.target,o,null)));if(i==null||typeof i=="symbol"||typeof i=="boolean"){e.removeAttribute(l);break}i=Fr(""+i),e.setAttribute(l,i);break;case"onClick":i!=null&&(e.onclick=_n);break;case"onScroll":i!=null&&Re("scroll",e);break;case"onScrollEnd":i!=null&&Re("scrollend",e);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"multiple":e.multiple=i&&typeof i!="function"&&typeof i!="symbol";break;case"muted":e.muted=i&&typeof i!="function"&&typeof i!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(i==null||typeof i=="function"||typeof i=="boolean"||typeof i=="symbol"){e.removeAttribute("xlink:href");break}l=Fr(""+i),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",l);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""+i):e.removeAttribute(l);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":i&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,""):e.removeAttribute(l);break;case"capture":case"download":i===!0?e.setAttribute(l,""):i!==!1&&i!=null&&typeof i!="function"&&typeof i!="symbol"?e.setAttribute(l,i):e.removeAttribute(l);break;case"cols":case"rows":case"size":case"span":i!=null&&typeof i!="function"&&typeof i!="symbol"&&!isNaN(i)&&1<=i?e.setAttribute(l,i):e.removeAttribute(l);break;case"rowSpan":case"start":i==null||typeof i=="function"||typeof i=="symbol"||isNaN(i)?e.removeAttribute(l):e.setAttribute(l,i);break;case"popover":Re("beforetoggle",e),Re("toggle",e),Qr(e,"popover",i);break;case"xlinkActuate":zn(e,"http://www.w3.org/1999/xlink","xlink:actuate",i);break;case"xlinkArcrole":zn(e,"http://www.w3.org/1999/xlink","xlink:arcrole",i);break;case"xlinkRole":zn(e,"http://www.w3.org/1999/xlink","xlink:role",i);break;case"xlinkShow":zn(e,"http://www.w3.org/1999/xlink","xlink:show",i);break;case"xlinkTitle":zn(e,"http://www.w3.org/1999/xlink","xlink:title",i);break;case"xlinkType":zn(e,"http://www.w3.org/1999/xlink","xlink:type",i);break;case"xmlBase":zn(e,"http://www.w3.org/XML/1998/namespace","xml:base",i);break;case"xmlLang":zn(e,"http://www.w3.org/XML/1998/namespace","xml:lang",i);break;case"xmlSpace":zn(e,"http://www.w3.org/XML/1998/namespace","xml:space",i);break;case"is":Qr(e,"is",i);break;case"innerText":case"textContent":break;default:(!(2<l.length)||l[0]!=="o"&&l[0]!=="O"||l[1]!=="n"&&l[1]!=="N")&&(l=vy.get(l)||l,Qr(e,l,i))}}function Sc(e,t,l,i,o,s){switch(l){case"style":sf(e,i,s);break;case"dangerouslySetInnerHTML":if(i!=null){if(typeof i!="object"||!("__html"in i))throw Error(u(61));if(l=i.__html,l!=null){if(o.children!=null)throw Error(u(60));e.innerHTML=l}}break;case"children":typeof i=="string"?Fl(e,i):(typeof i=="number"||typeof i=="bigint")&&Fl(e,""+i);break;case"onScroll":i!=null&&Re("scroll",e);break;case"onScrollEnd":i!=null&&Re("scrollend",e);break;case"onClick":i!=null&&(e.onclick=_n);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!ef.hasOwnProperty(l))e:{if(l[0]==="o"&&l[1]==="n"&&(o=l.endsWith("Capture"),t=l.slice(2,o?l.length-7:void 0),s=e[Lt]||null,s=s!=null?s[l]:null,typeof s=="function"&&e.removeEventListener(t,s,o),typeof i=="function")){typeof s!="function"&&s!==null&&(l in e?e[l]=null:e.hasAttribute(l)&&e.removeAttribute(l)),e.addEventListener(t,i,o);break e}l in e?e[l]=i:i===!0?e.setAttribute(l,""):Qr(e,l,i)}}}function At(e,t,l){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":Re("error",e),Re("load",e);var i=!1,o=!1,s;for(s in l)if(l.hasOwnProperty(s)){var y=l[s];if(y!=null)switch(s){case"src":i=!0;break;case"srcSet":o=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Ke(e,t,s,y,l,null)}}o&&Ke(e,t,"srcSet",l.srcSet,l,null),i&&Ke(e,t,"src",l.src,l,null);return;case"input":Re("invalid",e);var b=s=y=o=null,A=null,M=null;for(i in l)if(l.hasOwnProperty(i)){var q=l[i];if(q!=null)switch(i){case"name":o=q;break;case"type":y=q;break;case"checked":A=q;break;case"defaultChecked":M=q;break;case"value":s=q;break;case"defaultValue":b=q;break;case"children":case"dangerouslySetInnerHTML":if(q!=null)throw Error(u(137,t));break;default:Ke(e,t,i,q,l,null)}}af(e,s,b,A,M,y,o,!1);return;case"select":Re("invalid",e),i=y=s=null;for(o in l)if(l.hasOwnProperty(o)&&(b=l[o],b!=null))switch(o){case"value":s=b;break;case"defaultValue":y=b;break;case"multiple":i=b;default:Ke(e,t,o,b,l,null)}t=s,l=y,e.multiple=!!i,t!=null?Zl(e,!!i,t,!1):l!=null&&Zl(e,!!i,l,!0);return;case"textarea":Re("invalid",e),s=o=i=null;for(y in l)if(l.hasOwnProperty(y)&&(b=l[y],b!=null))switch(y){case"value":i=b;break;case"defaultValue":o=b;break;case"children":s=b;break;case"dangerouslySetInnerHTML":if(b!=null)throw Error(u(91));break;default:Ke(e,t,y,b,l,null)}of(e,i,o,s);return;case"option":for(A in l)if(l.hasOwnProperty(A)&&(i=l[A],i!=null))switch(A){case"selected":e.selected=i&&typeof i!="function"&&typeof i!="symbol";break;default:Ke(e,t,A,i,l,null)}return;case"dialog":Re("beforetoggle",e),Re("toggle",e),Re("cancel",e),Re("close",e);break;case"iframe":case"object":Re("load",e);break;case"video":case"audio":for(i=0;i<yr.length;i++)Re(yr[i],e);break;case"image":Re("error",e),Re("load",e);break;case"details":Re("toggle",e);break;case"embed":case"source":case"link":Re("error",e),Re("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(M in l)if(l.hasOwnProperty(M)&&(i=l[M],i!=null))switch(M){case"children":case"dangerouslySetInnerHTML":throw Error(u(137,t));default:Ke(e,t,M,i,l,null)}return;default:if(Nu(t)){for(q in l)l.hasOwnProperty(q)&&(i=l[q],i!==void 0&&Sc(e,t,q,i,l,void 0));return}}for(b in l)l.hasOwnProperty(b)&&(i=l[b],i!=null&&Ke(e,t,b,i,l,null))}function Q1(e,t,l,i){switch(t){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var o=null,s=null,y=null,b=null,A=null,M=null,q=null;for(U in l){var Q=l[U];if(l.hasOwnProperty(U)&&Q!=null)switch(U){case"checked":break;case"value":break;case"defaultValue":A=Q;default:i.hasOwnProperty(U)||Ke(e,t,U,null,i,Q)}}for(var R in i){var U=i[R];if(Q=l[R],i.hasOwnProperty(R)&&(U!=null||Q!=null))switch(R){case"type":s=U;break;case"name":o=U;break;case"checked":M=U;break;case"defaultChecked":q=U;break;case"value":y=U;break;case"defaultValue":b=U;break;case"children":case"dangerouslySetInnerHTML":if(U!=null)throw Error(u(137,t));break;default:U!==Q&&Ke(e,t,R,U,i,Q)}}Mu(e,y,b,A,M,q,s,o);return;case"select":U=y=b=R=null;for(s in l)if(A=l[s],l.hasOwnProperty(s)&&A!=null)switch(s){case"value":break;case"multiple":U=A;default:i.hasOwnProperty(s)||Ke(e,t,s,null,i,A)}for(o in i)if(s=i[o],A=l[o],i.hasOwnProperty(o)&&(s!=null||A!=null))switch(o){case"value":R=s;break;case"defaultValue":b=s;break;case"multiple":y=s;default:s!==A&&Ke(e,t,o,s,i,A)}t=b,l=y,i=U,R!=null?Zl(e,!!l,R,!1):!!i!=!!l&&(t!=null?Zl(e,!!l,t,!0):Zl(e,!!l,l?[]:"",!1));return;case"textarea":U=R=null;for(b in l)if(o=l[b],l.hasOwnProperty(b)&&o!=null&&!i.hasOwnProperty(b))switch(b){case"value":break;case"children":break;default:Ke(e,t,b,null,i,o)}for(y in i)if(o=i[y],s=l[y],i.hasOwnProperty(y)&&(o!=null||s!=null))switch(y){case"value":R=o;break;case"defaultValue":U=o;break;case"children":break;case"dangerouslySetInnerHTML":if(o!=null)throw Error(u(91));break;default:o!==s&&Ke(e,t,y,o,i,s)}uf(e,R,U);return;case"option":for(var se in l)if(R=l[se],l.hasOwnProperty(se)&&R!=null&&!i.hasOwnProperty(se))switch(se){case"selected":e.selected=!1;break;default:Ke(e,t,se,null,i,R)}for(A in i)if(R=i[A],U=l[A],i.hasOwnProperty(A)&&R!==U&&(R!=null||U!=null))switch(A){case"selected":e.selected=R&&typeof R!="function"&&typeof R!="symbol";break;default:Ke(e,t,A,R,i,U)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var xe in l)R=l[xe],l.hasOwnProperty(xe)&&R!=null&&!i.hasOwnProperty(xe)&&Ke(e,t,xe,null,i,R);for(M in i)if(R=i[M],U=l[M],i.hasOwnProperty(M)&&R!==U&&(R!=null||U!=null))switch(M){case"children":case"dangerouslySetInnerHTML":if(R!=null)throw Error(u(137,t));break;default:Ke(e,t,M,R,i,U)}return;default:if(Nu(t)){for(var Je in l)R=l[Je],l.hasOwnProperty(Je)&&R!==void 0&&!i.hasOwnProperty(Je)&&Sc(e,t,Je,void 0,i,R);for(q in i)R=i[q],U=l[q],!i.hasOwnProperty(q)||R===U||R===void 0&&U===void 0||Sc(e,t,q,R,i,U);return}}for(var z in l)R=l[z],l.hasOwnProperty(z)&&R!=null&&!i.hasOwnProperty(z)&&Ke(e,t,z,null,i,R);for(Q in i)R=i[Q],U=l[Q],!i.hasOwnProperty(Q)||R===U||R==null&&U==null||Ke(e,t,Q,R,i,U)}function fp(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function I1(){if(typeof performance.getEntriesByType=="function"){for(var e=0,t=0,l=performance.getEntriesByType("resource"),i=0;i<l.length;i++){var o=l[i],s=o.transferSize,y=o.initiatorType,b=o.duration;if(s&&b&&fp(y)){for(y=0,b=o.responseEnd,i+=1;i<l.length;i++){var A=l[i],M=A.startTime;if(M>b)break;var q=A.transferSize,Q=A.initiatorType;q&&fp(Q)&&(A=A.responseEnd,y+=q*(A<b?1:(b-M)/(A-M)))}if(--i,t+=8*(s+y)/(o.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var kc=null,Ec=null;function Ga(e){return e.nodeType===9?e:e.ownerDocument}function dp(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function hp(e,t){if(e===0)switch(t){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&t==="foreignObject"?0:e}function Ac(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.children=="bigint"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var wc=null;function Z1(){var e=window.event;return e&&e.type==="popstate"?e===wc?!1:(wc=e,!0):(wc=null,!1)}var pp=typeof setTimeout=="function"?setTimeout:void 0,F1=typeof clearTimeout=="function"?clearTimeout:void 0,mp=typeof Promise=="function"?Promise:void 0,K1=typeof queueMicrotask=="function"?queueMicrotask:typeof mp<"u"?function(e){return mp.resolve(null).then(e).catch(J1)}:pp;function J1(e){setTimeout(function(){throw e})}function dl(e){return e==="head"}function gp(e,t){var l=t,i=0;do{var o=l.nextSibling;if(e.removeChild(l),o&&o.nodeType===8)if(l=o.data,l==="/$"||l==="/&"){if(i===0){e.removeChild(o),wi(t);return}i--}else if(l==="$"||l==="$?"||l==="$~"||l==="$!"||l==="&")i++;else if(l==="html")br(e.ownerDocument.documentElement);else if(l==="head"){l=e.ownerDocument.head,br(l);for(var s=l.firstChild;s;){var y=s.nextSibling,b=s.nodeName;s[ji]||b==="SCRIPT"||b==="STYLE"||b==="LINK"&&s.rel.toLowerCase()==="stylesheet"||l.removeChild(s),s=y}}else l==="body"&&br(e.ownerDocument.body);l=o}while(l);wi(t)}function yp(e,t){var l=e;e=0;do{var i=l.nextSibling;if(l.nodeType===1?t?(l._stashedDisplay=l.style.display,l.style.display="none"):(l.style.display=l._stashedDisplay||"",l.getAttribute("style")===""&&l.removeAttribute("style")):l.nodeType===3&&(t?(l._stashedText=l.nodeValue,l.nodeValue=""):l.nodeValue=l._stashedText||""),i&&i.nodeType===8)if(l=i.data,l==="/$"){if(e===0)break;e--}else l!=="$"&&l!=="$?"&&l!=="$~"&&l!=="$!"||e++;l=i}while(l)}function Tc(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var l=t;switch(t=t.nextSibling,l.nodeName){case"HTML":case"HEAD":case"BODY":Tc(l),Ou(l);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(l.rel.toLowerCase()==="stylesheet")continue}e.removeChild(l)}}function W1(e,t,l,i){for(;e.nodeType===1;){var o=l;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!i&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(i){if(!e[ji])switch(t){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(s=e.getAttribute("rel"),s==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(s!==o.rel||e.getAttribute("href")!==(o.href==null||o.href===""?null:o.href)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin)||e.getAttribute("title")!==(o.title==null?null:o.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(s=e.getAttribute("src"),(s!==(o.src==null?null:o.src)||e.getAttribute("type")!==(o.type==null?null:o.type)||e.getAttribute("crossorigin")!==(o.crossOrigin==null?null:o.crossOrigin))&&s&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(t==="input"&&e.type==="hidden"){var s=o.name==null?null:""+o.name;if(o.type==="hidden"&&e.getAttribute("name")===s)return e}else return e;if(e=fn(e.nextSibling),e===null)break}return null}function $1(e,t,l){if(t==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!l||(e=fn(e.nextSibling),e===null))return null;return e}function vp(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!t||(e=fn(e.nextSibling),e===null))return null;return e}function Cc(e){return e.data==="$?"||e.data==="$~"}function zc(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function P1(e,t){var l=e.ownerDocument;if(e.data==="$~")e._reactRetry=t;else if(e.data!=="$?"||l.readyState!=="loading")t();else{var i=function(){t(),l.removeEventListener("DOMContentLoaded",i)};l.addEventListener("DOMContentLoaded",i),e._reactRetry=i}}function fn(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?"||t==="$~"||t==="&"||t==="F!"||t==="F")break;if(t==="/$"||t==="/&")return null}}return e}var _c=null;function bp(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="/$"||l==="/&"){if(t===0)return fn(e.nextSibling);t--}else l!=="$"&&l!=="$!"&&l!=="$?"&&l!=="$~"&&l!=="&"||t++}e=e.nextSibling}return null}function xp(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var l=e.data;if(l==="$"||l==="$!"||l==="$?"||l==="$~"||l==="&"){if(t===0)return e;t--}else l!=="/$"&&l!=="/&"||t++}e=e.previousSibling}return null}function Sp(e,t,l){switch(t=Ga(l),e){case"html":if(e=t.documentElement,!e)throw Error(u(452));return e;case"head":if(e=t.head,!e)throw Error(u(453));return e;case"body":if(e=t.body,!e)throw Error(u(454));return e;default:throw Error(u(451))}}function br(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);Ou(e)}var dn=new Map,kp=new Set;function Xa(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Qn=K.d;K.d={f:ev,r:tv,D:nv,C:lv,L:iv,m:rv,X:uv,S:av,M:ov};function ev(){var e=Qn.f(),t=La();return e||t}function tv(e){var t=Xl(e);t!==null&&t.tag===5&&t.type==="form"?Hd(t):Qn.r(e)}var ki=typeof document>"u"?null:document;function Ep(e,t,l){var i=ki;if(i&&typeof t=="string"&&t){var o=ln(t);o=\'link[rel="\'+e+\'"][href="\'+o+\'"]\',typeof l=="string"&&(o+=\'[crossorigin="\'+l+\'"]\'),kp.has(o)||(kp.add(o),e={rel:e,crossOrigin:l,href:t},i.querySelector(o)===null&&(t=i.createElement("link"),At(t,"link",e),yt(t),i.head.appendChild(t)))}}function nv(e){Qn.D(e),Ep("dns-prefetch",e,null)}function lv(e,t){Qn.C(e,t),Ep("preconnect",e,t)}function iv(e,t,l){Qn.L(e,t,l);var i=ki;if(i&&e&&t){var o=\'link[rel="preload"][as="\'+ln(t)+\'"]\';t==="image"&&l&&l.imageSrcSet?(o+=\'[imagesrcset="\'+ln(l.imageSrcSet)+\'"]\',typeof l.imageSizes=="string"&&(o+=\'[imagesizes="\'+ln(l.imageSizes)+\'"]\')):o+=\'[href="\'+ln(e)+\'"]\';var s=o;switch(t){case"style":s=Ei(e);break;case"script":s=Ai(e)}dn.has(s)||(e=g({rel:"preload",href:t==="image"&&l&&l.imageSrcSet?void 0:e,as:t},l),dn.set(s,e),i.querySelector(o)!==null||t==="style"&&i.querySelector(xr(s))||t==="script"&&i.querySelector(Sr(s))||(t=i.createElement("link"),At(t,"link",e),yt(t),i.head.appendChild(t)))}}function rv(e,t){Qn.m(e,t);var l=ki;if(l&&e){var i=t&&typeof t.as=="string"?t.as:"script",o=\'link[rel="modulepreload"][as="\'+ln(i)+\'"][href="\'+ln(e)+\'"]\',s=o;switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":s=Ai(e)}if(!dn.has(s)&&(e=g({rel:"modulepreload",href:e},t),dn.set(s,e),l.querySelector(o)===null)){switch(i){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(l.querySelector(Sr(s)))return}i=l.createElement("link"),At(i,"link",e),yt(i),l.head.appendChild(i)}}}function av(e,t,l){Qn.S(e,t,l);var i=ki;if(i&&e){var o=Ql(i).hoistableStyles,s=Ei(e);t=t||"default";var y=o.get(s);if(!y){var b={loading:0,preload:null};if(y=i.querySelector(xr(s)))b.loading=5;else{e=g({rel:"stylesheet",href:e,"data-precedence":t},l),(l=dn.get(s))&&Oc(e,l);var A=y=i.createElement("link");yt(A),At(A,"link",e),A._p=new Promise(function(M,q){A.onload=M,A.onerror=q}),A.addEventListener("load",function(){b.loading|=1}),A.addEventListener("error",function(){b.loading|=2}),b.loading|=4,Qa(y,t,i)}y={type:"stylesheet",instance:y,count:1,state:b},o.set(s,y)}}}function uv(e,t){Qn.X(e,t);var l=ki;if(l&&e){var i=Ql(l).hoistableScripts,o=Ai(e),s=i.get(o);s||(s=l.querySelector(Sr(o)),s||(e=g({src:e,async:!0},t),(t=dn.get(o))&&Dc(e,t),s=l.createElement("script"),yt(s),At(s,"link",e),l.head.appendChild(s)),s={type:"script",instance:s,count:1,state:null},i.set(o,s))}}function ov(e,t){Qn.M(e,t);var l=ki;if(l&&e){var i=Ql(l).hoistableScripts,o=Ai(e),s=i.get(o);s||(s=l.querySelector(Sr(o)),s||(e=g({src:e,async:!0,type:"module"},t),(t=dn.get(o))&&Dc(e,t),s=l.createElement("script"),yt(s),At(s,"link",e),l.head.appendChild(s)),s={type:"script",instance:s,count:1,state:null},i.set(o,s))}}function Ap(e,t,l,i){var o=(o=fe.current)?Xa(o):null;if(!o)throw Error(u(446));switch(e){case"meta":case"title":return null;case"style":return typeof l.precedence=="string"&&typeof l.href=="string"?(t=Ei(l.href),l=Ql(o).hoistableStyles,i=l.get(t),i||(i={type:"style",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};case"link":if(l.rel==="stylesheet"&&typeof l.href=="string"&&typeof l.precedence=="string"){e=Ei(l.href);var s=Ql(o).hoistableStyles,y=s.get(e);if(y||(o=o.ownerDocument||o,y={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},s.set(e,y),(s=o.querySelector(xr(e)))&&!s._p&&(y.instance=s,y.state.loading=5),dn.has(e)||(l={rel:"preload",as:"style",href:l.href,crossOrigin:l.crossOrigin,integrity:l.integrity,media:l.media,hrefLang:l.hrefLang,referrerPolicy:l.referrerPolicy},dn.set(e,l),s||cv(o,e,l,y.state))),t&&i===null)throw Error(u(528,""));return y}if(t&&i!==null)throw Error(u(529,""));return null;case"script":return t=l.async,l=l.src,typeof l=="string"&&t&&typeof t!="function"&&typeof t!="symbol"?(t=Ai(l),l=Ql(o).hoistableScripts,i=l.get(t),i||(i={type:"script",instance:null,count:0,state:null},l.set(t,i)),i):{type:"void",instance:null,count:0,state:null};default:throw Error(u(444,e))}}function Ei(e){return\'href="\'+ln(e)+\'"\'}function xr(e){return\'link[rel="stylesheet"][\'+e+"]"}function wp(e){return g({},e,{"data-precedence":e.precedence,precedence:null})}function cv(e,t,l,i){e.querySelector(\'link[rel="preload"][as="style"][\'+t+"]")?i.loading=1:(t=e.createElement("link"),i.preload=t,t.addEventListener("load",function(){return i.loading|=1}),t.addEventListener("error",function(){return i.loading|=2}),At(t,"link",l),yt(t),e.head.appendChild(t))}function Ai(e){return\'[src="\'+ln(e)+\'"]\'}function Sr(e){return"script[async]"+e}function Tp(e,t,l){if(t.count++,t.instance===null)switch(t.type){case"style":var i=e.querySelector(\'style[data-href~="\'+ln(l.href)+\'"]\');if(i)return t.instance=i,yt(i),i;var o=g({},l,{"data-href":l.href,"data-precedence":l.precedence,href:null,precedence:null});return i=(e.ownerDocument||e).createElement("style"),yt(i),At(i,"style",o),Qa(i,l.precedence,e),t.instance=i;case"stylesheet":o=Ei(l.href);var s=e.querySelector(xr(o));if(s)return t.state.loading|=4,t.instance=s,yt(s),s;i=wp(l),(o=dn.get(o))&&Oc(i,o),s=(e.ownerDocument||e).createElement("link"),yt(s);var y=s;return y._p=new Promise(function(b,A){y.onload=b,y.onerror=A}),At(s,"link",i),t.state.loading|=4,Qa(s,l.precedence,e),t.instance=s;case"script":return s=Ai(l.src),(o=e.querySelector(Sr(s)))?(t.instance=o,yt(o),o):(i=l,(o=dn.get(s))&&(i=g({},l),Dc(i,o)),e=e.ownerDocument||e,o=e.createElement("script"),yt(o),At(o,"link",i),e.head.appendChild(o),t.instance=o);case"void":return null;default:throw Error(u(443,t.type))}else t.type==="stylesheet"&&(t.state.loading&4)===0&&(i=t.instance,t.state.loading|=4,Qa(i,l.precedence,e));return t.instance}function Qa(e,t,l){for(var i=l.querySelectorAll(\'link[rel="stylesheet"][data-precedence],style[data-precedence]\'),o=i.length?i[i.length-1]:null,s=o,y=0;y<i.length;y++){var b=i[y];if(b.dataset.precedence===t)s=b;else if(s!==o)break}s?s.parentNode.insertBefore(e,s.nextSibling):(t=l.nodeType===9?l.head:l,t.insertBefore(e,t.firstChild))}function Oc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.title==null&&(e.title=t.title)}function Dc(e,t){e.crossOrigin==null&&(e.crossOrigin=t.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=t.referrerPolicy),e.integrity==null&&(e.integrity=t.integrity)}var Ia=null;function Cp(e,t,l){if(Ia===null){var i=new Map,o=Ia=new Map;o.set(l,i)}else o=Ia,i=o.get(l),i||(i=new Map,o.set(l,i));if(i.has(e))return i;for(i.set(e,null),l=l.getElementsByTagName(e),o=0;o<l.length;o++){var s=l[o];if(!(s[ji]||s[xt]||e==="link"&&s.getAttribute("rel")==="stylesheet")&&s.namespaceURI!=="http://www.w3.org/2000/svg"){var y=s.getAttribute(t)||"";y=e+y;var b=i.get(y);b?b.push(s):i.set(y,[s])}}return i}function zp(e,t,l){e=e.ownerDocument||e,e.head.insertBefore(l,t==="title"?e.querySelector("head > title"):null)}function sv(e,t,l){if(l===1||t.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof t.precedence!="string"||typeof t.href!="string"||t.href==="")break;return!0;case"link":if(typeof t.rel!="string"||typeof t.href!="string"||t.href===""||t.onLoad||t.onError)break;switch(t.rel){case"stylesheet":return e=t.disabled,typeof t.precedence=="string"&&e==null;default:return!0}case"script":if(t.async&&typeof t.async!="function"&&typeof t.async!="symbol"&&!t.onLoad&&!t.onError&&t.src&&typeof t.src=="string")return!0}return!1}function _p(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function fv(e,t,l,i){if(l.type==="stylesheet"&&(typeof i.media!="string"||matchMedia(i.media).matches!==!1)&&(l.state.loading&4)===0){if(l.instance===null){var o=Ei(i.href),s=t.querySelector(xr(o));if(s){t=s._p,t!==null&&typeof t=="object"&&typeof t.then=="function"&&(e.count++,e=Za.bind(e),t.then(e,e)),l.state.loading|=4,l.instance=s,yt(s);return}s=t.ownerDocument||t,i=wp(i),(o=dn.get(o))&&Oc(i,o),s=s.createElement("link"),yt(s);var y=s;y._p=new Promise(function(b,A){y.onload=b,y.onerror=A}),At(s,"link",i),l.instance=s}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(l,t),(t=l.state.preload)&&(l.state.loading&3)===0&&(e.count++,l=Za.bind(e),t.addEventListener("load",l),t.addEventListener("error",l))}}var Mc=0;function dv(e,t){return e.stylesheets&&e.count===0&&Ka(e,e.stylesheets),0<e.count||0<e.imgCount?function(l){var i=setTimeout(function(){if(e.stylesheets&&Ka(e,e.stylesheets),e.unsuspend){var s=e.unsuspend;e.unsuspend=null,s()}},6e4+t);0<e.imgBytes&&Mc===0&&(Mc=62500*I1());var o=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Ka(e,e.stylesheets),e.unsuspend)){var s=e.unsuspend;e.unsuspend=null,s()}},(e.imgBytes>Mc?50:800)+t);return e.unsuspend=l,function(){e.unsuspend=null,clearTimeout(i),clearTimeout(o)}}:null}function Za(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Ka(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Fa=null;function Ka(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Fa=new Map,t.forEach(hv,e),Fa=null,Za.call(e))}function hv(e,t){if(!(t.state.loading&4)){var l=Fa.get(e);if(l)var i=l.get(null);else{l=new Map,Fa.set(e,l);for(var o=e.querySelectorAll("link[data-precedence],style[data-precedence]"),s=0;s<o.length;s++){var y=o[s];(y.nodeName==="LINK"||y.getAttribute("media")!=="not all")&&(l.set(y.dataset.precedence,y),i=y)}i&&l.set(null,i)}o=t.instance,y=o.getAttribute("data-precedence"),s=l.get(y)||i,s===i&&l.set(null,o),l.set(y,o),this.count++,i=Za.bind(this),o.addEventListener("load",i),o.addEventListener("error",i),s?s.parentNode.insertBefore(o,s.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(o,e.firstChild)),t.state.loading|=4}}var kr={$$typeof:Y,Provider:null,Consumer:null,_currentValue:ce,_currentValue2:ce,_threadCount:0};function pv(e,t,l,i,o,s,y,b,A){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=Tu(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=Tu(0),this.hiddenUpdates=Tu(null),this.identifierPrefix=i,this.onUncaughtError=o,this.onCaughtError=s,this.onRecoverableError=y,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=A,this.incompleteTransitions=new Map}function Op(e,t,l,i,o,s,y,b,A,M,q,Q){return e=new pv(e,t,l,y,A,M,q,Q,b),t=1,s===!0&&(t|=24),s=It(3,null,null,t),e.current=s,s.stateNode=e,t=so(),t.refCount++,e.pooledCache=t,t.refCount++,s.memoizedState={element:i,isDehydrated:l,cache:t},mo(s),e}function Dp(e){return e?(e=ti,e):ti}function Mp(e,t,l,i,o,s){o=Dp(o),i.context===null?i.context=o:i.pendingContext=o,i=tl(t),i.payload={element:l},s=s===void 0?null:s,s!==null&&(i.callback=s),l=nl(e,i,t),l!==null&&(Yt(l,e,t),er(l,e,t))}function Rp(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var l=e.retryLane;e.retryLane=l!==0&&l<t?l:t}}function Rc(e,t){Rp(e,t),(e=e.alternate)&&Rp(e,t)}function Np(e){if(e.tag===13||e.tag===31){var t=wl(e,67108864);t!==null&&Yt(t,e,67108864),Rc(e,67108864)}}function Lp(e){if(e.tag===13||e.tag===31){var t=Wt();t=Cu(t);var l=wl(e,t);l!==null&&Yt(l,e,t),Rc(e,t)}}var Ja=!0;function mv(e,t,l,i){var o=D.T;D.T=null;var s=K.p;try{K.p=2,Nc(e,t,l,i)}finally{K.p=s,D.T=o}}function gv(e,t,l,i){var o=D.T;D.T=null;var s=K.p;try{K.p=8,Nc(e,t,l,i)}finally{K.p=s,D.T=o}}function Nc(e,t,l,i){if(Ja){var o=Lc(i);if(o===null)xc(e,t,i,Wa,l),jp(e,i);else if(vv(o,e,t,l,i))i.stopPropagation();else if(jp(e,i),t&4&&-1<yv.indexOf(e)){for(;o!==null;){var s=Xl(o);if(s!==null)switch(s.tag){case 3:if(s=s.stateNode,s.current.memoizedState.isDehydrated){var y=xl(s.pendingLanes);if(y!==0){var b=s;for(b.pendingLanes|=2,b.entangledLanes|=2;y;){var A=1<<31-We(y);b.entanglements[1]|=A,y&=~A}En(s),(Ve&6)===0&&(Ra=Ot()+500,gr(0))}}break;case 31:case 13:b=wl(s,2),b!==null&&Yt(b,s,2),La(),Rc(s,2)}if(s=Lc(i),s===null&&xc(e,t,i,Wa,l),s===o)break;o=s}o!==null&&i.stopPropagation()}else xc(e,t,i,null,l)}}function Lc(e){return e=Uu(e),Uc(e)}var Wa=null;function Uc(e){if(Wa=null,e=Gl(e),e!==null){var t=f(e);if(t===null)e=null;else{var l=t.tag;if(l===13){if(e=d(t),e!==null)return e;e=null}else if(l===31){if(e=h(t),e!==null)return e;e=null}else if(l===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return Wa=e,null}function Up(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(wu()){case V:return 2;case P:return 8;case Ee:case De:return 32;case Ge:return 268435456;default:return 32}default:return 32}}var jc=!1,hl=null,pl=null,ml=null,Er=new Map,Ar=new Map,gl=[],yv="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function jp(e,t){switch(e){case"focusin":case"focusout":hl=null;break;case"dragenter":case"dragleave":pl=null;break;case"mouseover":case"mouseout":ml=null;break;case"pointerover":case"pointerout":Er.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":Ar.delete(t.pointerId)}}function wr(e,t,l,i,o,s){return e===null||e.nativeEvent!==s?(e={blockedOn:t,domEventName:l,eventSystemFlags:i,nativeEvent:s,targetContainers:[o]},t!==null&&(t=Xl(t),t!==null&&Np(t)),e):(e.eventSystemFlags|=i,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function vv(e,t,l,i,o){switch(t){case"focusin":return hl=wr(hl,e,t,l,i,o),!0;case"dragenter":return pl=wr(pl,e,t,l,i,o),!0;case"mouseover":return ml=wr(ml,e,t,l,i,o),!0;case"pointerover":var s=o.pointerId;return Er.set(s,wr(Er.get(s)||null,e,t,l,i,o)),!0;case"gotpointercapture":return s=o.pointerId,Ar.set(s,wr(Ar.get(s)||null,e,t,l,i,o)),!0}return!1}function Bp(e){var t=Gl(e.target);if(t!==null){var l=f(t);if(l!==null){if(t=l.tag,t===13){if(t=d(l),t!==null){e.blockedOn=t,Ws(e.priority,function(){Lp(l)});return}}else if(t===31){if(t=h(l),t!==null){e.blockedOn=t,Ws(e.priority,function(){Lp(l)});return}}else if(t===3&&l.stateNode.current.memoizedState.isDehydrated){e.blockedOn=l.tag===3?l.stateNode.containerInfo:null;return}}}e.blockedOn=null}function $a(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var l=Lc(e.nativeEvent);if(l===null){l=e.nativeEvent;var i=new l.constructor(l.type,l);Lu=i,l.target.dispatchEvent(i),Lu=null}else return t=Xl(l),t!==null&&Np(t),e.blockedOn=l,!1;t.shift()}return!0}function Hp(e,t,l){$a(e)&&l.delete(t)}function bv(){jc=!1,hl!==null&&$a(hl)&&(hl=null),pl!==null&&$a(pl)&&(pl=null),ml!==null&&$a(ml)&&(ml=null),Er.forEach(Hp),Ar.forEach(Hp)}function Pa(e,t){e.blockedOn===t&&(e.blockedOn=null,jc||(jc=!0,n.unstable_scheduleCallback(n.unstable_NormalPriority,bv)))}var eu=null;function qp(e){eu!==e&&(eu=e,n.unstable_scheduleCallback(n.unstable_NormalPriority,function(){eu===e&&(eu=null);for(var t=0;t<e.length;t+=3){var l=e[t],i=e[t+1],o=e[t+2];if(typeof i!="function"){if(Uc(i||l)===null)continue;break}var s=Xl(l);s!==null&&(e.splice(t,3),t-=3,Lo(s,{pending:!0,data:o,method:l.method,action:i},i,o))}}))}function wi(e){function t(A){return Pa(A,e)}hl!==null&&Pa(hl,e),pl!==null&&Pa(pl,e),ml!==null&&Pa(ml,e),Er.forEach(t),Ar.forEach(t);for(var l=0;l<gl.length;l++){var i=gl[l];i.blockedOn===e&&(i.blockedOn=null)}for(;0<gl.length&&(l=gl[0],l.blockedOn===null);)Bp(l),l.blockedOn===null&&gl.shift();if(l=(e.ownerDocument||e).$$reactFormReplay,l!=null)for(i=0;i<l.length;i+=3){var o=l[i],s=l[i+1],y=o[Lt]||null;if(typeof s=="function")y||qp(l);else if(y){var b=null;if(s&&s.hasAttribute("formAction")){if(o=s,y=s[Lt]||null)b=y.formAction;else if(Uc(o)!==null)continue}else b=y.action;typeof b=="function"?l[i+1]=b:(l.splice(i,3),i-=3),qp(l)}}}function Yp(){function e(s){s.canIntercept&&s.info==="react-transition"&&s.intercept({handler:function(){return new Promise(function(y){return o=y})},focusReset:"manual",scroll:"manual"})}function t(){o!==null&&(o(),o=null),i||setTimeout(l,20)}function l(){if(!i&&!navigation.transition){var s=navigation.currentEntry;s&&s.url!=null&&navigation.navigate(s.url,{state:s.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var i=!1,o=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",t),navigation.addEventListener("navigateerror",t),setTimeout(l,100),function(){i=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",t),navigation.removeEventListener("navigateerror",t),o!==null&&(o(),o=null)}}}function Bc(e){this._internalRoot=e}tu.prototype.render=Bc.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(u(409));var l=t.current,i=Wt();Mp(l,i,e,t,null,null)},tu.prototype.unmount=Bc.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;Mp(e.current,2,null,e,null,null),La(),t[Vl]=null}};function tu(e){this._internalRoot=e}tu.prototype.unstable_scheduleHydration=function(e){if(e){var t=Js();e={blockedOn:null,target:e,priority:t};for(var l=0;l<gl.length&&t!==0&&t<gl[l].priority;l++);gl.splice(l,0,e),l===0&&Bp(e)}};var Vp=r.version;if(Vp!=="19.2.6")throw Error(u(527,Vp,"19.2.6"));K.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(u(188)):(e=Object.keys(e).join(","),Error(u(268,e)));return e=p(t),e=e!==null?v(e):null,e=e===null?null:e.stateNode,e};var xv={bundleType:0,version:"19.2.6",rendererPackageName:"react-dom",currentDispatcherRef:D,reconcilerVersion:"19.2.6"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var nu=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!nu.isDisabled&&nu.supportsFiber)try{Dt=nu.inject(xv),mt=nu}catch{}}return Cr.createRoot=function(e,t){if(!c(e))throw Error(u(299));var l=!1,i="",o=Kd,s=Jd,y=Wd;return t!=null&&(t.unstable_strictMode===!0&&(l=!0),t.identifierPrefix!==void 0&&(i=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(s=t.onCaughtError),t.onRecoverableError!==void 0&&(y=t.onRecoverableError)),t=Op(e,1,!1,null,null,l,i,null,o,s,y,Yp),e[Vl]=t.current,bc(e),new Bc(t)},Cr.hydrateRoot=function(e,t,l){if(!c(e))throw Error(u(299));var i=!1,o="",s=Kd,y=Jd,b=Wd,A=null;return l!=null&&(l.unstable_strictMode===!0&&(i=!0),l.identifierPrefix!==void 0&&(o=l.identifierPrefix),l.onUncaughtError!==void 0&&(s=l.onUncaughtError),l.onCaughtError!==void 0&&(y=l.onCaughtError),l.onRecoverableError!==void 0&&(b=l.onRecoverableError),l.formState!==void 0&&(A=l.formState)),t=Op(e,1,!0,t,l??null,i,o,A,s,y,b,Yp),t.context=Dp(null),l=t.current,i=Wt(),i=Cu(i),o=tl(i),o.callback=null,nl(l,o,i),l=i,t.current.lanes=l,Ui(t,l),En(t),e[Vl]=t.current,bc(e),new tu(t)},Cr.version="19.2.6",Cr}var $p;function Ov(){if($p)return Yc.exports;$p=1;function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(r){console.error(r)}}return n(),Yc.exports=_v(),Yc.exports}var Dv=Ov();function Mv(){return I.jsxs("main",{className:"duplicate-page",children:[I.jsxs("svg",{width:"48",height:"48",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:[I.jsx("circle",{cx:"12",cy:"12",r:"10"}),I.jsx("path",{d:"m4.9 4.9 14.2 14.2"})]}),I.jsx("h1",{children:"Session unavailable"}),I.jsx("p",{children:"Another browser window is already connected to this Voice Agent. Close the other session and refresh this page."})]})}const Pp=n=>Symbol.iterator in n,em=n=>"entries"in n,tm=(n,r)=>{const a=n instanceof Map?n:new Map(n.entries()),u=r instanceof Map?r:new Map(r.entries());if(a.size!==u.size)return!1;for(const[c,f]of a)if(!u.has(c)||!Object.is(f,u.get(c)))return!1;return!0},Rv=(n,r)=>{const a=n[Symbol.iterator](),u=r[Symbol.iterator]();let c=a.next(),f=u.next();for(;!c.done&&!f.done;){if(!Object.is(c.value,f.value))return!1;c=a.next(),f=u.next()}return!!c.done&&!!f.done};function Nv(n,r){return Object.is(n,r)?!0:typeof n!="object"||n===null||typeof r!="object"||r===null||Object.getPrototypeOf(n)!==Object.getPrototypeOf(r)?!1:Pp(n)&&Pp(r)?em(n)&&em(r)?tm(n,r):Rv(n,r):tm({entries:()=>Object.entries(n)},{entries:()=>Object.entries(r)})}function vu(n){const r=Mr.useRef(void 0);return a=>{const u=n(a);return Nv(r.current,u)?r.current:r.current=u}}const nm=n=>{let r;const a=new Set,u=(p,v)=>{const g=typeof p=="function"?p(r):p;if(!Object.is(g,r)){const x=r;r=v??(typeof g!="object"||g===null)?g:Object.assign({},r,g),a.forEach(S=>S(r,x))}},c=()=>r,h={setState:u,getState:c,getInitialState:()=>m,subscribe:p=>(a.add(p),()=>a.delete(p))},m=r=n(u,c,h);return h},Lv=(n=>n?nm(n):nm),Uv=n=>n;function jv(n,r=Uv){const a=Mr.useSyncExternalStore(n.subscribe,Mr.useCallback(()=>r(n.getState()),[n,r]),Mr.useCallback(()=>r(n.getInitialState()),[n,r]));return Mr.useDebugValue(a),a}const Bv=(n,r)=>(a,u,c)=>(c.dispatch=f=>(a(d=>n(d,f),!1,f),f),c.dispatchFromDevtools=!0,{dispatch:(...f)=>c.dispatch(...f),...r}),Hv=Bv;function qv(n,r){let a;try{a=n()}catch{return}return{getItem:c=>{var f;const d=m=>m===null?null:JSON.parse(m,void 0),h=(f=a.getItem(c))!=null?f:null;return h instanceof Promise?h.then(d):d(h)},setItem:(c,f)=>a.setItem(c,JSON.stringify(f,void 0)),removeItem:c=>a.removeItem(c)}}const ss=n=>r=>{try{const a=n(r);return a instanceof Promise?a:{then(u){return ss(u)(a)},catch(u){return this}}}catch(a){return{then(u){return this},catch(u){return ss(u)(a)}}}},Yv=(n,r)=>(a,u,c)=>{let f={storage:qv(()=>window.localStorage),partialize:j=>j,version:0,merge:(j,_)=>({..._,...j}),...r},d=!1,h=0;const m=new Set,p=new Set;let v=f.storage;if(!v)return n((...j)=>{console.warn(`[zustand persist middleware] Unable to update item \'${f.name}\', the given storage is currently unavailable.`),a(...j)},u,c);const g=()=>{const j=f.partialize({...u()});return v.setItem(f.name,{state:j,version:f.version})},x=c.setState;c.setState=(j,_)=>(x(j,_),g());const S=n((...j)=>(a(...j),g()),u,c);c.getInitialState=()=>S;let C;const B=()=>{var j,_;if(!v)return;const F=++h;d=!1,m.forEach(le=>{var ue;return le((ue=u())!=null?ue:S)});const Y=((_=f.onRehydrateStorage)==null?void 0:_.call(f,(j=u())!=null?j:S))||void 0;return ss(v.getItem.bind(v))(f.name).then(le=>{if(le)if(typeof le.version=="number"&&le.version!==f.version){if(f.migrate){const ue=f.migrate(le.state,le.version);return ue instanceof Promise?ue.then(N=>[!0,N]):[!0,ue]}console.error("State loaded from storage couldn\'t be migrated since no migrate function was provided")}else return[!1,le.state];return[!1,void 0]}).then(le=>{var ue;if(F!==h)return;const[N,$]=le;if(C=f.merge($,(ue=u())!=null?ue:S),a(C,!0),N)return g()}).then(()=>{F===h&&(Y?.(u(),void 0),C=u(),d=!0,p.forEach(le=>le(C)))}).catch(le=>{F===h&&Y?.(void 0,le)})};return c.persist={setOptions:j=>{f={...f,...j},j.storage&&(v=j.storage)},clearStorage:()=>{v?.removeItem(f.name)},getOptions:()=>f,rehydrate:()=>B(),hasHydrated:()=>d,onHydrate:j=>(m.add(j),()=>{m.delete(j)}),onFinishHydration:j=>(p.add(j),()=>{p.delete(j)})},f.skipHydration||B(),C||S},Vv=Yv,Gv={permission:"unknown",devices:[],selectedDeviceId:null,ready:!1,autoplayAllowed:null,pendingSessionStart:!1};function Xv(n,r){switch(r.type){case"browser/autoplay/probed":return{...n,autoplayAllowed:r.allowed,pendingSessionStart:!1};case"browser/devices/enumerated":return{...n,devices:r.devices};case"host/browser-audio/device-change":return{...n,devices:r.devices,selectedDeviceId:r.selectedDeviceId};case"ui/select/mic-device":return n.selectedDeviceId===r.deviceId?n:{...n,selectedDeviceId:r.deviceId};case"browser/permission/granted":return{...n,permission:"granted",ready:!0};case"browser/permission/denied":return{...n,permission:"denied"};case"browser/mic/stream-failed":return{...n,permission:"denied",ready:!1};case"host/voice/session/start":return n.autoplayAllowed===!0||n.pendingSessionStart?n:{...n,pendingSessionStart:!0};case"voice/session/in-flight":return!r.inFlight||!n.pendingSessionStart?n:{...n,pendingSessionStart:!1};default:return n}}const Qv={status:"connecting",reconnectMs:250};function Iv(n,r){switch(r.type){case"connection/status":return n.status===r.status?n:{...n,status:r.status};default:return n}}const Zv={status:"starting",conversation:null,instructions:void 0,streamDrafts:new Map,atBottom:!0,previousConversationId:null};function Fv(n,r){switch(r.type){case"host/state":{const a=r.data.conversation??null,u=a?.status??n.status,c=a?.id??null;return c!==n.previousConversationId?{...n,status:u,conversation:a,instructions:r.data.instructions,streamDrafts:new Map,atBottom:!0,previousConversationId:c}:{...n,status:u,conversation:a,instructions:r.data.instructions}}case"host/transcript/delta":{const a=new Map(n.streamDrafts);return a.set(r.delta.itemId,r.delta),{...n,streamDrafts:a}}case"ui/scroll/transcript":return n.atBottom===r.atBottom?n:{...n,atBottom:r.atBottom};default:return n}}const Kv={injectedVersion:null};function Jv(n,r){switch(r.type){case"host/state":{const a=r.data.injectedVersion??null;return a===n.injectedVersion?n:{...n,injectedVersion:a}}case"host/stage":{const a=r.data.injectedVersion;return a===n.injectedVersion?n:{...n,injectedVersion:a}}default:return n}}const Wv={modal:"none",moreActionsOpen:!1,duplicateClient:!1,settings:[],settingsInFlight:new Set,settingsResults:new Map};function $v(n,r){if(n.length!==r.length)return!1;for(let a=0;a<n.length;a+=1){const u=n[a],c=r[a];if(u?.id!==c?.id||u?.type!==c?.type||u?.label!==c?.label||u?.confirmation?.text!==c?.confirmation?.text||u?.confirmation?.confirmLabel!==c?.confirmation?.confirmLabel||u?.confirmation?.cancelLabel!==c?.confirmation?.cancelLabel)return!1}return!0}function Pv(n,r){switch(r.type){case"ui/click/transcript":return{...n,modal:"transcript",moreActionsOpen:!1};case"ui/click/instructions":return{...n,modal:"instructions",moreActionsOpen:!1};case"ui/click/modal-backdrop":case"ui/click/modal-close":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/key/escape":return n.modal==="none"&&!n.moreActionsOpen?n:{...n,modal:"none",moreActionsOpen:!1};case"ui/click/more-actions":return{...n,moreActionsOpen:!n.moreActionsOpen};case"host/duplicate-client":return n.duplicateClient?n:{...n,duplicateClient:!0};case"host/state":{const a=r.data.settings;return $v(n.settings,a)?n:{...n,settings:a}}case"ui/click/setting":{if(n.settingsInFlight.has(r.id))return n;const a=new Set(n.settingsInFlight);a.add(r.id);const u=new Map(n.settingsResults);return u.delete(r.id),{...n,settingsInFlight:a,settingsResults:u}}case"host/settings/result":{const a=new Set(n.settingsInFlight);a.delete(r.id);const u=new Map(n.settingsResults);return u.set(r.id,{ok:r.ok,error:r.error}),{...n,settingsInFlight:a,settingsResults:u}}default:return n}}const eb={xaiOpen:!1,xaiStatus:"disconnected",connectedSent:!1,sessionInFlight:!1,paused:!1,responseActive:!1,speakingItemId:null,pendingUserItemId:null,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};function tb(n,r){switch(r.type){case"xai/ws/connecting":return n.xaiStatus==="connecting"?n:{...n,xaiStatus:"connecting"};case"xai/ws/open":return{...n,xaiOpen:!0,xaiStatus:"connected"};case"xai/ws/error":return n.xaiStatus==="error"?n:{...n,xaiStatus:"error"};case"xai/ws/close":return{...n,xaiOpen:!1,xaiStatus:"disconnected",responseActive:!1,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1,pendingUserItemId:null};case"xai/response/created":return{...n,responseActive:!0,speakingItemId:null};case"xai/response/done":case"xai/response/failed":return{...n,responseActive:!1,pendingUserItemId:null};case"xai/response/cancelled":return{...n,responseActive:!1,speakingItemId:null};case"xai/input-audio-buffer/speech-started":return{...n,speakingItemId:r.itemId||null,pendingUserItemId:r.itemId||n.pendingUserItemId};case"xai/input-audio-buffer/speech-stopped":case"xai/conversation/item/added":return n.speakingItemId===null?n:{...n,speakingItemId:null};case"xai/response/output-item/added":return{...n,speakingItemId:r.itemId};case"voice/session/in-flight":return n.sessionInFlight===r.inFlight?n:{...n,sessionInFlight:r.inFlight};case"voice/paused":return n.paused===r.paused?n:{...n,paused:r.paused};case"voice/playback/cursor":return{...n,nextPlaybackTime:r.nextPlaybackTime,playbackEndsAt:r.playbackEndsAt};case"voice/playback/cut":return{...n,nextPlaybackTime:0,playbackEndsAt:0,deferredSendsPending:!1};case"host/voice/send":return r.gate!=="playback-drained"?n:{...n,deferredSendsPending:!0};case"voice/playback/drained":return n.deferredSendsPending?{...n,deferredSendsPending:!1}:n;default:return n}}const nb={connection:Qv,conversation:Zv,audio:Gv,voice:eb,ui:Wv,stage:Kv};function lb(n,r){const a=Iv(n.connection,r),u=Fv(n.conversation,r),c=Xv(n.audio,r),f=tb(n.voice,r),d=Pv(n.ui,r),h=Jv(n.stage,r);return a===n.connection&&u===n.conversation&&c===n.audio&&f===n.voice&&d===n.ui&&h===n.stage?n:{connection:a,conversation:u,audio:c,voice:f,ui:d,stage:h}}const Cs=Lv(Vv(Hv(lb,nb),{name:"voice:audio",partialize:n=>({audio:{selectedDeviceId:n.audio.selectedDeviceId}}),merge:(n,r)=>{const u=n?.audio?.selectedDeviceId??r.audio.selectedDeviceId;return{...r,audio:{...r.audio,selectedDeviceId:u}}}}));function fs(){return Cs.getState()}function Tt(n){return jv(Cs,n)}const cu=[],lm=[];let Qc=!1;function bt(n){if(Qc){lm.push(n);return}Qc=!0;try{let r=n;for(;r!==void 0;){Cs.dispatch(r);for(const a of cu)a(r);r=lm.shift()}}finally{Qc=!1}}function ng(n){return cu.push(n),()=>{const r=cu.indexOf(n);r!==-1&&cu.splice(r,1)}}let _i,Hl;async function ib(){return navigator.mediaDevices?.enumerateDevices?(await navigator.mediaDevices.enumerateDevices()).filter(r=>r.kind==="audioinput").map(r=>({deviceId:r.deviceId,label:r.label||"Microphone",groupId:r.groupId})):[]}function Ic(n,r){if(_i&&Hl&&_i.removeEventListener("ended",Hl),_i=n,Hl=void 0,!n)return;const a=()=>{r({type:"browser/mic/track-ended"})};Hl=a,n.addEventListener("ended",a)}function rb({dispatch:n}){const r=()=>{ib().then(a=>{n({type:"browser/devices/enumerated",devices:a})}).catch(a=>{n({type:"browser/window/error",message:`devicechange enumerate failed: ${String(a instanceof Error?a.message:a)}`})})};return navigator.mediaDevices?.addEventListener?.("devicechange",r),()=>{navigator.mediaDevices?.removeEventListener?.("devicechange",r),_i&&Hl&&_i.removeEventListener("ended",Hl),_i=void 0,Hl=void 0}}let wn,lu=250;const ds=[],ab=new Set(["xai/response/output-audio/delta"]);let hs;function ub(){return`${location.protocol==="https:"?"wss:":"ws:"}//${location.host}/ws`}function wt(n,r){const a=JSON.stringify({type:n,data:r});if(n==="browser.debug"){wn&&wn.readyState===WebSocket.OPEN?wn.send(a):ds.push(a);return}wn&&wn.readyState===WebSocket.OPEN&&wn.send(a)}function ob(n){switch(n.type){case"duplicate.client":return[{type:"host/duplicate-client"}];case"state":return[{type:"host/state",data:n.data}];case"transcript.item":return[{type:"host/transcript/item",item:n.data}];case"transcript.delta":return[{type:"host/transcript/delta",delta:n.data}];case"browser.audio.deviceChange":return[{type:"host/browser-audio/device-change",devices:n.data.devices.map(r=>({deviceId:r.deviceId,label:r.label,groupId:r.groupId})),selectedDeviceId:n.data.selectedDeviceId??null}];case"voice.session.start":return[{type:"host/voice/session/start"}];case"voice.session.token":return[{type:"host/voice/session/token",token:n.data}];case"voice.session.close":return[{type:"host/voice/session/close",code:n.data.code,reason:n.data.reason}];case"voice.send":return[{type:"host/voice/send",event:n.data.event,gate:n.data.gate}];case"stage.injected":return[{type:"host/stage",data:n.data}];case"wait_for_context.start":return[{type:"host/wait-for-context/start"}];case"wait_for_context.end":return[{type:"host/wait-for-context/end"}];case"settings.result":return[{type:"host/settings/result",id:n.data.id,ok:n.data.ok,error:n.data.error}];case"audio.output.delta":return[];case"error":return[];default:return[]}}function cb({dispatch:n,subscribeToActions:r,getState:a}){let u=!1,c;const f=()=>{n({type:"connection/status",status:"connecting"});const h=new WebSocket(ub());wn=h,h.addEventListener("open",()=>{lu=250;const m=[];for(const p of ds)try{h.send(p)}catch(v){m.push(String(v instanceof Error?v.message:v))}ds.length=0,n({type:"connection/status",status:"connected"});for(const p of m)n({type:"browser/window/error",message:`debugBuffer.flush.failed: ${p}`})}),h.addEventListener("message",m=>{let p;try{p=JSON.parse(String(m.data))}catch(v){n({type:"browser/window/error",message:`ws.in.parseError: ${String(v instanceof Error?v.message:v)}`});return}for(const v of ob(p))n(v)}),h.addEventListener("close",()=>{wn=void 0,n({type:"connection/status",status:"disconnected"}),!u&&(c=setTimeout(f,lu),lu=Math.min(lu*2,5e3))}),h.addEventListener("error",()=>{n({type:"connection/status",status:"error"})})},d=r(h=>{h.type.startsWith("xai/")&&!h.type.startsWith("xai/ws/")&&hs!==void 0&&wt("voice.event",{event:hs}),h.type==="ui/click/download-transcript"&&fb(a),h.type==="ui/click/setting"&&wt("settings.invoke",{id:h.id}),h.type==="ui/html/click"&&wt("html.click",{x:h.x,y:h.y,width:h.width,height:h.height,path:h.path}),ab.has(h.type)||wt("browser.debug",{label:"action",info:h,t:Date.now()})});return f(),()=>{u=!0,d(),c!==void 0&&clearTimeout(c);try{wn?.close()}catch(h){console.error("hostSocketRunner.teardown.close.failed",h)}wn=void 0}}function sb(n){hs=n}function fb(n){const r=n().conversation.conversation,a=r?.transcript??[];if(a.length===0)return;const u=`${a.map(p=>JSON.stringify(p)).join(`\n`)}\n`,c=new Blob([u],{type:"application/jsonl"}),f=URL.createObjectURL(c),d=document.createElement("a"),h=new Date().toISOString().replace(/[:.]/g,"-"),m=r?.id??"conversation";d.href=f,d.download=`transcript-${m}-${h}.jsonl`,document.body.append(d),d.click(),d.remove(),URL.revokeObjectURL(f)}const su=new Float32Array(5),db=`\n  class Pcm16Encoder extends AudioWorkletProcessor {\n    constructor() { super(); this.buf = []; this.target = 4800; }\n    process(inputs) {\n      const ch = inputs[0] && inputs[0][0];\n      if (!ch) return true;\n      this.buf.push(new Float32Array(ch));\n      let total = 0;\n      for (const b of this.buf) total += b.length;\n      while (total >= this.target) {\n        const out = new Int16Array(this.target);\n        let written = 0;\n        while (written < this.target) {\n          const head = this.buf[0];\n          const take = Math.min(head.length, this.target - written);\n          for (let i = 0; i < take; i++) {\n            const s = Math.max(-1, Math.min(1, head[i]));\n            out[written + i] = s < 0 ? s * 0x8000 : s * 0x7fff;\n          }\n          if (take === head.length) this.buf.shift();\n          else this.buf[0] = head.subarray(take);\n          written += take;\n        }\n        total -= this.target;\n        this.port.postMessage(out.buffer, [out.buffer]);\n      }\n      return true;\n    }\n  }\n  registerProcessor("pcm16-encoder", Pcm16Encoder);\n`,hb=50,pb=500,mb=5e3,gb=3,yb=.01;function im(){return{nextPlaybackTime:0,playbackEndsAt:0,scheduledSources:[],pendingSends:[],preOpenAudio:[],deferredSends:[],connectedSent:!1,sessionConfigured:!1,pendingSessionUpdate:!1,tokenExpiresAt:0,paused:!1}}function Xe(n){return String(n instanceof Error?n.message:n)}function vb({dispatch:n,subscribeToActions:r,getState:a}){let u=im(),c=!1,f=0,d,h,m=0,p=!1,v,g,x,S=0,C;const B=8e3;let j=!1;const _=()=>{C!==void 0&&(clearTimeout(C),C=void 0)},F=(X,Z,ne)=>{wt("browser.audio.error",{code:X,message:Z,suggestedAction:ne}),n({type:"browser/mic/stream-failed",error:{code:X,message:Z}})},Y=X=>{const Z={echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0};return X&&(Z.deviceId={exact:X}),navigator.mediaDevices.getUserMedia({audio:Z})},le=async()=>{if(!navigator.mediaDevices?.getUserMedia)return!1;try{const X=a().audio.selectedDeviceId;let Z;try{Z=await Y(X)}catch(oe){if(!X)throw oe;Z=await Y(null)}for(const oe of Z.getTracks())oe.stop();const ne=(await navigator.mediaDevices.enumerateDevices()).filter(oe=>oe.kind==="audioinput").map(oe=>({deviceId:oe.deviceId,label:oe.label||"Microphone",groupId:oe.groupId})),ae=a().audio.selectedDeviceId,pe=ae??ne[0]?.deviceId??null;return n({type:"browser/devices/enumerated",devices:ne}),pe&&pe!==ae&&n({type:"ui/select/mic-device",deviceId:pe}),n({type:"browser/permission/granted"}),wt("audio.device.state",{permission:"granted",devices:ne,selectedDeviceId:pe??void 0,ready:!0}),!0}catch{return F("MICROPHONE_DEVICE_ERROR","Could not access the selected microphone.","Allow microphone access and try again."),n({type:"browser/permission/denied"}),!1}},ue=X=>{if(u.analyserCtx)try{u.analyserCtx.close()}catch(oe){n({type:"browser/window/error",message:`startMeters.analyserCtx.close.failed: ${Xe(oe)}`})}const Z=new AudioContext;Z.state==="suspended"&&Z.resume().then(()=>{Z.state==="suspended"&&n({type:"browser/window/error",message:"startMeters.audioCtx.resume.noop: AudioContext stayed suspended after resume(); metering is not live (mic pipeline detached)"})}).catch(oe=>{n({type:"browser/window/error",message:`startMeters.audioCtx.resume.failed: ${Xe(oe)}`})});const ne=Z.createAnalyser();if(ne.fftSize=256,Z.createMediaStreamSource(X).connect(ne),u.analyser=ne,u.analyserCtx=Z,c)return;c=!0;const ae=new Uint8Array(ne.frequencyBinCount),pe=()=>{const oe=u.analyser;if(oe){oe.getByteFrequencyData(ae);for(let ye=0;ye<su.length;ye+=1)su[ye]=Math.max(.1,(ae[ye*10]??0)/255)}f=requestAnimationFrame(pe)};pe()},N=X=>{const Z=atob(X),ne=new Uint8Array(Z.length);for(let oe=0;oe<Z.length;oe+=1)ne[oe]=Z.charCodeAt(oe);const ae=new DataView(ne.buffer),pe=new Float32Array(ne.length/2);for(let oe=0;oe<pe.length;oe+=1){const ye=ae.getInt16(oe*2,!0);pe[oe]=ye<0?ye/32768:ye/32767}return pe},$=X=>{let Z="";for(let ae=0;ae<X.length;ae+=32768)Z+=String.fromCharCode(...X.subarray(ae,ae+32768));return btoa(Z)},he=()=>{const X=u.outputCtx,Z=u.playbackEndsAt;return!Z||!X?!0:X.currentTime>=Z-yb},Se=()=>{if(!he()){if(u.deferredSends.length===0)return;const X=u.outputCtx,Z=X?Math.max(0,(u.playbackEndsAt-X.currentTime+.015)*1e3):50;h!==void 0&&clearTimeout(h),h=setTimeout(Se,Z);return}h!==void 0&&(clearTimeout(h),h=void 0),u.deferredSends.length!==0&&n({type:"voice/playback/drained"})},L=X=>{try{const Z=N(X);if(Z.length===0)return;let ne=u.outputCtx;ne||(ne=new AudioContext({sampleRate:48e3}),u.outputCtx=ne),ne.state==="suspended"&&ne.resume().catch(He=>{n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Xe(He)}`})});const ae=ne.createBuffer(1,Z.length,48e3);ae.getChannelData(0).set(Z);const pe=ne.createBufferSource();pe.buffer=ae,pe.connect(ne.destination);const oe=ne.currentTime,ye=Math.max(oe,u.nextPlaybackTime);pe.start(ye);const Ce=ye+ae.duration;if(u.nextPlaybackTime=Ce,u.playbackEndsAt=Math.max(u.playbackEndsAt||0,Ce),u.scheduledSources.push(pe),n({type:"voice/playback/cursor",nextPlaybackTime:u.nextPlaybackTime,playbackEndsAt:u.playbackEndsAt}),pe.addEventListener("ended",()=>{const He=u.scheduledSources.indexOf(pe);He!==-1&&u.scheduledSources.splice(He,1),Se()}),u.deferredSends.length>0){const He=Math.max(0,(u.playbackEndsAt-ne.currentTime+.015)*1e3);h!==void 0&&clearTimeout(h),h=setTimeout(Se,He)}}catch(Z){F("AUDIO_DECODE_FAILED",Xe(Z),"Refresh the page; if the problem persists check audio device permissions.")}},ie=()=>{for(const X of u.scheduledSources.splice(0)){try{X.stop()}catch{}try{X.disconnect()}catch(Z){n({type:"browser/window/error",message:`stopScheduledPlayback.disconnect.failed: ${Xe(Z)}`})}}u.nextPlaybackTime=0,u.playbackEndsAt=0},ee=async X=>{try{const Z=new AudioContext({sampleRate:48e3});u.inputCtx=Z,Z.state==="suspended"&&Z.resume().catch(ye=>n({type:"browser/window/error",message:`inputCtx.resume.failed: ${Xe(ye)}`}));const ne=Z.createMediaStreamSource(X);u.micSourceNode=ne;const ae=new Blob([db],{type:"application/javascript"}),pe=URL.createObjectURL(ae);try{await Z.audioWorklet.addModule(pe)}finally{URL.revokeObjectURL(pe)}const oe=new AudioWorkletNode(Z,"pcm16-encoder");u.workletNode=oe,oe.port.onmessage=ye=>{if(!u.paused)try{const Ce=$(new Uint8Array(ye.data)),He=u.xaiWs;He&&He.readyState===WebSocket.OPEN&&u.sessionConfigured?He.send(JSON.stringify({type:"input_audio_buffer.append",audio:Ce})):(u.preOpenAudio.push(Ce),u.preOpenAudio.length>hb&&(u.preOpenAudio.shift(),n({type:"voice/queue/pre-open-cap-hit"})))}catch(Ce){F("AUDIO_ENCODE_FAILED",Xe(Ce),"Refresh the page; if the problem persists check microphone permissions.")}},ne.connect(oe)}catch(Z){F("AUDIO_ENCODER_INIT_FAILED",Xe(Z),"Try a different browser or device.")}},ke=(X,Z)=>{wt("voice.session.failed",{error:{code:X,message:Z}}),Ae()},re=()=>{n({type:"voice/session/in-flight",inFlight:!0}),wt("conversation.start"),wt("voice.session.requested")},W=()=>{const{voice:X,audio:Z}=a();Z.autoplayAllowed!==null&&(X.sessionInFlight||X.xaiOpen||u.xaiWs||(n({type:"voice/session/in-flight",inFlight:!0}),wt("voice.session.requested")))},D=()=>{const{voice:X,audio:Z}=a();if(!X.xaiOpen&&!X.sessionInFlight){if(Z.autoplayAllowed===null){n({type:"host/voice/session/start"});return}if(Z.autoplayAllowed===!1){le().then(ne=>{ne&&re()});return}if(!Z.ready){le().then(ne=>{ne&&re()});return}re();return}if(X.xaiOpen&&!X.paused){wt("conversation.pause"),H();return}X.xaiOpen&&X.paused&&(wt("conversation.resume"),k())},K=()=>{if(u.xaiWs)return!1;const{voice:X,audio:Z}=a();return X.sessionInFlight&&X.xaiOpen?!1:Z.ready?!0:(F("MICROPHONE_NOT_READY","Microphone is not ready.","Grant microphone access and try again."),!1)},ce=X=>{if(!u.sessionConfigured){u.sessionConfigured=!0,u.pendingSessionUpdate=!1;for(const Z of u.preOpenAudio)try{X.send(JSON.stringify({type:"input_audio_buffer.append",audio:Z}))}catch(ne){n({type:"browser/window/error",message:`xaiWs.send.preOpenAudio.failed: ${Xe(ne)}`})}u.preOpenAudio=[]}},we=async X=>{if(!X?.clientSecret||!X?.model){ke("VOICE_TOKEN_INVALID","Missing client secret or model.");return}if(u.xaiWs){const{voice:ae}=a();!u.connectedSent&&!ae.xaiOpen&&u.xaiWs.readyState!==WebSocket.OPEN&&(n({type:"browser/window/error",message:"voice.reset.rebuild.skipped: a stale xAI socket from an establish that raced reset is still owning the audio refs; rebuild aborted"}),n({type:"voice/session/in-flight",inFlight:!1}));return}j&&n({type:"voice/session/in-flight",inFlight:!0});const Z=S,ne=()=>Z!==S;if(typeof X.expiresAt=="number"&&Date.now()>X.expiresAt*1e3-mb){if(m+=1,m>gb){m=0,n({type:"connection/status",status:"error"}),n({type:"voice/session/in-flight",inFlight:!1});return}wt("voice.session.requested");return}if(m=0,u.tokenExpiresAt=X.expiresAt??0,!(!K()&&!a().voice.sessionInFlight))try{const ae=await Y(a().audio.selectedDeviceId);if(ne()){for(const et of ae.getTracks())et.stop();return}u.micStream=ae;const pe=ae.getAudioTracks()[0];if(u.micTrack=pe,Ic(pe,n),pe&&n({type:"browser/mic/stream-acquired",deviceId:a().audio.selectedDeviceId??"",trackId:pe.id}),ue(ae),u.preOpenAudio=[],await ee(ae),ne())return;const oe=bb(X.clientSecret,n);n({type:"xai/ws/connecting"});const ye=new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(X.model)}`,[`xai-client-secret.${oe}`]);u.xaiWs=ye;let Ce,He="";ye.addEventListener("open",()=>{j=!1,_(),n({type:"xai/ws/open"});for(const et of u.pendingSends)try{ye.send(et)}catch(ct){n({type:"browser/window/error",message:`xaiWs.send.pending.failed: ${Xe(ct)}`})}u.pendingSends=[],u.pendingSessionUpdate&&ce(ye),u.connectedSent||(u.connectedSent=!0,n({type:"voice/session/in-flight",inFlight:!1}),wt("voice.session.connected"))}),ye.addEventListener("message",et=>{let ct;try{ct=JSON.parse(String(et.data))}catch(bn){n({type:"browser/window/error",message:`xaiWs.in.parseError: ${Xe(bn)}`});return}if(ct?.type==="ping"){try{const bn=typeof ct.event_id=="string"?ct.event_id:void 0;ye.send(JSON.stringify(bn?{type:"pong",event_id:bn}:{type:"pong"}))}catch(bn){n({type:"browser/window/error",message:`xaiWs.send.pong.failed: ${Xe(bn)}`})}return}sb(ct),xb(ct,n),ct?.type==="response.output_audio.delta"&&typeof ct.delta=="string"&&!u.paused&&L(ct.delta)});const en=et=>{Ce=et.code,He=et.reason,n({type:"xai/ws/close",code:et.code,reason:et.reason}),u.connectedSent?(wt("voice.session.failed",{error:{code:"VOICE_WS_CLOSED",message:`xAI WS closed: code=${et.code}`}}),Ae()):ke("VOICE_WS_REJECTED",`xAI WS closed before open: code=${et.code} reason=${et.reason}`)},tn=()=>{if(n({type:"xai/ws/error"}),!u.connectedSent){const et=Ce!==void 0?` WS close code=${Ce}${He?` reason="${He}"`:""}.`:" No close frame received before error.";ke("VOICE_WS_REJECTED",`xAI WebSocket handshake failed. Attempted: wss://api.x.ai/v1/realtime with subprotocol prefix "xai-client-secret" (token not logged).${et} Possible causes: CORS policy, invalid/expired token, wrong subprotocol format, or origin not allowlisted.`)}};ye.addEventListener("close",en),ye.addEventListener("error",tn),x=()=>{ye.removeEventListener("close",en),ye.removeEventListener("error",tn)}}catch(ae){ke("VOICE_SETUP_FAILED",Xe(ae))}},E=(X,Z)=>{if(!X)return;if(Z==="playback-drained"&&!he()){u.deferredSends.push(X);return}const ne=X.type==="session.update",ae=JSON.stringify(X),pe=u.xaiWs;if(pe&&a().voice.xaiOpen){try{pe.send(ae),ne&&ce(pe)}catch(oe){n({type:"browser/window/error",message:`xaiWs.send.failed.requeue: ${Xe(oe)}`}),u.pendingSends.push(ae),ne&&(u.pendingSessionUpdate=!0)}return}u.pendingSends.push(ae),ne&&(u.pendingSessionUpdate=!0)},w=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),u.outputCtx?.state==="running"&&u.outputCtx.suspend().catch(X=>n({type:"browser/window/error",message:`outputCtx.suspend.failed: ${Xe(X)}`})),u.xaiWs&&a().voice.xaiOpen&&a().voice.responseActive)try{u.xaiWs.send(JSON.stringify({type:"response.cancel"}))}catch(X){n({type:"browser/window/error",message:`xaiWs.send.responseCancel.failed: ${Xe(X)}`})}},H=()=>{if(u.paused=!0,u.micTrack&&(u.micTrack.enabled=!1),n({type:"voice/paused",paused:!0}),a().voice.responseActive){d!==void 0&&clearTimeout(d),d=setTimeout(()=>{d!==void 0&&(d=void 0,w())},pb);return}w()},k=()=>{d!==void 0&&(clearTimeout(d),d=void 0),u.paused=!1,u.micTrack&&(u.micTrack.enabled=!0),u.outputCtx?.state==="suspended"&&u.outputCtx.resume().catch(X=>n({type:"browser/window/error",message:`outputCtx.resume.failed: ${Xe(X)}`})),n({type:"voice/paused",paused:!1})},te=async X=>{if(wt("audio.device.select",{deviceId:X}),!!u.xaiWs)try{const Z=await Y(X);if(u.workletNode){try{u.workletNode.port.onmessage=null,u.workletNode.disconnect()}catch(ne){n({type:"browser/window/error",message:`switchMic.worklet.disconnect.failed: ${Xe(ne)}`})}u.workletNode=void 0}if(u.micSourceNode)try{u.micSourceNode.disconnect()}catch(ne){n({type:"browser/window/error",message:`switchMic.micSource.disconnect.failed: ${Xe(ne)}`})}if(u.inputCtx){try{u.inputCtx.close()}catch(ne){n({type:"browser/window/error",message:`switchMic.inputCtx.close.failed: ${Xe(ne)}`})}u.inputCtx=void 0}if(u.micStream)for(const ne of u.micStream.getTracks())ne.stop();u.micStream=Z,u.micTrack=Z.getAudioTracks()[0],Ic(u.micTrack,n),await ee(Z),ue(Z)}catch(Z){F("MICROPHONE_SWITCH_FAILED",Xe(Z)||"Could not switch microphone.","Try a different device.")}},me=()=>{if(g)return;v||(v=new AudioContext),v.state==="suspended"&&v.resume().catch(Z=>n({type:"browser/window/error",message:`metronome.resume.failed: ${Xe(Z)}`}));const X=()=>{const Z=v;if(!Z)return;const ne=Z.createOscillator(),ae=Z.createGain();ne.type="sine",ne.frequency.value=880;const pe=Z.currentTime;ae.gain.setValueAtTime(0,pe),ae.gain.linearRampToValueAtTime(.05,pe+.005),ae.gain.exponentialRampToValueAtTime(1e-4,pe+.08),ne.connect(ae).connect(Z.destination),ne.start(pe),ne.stop(pe+.1)};X(),g=setInterval(X,2e3)},fe=()=>{g&&(clearInterval(g),g=void 0)};function Ae(){const{xaiWs:X,micStream:Z,analyserCtx:ne,workletNode:ae,micSourceNode:pe,inputCtx:oe,outputCtx:ye}=u;if(x&&(x(),x=void 0),X)try{X.close()}catch(Ce){n({type:"browser/window/error",message:`teardown.xaiWs.close.failed: ${Xe(Ce)}`})}if(ae)try{ae.port.onmessage=null,ae.disconnect()}catch(Ce){n({type:"browser/window/error",message:`teardown.worklet.disconnect.failed: ${Xe(Ce)}`})}if(pe)try{pe.disconnect()}catch(Ce){n({type:"browser/window/error",message:`teardown.micSource.disconnect.failed: ${Xe(Ce)}`})}if(oe)try{oe.close()}catch(Ce){n({type:"browser/window/error",message:`teardown.inputCtx.close.failed: ${Xe(Ce)}`})}if(ye)try{ye.close()}catch(Ce){n({type:"browser/window/error",message:`teardown.outputCtx.close.failed: ${Xe(Ce)}`})}if(Z)for(const Ce of Z.getTracks())Ce.stop();if(ne)try{ne.close()}catch(Ce){n({type:"browser/window/error",message:`teardown.analyserCtx.close.failed: ${Xe(Ce)}`})}h!==void 0&&(clearTimeout(h),h=void 0),d!==void 0&&(clearTimeout(d),d=void 0),f&&(cancelAnimationFrame(f),f=0),c=!1,_(),S+=1,Ic(void 0,n),u=im(),su.fill(0)}const Qe=r(X=>{switch(X.type){case"ui/click/primary":D();break;case"host/voice/session/start":W();break;case"browser/autoplay/probed":X.allowed&&le();break;case"ui/click/reset":{wt("conversation.reset"),Ae(),n({type:"voice/session/in-flight",inFlight:!1}),j=!0,_(),C=setTimeout(()=>{C=void 0,!(u.xaiWs&&a().voice.xaiOpen)&&(n({type:"browser/window/error",message:"voice.reset.rebuild.timeout: no live voice session was rebuilt after reset; the microphone is detached from the audio pipeline"}),n({type:"voice/session/in-flight",inFlight:!1}))},B);break}case"ui/select/mic-device":te(X.deviceId);break;case"host/voice/session/token":we(X.token).catch(Z=>{ke("VOICE_SETUP_FAILED",Xe(Z))});break;case"host/voice/send":E(X.event,X.gate);break;case"host/voice/session/close":Ae();break;case"host/duplicate-client":Ae();break;case"host/state":{const Z=X.data.conversationStatus;if((Z==="none"||Z==="ending")&&a().voice.xaiOpen&&Ae(),Z==="paused"&&a().voice.xaiOpen&&!a().voice.paused?H():Z==="active"&&a().voice.xaiOpen&&a().voice.paused&&k(),X.data.connectOnPageLoad&&!p){const{audio:ne,voice:ae}=a();!ne.ready&&ne.permission!=="denied"&&!ae.xaiOpen&&!ae.sessionInFlight&&(p=!0,le())}break}case"host/wait-for-context/start":me();break;case"host/wait-for-context/end":fe();break;case"xai/input-audio-buffer/speech-started":case"xai/response/cancelled":n({type:"voice/playback/cut"});break;case"voice/playback/cut":ie(),h!==void 0&&(clearTimeout(h),h=void 0),u.deferredSends=[];break;case"voice/playback/drained":{const Z=u.xaiWs;if(Z&&a().voice.xaiOpen)for(const ne of u.deferredSends)try{Z.send(JSON.stringify(ne))}catch(ae){n({type:"browser/window/error",message:`xaiWs.send.deferred.failed: ${Xe(ae)}`})}u.deferredSends=[];break}}});return()=>{Qe(),fe(),Ae()}}const rm=/^[A-Za-z0-9!#$%&\'*+\\-.^_`|~]+$/;function bb(n,r){if(rm.test(n))return n;const a=[...new Set(n.split("").filter(u=>!rm.test(u)))].join("");return r({type:"browser/window/error",message:`voice.session.token.sanitized: unsafeChars=${a}`}),btoa(n).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=/g,"")}function xb(n,r){const a=n?.type;if(typeof a!="string"){r({type:"xai/unknown",raw:n});return}const u=typeof n.item_id=="string"?n.item_id:"";switch(a){case"session.created":r({type:"xai/session/created"});return;case"session.updated":r({type:"xai/session/updated"});return;case"conversation.created":r({type:"xai/conversation/created"});return;case"conversation.item.added":{const c=n.item,f=typeof c?.role=="string"?c.role:"";r({type:"xai/conversation/item/added",itemId:u,role:f});return}case"input_audio_buffer.speech_started":r({type:"xai/input-audio-buffer/speech-started",itemId:u});return;case"input_audio_buffer.speech_stopped":r({type:"xai/input-audio-buffer/speech-stopped"});return;case"input_audio_buffer.committed":r({type:"xai/input-audio-buffer/committed"});return;case"input_audio_buffer.cleared":r({type:"xai/input-audio-buffer/cleared"});return;case"response.created":r({type:"xai/response/created"});return;case"response.done":r({type:"xai/response/done"});return;case"response.cancelled":r({type:"xai/response/cancelled"});return;case"response.failed":r({type:"xai/response/failed"});return;case"response.output_audio.delta":r({type:"xai/response/output-audio/delta",b64:""});return;case"response.output_audio.done":r({type:"xai/response/output-audio/done"});return;case"response.output_audio_transcript.delta":r({type:"xai/response/output-audio-transcript/delta",delta:""});return;case"response.output_audio_transcript.done":r({type:"xai/response/output-audio-transcript/done"});return;case"response.text.delta":r({type:"xai/response/text/delta",delta:""});return;case"response.text.done":r({type:"xai/response/text/done"});return;case"error":r({type:"xai/error",code:"",message:""});return;default:r({type:"xai/unknown",raw:n})}}function Sb({dimmed:n}){const r=ve.useRef([]);return ve.useEffect(()=>{let a=0;const u=()=>{for(let c=0;c<r.current.length;c+=1){const f=r.current[c];f!==void 0&&f.style.setProperty("--level",String(Math.max(.1,su[c]??.1)))}a=requestAnimationFrame(u)};return a=requestAnimationFrame(u),()=>cancelAnimationFrame(a)},[]),I.jsx("div",{className:`meters${n?" dimmed":""}`,"aria-hidden":"true",children:[0,1,2,3,4].map(a=>I.jsx("span",{className:"bar",ref:u=>{u!==null&&(r.current[a]=u)}},a))})}function kb(){const{permission:n,devices:r,selectedDeviceId:a}=Tt(vu(u=>({permission:u.audio.permission,devices:u.audio.devices,selectedDeviceId:u.audio.selectedDeviceId})));return n==="denied"?I.jsxs("div",{className:"error-block",children:[I.jsx("div",{className:"error-title",children:"Microphone error"}),I.jsx("div",{children:"Microphone access denied \u2014 allow access in browser settings."}),I.jsx("button",{className:"retry",type:"button",onClick:()=>bt({type:"ui/click/primary"}),children:"Retry"})]}):r.length===0?I.jsx("div",{className:"mic-note",children:"Microphone access is required to use voice."}):I.jsxs("div",{children:[I.jsx("label",{className:"field-label",htmlFor:"micSelect",children:"Microphone"}),I.jsx("select",{id:"micSelect",value:a??r[0]?.deviceId??"",onChange:u=>bt({type:"ui/select/mic-device",deviceId:u.target.value}),children:r.map(u=>I.jsx("option",{value:u.deviceId,children:u.label},u.deviceId))})]})}function Eb(){const{settings:n,settingsInFlight:r,settingsResults:a}=Tt(vu(f=>({settings:f.ui.settings,settingsInFlight:f.ui.settingsInFlight,settingsResults:f.ui.settingsResults}))),[u,c]=ve.useState(null);return n.length===0?null:I.jsx("div",{className:"settings-panel",children:n.map(f=>{const d=r.has(f.id),h=a.get(f.id),m=u===f.id,p=()=>{c(null),bt({type:"ui/click/setting",id:f.id})},v=()=>{if(f.confirmation){c(f.id);return}p()};return I.jsxs("div",{className:"setting-item",children:[I.jsx("button",{className:"menu-item",type:"button",disabled:d,onClick:v,children:f.label}),m&&f.confirmation?I.jsxs("div",{className:"setting-confirm",children:[I.jsx("div",{className:"setting-confirm-text",children:f.confirmation.text}),I.jsxs("div",{className:"setting-confirm-actions",children:[I.jsx("button",{className:"setting-confirm-btn danger",type:"button",disabled:d,onClick:p,children:f.confirmation.confirmLabel??"Confirm"}),I.jsx("button",{className:"setting-confirm-btn",type:"button",onClick:()=>c(null),children:f.confirmation.cancelLabel??"Cancel"})]})]}):null,h&&!h.ok?I.jsx("div",{className:"setting-result error",children:h.error??"Action failed."}):null,h?.ok?I.jsx("div",{className:"setting-result ok",children:"Done."}):null]},f.id)})})}function Ab(){const{xaiOpen:n,xaiStatus:r,sessionInFlight:a,paused:u}=Tt(vu(x=>({xaiOpen:x.voice.xaiOpen,xaiStatus:x.voice.xaiStatus,sessionInFlight:x.voice.sessionInFlight,paused:x.voice.paused}))),c=Tt(x=>x.connection.status),f=Tt(x=>x.audio.autoplayAllowed),d=Tt(x=>x.ui.moreActionsOpen),h=Tt(x=>(x.conversation.conversation?.transcript.length??0)>0);let m;!n&&!a?m="idle":a&&!n?m="connecting":n&&!u?m="active":m="paused";const p=m==="idle"||m==="paused",v=m==="connecting",g=f===!1;return I.jsxs("div",{className:"floating-tab",children:[I.jsxs("button",{className:"icon-btn",type:"button",disabled:v,"aria-label":p?"Start conversation":"Pause conversation",title:g&&p?"Click to enable audio.":void 0,onClick:()=>bt({type:"ui/click/primary"}),children:[I.jsx("span",{className:`codicon codicon-${p?"play":"debug-pause"}`,"aria-hidden":"true"}),g&&p?I.jsx("span",{className:"shield-badge codicon codicon-shield","aria-hidden":"true"}):null]}),m==="active"||m==="paused"?I.jsx("button",{className:"icon-btn",type:"button","aria-label":"Reset conversation",onClick:()=>bt({type:"ui/click/reset"}),children:I.jsx("span",{className:"codicon codicon-refresh","aria-hidden":"true"})}):null,I.jsx("button",{className:"icon-btn",type:"button","aria-label":"View transcript",onClick:()=>bt({type:"ui/click/transcript"}),children:I.jsx("span",{className:"codicon codicon-comment-discussion","aria-hidden":"true"})}),I.jsx("button",{className:"icon-btn",type:"button","aria-label":"View instructions",onClick:()=>bt({type:"ui/click/instructions"}),children:I.jsx("span",{className:"codicon codicon-book","aria-hidden":"true"})}),m==="active"?I.jsx(Sb,{dimmed:!1}):null,I.jsx("div",{className:"connection",title:`Local: ${c} \xB7 xAI: ${r}`,children:I.jsxs("span",{className:"split-dot",children:[I.jsx("span",{className:`split-dot-half top ${c}`}),I.jsx("span",{className:`split-dot-half bottom ${r}`})]})}),I.jsxs("div",{style:{position:"relative"},children:[I.jsx("button",{className:"icon-btn",type:"button","aria-label":"More actions","aria-expanded":d,onClick:()=>bt({type:"ui/click/more-actions"}),children:I.jsx("span",{className:"codicon codicon-ellipsis","aria-hidden":"true"})}),d?I.jsxs("div",{className:"more-actions-popover","data-more-actions":!0,children:[I.jsx(kb,{}),I.jsx("button",{className:"menu-item",type:"button",disabled:!h,onClick:()=>bt({type:"ui/click/download-transcript"}),children:"Download transcript (JSONL)"}),I.jsx(Eb,{})]}):null]})]})}function wb(n,r){const a={};return(n[n.length-1]===""?[...n,""]:n).join((a.padRight?" ":"")+","+(a.padLeft===!1?"":" ")).trim()}const Tb=/^[$_\\p{ID_Start}][$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,Cb=/^[$_\\p{ID_Start}][-$_\\u{200C}\\u{200D}\\p{ID_Continue}]*$/u,zb={};function am(n,r){return(zb.jsx?Cb:Tb).test(n)}const _b=/[ \\t\\n\\f\\r]/g;function Ob(n){return typeof n=="object"?n.type==="text"?um(n.value):!1:um(n)}function um(n){return n.replace(_b,"")===""}class Br{constructor(r,a,u){this.normal=a,this.property=r,u&&(this.space=u)}}Br.prototype.normal={};Br.prototype.property={};Br.prototype.space=void 0;function lg(n,r){const a={},u={};for(const c of n)Object.assign(a,c.property),Object.assign(u,c.normal);return new Br(a,u,r)}function ps(n){return n.toLowerCase()}class Gt{constructor(r,a){this.attribute=a,this.property=r}}Gt.prototype.attribute="";Gt.prototype.booleanish=!1;Gt.prototype.boolean=!1;Gt.prototype.commaOrSpaceSeparated=!1;Gt.prototype.commaSeparated=!1;Gt.prototype.defined=!1;Gt.prototype.mustUseProperty=!1;Gt.prototype.number=!1;Gt.prototype.overloadedBoolean=!1;Gt.prototype.property="";Gt.prototype.spaceSeparated=!1;Gt.prototype.space=void 0;let Db=0;const Oe=Yl(),pt=Yl(),ms=Yl(),J=Yl(),tt=Yl(),Oi=Yl(),$t=Yl();function Yl(){return 2**++Db}const gs=Object.freeze(Object.defineProperty({__proto__:null,boolean:Oe,booleanish:pt,commaOrSpaceSeparated:$t,commaSeparated:Oi,number:J,overloadedBoolean:ms,spaceSeparated:tt},Symbol.toStringTag,{value:"Module"})),Zc=Object.keys(gs);class zs extends Gt{constructor(r,a,u,c){let f=-1;if(super(r,a),om(this,"space",c),typeof u=="number")for(;++f<Zc.length;){const d=Zc[f];om(this,Zc[f],(u&gs[d])===gs[d])}}}zs.prototype.defined=!0;function om(n,r,a){a&&(n[r]=a)}function Mi(n){const r={},a={};for(const[u,c]of Object.entries(n.properties)){const f=new zs(u,n.transform(n.attributes||{},u),c,n.space);n.mustUseProperty&&n.mustUseProperty.includes(u)&&(f.mustUseProperty=!0),r[u]=f,a[ps(u)]=u,a[ps(f.attribute)]=u}return new Br(r,a,n.space)}const ig=Mi({properties:{ariaActiveDescendant:null,ariaAtomic:pt,ariaAutoComplete:null,ariaBusy:pt,ariaChecked:pt,ariaColCount:J,ariaColIndex:J,ariaColSpan:J,ariaControls:tt,ariaCurrent:null,ariaDescribedBy:tt,ariaDetails:null,ariaDisabled:pt,ariaDropEffect:tt,ariaErrorMessage:null,ariaExpanded:pt,ariaFlowTo:tt,ariaGrabbed:pt,ariaHasPopup:null,ariaHidden:pt,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:tt,ariaLevel:J,ariaLive:null,ariaModal:pt,ariaMultiLine:pt,ariaMultiSelectable:pt,ariaOrientation:null,ariaOwns:tt,ariaPlaceholder:null,ariaPosInSet:J,ariaPressed:pt,ariaReadOnly:pt,ariaRelevant:null,ariaRequired:pt,ariaRoleDescription:tt,ariaRowCount:J,ariaRowIndex:J,ariaRowSpan:J,ariaSelected:pt,ariaSetSize:J,ariaSort:null,ariaValueMax:J,ariaValueMin:J,ariaValueNow:J,ariaValueText:null,role:null},transform(n,r){return r==="role"?r:"aria-"+r.slice(4).toLowerCase()}});function rg(n,r){return r in n?n[r]:r}function ag(n,r){return rg(n,r.toLowerCase())}const Mb=Mi({attributes:{acceptcharset:"accept-charset",classname:"class",htmlfor:"for",httpequiv:"http-equiv"},mustUseProperty:["checked","multiple","muted","selected"],properties:{abbr:null,accept:Oi,acceptCharset:tt,accessKey:tt,action:null,allow:null,allowFullScreen:Oe,allowPaymentRequest:Oe,allowUserMedia:Oe,alt:null,as:null,async:Oe,autoCapitalize:null,autoComplete:tt,autoFocus:Oe,autoPlay:Oe,blocking:tt,capture:null,charSet:null,checked:Oe,cite:null,className:tt,cols:J,colSpan:null,content:null,contentEditable:pt,controls:Oe,controlsList:tt,coords:J|Oi,crossOrigin:null,data:null,dateTime:null,decoding:null,default:Oe,defer:Oe,dir:null,dirName:null,disabled:Oe,download:ms,draggable:pt,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:Oe,formTarget:null,headers:tt,height:J,hidden:ms,high:J,href:null,hrefLang:null,htmlFor:tt,httpEquiv:tt,id:null,imageSizes:null,imageSrcSet:null,inert:Oe,inputMode:null,integrity:null,is:null,isMap:Oe,itemId:null,itemProp:tt,itemRef:tt,itemScope:Oe,itemType:tt,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:Oe,low:J,manifest:null,max:null,maxLength:J,media:null,method:null,min:null,minLength:J,multiple:Oe,muted:Oe,name:null,nonce:null,noModule:Oe,noValidate:Oe,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:Oe,optimum:J,pattern:null,ping:tt,placeholder:null,playsInline:Oe,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:Oe,referrerPolicy:null,rel:tt,required:Oe,reversed:Oe,rows:J,rowSpan:J,sandbox:tt,scope:null,scoped:Oe,seamless:Oe,selected:Oe,shadowRootClonable:Oe,shadowRootDelegatesFocus:Oe,shadowRootMode:null,shape:null,size:J,sizes:null,slot:null,span:J,spellCheck:pt,src:null,srcDoc:null,srcLang:null,srcSet:null,start:J,step:null,style:null,tabIndex:J,target:null,title:null,translate:null,type:null,typeMustMatch:Oe,useMap:null,value:pt,width:J,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:tt,axis:null,background:null,bgColor:null,border:J,borderColor:null,bottomMargin:J,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:Oe,declare:Oe,event:null,face:null,frame:null,frameBorder:null,hSpace:J,leftMargin:J,link:null,longDesc:null,lowSrc:null,marginHeight:J,marginWidth:J,noResize:Oe,noHref:Oe,noShade:Oe,noWrap:Oe,object:null,profile:null,prompt:null,rev:null,rightMargin:J,rules:null,scheme:null,scrolling:pt,standby:null,summary:null,text:null,topMargin:J,valueType:null,version:null,vAlign:null,vLink:null,vSpace:J,allowTransparency:null,autoCorrect:null,autoSave:null,disablePictureInPicture:Oe,disableRemotePlayback:Oe,prefix:null,property:null,results:J,security:null,unselectable:null},space:"html",transform:ag}),Rb=Mi({attributes:{accentHeight:"accent-height",alignmentBaseline:"alignment-baseline",arabicForm:"arabic-form",baselineShift:"baseline-shift",capHeight:"cap-height",className:"class",clipPath:"clip-path",clipRule:"clip-rule",colorInterpolation:"color-interpolation",colorInterpolationFilters:"color-interpolation-filters",colorProfile:"color-profile",colorRendering:"color-rendering",crossOrigin:"crossorigin",dataType:"datatype",dominantBaseline:"dominant-baseline",enableBackground:"enable-background",fillOpacity:"fill-opacity",fillRule:"fill-rule",floodColor:"flood-color",floodOpacity:"flood-opacity",fontFamily:"font-family",fontSize:"font-size",fontSizeAdjust:"font-size-adjust",fontStretch:"font-stretch",fontStyle:"font-style",fontVariant:"font-variant",fontWeight:"font-weight",glyphName:"glyph-name",glyphOrientationHorizontal:"glyph-orientation-horizontal",glyphOrientationVertical:"glyph-orientation-vertical",hrefLang:"hreflang",horizAdvX:"horiz-adv-x",horizOriginX:"horiz-origin-x",horizOriginY:"horiz-origin-y",imageRendering:"image-rendering",letterSpacing:"letter-spacing",lightingColor:"lighting-color",markerEnd:"marker-end",markerMid:"marker-mid",markerStart:"marker-start",navDown:"nav-down",navDownLeft:"nav-down-left",navDownRight:"nav-down-right",navLeft:"nav-left",navNext:"nav-next",navPrev:"nav-prev",navRight:"nav-right",navUp:"nav-up",navUpLeft:"nav-up-left",navUpRight:"nav-up-right",onAbort:"onabort",onActivate:"onactivate",onAfterPrint:"onafterprint",onBeforePrint:"onbeforeprint",onBegin:"onbegin",onCancel:"oncancel",onCanPlay:"oncanplay",onCanPlayThrough:"oncanplaythrough",onChange:"onchange",onClick:"onclick",onClose:"onclose",onCopy:"oncopy",onCueChange:"oncuechange",onCut:"oncut",onDblClick:"ondblclick",onDrag:"ondrag",onDragEnd:"ondragend",onDragEnter:"ondragenter",onDragExit:"ondragexit",onDragLeave:"ondragleave",onDragOver:"ondragover",onDragStart:"ondragstart",onDrop:"ondrop",onDurationChange:"ondurationchange",onEmptied:"onemptied",onEnd:"onend",onEnded:"onended",onError:"onerror",onFocus:"onfocus",onFocusIn:"onfocusin",onFocusOut:"onfocusout",onHashChange:"onhashchange",onInput:"oninput",onInvalid:"oninvalid",onKeyDown:"onkeydown",onKeyPress:"onkeypress",onKeyUp:"onkeyup",onLoad:"onload",onLoadedData:"onloadeddata",onLoadedMetadata:"onloadedmetadata",onLoadStart:"onloadstart",onMessage:"onmessage",onMouseDown:"onmousedown",onMouseEnter:"onmouseenter",onMouseLeave:"onmouseleave",onMouseMove:"onmousemove",onMouseOut:"onmouseout",onMouseOver:"onmouseover",onMouseUp:"onmouseup",onMouseWheel:"onmousewheel",onOffline:"onoffline",onOnline:"ononline",onPageHide:"onpagehide",onPageShow:"onpageshow",onPaste:"onpaste",onPause:"onpause",onPlay:"onplay",onPlaying:"onplaying",onPopState:"onpopstate",onProgress:"onprogress",onRateChange:"onratechange",onRepeat:"onrepeat",onReset:"onreset",onResize:"onresize",onScroll:"onscroll",onSeeked:"onseeked",onSeeking:"onseeking",onSelect:"onselect",onShow:"onshow",onStalled:"onstalled",onStorage:"onstorage",onSubmit:"onsubmit",onSuspend:"onsuspend",onTimeUpdate:"ontimeupdate",onToggle:"ontoggle",onUnload:"onunload",onVolumeChange:"onvolumechange",onWaiting:"onwaiting",onZoom:"onzoom",overlinePosition:"overline-position",overlineThickness:"overline-thickness",paintOrder:"paint-order",panose1:"panose-1",pointerEvents:"pointer-events",referrerPolicy:"referrerpolicy",renderingIntent:"rendering-intent",shapeRendering:"shape-rendering",stopColor:"stop-color",stopOpacity:"stop-opacity",strikethroughPosition:"strikethrough-position",strikethroughThickness:"strikethrough-thickness",strokeDashArray:"stroke-dasharray",strokeDashOffset:"stroke-dashoffset",strokeLineCap:"stroke-linecap",strokeLineJoin:"stroke-linejoin",strokeMiterLimit:"stroke-miterlimit",strokeOpacity:"stroke-opacity",strokeWidth:"stroke-width",tabIndex:"tabindex",textAnchor:"text-anchor",textDecoration:"text-decoration",textRendering:"text-rendering",transformOrigin:"transform-origin",typeOf:"typeof",underlinePosition:"underline-position",underlineThickness:"underline-thickness",unicodeBidi:"unicode-bidi",unicodeRange:"unicode-range",unitsPerEm:"units-per-em",vAlphabetic:"v-alphabetic",vHanging:"v-hanging",vIdeographic:"v-ideographic",vMathematical:"v-mathematical",vectorEffect:"vector-effect",vertAdvY:"vert-adv-y",vertOriginX:"vert-origin-x",vertOriginY:"vert-origin-y",wordSpacing:"word-spacing",writingMode:"writing-mode",xHeight:"x-height",playbackOrder:"playbackorder",timelineBegin:"timelinebegin"},properties:{about:$t,accentHeight:J,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:J,amplitude:J,arabicForm:null,ascent:J,attributeName:null,attributeType:null,azimuth:J,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:J,by:null,calcMode:null,capHeight:J,className:tt,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:J,diffuseConstant:J,direction:null,display:null,dur:null,divisor:J,dominantBaseline:null,download:Oe,dx:null,dy:null,edgeMode:null,editable:null,elevation:J,enableBackground:null,end:null,event:null,exponent:J,externalResourcesRequired:null,fill:null,fillOpacity:J,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:Oi,g2:Oi,glyphName:Oi,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:J,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:J,horizOriginX:J,horizOriginY:J,id:null,ideographic:J,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:J,k:J,k1:J,k2:J,k3:J,k4:J,kernelMatrix:$t,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:J,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:J,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:J,overlineThickness:J,paintOrder:null,panose1:null,path:null,pathLength:J,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:tt,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:J,pointsAtY:J,pointsAtZ:J,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:$t,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:$t,rev:$t,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:$t,requiredFeatures:$t,requiredFonts:$t,requiredFormats:$t,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:J,specularExponent:J,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:J,strikethroughThickness:J,string:null,stroke:null,strokeDashArray:$t,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:J,strokeOpacity:J,strokeWidth:null,style:null,surfaceScale:J,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:$t,tabIndex:J,tableValues:null,target:null,targetX:J,targetY:J,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:$t,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:J,underlineThickness:J,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:J,values:null,vAlphabetic:J,vMathematical:J,vectorEffect:null,vHanging:J,vIdeographic:J,version:null,vertAdvY:J,vertOriginX:J,vertOriginY:J,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:J,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:"svg",transform:rg}),ug=Mi({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:"xlink",transform(n,r){return"xlink:"+r.slice(5).toLowerCase()}}),og=Mi({attributes:{xmlnsxlink:"xmlns:xlink"},properties:{xmlnsXLink:null,xmlns:null},space:"xmlns",transform:ag}),cg=Mi({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:"xml",transform(n,r){return"xml:"+r.slice(3).toLowerCase()}}),Nb={classId:"classID",dataType:"datatype",itemId:"itemID",strokeDashArray:"strokeDasharray",strokeDashOffset:"strokeDashoffset",strokeLineCap:"strokeLinecap",strokeLineJoin:"strokeLinejoin",strokeMiterLimit:"strokeMiterlimit",typeOf:"typeof",xLinkActuate:"xlinkActuate",xLinkArcRole:"xlinkArcrole",xLinkHref:"xlinkHref",xLinkRole:"xlinkRole",xLinkShow:"xlinkShow",xLinkTitle:"xlinkTitle",xLinkType:"xlinkType",xmlnsXLink:"xmlnsXlink"},Lb=/[A-Z]/g,cm=/-[a-z]/g,Ub=/^data[-\\w.:]+$/i;function jb(n,r){const a=ps(r);let u=r,c=Gt;if(a in n.normal)return n.property[n.normal[a]];if(a.length>4&&a.slice(0,4)==="data"&&Ub.test(r)){if(r.charAt(4)==="-"){const f=r.slice(5).replace(cm,Hb);u="data"+f.charAt(0).toUpperCase()+f.slice(1)}else{const f=r.slice(4);if(!cm.test(f)){let d=f.replace(Lb,Bb);d.charAt(0)!=="-"&&(d="-"+d),r="data"+d}}c=zs}return new c(u,r)}function Bb(n){return"-"+n.toLowerCase()}function Hb(n){return n.charAt(1).toUpperCase()}const qb=lg([ig,Mb,ug,og,cg],"html"),_s=lg([ig,Rb,ug,og,cg],"svg");function Yb(n){return n.join(" ").trim()}var Ti={},Fc,sm;function Vb(){if(sm)return Fc;sm=1;var n=/\\/\\*[^*]*\\*+([^/*][^*]*\\*+)*\\//g,r=/\\n/g,a=/^\\s*/,u=/^(\\*?[-#/*\\\\\\w]+(\\[[0-9a-z_-]+\\])?)\\s*/,c=/^:\\s*/,f=/^((?:\'(?:\\\\\'|.)*?\'|"(?:\\\\"|.)*?"|\\([^)]*?\\)|[^};])+)/,d=/^[;\\s]*/,h=/^\\s+|\\s+$/g,m=`\n`,p="/",v="*",g="",x="comment",S="declaration";function C(j,_){if(typeof j!="string")throw new TypeError("First argument must be a string");if(!j)return[];_=_||{};var F=1,Y=1;function le(re){var W=re.match(r);W&&(F+=W.length);var D=re.lastIndexOf(m);Y=~D?re.length-D:Y+re.length}function ue(){var re={line:F,column:Y};return function(W){return W.position=new N(re),Se(),W}}function N(re){this.start=re,this.end={line:F,column:Y},this.source=_.source}N.prototype.content=j;function $(re){var W=new Error(_.source+":"+F+":"+Y+": "+re);if(W.reason=re,W.filename=_.source,W.line=F,W.column=Y,W.source=j,!_.silent)throw W}function he(re){var W=re.exec(j);if(W){var D=W[0];return le(D),j=j.slice(D.length),W}}function Se(){he(a)}function L(re){var W;for(re=re||[];W=ie();)W!==!1&&re.push(W);return re}function ie(){var re=ue();if(!(p!=j.charAt(0)||v!=j.charAt(1))){for(var W=2;g!=j.charAt(W)&&(v!=j.charAt(W)||p!=j.charAt(W+1));)++W;if(W+=2,g===j.charAt(W-1))return $("End of comment missing");var D=j.slice(2,W-2);return Y+=2,le(D),j=j.slice(W),Y+=2,re({type:x,comment:D})}}function ee(){var re=ue(),W=he(u);if(W){if(ie(),!he(c))return $("property missing \':\'");var D=he(f),K=re({type:S,property:B(W[0].replace(n,g)),value:D?B(D[0].replace(n,g)):g});return he(d),K}}function ke(){var re=[];L(re);for(var W;W=ee();)W!==!1&&(re.push(W),L(re));return re}return Se(),ke()}function B(j){return j?j.replace(h,g):g}return Fc=C,Fc}var fm;function Gb(){if(fm)return Ti;fm=1;var n=Ti&&Ti.__importDefault||function(u){return u&&u.__esModule?u:{default:u}};Object.defineProperty(Ti,"__esModule",{value:!0}),Ti.default=a;const r=n(Vb());function a(u,c){let f=null;if(!u||typeof u!="string")return f;const d=(0,r.default)(u),h=typeof c=="function";return d.forEach(m=>{if(m.type!=="declaration")return;const{property:p,value:v}=m;h?c(p,v,m):v&&(f=f||{},f[p]=v)}),f}return Ti}var zr={},dm;function Xb(){if(dm)return zr;dm=1,Object.defineProperty(zr,"__esModule",{value:!0}),zr.camelCase=void 0;var n=/^--[a-zA-Z0-9_-]+$/,r=/-([a-z])/g,a=/^[^-]+$/,u=/^-(webkit|moz|ms|o|khtml)-/,c=/^-(ms)-/,f=function(p){return!p||a.test(p)||n.test(p)},d=function(p,v){return v.toUpperCase()},h=function(p,v){return"".concat(v,"-")},m=function(p,v){return v===void 0&&(v={}),f(p)?p:(p=p.toLowerCase(),v.reactCompat?p=p.replace(c,h):p=p.replace(u,h),p.replace(r,d))};return zr.camelCase=m,zr}var _r,hm;function Qb(){if(hm)return _r;hm=1;var n=_r&&_r.__importDefault||function(c){return c&&c.__esModule?c:{default:c}},r=n(Gb()),a=Xb();function u(c,f){var d={};return!c||typeof c!="string"||(0,r.default)(c,function(h,m){h&&m&&(d[(0,a.camelCase)(h,f)]=m)}),d}return u.default=u,_r=u,_r}var Ib=Qb();const Zb=ws(Ib),sg=fg("end"),Os=fg("start");function fg(n){return r;function r(a){const u=a&&a.position&&a.position[n]||{};if(typeof u.line=="number"&&u.line>0&&typeof u.column=="number"&&u.column>0)return{line:u.line,column:u.column,offset:typeof u.offset=="number"&&u.offset>-1?u.offset:void 0}}}function Fb(n){const r=Os(n),a=sg(n);if(r&&a)return{start:r,end:a}}function Rr(n){return!n||typeof n!="object"?"":"position"in n||"type"in n?pm(n.position):"start"in n||"end"in n?pm(n):"line"in n||"column"in n?ys(n):""}function ys(n){return mm(n&&n.line)+":"+mm(n&&n.column)}function pm(n){return ys(n&&n.start)+"-"+ys(n&&n.end)}function mm(n){return n&&typeof n=="number"?n:1}class _t extends Error{constructor(r,a,u){super(),typeof a=="string"&&(u=a,a=void 0);let c="",f={},d=!1;if(a&&("line"in a&&"column"in a?f={place:a}:"start"in a&&"end"in a?f={place:a}:"type"in a?f={ancestors:[a],place:a.position}:f={...a}),typeof r=="string"?c=r:!f.cause&&r&&(d=!0,c=r.message,f.cause=r),!f.ruleId&&!f.source&&typeof u=="string"){const m=u.indexOf(":");m===-1?f.ruleId=u:(f.source=u.slice(0,m),f.ruleId=u.slice(m+1))}if(!f.place&&f.ancestors&&f.ancestors){const m=f.ancestors[f.ancestors.length-1];m&&(f.place=m.position)}const h=f.place&&"start"in f.place?f.place.start:f.place;this.ancestors=f.ancestors||void 0,this.cause=f.cause||void 0,this.column=h?h.column:void 0,this.fatal=void 0,this.file="",this.message=c,this.line=h?h.line:void 0,this.name=Rr(f.place)||"1:1",this.place=f.place||void 0,this.reason=this.message,this.ruleId=f.ruleId||void 0,this.source=f.source||void 0,this.stack=d&&f.cause&&typeof f.cause.stack=="string"?f.cause.stack:"",this.actual=void 0,this.expected=void 0,this.note=void 0,this.url=void 0}}_t.prototype.file="";_t.prototype.name="";_t.prototype.reason="";_t.prototype.message="";_t.prototype.stack="";_t.prototype.column=void 0;_t.prototype.line=void 0;_t.prototype.ancestors=void 0;_t.prototype.cause=void 0;_t.prototype.fatal=void 0;_t.prototype.place=void 0;_t.prototype.ruleId=void 0;_t.prototype.source=void 0;const Ds={}.hasOwnProperty,Kb=new Map,Jb=/[A-Z]/g,Wb=new Set(["table","tbody","thead","tfoot","tr"]),$b=new Set(["td","th"]),dg="https://github.com/syntax-tree/hast-util-to-jsx-runtime";function Pb(n,r){if(!r||r.Fragment===void 0)throw new TypeError("Expected `Fragment` in options");const a=r.filePath||void 0;let u;if(r.development){if(typeof r.jsxDEV!="function")throw new TypeError("Expected `jsxDEV` in options when `development: true`");u=u0(a,r.jsxDEV)}else{if(typeof r.jsx!="function")throw new TypeError("Expected `jsx` in production options");if(typeof r.jsxs!="function")throw new TypeError("Expected `jsxs` in production options");u=a0(a,r.jsx,r.jsxs)}const c={Fragment:r.Fragment,ancestors:[],components:r.components||{},create:u,elementAttributeNameCase:r.elementAttributeNameCase||"react",evaluater:r.createEvaluater?r.createEvaluater():void 0,filePath:a,ignoreInvalidStyle:r.ignoreInvalidStyle||!1,passKeys:r.passKeys!==!1,passNode:r.passNode||!1,schema:r.space==="svg"?_s:qb,stylePropertyNameCase:r.stylePropertyNameCase||"dom",tableCellAlignToStyle:r.tableCellAlignToStyle!==!1},f=hg(c,n,void 0);return f&&typeof f!="string"?f:c.create(n,c.Fragment,{children:f||void 0},void 0)}function hg(n,r,a){if(r.type==="element")return e0(n,r,a);if(r.type==="mdxFlowExpression"||r.type==="mdxTextExpression")return t0(n,r);if(r.type==="mdxJsxFlowElement"||r.type==="mdxJsxTextElement")return l0(n,r,a);if(r.type==="mdxjsEsm")return n0(n,r);if(r.type==="root")return i0(n,r,a);if(r.type==="text")return r0(n,r)}function e0(n,r,a){const u=n.schema;let c=u;r.tagName.toLowerCase()==="svg"&&u.space==="html"&&(c=_s,n.schema=c),n.ancestors.push(r);const f=mg(n,r.tagName,!1),d=o0(n,r);let h=Rs(n,r);return Wb.has(r.tagName)&&(h=h.filter(function(m){return typeof m=="string"?!Ob(m):!0})),pg(n,d,f,r),Ms(d,h),n.ancestors.pop(),n.schema=u,n.create(r,f,d,a)}function t0(n,r){if(r.data&&r.data.estree&&n.evaluater){const u=r.data.estree.body[0];return u.type,n.evaluater.evaluateExpression(u.expression)}Ur(n,r.position)}function n0(n,r){if(r.data&&r.data.estree&&n.evaluater)return n.evaluater.evaluateProgram(r.data.estree);Ur(n,r.position)}function l0(n,r,a){const u=n.schema;let c=u;r.name==="svg"&&u.space==="html"&&(c=_s,n.schema=c),n.ancestors.push(r);const f=r.name===null?n.Fragment:mg(n,r.name,!0),d=c0(n,r),h=Rs(n,r);return pg(n,d,f,r),Ms(d,h),n.ancestors.pop(),n.schema=u,n.create(r,f,d,a)}function i0(n,r,a){const u={};return Ms(u,Rs(n,r)),n.create(r,n.Fragment,u,a)}function r0(n,r){return r.value}function pg(n,r,a,u){typeof a!="string"&&a!==n.Fragment&&n.passNode&&(r.node=u)}function Ms(n,r){if(r.length>0){const a=r.length>1?r:r[0];a&&(n.children=a)}}function a0(n,r,a){return u;function u(c,f,d,h){const p=Array.isArray(d.children)?a:r;return h?p(f,d,h):p(f,d)}}function u0(n,r){return a;function a(u,c,f,d){const h=Array.isArray(f.children),m=Os(u);return r(c,f,d,h,{columnNumber:m?m.column-1:void 0,fileName:n,lineNumber:m?m.line:void 0},void 0)}}function o0(n,r){const a={};let u,c;for(c in r.properties)if(c!=="children"&&Ds.call(r.properties,c)){const f=s0(n,c,r.properties[c]);if(f){const[d,h]=f;n.tableCellAlignToStyle&&d==="align"&&typeof h=="string"&&$b.has(r.tagName)?u=h:a[d]=h}}if(u){const f=a.style||(a.style={});f[n.stylePropertyNameCase==="css"?"text-align":"textAlign"]=u}return a}function c0(n,r){const a={};for(const u of r.attributes)if(u.type==="mdxJsxExpressionAttribute")if(u.data&&u.data.estree&&n.evaluater){const f=u.data.estree.body[0];f.type;const d=f.expression;d.type;const h=d.properties[0];h.type,Object.assign(a,n.evaluater.evaluateExpression(h.argument))}else Ur(n,r.position);else{const c=u.name;let f;if(u.value&&typeof u.value=="object")if(u.value.data&&u.value.data.estree&&n.evaluater){const h=u.value.data.estree.body[0];h.type,f=n.evaluater.evaluateExpression(h.expression)}else Ur(n,r.position);else f=u.value===null?!0:u.value;a[c]=f}return a}function Rs(n,r){const a=[];let u=-1;const c=n.passKeys?new Map:Kb;for(;++u<r.children.length;){const f=r.children[u];let d;if(n.passKeys){const m=f.type==="element"?f.tagName:f.type==="mdxJsxFlowElement"||f.type==="mdxJsxTextElement"?f.name:void 0;if(m){const p=c.get(m)||0;d=m+"-"+p,c.set(m,p+1)}}const h=hg(n,f,d);h!==void 0&&a.push(h)}return a}function s0(n,r,a){const u=jb(n.schema,r);if(!(a==null||typeof a=="number"&&Number.isNaN(a))){if(Array.isArray(a)&&(a=u.commaSeparated?wb(a):Yb(a)),u.property==="style"){let c=typeof a=="object"?a:f0(n,String(a));return n.stylePropertyNameCase==="css"&&(c=d0(c)),["style",c]}return[n.elementAttributeNameCase==="react"&&u.space?Nb[u.property]||u.property:u.attribute,a]}}function f0(n,r){try{return Zb(r,{reactCompat:!0})}catch(a){if(n.ignoreInvalidStyle)return{};const u=a,c=new _t("Cannot parse `style` attribute",{ancestors:n.ancestors,cause:u,ruleId:"style",source:"hast-util-to-jsx-runtime"});throw c.file=n.filePath||void 0,c.url=dg+"#cannot-parse-style-attribute",c}}function mg(n,r,a){let u;if(!a)u={type:"Literal",value:r};else if(r.includes(".")){const c=r.split(".");let f=-1,d;for(;++f<c.length;){const h=am(c[f])?{type:"Identifier",name:c[f]}:{type:"Literal",value:c[f]};d=d?{type:"MemberExpression",object:d,property:h,computed:!!(f&&h.type==="Literal"),optional:!1}:h}u=d}else u=am(r)&&!/^[a-z]/.test(r)?{type:"Identifier",name:r}:{type:"Literal",value:r};if(u.type==="Literal"){const c=u.value;return Ds.call(n.components,c)?n.components[c]:c}if(n.evaluater)return n.evaluater.evaluateExpression(u);Ur(n)}function Ur(n,r){const a=new _t("Cannot handle MDX estrees without `createEvaluater`",{ancestors:n.ancestors,place:r,ruleId:"mdx-estree",source:"hast-util-to-jsx-runtime"});throw a.file=n.filePath||void 0,a.url=dg+"#cannot-handle-mdx-estrees-without-createevaluater",a}function d0(n){const r={};let a;for(a in n)Ds.call(n,a)&&(r[h0(a)]=n[a]);return r}function h0(n){let r=n.replace(Jb,p0);return r.slice(0,3)==="ms-"&&(r="-"+r),r}function p0(n){return"-"+n.toLowerCase()}const Kc={action:["form"],cite:["blockquote","del","ins","q"],data:["object"],formAction:["button","input"],href:["a","area","base","link"],icon:["menuitem"],itemId:null,manifest:["html"],ping:["a","area"],poster:["video"],src:["audio","embed","iframe","img","input","script","source","track","video"]},m0={};function Ns(n,r){const a=m0,u=typeof a.includeImageAlt=="boolean"?a.includeImageAlt:!0,c=typeof a.includeHtml=="boolean"?a.includeHtml:!0;return gg(n,u,c)}function gg(n,r,a){if(g0(n)){if("value"in n)return n.type==="html"&&!a?"":n.value;if(r&&"alt"in n&&n.alt)return n.alt;if("children"in n)return gm(n.children,r,a)}return Array.isArray(n)?gm(n,r,a):""}function gm(n,r,a){const u=[];let c=-1;for(;++c<n.length;)u[c]=gg(n[c],r,a);return u.join("")}function g0(n){return!!(n&&typeof n=="object")}const ym=document.createElement("i");function Ls(n){const r="&"+n+";";ym.innerHTML=r;const a=ym.textContent;return a.charCodeAt(a.length-1)===59&&n!=="semi"||a===r?!1:a}function Pt(n,r,a,u){const c=n.length;let f=0,d;if(r<0?r=-r>c?0:c+r:r=r>c?c:r,a=a>0?a:0,u.length<1e4)d=Array.from(u),d.unshift(r,a),n.splice(...d);else for(a&&n.splice(r,a);f<u.length;)d=u.slice(f,f+1e4),d.unshift(r,0),n.splice(...d),f+=1e4,r+=1e4}function hn(n,r){return n.length>0?(Pt(n,n.length,0,r),n):r}const vm={}.hasOwnProperty;function yg(n){const r={};let a=-1;for(;++a<n.length;)y0(r,n[a]);return r}function y0(n,r){let a;for(a in r){const c=(vm.call(n,a)?n[a]:void 0)||(n[a]={}),f=r[a];let d;if(f)for(d in f){vm.call(c,d)||(c[d]=[]);const h=f[d];v0(c[d],Array.isArray(h)?h:h?[h]:[])}}}function v0(n,r){let a=-1;const u=[];for(;++a<r.length;)(r[a].add==="after"?n:u).push(r[a]);Pt(n,0,0,u)}function vg(n,r){const a=Number.parseInt(n,r);return a<9||a===11||a>13&&a<32||a>126&&a<160||a>55295&&a<57344||a>64975&&a<65008||(a&65535)===65535||(a&65535)===65534||a>1114111?"\uFFFD":String.fromCodePoint(a)}function vn(n){return n.replace(/[\\t\\n\\r ]+/g," ").replace(/^ | $/g,"").toLowerCase().toUpperCase()}const Rt=bl(/[A-Za-z]/),zt=bl(/[\\dA-Za-z]/),b0=bl(/[#-\'*+\\--9=?A-Z^-~]/);function pu(n){return n!==null&&(n<32||n===127)}const vs=bl(/\\d/),x0=bl(/[\\dA-Fa-f]/),S0=bl(/[!-/:-@[-`{-~]/);function be(n){return n!==null&&n<-2}function Pe(n){return n!==null&&(n<0||n===32)}function Ne(n){return n===-2||n===-1||n===32}const bu=bl(/\\p{P}|\\p{S}/u),ql=bl(/\\s/);function bl(n){return r;function r(a){return a!==null&&a>-1&&n.test(String.fromCharCode(a))}}function Ri(n){const r=[];let a=-1,u=0,c=0;for(;++a<n.length;){const f=n.charCodeAt(a);let d="";if(f===37&&zt(n.charCodeAt(a+1))&&zt(n.charCodeAt(a+2)))c=2;else if(f<128)/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(f))||(d=String.fromCharCode(f));else if(f>55295&&f<57344){const h=n.charCodeAt(a+1);f<56320&&h>56319&&h<57344?(d=String.fromCharCode(f,h),c=1):d="\uFFFD"}else d=String.fromCharCode(f);d&&(r.push(n.slice(u,a),encodeURIComponent(d)),u=a+c+1,d=""),c&&(a+=c,c=0)}return r.join("")+n.slice(u)}function Be(n,r,a,u){const c=u?u-1:Number.POSITIVE_INFINITY;let f=0;return d;function d(m){return Ne(m)?(n.enter(a),h(m)):r(m)}function h(m){return Ne(m)&&f++<c?(n.consume(m),h):(n.exit(a),r(m))}}const k0={tokenize:E0};function E0(n){const r=n.attempt(this.parser.constructs.contentInitial,u,c);let a;return r;function u(h){if(h===null){n.consume(h);return}return n.enter("lineEnding"),n.consume(h),n.exit("lineEnding"),Be(n,r,"linePrefix")}function c(h){return n.enter("paragraph"),f(h)}function f(h){const m=n.enter("chunkText",{contentType:"text",previous:a});return a&&(a.next=m),a=m,d(h)}function d(h){if(h===null){n.exit("chunkText"),n.exit("paragraph"),n.consume(h);return}return be(h)?(n.consume(h),n.exit("chunkText"),f):(n.consume(h),d)}}const A0={tokenize:w0},bm={tokenize:T0};function w0(n){const r=this,a=[];let u=0,c,f,d;return h;function h(Y){if(u<a.length){const le=a[u];return r.containerState=le[1],n.attempt(le[0].continuation,m,p)(Y)}return p(Y)}function m(Y){if(u++,r.containerState._closeFlow){r.containerState._closeFlow=void 0,c&&F();const le=r.events.length;let ue=le,N;for(;ue--;)if(r.events[ue][0]==="exit"&&r.events[ue][1].type==="chunkFlow"){N=r.events[ue][1].end;break}_(u);let $=le;for(;$<r.events.length;)r.events[$][1].end={...N},$++;return Pt(r.events,ue+1,0,r.events.slice(le)),r.events.length=$,p(Y)}return h(Y)}function p(Y){if(u===a.length){if(!c)return x(Y);if(c.currentConstruct&&c.currentConstruct.concrete)return C(Y);r.interrupt=!!(c.currentConstruct&&!c._gfmTableDynamicInterruptHack)}return r.containerState={},n.check(bm,v,g)(Y)}function v(Y){return c&&F(),_(u),x(Y)}function g(Y){return r.parser.lazy[r.now().line]=u!==a.length,d=r.now().offset,C(Y)}function x(Y){return r.containerState={},n.attempt(bm,S,C)(Y)}function S(Y){return u++,a.push([r.currentConstruct,r.containerState]),x(Y)}function C(Y){if(Y===null){c&&F(),_(0),n.consume(Y);return}return c=c||r.parser.flow(r.now()),n.enter("chunkFlow",{_tokenizer:c,contentType:"flow",previous:f}),B(Y)}function B(Y){if(Y===null){j(n.exit("chunkFlow"),!0),_(0),n.consume(Y);return}return be(Y)?(n.consume(Y),j(n.exit("chunkFlow")),u=0,r.interrupt=void 0,h):(n.consume(Y),B)}function j(Y,le){const ue=r.sliceStream(Y);if(le&&ue.push(null),Y.previous=f,f&&(f.next=Y),f=Y,c.defineSkip(Y.start),c.write(ue),r.parser.lazy[Y.start.line]){let N=c.events.length;for(;N--;)if(c.events[N][1].start.offset<d&&(!c.events[N][1].end||c.events[N][1].end.offset>d))return;const $=r.events.length;let he=$,Se,L;for(;he--;)if(r.events[he][0]==="exit"&&r.events[he][1].type==="chunkFlow"){if(Se){L=r.events[he][1].end;break}Se=!0}for(_(u),N=$;N<r.events.length;)r.events[N][1].end={...L},N++;Pt(r.events,he+1,0,r.events.slice($)),r.events.length=N}}function _(Y){let le=a.length;for(;le-- >Y;){const ue=a[le];r.containerState=ue[1],ue[0].exit.call(r,n)}a.length=Y}function F(){c.write([null]),f=void 0,c=void 0,r.containerState._closeFlow=void 0}}function T0(n,r,a){return Be(n,n.attempt(this.parser.constructs.document,r,a),"linePrefix",this.parser.constructs.disable.null.includes("codeIndented")?void 0:4)}function Di(n){if(n===null||Pe(n)||ql(n))return 1;if(bu(n))return 2}function xu(n,r,a){const u=[];let c=-1;for(;++c<n.length;){const f=n[c].resolveAll;f&&!u.includes(f)&&(r=f(r,a),u.push(f))}return r}const bs={name:"attention",resolveAll:C0,tokenize:z0};function C0(n,r){let a=-1,u,c,f,d,h,m,p,v;for(;++a<n.length;)if(n[a][0]==="enter"&&n[a][1].type==="attentionSequence"&&n[a][1]._close){for(u=a;u--;)if(n[u][0]==="exit"&&n[u][1].type==="attentionSequence"&&n[u][1]._open&&r.sliceSerialize(n[u][1]).charCodeAt(0)===r.sliceSerialize(n[a][1]).charCodeAt(0)){if((n[u][1]._close||n[a][1]._open)&&(n[a][1].end.offset-n[a][1].start.offset)%3&&!((n[u][1].end.offset-n[u][1].start.offset+n[a][1].end.offset-n[a][1].start.offset)%3))continue;m=n[u][1].end.offset-n[u][1].start.offset>1&&n[a][1].end.offset-n[a][1].start.offset>1?2:1;const g={...n[u][1].end},x={...n[a][1].start};xm(g,-m),xm(x,m),d={type:m>1?"strongSequence":"emphasisSequence",start:g,end:{...n[u][1].end}},h={type:m>1?"strongSequence":"emphasisSequence",start:{...n[a][1].start},end:x},f={type:m>1?"strongText":"emphasisText",start:{...n[u][1].end},end:{...n[a][1].start}},c={type:m>1?"strong":"emphasis",start:{...d.start},end:{...h.end}},n[u][1].end={...d.start},n[a][1].start={...h.end},p=[],n[u][1].end.offset-n[u][1].start.offset&&(p=hn(p,[["enter",n[u][1],r],["exit",n[u][1],r]])),p=hn(p,[["enter",c,r],["enter",d,r],["exit",d,r],["enter",f,r]]),p=hn(p,xu(r.parser.constructs.insideSpan.null,n.slice(u+1,a),r)),p=hn(p,[["exit",f,r],["enter",h,r],["exit",h,r],["exit",c,r]]),n[a][1].end.offset-n[a][1].start.offset?(v=2,p=hn(p,[["enter",n[a][1],r],["exit",n[a][1],r]])):v=0,Pt(n,u-1,a-u+3,p),a=u+p.length-v-2;break}}for(a=-1;++a<n.length;)n[a][1].type==="attentionSequence"&&(n[a][1].type="data");return n}function z0(n,r){const a=this.parser.constructs.attentionMarkers.null,u=this.previous,c=Di(u);let f;return d;function d(m){return f=m,n.enter("attentionSequence"),h(m)}function h(m){if(m===f)return n.consume(m),h;const p=n.exit("attentionSequence"),v=Di(m),g=!v||v===2&&c||a.includes(m),x=!c||c===2&&v||a.includes(u);return p._open=!!(f===42?g:g&&(c||!x)),p._close=!!(f===42?x:x&&(v||!g)),r(m)}}function xm(n,r){n.column+=r,n.offset+=r,n._bufferIndex+=r}const _0={name:"autolink",tokenize:O0};function O0(n,r,a){let u=0;return c;function c(S){return n.enter("autolink"),n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.enter("autolinkProtocol"),f}function f(S){return Rt(S)?(n.consume(S),d):S===64?a(S):p(S)}function d(S){return S===43||S===45||S===46||zt(S)?(u=1,h(S)):p(S)}function h(S){return S===58?(n.consume(S),u=0,m):(S===43||S===45||S===46||zt(S))&&u++<32?(n.consume(S),h):(u=0,p(S))}function m(S){return S===62?(n.exit("autolinkProtocol"),n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.exit("autolink"),r):S===null||S===32||S===60||pu(S)?a(S):(n.consume(S),m)}function p(S){return S===64?(n.consume(S),v):b0(S)?(n.consume(S),p):a(S)}function v(S){return zt(S)?g(S):a(S)}function g(S){return S===46?(n.consume(S),u=0,v):S===62?(n.exit("autolinkProtocol").type="autolinkEmail",n.enter("autolinkMarker"),n.consume(S),n.exit("autolinkMarker"),n.exit("autolink"),r):x(S)}function x(S){if((S===45||zt(S))&&u++<63){const C=S===45?x:g;return n.consume(S),C}return a(S)}}const Hr={partial:!0,tokenize:D0};function D0(n,r,a){return u;function u(f){return Ne(f)?Be(n,c,"linePrefix")(f):c(f)}function c(f){return f===null||be(f)?r(f):a(f)}}const bg={continuation:{tokenize:R0},exit:N0,name:"blockQuote",tokenize:M0};function M0(n,r,a){const u=this;return c;function c(d){if(d===62){const h=u.containerState;return h.open||(n.enter("blockQuote",{_container:!0}),h.open=!0),n.enter("blockQuotePrefix"),n.enter("blockQuoteMarker"),n.consume(d),n.exit("blockQuoteMarker"),f}return a(d)}function f(d){return Ne(d)?(n.enter("blockQuotePrefixWhitespace"),n.consume(d),n.exit("blockQuotePrefixWhitespace"),n.exit("blockQuotePrefix"),r):(n.exit("blockQuotePrefix"),r(d))}}function R0(n,r,a){const u=this;return c;function c(d){return Ne(d)?Be(n,f,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(d):f(d)}function f(d){return n.attempt(bg,r,a)(d)}}function N0(n){n.exit("blockQuote")}const xg={name:"characterEscape",tokenize:L0};function L0(n,r,a){return u;function u(f){return n.enter("characterEscape"),n.enter("escapeMarker"),n.consume(f),n.exit("escapeMarker"),c}function c(f){return S0(f)?(n.enter("characterEscapeValue"),n.consume(f),n.exit("characterEscapeValue"),n.exit("characterEscape"),r):a(f)}}const Sg={name:"characterReference",tokenize:U0};function U0(n,r,a){const u=this;let c=0,f,d;return h;function h(g){return n.enter("characterReference"),n.enter("characterReferenceMarker"),n.consume(g),n.exit("characterReferenceMarker"),m}function m(g){return g===35?(n.enter("characterReferenceMarkerNumeric"),n.consume(g),n.exit("characterReferenceMarkerNumeric"),p):(n.enter("characterReferenceValue"),f=31,d=zt,v(g))}function p(g){return g===88||g===120?(n.enter("characterReferenceMarkerHexadecimal"),n.consume(g),n.exit("characterReferenceMarkerHexadecimal"),n.enter("characterReferenceValue"),f=6,d=x0,v):(n.enter("characterReferenceValue"),f=7,d=vs,v(g))}function v(g){if(g===59&&c){const x=n.exit("characterReferenceValue");return d===zt&&!Ls(u.sliceSerialize(x))?a(g):(n.enter("characterReferenceMarker"),n.consume(g),n.exit("characterReferenceMarker"),n.exit("characterReference"),r)}return d(g)&&c++<f?(n.consume(g),v):a(g)}}const Sm={partial:!0,tokenize:B0},km={concrete:!0,name:"codeFenced",tokenize:j0};function j0(n,r,a){const u=this,c={partial:!0,tokenize:ue};let f=0,d=0,h;return m;function m(N){return p(N)}function p(N){const $=u.events[u.events.length-1];return f=$&&$[1].type==="linePrefix"?$[2].sliceSerialize($[1],!0).length:0,h=N,n.enter("codeFenced"),n.enter("codeFencedFence"),n.enter("codeFencedFenceSequence"),v(N)}function v(N){return N===h?(d++,n.consume(N),v):d<3?a(N):(n.exit("codeFencedFenceSequence"),Ne(N)?Be(n,g,"whitespace")(N):g(N))}function g(N){return N===null||be(N)?(n.exit("codeFencedFence"),u.interrupt?r(N):n.check(Sm,B,le)(N)):(n.enter("codeFencedFenceInfo"),n.enter("chunkString",{contentType:"string"}),x(N))}function x(N){return N===null||be(N)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),g(N)):Ne(N)?(n.exit("chunkString"),n.exit("codeFencedFenceInfo"),Be(n,S,"whitespace")(N)):N===96&&N===h?a(N):(n.consume(N),x)}function S(N){return N===null||be(N)?g(N):(n.enter("codeFencedFenceMeta"),n.enter("chunkString",{contentType:"string"}),C(N))}function C(N){return N===null||be(N)?(n.exit("chunkString"),n.exit("codeFencedFenceMeta"),g(N)):N===96&&N===h?a(N):(n.consume(N),C)}function B(N){return n.attempt(c,le,j)(N)}function j(N){return n.enter("lineEnding"),n.consume(N),n.exit("lineEnding"),_}function _(N){return f>0&&Ne(N)?Be(n,F,"linePrefix",f+1)(N):F(N)}function F(N){return N===null||be(N)?n.check(Sm,B,le)(N):(n.enter("codeFlowValue"),Y(N))}function Y(N){return N===null||be(N)?(n.exit("codeFlowValue"),F(N)):(n.consume(N),Y)}function le(N){return n.exit("codeFenced"),r(N)}function ue(N,$,he){let Se=0;return L;function L(W){return N.enter("lineEnding"),N.consume(W),N.exit("lineEnding"),ie}function ie(W){return N.enter("codeFencedFence"),Ne(W)?Be(N,ee,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(W):ee(W)}function ee(W){return W===h?(N.enter("codeFencedFenceSequence"),ke(W)):he(W)}function ke(W){return W===h?(Se++,N.consume(W),ke):Se>=d?(N.exit("codeFencedFenceSequence"),Ne(W)?Be(N,re,"whitespace")(W):re(W)):he(W)}function re(W){return W===null||be(W)?(N.exit("codeFencedFence"),$(W)):he(W)}}}function B0(n,r,a){const u=this;return c;function c(d){return d===null?a(d):(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f)}function f(d){return u.parser.lazy[u.now().line]?a(d):r(d)}}const Jc={name:"codeIndented",tokenize:q0},H0={partial:!0,tokenize:Y0};function q0(n,r,a){const u=this;return c;function c(p){return n.enter("codeIndented"),Be(n,f,"linePrefix",5)(p)}function f(p){const v=u.events[u.events.length-1];return v&&v[1].type==="linePrefix"&&v[2].sliceSerialize(v[1],!0).length>=4?d(p):a(p)}function d(p){return p===null?m(p):be(p)?n.attempt(H0,d,m)(p):(n.enter("codeFlowValue"),h(p))}function h(p){return p===null||be(p)?(n.exit("codeFlowValue"),d(p)):(n.consume(p),h)}function m(p){return n.exit("codeIndented"),r(p)}}function Y0(n,r,a){const u=this;return c;function c(d){return u.parser.lazy[u.now().line]?a(d):be(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),c):Be(n,f,"linePrefix",5)(d)}function f(d){const h=u.events[u.events.length-1];return h&&h[1].type==="linePrefix"&&h[2].sliceSerialize(h[1],!0).length>=4?r(d):be(d)?c(d):a(d)}}const V0={name:"codeText",previous:X0,resolve:G0,tokenize:Q0};function G0(n){let r=n.length-4,a=3,u,c;if((n[a][1].type==="lineEnding"||n[a][1].type==="space")&&(n[r][1].type==="lineEnding"||n[r][1].type==="space")){for(u=a;++u<r;)if(n[u][1].type==="codeTextData"){n[a][1].type="codeTextPadding",n[r][1].type="codeTextPadding",a+=2,r-=2;break}}for(u=a-1,r++;++u<=r;)c===void 0?u!==r&&n[u][1].type!=="lineEnding"&&(c=u):(u===r||n[u][1].type==="lineEnding")&&(n[c][1].type="codeTextData",u!==c+2&&(n[c][1].end=n[u-1][1].end,n.splice(c+2,u-c-2),r-=u-c-2,u=c+2),c=void 0);return n}function X0(n){return n!==96||this.events[this.events.length-1][1].type==="characterEscape"}function Q0(n,r,a){let u=0,c,f;return d;function d(g){return n.enter("codeText"),n.enter("codeTextSequence"),h(g)}function h(g){return g===96?(n.consume(g),u++,h):(n.exit("codeTextSequence"),m(g))}function m(g){return g===null?a(g):g===32?(n.enter("space"),n.consume(g),n.exit("space"),m):g===96?(f=n.enter("codeTextSequence"),c=0,v(g)):be(g)?(n.enter("lineEnding"),n.consume(g),n.exit("lineEnding"),m):(n.enter("codeTextData"),p(g))}function p(g){return g===null||g===32||g===96||be(g)?(n.exit("codeTextData"),m(g)):(n.consume(g),p)}function v(g){return g===96?(n.consume(g),c++,v):c===u?(n.exit("codeTextSequence"),n.exit("codeText"),r(g)):(f.type="codeTextData",p(g))}}class I0{constructor(r){this.left=r?[...r]:[],this.right=[]}get(r){if(r<0||r>=this.left.length+this.right.length)throw new RangeError("Cannot access index `"+r+"` in a splice buffer of size `"+(this.left.length+this.right.length)+"`");return r<this.left.length?this.left[r]:this.right[this.right.length-r+this.left.length-1]}get length(){return this.left.length+this.right.length}shift(){return this.setCursor(0),this.right.pop()}slice(r,a){const u=a??Number.POSITIVE_INFINITY;return u<this.left.length?this.left.slice(r,u):r>this.left.length?this.right.slice(this.right.length-u+this.left.length,this.right.length-r+this.left.length).reverse():this.left.slice(r).concat(this.right.slice(this.right.length-u+this.left.length).reverse())}splice(r,a,u){const c=a||0;this.setCursor(Math.trunc(r));const f=this.right.splice(this.right.length-c,Number.POSITIVE_INFINITY);return u&&Or(this.left,u),f.reverse()}pop(){return this.setCursor(Number.POSITIVE_INFINITY),this.left.pop()}push(r){this.setCursor(Number.POSITIVE_INFINITY),this.left.push(r)}pushMany(r){this.setCursor(Number.POSITIVE_INFINITY),Or(this.left,r)}unshift(r){this.setCursor(0),this.right.push(r)}unshiftMany(r){this.setCursor(0),Or(this.right,r.reverse())}setCursor(r){if(!(r===this.left.length||r>this.left.length&&this.right.length===0||r<0&&this.left.length===0))if(r<this.left.length){const a=this.left.splice(r,Number.POSITIVE_INFINITY);Or(this.right,a.reverse())}else{const a=this.right.splice(this.left.length+this.right.length-r,Number.POSITIVE_INFINITY);Or(this.left,a.reverse())}}}function Or(n,r){let a=0;if(r.length<1e4)n.push(...r);else for(;a<r.length;)n.push(...r.slice(a,a+1e4)),a+=1e4}function kg(n){const r={};let a=-1,u,c,f,d,h,m,p;const v=new I0(n);for(;++a<v.length;){for(;a in r;)a=r[a];if(u=v.get(a),a&&u[1].type==="chunkFlow"&&v.get(a-1)[1].type==="listItemPrefix"&&(m=u[1]._tokenizer.events,f=0,f<m.length&&m[f][1].type==="lineEndingBlank"&&(f+=2),f<m.length&&m[f][1].type==="content"))for(;++f<m.length&&m[f][1].type!=="content";)m[f][1].type==="chunkText"&&(m[f][1]._isInFirstContentOfListItem=!0,f++);if(u[0]==="enter")u[1].contentType&&(Object.assign(r,Z0(v,a)),a=r[a],p=!0);else if(u[1]._container){for(f=a,c=void 0;f--;)if(d=v.get(f),d[1].type==="lineEnding"||d[1].type==="lineEndingBlank")d[0]==="enter"&&(c&&(v.get(c)[1].type="lineEndingBlank"),d[1].type="lineEnding",c=f);else if(!(d[1].type==="linePrefix"||d[1].type==="listItemIndent"))break;c&&(u[1].end={...v.get(c)[1].start},h=v.slice(c,a),h.unshift(u),v.splice(c,a-c+1,h))}}return Pt(n,0,Number.POSITIVE_INFINITY,v.slice(0)),!p}function Z0(n,r){const a=n.get(r)[1],u=n.get(r)[2];let c=r-1;const f=[];let d=a._tokenizer;d||(d=u.parser[a.contentType](a.start),a._contentTypeTextTrailing&&(d._contentTypeTextTrailing=!0));const h=d.events,m=[],p={};let v,g,x=-1,S=a,C=0,B=0;const j=[B];for(;S;){for(;n.get(++c)[1]!==S;);f.push(c),S._tokenizer||(v=u.sliceStream(S),S.next||v.push(null),g&&d.defineSkip(S.start),S._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=!0),d.write(v),S._isInFirstContentOfListItem&&(d._gfmTasklistFirstContentOfListItem=void 0)),g=S,S=S.next}for(S=a;++x<h.length;)h[x][0]==="exit"&&h[x-1][0]==="enter"&&h[x][1].type===h[x-1][1].type&&h[x][1].start.line!==h[x][1].end.line&&(B=x+1,j.push(B),S._tokenizer=void 0,S.previous=void 0,S=S.next);for(d.events=[],S?(S._tokenizer=void 0,S.previous=void 0):j.pop(),x=j.length;x--;){const _=h.slice(j[x],j[x+1]),F=f.pop();m.push([F,F+_.length-1]),n.splice(F,2,_)}for(m.reverse(),x=-1;++x<m.length;)p[C+m[x][0]]=C+m[x][1],C+=m[x][1]-m[x][0]-1;return p}const F0={resolve:J0,tokenize:W0},K0={partial:!0,tokenize:$0};function J0(n){return kg(n),n}function W0(n,r){let a;return u;function u(h){return n.enter("content"),a=n.enter("chunkContent",{contentType:"content"}),c(h)}function c(h){return h===null?f(h):be(h)?n.check(K0,d,f)(h):(n.consume(h),c)}function f(h){return n.exit("chunkContent"),n.exit("content"),r(h)}function d(h){return n.consume(h),n.exit("chunkContent"),a.next=n.enter("chunkContent",{contentType:"content",previous:a}),a=a.next,c}}function $0(n,r,a){const u=this;return c;function c(d){return n.exit("chunkContent"),n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),Be(n,f,"linePrefix")}function f(d){if(d===null||be(d))return a(d);const h=u.events[u.events.length-1];return!u.parser.constructs.disable.null.includes("codeIndented")&&h&&h[1].type==="linePrefix"&&h[2].sliceSerialize(h[1],!0).length>=4?r(d):n.interrupt(u.parser.constructs.flow,a,r)(d)}}function Eg(n,r,a,u,c,f,d,h,m){const p=m||Number.POSITIVE_INFINITY;let v=0;return g;function g(_){return _===60?(n.enter(u),n.enter(c),n.enter(f),n.consume(_),n.exit(f),x):_===null||_===32||_===41||pu(_)?a(_):(n.enter(u),n.enter(d),n.enter(h),n.enter("chunkString",{contentType:"string"}),B(_))}function x(_){return _===62?(n.enter(f),n.consume(_),n.exit(f),n.exit(c),n.exit(u),r):(n.enter(h),n.enter("chunkString",{contentType:"string"}),S(_))}function S(_){return _===62?(n.exit("chunkString"),n.exit(h),x(_)):_===null||_===60||be(_)?a(_):(n.consume(_),_===92?C:S)}function C(_){return _===60||_===62||_===92?(n.consume(_),S):S(_)}function B(_){return!v&&(_===null||_===41||Pe(_))?(n.exit("chunkString"),n.exit(h),n.exit(d),n.exit(u),r(_)):v<p&&_===40?(n.consume(_),v++,B):_===41?(n.consume(_),v--,B):_===null||_===32||_===40||pu(_)?a(_):(n.consume(_),_===92?j:B)}function j(_){return _===40||_===41||_===92?(n.consume(_),B):B(_)}}function Ag(n,r,a,u,c,f){const d=this;let h=0,m;return p;function p(S){return n.enter(u),n.enter(c),n.consume(S),n.exit(c),n.enter(f),v}function v(S){return h>999||S===null||S===91||S===93&&!m||S===94&&!h&&"_hiddenFootnoteSupport"in d.parser.constructs?a(S):S===93?(n.exit(f),n.enter(c),n.consume(S),n.exit(c),n.exit(u),r):be(S)?(n.enter("lineEnding"),n.consume(S),n.exit("lineEnding"),v):(n.enter("chunkString",{contentType:"string"}),g(S))}function g(S){return S===null||S===91||S===93||be(S)||h++>999?(n.exit("chunkString"),v(S)):(n.consume(S),m||(m=!Ne(S)),S===92?x:g)}function x(S){return S===91||S===92||S===93?(n.consume(S),h++,g):g(S)}}function wg(n,r,a,u,c,f){let d;return h;function h(x){return x===34||x===39||x===40?(n.enter(u),n.enter(c),n.consume(x),n.exit(c),d=x===40?41:x,m):a(x)}function m(x){return x===d?(n.enter(c),n.consume(x),n.exit(c),n.exit(u),r):(n.enter(f),p(x))}function p(x){return x===d?(n.exit(f),m(d)):x===null?a(x):be(x)?(n.enter("lineEnding"),n.consume(x),n.exit("lineEnding"),Be(n,p,"linePrefix")):(n.enter("chunkString",{contentType:"string"}),v(x))}function v(x){return x===d||x===null||be(x)?(n.exit("chunkString"),p(x)):(n.consume(x),x===92?g:v)}function g(x){return x===d||x===92?(n.consume(x),v):v(x)}}function Nr(n,r){let a;return u;function u(c){return be(c)?(n.enter("lineEnding"),n.consume(c),n.exit("lineEnding"),a=!0,u):Ne(c)?Be(n,u,a?"linePrefix":"lineSuffix")(c):r(c)}}const P0={name:"definition",tokenize:tx},ex={partial:!0,tokenize:nx};function tx(n,r,a){const u=this;let c;return f;function f(S){return n.enter("definition"),d(S)}function d(S){return Ag.call(u,n,h,a,"definitionLabel","definitionLabelMarker","definitionLabelString")(S)}function h(S){return c=vn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)),S===58?(n.enter("definitionMarker"),n.consume(S),n.exit("definitionMarker"),m):a(S)}function m(S){return Pe(S)?Nr(n,p)(S):p(S)}function p(S){return Eg(n,v,a,"definitionDestination","definitionDestinationLiteral","definitionDestinationLiteralMarker","definitionDestinationRaw","definitionDestinationString")(S)}function v(S){return n.attempt(ex,g,g)(S)}function g(S){return Ne(S)?Be(n,x,"whitespace")(S):x(S)}function x(S){return S===null||be(S)?(n.exit("definition"),u.parser.defined.push(c),r(S)):a(S)}}function nx(n,r,a){return u;function u(h){return Pe(h)?Nr(n,c)(h):a(h)}function c(h){return wg(n,f,a,"definitionTitle","definitionTitleMarker","definitionTitleString")(h)}function f(h){return Ne(h)?Be(n,d,"whitespace")(h):d(h)}function d(h){return h===null||be(h)?r(h):a(h)}}const lx={name:"hardBreakEscape",tokenize:ix};function ix(n,r,a){return u;function u(f){return n.enter("hardBreakEscape"),n.consume(f),c}function c(f){return be(f)?(n.exit("hardBreakEscape"),r(f)):a(f)}}const rx={name:"headingAtx",resolve:ax,tokenize:ux};function ax(n,r){let a=n.length-2,u=3,c,f;return n[u][1].type==="whitespace"&&(u+=2),a-2>u&&n[a][1].type==="whitespace"&&(a-=2),n[a][1].type==="atxHeadingSequence"&&(u===a-1||a-4>u&&n[a-2][1].type==="whitespace")&&(a-=u+1===a?2:4),a>u&&(c={type:"atxHeadingText",start:n[u][1].start,end:n[a][1].end},f={type:"chunkText",start:n[u][1].start,end:n[a][1].end,contentType:"text"},Pt(n,u,a-u+1,[["enter",c,r],["enter",f,r],["exit",f,r],["exit",c,r]])),n}function ux(n,r,a){let u=0;return c;function c(v){return n.enter("atxHeading"),f(v)}function f(v){return n.enter("atxHeadingSequence"),d(v)}function d(v){return v===35&&u++<6?(n.consume(v),d):v===null||Pe(v)?(n.exit("atxHeadingSequence"),h(v)):a(v)}function h(v){return v===35?(n.enter("atxHeadingSequence"),m(v)):v===null||be(v)?(n.exit("atxHeading"),r(v)):Ne(v)?Be(n,h,"whitespace")(v):(n.enter("atxHeadingText"),p(v))}function m(v){return v===35?(n.consume(v),m):(n.exit("atxHeadingSequence"),h(v))}function p(v){return v===null||v===35||Pe(v)?(n.exit("atxHeadingText"),h(v)):(n.consume(v),p)}}const ox=["address","article","aside","base","basefont","blockquote","body","caption","center","col","colgroup","dd","details","dialog","dir","div","dl","dt","fieldset","figcaption","figure","footer","form","frame","frameset","h1","h2","h3","h4","h5","h6","head","header","hr","html","iframe","legend","li","link","main","menu","menuitem","nav","noframes","ol","optgroup","option","p","param","search","section","summary","table","tbody","td","tfoot","th","thead","title","tr","track","ul"],Em=["pre","script","style","textarea"],cx={concrete:!0,name:"htmlFlow",resolveTo:dx,tokenize:hx},sx={partial:!0,tokenize:mx},fx={partial:!0,tokenize:px};function dx(n){let r=n.length;for(;r--&&!(n[r][0]==="enter"&&n[r][1].type==="htmlFlow"););return r>1&&n[r-2][1].type==="linePrefix"&&(n[r][1].start=n[r-2][1].start,n[r+1][1].start=n[r-2][1].start,n.splice(r-2,2)),n}function hx(n,r,a){const u=this;let c,f,d,h,m;return p;function p(k){return v(k)}function v(k){return n.enter("htmlFlow"),n.enter("htmlFlowData"),n.consume(k),g}function g(k){return k===33?(n.consume(k),x):k===47?(n.consume(k),f=!0,B):k===63?(n.consume(k),c=3,u.interrupt?r:E):Rt(k)?(n.consume(k),d=String.fromCharCode(k),j):a(k)}function x(k){return k===45?(n.consume(k),c=2,S):k===91?(n.consume(k),c=5,h=0,C):Rt(k)?(n.consume(k),c=4,u.interrupt?r:E):a(k)}function S(k){return k===45?(n.consume(k),u.interrupt?r:E):a(k)}function C(k){const te="CDATA[";return k===te.charCodeAt(h++)?(n.consume(k),h===te.length?u.interrupt?r:ee:C):a(k)}function B(k){return Rt(k)?(n.consume(k),d=String.fromCharCode(k),j):a(k)}function j(k){if(k===null||k===47||k===62||Pe(k)){const te=k===47,me=d.toLowerCase();return!te&&!f&&Em.includes(me)?(c=1,u.interrupt?r(k):ee(k)):ox.includes(d.toLowerCase())?(c=6,te?(n.consume(k),_):u.interrupt?r(k):ee(k)):(c=7,u.interrupt&&!u.parser.lazy[u.now().line]?a(k):f?F(k):Y(k))}return k===45||zt(k)?(n.consume(k),d+=String.fromCharCode(k),j):a(k)}function _(k){return k===62?(n.consume(k),u.interrupt?r:ee):a(k)}function F(k){return Ne(k)?(n.consume(k),F):L(k)}function Y(k){return k===47?(n.consume(k),L):k===58||k===95||Rt(k)?(n.consume(k),le):Ne(k)?(n.consume(k),Y):L(k)}function le(k){return k===45||k===46||k===58||k===95||zt(k)?(n.consume(k),le):ue(k)}function ue(k){return k===61?(n.consume(k),N):Ne(k)?(n.consume(k),ue):Y(k)}function N(k){return k===null||k===60||k===61||k===62||k===96?a(k):k===34||k===39?(n.consume(k),m=k,$):Ne(k)?(n.consume(k),N):he(k)}function $(k){return k===m?(n.consume(k),m=null,Se):k===null||be(k)?a(k):(n.consume(k),$)}function he(k){return k===null||k===34||k===39||k===47||k===60||k===61||k===62||k===96||Pe(k)?ue(k):(n.consume(k),he)}function Se(k){return k===47||k===62||Ne(k)?Y(k):a(k)}function L(k){return k===62?(n.consume(k),ie):a(k)}function ie(k){return k===null||be(k)?ee(k):Ne(k)?(n.consume(k),ie):a(k)}function ee(k){return k===45&&c===2?(n.consume(k),D):k===60&&c===1?(n.consume(k),K):k===62&&c===4?(n.consume(k),w):k===63&&c===3?(n.consume(k),E):k===93&&c===5?(n.consume(k),we):be(k)&&(c===6||c===7)?(n.exit("htmlFlowData"),n.check(sx,H,ke)(k)):k===null||be(k)?(n.exit("htmlFlowData"),ke(k)):(n.consume(k),ee)}function ke(k){return n.check(fx,re,H)(k)}function re(k){return n.enter("lineEnding"),n.consume(k),n.exit("lineEnding"),W}function W(k){return k===null||be(k)?ke(k):(n.enter("htmlFlowData"),ee(k))}function D(k){return k===45?(n.consume(k),E):ee(k)}function K(k){return k===47?(n.consume(k),d="",ce):ee(k)}function ce(k){if(k===62){const te=d.toLowerCase();return Em.includes(te)?(n.consume(k),w):ee(k)}return Rt(k)&&d.length<8?(n.consume(k),d+=String.fromCharCode(k),ce):ee(k)}function we(k){return k===93?(n.consume(k),E):ee(k)}function E(k){return k===62?(n.consume(k),w):k===45&&c===2?(n.consume(k),E):ee(k)}function w(k){return k===null||be(k)?(n.exit("htmlFlowData"),H(k)):(n.consume(k),w)}function H(k){return n.exit("htmlFlow"),r(k)}}function px(n,r,a){const u=this;return c;function c(d){return be(d)?(n.enter("lineEnding"),n.consume(d),n.exit("lineEnding"),f):a(d)}function f(d){return u.parser.lazy[u.now().line]?a(d):r(d)}}function mx(n,r,a){return u;function u(c){return n.enter("lineEnding"),n.consume(c),n.exit("lineEnding"),n.attempt(Hr,r,a)}}const gx={name:"htmlText",tokenize:yx};function yx(n,r,a){const u=this;let c,f,d;return h;function h(E){return n.enter("htmlText"),n.enter("htmlTextData"),n.consume(E),m}function m(E){return E===33?(n.consume(E),p):E===47?(n.consume(E),ue):E===63?(n.consume(E),Y):Rt(E)?(n.consume(E),he):a(E)}function p(E){return E===45?(n.consume(E),v):E===91?(n.consume(E),f=0,C):Rt(E)?(n.consume(E),F):a(E)}function v(E){return E===45?(n.consume(E),S):a(E)}function g(E){return E===null?a(E):E===45?(n.consume(E),x):be(E)?(d=g,K(E)):(n.consume(E),g)}function x(E){return E===45?(n.consume(E),S):g(E)}function S(E){return E===62?D(E):E===45?x(E):g(E)}function C(E){const w="CDATA[";return E===w.charCodeAt(f++)?(n.consume(E),f===w.length?B:C):a(E)}function B(E){return E===null?a(E):E===93?(n.consume(E),j):be(E)?(d=B,K(E)):(n.consume(E),B)}function j(E){return E===93?(n.consume(E),_):B(E)}function _(E){return E===62?D(E):E===93?(n.consume(E),_):B(E)}function F(E){return E===null||E===62?D(E):be(E)?(d=F,K(E)):(n.consume(E),F)}function Y(E){return E===null?a(E):E===63?(n.consume(E),le):be(E)?(d=Y,K(E)):(n.consume(E),Y)}function le(E){return E===62?D(E):Y(E)}function ue(E){return Rt(E)?(n.consume(E),N):a(E)}function N(E){return E===45||zt(E)?(n.consume(E),N):$(E)}function $(E){return be(E)?(d=$,K(E)):Ne(E)?(n.consume(E),$):D(E)}function he(E){return E===45||zt(E)?(n.consume(E),he):E===47||E===62||Pe(E)?Se(E):a(E)}function Se(E){return E===47?(n.consume(E),D):E===58||E===95||Rt(E)?(n.consume(E),L):be(E)?(d=Se,K(E)):Ne(E)?(n.consume(E),Se):D(E)}function L(E){return E===45||E===46||E===58||E===95||zt(E)?(n.consume(E),L):ie(E)}function ie(E){return E===61?(n.consume(E),ee):be(E)?(d=ie,K(E)):Ne(E)?(n.consume(E),ie):Se(E)}function ee(E){return E===null||E===60||E===61||E===62||E===96?a(E):E===34||E===39?(n.consume(E),c=E,ke):be(E)?(d=ee,K(E)):Ne(E)?(n.consume(E),ee):(n.consume(E),re)}function ke(E){return E===c?(n.consume(E),c=void 0,W):E===null?a(E):be(E)?(d=ke,K(E)):(n.consume(E),ke)}function re(E){return E===null||E===34||E===39||E===60||E===61||E===96?a(E):E===47||E===62||Pe(E)?Se(E):(n.consume(E),re)}function W(E){return E===47||E===62||Pe(E)?Se(E):a(E)}function D(E){return E===62?(n.consume(E),n.exit("htmlTextData"),n.exit("htmlText"),r):a(E)}function K(E){return n.exit("htmlTextData"),n.enter("lineEnding"),n.consume(E),n.exit("lineEnding"),ce}function ce(E){return Ne(E)?Be(n,we,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(E):we(E)}function we(E){return n.enter("htmlTextData"),d(E)}}const Us={name:"labelEnd",resolveAll:Sx,resolveTo:kx,tokenize:Ex},vx={tokenize:Ax},bx={tokenize:wx},xx={tokenize:Tx};function Sx(n){let r=-1;const a=[];for(;++r<n.length;){const u=n[r][1];if(a.push(n[r]),u.type==="labelImage"||u.type==="labelLink"||u.type==="labelEnd"){const c=u.type==="labelImage"?4:2;u.type="data",r+=c}}return n.length!==a.length&&Pt(n,0,n.length,a),n}function kx(n,r){let a=n.length,u=0,c,f,d,h;for(;a--;)if(c=n[a][1],f){if(c.type==="link"||c.type==="labelLink"&&c._inactive)break;n[a][0]==="enter"&&c.type==="labelLink"&&(c._inactive=!0)}else if(d){if(n[a][0]==="enter"&&(c.type==="labelImage"||c.type==="labelLink")&&!c._balanced&&(f=a,c.type!=="labelLink")){u=2;break}}else c.type==="labelEnd"&&(d=a);const m={type:n[f][1].type==="labelLink"?"link":"image",start:{...n[f][1].start},end:{...n[n.length-1][1].end}},p={type:"label",start:{...n[f][1].start},end:{...n[d][1].end}},v={type:"labelText",start:{...n[f+u+2][1].end},end:{...n[d-2][1].start}};return h=[["enter",m,r],["enter",p,r]],h=hn(h,n.slice(f+1,f+u+3)),h=hn(h,[["enter",v,r]]),h=hn(h,xu(r.parser.constructs.insideSpan.null,n.slice(f+u+4,d-3),r)),h=hn(h,[["exit",v,r],n[d-2],n[d-1],["exit",p,r]]),h=hn(h,n.slice(d+1)),h=hn(h,[["exit",m,r]]),Pt(n,f,n.length,h),n}function Ex(n,r,a){const u=this;let c=u.events.length,f,d;for(;c--;)if((u.events[c][1].type==="labelImage"||u.events[c][1].type==="labelLink")&&!u.events[c][1]._balanced){f=u.events[c][1];break}return h;function h(x){return f?f._inactive?g(x):(d=u.parser.defined.includes(vn(u.sliceSerialize({start:f.end,end:u.now()}))),n.enter("labelEnd"),n.enter("labelMarker"),n.consume(x),n.exit("labelMarker"),n.exit("labelEnd"),m):a(x)}function m(x){return x===40?n.attempt(vx,v,d?v:g)(x):x===91?n.attempt(bx,v,d?p:g)(x):d?v(x):g(x)}function p(x){return n.attempt(xx,v,g)(x)}function v(x){return r(x)}function g(x){return f._balanced=!0,a(x)}}function Ax(n,r,a){return u;function u(g){return n.enter("resource"),n.enter("resourceMarker"),n.consume(g),n.exit("resourceMarker"),c}function c(g){return Pe(g)?Nr(n,f)(g):f(g)}function f(g){return g===41?v(g):Eg(n,d,h,"resourceDestination","resourceDestinationLiteral","resourceDestinationLiteralMarker","resourceDestinationRaw","resourceDestinationString",32)(g)}function d(g){return Pe(g)?Nr(n,m)(g):v(g)}function h(g){return a(g)}function m(g){return g===34||g===39||g===40?wg(n,p,a,"resourceTitle","resourceTitleMarker","resourceTitleString")(g):v(g)}function p(g){return Pe(g)?Nr(n,v)(g):v(g)}function v(g){return g===41?(n.enter("resourceMarker"),n.consume(g),n.exit("resourceMarker"),n.exit("resource"),r):a(g)}}function wx(n,r,a){const u=this;return c;function c(h){return Ag.call(u,n,f,d,"reference","referenceMarker","referenceString")(h)}function f(h){return u.parser.defined.includes(vn(u.sliceSerialize(u.events[u.events.length-1][1]).slice(1,-1)))?r(h):a(h)}function d(h){return a(h)}}function Tx(n,r,a){return u;function u(f){return n.enter("reference"),n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),c}function c(f){return f===93?(n.enter("referenceMarker"),n.consume(f),n.exit("referenceMarker"),n.exit("reference"),r):a(f)}}const Cx={name:"labelStartImage",resolveAll:Us.resolveAll,tokenize:zx};function zx(n,r,a){const u=this;return c;function c(h){return n.enter("labelImage"),n.enter("labelImageMarker"),n.consume(h),n.exit("labelImageMarker"),f}function f(h){return h===91?(n.enter("labelMarker"),n.consume(h),n.exit("labelMarker"),n.exit("labelImage"),d):a(h)}function d(h){return h===94&&"_hiddenFootnoteSupport"in u.parser.constructs?a(h):r(h)}}const _x={name:"labelStartLink",resolveAll:Us.resolveAll,tokenize:Ox};function Ox(n,r,a){const u=this;return c;function c(d){return n.enter("labelLink"),n.enter("labelMarker"),n.consume(d),n.exit("labelMarker"),n.exit("labelLink"),f}function f(d){return d===94&&"_hiddenFootnoteSupport"in u.parser.constructs?a(d):r(d)}}const Wc={name:"lineEnding",tokenize:Dx};function Dx(n,r){return a;function a(u){return n.enter("lineEnding"),n.consume(u),n.exit("lineEnding"),Be(n,r,"linePrefix")}}const fu={name:"thematicBreak",tokenize:Mx};function Mx(n,r,a){let u=0,c;return f;function f(p){return n.enter("thematicBreak"),d(p)}function d(p){return c=p,h(p)}function h(p){return p===c?(n.enter("thematicBreakSequence"),m(p)):u>=3&&(p===null||be(p))?(n.exit("thematicBreak"),r(p)):a(p)}function m(p){return p===c?(n.consume(p),u++,m):(n.exit("thematicBreakSequence"),Ne(p)?Be(n,h,"whitespace")(p):h(p))}}const Vt={continuation:{tokenize:Ux},exit:Bx,name:"list",tokenize:Lx},Rx={partial:!0,tokenize:Hx},Nx={partial:!0,tokenize:jx};function Lx(n,r,a){const u=this,c=u.events[u.events.length-1];let f=c&&c[1].type==="linePrefix"?c[2].sliceSerialize(c[1],!0).length:0,d=0;return h;function h(S){const C=u.containerState.type||(S===42||S===43||S===45?"listUnordered":"listOrdered");if(C==="listUnordered"?!u.containerState.marker||S===u.containerState.marker:vs(S)){if(u.containerState.type||(u.containerState.type=C,n.enter(C,{_container:!0})),C==="listUnordered")return n.enter("listItemPrefix"),S===42||S===45?n.check(fu,a,p)(S):p(S);if(!u.interrupt||S===49)return n.enter("listItemPrefix"),n.enter("listItemValue"),m(S)}return a(S)}function m(S){return vs(S)&&++d<10?(n.consume(S),m):(!u.interrupt||d<2)&&(u.containerState.marker?S===u.containerState.marker:S===41||S===46)?(n.exit("listItemValue"),p(S)):a(S)}function p(S){return n.enter("listItemMarker"),n.consume(S),n.exit("listItemMarker"),u.containerState.marker=u.containerState.marker||S,n.check(Hr,u.interrupt?a:v,n.attempt(Rx,x,g))}function v(S){return u.containerState.initialBlankLine=!0,f++,x(S)}function g(S){return Ne(S)?(n.enter("listItemPrefixWhitespace"),n.consume(S),n.exit("listItemPrefixWhitespace"),x):a(S)}function x(S){return u.containerState.size=f+u.sliceSerialize(n.exit("listItemPrefix"),!0).length,r(S)}}function Ux(n,r,a){const u=this;return u.containerState._closeFlow=void 0,n.check(Hr,c,f);function c(h){return u.containerState.furtherBlankLines=u.containerState.furtherBlankLines||u.containerState.initialBlankLine,Be(n,r,"listItemIndent",u.containerState.size+1)(h)}function f(h){return u.containerState.furtherBlankLines||!Ne(h)?(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,d(h)):(u.containerState.furtherBlankLines=void 0,u.containerState.initialBlankLine=void 0,n.attempt(Nx,r,d)(h))}function d(h){return u.containerState._closeFlow=!0,u.interrupt=void 0,Be(n,n.attempt(Vt,r,a),"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(h)}}function jx(n,r,a){const u=this;return Be(n,c,"listItemIndent",u.containerState.size+1);function c(f){const d=u.events[u.events.length-1];return d&&d[1].type==="listItemIndent"&&d[2].sliceSerialize(d[1],!0).length===u.containerState.size?r(f):a(f)}}function Bx(n){n.exit(this.containerState.type)}function Hx(n,r,a){const u=this;return Be(n,c,"listItemPrefixWhitespace",u.parser.constructs.disable.null.includes("codeIndented")?void 0:5);function c(f){const d=u.events[u.events.length-1];return!Ne(f)&&d&&d[1].type==="listItemPrefixWhitespace"?r(f):a(f)}}const Am={name:"setextUnderline",resolveTo:qx,tokenize:Yx};function qx(n,r){let a=n.length,u,c,f;for(;a--;)if(n[a][0]==="enter"){if(n[a][1].type==="content"){u=a;break}n[a][1].type==="paragraph"&&(c=a)}else n[a][1].type==="content"&&n.splice(a,1),!f&&n[a][1].type==="definition"&&(f=a);const d={type:"setextHeading",start:{...n[u][1].start},end:{...n[n.length-1][1].end}};return n[c][1].type="setextHeadingText",f?(n.splice(c,0,["enter",d,r]),n.splice(f+1,0,["exit",n[u][1],r]),n[u][1].end={...n[f][1].end}):n[u][1]=d,n.push(["exit",d,r]),n}function Yx(n,r,a){const u=this;let c;return f;function f(p){let v=u.events.length,g;for(;v--;)if(u.events[v][1].type!=="lineEnding"&&u.events[v][1].type!=="linePrefix"&&u.events[v][1].type!=="content"){g=u.events[v][1].type==="paragraph";break}return!u.parser.lazy[u.now().line]&&(u.interrupt||g)?(n.enter("setextHeadingLine"),c=p,d(p)):a(p)}function d(p){return n.enter("setextHeadingLineSequence"),h(p)}function h(p){return p===c?(n.consume(p),h):(n.exit("setextHeadingLineSequence"),Ne(p)?Be(n,m,"lineSuffix")(p):m(p))}function m(p){return p===null||be(p)?(n.exit("setextHeadingLine"),r(p)):a(p)}}const Vx={tokenize:Gx};function Gx(n){const r=this,a=n.attempt(Hr,u,n.attempt(this.parser.constructs.flowInitial,c,Be(n,n.attempt(this.parser.constructs.flow,c,n.attempt(F0,c)),"linePrefix")));return a;function u(f){if(f===null){n.consume(f);return}return n.enter("lineEndingBlank"),n.consume(f),n.exit("lineEndingBlank"),r.currentConstruct=void 0,a}function c(f){if(f===null){n.consume(f);return}return n.enter("lineEnding"),n.consume(f),n.exit("lineEnding"),r.currentConstruct=void 0,a}}const Xx={resolveAll:Cg()},Qx=Tg("string"),Ix=Tg("text");function Tg(n){return{resolveAll:Cg(n==="text"?Zx:void 0),tokenize:r};function r(a){const u=this,c=this.parser.constructs[n],f=a.attempt(c,d,h);return d;function d(v){return p(v)?f(v):h(v)}function h(v){if(v===null){a.consume(v);return}return a.enter("data"),a.consume(v),m}function m(v){return p(v)?(a.exit("data"),f(v)):(a.consume(v),m)}function p(v){if(v===null)return!0;const g=c[v];let x=-1;if(g)for(;++x<g.length;){const S=g[x];if(!S.previous||S.previous.call(u,u.previous))return!0}return!1}}}function Cg(n){return r;function r(a,u){let c=-1,f;for(;++c<=a.length;)f===void 0?a[c]&&a[c][1].type==="data"&&(f=c,c++):(!a[c]||a[c][1].type!=="data")&&(c!==f+2&&(a[f][1].end=a[c-1][1].end,a.splice(f+2,c-f-2),c=f+2),f=void 0);return n?n(a,u):a}}function Zx(n,r){let a=0;for(;++a<=n.length;)if((a===n.length||n[a][1].type==="lineEnding")&&n[a-1][1].type==="data"){const u=n[a-1][1],c=r.sliceStream(u);let f=c.length,d=-1,h=0,m;for(;f--;){const p=c[f];if(typeof p=="string"){for(d=p.length;p.charCodeAt(d-1)===32;)h++,d--;if(d)break;d=-1}else if(p===-2)m=!0,h++;else if(p!==-1){f++;break}}if(r._contentTypeTextTrailing&&a===n.length&&(h=0),h){const p={type:a===n.length||m||h<2?"lineSuffix":"hardBreakTrailing",start:{_bufferIndex:f?d:u.start._bufferIndex+d,_index:u.start._index+f,line:u.end.line,column:u.end.column-h,offset:u.end.offset-h},end:{...u.end}};u.end={...p.start},u.start.offset===u.end.offset?Object.assign(u,p):(n.splice(a,0,["enter",p,r],["exit",p,r]),a+=2)}a++}return n}const Fx={42:Vt,43:Vt,45:Vt,48:Vt,49:Vt,50:Vt,51:Vt,52:Vt,53:Vt,54:Vt,55:Vt,56:Vt,57:Vt,62:bg},Kx={91:P0},Jx={[-2]:Jc,[-1]:Jc,32:Jc},Wx={35:rx,42:fu,45:[Am,fu],60:cx,61:Am,95:fu,96:km,126:km},$x={38:Sg,92:xg},Px={[-5]:Wc,[-4]:Wc,[-3]:Wc,33:Cx,38:Sg,42:bs,60:[_0,gx],91:_x,92:[lx,xg],93:Us,95:bs,96:V0},eS={null:[bs,Xx]},tS={null:[42,95]},nS={null:[]},lS=Object.freeze(Object.defineProperty({__proto__:null,attentionMarkers:tS,contentInitial:Kx,disable:nS,document:Fx,flow:Wx,flowInitial:Jx,insideSpan:eS,string:$x,text:Px},Symbol.toStringTag,{value:"Module"}));function iS(n,r,a){let u={_bufferIndex:-1,_index:0,line:a&&a.line||1,column:a&&a.column||1,offset:a&&a.offset||0};const c={},f=[];let d=[],h=[];const m={attempt:$(ue),check:$(N),consume:F,enter:Y,exit:le,interrupt:$(N,{interrupt:!0})},p={code:null,containerState:{},defineSkip:B,events:[],now:C,parser:n,previous:null,sliceSerialize:x,sliceStream:S,write:g};let v=r.tokenize.call(p,m);return r.resolveAll&&f.push(r),p;function g(ie){return d=hn(d,ie),j(),d[d.length-1]!==null?[]:(he(r,0),p.events=xu(f,p.events,p),p.events)}function x(ie,ee){return aS(S(ie),ee)}function S(ie){return rS(d,ie)}function C(){const{_bufferIndex:ie,_index:ee,line:ke,column:re,offset:W}=u;return{_bufferIndex:ie,_index:ee,line:ke,column:re,offset:W}}function B(ie){c[ie.line]=ie.column,L()}function j(){let ie;for(;u._index<d.length;){const ee=d[u._index];if(typeof ee=="string")for(ie=u._index,u._bufferIndex<0&&(u._bufferIndex=0);u._index===ie&&u._bufferIndex<ee.length;)_(ee.charCodeAt(u._bufferIndex));else _(ee)}}function _(ie){v=v(ie)}function F(ie){be(ie)?(u.line++,u.column=1,u.offset+=ie===-3?2:1,L()):ie!==-1&&(u.column++,u.offset++),u._bufferIndex<0?u._index++:(u._bufferIndex++,u._bufferIndex===d[u._index].length&&(u._bufferIndex=-1,u._index++)),p.previous=ie}function Y(ie,ee){const ke=ee||{};return ke.type=ie,ke.start=C(),p.events.push(["enter",ke,p]),h.push(ke),ke}function le(ie){const ee=h.pop();return ee.end=C(),p.events.push(["exit",ee,p]),ee}function ue(ie,ee){he(ie,ee.from)}function N(ie,ee){ee.restore()}function $(ie,ee){return ke;function ke(re,W,D){let K,ce,we,E;return Array.isArray(re)?H(re):"tokenize"in re?H([re]):w(re);function w(fe){return Ae;function Ae(Qe){const X=Qe!==null&&fe[Qe],Z=Qe!==null&&fe.null,ne=[...Array.isArray(X)?X:X?[X]:[],...Array.isArray(Z)?Z:Z?[Z]:[]];return H(ne)(Qe)}}function H(fe){return K=fe,ce=0,fe.length===0?D:k(fe[ce])}function k(fe){return Ae;function Ae(Qe){return E=Se(),we=fe,fe.partial||(p.currentConstruct=fe),fe.name&&p.parser.constructs.disable.null.includes(fe.name)?me():fe.tokenize.call(ee?Object.assign(Object.create(p),ee):p,m,te,me)(Qe)}}function te(fe){return ie(we,E),W}function me(fe){return E.restore(),++ce<K.length?k(K[ce]):D}}}function he(ie,ee){ie.resolveAll&&!f.includes(ie)&&f.push(ie),ie.resolve&&Pt(p.events,ee,p.events.length-ee,ie.resolve(p.events.slice(ee),p)),ie.resolveTo&&(p.events=ie.resolveTo(p.events,p))}function Se(){const ie=C(),ee=p.previous,ke=p.currentConstruct,re=p.events.length,W=Array.from(h);return{from:re,restore:D};function D(){u=ie,p.previous=ee,p.currentConstruct=ke,p.events.length=re,h=W,L()}}function L(){u.line in c&&u.column<2&&(u.column=c[u.line],u.offset+=c[u.line]-1)}}function rS(n,r){const a=r.start._index,u=r.start._bufferIndex,c=r.end._index,f=r.end._bufferIndex;let d;if(a===c)d=[n[a].slice(u,f)];else{if(d=n.slice(a,c),u>-1){const h=d[0];typeof h=="string"?d[0]=h.slice(u):d.shift()}f>0&&d.push(n[c].slice(0,f))}return d}function aS(n,r){let a=-1;const u=[];let c;for(;++a<n.length;){const f=n[a];let d;if(typeof f=="string")d=f;else switch(f){case-5:{d="\\r";break}case-4:{d=`\n`;break}case-3:{d=`\\r\n`;break}case-2:{d=r?" ":"	";break}case-1:{if(!r&&c)continue;d=" ";break}default:d=String.fromCharCode(f)}c=f===-2,u.push(d)}return u.join("")}function uS(n){const u={constructs:yg([lS,...(n||{}).extensions||[]]),content:c(k0),defined:[],document:c(A0),flow:c(Vx),lazy:{},string:c(Qx),text:c(Ix)};return u;function c(f){return d;function d(h){return iS(u,f,h)}}}function oS(n){for(;!kg(n););return n}const wm=/[\\0\\t\\n\\r]/g;function cS(){let n=1,r="",a=!0,u;return c;function c(f,d,h){const m=[];let p,v,g,x,S;for(f=r+(typeof f=="string"?f.toString():new TextDecoder(d||void 0).decode(f)),g=0,r="",a&&(f.charCodeAt(0)===65279&&g++,a=void 0);g<f.length;){if(wm.lastIndex=g,p=wm.exec(f),x=p&&p.index!==void 0?p.index:f.length,S=f.charCodeAt(x),!p){r=f.slice(g);break}if(S===10&&g===x&&u)m.push(-3),u=void 0;else switch(u&&(m.push(-5),u=void 0),g<x&&(m.push(f.slice(g,x)),n+=x-g),S){case 0:{m.push(65533),n++;break}case 9:{for(v=Math.ceil(n/4)*4,m.push(-2);n++<v;)m.push(-1);break}case 10:{m.push(-4),n=1;break}default:u=!0,n=1}g=x+1}return h&&(u&&m.push(-5),r&&m.push(r),m.push(null)),m}}const sS=/\\\\([!-/:-@[-`{-~])|&(#(?:\\d{1,7}|x[\\da-f]{1,6})|[\\da-z]{1,31});/gi;function fS(n){return n.replace(sS,dS)}function dS(n,r,a){if(r)return r;if(a.charCodeAt(0)===35){const c=a.charCodeAt(1),f=c===120||c===88;return vg(a.slice(f?2:1),f?16:10)}return Ls(a)||n}const zg={}.hasOwnProperty;function hS(n,r,a){return r&&typeof r=="object"&&(a=r,r=void 0),pS(a)(oS(uS(a).document().write(cS()(n,r,!0))))}function pS(n){const r={transforms:[],canContainEols:["emphasis","fragment","heading","paragraph","strong"],enter:{autolink:f(tn),autolinkProtocol:Se,autolinkEmail:Se,atxHeading:f(ye),blockQuote:f(Z),characterEscape:Se,characterReference:Se,codeFenced:f(ne),codeFencedFenceInfo:d,codeFencedFenceMeta:d,codeIndented:f(ne,d),codeText:f(ae,d),codeTextData:Se,data:Se,codeFlowValue:Se,definition:f(pe),definitionDestinationString:d,definitionLabelString:d,definitionTitleString:d,emphasis:f(oe),hardBreakEscape:f(Ce),hardBreakTrailing:f(Ce),htmlFlow:f(He,d),htmlFlowData:Se,htmlText:f(He,d),htmlTextData:Se,image:f(en),label:d,link:f(tn),listItem:f(ct),listItemValue:x,listOrdered:f(et,g),listUnordered:f(et),paragraph:f(bn),reference:k,referenceString:d,resourceDestinationString:d,resourceTitleString:d,setextHeading:f(ye),strong:f(Au),thematicBreak:f(wu)},exit:{atxHeading:m(),atxHeadingSequence:ue,autolink:m(),autolinkEmail:X,autolinkProtocol:Qe,blockQuote:m(),characterEscapeValue:L,characterReferenceMarkerHexadecimal:me,characterReferenceMarkerNumeric:me,characterReferenceValue:fe,characterReference:Ae,codeFenced:m(j),codeFencedFence:B,codeFencedFenceInfo:S,codeFencedFenceMeta:C,codeFlowValue:L,codeIndented:m(_),codeText:m(W),codeTextData:L,data:L,definition:m(),definitionDestinationString:le,definitionLabelString:F,definitionTitleString:Y,emphasis:m(),hardBreakEscape:m(ee),hardBreakTrailing:m(ee),htmlFlow:m(ke),htmlFlowData:L,htmlText:m(re),htmlTextData:L,image:m(K),label:we,labelText:ce,lineEnding:ie,link:m(D),listItem:m(),listOrdered:m(),listUnordered:m(),paragraph:m(),referenceString:te,resourceDestinationString:E,resourceTitleString:w,resource:H,setextHeading:m(he),setextHeadingLineSequence:$,setextHeadingText:N,strong:m(),thematicBreak:m()}};_g(r,(n||{}).mdastExtensions||[]);const a={};return u;function u(V){let P={type:"root",children:[]};const Ee={stack:[P],tokenStack:[],config:r,enter:h,exit:p,buffer:d,resume:v,data:a},De=[];let Ge=-1;for(;++Ge<V.length;)if(V[Ge][1].type==="listOrdered"||V[Ge][1].type==="listUnordered")if(V[Ge][0]==="enter")De.push(Ge);else{const Xt=De.pop();Ge=c(V,Xt,Ge)}for(Ge=-1;++Ge<V.length;){const Xt=r[V[Ge][0]];zg.call(Xt,V[Ge][1].type)&&Xt[V[Ge][1].type].call(Object.assign({sliceSerialize:V[Ge][2].sliceSerialize},Ee),V[Ge][1])}if(Ee.tokenStack.length>0){const Xt=Ee.tokenStack[Ee.tokenStack.length-1];(Xt[1]||Tm).call(Ee,void 0,Xt[0])}for(P.position={start:vl(V.length>0?V[0][1].start:{line:1,column:1,offset:0}),end:vl(V.length>0?V[V.length-2][1].end:{line:1,column:1,offset:0})},Ge=-1;++Ge<r.transforms.length;)P=r.transforms[Ge](P)||P;return P}function c(V,P,Ee){let De=P-1,Ge=-1,Xt=!1,Cn,Dt,mt,Nt;for(;++De<=Ee;){const We=V[De];switch(We[1].type){case"listUnordered":case"listOrdered":case"blockQuote":{We[0]==="enter"?Ge++:Ge--,Nt=void 0;break}case"lineEndingBlank":{We[0]==="enter"&&(Cn&&!Nt&&!Ge&&!mt&&(mt=De),Nt=void 0);break}case"linePrefix":case"listItemValue":case"listItemMarker":case"listItemPrefix":case"listItemPrefixWhitespace":break;default:Nt=void 0}if(!Ge&&We[0]==="enter"&&We[1].type==="listItemPrefix"||Ge===-1&&We[0]==="exit"&&(We[1].type==="listUnordered"||We[1].type==="listOrdered")){if(Cn){let Zn=De;for(Dt=void 0;Zn--;){const pn=V[Zn];if(pn[1].type==="lineEnding"||pn[1].type==="lineEndingBlank"){if(pn[0]==="exit")continue;Dt&&(V[Dt][1].type="lineEndingBlank",Xt=!0),pn[1].type="lineEnding",Dt=Zn}else if(!(pn[1].type==="linePrefix"||pn[1].type==="blockQuotePrefix"||pn[1].type==="blockQuotePrefixWhitespace"||pn[1].type==="blockQuoteMarker"||pn[1].type==="listItemIndent"))break}mt&&(!Dt||mt<Dt)&&(Cn._spread=!0),Cn.end=Object.assign({},Dt?V[Dt][1].start:We[1].end),V.splice(Dt||De,0,["exit",Cn,We[2]]),De++,Ee++}if(We[1].type==="listItemPrefix"){const Zn={type:"listItem",_spread:!1,start:Object.assign({},We[1].start),end:void 0};Cn=Zn,V.splice(De,0,["enter",Zn,We[2]]),De++,Ee++,mt=void 0,Nt=!0}}}return V[P][1]._spread=Xt,Ee}function f(V,P){return Ee;function Ee(De){h.call(this,V(De),De),P&&P.call(this,De)}}function d(){this.stack.push({type:"fragment",children:[]})}function h(V,P,Ee){this.stack[this.stack.length-1].children.push(V),this.stack.push(V),this.tokenStack.push([P,Ee||void 0]),V.position={start:vl(P.start),end:void 0}}function m(V){return P;function P(Ee){V&&V.call(this,Ee),p.call(this,Ee)}}function p(V,P){const Ee=this.stack.pop(),De=this.tokenStack.pop();if(De)De[0].type!==V.type&&(P?P.call(this,V,De[0]):(De[1]||Tm).call(this,V,De[0]));else throw new Error("Cannot close `"+V.type+"` ("+Rr({start:V.start,end:V.end})+"): it\u2019s not open");Ee.position.end=vl(V.end)}function v(){return Ns(this.stack.pop())}function g(){this.data.expectingFirstListItemValue=!0}function x(V){if(this.data.expectingFirstListItemValue){const P=this.stack[this.stack.length-2];P.start=Number.parseInt(this.sliceSerialize(V),10),this.data.expectingFirstListItemValue=void 0}}function S(){const V=this.resume(),P=this.stack[this.stack.length-1];P.lang=V}function C(){const V=this.resume(),P=this.stack[this.stack.length-1];P.meta=V}function B(){this.data.flowCodeInside||(this.buffer(),this.data.flowCodeInside=!0)}function j(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V.replace(/^(\\r?\\n|\\r)|(\\r?\\n|\\r)$/g,""),this.data.flowCodeInside=void 0}function _(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V.replace(/(\\r?\\n|\\r)$/g,"")}function F(V){const P=this.resume(),Ee=this.stack[this.stack.length-1];Ee.label=P,Ee.identifier=vn(this.sliceSerialize(V)).toLowerCase()}function Y(){const V=this.resume(),P=this.stack[this.stack.length-1];P.title=V}function le(){const V=this.resume(),P=this.stack[this.stack.length-1];P.url=V}function ue(V){const P=this.stack[this.stack.length-1];if(!P.depth){const Ee=this.sliceSerialize(V).length;P.depth=Ee}}function N(){this.data.setextHeadingSlurpLineEnding=!0}function $(V){const P=this.stack[this.stack.length-1];P.depth=this.sliceSerialize(V).codePointAt(0)===61?1:2}function he(){this.data.setextHeadingSlurpLineEnding=void 0}function Se(V){const Ee=this.stack[this.stack.length-1].children;let De=Ee[Ee.length-1];(!De||De.type!=="text")&&(De=Ot(),De.position={start:vl(V.start),end:void 0},Ee.push(De)),this.stack.push(De)}function L(V){const P=this.stack.pop();P.value+=this.sliceSerialize(V),P.position.end=vl(V.end)}function ie(V){const P=this.stack[this.stack.length-1];if(this.data.atHardBreak){const Ee=P.children[P.children.length-1];Ee.position.end=vl(V.end),this.data.atHardBreak=void 0;return}!this.data.setextHeadingSlurpLineEnding&&r.canContainEols.includes(P.type)&&(Se.call(this,V),L.call(this,V))}function ee(){this.data.atHardBreak=!0}function ke(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function re(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function W(){const V=this.resume(),P=this.stack[this.stack.length-1];P.value=V}function D(){const V=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";V.type+="Reference",V.referenceType=P,delete V.url,delete V.title}else delete V.identifier,delete V.label;this.data.referenceType=void 0}function K(){const V=this.stack[this.stack.length-1];if(this.data.inReference){const P=this.data.referenceType||"shortcut";V.type+="Reference",V.referenceType=P,delete V.url,delete V.title}else delete V.identifier,delete V.label;this.data.referenceType=void 0}function ce(V){const P=this.sliceSerialize(V),Ee=this.stack[this.stack.length-2];Ee.label=fS(P),Ee.identifier=vn(P).toLowerCase()}function we(){const V=this.stack[this.stack.length-1],P=this.resume(),Ee=this.stack[this.stack.length-1];if(this.data.inReference=!0,Ee.type==="link"){const De=V.children;Ee.children=De}else Ee.alt=P}function E(){const V=this.resume(),P=this.stack[this.stack.length-1];P.url=V}function w(){const V=this.resume(),P=this.stack[this.stack.length-1];P.title=V}function H(){this.data.inReference=void 0}function k(){this.data.referenceType="collapsed"}function te(V){const P=this.resume(),Ee=this.stack[this.stack.length-1];Ee.label=P,Ee.identifier=vn(this.sliceSerialize(V)).toLowerCase(),this.data.referenceType="full"}function me(V){this.data.characterReferenceType=V.type}function fe(V){const P=this.sliceSerialize(V),Ee=this.data.characterReferenceType;let De;Ee?(De=vg(P,Ee==="characterReferenceMarkerNumeric"?10:16),this.data.characterReferenceType=void 0):De=Ls(P);const Ge=this.stack[this.stack.length-1];Ge.value+=De}function Ae(V){const P=this.stack.pop();P.position.end=vl(V.end)}function Qe(V){L.call(this,V);const P=this.stack[this.stack.length-1];P.url=this.sliceSerialize(V)}function X(V){L.call(this,V);const P=this.stack[this.stack.length-1];P.url="mailto:"+this.sliceSerialize(V)}function Z(){return{type:"blockquote",children:[]}}function ne(){return{type:"code",lang:null,meta:null,value:""}}function ae(){return{type:"inlineCode",value:""}}function pe(){return{type:"definition",identifier:"",label:null,title:null,url:""}}function oe(){return{type:"emphasis",children:[]}}function ye(){return{type:"heading",depth:0,children:[]}}function Ce(){return{type:"break"}}function He(){return{type:"html",value:""}}function en(){return{type:"image",title:null,url:"",alt:null}}function tn(){return{type:"link",title:null,url:"",children:[]}}function et(V){return{type:"list",ordered:V.type==="listOrdered",start:null,spread:V._spread,children:[]}}function ct(V){return{type:"listItem",spread:V._spread,checked:null,children:[]}}function bn(){return{type:"paragraph",children:[]}}function Au(){return{type:"strong",children:[]}}function Ot(){return{type:"text",value:""}}function wu(){return{type:"thematicBreak"}}}function vl(n){return{line:n.line,column:n.column,offset:n.offset}}function _g(n,r){let a=-1;for(;++a<r.length;){const u=r[a];Array.isArray(u)?_g(n,u):mS(n,u)}}function mS(n,r){let a;for(a in r)if(zg.call(r,a))switch(a){case"canContainEols":{const u=r[a];u&&n[a].push(...u);break}case"transforms":{const u=r[a];u&&n[a].push(...u);break}case"enter":case"exit":{const u=r[a];u&&Object.assign(n[a],u);break}}}function Tm(n,r){throw n?new Error("Cannot close `"+n.type+"` ("+Rr({start:n.start,end:n.end})+"): a different token (`"+r.type+"`, "+Rr({start:r.start,end:r.end})+") is open"):new Error("Cannot close document, a token (`"+r.type+"`, "+Rr({start:r.start,end:r.end})+") is still open")}function gS(n){const r=this;r.parser=a;function a(u){return hS(u,{...r.data("settings"),...n,extensions:r.data("micromarkExtensions")||[],mdastExtensions:r.data("fromMarkdownExtensions")||[]})}}function yS(n,r){const a={type:"element",tagName:"blockquote",properties:{},children:n.wrap(n.all(r),!0)};return n.patch(r,a),n.applyData(r,a)}function vS(n,r){const a={type:"element",tagName:"br",properties:{},children:[]};return n.patch(r,a),[n.applyData(r,a),{type:"text",value:`\n`}]}function bS(n,r){const a=r.value?r.value+`\n`:"",u={},c=r.lang?r.lang.split(/\\s+/):[];c.length>0&&(u.className=["language-"+c[0]]);let f={type:"element",tagName:"code",properties:u,children:[{type:"text",value:a}]};return r.meta&&(f.data={meta:r.meta}),n.patch(r,f),f=n.applyData(r,f),f={type:"element",tagName:"pre",properties:{},children:[f]},n.patch(r,f),f}function xS(n,r){const a={type:"element",tagName:"del",properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}function SS(n,r){const a={type:"element",tagName:"em",properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}function kS(n,r){const a=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",u=String(r.identifier).toUpperCase(),c=Ri(u.toLowerCase()),f=n.footnoteOrder.indexOf(u);let d,h=n.footnoteCounts.get(u);h===void 0?(h=0,n.footnoteOrder.push(u),d=n.footnoteOrder.length):d=f+1,h+=1,n.footnoteCounts.set(u,h);const m={type:"element",tagName:"a",properties:{href:"#"+a+"fn-"+c,id:a+"fnref-"+c+(h>1?"-"+h:""),dataFootnoteRef:!0,ariaDescribedBy:["footnote-label"]},children:[{type:"text",value:String(d)}]};n.patch(r,m);const p={type:"element",tagName:"sup",properties:{},children:[m]};return n.patch(r,p),n.applyData(r,p)}function ES(n,r){const a={type:"element",tagName:"h"+r.depth,properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}function AS(n,r){if(n.options.allowDangerousHtml){const a={type:"raw",value:r.value};return n.patch(r,a),n.applyData(r,a)}}function Og(n,r){const a=r.referenceType;let u="]";if(a==="collapsed"?u+="[]":a==="full"&&(u+="["+(r.label||r.identifier)+"]"),r.type==="imageReference")return[{type:"text",value:"!["+r.alt+u}];const c=n.all(r),f=c[0];f&&f.type==="text"?f.value="["+f.value:c.unshift({type:"text",value:"["});const d=c[c.length-1];return d&&d.type==="text"?d.value+=u:c.push({type:"text",value:u}),c}function wS(n,r){const a=String(r.identifier).toUpperCase(),u=n.definitionById.get(a);if(!u)return Og(n,r);const c={src:Ri(u.url||""),alt:r.alt};u.title!==null&&u.title!==void 0&&(c.title=u.title);const f={type:"element",tagName:"img",properties:c,children:[]};return n.patch(r,f),n.applyData(r,f)}function TS(n,r){const a={src:Ri(r.url)};r.alt!==null&&r.alt!==void 0&&(a.alt=r.alt),r.title!==null&&r.title!==void 0&&(a.title=r.title);const u={type:"element",tagName:"img",properties:a,children:[]};return n.patch(r,u),n.applyData(r,u)}function CS(n,r){const a={type:"text",value:r.value.replace(/\\r?\\n|\\r/g," ")};n.patch(r,a);const u={type:"element",tagName:"code",properties:{},children:[a]};return n.patch(r,u),n.applyData(r,u)}function zS(n,r){const a=String(r.identifier).toUpperCase(),u=n.definitionById.get(a);if(!u)return Og(n,r);const c={href:Ri(u.url||"")};u.title!==null&&u.title!==void 0&&(c.title=u.title);const f={type:"element",tagName:"a",properties:c,children:n.all(r)};return n.patch(r,f),n.applyData(r,f)}function _S(n,r){const a={href:Ri(r.url)};r.title!==null&&r.title!==void 0&&(a.title=r.title);const u={type:"element",tagName:"a",properties:a,children:n.all(r)};return n.patch(r,u),n.applyData(r,u)}function OS(n,r,a){const u=n.all(r),c=a?DS(a):Dg(r),f={},d=[];if(typeof r.checked=="boolean"){const v=u[0];let g;v&&v.type==="element"&&v.tagName==="p"?g=v:(g={type:"element",tagName:"p",properties:{},children:[]},u.unshift(g)),g.children.length>0&&g.children.unshift({type:"text",value:" "}),g.children.unshift({type:"element",tagName:"input",properties:{type:"checkbox",checked:r.checked,disabled:!0},children:[]}),f.className=["task-list-item"]}let h=-1;for(;++h<u.length;){const v=u[h];(c||h!==0||v.type!=="element"||v.tagName!=="p")&&d.push({type:"text",value:`\n`}),v.type==="element"&&v.tagName==="p"&&!c?d.push(...v.children):d.push(v)}const m=u[u.length-1];m&&(c||m.type!=="element"||m.tagName!=="p")&&d.push({type:"text",value:`\n`});const p={type:"element",tagName:"li",properties:f,children:d};return n.patch(r,p),n.applyData(r,p)}function DS(n){let r=!1;if(n.type==="list"){r=n.spread||!1;const a=n.children;let u=-1;for(;!r&&++u<a.length;)r=Dg(a[u])}return r}function Dg(n){const r=n.spread;return r??n.children.length>1}function MS(n,r){const a={},u=n.all(r);let c=-1;for(typeof r.start=="number"&&r.start!==1&&(a.start=r.start);++c<u.length;){const d=u[c];if(d.type==="element"&&d.tagName==="li"&&d.properties&&Array.isArray(d.properties.className)&&d.properties.className.includes("task-list-item")){a.className=["contains-task-list"];break}}const f={type:"element",tagName:r.ordered?"ol":"ul",properties:a,children:n.wrap(u,!0)};return n.patch(r,f),n.applyData(r,f)}function RS(n,r){const a={type:"element",tagName:"p",properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}function NS(n,r){const a={type:"root",children:n.wrap(n.all(r))};return n.patch(r,a),n.applyData(r,a)}function LS(n,r){const a={type:"element",tagName:"strong",properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}function US(n,r){const a=n.all(r),u=a.shift(),c=[];if(u){const d={type:"element",tagName:"thead",properties:{},children:n.wrap([u],!0)};n.patch(r.children[0],d),c.push(d)}if(a.length>0){const d={type:"element",tagName:"tbody",properties:{},children:n.wrap(a,!0)},h=Os(r.children[1]),m=sg(r.children[r.children.length-1]);h&&m&&(d.position={start:h,end:m}),c.push(d)}const f={type:"element",tagName:"table",properties:{},children:n.wrap(c,!0)};return n.patch(r,f),n.applyData(r,f)}function jS(n,r,a){const u=a?a.children:void 0,f=(u?u.indexOf(r):1)===0?"th":"td",d=a&&a.type==="table"?a.align:void 0,h=d?d.length:r.children.length;let m=-1;const p=[];for(;++m<h;){const g=r.children[m],x={},S=d?d[m]:void 0;S&&(x.align=S);let C={type:"element",tagName:f,properties:x,children:[]};g&&(C.children=n.all(g),n.patch(g,C),C=n.applyData(g,C)),p.push(C)}const v={type:"element",tagName:"tr",properties:{},children:n.wrap(p,!0)};return n.patch(r,v),n.applyData(r,v)}function BS(n,r){const a={type:"element",tagName:"td",properties:{},children:n.all(r)};return n.patch(r,a),n.applyData(r,a)}const Cm=9,zm=32;function HS(n){const r=String(n),a=/\\r?\\n|\\r/g;let u=a.exec(r),c=0;const f=[];for(;u;)f.push(_m(r.slice(c,u.index),c>0,!0),u[0]),c=u.index+u[0].length,u=a.exec(r);return f.push(_m(r.slice(c),c>0,!1)),f.join("")}function _m(n,r,a){let u=0,c=n.length;if(r){let f=n.codePointAt(u);for(;f===Cm||f===zm;)u++,f=n.codePointAt(u)}if(a){let f=n.codePointAt(c-1);for(;f===Cm||f===zm;)c--,f=n.codePointAt(c-1)}return c>u?n.slice(u,c):""}function qS(n,r){const a={type:"text",value:HS(String(r.value))};return n.patch(r,a),n.applyData(r,a)}function YS(n,r){const a={type:"element",tagName:"hr",properties:{},children:[]};return n.patch(r,a),n.applyData(r,a)}const VS={blockquote:yS,break:vS,code:bS,delete:xS,emphasis:SS,footnoteReference:kS,heading:ES,html:AS,imageReference:wS,image:TS,inlineCode:CS,linkReference:zS,link:_S,listItem:OS,list:MS,paragraph:RS,root:NS,strong:LS,table:US,tableCell:BS,tableRow:jS,text:qS,thematicBreak:YS,toml:iu,yaml:iu,definition:iu,footnoteDefinition:iu};function iu(){}const Mg=-1,Su=0,Lr=1,mu=2,js=3,Bs=4,Hs=5,qs=6,Rg=7,Ng=8,GS=typeof self=="object"?self:globalThis,Om=(n,r)=>{switch(n){case"Function":case"SharedWorker":case"Worker":case"eval":case"setInterval":case"setTimeout":throw new TypeError("unable to deserialize "+n)}return new GS[n](r)},XS=(n,r)=>{const a=(c,f)=>(n.set(f,c),c),u=c=>{if(n.has(c))return n.get(c);const[f,d]=r[c];switch(f){case Su:case Mg:return a(d,c);case Lr:{const h=a([],c);for(const m of d)h.push(u(m));return h}case mu:{const h=a({},c);for(const[m,p]of d)h[u(m)]=u(p);return h}case js:return a(new Date(d),c);case Bs:{const{source:h,flags:m}=d;return a(new RegExp(h,m),c)}case Hs:{const h=a(new Map,c);for(const[m,p]of d)h.set(u(m),u(p));return h}case qs:{const h=a(new Set,c);for(const m of d)h.add(u(m));return h}case Rg:{const{name:h,message:m}=d;return a(Om(h,m),c)}case Ng:return a(BigInt(d),c);case"BigInt":return a(Object(BigInt(d)),c);case"ArrayBuffer":return a(new Uint8Array(d).buffer,d);case"DataView":{const{buffer:h}=new Uint8Array(d);return a(new DataView(h),d)}}return a(Om(f,d),c)};return u},Dm=n=>XS(new Map,n)(0),Ci="",{toString:QS}={},{keys:IS}=Object,Dr=n=>{const r=typeof n;if(r!=="object"||!n)return[Su,r];const a=QS.call(n).slice(8,-1);switch(a){case"Array":return[Lr,Ci];case"Object":return[mu,Ci];case"Date":return[js,Ci];case"RegExp":return[Bs,Ci];case"Map":return[Hs,Ci];case"Set":return[qs,Ci];case"DataView":return[Lr,a]}return a.includes("Array")?[Lr,a]:a.includes("Error")?[Rg,a]:[mu,a]},ru=([n,r])=>n===Su&&(r==="function"||r==="symbol"),ZS=(n,r,a,u)=>{const c=(d,h)=>{const m=u.push(d)-1;return a.set(h,m),m},f=d=>{if(a.has(d))return a.get(d);let[h,m]=Dr(d);switch(h){case Su:{let v=d;switch(m){case"bigint":h=Ng,v=d.toString();break;case"function":case"symbol":if(n)throw new TypeError("unable to serialize "+m);v=null;break;case"undefined":return c([Mg],d)}return c([h,v],d)}case Lr:{if(m){let x=d;return m==="DataView"?x=new Uint8Array(d.buffer):m==="ArrayBuffer"&&(x=new Uint8Array(d)),c([m,[...x]],d)}const v=[],g=c([h,v],d);for(const x of d)v.push(f(x));return g}case mu:{if(m)switch(m){case"BigInt":return c([m,d.toString()],d);case"Boolean":case"Number":case"String":return c([m,d.valueOf()],d)}if(r&&"toJSON"in d)return f(d.toJSON());const v=[],g=c([h,v],d);for(const x of IS(d))(n||!ru(Dr(d[x])))&&v.push([f(x),f(d[x])]);return g}case js:return c([h,d.toISOString()],d);case Bs:{const{source:v,flags:g}=d;return c([h,{source:v,flags:g}],d)}case Hs:{const v=[],g=c([h,v],d);for(const[x,S]of d)(n||!(ru(Dr(x))||ru(Dr(S))))&&v.push([f(x),f(S)]);return g}case qs:{const v=[],g=c([h,v],d);for(const x of d)(n||!ru(Dr(x)))&&v.push(f(x));return g}}const{message:p}=d;return c([h,{name:m,message:p}],d)};return f},Mm=(n,{json:r,lossy:a}={})=>{const u=[];return ZS(!(r||a),!!r,new Map,u)(n),u},gu=typeof structuredClone=="function"?(n,r)=>r&&("json"in r||"lossy"in r)?Dm(Mm(n,r)):structuredClone(n):(n,r)=>Dm(Mm(n,r));function FS(n,r){const a=[{type:"text",value:"\u21A9"}];return r>1&&a.push({type:"element",tagName:"sup",properties:{},children:[{type:"text",value:String(r)}]}),a}function KS(n,r){return"Back to reference "+(n+1)+(r>1?"-"+r:"")}function JS(n){const r=typeof n.options.clobberPrefix=="string"?n.options.clobberPrefix:"user-content-",a=n.options.footnoteBackContent||FS,u=n.options.footnoteBackLabel||KS,c=n.options.footnoteLabel||"Footnotes",f=n.options.footnoteLabelTagName||"h2",d=n.options.footnoteLabelProperties||{className:["sr-only"]},h=[];let m=-1;for(;++m<n.footnoteOrder.length;){const p=n.footnoteById.get(n.footnoteOrder[m]);if(!p)continue;const v=n.all(p),g=String(p.identifier).toUpperCase(),x=Ri(g.toLowerCase());let S=0;const C=[],B=n.footnoteCounts.get(g);for(;B!==void 0&&++S<=B;){C.length>0&&C.push({type:"text",value:" "});let F=typeof a=="string"?a:a(m,S);typeof F=="string"&&(F={type:"text",value:F}),C.push({type:"element",tagName:"a",properties:{href:"#"+r+"fnref-"+x+(S>1?"-"+S:""),dataFootnoteBackref:"",ariaLabel:typeof u=="string"?u:u(m,S),className:["data-footnote-backref"]},children:Array.isArray(F)?F:[F]})}const j=v[v.length-1];if(j&&j.type==="element"&&j.tagName==="p"){const F=j.children[j.children.length-1];F&&F.type==="text"?F.value+=" ":j.children.push({type:"text",value:" "}),j.children.push(...C)}else v.push(...C);const _={type:"element",tagName:"li",properties:{id:r+"fn-"+x},children:n.wrap(v,!0)};n.patch(p,_),h.push(_)}if(h.length!==0)return{type:"element",tagName:"section",properties:{dataFootnotes:!0,className:["footnotes"]},children:[{type:"element",tagName:f,properties:{...gu(d),id:"footnote-label"},children:[{type:"text",value:c}]},{type:"text",value:`\n`},{type:"element",tagName:"ol",properties:{},children:n.wrap(h,!0)},{type:"text",value:`\n`}]}}const ku=(function(n){if(n==null)return ek;if(typeof n=="function")return Eu(n);if(typeof n=="object")return Array.isArray(n)?WS(n):$S(n);if(typeof n=="string")return PS(n);throw new Error("Expected function, string, or object as test")});function WS(n){const r=[];let a=-1;for(;++a<n.length;)r[a]=ku(n[a]);return Eu(u);function u(...c){let f=-1;for(;++f<r.length;)if(r[f].apply(this,c))return!0;return!1}}function $S(n){const r=n;return Eu(a);function a(u){const c=u;let f;for(f in n)if(c[f]!==r[f])return!1;return!0}}function PS(n){return Eu(r);function r(a){return a&&a.type===n}}function Eu(n){return r;function r(a,u,c){return!!(tk(a)&&n.call(this,a,typeof u=="number"?u:void 0,c||void 0))}}function ek(){return!0}function tk(n){return n!==null&&typeof n=="object"&&"type"in n}const Lg=[],nk=!0,xs=!1,lk="skip";function Ug(n,r,a,u){let c;typeof r=="function"&&typeof a!="function"?(u=a,a=r):c=r;const f=ku(c),d=u?-1:1;h(n,void 0,[])();function h(m,p,v){const g=m&&typeof m=="object"?m:{};if(typeof g.type=="string"){const S=typeof g.tagName=="string"?g.tagName:typeof g.name=="string"?g.name:void 0;Object.defineProperty(x,"name",{value:"node ("+(m.type+(S?"<"+S+">":""))+")"})}return x;function x(){let S=Lg,C,B,j;if((!r||f(m,p,v[v.length-1]||void 0))&&(S=ik(a(m,v)),S[0]===xs))return S;if("children"in m&&m.children){const _=m;if(_.children&&S[0]!==lk)for(B=(u?_.children.length:-1)+d,j=v.concat(_);B>-1&&B<_.children.length;){const F=_.children[B];if(C=h(F,B,j)(),C[0]===xs)return C;B=typeof C[1]=="number"?C[1]:B+d}}return S}}}function ik(n){return Array.isArray(n)?n:typeof n=="number"?[nk,n]:n==null?Lg:[n]}function Ys(n,r,a,u){let c,f,d;typeof r=="function"&&typeof a!="function"?(f=void 0,d=r,c=a):(f=r,d=a,c=u),Ug(n,f,h,c);function h(m,p){const v=p[p.length-1],g=v?v.children.indexOf(m):void 0;return d(m,g,v)}}const Ss={}.hasOwnProperty,rk={};function ak(n,r){const a=r||rk,u=new Map,c=new Map,f=new Map,d={...VS,...a.handlers},h={all:p,applyData:ok,definitionById:u,footnoteById:c,footnoteCounts:f,footnoteOrder:[],handlers:d,one:m,options:a,patch:uk,wrap:sk};return Ys(n,function(v){if(v.type==="definition"||v.type==="footnoteDefinition"){const g=v.type==="definition"?u:c,x=String(v.identifier).toUpperCase();g.has(x)||g.set(x,v)}}),h;function m(v,g){const x=v.type,S=h.handlers[x];if(Ss.call(h.handlers,x)&&S)return S(h,v,g);if(h.options.passThrough&&h.options.passThrough.includes(x)){if("children"in v){const{children:B,...j}=v,_=gu(j);return _.children=h.all(v),_}return gu(v)}return(h.options.unknownHandler||ck)(h,v,g)}function p(v){const g=[];if("children"in v){const x=v.children;let S=-1;for(;++S<x.length;){const C=h.one(x[S],v);if(C){if(S&&x[S-1].type==="break"&&(!Array.isArray(C)&&C.type==="text"&&(C.value=Rm(C.value)),!Array.isArray(C)&&C.type==="element")){const B=C.children[0];B&&B.type==="text"&&(B.value=Rm(B.value))}Array.isArray(C)?g.push(...C):g.push(C)}}}return g}}function uk(n,r){n.position&&(r.position=Fb(n))}function ok(n,r){let a=r;if(n&&n.data){const u=n.data.hName,c=n.data.hChildren,f=n.data.hProperties;if(typeof u=="string")if(a.type==="element")a.tagName=u;else{const d="children"in a?a.children:[a];a={type:"element",tagName:u,properties:{},children:d}}a.type==="element"&&f&&Object.assign(a.properties,gu(f)),"children"in a&&a.children&&c!==null&&c!==void 0&&(a.children=c)}return a}function ck(n,r){const a=r.data||{},u="value"in r&&!(Ss.call(a,"hProperties")||Ss.call(a,"hChildren"))?{type:"text",value:r.value}:{type:"element",tagName:"div",properties:{},children:n.all(r)};return n.patch(r,u),n.applyData(r,u)}function sk(n,r){const a=[];let u=-1;for(r&&a.push({type:"text",value:`\n`});++u<n.length;)u&&a.push({type:"text",value:`\n`}),a.push(n[u]);return r&&n.length>0&&a.push({type:"text",value:`\n`}),a}function Rm(n){let r=0,a=n.charCodeAt(r);for(;a===9||a===32;)r++,a=n.charCodeAt(r);return n.slice(r)}function Nm(n,r){const a=ak(n,r),u=a.one(n,void 0),c=JS(a),f=Array.isArray(u)?{type:"root",children:u}:u||{type:"root",children:[]};return c&&f.children.push({type:"text",value:`\n`},c),f}function fk(n,r){return n&&"run"in n?async function(a,u){const c=Nm(a,{file:u,...r});await n.run(c,u)}:function(a,u){return Nm(a,{file:u,...n||r})}}function Lm(n){if(n)throw n}var $c,Um;function dk(){if(Um)return $c;Um=1;var n=Object.prototype.hasOwnProperty,r=Object.prototype.toString,a=Object.defineProperty,u=Object.getOwnPropertyDescriptor,c=function(p){return typeof Array.isArray=="function"?Array.isArray(p):r.call(p)==="[object Array]"},f=function(p){if(!p||r.call(p)!=="[object Object]")return!1;var v=n.call(p,"constructor"),g=p.constructor&&p.constructor.prototype&&n.call(p.constructor.prototype,"isPrototypeOf");if(p.constructor&&!v&&!g)return!1;var x;for(x in p);return typeof x>"u"||n.call(p,x)},d=function(p,v){a&&v.name==="__proto__"?a(p,v.name,{enumerable:!0,configurable:!0,value:v.newValue,writable:!0}):p[v.name]=v.newValue},h=function(p,v){if(v==="__proto__")if(n.call(p,v)){if(u)return u(p,v).value}else return;return p[v]};return $c=function m(){var p,v,g,x,S,C,B=arguments[0],j=1,_=arguments.length,F=!1;for(typeof B=="boolean"&&(F=B,B=arguments[1]||{},j=2),(B==null||typeof B!="object"&&typeof B!="function")&&(B={});j<_;++j)if(p=arguments[j],p!=null)for(v in p)g=h(B,v),x=h(p,v),B!==x&&(F&&x&&(f(x)||(S=c(x)))?(S?(S=!1,C=g&&c(g)?g:[]):C=g&&f(g)?g:{},d(B,{name:v,newValue:m(F,C,x)})):typeof x<"u"&&d(B,{name:v,newValue:x}));return B},$c}var hk=dk();const Pc=ws(hk);function ks(n){if(typeof n!="object"||n===null)return!1;const r=Object.getPrototypeOf(n);return(r===null||r===Object.prototype||Object.getPrototypeOf(r)===null)&&!(Symbol.toStringTag in n)&&!(Symbol.iterator in n)}function pk(){const n=[],r={run:a,use:u};return r;function a(...c){let f=-1;const d=c.pop();if(typeof d!="function")throw new TypeError("Expected function as last argument, not "+d);h(null,...c);function h(m,...p){const v=n[++f];let g=-1;if(m){d(m);return}for(;++g<c.length;)(p[g]===null||p[g]===void 0)&&(p[g]=c[g]);c=p,v?mk(v,h)(...p):d(null,...p)}}function u(c){if(typeof c!="function")throw new TypeError("Expected `middelware` to be a function, not "+c);return n.push(c),r}}function mk(n,r){let a;return u;function u(...d){const h=n.length>d.length;let m;h&&d.push(c);try{m=n.apply(this,d)}catch(p){const v=p;if(h&&a)throw v;return c(v)}h||(m&&m.then&&typeof m.then=="function"?m.then(f,c):m instanceof Error?c(m):f(m))}function c(d,...h){a||(a=!0,r(d,...h))}function f(d){c(null,d)}}const An={basename:gk,dirname:yk,extname:vk,join:bk,sep:"/"};function gk(n,r){if(r!==void 0&&typeof r!="string")throw new TypeError(\'"ext" argument must be a string\');qr(n);let a=0,u=-1,c=n.length,f;if(r===void 0||r.length===0||r.length>n.length){for(;c--;)if(n.codePointAt(c)===47){if(f){a=c+1;break}}else u<0&&(f=!0,u=c+1);return u<0?"":n.slice(a,u)}if(r===n)return"";let d=-1,h=r.length-1;for(;c--;)if(n.codePointAt(c)===47){if(f){a=c+1;break}}else d<0&&(f=!0,d=c+1),h>-1&&(n.codePointAt(c)===r.codePointAt(h--)?h<0&&(u=c):(h=-1,u=d));return a===u?u=d:u<0&&(u=n.length),n.slice(a,u)}function yk(n){if(qr(n),n.length===0)return".";let r=-1,a=n.length,u;for(;--a;)if(n.codePointAt(a)===47){if(u){r=a;break}}else u||(u=!0);return r<0?n.codePointAt(0)===47?"/":".":r===1&&n.codePointAt(0)===47?"//":n.slice(0,r)}function vk(n){qr(n);let r=n.length,a=-1,u=0,c=-1,f=0,d;for(;r--;){const h=n.codePointAt(r);if(h===47){if(d){u=r+1;break}continue}a<0&&(d=!0,a=r+1),h===46?c<0?c=r:f!==1&&(f=1):c>-1&&(f=-1)}return c<0||a<0||f===0||f===1&&c===a-1&&c===u+1?"":n.slice(c,a)}function bk(...n){let r=-1,a;for(;++r<n.length;)qr(n[r]),n[r]&&(a=a===void 0?n[r]:a+"/"+n[r]);return a===void 0?".":xk(a)}function xk(n){qr(n);const r=n.codePointAt(0)===47;let a=Sk(n,!r);return a.length===0&&!r&&(a="."),a.length>0&&n.codePointAt(n.length-1)===47&&(a+="/"),r?"/"+a:a}function Sk(n,r){let a="",u=0,c=-1,f=0,d=-1,h,m;for(;++d<=n.length;){if(d<n.length)h=n.codePointAt(d);else{if(h===47)break;h=47}if(h===47){if(!(c===d-1||f===1))if(c!==d-1&&f===2){if(a.length<2||u!==2||a.codePointAt(a.length-1)!==46||a.codePointAt(a.length-2)!==46){if(a.length>2){if(m=a.lastIndexOf("/"),m!==a.length-1){m<0?(a="",u=0):(a=a.slice(0,m),u=a.length-1-a.lastIndexOf("/")),c=d,f=0;continue}}else if(a.length>0){a="",u=0,c=d,f=0;continue}}r&&(a=a.length>0?a+"/..":"..",u=2)}else a.length>0?a+="/"+n.slice(c+1,d):a=n.slice(c+1,d),u=d-c-1;c=d,f=0}else h===46&&f>-1?f++:f=-1}return a}function qr(n){if(typeof n!="string")throw new TypeError("Path must be a string. Received "+JSON.stringify(n))}const kk={cwd:Ek};function Ek(){return"/"}function Es(n){return!!(n!==null&&typeof n=="object"&&"href"in n&&n.href&&"protocol"in n&&n.protocol&&n.auth===void 0)}function Ak(n){if(typeof n=="string")n=new URL(n);else if(!Es(n)){const r=new TypeError(\'The "path" argument must be of type string or an instance of URL. Received `\'+n+"`");throw r.code="ERR_INVALID_ARG_TYPE",r}if(n.protocol!=="file:"){const r=new TypeError("The URL must be of scheme file");throw r.code="ERR_INVALID_URL_SCHEME",r}return wk(n)}function wk(n){if(n.hostname!==""){const u=new TypeError(\'File URL host must be "localhost" or empty on darwin\');throw u.code="ERR_INVALID_FILE_URL_HOST",u}const r=n.pathname;let a=-1;for(;++a<r.length;)if(r.codePointAt(a)===37&&r.codePointAt(a+1)===50){const u=r.codePointAt(a+2);if(u===70||u===102){const c=new TypeError("File URL path must not include encoded / characters");throw c.code="ERR_INVALID_FILE_URL_PATH",c}}return decodeURIComponent(r)}const es=["history","path","basename","stem","extname","dirname"];class jg{constructor(r){let a;r?Es(r)?a={path:r}:typeof r=="string"||Tk(r)?a={value:r}:a=r:a={},this.cwd="cwd"in a?"":kk.cwd(),this.data={},this.history=[],this.messages=[],this.value,this.map,this.result,this.stored;let u=-1;for(;++u<es.length;){const f=es[u];f in a&&a[f]!==void 0&&a[f]!==null&&(this[f]=f==="history"?[...a[f]]:a[f])}let c;for(c in a)es.includes(c)||(this[c]=a[c])}get basename(){return typeof this.path=="string"?An.basename(this.path):void 0}set basename(r){ns(r,"basename"),ts(r,"basename"),this.path=An.join(this.dirname||"",r)}get dirname(){return typeof this.path=="string"?An.dirname(this.path):void 0}set dirname(r){jm(this.basename,"dirname"),this.path=An.join(r||"",this.basename)}get extname(){return typeof this.path=="string"?An.extname(this.path):void 0}set extname(r){if(ts(r,"extname"),jm(this.dirname,"extname"),r){if(r.codePointAt(0)!==46)throw new Error("`extname` must start with `.`");if(r.includes(".",1))throw new Error("`extname` cannot contain multiple dots")}this.path=An.join(this.dirname,this.stem+(r||""))}get path(){return this.history[this.history.length-1]}set path(r){Es(r)&&(r=Ak(r)),ns(r,"path"),this.path!==r&&this.history.push(r)}get stem(){return typeof this.path=="string"?An.basename(this.path,this.extname):void 0}set stem(r){ns(r,"stem"),ts(r,"stem"),this.path=An.join(this.dirname||"",r+(this.extname||""))}fail(r,a,u){const c=this.message(r,a,u);throw c.fatal=!0,c}info(r,a,u){const c=this.message(r,a,u);return c.fatal=void 0,c}message(r,a,u){const c=new _t(r,a,u);return this.path&&(c.name=this.path+":"+c.name,c.file=this.path),c.fatal=!1,this.messages.push(c),c}toString(r){return this.value===void 0?"":typeof this.value=="string"?this.value:new TextDecoder(r||void 0).decode(this.value)}}function ts(n,r){if(n&&n.includes(An.sep))throw new Error("`"+r+"` cannot be a path: did not expect `"+An.sep+"`")}function ns(n,r){if(!n)throw new Error("`"+r+"` cannot be empty")}function jm(n,r){if(!n)throw new Error("Setting `"+r+"` requires `path` to be set too")}function Tk(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const Ck=(function(n){const u=this.constructor.prototype,c=u[n],f=function(){return c.apply(f,arguments)};return Object.setPrototypeOf(f,u),f}),zk={}.hasOwnProperty;class Vs extends Ck{constructor(){super("copy"),this.Compiler=void 0,this.Parser=void 0,this.attachers=[],this.compiler=void 0,this.freezeIndex=-1,this.frozen=void 0,this.namespace={},this.parser=void 0,this.transformers=pk()}copy(){const r=new Vs;let a=-1;for(;++a<this.attachers.length;){const u=this.attachers[a];r.use(...u)}return r.data(Pc(!0,{},this.namespace)),r}data(r,a){return typeof r=="string"?arguments.length===2?(rs("data",this.frozen),this.namespace[r]=a,this):zk.call(this.namespace,r)&&this.namespace[r]||void 0:r?(rs("data",this.frozen),this.namespace=r,this):this.namespace}freeze(){if(this.frozen)return this;const r=this;for(;++this.freezeIndex<this.attachers.length;){const[a,...u]=this.attachers[this.freezeIndex];if(u[0]===!1)continue;u[0]===!0&&(u[0]=void 0);const c=a.call(r,...u);typeof c=="function"&&this.transformers.use(c)}return this.frozen=!0,this.freezeIndex=Number.POSITIVE_INFINITY,this}parse(r){this.freeze();const a=au(r),u=this.parser||this.Parser;return ls("parse",u),u(String(a),a)}process(r,a){const u=this;return this.freeze(),ls("process",this.parser||this.Parser),is("process",this.compiler||this.Compiler),a?c(void 0,a):new Promise(c);function c(f,d){const h=au(r),m=u.parse(h);u.run(m,h,function(v,g,x){if(v||!g||!x)return p(v);const S=g,C=u.stringify(S,x);Dk(C)?x.value=C:x.result=C,p(v,x)});function p(v,g){v||!g?d(v):f?f(g):a(void 0,g)}}}processSync(r){let a=!1,u;return this.freeze(),ls("processSync",this.parser||this.Parser),is("processSync",this.compiler||this.Compiler),this.process(r,c),Hm("processSync","process",a),u;function c(f,d){a=!0,Lm(f),u=d}}run(r,a,u){Bm(r),this.freeze();const c=this.transformers;return!u&&typeof a=="function"&&(u=a,a=void 0),u?f(void 0,u):new Promise(f);function f(d,h){const m=au(a);c.run(r,m,p);function p(v,g,x){const S=g||r;v?h(v):d?d(S):u(void 0,S,x)}}}runSync(r,a){let u=!1,c;return this.run(r,a,f),Hm("runSync","run",u),c;function f(d,h){Lm(d),c=h,u=!0}}stringify(r,a){this.freeze();const u=au(a),c=this.compiler||this.Compiler;return is("stringify",c),Bm(r),c(r,u)}use(r,...a){const u=this.attachers,c=this.namespace;if(rs("use",this.frozen),r!=null)if(typeof r=="function")m(r,a);else if(typeof r=="object")Array.isArray(r)?h(r):d(r);else throw new TypeError("Expected usable value, not `"+r+"`");return this;function f(p){if(typeof p=="function")m(p,[]);else if(typeof p=="object")if(Array.isArray(p)){const[v,...g]=p;m(v,g)}else d(p);else throw new TypeError("Expected usable value, not `"+p+"`")}function d(p){if(!("plugins"in p)&&!("settings"in p))throw new Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");h(p.plugins),p.settings&&(c.settings=Pc(!0,c.settings,p.settings))}function h(p){let v=-1;if(p!=null)if(Array.isArray(p))for(;++v<p.length;){const g=p[v];f(g)}else throw new TypeError("Expected a list of plugins, not `"+p+"`")}function m(p,v){let g=-1,x=-1;for(;++g<u.length;)if(u[g][0]===p){x=g;break}if(x===-1)u.push([p,...v]);else if(v.length>0){let[S,...C]=v;const B=u[x][1];ks(B)&&ks(S)&&(S=Pc(!0,B,S)),u[x]=[p,S,...C]}}}}const _k=new Vs().freeze();function ls(n,r){if(typeof r!="function")throw new TypeError("Cannot `"+n+"` without `parser`")}function is(n,r){if(typeof r!="function")throw new TypeError("Cannot `"+n+"` without `compiler`")}function rs(n,r){if(r)throw new Error("Cannot call `"+n+"` on a frozen processor.\\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.")}function Bm(n){if(!ks(n)||typeof n.type!="string")throw new TypeError("Expected node, got `"+n+"`")}function Hm(n,r,a){if(!a)throw new Error("`"+n+"` finished async. Use `"+r+"` instead")}function au(n){return Ok(n)?n:new jg(n)}function Ok(n){return!!(n&&typeof n=="object"&&"message"in n&&"messages"in n)}function Dk(n){return typeof n=="string"||Mk(n)}function Mk(n){return!!(n&&typeof n=="object"&&"byteLength"in n&&"byteOffset"in n)}const Rk="https://github.com/remarkjs/react-markdown/blob/main/changelog.md",qm=[],Ym={allowDangerousHtml:!0},Nk=/^(https?|ircs?|mailto|xmpp)$/i,Lk=[{from:"astPlugins",id:"remove-buggy-html-in-markdown-parser"},{from:"allowDangerousHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"allowNode",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowElement"},{from:"allowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"allowedElements"},{from:"disallowedTypes",id:"replace-allownode-allowedtypes-and-disallowedtypes",to:"disallowedElements"},{from:"escapeHtml",id:"remove-buggy-html-in-markdown-parser"},{from:"includeElementIndex",id:"#remove-includeelementindex"},{from:"includeNodeIndex",id:"change-includenodeindex-to-includeelementindex"},{from:"linkTarget",id:"remove-linktarget"},{from:"plugins",id:"change-plugins-to-remarkplugins",to:"remarkPlugins"},{from:"rawSourcePos",id:"#remove-rawsourcepos"},{from:"renderers",id:"change-renderers-to-components",to:"components"},{from:"source",id:"change-source-to-children",to:"children"},{from:"sourcePos",id:"#remove-sourcepos"},{from:"transformImageUri",id:"#add-urltransform",to:"urlTransform"},{from:"transformLinkUri",id:"#add-urltransform",to:"urlTransform"}];function Uk(n){const r=jk(n),a=Bk(n);return Hk(r.runSync(r.parse(a),a),n)}function jk(n){const r=n.rehypePlugins||qm,a=n.remarkPlugins||qm,u=n.remarkRehypeOptions?{...n.remarkRehypeOptions,...Ym}:Ym;return _k().use(gS).use(a).use(fk,u).use(r)}function Bk(n){const r=n.children||"",a=new jg;return typeof r=="string"&&(a.value=r),a}function Hk(n,r){const a=r.allowedElements,u=r.allowElement,c=r.components,f=r.disallowedElements,d=r.skipHtml,h=r.unwrapDisallowed,m=r.urlTransform||qk;for(const v of Lk)Object.hasOwn(r,v.from)&&(""+v.from+(v.to?"use `"+v.to+"` instead":"remove it")+Rk+v.id,void 0);return r.className&&(n={type:"element",tagName:"div",properties:{className:r.className},children:n.type==="root"?n.children:[n]}),Ys(n,p),Pb(n,{Fragment:I.Fragment,components:c,ignoreInvalidStyle:!0,jsx:I.jsx,jsxs:I.jsxs,passKeys:!0,passNode:!0});function p(v,g,x){if(v.type==="raw"&&x&&typeof g=="number")return d?x.children.splice(g,1):x.children[g]={type:"text",value:v.value},g;if(v.type==="element"){let S;for(S in Kc)if(Object.hasOwn(Kc,S)&&Object.hasOwn(v.properties,S)){const C=v.properties[S],B=Kc[S];(B===null||B.includes(v.tagName))&&(v.properties[S]=m(String(C||""),S,v))}}if(v.type==="element"){let S=a?!a.includes(v.tagName):f?f.includes(v.tagName):!1;if(!S&&u&&typeof g=="number"&&(S=!u(v,g,x)),S&&x&&typeof g=="number")return h&&v.children?x.children.splice(g,1,...v.children):x.children.splice(g,1),g}}}function qk(n){const r=n.indexOf(":"),a=n.indexOf("?"),u=n.indexOf("#"),c=n.indexOf("/");return r===-1||c!==-1&&r>c||a!==-1&&r>a||u!==-1&&r>u||Nk.test(n.slice(0,r))?n:""}function Vm(n,r){const a=String(n);if(typeof r!="string")throw new TypeError("Expected character");let u=0,c=a.indexOf(r);for(;c!==-1;)u++,c=a.indexOf(r,c+r.length);return u}function Yk(n){if(typeof n!="string")throw new TypeError("Expected a string");return n.replace(/[|\\\\{}()[\\]^$+*?.]/g,"\\\\$&").replace(/-/g,"\\\\x2d")}function Vk(n,r,a){const c=ku((a||{}).ignore||[]),f=Gk(r);let d=-1;for(;++d<f.length;)Ug(n,"text",h);function h(p,v){let g=-1,x;for(;++g<v.length;){const S=v[g],C=x?x.children:void 0;if(c(S,C?C.indexOf(S):void 0,x))return;x=S}if(x)return m(p,v)}function m(p,v){const g=v[v.length-1],x=f[d][0],S=f[d][1];let C=0;const j=g.children.indexOf(p);let _=!1,F=[];x.lastIndex=0;let Y=x.exec(p.value);for(;Y;){const le=Y.index,ue={index:Y.index,input:Y.input,stack:[...v,p]};let N=S(...Y,ue);if(typeof N=="string"&&(N=N.length>0?{type:"text",value:N}:void 0),N===!1?x.lastIndex=le+1:(C!==le&&F.push({type:"text",value:p.value.slice(C,le)}),Array.isArray(N)?F.push(...N):N&&F.push(N),C=le+Y[0].length,_=!0),!x.global)break;Y=x.exec(p.value)}return _?(C<p.value.length&&F.push({type:"text",value:p.value.slice(C)}),g.children.splice(j,1,...F)):F=[p],j+F.length}}function Gk(n){const r=[];if(!Array.isArray(n))throw new TypeError("Expected find and replace tuple or list of tuples");const a=!n[0]||Array.isArray(n[0])?n:[n];let u=-1;for(;++u<a.length;){const c=a[u];r.push([Xk(c[0]),Qk(c[1])])}return r}function Xk(n){return typeof n=="string"?new RegExp(Yk(n),"g"):n}function Qk(n){return typeof n=="function"?n:function(){return n}}const as="phrasing",us=["autolink","link","image","label"];function Ik(){return{transforms:[Pk],enter:{literalAutolink:Fk,literalAutolinkEmail:os,literalAutolinkHttp:os,literalAutolinkWww:os},exit:{literalAutolink:$k,literalAutolinkEmail:Wk,literalAutolinkHttp:Kk,literalAutolinkWww:Jk}}}function Zk(){return{unsafe:[{character:"@",before:"[+\\\\-.\\\\w]",after:"[\\\\-.\\\\w]",inConstruct:as,notInConstruct:us},{character:".",before:"[Ww]",after:"[\\\\-.\\\\w]",inConstruct:as,notInConstruct:us},{character:":",before:"[ps]",after:"\\\\/",inConstruct:as,notInConstruct:us}]}}function Fk(n){this.enter({type:"link",title:null,url:"",children:[]},n)}function os(n){this.config.enter.autolinkProtocol.call(this,n)}function Kk(n){this.config.exit.autolinkProtocol.call(this,n)}function Jk(n){this.config.exit.data.call(this,n);const r=this.stack[this.stack.length-1];r.type,r.url="http://"+this.sliceSerialize(n)}function Wk(n){this.config.exit.autolinkEmail.call(this,n)}function $k(n){this.exit(n)}function Pk(n){Vk(n,[[/(https?:\\/\\/|www(?=\\.))([-.\\w]+)([^ \\t\\r\\n]*)/gi,eE],[/(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)/gu,tE]],{ignore:["link","linkReference"]})}function eE(n,r,a,u,c){let f="";if(!Bg(c)||(/^w/i.test(r)&&(a=r+a,r="",f="http://"),!nE(a)))return!1;const d=lE(a+u);if(!d[0])return!1;const h={type:"link",title:null,url:f+r+d[0],children:[{type:"text",value:r+d[0]}]};return d[1]?[h,{type:"text",value:d[1]}]:h}function tE(n,r,a,u){return!Bg(u,!0)||/[-\\d_]$/.test(a)?!1:{type:"link",title:null,url:"mailto:"+r+"@"+a,children:[{type:"text",value:r+"@"+a}]}}function nE(n){const r=n.split(".");return!(r.length<2||r[r.length-1]&&(/_/.test(r[r.length-1])||!/[a-zA-Z\\d]/.test(r[r.length-1]))||r[r.length-2]&&(/_/.test(r[r.length-2])||!/[a-zA-Z\\d]/.test(r[r.length-2])))}function lE(n){const r=/[!"&\'),.:;<>?\\]}]+$/.exec(n);if(!r)return[n,void 0];n=n.slice(0,r.index);let a=r[0],u=a.indexOf(")");const c=Vm(n,"(");let f=Vm(n,")");for(;u!==-1&&c>f;)n+=a.slice(0,u+1),a=a.slice(u+1),u=a.indexOf(")"),f++;return[n,a]}function Bg(n,r){const a=n.input.charCodeAt(n.index-1);return(n.index===0||ql(a)||bu(a))&&(!r||a!==47)}Hg.peek=dE;function iE(){this.buffer()}function rE(n){this.enter({type:"footnoteReference",identifier:"",label:""},n)}function aE(){this.buffer()}function uE(n){this.enter({type:"footnoteDefinition",identifier:"",label:"",children:[]},n)}function oE(n){const r=this.resume(),a=this.stack[this.stack.length-1];a.type,a.identifier=vn(this.sliceSerialize(n)).toLowerCase(),a.label=r}function cE(n){this.exit(n)}function sE(n){const r=this.resume(),a=this.stack[this.stack.length-1];a.type,a.identifier=vn(this.sliceSerialize(n)).toLowerCase(),a.label=r}function fE(n){this.exit(n)}function dE(){return"["}function Hg(n,r,a,u){const c=a.createTracker(u);let f=c.move("[^");const d=a.enter("footnoteReference"),h=a.enter("reference");return f+=c.move(a.safe(a.associationId(n),{after:"]",before:f})),h(),d(),f+=c.move("]"),f}function hE(){return{enter:{gfmFootnoteCallString:iE,gfmFootnoteCall:rE,gfmFootnoteDefinitionLabelString:aE,gfmFootnoteDefinition:uE},exit:{gfmFootnoteCallString:oE,gfmFootnoteCall:cE,gfmFootnoteDefinitionLabelString:sE,gfmFootnoteDefinition:fE}}}function pE(n){let r=!1;return n&&n.firstLineBlank&&(r=!0),{handlers:{footnoteDefinition:a,footnoteReference:Hg},unsafe:[{character:"[",inConstruct:["label","phrasing","reference"]}]};function a(u,c,f,d){const h=f.createTracker(d);let m=h.move("[^");const p=f.enter("footnoteDefinition"),v=f.enter("label");return m+=h.move(f.safe(f.associationId(u),{before:m,after:"]"})),v(),m+=h.move("]:"),u.children&&u.children.length>0&&(h.shift(4),m+=h.move((r?`\n`:" ")+f.indentLines(f.containerFlow(u,h.current()),r?qg:mE))),p(),m}}function mE(n,r,a){return r===0?n:qg(n,r,a)}function qg(n,r,a){return(a?"":"    ")+n}const gE=["autolink","destinationLiteral","destinationRaw","reference","titleQuote","titleApostrophe"];Yg.peek=SE;function yE(){return{canContainEols:["delete"],enter:{strikethrough:bE},exit:{strikethrough:xE}}}function vE(){return{unsafe:[{character:"~",inConstruct:"phrasing",notInConstruct:gE}],handlers:{delete:Yg}}}function bE(n){this.enter({type:"delete",children:[]},n)}function xE(n){this.exit(n)}function Yg(n,r,a,u){const c=a.createTracker(u),f=a.enter("strikethrough");let d=c.move("~~");return d+=a.containerPhrasing(n,{...c.current(),before:d,after:"~"}),d+=c.move("~~"),f(),d}function SE(){return"~"}function kE(n){return n.length}function EE(n,r){const a=r||{},u=(a.align||[]).concat(),c=a.stringLength||kE,f=[],d=[],h=[],m=[];let p=0,v=-1;for(;++v<n.length;){const B=[],j=[];let _=-1;for(n[v].length>p&&(p=n[v].length);++_<n[v].length;){const F=AE(n[v][_]);if(a.alignDelimiters!==!1){const Y=c(F);j[_]=Y,(m[_]===void 0||Y>m[_])&&(m[_]=Y)}B.push(F)}d[v]=B,h[v]=j}let g=-1;if(typeof u=="object"&&"length"in u)for(;++g<p;)f[g]=Gm(u[g]);else{const B=Gm(u);for(;++g<p;)f[g]=B}g=-1;const x=[],S=[];for(;++g<p;){const B=f[g];let j="",_="";B===99?(j=":",_=":"):B===108?j=":":B===114&&(_=":");let F=a.alignDelimiters===!1?1:Math.max(1,m[g]-j.length-_.length);const Y=j+"-".repeat(F)+_;a.alignDelimiters!==!1&&(F=j.length+F+_.length,F>m[g]&&(m[g]=F),S[g]=F),x[g]=Y}d.splice(1,0,x),h.splice(1,0,S),v=-1;const C=[];for(;++v<d.length;){const B=d[v],j=h[v];g=-1;const _=[];for(;++g<p;){const F=B[g]||"";let Y="",le="";if(a.alignDelimiters!==!1){const ue=m[g]-(j[g]||0),N=f[g];N===114?Y=" ".repeat(ue):N===99?ue%2?(Y=" ".repeat(ue/2+.5),le=" ".repeat(ue/2-.5)):(Y=" ".repeat(ue/2),le=Y):le=" ".repeat(ue)}a.delimiterStart!==!1&&!g&&_.push("|"),a.padding!==!1&&!(a.alignDelimiters===!1&&F==="")&&(a.delimiterStart!==!1||g)&&_.push(" "),a.alignDelimiters!==!1&&_.push(Y),_.push(F),a.alignDelimiters!==!1&&_.push(le),a.padding!==!1&&_.push(" "),(a.delimiterEnd!==!1||g!==p-1)&&_.push("|")}C.push(a.delimiterEnd===!1?_.join("").replace(/ +$/,""):_.join(""))}return C.join(`\n`)}function AE(n){return n==null?"":String(n)}function Gm(n){const r=typeof n=="string"?n.codePointAt(0):0;return r===67||r===99?99:r===76||r===108?108:r===82||r===114?114:0}function wE(n,r,a,u){const c=a.enter("blockquote"),f=a.createTracker(u);f.move("> "),f.shift(2);const d=a.indentLines(a.containerFlow(n,f.current()),TE);return c(),d}function TE(n,r,a){return">"+(a?"":" ")+n}function CE(n,r){return Xm(n,r.inConstruct,!0)&&!Xm(n,r.notInConstruct,!1)}function Xm(n,r,a){if(typeof r=="string"&&(r=[r]),!r||r.length===0)return a;let u=-1;for(;++u<r.length;)if(n.includes(r[u]))return!0;return!1}function Qm(n,r,a,u){let c=-1;for(;++c<a.unsafe.length;)if(a.unsafe[c].character===`\n`&&CE(a.stack,a.unsafe[c]))return/[ \\t]/.test(u.before)?"":" ";return`\\\\\n`}function zE(n,r){const a=String(n);let u=a.indexOf(r),c=u,f=0,d=0;if(typeof r!="string")throw new TypeError("Expected substring");for(;u!==-1;)u===c?++f>d&&(d=f):f=1,c=u+r.length,u=a.indexOf(r,c);return d}function _E(n,r){return!!(r.options.fences===!1&&n.value&&!n.lang&&/[^ \\r\\n]/.test(n.value)&&!/^[\\t ]*(?:[\\r\\n]|$)|(?:^|[\\r\\n])[\\t ]*$/.test(n.value))}function OE(n){const r=n.options.fence||"`";if(r!=="`"&&r!=="~")throw new Error("Cannot serialize code with `"+r+"` for `options.fence`, expected `` ` `` or `~`");return r}function DE(n,r,a,u){const c=OE(a),f=n.value||"",d=c==="`"?"GraveAccent":"Tilde";if(_E(n,a)){const g=a.enter("codeIndented"),x=a.indentLines(f,ME);return g(),x}const h=a.createTracker(u),m=c.repeat(Math.max(zE(f,c)+1,3)),p=a.enter("codeFenced");let v=h.move(m);if(n.lang){const g=a.enter(`codeFencedLang${d}`);v+=h.move(a.safe(n.lang,{before:v,after:" ",encode:["`"],...h.current()})),g()}if(n.lang&&n.meta){const g=a.enter(`codeFencedMeta${d}`);v+=h.move(" "),v+=h.move(a.safe(n.meta,{before:v,after:`\n`,encode:["`"],...h.current()})),g()}return v+=h.move(`\n`),f&&(v+=h.move(f+`\n`)),v+=h.move(m),p(),v}function ME(n,r,a){return(a?"":"    ")+n}function Gs(n){const r=n.options.quote||\'"\';if(r!==\'"\'&&r!=="\'")throw new Error("Cannot serialize title with `"+r+"` for `options.quote`, expected `\\"`, or `\'`");return r}function RE(n,r,a,u){const c=Gs(a),f=c===\'"\'?"Quote":"Apostrophe",d=a.enter("definition");let h=a.enter("label");const m=a.createTracker(u);let p=m.move("[");return p+=m.move(a.safe(a.associationId(n),{before:p,after:"]",...m.current()})),p+=m.move("]: "),h(),!n.url||/[\\0- \\u007F]/.test(n.url)?(h=a.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(a.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(h=a.enter("destinationRaw"),p+=m.move(a.safe(n.url,{before:p,after:n.title?" ":`\n`,...m.current()}))),h(),n.title&&(h=a.enter(`title${f}`),p+=m.move(" "+c),p+=m.move(a.safe(n.title,{before:p,after:c,...m.current()})),p+=m.move(c),h()),d(),p}function NE(n){const r=n.options.emphasis||"*";if(r!=="*"&&r!=="_")throw new Error("Cannot serialize emphasis with `"+r+"` for `options.emphasis`, expected `*`, or `_`");return r}function jr(n){return"&#x"+n.toString(16).toUpperCase()+";"}function yu(n,r,a){const u=Di(n),c=Di(r);return u===void 0?c===void 0?a==="_"?{inside:!0,outside:!0}:{inside:!1,outside:!1}:c===1?{inside:!0,outside:!0}:{inside:!1,outside:!0}:u===1?c===void 0?{inside:!1,outside:!1}:c===1?{inside:!0,outside:!0}:{inside:!1,outside:!1}:c===void 0?{inside:!1,outside:!1}:c===1?{inside:!0,outside:!1}:{inside:!1,outside:!1}}Vg.peek=LE;function Vg(n,r,a,u){const c=NE(a),f=a.enter("emphasis"),d=a.createTracker(u),h=d.move(c);let m=d.move(a.containerPhrasing(n,{after:c,before:h,...d.current()}));const p=m.charCodeAt(0),v=yu(u.before.charCodeAt(u.before.length-1),p,c);v.inside&&(m=jr(p)+m.slice(1));const g=m.charCodeAt(m.length-1),x=yu(u.after.charCodeAt(0),g,c);x.inside&&(m=m.slice(0,-1)+jr(g));const S=d.move(c);return f(),a.attentionEncodeSurroundingInfo={after:x.outside,before:v.outside},h+m+S}function LE(n,r,a){return a.options.emphasis||"*"}function UE(n,r){let a=!1;return Ys(n,function(u){if("value"in u&&/\\r?\\n|\\r/.test(u.value)||u.type==="break")return a=!0,xs}),!!((!n.depth||n.depth<3)&&Ns(n)&&(r.options.setext||a))}function jE(n,r,a,u){const c=Math.max(Math.min(6,n.depth||1),1),f=a.createTracker(u);if(UE(n,a)){const v=a.enter("headingSetext"),g=a.enter("phrasing"),x=a.containerPhrasing(n,{...f.current(),before:`\n`,after:`\n`});return g(),v(),x+`\n`+(c===1?"=":"-").repeat(x.length-(Math.max(x.lastIndexOf("\\r"),x.lastIndexOf(`\n`))+1))}const d="#".repeat(c),h=a.enter("headingAtx"),m=a.enter("phrasing");f.move(d+" ");let p=a.containerPhrasing(n,{before:"# ",after:`\n`,...f.current()});return/^[\\t ]/.test(p)&&(p=jr(p.charCodeAt(0))+p.slice(1)),p=p?d+" "+p:d,a.options.closeAtx&&(p+=" "+d),m(),h(),p}Gg.peek=BE;function Gg(n){return n.value||""}function BE(){return"<"}Xg.peek=HE;function Xg(n,r,a,u){const c=Gs(a),f=c===\'"\'?"Quote":"Apostrophe",d=a.enter("image");let h=a.enter("label");const m=a.createTracker(u);let p=m.move("![");return p+=m.move(a.safe(n.alt,{before:p,after:"]",...m.current()})),p+=m.move("]("),h(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(h=a.enter("destinationLiteral"),p+=m.move("<"),p+=m.move(a.safe(n.url,{before:p,after:">",...m.current()})),p+=m.move(">")):(h=a.enter("destinationRaw"),p+=m.move(a.safe(n.url,{before:p,after:n.title?" ":")",...m.current()}))),h(),n.title&&(h=a.enter(`title${f}`),p+=m.move(" "+c),p+=m.move(a.safe(n.title,{before:p,after:c,...m.current()})),p+=m.move(c),h()),p+=m.move(")"),d(),p}function HE(){return"!"}Qg.peek=qE;function Qg(n,r,a,u){const c=n.referenceType,f=a.enter("imageReference");let d=a.enter("label");const h=a.createTracker(u);let m=h.move("![");const p=a.safe(n.alt,{before:m,after:"]",...h.current()});m+=h.move(p+"]["),d();const v=a.stack;a.stack=[],d=a.enter("reference");const g=a.safe(a.associationId(n),{before:m,after:"]",...h.current()});return d(),a.stack=v,f(),c==="full"||!p||p!==g?m+=h.move(g+"]"):c==="shortcut"?m=m.slice(0,-1):m+=h.move("]"),m}function qE(){return"!"}Ig.peek=YE;function Ig(n,r,a){let u=n.value||"",c="`",f=-1;for(;new RegExp("(^|[^`])"+c+"([^`]|$)").test(u);)c+="`";for(/[^ \\r\\n]/.test(u)&&(/^[ \\r\\n]/.test(u)&&/[ \\r\\n]$/.test(u)||/^`|`$/.test(u))&&(u=" "+u+" ");++f<a.unsafe.length;){const d=a.unsafe[f],h=a.compilePattern(d);let m;if(d.atBreak)for(;m=h.exec(u);){let p=m.index;u.charCodeAt(p)===10&&u.charCodeAt(p-1)===13&&p--,u=u.slice(0,p)+" "+u.slice(m.index+1)}}return c+u+c}function YE(){return"`"}function Zg(n,r){const a=Ns(n);return!!(!r.options.resourceLink&&n.url&&!n.title&&n.children&&n.children.length===1&&n.children[0].type==="text"&&(a===n.url||"mailto:"+a===n.url)&&/^[a-z][a-z+.-]+:/i.test(n.url)&&!/[\\0- <>\\u007F]/.test(n.url))}Fg.peek=VE;function Fg(n,r,a,u){const c=Gs(a),f=c===\'"\'?"Quote":"Apostrophe",d=a.createTracker(u);let h,m;if(Zg(n,a)){const v=a.stack;a.stack=[],h=a.enter("autolink");let g=d.move("<");return g+=d.move(a.containerPhrasing(n,{before:g,after:">",...d.current()})),g+=d.move(">"),h(),a.stack=v,g}h=a.enter("link"),m=a.enter("label");let p=d.move("[");return p+=d.move(a.containerPhrasing(n,{before:p,after:"](",...d.current()})),p+=d.move("]("),m(),!n.url&&n.title||/[\\0- \\u007F]/.test(n.url)?(m=a.enter("destinationLiteral"),p+=d.move("<"),p+=d.move(a.safe(n.url,{before:p,after:">",...d.current()})),p+=d.move(">")):(m=a.enter("destinationRaw"),p+=d.move(a.safe(n.url,{before:p,after:n.title?" ":")",...d.current()}))),m(),n.title&&(m=a.enter(`title${f}`),p+=d.move(" "+c),p+=d.move(a.safe(n.title,{before:p,after:c,...d.current()})),p+=d.move(c),m()),p+=d.move(")"),h(),p}function VE(n,r,a){return Zg(n,a)?"<":"["}Kg.peek=GE;function Kg(n,r,a,u){const c=n.referenceType,f=a.enter("linkReference");let d=a.enter("label");const h=a.createTracker(u);let m=h.move("[");const p=a.containerPhrasing(n,{before:m,after:"]",...h.current()});m+=h.move(p+"]["),d();const v=a.stack;a.stack=[],d=a.enter("reference");const g=a.safe(a.associationId(n),{before:m,after:"]",...h.current()});return d(),a.stack=v,f(),c==="full"||!p||p!==g?m+=h.move(g+"]"):c==="shortcut"?m=m.slice(0,-1):m+=h.move("]"),m}function GE(){return"["}function Xs(n){const r=n.options.bullet||"*";if(r!=="*"&&r!=="+"&&r!=="-")throw new Error("Cannot serialize items with `"+r+"` for `options.bullet`, expected `*`, `+`, or `-`");return r}function XE(n){const r=Xs(n),a=n.options.bulletOther;if(!a)return r==="*"?"-":"*";if(a!=="*"&&a!=="+"&&a!=="-")throw new Error("Cannot serialize items with `"+a+"` for `options.bulletOther`, expected `*`, `+`, or `-`");if(a===r)throw new Error("Expected `bullet` (`"+r+"`) and `bulletOther` (`"+a+"`) to be different");return a}function QE(n){const r=n.options.bulletOrdered||".";if(r!=="."&&r!==")")throw new Error("Cannot serialize items with `"+r+"` for `options.bulletOrdered`, expected `.` or `)`");return r}function Jg(n){const r=n.options.rule||"*";if(r!=="*"&&r!=="-"&&r!=="_")throw new Error("Cannot serialize rules with `"+r+"` for `options.rule`, expected `*`, `-`, or `_`");return r}function IE(n,r,a,u){const c=a.enter("list"),f=a.bulletCurrent;let d=n.ordered?QE(a):Xs(a);const h=n.ordered?d==="."?")":".":XE(a);let m=r&&a.bulletLastUsed?d===a.bulletLastUsed:!1;if(!n.ordered){const v=n.children?n.children[0]:void 0;if((d==="*"||d==="-")&&v&&(!v.children||!v.children[0])&&a.stack[a.stack.length-1]==="list"&&a.stack[a.stack.length-2]==="listItem"&&a.stack[a.stack.length-3]==="list"&&a.stack[a.stack.length-4]==="listItem"&&a.indexStack[a.indexStack.length-1]===0&&a.indexStack[a.indexStack.length-2]===0&&a.indexStack[a.indexStack.length-3]===0&&(m=!0),Jg(a)===d&&v){let g=-1;for(;++g<n.children.length;){const x=n.children[g];if(x&&x.type==="listItem"&&x.children&&x.children[0]&&x.children[0].type==="thematicBreak"){m=!0;break}}}}m&&(d=h),a.bulletCurrent=d;const p=a.containerFlow(n,u);return a.bulletLastUsed=d,a.bulletCurrent=f,c(),p}function ZE(n){const r=n.options.listItemIndent||"one";if(r!=="tab"&&r!=="one"&&r!=="mixed")throw new Error("Cannot serialize items with `"+r+"` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");return r}function FE(n,r,a,u){const c=ZE(a);let f=a.bulletCurrent||Xs(a);r&&r.type==="list"&&r.ordered&&(f=(typeof r.start=="number"&&r.start>-1?r.start:1)+(a.options.incrementListMarker===!1?0:r.children.indexOf(n))+f);let d=f.length+1;(c==="tab"||c==="mixed"&&(r&&r.type==="list"&&r.spread||n.spread))&&(d=Math.ceil(d/4)*4);const h=a.createTracker(u);h.move(f+" ".repeat(d-f.length)),h.shift(d);const m=a.enter("listItem"),p=a.indentLines(a.containerFlow(n,h.current()),v);return m(),p;function v(g,x,S){return x?(S?"":" ".repeat(d))+g:(S?f:f+" ".repeat(d-f.length))+g}}function KE(n,r,a,u){const c=a.enter("paragraph"),f=a.enter("phrasing"),d=a.containerPhrasing(n,u);return f(),c(),d}const JE=ku(["break","delete","emphasis","footnote","footnoteReference","image","imageReference","inlineCode","inlineMath","link","linkReference","mdxJsxTextElement","mdxTextExpression","strong","text","textDirective"]);function WE(n,r,a,u){return(n.children.some(function(d){return JE(d)})?a.containerPhrasing:a.containerFlow).call(a,n,u)}function $E(n){const r=n.options.strong||"*";if(r!=="*"&&r!=="_")throw new Error("Cannot serialize strong with `"+r+"` for `options.strong`, expected `*`, or `_`");return r}Wg.peek=PE;function Wg(n,r,a,u){const c=$E(a),f=a.enter("strong"),d=a.createTracker(u),h=d.move(c+c);let m=d.move(a.containerPhrasing(n,{after:c,before:h,...d.current()}));const p=m.charCodeAt(0),v=yu(u.before.charCodeAt(u.before.length-1),p,c);v.inside&&(m=jr(p)+m.slice(1));const g=m.charCodeAt(m.length-1),x=yu(u.after.charCodeAt(0),g,c);x.inside&&(m=m.slice(0,-1)+jr(g));const S=d.move(c+c);return f(),a.attentionEncodeSurroundingInfo={after:x.outside,before:v.outside},h+m+S}function PE(n,r,a){return a.options.strong||"*"}function eA(n,r,a,u){return a.safe(n.value,u)}function tA(n){const r=n.options.ruleRepetition||3;if(r<3)throw new Error("Cannot serialize rules with repetition `"+r+"` for `options.ruleRepetition`, expected `3` or more");return r}function nA(n,r,a){const u=(Jg(a)+(a.options.ruleSpaces?" ":"")).repeat(tA(a));return a.options.ruleSpaces?u.slice(0,-1):u}const $g={blockquote:wE,break:Qm,code:DE,definition:RE,emphasis:Vg,hardBreak:Qm,heading:jE,html:Gg,image:Xg,imageReference:Qg,inlineCode:Ig,link:Fg,linkReference:Kg,list:IE,listItem:FE,paragraph:KE,root:WE,strong:Wg,text:eA,thematicBreak:nA};function lA(){return{enter:{table:iA,tableData:Im,tableHeader:Im,tableRow:aA},exit:{codeText:uA,table:rA,tableData:cs,tableHeader:cs,tableRow:cs}}}function iA(n){const r=n._align;this.enter({type:"table",align:r.map(function(a){return a==="none"?null:a}),children:[]},n),this.data.inTable=!0}function rA(n){this.exit(n),this.data.inTable=void 0}function aA(n){this.enter({type:"tableRow",children:[]},n)}function cs(n){this.exit(n)}function Im(n){this.enter({type:"tableCell",children:[]},n)}function uA(n){let r=this.resume();this.data.inTable&&(r=r.replace(/\\\\([\\\\|])/g,oA));const a=this.stack[this.stack.length-1];a.type,a.value=r,this.exit(n)}function oA(n,r){return r==="|"?r:n}function cA(n){const r=n||{},a=r.tableCellPadding,u=r.tablePipeAlign,c=r.stringLength,f=a?" ":"|";return{unsafe:[{character:"\\r",inConstruct:"tableCell"},{character:`\n`,inConstruct:"tableCell"},{atBreak:!0,character:"|",after:"[	 :-]"},{character:"|",inConstruct:"tableCell"},{atBreak:!0,character:":",after:"-"},{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{inlineCode:x,table:d,tableCell:m,tableRow:h}};function d(S,C,B,j){return p(v(S,B,j),S.align)}function h(S,C,B,j){const _=g(S,B,j),F=p([_]);return F.slice(0,F.indexOf(`\n`))}function m(S,C,B,j){const _=B.enter("tableCell"),F=B.enter("phrasing"),Y=B.containerPhrasing(S,{...j,before:f,after:f});return F(),_(),Y}function p(S,C){return EE(S,{align:C,alignDelimiters:u,padding:a,stringLength:c})}function v(S,C,B){const j=S.children;let _=-1;const F=[],Y=C.enter("table");for(;++_<j.length;)F[_]=g(j[_],C,B);return Y(),F}function g(S,C,B){const j=S.children;let _=-1;const F=[],Y=C.enter("tableRow");for(;++_<j.length;)F[_]=m(j[_],S,C,B);return Y(),F}function x(S,C,B){let j=$g.inlineCode(S,C,B);return B.stack.includes("tableCell")&&(j=j.replace(/\\|/g,"\\\\$&")),j}}function sA(){return{exit:{taskListCheckValueChecked:Zm,taskListCheckValueUnchecked:Zm,paragraph:dA}}}function fA(){return{unsafe:[{atBreak:!0,character:"-",after:"[:|-]"}],handlers:{listItem:hA}}}function Zm(n){const r=this.stack[this.stack.length-2];r.type,r.checked=n.type==="taskListCheckValueChecked"}function dA(n){const r=this.stack[this.stack.length-2];if(r&&r.type==="listItem"&&typeof r.checked=="boolean"){const a=this.stack[this.stack.length-1];a.type;const u=a.children[0];if(u&&u.type==="text"){const c=r.children;let f=-1,d;for(;++f<c.length;){const h=c[f];if(h.type==="paragraph"){d=h;break}}d===a&&(u.value=u.value.slice(1),u.value.length===0?a.children.shift():a.position&&u.position&&typeof u.position.start.offset=="number"&&(u.position.start.column++,u.position.start.offset++,a.position.start=Object.assign({},u.position.start)))}}this.exit(n)}function hA(n,r,a,u){const c=n.children[0],f=typeof n.checked=="boolean"&&c&&c.type==="paragraph",d="["+(n.checked?"x":" ")+"] ",h=a.createTracker(u);f&&h.move(d);let m=$g.listItem(n,r,a,{...u,...h.current()});return f&&(m=m.replace(/^(?:[*+-]|\\d+\\.)([\\r\\n]| {1,3})/,p)),m;function p(v){return v+d}}function pA(){return[Ik(),hE(),yE(),lA(),sA()]}function mA(n){return{extensions:[Zk(),pE(n),vE(),cA(n),fA()]}}const gA={tokenize:kA,partial:!0},Pg={tokenize:EA,partial:!0},ey={tokenize:AA,partial:!0},ty={tokenize:wA,partial:!0},yA={tokenize:TA,partial:!0},ny={name:"wwwAutolink",tokenize:xA,previous:iy},ly={name:"protocolAutolink",tokenize:SA,previous:ry},In={name:"emailAutolink",tokenize:bA,previous:ay},Tn={};function vA(){return{text:Tn}}let Bl=48;for(;Bl<123;)Tn[Bl]=In,Bl++,Bl===58?Bl=65:Bl===91&&(Bl=97);Tn[43]=In;Tn[45]=In;Tn[46]=In;Tn[95]=In;Tn[72]=[In,ly];Tn[104]=[In,ly];Tn[87]=[In,ny];Tn[119]=[In,ny];function bA(n,r,a){const u=this;let c,f;return d;function d(g){return!As(g)||!ay.call(u,u.previous)||Qs(u.events)?a(g):(n.enter("literalAutolink"),n.enter("literalAutolinkEmail"),h(g))}function h(g){return As(g)?(n.consume(g),h):g===64?(n.consume(g),m):a(g)}function m(g){return g===46?n.check(yA,v,p)(g):g===45||g===95||zt(g)?(f=!0,n.consume(g),m):v(g)}function p(g){return n.consume(g),c=!0,m}function v(g){return f&&c&&Rt(u.previous)?(n.exit("literalAutolinkEmail"),n.exit("literalAutolink"),r(g)):a(g)}}function xA(n,r,a){const u=this;return c;function c(d){return d!==87&&d!==119||!iy.call(u,u.previous)||Qs(u.events)?a(d):(n.enter("literalAutolink"),n.enter("literalAutolinkWww"),n.check(gA,n.attempt(Pg,n.attempt(ey,f),a),a)(d))}function f(d){return n.exit("literalAutolinkWww"),n.exit("literalAutolink"),r(d)}}function SA(n,r,a){const u=this;let c="",f=!1;return d;function d(g){return(g===72||g===104)&&ry.call(u,u.previous)&&!Qs(u.events)?(n.enter("literalAutolink"),n.enter("literalAutolinkHttp"),c+=String.fromCodePoint(g),n.consume(g),h):a(g)}function h(g){if(Rt(g)&&c.length<5)return c+=String.fromCodePoint(g),n.consume(g),h;if(g===58){const x=c.toLowerCase();if(x==="http"||x==="https")return n.consume(g),m}return a(g)}function m(g){return g===47?(n.consume(g),f?p:(f=!0,m)):a(g)}function p(g){return g===null||pu(g)||Pe(g)||ql(g)||bu(g)?a(g):n.attempt(Pg,n.attempt(ey,v),a)(g)}function v(g){return n.exit("literalAutolinkHttp"),n.exit("literalAutolink"),r(g)}}function kA(n,r,a){let u=0;return c;function c(d){return(d===87||d===119)&&u<3?(u++,n.consume(d),c):d===46&&u===3?(n.consume(d),f):a(d)}function f(d){return d===null?a(d):r(d)}}function EA(n,r,a){let u,c,f;return d;function d(p){return p===46||p===95?n.check(ty,m,h)(p):p===null||Pe(p)||ql(p)||p!==45&&bu(p)?m(p):(f=!0,n.consume(p),d)}function h(p){return p===95?u=!0:(c=u,u=void 0),n.consume(p),d}function m(p){return c||u||!f?a(p):r(p)}}function AA(n,r){let a=0,u=0;return c;function c(d){return d===40?(a++,n.consume(d),c):d===41&&u<a?f(d):d===33||d===34||d===38||d===39||d===41||d===42||d===44||d===46||d===58||d===59||d===60||d===63||d===93||d===95||d===126?n.check(ty,r,f)(d):d===null||Pe(d)||ql(d)?r(d):(n.consume(d),c)}function f(d){return d===41&&u++,n.consume(d),c}}function wA(n,r,a){return u;function u(h){return h===33||h===34||h===39||h===41||h===42||h===44||h===46||h===58||h===59||h===63||h===95||h===126?(n.consume(h),u):h===38?(n.consume(h),f):h===93?(n.consume(h),c):h===60||h===null||Pe(h)||ql(h)?r(h):a(h)}function c(h){return h===null||h===40||h===91||Pe(h)||ql(h)?r(h):u(h)}function f(h){return Rt(h)?d(h):a(h)}function d(h){return h===59?(n.consume(h),u):Rt(h)?(n.consume(h),d):a(h)}}function TA(n,r,a){return u;function u(f){return n.consume(f),c}function c(f){return zt(f)?a(f):r(f)}}function iy(n){return n===null||n===40||n===42||n===95||n===91||n===93||n===126||Pe(n)}function ry(n){return!Rt(n)}function ay(n){return!(n===47||As(n))}function As(n){return n===43||n===45||n===46||n===95||zt(n)}function Qs(n){let r=n.length,a=!1;for(;r--;){const u=n[r][1];if((u.type==="labelLink"||u.type==="labelImage")&&!u._balanced){a=!0;break}if(u._gfmAutolinkLiteralWalkedInto){a=!1;break}}return n.length>0&&!a&&(n[n.length-1][1]._gfmAutolinkLiteralWalkedInto=!0),a}const CA={tokenize:LA,partial:!0};function zA(){return{document:{91:{name:"gfmFootnoteDefinition",tokenize:MA,continuation:{tokenize:RA},exit:NA}},text:{91:{name:"gfmFootnoteCall",tokenize:DA},93:{name:"gfmPotentialFootnoteCall",add:"after",tokenize:_A,resolveTo:OA}}}}function _A(n,r,a){const u=this;let c=u.events.length;const f=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let d;for(;c--;){const m=u.events[c][1];if(m.type==="labelImage"){d=m;break}if(m.type==="gfmFootnoteCall"||m.type==="labelLink"||m.type==="label"||m.type==="image"||m.type==="link")break}return h;function h(m){if(!d||!d._balanced)return a(m);const p=vn(u.sliceSerialize({start:d.end,end:u.now()}));return p.codePointAt(0)!==94||!f.includes(p.slice(1))?a(m):(n.enter("gfmFootnoteCallLabelMarker"),n.consume(m),n.exit("gfmFootnoteCallLabelMarker"),r(m))}}function OA(n,r){let a=n.length;for(;a--;)if(n[a][1].type==="labelImage"&&n[a][0]==="enter"){n[a][1];break}n[a+1][1].type="data",n[a+3][1].type="gfmFootnoteCallLabelMarker";const u={type:"gfmFootnoteCall",start:Object.assign({},n[a+3][1].start),end:Object.assign({},n[n.length-1][1].end)},c={type:"gfmFootnoteCallMarker",start:Object.assign({},n[a+3][1].end),end:Object.assign({},n[a+3][1].end)};c.end.column++,c.end.offset++,c.end._bufferIndex++;const f={type:"gfmFootnoteCallString",start:Object.assign({},c.end),end:Object.assign({},n[n.length-1][1].start)},d={type:"chunkString",contentType:"string",start:Object.assign({},f.start),end:Object.assign({},f.end)},h=[n[a+1],n[a+2],["enter",u,r],n[a+3],n[a+4],["enter",c,r],["exit",c,r],["enter",f,r],["enter",d,r],["exit",d,r],["exit",f,r],n[n.length-2],n[n.length-1],["exit",u,r]];return n.splice(a,n.length-a+1,...h),n}function DA(n,r,a){const u=this,c=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f=0,d;return h;function h(g){return n.enter("gfmFootnoteCall"),n.enter("gfmFootnoteCallLabelMarker"),n.consume(g),n.exit("gfmFootnoteCallLabelMarker"),m}function m(g){return g!==94?a(g):(n.enter("gfmFootnoteCallMarker"),n.consume(g),n.exit("gfmFootnoteCallMarker"),n.enter("gfmFootnoteCallString"),n.enter("chunkString").contentType="string",p)}function p(g){if(f>999||g===93&&!d||g===null||g===91||Pe(g))return a(g);if(g===93){n.exit("chunkString");const x=n.exit("gfmFootnoteCallString");return c.includes(vn(u.sliceSerialize(x)))?(n.enter("gfmFootnoteCallLabelMarker"),n.consume(g),n.exit("gfmFootnoteCallLabelMarker"),n.exit("gfmFootnoteCall"),r):a(g)}return Pe(g)||(d=!0),f++,n.consume(g),g===92?v:p}function v(g){return g===91||g===92||g===93?(n.consume(g),f++,p):p(g)}}function MA(n,r,a){const u=this,c=u.parser.gfmFootnotes||(u.parser.gfmFootnotes=[]);let f,d=0,h;return m;function m(C){return n.enter("gfmFootnoteDefinition")._container=!0,n.enter("gfmFootnoteDefinitionLabel"),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),p}function p(C){return C===94?(n.enter("gfmFootnoteDefinitionMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionMarker"),n.enter("gfmFootnoteDefinitionLabelString"),n.enter("chunkString").contentType="string",v):a(C)}function v(C){if(d>999||C===93&&!h||C===null||C===91||Pe(C))return a(C);if(C===93){n.exit("chunkString");const B=n.exit("gfmFootnoteDefinitionLabelString");return f=vn(u.sliceSerialize(B)),n.enter("gfmFootnoteDefinitionLabelMarker"),n.consume(C),n.exit("gfmFootnoteDefinitionLabelMarker"),n.exit("gfmFootnoteDefinitionLabel"),x}return Pe(C)||(h=!0),d++,n.consume(C),C===92?g:v}function g(C){return C===91||C===92||C===93?(n.consume(C),d++,v):v(C)}function x(C){return C===58?(n.enter("definitionMarker"),n.consume(C),n.exit("definitionMarker"),c.includes(f)||c.push(f),Be(n,S,"gfmFootnoteDefinitionWhitespace")):a(C)}function S(C){return r(C)}}function RA(n,r,a){return n.check(Hr,r,n.attempt(CA,r,a))}function NA(n){n.exit("gfmFootnoteDefinition")}function LA(n,r,a){const u=this;return Be(n,c,"gfmFootnoteDefinitionIndent",5);function c(f){const d=u.events[u.events.length-1];return d&&d[1].type==="gfmFootnoteDefinitionIndent"&&d[2].sliceSerialize(d[1],!0).length===4?r(f):a(f)}}function UA(n){let a=(n||{}).singleTilde;const u={name:"strikethrough",tokenize:f,resolveAll:c};return a==null&&(a=!0),{text:{126:u},insideSpan:{null:[u]},attentionMarkers:{null:[126]}};function c(d,h){let m=-1;for(;++m<d.length;)if(d[m][0]==="enter"&&d[m][1].type==="strikethroughSequenceTemporary"&&d[m][1]._close){let p=m;for(;p--;)if(d[p][0]==="exit"&&d[p][1].type==="strikethroughSequenceTemporary"&&d[p][1]._open&&d[m][1].end.offset-d[m][1].start.offset===d[p][1].end.offset-d[p][1].start.offset){d[m][1].type="strikethroughSequence",d[p][1].type="strikethroughSequence";const v={type:"strikethrough",start:Object.assign({},d[p][1].start),end:Object.assign({},d[m][1].end)},g={type:"strikethroughText",start:Object.assign({},d[p][1].end),end:Object.assign({},d[m][1].start)},x=[["enter",v,h],["enter",d[p][1],h],["exit",d[p][1],h],["enter",g,h]],S=h.parser.constructs.insideSpan.null;S&&Pt(x,x.length,0,xu(S,d.slice(p+1,m),h)),Pt(x,x.length,0,[["exit",g,h],["enter",d[m][1],h],["exit",d[m][1],h],["exit",v,h]]),Pt(d,p-1,m-p+3,x),m=p+x.length-2;break}}for(m=-1;++m<d.length;)d[m][1].type==="strikethroughSequenceTemporary"&&(d[m][1].type="data");return d}function f(d,h,m){const p=this.previous,v=this.events;let g=0;return x;function x(C){return p===126&&v[v.length-1][1].type!=="characterEscape"?m(C):(d.enter("strikethroughSequenceTemporary"),S(C))}function S(C){const B=Di(p);if(C===126)return g>1?m(C):(d.consume(C),g++,S);if(g<2&&!a)return m(C);const j=d.exit("strikethroughSequenceTemporary"),_=Di(C);return j._open=!_||_===2&&!!B,j._close=!B||B===2&&!!_,h(C)}}}class jA{constructor(){this.map=[]}add(r,a,u){BA(this,r,a,u)}consume(r){if(this.map.sort(function(f,d){return f[0]-d[0]}),this.map.length===0)return;let a=this.map.length;const u=[];for(;a>0;)a-=1,u.push(r.slice(this.map[a][0]+this.map[a][1]),this.map[a][2]),r.length=this.map[a][0];u.push(r.slice()),r.length=0;let c=u.pop();for(;c;){for(const f of c)r.push(f);c=u.pop()}this.map.length=0}}function BA(n,r,a,u){let c=0;if(!(a===0&&u.length===0)){for(;c<n.map.length;){if(n.map[c][0]===r){n.map[c][1]+=a,n.map[c][2].push(...u);return}c+=1}n.map.push([r,a,u])}}function HA(n,r){let a=!1;const u=[];for(;r<n.length;){const c=n[r];if(a){if(c[0]==="enter")c[1].type==="tableContent"&&u.push(n[r+1][1].type==="tableDelimiterMarker"?"left":"none");else if(c[1].type==="tableContent"){if(n[r-1][1].type==="tableDelimiterMarker"){const f=u.length-1;u[f]=u[f]==="left"?"center":"right"}}else if(c[1].type==="tableDelimiterRow")break}else c[0]==="enter"&&c[1].type==="tableDelimiterRow"&&(a=!0);r+=1}return u}function qA(){return{flow:{null:{name:"table",tokenize:YA,resolveAll:VA}}}}function YA(n,r,a){const u=this;let c=0,f=0,d;return h;function h(L){let ie=u.events.length-1;for(;ie>-1;){const re=u.events[ie][1].type;if(re==="lineEnding"||re==="linePrefix")ie--;else break}const ee=ie>-1?u.events[ie][1].type:null,ke=ee==="tableHead"||ee==="tableRow"?N:m;return ke===N&&u.parser.lazy[u.now().line]?a(L):ke(L)}function m(L){return n.enter("tableHead"),n.enter("tableRow"),p(L)}function p(L){return L===124||(d=!0,f+=1),v(L)}function v(L){return L===null?a(L):be(L)?f>1?(f=0,u.interrupt=!0,n.exit("tableRow"),n.enter("lineEnding"),n.consume(L),n.exit("lineEnding"),S):a(L):Ne(L)?Be(n,v,"whitespace")(L):(f+=1,d&&(d=!1,c+=1),L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),d=!0,v):(n.enter("data"),g(L)))}function g(L){return L===null||L===124||Pe(L)?(n.exit("data"),v(L)):(n.consume(L),L===92?x:g)}function x(L){return L===92||L===124?(n.consume(L),g):g(L)}function S(L){return u.interrupt=!1,u.parser.lazy[u.now().line]?a(L):(n.enter("tableDelimiterRow"),d=!1,Ne(L)?Be(n,C,"linePrefix",u.parser.constructs.disable.null.includes("codeIndented")?void 0:4)(L):C(L))}function C(L){return L===45||L===58?j(L):L===124?(d=!0,n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),B):ue(L)}function B(L){return Ne(L)?Be(n,j,"whitespace")(L):j(L)}function j(L){return L===58?(f+=1,d=!0,n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),_):L===45?(f+=1,_(L)):L===null||be(L)?le(L):ue(L)}function _(L){return L===45?(n.enter("tableDelimiterFiller"),F(L)):ue(L)}function F(L){return L===45?(n.consume(L),F):L===58?(d=!0,n.exit("tableDelimiterFiller"),n.enter("tableDelimiterMarker"),n.consume(L),n.exit("tableDelimiterMarker"),Y):(n.exit("tableDelimiterFiller"),Y(L))}function Y(L){return Ne(L)?Be(n,le,"whitespace")(L):le(L)}function le(L){return L===124?C(L):L===null||be(L)?!d||c!==f?ue(L):(n.exit("tableDelimiterRow"),n.exit("tableHead"),r(L)):ue(L)}function ue(L){return a(L)}function N(L){return n.enter("tableRow"),$(L)}function $(L){return L===124?(n.enter("tableCellDivider"),n.consume(L),n.exit("tableCellDivider"),$):L===null||be(L)?(n.exit("tableRow"),r(L)):Ne(L)?Be(n,$,"whitespace")(L):(n.enter("data"),he(L))}function he(L){return L===null||L===124||Pe(L)?(n.exit("data"),$(L)):(n.consume(L),L===92?Se:he)}function Se(L){return L===92||L===124?(n.consume(L),he):he(L)}}function VA(n,r){let a=-1,u=!0,c=0,f=[0,0,0,0],d=[0,0,0,0],h=!1,m=0,p,v,g;const x=new jA;for(;++a<n.length;){const S=n[a],C=S[1];S[0]==="enter"?C.type==="tableHead"?(h=!1,m!==0&&(Fm(x,r,m,p,v),v=void 0,m=0),p={type:"table",start:Object.assign({},C.start),end:Object.assign({},C.end)},x.add(a,0,[["enter",p,r]])):C.type==="tableRow"||C.type==="tableDelimiterRow"?(u=!0,g=void 0,f=[0,0,0,0],d=[0,a+1,0,0],h&&(h=!1,v={type:"tableBody",start:Object.assign({},C.start),end:Object.assign({},C.end)},x.add(a,0,[["enter",v,r]])),c=C.type==="tableDelimiterRow"?2:v?3:1):c&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")?(u=!1,d[2]===0&&(f[1]!==0&&(d[0]=d[1],g=uu(x,r,f,c,void 0,g),f=[0,0,0,0]),d[2]=a)):C.type==="tableCellDivider"&&(u?u=!1:(f[1]!==0&&(d[0]=d[1],g=uu(x,r,f,c,void 0,g)),f=d,d=[f[1],a,0,0])):C.type==="tableHead"?(h=!0,m=a):C.type==="tableRow"||C.type==="tableDelimiterRow"?(m=a,f[1]!==0?(d[0]=d[1],g=uu(x,r,f,c,a,g)):d[1]!==0&&(g=uu(x,r,d,c,a,g)),c=0):c&&(C.type==="data"||C.type==="tableDelimiterMarker"||C.type==="tableDelimiterFiller")&&(d[3]=a)}for(m!==0&&Fm(x,r,m,p,v),x.consume(r.events),a=-1;++a<r.events.length;){const S=r.events[a];S[0]==="enter"&&S[1].type==="table"&&(S[1]._align=HA(r.events,a))}return n}function uu(n,r,a,u,c,f){const d=u===1?"tableHeader":u===2?"tableDelimiter":"tableData",h="tableContent";a[0]!==0&&(f.end=Object.assign({},zi(r.events,a[0])),n.add(a[0],0,[["exit",f,r]]));const m=zi(r.events,a[1]);if(f={type:d,start:Object.assign({},m),end:Object.assign({},m)},n.add(a[1],0,[["enter",f,r]]),a[2]!==0){const p=zi(r.events,a[2]),v=zi(r.events,a[3]),g={type:h,start:Object.assign({},p),end:Object.assign({},v)};if(n.add(a[2],0,[["enter",g,r]]),u!==2){const x=r.events[a[2]],S=r.events[a[3]];if(x[1].end=Object.assign({},S[1].end),x[1].type="chunkText",x[1].contentType="text",a[3]>a[2]+1){const C=a[2]+1,B=a[3]-a[2]-1;n.add(C,B,[])}}n.add(a[3]+1,0,[["exit",g,r]])}return c!==void 0&&(f.end=Object.assign({},zi(r.events,c)),n.add(c,0,[["exit",f,r]]),f=void 0),f}function Fm(n,r,a,u,c){const f=[],d=zi(r.events,a);c&&(c.end=Object.assign({},d),f.push(["exit",c,r])),u.end=Object.assign({},d),f.push(["exit",u,r]),n.add(a+1,0,f)}function zi(n,r){const a=n[r],u=a[0]==="enter"?"start":"end";return a[1][u]}const GA={name:"tasklistCheck",tokenize:QA};function XA(){return{text:{91:GA}}}function QA(n,r,a){const u=this;return c;function c(m){return u.previous!==null||!u._gfmTasklistFirstContentOfListItem?a(m):(n.enter("taskListCheck"),n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),f)}function f(m){return Pe(m)?(n.enter("taskListCheckValueUnchecked"),n.consume(m),n.exit("taskListCheckValueUnchecked"),d):m===88||m===120?(n.enter("taskListCheckValueChecked"),n.consume(m),n.exit("taskListCheckValueChecked"),d):a(m)}function d(m){return m===93?(n.enter("taskListCheckMarker"),n.consume(m),n.exit("taskListCheckMarker"),n.exit("taskListCheck"),h):a(m)}function h(m){return be(m)?r(m):Ne(m)?n.check({tokenize:IA},r,a)(m):a(m)}}function IA(n,r,a){return Be(n,u,"whitespace");function u(c){return c===null?a(c):r(c)}}function ZA(n){return yg([vA(),zA(),UA(n),qA(),XA()])}const FA={};function KA(n){const r=this,a=n||FA,u=r.data(),c=u.micromarkExtensions||(u.micromarkExtensions=[]),f=u.fromMarkdownExtensions||(u.fromMarkdownExtensions=[]),d=u.toMarkdownExtensions||(u.toMarkdownExtensions=[]);c.push(ZA(a)),f.push(pA()),d.push(mA(a))}function JA(){const n=Tt(c=>c.ui.modal==="instructions"),r=Tt(c=>c.conversation.instructions),a=ve.useRef(null),u=ve.useRef(null);return ve.useEffect(()=>{if(n)return u.current=document.activeElement,a.current?.focus(),()=>{u.current?.focus()}},[n]),n?I.jsx("div",{className:"modal-backdrop",onClick:()=>bt({type:"ui/click/modal-backdrop"}),children:I.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"instructions-title",tabIndex:-1,ref:a,onClick:c=>c.stopPropagation(),children:[I.jsxs("div",{className:"modal-header",children:[I.jsx("span",{className:"modal-title",id:"instructions-title",children:"Instructions"}),I.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>bt({type:"ui/click/modal-close"}),children:I.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),I.jsx("div",{className:"modal-body instructions-body",children:r===void 0?I.jsx("p",{className:"loading-state",children:"Loading instructions\u2026"}):I.jsx(Uk,{remarkPlugins:[KA],disallowedElements:["script","iframe","object","embed"],unwrapDisallowed:!0,children:r})})]})}):null}function ou({item:n,speakingItemId:r,forceSpeaking:a=!1}){const u=a||n.role==="user"&&n.id===r,c=["transcript-item",`role-${n.role}`,`source-${n.source}`,n.streaming?"streaming":"",u?"speaking":""].filter(Boolean).join(" ");return I.jsx("article",{className:c,children:n.text})}function WA({tool:n}){const[r,a]=ve.useState(!1),u=()=>a(f=>!f),c=n.status==="completed"?n.result:n.status==="failed"||n.status==="interrupted"?n.error:null;return I.jsxs("article",{className:"tool-call",tabIndex:0,onClick:u,onKeyDown:f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),u())},children:[I.jsxs("div",{className:"tool-row",children:[I.jsx("span",{className:"toggle",children:r?"\u25BE":"\u25B8"}),I.jsxs("span",{children:["Tool: ",n.toolName,"(...)"]}),I.jsx("span",{className:`badge ${n.status}`,children:n.status})]}),r?I.jsxs("div",{className:"tool-call-body",children:[I.jsx("div",{className:"section-label",children:"ARGUMENTS"}),I.jsx("pre",{children:JSON.stringify(n.arguments,null,2)}),I.jsx("div",{className:"section-label",children:"RESULT"}),I.jsx("pre",{children:JSON.stringify(c,null,2)})]}):null]})}function $A(){const{conversation:n,streamDrafts:r,speakingItemId:a,pendingUserItemId:u,responseActive:c}=Tt(vu(g=>({conversation:g.conversation.conversation,streamDrafts:g.conversation.streamDrafts,speakingItemId:g.voice.speakingItemId,pendingUserItemId:g.voice.pendingUserItemId,responseActive:g.voice.responseActive})));if(n===null)return I.jsxs("div",{className:"empty-state",children:[I.jsx("svg",{className:"empty-icon",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",children:I.jsx("path",{d:"M12 2v20M5 8v8M19 8v8"})}),I.jsx("div",{children:"Ready to start"})]});if(n.status==="ended")return I.jsxs("div",{className:"ended-state",children:[I.jsx("strong",{children:"Conversation ended"}),I.jsx("span",{children:"Transcript is no longer active."})]});const f=n,d=new Map(f.transcript.map(g=>[g.id,g])),h=new Map(f.toolCalls.map(g=>[g.id,g])),m=[];for(const g of f.timeline)if(g.type==="transcript"){const x=d.get(g.transcriptItemId);x!==void 0&&m.push(I.jsx(ou,{item:{id:x.id,role:x.role,source:x.source,text:x.text,streaming:!1},speakingItemId:a},`t-${x.id}`))}else{const x=h.get(g.toolCallId);x!==void 0&&m.push(I.jsx(WA,{tool:x},`c-${x.id}`))}let p=!1;for(const g of r.values())if(!d.has(g.itemId)&&g.itemId===u){p=!0;break}u!==null&&!p&&!d.has(u)&&m.push(I.jsx(ou,{item:{id:u,role:"user",source:"microphone",text:"",streaming:!1},speakingItemId:a,forceSpeaking:!0},`pending-${u}`));let v=!1;for(const g of r.values())d.has(g.itemId)||(g.role==="assistant"&&(v=!0),m.push(I.jsx(ou,{item:{id:g.itemId,role:g.role,source:g.source,text:g.fullTextSoFar,streaming:!0},speakingItemId:a},`d-${g.itemId}`)));return c&&!v&&m.push(I.jsx(ou,{item:{id:"pending-assistant",role:"assistant",source:"assistantAudio",text:"",streaming:!1},speakingItemId:a,forceSpeaking:!0},"pending-assistant")),I.jsx(I.Fragment,{children:m})}function PA(){const n=Tt(m=>m.ui.modal==="transcript"),r=Tt(m=>m.conversation.atBottom),a=Tt(m=>m.conversation.conversation?.transcript),u=Tt(m=>m.conversation.streamDrafts),c=ve.useRef(null),f=ve.useRef(null),d=ve.useRef(null);if(ve.useEffect(()=>{if(n)return d.current=document.activeElement,c.current?.focus(),()=>{d.current?.focus()}},[n]),ve.useEffect(()=>{n&&r&&f.current!==null&&(f.current.scrollTop=f.current.scrollHeight)},[n,r,a,u]),!n)return null;const h=m=>{if(m.key!=="Tab")return;const p=c.current;if(p===null)return;const v=p.querySelectorAll(\'button, [href], select, textarea, [tabindex]:not([tabindex="-1"])\');if(v.length===0)return;const g=v[0],x=v[v.length-1];g===void 0||x===void 0||(m.shiftKey&&document.activeElement===g?(m.preventDefault(),x.focus()):!m.shiftKey&&document.activeElement===x&&(m.preventDefault(),g.focus()))};return I.jsx("div",{className:"modal-backdrop",onClick:()=>bt({type:"ui/click/modal-backdrop"}),children:I.jsxs("div",{className:"modal",role:"dialog","aria-modal":"true","aria-labelledby":"transcript-title",tabIndex:-1,ref:c,onClick:m=>m.stopPropagation(),onKeyDown:h,children:[I.jsxs("div",{className:"modal-header",children:[I.jsx("span",{className:"modal-title",id:"transcript-title",children:"Conversation"}),I.jsx("button",{className:"modal-close",type:"button","aria-label":"Close",onClick:()=>bt({type:"ui/click/modal-close"}),children:I.jsx("span",{className:"codicon codicon-close","aria-hidden":"true"})})]}),I.jsx("div",{className:"modal-body",ref:f,onScroll:m=>{const p=m.currentTarget;bt({type:"ui/scroll/transcript",atBottom:p.scrollHeight-p.scrollTop-p.clientHeight<80})},children:I.jsx($A,{})})]})})}var Km=()=>typeof window>"u"?null:window.SpeechRecognition||window.webkitSpeechRecognition||null,e2=()=>{if(typeof window>"u")return null;try{const n=new AudioContext,r=n.createOscillator(),a=n.createGain();return a.gain.value=.001,r.frequency.value=20,r.connect(a),a.connect(n.destination),r.start(),{context:n,oscillator:r,gain:a}}catch{return null}},Jm=n=>{try{n.oscillator.stop(),n.oscillator.disconnect(),n.gain.disconnect(),n.context.close()}catch{}},Wm=(n,r)=>n.map(a=>typeof a=="string"?{word:a,language:r}:a),t2=n=>[...new Set(n.map(r=>r.language))],$m=async()=>{if(typeof navigator>"u"||!("wakeLock"in navigator))return null;try{return await navigator.wakeLock.request("screen")}catch{return null}},Pm=async n=>{if(n)try{await n.release()}catch{}},n2=n=>n.replace(/\\s+/g,"").normalize("NFKC").replace(/[\u30A1-\u30F6]/g,r=>String.fromCharCode(r.charCodeAt(0)-96)).replace(/\u3092/g,"\u304A"),eg=(n,r)=>{const a=n.length,u=r.length;if(a===0)return u;if(u===0)return a;let c=new Array(u+1),f=new Array(u+1);for(let d=0;d<=u;d++)c[d]=d;for(let d=1;d<=a;d++){f[0]=d;for(let h=1;h<=u;h++){const m=n[d-1]===r[h-1]?0:1;f[h]=Math.min(c[h]+1,f[h-1]+1,c[h-1]+m)}[c,f]=[f,c]}return c[u]},l2=(n,r,a)=>{if(n.includes(r))return!0;const u=r.length;if(u===0)return!1;const c=u<=3?Math.max(a,.9):a;if(n.length<u)return 1-eg(n,r)/u>=c;const f=Math.max(1,u-1),d=u+1;for(let h=f;h<=d;h++)if(!(n.length<h))for(let m=0;m<=n.length-h;m++){const p=n.slice(m,m+h);if(1-eg(p,r)/Math.max(p.length,u)>=c)return!0}return!1};function i2(n){const{wakeWords:r,onWakeWord:a,stopWords:u=[],onStopWord:c,continuous:f=!0,language:d="ja-JP",caseSensitive:h=!1,keepAlive:m=!0,screenLock:p=!1,maxAlternatives:v=3,normalize:g=!0,similarityThreshold:x,onTranscript:S}=n,[C,B]=ve.useState(!1),[j,_]=ve.useState(!1),[F,Y]=ve.useState(null),[le,ue]=ve.useState(""),N=ve.useRef(null),$=ve.useRef(null),he=ve.useRef(null),Se=ve.useRef(a),L=ve.useRef(c),ie=ve.useRef(S),ee=ve.useRef(0),ke=ve.useRef(!1),re=ve.useRef(new Set),W=ve.useRef(-1),D=Wm(r,d),K=Wm(u,d),ce=[...D,...K],we=t2(ce),E=ve.useRef(D),w=ve.useRef(K),H=ve.useRef(we);ve.useEffect(()=>{Se.current=a,L.current=c,ie.current=S,E.current=D,w.current=K,H.current=we},[a,c,S,D,K,we]),ve.useEffect(()=>{_(!0)},[]);const k=j&&Km()!==null,te=ve.useRef(()=>{}),me=ve.useCallback(ae=>{let pe=h?ae:ae.toLowerCase();return g&&(pe=n2(pe)),pe},[h,g]),fe=ve.useCallback((ae,pe)=>typeof x=="number"&&x>0&&x<=1?l2(ae,pe,x):ae.includes(pe),[x]),Ae=ve.useCallback((ae,pe)=>{for(const oe of w.current){const ye=me(oe.word),Ce=`stop:${pe}:${ye}`;if(!re.current.has(Ce)){for(const He of ae)if(fe(me(He),ye))return re.current.add(Ce),L.current?.(oe.word,He),te.current(),!0}}return!1},[me,fe]),Qe=ve.useCallback((ae,pe)=>{if(Ae(ae,pe))return!1;for(const oe of E.current){const ye=me(oe.word),Ce=`wake:${pe}:${ye}`;if(!re.current.has(Ce)){for(const He of ae)if(fe(me(He),ye))return re.current.add(Ce),Se.current(oe.word,He),!0}}return!1},[me,Ae,fe]),X=ve.useCallback(ae=>{const pe=Km();if(!pe){Y(new Error("SpeechRecognition is not supported in this browser"));return}N.current&&N.current.stop();const oe=new pe;oe.continuous=f,oe.interimResults=!0,oe.lang=ae,oe.maxAlternatives=Math.max(1,v),oe.onstart=()=>{B(!0),Y(null)},oe.onresult=ye=>{const Ce=ye.resultIndex,He=ye.results[Ce];if(He){const en=[];for(let et=0;et<He.length;et++){const ct=He[et];ct?.transcript&&en.push(ct.transcript)}const tn=en[0]??"";ue(tn),ie.current&&ie.current(tn,{alternatives:en.slice(1),isFinal:He.isFinal}),(He.isFinal||Ce>W.current)&&(Qe(en,Ce),He.isFinal&&(W.current=Ce))}},oe.onerror=ye=>{Y(new Error(`Speech recognition error: ${ye.error}`)),B(!1)},oe.onend=()=>{if(ke.current&&f){ee.current=(ee.current+1)%H.current.length;const ye=H.current[ee.current];re.current.clear(),W.current=-1,setTimeout(()=>{ke.current&&X(ye)},100)}else B(!1)},N.current=oe;try{oe.start()}catch(ye){Y(ye instanceof Error?ye:new Error("Failed to start recognition"))}},[f,v,Qe]),Z=ve.useCallback(async()=>{ke.current=!0,ee.current=0,re.current.clear(),W.current=-1,m&&!$.current&&($.current=e2()),p&&!he.current&&(he.current=await $m());const ae=H.current[0]||d;X(ae)},[m,p,d,X]),ne=ve.useCallback(async()=>{ke.current=!1,N.current&&(N.current.stop(),N.current=null),$.current&&(Jm($.current),$.current=null),he.current&&(await Pm(he.current),he.current=null),B(!1)},[]);return ve.useEffect(()=>{te.current=ne},[ne]),ve.useEffect(()=>{if(!p)return;const ae=async()=>{document.visibilityState==="visible"&&ke.current&&!he.current&&(he.current=await $m())};return document.addEventListener("visibilitychange",ae),()=>{document.removeEventListener("visibilitychange",ae)}},[p]),ve.useEffect(()=>()=>{ke.current=!1,N.current&&(N.current.stop(),N.current=null),$.current&&(Jm($.current),$.current=null),he.current&&(Pm(he.current),he.current=null)},[]),{isListening:C,isSupported:k,start:Z,stop:ne,error:F,transcript:le}}const tg="Hey Computer";let du;function r2(){return du}function a2({dispatch:n,subscribeToActions:r,getState:a}){let u=tg,c=!1,f={active:!1,phrase:tg};const d=new Set,h=()=>{const v=u!==null&&c,g=u??f.phrase;if(!(f.active===v&&f.phrase===g)){f={active:v,phrase:g};for(const x of d)x(f)}},m={getIntent:()=>f,subscribe:v=>(d.add(v),()=>{d.delete(v)}),onWakeWordDetected:()=>{u!==null&&a().voice.paused&&n({type:"ui/click/primary"})}};du=m;const p=r(v=>{switch(v.type){case"host/state":{const g=v.data.wakeWord;g!==u&&(u=g,h());break}case"voice/paused":{v.paused!==c&&(c=v.paused,h());break}}});return()=>{p(),d.clear(),du===m&&(du=void 0),f={active:!1,phrase:f.phrase}}}function u2(){const n=r2(),[r,a]=ve.useState(()=>n?.getIntent()??{active:!1,phrase:""});return ve.useEffect(()=>{if(n)return a(n.getIntent()),n.subscribe(a)},[n]),!n||!r.active||r.phrase.length===0?null:I.jsx(o2,{phrase:r.phrase,onDetected:n.onWakeWordDetected},r.phrase)}function o2({phrase:n,onDetected:r}){const{start:a,stop:u,isSupported:c}=i2({wakeWords:[n],onWakeWord:()=>{r()},language:"en-US",similarityThreshold:.75,continuous:!0,keepAlive:!0});return ve.useEffect(()=>{if(c)return a(),()=>{u()}},[c,a,u]),null}function c2(n){const r=[];let a=n;for(;a&&a.tagName.toLowerCase()!=="body";){if(a.id){r.unshift(`#${a.id}`);break}const u=a.tagName.toLowerCase(),c=a.parentElement;if(c){const d=Array.from(c.children).filter(h=>h.tagName.toLowerCase()===u).indexOf(a)+1;r.unshift(`${u}:nth-of-type(${d})`)}else r.unshift(u);a=c}return r.length>0?`body > ${r.join(" > ")}`:"body"}function s2(){const n=Tt(f=>f.ui.duplicateClient),r=Tt(f=>f.ui.moreActionsOpen);ve.useEffect(()=>{const f=d=>{d.key==="Escape"&&bt({type:"ui/key/escape"})};return window.addEventListener("keydown",f),()=>window.removeEventListener("keydown",f)},[]),ve.useEffect(()=>{if(!r)return;const f=h=>{const m=h.target;m?.closest("[data-more-actions]")===null&&m?.closest(\'[aria-label="More actions"]\')===null&&bt({type:"ui/click/modal-backdrop"})},d=window.setTimeout(()=>document.addEventListener("click",f),0);return()=>{window.clearTimeout(d),document.removeEventListener("click",f)}},[r]);const a=Tt(f=>f.stage.injectedVersion),u=ve.useRef(null),c=ve.useCallback(f=>{u.current?.(),u.current=null;const d=f.contentDocument,h=f.contentWindow;if(!d||!h)return;const m=p=>{const v=p.composedPath()[0];v instanceof Element&&bt({type:"ui/html/click",x:Math.round(p.clientX),y:Math.round(p.clientY),width:h.innerWidth,height:h.innerHeight,path:c2(v)})};d.addEventListener("click",m),u.current=()=>d.removeEventListener("click",m)},[]);return ve.useEffect(()=>(a==null&&(u.current?.(),u.current=null),()=>{u.current?.(),u.current=null}),[a]),n?I.jsx(Mv,{}):I.jsxs(I.Fragment,{children:[a!=null&&I.jsx("iframe",{className:"injected-stage",src:`/__injected?v=${a}`,onLoad:f=>c(f.currentTarget)}),I.jsx(Ab,{}),I.jsx(PA,{}),I.jsx(JA,{}),I.jsx(u2,{})]})}const f2="data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";async function d2(n){if(navigator.userActivation&&navigator.userActivation.hasBeenActive===!1)return!1;try{const r=new Audio(f2);return r.volume=0,await r.play(),r.pause(),!0}catch(r){return n({type:"browser/window/error",message:`canAutoplay.probe.blocked: ${String(r instanceof Error?r.message:r)}`}),!1}}function h2({dispatch:n,subscribeToActions:r,getState:a}){let u=!1,c=!1;const f=r(d=>{d.type==="browser/autoplay/probed"&&c&&(c=!1,n({type:"ui/click/primary"}))});return d2(n).then(d=>{u||(u=!0,c=a().audio.pendingSessionStart,n({type:"browser/autoplay/probed",allowed:d}))}),f}function p2({dispatch:n}){const r=u=>{n({type:"browser/window/error",message:u.message})},a=u=>{n({type:"browser/window/unhandled-rejection",reason:String(u.reason)})};return window.addEventListener("error",r),window.addEventListener("unhandledrejection",a),()=>{window.removeEventListener("error",r),window.removeEventListener("unhandledrejection",a)}}const Ni={dispatch:bt,subscribeToActions:ng,getState:fs};cb(Ni);vb(Ni);rb(Ni);p2(Ni);h2(Ni);a2(Ni);const m2=200,hu=[];ng(n=>{hu.push({t:Date.now(),type:n.type}),hu.length>m2&&hu.shift()});window.__voice={state:()=>{try{return JSON.parse(JSON.stringify(fs()))}catch{return fs()}},actions:()=>hu.slice()};const uy=document.getElementById("root");if(uy===null)throw new Error("Root element #root not found");Dv.createRoot(uy).render(I.jsx(ve.StrictMode,{children:I.jsx(s2,{})}));</script>\n    <style rel="stylesheet" crossorigin>:root{--bg-base: #09090b;--bg-card: #18181b;--border: #27272a;--text-dim: #52525b;--text-muted: #71717a;--text-default: #a1a1aa;--text-bright: #e4e4e7;--text-white: #fafafa;--accent: #22d3ee;--role-user: #a78bfa;--role-assistant: #34d399;--role-system: #fb923c;--role-tool: #60a5fa;--state-error: #f87171;--dot-connected: #22c55e;--dot-connecting: #eab308;--dot-disconnected: #52525b;--dot-error: #f87171;--font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;--z-stage: 50;--z-tab: 100;--z-backdrop: 150;--z-modal: 200}*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--bg-base);color:var(--text-default);font-family:var(--font-sans)}button,select{font:inherit}button:focus-visible,select:focus-visible,.tool-call:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:active:enabled{transform:scale(.97)}.injected-stage{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:var(--z-stage, 50)}.floating-tab{position:fixed;top:16px;left:16px;z-index:var(--z-tab, 100);display:flex;align-items:center;gap:14px;pointer-events:all}.floating-tab .icon-btn{position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;padding:0;color:var(--text-white);opacity:.7;cursor:pointer;transition:opacity .15s,transform 80ms}.floating-tab .icon-btn:hover:enabled{opacity:1}.floating-tab .icon-btn:active:enabled{transform:scale(.96)}.floating-tab .icon-btn:disabled{opacity:.35;cursor:not-allowed}.shield-badge{position:absolute;right:-3px;bottom:-3px;font-size:9px;line-height:1;color:var(--dot-connecting)}.connection{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px}.dot{width:8px;height:8px;border-radius:50%;background:var(--dot-disconnected)}.dot.connected{background:var(--dot-connected)}.dot.connecting{background:var(--dot-connecting)}.dot.disconnected{background:var(--dot-disconnected)}.dot.error{background:var(--dot-error)}.split-dot{display:inline-block;width:8px;height:8px;border-radius:50%;overflow:hidden;line-height:0}.split-dot-half{display:block;width:8px;height:4px;background:var(--dot-disconnected)}.split-dot-half.connected{background:var(--dot-connected)}.split-dot-half.connecting{background:var(--dot-connecting)}.split-dot-half.disconnected{background:var(--dot-disconnected)}.split-dot-half.error{background:var(--dot-error)}.meters{display:flex;align-items:flex-end;gap:2px;height:16px}.meters.dimmed{opacity:.3}.bar{width:2px;height:16px;border-radius:2px;background:#22d3ee99;transform:scaleY(var(--level, .1));transform-origin:bottom;transition:transform 50ms linear}.more-actions-popover{position:absolute;left:0;top:36px;z-index:var(--z-tab, 100);width:min(320px,calc(100vw - 32px));padding:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);box-shadow:0 12px 32px #00000059}.field-label{display:block;margin-bottom:4px;color:var(--text-muted);font-size:11px;letter-spacing:.05em;text-transform:uppercase}select{width:100%;appearance:none;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-bright);padding:6px 10px;font-size:13px}.menu-item{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-bright);font-size:13px;text-align:left;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.menu-item:hover:enabled{border-color:#3f3f46;background:#ffffff0a}.menu-item:disabled{opacity:.4;cursor:not-allowed}.mic-note{color:var(--text-muted);font-size:12px;font-style:italic}.settings-panel,.setting-item{display:flex;flex-direction:column}.setting-confirm{margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:6px;background:#ffffff05}.setting-confirm-text{color:var(--text-bright);font-size:12px;line-height:1.4}.setting-confirm-actions{display:flex;gap:8px;margin-top:10px}.setting-confirm-btn{flex:1;height:28px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-bright);font-size:12px;cursor:pointer;transition:border-color .15s,color .15s,background .15s}.setting-confirm-btn:hover:enabled{border-color:#3f3f46;background:#ffffff0a}.setting-confirm-btn:disabled{opacity:.4;cursor:not-allowed}.setting-confirm-btn.danger{border-color:#f8717166;color:var(--state-error)}.setting-confirm-btn.danger:hover:enabled{border-color:#f8717199;background:#f8717114}.setting-result{margin-top:6px;font-size:12px;line-height:1.4}.setting-result.error{color:var(--state-error)}.setting-result.ok{color:var(--text-muted)}.error-block{background:#f8717112;border:1px solid rgba(248,113,113,.2);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px}.error-title{color:var(--state-error);font-size:13px;font-weight:600}.retry{height:28px;border:1px solid rgba(248,113,113,.4);background:transparent;color:var(--state-error);font-size:12px;border-radius:6px;cursor:pointer}.modal-backdrop{position:fixed;inset:0;z-index:var(--z-backdrop, 150);background:#0009;display:flex;align-items:center;justify-content:center}.modal{position:relative;z-index:var(--z-modal, 200);width:min(680px,calc(100vw - 32px));max-width:680px;max-height:80vh;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);box-shadow:0 24px 64px #00000080}.modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0}.modal-title{color:var(--text-bright);font-size:14px;font-weight:500}.modal-close{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:6px}.modal-close:hover{color:var(--text-bright)}.modal-body{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}.loading-state{color:var(--text-muted);font-style:italic}.instructions-body{white-space:pre-wrap}.instructions-body p,.instructions-body ul,.instructions-body ol,.instructions-body li,.instructions-body blockquote,.instructions-body h1,.instructions-body h2,.instructions-body h3,.instructions-body h4,.instructions-body h5,.instructions-body h6{white-space:normal}.empty-state,.ended-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.empty-icon{width:32px;height:32px;opacity:.5}.transcript-item{padding:8px 12px;border-radius:0 6px 6px 0;color:var(--text-bright);font-size:14px;line-height:1.55;word-break:break-word}.transcript-item.streaming{opacity:1}.transcript-item.speaking{opacity:.85}.transcript-item.speaking:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--role-user);margin-right:6px;animation:speaking-pulse 1s ease-in-out infinite;vertical-align:middle}.transcript-item.role-assistant.speaking:before{background:var(--role-assistant)}@keyframes speaking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}.role-user{border-left:2px solid var(--role-user)}.role-assistant{border-left:2px solid var(--role-assistant)}.role-system{border-left:2px solid var(--role-system);background:#fb923c0f;color:#fb923cd9;font-size:13px;font-style:italic}.source-textInput{background:#a78bfa0a}.source-system.role-user,.source-system.role-assistant{border-left-style:dashed;color:var(--text-default)}.source-firstMessage{position:relative;border:1px solid rgba(167,139,250,.25);background:#a78bfa0f;border-radius:6px;padding-right:110px}.source-firstMessage:after{content:"first message";position:absolute;top:6px;right:8px;color:var(--text-dim);font-family:var(--font-mono);font-size:10px}.tool-call{background:#60a5fa12;border:1px solid rgba(96,165,250,.18);border-radius:6px;padding:7px 10px;font-family:var(--font-mono);font-size:12px;cursor:pointer;user-select:none}.tool-row{display:flex;align-items:center;gap:8px}.badge{border-radius:4px;padding:2px 7px;background:#34d3991f;color:#34d399;font-size:11px}.badge.started{background:#fbbf2426;color:#fbbf24}.badge.failed{background:#f871711f;color:#f87171}.badge.interrupted{background:#a1a1aa1f;color:#71717a}.tool-call-body{overflow:hidden}.section-label{margin:10px 0 4px;color:var(--text-dim);font-size:11px;letter-spacing:.08em}pre{margin:0 0 8px;padding:8px;overflow-x:auto;border-radius:4px;background:#00000040;color:var(--text-default);white-space:pre-wrap;word-break:break-all}.duplicate-page{min-height:100dvh;max-width:380px;margin:0 auto;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--text-muted)}.thinking{display:flex;gap:4px;align-items:center;padding:6px 10px;margin:0 0 8px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)}.thinking .tdot{width:6px;height:6px;border-radius:50%;background:var(--accent);opacity:.4;animation:thinking-pulse 1s ease-in-out infinite}.thinking .tdot:nth-child(2){animation-delay:.15s}.thinking .tdot:nth-child(3){animation-delay:.3s}@keyframes thinking-pulse{0%,to{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}</style>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';

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
  // Stable id → configured UI setting item. Ids are assigned in declaration
  // order (`setting-0`, `setting-1`, …) so the browser can invoke a callback
  // by id without the (unserializable) callback ever crossing the wire.
  #settings = /* @__PURE__ */ new Map();
  #settingDescriptors = [];
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
  // Monotonic logical clock for timeline ordering. Each transcript/timeline
  // item is stamped exactly once, at first slot creation, in xAI event arrival
  // order. xAI emits `conversation.item.added` for a user turn before the
  // following assistant response's transcript, so creation-order is the true
  // conversational order. A late `input_audio_transcription.completed` for an
  // already-created user slot fills in text only and must not re-sequence.
  // See `#nextSequence`.
  #sequenceCounter = 0;
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
    this.#config.ui.settings.forEach((item, index) => {
      const id = `setting-${index}`;
      this.#settings.set(id, item);
      this.#settingDescriptors.push({
        id,
        type: item.type,
        label: item.label,
        confirmation: item.confirmation
      });
    });
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
  // Stamp the next monotonic sequence. Called once per item at first slot
  // creation, in xAI event arrival order — that arrival order is the true
  // conversational order, so no per-response reservation is needed.
  #nextSequence() {
    this.#sequenceCounter += 1;
    return this.#sequenceCounter;
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
      sequence: this.#nextSequence()
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
      sequence: this.#nextSequence()
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
      // Injected/first-message turns carry no xAI item id; they are stamped at
      // creation in arrival order like every other item.
      sequence: this.#nextSequence()
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
      case "settings.invoke": {
        await this.#invokeSetting(typeof message.data?.id === "string" ? message.data.id : void 0);
        break;
      }
      case "html.click": {
        const data = message.data;
        const x = typeof data?.x === "number" ? data.x : void 0;
        const y = typeof data?.y === "number" ? data.y : void 0;
        const width = typeof data?.width === "number" ? data.width : void 0;
        const height = typeof data?.height === "number" ? data.height : void 0;
        const path = typeof data?.path === "string" ? data.path : void 0;
        if (x === void 0 || y === void 0 || width === void 0 || height === void 0 || path === void 0) {
          break;
        }
        this.emit("html.click", { x, y, width, height, path, createdAt: /* @__PURE__ */ new Date() });
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
  // Resolve a browser `settings.invoke` to its configured callback, await it,
  // and report the outcome back to the browser. A failed callback surfaces as
  // a `conversation.error` event (the same channel other browser-driven
  // failures use) and is reported to the browser as `{ ok: false, error }`;
  // it never rejects out of the message loop.
  async #invokeSetting(id) {
    if (id === void 0) return;
    const item = this.#settings.get(id);
    if (!item) {
      const error = this.#fail("CONFIG_INVALID", "Browser invoked an unknown setting.", { id });
      this.#broadcast({ type: "settings.result", data: { id, ok: false, error: error.message } });
      return;
    }
    try {
      await item.callback();
      this.#broadcast({ type: "settings.result", data: { id, ok: true } });
    } catch (cause) {
      const error = toVoiceError("INTERNAL_INVARIANT_VIOLATION", "Settings callback failed.", { id }, cause);
      this.#log("error", error);
      this.emit("conversation.error", {
        conversationId: this.#conversation?.id,
        error,
        createdAt: /* @__PURE__ */ new Date()
      });
      this.#broadcast({ type: "settings.result", data: { id, ok: false, error: error.message } });
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
        injectedVersion: this.#injectedHtml === null ? null : this.#injectedVersion,
        settings: this.#settingDescriptors
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
      title: config.ui?.title ?? DEFAULT_UI_TITLE,
      settings: config.ui?.settings ?? []
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
    // Render in true conversational order. `sequence` is the monotonic
    // position stamped when the item's slot was first created, in xAI event
    // arrival order (which is the real conversational order). A late ASR
    // `transcription.completed` only updates text and keeps its original
    // sequence. Ties fall back to arrival time for stability.
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
