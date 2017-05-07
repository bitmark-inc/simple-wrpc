describe('CLIENT Test1', function() {
  this.timeout(120000);
  it('should allow me to test1', function() {
    expect(1).to.equal(1);
  });
  it('should allow me to test2', function() {
    expect(2).to.equal(2);
  });
  it('should wait 10 seconds', function(done) {
    setTimeout(done, 10000);
  });
});