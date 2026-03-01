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

const getProfileById = (req, res) => {
  const { userId } = req.params

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ success: false, erro: 'userId inválido.' })
  }

  db.query(
    'SELECT id_users AS id, userName AS name, email, idade AS age, peso AS weight, altura AS height, id_tipoUser, created_at FROM users WHERE id_users = ?',
    [userId],
    (err, rows) => {
      if (err) {
        console.error('[user.getProfileById]', err)
        return res.status(500).json({ success: false, erro: 'Erro ao obter perfil.' })
      }
      if (!rows.length) {
        return res.status(404).json({ success: false, erro: 'Utilizador não encontrado.' })
      }
      res.json({ success: true, user: rows[0] })
    }
  )
}

const updateProfileById = (req, res) => {
  const { userId } = req.params
  const { nome, idade, peso, altura } = req.body

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ success: false, erro: 'userId inválido.' })
  }

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return res.status(400).json({ success: false, erro: 'Nome é obrigatório e deve ter pelo menos 2 caracteres.' })
  }

  db.query(
    'UPDATE users SET userName = ?, idade = ?, peso = ?, altura = ? WHERE id_users = ?',
    [nome.trim(), idade != null ? idade : null, peso != null ? peso : null, altura != null ? altura : null, userId],
    (err, result) => {
      if (err) {
        console.error('[user.updateProfileById]', err)
        return res.status(500).json({ success: false, erro: 'Erro ao atualizar perfil.' })
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, erro: 'Utilizador não encontrado.' })
      }
      res.json({ success: true, mensagem: 'Perfil atualizado com sucesso.' })
    }
  )
}

module.exports = { getOwnProfile, updateOwnProfile, getProfileById, updateProfileById }
