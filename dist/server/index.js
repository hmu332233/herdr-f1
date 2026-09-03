import { createRequire as __WEBPACK_EXTERNAL_createRequire } from "module";
/******/ var __webpack_modules__ = ({

/***/ 803:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { EMPTY_BUFFER } = __nccwpck_require__(791);

const FastBuffer = Buffer[Symbol.species];

/**
 * Merges an array of buffers into a new buffer.
 *
 * @param {Buffer[]} list The array of buffers to concat
 * @param {Number} totalLength The total length of buffers in the list
 * @return {Buffer} The resulting buffer
 * @public
 */
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

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function _mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
function _unmask(buffer, mask) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 *
 * @param {Buffer} buf The buffer to convert
 * @return {ArrayBuffer} Converted buffer
 * @public
 */
function toArrayBuffer(buf) {
  if (buf.length === buf.buffer.byteLength) {
    return buf.buffer;
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

/**
 * Converts `data` to a `Buffer`.
 *
 * @param {*} data The data to convert
 * @return {Buffer} The buffer
 * @throws {TypeError}
 * @public
 */
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

/* istanbul ignore else  */
if (!process.env.WS_NO_BUFFER_UTIL) {
  try {
    const bufferUtil = __nccwpck_require__(327);

    module.exports.mask = function (source, mask, output, offset, length) {
      if (length < 48) _mask(source, mask, output, offset, length);
      else bufferUtil.mask(source, mask, output, offset, length);
    };

    module.exports.unmask = function (buffer, mask) {
      if (buffer.length < 32) _unmask(buffer, mask);
      else bufferUtil.unmask(buffer, mask);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),

/***/ 791:
/***/ ((module) => {



const BINARY_TYPES = ['nodebuffer', 'arraybuffer', 'fragments'];
const hasBlob = typeof Blob !== 'undefined';

if (hasBlob) BINARY_TYPES.push('blob');

module.exports = {
  BINARY_TYPES,
  CLOSE_TIMEOUT: 30000,
  EMPTY_BUFFER: Buffer.alloc(0),
  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  hasBlob,
  kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
  kListener: Symbol('kListener'),
  kStatusCode: Symbol('status-code'),
  kWebSocket: Symbol('websocket'),
  NOOP: () => {}
};


/***/ }),

/***/ 634:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { kForOnEventAttribute, kListener } = __nccwpck_require__(791);

const kCode = Symbol('kCode');
const kData = Symbol('kData');
const kError = Symbol('kError');
const kMessage = Symbol('kMessage');
const kReason = Symbol('kReason');
const kTarget = Symbol('kTarget');
const kType = Symbol('kType');
const kWasClean = Symbol('kWasClean');

/**
 * Class representing an event.
 */
class Event {
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
}

Object.defineProperty(Event.prototype, 'target', { enumerable: true });
Object.defineProperty(Event.prototype, 'type', { enumerable: true });

/**
 * Class representing a close event.
 *
 * @extends Event
 */
class CloseEvent extends Event {
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

    this[kCode] = options.code === undefined ? 0 : options.code;
    this[kReason] = options.reason === undefined ? '' : options.reason;
    this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
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
}

Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

/**
 * Class representing an error event.
 *
 * @extends Event
 */
class ErrorEvent extends Event {
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

    this[kError] = options.error === undefined ? null : options.error;
    this[kMessage] = options.message === undefined ? '' : options.message;
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
}

Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

/**
 * Class representing a message event.
 *
 * @extends Event
 */
class MessageEvent extends Event {
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

    this[kData] = options.data === undefined ? null : options.data;
  }

  /**
   * @type {*}
   */
  get data() {
    return this[kData];
  }
}

Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

/**
 * This provides methods for emulating the `EventTarget` interface. It's not
 * meant to be used directly.
 *
 * @mixin
 */
const EventTarget = {
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
      if (
        !options[kForOnEventAttribute] &&
        listener[kListener] === handler &&
        !listener[kForOnEventAttribute]
      ) {
        return;
      }
    }

    let wrapper;

    if (type === 'message') {
      wrapper = function onMessage(data, isBinary) {
        const event = new MessageEvent('message', {
          data: isBinary ? data : data.toString()
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'close') {
      wrapper = function onClose(code, message) {
        const event = new CloseEvent('close', {
          code,
          reason: message.toString(),
          wasClean: this._closeFrameReceived && this._closeFrameSent
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'error') {
      wrapper = function onError(error) {
        const event = new ErrorEvent('error', {
          error,
          message: error.message
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'open') {
      wrapper = function onOpen() {
        const event = new Event('open');

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

/**
 * Call an event listener
 *
 * @param {(Function|Object)} listener The listener to call
 * @param {*} thisArg The value to use as `this`` when calling the listener
 * @param {Event} event The event to pass to the listener
 * @private
 */
function callListener(listener, thisArg, event) {
  if (typeof listener === 'object' && listener.handleEvent) {
    listener.handleEvent.call(listener, event);
  } else {
    listener.call(thisArg, event);
  }
}


/***/ }),

/***/ 335:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { tokenChars } = __nccwpck_require__(615);

/**
 * Adds an offer to the map of extension offers or a parameter to the map of
 * parameters.
 *
 * @param {Object} dest The map of extension offers or parameters
 * @param {String} name The extension or parameter name
 * @param {(Object|Boolean|String)} elem The extension parameters or the
 *     parameter value
 * @private
 */
function push(dest, name, elem) {
  if (dest[name] === undefined) dest[name] = [elem];
  else dest[name].push(elem);
}

/**
 * Parses the `Sec-WebSocket-Extensions` header into an object.
 *
 * @param {String} header The field value of the header
 * @return {Object} The parsed object
 * @public
 */
function parse(header) {
  const offers = Object.create(null);
  let params = Object.create(null);
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

    if (extensionName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (
        i !== 0 &&
        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
      ) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        const name = header.slice(start, end);
        if (code === 0x2c) {
          push(offers, name, params);
          params = Object.create(null);
        } else {
          extensionName = name;
        }

        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else if (paramName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 || code === 0x09) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        push(params, header.slice(start, end), true);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        start = end = -1;
      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
        paramName = header.slice(start, i);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else {
      //
      // The value of a quoted-string after unescaping must conform to the
      // token ABNF, so only token characters are valid.
      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
      //
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
        } else if (code === 0x22 /* '"' */ && start !== -1) {
          inQuotes = false;
          end = i;
        } else if (code === 0x5c /* '\' */) {
          isEscaping = true;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
        inQuotes = true;
      } else if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
        if (end === -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        let value = header.slice(start, end);
        if (mustUnescape) {
          value = value.replace(/\\/g, '');
          mustUnescape = false;
        }
        push(params, paramName, value);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        paramName = undefined;
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
  }

  if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
    throw new SyntaxError('Unexpected end of input');
  }

  if (end === -1) end = i;
  const token = header.slice(start, end);
  if (extensionName === undefined) {
    push(offers, token, params);
  } else {
    if (paramName === undefined) {
      push(params, token, true);
    } else if (mustUnescape) {
      push(params, paramName, token.replace(/\\/g, ''));
    } else {
      push(params, paramName, token);
    }
    push(offers, extensionName, params);
  }

  return offers;
}

/**
 * Builds the `Sec-WebSocket-Extensions` header field value.
 *
 * @param {Object} extensions The map of extensions and parameters to format
 * @return {String} A string representing the given object
 * @public
 */
function format(extensions) {
  return Object.keys(extensions)
    .map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations)) configurations = [configurations];
      return configurations
        .map((params) => {
          return [extension]
            .concat(
              Object.keys(params).map((k) => {
                let values = params[k];
                if (!Array.isArray(values)) values = [values];
                return values
                  .map((v) => (v === true ? k : `${k}=${v}`))
                  .join('; ');
              })
            )
            .join('; ');
        })
        .join(', ');
    })
    .join(', ');
}

module.exports = { format, parse };


/***/ }),

/***/ 958:
/***/ ((module) => {



const kDone = Symbol('kDone');
const kRun = Symbol('kRun');

/**
 * A very simple job queue with adjustable concurrency. Adapted from
 * https://github.com/STRML/async-limiter
 */
class Limiter {
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
}

module.exports = Limiter;


/***/ }),

/***/ 376:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const zlib = __nccwpck_require__(106);

const bufferUtil = __nccwpck_require__(803);
const Limiter = __nccwpck_require__(958);
const { kStatusCode } = __nccwpck_require__(791);

const FastBuffer = Buffer[Symbol.species];
const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const kPerMessageDeflate = Symbol('permessage-deflate');
const kTotalLength = Symbol('total-length');
const kCallback = Symbol('callback');
const kBuffers = Symbol('buffers');
const kError = Symbol('error');

//
// We limit zlib concurrency, which prevents severe memory fragmentation
// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
// and https://github.com/websockets/ws/issues/1202
//
// Intentionally global; it's the global thread pool that's an issue.
//
let zlibLimiter;

/**
 * permessage-deflate implementation.
 */
class PerMessageDeflate {
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
   * @param {Boolean} [options.isServer=false] Create the instance in either
   *     server or client mode
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
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
   */
  constructor(options) {
    this._options = options || {};
    this._threshold =
      this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._maxPayload = this._options.maxPayload | 0;
    this._isServer = !!this._options.isServer;
    this._deflate = null;
    this._inflate = null;

    this.params = null;

    if (!zlibLimiter) {
      const concurrency =
        this._options.concurrencyLimit !== undefined
          ? this._options.concurrencyLimit
          : 10;
      zlibLimiter = new Limiter(concurrency);
    }
  }

  /**
   * @type {String}
   */
  static get extensionName() {
    return 'permessage-deflate';
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

    this.params = this._isServer
      ? this.acceptAsServer(configurations)
      : this.acceptAsClient(configurations);

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
            'The deflate stream was closed while data was being processed'
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
      if (
        (opts.serverNoContextTakeover === false &&
          params.server_no_context_takeover) ||
        (params.server_max_window_bits &&
          (opts.serverMaxWindowBits === false ||
            (typeof opts.serverMaxWindowBits === 'number' &&
              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
        (typeof opts.clientMaxWindowBits === 'number' &&
          !params.client_max_window_bits)
      ) {
        return false;
      }

      return true;
    });

    if (!accepted) {
      throw new Error('None of the extension offers can be accepted');
    }

    if (opts.serverNoContextTakeover) {
      accepted.server_no_context_takeover = true;
    }
    if (opts.clientNoContextTakeover) {
      accepted.client_no_context_takeover = true;
    }
    if (typeof opts.serverMaxWindowBits === 'number') {
      accepted.server_max_window_bits = opts.serverMaxWindowBits;
    }
    if (typeof opts.clientMaxWindowBits === 'number') {
      accepted.client_max_window_bits = opts.clientMaxWindowBits;
    } else if (
      accepted.client_max_window_bits === true ||
      opts.clientMaxWindowBits === false
    ) {
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

    if (
      this._options.clientNoContextTakeover === false &&
      params.client_no_context_takeover
    ) {
      throw new Error('Unexpected parameter "client_no_context_takeover"');
    }

    if (!params.client_max_window_bits) {
      if (typeof this._options.clientMaxWindowBits === 'number') {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      }
    } else if (
      this._options.clientMaxWindowBits === false ||
      (typeof this._options.clientMaxWindowBits === 'number' &&
        params.client_max_window_bits > this._options.clientMaxWindowBits)
    ) {
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

        if (key === 'client_max_window_bits') {
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
        } else if (key === 'server_max_window_bits') {
          const num = +value;
          if (!Number.isInteger(num) || num < 8 || num > 15) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
          value = num;
        } else if (
          key === 'client_no_context_takeover' ||
          key === 'server_no_context_takeover'
        ) {
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
    const endpoint = this._isServer ? 'client' : 'server';

    if (!this._inflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._inflate = zlib.createInflateRaw({
        ...this._options.zlibInflateOptions,
        windowBits
      });
      this._inflate[kPerMessageDeflate] = this;
      this._inflate[kTotalLength] = 0;
      this._inflate[kBuffers] = [];
      this._inflate.on('error', inflateOnError);
      this._inflate.on('data', inflateOnData);
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

      const data = bufferUtil.concat(
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

      callback(null, data);
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
    const endpoint = this._isServer ? 'server' : 'client';

    if (!this._deflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._deflate = zlib.createDeflateRaw({
        ...this._options.zlibDeflateOptions,
        windowBits
      });

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      this._deflate.on('data', deflateOnData);
    }

    this._deflate[kCallback] = callback;

    this._deflate.write(data);
    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
      if (!this._deflate) {
        //
        // The deflate stream was closed while data was being processed.
        //
        return;
      }

      let data = bufferUtil.concat(
        this._deflate[kBuffers],
        this._deflate[kTotalLength]
      );

      if (fin) {
        data = new FastBuffer(data.buffer, data.byteOffset, data.length - 4);
      }

      //
      // Ensure that the callback will not be called again in
      // `PerMessageDeflate#cleanup()`.
      //
      this._deflate[kCallback] = null;

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
        this._deflate.reset();
      }

      callback(null, data);
    });
  }
}

module.exports = PerMessageDeflate;

/**
 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function deflateOnData(chunk) {
  this[kBuffers].push(chunk);
  this[kTotalLength] += chunk.length;
}

/**
 * The listener of the `zlib.InflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function inflateOnData(chunk) {
  this[kTotalLength] += chunk.length;

  if (
    this[kPerMessageDeflate]._maxPayload < 1 ||
    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
  ) {
    this[kBuffers].push(chunk);
    return;
  }

  this[kError] = new RangeError('Max payload size exceeded');
  this[kError].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
  this[kError][kStatusCode] = 1009;
  this.removeListener('data', inflateOnData);

  //
  // The choice to employ `zlib.reset()` over `zlib.close()` is dictated by the
  // fact that in Node.js versions prior to 13.10.0, the callback for
  // `zlib.flush()` is not called if `zlib.close()` is used. Utilizing
  // `zlib.reset()` ensures that either the callback is invoked or an error is
  // emitted.
  //
  this.reset();
}

/**
 * The listener of the `zlib.InflateRaw` stream `'error'` event.
 *
 * @param {Error} err The emitted error
 * @private
 */
function inflateOnError(err) {
  //
  // There is no need to call `Zlib#close()` as the handle is automatically
  // closed when an error is emitted.
  //
  this[kPerMessageDeflate]._inflate = null;

  if (this[kError]) {
    this[kCallback](this[kError]);
    return;
  }

  err[kStatusCode] = 1007;
  this[kCallback](err);
}


/***/ }),

/***/ 893:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { Writable } = __nccwpck_require__(203);

const PerMessageDeflate = __nccwpck_require__(376);
const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  kStatusCode,
  kWebSocket
} = __nccwpck_require__(791);
const { concat, toArrayBuffer, unmask } = __nccwpck_require__(803);
const { isValidStatusCode, isValidUTF8 } = __nccwpck_require__(615);

const FastBuffer = Buffer[Symbol.species];

const GET_INFO = 0;
const GET_PAYLOAD_LENGTH_16 = 1;
const GET_PAYLOAD_LENGTH_64 = 2;
const GET_MASK = 3;
const GET_DATA = 4;
const INFLATING = 5;
const DEFER_EVENT = 6;

/**
 * HyBi Receiver implementation.
 *
 * @extends Writable
 */
class Receiver extends Writable {
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
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   */
  constructor(options = {}) {
    super();

    this._allowSynchronousEvents =
      options.allowSynchronousEvents !== undefined
        ? options.allowSynchronousEvents
        : true;
    this._binaryType = options.binaryType || BINARY_TYPES[0];
    this._extensions = options.extensions || {};
    this._isServer = !!options.isServer;
    this._maxBufferedChunks = options.maxBufferedChunks | 0;
    this._maxFragments = options.maxFragments | 0;
    this._maxPayload = options.maxPayload | 0;
    this._skipUTF8Validation = !!options.skipUTF8Validation;
    this[kWebSocket] = undefined;

    this._bufferedBytes = 0;
    this._buffers = [];

    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._numFragments = 0;
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
    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

    if (
      this._maxBufferedChunks > 0 &&
      this._buffers.length >= this._maxBufferedChunks
    ) {
      cb(
        this.createError(
          RangeError,
          'Too many buffered chunks',
          false,
          1008,
          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
        )
      );
      return;
    }

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

    if ((buf[0] & 0x30) !== 0x00) {
      const error = this.createError(
        RangeError,
        'RSV2 and RSV3 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_2_3'
      );

      cb(error);
      return;
    }

    const compressed = (buf[0] & 0x40) === 0x40;

    if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
      const error = this.createError(
        RangeError,
        'RSV1 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_1'
      );

      cb(error);
      return;
    }

    this._fin = (buf[0] & 0x80) === 0x80;
    this._opcode = buf[0] & 0x0f;
    this._payloadLength = buf[1] & 0x7f;

    if (this._opcode === 0x00) {
      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (!this._fragmented) {
        const error = this.createError(
          RangeError,
          'invalid opcode 0',
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._opcode = this._fragmented;
    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
      if (this._fragmented) {
        const error = this.createError(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._compressed = compressed;
    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
      if (!this._fin) {
        const error = this.createError(
          RangeError,
          'FIN must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_FIN'
        );

        cb(error);
        return;
      }

      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (
        this._payloadLength > 0x7d ||
        (this._opcode === 0x08 && this._payloadLength === 1)
      ) {
        const error = this.createError(
          RangeError,
          `invalid payload length ${this._payloadLength}`,
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
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
        'WS_ERR_INVALID_OPCODE'
      );

      cb(error);
      return;
    }

    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
    this._masked = (buf[1] & 0x80) === 0x80;

    if (this._isServer) {
      if (!this._masked) {
        const error = this.createError(
          RangeError,
          'MASK must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_MASK'
        );

        cb(error);
        return;
      }
    } else if (this._masked) {
      const error = this.createError(
        RangeError,
        'MASK must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_MASK'
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

    //
    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
    // if payload length is greater than this number.
    //
    if (num > Math.pow(2, 53 - 32) - 1) {
      const error = this.createError(
        RangeError,
        'Unsupported WebSocket frame: payload length > 2^53 - 1',
        false,
        1009,
        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
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
    if (this._payloadLength && this._opcode < 0x08) {
      this._totalPayloadLength += this._payloadLength;
      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
        const error = this.createError(
          RangeError,
          'Max payload size exceeded',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
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

      if (
        this._masked &&
        (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
      ) {
        unmask(data, this._mask);
      }
    }

    if (this._opcode > 0x07) {
      this.controlMessage(data, cb);
      return;
    }

    if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
      const error = this.createError(
        RangeError,
        'Too many message fragments',
        false,
        1008,
        'WS_ERR_TOO_MANY_BUFFERED_PARTS'
      );

      cb(error);
      return;
    }

    if (this._compressed) {
      this._state = INFLATING;
      this.decompress(data, cb);
      return;
    }

    if (data.length) {
      //
      // This message is not compressed so its length is the sum of the payload
      // length of all fragments.
      //
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
            'Max payload size exceeded',
            false,
            1009,
            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
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
    this._numFragments = 0;
    this._fragments = [];

    if (this._opcode === 2) {
      let data;

      if (this._binaryType === 'nodebuffer') {
        data = concat(fragments, messageLength);
      } else if (this._binaryType === 'arraybuffer') {
        data = toArrayBuffer(concat(fragments, messageLength));
      } else if (this._binaryType === 'blob') {
        data = new Blob(fragments);
      } else {
        data = fragments;
      }

      if (this._allowSynchronousEvents) {
        this.emit('message', data, true);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', data, true);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    } else {
      const buf = concat(fragments, messageLength);

      if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
        const error = this.createError(
          Error,
          'invalid UTF-8 sequence',
          true,
          1007,
          'WS_ERR_INVALID_UTF8'
        );

        cb(error);
        return;
      }

      if (this._state === INFLATING || this._allowSynchronousEvents) {
        this.emit('message', buf, false);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', buf, false);
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
    if (this._opcode === 0x08) {
      if (data.length === 0) {
        this._loop = false;
        this.emit('conclude', 1005, EMPTY_BUFFER);
        this.end();
      } else {
        const code = data.readUInt16BE(0);

        if (!isValidStatusCode(code)) {
          const error = this.createError(
            RangeError,
            `invalid status code ${code}`,
            true,
            1002,
            'WS_ERR_INVALID_CLOSE_CODE'
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
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );

          cb(error);
          return;
        }

        this._loop = false;
        this.emit('conclude', code, buf);
        this.end();
      }

      this._state = GET_INFO;
      return;
    }

    if (this._allowSynchronousEvents) {
      this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
      this._state = GET_INFO;
    } else {
      this._state = DEFER_EVENT;
      setImmediate(() => {
        this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
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
}

module.exports = Receiver;


/***/ }),

/***/ 389:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex" }] */



const { Duplex } = __nccwpck_require__(203);
const { randomFillSync } = __nccwpck_require__(982);
const {
  types: { isUint8Array }
} = __nccwpck_require__(23);

const PerMessageDeflate = __nccwpck_require__(376);
const { EMPTY_BUFFER, kWebSocket, NOOP } = __nccwpck_require__(791);
const { isBlob, isValidStatusCode } = __nccwpck_require__(615);
const { mask: applyMask, toBuffer } = __nccwpck_require__(803);

const kByteLength = Symbol('kByteLength');
const maskBuffer = Buffer.alloc(4);
const RANDOM_POOL_SIZE = 8 * 1024;
let randomPool;
let randomPoolPointer = RANDOM_POOL_SIZE;

const DEFAULT = 0;
const DEFLATING = 1;
const GET_BLOB_DATA = 2;

/**
 * HyBi Sender implementation.
 */
class Sender {
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
    this[kWebSocket] = undefined;
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
          /* istanbul ignore else  */
          if (randomPool === undefined) {
            //
            // This is lazily initialized because server-sent frames must not
            // be masked so it may never be used.
            //
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

    if (typeof data === 'string') {
      if (
        (!options.mask || skipMasking) &&
        options[kByteLength] !== undefined
      ) {
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

    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
    if (options.rsv1) target[0] |= 0x40;

    target[1] = payloadLength;

    if (payloadLength === 126) {
      target.writeUInt16BE(dataLength, 2);
    } else if (payloadLength === 127) {
      target[2] = target[3] = 0;
      target.writeUIntBE(dataLength, 4, 6);
    }

    if (!options.mask) return [target, data];

    target[1] |= 0x80;
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

    if (code === undefined) {
      buf = EMPTY_BUFFER;
    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
      throw new TypeError('First argument must be a valid error code number');
    } else if (data === undefined || !data.length) {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      const length = Buffer.byteLength(data);

      if (length > 123) {
        throw new RangeError('The message must not be greater than 123 bytes');
      }

      buf = Buffer.allocUnsafe(2 + length);
      buf.writeUInt16BE(code, 0);

      if (typeof data === 'string') {
        buf.write(data, 2);
      } else if (isUint8Array(data)) {
        buf.set(data, 2);
      } else {
        throw new TypeError('Second argument must be a string or a Uint8Array');
      }
    }

    const options = {
      [kByteLength]: buf.length,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x08,
      readOnly: false,
      rsv1: false
    };

    if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, buf, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(buf, options), cb);
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

    if (typeof data === 'string') {
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
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x09,
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
      this.sendFrame(Sender.frame(data, options), cb);
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

    if (typeof data === 'string') {
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
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x0a,
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
      this.sendFrame(Sender.frame(data, options), cb);
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

    if (typeof data === 'string') {
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
      if (
        rsv1 &&
        perMessageDeflate &&
        perMessageDeflate.params[
          perMessageDeflate._isServer
            ? 'server_no_context_takeover'
            : 'client_no_context_takeover'
        ]
      ) {
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

    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        if (this._socket.destroyed) {
          const err = new Error(
            'The socket was closed while the blob was being read'
          );

          //
          // `callCallbacks` is called in the next tick to ensure that errors
          // that might be thrown in the callbacks behave like errors thrown
          // outside the promise chain.
          //
          process.nextTick(callCallbacks, this, err, cb);
          return;
        }

        this._bufferedBytes -= options[kByteLength];
        const data = toBuffer(arrayBuffer);

        if (!compress) {
          this._state = DEFAULT;
          this.sendFrame(Sender.frame(data, options), cb);
          this.dequeue();
        } else {
          this.dispatch(data, compress, options, cb);
        }
      })
      .catch((err) => {
        //
        // `onError` is called in the next tick for the same reason that
        // `callCallbacks` above is.
        //
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
      this.sendFrame(Sender.frame(data, options), cb);
      return;
    }

    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    this._bufferedBytes += options[kByteLength];
    this._state = DEFLATING;
    perMessageDeflate.compress(data, options.fin, (_, buf) => {
      if (this._socket.destroyed) {
        const err = new Error(
          'The socket was closed while data was being compressed'
        );

        callCallbacks(this, err, cb);
        return;
      }

      this._bufferedBytes -= options[kByteLength];
      this._state = DEFAULT;
      options.readOnly = false;
      this.sendFrame(Sender.frame(buf, options), cb);
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
}

module.exports = Sender;

/**
 * Calls queued callbacks with an error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error to call the callbacks with
 * @param {Function} [cb] The first callback
 * @private
 */
function callCallbacks(sender, err, cb) {
  if (typeof cb === 'function') cb(err);

  for (let i = 0; i < sender._queue.length; i++) {
    const params = sender._queue[i];
    const callback = params[params.length - 1];

    if (typeof callback === 'function') callback(err);
  }
}

/**
 * Handles a `Sender` error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error
 * @param {Function} [cb] The first pending callback
 * @private
 */
function onError(sender, err, cb) {
  callCallbacks(sender, err, cb);
  sender.onerror(err);
}


/***/ }),

/***/ 412:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^WebSocket$" }] */


const WebSocket = __nccwpck_require__(681);
const { Duplex } = __nccwpck_require__(203);

/**
 * Emits the `'close'` event on a stream.
 *
 * @param {Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * The listener of the `'end'` event.
 *
 * @private
 */
function duplexOnEnd() {
  if (!this.destroyed && this._writableState.finished) {
    this.destroy();
  }
}

/**
 * The listener of the `'error'` event.
 *
 * @param {Error} err The error
 * @private
 */
function duplexOnError(err) {
  this.removeListener('error', duplexOnError);
  this.destroy();
  if (this.listenerCount('error') === 0) {
    // Do not suppress the throwing behavior.
    this.emit('error', err);
  }
}

/**
 * Wraps a `WebSocket` in a duplex stream.
 *
 * @param {WebSocket} ws The `WebSocket` to wrap
 * @param {Object} [options] The options for the `Duplex` constructor
 * @return {Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let terminateOnDestroy = true;

  const duplex = new Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg, isBinary) {
    const data =
      !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;

    if (!duplex.push(data)) ws.pause();
  });

  ws.once('error', function error(err) {
    if (duplex.destroyed) return;

    // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
    //
    // - If the `'error'` event is emitted before the `'open'` event, then
    //   `ws.terminate()` is a noop as no socket is assigned.
    // - Otherwise, the error is re-emitted by the listener of the `'error'`
    //   event of the `Receiver` object. The listener already closes the
    //   connection by calling `ws.close()`. This allows a close frame to be
    //   sent to the other peer. If `ws.terminate()` is called right after this,
    //   then the close frame might not be sent.
    terminateOnDestroy = false;
    duplex.destroy(err);
  });

  ws.once('close', function close() {
    if (duplex.destroyed) return;

    duplex.push(null);
  });

  duplex._destroy = function (err, callback) {
    if (ws.readyState === ws.CLOSED) {
      callback(err);
      process.nextTick(emitClose, duplex);
      return;
    }

    let called = false;

    ws.once('error', function error(err) {
      called = true;
      callback(err);
    });

    ws.once('close', function close() {
      if (!called) callback(err);
      process.nextTick(emitClose, duplex);
    });

    if (terminateOnDestroy) ws.terminate();
  };

  duplex._final = function (callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._final(callback);
      });
      return;
    }

    // If the value of the `_socket` property is `null` it means that `ws` is a
    // client websocket and the handshake failed. In fact, when this happens, a
    // socket is never assigned to the websocket. Wait for the `'error'` event
    // that will be emitted by the websocket.
    if (ws._socket === null) return;

    if (ws._socket._writableState.finished) {
      callback();
      if (duplex._readableState.endEmitted) duplex.destroy();
    } else {
      ws._socket.once('finish', function finish() {
        // `duplex` is not destroyed here because the `'end'` event will be
        // emitted on `duplex` after this `'finish'` event. The EOF signaling
        // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
        callback();
      });
      ws.close();
    }
  };

  duplex._read = function () {
    if (ws.isPaused) ws.resume();
  };

  duplex._write = function (chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._write(chunk, encoding, callback);
      });
      return;
    }

    ws.send(chunk, callback);
  };

  duplex.on('end', duplexOnEnd);
  duplex.on('error', duplexOnError);
  return duplex;
}

module.exports = createWebSocketStream;


/***/ }),

/***/ 951:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { tokenChars } = __nccwpck_require__(615);

/**
 * Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
 *
 * @param {String} header The field value of the header
 * @return {Set} The subprotocol names
 * @public
 */
function parse(header) {
  const protocols = new Set();
  let start = -1;
  let end = -1;
  let i = 0;

  for (i; i < header.length; i++) {
    const code = header.charCodeAt(i);

    if (end === -1 && tokenChars[code] === 1) {
      if (start === -1) start = i;
    } else if (
      i !== 0 &&
      (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
    ) {
      if (end === -1 && start !== -1) end = i;
    } else if (code === 0x2c /* ',' */) {
      if (start === -1) {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }

      if (end === -1) end = i;

      const protocol = header.slice(start, end);

      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }

      protocols.add(protocol);
      start = end = -1;
    } else {
      throw new SyntaxError(`Unexpected character at index ${i}`);
    }
  }

  if (start === -1 || end !== -1) {
    throw new SyntaxError('Unexpected end of input');
  }

  const protocol = header.slice(start, i);

  if (protocols.has(protocol)) {
    throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
  }

  protocols.add(protocol);
  return protocols;
}

module.exports = { parse };


/***/ }),

/***/ 615:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



const { isUtf8 } = __nccwpck_require__(181);

const { hasBlob } = __nccwpck_require__(791);

//
// Allowed token characters:
//
// '!', '#', '$', '%', '&', ''', '*', '+', '-',
// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
//
// tokenChars[32] === 0 // ' '
// tokenChars[33] === 1 // '!'
// tokenChars[34] === 0 // '"'
// ...
//
// prettier-ignore
const tokenChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
];

/**
 * Checks if a status code is allowed in a close frame.
 *
 * @param {Number} code The status code
 * @return {Boolean} `true` if the status code is valid, else `false`
 * @public
 */
function isValidStatusCode(code) {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function _isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0) {
      // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // Overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether a value is a `Blob`.
 *
 * @param {*} value The value to be tested
 * @return {Boolean} `true` if `value` is a `Blob`, else `false`
 * @private
 */
function isBlob(value) {
  return (
    hasBlob &&
    typeof value === 'object' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.type === 'string' &&
    typeof value.stream === 'function' &&
    (value[Symbol.toStringTag] === 'Blob' ||
      value[Symbol.toStringTag] === 'File')
  );
}

module.exports = {
  isBlob,
  isValidStatusCode,
  isValidUTF8: _isValidUTF8,
  tokenChars
};

if (isUtf8) {
  module.exports.isValidUTF8 = function (buf) {
    return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
  };
} /* istanbul ignore else  */ else if (!process.env.WS_NO_UTF_8_VALIDATE) {
  try {
    const isValidUTF8 = __nccwpck_require__(414);

    module.exports.isValidUTF8 = function (buf) {
      return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),

/***/ 129:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex$", "caughtErrors": "none" }] */



const EventEmitter = __nccwpck_require__(434);
const http = __nccwpck_require__(611);
const { Duplex } = __nccwpck_require__(203);
const { createHash } = __nccwpck_require__(982);

const extension = __nccwpck_require__(335);
const PerMessageDeflate = __nccwpck_require__(376);
const subprotocol = __nccwpck_require__(951);
const WebSocket = __nccwpck_require__(681);
const { CLOSE_TIMEOUT, GUID, kWebSocket } = __nccwpck_require__(791);

const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

const RUNNING = 0;
const CLOSING = 1;
const CLOSED = 2;

/**
 * Class representing a WebSocket server.
 *
 * @extends EventEmitter
 */
class WebSocketServer extends EventEmitter {
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
   * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
   *     wait for the closing handshake to finish after `websocket.close()` is
   *     called
   * @param {Function} [options.handleProtocols] A hook to handle protocols
   * @param {String} [options.host] The hostname where to bind the server
   * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=16384] The maximum number of message
   *     fragments
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
      maxBufferedChunks: 256 * 1024,
      maxFragments: 16 * 1024,
      maxPayload: 100 * 1024 * 1024,
      skipUTF8Validation: false,
      perMessageDeflate: false,
      handleProtocols: null,
      clientTracking: true,
      closeTimeout: CLOSE_TIMEOUT,
      verifyClient: null,
      noServer: false,
      backlog: null, // use default (511 as implemented in net.js)
      server: null,
      host: null,
      path: null,
      port: null,
      WebSocket,
      ...options
    };

    if (
      (options.port == null && !options.server && !options.noServer) ||
      (options.port != null && (options.server || options.noServer)) ||
      (options.server && options.noServer)
    ) {
      throw new TypeError(
        'One and only one of the "port", "server", or "noServer" options ' +
          'must be specified'
      );
    }

    if (options.port != null) {
      this._server = http.createServer((req, res) => {
        const body = http.STATUS_CODES[426];

        res.writeHead(426, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
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
      const emitConnection = this.emit.bind(this, 'connection');

      this._removeListeners = addListeners(this._server, {
        listening: this.emit.bind(this, 'listening'),
        error: this.emit.bind(this, 'error'),
        upgrade: (req, socket, head) => {
          this.handleUpgrade(req, socket, head, emitConnection);
        }
      });
    }

    if (options.perMessageDeflate === true) options.perMessageDeflate = {};
    if (options.clientTracking) {
      this.clients = new Set();
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
        this.once('close', () => {
          cb(new Error('The server is not running'));
        });
      }

      process.nextTick(emitClose, this);
      return;
    }

    if (cb) this.once('close', cb);

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

      //
      // The HTTP/S server was created internally. Close it, and rely on its
      // `'close'` event.
      //
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
      const index = req.url.indexOf('?');
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
    socket.on('error', socketOnError);

    const key = req.headers['sec-websocket-key'];
    const upgrade = req.headers.upgrade;
    const version = +req.headers['sec-websocket-version'];

    if (req.method !== 'GET') {
      const message = 'Invalid HTTP method';
      abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
      return;
    }

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      const message = 'Invalid Upgrade header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (key === undefined || !keyRegex.test(key)) {
      const message = 'Missing or invalid Sec-WebSocket-Key header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (version !== 13 && version !== 8) {
      const message = 'Missing or invalid Sec-WebSocket-Version header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
        'Sec-WebSocket-Version': '13, 8'
      });
      return;
    }

    if (!this.shouldHandle(req)) {
      abortHandshake(socket, 400);
      return;
    }

    const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
    let protocols = new Set();

    if (secWebSocketProtocol !== undefined) {
      try {
        protocols = subprotocol.parse(secWebSocketProtocol);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Protocol header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    const secWebSocketExtensions = req.headers['sec-websocket-extensions'];
    const extensions = {};

    if (
      this.options.perMessageDeflate &&
      secWebSocketExtensions !== undefined
    ) {
      const perMessageDeflate = new PerMessageDeflate({
        ...this.options.perMessageDeflate,
        isServer: true,
        maxPayload: this.options.maxPayload
      });

      try {
        const offers = extension.parse(secWebSocketExtensions);

        if (offers[PerMessageDeflate.extensionName]) {
          perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
          extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
      } catch (err) {
        const message =
          'Invalid or unacceptable Sec-WebSocket-Extensions header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    //
    // Optionally call external client verification handler.
    //
    if (this.options.verifyClient) {
      const info = {
        origin:
          req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
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
    //
    // Destroy the socket if the client has already sent a FIN packet.
    //
    if (!socket.readable || !socket.writable) return socket.destroy();

    if (socket[kWebSocket]) {
      throw new Error(
        'server.handleUpgrade() was called more than once with the same ' +
          'socket, possibly due to a misconfiguration'
      );
    }

    if (this._state > RUNNING) return abortHandshake(socket, 503);

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${digest}`
    ];

    const ws = new this.options.WebSocket(null, undefined, this.options);

    if (protocols.size) {
      //
      // Optionally call external protocol selection handler.
      //
      const protocol = this.options.handleProtocols
        ? this.options.handleProtocols(protocols, req)
        : protocols.values().next().value;

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

    //
    // Allow external modification/inspection of handshake headers.
    //
    this.emit('headers', headers, req);

    socket.write(headers.concat('\r\n').join('\r\n'));
    socket.removeListener('error', socketOnError);

    ws.setSocket(socket, head, {
      allowSynchronousEvents: this.options.allowSynchronousEvents,
      maxBufferedChunks: this.options.maxBufferedChunks,
      maxFragments: this.options.maxFragments,
      maxPayload: this.options.maxPayload,
      skipUTF8Validation: this.options.skipUTF8Validation
    });

    if (this.clients) {
      this.clients.add(ws);
      ws.on('close', () => {
        this.clients.delete(ws);

        if (this._shouldEmitClose && !this.clients.size) {
          process.nextTick(emitClose, this);
        }
      });
    }

    cb(ws, req);
  }
}

module.exports = WebSocketServer;

/**
 * Add event listeners on an `EventEmitter` using a map of <event, listener>
 * pairs.
 *
 * @param {EventEmitter} server The event emitter
 * @param {Object.<String, Function>} map The listeners to add
 * @return {Function} A function that will remove the added listeners when
 *     called
 * @private
 */
function addListeners(server, map) {
  for (const event of Object.keys(map)) server.on(event, map[event]);

  return function removeListeners() {
    for (const event of Object.keys(map)) {
      server.removeListener(event, map[event]);
    }
  };
}

/**
 * Emit a `'close'` event on an `EventEmitter`.
 *
 * @param {EventEmitter} server The event emitter
 * @private
 */
function emitClose(server) {
  server._state = CLOSED;
  server.emit('close');
}

/**
 * Handle socket errors.
 *
 * @private
 */
function socketOnError() {
  this.destroy();
}

/**
 * Close the connection when preconditions are not fulfilled.
 *
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} [message] The HTTP response body
 * @param {Object} [headers] Additional HTTP response headers
 * @private
 */
function abortHandshake(socket, code, message, headers) {
  //
  // The socket is writable unless the user destroyed or ended it before calling
  // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
  // error. Handling this does not make much sense as the worst that can happen
  // is that some of the data written by the user might be discarded due to the
  // call to `socket.end()` below, which triggers an `'error'` event that in
  // turn causes the socket to be destroyed.
  //
  message = message || http.STATUS_CODES[code];
  headers = {
    Connection: 'close',
    'Content-Type': 'text/html',
    'Content-Length': Buffer.byteLength(message),
    ...headers
  };

  socket.once('finish', socket.destroy);

  socket.end(
    `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
      Object.keys(headers)
        .map((h) => `${h}: ${headers[h]}`)
        .join('\r\n') +
      '\r\n\r\n' +
      message
  );
}

/**
 * Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
 * one listener for it, otherwise call `abortHandshake()`.
 *
 * @param {WebSocketServer} server The WebSocket server
 * @param {http.IncomingMessage} req The request object
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} message The HTTP response body
 * @param {Object} [headers] The HTTP response headers
 * @private
 */
function abortHandshakeOrEmitwsClientError(
  server,
  req,
  socket,
  code,
  message,
  headers
) {
  if (server.listenerCount('wsClientError')) {
    const err = new Error(message);
    Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);

    server.emit('wsClientError', err, socket, req);
  } else {
    abortHandshake(socket, code, message, headers);
  }
}


/***/ }),

/***/ 681:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex|Readable$", "caughtErrors": "none" }] */



const EventEmitter = __nccwpck_require__(434);
const https = __nccwpck_require__(692);
const http = __nccwpck_require__(611);
const net = __nccwpck_require__(278);
const tls = __nccwpck_require__(756);
const { randomBytes, createHash } = __nccwpck_require__(982);
const { Duplex, Readable } = __nccwpck_require__(203);
const { URL } = __nccwpck_require__(16);

const PerMessageDeflate = __nccwpck_require__(376);
const Receiver = __nccwpck_require__(893);
const Sender = __nccwpck_require__(389);
const { isBlob } = __nccwpck_require__(615);

const {
  BINARY_TYPES,
  CLOSE_TIMEOUT,
  EMPTY_BUFFER,
  GUID,
  kForOnEventAttribute,
  kListener,
  kStatusCode,
  kWebSocket,
  NOOP
} = __nccwpck_require__(791);
const {
  EventTarget: { addEventListener, removeEventListener }
} = __nccwpck_require__(634);
const { format, parse } = __nccwpck_require__(335);
const { toBuffer } = __nccwpck_require__(803);

const kAborted = Symbol('kAborted');
const protocolVersions = [8, 13];
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
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
    this._protocol = '';
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;

    if (address !== null) {
      this._bufferedAmount = 0;
      this._isServer = false;
      this._redirects = 0;

      if (protocols === undefined) {
        protocols = [];
      } else if (!Array.isArray(protocols)) {
        if (typeof protocols === 'object' && protocols !== null) {
          options = protocols;
          protocols = [];
        } else {
          protocols = [protocols];
        }
      }

      initAsClient(this, address, protocols, options);
    } else {
      this._autoPong = options.autoPong;
      this._closeTimeout = options.closeTimeout;
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

    //
    // Allow to change `binaryType` on the fly.
    //
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
   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
   *     buffered data chunks
   * @param {Number} [options.maxFragments=0] The maximum number of message
   *     fragments
   * @param {Number} [options.maxPayload=0] The maximum allowed message size
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @private
   */
  setSocket(socket, head, options) {
    const receiver = new Receiver({
      allowSynchronousEvents: options.allowSynchronousEvents,
      binaryType: this.binaryType,
      extensions: this._extensions,
      isServer: this._isServer,
      maxBufferedChunks: options.maxBufferedChunks,
      maxFragments: options.maxFragments,
      maxPayload: options.maxPayload,
      skipUTF8Validation: options.skipUTF8Validation
    });

    const sender = new Sender(socket, this._extensions, options.generateMask);

    this._receiver = receiver;
    this._sender = sender;
    this._socket = socket;

    receiver[kWebSocket] = this;
    sender[kWebSocket] = this;
    socket[kWebSocket] = this;

    receiver.on('conclude', receiverOnConclude);
    receiver.on('drain', receiverOnDrain);
    receiver.on('error', receiverOnError);
    receiver.on('message', receiverOnMessage);
    receiver.on('ping', receiverOnPing);
    receiver.on('pong', receiverOnPong);

    sender.onerror = senderOnError;

    //
    // These methods may not be available if `socket` is just a `Duplex`.
    //
    if (socket.setTimeout) socket.setTimeout(0);
    if (socket.setNoDelay) socket.setNoDelay();

    if (head.length > 0) socket.unshift(head);

    socket.on('close', socketOnClose);
    socket.on('data', socketOnData);
    socket.on('end', socketOnEnd);
    socket.on('error', socketOnError);

    this._readyState = WebSocket.OPEN;
    this.emit('open');
  }

  /**
   * Emit the `'close'` event.
   *
   * @private
   */
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
      return;
    }

    if (this._extensions[PerMessageDeflate.extensionName]) {
      this._extensions[PerMessageDeflate.extensionName].cleanup();
    }

    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit('close', this._closeCode, this._closeMessage);
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
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this.readyState === WebSocket.CLOSING) {
      if (
        this._closeFrameSent &&
        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
      ) {
        this._socket.end();
      }

      return;
    }

    this._readyState = WebSocket.CLOSING;
    this._sender.close(code, data, !this._isServer, (err) => {
      //
      // This error is handled by the `'error'` listener on the socket. We only
      // want to know if the close frame has been sent here.
      //
      if (err) return;

      this._closeFrameSent = true;

      if (
        this._closeFrameReceived ||
        this._receiver._writableState.errorEmitted
      ) {
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
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
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
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
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
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Resume the socket.
   *
   * @public
   */
  resume() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
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
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    const opts = {
      binary: typeof data !== 'string',
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
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this._socket) {
      this._readyState = WebSocket.CLOSING;
      this._socket.destroy();
    }
  }
}

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'isPaused',
  'protocol',
  'readyState',
  'url'
].forEach((property) => {
  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
});

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(WebSocket.prototype, `on${method}`, {
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

      if (typeof handler !== 'function') return;

      this.addEventListener(method, handler, {
        [kForOnEventAttribute]: true
      });
    }
  });
});

WebSocket.prototype.addEventListener = addEventListener;
WebSocket.prototype.removeEventListener = removeEventListener;

module.exports = WebSocket;

/**
 * Initialize a WebSocket client.
 *
 * @param {WebSocket} websocket The client to initialize
 * @param {(String|URL)} address The URL to which to connect
 * @param {Array} protocols The subprotocols
 * @param {Object} [options] Connection options
 * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
 *     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
 *     times in the same tick
 * @param {Boolean} [options.autoPong=true] Specifies whether or not to
 *     automatically send a pong in response to a ping
 * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to wait
 *     for the closing handshake to finish after `websocket.close()` is called
 * @param {Function} [options.finishRequest] A function which can be used to
 *     customize the headers of each http request before it is sent
 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
 *     redirects
 * @param {Function} [options.generateMask] The function used to generate the
 *     masking key
 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
 *     handshake request
 * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
 *     buffered data chunks
 * @param {Number} [options.maxFragments=16384] The maximum number of message
 *     fragments
 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
 *     size
 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
 *     allowed
 * @param {String} [options.origin] Value of the `Origin` or
 *     `Sec-WebSocket-Origin` header
 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
 *     permessage-deflate
 * @param {Number} [options.protocolVersion=13] Value of the
 *     `Sec-WebSocket-Version` header
 * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
 *     not to skip UTF-8 validation for text and close messages
 * @private
 */
function initAsClient(websocket, address, protocols, options) {
  const opts = {
    allowSynchronousEvents: true,
    autoPong: true,
    closeTimeout: CLOSE_TIMEOUT,
    protocolVersion: protocolVersions[1],
    maxBufferedChunks: 256 * 1024,
    maxFragments: 16 * 1024,
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
    perMessageDeflate: true,
    followRedirects: false,
    maxRedirects: 10,
    ...options,
    socketPath: undefined,
    hostname: undefined,
    protocol: undefined,
    timeout: undefined,
    method: 'GET',
    host: undefined,
    path: undefined,
    port: undefined
  };

  websocket._autoPong = opts.autoPong;
  websocket._closeTimeout = opts.closeTimeout;

  if (!protocolVersions.includes(opts.protocolVersion)) {
    throw new RangeError(
      `Unsupported protocol version: ${opts.protocolVersion} ` +
        `(supported versions: ${protocolVersions.join(', ')})`
    );
  }

  let parsedUrl;

  if (address instanceof URL) {
    parsedUrl = address;
  } else {
    try {
      parsedUrl = new URL(address);
    } catch {
      throw new SyntaxError(`Invalid URL: ${address}`);
    }
  }

  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'ws:';
  } else if (parsedUrl.protocol === 'https:') {
    parsedUrl.protocol = 'wss:';
  }

  websocket._url = parsedUrl.href;

  const isSecure = parsedUrl.protocol === 'wss:';
  const isIpcUrl = parsedUrl.protocol === 'ws+unix:';
  let invalidUrlMessage;

  if (parsedUrl.protocol !== 'ws:' && !isSecure && !isIpcUrl) {
    invalidUrlMessage =
      'The URL\'s protocol must be one of "ws:", "wss:", ' +
      '"http:", "https:", or "ws+unix:"';
  } else if (isIpcUrl && !parsedUrl.pathname) {
    invalidUrlMessage = "The URL's pathname is empty";
  } else if (parsedUrl.hash) {
    invalidUrlMessage = 'The URL contains a fragment identifier';
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
  const key = randomBytes(16).toString('base64');
  const request = isSecure ? https.request : http.request;
  const protocolSet = new Set();
  let perMessageDeflate;

  opts.createConnection =
    opts.createConnection || (isSecure ? tlsConnect : netConnect);
  opts.defaultPort = opts.defaultPort || defaultPort;
  opts.port = parsedUrl.port || defaultPort;
  opts.host = parsedUrl.hostname.startsWith('[')
    ? parsedUrl.hostname.slice(1, -1)
    : parsedUrl.hostname;
  opts.headers = {
    ...opts.headers,
    'Sec-WebSocket-Version': opts.protocolVersion,
    'Sec-WebSocket-Key': key,
    Connection: 'Upgrade',
    Upgrade: 'websocket'
  };
  opts.path = parsedUrl.pathname + parsedUrl.search;
  opts.timeout = opts.handshakeTimeout;

  if (opts.perMessageDeflate) {
    perMessageDeflate = new PerMessageDeflate({
      ...opts.perMessageDeflate,
      isServer: false,
      maxPayload: opts.maxPayload
    });
    opts.headers['Sec-WebSocket-Extensions'] = format({
      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
    });
  }
  if (protocols.length) {
    for (const protocol of protocols) {
      if (
        typeof protocol !== 'string' ||
        !subprotocolRegex.test(protocol) ||
        protocolSet.has(protocol)
      ) {
        throw new SyntaxError(
          'An invalid or duplicated subprotocol was specified'
        );
      }

      protocolSet.add(protocol);
    }

    opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
  }
  if (opts.origin) {
    if (opts.protocolVersion < 13) {
      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
    } else {
      opts.headers.Origin = opts.origin;
    }
  }
  if (parsedUrl.username || parsedUrl.password) {
    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
  }

  if (isIpcUrl) {
    const parts = opts.path.split(':');

    opts.socketPath = parts[0];
    opts.path = parts[1];
  }

  let req;

  if (opts.followRedirects) {
    if (websocket._redirects === 0) {
      websocket._originalIpc = isIpcUrl;
      websocket._originalSecure = isSecure;
      websocket._originalHostOrSocketPath = isIpcUrl
        ? opts.socketPath
        : parsedUrl.host;

      const headers = options && options.headers;

      //
      // Shallow copy the user provided options so that headers can be changed
      // without mutating the original object.
      //
      options = { ...options, headers: {} };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          options.headers[key.toLowerCase()] = value;
        }
      }
    } else if (websocket.listenerCount('redirect') === 0) {
      const isSameHost = isIpcUrl
        ? websocket._originalIpc
          ? opts.socketPath === websocket._originalHostOrSocketPath
          : false
        : websocket._originalIpc
          ? false
          : parsedUrl.host === websocket._originalHostOrSocketPath;

      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
        //
        // Match curl 7.77.0 behavior and drop the following headers. These
        // headers are also dropped when following a redirect to a subdomain.
        //
        delete opts.headers.authorization;
        delete opts.headers.cookie;

        if (!isSameHost) delete opts.headers.host;

        opts.auth = undefined;
      }
    }

    //
    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
    // If the `Authorization` header is set, then there is nothing to do as it
    // will take precedence.
    //
    if (opts.auth && !options.headers.authorization) {
      options.headers.authorization =
        'Basic ' + Buffer.from(opts.auth).toString('base64');
    }

    req = websocket._req = request(opts);

    if (websocket._redirects) {
      //
      // Unlike what is done for the `'upgrade'` event, no early exit is
      // triggered here if the user calls `websocket.close()` or
      // `websocket.terminate()` from a listener of the `'redirect'` event. This
      // is because the user can also call `request.destroy()` with an error
      // before calling `websocket.close()` or `websocket.terminate()` and this
      // would result in an error being emitted on the `request` object with no
      // `'error'` event listeners attached.
      //
      websocket.emit('redirect', websocket.url, req);
    }
  } else {
    req = websocket._req = request(opts);
  }

  if (opts.timeout) {
    req.on('timeout', () => {
      abortHandshake(websocket, req, 'Opening handshake has timed out');
    });
  }

  req.on('error', (err) => {
    if (req === null || req[kAborted]) return;

    req = websocket._req = null;
    emitErrorAndClose(websocket, err);
  });

  req.on('response', (res) => {
    const location = res.headers.location;
    const statusCode = res.statusCode;

    if (
      location &&
      opts.followRedirects &&
      statusCode >= 300 &&
      statusCode < 400
    ) {
      if (++websocket._redirects > opts.maxRedirects) {
        abortHandshake(websocket, req, 'Maximum redirects exceeded');
        return;
      }

      req.abort();

      let addr;

      try {
        addr = new URL(location, address);
      } catch (e) {
        const err = new SyntaxError(`Invalid URL: ${location}`);
        emitErrorAndClose(websocket, err);
        return;
      }

      initAsClient(websocket, addr, protocols, options);
    } else if (!websocket.emit('unexpected-response', req, res)) {
      abortHandshake(
        websocket,
        req,
        `Unexpected server response: ${res.statusCode}`
      );
    }
  });

  req.on('upgrade', (res, socket, head) => {
    websocket.emit('upgrade', res);

    //
    // The user may have closed the connection from a listener of the
    // `'upgrade'` event.
    //
    if (websocket.readyState !== WebSocket.CONNECTING) return;

    req = websocket._req = null;

    const upgrade = res.headers.upgrade;

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      abortHandshake(websocket, socket, 'Invalid Upgrade header');
      return;
    }

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    if (res.headers['sec-websocket-accept'] !== digest) {
      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
      return;
    }

    const serverProt = res.headers['sec-websocket-protocol'];
    let protError;

    if (serverProt !== undefined) {
      if (!protocolSet.size) {
        protError = 'Server sent a subprotocol but none was requested';
      } else if (!protocolSet.has(serverProt)) {
        protError = 'Server sent an invalid subprotocol';
      }
    } else if (protocolSet.size) {
      protError = 'Server sent no subprotocol';
    }

    if (protError) {
      abortHandshake(websocket, socket, protError);
      return;
    }

    if (serverProt) websocket._protocol = serverProt;

    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

    if (secWebSocketExtensions !== undefined) {
      if (!perMessageDeflate) {
        const message =
          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
          'was requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      let extensions;

      try {
        extensions = parse(secWebSocketExtensions);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      const extensionNames = Object.keys(extensions);

      if (
        extensionNames.length !== 1 ||
        extensionNames[0] !== PerMessageDeflate.extensionName
      ) {
        const message = 'Server indicated an extension that was not requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      try {
        perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      websocket._extensions[PerMessageDeflate.extensionName] =
        perMessageDeflate;
    }

    websocket.setSocket(socket, head, {
      allowSynchronousEvents: opts.allowSynchronousEvents,
      generateMask: opts.generateMask,
      maxBufferedChunks: opts.maxBufferedChunks,
      maxFragments: opts.maxFragments,
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

/**
 * Emit the `'error'` and `'close'` events.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {Error} The error to emit
 * @private
 */
function emitErrorAndClose(websocket, err) {
  websocket._readyState = WebSocket.CLOSING;
  //
  // The following assignment is practically useless and is done only for
  // consistency.
  //
  websocket._errorEmitted = true;
  websocket.emit('error', err);
  websocket.emitClose();
}

/**
 * Create a `net.Socket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {net.Socket} The newly created socket used to start the connection
 * @private
 */
function netConnect(options) {
  options.path = options.socketPath;
  return net.connect(options);
}

/**
 * Create a `tls.TLSSocket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {tls.TLSSocket} The newly created socket used to start the connection
 * @private
 */
function tlsConnect(options) {
  options.path = undefined;

  if (!options.servername && options.servername !== '') {
    options.servername = net.isIP(options.host) ? '' : options.host;
  }

  return tls.connect(options);
}

/**
 * Abort the handshake and emit an error.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
 *     abort or the socket to destroy
 * @param {String} message The error message
 * @private
 */
function abortHandshake(websocket, stream, message) {
  websocket._readyState = WebSocket.CLOSING;

  const err = new Error(message);
  Error.captureStackTrace(err, abortHandshake);

  if (stream.setHeader) {
    stream[kAborted] = true;
    stream.abort();

    if (stream.socket && !stream.socket.destroyed) {
      //
      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
      // called after the request completed. See
      // https://github.com/websockets/ws/issues/1869.
      //
      stream.socket.destroy();
    }

    process.nextTick(emitErrorAndClose, websocket, err);
  } else {
    stream.destroy(err);
    stream.once('error', websocket.emit.bind(websocket, 'error'));
    stream.once('close', websocket.emitClose.bind(websocket));
  }
}

/**
 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {*} [data] The data to send
 * @param {Function} [cb] Callback
 * @private
 */
function sendAfterClose(websocket, data, cb) {
  if (data) {
    const length = isBlob(data) ? data.size : toBuffer(data).length;

    //
    // The `_bufferedAmount` property is used only when the peer is a client and
    // the opening handshake fails. Under these circumstances, in fact, the
    // `setSocket()` method is not called, so the `_socket` and `_sender`
    // properties are set to `null`.
    //
    if (websocket._socket) websocket._sender._bufferedBytes += length;
    else websocket._bufferedAmount += length;
  }

  if (cb) {
    const err = new Error(
      `WebSocket is not open: readyState ${websocket.readyState} ` +
        `(${readyStates[websocket.readyState]})`
    );
    process.nextTick(cb, err);
  }
}

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {Buffer} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket];

  websocket._closeFrameReceived = true;
  websocket._closeMessage = reason;
  websocket._closeCode = code;

  if (websocket._socket[kWebSocket] === undefined) return;

  websocket._socket.removeListener('data', socketOnData);
  process.nextTick(resume, websocket._socket);

  if (code === 1005) websocket.close();
  else websocket.close(code, reason);
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  const websocket = this[kWebSocket];

  if (!websocket.isPaused) websocket._socket.resume();
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket._socket[kWebSocket] !== undefined) {
    websocket._socket.removeListener('data', socketOnData);

    //
    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
    // https://github.com/websockets/ws/issues/1940.
    //
    process.nextTick(resume, websocket._socket);

    websocket.close(err[kStatusCode]);
  }

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket].emitClose();
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {Buffer|ArrayBuffer|Buffer[])} data The message
 * @param {Boolean} isBinary Specifies whether the message is binary or not
 * @private
 */
function receiverOnMessage(data, isBinary) {
  this[kWebSocket].emit('message', data, isBinary);
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket];

  if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
  websocket.emit('ping', data);
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket].emit('pong', data);
}

/**
 * Resume a readable stream
 *
 * @param {Readable} stream The readable stream
 * @private
 */
function resume(stream) {
  stream.resume();
}

/**
 * The `Sender` error event handler.
 *
 * @param {Error} The error
 * @private
 */
function senderOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket.readyState === WebSocket.CLOSED) return;
  if (websocket.readyState === WebSocket.OPEN) {
    websocket._readyState = WebSocket.CLOSING;
    setCloseTimer(websocket);
  }

  //
  // `socket.end()` is used instead of `socket.destroy()` to allow the other
  // peer to finish sending queued data. There is no need to set a timer here
  // because `CLOSING` means that it is already set or not needed.
  //
  this._socket.end();

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * Set a timer to destroy the underlying raw socket of a WebSocket.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @private
 */
function setCloseTimer(websocket) {
  websocket._closeTimer = setTimeout(
    websocket._socket.destroy.bind(websocket._socket),
    websocket._closeTimeout
  );
}

/**
 * The listener of the socket `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket];

  this.removeListener('close', socketOnClose);
  this.removeListener('data', socketOnData);
  this.removeListener('end', socketOnEnd);

  websocket._readyState = WebSocket.CLOSING;

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written. If instead, the
  // socket is paused, any possible buffered data will be read as a single
  // chunk.
  //
  if (
    !this._readableState.endEmitted &&
    !websocket._closeFrameReceived &&
    !websocket._receiver._writableState.errorEmitted &&
    this._readableState.length !== 0
  ) {
    const chunk = this.read(this._readableState.length);

    websocket._receiver.write(chunk);
  }

  websocket._receiver.end();

  this[kWebSocket] = undefined;

  clearTimeout(websocket._closeTimer);

  if (
    websocket._receiver._writableState.finished ||
    websocket._receiver._writableState.errorEmitted
  ) {
    websocket.emitClose();
  } else {
    websocket._receiver.on('error', receiverOnFinish);
    websocket._receiver.on('finish', receiverOnFinish);
  }
}

/**
 * The listener of the socket `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket]._receiver.write(chunk)) {
    this.pause();
  }
}

/**
 * The listener of the socket `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket];

  websocket._readyState = WebSocket.CLOSING;
  websocket._receiver.end();
  this.end();
}

/**
 * The listener of the socket `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket];

  this.removeListener('error', socketOnError);
  this.on('error', NOOP);

  if (websocket) {
    websocket._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}


/***/ }),

/***/ 327:
/***/ ((module) => {

module.exports = eval("require")("bufferutil");


/***/ }),

/***/ 414:
/***/ ((module) => {

module.exports = eval("require")("utf-8-validate");


/***/ }),

/***/ 181:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("buffer");

/***/ }),

/***/ 982:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("crypto");

/***/ }),

/***/ 434:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("events");

/***/ }),

/***/ 611:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("http");

/***/ }),

/***/ 692:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("https");

/***/ }),

/***/ 278:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("net");

/***/ }),

/***/ 203:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("stream");

/***/ }),

/***/ 756:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("tls");

/***/ }),

