const express = require("express")
const { customerAuth, customerOptional } = require("../../lib/auth")
const { controller } = require("../../lib/util")
const { validate } = require("../../lib/validate")

const cart = controller(require("../../controllers/store/cart"))
const schema = require("../../validation/store/cart")
const { cartLimiter, checkoutLimiter, promoCodeLimiter } = require("../../lib/rate-limits")

const router = express.Router()

// Carts belong to guests as much as to accounts: the id is an unguessable
// uuid, and a token only adds personal pricing and address memory on top.
//
// The three limiters below cover what an unauthenticated caller can make this
// API *do*: create rows, reserve stock and send mail, and guess promo codes.
router.post("/carts", cartLimiter, customerOptional, validate(schema.create), cart.create)
router.get("/carts/:id", validate(schema.get), cart.get)
router.post("/carts/:id/items", validate(schema.addItem), cart.addItem)
router.patch("/carts/:id/items/:itemId", validate(schema.updateItem), cart.updateItem)
router.delete("/carts/:id/items/:itemId", validate(schema.removeItem), cart.removeItem)
router.post("/carts/:id/promotions", promoCodeLimiter, validate(schema.applyPromotion), cart.applyPromotion)
router.delete("/carts/:id/promotions", validate(schema.removePromotion), cart.removePromotion)
router.post("/carts/:id/details", customerOptional, validate(schema.setDetails), cart.setDetails)
router.post("/carts/:id/payment", validate(schema.setPayment), cart.setPayment)
router.post("/carts/:id/complete", checkoutLimiter, customerOptional, validate(schema.complete), cart.complete)

/** Attaching a cart to an account is the one step that needs a real token. */
router.post("/carts/:id/customer", customerAuth, validate(schema.attachCustomer), cart.attachCustomer)

module.exports = router
