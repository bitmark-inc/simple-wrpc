var WebSocketServer = require('uws').Server;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var RECONNECT_WAITING_TIMEOUT = 5 * 60 * 1000;
var EVENT = {
  OPEN: 'open',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  MESSAGE: 'message',
  CLOSE: 'close',
  ERROR: 'error'
};
var STATE = {
  UNAVAILABLE: 'unavailable',
  AVAILABLE: 'available',
  CLOSED: 'closed'
};
var MESSAGE_SIGNAL = {
  REQUEST: 'req', // req:<id>:<type>:<name>:<params>
  RESPONSE: 'res' // res:<id>:<data>
};

var PRESERVED_MESSAGE_NAME = {
  PING: 'ping',
  PONG: 'pong'
}

var MESSAGE_TYPE = {
  ONE_WAY: '1',
  TWO_WAY: '2'
};

var TIMEOUT = 30000;
var CALL_TIMEOUT = 10000;

/**
 * All utilities
 * @type {Object}
 */
var Helper = {};
Helper.makeRandomString = function(length) {
  var text = '';
  var possible = 'abcdef0123456789';

  length = length || 8;
  for( var i=0; i < length; i++ ) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

Helper.createID = function() {
  return (new Date().getTime()) + '-' + Helper.makeRandomString();
};

/**
 * Message structure
 * {id, content}
 */
Helper.MessagePool = function() {
  var messages = [];

  this.pushMessage = function(message) {
    if (!message.id) {
      throw new Error('message id is required');
    }
    if (!message.content) {
      throw new Error('message content is required');
    }
    message.id = message.id.toString();
    messages.push(message);
  };

  this.removeMessageUntilID = function(id) {
    for (var i = 0, length = messages.length; i < length; i++) {
      if (messages[i].id === id) {
        messages.splice(0, i+1);
        break;
      }
    }
  };

  this.getMessages = function() {
    return messages;
  };

  this.getMessage = function(id) {
    return messages.find(function(message) {
      return message.id === id;
    });
  };
};

Helper.parseMessage = function(messageString) {
  var requestRegExp = new RegExp(
    '^' + MESSAGE_SIGNAL.REQUEST + ':' + // signal
    '([^:]+):' + // id
    '(' + MESSAGE_TYPE.ONE_WAY + '|' + MESSAGE_TYPE.TWO_WAY + '):' + // type
    '([^:]+)' + // name
    '(?::(.+))?$'); // parameter
  var responseRegExp = new RegExp(
    '^' + MESSAGE_SIGNAL.RESPONSE + ':' +
    '([^:]+)' + // id
    '(?::(.+))?$'); // data

  var result = responseRegExp.exec(messageString);
  if (result) {
    try {
      result[2] = JSON.parse(result[2]);
    } catch (err) {}
    return {
      signal: MESSAGE_SIGNAL.RESPONSE,
      id: result[1],
      data: result[2]
    }
  } else {
    result = requestRegExp.exec(messageString);
    if (result && (result[2] === MESSAGE_TYPE.ONE_WAY || result[2] === MESSAGE_TYPE.TWO_WAY)) {
      if (result[4]) {
        try {
          result[4] = JSON.parse(result[4]);
        } catch (err) {}
      }
      return {
        signal: MESSAGE_SIGNAL.REQUEST,
        id: result[1],
        type: result[2],
        name: result[3],
        data: result[4]
      };
    }
    return null;
  }
};

Helper.buildRequestMessage = function(id, type, name, params) {
  return MESSAGE_SIGNAL.REQUEST + ':' + id + ':' + type + ':' + name + (params ? ':' + JSON.stringify(params) : '');
};

Helper.buildReponseMessage = function(id, data) {
  return MESSAGE_SIGNAL.RESPONSE + ':' + id + (data ? ':' + JSON.stringify(data) : '');
};



var BitmarkRPCWebsocket = function(connection) {
  var self = this;
  var messagePool = new Helper.MessagePool();

  this.connection = null;

  function sendMessage(id, content, callback) {
    console.log('SEND MESSAGE', content);
    messagePool.pushMessage({
      id: id,
      content: content,
      callback
    });
    self.connection.send(content);
  };

  //----------------------------------------------------
  // GROUP OF FUNCTIONS FOR SENDING REQUEST

  this.sendData = function(name, params, callback) {
    var id = Helper.createID();
    sendMessage(id, Helper.buildRequestMessage(id, MESSAGE_TYPE.ONE_WAY, name, params), callback);
  };

  this.callMethod = function(name, params, callback) {
    var id = Helper.createID();
    sendMessage(id, Helper.buildRequestMessage(id, MESSAGE_TYPE.TWO_WAY, name, params), callback);
  };

  function sendPingRequest() {
    var id = new Date().getTime();
    sendMessage(id, Helper.buildRequestMessage(id, MESSAGE_TYPE.ONE_WAY, PRESERVED_MESSAGE_NAME.PING));
  }

  var pingTimer;
  function onReceivingResponse(response) {
    var message = messagePool.getMessage(response.id);
    if (message.callback) {
      message.callback(response.data);
    }
    // receiving response means other messages before the corresponding requests are sent
    messagePool.removeMessageUntilID(response.id);
    window.clearTimeout(pingTimer);
    pingTimer = setTimeout(sendPingRequest, TIMEOUT);
  }

  //----------------------------------------------------
  //GROUP OF FUNCTIONS FOR RECEIVING REQUEST

  var dataEventTarget = new EventEmitter();
  this.addListenerForData = dataEventTarget.on.bind(dataEventTarget);
  this.removeListenerForData = dataEventTarget.removeListener.bind(dataEventTarget);

  var methodCallEventTarget = new EventEmitter();
  this.addListenerForMethodCall = methodCallEventTarget.on.bind(methodCallEventTarget);
  this.removeListenerForMethodCall = methodCallEventTarget.removeListener.bind(methodCallEventTarget);

  function onReceivingRequest(request) {
    switch (request.type) {
      case MESSAGE_TYPE.ONE_WAY:
        dataEventTarget.emit(request.name, request.data);
        sendMessage(request.id, Helper.buildReponseMessage(request.id));
      case MESSAGE_TYPE.TWO_WAY:
        request.data = request.data || {};
        request.data.done = function(data) {
          sendMessage(request.id, Helper.buildReponseMessage(request.id, data));
        };
        methodCallEventTarget.emit(request.name, request.data);
    }
  }

  //----------------------------------------------------
  //GROUP OF FUNCTIONS FOR DRIVING INCOMING MESSAGES

  var requestIDsReceived = []; // To prevent receiving duplicate request
  var responseIDsReceived = []; // To prevent receiving duplicate response

  /**
   * The ping pong method is a mechanism to d
   */
  function addReceivingMessageHandler() {
    var connection = self.connection;

    function onReceivingMessage(message) {
      console.log('===== RECEIVED MESSAGE');
      console.log(message);
      var message = Helper.parseMessage(message);
      if (!message) {
        console.warn('ignore message because of unrecognized type', message);
        return;
      }
      // If the socket receives the response data or pong data
      // it means all the messages before that have been sent
      console.log('==== PARSE IT TO');
      console.log(message);
      switch (message.signal) {
        case MESSAGE_SIGNAL.REQUEST:
          console.log('RECEIVE REQUEST');
          console.log(message);
          if (requestIDsReceived.indexOf(message.id) === -1) {
            onReceivingRequest(message);
            requestIDsReceived.push(message.id);
          }
          break;
        case MESSAGE_SIGNAL.RESPONSE:
          if (responseIDsReceived.indexOf(message.id) === -1) {
            onReceivingResponse(message);
            responseIDsReceived.push(message.id);
          }
          break;
      }
    }

    connection.on('message', onReceivingMessage);
    return function () {
      connection.removeListener('message', onReceivingMessage);
    };
  };

  this.setConnection = function(connection) {
    self.connection = connection;
    var removeMessageHandler = null;
    /**
     * If the socket discoonect (after connected successfully)
     * We remove all event listeners, close the socket and create a new one
     * @param  {EVENT} e
     */
    var onSocketDisconnect = function(e) {
      self.connection.removeListener('error', onErrorAfterOpening);
      self.connection.removeListener('close', onSocketClose);
      removeMessageHandler();
      self.emit(EVENT.DISCONNECT, e);
      self.connection.close();
    };

    var onErrorAfterOpening = function(e) {
      self.emit(EVENT.ERROR, e);
      onSocketDisconnect(e);
    };

    var onSocketClose = function(e) {
      console.log('Socket is closed');
      onSocketDisconnect(e);
    };

    var onTimeout = function(e) {
      onSocketDisconnect(e);
    };

    self.connection.on('error', onErrorAfterOpening);
    self.connection.on('close', onSocketClose);
    self.connection.on('timeout', onTimeout); // this event is used to detect connection lost better
    removeMessageHandler = addReceivingMessageHandler();

    // Resend all the messages that is left from the last connection if any
    messagePool.getMessages().forEach(function(message) {
      self.connection.send(message.content);
    });

    self.connection.send(self.id);
  };

  this.setConnection(connection);
};
util.inherits(BitmarkRPCWebsocket, EventEmitter);

var BitmarkRPCWebsocketServer = function(options) {
  var self = this;
  var wss = new WebSocketServer(options);
  var idMap = {}; // string - BitmarkRPCWebsocket

  wss.on('connection', function(connection) {
    function waitingForID(id) {
      console.log('id is ', id);
      connection.removeListener('message', waitingForID);
      if (idMap[id]) {
        idMap[id].setConnection(connection);
      } else {
        idMap[id] = new BitmarkRPCWebsocket(connection);
        self.emit('connection', idMap[id]);
      }
    }
    connection.on('message', waitingForID);
    // var eventSystem = new EventEmitter(); // an attempt for allow multiple event listeners for uws
    // connection = eventSystem;
    // connection.on('message', eventSystem.emit.bind(eventSystem, 'message'));
    // connection.on('error', eventSystem.emit.bind(eventSystem, 'error'));
    // connection.on('close', eventSystem.emit.bind(eventSystem, 'close'));

    // eventSystem.on('message', waitingForID);
  });
};

util.inherits(BitmarkRPCWebsocketServer, EventEmitter);

module.exports = {
  Server: BitmarkRPCWebsocketServer
};