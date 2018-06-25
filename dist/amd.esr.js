/* esr version 0.9.3 */
define(function () { 'use strict';

  var VERSION = "0.9.3";

  var isarray = Array.isArray || function (arr) {
    return Object.prototype.toString.call(arr) == '[object Array]';
  };

  /**
   * Expose `pathToRegexp`.
   */
  var pathToRegexp_1 = pathToRegexp;
  var parse_1 = parse;
  var compile_1 = compile;
  var tokensToFunction_1 = tokensToFunction;
  var tokensToRegExp_1 = tokensToRegExp;

  /**
   * The main path matching regexp utility.
   *
   * @type {RegExp}
   */
  var PATH_REGEXP = new RegExp([
    // Match escaped characters that would otherwise appear in future matches.
    // This allows the user to escape special characters that won't transform.
    '(\\\\.)',
    // Match Express-style parameters and un-named parameters with a prefix
    // and optional suffixes. Matches appear as:
    //
    // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
    // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
    // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
    '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
  ].join('|'), 'g');

  /**
   * Parse a string for the raw tokens.
   *
   * @param  {string}  str
   * @param  {Object=} options
   * @return {!Array}
   */
  function parse (str, options) {
    var tokens = [];
    var key = 0;
    var index = 0;
    var path = '';
    var defaultDelimiter = options && options.delimiter || '/';
    var res;

    while ((res = PATH_REGEXP.exec(str)) != null) {
      var m = res[0];
      var escaped = res[1];
      var offset = res.index;
      path += str.slice(index, offset);
      index = offset + m.length;

      // Ignore already escaped sequences.
      if (escaped) {
        path += escaped[1];
        continue
      }

      var next = str[index];
      var prefix = res[2];
      var name = res[3];
      var capture = res[4];
      var group = res[5];
      var modifier = res[6];
      var asterisk = res[7];

      // Push the current path onto the tokens.
      if (path) {
        tokens.push(path);
        path = '';
      }

      var partial = prefix != null && next != null && next !== prefix;
      var repeat = modifier === '+' || modifier === '*';
      var optional = modifier === '?' || modifier === '*';
      var delimiter = res[2] || defaultDelimiter;
      var pattern = capture || group;

      tokens.push({
        name: name || key++,
        prefix: prefix || '',
        delimiter: delimiter,
        optional: optional,
        repeat: repeat,
        partial: partial,
        asterisk: !!asterisk,
        pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
      });
    }

    // Match any characters still remaining.
    if (index < str.length) {
      path += str.substr(index);
    }

    // If the path exists, push it onto the end.
    if (path) {
      tokens.push(path);
    }

    return tokens
  }

  /**
   * Compile a string to a template function for the path.
   *
   * @param  {string}             str
   * @param  {Object=}            options
   * @return {!function(Object=, Object=)}
   */
  function compile (str, options) {
    return tokensToFunction(parse(str, options))
  }

  /**
   * Prettier encoding of URI path segments.
   *
   * @param  {string}
   * @return {string}
   */
  function encodeURIComponentPretty (str) {
    return encodeURI(str).replace(/[\/?#]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase()
    })
  }

  /**
   * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
   *
   * @param  {string}
   * @return {string}
   */
  function encodeAsterisk (str) {
    return encodeURI(str).replace(/[?#]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase()
    })
  }

  /**
   * Expose a method for transforming tokens into the path function.
   */
  function tokensToFunction (tokens) {
    // Compile all the tokens into regexps.
    var matches = new Array(tokens.length);

    // Compile all the patterns before compilation.
    for (var i = 0; i < tokens.length; i++) {
      if (typeof tokens[i] === 'object') {
        matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$');
      }
    }

    return function (obj, opts) {
      var path = '';
      var data = obj || {};
      var options = opts || {};
      var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent;

      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        if (typeof token === 'string') {
          path += token;

          continue
        }

        var value = data[token.name];
        var segment;

        if (value == null) {
          if (token.optional) {
            // Prepend partial segment prefixes.
            if (token.partial) {
              path += token.prefix;
            }

            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to be defined')
          }
        }

        if (isarray(value)) {
          if (!token.repeat) {
            throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
          }

          if (value.length === 0) {
            if (token.optional) {
              continue
            } else {
              throw new TypeError('Expected "' + token.name + '" to not be empty')
            }
          }

          for (var j = 0; j < value.length; j++) {
            segment = encode(value[j]);

            if (!matches[i].test(segment)) {
              throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
            }

            path += (j === 0 ? token.prefix : token.delimiter) + segment;
          }

          continue
        }

        segment = token.asterisk ? encodeAsterisk(value) : encode(value);

        if (!matches[i].test(segment)) {
          throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
        }

        path += token.prefix + segment;
      }

      return path
    }
  }

  /**
   * Escape a regular expression string.
   *
   * @param  {string} str
   * @return {string}
   */
  function escapeString (str) {
    return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
  }

  /**
   * Escape the capturing group by escaping special characters and meaning.
   *
   * @param  {string} group
   * @return {string}
   */
  function escapeGroup (group) {
    return group.replace(/([=!:$\/()])/g, '\\$1')
  }

  /**
   * Attach the keys as a property of the regexp.
   *
   * @param  {!RegExp} re
   * @param  {Array}   keys
   * @return {!RegExp}
   */
  function attachKeys (re, keys) {
    re.keys = keys;
    return re
  }

  /**
   * Get the flags for a regexp from the options.
   *
   * @param  {Object} options
   * @return {string}
   */
  function flags (options) {
    return options.sensitive ? '' : 'i'
  }

  /**
   * Pull out keys from a regexp.
   *
   * @param  {!RegExp} path
   * @param  {!Array}  keys
   * @return {!RegExp}
   */
  function regexpToRegexp (path, keys) {
    // Use a negative lookahead to match only capturing groups.
    var groups = path.source.match(/\((?!\?)/g);

    if (groups) {
      for (var i = 0; i < groups.length; i++) {
        keys.push({
          name: i,
          prefix: null,
          delimiter: null,
          optional: false,
          repeat: false,
          partial: false,
          asterisk: false,
          pattern: null
        });
      }
    }

    return attachKeys(path, keys)
  }

  /**
   * Transform an array into a regexp.
   *
   * @param  {!Array}  path
   * @param  {Array}   keys
   * @param  {!Object} options
   * @return {!RegExp}
   */
  function arrayToRegexp (path, keys, options) {
    var parts = [];

    for (var i = 0; i < path.length; i++) {
      parts.push(pathToRegexp(path[i], keys, options).source);
    }

    var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

    return attachKeys(regexp, keys)
  }

  /**
   * Create a path regexp from string input.
   *
   * @param  {string}  path
   * @param  {!Array}  keys
   * @param  {!Object} options
   * @return {!RegExp}
   */
  function stringToRegexp (path, keys, options) {
    return tokensToRegExp(parse(path, options), keys, options)
  }

  /**
   * Expose a function for taking tokens and returning a RegExp.
   *
   * @param  {!Array}          tokens
   * @param  {(Array|Object)=} keys
   * @param  {Object=}         options
   * @return {!RegExp}
   */
  function tokensToRegExp (tokens, keys, options) {
    if (!isarray(keys)) {
      options = /** @type {!Object} */ (keys || options);
      keys = [];
    }

    options = options || {};

    var strict = options.strict;
    var end = options.end !== false;
    var route = '';

    // Iterate over the tokens and create our regexp string.
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];

      if (typeof token === 'string') {
        route += escapeString(token);
      } else {
        var prefix = escapeString(token.prefix);
        var capture = '(?:' + token.pattern + ')';

        keys.push(token);

        if (token.repeat) {
          capture += '(?:' + prefix + capture + ')*';
        }

        if (token.optional) {
          if (!token.partial) {
            capture = '(?:' + prefix + '(' + capture + '))?';
          } else {
            capture = prefix + '(' + capture + ')?';
          }
        } else {
          capture = prefix + '(' + capture + ')';
        }

        route += capture;
      }
    }

    var delimiter = escapeString(options.delimiter || '/');
    var endsWithDelimiter = route.slice(-delimiter.length) === delimiter;

    // In non-strict mode we allow a slash at the end of match. If the path to
    // match already ends with a slash, we remove it for consistency. The slash
    // is valid at the end of a path match, not in the middle. This is important
    // in non-ending mode, where "/test/" shouldn't match "/test//route".
    if (!strict) {
      route = (endsWithDelimiter ? route.slice(0, -delimiter.length) : route) + '(?:' + delimiter + '(?=$))?';
    }

    if (end) {
      route += '$';
    } else {
      // In non-ending mode, we need the capturing groups to match as much as
      // possible by using a positive lookahead to the end or next path segment.
      route += strict && endsWithDelimiter ? '' : '(?=' + delimiter + '|$)';
    }

    return attachKeys(new RegExp('^' + route, flags(options)), keys)
  }

  /**
   * Normalize the given path string, returning a regular expression.
   *
   * An empty array can be passed in for the keys, which will hold the
   * placeholder key descriptions. For example, using `/user/:id`, `keys` will
   * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
   *
   * @param  {(string|RegExp|Array)} path
   * @param  {(Array|Object)=}       keys
   * @param  {Object=}               options
   * @return {!RegExp}
   */
  function pathToRegexp (path, keys, options) {
    if (!isarray(keys)) {
      options = /** @type {!Object} */ (keys || options);
      keys = [];
    }

    options = options || {};

    if (path instanceof RegExp) {
      return regexpToRegexp(path, /** @type {!Array} */ (keys))
    }

    if (isarray(path)) {
      return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
    }

    return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
  }
  pathToRegexp_1.parse = parse_1;
  pathToRegexp_1.compile = compile_1;
  pathToRegexp_1.tokensToFunction = tokensToFunction_1;
  pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var promise = createCommonjsModule(function (module) {
  (function (root) {

    // Store setTimeout reference so promise-polyfill will be unaffected by
    // other code modifying setTimeout (like sinon.useFakeTimers())
    var setTimeoutFunc = setTimeout;

    function noop() {}
    
    // Polyfill for Function.prototype.bind
    function bind(fn, thisArg) {
      return function () {
        fn.apply(thisArg, arguments);
      };
    }

    function Promise(fn) {
      if (typeof this !== 'object') { throw new TypeError('Promises must be constructed via new'); }
      if (typeof fn !== 'function') { throw new TypeError('not a function'); }
      this._state = 0;
      this._handled = false;
      this._value = undefined;
      this._deferreds = [];

      doResolve(fn, this);
    }

    function handle(self, deferred) {
      while (self._state === 3) {
        self = self._value;
      }
      if (self._state === 0) {
        self._deferreds.push(deferred);
        return;
      }
      self._handled = true;
      Promise._immediateFn(function () {
        var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
        if (cb === null) {
          (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
          return;
        }
        var ret;
        try {
          ret = cb(self._value);
        } catch (e) {
          reject(deferred.promise, e);
          return;
        }
        resolve(deferred.promise, ret);
      });
    }

    function resolve(self, newValue) {
      try {
        // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
        if (newValue === self) { throw new TypeError('A promise cannot be resolved with itself.'); }
        if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
          var then = newValue.then;
          if (newValue instanceof Promise) {
            self._state = 3;
            self._value = newValue;
            finale(self);
            return;
          } else if (typeof then === 'function') {
            doResolve(bind(then, newValue), self);
            return;
          }
        }
        self._state = 1;
        self._value = newValue;
        finale(self);
      } catch (e) {
        reject(self, e);
      }
    }

    function reject(self, newValue) {
      self._state = 2;
      self._value = newValue;
      finale(self);
    }

    function finale(self) {
      if (self._state === 2 && self._deferreds.length === 0) {
        Promise._immediateFn(function() {
          if (!self._handled) {
            Promise._unhandledRejectionFn(self._value);
          }
        });
      }

      for (var i = 0, len = self._deferreds.length; i < len; i++) {
        handle(self, self._deferreds[i]);
      }
      self._deferreds = null;
    }

    function Handler(onFulfilled, onRejected, promise) {
      this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
      this.onRejected = typeof onRejected === 'function' ? onRejected : null;
      this.promise = promise;
    }

    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     *
     * Makes no guarantees about asynchrony.
     */
    function doResolve(fn, self) {
      var done = false;
      try {
        fn(function (value) {
          if (done) { return; }
          done = true;
          resolve(self, value);
        }, function (reason) {
          if (done) { return; }
          done = true;
          reject(self, reason);
        });
      } catch (ex) {
        if (done) { return; }
        done = true;
        reject(self, ex);
      }
    }

    Promise.prototype['catch'] = function (onRejected) {
      return this.then(null, onRejected);
    };

    Promise.prototype.then = function (onFulfilled, onRejected) {
      var prom = new (this.constructor)(noop);

      handle(this, new Handler(onFulfilled, onRejected, prom));
      return prom;
    };

    Promise.all = function (arr) {
      var args = Array.prototype.slice.call(arr);

      return new Promise(function (resolve, reject) {
        if (args.length === 0) { return resolve([]); }
        var remaining = args.length;

        function res(i, val) {
          try {
            if (val && (typeof val === 'object' || typeof val === 'function')) {
              var then = val.then;
              if (typeof then === 'function') {
                then.call(val, function (val) {
                  res(i, val);
                }, reject);
                return;
              }
            }
            args[i] = val;
            if (--remaining === 0) {
              resolve(args);
            }
          } catch (ex) {
            reject(ex);
          }
        }

        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };

    Promise.resolve = function (value) {
      if (value && typeof value === 'object' && value.constructor === Promise) {
        return value;
      }

      return new Promise(function (resolve) {
        resolve(value);
      });
    };

    Promise.reject = function (value) {
      return new Promise(function (resolve, reject) {
        reject(value);
      });
    };

    Promise.race = function (values) {
      return new Promise(function (resolve, reject) {
        for (var i = 0, len = values.length; i < len; i++) {
          values[i].then(resolve, reject);
        }
      });
    };

    // Use polyfill for setImmediate for performance gains
    Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
      function (fn) {
        setTimeoutFunc(fn, 0);
      };

    Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
      if (typeof console !== 'undefined' && console) {
        console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
      }
    };

    /**
     * Set the immediate function to execute callbacks
     * @param fn {function} Function to execute
     * @deprecated
     */
    Promise._setImmediateFn = function _setImmediateFn(fn) {
      Promise._immediateFn = fn;
    };

    /**
     * Change the function to execute on unhandled rejection
     * @param {function} fn Function to execute on unhandled rejection
     * @deprecated
     */
    Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
      Promise._unhandledRejectionFn = fn;
    };
    
    if (module.exports) {
      module.exports = Promise;
    } else if (!root.Promise) {
      root.Promise = Promise;
    }

  })(commonjsGlobal);
  });

  /**
   * Copyright 2014-2015, Facebook, Inc.
   * All rights reserved.
   *
   * This source code is licensed under the BSD-style license found in the
   * LICENSE file in the root directory of this source tree. An additional grant
   * of patent rights can be found in the PATENTS file in the same directory.
   */

  /**
   * Similar to invariant but only logs a warning if the condition is not met.
   * This can be used to log issues in development environments in critical
   * paths. Removing the logging code for production environments will keep the
   * same logic and follow the same code paths.
   */

  var warning = function() {};

  {
    warning = function(condition, format, args) {
      var arguments$1 = arguments;

      var len = arguments.length;
      args = new Array(len > 2 ? len - 2 : 0);
      for (var key = 2; key < len; key++) {
        args[key - 2] = arguments$1[key];
      }
      if (format === undefined) {
        throw new Error(
          '`warning(condition, format, ...args)` requires a warning ' +
          'message argument'
        );
      }

      if (format.length < 10 || (/^[s\W]*$/).test(format)) {
        throw new Error(
          'The warning format should be able to uniquely identify this ' +
          'warning. Please, use a more descriptive format than: ' + format
        );
      }

      if (!condition) {
        var argIndex = 0;
        var message = 'Warning: ' +
          format.replace(/%s/g, function() {
            return args[argIndex++];
          });
        if (typeof console !== 'undefined') {
          console.error(message);
        }
        try {
          // This error was thrown as a convenience so that you can use this stack
          // to find the callsite that caused this warning to fire.
          throw new Error(message);
        } catch(x) {}
      }
    };
  }

  var browser = warning;

  /**
   * Copyright 2013-2015, Facebook, Inc.
   * All rights reserved.
   *
   * This source code is licensed under the BSD-style license found in the
   * LICENSE file in the root directory of this source tree. An additional grant
   * of patent rights can be found in the PATENTS file in the same directory.
   */

  /**
   * Use invariant() to assert state which your program assumes to be true.
   *
   * Provide sprintf-style format (only %s is supported) and arguments
   * to provide information about what broke and what you were
   * expecting.
   *
   * The invariant message will be stripped in production, but the invariant
   * will remain to ensure logic does not differ in production.
   */

  var invariant = function(condition, format, a, b, c, d, e, f) {
    {
      if (format === undefined) {
        throw new Error('invariant requires an error message argument');
      }
    }

    if (!condition) {
      var error;
      if (format === undefined) {
        error = new Error(
          'Minified exception occurred; use the non-minified dev environment ' +
          'for the full error message and additional helpful warnings.'
        );
      } else {
        var args = [a, b, c, d, e, f];
        var argIndex = 0;
        error = new Error(
          format.replace(/%s/g, function() { return args[argIndex++]; })
        );
        error.name = 'Invariant Violation';
      }

      error.framesToPop = 1; // we don't care about invariant's own frame
      throw error;
    }
  };

  var browser$1 = invariant;

  var isAbsolute = function isAbsolute(pathname) {
    return pathname.charAt(0) === '/';
  };

  // About 1.5x faster than the two-arg version of Array#splice()
  var spliceOne = function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1) {
      list[i] = list[k];
    }list.pop();
  };

  // This implementation is based heavily on node's url.parse
  var resolvePathname = function resolvePathname(to) {
    var from = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

    var toParts = to && to.split('/') || [];
    var fromParts = from && from.split('/') || [];

    var isToAbs = to && isAbsolute(to);
    var isFromAbs = from && isAbsolute(from);
    var mustEndAbs = isToAbs || isFromAbs;

    if (to && isAbsolute(to)) {
      // to is absolute
      fromParts = toParts;
    } else if (toParts.length) {
      // to is relative, drop the filename
      fromParts.pop();
      fromParts = fromParts.concat(toParts);
    }

    if (!fromParts.length) { return '/'; }

    var hasTrailingSlash = void 0;
    if (fromParts.length) {
      var last = fromParts[fromParts.length - 1];
      hasTrailingSlash = last === '.' || last === '..' || last === '';
    } else {
      hasTrailingSlash = false;
    }

    var up = 0;
    for (var i = fromParts.length; i >= 0; i--) {
      var part = fromParts[i];

      if (part === '.') {
        spliceOne(fromParts, i);
      } else if (part === '..') {
        spliceOne(fromParts, i);
        up++;
      } else if (up) {
        spliceOne(fromParts, i);
        up--;
      }
    }

    if (!mustEndAbs) { for (; up--; up) {
      fromParts.unshift('..');
    } }if (mustEndAbs && fromParts[0] !== '' && (!fromParts[0] || !isAbsolute(fromParts[0]))) { fromParts.unshift(''); }

    var result = fromParts.join('/');

    if (hasTrailingSlash && result.substr(-1) !== '/') { result += '/'; }

    return result;
  };

  var resolvePathname_1 = resolvePathname;

  var valueEqual_1 = createCommonjsModule(function (module, exports) {

  exports.__esModule = true;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

  var valueEqual = function valueEqual(a, b) {
    if (a === b) { return true; }

    if (a == null || b == null) { return false; }

    if (Array.isArray(a)) { return Array.isArray(b) && a.length === b.length && a.every(function (item, index) {
      return valueEqual(item, b[index]);
    }); }

    var aType = typeof a === 'undefined' ? 'undefined' : _typeof(a);
    var bType = typeof b === 'undefined' ? 'undefined' : _typeof(b);

    if (aType !== bType) { return false; }

    if (aType === 'object') {
      var aValue = a.valueOf();
      var bValue = b.valueOf();

      if (aValue !== a || bValue !== b) { return valueEqual(aValue, bValue); }

      var aKeys = Object.keys(a);
      var bKeys = Object.keys(b);

      if (aKeys.length !== bKeys.length) { return false; }

      return aKeys.every(function (key) {
        return valueEqual(a[key], b[key]);
      });
    }

    return false;
  };

  exports.default = valueEqual;
  });

  var valueEqual = unwrapExports(valueEqual_1);

  var addLeadingSlash = function addLeadingSlash(path) {
    return path.charAt(0) === '/' ? path : '/' + path;
  };

  var stripLeadingSlash = function stripLeadingSlash(path) {
    return path.charAt(0) === '/' ? path.substr(1) : path;
  };

  var hasBasename = function hasBasename(path, prefix) {
    return new RegExp('^' + prefix + '(\\/|\\?|#|$)', 'i').test(path);
  };

  var stripBasename = function stripBasename(path, prefix) {
    return hasBasename(path, prefix) ? path.substr(prefix.length) : path;
  };

  var stripTrailingSlash = function stripTrailingSlash(path) {
    return path.charAt(path.length - 1) === '/' ? path.slice(0, -1) : path;
  };

  var parsePath = function parsePath(path) {
    var pathname = path || '/';
    var search = '';
    var hash = '';

    var hashIndex = pathname.indexOf('#');
    if (hashIndex !== -1) {
      hash = pathname.substr(hashIndex);
      pathname = pathname.substr(0, hashIndex);
    }

    var searchIndex = pathname.indexOf('?');
    if (searchIndex !== -1) {
      search = pathname.substr(searchIndex);
      pathname = pathname.substr(0, searchIndex);
    }

    return {
      pathname: pathname,
      search: search === '?' ? '' : search,
      hash: hash === '#' ? '' : hash
    };
  };

  var createPath = function createPath(location) {
    var pathname = location.pathname,
        search = location.search,
        hash = location.hash;


    var path = pathname || '/';

    if (search && search !== '?') { path += search.charAt(0) === '?' ? search : '?' + search; }

    if (hash && hash !== '#') { path += hash.charAt(0) === '#' ? hash : '#' + hash; }

    return path;
  };

  var _extends = Object.assign || function (target) {
  var arguments$1 = arguments;
   for (var i = 1; i < arguments.length; i++) { var source = arguments$1[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  var createLocation = function createLocation(path, state, key, currentLocation) {
    var location = void 0;
    if (typeof path === 'string') {
      // Two-arg form: push(path, state)
      location = parsePath(path);
      location.state = state;
    } else {
      // One-arg form: push(location)
      location = _extends({}, path);

      if (location.pathname === undefined) { location.pathname = ''; }

      if (location.search) {
        if (location.search.charAt(0) !== '?') { location.search = '?' + location.search; }
      } else {
        location.search = '';
      }

      if (location.hash) {
        if (location.hash.charAt(0) !== '#') { location.hash = '#' + location.hash; }
      } else {
        location.hash = '';
      }

      if (state !== undefined && location.state === undefined) { location.state = state; }
    }

    try {
      location.pathname = decodeURI(location.pathname);
    } catch (e) {
      if (e instanceof URIError) {
        throw new URIError('Pathname "' + location.pathname + '" could not be decoded. ' + 'This is likely caused by an invalid percent-encoding.');
      } else {
        throw e;
      }
    }

    if (key) { location.key = key; }

    if (currentLocation) {
      // Resolve incomplete/relative pathname relative to current location.
      if (!location.pathname) {
        location.pathname = currentLocation.pathname;
      } else if (location.pathname.charAt(0) !== '/') {
        location.pathname = resolvePathname_1(location.pathname, currentLocation.pathname);
      }
    } else {
      // When there is no prior location and pathname is empty, set it to /
      if (!location.pathname) {
        location.pathname = '/';
      }
    }

    return location;
  };

  var locationsAreEqual = function locationsAreEqual(a, b) {
    return a.pathname === b.pathname && a.search === b.search && a.hash === b.hash && a.key === b.key && valueEqual(a.state, b.state);
  };

  var createTransitionManager = function createTransitionManager() {
    var prompt = null;

    var setPrompt = function setPrompt(nextPrompt) {
      browser(prompt == null, 'A history supports only one prompt at a time');

      prompt = nextPrompt;

      return function () {
        if (prompt === nextPrompt) { prompt = null; }
      };
    };

    var confirmTransitionTo = function confirmTransitionTo(location, action, getUserConfirmation, callback) {
      // TODO: If another transition starts while we're still confirming
      // the previous one, we may end up in a weird state. Figure out the
      // best way to handle this.
      if (prompt != null) {
        var result = typeof prompt === 'function' ? prompt(location, action) : prompt;

        if (typeof result === 'string') {
          if (typeof getUserConfirmation === 'function') {
            getUserConfirmation(result, callback);
          } else {
            browser(false, 'A history needs a getUserConfirmation function in order to use a prompt message');

            callback(true);
          }
        } else {
          // Return false from a transition hook to cancel the transition.
          callback(result !== false);
        }
      } else {
        callback(true);
      }
    };

    var listeners = [];

    var appendListener = function appendListener(fn) {
      var isActive = true;

      var listener = function listener() {
        if (isActive) { fn.apply(undefined, arguments); }
      };

      listeners.push(listener);

      return function () {
        isActive = false;
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      };
    };

    var notifyListeners = function notifyListeners() {
      var arguments$1 = arguments;

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments$1[_key];
      }

      listeners.forEach(function (listener) {
        return listener.apply(undefined, args);
      });
    };

    return {
      setPrompt: setPrompt,
      confirmTransitionTo: confirmTransitionTo,
      appendListener: appendListener,
      notifyListeners: notifyListeners
    };
  };

  var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);

  var addEventListener = function addEventListener(node, event, listener) {
    return node.addEventListener ? node.addEventListener(event, listener, false) : node.attachEvent('on' + event, listener);
  };

  var removeEventListener = function removeEventListener(node, event, listener) {
    return node.removeEventListener ? node.removeEventListener(event, listener, false) : node.detachEvent('on' + event, listener);
  };

  var getConfirmation = function getConfirmation(message, callback) {
    return callback(window.confirm(message));
  }; // eslint-disable-line no-alert

  /**
   * Returns true if the HTML5 history API is supported. Taken from Modernizr.
   *
   * https://github.com/Modernizr/Modernizr/blob/master/LICENSE
   * https://github.com/Modernizr/Modernizr/blob/master/feature-detects/history.js
   * changed to avoid false negatives for Windows Phones: https://github.com/reactjs/react-router/issues/586
   */
  var supportsHistory = function supportsHistory() {
    var ua = window.navigator.userAgent;

    if ((ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) && ua.indexOf('Mobile Safari') !== -1 && ua.indexOf('Chrome') === -1 && ua.indexOf('Windows Phone') === -1) { return false; }

    return window.history && 'pushState' in window.history;
  };

  /**
   * Returns true if browser fires popstate on hash change.
   * IE10 and IE11 do not.
   */
  var supportsPopStateOnHashChange = function supportsPopStateOnHashChange() {
    return window.navigator.userAgent.indexOf('Trident') === -1;
  };

  /**
   * Returns false if using go(n) with hash history causes a full page reload.
   */
  var supportsGoWithoutReloadUsingHash = function supportsGoWithoutReloadUsingHash() {
    return window.navigator.userAgent.indexOf('Firefox') === -1;
  };

  /**
   * Returns true if a given popstate event is an extraneous WebKit event.
   * Accounts for the fact that Chrome on iOS fires real popstate events
   * containing undefined state when pressing the back button.
   */
  var isExtraneousPopstateEvent = function isExtraneousPopstateEvent(event) {
    return event.state === undefined && navigator.userAgent.indexOf('CriOS') === -1;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

  var _extends$1 = Object.assign || function (target) {
  var arguments$1 = arguments;
   for (var i = 1; i < arguments.length; i++) { var source = arguments$1[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  var PopStateEvent = 'popstate';
  var HashChangeEvent = 'hashchange';

  var getHistoryState = function getHistoryState() {
    try {
      return window.history.state || {};
    } catch (e) {
      // IE 11 sometimes throws when accessing window.history.state
      // See https://github.com/ReactTraining/history/pull/289
      return {};
    }
  };

  /**
   * Creates a history object that uses the HTML5 history API including
   * pushState, replaceState, and the popstate event.
   */
  var createBrowserHistory = function createBrowserHistory() {
    var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    browser$1(canUseDOM, 'Browser history needs a DOM');

    var globalHistory = window.history;
    var canUseHistory = supportsHistory();
    var needsHashChangeListener = !supportsPopStateOnHashChange();

    var _props$forceRefresh = props.forceRefresh,
        forceRefresh = _props$forceRefresh === undefined ? false : _props$forceRefresh,
        _props$getUserConfirm = props.getUserConfirmation,
        getUserConfirmation = _props$getUserConfirm === undefined ? getConfirmation : _props$getUserConfirm,
        _props$keyLength = props.keyLength,
        keyLength = _props$keyLength === undefined ? 6 : _props$keyLength;

    var basename = props.basename ? stripTrailingSlash(addLeadingSlash(props.basename)) : '';

    var getDOMLocation = function getDOMLocation(historyState) {
      var _ref = historyState || {},
          key = _ref.key,
          state = _ref.state;

      var _window$location = window.location,
          pathname = _window$location.pathname,
          search = _window$location.search,
          hash = _window$location.hash;


      var path = pathname + search + hash;

      browser(!basename || hasBasename(path, basename), 'You are attempting to use a basename on a page whose URL path does not begin ' + 'with the basename. Expected path "' + path + '" to begin with "' + basename + '".');

      if (basename) { path = stripBasename(path, basename); }

      return createLocation(path, state, key);
    };

    var createKey = function createKey() {
      return Math.random().toString(36).substr(2, keyLength);
    };

    var transitionManager = createTransitionManager();

    var setState = function setState(nextState) {
      _extends$1(history, nextState);

      history.length = globalHistory.length;

      transitionManager.notifyListeners(history.location, history.action);
    };

    var handlePopState = function handlePopState(event) {
      // Ignore extraneous popstate events in WebKit.
      if (isExtraneousPopstateEvent(event)) { return; }

      handlePop(getDOMLocation(event.state));
    };

    var handleHashChange = function handleHashChange() {
      handlePop(getDOMLocation(getHistoryState()));
    };

    var forceNextPop = false;

    var handlePop = function handlePop(location) {
      if (forceNextPop) {
        forceNextPop = false;
        setState();
      } else {
        var action = 'POP';

        transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
          if (ok) {
            setState({ action: action, location: location });
          } else {
            revertPop(location);
          }
        });
      }
    };

    var revertPop = function revertPop(fromLocation) {
      var toLocation = history.location;

      // TODO: We could probably make this more reliable by
      // keeping a list of keys we've seen in sessionStorage.
      // Instead, we just default to 0 for keys we don't know.

      var toIndex = allKeys.indexOf(toLocation.key);

      if (toIndex === -1) { toIndex = 0; }

      var fromIndex = allKeys.indexOf(fromLocation.key);

      if (fromIndex === -1) { fromIndex = 0; }

      var delta = toIndex - fromIndex;

      if (delta) {
        forceNextPop = true;
        go(delta);
      }
    };

    var initialLocation = getDOMLocation(getHistoryState());
    var allKeys = [initialLocation.key];

    // Public interface

    var createHref = function createHref(location) {
      return basename + createPath(location);
    };

    var push = function push(path, state) {
      browser(!((typeof path === 'undefined' ? 'undefined' : _typeof(path)) === 'object' && path.state !== undefined && state !== undefined), 'You should avoid providing a 2nd state argument to push when the 1st ' + 'argument is a location-like object that already has state; it is ignored');

      var action = 'PUSH';
      var location = createLocation(path, state, createKey(), history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        var href = createHref(location);
        var key = location.key,
            state = location.state;


        if (canUseHistory) {
          globalHistory.pushState({ key: key, state: state }, null, href);

          if (forceRefresh) {
            window.location.href = href;
          } else {
            var prevIndex = allKeys.indexOf(history.location.key);
            var nextKeys = allKeys.slice(0, prevIndex === -1 ? 0 : prevIndex + 1);

            nextKeys.push(location.key);
            allKeys = nextKeys;

            setState({ action: action, location: location });
          }
        } else {
          browser(state === undefined, 'Browser history cannot push state in browsers that do not support HTML5 history');

          window.location.href = href;
        }
      });
    };

    var replace = function replace(path, state) {
      browser(!((typeof path === 'undefined' ? 'undefined' : _typeof(path)) === 'object' && path.state !== undefined && state !== undefined), 'You should avoid providing a 2nd state argument to replace when the 1st ' + 'argument is a location-like object that already has state; it is ignored');

      var action = 'REPLACE';
      var location = createLocation(path, state, createKey(), history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        var href = createHref(location);
        var key = location.key,
            state = location.state;


        if (canUseHistory) {
          globalHistory.replaceState({ key: key, state: state }, null, href);

          if (forceRefresh) {
            window.location.replace(href);
          } else {
            var prevIndex = allKeys.indexOf(history.location.key);

            if (prevIndex !== -1) { allKeys[prevIndex] = location.key; }

            setState({ action: action, location: location });
          }
        } else {
          browser(state === undefined, 'Browser history cannot replace state in browsers that do not support HTML5 history');

          window.location.replace(href);
        }
      });
    };

    var go = function go(n) {
      globalHistory.go(n);
    };

    var goBack = function goBack() {
      return go(-1);
    };

    var goForward = function goForward() {
      return go(1);
    };

    var listenerCount = 0;

    var checkDOMListeners = function checkDOMListeners(delta) {
      listenerCount += delta;

      if (listenerCount === 1) {
        addEventListener(window, PopStateEvent, handlePopState);

        if (needsHashChangeListener) { addEventListener(window, HashChangeEvent, handleHashChange); }
      } else if (listenerCount === 0) {
        removeEventListener(window, PopStateEvent, handlePopState);

        if (needsHashChangeListener) { removeEventListener(window, HashChangeEvent, handleHashChange); }
      }
    };

    var isBlocked = false;

    var block = function block() {
      var prompt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      var unblock = transitionManager.setPrompt(prompt);

      if (!isBlocked) {
        checkDOMListeners(1);
        isBlocked = true;
      }

      return function () {
        if (isBlocked) {
          isBlocked = false;
          checkDOMListeners(-1);
        }

        return unblock();
      };
    };

    var listen = function listen(listener) {
      var unlisten = transitionManager.appendListener(listener);
      checkDOMListeners(1);

      return function () {
        checkDOMListeners(-1);
        unlisten();
      };
    };

    var history = {
      length: globalHistory.length,
      action: 'POP',
      location: initialLocation,
      createHref: createHref,
      push: push,
      replace: replace,
      go: go,
      goBack: goBack,
      goForward: goForward,
      block: block,
      listen: listen
    };

    return history;
  };

  var _extends$2 = Object.assign || function (target) {
  var arguments$1 = arguments;
   for (var i = 1; i < arguments.length; i++) { var source = arguments$1[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  var HashChangeEvent$1 = 'hashchange';

  var HashPathCoders = {
    hashbang: {
      encodePath: function encodePath(path) {
        return path.charAt(0) === '!' ? path : '!/' + stripLeadingSlash(path);
      },
      decodePath: function decodePath(path) {
        return path.charAt(0) === '!' ? path.substr(1) : path;
      }
    },
    noslash: {
      encodePath: stripLeadingSlash,
      decodePath: addLeadingSlash
    },
    slash: {
      encodePath: addLeadingSlash,
      decodePath: addLeadingSlash
    }
  };

  var getHashPath = function getHashPath() {
    // We can't use window.location.hash here because it's not
    // consistent across browsers - Firefox will pre-decode it!
    var href = window.location.href;
    var hashIndex = href.indexOf('#');
    return hashIndex === -1 ? '' : href.substring(hashIndex + 1);
  };

  var pushHashPath = function pushHashPath(path) {
    return window.location.hash = path;
  };

  var replaceHashPath = function replaceHashPath(path) {
    var hashIndex = window.location.href.indexOf('#');

    window.location.replace(window.location.href.slice(0, hashIndex >= 0 ? hashIndex : 0) + '#' + path);
  };

  var createHashHistory = function createHashHistory() {
    var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    browser$1(canUseDOM, 'Hash history needs a DOM');

    var globalHistory = window.history;
    var canGoWithoutReload = supportsGoWithoutReloadUsingHash();

    var _props$getUserConfirm = props.getUserConfirmation,
        getUserConfirmation = _props$getUserConfirm === undefined ? getConfirmation : _props$getUserConfirm,
        _props$hashType = props.hashType,
        hashType = _props$hashType === undefined ? 'slash' : _props$hashType;

    var basename = props.basename ? stripTrailingSlash(addLeadingSlash(props.basename)) : '';

    var _HashPathCoders$hashT = HashPathCoders[hashType],
        encodePath = _HashPathCoders$hashT.encodePath,
        decodePath = _HashPathCoders$hashT.decodePath;


    var getDOMLocation = function getDOMLocation() {
      var path = decodePath(getHashPath());

      browser(!basename || hasBasename(path, basename), 'You are attempting to use a basename on a page whose URL path does not begin ' + 'with the basename. Expected path "' + path + '" to begin with "' + basename + '".');

      if (basename) { path = stripBasename(path, basename); }

      return createLocation(path);
    };

    var transitionManager = createTransitionManager();

    var setState = function setState(nextState) {
      _extends$2(history, nextState);

      history.length = globalHistory.length;

      transitionManager.notifyListeners(history.location, history.action);
    };

    var forceNextPop = false;
    var ignorePath = null;

    var handleHashChange = function handleHashChange() {
      var path = getHashPath();
      var encodedPath = encodePath(path);

      if (path !== encodedPath) {
        // Ensure we always have a properly-encoded hash.
        replaceHashPath(encodedPath);
      } else {
        var location = getDOMLocation();
        var prevLocation = history.location;

        if (!forceNextPop && locationsAreEqual(prevLocation, location)) { return; } // A hashchange doesn't always == location change.

        if (ignorePath === createPath(location)) { return; } // Ignore this change; we already setState in push/replace.

        ignorePath = null;

        handlePop(location);
      }
    };

    var handlePop = function handlePop(location) {
      if (forceNextPop) {
        forceNextPop = false;
        setState();
      } else {
        var action = 'POP';

        transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
          if (ok) {
            setState({ action: action, location: location });
          } else {
            revertPop(location);
          }
        });
      }
    };

    var revertPop = function revertPop(fromLocation) {
      var toLocation = history.location;

      // TODO: We could probably make this more reliable by
      // keeping a list of paths we've seen in sessionStorage.
      // Instead, we just default to 0 for paths we don't know.

      var toIndex = allPaths.lastIndexOf(createPath(toLocation));

      if (toIndex === -1) { toIndex = 0; }

      var fromIndex = allPaths.lastIndexOf(createPath(fromLocation));

      if (fromIndex === -1) { fromIndex = 0; }

      var delta = toIndex - fromIndex;

      if (delta) {
        forceNextPop = true;
        go(delta);
      }
    };

    // Ensure the hash is encoded properly before doing anything else.
    var path = getHashPath();
    var encodedPath = encodePath(path);

    if (path !== encodedPath) { replaceHashPath(encodedPath); }

    var initialLocation = getDOMLocation();
    var allPaths = [createPath(initialLocation)];

    // Public interface

    var createHref = function createHref(location) {
      return '#' + encodePath(basename + createPath(location));
    };

    var push = function push(path, state) {
      browser(state === undefined, 'Hash history cannot push state; it is ignored');

      var action = 'PUSH';
      var location = createLocation(path, undefined, undefined, history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        var path = createPath(location);
        var encodedPath = encodePath(basename + path);
        var hashChanged = getHashPath() !== encodedPath;

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a PUSH, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path;
          pushHashPath(encodedPath);

          var prevIndex = allPaths.lastIndexOf(createPath(history.location));
          var nextPaths = allPaths.slice(0, prevIndex === -1 ? 0 : prevIndex + 1);

          nextPaths.push(path);
          allPaths = nextPaths;

          setState({ action: action, location: location });
        } else {
          browser(false, 'Hash history cannot PUSH the same path; a new entry will not be added to the history stack');

          setState();
        }
      });
    };

    var replace = function replace(path, state) {
      browser(state === undefined, 'Hash history cannot replace state; it is ignored');

      var action = 'REPLACE';
      var location = createLocation(path, undefined, undefined, history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        var path = createPath(location);
        var encodedPath = encodePath(basename + path);
        var hashChanged = getHashPath() !== encodedPath;

        if (hashChanged) {
          // We cannot tell if a hashchange was caused by a REPLACE, so we'd
          // rather setState here and ignore the hashchange. The caveat here
          // is that other hash histories in the page will consider it a POP.
          ignorePath = path;
          replaceHashPath(encodedPath);
        }

        var prevIndex = allPaths.indexOf(createPath(history.location));

        if (prevIndex !== -1) { allPaths[prevIndex] = path; }

        setState({ action: action, location: location });
      });
    };

    var go = function go(n) {
      browser(canGoWithoutReload, 'Hash history go(n) causes a full page reload in this browser');

      globalHistory.go(n);
    };

    var goBack = function goBack() {
      return go(-1);
    };

    var goForward = function goForward() {
      return go(1);
    };

    var listenerCount = 0;

    var checkDOMListeners = function checkDOMListeners(delta) {
      listenerCount += delta;

      if (listenerCount === 1) {
        addEventListener(window, HashChangeEvent$1, handleHashChange);
      } else if (listenerCount === 0) {
        removeEventListener(window, HashChangeEvent$1, handleHashChange);
      }
    };

    var isBlocked = false;

    var block = function block() {
      var prompt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

      var unblock = transitionManager.setPrompt(prompt);

      if (!isBlocked) {
        checkDOMListeners(1);
        isBlocked = true;
      }

      return function () {
        if (isBlocked) {
          isBlocked = false;
          checkDOMListeners(-1);
        }

        return unblock();
      };
    };

    var listen = function listen(listener) {
      var unlisten = transitionManager.appendListener(listener);
      checkDOMListeners(1);

      return function () {
        checkDOMListeners(-1);
        unlisten();
      };
    };

    var history = {
      length: globalHistory.length,
      action: 'POP',
      location: initialLocation,
      createHref: createHref,
      push: push,
      replace: replace,
      go: go,
      goBack: goBack,
      goForward: goForward,
      block: block,
      listen: listen
    };

    return history;
  };

  var _typeof$1 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

  var _extends$3 = Object.assign || function (target) {
  var arguments$1 = arguments;
   for (var i = 1; i < arguments.length; i++) { var source = arguments$1[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  var clamp = function clamp(n, lowerBound, upperBound) {
    return Math.min(Math.max(n, lowerBound), upperBound);
  };

  /**
   * Creates a history object that stores locations in memory.
   */
  var createMemoryHistory = function createMemoryHistory() {
    var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var getUserConfirmation = props.getUserConfirmation,
        _props$initialEntries = props.initialEntries,
        initialEntries = _props$initialEntries === undefined ? ['/'] : _props$initialEntries,
        _props$initialIndex = props.initialIndex,
        initialIndex = _props$initialIndex === undefined ? 0 : _props$initialIndex,
        _props$keyLength = props.keyLength,
        keyLength = _props$keyLength === undefined ? 6 : _props$keyLength;


    var transitionManager = createTransitionManager();

    var setState = function setState(nextState) {
      _extends$3(history, nextState);

      history.length = history.entries.length;

      transitionManager.notifyListeners(history.location, history.action);
    };

    var createKey = function createKey() {
      return Math.random().toString(36).substr(2, keyLength);
    };

    var index = clamp(initialIndex, 0, initialEntries.length - 1);
    var entries = initialEntries.map(function (entry) {
      return typeof entry === 'string' ? createLocation(entry, undefined, createKey()) : createLocation(entry, undefined, entry.key || createKey());
    });

    // Public interface

    var createHref = createPath;

    var push = function push(path, state) {
      browser(!((typeof path === 'undefined' ? 'undefined' : _typeof$1(path)) === 'object' && path.state !== undefined && state !== undefined), 'You should avoid providing a 2nd state argument to push when the 1st ' + 'argument is a location-like object that already has state; it is ignored');

      var action = 'PUSH';
      var location = createLocation(path, state, createKey(), history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        var prevIndex = history.index;
        var nextIndex = prevIndex + 1;

        var nextEntries = history.entries.slice(0);
        if (nextEntries.length > nextIndex) {
          nextEntries.splice(nextIndex, nextEntries.length - nextIndex, location);
        } else {
          nextEntries.push(location);
        }

        setState({
          action: action,
          location: location,
          index: nextIndex,
          entries: nextEntries
        });
      });
    };

    var replace = function replace(path, state) {
      browser(!((typeof path === 'undefined' ? 'undefined' : _typeof$1(path)) === 'object' && path.state !== undefined && state !== undefined), 'You should avoid providing a 2nd state argument to replace when the 1st ' + 'argument is a location-like object that already has state; it is ignored');

      var action = 'REPLACE';
      var location = createLocation(path, state, createKey(), history.location);

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (!ok) { return; }

        history.entries[history.index] = location;

        setState({ action: action, location: location });
      });
    };

    var go = function go(n) {
      var nextIndex = clamp(history.index + n, 0, history.entries.length - 1);

      var action = 'POP';
      var location = history.entries[nextIndex];

      transitionManager.confirmTransitionTo(location, action, getUserConfirmation, function (ok) {
        if (ok) {
          setState({
            action: action,
            location: location,
            index: nextIndex
          });
        } else {
          // Mimic the behavior of DOM histories by
          // causing a render after a cancelled POP.
          setState();
        }
      });
    };

    var goBack = function goBack() {
      return go(-1);
    };

    var goForward = function goForward() {
      return go(1);
    };

    var canGo = function canGo(n) {
      var nextIndex = history.index + n;
      return nextIndex >= 0 && nextIndex < history.entries.length;
    };

    var block = function block() {
      var prompt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      return transitionManager.setPrompt(prompt);
    };

    var listen = function listen(listener) {
      return transitionManager.appendListener(listener);
    };

    var history = {
      length: entries.length,
      action: 'POP',
      location: entries[index],
      index: index,
      entries: entries,
      createHref: createHref,
      push: push,
      replace: replace,
      go: go,
      goBack: goBack,
      goForward: goForward,
      canGo: canGo,
      block: block,
      listen: listen
    };

    return history;
  };

  var constants = {
    BROWSER: 'BROWSER',
    MEMORY: 'MEMORY',
    HASH: 'HASH'
  };

  // Copu from mout/array/forEach
  var forEach = function (arr, callback, thisObj) {
    if (arr == null) {
      return;
    }
    var i = -1,
        len = arr.length;
    while (++i < len) {
      // we iterate over sparse items since there is no way to make it
      // work properly on IE 7-8. see #64
      if ( callback.call(thisObj, arr[i], i, arr) === false ) {
        break;
      }
    }
  };

  var Router = function Router(type) {
    if ( type === void 0 ) type = constants.BROWSER;

    /**
     * hash history object.
     * @private
     * @type {Object}
     */
    switch (type) {
    case constants.BROWSER:
      this._history = createBrowserHistory();
      break;
    case constants.MEMORY:
      this._history = createMemoryHistory();
      break;
    case constants.HASH:
      this._history = createHashHistory();
      break;
    default:
      break;
    }

    /**
     * routing definitions.
     * @private
     * @type {Array}
     */
    this._routes = [];

    /**
     * function to stop listening for the changes.
     * to stop, just execute this function.
     * @private
     * @type {Function|null}
     */
    this._unlistener = null;

    /**
     * function that will be called on ahead of every routing.
     * @type {Function|null}
     */
    this._onBefore = null;

    /**
     * function that will be called only once on ahead of routing.
     * @type {Function|null}
     */
    this._onBeforeOnce = null;

    /**
     * function that will be called on behind of every routing.
     * @type {Function|null}
     */
    this._onAfter = null;

    /**
     * function that will be called only once on behind of routing.
     * @type {Function|null}
     */
    this._onAfterOnce = null;
  };

  /**
   * start listening for changes to the current location.
   * @param {Boolean} autoExec to decide whether routing is executed with the current url.
   */
  Router.prototype.start = function start (autoExec) {
      var this$1 = this;
      if ( autoExec === void 0 ) autoExec = true;

    this._unlistener = this._history.listen(function (location, action) {
      this$1._change(location, action);
    });

    if (autoExec) {
      this._change(this.getCurrentLocation(), this.getCurrentAction());
    }
  };

  /**
   * stop listening.
   */
  Router.prototype.stop = function stop () {
    if (!this._unlistener) {
      return;
    }
    this._unlistener();
    this._unlistener = null;
  };

  /**
   * register a route.
   * @param {String} pattern express-like url pattern.
   * @param {Function} onEnter a function that will be executed when the route changes.
   * @param {Function} onBefore a function that will be executed before the route changes.
   * @param {Function} onAfter a function that will be executed after the route changes.
   * @return {Router}
   */
  Router.prototype.on = function on (pattern, onEnter, onBefore, onAfter) {
    var keys = [];
    var regexp = pathToRegexp_1(pattern, keys);
    this._routes.push({
      pattern: pattern,
      regexp: regexp,
      keys: keys,
      onEnter: onEnter,
      onBefore: onBefore,
      onAfter: onAfter
    });
    return this;
  };

  /**
   * register a function to hook just before routing.
   * this function is called on every routing.
   * @param {Function} func
   * @return {Router}
   */
  Router.prototype.onBefore = function onBefore (func) {
    this._onBefore = func;
    return this;
  };

  /**
   * register a function to hook just before routing.
   * this function is called before routing only once.
   * @param {Function} func
   * @return {Router}
   */
  Router.prototype.onBeforeOnce = function onBeforeOnce (func) {
    this._onBeforeOnce = func;
    return this;
  };

  /**
   * register a function to hook just after routing.
   * this function is called on every routing.
   * @param {Function} func
   * @return {Router}
   */
  Router.prototype.onAfter = function onAfter (func) {
    this._onAfter = func;
    return this;
  };

  /**
   * register a function to hook just after routing.
   * this function is called after routing only once.
   * @param {Function} func
   * @return {Router}
   */
  Router.prototype.onAfterOnce = function onAfterOnce (func) {
    this._onAfterOnce = func;
    return this;
  };

  /**
   * navigate to target location.
   * @param {String|Object} path e.g.) '/foo' or { pathname, search, hash }
   * @param {Boolean} force force to navigate even if path is the same as previous one.
   */
  Router.prototype.navigateTo = function navigateTo (path, force) {
      var this$1 = this;
      if ( force === void 0 ) force = false;

    return promise
      .resolve()
      .then(function () {
        if (!force && this$1.getCurrentLocation().pathname === path) {
          console.warn('same path is passed.');
          return;
        }

        this$1._history.push(path);
      });
  };

  /**
   * replace current location.
   * @param {String|Object} path e.g.) '/foo' or { pathname, search, hash }
   */
  Router.prototype.replace = function replace (path) {
      var this$1 = this;

    return promise
      .resolve()
      .then(function () {
        if (this$1.getCurrentLocation().pathname === path) {
          console.warn('same path is passed.');
          return;
        }

        this$1._history.replace(path);
      });
  };

  /**
   * returns current location.
   * @return {String}
   */
  Router.prototype.getCurrentLocation = function getCurrentLocation () {
    return this._history.location;
  };

  /**
   * returns current action.
   * @return {String}
   */
  Router.prototype.getCurrentAction = function getCurrentAction () {
    return this._history.action;
  };

  /**
   * hash version of `location.href`.
   * @param {String} pathname
   */
  Router.prototype.createHref = function createHref (pathname) {
    return this._history.createHref({
      pathname: pathname
    });
  };

  /**
   * fire route enter event.
   * @private
   * @param {Object} location i.e.) history.location
   * @param {String} action i.e.) history.action
   */
  Router.prototype._change = function _change (location/*, action */) {
      var this$1 = this;

    var route;
    forEach(this._routes, function (r) {
      if (!!route) {
        return;
      }
      if (!!r.regexp.exec(location.pathname)) {
        route = r;
      }
    });

    if (!route) {
      return;
    }

    var data = this._parseLocation(location, route);

    // whether the routing was canceled and replaced.
    var isReplaced = false;
    var replace = function (path) {
      isReplaced = true;
      this$1.replace(path);
    };

    promise
      .resolve()
      .then(function () {// onBeforeOnce
        if (!this$1._onBeforeOnce) {
          return promise.resolve();
        }
        var onBeforeOnce = this$1._onBeforeOnce;
        this$1._onBeforeOnce = null;
        return onBeforeOnce(data);
      })
      .then(function () {// onBefore
        if (!this$1._onBefore) {
          return promise.resolve();
        }
        return this$1._onBefore(data);
      })
      .then(function () {// route.onBefore
        if (!route.onBefore) {
          return promise.resolve();
        }
        return route.onBefore(data, replace);
      })
      .then(function () {// route.onEnter
        if (isReplaced || !route.onEnter) {
          return promise.resolve();
        }
        return route.onEnter(data);
      })
      .then(function () {// route.onAfter
        if (isReplaced || !route.onAfter) {
          return promise.resolve();
        }
        return route.onAfter(data);
      })
      .then(function () {// onAfter
        if (isReplaced || !this$1._onAfter) {
          return promise.resolve();
        }
        return this$1._onAfter(data);
      })
      .then(function () {// onAfterOnce
        if (isReplaced || !this$1._onAfterOnce) {
          return promise.resolve();
        }
        var onAfterOnce = this$1._onAfterOnce;
        this$1._onAfterOnce = null;
        return onAfterOnce(data);
      })
      .catch(function (err) {
        console.error(err.message || 'couldn\'t route. check the onBefore and onAfter functions.');
      });
  };

  /**
   * parse location object.
   * @private
   * @param {Object} location
   * @param {Object} route
   * @return {Object}
   */
  Router.prototype._parseLocation = function _parseLocation (location, route) {
    var params = {};
    var list = route.regexp.exec(location.pathname).slice(1);
    forEach(route.keys, function (v, i) {
      params[v.name] = list[i];
    });

    var queries = {};
    forEach(location.search.slice(1).split('&'), function (v) {
      if (!v) {
        return;
      }
      var pair = v.split('=');
      queries[pair[0]] = pair[1];
    });

    var hash = location.hash.slice(1);

    return {
      params: params,
      queries: queries,
      hash: hash,
      pathname: location.pathname
    };
  };

  Router.BROWSER = constants.BROWSER;
  Router.MEMORY = constants.MEMORY;
  Router.HASH = constants.HASH;

  return Router;

});
