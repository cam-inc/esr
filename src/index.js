import pathToRegexp from 'path-to-regexp';
import Promise from 'promise-polyfill';
import {
  createBrowserHistory,
  createMemoryHistory,
  createHashHistory
} from 'history';

const constants = {
  BROWSER: 'BROWSER',
  MEMORY: 'MEMORY',
  HASH: 'HASH'
};

// Copu from mout/array/forEach
const forEach = (arr, callback, thisObj) => {
  if (arr == null) {
    return;
  }
  let i = -1,
      len = arr.length;
  while (++i < len) {
    // we iterate over sparse items since there is no way to make it
    // work properly on IE 7-8. see #64
    if ( callback.call(thisObj, arr[i], i, arr) === false ) {
      break;
    }
  }
};

class Router {
  /**
   * @param {String} type type of history object. this should be one of 'browser', 'memory' or 'hash'.
   */
  constructor(type = constants.BROWSER) {
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
  }

  /**
   * start listening for changes to the current location.
   * @param {Boolean} autoExec to decide whether routing is executed with the current url.
   */
  start(autoExec = true) {
    this._unlistener = this._history.listen((location, action) => {
      this._change(location, action);
    });

    if (autoExec) {
      this._change(this.getCurrentLocation(), this.getCurrentAction());
    }
  }

  /**
   * stop listening.
   */
  stop() {
    if (!this._unlistener) {
      return;
    }
    this._unlistener();
    this._unlistener = null;
  }

  /**
   * register a route.
   * @param {String} pattern express-like url pattern.
   * @param {Function} onEnter a function that will be executed when the route changes.
   * @param {Function} onBefore a function that will be executed before the route changes.
   * @param {Function} onAfter a function that will be executed after the route changes.
   * @return {Router}
   */
  on(pattern, onEnter, onBefore, onAfter) {
    const keys = [];
    const regexp = pathToRegexp(pattern, keys);
    this._routes.push({
      pattern,
      regexp,
      keys,
      onEnter,
      onBefore,
      onAfter
    });
    return this;
  }

  /**
   * register a function to hook just before routing.
   * this function is called on every routing.
   * @param {Function} func
   * @return {Router}
   */
  onBefore(func) {
    this._onBefore = func;
    return this;
  }

  /**
   * register a function to hook just before routing.
   * this function is called before routing only once.
   * @param {Function} func
   * @return {Router}
   */
  onBeforeOnce(func) {
    this._onBeforeOnce = func;
    return this;
  }

  /**
   * register a function to hook just after routing.
   * this function is called on every routing.
   * @param {Function} func
   * @return {Router}
   */
  onAfter(func) {
    this._onAfter = func;
    return this;
  }

  /**
   * register a function to hook just after routing.
   * this function is called after routing only once.
   * @param {Function} func
   * @return {Router}
   */
  onAfterOnce(func) {
    this._onAfterOnce = func;
    return this;
  }

  /**
   * navigate to target location.
   * @param {String|Object} path e.g.) '/foo' or { pathname, search, hash }
   * @param {Boolean} force force to navigate even if path is the same as previous one.
   */
  navigateTo(path, force = false) {
    return Promise
      .resolve()
      .then(() => {
        if (!force && this.getCurrentLocation().pathname === path) {
          console.warn('same path is passed.');
          return;
        }

        this._history.push(path);
      });
  }

  /**
   * replace current location.
   * @param {String|Object} path e.g.) '/foo' or { pathname, search, hash }
   */
  replace(path) {
    return Promise
      .resolve()
      .then(() => {
        if (this.getCurrentLocation().pathname === path) {
          console.warn('same path is passed.');
          return;
        }

        this._history.replace(path);
      });
  }

  /**
   * returns current location.
   * @return {String}
   */
  getCurrentLocation() {
    return this._history.location;
  }

  /**
   * returns current action.
   * @return {String}
   */
  getCurrentAction() {
    return this._history.action;
  }

  /**
   * hash version of `location.href`.
   * @param {String} pathname
   */
  createHref(pathname) {
    return this._history.createHref({
      pathname
    });
  }

  /**
   * fire route enter event.
   * @private
   * @param {Object} location i.e.) history.location
   * @param {String} action i.e.) history.action
   */
  _change(location/*, action */) {
    let route;
    forEach(this._routes, r => {
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

    const data = this._parseLocation(location, route);

    // whether the routing was canceled and replaced.
    let isReplaced = false;
    const replace = (path) => {
      isReplaced = true;
      this.replace(path);
    };

    Promise
      .resolve()
      .then(() => {// onBeforeOnce
        if (!this._onBeforeOnce) {
          return Promise.resolve();
        }
        const onBeforeOnce = this._onBeforeOnce;
        this._onBeforeOnce = null;
        return onBeforeOnce(data);
      })
      .then(() => {// onBefore
        if (!this._onBefore) {
          return Promise.resolve();
        }
        return this._onBefore(data);
      })
      .then(() => {// route.onBefore
        if (!route.onBefore) {
          return Promise.resolve();
        }
        return route.onBefore(data, replace);
      })
      .then(() => {// route.onEnter
        if (isReplaced || !route.onEnter) {
          return Promise.resolve();
        }
        return route.onEnter(data);
      })
      .then(() => {// route.onAfter
        if (isReplaced || !route.onAfter) {
          return Promise.resolve();
        }
        return route.onAfter(data);
      })
      .then(() => {// onAfter
        if (isReplaced || !this._onAfter) {
          return Promise.resolve();
        }
        return this._onAfter(data);
      })
      .then(() => {// onAfterOnce
        if (isReplaced || !this._onAfterOnce) {
          return Promise.resolve();
        }
        const onAfterOnce = this._onAfterOnce;
        this._onAfterOnce = null;
        return onAfterOnce(data);
      })
      .catch(err => {
        console.error(err.message || 'couldn\'t route. check the onBefore and onAfter functions.');
      });
  }

  /**
   * parse location object.
   * @private
   * @param {Object} location
   * @param {Object} route
   * @return {Object}
   */
  _parseLocation(location, route) {
    const params = {};
    const list = route.regexp.exec(location.pathname).slice(1);
    forEach(route.keys, (v, i) => {
      params[v.name] = list[i];
    });

    const queries = {};
    forEach(location.search.slice(1).split('&'), v => {
      if (!v) {
        return;
      }
      const pair = v.split('=');
      queries[pair[0]] = pair[1];
    });

    const hash = location.hash.slice(1);

    return {
      params,
      queries,
      hash,
      pathname: location.pathname
    };
  }
}

Router.BROWSER = constants.BROWSER;
Router.MEMORY = constants.MEMORY;
Router.HASH = constants.HASH;

export default Router;
