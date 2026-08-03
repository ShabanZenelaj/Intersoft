/**
 * Request validation.
 *
 * Every endpoint declares the shape it accepts next to its route, and this
 * middleware enforces it before the controller runs. Controllers therefore
 * receive input that is already the right type and can get on with the work.
 *
 * What belongs here: shape, type, format, required-ness, ranges, enums —
 * anything answerable from the request alone.
 * What does not: rules that need the database ("order not found", "refund
 * exceeds the remaining total", "email already in use"). Those stay in the
 * controllers, where the data is.
 */

const OPTIONS = {
  // HTML forms and query strings send everything as text, so "12" must become
  // 12 and "true" must become true before a controller sees it.
  convert: true,
  // Report only the first problem: the admin panel and storefront both show a
  // single message, and one clear sentence beats a list.
  abortEarly: true,
  // Unknown keys are dropped rather than rejected. Clients may send extra
  // fields (a whole record echoed back on save); nothing undeclared reaches
  // the database, which also rules out mass assignment.
  stripUnknown: true,
}

/** Joi wraps labels in quotes ("email" must be...); read better without them. */
const readableMessage = (error) => error.details?.[0]?.message.replace(/"/g, "") || "Invalid request."

/**
 * @param {{ body?: Joi.Schema, query?: Joi.Schema, params?: Joi.Schema }} schemas
 */
const validate = (schemas) => (req, _res, next) => {
  for (const source of ["params", "query", "body"]) {
    const schema = schemas[source]
    if (!schema) continue

    // A body is optional on the wire; validate {} so "required" still bites.
    const value = source === "body" ? req.body ?? {} : req[source]
    const result = schema.validate(value, OPTIONS)

    if (result.error) {
      const error = new Error(readableMessage(result.error))
      error.status = 400
      return next(error)
    }
    req[source] = result.value
  }
  return next()
}

module.exports = { validate }
