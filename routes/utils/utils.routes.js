const express = require('express')
const router = express.Router()
const utilsController = require('../../controllers/utils/utils.controller')

// Health check
router.get('/health', utilsController.health)
// Server info
router.get('/server-info', utilsController.serverInfo)
// Daily phrase
router.get('/daily-phrase', utilsController.dailyPhrase)

module.exports = router
