/**
 * "New event in Strata" — a REST hook trigger.
 *
 * Enable → POST /webhooks with the catch-hook URL; disable → DELETE /webhooks/{id}.
 * The delivery engine then POSTs every subscribed event, signed with HMAC-SHA256
 * and carrying a stable `x-webhook-id`, so Zapier receives each event once for
 * each real occurrence.
 */
const LABEL = 'Zapier';

/** Subscribe: register Zapier's catch URL as an outbound endpoint. */
const subscribeHook = async (z, bundle) => {
  const events = Array.isArray(bundle.inputData.events)
    ? bundle.inputData.events.filter(Boolean)
    : [];

  const response = await z.request({
    url: `${bundle.authData.baseUrl.replace(/\/$/, '')}/webhooks`,
    method: 'POST',
    body: {
      url: bundle.targetUrl,
      events,
      label: LABEL,
      appId: 'zapier',
    },
  });

  const data = response.json.data;
  return { id: data.id, secret: data.secret, events: data.events };
};

/** Unsubscribe: remove the endpoint so disabling a Zap stops the deliveries. */
const unsubscribeHook = async (z, bundle) => {
  const hookId = bundle.subscribeData.id;
  await z.request({
    url: `${bundle.authData.baseUrl.replace(/\/$/, '')}/webhooks/${hookId}`,
    method: 'DELETE',
  });
  return {};
};

/**
 * Live deliveries arrive as the signed envelope Strata sends
 * (`{ event, organizationId, deliveryId, occurredAt, data }`). Zapier needs an
 * `id` to deduplicate a redelivery, so the delivery id is mapped onto it.
 */
const getEvent = (z, bundle) => {
  const payload = bundle.cleanedRequest;
  return [{ ...payload, id: payload.deliveryId, ...(payload.data || {}) }];
};

/**
 * Sample data for the Zap editor. A hook cannot be replayed on demand, so the
 * trigger falls back to the read API (`GET /leaves`) to show believable fields
 * while the user maps them.
 */
const performList = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.baseUrl.replace(/\/$/, '')}/leaves?limit=3`,
    method: 'GET',
  });
  return (response.json.data || []).map((leave) => ({
    id: leave._id || leave.id,
    event: 'leave.requested',
    ...leave,
  }));
};

module.exports = {
  key: 'new_event',
  noun: 'Event',

  display: {
    label: 'New Event in Strata',
    description:
      'Triggers when something happens in Strata — a leave request, a new employee, an expense, an attendance clock-in.',
  },

  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: getEvent,
    performList,
    sample: {
      id: 'jd7f0s9kd8fhs',
      event: 'leave.requested',
      organizationId: 'org_123',
      deliveryId: 'jd7f0s9kd8fhs',
      occurredAt: 1767225600000,
      employeeName: 'Anna Hakobyan',
      leaveType: 'vacation',
      days: 3,
    },
    inputFields: [
      {
        key: 'events',
        label: 'Event types',
        list: true,
        required: false,
        helpText:
          'Leave empty to receive every event type. Available: leave.requested, leave.approved, leave.rejected, leave.cancelled, employee.created, employee.updated, employee.deactivated, attendance.clock_in, attendance.clock_out, task.created, task.completed, expense.submitted, expense.approved, expense.rejected, document.signed.',
      },
    ],
    outputFields: [
      { key: 'id', label: 'Delivery id' },
      { key: 'event', label: 'Event type' },
      { key: 'occurredAt', label: 'Occurred at' },
      { key: 'organizationId', label: 'Organization id' },
    ],
  },
};
