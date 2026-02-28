const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const userController = require('../../controllers/user/user.controller')
const { userUpdateValidation } = require('../../utils/validators')

// Perfil do próprio utilizador
router.get('/profile', authenticateJWT, userController.getOwnProfile)
router.put('/profile', authenticateJWT, userUpdateValidation, userController.updateOwnProfile)

// ...outras rotas de utilizador

module.exports = router
