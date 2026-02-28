const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const comunidadeController = require('../../controllers/comunidade/comunidade.controller')

// Listar comunidades
router.get('/', authenticateJWT, comunidadeController.getAll)
// ...outras rotas de comunidade (criar, aderir, sair, admin)

module.exports = router
