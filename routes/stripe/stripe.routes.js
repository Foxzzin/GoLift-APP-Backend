const express = require('express')
const router = express.Router()
const stripeController = require('../../controllers/stripe/stripe.controller')

// Webhook Stripe
router.post('/webhook', stripeController.webhook)
// Checkout session
router.post('/checkout-session', stripeController.checkoutSession)
// Portal de pagamentos
router.post('/portal', stripeController.portal)

module.exports = router
