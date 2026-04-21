import EventEmitter from 'events';

/**
 * Internal event bus for approval flow.
 * Server emits `approval:${leadId}` when dashboard sends approve/skip/rewrite.
 * waitForDashboardApproval() listens on this bus.
 */
const bus = new EventEmitter();
bus.setMaxListeners(100); // Prevent spurious "MaxListeners exceeded" warnings

export const approvalBus = bus;
