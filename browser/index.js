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

  function generateEvent(s, args) {
    var evt = window.document.createEvent("CustomEvent");
    evt.initCustomEvent(s, false, false, args);
    return evt;
  }

  function TimeDecay(intervalInput, decayInput) {
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
  }

  function removeAllListeners(connection) {
    for (var i in EVENT) {
      connection.removeEventListener(i);
    }
  }

  var BitmarkWebsocket = function(url, options) {
    var self = this;
    // Event system for BitmarkWebsocket object
    var eventTarget = document.createElement('div');
    this.on = eventTarget.addEventListener.bind(eventTarget);
    this.off = eventTarget.removeEventListener.bind(eventTarget);
    this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);

    // BitmarkWebsocket attribute
    options = options || {};
    this.scheduler = new TimeDecay(options.reconnect_interval, options.reconnect_decay);
    this.reconnectTimer = null;
    this.connection = null;
    this.state = STATE.UNAVAILABLE;

    // Create the new Websocket and listening to event
    function createSocket(url, isNew, time) {
      window.clearTimeout(self.reconnectTimer);
      console.log('Create socket in ', time);
      self.reconnectTimer = setTimeout(function() {
        self.connection = new WebSocket(url);
        /**
         * If the error happen before we even succeed open the connection
         * We just close the connection and create a new socket later
         * @param  {Event} e
         */
        var onErrorBeforeOpening = function(e) {
          self.dispatchEvent(generateEvent(EVENT.ERROR, e));
          self.connection.close();
          createSocket(url, isNew, self.scheduler.getTime());
        };
        /**
         * If the socket discoonect (after connected successfully)
         * We remove all event listeners, close the socket and create a new one
         * @param  {EVENT} e
         */
        var onSocketDisconnect = function(e) {
          self.connection.removeEventListener(EVENT.ERROR, onErrorAfterOpening);
          self.connection.removeEventListener(EVENT.CLOSE, onSocketClose);
          self.connection.removeEventListener(EVENT.OPEN, onSocketOpen);
          self.dispatchEvent(generateEvent(EVENT.DISCONNECT, e));
          self.connection.close();
          createSocket(url, false, self.scheduler.getTime());
        };
        var onErrorAfterOpening = function(e) {
          self.dispatchEvent(generateEvent(EVENT.ERROR));
          onSocketDisconnect(e);
        };
        var onSocketClose = function(e) {
          onSocketDisconnect(e);
        };
        var onSocketOpen = function(e) {
          self.dispatchEvent(generateEvent(isNew ? EVENT.OPEN : EVENT.RECONNECT, e));
          self.scheduler.reset();

          self.connection.removeEventListener(EVENT.ERROR, onErrorBeforeOpening);
          self.connection.addEventListener(EVENT.ERROR, onErrorAfterOpening);
          self.connection.addEventListener(EVENT.CLOSE, onSocketClose);
          // TODO: add a lot of event
        };

        self.connection.addEventListener('open', onSocketOpen);
        self.connection.addEventListener('error', onErrorBeforeOpening);

      }, time);
    }

    createSocket(url, true, 0);

    // eventTarget.addEventListener('open',       function(event) { self.onopen(event); });
    // eventTarget.addEventListener('close',      function(event) { self.onclose(event); });
    // eventTarget.addEventListener('connecting', function(event) { self.onconnecting(event); });
    // eventTarget.addEventListener('message',    function(event) { self.onmessage(event); });
    // eventTarget.addEventListener('error',      function(event) { self.onerror(event); });
    // this.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
    // setTimeout(function() {
    //   var event = generateEvent('open', {data: 'hehe'});
    //   eventTarget.dispatchEvent(event);
    // }, 1000);
  };
  window.BitmarkWebsocket = BitmarkWebsocket;
})();