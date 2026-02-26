/**
 * seed-sessoes-semana.js
 * Insere sessões de treino na semana 16/02/2026 - 22/02/2026
 * para testar o relatório semanal.
 *
 * Uso: node seed-sessoes-semana.js
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "golift",
  });

  console.log("✓ Ligado à base de dados");

  // Buscar utilizadores existentes
  const [users] = await db.query("SELECT id_users, userName FROM users LIMIT 5");
  if (users.length === 0) {
    console.error("Nenhum utilizador encontrado.");
    await db.end();
    return;
  }
  console.log(`✓ Utilizadores encontrados: ${users.map(u => `${u.id_users}(${u.userName})`).join(", ")}`);

  // Usar o primeiro utilizador
  const user = users[0];
  const userId = user.id_users;

  // Buscar treinos do utilizador
  const [treinos] = await db.query(
    "SELECT id_treino, nome FROM treino WHERE id_users = ? LIMIT 5",
    [userId]
  );

  if (treinos.length === 0) {
    console.error(`Nenhum treino encontrado para o utilizador ${userId}.`);
    await db.end();
    return;
  }
  console.log(`✓ Treinos encontrados: ${treinos.map(t => `${t.id_treino}(${t.nome})`).join(", ")}`);

  // Buscar exercícios existentes
  const [exercicios] = await db.query(
    "SELECT id_exercicio, nome FROM exercicios LIMIT 10"
  );
  if (exercicios.length === 0) {
    console.error("Nenhum exercício encontrado.");
    await db.end();
    return;
  }

  // Sessões a inserir: dias da semana 16/02 - 22/02/2026
  const sessoesDados = [
    { data: "2026-02-16 08:30:00", duracao: 3600, treinoIdx: 0 }, // Segunda
    { data: "2026-02-17 19:00:00", duracao: 2700, treinoIdx: 1 % treinos.length }, // Terça
    { data: "2026-02-19 07:45:00", duracao: 4200, treinoIdx: 0 }, // Quinta
    { data: "2026-02-21 10:00:00", duracao: 3000, treinoIdx: 2 % treinos.length }, // Sábado
    { data: "2026-02-22 09:15:00", duracao: 2400, treinoIdx: 1 % treinos.length }, // Domingo
  ];

  for (const s of sessoesDados) {
    const treino = treinos[s.treinoIdx];

    // Inserir sessão
    const [result] = await db.query(
      "INSERT INTO treino_sessao (id_treino, id_users, data_fim, duracao_segundos) VALUES (?, ?, ?, ?)",
      [treino.id_treino, userId, s.data, s.duracao]
    );
    const sessaoId = result.insertId;

    // Inserir 3-4 séries com exercícios aleatórios
    const numExercicios = 3 + (sessaoId % 2); // 3 ou 4
    for (let i = 0; i < numExercicios; i++) {
      const ex = exercicios[i % exercicios.length];
      for (let serie = 1; serie <= 3; serie++) {
        await db.query(
          "INSERT INTO treino_serie (id_sessao, id_exercicio, numero_serie, repeticoes, peso) VALUES (?, ?, ?, ?, ?)",
          [sessaoId, ex.id_exercicio, serie, 8 + (serie * 2), 20 + (i * 5)]
        );
      }
    }

    console.log(`✓ Sessão inserida: ${s.data} | treino "${treino.nome}" | id_sessao=${sessaoId}`);
  }

  console.log("\n✅ Sessões da semana 16-22/02/2026 inseridas com sucesso!");
  await db.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
