const db = require('../../config/db')

const getOwnProfile = (req, res) => {
  const userId = req.user.id
  db.query('SELECT id_users as id, userName, email, idade, peso, altura, id_tipoUser, created_at FROM users WHERE id_users = ?', [userId], (err, rows) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ erro: 'Erro ao obter perfil.' })
    }
    if (!rows.length) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' })
    }
    // Não expor password nem dados sensíveis
    res.json(rows[0])
  })
}

const updateOwnProfile = (req, res) => {
  const userId = req.user.id
  const { userName, email, idade, peso, altura } = req.body
  db.query('UPDATE users SET userName = ?, email = ?, idade = ?, peso = ?, altura = ? WHERE id_users = ?',
    [userName, email, idade, peso, altura, userId],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ erro: 'Erro ao atualizar perfil.' })
      }
      return res.json({ sucesso: true })
    })
}

module.exports = { getOwnProfile, updateOwnProfile }
