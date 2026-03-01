const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const userController = require('../../controllers/user/user.controller')
const { userUpdateValidation } = require('../../utils/validators')

// Perfil do próprio utilizador
router.get('/profile', authenticateJWT, userController.getOwnProfile)
router.put('/profile', authenticateJWT, userUpdateValidation, userController.updateOwnProfile)

// Perfil por userId (GET e PUT)
router.get('/profile/:userId', authenticateJWT, userController.getProfileById)
router.put('/profile/:userId', authenticateJWT, userController.updateProfileById)

// ...outras rotas de utilizador

module.exports = router
