let nodeServer = require('../server-node');

var BitmarkRPCWebsocketServer = nodeServer.Server;
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

// Run browser test by karma
const cfg = require('karma').config;
const karmaConfig = cfg.parseConfig(path.resolve('./karma.conf.js'));
var KarmaServer = require('karma').Server
var server = new KarmaServer(karmaConfig, function(exitCode) {
  // console.log('Karma has exited with ' + exitCode)
  // process.exit(exitCode)
});
server.start();