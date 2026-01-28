  // server.js
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");


const app = express();
app.use(cors());
app.use(express.json());


// Rota de teste
app.get("/api/teste", (req, res) => {
  db.query("SELECT * FROM tipo_user", (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }

    res.json({ sucesso: true, resultado: rows[0].resultado });
  });
});

//Rota para obter todos os users
app.get("/api/getUsers", (req, res) => {
  const sql = "SELECT * FROM users";
  db.query(sql, (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter os utilizadores." });
    }
    res.json(rows);
  });
});

// Rota de Tipo de user
app.get("/api/getTipoUser", (req, res) => {
  const sql = "SELECT * FROM tipo_user";

  db.query(sql, (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter os tipos de utilizador." });
    }

    res.json(rows);
  });
});


//Rota de Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Mail: " + req.body.email)
  console.log("Password: " + req.body.password)

  if (!email || !password) {
    return res.status(400).json({ erro: "Email e password são obrigatórios." });
  }

  const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

  db.query(sql, [email], async (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }

    if (rows.length === 0) {
      return res.status(401).json({ erro: "Credenciais inválidas1." });
    }

    const user = rows[0];

    // Verificar password encriptada
    const passwordCorreta = await bcrypt.compare(password, user.password);

    if (!passwordCorreta) {
      return res.status(401).json({ erro: "Credenciais inválidas2." });
    }


    console.log("[LOGIN] user row from DB:", user);
    console.log("[LOGIN] user.id_tipoUser:", user.id_tipoUser);


    // Login correcto
    res.json({
      sucesso: true,
      id: user.id_users,
      nome: user.userName,
      email: user.email,
      tipo: user.id_tipoUser
    });


    //console.log("User da BD:", user);

  });
});




// Rota de registo
app.post("/api/register", async (req, res) => {
  const { nome, email, password, idade, peso, altura } = req.body;

  if (!nome || !email || !password || !idade || !peso || !altura) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }

  // Verifica email duplicado
  const checkSql = "SELECT * FROM users WHERE email = ? LIMIT 1";
  db.query(checkSql, [email], async (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados." });
    if (rows.length > 0) return res.status(409).json({ erro: "Email já registado." });

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertSql = "INSERT INTO users (userName, email, password, idade, peso, altura, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
    db.query(insertSql, [nome, email, hashedPassword, idade, peso, altura], (err, result) => {
      if (err) return res.status(500).json({ erro: "Erro ao criar utilizador." });

      res.json({ sucesso: true, mensagem: "Utilizador registado com sucesso!", id: result.insertId });
    });
  });
});


// server.js - ADICIONA ESTAS ROTAS AO TEU SERVIDOR

// Rota para obter dados do perfil do utilizador
app.get("/api/profile/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      u.id_users as id,
      u.userName as name,
      u.email,
      u.idade as age,
      u.peso as weight,
      u.altura as height,
      u.created_at as createdAt
    FROM users u
    WHERE u.id_users = ? 
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    console.log("[API] /api/profile params:", { userId });
    if (err) {
      console.error("[API] /api/profile SQL error:", err);
      return res.status(500).json({ erro: "Erro ao obter perfil." });
    }

    console.log("[API] /api/profile rows:", rows);
    if (!rows || rows.length === 0) {
      console.warn("[API] /api/profile - utilizador não encontrado for id:", userId);
      return res.status(404).json({ erro: "Utilizador não encontrado." });
    }

    return res.json({ sucesso: true, user: rows[0] });
  });
});

// Rota para obter o último treino do utilizador
app.get("/api/lastWorkout/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      t.id_treino,
      'Treino' as name,
      t.data_treino as date,
      COUNT(te.id_exercicio) as exercises
    FROM treino t
    LEFT JOIN treino_exercicio te ON t.id_treino = te.id_treino
    WHERE t.id_users = ?
    GROUP BY t.id_treino, t.data_treino
    ORDER BY t.data_treino DESC 
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter último treino." });
    }

    if (rows.length === 0) {
      return res.json({ sucesso: true, lastWorkout: null });
    }

    res.json({ sucesso: true, lastWorkout: rows[0] });
  });
});

// Rota para obter recordes pessoais do utilizador (Top 3 exercícios com mais peso)
app.get("/api/records/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      e.nome as exercise,
      MAX(e.recorde_pessoal) as weight,
      'N/A' as reps
    FROM exercicios e
    INNER JOIN treino_exercicio te ON e.id_exercicio = te.id_exercicio
    INNER JOIN treino t ON te.id_treino = t.id_treino
    WHERE t.id_users = ? AND e.recorde_pessoal IS NOT NULL
    GROUP BY e.id_exercicio, e.nome
    ORDER BY weight DESC 
    LIMIT 3
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter recordes." });
    }

    res.json({ sucesso: true, records: rows });
  });
});


// ---------- Admin API routes ----------

// Get basic stats for admin dashboard
app.get("/api/admin/stats", (req, res) => {
  const stats = {};

  db.query("SELECT COUNT(*) as totalUsers FROM users", (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro ao obter total de utilizadores." });
    stats.totalUsers = rows[0].totalUsers || 0;

    db.query("SELECT COUNT(*) as totalTreinos FROM treino", (err2, rows2) => {
      if (err2) return res.status(500).json({ erro: "Erro ao obter total de treinos." });
      stats.totalTreinos = rows2[0].totalTreinos || 0;

      db.query("SELECT COUNT(*) as totalExercises FROM exercicios", (err3, rows3) => {
        if (err3) return res.status(500).json({ erro: "Erro ao obter total de exercícios." });
        stats.totalExercises = rows3[0].totalExercises || 0;

        db.query("SELECT COUNT(*) as totalAdmins FROM users WHERE id_tipoUser = 1", (err4, rows4) => {
          if (err4) return res.status(500).json({ erro: "Erro ao obter total de admins." });
          stats.totalAdmins = rows4[0].totalAdmins || 0;

          return res.json(stats);
        });
      });
    });
  });
});

// Get list of users for admin
app.get("/api/admin/users", (req, res) => {
  // Return full user info (excluding password) for admin UI, including created_at
  const sql = `SELECT id_users as id, userName, email, idade, peso, altura, id_tipoUser, created_at FROM users ORDER BY id_users DESC`;
  db.query(sql, (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter os utilizadores." });
    }
    res.json(rows);
  });
});

// Update user (admin)
app.put("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  const { userName, email, idade, peso, altura, id_tipoUser } = req.body;

  const sql = `UPDATE users SET userName = ?, email = ?, idade = ?, peso = ?, altura = ?, id_tipoUser = ? WHERE id_users = ?`;
  db.query(sql, [userName, email, idade, peso, altura, id_tipoUser, id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao atualizar utilizador." });
    }
    return res.json({ sucesso: true });
  });
});

// Delete user (admin)
app.delete("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM users WHERE id_users = ?", [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao apagar utilizador." });
    }
    return res.json({ sucesso: true });
  });
});

// Get exercises (admin)
app.get("/api/admin/exercicios", (req, res) => {
  const sql = "SELECT id_exercicio as id, nome, descricao, video, recorde_pessoal as recorde_pessoal, grupo_tipo, sub_tipo FROM exercicios ORDER BY nome ASC";
  db.query(sql, (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao obter exercícios." });
    }
    res.json(rows);
  });
});

