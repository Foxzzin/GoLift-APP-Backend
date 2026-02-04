#!/usr/bin/env node

const http = require('http');

console.log('\n========== SERVIDOR DE TESTE ==========\n');

const server = http.createServer((req, res) => {
  console.log(`📍 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/api/comunidades') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  } else if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sucesso: true, mensagem: "Servidor online" }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ erro: "Rota não encontrada" }));
  }
});

server.on('error', (err) => {
  console.error('❌ ERRO DO SERVIDOR:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`   A porta 5000 já está em uso!`);
  }
  process.exit(1);
});

const PORT = 5000;
server.listen(PORT, 'localhost', () => {
  console.log(`✅ Servidor de teste a escutar em porta ${PORT}`);
  console.log(`   - GET /api/comunidades -> []`);
  console.log(`   - GET /api/health -> { sucesso: true, mensagem: "Servidor online" }`);
  console.log(`\n💡 Teste com: curl http://localhost:5000/api/comunidades\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Servidor a encerrar...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
});
