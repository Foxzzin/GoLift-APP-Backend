const express = require('express')
const router = express.Router()
const { authenticateJWT } = require('../../middleware/auth.middleware')
const adminController = require('../../controllers/admin/admin.controller')
const { isAdmin } = require('../../middleware/permissions.middleware')
const { userUpdateValidation } = require('../../utils/validators')

// Exemplo: obter utilizadores (apenas admin)
router.get('/users', authenticateJWT, isAdmin, adminController.getUsers)
router.put('/users/:id', authenticateJWT, isAdmin, adminController.updateUser)
router.delete('/users/:id', authenticateJWT, isAdmin, adminController.deleteUser)

router.put('/users/:id', authenticateJWT, isAdmin, userUpdateValidation, adminController.updateUser)
// ...adicionar outras rotas admin

module.exports = router
