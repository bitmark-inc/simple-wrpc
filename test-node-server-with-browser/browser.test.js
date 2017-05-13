let Helper = {};
Helper.createSocketConnection = (port, onOpenCallback) => {
  wrpc = new SimpleWRPC('ws:\/\/127.0.0.1:' + port + '\/');
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

describe('Test Websocket module with Nodejs Server and Chrome Browser Client', function() {
  let wrpc;
  this.timeout(120000);

  beforeEach((done) => {
    // delay each test for the server to initialize first
    setTimeout(done, 3000);
  });

  let testName = 'TEST-01';
  // it(testName, function(done) {
  //   wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
  //     wrpc.close();
  //     done();
  //   })
  // });

  // testName = 'TEST-02';
  // it(testName, function(done) {
  //   wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
  //     wrpc.on('close', () => {
  //       done();
  //     });
  //   })
  // });

  // testName = 'TEST-03';
  // it(testName, function(done) {
  //   wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
  //     let testFinished = false;
  //     wrpc.subscribeForEvent('test3-receiving-event', (event) => {
  //       expect(event.data).to.deep.equal({greeting: "hi! I am websocket server"});
  //       wrpc.close();
  //       done();
  //     });
  //   })
  // });

  testName = 'TEST-04';
  it(testName, function(done) {
    wrpc = Helper.createSocketConnection(Helper.portMapping[testName], () => {
      let testFinished = false;
      wrpc.addListenerToMethodCall('test4-receiving-method-call', (event) => {
        console.log(JSON.stringify(event));
        console.log('AAAAAAA');
        expect(event.data).to.deep.equal({ask: "client, how are you?"});
        console.log('BBBBBBB');
        event.done({answer: "I am fine."});
        wrpc.close();
        done();
      });
    })
  });




});