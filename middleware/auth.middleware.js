const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'golift_super_secret'

function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token não fornecido' })
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Token inválido ou expirado' })
    }
    req.user = user
    next()
  })
}

module.exports = { authenticateJWT }
