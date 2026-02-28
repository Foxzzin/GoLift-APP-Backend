const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '')
const db = require('../../config/db')

const webhook = async (req, res) => {
  // ...mover lógica do webhook do server.js
  res.json({ received: true })
}

const checkoutSession = async (req, res) => {
  // ...mover lógica do checkout session do server.js
  res.json({})
}

const portal = async (req, res) => {
  // ...mover lógica do portal do server.js
  res.json({})
}

module.exports = { webhook, checkoutSession, portal }
