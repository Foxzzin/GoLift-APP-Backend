const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const { isAdmin } = require('../../middleware/permissions.middleware')
const comunidadeController = require('../../controllers/comunidade/comunidade.controller')

// Listar comunidades
router.get('/', authenticateJWT, comunidadeController.getAll)

// Editar comunidade (admin)
router.put('/:id', authenticateJWT, isAdmin, comunidadeController.update)

// ...outras rotas de comunidade (criar, aderir, sair)

module.exports = router
