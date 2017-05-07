(function() {
  $(function() {
    var $body = $('body');
    var connection = new WebSocket('ws:\/\/127.0.0.1:3000\/');
    var appendMessage = function(text) {
      $body.append(text);
      $body.append('<br/>');
    };

    appendMessage('Connecting...');

    // When the connection is open, send some data to the server
    connection.onopen = function () {
      appendMessage('Connection openned');
      appendMessage('Send Ping');
      connection.send('Ping'); // Send the message 'Ping' to the server
      setInterval(function() {
        appendMessage('Send a json object');
        connection.send(JSON.stringify({name: 'cuong', from: 'Bitmark'}));
      }, 5000);
    };

    // Log errors
    connection.onerror = function (error) {
      appendMessage('Connection has error');
      console.log(error);
    };

    // Log messages from the server
    connection.onmessage = function (e) {
      appendMessage('Receive message ' + e.data);
    };

    connection.onclose = function(e) {
      appendMessage('Socket closed');
    };

    setInterval(function() {
      console.log(connection.bufferedAmount);
    }, 3000);


    // var eventTarget = document.createElement('div');
    // var event = new CustomEvent('build', {somedata: 'data'});
    // eventTarget.addEventListener('build', function() {
    //   console.log('AAAAAA');
    // });
    // eventTarget.dispatchEvent(event);
    // window.aaa = eventTarget;
  });

})();