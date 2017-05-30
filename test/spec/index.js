const chai = require('chai');
const spies = require('chai-spies');
const Esr = require('../../index');

const expect = chai.expect;

chai.use(spies);

describe('Esr', function() {
  it('should expose history object types.', () => {
    expect(Esr.BROWSER).to.be.a('string');
    expect(Esr.MEMORY).to.be.a('string');
    expect(Esr.HASH).to.be.a('string');
  });

  it('should be a class.', () => {
    expect(Esr).to.be.a('function');
    const create = () => {
      new Esr(Esr.MEMORY);
    };
    expect(create).not.to.throw();
  });

  it('should expose `start` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('start');
    expect(router.start).to.be.a('function');
    const start = () => {
      router.start();
    };
    const startWithoutAutoExec = () => {
      router.start(false);
    };
    expect(start).not.to.throw();
    expect(startWithoutAutoExec).not.to.throw();
  });

  it('should expose `stop` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('stop');
    expect(router.stop).to.be.a('function');
    const stop = () => {
      router.stop();
    };
    expect(stop).not.to.throw();
  });

  it('should expose `on` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('on');
    expect(router.on).to.be.a('function');
    const on = () => {
      router.on('/foo', () => {}, () => {}, () => {});
    };
    expect(on).not.to.throw();
    expect(router.on('/foo') === router).to.be.ok;
  });

  it('should expose `onBefore` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('onBefore');
    expect(router.onBefore).to.be.a('function');
    const onBefore = () => {
      router.onBefore(() => {});
    };
    expect(onBefore).not.to.throw();
    expect(router.onBefore(() => {}) === router).to.be.ok;
  });

  it('should expose `onBeforeOnce` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('onBeforeOnce');
    expect(router.onBeforeOnce).to.be.a('function');
    const onBeforeOnce = () => {
      router.onBeforeOnce(() => {});
    };
    expect(onBeforeOnce).not.to.throw();
    expect(router.onBeforeOnce(() => {}) === router).to.be.ok;
  });

  it('should expose `onAfter` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('onAfter');
    expect(router.onAfter).to.be.a('function');
    const onAfter = () => {
      router.onAfter(() => {});
    };
    expect(onAfter).not.to.throw();
    expect(router.onAfter(() => {}) === router).to.be.ok;
  });

  it('should expose `onAfterOnce` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('onAfterOnce');
    expect(router.onAfterOnce).to.be.a('function');
    const onAfterOnce = () => {
      router.onAfterOnce(() => {});
    };
    expect(onAfterOnce).not.to.throw();
    expect(router.onAfterOnce(() => {}) === router).to.be.ok;
  });

  it('should expose `navigateTo` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('navigateTo');
    expect(router.navigateTo).to.be.a('function');
    const navigateTo = () => {
      router.navigateTo('/foo');
    };
    expect(navigateTo).not.to.throw();
  });

  it('should expose `replace` API.', () => {
    const router = new Esr(Esr.MEMORY);
    expect(router).to.have.property('replace');
    expect(router.replace).to.be.a('function');
    const replace = () => {
      router.replace('/foo');
    };
    expect(replace).not.to.throw();
  });

  it('should route.', done => {
    const router = new Esr(Esr.MEMORY);
    const onEnter = function() {};
    const spy = chai.spy(onEnter);
    router.on('/foo', spy);
    router.start();
    router.navigateTo('/foo');
    setTimeout(() => {
      expect(spy).to.have.been.called();
      done();
    }, 100);
  });

  it('should route in proper order.', done => {
    const order = [];
    const router = new Esr(Esr.MEMORY);
    const onBeforeOnceCommon = function() {
      order.push(1);
    };
    const spyBeforeOnceCommon = chai.spy(onBeforeOnceCommon);
    const onBeforeCommon = function() {
      order.push(2);
    };
    const spyBeforeCommon = chai.spy(onBeforeCommon);
    const onBefore = function() {
      order.push(3);
    };
    const spyBefore = chai.spy(onBefore);
    const onEnter = function() {
      order.push(4);
    };
    const spyEnter = chai.spy(onEnter);
    const onAfter = function() {
      order.push(5);
    };
    const spyAfter = chai.spy(onAfter);
    const onAfterCommon = function() {
      order.push(6);
    };
    const spyAfterCommon = chai.spy(onAfterCommon);
    const onAfterOnceCommon = function() {
      order.push(7);
    };
    const spyAfterOnceCommon = chai.spy(onAfterOnceCommon);
    router
      .onBeforeOnce(spyBeforeOnceCommon)
      .onBefore(spyBeforeCommon)
      .on('/foo', spyEnter, spyBefore, spyAfter)
      .onAfter(spyAfterCommon)
      .onAfterOnce(spyAfterOnceCommon);
    router.start();
    router.navigateTo('/foo');
    setTimeout(() => {
      expect(spyBeforeOnceCommon).to.have.been.called();
      expect(spyBeforeCommon).to.have.been.called();
      expect(spyBefore).to.have.been.called();
      expect(spyEnter).to.have.been.called();
      expect(spyAfter).to.have.been.called();
      expect(spyAfterCommon).to.have.been.called();
      expect(spyAfterOnceCommon).to.have.been.called();
      expect(order).to.have.ordered.members([1, 2, 3, 4, 5, 6, 7]);
      done();
    }, 100);
  });

  it('should pass route info.', done => {
    let routeInfo;
    const router = new Esr(Esr.MEMORY);
    const onEnter = function(route) {
      routeInfo = route;
    };
    router.on('/foo/:bar/:hoge', onEnter);
    router.start();
    router.navigateTo('/foo/BAR/HOGE?aaa=AAA&bbb=BBB#ccc');
    setTimeout(() => {
      expect(routeInfo).to.be.a('object');
      expect(routeInfo.params).to.be.a('object');
      expect(routeInfo.params.bar).to.equal('BAR');
      expect(routeInfo.params.hoge).to.equal('HOGE');
      expect(routeInfo.queries).to.be.a('object');
      expect(routeInfo.queries.aaa).to.equal('AAA');
      expect(routeInfo.queries.bbb).to.equal('BBB');
      expect(routeInfo.hash).to.be.a('string');
      expect(routeInfo.hash).to.equal('ccc');
      done();
    }, 100);
  });

});
