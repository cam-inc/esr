import { filter, find, forEach } from 'mout/array';
import pathToRegexp from 'path-to-regexp';
import {
  createBrowserHistory,
  createMemoryHistory,
  createHashHistory
} from 'history';

class Router {
  /**
   * @param {String} type type of history object. this should be one of 'browser', 'memory' or 'hash'.
   */
  constructor(type = 'browser') {
    /**
     * hash history object.
     * @private
     * @type {Object}
     */
    switch (type) {
    case 'browser':
      this._history = createBrowserHistory();
      break;
    case 'memory':
      this._history = createMemoryHistory();
      break;
    case 'hash':
      this._history = createHashHistory();
      break;
    default:
      break;
    };

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
     * @type {Function}
     */
    this._onBefore = () => {
      return Promise.resolve();
    };

    /**
     * function that will be called on behind of every routing.
     * @type {Function}
     */
    this._onAfter = () => {
      return Promise.resolve();
    };
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
   * navigate to target location.
   * @param {String|Object} path e.g.) '/foo' or { pathname, search, hash }
   */
  navigateTo(path) {
    return Promise
      .resolve()
      .then(() => {
        if (this.getCurrentLocation().pathname === path) {
          console.warn('same path is passed.');
          return;
        }

        this._history.push(path);
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
    const route = find(this._routes, route => {
      return !!route.regexp.exec(location.pathname);
    });

    if (!route) {
      return;
    }

    const params = this._parseLocation(location, route);
    const splitedPathname = filter(location.pathname.split('/'), v => {
      return !!v;
    });

    Promise
      .resolve()
      .then(() => this._onBefore(...params))
      .then(() => {
        if (!route.onBefore) {
          return Promise.resolve();
        }
        return route.onBefore(...params);
      })
      .then(() => route.onEnter(...params))
      .then(() => {
        if (!route.onAfter) {
          return Promise.resolve();
        }
        return route.onAfter(...params);
      })
      .then(() => this._onAfter(...params))
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
      hash
    };
  }
}

export default new Router();
