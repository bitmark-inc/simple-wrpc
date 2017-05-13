let chai = require('chai');
let expect = chai.expect;

let nodeServer = require('../server-node');
let SimpleWRPCServer = nodeServer.Server;

let Helper = {};
Helper.createWRPCServer = (port, onConnectionCallback) => {
  let wrpcServer = new SimpleWRPCServer({port: port});
  wrpcServer.on('connection', onConnectionCallback);
  return wrpcServer;
}
Helper.portMapping = {
  'TEST-01': 8201,
  'TEST-02': 8202,
  'TEST-03': 8203,
  'TEST-04': 8204,
  'TEST-05': 8205,
  'TEST-06': 8206,
  'TEST-07': 8207,
  'TEST-08': 8208
}

describe('Please start the client to test the feature', function() {
  let conn = null;
  this.timeout(120000);

  let testName = 'TEST-01';
  // it(testName, function(done) {
  //   let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (WRPCClient) => {
  //     WRPCClient.on('close', function() {
  //       wrpcServer.close();
  //       done();
  //     });
  //   });
  // });

  // testName = 'TEST-02';
  // it(testName, function(done) {
  //   let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (WRPCClient) => {
  //     WRPCClient.close();
  //     wrpcServer.close();
  //     done();
  //   });
  // });

  // testName = 'TEST-03';
  // it(testName, function(done) {
  //   let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (WRPCClient) => {
  //     let testFinished = false;
  //     WRPCClient.publishEvent(`test3-receiving-event`, {greeting: "hi! I am websocket server"}, () => {
  //       testFinished = true;
  //     });
  //     WRPCClient.on('close', () => {
  //       expect(testFinished).to.equal(true);
  //       wrpcServer.close();
  //       done();
  //     })
  //   });
  // });

  testName = 'TEST-04';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (WRPCClient) => {
      let testFinished = false;

      WRPCClient.callMethod(`test4-receiving-method-call`, {ask: "client, how are you?"}, (error, data) => {
        expect(error).to.not.be.ok;
        expect(data).to.deep.equal({answer: "I am fine."});
        testFinished = true;
      });
      WRPCClient.on('close', () => {
        expect(testFinished).to.equal(true);
        wrpcServer.close();
        done();
      })
    });
  });


  // it('Can finish Test1', function(done) {
  //   conn.subscribeForEvent('test1', function() {
  //   });
  // });

  // it('Can receive the event', function(done) {
  //   conn.publishEvent('test1-receiving-event', {greeting: "hi! I am websocket server"}, function(error) {
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