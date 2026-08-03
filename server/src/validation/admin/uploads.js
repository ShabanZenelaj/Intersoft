const Joi = require("joi")

// The files themselves arrive as multipart: multer caps size and count, and
// the controller sniffs the magic bytes before anything is written to disk.
const create = {}

const remove = {
  body: Joi.object({
    url: Joi.string().max(2000).required().messages({
      "string.empty": "url is required.",
      "any.required": "url is required.",
    }),
  }),
}

module.exports = { create, remove }
