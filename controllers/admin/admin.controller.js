const db = require('../../config/db')

const getUsers = (req, res) => {
  db.query('SELECT id_users as id, userName, email, idade, peso, altura, id_tipoUser, created_at FROM users ORDER BY id_users DESC', (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: 'Erro ao obter os utilizadores.' })
    }
    res.json(rows)
  })
}

const updateUser = (req, res) => {
  const { id } = req.params
  const { userName, email, idade, peso, altura, id_tipoUser } = req.body
  db.query('UPDATE users SET userName = ?, email = ?, idade = ?, peso = ?, altura = ?, id_tipoUser = ? WHERE id_users = ?',
    [userName, email, idade, peso, altura, id_tipoUser, id],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: 'Erro ao atualizar utilizador.' })
      }
      return res.json({ sucesso: true })
    })
}

const deleteUser = (req, res) => {
  const { id } = req.params
  db.query('DELETE FROM users WHERE id_users = ?', [id], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: 'Erro ao apagar utilizador.' })
    }
    return res.json({ sucesso: true })
  })
}

module.exports = { getUsers, updateUser, deleteUser }