// Add new exercise (admin)
app.post("/api/admin/exercicios", (req, res) => {
  const { nome, descricao, video, recorde_pessoal, grupo_tipo, sub_tipo } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome do exercício é obrigatório." });

  // Prevent duplicates by name
  db.query("SELECT * FROM exercicios WHERE nome = ? LIMIT 1", [nome], (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados." });
    if (rows.length > 0) return res.status(409).json({ erro: "Exercício já existe." });

    const insertSql = `INSERT INTO exercicios (nome, descricao, video, recorde_pessoal, grupo_tipo, sub_type, sub_tipo) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    // Note: some schemas may use different column names; try to insert into sub_tipo
    db.query("INSERT INTO exercicios (nome, descricao, video, recorde_pessoal, grupo_tipo, sub_tipo) VALUES (?, ?, ?, ?, ?, ?)", [nome, descricao || null, video || null, recorde_pessoal || null, grupo_tipo || null, sub_tipo || null], (err2, result) => {
      if (err2) {
        console.log(err2);
        return res.status(500).json({ erro: "Erro ao adicionar exercício." });
      }
      res.json({ sucesso: true, id: result.insertId, nome });
    });
  });
});

// Delete exercise (admin) by name
app.delete("/api/admin/exercicios/:nome", (req, res) => {
  const { nome } = req.params;
  db.query("DELETE FROM exercicios WHERE nome = ?", [nome], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro ao apagar exercício." });
    }
    return res.json({ sucesso: true });
  });
});

// ---------- User API routes for workouts ----------

// Get all available exercises for users
app.get("/api/exercicios", (req, res) => {
  console.log("[API] /api/exercicios - Rota chamada às", new Date().toISOString());
  
  // Verificar se a conexão à BD está ativa
  if (!db) {
    console.error("[API] /api/exercicios - Conexão à BD não disponível");
    return res.status(500).json({ 
      erro: "Erro de conexão à base de dados.",
      detalhes: "Conexão não inicializada"
    });
  }

  const sql = "SELECT id_exercicio as id, nome, descricao, video, grupo_tipo as category, sub_tipo as subType FROM exercicios ORDER BY nome ASC";
  console.log("[API] /api/exercicios - Executando query:", sql);
  
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("[API] /api/exercicios - Erro na query:", err);
      console.error("[API] /api/exercicios - Detalhes do erro:", {
        code: err.code,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState,
        message: err.message
      });
      return res.status(500).json({ 
        erro: "Erro ao obter exercícios.",
        detalhes: err.sqlMessage || err.message,
        code: err.code
      });
    }
    
    console.log("[API] /api/exercicios - Exercícios encontrados:", rows ? rows.length : 0);
    if (rows && rows.length > 0) {
      console.log("[API] /api/exercicios - Primeiro exercício:", rows[0]);
    } else {
      console.warn("[API] /api/exercicios - Nenhum exercício encontrado na base de dados");
    }
    
    // Garantir que sempre retornamos um array, mesmo que vazio
    const result = Array.isArray(rows) ? rows : [];
    console.log("[API] /api/exercicios - Retornando", result.length, "exercícios");
    res.json(result);
  });
});

// Create a new workout (treino) for a user
app.post("/api/treino", (req, res) => {
  const { userId, nome, exercicios, dataRealizacao } = req.body;

  console.log("[API] POST /api/treino - Dados recebidos:", { userId, nome, exercicios, dataRealizacao });

  if (!userId || !nome || !exercicios || !Array.isArray(exercicios) || exercicios.length === 0) {
    console.log("[API] POST /api/treino - Validação falhou");
    return res.status(400).json({ erro: "userId, nome e lista de exercícios são obrigatórios." });
  }

  // Validar nome
  if (nome.trim().length === 0) {
    console.log("[API] POST /api/treino - Nome vazio");
    return res.status(400).json({ erro: "O nome do treino não pode estar vazio." });
  }

  // Verificar se o utilizador existe
  db.query("SELECT id_users FROM users WHERE id_users = ?", [userId], (err, userRows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }
    if (userRows.length === 0) {
      return res.status(404).json({ erro: "Utilizador não encontrado." });
    }

    // Obter o próximo id_treino disponível
    db.query("SELECT COALESCE(MAX(id_treino), 0) + 1 as nextId FROM treino", (err, idRows) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ erro: "Erro ao obter próximo ID de treino." });
      }

      const newTreinoId = idRows[0].nextId;
      // Usar data fornecida ou data atual
      const dataTreino = dataRealizacao || new Date().toISOString().split('T')[0]; // Data no formato YYYY-MM-DD

      // Inserir o treino com nome
      console.log("[API] POST /api/treino - Inserindo treino:", { newTreinoId, userId, nome: nome.trim(), dataTreino });
      
      // Verificar se o campo nome existe na tabela, se não existir, inserir sem nome
      db.query("INSERT INTO treino (id_treino, id_users, nome, data_treino) VALUES (?, ?, ?, ?)", 
        [newTreinoId, userId, nome.trim(), dataTreino], (err, result) => {
        if (err) {
          console.error("[API] POST /api/treino - Erro ao inserir treino:", err);
          console.error("[API] POST /api/treino - Detalhes do erro:", {
            code: err.code,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState
          });
          
          // Se o erro for porque o campo nome não existe, tentar sem nome
          if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage && err.sqlMessage.includes('nome')) {
            console.log("[API] POST /api/treino - Campo nome não existe, inserindo sem nome");
            db.query("INSERT INTO treino (id_treino, id_users, data_treino) VALUES (?, ?, ?)", 
              [newTreinoId, userId, dataTreino], (err2, result2) => {
              if (err2) {
                console.error("[API] POST /api/treino - Erro ao inserir treino sem nome:", err2);
                return res.status(500).json({ 
                  erro: "Erro ao criar treino.",
                  detalhes: "O campo 'nome' não existe na tabela. Execute o script SQL para adicionar o campo."
                });
              }
              // Continuar com a inserção dos exercícios mesmo sem nome
              insertExercicios();
            });
            return;
          }
          
          return res.status(500).json({ 
            erro: "Erro ao criar treino.",
            detalhes: err.sqlMessage || err.message
          });
        }
        
        // Função para inserir exercícios
        function insertExercicios() {

          // Inserir os exercícios do treino
          const exercicioValues = exercicios.map(exId => [newTreinoId, exId]);
          const placeholders = exercicios.map(() => "(?, ?)").join(", ");
          const values = exercicioValues.flat();

          console.log("[API] POST /api/treino - Inserindo exercícios:", exercicios);

          db.query(`INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES ${placeholders}`, 
            values, (err2, result2) => {
            if (err2) {
              console.error("[API] POST /api/treino - Erro ao inserir exercícios:", err2);
              // Se falhar ao inserir exercícios, apagar o treino criado
              db.query("DELETE FROM treino WHERE id_treino = ? AND id_users = ?", [newTreinoId, userId]);
              return res.status(500).json({ erro: "Erro ao adicionar exercícios ao treino." });
            }

            console.log("[API] POST /api/treino - Treino criado com sucesso!");
            res.json({ 
              sucesso: true, 
              mensagem: "Treino criado com sucesso!", 
              id_treino: newTreinoId,
              nome: nome,
              data_treino: dataTreino,
              exercicios: exercicios.length
            });
          });
        }
        
        insertExercicios();
      });
    });
  });
});

// ============================================
// SESSÕES - Deve vir ANTES de /api/treino/:userId
// ============================================
// Get all workout sessions for a user (for metrics)
app.get("/api/sessoes/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      ts.id_sessao,
      ts.id_treino,
      ts.data_inicio,
      ts.data_fim,
      ts.duracao_segundos,
      t.nome as nome_treino,
      COUNT(DISTINCT tse.id_exercicio) as num_exercicios,
      GROUP_CONCAT(DISTINCT e.grupo_tipo SEPARATOR ', ') as grupo_tipo
    FROM treino_sessao ts
    INNER JOIN treino t ON ts.id_treino = t.id_treino
    LEFT JOIN treino_serie tse ON ts.id_sessao = tse.id_sessao
    LEFT JOIN exercicios e ON tse.id_exercicio = e.id_exercicio
    WHERE ts.id_users = ? AND ts.data_fim IS NOT NULL
    GROUP BY ts.id_sessao, ts.id_treino, ts.data_inicio, ts.data_fim, ts.duracao_segundos, t.nome
    ORDER BY ts.data_inicio DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/sessoes/:userId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter sessões de treino." });
    }

    console.log("[API] /api/sessoes/:userId - Sessões encontradas:", rows.length);
    if (rows.length > 0) {
      console.log("[API] Primeira sessão raw:", rows[0]);
    }

    const sessoes = rows.map(sessao => ({
      id_sessao: sessao.id_sessao,
      id_treino: sessao.id_treino,
      nome: sessao.nome_treino || `Treino ${sessao.id_treino}`,
      data_treino: sessao.data_inicio,
      data_fim: sessao.data_fim,
      duracao_segundos: sessao.duracao_segundos,
      num_exercicios: sessao.num_exercicios || 0,
      grupo_tipo: sessao.grupo_tipo || null
    }));

    console.log("[API] Sessões mapeadas - primeira:", sessoes.length > 0 ? sessoes[0] : "nenhuma");
    res.json(sessoes);
  });
});

// Get workout session details with exercises and records broken
app.get("/api/sessao/detalhes/:sessaoId", (req, res) => {
  const { sessaoId } = req.params;

  // Buscar dados da sessão
  const sqlSessao = `
    SELECT 
      ts.id_sessao,
      ts.id_treino,
      ts.id_users,
      ts.data_inicio,
      ts.data_fim,
      ts.duracao_segundos,
      t.nome as nome_treino
    FROM treino_sessao ts
    INNER JOIN treino t ON ts.id_treino = t.id_treino
    WHERE ts.id_sessao = ?
  `;

  db.query(sqlSessao, [sessaoId], (err, sessaoRows) => {
    if (err) {
      console.error("[API] /api/sessao/detalhes - Erro ao buscar sessão:", err);
      return res.status(500).json({ erro: "Erro ao buscar sessão." });
    }

    if (sessaoRows.length === 0) {
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const sessao = sessaoRows[0];

    // Buscar exercícios e séries da sessão
    const sqlExercicios = `
      SELECT 
        e.id_exercicio,
        e.nome as nome_exercicio,
        ts.numero_serie,
        ts.repeticoes,
        ts.peso
      FROM treino_serie ts
      INNER JOIN exercicios e ON ts.id_exercicio = e.id_exercicio
      WHERE ts.id_sessao = ?
      ORDER BY e.nome, ts.numero_serie
    `;

    db.query(sqlExercicios, [sessaoId], (err2, seriesRows) => {
      if (err2) {
        console.error("[API] /api/sessao/detalhes - Erro ao buscar exercícios:", err2);
        return res.status(500).json({ erro: "Erro ao buscar exercícios." });
      }

      // Agrupar séries por exercício
      const exerciciosMap = {};
      seriesRows.forEach(serie => {
        if (!exerciciosMap[serie.id_exercicio]) {
          exerciciosMap[serie.id_exercicio] = {
            id_exercicio: serie.id_exercicio,
            nome: serie.nome_exercicio,
            series: []
          };
        }
        exerciciosMap[serie.id_exercicio].series.push({
          numero_serie: serie.numero_serie,
          repeticoes: serie.repeticoes,
          peso: serie.peso
        });
      });

      const exercicios = Object.values(exerciciosMap);

      // Buscar recordes quebrados nesta sessão
      const sqlRecordes = `
        SELECT 
          e.nome as nome_exercicio,
          ts.peso,
          ts.repeticoes,
          ts.data_serie
        FROM treino_serie ts
        INNER JOIN exercicios e ON ts.id_exercicio = e.id_exercicio
        WHERE ts.id_sessao = ?
          AND ts.e_recorde = 1
        ORDER BY e.nome
      `;

      db.query(sqlRecordes, [sessaoId], (err3, recordesRows) => {
        if (err3) {
          console.error("[API] /api/sessao/detalhes - Erro ao buscar recordes:", err3);
          // Continuar mesmo com erro nos recordes
        }

        res.json({
          id_sessao: sessao.id_sessao,
          id_treino: sessao.id_treino,
          nome: sessao.nome_treino,
          data_inicio: sessao.data_inicio,
          data_fim: sessao.data_fim,
          duracao_segundos: sessao.duracao_segundos,
          exercicios: exercicios,
          recordes: recordesRows || []
        });
      });
    });
  });
});

// Get all workouts (treinos) for a user
app.get("/api/treino/:userId", (req, res) => {
  const { userId } = req.params;

  // Tentar primeiro com nome, se falhar, tentar sem nome
  const sqlWithNome = `
    SELECT 
      t.id_treino,
      t.nome,
      t.data_treino,
      COUNT(te.id_exercicio) as num_exercicios,
      GROUP_CONCAT(e.nome SEPARATOR ', ') as exercicios_nomes,
      GROUP_CONCAT(DISTINCT e.grupo_tipo SEPARATOR ', ') as grupo_tipo
    FROM treino t
    LEFT JOIN treino_exercicio te ON t.id_treino = te.id_treino
    LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio
    WHERE t.id_users = ?
    GROUP BY t.id_treino, t.nome, t.data_treino
    ORDER BY t.data_treino DESC, t.id_treino DESC
  `;

  db.query(sqlWithNome, [userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/treino/:userId - ERRO COMPLETO:", err);
      console.error("[API] /api/treino/:userId - Tipo do erro:", typeof err);
      console.error("[API] /api/treino/:userId - Detalhes:", {
        code: err.code,
        sqlMessage: err.sqlMessage,
        message: err.message
      });
      
      // Se o erro for porque o campo nome não existe, tentar query alternativa
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage && err.sqlMessage.includes('nome')) {
        console.log("[API] /api/treino/:userId - Campo nome não existe, usando query sem nome");
        const sqlWithoutNome = `
          SELECT 
            t.id_treino,
            t.data_treino,
            COUNT(te.id_exercicio) as num_exercicios,
            GROUP_CONCAT(e.nome SEPARATOR ', ') as exercicios_nomes,
            GROUP_CONCAT(DISTINCT e.grupo_tipo SEPARATOR ', ') as grupo_tipo
          FROM treino t
          LEFT JOIN treino_exercicio te ON t.id_treino = te.id_treino
          LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio
          WHERE t.id_users = ?
          GROUP BY t.id_treino, t.data_treino
          ORDER BY t.data_treino DESC, t.id_treino DESC
        `;
        
        db.query(sqlWithoutNome, [userId], (err2, rows2) => {
          if (err2) {
            console.error("[API] /api/treino/:userId - Erro na query alternativa:", err2);
            return res.status(500).json({ erro: "Erro ao obter treinos.", detalhes: err2.sqlMessage });
          }
          
          const treinosComExercicios = rows2.map(treino => ({
            id_treino: treino.id_treino,
            nome: `Treino ${treino.id_treino}`, // Nome padrão se não existir
            data_treino: treino.data_treino,
            num_exercicios: treino.num_exercicios || 0,
            exercicios_nomes: treino.exercicios_nomes || "",
            grupo_tipo: treino.grupo_tipo || null
          }));
          
          res.json(treinosComExercicios);
        });
        return;
      }
      
      return res.status(500).json({ erro: "Erro ao obter treinos.", detalhes: err.sqlMessage });
    }
    
    // Obter detalhes dos exercícios para cada treino
    const treinosComExercicios = rows.map(treino => ({
      id_treino: treino.id_treino,
      nome: treino.nome || `Treino ${treino.id_treino}`, // Nome padrão se não existir
      data_treino: treino.data_treino,
      num_exercicios: treino.num_exercicios || 0,
      exercicios_nomes: treino.exercicios_nomes || "",
      grupo_tipo: treino.grupo_tipo || null
    }));

    res.json(treinosComExercicios);
  });
});

// ============================================
// IMPORTANTE: Esta rota DEVE estar ANTES de /api/treino/:userId/:treinoId
// para evitar que "sessao" seja interpretado como userId
// ============================================
// Get workout session with exercises and sets
app.get("/api/treino/sessao/:sessaoId", (req, res) => {
  const { sessaoId } = req.params;
  
  console.log("===========================================");
  console.log("[API] GET /api/treino/sessao/:sessaoId");
  console.log("Sessão ID recebido:", sessaoId);
  console.log("Tipo:", typeof sessaoId);

  // 1. Obter dados da sessão
  const query1 = "SELECT * FROM treino_sessao WHERE id_sessao = ?";
  console.log("Query 1:", query1, [sessaoId]);
  
  db.query(query1, [sessaoId], (err, sessaoRows) => {
    if (err) {
      console.error("ERRO Query 1:", err);
      return res.status(500).json({ erro: "Erro ao obter sessão." });
    }

    console.log("Resultado Query 1 - Linhas encontradas:", sessaoRows.length);
    console.log("Dados:", sessaoRows);

    if (sessaoRows.length === 0) {
      console.warn("SESSÃO NÃO ENCONTRADA!");
      
      // Debug: ver todas as sessões
      db.query("SELECT id_sessao, id_treino, id_users FROM treino_sessao ORDER BY id_sessao DESC LIMIT 5", [], (e, all) => {
        console.log("Últimas 5 sessões na BD:", all);
      });
      
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const sessao = sessaoRows[0];
    console.log("Sessão encontrada!");
    console.log("- id_sessao:", sessao.id_sessao);
    console.log("- id_treino:", sessao.id_treino);
    console.log("- id_users:", sessao.id_users);

    // 2. Obter exercícios do treino
    const query2 = `
      SELECT 
        e.id_exercicio as id,
        e.nome,
        e.descricao,
        e.grupo_tipo as category,
        e.sub_tipo as subType
      FROM treino_exercicio te
      INNER JOIN exercicios e ON te.id_exercicio = e.id_exercicio
      WHERE te.id_treino = ?
    `;
    console.log("Query 2:", query2, [sessao.id_treino]);
    
    db.query(query2, [sessao.id_treino], (err2, exercicios) => {
      if (err2) {
        console.error("ERRO Query 2:", err2);
        return res.status(500).json({ erro: "Erro ao obter exercícios." });
      }

      console.log("Resultado Query 2 - Exercícios encontrados:", exercicios.length);
      console.log("Exercícios:", exercicios);

      // 3. Buscar última sessão concluída do mesmo treino para obter dados anteriores
      const query3 = `
        SELECT id_sessao
        FROM treino_sessao
        WHERE id_treino = ? 
          AND id_users = ? 
          AND id_sessao != ?
          AND data_fim IS NOT NULL
        ORDER BY data_fim DESC
        LIMIT 1
      `;
      console.log("Query 3 (última sessão):", query3, [sessao.id_treino, sessao.id_users, sessaoId]);
      
      db.query(query3, [sessao.id_treino, sessao.id_users, sessaoId], (err3, ultimaSessao) => {
        if (err3) {
          console.error("ERRO Query 3:", err3);
          return res.status(500).json({ erro: "Erro ao buscar sessão anterior." });
        }

        console.log("Resultado Query 3 - Última sessão:", ultimaSessao);

        // 4. Se houver sessão anterior, buscar as séries dela
        if (ultimaSessao.length > 0) {
          const idSessaoAnterior = ultimaSessao[0].id_sessao;
          console.log("Sessão anterior encontrada:", idSessaoAnterior);

          const query4 = `
            SELECT 
              id_exercicio,
              numero_serie,
              repeticoes,
              peso
            FROM treino_serie
            WHERE id_sessao = ?
            ORDER BY id_exercicio, numero_serie
          `;
          console.log("Query 4 (séries anteriores):", query4, [idSessaoAnterior]);

          db.query(query4, [idSessaoAnterior], (err4, seriesAnteriores) => {
            if (err4) {
              console.error("ERRO Query 4:", err4);
              return res.status(500).json({ erro: "Erro ao obter séries anteriores." });
            }

            console.log("Resultado Query 4 - Séries anteriores:", seriesAnteriores.length);

            // Agrupar séries anteriores por exercício
            const exerciciosComSeries = exercicios.map(ex => {
              const seriesDoExercicio = seriesAnteriores.filter(s => s.id_exercicio === ex.id);
              return {
                ...ex,
                series: seriesDoExercicio
              };
            });

            console.log("RESPOSTA FINAL:");
            console.log("- Total exercícios:", exerciciosComSeries.length);
            console.log("- Com séries anteriores de sessão:", idSessaoAnterior);
            console.log("===========================================");

            res.json({
              id_sessao: sessao.id_sessao,
              id_treino: sessao.id_treino,
              data_inicio: sessao.data_inicio,
              exercicios: exerciciosComSeries
            });
          });
        } else {
          // Sem sessão anterior, retornar sem séries
          console.log("Nenhuma sessão anterior encontrada");

          const exerciciosComSeries = exercicios.map(ex => ({
            ...ex,
            series: []
          }));

          console.log("RESPOSTA FINAL (sem sessão anterior):");
          console.log("- Total exercícios:", exerciciosComSeries.length);
          console.log("===========================================");

          res.json({
            id_sessao: sessao.id_sessao,
            id_treino: sessao.id_treino,
            data_inicio: sessao.data_inicio,
            exercicios: exerciciosComSeries
          });
        }
      });
    });
  });
});

// Get workout details with exercises
app.get("/api/treino/:userId/:treinoId", (req, res) => {
  const { userId, treinoId } = req.params;

  // Verificar se o treino pertence ao utilizador
  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    const treino = treinoRows[0];

    // Obter exercícios do treino
    const sql = `
      SELECT 
        e.id_exercicio as id,
        e.nome,
        e.descricao,
        e.grupo_tipo as category,
        e.sub_tipo as subType
      FROM treino_exercicio te
      INNER JOIN exercicios e ON te.id_exercicio = e.id_exercicio
      WHERE te.id_treino = ?
      ORDER BY e.nome ASC
    `;

    db.query(sql, [treinoId], (err2, exercicioRows) => {
      if (err2) {
        console.error("[API] /api/treino/:userId/:treinoId - Erro ao obter exercícios:", err2);
        return res.status(500).json({ erro: "Erro ao obter exercícios do treino." });
      }

      res.json({
        id_treino: treino.id_treino,
        nome: treino.nome,
        data_treino: treino.data_treino,
        exercicios: exercicioRows
      });
    });
  });
});

// Update workout (treino) - Editar nome e exercícios
app.put("/api/treino/:userId/:treinoId", (req, res) => {
  const { userId, treinoId } = req.params;
  const { nome, exercicios } = req.body;

  console.log("[API] PUT /api/treino/:userId/:treinoId - Dados:", { userId, treinoId, nome, exercicios });

  // Verificar se o treino pertence ao utilizador
  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] PUT /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    // Atualizar nome se fornecido
    if (nome && nome.trim().length > 0) {
      db.query("UPDATE treino SET nome = ? WHERE id_treino = ? AND id_users = ?", 
        [nome.trim(), treinoId, userId], (err2) => {
        if (err2) {
          console.error("[API] PUT /api/treino/:userId/:treinoId - Erro ao atualizar nome:", err2);
          return res.status(500).json({ erro: "Erro ao atualizar nome do treino.", detalhes: err2.sqlMessage });
        }

        // Após atualizar nome, atualizar exercícios se fornecidos
        atualizarExercicios();
      });
    } else {
      // Se não há nome para atualizar, atualizar exercícios diretamente
      atualizarExercicios();
    }

    function atualizarExercicios() {
      // Atualizar exercícios se fornecidos
      if (exercicios && Array.isArray(exercicios)) {
        // Apagar exercícios antigos
        db.query("DELETE FROM treino_exercicio WHERE id_treino = ?", [treinoId], (err3) => {
          if (err3) {
            console.error("[API] PUT /api/treino/:userId/:treinoId - Erro ao apagar exercícios:", err3);
            return res.status(500).json({ erro: "Erro ao atualizar exercícios.", detalhes: err3.sqlMessage });
          }

          // Inserir novos exercícios
          if (exercicios.length > 0) {
            const exercicioValues = exercicios.map(exId => [treinoId, exId]);
            const placeholders = exercicios.map(() => "(?, ?)").join(", ");
            const values = exercicioValues.flat();

            db.query(`INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES ${placeholders}`, 
              values, (err4) => {
              if (err4) {
                console.error("[API] PUT /api/treino/:userId/:treinoId - Erro ao inserir exercícios:", err4);
                return res.status(500).json({ erro: "Erro ao atualizar exercícios.", detalhes: err4.sqlMessage });
              }

              console.log("[API] PUT /api/treino/:userId/:treinoId - Treino atualizado com sucesso!");
              res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
            });
          } else {
            console.log("[API] PUT /api/treino/:userId/:treinoId - Treino atualizado (sem exercícios)!");
            res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
          }
        });
      } else {
        // Se não há exercícios para atualizar, apenas retornar sucesso
        console.log("[API] PUT /api/treino/:userId/:treinoId - Treino atualizado (apenas nome)!");
        res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
      }
    }
  });
});

// Delete workout (treino)
app.delete("/api/treino/:userId/:treinoId", (req, res) => {
  const { userId, treinoId } = req.params;

  console.log("[API] DELETE /api/treino/:userId/:treinoId - Apagando treino:", { userId, treinoId });

  // Verificar se o treino pertence ao utilizador
  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] DELETE /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    // Apagar exercícios do treino
    db.query("DELETE FROM treino_exercicio WHERE id_treino = ?", [treinoId], (err2) => {
      if (err2) {
        console.error("[API] DELETE /api/treino/:userId/:treinoId - Erro ao apagar exercícios:", err2);
        return res.status(500).json({ erro: "Erro ao apagar exercícios do treino." });
      }

      // Apagar treino
      db.query("DELETE FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err3) => {
        if (err3) {
          console.error("[API] DELETE /api/treino/:userId/:treinoId - Erro ao apagar treino:", err3);
          return res.status(500).json({ erro: "Erro ao apagar treino." });
        }

        res.json({ sucesso: true, mensagem: "Treino apagado com sucesso!" });
      });
    });
  });
});

// Start workout session - Iniciar treino
app.post("/api/treino/:userId/:treinoId/iniciar", (req, res) => {
  const { userId, treinoId } = req.params;

  console.log("===========================================");
  console.log("[INICIAR TREINO]");
  console.log("userId:", userId, "treinoId:", treinoId);

  // Verificar se o treino pertence ao utilizador
  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("ERRO ao verificar treino:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    console.log("Treinos encontrados:", treinoRows.length);

    if (treinoRows.length === 0) {
      console.warn("TREINO NÃO ENCONTRADO!");
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    console.log("Treino OK! Criando sessão...");
    
    // Criar sessão de treino
    db.query("INSERT INTO treino_sessao (id_treino, id_users, data_inicio) VALUES (?, ?, NOW())", 
      [treinoId, userId], (err2, result) => {
      if (err2) {
        console.error("ERRO ao criar sessão:", err2);
        return res.status(500).json({ erro: "Erro ao iniciar treino." });
      }

      const sessionId = result.insertId;
      console.log("✓ SESSÃO CRIADA COM SUCESSO!");
      console.log("✓ ID da sessão:", sessionId);
      console.log("✓ Retornando para o frontend...");
      console.log("===========================================");
      
      res.json({ 
        sucesso: true, 
        id_sessao: sessionId
      });
    });
  });
});

// End workout session - Terminar treino
app.post("/api/treino/sessao/:sessaoId/terminar", (req, res) => {
  const { sessaoId } = req.params;
  const { duracao_segundos } = req.body;

  console.log("[API] POST /api/treino/sessao/:sessaoId/terminar - Terminando sessão:", { sessaoId, duracao_segundos });

  db.query("UPDATE treino_sessao SET data_fim = NOW(), duracao_segundos = ? WHERE id_sessao = ?", 
    [duracao_segundos, sessaoId], (err) => {
    if (err) {
      console.error("[API] POST /api/treino/sessao/:sessaoId/terminar - Erro:", err);
      return res.status(500).json({ erro: "Erro ao terminar treino." });
    }

    res.json({ sucesso: true, mensagem: "Treino terminado com sucesso!" });
  });
});

// Save workout set - Guardar série (suporta cardio: distância/tempo)
app.post("/api/treino/sessao/:sessaoId/serie", (req, res) => {
  const { sessaoId } = req.params;
  const { id_exercicio, numero_serie, repeticoes, peso, distancia_km, tempo_segundos } = req.body;

  console.log("[API] POST /api/treino/sessao/:sessaoId/serie - Guardando série:", { sessaoId, id_exercicio, numero_serie, repeticoes, peso, distancia_km, tempo_segundos });

  const distancia = distancia_km !== undefined ? parseFloat(distancia_km) : (peso !== undefined ? parseFloat(peso) : null);
  const tempo = tempo_segundos !== undefined ? parseInt(tempo_segundos, 10) : (repeticoes !== undefined ? parseInt(repeticoes, 10) : null);
  const isCardio = distancia_km !== undefined || tempo_segundos !== undefined;

  if (!id_exercicio || !numero_serie) {
    return res.status(400).json({ erro: "id_exercicio e numero_serie são obrigatórios." });
  }

  if (isCardio) {
    const distanciaValida = distancia !== null && !Number.isNaN(distancia) && distancia > 0;
    const tempoValido = tempo !== null && !Number.isNaN(tempo) && tempo > 0;
    if (!distanciaValida || !tempoValido) {
      return res.status(400).json({ erro: "Para cardio, informe distância (>0) e tempo (>0)." });
    }
  } else if (tempo === null || Number.isNaN(tempo)) {
    return res.status(400).json({ erro: "repeticoes são obrigatórias." });
  }

  db.query(
    "INSERT INTO treino_serie (id_sessao, id_exercicio, numero_serie, repeticoes, peso) VALUES (?, ?, ?, ?, ?)",
    [sessaoId, id_exercicio, numero_serie, tempo || null, distancia || null],
    (err, result) => {
      if (err) {
        console.error("[API] POST /api/treino/sessao/:sessaoId/serie - Erro:", err);
        return res.status(500).json({ erro: "Erro ao guardar série." });
      }

      res.json({ sucesso: true, mensagem: "Série guardada com sucesso!", id_serie: result?.insertId });
    }
  );
});

// Finalize workout session - Concluir treino
app.post("/api/treino/sessao/:sessaoId/finalizar", (req, res) => {
  const { sessaoId } = req.params;
  const { duracao_segundos } = req.body;

  console.log("[API] POST /api/treino/sessao/:sessaoId/finalizar - Finalizando sessão:", { sessaoId, duracao_segundos });

  db.query("UPDATE treino_sessao SET data_fim = NOW(), duracao_segundos = ? WHERE id_sessao = ?", 
    [duracao_segundos, sessaoId], (err) => {
    if (err) {
      console.error("[API] POST /api/treino/sessao/:sessaoId/finalizar - Erro:", err);
      return res.status(500).json({ erro: "Erro ao finalizar treino." });
    }

    res.json({ sucesso: true, mensagem: "Treino finalizado com sucesso!" });
  });
});

// Cancel workout session - Cancelar treino
app.delete("/api/treino/sessao/:sessaoId/cancelar", (req, res) => {
  const { sessaoId } = req.params;

  console.log("[API] DELETE /api/treino/sessao/:sessaoId/cancelar - Cancelando sessão:", sessaoId);

  // Primeiro apagar as séries desta sessão
  db.query("DELETE FROM treino_serie WHERE id_sessao = ?", [sessaoId], (err) => {
    if (err) {
      console.error("[API] DELETE /api/treino/sessao/:sessaoId/cancelar - Erro ao apagar séries:", err);
      return res.status(500).json({ erro: "Erro ao cancelar treino." });
    }

    // Depois apagar a sessão
    db.query("DELETE FROM treino_sessao WHERE id_sessao = ?", [sessaoId], (err2) => {
      if (err2) {
        console.error("[API] DELETE /api/treino/sessao/:sessaoId/cancelar - Erro ao apagar sessão:", err2);
        return res.status(500).json({ erro: "Erro ao cancelar treino." });
      }

      console.log("[API] DELETE /api/treino/sessao/:sessaoId/cancelar - Sessão cancelada com sucesso!");
      res.json({ sucesso: true, mensagem: "Treino cancelado com sucesso!" });
    });
  });
});

// Get personal records (recordes pessoais) for a user
app.get("/api/recordes/:userId", (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT 
      e.nome as nome_exercicio,
      MAX(ts.peso) as peso,
      ts.data_serie
    FROM treino_serie ts
    INNER JOIN treino_sessao sess ON ts.id_sessao = sess.id_sessao
    INNER JOIN exercicios e ON ts.id_exercicio = e.id_exercicio
    WHERE sess.id_users = ? AND ts.peso > 0
    GROUP BY ts.id_exercicio, e.nome
    ORDER BY ts.peso DESC
    LIMIT 20
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/recordes/:userId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter recordes." });
    }
    res.json(rows);
  });
});

// Get workout details with series
app.get("/api/treino/detalhes/:treinoId/:dataIso", (req, res) => {
  const { treinoId, dataIso } = req.params;

  // Buscar informações do treino
  db.query("SELECT * FROM treino WHERE id_treino = ?", [treinoId], (err, treinoRows) => {
    if (err) {
      console.error("[API] /api/treino/detalhes - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    const treino = treinoRows[0];

    // Primeiro buscar exercícios do treino
    const sqlExercicios = `
      SELECT 
        e.id_exercicio,
        e.nome as exercicio
      FROM treino_exercicio te
      INNER JOIN exercicios e ON te.id_exercicio = e.id_exercicio
      WHERE te.id_treino = ?
      ORDER BY e.nome ASC
    `;

    db.query(sqlExercicios, [treinoId], (err2, exerciciosRows) => {
      if (err2) {
        console.error("[API] /api/treino/detalhes - Erro ao buscar exercícios:", err2);
        return res.status(500).json({ erro: "Erro ao buscar exercícios." });
      }

      if (exerciciosRows.length === 0) {
        return res.json({
          nome: treino.nome || "Treino",
          data: treino.data_treino,
          exercicios: []
        });
      }

      // Buscar sessão pela data específica
      const dataInicio = `${dataIso}%`;
      console.log("[API] Buscando sessão - treinoId:", treinoId, "dataIso:", dataIso, "pattern:", dataInicio);
      
      db.query(
        "SELECT id_sessao, data_inicio FROM treino_sessao WHERE id_treino = ? AND DATE(data_inicio) = ? ORDER BY data_inicio DESC LIMIT 1",
        [treinoId, dataIso],
        (err3, sessaoRows) => {
          console.log("[API] Sessões encontradas:", sessaoRows ? sessaoRows.length : 0);
          if (sessaoRows && sessaoRows.length > 0) {
            console.log("[API] Sessão ID:", sessaoRows[0].id_sessao, "Data:", sessaoRows[0].data_inicio);
          }

          // Se não houver sessão, retornar exercícios sem séries
          if (err3 || sessaoRows.length === 0) {
            console.log("[API] Nenhuma sessão encontrada, retornando exercícios sem séries");
            const exercicios = exerciciosRows.map(ex => ({
              nome: ex.exercicio,
              series: []
            }));

            return res.json({
              nome: treino.nome || "Treino",
              data: treino.data_treino,
              exercicios: exercicios
            });
          }

          const sessaoId = sessaoRows[0].id_sessao;
          console.log("[API] Buscando séries para sessão:", sessaoId);

          // Buscar séries da sessão
          const sqlSeries = `
            SELECT 
              ts.id_exercicio,
              ts.numero_serie,
              ts.repeticoes,
              ts.peso
            FROM treino_serie ts
            WHERE ts.id_sessao = ?
            ORDER BY ts.numero_serie ASC
          `;

          db.query(sqlSeries, [sessaoId], (err4, seriesRows) => {
            if (err4) {
              console.error("[API] /api/treino/detalhes - Erro ao buscar séries:", err4);
            }

            console.log("[API] Séries encontradas:", seriesRows ? seriesRows.length : 0);
            if (seriesRows && seriesRows.length > 0) {
              console.log("[API] Primeira série:", seriesRows[0]);
            }

            // Criar mapa de séries por exercício
            const seriesMap = {};
            (seriesRows || []).forEach(row => {
              if (!seriesMap[row.id_exercicio]) {
                seriesMap[row.id_exercicio] = [];
              }
              seriesMap[row.id_exercicio].push({
                numero: row.numero_serie,
                repeticoes: row.repeticoes,
                peso: row.peso
              });
            });

            // Montar resposta final
            const exercicios = exerciciosRows.map(ex => ({
              nome: ex.exercicio,
              series: seriesMap[ex.id_exercicio] || []
            }));

            res.json({
              nome: treino.nome || "Treino",
              data: treino.data_treino,
              exercicios: exercicios
            });
          });
        }
      );
    });
  });
});

// ============ ROTAS DE TREINOS PARA ADMINS ============

// GET - Obter todos os treinos de admin
app.get("/api/treino-admin", (req, res) => {
  const sql = `
    SELECT ta.id_treino_admin, ta.nome, ta.criado_em
    FROM treino_admin ta
    ORDER BY ta.criado_em DESC
  `;
  
  db.query(sql, (err, treinosRows) => {
    if (err) {
      console.error("Erro ao obter treinos de admin:", err);
      return res.status(500).json({ erro: "Erro ao obter treinos." });
    }

    if (treinosRows.length === 0) {
      return res.json([]);
    }

    // Obter exercícios para cada treino
    const resultado = [];
    let processados = 0;

    treinosRows.forEach((treino) => {
      const sqlExercicos = `
        SELECT e.id_exercicio, e.nome, e.grupo_tipo
        FROM exercicios e
        INNER JOIN treino_admin_exercicio tae ON e.id_exercicio = tae.id_exercicio
        WHERE tae.id_treino_admin = ?
        ORDER BY tae.id_treino_admin_exercicio ASC
      `;

      db.query(sqlExercicos, [treino.id_treino_admin], (err, exerciciosRows) => {
        if (err) {
          console.error("Erro ao obter exercícios do treino admin:", err);
          exerciciosRows = [];
        }

        resultado.push({
          id_treino_admin: treino.id_treino_admin,
          nome: treino.nome,
          exercicios: exerciciosRows.map((ex) => ({
            id: ex.id_exercicio,
            name: ex.nome,
            category: ex.grupo_tipo,
          })),
          criado_em: treino.criado_em,
        });

        processados++;
        if (processados === treinosRows.length) {
          res.json(resultado);
        }
      });
    });
  });
});

// GET - Obter detalhes de um treino de admin específico
app.get("/api/treino-admin/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT ta.id_treino_admin, ta.nome
    FROM treino_admin ta
    WHERE ta.id_treino_admin = ?
  `;

  db.query(sql, [id], (err, treinosRows) => {
    if (err) {
      console.error("Erro ao obter treino admin:", err);
      return res.status(500).json({ erro: "Erro ao obter treino." });
    }

    if (treinosRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    const treino = treinosRows[0];

    const sqlExercicos = `
      SELECT e.id_exercicio, e.nome, e.grupo_tipo
      FROM exercicios e
      INNER JOIN treino_admin_exercicio tae ON e.id_exercicio = tae.id_exercicio
      WHERE tae.id_treino_admin = ?
      ORDER BY tae.id_treino_admin_exercicio ASC
    `;

    db.query(sqlExercicos, [id], (err, exerciciosRows) => {
      if (err) {
        console.error("Erro ao obter exercícios:", err);
        exerciciosRows = [];
      }

      res.json({
        id_treino_admin: treino.id_treino_admin,
        nome: treino.nome,
        exercicios: exerciciosRows.map((ex) => ({
          id: ex.id_exercicio,
          name: ex.nome,
          category: ex.grupo_tipo,
        })),
      });
    });
  });
});

// POST - Criar novo treino de admin
app.post("/api/treino-admin", (req, res) => {
  const { nome, exercicios } = req.body;

  if (!nome || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({
      sucesso: false,
      erro: "Nome e exercícios são obrigatórios.",
    });
  }

  const sqlInsertTreino = `
    INSERT INTO treino_admin (nome, criado_em)
    VALUES (?, NOW())
  `;

  db.query(sqlInsertTreino, [nome], (err, result) => {
    if (err) {
      console.error("Erro ao criar treino admin:", err);
      return res.status(500).json({ sucesso: false, erro: "Erro ao criar treino." });
    }

    const treinoAdminId = result.insertId;

    // Inserir exercícios
    const sqlInsertExercicos = `
      INSERT INTO treino_admin_exercicio (id_treino_admin, id_exercicio)
      VALUES (?, ?)
    `;

    let inseridos = 0;
    let erroOcorreu = false;

    exercicios.forEach((exercicioId) => {
      db.query(sqlInsertExercicos, [treinoAdminId, exercicioId], (err) => {
        if (err) {
          console.error("Erro ao inserir exercício no treino admin:", err);
          erroOcorreu = true;
        }
        inseridos++;

        if (inseridos === exercicios.length) {
          if (erroOcorreu) {
            return res.status(500).json({ 
              sucesso: false, 
              erro: "Erro ao adicionar alguns exercícios ao treino." 
            });
          }
          res.json({
            sucesso: true,
            mensagem: "Treino criado com sucesso!",
            id_treino_admin: treinoAdminId,
          });
        }
      });
    });
  });
});

// PUT - Atualizar treino de admin
app.put("/api/treino-admin/:id", (req, res) => {
  const { id } = req.params;
  const { nome, exercicios } = req.body;

  if (!nome || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({
      sucesso: false,
      erro: "Nome e exercícios são obrigatórios.",
    });
  }

  const sqlUpdate = "UPDATE treino_admin SET nome = ?, atualizado_em = NOW() WHERE id_treino_admin = ?";

  db.query(sqlUpdate, [nome, id], (err) => {
    if (err) {
      console.error("Erro ao atualizar treino admin:", err);
      return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar treino." });
    }

    // Deletar exercícios antigos
    const sqlDeleteExercicos = "DELETE FROM treino_admin_exercicio WHERE id_treino_admin = ?";
    db.query(sqlDeleteExercicos, [id], (err) => {
      if (err) {
        console.error("Erro ao deletar exercícios antigos:", err);
        return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar exercícios." });
      }

      if (exercicios.length === 0) {
        return res.json({
          sucesso: true,
          mensagem: "Treino atualizado com sucesso!",
          id_treino_admin: id,
        });
      }

      // Inserir novos exercícios
      const sqlInsertExercicos = `
        INSERT INTO treino_admin_exercicio (id_treino_admin, id_exercicio)
        VALUES (?, ?)
      `;

      let inseridos = 0;
      let erroOcorreu = false;
      const erros = [];

      exercicios.forEach((exercicioId) => {
        db.query(sqlInsertExercicos, [id, exercicioId], (err) => {
          if (err) {
            console.error(`Erro ao inserir exercício ${exercicioId}:`, err);
            erroOcorreu = true;
            erros.push(exercicioId);
          }
          inseridos++;

          if (inseridos === exercicios.length) {
            if (erroOcorreu) {
              return res.status(500).json({ 
                sucesso: false, 
                erro: `Erro ao adicionar exercícios: ${erros.join(', ')}` 
              });
            }
            res.json({
              sucesso: true,
              mensagem: "Treino atualizado com sucesso!",
            });
          }
        });
      });
    });
  });
});

// DELETE - Apagar treino de admin
app.delete("/api/treino-admin/:id", (req, res) => {
  const { id } = req.params;

  const sqlDelete = "DELETE FROM treino_admin WHERE id_treino_admin = ?";
  db.query(sqlDelete, [id], (err) => {
    if (err) {
      console.error("Erro ao deletar treino admin:", err);
      return res.status(500).json({ sucesso: false, erro: "Erro ao deletar treino." });
    }

    res.json({
      sucesso: true,
      mensagem: "Treino deletado com sucesso!",
    });
  });
});


// ============ RECUPERA��O DE SENHA ============

// Armazenar c�digos de recupera��o temporariamente (em produ��o usar Redis ou BD)
const recoveryCodes = new Map();

// Solicitar recupera��o de senha - gera c�digo de 6 d�gitos
app.post("/api/recuperar-senha", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: "Email � obrigat�rio." });
  }

  // Verificar se o email existe
  db.query("SELECT id_users, userName FROM users WHERE email = ?", [email], (err, rows) => {
    if (err) {
      console.error("Erro ao verificar email:", err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Email n�o encontrado." });
    }

    // Gerar c�digo de 6 d�gitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar c�digo com expira��o de 15 minutos
    recoveryCodes.set(email, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      userId: rows[0].id_users
    });

    console.log("[RECUPERAR SENHA] C�digo gerado para", email, ":", code);

    // Em produ��o, enviar email com o c�digo
    // Por agora, retornar sucesso (c�digo aparece no console do servidor)
    res.json({ 
      sucesso: true, 
      mensagem: "C�digo de recupera��o enviado para o email.",
      // REMOVER EM PRODU��O - apenas para testes
      codigo_teste: code
    });
  });
});

