const db = require('../../config/db')

const getPlano = (req, res) => {
  const { userId } = req.params
  db.query('SELECT * FROM planos WHERE id_user = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter plano.' })
    res.json(rows)
  })
}

// ...outras funções de plano

module.exports = { getPlano }
