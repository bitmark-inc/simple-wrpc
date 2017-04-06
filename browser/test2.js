(function() {
  $(function() {

    var socket = new BitmarkWebsocket('ws:\/\/127.0.0.1:3000\/');

    socket.on('open', function() {
      console.log('Socket open!!!');
    });

    socket.on('error', function(e) {
      console.log('Socket error!!!', e);
    });

    socket.on('disconnect', function(e) {
      console.log('Socket disconnect!!!');
    });

    socket.on('reconnect', function(e) {
      console.log('Socket reconnect!!!');
    });

  });
})();