/***/ 16:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("url");

/***/ }),

/***/ 23:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("util");

/***/ }),

/***/ 106:
/***/ ((module) => {

module.exports = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("zlib");

/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __nccwpck_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	var threw = true;
/******/ 	try {
/******/ 		__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 		threw = false;
/******/ 	} finally {
/******/ 		if(threw) delete __webpack_module_cache__[moduleId];
/******/ 	}
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/compat get default export */
/******/ (() => {
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__nccwpck_require__.n = (module) => {
/******/ 		var getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__nccwpck_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__nccwpck_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__nccwpck_require__.o(definition, key) && !__nccwpck_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__nccwpck_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

// EXPORTS
__nccwpck_require__.d(__webpack_exports__, {
  Z: () => (/* binding */ parseArgs),
  e: () => (/* binding */ run)
});

;// CONCATENATED MODULE: external "node:child_process"
const external_node_child_process_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:child_process");
;// CONCATENATED MODULE: external "node:net"
const external_node_net_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:net");
var external_node_net_default = /*#__PURE__*/__nccwpck_require__.n(external_node_net_namespaceObject);
;// CONCATENATED MODULE: external "node:util"
const external_node_util_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:util");
;// CONCATENATED MODULE: external "node:crypto"
const external_node_crypto_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:crypto");
;// CONCATENATED MODULE: external "node:fs"
const external_node_fs_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:fs");
var external_node_fs_default = /*#__PURE__*/__nccwpck_require__.n(external_node_fs_namespaceObject);
;// CONCATENATED MODULE: external "node:os"
const external_node_os_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:os");
var external_node_os_default = /*#__PURE__*/__nccwpck_require__.n(external_node_os_namespaceObject);
;// CONCATENATED MODULE: external "node:path"
const external_node_path_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:path");
var external_node_path_default = /*#__PURE__*/__nccwpck_require__.n(external_node_path_namespaceObject);
;// CONCATENATED MODULE: external "node:url"
const external_node_url_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:url");
;// CONCATENATED MODULE: ./src/server/broadcaster.ts
/**
 * Owns the server-side tick: advances the race session on a fixed cadence and
 * fans full sync messages out to connected browsers.
 */
function createRaceBroadcaster(session, clock, tickMs = 250, 
/** Multiplayer only: the host-owned venue stamped on every sync so viewers
 *  render it and lock their selector. A getter lets the host rotate venues
 *  between Grands Prix. Local mode omits it. */
circuitID, 
/** Called once after the session advances onto a new Grand Prix. Multiplayer
 *  uses this boundary to choose the next venue and update its race distance
 *  before the first sync for that Grand Prix is built. */
onGrandPrixStart) {
    let timer = null;
    const clients = new Set();
    let observedGrandPrix = session.presentation().grandPrix;
    function start() {
        if (timer)
            return;
        timer = setInterval(tick, tickMs);
    }
    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }
    function addClient(send) {
        clients.add(send);
        const now = clock();
        session.advance(now);
        observeGrandPrix(now);
        const sync = buildSync(now);
        send(JSON.stringify(sync));
    }
    function removeClient(send) {
        clients.delete(send);
    }
    /** One cadence step. Public so tests can drive it with a manual clock. */
    function tick() {
        const now = clock();
        session.advance(now);
        observeGrandPrix(now);
        if (clients.size === 0)
            return; // race continues; nothing to fan out
        const json = JSON.stringify(buildSync(now));
        for (const send of clients)
            send(json);
    }
    function observeGrandPrix(now) {
        const grandPrix = session.presentation().grandPrix;
        if (grandPrix === observedGrandPrix)
            return;
        observedGrandPrix = grandPrix;
        onGrandPrixStart?.(grandPrix, now);
    }
    function buildSync(now = clock()) {
        // buildSync is public for diagnostics/tests and may be called after some
        // other session input crossed the boundary between broadcaster ticks.
        observeGrandPrix(now);
        const currentCircuitID = typeof circuitID === 'function' ? circuitID() : circuitID;
        return currentCircuitID === undefined
            ? { type: 'sync', ...session.presentation() }
            : { type: 'sync', circuitID: currentCircuitID, ...session.presentation() };
    }
    return { start, stop, addClient, removeClient, tick, buildSync };
}

;// CONCATENATED MODULE: ./src/server/rules.ts
/// Fixed game rules for the fictional Grand Prix. None of these values are
/// measurements of real work; they exist only to make status fun to watch.
/// Values are the Swift RaceRules constants verbatim.
const RaceRules = {
    totalLaps: 58,
    /** Nominal seconds per lap at pace 1.0. */
    baseLapDuration: 18,
    /** Nominal working velocity in laps per second. */
    baseSpeed: 1 / 18,
    paceMin: 0.75,
    paceMax: 1.25,
    /** Done cooldown display motion relative to nominal base speed. */
    doneCooldownFactor: 0.25,
    /** A single elapsed step larger than this is capped so sleep/debugger
     *  pauses cannot award a block of phantom laps. */
    maximumAcceptedStep: 1.0,
    podiumDuration: 8.0,
    /** A live new entrant starts this many laps behind the current last car. */
    newEntrantDeficit: 0.15,
    /** How long the transient NEW STINT treatment stays visible (race seconds). */
    newStintDuration: 4.0,
    /** Pace of the still-running cars while the yellow flag is out, relative to
     *  nominal. A stopped car brings out the safety car, so the rest of the field
     *  slows and holds position instead of racing past the incident. Scoring is
     *  genuinely slowed — not just the animation — so the standings a viewer reads
     *  match the motion they watched. */
    safetyCarFactor: 0.4,
    /** Number of distinct constructor liveries available. Must match the length
     *  of palette.teamColors on the client: slots are handed out in the palette's
     *  max-contrast order, and teams beyond it fall back to pattern outlines. */
    paletteSize: 11,
    maximumGridNumber: 99,
    /** Team radio lines retained per Grand Prix; older ones fall off the back. */
    radioHistoryLimit: 40,
};
const MASK_64 = 0xffffffffffffffffn;
/** FNV-1a 64-bit: deliberately process-independent so colors and numbers stay
 *  approximately stable across launches (mirrors Swift RaceIdentity). */
function stableHash(value) {
    let hash = 14695981039346656037n;
    for (const byte of new TextEncoder().encode(value)) {
        hash ^= BigInt(byte);
        hash = (hash * 1099511628211n) & MASK_64;
    }
    return hash;
}
/** Rules for the multiplayer two-car mode (design decisions M1–M8). Cars are
 *  fictional; these constants shape how real agent activity becomes speed. */
const MultiplayerRules = {
    /** Cars fielded per team, like a real constructor (M1). A participant with a
     *  single agent fields one car (M5). */
    carsPerTeam: 2,
    /** Crew agents working at once for full power — M3's k. At 1, scale buys
     *  availability (someone is always working) rather than raw speed. */
    crewPowerCap: 1,
    /** Sliding window (seconds) the rolling uptime is measured over (M4). The
     *  momentum dial: shorter is jumpier, longer is heavier. */
    uptimeWindowSeconds: 90,
    /** Car speed factor = uptimeFloor + uptimeSpan × rolling uptime (M4). */
    uptimeFloor: 0.75,
    uptimeSpan: 0.5,
    /** Per-lap random jitter half-width. Multiplayer speed is earned via uptime;
     *  randomness stays as flavor only (±5% against local's ±25%). */
    paceJitterHalfWidth: 0.05,
    /** Continuous mode keeps state and uptime legible by narrowing flavour. */
    continuousPaceJitterHalfWidth: 0.005,
    /** Continuous cars always circulate close to nominal pace. Activity is a
     *  small advantage rather than enough to split the field quickly. */
    cruisingFactor: 0.98,
    continuousWorkingBonusSpan: 0.02,
    /** Green-flag recovery assist. Every follower is eligible, but the boost is
     *  added to its own pace only after it falls outside the nearby racing pack.
     *  It does not guarantee that a slower car closes on the car ahead. */
    continuousCatchupMax: 0.04,
    continuousCatchupStartGap: 0.1,
    continuousCatchupFullGap: 0.5,
    /** Eight tenths of a car-marker length, allowing at most 20% visual overlap.
     *  The existing Safety Car gap is about 1.5 marker lengths, so
     *  0.025 / 1.5 * 0.8 keeps both rules in one scale. */
    continuousCatchupTargetGap: 1 / 75,
    /** A working car close behind a cruising car gets a short passing burst.
     *  It disappears as soon as the pass is complete or the target works. */
    continuousOvertakeBoost: 0.04,
    continuousOvertakeRange: 0.08,
    /** Working consumes 80 points of tyre life over 20 nominal laps. Worn
     *  tyres lose up to 0.01x before the mandatory stop at 20%, preserving a
     *  small intrinsic advantage over a 0.98x cruising car. */
    tireLifeFresh: 100,
    tireLifePitThreshold: 20,
    tireWearStartsAt: 50,
    tireWorkingSecondsToPit: 20 * RaceRules.baseLapDuration,
    tirePenaltyMax: 0.01,
    pitEntrySeconds: 1.4,
    pitServiceSeconds: 4,
    pitExitSeconds: 1.4,
    safetyCarLeaderFactor: 0.4,
    safetyCarCatchupFactor: 0.8,
    /** Approximate 1.5 marker lengths as a fraction of a lap. */
    safetyCarQueueGap: 0.025,
    safetyCarCatchupRange: 0.25,
    greenFlagDuration: 3,
};
/** Production pace: seeded pseudo-random, reproducible across launches for
 *  the same grand prix sequence and terminal, varying lap to lap. */
const seededPace = (grandPrix, terminalID, lap) => {
    const hash = stableHash(`${grandPrix}|${terminalID}|${lap}`) ^ 0x5deece66n;
    // A second mix avalanches the low bits before the modulo.
    const mixed = ((hash ^ (hash >> 33n)) * 0xff51afd7ed558ccdn) & MASK_64;
    const unit = Number(mixed % 100000n) / 99999;
    return RaceRules.paceMin + unit * (RaceRules.paceMax - RaceRules.paceMin);
};
/** Multiplayer pace: the same seeded randomness squeezed into the jitter band.
 *  Rank is meant to be earned through uptime (M3/M4); the dice only flavor. */
const multiplayerPace = (grandPrix, terminalID, lap) => {
    const scale = MultiplayerRules.paceJitterHalfWidth / (RaceRules.paceMax - 1);
    return 1 + (seededPace(grandPrix, terminalID, lap) - 1) * scale;
};
const continuousMultiplayerPace = (grandPrix, terminalID, lap) => {
    const scale = MultiplayerRules.continuousPaceJitterHalfWidth / (RaceRules.paceMax - 1);
    return 1 + (seededPace(grandPrix, terminalID, lap) - 1) * scale;
};

;// CONCATENATED MODULE: ./src/server/fixtures.ts

const FIXTURE_NAMES = ['grid', 'dense', 'redflag', 'error', 'podium'];
/** Deterministic grids used to review the dashboard without a live herdr. */
function loadFixture(name, session) {
    switch (name) {
        case 'dense':
            dense(session);
            break;
        case 'redflag':
            connectionFixture(session, { kind: 'offline' });
            break;
        case 'error':
            connectionFixture(session, { kind: 'protocolError', detail: 'Invalid Herdr response: malformed snapshot' });
            break;
        case 'podium':
            podium(session);
            break;
        default: grid(session);
    }
}
function agent(id, tab, kind, status, focused = false) {
    return {
        terminalID: id, paneID: `pane-${id}`, tabLabel: tab,
        agentKind: kind, agentSessionReference: null, isFocused: focused, status,
    };
}
function snapshot(teams) {
    return { teams: teams.map(([id, label, agents]) => ({ id, label, agents })) };
}
/** Boots a live race, lets everyone work for staggered spans so distances
 *  spread out, then applies the final statuses. */
function race(session, teams, seconds) {
    const asWorking = (a) => ({ ...a, status: 'working' });
    const working = teams.map(([id, label, agents]) => [id, label, agents.map(asWorking)]);
    session.applySnapshot(snapshot(working), 0);
    session.applyConnection({ kind: 'live' }, 0);
    session.advance(0);
    let now = 0;
    // Deterministic mixing: settle agents in stable-hash order so the same
    // fixture always produces the same spread of distances.
    const flattened = teams
        .flatMap(([, , agents]) => agents)
        .sort((a, b) => (stableHash(a.terminalID) < stableHash(b.terminalID) ? -1 : 1));
    const stagger = seconds / Math.max(1, flattened.length);
    const settled = new Map();
    flattened.forEach((item, index) => {
        const target = (index + 1) * stagger;
        while (now < target - 1e-9) {
            now = Math.min(now + 1, target);
            session.advance(now);
        }
        settled.set(item.terminalID, item);
        const mixed = teams.map(([id, label, agents]) => [id, label, agents.map(a => settled.get(a.terminalID) ?? asWorking(a))]);
        session.applySnapshot(snapshot(mixed), now);
    });
}
function standardTeams() {
    return [
        ['ws-herdr', 'herdr', [
                agent('t1', 'core', 'claude', 'working'),
                agent('t2', 'socket', 'codex', 'working', true),
            ]],
        ['ws-pet', 'herdr-f1', [
                agent('t4', 'dashboard', 'claude', 'working'),
                agent('t6', 'standings', 'codex', 'blocked'),
            ]],
        ['ws-console', 'console-api', [
                agent('t8', 'billing', 'codex', 'working'),
                agent('t9', 'auth', 'claude', 'idle'),
            ]],
        ['ws-infra', 'infra-tools', [
                agent('t10', 'deploy', 'claude', 'working'),
                agent('t11', 'monitor', 'aider', 'done'),
            ]],
    ];
}
function grid(session) {
    race(session, standardTeams(), 400);
}
function dense(session) {
    const statuses = ['working', 'working', 'idle', 'done', 'blocked'];
    const teams = Array.from({ length: 14 }, (_, index) => {
        const id = `ws-${index}`;
        const label = `project-${index}`;
        const agents = Array.from({ length: (index % 3) + 1 }, (_, slot) => agent(`d${index}-${slot}`, `pane-${slot}`, slot % 2 === 0 ? 'claude' : 'codex', statuses[(index + slot) % statuses.length]));
        return [id, label, agents];
    });
    race(session, teams, 300);
}
function connectionFixture(session, state) {
    race(session, standardTeams(), 400);
    session.applyConnection(state, 500);
}
function podium(session) {
    race(session, standardTeams(), 120);
    let now = 500;
    while (session.presentation().phase === 'live' && now < 500 + 60 * 60) {
        now += 1;
        session.advance(now);
    }
}

;// CONCATENATED MODULE: external "node:readline"
const external_node_readline_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:readline");
;// CONCATENATED MODULE: external "node:timers/promises"
const promises_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:timers/promises");
;// CONCATENATED MODULE: ./src/server/herdr/projector.ts
// herdr 0.8.0 ships protocol 19; the snapshot fields the projector reads
// (workspaces/tabs/agents with object agent_session) are unchanged since 16.
const SUPPORTED_PROTOCOL = 19;
/** Any malformed, unsupported, or server-reported protocol problem. */
class HerdrProtocolFault extends Error {
}
/** Protocols newer than SUPPORTED_PROTOCOL are projected anyway — every field
 *  read is already defensive — but each one is announced once on the server
 *  terminal so odd telemetry is traceable to the version gap. */
const warnedProtocols = new Set();
const STATUSES = new Set(['idle', 'working', 'done', 'blocked']);
/** Unwraps a session.snapshot response envelope and projects it. */
function decodeSnapshotResponse(envelope) {
    const result = envelope?.result;
    if (typeof result !== 'object' || result === null) {
        throw new HerdrProtocolFault('Invalid Herdr response: missing result');
    }
    if (result.type !== 'session_snapshot') {
        throw new HerdrProtocolFault(`Unsupported Herdr response: ${String(result.type)}`);
    }
    return projectSnapshot(result.snapshot);
}
function projectSnapshot(snapshot) {
    const raw = snapshot;
    if (typeof raw !== 'object' || raw === null ||
        !Array.isArray(raw.workspaces) || !Array.isArray(raw.agents)) {
        throw new HerdrProtocolFault('Invalid Herdr response: malformed snapshot');
    }
    if (typeof raw.protocol !== 'number') {
        throw new HerdrProtocolFault(`Unsupported Herdr protocol ${String(raw.protocol)}`);
    }
    if (raw.protocol > SUPPORTED_PROTOCOL && !warnedProtocols.has(raw.protocol)) {
        warnedProtocols.add(raw.protocol);
        console.warn(`Herdr speaks protocol ${raw.protocol}, newer than the supported ${SUPPORTED_PROTOCOL}. ` +
            'Continuing anyway; update Herdr F1 if telemetry looks wrong.');
    }
    const tabs = new Map();
    for (const tab of (Array.isArray(raw.tabs) ? raw.tabs : [])) {
        if (typeof tab?.tab_id === 'string')
            tabs.set(tab.tab_id, tab);
    }
    const focusedPaneID = typeof raw.focused_pane_id === 'string' ? raw.focused_pane_id : null;
    const agentsByWorkspace = new Map();
    for (const agent of raw.agents) {
        const status = agent?.agent_status;
        if (typeof status !== 'string' || !STATUSES.has(status))
            continue;
        const workspaceID = String(agent.workspace_id ?? '');
        const paneID = String(agent.pane_id ?? '');
        const entry = {
            terminalID: String(agent.terminal_id ?? ''),
            paneID,
            tabLabel: tabLabel(agent, tabs),
            agentKind: firstVisible(agent.display_agent, agent.agent, agent.name) ?? 'Agent',
            agentSessionReference: sessionReference(agent),
            isFocused: agent.focused === true || (focusedPaneID !== null && paneID === focusedPaneID),
            status: status,
        };
        const list = agentsByWorkspace.get(workspaceID) ?? [];
        list.push(entry);
        agentsByWorkspace.set(workspaceID, list);
    }
    const teams = [];
    for (const workspace of raw.workspaces) {
        const id = workspace?.workspace_id;
        if (typeof id !== 'string')
            continue;
        const agents = agentsByWorkspace.get(id);
        if (!agents || agents.length === 0)
            continue;
        teams.push({ id, label: workspace.label ?? id, agents });
    }
    return { teams };
}
function tabLabel(agent, tabs) {
    const tabID = typeof agent.tab_id === 'string' ? agent.tab_id : null;
    const tab = tabID === null ? undefined : tabs.get(tabID);
    if (!tab)
        return tabID ?? String(agent.pane_id ?? '');
    return firstVisible(tab.label, tab.title, tab.name) ?? tabID;
}
/** Opaque identity token used only for NEW STINT detection; never shown. */
function sessionReference(agent) {
    const session = agent.agent_session;
    if (session && firstVisible(session.value) !== null) {
        return [session.source, session.kind, session.value]
            .filter((part) => typeof part === 'string' && part.length > 0)
            .join('|');
    }
    return firstVisible(agent.agent_session_id, agent.agent_session_path);
}
function firstVisible(...values) {
    for (const value of values) {
        if (typeof value !== 'string')
            continue;
        const trimmed = value.trim();
        if (trimmed.length > 0)
            return trimmed;
    }
    return null;
}

;// CONCATENATED MODULE: ./src/server/herdr/types.ts
function allAgents(snapshot) {
    return snapshot.teams.flatMap(team => team.agents);
}

;// CONCATENATED MODULE: ./src/server/herdr/client.ts







const defaultSocketPath = external_node_path_default().join(external_node_os_default().homedir(), '.config', 'herdr', 'herdr.sock');
const BROADCAST_SUBSCRIPTIONS = [
    'workspace.created', 'workspace.updated', 'workspace.metadata_updated',
    'workspace.renamed', 'workspace.moved', 'workspace.closed', 'workspace.focused',
    'tab.created', 'tab.closed', 'tab.focused', 'tab.renamed', 'tab.moved',
    'pane.created', 'pane.closed', 'pane.focused', 'pane.moved', 'pane.exited',
    'pane.agent_detected',
];
/** Every subscribed event invalidates the snapshot. `pane.updated` is
 *  deliberately omitted: it fires on terminal-title churn and would amount to
 *  output polling. Canonical names use underscores; protocol 17+ dot names are
 *  normalized at the event boundary and legacy underscore names still work. */
const INVALIDATION_EVENTS = new Set([
    ...BROADCAST_SUBSCRIPTIONS.map(canonicalEventName),
    'pane_agent_status_changed',
]);
function subscriptionRequest(id, agentPaneIDs) {
    const subscriptions = BROADCAST_SUBSCRIPTIONS.map(type => ({ type }));
    // Agent status is a per-pane subscription in the herdr protocol.
    for (const paneID of agentPaneIDs) {
        subscriptions.push({ type: 'pane.agent_status_changed', pane_id: paneID });
    }
    return { id, method: 'events.subscribe', params: { subscriptions } };
}
/**
 * Event-driven herdr transport. herdr answers exactly one request per
 * connection and then closes it, so session.snapshot and agent.focus each use
 * a short-lived connection. Event subscriptions live on one long-lived
 * connection that accepts a single events.subscribe at connect time; because
 * pane.agent_status_changed is per-pane, the client resubscribes with a fresh
 * connection whenever the set of agent panes changes. Every relevant event
 * triggers an authoritative snapshot refresh — there is no polling.
 */
function createHerdrClient(options = {}) {
    const socketPath = options.socketPath ?? defaultSocketPath;
    const initialReconnectDelayMs = options.initialReconnectDelayMs ?? 1000;
    const maximumReconnectDelayMs = options.maximumReconnectDelayMs ?? 30000;
    let requestSequence = 0;
    let started = false;
    let stopped = false;
    const stopController = new AbortController();
    let eventSocket = null;
    let reachedLive = false;
    /** Current terminal → pane mapping from the latest snapshot. herdr's focus
     *  request targets the pane, while the durable car identity is the terminal;
     *  this bridges the two. */
    let paneByTerminal = new Map();
    function start(onUpdate) {
        if (started)
            return;
        started = true;
        onUpdate({ kind: 'connection', state: { kind: 'waiting' } });
        void monitor(onUpdate);
    }
    function stop() {
        stopped = true;
        // Aborts a pending reconnect backoff, so a stopped client never keeps the
        // process alive waiting on a sleep timer.
        stopController.abort();
        eventSocket?.destroy();
        eventSocket = null;
    }
    async function focus(terminalID) {
        // Only focus terminals present in the latest authoritative snapshot.
        const target = paneByTerminal.get(terminalID);
        if (!target)
            return;
        requestSequence += 1;
        const envelope = await requestOnce({
            id: `focus-${requestSequence}`,
            method: 'agent.focus',
            params: { target },
        });
        if (envelope.error)
            throw serverFault(envelope.error);
    }
    async function monitor(onUpdate) {
        let delayMs = initialReconnectDelayMs;
        while (!stopped) {
            reachedLive = false;
            try {
                await connectOnce(onUpdate);
            }
            catch (error) {
                if (stopped)
                    return;
                if (error instanceof HerdrProtocolFault) {
                    onUpdate({ kind: 'connection', state: { kind: 'protocolError', detail: error.message } });
                }
                else {
                    onUpdate({ kind: 'connection', state: { kind: reachedLive ? 'offline' : 'waiting' } });
                }
            }
            if (stopped)
                return;
            if (reachedLive)
                delayMs = initialReconnectDelayMs;
            try {
                await (0,promises_namespaceObject.setTimeout)(delayMs, undefined, { signal: stopController.signal });
            }
            catch {
                return; // stop() aborted the backoff
            }
            delayMs = Math.min(delayMs * 2, maximumReconnectDelayMs);
        }
    }
    /** Runs one connected session until the transport fails. */
    async function connectOnce(onUpdate) {
        let snapshot = await fetchSnapshot();
        onUpdate({ kind: 'snapshot', snapshot });
        // Each pass subscribes with the current agent-pane set; a refresh that
        // changes that set falls through to resubscribe.
        while (true) {
            if (stopped)
                return;
            const agentPanes = new Set(allAgents(snapshot).map(agent => agent.paneID));
            const socket = await connectSocket(socketPath);
            eventSocket = socket;
            try {
                requestSequence += 1;
                const subscribeID = `subscribe-${requestSequence}`;
                socket.write(JSON.stringify(subscriptionRequest(subscribeID, [...agentPanes].sort())) + '\n');
                const reader = (0,external_node_readline_namespaceObject.createInterface)({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
                const first = await reader.next();
                if (first.done)
                    throw new Error('connection reset');
                const ack = parseEnvelope(first.value);
                if (ack.error)
                    throw serverFault(ack.error);
                if (ack.id !== subscribeID || ack.result?.type !== 'subscription_started') {
                    throw new HerdrProtocolFault('Unsupported Herdr response: events.subscribe was not acknowledged');
                }
                reachedLive = true;
                onUpdate({ kind: 'connection', state: { kind: 'live' } });
                // Authoritative refresh once the subscription is active, closing the
                // gap between the bootstrap snapshot and the first event.
                snapshot = await fetchSnapshot();
                onUpdate({ kind: 'snapshot', snapshot });
                if (!sameSet(paneSet(snapshot), agentPanes))
                    continue;
                let resubscribe = false;
                while (!resubscribe) {
                    const next = await reader.next();
                    if (next.done)
                        throw new Error('connection reset');
                    if (stopped)
                        return;
                    const envelope = parseEnvelope(next.value);
                    if (typeof envelope.event !== 'string' || typeof envelope.data !== 'object' || envelope.data === null) {
                        throw new HerdrProtocolFault('Invalid Herdr response: event envelope is incomplete');
                    }
                    if (!INVALIDATION_EVENTS.has(canonicalEventName(envelope.event)))
                        continue;
                    // Refreshes run one at a time on this loop; events arriving
                    // meanwhile stay buffered on the socket.
                    snapshot = await fetchSnapshot();
                    onUpdate({ kind: 'snapshot', snapshot });
                    resubscribe = !sameSet(paneSet(snapshot), agentPanes);
                }
            }
            finally {
                if (eventSocket === socket)
                    eventSocket = null;
                socket.destroy();
            }
        }
    }
    // MARK: - One-shot requests
    async function fetchSnapshot() {
        requestSequence += 1;
        const envelope = await requestOnce({
            id: `snapshot-${requestSequence}`,
            method: 'session.snapshot',
            params: {},
        });
        if (envelope.error)
            throw serverFault(envelope.error);
        const snapshot = decodeSnapshotResponse(envelope);
        paneByTerminal = new Map(allAgents(snapshot).map(agent => [agent.terminalID, agent.paneID]));
        return snapshot;
    }
    async function requestOnce(payload) {
        const socket = await connectSocket(socketPath);
        try {
            socket.write(JSON.stringify(payload) + '\n');
            for await (const line of (0,external_node_readline_namespaceObject.createInterface)({ input: socket, crlfDelay: Infinity })) {
                return parseEnvelope(line);
            }
            throw new Error('herdr closed the connection before responding');
        }
        finally {
            socket.destroy();
        }
    }
    return { start, stop, focus };
}
// MARK: - Transport helpers
function connectSocket(socketPath) {
    return new Promise((resolve, reject) => {
        const socket = external_node_net_default().createConnection(socketPath);
        const onError = (error) => reject(error);
        socket.once('error', onError);
        socket.once('connect', () => {
            socket.removeListener('error', onError);
            resolve(socket);
        });
    });
}
function parseEnvelope(line) {
    let value;
    try {
        value = JSON.parse(line);
    }
    catch {
        throw new HerdrProtocolFault('Invalid Herdr response: expected a JSON object');
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new HerdrProtocolFault('Invalid Herdr response: expected a JSON object');
    }
    return value;
}
function serverFault(error) {
    const fault = error;
    if (typeof fault?.code === 'string' && typeof fault?.message === 'string') {
        return new HerdrProtocolFault(`Herdr error ${fault.code}: ${fault.message}`);
    }
    return new HerdrProtocolFault('Invalid Herdr response: invalid error response');
}
function paneSet(snapshot) {
    return new Set(allAgents(snapshot).map(agent => agent.paneID));
}
function sameSet(a, b) {
    if (a.size !== b.size)
        return false;
    for (const value of a)
        if (!b.has(value))
            return false;
    return true;
}
function canonicalEventName(name) {
    return name.replaceAll('.', '_');
}

;// CONCATENATED MODULE: ./src/server/radio.ts

/**
 * Team radio phrasing. Every line is invented race commentary chosen from a
 * fixed script by status transition — the dashboard never reads terminal
 * output, so no agent text can ever reach here.
 *
 * Selection is a pure function of the seed, so one transition keeps the same
 * line for as long as it stays in the history window: sync re-sends the whole
 * window several times a second and the text must not flicker between them.
 */
const SCRIPTS = {
    boxBox: [
        'Box this lap, box this lap.',
        'In the pits, in the pits.',
        'Coming in for service.',
        'Understood, box now.',
    ],
    greenAgain: [
        "Out of the pits, let's go.",
        'Back to green, pushing now.',
        'Clear track ahead, hammer time.',
        'Rejoining the circuit.',
    ],
    incident: [
        "We have a problem, I'm stopping.",
        "Something's not right, need help.",
        'Losing power, pulling over.',
        "I'm stuck out here.",
    ],
    recovered: [
        'All clear, back under way.',
        'Recovered, resuming the race.',
        'Problem solved, back to it.',
        'Good to go again.',
    ],
    chequered: [
        "That's the chequered flag. Great job.",
        'Race complete, well done everyone.',
        'Crossed the line. Superb work.',
        "That's a finish, brilliant stuff.",
    ],
    newStint: [
        'New driver in the car.',
        'Fresh stint, fresh tyres.',
        'Driver change complete.',
        'New hands on the wheel.',
    ],
    retired: [
        "That's a retirement. Into the garage.",
        'Car is out of the race.',
        'Retiring the car, that is all.',
        "We're done for today.",
    ],
};
/**
 * Picks the radio line for one transition. The seed should identify the
 * transition (terminal, lap, kind) so replays of the same event read
 * identically and tests stay deterministic.
 */
function radioText(kind, seed) {
    const script = SCRIPTS[kind];
    const index = Number(stableHash(`${kind}|${seed}`) % BigInt(script.length));
    return script[index];
}

;// CONCATENATED MODULE: ./src/server/race-session.ts


/**
 * In-memory race state owner. Consumes authoritative projected herdr
 * snapshots, connection state, and monotonic time (seconds); publishes a
 * complete RacePresentation. All race records are fictional game state that
 * lives only as long as this object. Official distance advances exclusively
 * from accepted elapsed race time, never from render frames.
 */
function createRaceSession(paceSource = seededPace, 
/** Wall clock used only to stamp team radio. The race itself runs on the
 *  monotonic clock passed to advance(); this is injected separately so tests
 *  get stable timestamps. */
wallClock = () => new Date(), options = {}) {
    const raceMode = options.raceMode ?? 'classic';
    let lastTick = null;
    /** Race distance for the circuit currently being raced. Session state rather
     *  than a constant, because each venue has its own published distance and the
     *  dashboard can switch circuits mid-session. */
    let totalLaps = RaceRules.totalLaps;
    /** Accepted live seconds since the current Grand Prix started. */
    let raceTime = 0;
    let podiumElapsed = 0;
    let phase = 'awaitingGrid';
    let grandPrix = 1;
    let connection = { kind: 'waiting' };
    let hasSnapshot = false;
    let frozenPodium = null;
    let controlPhase = 'green';
    let safetyQueue = [];
    let safetyCarDistance = 0;
    let withdrawalLine = 0;
    let greenFlagUntil = 0;
    const entries = new Map();
    let nextBootstrapIndex = 0;
    /** Terminals present in the most recent authoritative snapshot. Absence
     *  from this set (not socket loss) is what retires an entry. */
    let presentInLatestSnapshot = new Set();
    const numberAssignments = new Map();
    const usedNumbers = new Set();
    const teamTokens = new Map();
    const usedPaletteSlots = new Set();
    let nextPatternSlot = 0;
    const teamOrder = new Map();
    let nextTeamOrder = 0;
    const teamLabels = new Map();
    /** Recent team radio for the current Grand Prix, oldest first. */
    let radio = [];
    let nextRadioID = 1;
    // MARK: - Inputs
    function apply(update, now) {
        if (update.kind === 'snapshot')
            applySnapshot(update.snapshot, now);
        else
            applyConnection(update.state, now);
    }
    function applyConnection(state, now) {
        if (connectionEquals(state, connection))
            return;
        // Settle scored time up to this instant, then break the tick chain so
        // frozen (offline/error) duration is excluded when live returns.
        advance(now);
        connection = state;
        lastTick = null;
    }
    function applySnapshot(snapshot, now) {
        advance(now);
        reconcile(snapshot);
    }
    /** Advances race time to `now` (monotonic seconds). A single step is capped
     *  at one second so suspensions cannot award phantom laps; time only counts
     *  while the herdr connection is live. */
    function advance(now) {
        const elapsed = lastTick === null
            ? 0
            : Math.min(Math.max(0, now - lastTick), RaceRules.maximumAcceptedStep);
        lastTick = now;
        if (connection.kind !== 'live' || elapsed <= 0)
            return;
        step(elapsed);
    }
    // MARK: - Simulation
    function step(elapsed) {
        switch (phase) {
            case 'awaitingGrid':
                return;
            case 'live':
                raceTime += elapsed;
                if (raceMode === 'continuous')
                    scoreContinuous(elapsed);
                else
                    scoreLive(elapsed);
                return;
            case 'podium':
                raceTime += elapsed;
                podiumElapsed += elapsed;
                coolDownDisplays(elapsed);
                if (podiumElapsed >= RaceRules.podiumDuration)
                    startNextGrandPrix();
        }
    }
    function scoreLive(elapsed) {
        // Sampled once for the whole step: the probe pass below and the commit pass
        // that follows must score against the same track condition, or a car could
        // be found to finish at a pace it is then not advanced at.
        const paceFactor = fieldPaceFactor();
        // The first individual to reach the finish ends the race, so everyone only
        // advances up to the earliest finish instant within this step.
        let earliestFinish = elapsed;
        let finisher = null;
        for (const entry of entries.values()) {
            if (!isDriving(entry))
                continue;
            const official = { value: entry.official };
            const pace = { ...entry.pace };
            const unused = walk(official, pace, entry.terminalID, elapsed, paceFactor * entry.externalPace);
            if (official.value >= totalLaps) {
                const finishTime = elapsed - unused;
                if (finishTime < earliestFinish || (finishTime === earliestFinish && finisher === null)) {
                    earliestFinish = finishTime;
                    finisher = entry.terminalID;
                }
                else if (finishTime === earliestFinish && finisher !== null &&
                    compareOrderKeys(orderKey(entries.get(finisher)), orderKey(entry)) > 0) {
                    finisher = entry.terminalID;
                }
            }
        }
        const budget = finisher === null ? elapsed : earliestFinish;
        for (const entry of entries.values()) {
            if (isDriving(entry)) {
                const official = { value: entry.official };
                walk(official, entry.pace, entry.terminalID, budget, paceFactor * entry.externalPace);
                entry.display += official.value - entry.official;
                entry.official = official.value;
            }
            else if (entry.status === 'done' && !entry.isRetired) {
                entry.display +=
                    budget * RaceRules.baseSpeed * RaceRules.doneCooldownFactor * paceFactor;
            }
        }
        if (finisher !== null)
            finishGrandPrix();
    }
    function scoreContinuous(elapsed) {
        if (controlPhase === 'greenFlag' && raceTime >= greenFlagUntil)
            controlPhase = 'green';
        advancePitCycles(elapsed);
        if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
            safetyQueue = safetyQueue.filter(id => {
                const entry = entries.get(id);
                return entry !== undefined && isContinuousRunner(entry);
            });
            appendMissingQueueRunners();
            scoreSafetyCar(elapsed);
            return;
        }
        scoreContinuousGreen(elapsed);
    }
    function scoreContinuousGreen(elapsed) {
        // Freeze the factors for this scoring step. The finish probe and commit
        // pass must use the same rubber-band correction, even if a pass would
        // change the order by the end of the step.
        const plan = continuousGreenPlan();
        const factors = plan.factors;
        let earliestFinish = elapsed;
        let finisher = null;
        for (const [index, entry] of plan.runners.entries()) {
            const official = { value: entry.official };
            const pace = { ...entry.pace };
            const unused = walk(official, pace, entry.terminalID, elapsed, factors.get(entry.terminalID) ?? continuousNormalFactor(entry));
            // A pace-matched follower cannot finish through the car ahead. Only the
            // current leader and cars with an explicit working pass may set the
            // finish time in the independent probe.
            if (official.value >= totalLaps && (index === 0 || plan.canPass.has(entry.terminalID))) {
                const finishTime = elapsed - unused;
                if (finishTime < earliestFinish || (finishTime === earliestFinish && finisher === null)) {
                    earliestFinish = finishTime;
                    finisher = entry.terminalID;
                }
            }
        }
        const budget = finisher === null ? elapsed : earliestFinish;
        let ahead;
        for (const entry of plan.runners) {
            const before = entry.official;
            const official = { value: entry.official };
            walk(official, entry.pace, entry.terminalID, budget, factors.get(entry.terminalID) ?? continuousNormalFactor(entry));
            const mayPass = plan.canPass.has(entry.terminalID);
            if (ahead && !mayPass) {
                const limit = ahead.official
                    - (plan.holdingGaps.get(entry.terminalID)
                        ?? MultiplayerRules.continuousCatchupTargetGap);
                official.value = Math.min(official.value, Math.max(before, limit));
            }
            entry.official = official.value;
            entry.display = official.value;
            ahead = entry;
        }
        wearContinuousTires(budget);
        if (finisher !== null)
            finishGrandPrix();
    }
    function scoreSafetyCar(elapsed) {
        const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
        let neutralized = elapsed;
        let greenRemainder = 0;
        if (controlPhase === 'inThisLap' && leader) {
            const secondsToLine = Math.max(0, (withdrawalLine - leader.official) /
                (RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor));
            if (secondsToLine <= elapsed) {
                neutralized = secondsToLine;
                greenRemainder = elapsed - secondsToLine;
            }
        }
        advanceSafetyQueue(neutralized);
        if ([...entries.values()].some(entry => entry.official >= totalLaps && isContinuousRunner(entry))) {
            finishGrandPrix();
            return;
        }
        if (greenRemainder > 0 || (controlPhase === 'inThisLap' && leader?.official === withdrawalLine)) {
            controlPhase = 'greenFlag';
            greenFlagUntil = raceTime - greenRemainder + MultiplayerRules.greenFlagDuration;
            safetyQueue = [];
            if (greenRemainder > 0)
                scoreContinuousGreen(greenRemainder);
        }
    }
    function advanceSafetyQueue(elapsed) {
        if (elapsed <= 0)
            return;
        safetyCarDistance += RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor * elapsed;
        let ahead = null;
        for (const id of safetyQueue) {
            const entry = entries.get(id);
            if (!entry || !isContinuousRunner(entry))
                continue;
            const factor = ahead === null
                ? MultiplayerRules.safetyCarLeaderFactor
                : safetyCarFollowerFactor(ahead, entry);
            const proposed = entry.official + RaceRules.baseSpeed * factor * elapsed;
            entry.official = ahead === null
                ? proposed
                : Math.max(entry.official, Math.min(proposed, ahead.official - MultiplayerRules.safetyCarQueueGap));
            entry.display = entry.official;
            ahead = entry;
        }
    }
    function safetyCarFollowerFactor(ahead, entry) {
        const excess = Math.max(0, ahead.official - entry.official - MultiplayerRules.safetyCarQueueGap);
        const ratio = Math.min(1, excess / MultiplayerRules.safetyCarCatchupRange);
        return MultiplayerRules.safetyCarLeaderFactor
            + ratio * (MultiplayerRules.safetyCarCatchupFactor - MultiplayerRules.safetyCarLeaderFactor);
    }
    function isContinuousRunner(entry) {
        return !entry.isRetired
            && !entry.isQueuedNextGrid
            && !isLiveBlocked(entry)
            && entry.pitState === 'racing';
    }
    function continuousNormalFactor(entry) {
        const stateFactor = entry.isLastKnown || entry.crewState !== 'working'
            ? MultiplayerRules.cruisingFactor
            : Math.min(1 + MultiplayerRules.continuousWorkingBonusSpan, Math.max(1, entry.externalPace));
        return stateFactor - continuousTirePenalty(entry);
    }
    function continuousTirePenalty(entry) {
        const wornRange = MultiplayerRules.tireWearStartsAt
            - MultiplayerRules.tireLifePitThreshold;
        const worn = MultiplayerRules.tireWearStartsAt - entry.tireLife;
        return MultiplayerRules.tirePenaltyMax * Math.min(1, Math.max(0, worn / wornRange));
    }
    /** Individual-car green-flag pace. A distant follower receives a recovery
     *  boost on top of its own natural pace; nearby cars run naturally, so the
     *  field does not converge into an evenly spaced train. The assist cannot
     *  create an overtake. A live WORKING car is the sole exception: natural
     *  pace can pass another car, with an extra burst against a non-working or
     *  offline car inside the passing range. */
    function continuousGreenPlan() {
        const runners = [...entries.values()]
            .filter(isContinuousRunner)
            .sort((a, b) => b.official - a.official || compareOrderKeys(orderKey(a), orderKey(b)));
        const factors = new Map();
        const actualFactors = new Map();
        const naturalFactors = new Map();
        const canPass = new Set();
        const holdingGaps = new Map();
        const leaderPace = runners[0] ? currentPaceMultiplier(runners[0]) : 1;
        const leaderActual = runners[0]
            ? leaderPace * continuousNormalFactor(runners[0])
            : 0;
        runners.forEach((entry, index) => {
            const pace = currentPaceMultiplier(entry);
            const naturalActual = pace * continuousNormalFactor(entry);
            const ahead = index > 0 ? runners[index - 1] : undefined;
            const gapToAhead = ahead ? Math.max(0, ahead.official - entry.official) : Infinity;
            const canPassCruiser = entry.crewState === 'working'
                && !entry.isLastKnown
                && ahead !== undefined
                && (ahead.crewState !== 'working' || ahead.isLastKnown)
                && gapToAhead <= MultiplayerRules.continuousOvertakeRange;
            let actual = naturalActual;
            if (ahead) {
                const aheadActual = actualFactors.get(ahead.terminalID) ?? leaderActual;
                const aheadNatural = naturalFactors.get(ahead.terminalID) ?? aheadActual;
                const workingPass = entry.crewState === 'working'
                    && !entry.isLastKnown
                    && gapToAhead <= MultiplayerRules.continuousOvertakeRange
                    && (canPassCruiser || naturalActual > aheadNatural + 1e-9);
                if (!workingPass && gapToAhead <= MultiplayerRules.continuousCatchupTargetGap) {
                    actual = aheadActual;
                    // Cars may join or start at the same coordinate. Hold the intended
                    // spacing rather than preserving that overlap forever; the commit
                    // cap lets the car ahead open the gap without moving anyone back.
                    holdingGaps.set(entry.terminalID, MultiplayerRules.continuousCatchupTargetGap);
                }
                else {
                    const catchupRange = MultiplayerRules.continuousCatchupFullGap
                        - MultiplayerRules.continuousCatchupStartGap;
                    const gapShare = Math.min(1, Math.max(0, (gapToAhead - MultiplayerRules.continuousCatchupStartGap) / catchupRange));
                    const catchup = MultiplayerRules.continuousCatchupMax * gapShare;
                    // Cap every follower against the leader rather than compounding
                    // +0.04x down a long train. Basing the assist on the follower's own
                    // pace means it recovers large deficits without being guaranteed to
                    // close every nearby gap.
                    actual = Math.max(actual, Math.min(naturalActual + catchup, leaderActual + MultiplayerRules.continuousCatchupMax));
                    if (workingPass) {
                        if (canPassCruiser)
                            actual += MultiplayerRules.continuousOvertakeBoost;
                        canPass.add(entry.terminalID);
                    }
                    else {
                        holdingGaps.set(entry.terminalID, MultiplayerRules.continuousCatchupTargetGap);
                    }
                }
            }
            naturalFactors.set(entry.terminalID, naturalActual);
            actualFactors.set(entry.terminalID, actual);
            factors.set(entry.terminalID, actual / pace);
        });
        return { runners, factors, canPass, holdingGaps };
    }
    function currentPaceMultiplier(entry) {
        return entry.pace.lap === -1 ? 1 : entry.pace.multiplier;
    }
    function advancePitCycles(elapsed) {
        for (const entry of entries.values()) {
            if (entry.pitState === 'racing')
                continue;
            let remaining = elapsed;
            while (remaining > 1e-12 && entry.pitState !== 'racing') {
                const used = Math.min(remaining, entry.pitPhaseRemaining);
                entry.pitPhaseRemaining -= used;
                remaining -= used;
                if (entry.pitPhaseRemaining > 1e-12)
                    break;
                if (entry.pitState === 'pitIn') {
                    entry.pitState = 'pitting';
                    entry.pitPhaseRemaining = MultiplayerRules.pitServiceSeconds;
                }
                else if (entry.pitState === 'pitting') {
                    entry.tireLife = MultiplayerRules.tireLifeFresh;
                    entry.pitState = 'pitOut';
                    entry.pitPhaseRemaining = MultiplayerRules.pitExitSeconds;
                }
                else {
                    entry.pitState = 'racing';
                    entry.pitPhaseRemaining = 0;
                }
            }
        }
    }
    function wearContinuousTires(elapsed) {
        const wearPerSecond = (MultiplayerRules.tireLifeFresh - MultiplayerRules.tireLifePitThreshold) / MultiplayerRules.tireWorkingSecondsToPit;
        for (const entry of entries.values()) {
            if (!isContinuousRunner(entry))
                continue;
            if (entry.crewState !== 'working' || entry.isLastKnown)
                continue;
            entry.tireLife = Math.max(MultiplayerRules.tireLifePitThreshold, entry.tireLife - elapsed * wearPerSecond);
            if (entry.tireLife > MultiplayerRules.tireLifePitThreshold + 1e-9)
                continue;
            entry.pitState = 'pitIn';
            entry.pitPhaseRemaining = MultiplayerRules.pitEntrySeconds;
        }
    }
    function pitTimeRemaining(entry) {
        switch (entry.pitState) {
            case 'racing': return null;
            case 'pitIn':
                return entry.pitPhaseRemaining
                    + MultiplayerRules.pitServiceSeconds
                    + MultiplayerRules.pitExitSeconds;
            case 'pitting':
                return entry.pitPhaseRemaining + MultiplayerRules.pitExitSeconds;
            case 'pitOut': return entry.pitPhaseRemaining;
        }
    }
    function isDriving(entry) {
        return entry.status === 'working' && !entry.isRetired && !entry.isQueuedNextGrid;
    }
    /** A car stopped on the circuit: blocked, but still in this race and not
     *  parked in the pit lane. This is the whole yellow-flag condition — an agent
     *  that blocked while idle is in its pit box, which needs no marshals.
     *
     *  Retired and next-grid cars are excluded because they are not on the
     *  circuit at all; a race would otherwise stay permanently yellow for a
     *  terminal that has already gone away. */
    function causesYellowFlag(entry) {
        if (raceMode === 'continuous')
            return isLiveBlocked(entry);
        return entry.status === 'blocked'
            && !entry.isRetired
            && !entry.isQueuedNextGrid
            && !entry.incidentInPit;
    }
    function isLiveBlocked(entry) {
        return entry.crewState === 'blocked'
            && !entry.isLastKnown
            && !entry.isRetired
            && !entry.isQueuedNextGrid;
    }
    /** True while any car is stopped on the circuit. Read once per scoring step
     *  and once per presentation, so the pace the field runs at and the flag the
     *  dashboard shows always come from the same condition. */
    function isYellowFlag() {
        for (const entry of entries.values()) {
            if (causesYellowFlag(entry))
                return true;
        }
        return false;
    }
    /** Speed scale applied to every running car. The safety car neutralizes the
     *  race: the field slows, but nobody stops and gaps are preserved, since one
     *  factor applied to everyone leaves the relative order untouched. */
    function fieldPaceFactor() {
        return isYellowFlag() ? RaceRules.safetyCarFactor : 1;
    }
    /** Advances `official.value` by up to `budget` seconds, resampling pace at
     *  each official lap boundary and stopping exactly at the finish.
     *  Returns the unused part of the budget (non-zero only at the finish).
     *
     *  `paceFactor` neutralizes the field behind the safety car. It scales the
     *  speed rather than the budget so the lap-boundary walk stays exact: pace is
     *  still resampled per official lap, and the finish is still hit dead on. */
    function walk(official, pace, terminalID, budget, paceFactor) {
        const finish = totalLaps;
        let remaining = budget;
        while (remaining > 1e-12 && official.value < finish) {
            const lap = Math.min(Math.floor(official.value), totalLaps - 1);
            if (pace.lap !== lap) {
                pace.multiplier = clampPace(paceSource(grandPrix, terminalID, lap));
                pace.lap = lap;
            }
            const speed = RaceRules.baseSpeed * pace.multiplier * paceFactor;
            const boundary = Math.min(lap + 1, finish);
            const timeToBoundary = (boundary - official.value) / speed;
            // The epsilon snaps float-accumulated distance onto exact lap
            // boundaries so lap labels and the finish stay crisp.
            if (timeToBoundary <= remaining + 1e-9) {
                official.value = boundary;
                remaining = Math.max(0, remaining - timeToBoundary);
            }
            else {
                official.value += remaining * speed;
                remaining = 0;
            }
        }
        return remaining;
    }
    function coolDownDisplays(elapsed) {
        // Podium victory lap: slow display-only motion; the result is frozen.
        for (const entry of entries.values()) {
            if (entry.isRetired || entry.isQueuedNextGrid)
                continue;
            if (raceMode === 'continuous') {
                if (isLiveBlocked(entry))
                    continue;
            }
            else if (entry.status !== 'working' && entry.status !== 'done')
                continue;
            entry.display += elapsed * RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
        }
    }
    // MARK: - Grand Prix lifecycle
    function finishGrandPrix() {
        const standings = rankedTeams();
        frozenPodium = {
            grandPrix: grandPrix,
            top: standings.slice(0, 3).map(standing => ({
                rank: standing.rank,
                label: standing.label,
                colorToken: standing.colorToken,
                distance: standing.distance,
            })),
        };
        phase = 'podium';
        podiumElapsed = 0;
    }
    function startNextGrandPrix() {
        grandPrix += 1;
        dropAbsentRetiredEntries();
        resetGrid();
        phase = 'live';
        frozenPodium = null;
    }
    function dropAbsentRetiredEntries() {
        for (const entry of [...entries.values()]) {
            if (!entry.isRetired || presentInLatestSnapshot.has(entry.terminalID))
                continue;
            entries.delete(entry.terminalID);
            // Retired numbers were held for the whole race; free them now.
            const number = numberAssignments.get(entry.terminalID);
            if (number !== undefined) {
                numberAssignments.delete(entry.terminalID);
                usedNumbers.delete(number);
            }
        }
    }
    function resetGrid() {
        raceTime = 0;
        podiumElapsed = 0;
        // Radio belongs to the Grand Prix that produced it.
        radio = [];
        controlPhase = 'green';
        safetyQueue = [];
        safetyCarDistance = 0;
        withdrawalLine = 0;
        greenFlagUntil = 0;
        const orderedIDs = [...entries.keys()].sort((a, b) => compareOrderKeys(orderKey(entries.get(a)), orderKey(entries.get(b))));
        const circulating = [];
        for (const id of orderedIDs) {
            const entry = entries.get(id);
            entry.official = 0;
            entry.display = 0;
            entry.pace = { multiplier: 1, lap: -1 };
            entry.tireLife = MultiplayerRules.tireLifeFresh;
            entry.pitState = 'racing';
            entry.pitPhaseRemaining = 0;
            entry.isQueuedNextGrid = false;
            entry.newStintUntil = null;
            entry.incidentInPit = false;
            if (raceMode === 'classic' && (entry.status === 'done' || entry.status === 'blocked')) {
                circulating.push(id);
            }
        }
        // Done cooldown and incident markers restart on deterministic,
        // non-overlapping display positions around the circuit.
        circulating.forEach((id, index) => {
            entries.get(id).display = (index + 1) / (circulating.length + 1);
        });
    }
    function orderKey(entry) {
        return [
            teamOrder.get(entry.teamID) ?? Number.MAX_SAFE_INTEGER,
            entry.bootstrapIndex,
            entry.terminalID,
        ];
    }
    // MARK: - Team radio
    /** Appends one radio line for a transition that just happened, trimming the
     *  oldest once the window is full. Callers must only fire this on a real
     *  transition — never on a snapshot that merely restates known state. */
    function emitRadio(entry, kind) {
        const lap = lapOf(entry, totalLaps);
        const id = nextRadioID++;
        radio.push({
            id,
            kind,
            terminalID: entry.terminalID,
            carNumber: entry.carNumber,
            colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
            teamLabel: teamLabels.get(entry.teamID) ?? entry.teamID,
            tabLabel: entry.tabLabel,
            lap,
            timeText: clockText(wallClock()),
            // Seeded by the transition itself, so the line a viewer is reading never
            // changes underneath them as sync re-sends the window.
            text: radioText(kind, `${grandPrix}|${entry.terminalID}|${lap}|${id}`),
        });
        if (radio.length > RaceRules.radioHistoryLimit) {
            radio = radio.slice(radio.length - RaceRules.radioHistoryLimit);
        }
    }
    /** The status change a radio line should announce, or null when the
     *  transition is not worth breaking radio silence for. */
    function radioKindFor(previous, next) {
        if (next === 'blocked')
            return 'incident';
        if (previous === 'blocked')
            return 'recovered';
        if (next === 'done')
            return 'chequered';
        if (previous === 'working' && next === 'idle')
            return 'boxBox';
        if (previous === 'idle' && next === 'working')
            return 'greenAgain';
        return null;
    }
    // MARK: - Snapshot reconciliation
    function reconcile(snapshot) {
        const bootstrapping = !hasSnapshot;
        hasSnapshot = true;
        for (const team of snapshot.teams) {
            teamLabels.set(team.id, team.label);
            if (!teamOrder.has(team.id))
                teamOrder.set(team.id, nextTeamOrder++);
        }
        assignTeamTokens(snapshot.teams.map(team => team.id));
        // The bootstrap snapshot establishes the grid rather than changing it;
        // announcing it would open every race with a burst of radio for cars that
        // never actually did anything.
        const announces = !bootstrapping;
        const seen = new Set();
        const newcomers = [];
        for (const team of snapshot.teams) {
            for (const agent of team.agents) {
                seen.add(agent.terminalID);
                if (entries.has(agent.terminalID))
                    updateEntry(agent, team.id, announces);
                else
                    newcomers.push([agent, team.id]);
            }
        }
        // Collisions resolve in deterministic terminal-ID order without
        // renumbering existing or retired cars.
        newcomers.sort(([a], [b]) => compareStrings(a.terminalID, b.terminalID));
        for (const [agent, teamID] of newcomers)
            addEntry(agent, teamID);
        presentInLatestSnapshot = seen;
        for (const [id, entry] of entries) {
            if (seen.has(id) || entry.isRetired)
                continue;
            entry.isRetired = true;
            if (announces)
                emitRadio(entry, 'retired');
        }
        if (raceMode === 'continuous' && phase === 'live')
            refreshContinuousControl();
        if (bootstrapping) {
            phase = 'live';
            resetGrid();
            if (raceMode === 'continuous')
                refreshContinuousControl();
        }
    }
    function updateEntry(agent, teamID, announces) {
        const entry = entries.get(agent.terminalID);
        // A terminal reappearing before race end restores its existing entry.
        entry.isRetired = false;
        // A live workspace move transfers the entry and its whole distance.
        entry.teamID = teamID;
        if (entry.sessionReference !== null &&
            agent.agentSessionReference !== null &&
            entry.sessionReference !== agent.agentSessionReference) {
            entry.newStintUntil = raceTime + RaceRules.newStintDuration;
            if (announces)
                emitRadio(entry, 'newStint');
        }
        if (agent.agentSessionReference !== null) {
            entry.sessionReference = agent.agentSessionReference;
        }
        if (entry.status !== agent.status) {
            const kind = radioKindFor(entry.status, agent.status);
            if (agent.status === 'blocked') {
                entry.incidentInPit = entry.status === 'idle' || entry.isQueuedNextGrid;
            }
            else {
                entry.incidentInPit = false;
            }
            entry.status = agent.status;
            // Emitted after the status lands so the line quotes the new state.
            if (announces && kind !== null)
                emitRadio(entry, kind);
        }
        entry.crewState = agent.crewState ?? agent.status;
        entry.crewCounts = agent.crewCounts ?? countsForStatus(agent.status);
        entry.isLastKnown = agent.isLastKnown ?? false;
        entry.tabLabel = agent.tabLabel;
        entry.agentKind = agent.agentKind;
        entry.isFocused = agent.isFocused;
    }
    function addEntry(agent, teamID) {
        const entry = {
            terminalID: agent.terminalID,
            carNumber: assignNumber(agent.terminalID),
            teamID,
            tabLabel: agent.tabLabel,
            agentKind: agent.agentKind,
            sessionReference: agent.agentSessionReference,
            status: agent.status,
            crewState: agent.crewState ?? agent.status,
            crewCounts: agent.crewCounts ?? countsForStatus(agent.status),
            isLastKnown: agent.isLastKnown ?? false,
            isFocused: agent.isFocused,
            official: 0,
            display: 0,
            pace: { multiplier: 1, lap: -1 },
            externalPace: 1,
            tireLife: MultiplayerRules.tireLifeFresh,
            pitState: 'racing',
            pitPhaseRemaining: 0,
            isRetired: false,
            isQueuedNextGrid: false,
            incidentInPit: false,
            newStintUntil: null,
            bootstrapIndex: nextBootstrapIndex++,
        };
        if (phase === 'live') {
            // Join just behind the current last-place car, clamped at zero.
            const actives = [...entries.values()]
                .filter(other => !other.isRetired && !other.isQueuedNextGrid)
                .map(other => other.official);
            const lowest = actives.length > 0 ? Math.min(...actives) : RaceRules.newEntrantDeficit;
            entry.official = Math.max(0, lowest - RaceRules.newEntrantDeficit);
            entry.display = entry.official;
        }
        else if (phase === 'podium') {
            entry.isQueuedNextGrid = true;
        }
        entries.set(agent.terminalID, entry);
    }
    function refreshContinuousControl() {
        const blocked = [...entries.values()].filter(isLiveBlocked);
        if (blocked.length > 0) {
            if (controlPhase === 'green' || controlPhase === 'greenFlag') {
                safetyQueue = runningOrder();
                const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
                safetyCarDistance = (leader?.official ?? Math.max(0, ...blocked.map(entry => entry.official)))
                    + MultiplayerRules.safetyCarQueueGap;
            }
            else {
                safetyQueue = safetyQueue.filter(id => {
                    const entry = entries.get(id);
                    return entry !== undefined && isContinuousRunner(entry);
                });
                appendMissingQueueRunners();
            }
            controlPhase = 'deployed';
            return;
        }
        if (controlPhase === 'deployed') {
            appendMissingQueueRunners();
            const leader = safetyQueue.length > 0 ? entries.get(safetyQueue[0]) : undefined;
            withdrawalLine = leader ? Math.floor(leader.official) + 1 : 0;
            controlPhase = leader ? 'inThisLap' : 'greenFlag';
            if (!leader)
                greenFlagUntil = raceTime + MultiplayerRules.greenFlagDuration;
            return;
        }
        if (controlPhase === 'inThisLap')
            appendMissingQueueRunners();
    }
    function runningOrder() {
        return [...entries.values()]
            .filter(isContinuousRunner)
            .sort((a, b) => b.official - a.official || compareOrderKeys(orderKey(a), orderKey(b)))
            .map(entry => entry.terminalID);
    }
    function appendMissingQueueRunners() {
        const present = new Set(safetyQueue);
        const missing = runningOrder().filter(id => !present.has(id));
        for (const id of missing) {
            const entry = entries.get(id);
            const tail = safetyQueue.length > 0 ? entries.get(safetyQueue[safetyQueue.length - 1]) : undefined;
            if (tail) {
                entry.official = Math.max(0, tail.official - MultiplayerRules.safetyCarQueueGap);
                entry.display = entry.official;
            }
            safetyQueue.push(id);
        }
    }
    // MARK: - Identity assignment
    function assignNumber(terminalID) {
        const existing = numberAssignments.get(terminalID);
        if (existing !== undefined)
            return existing;
        const preferred = Number(stableHash(terminalID) % BigInt(RaceRules.maximumGridNumber)) + 1;
        for (let probe = 0; probe < RaceRules.maximumGridNumber; probe += 1) {
            const candidate = ((preferred - 1 + probe) % RaceRules.maximumGridNumber) + 1;
            if (!usedNumbers.has(candidate)) {
                numberAssignments.set(terminalID, candidate);
                usedNumbers.add(candidate);
                return candidate;
            }
        }
        throw new Error(`grid is limited to ${RaceRules.maximumGridNumber} cars`);
    }
    function assignTeamTokens(ids) {
        // Existing assignments are preserved. The palette itself is ordered as a
        // max-contrast sequence, so handing out the first free slot makes a small
        // field much easier to scan than starting from an arbitrary hash (which
        // could give the first two teams neighboring blues or reds). Sorting a
        // batch keeps bootstrap assignment deterministic; later arrivals take the
        // next visually distinct slot without changing anyone already racing.
        const unseen = ids.filter(id => !teamTokens.has(id)).sort(compareStrings);
        for (const id of unseen) {
            let assigned = null;
            for (let slot = 0; slot < RaceRules.paletteSize; slot += 1) {
                if (!usedPaletteSlots.has(slot)) {
                    assigned = slot;
                    break;
                }
            }
            if (assigned !== null) {
                teamTokens.set(id, { kind: 'palette', slot: assigned });
                usedPaletteSlots.add(assigned);
            }
            else {
                teamTokens.set(id, { kind: 'pattern', slot: nextPatternSlot++ });
            }
        }
    }
    // MARK: - Presentation
    function presentation() {
        const teams = rankedTeams();
        const currentOverlay = overlay();
        return {
            raceMode,
            phase: phase,
            grandPrix: grandPrix,
            headerLap: headerLap(),
            totalLaps,
            teams,
            podium: frozenPodium,
            connection: connection,
            overlay: currentOverlay,
            flag: flag(teams),
            raceControl: raceControl(teams),
            radio: [...radio],
        };
    }
    function raceControl(teams) {
        if (raceMode !== 'continuous')
            return { kind: 'green' };
        if (controlPhase === 'greenFlag')
            return { kind: 'greenFlag' };
        if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
            const terminalIDs = teams.flatMap(team => team.entries)
                .filter(entry => entry.causesYellowFlag)
                .map(entry => entry.id);
            return {
                kind: 'safetyCar',
                phase: controlPhase,
                terminalIDs,
                safetyCarProgress: controlPhase === 'deployed'
                    ? safetyCarDistance - Math.floor(safetyCarDistance)
                    : null,
            };
        }
        return { kind: 'green' };
    }
    /** Track condition, read off the entries already presented so the flag and
     *  the cars flagged can never disagree. Standings order carries through,
     *  which makes the list stable between syncs. */
    function flag(teams) {
        const terminalIDs = teams
            .flatMap(team => team.entries)
            .filter(entry => entry.causesYellowFlag)
            .map(entry => entry.id);
        return terminalIDs.length === 0 ? { kind: 'green' } : { kind: 'yellow', terminalIDs };
    }
    function headerLap() {
        let leader = 0;
        for (const entry of entries.values()) {
            if (!entry.isQueuedNextGrid)
                leader = Math.max(leader, entry.official);
        }
        return Math.min(totalLaps, Math.floor(leader) + 1);
    }
    function rankedTeams() {
        // One condition for the whole presentation: every entry reports the display
        // speed it is actually being scored at.
        const paceFactor = fieldPaceFactor();
        const continuousFactors = raceMode === 'continuous'
            ? continuousGreenPlan().factors
            : undefined;
        // A workspace whose every entry has retired leaves the standings (and the
        // podium) entirely. The entries themselves stay in the session, so a
        // terminal reappearing before race end restores the team with its
        // distance intact.
        const groups = new Map();
        for (const entry of entries.values()) {
            const members = groups.get(entry.teamID) ?? [];
            members.push(entry);
            groups.set(entry.teamID, members);
        }
        // Quantized distances keep ordering stable against float noise.
        const quantized = (value) => Math.round(value * 1e6);
        const ordered = [...groups.entries()]
            .filter(([, members]) => members.some(member => !member.isRetired))
            .map(([id, members]) => ({
            id,
            distance: members.reduce((sum, member) => sum + member.official, 0),
            members,
        }))
            .sort((a, b) => quantized(b.distance) - quantized(a.distance) ||
            (teamOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                (teamOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
            compareStrings(a.id, b.id));
        const leaderDistance = ordered[0]?.distance ?? 0;
        return ordered.map((teamGroup, index) => ({
            id: teamGroup.id,
            rank: index + 1,
            label: teamLabels.get(teamGroup.id) ?? teamGroup.id,
            colorToken: teamTokens.get(teamGroup.id) ?? { kind: 'palette', slot: 0 },
            distance: teamGroup.distance,
            distanceText: `${teamGroup.distance.toFixed(1)} LAPS`,
            gapText: index === 0 ? '—' : gapText(leaderDistance - teamGroup.distance),
            isOffline: teamGroup.members.every(entry => entry.isLastKnown),
            blockedCount: teamGroup.members.filter(entry => isLiveBlocked(entry)).length,
            entries: teamGroup.members
                .slice()
                .sort((a, b) => quantized(b.official) - quantized(a.official) ||
                a.carNumber - b.carNumber ||
                compareStrings(a.terminalID, b.terminalID))
                .map(entry => present(entry, paceFactor, continuousFactors)),
        }));
    }
    function present(entry, paceFactor, continuousFactors) {
        const lap = lapOf(entry, totalLaps);
        const progress = entry.display - Math.floor(entry.display);
        let placement;
        let statusText;
        if (entry.isQueuedNextGrid) {
            placement = { kind: 'nextGrid' };
            statusText = 'NEXT GRID';
        }
        else if (entry.isRetired) {
            placement = { kind: 'retired' };
            statusText = `RETIRED · LAP ${lap}`;
        }
        else if (raceMode === 'continuous') {
            if (isLiveBlocked(entry)) {
                placement = { kind: 'incidentTrack', progress };
                statusText = `INCIDENT · LAP ${lap}`;
            }
            else if (entry.pitState === 'pitIn' || entry.pitState === 'pitting') {
                placement = { kind: 'pit' };
                statusText = entry.pitState === 'pitIn' ? 'PIT IN' : 'PITTING';
            }
            else if (entry.pitState === 'pitOut') {
                placement = { kind: 'track', progress };
                statusText = 'PIT OUT';
            }
            else {
                placement = { kind: 'track', progress };
                statusText = `LAP ${lap}`;
            }
        }
        else {
            switch (entry.status) {
                case 'working':
                    placement = { kind: 'track', progress };
                    statusText = `LAP ${lap}`;
                    break;
                case 'idle':
                    placement = { kind: 'pit' };
                    statusText = 'PIT';
                    break;
                case 'done':
                    placement = { kind: 'cooldown', progress };
                    statusText = `DONE · LAP ${lap}`;
                    break;
                case 'blocked':
                    placement = entry.incidentInPit ? { kind: 'incidentPit' } : { kind: 'incidentTrack', progress };
                    statusText = `INCIDENT · LAP ${lap}`;
                    break;
            }
        }
        return {
            id: entry.terminalID,
            carNumber: entry.carNumber,
            teamID: entry.teamID,
            workspaceLabel: teamLabels.get(entry.teamID) ?? entry.teamID,
            tabLabel: entry.tabLabel,
            agentKind: entry.agentKind,
            status: entry.status,
            crewState: entry.crewState,
            crewCounts: { ...entry.crewCounts },
            isLastKnown: entry.isLastKnown,
            colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
            officialDistance: entry.official,
            lap,
            statusText,
            placement,
            displaySpeed: displaySpeed(entry, paceFactor, continuousFactors),
            tireLife: raceMode === 'continuous' ? entry.tireLife : null,
            pitState: raceMode === 'continuous' ? entry.pitState : 'none',
            pitTimeRemaining: raceMode === 'continuous' ? pitTimeRemaining(entry) : null,
            isFocused: entry.isFocused,
            showsNewStint: entry.newStintUntil !== null && raceTime < entry.newStintUntil,
            causesYellowFlag: causesYellowFlag(entry),
        };
    }
    /** Display motion in laps/second the client uses to extrapolate between
     *  syncs. Mirrors the motion the server itself applies in step(). */
    function displaySpeed(entry, paceFactor, continuousFactors) {
        if (connection.kind !== 'live')
            return 0;
        if (entry.isRetired || entry.isQueuedNextGrid)
            return 0;
        if (phase === 'live') {
            if (raceMode === 'continuous') {
                if (!isContinuousRunner(entry))
                    return 0;
                if (controlPhase === 'deployed' || controlPhase === 'inThisLap') {
                    const index = safetyQueue.indexOf(entry.terminalID);
                    if (index < 0)
                        return 0;
                    if (index === 0)
                        return RaceRules.baseSpeed * MultiplayerRules.safetyCarLeaderFactor;
                    const ahead = entries.get(safetyQueue[index - 1]);
                    return RaceRules.baseSpeed * (ahead
                        ? safetyCarFollowerFactor(ahead, entry)
                        : MultiplayerRules.safetyCarLeaderFactor);
                }
                return RaceRules.baseSpeed
                    * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier)
                    * (continuousFactors?.get(entry.terminalID) ?? continuousNormalFactor(entry));
            }
            if (entry.status === 'working') {
                return RaceRules.baseSpeed
                    * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier)
                    * paceFactor
                    * entry.externalPace;
            }
            if (entry.status === 'done') {
                return RaceRules.baseSpeed * RaceRules.doneCooldownFactor * paceFactor;
            }
            return 0;
        }
        if (phase === 'podium' && (entry.status === 'working' || entry.status === 'done')) {
            return RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
        }
        return 0;
    }
    function overlay() {
        if (connection.kind === 'protocolError') {
            return { kind: 'suspended', detail: connection.detail };
        }
        if (!hasSnapshot)
            return { kind: 'formationLap' };
        if (connection.kind !== 'live')
            return { kind: 'redFlag' };
        if ([...entries.values()].every(entry => entry.isRetired))
            return { kind: 'noCarsOnGrid' };
        return { kind: 'none' };
    }
    /** Sets the race distance for the selected circuit.
     *
     *  Distance already covered is kept: cars stay where they are and the finish
     *  moves. Shortening it below what the leader has already run would leave the
     *  race unfinishable by the normal path, so that case finishes the Grand Prix
     *  immediately — the same outcome as a car crossing the line. */
    function setTotalLaps(laps, now) {
        const next = Math.max(1, Math.floor(laps));
        if (next === totalLaps)
            return;
        advance(now);
        totalLaps = next;
        if (phase !== 'live')
            return;
        for (const entry of entries.values()) {
            if (!entry.isQueuedNextGrid && entry.official >= totalLaps) {
                finishGrandPrix();
                return;
            }
        }
    }
    /** Injects a live speed factor for one car (multiplayer uptime, M4). Settles
     *  scored time first so the new factor applies only from this instant. */
    function setExternalPace(terminalID, factor, now) {
        const entry = entries.get(terminalID);
        if (!entry)
            return;
        const next = Math.min(Math.max(factor, 0), 2);
        if (next === entry.externalPace)
            return;
        advance(now);
        entry.externalPace = next;
    }
    return { apply, applyConnection, applySnapshot, advance, presentation, setTotalLaps, setExternalPace };
}
// MARK: - Helpers
function clampPace(value) {
    return Math.min(Math.max(value, RaceRules.paceMin), RaceRules.paceMax);
}
/** Local wall-clock `HH:MM:SS`. */
function clockText(now) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
/** One-based lap from official distance, capped at the finish. Shared so the
 *  lap a radio line quotes always matches the standings. */
function lapOf(entry, totalLaps) {
    return Math.min(totalLaps, Math.floor(entry.official) + 1);
}
function gapText(gap) {
    if (gap < 1)
        return `+${(gap * RaceRules.baseLapDuration).toFixed(1)}s`;
    return `+${gap.toFixed(1)} LAPS`;
}
function connectionEquals(a, b) {
    if (a.kind !== b.kind)
        return false;
    if (a.kind === 'protocolError' && b.kind === 'protocolError')
        return a.detail === b.detail;
    return true;
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
function compareOrderKeys(a, b) {
    return a[0] - b[0] || a[1] - b[1] || compareStrings(a[2], b[2]);
}
function countsForStatus(status) {
    return {
        working: status === 'working' ? 1 : 0,
        idle: status === 'idle' ? 1 : 0,
        done: status === 'done' ? 1 : 0,
        blocked: status === 'blocked' ? 1 : 0,
    };
}

;// CONCATENATED MODULE: external "node:http"
const external_node_http_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:http");
var external_node_http_default = /*#__PURE__*/__nccwpck_require__.n(external_node_http_namespaceObject);
// EXTERNAL MODULE: ./node_modules/ws/lib/stream.js
var stream = __nccwpck_require__(412);
// EXTERNAL MODULE: ./node_modules/ws/lib/extension.js
var extension = __nccwpck_require__(335);
// EXTERNAL MODULE: ./node_modules/ws/lib/permessage-deflate.js
var permessage_deflate = __nccwpck_require__(376);
// EXTERNAL MODULE: ./node_modules/ws/lib/receiver.js
var receiver = __nccwpck_require__(893);
// EXTERNAL MODULE: ./node_modules/ws/lib/sender.js
var sender = __nccwpck_require__(389);
// EXTERNAL MODULE: ./node_modules/ws/lib/subprotocol.js
var subprotocol = __nccwpck_require__(951);
// EXTERNAL MODULE: ./node_modules/ws/lib/websocket.js
var websocket = __nccwpck_require__(681);
// EXTERNAL MODULE: ./node_modules/ws/lib/websocket-server.js
var websocket_server = __nccwpck_require__(129);
;// CONCATENATED MODULE: ./node_modules/ws/wrapper.mjs











/* harmony default export */ const wrapper = ((/* unused pure expression or super */ null && (WebSocket)));

;// CONCATENATED MODULE: ./src/server/server.ts






const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.map': 'application/json',
    '.woff2': 'font/woff2',
    // Required for the install prompt: served as the octet-stream fallback the
    // browser ignores the manifest entirely and the app is not installable.
    '.webmanifest': 'application/manifest+json',
};
async function startServer(options) {
    const webRoot = external_node_path_default().resolve(options.webRoot);
    const server = external_node_http_default().createServer((request, response) => serveStatic(webRoot, request, response));
    const port = await listenOnFreePort(server, options.port, options.bindHost ?? '127.0.0.1');
    const sockets = new websocket_server({
        noServer: true,
        maxPayload: 4096,
        perMessageDeflate: false,
    });
    // Join payloads carry a whole agent roster, so they get a larger (but still
    // bounded) frame budget than the tiny viewer messages.
    const joinSockets = options.onJoin
        ? new websocket_server({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false })
        : null;
    const allowedOrigin = `http://127.0.0.1:${port}`;
    const originAllowed = (request) => options.viewerOrigin === 'host'
        ? typeof request.headers.host === 'string' && request.headers.origin === `http://${request.headers.host}`
        : request.headers.origin === allowedOrigin;
    server.on('upgrade', (request, socket, head) => {
        if (request.url === '/join' && joinSockets && options.onJoin) {
            joinSockets.handleUpgrade(request, socket, head, client => options.onJoin(client));
            return;
        }
        if (request.url !== '/ws' || !originAllowed(request)) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
            socket.destroy();
            return;
        }
        sockets.handleUpgrade(request, socket, head, client => {
            sockets.emit('connection', client, request);
        });
    });
    sockets.on('connection', socket => {
        const send = (json) => {
            if (socket.readyState === socket.OPEN)
                socket.send(json);
        };
        options.broadcaster.addClient(send);
        socket.on('message', raw => {
            try {
                const message = JSON.parse(String(raw));
                if (message?.type === 'focus' && typeof message.terminalID === 'string') {
                    options.onFocus(message.terminalID);
                }
                else if (message?.type === 'circuit' && Number.isFinite(message.totalLaps) &&
                    // Bounded: the browser is untrusted, and an absurd distance would
                    // either end the race at once or make it unfinishable.
                    message.totalLaps >= 1 && message.totalLaps <= 200) {
                    options.onCircuit(message.totalLaps);
                }
            }
            catch {
                // Malformed client messages are ignored; the browser is untrusted input.
            }
        });
        socket.on('close', () => options.broadcaster.removeClient(send));
    });
    return {
        port,
        close: () => new Promise(resolve => {
            sockets.close();
            for (const client of sockets.clients)
                client.terminate();
            if (joinSockets) {
                joinSockets.close();
                for (const client of joinSockets.clients)
                    client.terminate();
            }
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}
function serveStatic(webRoot, request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const filePath = external_node_path_default().join(webRoot, external_node_path_default().normalize(relative));
    if (!filePath.startsWith(webRoot + (external_node_path_default()).sep) && filePath !== external_node_path_default().join(webRoot, 'index.html')) {
        response.writeHead(404, { connection: 'close' });
        response.end('not found');
        return;
    }
    if (!external_node_fs_default().existsSync(filePath) || !external_node_fs_default().statSync(filePath).isFile()) {
        response.writeHead(404, { connection: 'close' });
        response.end('not found');
        return;
    }
    response.writeHead(200, {
        'content-type': MIME[external_node_path_default().extname(filePath)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
        connection: 'close',
    });
    external_node_fs_default().createReadStream(filePath).pipe(response);
}
/** Tries preferred..preferred+19 on EADDRINUSE. */
async function listenOnFreePort(server, preferred, bindHost) {
    for (let port = preferred; port < preferred + 20; port += 1) {
        try {
            await new Promise((resolve, reject) => {
                const onError = (error) => {
                    server.removeListener('listening', onListening);
                    reject(error);
                };
                const onListening = () => {
                    server.removeListener('error', onError);
                    resolve();
                };
                server.once('error', onError);
                server.once('listening', onListening);
                server.listen(port, bindHost);
            });
        }
        catch (error) {
            if (error.code !== 'EADDRINUSE')
                throw error;
            await (0,promises_namespaceObject.setImmediate)();
            continue;
        }
        // Linux refuses overlapping binds itself: the listen() above already holds
        // the port against the complement address, so the probe below would always
        // see EADDRINUSE from our own socket and reject every port in the range.
        // There, listen() succeeding is proof enough.
        if (process.platform === 'linux')
            return port;
        // On macOS/BSD a wildcard bind and another process's specific bind coexist
        // on one port, in either order, so listen() succeeding does not prove the
        // port is ours alone — the more specific listener would take the loopback
        // traffic, and clients on the printed port would silently reach the wrong
        // server. Probing the complement address closes both directions: a
        // loopback bind checks no one holds the wildcard, and a wildcard bind
        // checks no one holds loopback. Our own bind never blocks the probe; only
        // another socket holding the complement exactly does.
        const complement = bindHost === '0.0.0.0' ? '127.0.0.1' : '0.0.0.0';
        if (await canBind(port, complement))
            return port;
        await new Promise(resolve => server.close(() => resolve()));
        await (0,promises_namespaceObject.setImmediate)();
    }
    throw new Error(`no free port between ${preferred} and ${preferred + 19}`);
}
function canBind(port, host) {
    return new Promise(resolve => {
        const probe = external_node_net_default().createServer();
        probe.once('error', () => resolve(false));
        probe.listen(port, host, () => probe.close(() => resolve(true)));
    });
}

;// CONCATENATED MODULE: ./src/server/dashboard.ts








const monotonicSeconds = () => performance.now() / 1000;
const WILDCARD = new Set(['0.0.0.0', '::']);
/** Every URL the dashboard actually answers on. A wildcard bind has no single
 *  address to report, so it is expanded to the interfaces it covers rather
 *  than printed as the loopback it merely includes. Loopback leads: it is the
 *  address that always works from this machine, and `--open` uses it. */
function reachableURLs(bindHost, port) {
    const withPort = (host) => `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
    if (!WILDCARD.has(bindHost))
        return [withPort(bindHost)];
    const family = bindHost === '0.0.0.0' ? 'IPv4' : 'IPv6';
    const others = Object.values(external_node_os_default().networkInterfaces())
        .flatMap(entries => entries ?? [])
        .filter(entry => entry.family === family && !entry.internal)
        .map(entry => withPort(entry.address));
    return [withPort(family === 'IPv4' ? '127.0.0.1' : '::1'), ...new Set(others)];
}
/** The built web bundle, resolved relative to this module so it works both
 *  from source (src/web) and from the ncc bundle (dist/web). */
function webRootPath() {
    return external_node_path_default().resolve(external_node_path_default().dirname((0,external_node_url_namespaceObject.fileURLToPath)(import.meta.url)), '../web');
}
async function startDashboard(options) {
    const session = createRaceSession();
    const broadcaster = createRaceBroadcaster(session, monotonicSeconds);
    let client = null;
    if (options.target.kind === 'fixture') {
        loadFixture(options.target.name, session);
    }
    else {
        client = createHerdrClient({ socketPath: options.target.socketPath });
        client.start(update => session.apply(update, monotonicSeconds()));
    }
    const webRoot = webRootPath();
    const bindHost = options.bindHost ?? '127.0.0.1';
    const server = await startServer({
        port: options.port,
        webRoot,
        broadcaster,
        bindHost,
        // A non-loopback bind is reached under whatever address the browser used
        // (a forwarded `localhost`, a LAN address), which the exact-origin policy
        // would reject on the WebSocket upgrade. Same-origin either way.
        viewerOrigin: bindHost === '127.0.0.1' ? 'loopback' : 'host',
        onFocus: terminalID => { client?.focus(terminalID).catch(() => { }); },
        onCircuit: totalLaps => { session.setTotalLaps(totalLaps, monotonicSeconds()); },
    });
    broadcaster.start();
    const urls = reachableURLs(bindHost, server.port);
    return {
        url: urls[0],
        /** Every URL the server answers on, `url` first. */
        urls,
        bindHost,
        port: server.port,
        close: async () => {
            broadcaster.stop();
            client?.stop();
            await server.close();
        },
    };
}

;// CONCATENATED MODULE: ./src/server/target.ts

function instanceKey(target) {
    const identity = target.kind === 'herdr'
        ? `herdr:${target.socketPath}`
        : `fixture:${target.name}`;
    return (0,external_node_crypto_namespaceObject.createHash)('sha256').update(identity).digest('hex').slice(0, 16);
}
function targetLabel(target) {
    return target.kind === 'herdr' ? target.socketPath : `fixture:${target.name}`;
}

;// CONCATENATED MODULE: ./src/server/daemon.ts








function stateRoot() {
    return process.env.HERDR_F1_STATE_DIR
        ?? external_node_path_default().join(external_node_os_default().tmpdir(), 'herdr-f1');
}
function ensurePrivateDirectory(directory) {
    external_node_fs_default().mkdirSync(directory, { recursive: true, mode: 0o700 });
    external_node_fs_default().chmodSync(directory, 0o700);
}
function instancePaths(target) {
    const root = stateRoot();
    const key = instanceKey(target);
    return {
        recordPath: external_node_path_default().join(root, 'instances', `${key}.json`),
        lockPath: external_node_path_default().join(root, 'locks', `${key}.lock`),
        logPath: external_node_path_default().join(root, 'logs', `${key}.log`),
    };
}
function validRecord(value) {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return Number.isInteger(record.pid) && (record.pid ?? 0) > 0
        && typeof record.identity === 'string' && record.identity.length > 0
        && typeof record.url === 'string' && record.url.startsWith('http://')
        && (record.urls === undefined || (Array.isArray(record.urls) && record.urls.every(url => typeof url === 'string')));
}
function readInstanceRecord(target) {
    const { recordPath } = instancePaths(target);
    try {
        const parsed = JSON.parse(external_node_fs_default().readFileSync(recordPath, 'utf8'));
        if (validRecord(parsed))
            return parsed;
    }
    catch {
        return null;
    }
    external_node_fs_default().rmSync(recordPath, { force: true });
    return null;
}
function writeInstanceRecord(record) {
    const { recordPath } = instancePaths(record.target);
    ensurePrivateDirectory(external_node_path_default().dirname(recordPath));
    const temp = `${recordPath}.${process.pid}.${(0,external_node_crypto_namespaceObject.randomBytes)(6).toString('hex')}.tmp`;
    external_node_fs_default().writeFileSync(temp, JSON.stringify(record));
    external_node_fs_default().chmodSync(temp, 0o600);
    external_node_fs_default().renameSync(temp, recordPath);
}
function isProcessAlive(record) {
    try {
        process.kill(record.pid, 0);
    }
    catch {
        return false;
    }
    const processInfo = (0,external_node_child_process_namespaceObject.spawnSync)('ps', ['-p', String(record.pid), '-o', 'command='], { encoding: 'utf8' });
    return processInfo.status === 0 && processInfo.stdout.trim() === `herdr-f1:${record.identity}`;
}
function spawnDaemon(target, port, bindHost, logPath) {
    const pluginRoot = external_node_path_default().resolve(external_node_path_default().dirname((0,external_node_url_namespaceObject.fileURLToPath)(import.meta.url)), '../..');
    const binPath = external_node_path_default().join(pluginRoot, 'bin', 'herdr-f1.js');
    const args = [binPath, '__daemon', '--port', String(port)];
    if (bindHost !== undefined)
        args.push('--bind', bindHost);
    if (target.kind === 'herdr')
        args.push('--socket', target.socketPath);
    else
        args.push('--fixture', target.name);
    ensurePrivateDirectory(external_node_path_default().dirname(logPath));
    const log = external_node_fs_default().openSync(logPath, 'a', 0o600);
    try {
        const child = (0,external_node_child_process_namespaceObject.spawn)(process.execPath, args, {
            cwd: pluginRoot, detached: true, env: { ...process.env, HERDR_F1_STATE_DIR: stateRoot() },
            stdio: ['ignore', log, log],
        });
        child.unref();
    }
    finally {
        external_node_fs_default().closeSync(log);
    }
}
function removeRecord(target) { external_node_fs_default().rmSync(instancePaths(target).recordPath, { force: true }); }
function liveRecord(target) {
    const record = readInstanceRecord(target);
    if (!record)
        return null;
    if (isProcessAlive(record))
        return record;
    removeRecord(target);
    return null;
}
function acquireLock(target, now) {
    const { lockPath } = instancePaths(target);
    ensurePrivateDirectory(external_node_path_default().dirname(lockPath));
    try {
        external_node_fs_default().closeSync(external_node_fs_default().openSync(lockPath, 'wx', 0o600));
        return true;
    }
    catch (error) {
        if (error.code !== 'EEXIST')
            throw error;
        try {
            if (now - external_node_fs_default().statSync(lockPath).mtimeMs > 10_000)
                external_node_fs_default().rmSync(lockPath, { force: true });
        }
        catch { /* another controller released it */ }
        return false;
    }
}
function releaseLock(target) { external_node_fs_default().rmSync(instancePaths(target).lockPath, { force: true }); }
async function ensureDaemon(request) {
    const existing = liveRecord(request.target);
    if (existing)
        return { record: existing, reused: true };
    const deadline = Date.now() + 5_000;
    while (!acquireLock(request.target, Date.now())) {
        const ready = liveRecord(request.target);
        if (ready)
            return { record: ready, reused: true };
        if (Date.now() >= deadline)
            throw new Error(`timed out waiting for Herdr F1 lock; log: ${instancePaths(request.target).logPath}`);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    try {
        const again = liveRecord(request.target);
        if (again)
            return { record: again, reused: true };
        spawnDaemon(request.target, request.port, request.bindHost, instancePaths(request.target).logPath);
        while (Date.now() < deadline) {
            const ready = liveRecord(request.target);
            if (ready)
                return { record: ready, reused: false };
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`Herdr F1 did not become ready; log: ${instancePaths(request.target).logPath}`);
    }
    finally {
        releaseLock(request.target);
    }
}
function statusDaemon(target) {
    return liveRecord(target);
}
async function stopDaemon(target) {
    const record = liveRecord(target);
    if (!record)
        return false;
    process.kill(record.pid, 'SIGTERM');
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && isProcessAlive(record))
        await new Promise(resolve => setTimeout(resolve, 50));
    removeRecord(target);
    return true;
}
async function runDaemon(target, port, bindHost) {
    const identity = (0,external_node_crypto_namespaceObject.randomBytes)(8).toString('hex');
    process.title = `herdr-f1:${identity}`;
    let resolveStop;
    const stopped = new Promise(resolve => { resolveStop = resolve; });
    const requestShutdown = () => resolveStop();
    const dashboard = await startDashboard({ target, port, bindHost });
    process.once('SIGINT', requestShutdown);
    process.once('SIGTERM', requestShutdown);
    try {
        const paths = instancePaths(target);
        writeInstanceRecord({
            pid: process.pid, identity, url: dashboard.url, urls: dashboard.urls, target, logPath: paths.logPath,
        });
        await stopped;
    }
    finally {
        process.removeListener('SIGINT', requestShutdown);
        process.removeListener('SIGTERM', requestShutdown);
        await dashboard.close();
        removeOwnedRecord(target, process.pid);
    }
}
function removeOwnedRecord(target, pid) {
    const current = readInstanceRecord(target);
    if (current?.pid !== pid)
        return;
    removeRecord(target);
}

;// CONCATENATED MODULE: ./src/shared/venues.ts
/** Venue metadata shared by the server and the browser: the published race
 *  distance per circuit. The single source of truth — the browser's circuit
 *  definitions (geometry) and the server's `host --circuit` validation both
 *  read distances from here, so the two sides can never disagree about how
 *  long a venue's race is. */
const VENUES = [
    { id: 'herdr', laps: 58 },
    { id: 'korea', laps: 55 },
    { id: 'suzuka', laps: 53 },
    { id: 'catalunya', laps: 66 },
    { id: 'las-vegas', laps: 50 },
];
const VENUE_IDS = VENUES.map(venue => venue.id);
const DEFAULT_VENUE_ID = 'herdr';
function isVenueID(id) {
    return VENUE_IDS.includes(id);
}
function venueLaps(id) {
    return VENUES.find(venue => venue.id === id).laps;
}

;// CONCATENATED MODULE: ./src/server/multiplayer/uptime.ts
/**
 * Rolling uptime over a sliding window (design decision M4) — the momentum
 * behind a car's speed. Power is piecewise constant between reports (no herdr
 * event means no change), so the tracker stores the change points and
 * integrates exactly; no sampling, no decay approximation.
 */
function createUptimeTracker(windowSeconds) {
    /** Change points, oldest first. Power before the first entry is 0. */
    let segments = [];
    /** Records the instantaneous power (0..1) from `now` on. */
    function setPower(now, power) {
        const last = segments[segments.length - 1];
        if (last && last.power === power)
            return;
        if (last && last.at >= now) {
            // Same-instant correction: the latest value wins.
            last.power = power;
            return;
        }
        segments.push({ at: now, power });
    }
    /** Mean power over [now - window, now], in 0..1. */
    function uptime(now) {
        const start = now - windowSeconds;
        prune(start);
        let integral = 0;
        for (let index = 0; index < segments.length; index += 1) {
            const from = Math.max(segments[index].at, start);
            const to = Math.min(index + 1 < segments.length ? segments[index + 1].at : now, now);
            if (to > from)
                integral += segments[index].power * (to - from);
        }
        return Math.min(1, Math.max(0, integral / windowSeconds));
    }
    /** Drops change points that no longer affect the window, keeping the last
     *  one at or before `start` as the window's boundary value. */
    function prune(start) {
        let firstRelevant = 0;
        while (firstRelevant + 1 < segments.length &&
            segments[firstRelevant + 1].at <= start) {
            firstRelevant += 1;
        }
        if (firstRelevant > 0)
            segments = segments.slice(firstRelevant);
    }
    return { setPower, uptime };
}

;// CONCATENATED MODULE: ./src/server/multiplayer/wire.ts
/** join↔host protocol version. Mismatches are rejected with a clear error at
 *  the handshake, mirroring the herdr protocol policy. v3 carries a complete
 *  aggregate state partition for each two-car crew, still without per-agent
 *  rows or identities. */
const MULTIPLAYER_PROTOCOL = 3;
const CREWS_PER_TEAM = 2;
const NAME_LENGTH_LIMIT = 24;
function emptyCounters() {
    return { incidents: 0, recoveries: 0, pits: 0, greens: 0, chequered: 0, stints: 0 };
}
function emptyCrewReport() {
    return { size: 0, working: 0, idle: 0, done: 0, blocked: 0, counters: emptyCounters() };
}
const COUNTER_KEYS = ['incidents', 'recoveries', 'pits', 'greens', 'chequered', 'stints'];
const CREW_SIZE_LIMIT = 999;
const COUNTER_LIMIT = 1_000_000_000;
/** Trimmed display name, or null when unusable. The name is the team label and
 *  the reconnect key, so it must be visible text of a sane length. */
function normalizeParticipantName(raw) {
    const name = raw.trim();
    if (name.length === 0 || name.length > NAME_LENGTH_LIMIT)
        return null;
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(name))
        return null;
    return name;
}
/** Strictly decodes one join-side message. Anything malformed — wrong shape,
 *  oversized fields, inconsistent counts — returns null; the join socket is
 *  untrusted network input, so nothing is coerced or partially accepted. */
function decodeJoinMessage(raw) {
    const value = parseObject(raw);
    if (value === null)
        return null;
    if (value.type === 'hello') {
        if (typeof value.protocol !== 'number' || typeof value.name !== 'string')
            return null;
        const name = normalizeParticipantName(value.name);
        if (name === null)
            return null;
        return { type: 'hello', protocol: value.protocol, name };
    }
    if (value.type === 'offline')
        return { type: 'offline' };
    if (value.type === 'snapshot') {
        if (!Array.isArray(value.crews) || value.crews.length > CREWS_PER_TEAM)
            return null;
        const crews = [];
        for (const item of value.crews) {
            const crew = decodeCrew(item);
            if (crew === null)
                return null;
            crews.push(crew);
        }
        return { type: 'snapshot', crews };
    }
    return null;
}
function decodeCrew(value) {
    if (typeof value !== 'object' || value === null)
        return null;
    const crew = value;
    const size = boundedCount(crew.size, CREW_SIZE_LIMIT);
    const working = boundedCount(crew.working, CREW_SIZE_LIMIT);
    const blocked = boundedCount(crew.blocked, CREW_SIZE_LIMIT);
    const idle = boundedCount(crew.idle, CREW_SIZE_LIMIT);
    const done = boundedCount(crew.done, CREW_SIZE_LIMIT);
    if (size === null || working === null || idle === null || done === null || blocked === null)
        return null;
    if (working + idle + done + blocked !== size)
        return null;
    if (typeof crew.counters !== 'object' || crew.counters === null)
        return null;
    const raw = crew.counters;
    const counters = emptyCounters();
    for (const key of COUNTER_KEYS) {
        const count = boundedCount(raw[key], COUNTER_LIMIT);
        if (count === null)
            return null;
        counters[key] = count;
    }
    return { size, working, idle, done, blocked, counters };
}
function boundedCount(value, limit) {
    if (typeof value !== 'number' || !Number.isInteger(value))
        return null;
    if (value < 0 || value > limit)
        return null;
    return value;
}
/** Decodes one host-side reply on the join client. */
function decodeHostMessage(raw) {
    const value = parseObject(raw);
    if (value === null)
        return null;
    if (value.type === 'welcome')
        return { type: 'welcome' };
    if (value.type === 'reject' && typeof value.reason === 'string') {
        return { type: 'reject', reason: value.reason.slice(0, 200) };
    }
    return null;
}
function parseObject(raw) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    return value;
}

;// CONCATENATED MODULE: ./src/server/multiplayer/registry.ts



/**
 * The host's roster for the two-car paddock (M1): one participant = one team
 * fielding up to two cars, whose crews are the participant's real agents.
 * Projects everything the host knows into a SourceSnapshot for the race
 * session; car identities are `name/car1`, `name/car2`, stable for the whole
 * hosting session.
 */
function createParticipantRegistry(raceMode = 'classic') {
    /** Insertion order is team order; participants are never removed, so teams
     *  and points survive departures for the lifetime of the host. */
    const participants = new Map();
    function makeCar() {
        return {
            crew: emptyCrewReport(),
            stintTotal: 0,
            tracker: createUptimeTracker(MultiplayerRules.uptimeWindowSeconds),
        };
    }
    /** Claims `name` for a new join socket. Returns false while the name is
     *  connected — reject and let the caller explain; a disconnected name is
     *  resumed with its team, cars, and points intact. */
    function connect(name) {
        const existing = participants.get(name);
        if (existing) {
            if (existing.connected)
                return false;
            existing.connected = true;
            // Telemetry stays stale until the resumed participant pushes a fresh
            // report, which also re-baselines the restarted counters.
            existing.herdrLive = false;
            existing.countersBaselined = false;
            return true;
        }
        participants.set(name, {
            name,
            connected: true,
            herdrLive: false,
            cars: Array.from({ length: CREWS_PER_TEAM }, makeCar),
            countersBaselined: false,
        });
        return true;
    }
    /** The team, retained report, and points stay; telemetry becomes stale. */
    function disconnect(name, now) {
        const participant = participants.get(name);
        if (!participant)
            return;
        participant.connected = false;
        participant.herdrLive = false;
        stopPower(participant, now);
    }
    function update(name, crews, now) {
        const participant = participants.get(name);
        if (!participant)
            return;
        participant.herdrLive = true;
        for (let index = 0; index < CREWS_PER_TEAM; index += 1) {
            const car = participant.cars[index];
            const report = crews[index] ?? emptyCrewReport();
            if (participant.countersBaselined) {
                // Counters are cumulative per join process; only growth is an event.
                car.stintTotal += Math.max(0, report.counters.stints - car.crew.counters.stints);
            }
            car.crew = report;
            car.tracker.setPower(now, carPower(report));
        }
        participant.countersBaselined = true;
    }
    /** The participant's local Herdr went down: keep the grid and stale report. */
    function markOffline(name, now) {
        const participant = participants.get(name);
        if (!participant)
            return;
        participant.herdrLive = false;
        stopPower(participant, now);
    }
    function stopPower(participant, now) {
        for (const car of participant.cars)
            car.tracker.setPower(now, 0);
    }
    /** M3: full power once any crew agent works (crewPowerCap = 1). */
    function carPower(crew) {
        return Math.min(crew.working, MultiplayerRules.crewPowerCap) / MultiplayerRules.crewPowerCap;
    }
    function isRacing(participant) {
        return participant.connected && participant.herdrLive;
    }
    function crewState(crew) {
        if (crew.blocked > 0)
            return 'blocked';
        if (crew.working > 0)
            return 'working';
        if (crew.size > 0 && crew.done === crew.size)
            return 'done';
        if (crew.size > 0 && crew.idle === crew.size)
            return 'idle';
        return 'cruising';
    }
    /** Everything the race session gets to see: up to two synthesized cars per
     *  team. Names and per-agent identifiers never reached the host (M7), so
     *  this projection cannot leak them; what shows is the crew arithmetic the
     *  dashboard is meant to show (M6). */
    function snapshot() {
        const teams = [];
        for (const participant of participants.values()) {
            const racing = isRacing(participant);
            const agents = [];
            participant.cars.forEach((car, index) => {
                if (car.crew.size === 0)
                    return; // an empty crew fields no car (M5)
                const working = racing ? car.crew.working : 0;
                const state = crewState(car.crew);
                agents.push({
                    terminalID: `${participant.name}/car${index + 1}`,
                    paneID: `${participant.name}/car${index + 1}`,
                    tabLabel: `car ${index + 1}`,
                    // Rendered as the row badge: the crew arithmetic behind the speed.
                    agentKind: `crew ${working}/${car.crew.size}`,
                    // Monotonic stint identity; the race session announces NEW STINT
                    // whenever it changes (M8).
                    agentSessionReference: `stint-${car.stintTotal}`,
                    // Focus is inactive in multiplayer (design decision 4).
                    isFocused: false,
                    status: !racing ? 'idle'
                        : raceMode === 'classic'
                            ? car.crew.blocked > 0 ? 'blocked' : car.crew.working > 0 ? 'working' : 'idle'
                            : state === 'cruising' ? 'idle' : state,
                    crewState: state,
                    crewCounts: {
                        working: car.crew.working,
                        idle: car.crew.idle,
                        done: car.crew.done,
                        blocked: car.crew.blocked,
                    },
                    isLastKnown: !racing,
                });
            });
            if (agents.length === 0)
                continue;
            teams.push({ id: participant.name, label: participant.name, agents });
        }
        return { teams };
    }
    /** Live speed factors for every fielded car (M4), for the host to inject
     *  into the race session each tick. */
    function paceFactors(now) {
        const factors = [];
        for (const participant of participants.values()) {
            participant.cars.forEach((car, index) => {
                if (car.crew.size === 0)
                    return;
                const live = isRacing(participant);
                const state = crewState(car.crew);
                const uptime = car.tracker.uptime(now);
                factors.push({
                    terminalID: `${participant.name}/car${index + 1}`,
                    factor: raceMode === 'continuous'
                        ? (!live || state !== 'working'
                            ? MultiplayerRules.cruisingFactor
                            : 1 + MultiplayerRules.continuousWorkingBonusSpan * uptime)
                        : MultiplayerRules.uptimeFloor + MultiplayerRules.uptimeSpan * uptime,
                });
            });
        }
        return factors;
    }
    return { connect, disconnect, update, markOffline, snapshot, paceFactors };
}

;// CONCATENATED MODULE: ./src/server/multiplayer/host.ts









const host_monotonicSeconds = () => performance.now() / 1000;
/**
 * The multiplayer aggregation server. Pure aggregator (design decision 10): it
 * never connects to a herdr — participants push anonymized snapshots over
 * /join, and this process owns the one race session every viewer watches.
 */
async function startHost(options) {
    const log = options.log ?? (() => { });
    const raceMode = options.raceMode ?? 'classic';
    let circuit = options.circuit ?? (raceMode === 'continuous' ? randomVenue(options.random) : DEFAULT_VENUE_ID);
    const venues = createVenueShuffleBag(circuit, options.random);
    // Multiplayer rank is earned through uptime (M3/M4); the seeded dice stay
    // as flavor only, so the session gets the narrowed pace source.
    const session = createRaceSession(raceMode === 'continuous' ? continuousMultiplayerPace : multiplayerPace, undefined, { raceMode });
    const broadcaster = createRaceBroadcaster(session, host_monotonicSeconds, undefined, () => circuit, (grandPrix, now) => {
        if (raceMode !== 'continuous')
            return;
        circuit = venues.next();
        session.setTotalLaps(venueLaps(circuit), now);
        log(`Grand Prix ${grandPrix} · circuit ${circuit} (${venueLaps(circuit)} laps)`);
    });
    // The opening venue's published distance is race state from the first Grand
    // Prix on. The broadcaster swaps both the drawing and distance at each later
    // Grand Prix boundary.
    session.setTotalLaps(venueLaps(circuit), host_monotonicSeconds());
    // There is no herdr connection whose liveness could gate the clock; the
    // host's sources are the participants, so race time always flows.
    session.applyConnection({ kind: 'live' }, host_monotonicSeconds());
    const registry = createParticipantRegistry(raceMode);
    // publish runs inside join-socket message handlers, where a throw would be
    // an uncaught exception taking the whole party down. The known overflow is
    // the race grid's 99 car numbers (4+ participants at the per-participant
    // cap): the session refuses the excess cars, the host keeps racing the
    // ones already on the grid, and the terminal says why.
    const publish = () => {
        try {
            session.applySnapshot(registry.snapshot(), host_monotonicSeconds());
        }
        catch (error) {
            log(`Snapshot rejected: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const server = await startServer({
        port: options.port,
        webRoot: webRootPath(),
        broadcaster,
        bindHost: options.bindHost ?? '0.0.0.0',
        viewerOrigin: 'host',
        // Focus is inactive in multiplayer (design decision 4): the host cannot
        // know whose browser clicked, and relaying would let anyone on the
        // network shake someone else's terminal. Circuit writes are ignored for
        // the same reason — venue rotation belongs to the host.
        onFocus: () => { },
        onCircuit: () => { },
        onJoin: socket => attachParticipant(socket, registry, publish, log),
    });
    broadcaster.start();
    // The momentum loop (M4): rolling uptime changes with the passage of time
    // alone, so car speeds are refreshed on a cadence, not just on snapshots.
    const paceTimer = setInterval(() => {
        const now = host_monotonicSeconds();
        for (const { terminalID, factor } of registry.paceFactors(now)) {
            session.setExternalPace(terminalID, factor, now);
        }
    }, 250);
    return {
        port: server.port,
        close: async () => {
            clearInterval(paceTimer);
            broadcaster.stop();
            await server.close();
        },
    };
}
/** Venue rotation for continuous mode: every circuit appears once per cycle,
 * and the first circuit of a new cycle cannot repeat the previous one. */
function createVenueShuffleBag(opening, random = Math.random) {
    let previous = opening;
    let bag = shuffle(VENUES.map(venue => venue.id).filter(id => id !== opening), random);
    function next() {
        if (bag.length === 0) {
            bag = shuffle(VENUES.map(venue => venue.id), random);
            if (bag[0] === previous && bag.length > 1)
                [bag[0], bag[1]] = [bag[1], bag[0]];
        }
        previous = bag.shift();
        return previous;
    }
    return { next };
}
/** Backwards-compatible one-shot helper. Rotation itself uses the persistent
 * shuffle bag above so a whole cycle cannot repeat a venue. */
function randomNextVenue(current, random = Math.random) {
    return createVenueShuffleBag(current, random).next();
}
function shuffle(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
        [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
}
/** Picks the opening venue when the host command did not specify one. */
function randomVenue(random = Math.random) {
    const index = Math.min(VENUES.length - 1, Math.max(0, Math.floor(random() * VENUES.length)));
    return VENUES[index].id;
}
/** Per-socket handshake and message pump for one joining participant. */
function attachParticipant(socket, registry, publish, log) {
    let name = null;
    const reply = (message) => socket.send(JSON.stringify(message));
    socket.on('message', raw => {
        const message = decodeJoinMessage(String(raw));
        if (name === null) {
            // The first message must be a valid hello; anything else is a client
            // this host cannot reason with, so fail loudly instead of guessing.
            if (message?.type !== 'hello') {
                reply({ type: 'reject', reason: 'Expected a protocol handshake. Update herdr-f1 on both sides.' });
                socket.close();
                return;
            }
            if (message.protocol !== MULTIPLAYER_PROTOCOL) {
                reply({
                    type: 'reject',
                    reason: `This host speaks multiplayer protocol ${MULTIPLAYER_PROTOCOL}, ` +
                        `the joining client protocol ${message.protocol}. Update herdr-f1 on the older side.`,
                });
                socket.close();
                return;
            }
            if (!registry.connect(message.name)) {
                reply({
                    type: 'reject',
                    reason: `"${message.name}" is already connected. Pick another name, or reuse it after that session disconnects.`,
                });
                socket.close();
                return;
            }
            name = message.name;
            reply({ type: 'welcome' });
            log(`${name} joined the paddock`);
            return;
        }
        // Post-handshake traffic is untrusted network input: malformed frames are
        // dropped, matching the viewer socket's tolerance.
        if (message?.type === 'snapshot') {
            registry.update(name, message.crews, host_monotonicSeconds());
            publish();
        }
        else if (message?.type === 'offline') {
            registry.markOffline(name, host_monotonicSeconds());
            publish();
        }
    });
    socket.on('close', () => {
        if (name === null)
            return;
        registry.disconnect(name, host_monotonicSeconds());
        publish();
        log(`${name} disconnected — team telemetry offline (rejoin with the same name to resume)`);
    });
    socket.on('error', () => { }); // 'close' always follows; nothing extra to do
}
/** Foreground CLI runner (design decision 9): prints where to point browsers
 *  and join clients, then hosts until Ctrl+C. */
async function runHost(port, circuit, raceMode = 'classic') {
    const openingCircuit = circuit ?? (raceMode === 'continuous' ? randomVenue() : DEFAULT_VENUE_ID);
    const host = await startHost({ port, circuit: openingCircuit, raceMode, log: line => console.log(line) });
    console.log(`Herdr F1 multiplayer host · ${raceMode} race · port ${host.port} · ` +
        `opening circuit ${openingCircuit} (${venueLaps(openingCircuit)} laps)`);
    for (const address of viewerAddresses()) {
        console.log(`  view    http://${address}:${host.port}`);
    }
    console.log(`  join    herdr-f1 join <this-host>:${host.port} --name <your-name>`);
    console.log('No authentication — host on trusted networks (LAN/VPN) only. Ctrl+C to stop.');
    await new Promise(resolve => {
        const requestShutdown = () => resolve();
        process.once('SIGINT', requestShutdown);
        process.once('SIGTERM', requestShutdown);
    });
    console.log('Stopping host…');
    await host.close();
}
/** Non-internal IPv4 addresses, loopback last, so the printed URLs cover both
 *  the LAN and a browser on the host machine itself. */
function viewerAddresses() {
    const addresses = [];
    for (const interfaces of Object.values(external_node_os_default().networkInterfaces())) {
        for (const entry of interfaces ?? []) {
            if (entry.family === 'IPv4' && !entry.internal)
                addresses.push(entry.address);
        }
    }
    addresses.push('127.0.0.1');
    return addresses;
}

;// CONCATENATED MODULE: ./src/server/multiplayer/join.ts






/**
 * Projects local herdr snapshots into the two-car wire format (M2/M7): agents
 * are split into per-car crews on this side, and only aggregates — counts and
 * cumulative transition counters — ever leave the machine. Names, per-agent
 * IDs, and session references are not even hashed anymore; they simply are
 * not sent.
 */
function createCrewTracker() {
    const previousStatus = new Map();
    const previousSession = new Map();
    /** Cumulative per-crew transition counts since this process started (M8). */
    const counters = [emptyCounters(), emptyCounters()];
    function update(snapshot) {
        const agents = allAgents(snapshot);
        // Deterministic split (M2): stable hash order, alternating assignment.
        // The same agent set always lands in the same crews — across reconnects
        // too — and the two crews never differ in size by more than one.
        const ordered = agents
            .slice()
            .sort((a, b) => {
            const ha = stableHash(a.terminalID);
            const hb = stableHash(b.terminalID);
            return ha < hb ? -1 : ha > hb ? 1 : a.terminalID < b.terminalID ? -1 : 1;
        });
        const crews = [emptyCrewReport(), emptyCrewReport()];
        const seen = new Set();
        ordered.forEach((agent, index) => {
            const crewIndex = index % CREWS_PER_TEAM;
            const crew = crews[crewIndex];
            crew.size += 1;
            if (agent.status === 'working')
                crew.working += 1;
            if (agent.status === 'idle')
                crew.idle += 1;
            if (agent.status === 'done')
                crew.done += 1;
            if (agent.status === 'blocked')
                crew.blocked += 1;
            seen.add(agent.terminalID);
            const before = previousStatus.get(agent.terminalID);
            if (before !== undefined && before !== agent.status) {
                countTransition(counters[crewIndex], before, agent.status);
            }
            previousStatus.set(agent.terminalID, agent.status);
            const session = agent.agentSessionReference;
            if (session !== null) {
                const knownSession = previousSession.get(agent.terminalID);
                if (knownSession !== undefined && knownSession !== session) {
                    counters[crewIndex].stints += 1;
                }
                previousSession.set(agent.terminalID, session);
            }
        });
        for (const id of [...previousStatus.keys()]) {
            if (!seen.has(id)) {
                previousStatus.delete(id);
                previousSession.delete(id);
            }
        }
        // Counters are cumulative and stay attached to their crew even after the
        // agents that produced them move on; reports always carry both crews.
        crews[0].counters = { ...counters[0] };
        crews[1].counters = { ...counters[1] };
        return crews;
    }
    return { update };
}
function countTransition(counters, before, after) {
    // Mirrors the radio vocabulary: blocked takes precedence, then the rest.
    if (after === 'blocked')
        counters.incidents += 1;
    else if (before === 'blocked')
        counters.recoveries += 1;
    else if (after === 'done')
        counters.chequered += 1;
    else if (before === 'working' && after === 'idle')
        counters.pits += 1;
    else if (before === 'idle' && after === 'working')
        counters.greens += 1;
}
/**
 * Foreground reporter (design decision 9): reads the local herdr socket and
 * pushes crew aggregates to the host until Ctrl+C. Runs no server of its own.
 * The host connection is outbound, so NAT needs no port forwarding.
 */
async function runJoin(options) {
    const url = `ws://${bracketed(options.host)}:${options.port}/join`;
    let stopped = false;
    let fatalReason = null;
    let socket = null;
    let welcomed = false;
    const tracker = createCrewTracker();
    /** What the host should currently believe; replayed after every reconnect. */
    let latest = null;
    const push = (message) => {
        if (welcomed && socket?.readyState === websocket.OPEN)
            socket.send(JSON.stringify(message));
    };
    const closeSocket = () => socket?.close();
    const client = createHerdrClient({ socketPath: options.socketPath });
    client.start(update => {
        if (update.kind === 'snapshot') {
            latest = { type: 'snapshot', crews: tracker.update(update.snapshot) };
        }
        else if (update.state.kind === 'live') {
            return; // the client fetches an authoritative snapshot right after going live
        }
        else {
            // Local Herdr feed is down: the host applies the selected mode's offline
            // rule without presenting this retained report as live telemetry.
            latest = { type: 'offline' };
        }
        push(latest);
    });
    // Aborting cuts a pending backoff sleep short, so Ctrl+C exits immediately
    // instead of waiting out a timer that can be 30 seconds long.
    const stopController = new AbortController();
    const onSignal = () => {
        stopped = true;
        stopController.abort();
        closeSocket();
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    console.log(`Herdr F1 · joining ${options.host}:${options.port} as "${options.name}" · Ctrl+C to leave`);
    // Same backoff shape as the herdr client: reset on success, double to a cap.
    let delayMs = 1000;
    while (!stopped && fatalReason === null) {
        await new Promise(resolve => {
            const ws = new websocket(url);
            socket = ws;
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'hello', protocol: MULTIPLAYER_PROTOCOL, name: options.name }));
            });
            ws.on('message', raw => {
                const message = decodeHostMessage(String(raw));
                if (message?.type === 'welcome') {
                    welcomed = true;
                    delayMs = 1000;
                    console.log(`Connected. Team "${options.name}" fields ${MultiplayerRules.carsPerTeam} cars; ` +
                        'your agents are the crews.');
                    if (latest)
                        push(latest);
                }
                else if (message?.type === 'reject') {
                    fatalReason = message.reason;
                }
            });
            ws.on('error', () => { }); // 'close' always follows
            ws.on('close', () => {
                if (welcomed && !stopped && fatalReason === null) {
                    console.log('Lost the host; reconnecting…');
                }
                welcomed = false;
                socket = null;
                resolve();
            });
        });
        if (stopped || fatalReason !== null)
            break;
        try {
            await (0,promises_namespaceObject.setTimeout)(delayMs, undefined, { signal: stopController.signal });
        }
        catch {
            break; // the signal handler aborted the backoff
        }
        delayMs = Math.min(delayMs * 2, 30000);
    }
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    client.stop();
    closeSocket();
    if (fatalReason !== null) {
        console.error(`Join rejected: ${fatalReason}`);
        process.exitCode = 1;
    }
    else {
        console.log('Left the session. Your team and points stay on the host until it shuts down.');
    }
}
/** Raw IPv6 addresses need brackets in a URL authority. */
function bracketed(host) {
    return host.includes(':') ? `[${host}]` : host;
}

;// CONCATENATED MODULE: ./src/server/cli.ts











const USAGE = `Usage:
  herdr-f1 [start] [--port <n>] [--bind <host>] [--open] [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 stop [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 status [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 host [--port <n>] [--circuit <${VENUE_IDS.join('|')}>] [--race-mode <classic|continuous>]
  herdr-f1 join <host[:port]> --name <name> [--socket <path>]`;
class UsageError extends Error {
}
function parseArgs(argv, env = process.env) {
    try {
        const { values, positionals } = (0,external_node_util_namespaceObject.parseArgs)({
            args: argv,
            allowPositionals: true,
            strict: true,
            options: {
                port: { type: 'string' },
                bind: { type: 'string' },
                open: { type: 'boolean' },
                socket: { type: 'string' },
                fixture: { type: 'string' },
                name: { type: 'string' },
                circuit: { type: 'string' },
                'race-mode': { type: 'string' },
            },
        });
        const command = positionals[0] ?? 'start';
        if (!['start', 'stop', 'status', '__daemon', 'host', 'join'].includes(command))
            throw new UsageError(USAGE);
        if (positionals.length > (command === 'join' ? 2 : 1))
            throw new UsageError(USAGE);
        if (values.name !== undefined && command !== 'join')
            throw new UsageError(USAGE);
        // The venue is the host launcher's choice alone (design decision 8, revised).
        if (values.circuit !== undefined && command !== 'host')
            throw new UsageError(USAGE);
        if (values['race-mode'] !== undefined && command !== 'host')
            throw new UsageError(USAGE);
        // `join` takes its port from <host[:port]>, so --port belongs to the
        // commands that bind a server.
        const starts = command === 'start' || command === '__daemon' || command === 'host';
        if ((!starts && values.port !== undefined) || (command !== 'start' && values.open))
            throw new UsageError(USAGE);
        const port = Number(values.port ?? 4158);
        if (!Number.isInteger(port) || port <= 0 || port > 65535)
            throw new UsageError(USAGE);
        // `host` picks its own wildcard bind, and the lifecycle commands only read
        // the instance record, so --bind belongs to the local dashboard alone.
        const binds = command === 'start' || command === '__daemon';
        if (values.bind !== undefined && !binds)
            throw new UsageError(USAGE);
        if (values.bind !== undefined && external_node_net_default().isIP(values.bind) === 0)
            throw new UsageError(USAGE);
        const bindHost = values.bind;
        if (command === 'host') {
            if (values.fixture || values.socket)
                throw new UsageError(USAGE);
            if (values.circuit !== undefined && !isVenueID(values.circuit))
                throw new UsageError(USAGE);
            const raceMode = values['race-mode'] ?? 'classic';
            if (raceMode !== 'classic' && raceMode !== 'continuous')
                throw new UsageError(USAGE);
            return values.circuit === undefined
                ? { kind: 'host', port, raceMode }
                : { kind: 'host', port, circuit: values.circuit, raceMode };
        }
        if (command === 'join') {
            if (positionals.length !== 2 || values.fixture)
                throw new UsageError(USAGE);
            const name = normalizeParticipantName(values.name ?? '');
            if (name === null)
                throw new UsageError(USAGE);
            const address = parseHostAddress(positionals[1]);
            return {
                kind: 'join',
                ...address,
                name,
                socketPath: values.socket ?? env.HERDR_SOCKET_PATH ?? defaultSocketPath,
            };
        }
        if (values.fixture && !FIXTURE_NAMES.includes(values.fixture))
            throw new UsageError(USAGE);
        if (values.fixture && values.socket)
            throw new UsageError(USAGE);
        const target = values.fixture
            ? { kind: 'fixture', name: values.fixture }
            : { kind: 'herdr', socketPath: values.socket ?? env.HERDR_SOCKET_PATH ?? defaultSocketPath };
        if (command === 'stop' || command === 'status')
            return { kind: command, target };
        if (command === '__daemon')
            return bindHost === undefined
                ? { kind: 'daemon', target, port }
                : { kind: 'daemon', target, port, bindHost };
        const start = { kind: 'start', target, port, open: values.open ?? false };
        return bindHost === undefined ? start : { ...start, bindHost };
    }
    catch (error) {
        if (error instanceof UsageError)
            throw error;
        throw new UsageError(USAGE);
    }
}
/** `<host[:port]>`, defaulting to 4158. IPv6 works bracketed (`[::1]:4200`)
 *  or bare with the default port. */
function parseHostAddress(raw) {
    const bracketed = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(raw);
    if (bracketed)
        return validatedAddress(bracketed[1], bracketed[2]);
    const parts = raw.split(':');
    if (parts.length > 2)
        return validatedAddress(raw, undefined); // bare IPv6
    return validatedAddress(parts[0], parts[1]);
}
function validatedAddress(host, portText) {
    const port = portText === undefined ? 4158 : Number(portText);
    if (host.length === 0 || !Number.isInteger(port) || port <= 0 || port > 65535)
        throw new UsageError(USAGE);
    return { host, port };
}
async function run(argv) {
    let command;
    try {
        command = parseArgs(argv);
    }
    catch (error) {
        if (error instanceof UsageError) {
            console.error(error.message);
            process.exitCode = 2;
            return;
        }
        throw error;
    }
    if (command.kind === 'daemon') {
        await runDaemon(command.target, command.port, command.bindHost);
        return;
    }
    // Multiplayer commands run in the foreground (design decision 9): party
    // sessions are transient, so there is no daemon to manage.
    if (command.kind === 'host') {
        await runHost(command.port, command.circuit, command.raceMode);
        return;
    }
    if (command.kind === 'join') {
        await runJoin(command);
        return;
    }
    if (command.kind === 'stop') {
        const stopped = await stopDaemon(command.target);
        console.log(stopped ? 'Herdr F1 stopped.' : 'Herdr F1 is not running.');
        return;
    }
    if (command.kind === 'status') {
        const record = await statusDaemon(command.target);
        if (!record) {
            console.log(`Herdr F1 is stopped · ${targetLabel(command.target)}`);
            process.exitCode = 1;
            return;
        }
        console.log(`Herdr F1 is running · ${record.url}`);
        printExtraURLs(record);
        console.log(`PID ${record.pid} · ${targetLabel(record.target)}`);
        console.log(`Log ${record.logPath}`);
        return;
    }
    const result = await ensureDaemon({ target: command.target, port: command.port, bindHost: command.bindHost });
    console.log(`Herdr F1 · ${result.record.url}${result.reused ? ' · already running' : ''}`);
    printExtraURLs(result.record);
    if (command.open)
        openBrowser(result.record.url);
    else
        console.log(`Open ${result.record.url} in your browser.`);
}
/** A wildcard bind answers on more than the loopback URL reported first, and
 *  those are the addresses another device would use. */
function printExtraURLs(record) {
    const extra = (record.urls ?? []).filter(url => url !== record.url);
    for (const url of extra)
        console.log(`Also on ${url}`);
}
function openBrowser(url) {
    const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
    const child = (0,external_node_child_process_namespaceObject.spawn)(command, [url], { stdio: 'ignore', detached: true });
    child.once('error', () => console.error(`Could not open a browser. Open ${url} manually.`));
    child.unref();
}

var __webpack_exports__parseArgs = __webpack_exports__.Z;
var __webpack_exports__run = __webpack_exports__.e;
export { __webpack_exports__parseArgs as parseArgs, __webpack_exports__run as run };
