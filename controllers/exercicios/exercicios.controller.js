const db = require('../../config/db')

const getAll = (req, res) => {
  db.query('SELECT * FROM exercicios', (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter exercícios.' })
    res.json(rows)
  })
}

const getAllAdmin = (req, res) => {
  db.query('SELECT * FROM exercicios', (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro ao obter exercícios.' })
    res.json(rows)
  })
}

const createAdmin = (req, res) => {
  const { nome, musculo, tipo } = req.body
  db.query('INSERT INTO exercicios (nome, musculo, tipo) VALUES (?, ?, ?)', [nome, musculo, tipo], (err, result) => {
    if (err) return res.status(500).json({ erro: 'Erro ao criar exercício.' })
    res.json({ sucesso: true })
  })
}

const deleteAdmin = (req, res) => {
  const { nome } = req.params
  db.query('DELETE FROM exercicios WHERE nome = ?', [nome], (err, result) => {
    if (err) return res.status(500).json({ erro: 'Erro ao apagar exercício.' })
    res.json({ sucesso: true })
  })
}

module.exports = { getAll, getAllAdmin, createAdmin, deleteAdmin }
