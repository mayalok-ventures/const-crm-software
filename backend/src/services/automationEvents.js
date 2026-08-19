const EventEmitter = require('events');

class CRMEventEmitter extends EventEmitter {}

const crmEvents = new CRMEventEmitter();
// Allow plenty of concurrent event listeners without memory leak warnings
crmEvents.setMaxListeners(50);

const CRM_EVENTS = {
  LEAD_CREATED: 'lead.created',
  LEAD_STAGE_CHANGED: 'lead.stage_changed',
  LEAD_FIELD_UPDATED: 'lead.field_updated',
  PAYMENT_CHECKOUT_STARTED: 'lead.checkout_started',
  STALL_BLOCKED: 'lead.stall_blocked',
  EVENT_ONBOARDED: 'lead.event_onboarded',
};

/**
 * Safely emit a CRM event with error boundary
 */
function emitCRMEvent(eventName, payload) {
  try {
    setImmediate(() => {
      try {
        crmEvents.emit(eventName, payload);
      } catch (err) {
        console.error(`[CRM Events] Unhandled error during event '${eventName}':`, err.message);
      }
    });
  } catch (syncErr) {
    console.error(`[CRM Events] Failed to dispatch event '${eventName}':`, syncErr.message);
  }
}

module.exports = {
  crmEvents,
  CRM_EVENTS,
  emitCRMEvent,
};
