/**
 * Event flow
 * - open
 * - disconnect // if the connection to the server is lost after opening the socket
 * - reconnect // if the socket reconnects to the server successfully after the disconnect
 * - message
 * - close
 * - error // Error can happen during any stages - but the socket still tries to connect to the server if it has not closed
 */

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
    UNAVAILABLE: 'unavailable',
    AVAILABLE: 'available',
    CLOSED: 'closed'
  };
  var MESSAGE_PREFIX = {
    PING: 'ping',
    PONG: 'pong',
    API: 'api'
  };
  var MESSAGE_TYPE = {
    ONE_WAY: 1,
    TWO_WAY: 2
  };
  // var MESSAGE_STATE = {
  //   INITIALIZED: 0,
  //   SENT: 1,
  //   FINISHED: 2
  // };
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

  Helper.generateEvent = function(s, args) {
    var evt = window.document.createEvent("CustomEvent");
    evt.initCustomEvent(s, false, false, args);
    return evt;
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
   * Pool is a place to manage message in 3 states, unsent, sent, and finished
   */
  function MessagePool() {
    var unsentPool = {};
    var sentPool = {};
    var objectToArray = function(object) {
      var result = [];
      for (var key in object) {
        result.push(object[key]);
      }
      return result;
    };
    this.pushUnsentItem = function(id, data) {
      unsentPool[id] = data;
    };
    this.getUnsentItems = function() {
      return objectToArray(unsentPool);
    };
    this.pushSentItem = function(id, data) {
      sentPool[id] = data;
    };
    this.getSentItem = function(id) {
      return sentPool[id];
    };
    this.getSentItems = function() {
      return objectToArray(sentPool);
    };
    this.setToSent = function(id) {
      sentPool[id] = unsentPool[id];
      delete unsentPool[id];
    };
    this.setAllToUnsent = function(id) {
      for (var id in sentPool) {
        unsentPool[id] = sentPool[id];
        delete sentPool[id];
      }
    };
    this.setToFinished = function(id) {
      delete sentPool[id];
    };
    this.removeAll = function() {
      var id;
      for (id in sentPool) {
        delete sentPool[id];
      }
      for (id in unsentPool) {
        delete unsentPool[id];
      }
    };
  }

  /**
   * Our websocket wrapper
   * @param {string} url     websocket server
   * @param {object} options {
   *   reconnect_interval,
   *   reconnect_decay
   * }
   */
  var BitmarkWebsocket = function(url, options) {
    var self = this;
    // Event system for BitmarkWebsocket object
    var eventTarget = document.createElement('div');
    this.on = eventTarget.addEventListener.bind(eventTarget);
    this.off = eventTarget.removeEventListener.bind(eventTarget);
    this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);

    // BitmarkWebsocket attribute
    options = options || {};
    this.scheduler = new Helper.TimeDecay(options.reconnect_interval, options.reconnect_decay);
    this.reconnectTimer = null;
    this.connection = null;
    this.state = STATE.UNAVAILABLE;


    /**
     * This group of functions deals with sending message and callback
     */
    /**
     * A place to store all the messages sent to the server
     * @type {object} {
     *   {
     *     detaiL: {
     *       id: string,
     *       name: string
     *       message_type: MESSAGE_TYPE,
     *       data: object,
     *       timeout: number
     *     }
     *     callback: function
     *   }
     */
    var messagePool = new MessagePool(); // keep the message in MESSATE_STATE.INITIALIZED state

    function sendAllUnsentMessages() {
      if (self.connection && self.connection.readyState === 1) { // socket is available
        messagePool.getUnsentItems().forEach(function(item) {
          self.connection.send(MESSAGE_PREFIX.API + ':' + JSON.stringify(message.detail));
          messagePool.setToSent(item.detail.id);
        });
      }
    }

    function sendMessage(name, messageType, data, timeout, callback) {
      var message = {
        detail: {
          id: (new Date().getTime()) + '-' + Helper.makeRandomString(),
          name: name,
          message_type: messageType,
          data: data,
          timeout: timeout,
        },
        callback: callback
      };
      messagePool.pushUnsentItem(message.detail.id, message);
      sendAllUnsentMessages();
    }

    function onResponded(response) {
      try {
        var data = JSON.parse(response);
        var message = messagePool.getSentItem(data.id);
        if (!message) {
          console.warn('Ignore data from socket server because the id does not match', data);
        } else {
          if (message.callback) {
            message.callback(data.detail);
          }
          messagePool.setToFinished(data.id);
        }
      } catch (error) {
        console.warn('Ignore data from socket server because the module can not parse', error);
      }
    }

    this.sendData = function(name, data, timeout, callback) {
      sendMessage(name, MESSAGE_TYPE.ONE_WAY, data, timeout, callback);
    };

    this.callMethod = function(name, data, timeout, callback) {
      sendMessage(name, MESSAGE_TYPE.TWO_WAY, data, timeout, callback);
    };

    /**
     * This function adds message handling to the current connection
     * Message could be following types, which requires 2 ways communication
     * - ping and pong
     * - call and response
     * @return {function} the function to revoke all listeners from the connection
     */
    function addMessageReceivingHandler() {
      var connection = self.connection;
      var lastSuccess = new Date().getTime();

      var rg = /^(data|pong):?(.*)$/;
      var parseMessage = function(messageString) {
        result = rg.exec(messageString);
        return result ? {signal: result[1], data: result[2]} : {};
      };

      var onReceivingMessage = function(event) {
        var message = parseMessage(event.data);
        switch (message.signal) {
          case MESSAGE_PREFIX.PONG:
            lastSuccess = message.data;
            console.log('lastSuccess is ' + lastSuccess);
            break;
          case MESSAGE_PREFIX.API: {
            onResponded(message.data);
            break;
          }
        }
      };
      connection.addEventListener('message', onReceivingMessage);

      return function () {
        connection.removeEventListener('message', onReceivingMessage);
      };
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
          self.dispatchEvent(Helper.generateEvent(EVENT.ERROR, e));
          self.connection.close();
          createSocket(url, isFirst, self.scheduler.getTime());
        };

        var onSocketOpen = function(e) {
          var removeMessageHandler = null;
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
            self.dispatchEvent(Helper.generateEvent(EVENT.DISCONNECT, e));
            self.connection.close();
            messagePool.setAllToUnsent();
            createSocket(url, false, self.scheduler.getTime());
          };

          var onErrorAfterOpening = function(e) {
            self.dispatchEvent(Helper.generateEvent(EVENT.ERROR));
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
          removeMessageHandler = addMessageReceivingHandler(self.connection);
          // TODO: add a lot of event

          self.dispatchEvent(Helper.generateEvent(isFirst ? EVENT.OPEN : EVENT.RECONNECT, e));
          self.scheduler.reset();
          sendAllUnsentMessages();
        };

        self.connection.addEventListener('open', onSocketOpen);
        self.connection.addEventListener('error', onErrorBeforeOpening);

      }, time);
    }
    createSocket(url, true, 0);

    function onMessage() {}
  };
  window.BitmarkWebsocket = BitmarkWebsocket;
})();