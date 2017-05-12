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
  OPEN: 1,
  CLOSED: 'closed'
};
var MESSAGE_SIGNAL = {
  REQUEST: 'req', // req:<id>:<type>:<name>:<params>
  RESPONSE: 'res' // res:<id>:<data>
};

var PRESERVED_MESSAGE_NAME = {
  PING: 'ping',
  CLOSE: 'close'
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

Helper.SequenceID = function() {
  var sequenceID = 0;
  this.get = function() {
    return ++sequenceID;
  }
}

/**
 * Message structure
 * {id, content}
 */
Helper.MessagePool = function() {
  var messages = [];
  var callback = {};

  this.pushMessage = function(message) {
    if (!message.id) {
      throw new Error('message id is required');
    }
    if (!message.signal) {
      throw new Error('message signal is required');
    }
    if (!message.content) {
      throw new Error('message content is required');
    }
    message.id = message.id.toString(); // make sure the id is string
    callback[message.id] = message.callback;
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

  this.callCallback = function(id, error, result) {
    if (callback[id]) {
      callback[id].call(undefined, error, result);
      delete callback[id];
    }
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

var SimpleWRPC = function(connection) {
  var self = this;
  var messagePool = new Helper.MessagePool();

  this.sequenceID = new Helper.SequenceID();
  this.connection = null;
  this.readyState = STATE.OPEN;

  function sendMessage(id, signal, content, callback) {
    if (self.readyState === STATE.CLOSE) {
      console.warn('Cannot send message because the socket was closed: ', content);
      return;
    }
    console.log('SEND ' + content + ' AT ' + new Date().getTime());
    messagePool.pushMessage({
      id: id,
      signal: signal,
      content: content,
      callback
    });
    self.connection.send(content);
  };

  //----------------------------------------------------
  // GROUP OF FUNCTIONS FOR SENDING REQUEST

  this.emitEvent = function(name, params, callback) {
    var id = self.sequenceID.get();
    var signal = MESSAGE_SIGNAL.REQUEST;
    var content = Helper.buildRequestMessage(id, MESSAGE_TYPE.ONE_WAY, name, params);
    sendMessage(id, signal, content, callback);
  };

  this.callMethod = function(name, params, callback) {
    var id = self.sequenceID.get();
    var signal = MESSAGE_SIGNAL.REQUEST;
    var content = Helper.buildRequestMessage(id, MESSAGE_TYPE.TWO_WAY, name, params)
    sendMessage(id, signal, content, callback);
  };

  function sendPingRequest() {
    var id = self.sequenceID.get();
    var signal = MESSAGE_SIGNAL.REQUEST;
    var content = Helper.buildRequestMessage(id, MESSAGE_TYPE.ONE_WAY, PRESERVED_MESSAGE_NAME.PING);
    sendMessage(id, signal, content);
  }

  var pingTimer;
  function onReceivingResponse(response) {
    messagePool.callCallback(response.id, null, response.data);
    // receiving response means other messages before the corresponding requests are sent
    messagePool.removeMessageUntilID(response.id);
    clearTimeout(pingTimer);
    pingTimer = setTimeout(sendPingRequest, TIMEOUT);
  }

  //----------------------------------------------------
  //GROUP OF FUNCTIONS FOR RECEIVING REQUEST

  var subscriptionEventTarget = new EventEmitter();
  this.subscribeToEvent = subscriptionEventTarget.on.bind(subscriptionEventTarget);
  this.unsubscribeToEvent = subscriptionEventTarget.removeListener.bind(subscriptionEventTarget);

  var methodCallEventTarget = new EventEmitter();
  this.addListenerToMethodCall = methodCallEventTarget.on.bind(methodCallEventTarget);
  this.removeListenerForMethodCall = methodCallEventTarget.removeListener.bind(methodCallEventTarget);

  // Subscribe to the request to close the socket from the server
  this.subscribeToEvent(PRESERVED_MESSAGE_NAME.CLOSE, function() {
    self.close(true);
  });

  function onReceivingRequest(request) {
    switch (request.type) {
      case MESSAGE_TYPE.ONE_WAY:
        sendMessage(request.id, MESSAGE_SIGNAL.RESPONSE, Helper.buildReponseMessage(request.id));
        subscriptionEventTarget.emit(request.name, request.data);
      case MESSAGE_TYPE.TWO_WAY:
        request.data = request.data || {};
        request.data.done = function(data) {
          sendMessage(request.id, MESSAGE_SIGNAL.RESPONSE, Helper.buildReponseMessage(request.id, data));
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
      console.log('RECEIVE ' + message + ' AT ' + new Date().getTime());
      var message = Helper.parseMessage(message);
      if (!message) {
        console.warn('ignore message because of unrecognized type', message);
        return;
      }
      // If the socket receives the response data or pong data
      // it means all the messages before that have been sent
      switch (message.signal) {
        case MESSAGE_SIGNAL.REQUEST:
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

  //--------------------------------------------------------
  //GROUP OF FUNCTIONS FOR BINDING TO THE CURRENT CONNECTION

  function sendCloseRequest(callback) {
    var id = self.sequenceID.get();
    var signal = MESSAGE_SIGNAL.REQUEST;
    var content = Helper.buildRequestMessage(id, MESSAGE_TYPE.ONE_WAY, PRESERVED_MESSAGE_NAME.CLOSE);
    sendMessage(id, signal, content, callback);
  }

  self.close = function(silent) {
    var close = function() {
      self.connection.close();
      self.emit(EVENT.CLOSE);
    }
    if (silent || self.readyState !== STATE.OPEN) {
      close();
    } else {
      sendCloseRequest(close);
    }
    self.readyState = STATE.CLOSE;
  }

  // this function can be called to replace the old websocket
  this.setConnection = function(connection) {

    if (self.readyState === STATE.CLOSE) {
      console.warn('Cannot set connection because it was closed');
      return;
    }

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

  };

  this.setConnection(connection);
};
util.inherits(SimpleWRPC, EventEmitter);

var SimpleWRPCServer = function(options) {
  var self = this;
  var wss = new WebSocketServer(options);
  var idMap = {}; // string - SimpleWRPC

  wss.on('connection', function(connection) {
    function waitingForID(id) {
      console.log('id is ', id);
      connection.removeListener('message', waitingForID);
      if (idMap[id]) {
        idMap[id].setConnection(connection);
      } else {
        idMap[id] = new SimpleWRPC(connection);
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

util.inherits(SimpleWRPCServer, EventEmitter);

module.exports = {
  Server: SimpleWRPCServer
};