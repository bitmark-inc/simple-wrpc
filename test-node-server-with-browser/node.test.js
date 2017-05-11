let chai = require('chai');
let expect = chai.expect;

let nodeServer = require('../server-node');
let SimpleWRPCServer = nodeServer.Server;
let wrpcServer = new SimpleWRPCServer({port: 8123});

describe('Test Websocket module with Nodejs Server and Chrome Browser Client', function() {
  let conn = null;
  this.timeout(120000);

  it('Allow the client to connect/close the connection to the server', function(done) {
    wrpcServer.on('connection', function(WRPCClient) {
      conn = WRPCClient;
      console.log('Connection is opened');
      conn.on('close', function() {
        console.log('SHOULD CLODE');
      });
    });
  });

  // it('Can send the signal to start Test1', function(done) {
  //   console.log('aaaa');
  //   conn.subscribeToEvent('test1', function() {
  //     console.log('bbbb');
  //     done();
  //   });
  // });

  // it('Can receive the event', function(done) {
  //   conn.emitEvent('test1-receiving-event', {greeting: "hi! I am websocket server"}, function(error) {
  //     expect(error).to.not.be.ok
  //     done();
  //   });
  // });

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