// Verificar c�digo de recupera��o
app.post("/api/verificar-codigo", (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ erro: "Email e c�digo s�o obrigat�rios." });
  }

  const recovery = recoveryCodes.get(email);

  if (!recovery) {
    return res.status(400).json({ erro: "Nenhum c�digo de recupera��o encontrado. Solicite um novo." });
  }

  if (Date.now() > recovery.expiresAt) {
    recoveryCodes.delete(email);
    return res.status(400).json({ erro: "C�digo expirado. Solicite um novo." });
  }

  if (recovery.code !== codigo) {
    return res.status(400).json({ erro: "C�digo inv�lido." });
  }

  res.json({ sucesso: true, mensagem: "C�digo v�lido." });
});

// Redefinir senha
app.post("/api/redefinir-senha", async (req, res) => {
  const { email, codigo, novaSenha } = req.body;

  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ erro: "Todos os campos s�o obrigat�rios." });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
  }

  const recovery = recoveryCodes.get(email);

  if (!recovery) {
    return res.status(400).json({ erro: "Nenhum c�digo de recupera��o encontrado." });
  }

  if (Date.now() > recovery.expiresAt) {
    recoveryCodes.delete(email);
    return res.status(400).json({ erro: "C�digo expirado. Solicite um novo." });
  }

  if (recovery.code !== codigo) {
    return res.status(400).json({ erro: "C�digo inv�lido." });
  }

  try {
    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha na BD
    db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email], (err) => {
      if (err) {
        console.error("Erro ao atualizar senha:", err);
        return res.status(500).json({ erro: "Erro ao atualizar senha." });
      }

      // Remover c�digo usado
      recoveryCodes.delete(email);

      console.log("[RECUPERAR SENHA] Senha alterada com sucesso para:", email);
      res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });
    });
  } catch (error) {
    console.error("Erro ao fazer hash da senha:", error);
    return res.status(500).json({ erro: "Erro ao processar senha." });
  }
});

