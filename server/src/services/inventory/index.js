/**
 * The Pro-Data integration, one concern per module:
 *
 *   catalog   mirror Pro-Data's catalog (the Inbox reads from it)
 *   importer  turn chosen items into enriched draft products
 *   pushes    send web orders to Pro-Data, and the "Needs linking" answers
 *   tracking  follow sent orders through Pro-Data (open / invoiced / canceled)
 *   stock     keep linked variants' stock in step with Pro-Data
 */
module.exports = {
  catalog: require("./catalog"),
  importer: require("./importer"),
  pushes: require("./pushes"),
  tracking: require("./tracking"),
  stock: require("./stock"),
}
