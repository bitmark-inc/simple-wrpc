var BitmarkRPCWebsocketServer = require('./index.js').Server;

var bitmarkRPC = new BitmarkRPCWebsocketServer({port: 3000});

bitmarkRPC.on('connection', function(conn) {
  conn.addListenerForData('mydata', function(data) {
    console.log('I JUST RECEIVED MYDATA WITH DATA', data);
  });
  conn.addListenerForMethodCall('mymethod', function(event) {
    event.done({data: 'aaabc'});
  });
});