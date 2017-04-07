var WebsocketServer = require('./index.js').Server;

var wss = new WebsocketServer({port: 3000});

function onMessage(message) {
    console.log('received: ' + message);
}

function onClose() {
  console.log('socket is closed');
}

wss.on('connection', function(ws) {
    ws.on('message', onMessage);
    ws.on('close', onClose);
});