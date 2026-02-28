const os = require('os')

const health = (req, res) => {
  res.json({ status: 'ok' })
}

const serverInfo = (req, res) => {
  res.json({ hostname: os.hostname(), uptime: os.uptime() })
}

const dailyPhrase = (req, res) => {
  res.json({ phrase: 'Nunca pares de lutar pelos teus objetivos!' })
}

module.exports = { health, serverInfo, dailyPhrase }
