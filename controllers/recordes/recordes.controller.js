const db = require('../../config/db')

const getRecordes = (req, res) => {
  const { userId } = req.params
  db.query('SELECT * FROM recordes WHERE id_user = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter recordes.' })
    res.json(rows)
  })
}

// ...outras funções de recordes

module.exports = { getRecordes }
