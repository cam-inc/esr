describe('esr', () => {
  it('should change the url.', done => {
    expect(Esr.HASH).to.be.a('string');
    const router = new Esr(Esr.HASH);
    router.on('/foo/:bar/:hoge', function(route) {
      expect(route).to.be.a('object');
      expect(route.params).to.be.a('object');
      expect(route.params.bar).to.equal('BAR');
      expect(route.params.hoge).to.equal('HOGE');
      expect(route.queries).to.be.a('object');
      expect(route.queries.aaa).to.equal('AAA');
      expect(route.queries.bbb).to.equal('BBB');
      expect(route.hash).to.equal('ccc');
      done();
    });
    router.start();
    router.navigateTo('/foo/BAR/HOGE?aaa=AAA&bbb=BBB#ccc');
  });
});
