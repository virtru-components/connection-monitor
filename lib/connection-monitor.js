var Emitter = require('emitter');
var _ = require('underscore');

/**
 * The default options for the monitor.  Turns off active monitoring
 * and sets the default for if you do turn on active monitoring to
 * 60 seconds.  If activeMontitoring is true then heartbeatUrl must
 * be set.
 *
 * @type {{activeMonitoring: boolean, heartBeatInterval: number}}
 */
var DEFAULT_OPTIONS = {
  activeMonitoring: false,
  heartBeatInterval: 6000
}

/**
 * Creates a new ConnectionMonitor.  The purpose of this class is
 * to determine whether or not a connection can be established with
 * a particular service, not necessarily detecting changes in
 * network connectivity, though that is a teriary function.
 *
 * The monitor adds events to the 'online' and 'offline' events on
 * the window.  If activeMonitoring is turned on then the monitor
 * will ping the url periodically based on the heartbeatInterval.
 * By default success is determined by a 200 response though technically
 * any sort of response would be acceptable, if custom logic
 * should be used to determine the success of a ping then the
 * heartbeatSuccessFunction should be set.  This function should
 * return either true or false.
 *
 * The monitor emits two events:
 *   online -
 *
 * @param options The options for the monitor
 * @param options.activeMonitoring True if active monitoring is on
 * @param options.heartbeatInterval The interval between active monitoring checks
 * @param options.heartbeatUrl The url to ping for success
 * @param options.heartbeatStatusFunction A function that returns either true
 * or false and determines success or failure of a ping.  This function accepts
 * one parameter, the XHR.  Example:
 *
 * function (xhr) {
 *   if (xhr.status === 200) {
 *     return true;
 *   }
 *   return false;
 * }
 * @constructor
 */
function ConnectionMonitor(options) {

  options = _.extend({}, DEFAULT_OPTIONS, options);

  if (options.activeMonitoring
    && (!options.heartbeatUrl
      || !_.isString(options.heartbeatUrl))) {
    throw new Error('The option heartbeatUrl must be set if active monitoring is turned on');
  }

  this.activeMonitoring = options.activeMonitoring;
  this.heartbeatInterval = options.heartbeatInterval;
  this.heartbeatUrl = options.heartbeatUrl;
  this.hearbeatStatusFunction = options.heartbeatStatusFunction;
  this.isOnline = navigator.onLine;

  _.bindAll(this);
}

// Add events to this class
Emitter(ConnectionMonitor.prototype);

/**
 * Starts monitoring on the network connection.
 */
ConnectionMonitor.prototype.start = function() {
  window.addEventListener("online", this.onOnline, false);
  window.addEventListener("offline", this.onOffline, false);

  if (this.activeMonitoring) {
    this.initializeXhrPolling();
  }
};

/**
 * Stops monitoring
 */
ConnectionMonitor.prototype.stop = function() {
  window.removeEventListener("online", this.onOnline);
  window.removeEventListener("offline", this.onOffline);

  if (this.intervalId) {
    clearTimeout(this.intervalId);
    this.intervalId = null;
  }
};

/**
 * Handles the window.online event.
 */
ConnectionMonitor.prototype.onOnline = function() {
  if (!self.isOnline) {
    self.toggleAndEmit();
  }
};

/**
 * Handles the window.offline event.
 */
ConnectionMonitor.prototype.onOffline = function() {
  if (self.isOnline) {
    self.toggleAndEmit();
  }
};

/**
 * Toggles the state and emits the appropriate event.
 */
ConnectionMonitor.prototype.toggleAndEmit = function() {
  if (this.isOnline) {
    this.isOnline = false;
    this.emit('offline');
  } else {
    this.isOnline = true;
    this.emit('online');
  }
};

/**
 * Intializes pinging of the heartbeat url.
 */
ConnectionMonitor.prototype.initializeXhrPolling = function() {
  this.sendHeartbeat();
  this.intervalId = setInterval(this.sendHeartbeat, this.heartbeatInterval)
};

/**
 * Default success function.
 *
 * @param xhr
 * @returns {boolean}
 */
function defaultStatusFunction(xhr) {
  if (xhr.status === 200) {
    return true;
  }
  return false;
}

ConnectionMonitor.prototype.tryAgain = function() {
  if (this.intervalId) {
    clearTimeout(this.intervalId);
    this.intervalId = null;
  }

  this.initializeXhrPolling();
};

/**
 * This function sends the heartbeat to the url specified in the
 * options.
 */
ConnectionMonitor.prototype.sendHeartbeat = function() {
  var xhr = new XMLHttpRequest();
  var self = this;

  xhr.onreadystatechange = function() {
    if (xhr.readyState != 4) {
      return;
    }

    try {
      var result = self.heartbeatStatusFunction
                     ? self.hearbeatStatusFunction(xhr)
                     : defaultStatusFunction(xhr);
      if (result) {
        if (!self.isOnline) {
          self.toggleAndEmit();
        }
      } else {
        if (self.isOnline) {
          self.toggleAndEmit();
        }
      }
    } catch (err) {
      if (self.isOnline) {
        self.toggleAndEmit();
      }
    }
  };
  xhr.open("GET", this.heartbeatUrl);
  xhr.send();
};

/**
 * The current status of the monitor.
 *
 * @returns {*} True or false, Online or not.
 */
ConnectionMonitor.prototype.status = function() {
  return this.isOnline;
};

/**
 * Factory method to create a new ConnectionMonitor.
 *
 * @param options
 * @returns {ConnectionMonitor}
 */
ConnectionMonitor.create = function(options) {
  var monitor = new ConnectionMonitor(options);
  monitor.start();
  return monitor;
};

exports.ConnectionMonitor = ConnectionMonitor;

exports.create = function(options) {
  var monitor = ConnectionMonitor.create(options);
  return monitor;
};