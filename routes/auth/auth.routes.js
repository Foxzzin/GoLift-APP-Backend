const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const authController = require('../../controllers/auth/auth.controller')
const { loginValidation, registerValidation } = require('../../utils/validators')

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: 'Demasiadas tentativas. Aguarda 15 minutos.' },
  keyGenerator: (req) => (req.body && req.body.email) ? req.body.email.toLowerCase() : req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', limiterLogin, loginValidation, authController.login)
router.post('/register', limiterLogin, registerValidation, authController.register)
// ...outras rotas de auth (ex: forgot/reset password)

module.exports = router
