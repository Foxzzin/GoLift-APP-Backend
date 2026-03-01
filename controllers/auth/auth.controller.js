const db = require('../../config/db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('[SECURITY] JWT_SECRET não definido no ambiente');

const login = async (req, res) => {
  const { email, password } = req.body
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro interno.' })
    if (!rows.length) return res.status(401).json({ erro: 'Credenciais inválidas.' })
    const user = rows[0]
    const passwordCorreta = await bcrypt.compare(password, user.password)
    if (!passwordCorreta) return res.status(401).json({ erro: 'Credenciais inválidas.' })
    const payload = { id: user.id_users, nome: user.userName, email: user.email, tipo: user.id_tipoUser }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
    res.json({ sucesso: true, token, user: payload })
  })
}

const register = async (req, res) => {
  const { nome, email, password, idade, peso, altura } = req.body
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro interno.' })
    if (rows.length) return res.status(400).json({ erro: 'Email já registado.' })
    const hash = await bcrypt.hash(password, 10)
    db.query('INSERT INTO users (userName, email, password, idade, peso, altura, id_tipoUser) VALUES (?, ?, ?, ?, ?, ?, 2)',
      [nome, email, hash, idade, peso, altura],
      (err, result) => {
        if (err) return res.status(500).json({ erro: 'Erro ao registar utilizador.' })
        res.json({ sucesso: true })
      })
  })
}

module.exports = { login, register }
