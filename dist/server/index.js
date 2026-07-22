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

/***/ 332:
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
const subprotocol = __nccwpck_require__(332);
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
function createRaceBroadcaster(session, clock, tickMs = 250) {
    let timer = null;
    const clients = new Set();
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
        const sync = buildSync();
        send(JSON.stringify(sync));
    }
    function removeClient(send) {
        clients.delete(send);
    }
    /** One cadence step. Public so tests can drive it with a manual clock. */
    function tick() {
        const now = clock();
        session.advance(now);
        if (clients.size === 0)
            return; // race continues; nothing to fan out
        const json = JSON.stringify(buildSync());
        for (const send of clients)
            send(json);
    }
    function buildSync() {
        return { type: 'sync', ...session.presentation() };
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
    paletteSize: 12,
    maximumGridNumber: 99,
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
/** Production pace: seeded pseudo-random, reproducible across launches for
 *  the same grand prix sequence and terminal, varying lap to lap. */
const seededPace = (grandPrix, terminalID, lap) => {
    const hash = stableHash(`${grandPrix}|${terminalID}|${lap}`) ^ 0x5deece66n;
    // A second mix avalanches the low bits before the modulo.
    const mixed = ((hash ^ (hash >> 33n)) * 0xff51afd7ed558ccdn) & MASK_64;
    const unit = Number(mixed % 100000n) / 99999;
    return RaceRules.paceMin + unit * (RaceRules.paceMax - RaceRules.paceMin);
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
            connectionFixture(session, { kind: 'protocolError', detail: 'Unsupported Herdr protocol 999' });
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
                agent('t3', 'tests', 'claude', 'idle'),
            ]],
        ['ws-pet', 'agent-pet', [
                agent('t4', 'dashboard', 'claude', 'working'),
                agent('t5', 'track', 'claude', 'done'),
                agent('t6', 'standings', 'codex', 'blocked'),
                agent('t7', 'fixtures', 'claude', 'idle'),
            ]],
        ['ws-console', 'console-api', [
                agent('t8', 'billing', 'codex', 'working'),
                agent('t9', 'auth', 'claude', 'idle'),
            ]],
        ['ws-infra', 'infra-tools', [
                agent('t10', 'deploy', 'claude', 'working'),
                agent('t11', 'monitor', 'aider', 'done'),
                agent('t12', 'runbook', 'codex', 'working'),
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

;// CONCATENATED MODULE: external "node:net"
const external_node_net_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:net");
var external_node_net_default = /*#__PURE__*/__nccwpck_require__.n(external_node_net_namespaceObject);
;// CONCATENATED MODULE: external "node:readline"
const external_node_readline_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:readline");
;// CONCATENATED MODULE: external "node:timers/promises"
const promises_namespaceObject = __WEBPACK_EXTERNAL_createRequire(import.meta.url)("node:timers/promises");
;// CONCATENATED MODULE: ./src/server/herdr/projector.ts
// herdr 0.7.5 ships protocol 17; the snapshot shape (workspaces/tabs/panes/
// agents with object agent_session) is unchanged from 16, so both are accepted.
const SUPPORTED_PROTOCOL = 17;
/** Any malformed, unsupported, or server-reported protocol problem. */
class HerdrProtocolFault extends Error {
}
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
    if (typeof raw.protocol !== 'number' || raw.protocol > SUPPORTED_PROTOCOL) {
        throw new HerdrProtocolFault(`Unsupported Herdr protocol ${String(raw.protocol)}`);
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
 *  output polling. Canonical names use underscores; protocol 17 dot names are
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
        eventSocket?.destroy();
        eventSocket = null;
    }
    async function focus(terminalID) {
        // Resolve the terminal's current pane; herdr focuses by pane. Fall back to
        // the terminal id if the mapping is missing (e.g. focus before first sync).
        const target = paneByTerminal.get(terminalID) ?? terminalID;
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
            await (0,promises_namespaceObject.setTimeout)(delayMs);
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

;// CONCATENATED MODULE: ./src/server/race-session.ts

/**
 * In-memory race state owner. Consumes authoritative projected herdr
 * snapshots, connection state, and monotonic time (seconds); publishes a
 * complete RacePresentation. All race records are fictional game state that
 * lives only as long as this object. Official distance advances exclusively
 * from accepted elapsed race time, never from render frames.
 */
function createRaceSession(paceSource = seededPace) {
    let lastTick = null;
    /** Accepted live seconds since the current Grand Prix started. */
    let raceTime = 0;
    let podiumElapsed = 0;
    let phase = 'awaitingGrid';
    let grandPrix = 1;
    let connection = { kind: 'waiting' };
    let hasSnapshot = false;
    let frozenPodium = null;
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
        // The first individual to reach 58 ends the race, so everyone only
        // advances up to the earliest finish instant within this step.
        let earliestFinish = elapsed;
        let finisher = null;
        for (const entry of entries.values()) {
            if (!isDriving(entry))
                continue;
            const official = { value: entry.official };
            const pace = { ...entry.pace };
            const unused = walk(official, pace, entry.terminalID, elapsed);
            if (official.value >= RaceRules.totalLaps) {
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
                walk(official, entry.pace, entry.terminalID, budget);
                entry.display += official.value - entry.official;
                entry.official = official.value;
            }
            else if (entry.status === 'done' && !entry.isRetired) {
                entry.display += budget * RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
            }
        }
        if (finisher !== null)
            finishGrandPrix();
    }
    function isDriving(entry) {
        return entry.status === 'working' && !entry.isRetired && !entry.isQueuedNextGrid;
    }
    /** Advances `official.value` by up to `budget` seconds, resampling pace at
     *  each official lap boundary and stopping exactly at the 58-lap finish.
     *  Returns the unused part of the budget (non-zero only at the finish). */
    function walk(official, pace, terminalID, budget) {
        const finish = RaceRules.totalLaps;
        let remaining = budget;
        while (remaining > 1e-12 && official.value < finish) {
            const lap = Math.min(Math.floor(official.value), RaceRules.totalLaps - 1);
            if (pace.lap !== lap) {
                pace.multiplier = clampPace(paceSource(grandPrix, terminalID, lap));
                pace.lap = lap;
            }
            const speed = RaceRules.baseSpeed * pace.multiplier;
            const boundary = Math.min(lap + 1, finish);
            const timeToBoundary = (boundary - official.value) / speed;
            // The epsilon snaps float-accumulated distance onto exact lap
            // boundaries so lap labels and the 58-lap finish stay crisp.
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
            if (entry.status !== 'working' && entry.status !== 'done')
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
        const orderedIDs = [...entries.keys()].sort((a, b) => compareOrderKeys(orderKey(entries.get(a)), orderKey(entries.get(b))));
        const circulating = [];
        for (const id of orderedIDs) {
            const entry = entries.get(id);
            entry.official = 0;
            entry.display = 0;
            entry.pace = { multiplier: 1, lap: -1 };
            entry.isQueuedNextGrid = false;
            entry.newStintUntil = null;
            entry.incidentInPit = false;
            if (entry.status === 'done' || entry.status === 'blocked')
                circulating.push(id);
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
        const seen = new Set();
        const newcomers = [];
        for (const team of snapshot.teams) {
            for (const agent of team.agents) {
                seen.add(agent.terminalID);
                if (entries.has(agent.terminalID))
                    updateEntry(agent, team.id);
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
            if (!seen.has(id))
                entry.isRetired = true;
        }
        if (bootstrapping) {
            phase = 'live';
            resetGrid();
        }
    }
    function updateEntry(agent, teamID) {
        const entry = entries.get(agent.terminalID);
        // A terminal reappearing before race end restores its existing entry.
        entry.isRetired = false;
        // A live workspace move transfers the entry and its whole distance.
        entry.teamID = teamID;
        if (entry.sessionReference !== null &&
            agent.agentSessionReference !== null &&
            entry.sessionReference !== agent.agentSessionReference) {
            entry.newStintUntil = raceTime + RaceRules.newStintDuration;
        }
        if (agent.agentSessionReference !== null) {
            entry.sessionReference = agent.agentSessionReference;
        }
        if (entry.status !== agent.status) {
            if (agent.status === 'blocked') {
                entry.incidentInPit = entry.status === 'idle' || entry.isQueuedNextGrid;
            }
            else {
                entry.incidentInPit = false;
            }
            entry.status = agent.status;
        }
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
            isFocused: agent.isFocused,
            official: 0,
            display: 0,
            pace: { multiplier: 1, lap: -1 },
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
        // Existing assignments are preserved; only unseen teams (sorted by
        // workspace ID for determinism) probe for a free palette slot.
        const unseen = ids.filter(id => !teamTokens.has(id)).sort(compareStrings);
        for (const id of unseen) {
            const preferred = Number(stableHash(id) % BigInt(RaceRules.paletteSize));
            let assigned = null;
            for (let probe = 0; probe < RaceRules.paletteSize; probe += 1) {
                const slot = (preferred + probe) % RaceRules.paletteSize;
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
            phase: phase,
            grandPrix: grandPrix,
            headerLap: headerLap(),
            teams,
            podium: frozenPodium,
            connection: connection,
            overlay: currentOverlay,
        };
    }
    function headerLap() {
        let leader = 0;
        for (const entry of entries.values()) {
            if (!entry.isQueuedNextGrid)
                leader = Math.max(leader, entry.official);
        }
        return Math.min(RaceRules.totalLaps, Math.floor(leader) + 1);
    }
    function rankedTeams() {
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
            entries: teamGroup.members
                .slice()
                .sort((a, b) => quantized(b.official) - quantized(a.official) ||
                a.carNumber - b.carNumber ||
                compareStrings(a.terminalID, b.terminalID))
                .map(entry => present(entry)),
        }));
    }
    function present(entry) {
        const lap = Math.min(RaceRules.totalLaps, Math.floor(entry.official) + 1);
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
            colorToken: teamTokens.get(entry.teamID) ?? { kind: 'palette', slot: 0 },
            officialDistance: entry.official,
            lap,
            statusText,
            placement,
            displaySpeed: displaySpeed(entry),
            isFocused: entry.isFocused,
            showsNewStint: entry.newStintUntil !== null && raceTime < entry.newStintUntil,
        };
    }
    /** Display motion in laps/second the client uses to extrapolate between
     *  syncs. Mirrors the motion the server itself applies in step(). */
    function displaySpeed(entry) {
        if (connection.kind !== 'live')
            return 0;
        if (entry.isRetired || entry.isQueuedNextGrid)
            return 0;
        if (phase === 'live') {
            if (entry.status === 'working') {
                return RaceRules.baseSpeed * (entry.pace.lap === -1 ? 1 : entry.pace.multiplier);
            }
            if (entry.status === 'done')
                return RaceRules.baseSpeed * RaceRules.doneCooldownFactor;
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
    return { apply, applyConnection, applySnapshot, advance, presentation };
}
// MARK: - Helpers
function clampPace(value) {
    return Math.min(Math.max(value, RaceRules.paceMin), RaceRules.paceMax);
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
var subprotocol = __nccwpck_require__(332);
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
};
async function startServer(options) {
    const webRoot = external_node_path_default().resolve(options.webRoot);
    const server = external_node_http_default().createServer((request, response) => serveStatic(webRoot, request, response));
    const port = await listenOnFreePort(server, options.port);
    const sockets = new websocket_server({ server, path: '/ws' });
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
        'content-type': MIME[external_node_path_default().extname(filePath)] ?? 'application/octet-stream', connection: 'close',
    });
    external_node_fs_default().createReadStream(filePath).pipe(response);
}
/** Binds 127.0.0.1 only. Tries preferred..preferred+19 on EADDRINUSE. */
async function listenOnFreePort(server, preferred) {
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
                server.listen(port, '127.0.0.1');
            });
            return port;
        }
        catch (error) {
            if (error.code !== 'EADDRINUSE')
                throw error;
            await (0,promises_namespaceObject.setImmediate)();
        }
    }
    throw new Error(`no free port between ${preferred} and ${preferred + 19}`);
}

