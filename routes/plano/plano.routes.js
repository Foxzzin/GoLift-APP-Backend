const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const planoController = require('../../controllers/plano/plano.controller')

// Obter plano de um utilizador
router.get('/:userId', authenticateJWT, planoController.getPlano)
// ...outras rotas de plano (criar, atualizar, etc.)

module.exports = router
