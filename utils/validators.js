// Exemplo de validação de input (usar express-validator ou similar)
const { body, validationResult } = require('express-validator')

const userUpdateValidation = [
  body('userName').isString().isLength({ min: 3 }),
  body('email').isEmail(),
  body('idade').isInt({ min: 0 }),
  body('peso').isFloat({ min: 0 }),
  body('altura').isFloat({ min: 0 }),
  body('id_tipoUser').optional().isIn([1,2]),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ erro: 'Input inválido', detalhes: errors.array() })
    }
    next()
  }
]

const loginValidation = [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ erro: 'Input inválido', detalhes: errors.array() })
    }
    next()
  }
]

const registerValidation = [
  body('nome').isString().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('idade').isInt({ min: 0 }),
  body('peso').isFloat({ min: 0 }),
  body('altura').isFloat({ min: 0 }),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ erro: 'Input inválido', detalhes: errors.array() })
    }
    next()
  }
]

module.exports = { userUpdateValidation, loginValidation, registerValidation }
