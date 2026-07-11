'use strict';

// Short, distinct beep parameters for chat sound-effect events. Kept as pure
// data (no Web Audio calls here) so the mapping can be unit tested without a
// browser audio backend; app.js turns this into an oscillator + gain node.
const TONE_CONFIG = {
  send:    { frequency: 720, duration: 0.07, type: 'sine', gain: 0.05 },
  receive: { frequency: 480, duration: 0.09, type: 'sine', gain: 0.05 },
};

function getToneConfig(kind) {
  return TONE_CONFIG[kind] || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getToneConfig, TONE_CONFIG };
}
