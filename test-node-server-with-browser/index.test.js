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
let BitmarkRPCWebsocketServer = nodeServer.Server;
let bitmarkRPCServer = new BitmarkRPCWebsocketServer({port: 3000});

describe('Test Websocket module with Nodejs Server and Chrome Browser Client', function() {
  this.timeout(120000);
  it('Allow the client to connect to the server', function() {
    karmaServer.start()
    bitmarkRPC.on('connection', function(bitmarkRPCClient) {
      
    });
  });

  describe('Test1', function() {
    it('should allow me to test1', function() {
      expect(1).to.equal(1);
    });
    it('should allow me to test2', function() {
      expect(2).to.equal(2);
    });
    it('should wait for karma', function(done) {
      setTimeout(done, 15000);
    });
  });

});

// bitmarkRPC.on('connection', function(conn) {
//   conn.subscribeToEvent('mydata', function(data) {
//     console.log('I JUST RECEIVED MYDATA WITH DATA', data);
//   });
//   conn.addListenerToMethodCall('mymethod', function(event) {
//     event.done({data: 'aaabc'});
//   });
//   conn.emitEvent('datafromserver', {a: 'aaa', b: 'bbb'}, function() {
//     console.log('Sent');
//   });
// });