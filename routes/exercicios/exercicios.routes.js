const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const { isAdmin } = require('../../middleware/permissions.middleware')
const exerciciosController = require('../../controllers/exercicios/exercicios.controller')

// User: listar exercícios
router.get('/', authenticateJWT, exerciciosController.getAll)

// Admin: listar, criar, apagar exercícios
router.get('/admin', authenticateJWT, isAdmin, exerciciosController.getAllAdmin)
router.post('/admin', authenticateJWT, isAdmin, exerciciosController.createAdmin)
router.delete('/admin/:nome', authenticateJWT, isAdmin, exerciciosController.deleteAdmin)

module.exports = router