;// CONCATENATED MODULE: ./src/server/dashboard.ts







const monotonicSeconds = () => performance.now() / 1000;
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
    const webRoot = external_node_path_default().resolve(external_node_path_default().dirname((0,external_node_url_namespaceObject.fileURLToPath)(import.meta.url)), '../web');
    const server = await startServer({
        port: options.port,
        webRoot,
        broadcaster,
        onFocus: terminalID => { client?.focus(terminalID).catch(() => { }); },
    });
    broadcaster.start();
    return {
        url: `http://127.0.0.1:${server.port}`,
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
        && typeof record.url === 'string' && record.url.startsWith('http://127.0.0.1:');
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
function spawnDaemon(target, port, logPath) {
    const pluginRoot = external_node_path_default().resolve(external_node_path_default().dirname((0,external_node_url_namespaceObject.fileURLToPath)(import.meta.url)), '../..');
    const binPath = external_node_path_default().join(pluginRoot, 'bin', 'herdr-f1.js');
    const args = [binPath, '__daemon', '--port', String(port)];
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
        spawnDaemon(request.target, request.port, instancePaths(request.target).logPath);
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
async function runDaemon(target, port) {
    const identity = (0,external_node_crypto_namespaceObject.randomBytes)(8).toString('hex');
    process.title = `herdr-f1:${identity}`;
    let resolveStop;
    const stopped = new Promise(resolve => { resolveStop = resolve; });
    const requestShutdown = () => resolveStop();
    const dashboard = await startDashboard({ target, port });
    process.once('SIGINT', requestShutdown);
    process.once('SIGTERM', requestShutdown);
    try {
        const paths = instancePaths(target);
        writeInstanceRecord({ pid: process.pid, identity, url: dashboard.url, target, logPath: paths.logPath });
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

;// CONCATENATED MODULE: ./src/server/cli.ts






const USAGE = `Usage:
  herdr-f1 [start] [--port <n>] [--open] [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 stop [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]
  herdr-f1 status [--fixture <${FIXTURE_NAMES.join('|')}>] [--socket <path>]`;
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
                open: { type: 'boolean' },
                socket: { type: 'string' },
                fixture: { type: 'string' },
            },
        });
        const command = positionals[0] ?? 'start';
        if (positionals.length > 1 || !['start', 'stop', 'status', '__daemon'].includes(command))
            throw new UsageError(USAGE);
        const starts = command === 'start' || command === '__daemon';
        if ((!starts && values.port !== undefined) || (command !== 'start' && values.open))
            throw new UsageError(USAGE);
        const port = Number(values.port ?? 4158);
        if (!Number.isInteger(port) || port <= 0 || port > 65535)
            throw new UsageError(USAGE);
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
            return { kind: 'daemon', target, port };
        return { kind: 'start', target, port, open: values.open ?? false };
    }
    catch (error) {
        if (error instanceof UsageError)
            throw error;
        throw new UsageError(USAGE);
    }
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
        await runDaemon(command.target, command.port);
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
        console.log(`PID ${record.pid} · ${targetLabel(record.target)}`);
        console.log(`Log ${record.logPath}`);
        return;
    }
    const result = await ensureDaemon({ target: command.target, port: command.port });
    console.log(`Herdr F1 · ${result.record.url}${result.reused ? ' · already running' : ''}`);
    if (command.open)
        openBrowser(result.record.url);
    else
        console.log(`Open ${result.record.url} in your browser.`);
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
