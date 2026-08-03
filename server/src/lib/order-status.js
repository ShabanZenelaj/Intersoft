/**
 * The order lifecycle, in one place because both the controllers and the
 * request schemas need it — the schemas to accept only real statuses, the
 * controllers to act on them.
 */

/** The states an order moves through, in order. */
const ORDER_FLOW = ["pending", "processing", "shipped", "delivered"]

/** Statuses that still have something coming to the customer. */
const ACTIVE_STATUSES = ["pending", "processing", "shipped"]

/** Every status an order can hold. */
const ALL_STATUSES = [...ORDER_FLOW, "canceled"]

module.exports = { ORDER_FLOW, ACTIVE_STATUSES, ALL_STATUSES }
