var WebSocketServer = require('uws').Server;
var EventEmitter = require('events').EventEmitter;
var util = require('util');


var rg = /^(data|ping):?(.*)$/;
var parseMessage = function(messageString) {
  result = rg.exec(messageString);
  return result ? {signal: result[1], data: result[2]} : {};
};

var BitmarkWebsocket = function(ws) {
  var self = this;
  ws.on('message', function(message) {
    message = parseMessage(message);
    console.log('Received message with');
    console.log('- Signal: ' + message.signal);
    console.log('- Data:' + message.data);
    switch (message.signal) {
      case 'ping':
        ws.send('pong:' + message.data);
        break;
    }
  });
};
util.inherits(BitmarkWebsocket, EventEmitter);

var BitmarkWebsocketServer = function(options) {
  var self = this;
  var wss = new WebSocketServer(options);
  wss.on('connection', function(ws) {
    self.emit('connection', new BitmarkWebsocket(ws));
  });
};

util.inherits(BitmarkWebsocketServer, EventEmitter);

module.exports = {
  Server: BitmarkWebsocketServer
};



// var WebSocketServer = require('uws').Server;
// var wss = new WebSocketServer({ port: 3000 });

// function onMessage(message) {
//     console.log('received: ' + message);
// }

// function onClose() {
//   console.log('socket is closed');
// }

// wss.on('connection', function(ws) {
//     ws.on('message', onMessage);
//     ws.on('close', onClose);
// });