const { pageParams } = require("../../lib/util")
const { listProducts } = require("../../services/catalog")
const campaignService = require("../../services/campaigns")
const { getCustomerGroupIds } = require("../../lib/pricing")

/**
 * Campaigns the shopper may see. A campaign limited to a customer group is
 * hidden from everyone else — no banner, and its page 404s.
 */
const list = async (req, res) => {
  const groupIds = await getCustomerGroupIds(req.customer?.id || null)
  const campaigns = await campaignService.visibleCampaigns({
    groupIds,
    // Already a real boolean: the schema converts ?banners=true.
    onlyHomeBanners: Boolean(req.query.banners),
  })
  if (req.customer) res.setHeader("Cache-Control", "private, no-store")
  res.json({ campaigns: campaigns.map(campaignService.toPublicJson) })
}

/** The campaign's own catalogue: the products it covers. */
const get = async (req, res) => {
  const groupIds = await getCustomerGroupIds(req.customer?.id || null)
  const campaign = await campaignService.findVisibleCampaign(req.params.handle, { groupIds })
  if (!campaign) return res.status(404).json({ message: "Campaign not found." })

  const scope = await campaignService.campaignScope(campaign)
  const { limit, offset } = pageParams(req, 60, 200)
  const { products, count } = await listProducts({
    customerId: req.customer?.id || null,
    productIds: scope.productIds,
    categoryIds: scope.categoryIds,
    limit,
    offset,
    order: req.query.order,
  })

  if (req.customer) res.setHeader("Cache-Control", "private, no-store")
  res.json({ campaign: campaignService.toPublicJson(campaign), products, count })
}

module.exports = { list, get }
