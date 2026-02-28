const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const aiController = require('../../controllers/ai/ai.controller')
const rateLimit = require('express-rate-limit')

// Limite de pedidos à IA
const limiterAI = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Limite de pedidos à IA atingido. Tenta de novo em 1 hora.' },
})

router.get('/report/:userId', limiterAI, aiController.getReport)
router.get('/plan/:userId', limiterAI, aiController.getPlan)
router.post('/plan/:userId/generate', limiterAI, authenticateJWT, aiController.generatePlan)
router.post('/plan/:userId/import-day', authenticateJWT, aiController.importDay)

module.exports = router
