const db = require('../../config/db')

const getAll = (req, res) => {
  db.query('SELECT * FROM comunidades', (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: 'Erro ao obter comunidades.' })
    }
    res.json(rows)
  })
}

// ...outras funções de comunidade (criar, aderir, sair, admin)

module.exports = { getAll }
