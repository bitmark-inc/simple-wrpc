(function() {
  $(function() {
    var $body = $('body');
    var connection = new window.WebSocket('ws://192.168.0.106:5051/echo');
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
    };

    // Log errors
    connection.onerror = function (error) {
      appendMessage('Connection has error');
      console.log('WebSocket Error ' + error);
    };

    // Log messages from the server
    connection.onmessage = function (e) {
      appendMessage('Receive message ' + e.data);
      console.log('Server: ' + e.data);
    };
  });

})();