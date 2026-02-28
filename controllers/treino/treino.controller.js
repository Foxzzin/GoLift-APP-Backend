const db = require('../../config/db')

const getUserTreinos = (req, res) => {
  const userId = req.user.id
  db.query('SELECT * FROM treinos WHERE id_user = ?', [userId], (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: 'Erro ao obter treinos.' })
    }
    res.json(rows)
  })
}

// ...outras funções de treino (criar, editar, apagar, admin)

module.exports = { getUserTreinos }
