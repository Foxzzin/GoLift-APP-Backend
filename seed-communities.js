// Script para adicionar dados de teste nas comunidades
const db = require("./db");
const bcrypt = require("bcrypt");

const testData = {
  usuarios: [
    {
      id: 20,
      nome: "Admin Comunidades",
      email: "admin.com@test.com",
      password: "senha123",
      tipo: 1, // admin
    },
    {
      id: 21,
      nome: "User Comunidades",
      email: "user.com@test.com",
      password: "senha123",
      tipo: 2,
    },
  ],
  comunidades: [
    {
      nome: "Fitness Brasil",
      descricao: "Comunidade dedicada a fitness e treinos no Brasil",
      criador_id: 20,
      pais: "Brasil",
      linguas: "Português",
      private: 0,
      verificada: 1,
    },
    {
      nome: "Gym Portugal",
      descricao: "Academia e treino em Lisboa e Porto",
      criador_id: 21,
      pais: "Portugal",
      linguas: "Português",
      private: 0,
      verificada: 1,
    },
    {
      nome: "Saúde Angola",
      descricao: "Bem-estar e saúde em Angola",
      criador_id: 20,
      pais: "Angola",
      linguas: "Português",
      private: 0,
      verificada: 1,
    },
  ],
};

console.log("Adicionando dados de teste...\n");

// Primeiro, adicionar utilizadores se não existirem
let usersCreated = 0;

testData.usuarios.forEach((user) => {
  const checkSql = "SELECT id_users FROM users WHERE email = ?";
  db.query(checkSql, [user.email], (err, results) => {
    if (err) {
      console.error(`❌ Erro ao verificar ${user.email}:`, err.message);
      usersCreated++;
      if (usersCreated === testData.usuarios.length) addCommunities();
      return;
    }

    if (results.length > 0) {
      console.log(`ℹ️ Utilizador já existe: ${user.email}`);
      usersCreated++;
      if (usersCreated === testData.usuarios.length) addCommunities();
    } else {
      // Criar utilizador
      bcrypt.hash(user.password, 10, (err, hashedPassword) => {
        if (err) {
          console.error(`❌ Erro ao hash password:`, err.message);
          usersCreated++;
          if (usersCreated === testData.usuarios.length) addCommunities();
          return;
        }

        const insertSql = `
          INSERT INTO users (id_users, userName, email, password, id_tipoUser)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.query(insertSql, [user.id, user.nome, user.email, hashedPassword, user.tipo], (err) => {
          if (err) {
            console.error(`❌ Erro ao criar ${user.email}:`, err.message);
          } else {
            console.log(`✓ Utilizador criado: ${user.email}`);
          }
          usersCreated++;
          if (usersCreated === testData.usuarios.length) addCommunities();
        });
      });
    }
  });
});

// Depois, adicionar comunidades
function addCommunities() {
  console.log("\nAdicionando comunidades...");
  let addedCount = 0;

  testData.comunidades.forEach((community) => {
    const sql = `
      INSERT INTO comunidades (nome, descricao, criador_id, pais, linguas, privada, verificada)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        community.nome,
        community.descricao,
        community.criador_id,
        community.pais,
        community.linguas,
        community.private,
        community.verificada,
      ],
      (err, result) => {
        if (err && err.code !== 'ER_DUP_ENTRY') {
          console.error(`❌ Erro ao adicionar ${community.nome}:`, err.message);
        } else if (err && err.code === 'ER_DUP_ENTRY') {
          console.log(`ℹ️ ${community.nome} já existe`);
        } else if (result.affectedRows > 0) {
          console.log(`✓ Comunidade adicionada: ${community.nome} (ID: ${result.insertId})`);

          // Adicionar criador como membro automático
          const memberSql = `
            INSERT IGNORE INTO comunidade_membros (comunidade_id, user_id)
            VALUES (?, ?)
          `;
          db.query(memberSql, [result.insertId, community.criador_id], (err) => {
            if (err) console.error(`Erro ao marcar criador como membro:`, err);
          });
        }

        addedCount++;
        if (addedCount === testData.comunidades.length) {
          console.log("\n✓ Dados de teste adicionados com sucesso!");
          process.exit(0);
        }
      }
    );
  });
}
