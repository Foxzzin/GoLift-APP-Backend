// db.js
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "golift"
});

db.connect((err) => {
  if (err) {
    console.log("Erro ao ligar à BD:", err);
    return;
  }
  console.log("Ligado ao MySQL!");
});

module.exports = db;
