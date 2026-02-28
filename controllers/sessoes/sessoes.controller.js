const db = require('../../config/db')

const getSessoes = (req, res) => {
  const { userId } = req.params
  db.query('SELECT * FROM sessoes WHERE id_user = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter sessões.' })
    res.json(rows)
  })
}

// ...outras funções de sessões

module.exports = { getSessoes }
