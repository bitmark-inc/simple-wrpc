var BitmarkRPCWebsocketServer = require('./index.js').Server;

var bitmarkRPC = new BitmarkRPCWebsocketServer({port: 3000});

bitmarkRPC.on('connection', function(conn) {
  conn.subscribeToEvent('mydata', function(data) {
    console.log('I JUST RECEIVED MYDATA WITH DATA', data);
  });
  conn.addListenerToMethodCall('mymethod', function(event) {
    event.done({data: 'aaabc'});
  });
  conn.emitEvent('datafromserver', {a: 'aaa', b: 'bbb'}, function() {
    console.log('Sent');
  });
});