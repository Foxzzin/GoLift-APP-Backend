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

const update = (req, res) => {
  const { id } = req.params
  const { nome, descricao } = req.body

  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, erro: 'ID de comunidade inválido.' })
  }

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return res.status(400).json({ success: false, erro: 'Nome é obrigatório e deve ter pelo menos 2 caracteres.' })
  }

  db.query(
    'UPDATE comunidades SET nome = ?, descricao = ? WHERE id = ?',
    [nome.trim(), descricao != null ? descricao : null, id],
    (err, result) => {
      if (err) {
        console.error('[comunidade.update]', err)
        return res.status(500).json({ success: false, erro: 'Erro ao atualizar comunidade.' })
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, erro: 'Comunidade não encontrada.' })
      }
      res.json({ success: true, mensagem: 'Comunidade atualizada com sucesso.' })
    }
  )
}

module.exports = { getAll, update }
