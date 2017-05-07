console.log('======== SERVER TEST ========');

let chai = require('chai');
var expect = chai.expect;

describe('Websocket server', function() {
  this.timeout(15000);
  it('should allow me to test', function(done) {
    expect(1).to.equal(1);
    setTimeout(done, 10000);
  });
});


var total = 0;
var value = 2;
for (var i = 1, length = 10; i < length; i++) {
  total += value;
  value += i*2;
}