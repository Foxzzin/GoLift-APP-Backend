// db.js
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "golift",
  connectTimeout: 10000,
  enableKeepAlive: true
});

db.connect((err) => {
  if (err) {
    console.log("Erro ao ligar à BD:", err);
    return;
  }
  console.log("Ligado ao MySQL!");
});

// Re-conectar se a conexão foi perdida
db.on('error', function(err) {
  console.log('Erro na BD:', err.code);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    db.connect();
  }
  if(err.code === 'ER_CON_COUNT_ERROR') {
    db.connect();
  }
  if(err.code === 'ER_AUTH_PLUGIN_CANNOT_BE_LOADED') {
    db.connect();
  }
});

module.exports = db;
