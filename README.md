[English](README.md)

# Express-like Simple Router.

## Install

```
$ npm install --save esr
```

## Sample

```javascript
import Esr from 'esr';

// create an instance.
const router = new Esr();

// routing definition.
const onEnter = function() {
  // called when the url got changed to `/users`.
};
router.on('/users', onEnter);

// start listening for the url to change.
router.start();

// change the url.
router.navigateTo('/users');
```

## Constructor

Esr provides 3 different methods for creating a history object, depending on your environment.

```javascript
import Esr from 'esr';

// use HTML5 history API.
const router = new Esr(Esr.BROWSER);

// use memory.
const router = new Esr(Esr.MEMORY);

// use hash.
const router = new Esr(Esr.HASH);
```

default is `Esr.BROWSER`.

[more detail](https://github.com/reacttraining/history#usage)

## Routing

### `router.navigateTo(String, Boolean)`

change current url. set secound parameter `true` to force navigate.

```javascript
import Esr from 'esr';
const router = new Esr();

router.navigateTo('/users');
router.navigateTo('/users/foo');
router.navigateTo('/users/foo?aaa=bbb');
router.navigateTo('/users/foo?aaa=bbb#ccc');
router.navigateTo('/users', true);
```

### `router.replace(String)`

replace current url.

```javascript
import Esr from 'esr';
const router = new Esr();

router.replace('/users');
```

### `router.start(Boolean)`

start listening for the url to change. a boolean argument can be passed to determine whether the esr should fire route an event or not. default is `true`.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users', function(route) {
  console.log('users');
});

// suppose that the current url is `https://sample.com/users`.
router.start();
//=> 'users'
```

## `router.on` Routing Definition.

`router.on(pattern, onEnter, onBefore, onAfter)` for routing definition.

### pattern

type: `String`
example: `/users/:userid`

set pattern to match.

[Express](http://expressjs.com/ja/)-Style pattern is applied.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users', function() {
  console.log('users');
});
router.on('/users/:userid', function() {
  console.log('a user');
});
router.on('*', function() {
  console.log('not found');
});

router.navigateTo('/users');
//=> 'users'
router.navigateTo('/users/foo');
//=> 'a user'
router.navigateTo('/bar');
//=> 'not found'

```

[more detail](https://github.com/pillarjs/path-to-regexp#parameters)

### onEnter

type: `Function`
example: `function(route)`

a callback function that will be called when the url matches the `pattern`.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users/:userid', function(route) {
  console.log('a user');
});

router.navigateTo('/users/foo');
//=> 'a user';
```

#### route

`route` object consists of some extra information.

- `route.params`(Object) key-value data matched on the `pattern`.
- `route.queries`(Object) key-value data of query.
- `route.hash`(String) hash value.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users/:userid/:type', function(route) {
  // route.params.userid === 'foo';
  // route.params.type === 'bar';
  // route.queries.aaa === 'AAA';
  // route.queries.bbb === 'BBB';
  // route.hash === 'ccc';
});

router.navigateTo('/users/foo/bar?aaa=AAA&bbb=BBB#ccc');
```

### onBefore

type: `Function`
example: `function(route, replace)`

a callback function that will be called just before `onEnter` when the url matches the `pattern`.

#### route

same as `route` of `onEnter`.

#### replace

a function used to redirect to another url.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/aaa', function(route) {
  console.log('onEnter of /aaa');
}, function(route, replace) {
  console.log('onBefore of /aaa');
});

router.on('/bbb', function(route) {
  console.log('onEnter of /bbb');
});

router.navigateTo('/aaa');
//=> 'onBefore of /aaa'
//(=> 'onEnter of /bbb') <= this won't be logged.
//=> 'onEnter of /bbb'
```

### onAfter

type: `Function`
example: `function(route)`

a callback function that will be called just after `onEnter` when the url matches the `pattern`.

#### route

same as `route` of `onEnter`.

## Common Routing Definition

callback functions that will be called for every url pattern.

- `router.onBeforeOnce` called only once. just before `router.on`'s callback.
- `router.onBefore` called just before `router.on`'s callback.
- `router.onAfter` called just after `router.on`'s callback.
- `router.onAfterOnce` called only once. just after `router.on`'s callback.

```javascript
import Esr from 'esr';
const router = new Esr();

router
  .onBeforeOnce(function(route) {
    console.log('before once');
  })
  .onBefore(function(route) {
    console.log('before');
  })
  .on('*', function(route) => {
    console.log('*');
  })
  .onAfter(function(route) {
    console.log('after');
  })
  .onAfterOnce(function(route) {
    console.log('after once');
  });

router.navigateTo('/first');
//=> 'before once'
//=> 'before'
//=> '*'
//=> 'after'
//=> 'after once'

router.navigateTo('/second');
//=> 'before'
//=> '*'
//=> 'after'
```

## Async

By passing a callback function that returns a Promise, you can handle async programing.

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users',function(route) {
  console.log('onEnter');
  return new Promise(function(resolve) {
    window.setTimeout(function() {
      resolve();
    }, 1000);
  });
}, function(route, replace) {
  console.log('onBefore');
  return new Promise(function(resolve) {
    window.setTimeout(function() {
      resolve();
    }, 1000);
  });
}, function(route) {
  console.log('onAfter');
  return new Promise(function(resolve) {
    window.setTimeout(function() {
      resolve();
    }, 1000);
  });
}).onAfter(function(route) {
  console.log('complete!');
});

router.navigateto('/users');
//=> 'onBefore'
// wait for 1000ms...
//=> 'onEnter'
// wait for 1000ms...
//=> 'onAfter'
// wait for 1000ms...
//=> 'complete!'
```

## Test

```
$ npm run test
```

## Build

```
$ npm run build
```

## Watch

```
$ npm run watch
```

## Lint

```
$ npm run lint
```