app.listen(5000, () => console.log("Servidor a correr na porta 5000"));

  const sql = 'INSERT INTO treino (nome, id_users, data_treino) VALUES (?, ?, CURDATE())';
  db.query(sql, [nome, usuario_id], (err, result) => {
    if (err) {
      console.error('Erro ao criar treino:', err);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao criar treino'
      });
    }

    res.json({
      sucesso: true,
      treino_id: result.insertId,
      mensagem: 'Treino criado com sucesso'
    });
  });
});

// 2. ADICIONAR EXERCÃCIOS AO TREINO DO USER
app.post('/api/treino-user/:treino_id/exercicios', (req, res) => {
  const { treino_id } = req.params;
  const { exercises } = req.body;

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({
      sucesso: false,
      erro: 'Array de exercÃ­cios Ã© obrigatÃ³rio'
    });
  }

  let adicionados = 0;
  let erros = 0;
  const totalExercicios = exercises.length;

  exercises.forEach((exercise) => {
    // Verificar se exercÃ­cio jÃ¡ existe
    const sqlCheck = 'SELECT id_exercicio FROM exercicios WHERE api_id = ?';
    db.query(sqlCheck, [exercise.api_id], (err, rows) => {
      if (err) {
        console.error('Erro ao verificar exercÃ­cio:', err);
        erros++;
        if (adicionados + erros === totalExercicios) finalizarAdicao();
        return;
      }

      if (rows.length > 0) {
        // ExercÃ­cio jÃ¡ existe
        const exercicio_id = rows[0].id_exercicio;
        adicionarAoTreino(exercicio_id);
      } else {
        // Inserir novo exercÃ­cio
        const descricao = 'Alvo: ' + exercise.target + '. Equipamento: ' + exercise.equipment;
        const sqlInsert = 'INSERT INTO exercicios (nome, descricao, grupo_tipo, sub_tipo, api_id, origem, atualizado_em) VALUES (?, ?, ?, ?, ?, "api", NOW())';
        
        db.query(sqlInsert, [
          exercise.name,
          descricao,
          exercise.bodyPart,
          exercise.target,
          exercise.api_id
        ], (err, result) => {
          if (err) {
            console.error('Erro ao inserir exercÃ­cio:', err);
            erros++;
            if (adicionados + erros === totalExercicios) finalizarAdicao();
            return;
          }
          
          adicionarAoTreino(result.insertId);
        });
      }

      function adicionarAoTreino(exId) {
        const sqlRelacao = 'INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES (?, ?)';
        db.query(sqlRelacao, [treino_id, exId], (err) => {
          if (err) {
            console.error('Erro ao adicionar ao treino:', err);
            erros++;
          } else {
            adicionados++;
          }
          
          if (adicionados + erros === totalExercicios) finalizarAdicao();
        });
      }
    });
  });

  function finalizarAdicao() {
    if (adicionados === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Nenhum exercÃ­cio foi adicionado'
      });
    }

    res.json({
      sucesso: true,
      exerciciosAdicionados: adicionados,
      mensagem: adicionados + ' exercÃ­cio(s) adicionado(s) com sucesso'
    });
  }
});

