const Joi = require("joi")

// The .xlsx arrives as multipart; the controller checks the buffer is there.
const importProducts = {}

const downloadTemplate = { query: Joi.object({}) }

module.exports = { importProducts, downloadTemplate }
