const Joi = require("joi")
const { idParam } = require("../common")

/**
 * The webhook body is deliberately permissive: it comes from RaiAccept, its
 * shape is theirs to change, and nothing in it is trusted anyway — the handler
 * re-checks the outcome against their API. Only the two identifiers the
 * handler actually reads are described.
 */
// Every block is nullable. A declined payment arrives with `card: null`
// because no card was charged, and rejecting that would 400 the notification —
// leaving the order stuck as pending with its stock held while RaiAccept
// retries three times and gives up.
const optionalObject = Joi.object().unknown(true).allow(null)

const webhook = {
  body: Joi.object({
    transaction: optionalObject,
    merchant: optionalObject,
    order: Joi.object({
      orderIdentification: Joi.string().max(200).allow(null, ""),
      invoice: Joi.object({ merchantOrderReference: Joi.string().max(200).allow(null, "") })
        .unknown(true)
        .allow(null),
    })
      .unknown(true)
      .allow(null),
    card: optionalObject,
    callbackUrls: optionalObject,
  }).unknown(true),
}

const status = { params: idParam("order id") }

module.exports = { webhook, status }
