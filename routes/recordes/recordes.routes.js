const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const recordesController = require('../../controllers/recordes/recordes.controller')

// Listar recordes de um utilizador
router.get('/:userId', authenticateJWT, recordesController.getRecordes)
// ...outras rotas de recordes

module.exports = router
