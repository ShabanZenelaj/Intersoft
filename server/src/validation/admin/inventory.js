const Joi = require("joi")
const { uuid, idParam, pagination, flag } = require("../common")

const JOB_NAMES = ["catalog", "import", "push", "tracking", "stock"]
const TABS = ["new", "ignored", "imported", "removed", "linkable", "all"]

const itemIds = Joi.array().items(uuid).min(1).max(500).required().messages({
  "array.min": "Choose at least one item.",
  "array.max": "Choose at most 500 items at a time.",
  "any.required": "Choose at least one item.",
})

const itemId = uuid.required().messages({
  "any.required": "Choose an item from Pro-Data.",
  "string.guid": "Choose an item from Pro-Data.",
})

const status = {}
const testConnection = {}

const runJob = {
  params: Joi.object({ job: Joi.string().valid(...JOB_NAMES).required() }),
  body: Joi.object({ accept_removals: flag }),
}

const updateSettings = {
  body: Joi.object({
    // null = count every warehouse.
    warehouses: Joi.array().items(Joi.string().trim().max(200)).max(200).allow(null),
    discount_mode: Joi.string().valid("percent", "amount"),
    jobs: Joi.object(Object.fromEntries(JOB_NAMES.map((name) => [name, flag]))),
  }).min(1),
}

const warehouses = {}
const classifications = {}

const categoryMap = {
  body: Joi.object({
    mappings: Joi.array()
      .items(
        Joi.object({
          category: Joi.string().allow("").max(300).required(),
          sub_category: Joi.string().allow("").max(300).default(""),
          // null removes the mapping.
          category_id: uuid.allow(null, "").required(),
        })
      )
      .max(2000)
      .required(),
  }),
}

const listItems = {
  query: Joi.object({
    tab: Joi.string().valid(...TABS).default("new"),
    q: Joi.string().trim().max(200).allow(""),
    category: Joi.string().max(300).allow(""),
    sub_category: Joi.string().max(300).allow(""),
    has_images: flag,
    ...pagination,
  }),
}

const getItem = { params: idParam("item id") }
const importItems = { body: Joi.object({ ids: itemIds }) }
const ignoreItems = { body: Joi.object({ ids: itemIds, ignored: flag.default(true) }) }

const listLinks = { query: Joi.object({ ...pagination }) }

const resolveLink = {
  params: idParam("line id"),
  body: Joi.object({
    action: Joi.string().valid("link", "one_off", "dismiss", "never").required().messages({
      "any.required": "Choose what to do with this line.",
    }),
    inventory_item_id: Joi.when("action", {
      is: Joi.string().valid("link", "one_off").required(),
      then: itemId,
      otherwise: Joi.any().strip(),
    }),
  }),
}

const linkVariant = {
  params: idParam("variant id"),
  // null unlinks.
  body: Joi.object({ inventory_item_id: uuid.allow(null).required() }),
}

const updateVariant = {
  params: idParam("variant id"),
  body: Joi.object({ inventory_sync: flag.required() }),
}

const getOrder = { params: idParam("order id") }
const sendOrder = { params: idParam("order id") }

const resolveOrder = {
  params: idParam("order id"),
  body: Joi.object({
    action: Joi.string().valid("arrived", "send_again", "void_done").required(),
    pro_data_order_id: Joi.when("action", {
      is: Joi.string().valid("arrived").required(),
      then: Joi.string().trim().max(100).required().messages({
        "any.required": "Enter the order number Pro-Data shows.",
        "string.empty": "Enter the order number Pro-Data shows.",
      }),
      otherwise: Joi.any().strip(),
    }),
  }),
}

const getProduct = { params: idParam("product id") }

module.exports = {
  status,
  testConnection,
  runJob,
  updateSettings,
  warehouses,
  classifications,
  categoryMap,
  listItems,
  getItem,
  importItems,
  ignoreItems,
  listLinks,
  resolveLink,
  linkVariant,
  updateVariant,
  getOrder,
  sendOrder,
  resolveOrder,
  getProduct,
  JOB_NAMES,
}
