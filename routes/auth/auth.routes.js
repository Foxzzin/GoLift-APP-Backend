const express = require('express')
const router = express.Router()
const authController = require('../../controllers/auth/auth.controller')
const { loginValidation, registerValidation } = require('../../utils/validators')

router.post('/login', loginValidation, authController.login)
router.post('/register', registerValidation, authController.register)
// ...outras rotas de auth (ex: forgot/reset password)

module.exports = router
