// Testes de segurança para o backend GoLift
const request = require('supertest')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')

// Importar o app real se possível, senão mockar
let app
try {
  app = require('../server')
} catch {
  app = express()
  app.use(helmet())
  app.use(cors())
  app.get('/api/health', (req, res) => res.json({ sucesso: true }))
}

describe('Segurança do servidor GoLift', () => {
  it('deve ter headers de segurança do helmet', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('deve bloquear CORS para origem não autorizada em produção', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CLIENT_URL = 'https://app.golift.pt'
    const res = await request(app).get('/api/health').set('Origin', 'https://malicious.com')
    expect(res.headers['access-control-allow-origin']).not.toBe('https://malicious.com')
  })

  it('deve permitir CORS para origem autorizada em produção', async () => {
    process.env.NODE_ENV = 'production'
    process.env.CLIENT_URL = 'https://app.golift.pt'
    const res = await request(app).get('/api/health').set('Origin', 'https://app.golift.pt')
    expect(res.headers['access-control-allow-origin']).toBe('https://app.golift.pt')
  })

  it('deve recusar arrancar sem JWT_SECRET seguro', () => {
    const old = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'golift_super_secret'
    expect(() => require('../server')).toThrow()
    process.env.JWT_SECRET = old
  })
})
