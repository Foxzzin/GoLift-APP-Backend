function isAdmin(req, res, next) {
  if (!req.user || req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' })
  }
  next()
}

module.exports = { isAdmin }
