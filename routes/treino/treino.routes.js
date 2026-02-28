const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const treinoController = require('../../controllers/treino/treino.controller')

// Listar treinos do próprio utilizador
router.get('/', authenticateJWT, treinoController.getUserTreinos)
// ...outras rotas de treino (criar, editar, apagar, admin)

module.exports = router
