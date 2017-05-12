(function() {
  $(function() {

    var socket = new SimpleWRPC('ws:\/\/127.0.0.1:3000\/');

    socket.subscribeToEvent('datafromserver', function(e) {
      console.log('Receive data from server', e.detail);
    });

    setTimeout(function() {
      socket.emitEvent('mydata', {one: 1, two: 2},  function(error, data) {
        console.log('Send mydata successfully!!!');
      });
    }, 2000);

    setTimeout(function() {
      socket.callMethod('mymethod', {one: 1, two: 2},  function(error, data) {
        console.log('Send mydata successfully!!!');
        console.log('Receive back data', data);
      });
    }, 4000);

    setTimeout(function() {
      socket.close();
    }, 2000);

  });
})();