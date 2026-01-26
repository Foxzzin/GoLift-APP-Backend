// db.js
const mysql = require("mysql2");

const db = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "golift",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("Erro ao ligar à BD:", err);
    return;
  }
  console.log("Ligado ao MySQL!");
  connection.release();
});

module.exports = db;
