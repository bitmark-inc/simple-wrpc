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

console.log('Please start the client to test the fetures');

describe('Basic pub/sub and method call', function() {
  this.timeout(30000);

  let testName = 'TEST-01';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      swrpcConn.on('close', function() {
        wrpcServer.close();
        done();
      });
    });
  });

  testName = 'TEST-02';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      swrpcConn.close();
      wrpcServer.close();
      done();
    });
  });

  testName = 'TEST-03';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      let testFinished = false;
      swrpcConn.publishEvent(`test3-server-event`, {greeting: "hi! I am websocket server"}, () => {
        testFinished = true;
      });
      swrpcConn.on('close', () => {
        expect(testFinished).to.equal(true);
        wrpcServer.close();
        done();
      })
    });
  });

  testName = 'TEST-04';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      let testFinished = false;

      swrpcConn.callMethod(`test4-server-call`, {ask: "client, how are you?"}, (error, data) => {
        expect(error).to.not.be.ok;
        expect(data).to.deep.equal({answer: "I am fine."});
        testFinished = true;
      });
      swrpcConn.on('close', () => {
        expect(testFinished).to.equal(true);
        wrpcServer.close();
        done();
      })
    });
  });


  testName = 'TEST-05';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      let testFinished = false;

      swrpcConn.subscribeForEvent(`test5-client-event`, (event) => {
        expect(event.data).to.deep.equal({greeting: "hi! I am websocket client"});
        testFinished = true;
      });
      swrpcConn.on('close', () => {
        expect(testFinished).to.equal(true);
        wrpcServer.close();
        done();
      })
    });
  });

  testName = 'TEST-06';
  it(testName, function(done) {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      let testFinished = false;

      swrpcConn.addListenerToMethodCall(`test6-client-call`, (event) => {
        expect(event.data).to.deep.equal({ask: "server, how are you?"});
        event.done({answer: "I am fine."});
        testFinished = true;
      });
      swrpcConn.on('close', () => {
        expect(testFinished).to.equal(true);
        wrpcServer.close();
        done();
      })
    });
  });
});

describe('Massive messages test', function() {
  this.timeout(900000);

  let massiveMessagesTestHelper = {
    getRandomInt: (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    addEventHandler: (index, swrpcConn, callback) => {
      swrpcConn.subscribeForEvent(`test9-client-event-${index}`, (event) => {
        expect(event.data).to.deep.equal({greeting: `hello from client for client-event-${index}`});
        callback();
      });
    },
    publishEvent: (index, wrpcConn, callback) => {
      setTimeout(() => {
        wrpcConn.publishEvent(`test9-server-event-${index}`, {greeting: `hello from server for server-event-${index}`}, callback);
      }, massiveMessagesTestHelper.getRandomInt(0,60000));
    },
    addMethodCallHandler: (index, wrpcConn, callback) => {
      wrpcConn.addListenerToMethodCall(`test9-client-call-${index}`, (event) => {
        expect(event.data).to.deep.equal({ask: `From client-call-${index}, how are you?`});
        event.done({answer: `For client-call-${index}, I am so so.`});
        callback();
      });
    },
    callMethod: (index, wrpcConn, callback) => {
      setTimeout(() => {
        wrpcConn.callMethod(`test9-server-call-${index}`, {ask: `From server-call-${index}, how are you?`}, (error, data) => {
          expect(error).to.not.be.ok;
          expect(data).to.deep.equal({answer: `For server-call-${index}, I am so so.`});
          callback();
        });
      }, massiveMessagesTestHelper.getRandomInt(0,60000));
    }
  };

  let testName = 'TEST-07';
  it(testName, (done) => {
    let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
      let loop = 100;
      let totalEventReceived = 0;
      let totalEventPublished = 0;
      let totalMethodCallReceived = 0;
      let totalMethodCalled = 0;

      for (let i = 1; i <= loop; i++) {
        massiveMessagesTestHelper.addEventHandler(i, swrpcConn, () => {
          totalEventReceived++;
        });
        massiveMessagesTestHelper.publishEvent(i, swrpcConn, () => {
          totalEventPublished++;
        });
        massiveMessagesTestHelper.addMethodCallHandler(i, swrpcConn, () => {
          totalMethodCallReceived++;
        });
        massiveMessagesTestHelper.callMethod(i, swrpcConn, () => {
          totalMethodCalled++;
        });
      }

      swrpcConn.on('close', () => {
        expect(totalEventReceived).to.equal(loop);
        expect(totalEventPublished).to.equal(loop);
        expect(totalMethodCallReceived).to.equal(loop);
        expect(totalMethodCalled).to.equal(loop);
        wrpcServer.close();
        done();
      });
    });
  });


  // testName = 'TEST-08';
  // it(testName, (done) => {
  //   let wrpcServer = Helper.createWRPCServer(Helper.portMapping[testName], (swrpcConn) => {
  //     let loop = 5;
  //     let totalEventReceived = 0;
  //     let totalEventPublished = 0;
  //     let totalMethodCallReceived = 0;
  //     let totalMethodCalled = 0;

  //     for (let i = 1; i <= loop; i++) {
  //       massiveMessagesTestHelper.addEventHandler(i, swrpcConn, () => {
  //         totalEventReceived++;
  //       });
  //       massiveMessagesTestHelper.publishEvent(i, swrpcConn, () => {
  //         totalEventPublished++;
  //       });
  //       massiveMessagesTestHelper.addMethodCallHandler(i, swrpcConn, () => {
  //         totalMethodCallReceived++;
  //       });
  //       massiveMessagesTestHelper.callMethod(i, swrpcConn, () => {
  //         totalMethodCalled++;
  //       });
  //     }

  //     swrpcConn.on('close', () => {
  //       expect(totalEventReceived).to.equal(loop);
  //       expect(totalEventPublished).to.equal(loop);
  //       expect(totalMethodCallReceived).to.equal(loop);
  //       expect(totalMethodCalled).to.equal(loop);
  //       wrpcServer.close();
  //       done();
  //     });
  //   });
  // });

});