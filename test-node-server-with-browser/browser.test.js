describe('Test Websocket module with Nodejs Server and Chrome Browser Client', function() {
  let wrpc;
  this.timeout(120000);

  it('should be able to connect/close the connection to the websocket server', function(done) {
    wrpc = new SimpleWRPC('ws:\/\/127.0.0.1:8123\/');
    wrpc.on('open', function() {
      wrpc.close();
      done();
    });
  });

  // it('should be able to finish the test1', function(done) {
  //   wrpc.emitEvent('test1');
  //   wrpc.subscribeToEvent('test1-receiving-event', function(data) {
  //     expect(data).to.deep.equal({greeting: "hi! I am websocket server"});
  //     done();
  //   });
  // });
});