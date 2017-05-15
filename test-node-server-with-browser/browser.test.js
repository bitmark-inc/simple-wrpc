let Helper = {};
Helper.createSocketConnection = (port, onOpenCallback) => {
  let wrpc = new SimpleWRPC('ws:\/\/127.0.0.1:' + port + '\/');
  wrpc.on('open', onOpenCallback);
  return wrpc;
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

console.log('Please start the server to test the fetures');

// describe('Basic pub/sub and method call', function() {
//   this.timeout(30000);

//   beforeEach((done) => {
//     // delay each test for the server to initialize first
//     setTimeout(done, 3000);
//   });

//   let testName = 'TEST-01';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.close();
//       done();
//     })
//   });

//   testName = 'TEST-02';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.on('close', () => {
//         done();
//       });
//     })
//   });

//   testName = 'TEST-03';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.subscribeForEvent('test3-receiving-event', (event) => {
//         expect(event.data).to.deep.equal({greeting: "hi! I am websocket server"});
//         wrpc.close();
//         done();
//       });
//     })
//   });

//   testName = 'TEST-04';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.addListenerToMethodCall('test4-receiving-method-call', (event) => {
//         expect(event.data).to.deep.equal({ask: "client, how are you?"});
//         event.done({answer: "I am fine."});
//         wrpc.close();
//         done();
//       });
//     })
//   });


//   testName = 'TEST-05';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.publishEvent(`test5-emit-event`, {greeting: "hi! I am websocket client"}, () => {
//         wrpc.close();
//         done();
//       });
//     });
//   });

//   testName = 'TEST-06';
//   it(testName, function(done) {
//     let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
//       wrpc.callMethod(`test6-call-method`, {ask: "server, how are you?"}, (error, data) => {
//         expect(error).to.not.be.ok;
//         expect(data).to.deep.equal({answer: "I am fine."});
//         wrpc.close();
//         done();
//       });
//     });
//   });

// });


describe('Massive messages test', function() {
  this.timeout(90000);

  beforeEach((done) => {
    // delay each test for the server to initialize first
    setTimeout(done, 3000);
  });

  let massiveMessagesTestHelper = {
    getRandomInt: (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    addEventHandler: (index, wrpc, callback) => {
      wrpc.subscribeForEvent(`test7-server-event-${index}`, (event) => {
        expect(event.data).to.deep.equal({greeting: `hello from server for server-event-${index}`});
        callback();
      });
    },
    publishEvent: (index, wrpc, callback) => {
      setTimeout(() => {
        wrpc.publishEvent(`test7-client-event-${index}`, {greeting: `hello from client for client-event-${index}`}, callback);
      }, massiveMessagesTestHelper.getRandomInt(0,10000));
    },
    callMethod: (index, wrpc, callback) => {
      setTimeout(() => {
        wrpc.callMethod(`test7-client-call-${index}`, {ask: `From client-call-${index}, how are you?`}, (error, data) => {
          console.log('CALL BACK!!!');
          expect(error).to.not.be.ok;
          expect(data).to.deep.equal({answer: `For client-call-${index}, I am so so.`});
          callback();
        });
      }, massiveMessagesTestHelper.getRandomInt(0,10000));
    },
    addMethodCallHandler: (index, wrpc, callback) => {
      wrpc.addListenerToMethodCall(`test7-server-call-${index}`, (event) => {
        expect(event.data).to.deep.equal({ask: `From server-call-${index}, how are you?`});
        event.done({answer: `For server-call-${index}, I am so so.`});
        callback();
      });
    },
    testFulFill: (wrpc, loopTarget, totalEventPublished, totalEventReceived, totalMethodCalled, totalMethodCallReceived, callback) => {
      let enoughEventPublished = (totalEventPublished === loopTarget);
      let enoughEventReceived = (totalEventReceived === loopTarget);
      let enoughMethodCalled = (totalMethodCalled === loopTarget);
      let enoughMethodCallReceived = (totalMethodCallReceived === loopTarget);
      if (enoughEventPublished && enoughEventReceived && enoughMethodCalled && enoughMethodCallReceived) {
        callback();
      }
    }
  }

  let testName = 'TEST-07';
  it(testName, function(done) {
    let loop = 100;
    let totalEventPublished = 0;
    let totalEventReceived = 0;
    let totalMethodCalled = 0;
    let totalMethodCallReceived = 0;

    let wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
      let checkTestFinish = () => {
        massiveMessagesTestHelper.testFulFill(wrpc, loop, totalEventPublished, totalEventReceived, totalMethodCalled, totalMethodCallReceived, () => {
          wrpc.close();
          done();
        })
      }
      for (let i = 1; i <= loop; i++) {
        massiveMessagesTestHelper.publishEvent(i, wrpc, () => {
          totalEventPublished++;
          checkTestFinish();
        });
        massiveMessagesTestHelper.addEventHandler(i, wrpc, () => {
          totalEventReceived++;
          checkTestFinish();
        });
        massiveMessagesTestHelper.callMethod(i, wrpc, () => {
          totalMethodCalled++;
          checkTestFinish();
        });
        massiveMessagesTestHelper.addMethodCallHandler(i, wrpc, () => {
          totalMethodCallReceived++;
          checkTestFinish();
        });
      }
    });
  });

})