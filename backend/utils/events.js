const EventEmitter = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

function emitRealtimeEvent(event, payload = {}) {
  emitter.emit('realtime', { event, payload, timestamp: Date.now() });
}

function subscribeRealtime(listener) {
  emitter.on('realtime', listener);
  return () => emitter.off('realtime', listener);
}

module.exports = {
  emitRealtimeEvent,
  subscribeRealtime,
};
