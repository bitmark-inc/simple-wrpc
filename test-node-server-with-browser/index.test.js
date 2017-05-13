let chai = require('chai');
let expect = chai.expect;

// Run browser test by karma
let path = require('path');
let cfg = require('karma').config;
let karmaConfig = cfg.parseConfig(path.resolve('./karma.conf.js'));
let KarmaServer = require('karma').Server
let karmaServer = new KarmaServer(karmaConfig, function(exitCode) {
  // console.log('Karma has exited with ' + exitCode)
  // process.exit(exitCode)
});


let nodeServer = require('../server-node');
let SimpleWRPCServer = nodeServer.Server;
let wrpcServer = new SimpleWRPCServer({port: 8123});

describe('Test Websocket module with Nodejs Server and Chrome Browser Client', function() {
  let conn = null;

  this.timeout(120000);
  it('Allow the client to connect to the server', function(done) {
    this.timeout(5000);
    wrpcServer.on('connection', function(WRPCClient) {
      conn = WRPCClient;
      done();
    });
    karmaServer.start();
  });

  it('Can send the signal to start Test1', function(done) {
    conn.subscribeForEvent('test1', function() {
      done();
    });
  });

  it('Can receive the event', function(done) {
    conn.publishEvent('test1-receiving-event', {greeting: "hi! I am websocket server"}, function(error) {
      expect(error).to.not.be.ok
      done();
    });
  });

  // describe('Test1', function() {
  //   it('should allow me to test1', function() {
  //     expect(1).to.equal(1);
  //   });
  //   it('should allow me to test2', function() {
  //     expect(2).to.equal(2);
  //   });
  //   it('should wait for karma', function(done) {
  //     setTimeout(done, 15000);
  //   });
  // });

});

// bitmarkRPC.on('connection', function(conn) {
//   conn.subscribeForEvent('mydata', function(data) {
//     console.log('I JUST RECEIVED MYDATA WITH DATA', data);
//   });
//   conn.addListenerToMethodCall('mymethod', function(event) {
//     event.done({data: 'aaabc'});
//   });
//   conn.publishEvent('datafromserver', {a: 'aaa', b: 'bbb'}, function() {
//     console.log('Sent');
//   });
// });