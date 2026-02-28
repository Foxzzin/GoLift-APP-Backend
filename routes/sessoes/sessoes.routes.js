const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const sessoesController = require('../../controllers/sessoes/sessoes.controller')

// Listar sessões de um utilizador
router.get('/:userId', authenticateJWT, sessoesController.getSessoes)
// ...outras rotas de sessões (detalhes, guardar, etc.)

module.exports = router
