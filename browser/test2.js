(function() {
  $(function() {

    var socket = new BitmarkRPCWebsocket('ws:\/\/127.0.0.1:3000\/');

    // socket.on('open', function() {
    //   console.log('Socket open!!!');
    // });

    // socket.on('error', function(e) {
    //   console.log('Socket error!!!', e);
    // });

    // socket.on('disconnect', function(e) {
    //   console.log('Socket disconnect!!!');
    // });

    // socket.on('reconnect', function(e) {
    //   console.log('Socket reconnect!!!');
    // });

    socket.addListenerForData('datafromserver', function(e) {
      console.log('Receive data from server', e.detail);
    });

    setTimeout(function() {
      socket.sendData('mydata', {one: 1, two: 2},  function(error, data) {
        console.log('Send mydata successfully!!!');
      });
    }, 2000);

    setTimeout(function() {
      socket.callMethod('mymethod', {one: 1, two: 2},  function(error, data) {
        console.log('Send mydata successfully!!!');
        console.log('Receive back data', data);
      });
    }, 4000);

  });
})();