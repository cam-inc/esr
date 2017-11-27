[English](README.md)

# Express-like Simple Router.

## インストール

```
$ npm install --save esr
```

## サンプル

```javascript
import Esr from 'esr';

// インスタンス作成
const router = new Esr();

// ルーティング定義
const onEnter = function() {
  // URLが`/users`に変更された時の処理。
};
router.on('/users', onEnter);

// ルーティング監視開始
router.start();

// 別ページに遷移
router.navigateTo('/users');
```

## コンストラクタ

インスタンス作成時に履歴管理方法を指定出来ます。

```javascript
import Esr from 'esr';

// HTML5 history APIで履歴管理。
const router = new Esr(Esr.BROWSER);

// メモリ内で履歴管理。
const router = new Esr(Esr.MEMORY);

// ハッシュ(#)で履歴管理。
const router = new Esr(Esr.HASH);
```

デフォルトは`Esr.BROWSER`です。

[詳細](https://github.com/reacttraining/history#usage)

## ルーティング

### `router.navigateTo(String, Boolean)`

指定URLにルーティングします。第二引数にtrueを渡すと強制的に画面遷移します。

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

現在のURLを指定値に書き換えます。

```javascript
import Esr from 'esr';
const router = new Esr();

router.replace('/users');
```

### `router.start(Boolean)`

ルーティング監視を開始します。渡す引数によって、start時に`pattern`マッチを行うか否かが決定されます。デフォルトは`true`です。

```javascript
import Esr from 'esr';
const router = new Esr();

router.on('/users', function(route) {
  console.log('users');
});

// 現在のURLが`https://sample.com/users`だと仮定する。
router.start();
//=> 'users'
```

## `router.on` ルーティング定義

`router.on(pattern, onEnter, onBefore, onAfter)`でルーティング定義を行います。

### pattern

type: `String`
example: `/users/:userid`

マッチ対象のpathを指定します。

[Express](http://expressjs.com/ja/)スタイルで指定可能です。

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

[詳細](https://github.com/pillarjs/path-to-regexp#parameters)

### onEnter

type: `Function`
example: `function(route)`

URLが`pattern`にマッチした際に実行される関数を指定します。

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

`onEnter`実行時に様々な情報を格納した`route`オブジェクトが渡されます。

- `route.params`(Object) `pattern`に対応した値がkey-valueで設定されます。
- `route.queries`(Object) クエリ値がkey-valueで設定されます。
- `route.hash`(String) ハッシュ値が設定されます。

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

URLが`pattern`にマッチした際に`onEnter`直前に実行される関数を指定します。

#### route

`onEnter`の`route`と同じです。

#### replace

`onBefore`実行時にリダイレクト用の関数が渡されます。

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

URLが`pattern`にマッチした際に`onEnter`直後に実行される関数を指定します。

#### route

`onEnter`の`route`と同じです。

## 共通ルーティング定義

`router.on`がマッチする`pattern`に対するルーティング定義を行うAPIであるのに対して、以下のAPIは全URLに対するルーティング定義を行います。

- `router.onBeforeOnce` 一度だけ`router.on`直前に発火します。
- `router.onBefore` `router.on`直前に発火します。
- `router.onAfter` `router.on`直後に発火します。
- `router.onAfterOnce` 一度だけ`router.on`直後に発火します。

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

## 非同期処理

Promiseを返す関数をルーティング定義時に渡すことで非同期実行が可能になります。

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

## テスト

```
$ npm run test
```

## ビルド

```
$ npm run build
```

## 監視

```
$ npm run watch
```

## リント

```
$ npm run lint
```