// 3. OBTER EXERCÃCIOS DE UM TREINO DO USER
app.get('/api/treino-user/:treino_id/exercicios', (req, res) => {
  const { treino_id } = req.params;

  const sql = 'SELECT e.id_exercicio, e.nome, e.descricao, e.grupo_tipo, e.sub_tipo, e.api_id, e.origem FROM treino_exercicio te JOIN exercicios e ON te.id_exercicio = e.id_exercicio WHERE te.id_treino = ?';

  db.query(sql, [treino_id], (err, rows) => {
    if (err) {
      console.error('Erro ao obter exercÃ­cios:', err);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao obter exercÃ­cios'
      });
    }

    res.json({
      sucesso: true,
      exercicios: rows || []
    });
  });
});

// 4. REMOVER EXERCÃCIO DO TREINO DO USER
app.delete('/api/treino-user/:treino_id/exercicios/:exercicio_id', (req, res) => {
  const { treino_id, exercicio_id } = req.params;

  const sql = 'DELETE FROM treino_exercicio WHERE id_treino = ? AND id_exercicio = ?';
  db.query(sql, [treino_id, exercicio_id], (err) => {
    if (err) {
      console.error('Erro ao remover exercÃ­cio:', err);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao remover exercÃ­cio'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'ExercÃ­cio removido com sucesso'
    });
  });
});

app.listen(5000, '0.0.0.0', () => console.log('Servidor a correr na porta 5000'));

