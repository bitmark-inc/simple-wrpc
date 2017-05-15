/**
 * Event flow
 * - open
 * - disconnect // if the connection to the server is lost after opening the socket
 * - reconnect // if the socket reconnects to the server successfully after the disconnect
 * - message
 * - close
 * - error // Error can happen during any stages - but the socket still tries to connect to the server if it has not closed
 */

// TODO: Add timeout if ping does not work
// TODO: Add close signal
// TODO: fix the case that the reponse is returned not in order but we already remove the elements (and the callback)

(function() {
  var RECONNECT_INTERVAL = 2000;
  var RECONNECT_DECAY = 1.5;
  var EVENT = {
    OPEN: 'open',
    DISCONNECT: 'disconnect',
    RECONNECT: 'reconnect',
    MESSAGE: 'message',
    CLOSE: 'close',
    ERROR: 'error'
  };
  var STATE = {
    CONNECTING: 1,
    OPEN: 2,
    RECONNECTING: 3,
    CLOSING: 4,
    CLOSED: 5
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
  }

  Helper.SequenceID = function() {
    var sequenceID = 0;
    this.get = function() {
      return ++sequenceID;
    }
  }

  Helper.createEvent = function(name, params) {
    var event = new CustomEvent(name);
    if (params) {
      for (var key in params) {
        event[key] = params[key];
      }
    }
    return event;
  };

  Helper.TimeDecay = function(intervalInput, decayInput) {
    var interval, decay;
    this.reset = function() {
      interval = intervalInput || RECONNECT_INTERVAL;
      decay = decayInput || RECONNECT_DECAY;
    };
    this.getTime = function() {
      var result = Math.round(interval);
      interval = interval * decay;
      return result;
    };
    this.reset();
  };

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
      if (message.callback) {
        callback[message.id] = message.callback;
      }
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


  /**
   * Our websocket wrapper
   * @param {string} url     websocket server
   * @param {object} options {
   *   reconnect_interval,
   *   reconnect_decay
   * }
   */
  var SimpleWRPC = function(url, options) {
    var self = this;
    // Event system for SimpleWRPC object
    var socketEventTarget = document.createElement('div');
    this.on = socketEventTarget.addEventListener.bind(socketEventTarget);
    this.off = socketEventTarget.removeEventListener.bind(socketEventTarget);
    this.dispatchEvent = socketEventTarget.dispatchEvent.bind(socketEventTarget);

    // SimpleWRPC attribute
    options = options || {};
    this.reconnectScheduler = new Helper.TimeDecay(options.reconnect_interval, options.reconnect_decay);
    this.reconnectTimer = null;
    this.connection = null;
    this.readyState = STATE.CONNECTING;
    this.id = Helper.createID();
    this.sequenceID = new Helper.SequenceID();

    var messagePool = new Helper.MessagePool();
    var lastSuccess = 0;

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
        callback: callback
      });
      self.connection.send(content);
    };

    //----------------------------------------------------
    // GROUP OF FUNCTIONS FOR SENDING REQUEST

    this.publishEvent = function(name, params, callback) {
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
      if (self.readyState === STATE.CLOSE) {
        return;
      }
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
      window.clearTimeout(pingTimer);
      pingTimer = setTimeout(sendPingRequest, TIMEOUT);
    }

    //----------------------------------------------------
    //GROUP OF FUNCTIONS FOR RECEIVING REQUEST

    var subscriptionEventTarget = document.createElement('div');
    this.subscribeForEvent = subscriptionEventTarget.addEventListener.bind(subscriptionEventTarget);
    this.unsubscribeForEvent = subscriptionEventTarget.removeEventListener.bind(subscriptionEventTarget);

    var methodCallEventTarget = document.createElement('div');
    this.addListenerToMethodCall = methodCallEventTarget.addEventListener.bind(methodCallEventTarget);
    this.removeListenerForMethodCall = methodCallEventTarget.removeEventListener.bind(methodCallEventTarget);

    // Subscribe to the request to close the socket from the server
    this.subscribeForEvent(PRESERVED_MESSAGE_NAME.CLOSE, function() {
      self.close(true);
    });

    function onReceivingRequest(request) {
      switch (request.type) {
        case MESSAGE_TYPE.ONE_WAY:
          sendMessage(request.id, MESSAGE_SIGNAL.RESPONSE, Helper.buildReponseMessage(request.id));
          subscriptionEventTarget.dispatchEvent(Helper.createEvent(request.name, {data: request.data}))
        case MESSAGE_TYPE.TWO_WAY:
          methodCallEventTarget.dispatchEvent(Helper.createEvent(request.name, {
            data: request.data,
            done: function(data) {
              sendMessage(request.id, MESSAGE_SIGNAL.RESPONSE, Helper.buildReponseMessage(request.id, data));
            }
          }));
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

      function onReceivingMessage(event) {
        console.log('RECEIVE ' + event.data + ' AT ' + new Date().getTime());
        var message = Helper.parseMessage(event.data);
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

      connection.addEventListener('message', onReceivingMessage);
      return function () {
        connection.removeEventListener('message', onReceivingMessage);
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
      // Clear the timer to prevent a reconnect later
      if (self.reconnectTimer) {
        window.clearTimeout(self.reconnectTimer)
      }
      var close = function() {
        self.connection.close();
        self.dispatchEvent(Helper.createEvent(EVENT.CLOSE, {}))
      }
      if (silent || self.readyState !== STATE.OPEN) {
        close();
      } else {
        sendCloseRequest(close);
      }
      self.readyState = STATE.CLOSE;
    }


    /**
     * Create socket and recreate socket if the last socket failed
     * @param  {string}  url   socket server url
     * @param  {boolean} isFirst indicate whether this is the first time connecting
     * @param  {number}  time  delay before creating the socket
     */
    function createSocket(url, isFirst, time) {
      window.clearTimeout(self.reconnectTimer);
      console.log('Create a new socket in ' + time);
      self.reconnectTimer = setTimeout(function() {
        self.connection = new WebSocket(url);
        /**
         * If the error happen before we even succeed open the connection
         * We just close the connection and create a new socket later
         * @param  {Event} e
         */
        var onErrorBeforeOpening = function(e) {
          self.dispatchEvent(Helper.createEvent(EVENT.ERROR, e));
          self.connection.close();
          createSocket(url, isFirst, self.reconnectScheduler.getTime());
        };

        var onSocketOpen = function(e) {
          var removeMessageHandler = null;

          if (self.readyState === STATE.CLOSE) {
            // In case the close method is called while the socket is trying to open
            self.connection.close();
            return;
          } else {
            self.readyState = STATE.OPEN;
          }
          /**
           * If the socket discoonect (after connected successfully)
           * We remove all event listeners, close the socket and create a new one
           * @param  {EVENT} e
           */
          var onSocketDisconnect = function(e) {
            self.connection.removeEventListener('error', onErrorAfterOpening);
            self.connection.removeEventListener('close', onSocketClose);
            self.connection.removeEventListener('open', onSocketOpen);
            removeMessageHandler();
            self.dispatchEvent(Helper.createEvent(EVENT.DISCONNECT, e));
            self.connection.close();
            if (self.readyState !== STATE.CLOSE) {
              // if close method is not called, just re-open the connection
              self.readyState = STATE.RECONNECTING;
              createSocket(url, false, self.reconnectScheduler.getTime());
            }
          };

          var onErrorAfterOpening = function(e) {
            self.dispatchEvent(Helper.createEvent(EVENT.ERROR, e));
            onSocketDisconnect(e);
          };

          var onSocketClose = function(e) {
            console.log('Socket is closed');
            onSocketDisconnect(e);
          };

          var onTimeout = function(e) {
            onSocketDisconnect(e);
          };

          self.connection.removeEventListener('error', onErrorBeforeOpening);
          self.connection.addEventListener('error', onErrorAfterOpening);
          self.connection.addEventListener('close', onSocketClose);
          self.connection.addEventListener('timeout', onTimeout); // this event is used to detect connection lost better
          removeMessageHandler = addReceivingMessageHandler(self.connection);

          self.dispatchEvent(Helper.createEvent(isFirst ? EVENT.OPEN : EVENT.RECONNECT, e));
          self.reconnectScheduler.reset();

          // Resend all the messages that is left from the last connection if any
          messagePool.getMessages().forEach(function(message) {
            self.connection.send(message.content);
          });

          self.connection.send(self.id);
          sendPingRequest();
        };

        self.connection.addEventListener('open', onSocketOpen);
        self.connection.addEventListener('error', onErrorBeforeOpening);

      }, time);
    }

    createSocket(url, true, 0);
  };

  window.SimpleWRPC = SimpleWRPC;

})();