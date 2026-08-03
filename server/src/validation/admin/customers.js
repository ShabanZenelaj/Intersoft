const Joi = require("joi")
const { uuid, idParam, pagination } = require("../common")

const customerParams = idParam("customer id")

const list = {
  query: Joi.object({
    q: Joi.string().max(200).allow(""),
    ...pagination,
  }),
}

const get = { params: customerParams }

/** Sends the full set of groups the customer should be in, replacing the old. */
const setGroups = {
  params: customerParams,
  body: Joi.object({ group_ids: Joi.array().items(uuid).default([]) }),
}

module.exports = { list, get, setGroups }
