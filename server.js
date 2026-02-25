// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");
const os = require("os");
const http = require("http");
const nodemailer = require("nodemailer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Stripe = require("stripe");
const rateLimit = require("express-rate-limit");

// ================== EMAIL (GMAIL SMTP) ==================
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS, // App Password do Gmail (não a password normal)
  },
});

// ================== GEMINI AI ==================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ================== STRIPE ==================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// ================== RESET DE PASSWORD (em memória) ==================
// Map: email → { code: string, expiry: number }
const resetCodes = new Map();


const app = express();

// ================== STRIPE WEBHOOK (antes do express.json) ==================
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[Stripe] Webhook signature inválida:", err.message);
    return res.status(400).json({ erro: "Webhook inválido" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 1);
      db.query(
        "UPDATE users SET plano = 'pago', plano_ativo_ate = ?, stripe_customer_id = ? WHERE id_users = ?",
        [expiry, session.customer, userId],
        (err) => {
          if (err) console.error("[Stripe] Erro ao ativar plano:", err);
          else console.log(`[Stripe] Plano ativado para user ${userId} até ${expiry.toISOString()}`);
        }
      );
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
    const obj = event.data.object;
    const customerId = obj.customer;
    db.query(
      "UPDATE users SET plano = 'free', plano_ativo_ate = NULL WHERE stripe_customer_id = ?",
      [customerId],
      (err) => { if (err) console.error("[Stripe] Erro ao desativar plano:", err); }
    );
  }

  res.json({ received: true });
});

app.use(cors());
app.use(express.json());

// ================== RATE LIMITING ==================
const limiterGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Demasiadas tentativas. Aguarda um momento." },
});
const limiterAI = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Limite de pedidos à IA atingido. Tenta de novo em 1 hora." },
});
app.use("/api/", limiterGeral);

// ================== MIGRAÇÕES DB ==================
function runMigrations() {
  const migrations = [
    "ALTER TABLE users ADD COLUMN plano VARCHAR(10) NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN plano_ativo_ate DATETIME NULL",
    "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL",
    `CREATE TABLE IF NOT EXISTS ai_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      semana_inicio DATE NOT NULL,
      conteudo TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_week (user_id, semana_inicio)
    )`,
    `CREATE TABLE IF NOT EXISTS ai_planos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      mes VARCHAR(7) NOT NULL,
      conteudo TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_month (user_id, mes)
    )`,
  ];
  migrations.forEach(sql => {
    db.query(sql, (err) => {
      if (err && !err.message.toLowerCase().includes("duplicate column")) {
        // Ignorar erros de coluna já existente silenciosamente
      }
    });
  });
  console.log("✓ Migrações de planos/AI verificadas");
}
runMigrations();

// Middleware para logar todas as requisições
app.use((req, res, next) => {
  next();
});

// Função para obter o IP local (prefere Wi-Fi, depois Ethernet, depois loopback)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let wifiIP = null;
  let ethernetIP = null;
  let anyIP = null;
  let virtualIP = null; // Ignorar IPs virtuais (como 192.168.56.x)
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Ignorar IPs virtuais (Hyper-V, VirtualBox, etc.)
        if (iface.address.startsWith("192.168.56.") || 
            iface.address.startsWith("10.0.2.") ||
            iface.address.startsWith("172.")) {
          virtualIP = iface.address; // Guardar só como fallback
          continue;
        }
        
        // Preferir Wi-Fi
        if (name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wlan")) {
          wifiIP = iface.address;
        }
        // Depois Ethernet
        else if (name.toLowerCase().includes("ethernet") || name.toLowerCase().includes("eth")) {
          ethernetIP = iface.address;
        }
        // Qualquer outro (mas não virtual)
        else if (!anyIP) {
          anyIP = iface.address;
        }
      }
    }
  }
  
  // Usar Wi-Fi > Ethernet > Qualquer outro > localhost (NÃO usar IP virtual como fallback principal)
  const selectedIP = wifiIP || ethernetIP || anyIP || virtualIP || "localhost";
  
  return selectedIP;
}

const SERVER_IP = getLocalIP();
const SERVER_PORT = process.env.PORT || 5000;


// Rota para obter informações do servidor (para auto-config no cliente)
app.get("/api/server-info", (req, res) => {
  let clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || "Desconhecido";
  
  // Limpar IPv6 mapped addresses (ex: ::ffff:192.168.1.10 -> 192.168.1.10)
  if (clientIP.includes("::ffff:")) {
    clientIP = clientIP.split("::ffff:")[1];
  }
  
  // Determine o IP correto para retornar
  let serverIPToReturn = SERVER_IP;
  
  // Se o cliente está na mesma subnet, preferir usar o IP em essa subnet
  if (clientIP && clientIP !== "Desconhecido" && !clientIP.includes("127.0.0.1")) {
    const clientSubnet = clientIP.substring(0, clientIP.lastIndexOf("."));
    const serverSubnet = SERVER_IP.substring(0, SERVER_IP.lastIndexOf("."));
    
    // Se estão na mesma subnet, usar SERVER_IP
    if (clientSubnet === serverSubnet) {
      serverIPToReturn = SERVER_IP;
    }
    // Se o cliente é localhost, retornar localhost
    else if (clientIP === "127.0.0.1" || clientIP === "localhost") {
      serverIPToReturn = "localhost";
    }
  }
  
  // Se o servidor não está acessível, tentar usar localhost como fallback
  if (!serverIPToReturn || serverIPToReturn === "localhost") {
    serverIPToReturn = "localhost";
  }
  
  // Se o cliente é localhost, usar localhost
  const apiURL = clientIP && (clientIP.includes("127.0.0.1") || clientIP === "localhost")
    ? `http://localhost:${SERVER_PORT}`
    : `http://${serverIPToReturn}:${SERVER_PORT}`;
  
  res.json({
    sucesso: true,
    ip: serverIPToReturn,
    porta: SERVER_PORT,
    url: apiURL,
    clientIP: clientIP,
    timestamp: new Date().toISOString()
  });
});

// Rota de health check (para verificar se o servidor está online)
app.get("/api/health", (req, res) => {
  res.json({ sucesso: true, mensagem: "Servidor online" });
});

//Rota de Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ erro: "Email e password são obrigatórios." });
  }

  const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";

  db.query(sql, [email], async (err, rows) => {
    if (err) {
      console.error("❌ [LOGIN] Erro na BD:", err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }

    if (rows.length === 0) {
      return res.status(401).json({ erro: "Email não encontrado." });
    }

    const user = rows[0];

    // Verificar password encriptada
    try {
      const passwordCorreta = await bcrypt.compare(password, user.password);
      
      if (!passwordCorreta) {
        return res.status(401).json({ erro: "Credenciais inválidas2." });
      }

      // Login correcto
      res.json({
        sucesso: true,
        id: user.id_users,
        nome: user.userName,
        email: user.email,
        tipo: user.id_tipoUser
      });
    } catch (bcryptError) {
      console.error("❌ [LOGIN] Erro ao comparar password:", bcryptError);
      return res.status(500).json({ erro: "Erro ao validar credenciais." });
    }
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
    if (err) {
      console.error("[API] /api/profile SQL error:", err);
      return res.status(500).json({ erro: "Erro ao obter perfil." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ erro: "Utilizador não encontrado." });
    }

    return res.json({ sucesso: true, user: rows[0] });
  });
});

// Rota para obter o streak de treinos do utilizador
// Streak = dias CONSECUTIVOS com sessões concluídas (data_fim preenchida)
app.get("/api/streak/:userId", (req, res) => {
  const { userId } = req.params;

  // Obter datas únicas de sessões concluídas, ordenadas DESC
  const sql = `
    SELECT DISTINCT DATE(ts.data_fim) as data_treino
    FROM treino_sessao ts
    INNER JOIN treino t ON ts.id_treino = t.id_treino
    WHERE t.id_users = ? AND ts.data_fim IS NOT NULL
    ORDER BY data_treino DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/streak SQL error:", err);
      return res.status(500).json({ erro: "Erro ao obter streak." });
    }

    if (!rows || rows.length === 0) {
      return res.json({ sucesso: true, streak: 0, maxStreak: 0 });
    }

    // Calcular streak de dias consecutivos
    let currentStreak = 0;
    let maxStreak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < rows.length; i++) {
      const workoutDate = new Date(rows[i].data_treino);
      workoutDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      // Se a data do treino é a esperada (dias consecutivos para trás desde hoje)
      if (workoutDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        // Quebra de sequência
        break;
      }
    }

    // maxStreak é igual a currentStreak se o treino mais recente foi hoje ou ontem
    maxStreak = currentStreak;

    res.json({ 
      sucesso: true, 
      streak: currentStreak,
      maxStreak: maxStreak
    });
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
      console.error(err);
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
      console.error(err);
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
      console.error(err);
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
      console.error(err);
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
        console.error(err2);
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
      console.error(err);
      return res.status(500).json({ erro: "Erro ao apagar exercício." });
    }
    return res.json({ sucesso: true });
  });
});

// ---------- User API routes for workouts ----------

// Get all available exercises for users
app.get("/api/exercicios", (req, res) => {
  // Verificar se a conexão à BD está ativa
  if (!db) {
    return res.status(500).json({ 
      erro: "Erro de conexão à base de dados.",
      detalhes: "Conexão não inicializada"
    });
  }

  const sql = "SELECT id_exercicio as id, nome, descricao, video, grupo_tipo as category, sub_tipo as subType FROM exercicios ORDER BY nome ASC";
  
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("[API] /api/exercicios - Erro na query:", err);
      return res.status(500).json({ 
        erro: "Erro ao obter exercícios.",
        detalhes: err.sqlMessage || err.message,
        code: err.code
      });
    }
    
    // Garantir que sempre retornamos um array, mesmo que vazio
    const result = Array.isArray(rows) ? rows : [];
    res.json(result);
  });
});

// Create a new workout (treino) for a user
app.post("/api/treino", (req, res) => {
  const { userId, nome, exercicios, dataRealizacao } = req.body;

  if (!userId || !nome || !exercicios || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({ erro: "userId, nome e lista de exercícios são obrigatórios." });
  }

  // Validar nome
  if (nome.trim().length === 0) {
    return res.status(400).json({ erro: "O nome do treino não pode estar vazio." });
  }

  // Verificar se o utilizador existe
  db.query("SELECT id_users FROM users WHERE id_users = ?", [userId], (err, userRows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }
    if (userRows.length === 0) {
      return res.status(404).json({ erro: "Utilizador não encontrado." });
    }

    // Obter o próximo id_treino disponível
    db.query("SELECT COALESCE(MAX(id_treino), 0) + 1 as nextId FROM treino", (err, idRows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: "Erro ao obter próximo ID de treino." });
      }

      const newTreinoId = idRows[0].nextId;
      // Usar data fornecida ou data atual
      const dataTreino = dataRealizacao || new Date().toISOString().split('T')[0]; // Data no formato YYYY-MM-DD

      // Inserir o treino na base de dados
      db.query("INSERT INTO treino (id_treino, id_users, nome, data_treino) VALUES (?, ?, ?, ?)", 
        [newTreinoId, userId, nome.trim(), dataTreino], (err, result) => {
        if (err) {
          console.error("[API] POST /api/treino - Erro ao inserir treino:", err);
          return res.status(500).json({ 
            erro: "Erro ao criar treino.",
            detalhes: err.sqlMessage || err.message
          });
        }

        // Inserir os exercícios em treino_exercicio imediatamente
        insertExercicios();

        function insertExercicios() {
          const exercicioValues = exercicios.map(exId => [newTreinoId, exId]);
          const placeholders = exercicios.map(() => "(?, ?)").join(", ");
          const values = exercicioValues.flat();

          db.query(`INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES ${placeholders}`,
            values, (err2) => {
            if (err2) {
              console.error("[API] POST /api/treino - Erro ao inserir exercícios:", err2);
              return res.status(500).json({ 
                erro: "Treino criado mas erro ao guardar exercícios.",
                detalhes: err2.sqlMessage || err2.message
              });
            }

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
      t.id_treino,
      ts.id_sessao,
      t.data_treino,
      ts.data_fim,
      ts.duracao_segundos,
      DATE_SUB(ts.data_fim, INTERVAL ts.duracao_segundos SECOND) as data_inicio_calculada,
      t.nome as nome_treino,
      ts.data_fim as data_para_ordenar,
      COUNT(te.id_exercicio) as num_exercicios,
      GROUP_CONCAT(DISTINCT e.grupo_tipo SEPARATOR ', ') as grupo_tipo
    FROM treino t
    INNER JOIN treino_sessao ts ON t.id_treino = ts.id_treino AND ts.id_users = ?
    LEFT JOIN treino_exercicio te ON t.id_treino = te.id_treino
    LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio
    WHERE t.id_users = ? AND ts.data_fim IS NOT NULL
      AND ts.id_sessao = (
        SELECT id_sessao FROM treino_sessao 
        WHERE id_treino = t.id_treino AND id_users = ? AND data_fim IS NOT NULL
        ORDER BY data_fim DESC LIMIT 1
      )
    GROUP BY t.id_treino, ts.id_sessao, t.data_treino, ts.data_fim, ts.duracao_segundos, t.nome
    ORDER BY data_para_ordenar DESC, t.id_treino DESC
  `;

  db.query(sql, [userId, userId, userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/sessoes/:userId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter sessões de treino." });
    }

    const sessoes = rows.map(sessao => ({
      id_sessao: sessao.id_sessao,
      id_treino: sessao.id_treino,
      nome: sessao.nome_treino || `Treino ${sessao.id_treino}`,
      data_treino: sessao.data_treino,
      data_inicio: sessao.data_inicio_calculada || sessao.data_treino,
      data_fim: sessao.data_fim,
      duracao_segundos: sessao.duracao_segundos,
      num_exercicios: sessao.num_exercicios || 0,
      grupo_tipo: sessao.grupo_tipo || null
    }));

    res.json(sessoes);
  });
});

// Get workout session details with exercises and records broken
app.get("/api/sessao/detalhes/:sessaoId", (req, res) => {
  const { sessaoId } = req.params;

  // Buscar tudo em uma única query otimizada com JOINs
  const sql = `
    SELECT 
      ts.id_sessao,
      ts.id_treino,
      ts.id_users,
      DATE_SUB(ts.data_fim, INTERVAL ts.duracao_segundos SECOND) as data_inicio,
      ts.data_fim,
      ts.duracao_segundos,
      t.nome as nome_treino,
      e.id_exercicio,
      e.nome as nome_exercicio,
      tser.numero_serie,
      tser.repeticoes,
      tser.peso,
      tser.e_recorde
    FROM treino_sessao ts
    INNER JOIN treino t ON ts.id_treino = t.id_treino
    LEFT JOIN treino_serie tser ON ts.id_sessao = tser.id_sessao
    LEFT JOIN exercicios e ON tser.id_exercicio = e.id_exercicio
    WHERE ts.id_sessao = ?
    ORDER BY e.nome, tser.numero_serie
  `;

  db.query(sql, [sessaoId], (err, rows) => {
    if (err) {
      console.error("[API] /api/sessao/detalhes - Erro:", err);
      return res.status(500).json({ erro: "Erro ao buscar sessão." });
    }

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const sessao = rows[0];

    // Agrupar séries por exercício
    const exerciciosMap = {};
    const recordes = [];

    rows.forEach(row => {
      // Processar exercícios e séries
      if (row.id_exercicio) {
        if (!exerciciosMap[row.id_exercicio]) {
          exerciciosMap[row.id_exercicio] = {
            id_exercicio: row.id_exercicio,
            nome_exercicio: row.nome_exercicio,
            series: []
          };
        }
        exerciciosMap[row.id_exercicio].series.push({
          numero_serie: row.numero_serie,
          repeticoes: row.repeticoes,
          peso: row.peso
        });

        // Coletar recordes
        if (row.e_recorde === 1) {
          recordes.push({
            nome_exercicio: row.nome_exercicio,
            peso: row.peso,
            repeticoes: row.repeticoes
          });
        }
      }
    });

    const exercicios = Object.values(exerciciosMap);

    res.json({
      id_sessao: sessao.id_sessao,
      id_treino: sessao.id_treino,
      nome_treino: sessao.nome_treino,
      data_inicio: sessao.data_inicio,
      data_fim: sessao.data_fim,
      duracao_segundos: sessao.duracao_segundos,
      exercicios: exercicios,
      recordes: recordes
    });
  });
});

// NOVA ROTA: Retorna treinos com datas da tabela treino (não apenas sessões completadas)
app.get("/api/treino-com-data/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
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
    WHERE t.id_users = ? AND t.data_treino IS NOT NULL
    GROUP BY t.id_treino, t.nome, t.data_treino
    ORDER BY t.data_treino DESC, t.id_treino DESC
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("[API] /api/treino-com-data/:userId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter treinos com data." });
    }

    const treinos = rows.map(treino => ({
      id_treino: treino.id_treino,
      nome: treino.nome || `Treino ${treino.id_treino}`,
      data_treino: treino.data_treino,
      data_inicio: treino.data_treino, // Adicionar data_inicio para compatibilidade
      num_exercicios: treino.num_exercicios || 0,
      exercicios_nomes: treino.exercicios_nomes || "",
      grupo_tipo: treino.grupo_tipo || null
    }));

    res.json(treinos);
  });
});

// Get all workouts (treinos) for a user
app.get("/api/treino/:userId", (req, res) => {
  const { userId } = req.params;

  console.log(`👤 Carregando treinos do utilizador ID: ${userId}`);

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
      console.error(`❌ Erro ao carregar treinos do user ${userId}:`, err.message);
      
      // Se o erro for porque o campo nome não existe, tentar query alternativa
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage && err.sqlMessage.includes('nome')) {
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

  // 1. Obter dados da sessão
  const query1 = "SELECT * FROM treino_sessao WHERE id_sessao = ?";
  
  db.query(query1, [sessaoId], (err, sessaoRows) => {
    if (err) {
      console.error("ERRO Query 1:", err);
      return res.status(500).json({ erro: "Erro ao obter sessão." });
    }

    if (sessaoRows.length === 0) {
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const sessao = sessaoRows[0];

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
    
    db.query(query2, [sessao.id_treino], (err2, exercicios) => {
      if (err2) {
        console.error("ERRO Query 2:", err2);
        return res.status(500).json({ erro: "Erro ao obter exercícios." });
      }

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
      
      db.query(query3, [sessao.id_treino, sessao.id_users, sessaoId], (err3, ultimaSessao) => {
        if (err3) {
          console.error("ERRO Query 3:", err3);
          return res.status(500).json({ erro: "Erro ao buscar sessão anterior." });
        }

        // 4. Se houver sessão anterior, buscar as séries dela
        if (ultimaSessao.length > 0) {
          const idSessaoAnterior = ultimaSessao[0].id_sessao;

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

          db.query(query4, [idSessaoAnterior], (err4, seriesAnteriores) => {
            if (err4) {
              console.error("ERRO Query 4:", err4);
              return res.status(500).json({ erro: "Erro ao obter séries anteriores." });
            }

            // Agrupar séries anteriores por exercício
            const exerciciosComSeries = exercicios.map(ex => {
              const seriesDoExercicio = seriesAnteriores.filter(s => s.id_exercicio === ex.id);
              return {
                ...ex,
                series: seriesDoExercicio
              };
            });

            res.json({
              id_sessao: sessao.id_sessao,
              id_treino: sessao.id_treino,
              data_inicio: sessao.data_inicio,
              exercicios: exerciciosComSeries
            });
          });
        } else {
          // Sem sessão anterior, retornar sem séries
          const exerciciosComSeries = exercicios.map(ex => ({
            ...ex,
            series: []
          }));

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

              res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
            });
          } else {
            res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
          }
        });
      } else {
        // Se não há exercícios para atualizar, apenas retornar sucesso
        res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
      }
    }
  });
});

// Delete workout (treino)
app.delete("/api/treino/:userId/:treinoId", (req, res) => {
  const { userId, treinoId } = req.params;

  // Verificar se o treino pertence ao utilizador
  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] DELETE /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    // Obter todas as sessões do treino para poder apagar as séries
    db.query("SELECT id_sessao FROM treino_sessao WHERE id_treino = ?", [treinoId], (err2, sessoes) => {
      if (err2) {
        console.error("[API] DELETE /api/treino - Erro ao obter sessões:", err2);
        return res.status(500).json({ erro: "Erro ao apagar treino." });
      }

      const sessaoIds = sessoes.map(s => s.id_sessao);

      // Apagar séries de todas as sessões (se existirem)
      const deleteSeries = (cb) => {
        if (sessaoIds.length === 0) return cb();
        const placeholders = sessaoIds.map(() => "?").join(", ");
        db.query(`DELETE FROM treino_serie WHERE id_sessao IN (${placeholders})`, sessaoIds, (err3) => {
          if (err3) {
            console.error("[API] DELETE /api/treino - Erro ao apagar séries:", err3);
            return res.status(500).json({ erro: "Erro ao apagar séries do treino." });
          }
          cb();
        });
      };

      deleteSeries(() => {
        // Apagar todas as sessões do treino
        db.query("DELETE FROM treino_sessao WHERE id_treino = ?", [treinoId], (err4) => {
          if (err4) {
            console.error("[API] DELETE /api/treino - Erro ao apagar sessões:", err4);
            return res.status(500).json({ erro: "Erro ao apagar sessões do treino." });
          }

          // Apagar exercícios do treino
          db.query("DELETE FROM treino_exercicio WHERE id_treino = ?", [treinoId], (err5) => {
            if (err5) {
              console.error("[API] DELETE /api/treino - Erro ao apagar exercícios:", err5);
              return res.status(500).json({ erro: "Erro ao apagar exercícios do treino." });
            }

            // Apagar o treino
            db.query("DELETE FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err6) => {
              if (err6) {
                console.error("[API] DELETE /api/treino - Erro ao apagar treino:", err6);
                return res.status(500).json({ erro: "Erro ao apagar treino." });
              }

              res.json({ sucesso: true, mensagem: "Treino apagado com sucesso!" });
            });
          });
        });
      });
    });
  });
});

// Save complete workout session in a single request
app.post("/api/treino/sessao/guardar", (req, res) => {
  const { userId, treinoId, duracao_segundos, series } = req.body;

  if (!userId || !treinoId || !series || !Array.isArray(series) || series.length === 0) {
    return res.status(400).json({ erro: "userId, treinoId e series são obrigatórios." });
  }

  // Create session with duration and finish time set immediately
  db.query(
    "INSERT INTO treino_sessao (id_treino, id_users, data_fim, duracao_segundos) VALUES (?, ?, NOW(), ?)",
    [treinoId, userId, duracao_segundos || 0],
    (err, result) => {
      if (err) {
        console.error("[API] POST /api/treino/sessao/guardar - Erro ao criar sessão:", err);
        return res.status(500).json({ erro: "Erro ao guardar sessão." });
      }

      const sessaoId = result.insertId;

      // Insert all series at once
      const values = series.map((s) => [sessaoId, s.id_exercicio, s.numero_serie, s.repeticoes || 0, s.peso || 0]);
      const placeholders = values.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const flatValues = values.flat();

      db.query(
        `INSERT INTO treino_serie (id_sessao, id_exercicio, numero_serie, repeticoes, peso) VALUES ${placeholders}`,
        flatValues,
        (err2) => {
          if (err2) {
            console.error("[API] POST /api/treino/sessao/guardar - Erro ao guardar séries:", err2);
            return res.status(500).json({ erro: "Erro ao guardar séries." });
          }

          // Mark workout as completed (required for streak calculation)
          db.query("UPDATE treino SET status = 'completed' WHERE id_treino = ?", [treinoId], (err3) => {
            if (err3) {
              console.warn("[API] POST /api/treino/sessao/guardar - Erro ao atualizar status:", err3);
            }
            res.json({ sucesso: true, mensagem: "Treino guardado com sucesso!", id_sessao: sessaoId });
          });
        }
      );
    }
  );
});

// (endpoints legacy /iniciar /serie /finalizar /cancelar removidos — substituídos por /api/treino/sessao/guardar)

// Get full workout details with exercises, series, weight and reps
app.get("/api/treino-sessao-detalhes/:sessaoId", (req, res) => {
  const { sessaoId } = req.params;

  const sql = `
    SELECT 
      ts.id_sessao,
      ts.id_treino,
      DATE_SUB(ts.data_fim, INTERVAL ts.duracao_segundos SECOND) as data_inicio,
      ts.data_fim,
      ts.duracao_segundos,
      t.nome as nome_treino,
      tse.id_serie,
      tse.id_exercicio,
      tse.numero_serie,
      tse.repeticoes,
      tse.peso,
      e.nome as nome_exercicio,
      e.grupo_tipo,
      e.sub_tipo
    FROM treino_sessao ts
    INNER JOIN treino t ON ts.id_treino = t.id_treino
    LEFT JOIN treino_serie tse ON ts.id_sessao = tse.id_sessao
    LEFT JOIN exercicios e ON tse.id_exercicio = e.id_exercicio
    WHERE ts.id_sessao = ?
    ORDER BY e.id_exercicio, tse.numero_serie
  `;

  db.query(sql, [sessaoId], (err, rows) => {
    if (err) {
      console.error("[API] /api/treino-sessao-detalhes - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter detalhes da sessão." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const sessao = rows[0];
    const exercicios = {};

    // Agrupar séries por exercício
    rows.forEach((row) => {
      if (row.id_exercicio) {
        if (!exercicios[row.id_exercicio]) {
          exercicios[row.id_exercicio] = {
            id_exercicio: row.id_exercicio,
            nome_exercicio: row.nome_exercicio,
            grupo_tipo: row.grupo_tipo,
            sub_tipo: row.sub_tipo,
            series: []
          };
        }
        
        if (row.id_serie) {
          exercicios[row.id_exercicio].series.push({
            numero_serie: row.numero_serie,
            repeticoes: row.repeticoes,
            peso: row.peso
          });
        }
      }
    });

    res.json({
      id_sessao: sessao.id_sessao,
      id_treino: sessao.id_treino,
      nome_treino: sessao.nome_treino,
      data_inicio: sessao.data_inicio,
      data_fim: sessao.data_fim,
      duracao_segundos: sessao.duracao_segundos,
      exercicios: Object.values(exercicios)
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
      
      db.query(
        "SELECT id_sessao, data_inicio FROM treino_sessao WHERE id_treino = ? AND DATE(data_inicio) = ? ORDER BY data_inicio DESC LIMIT 1",
        [treinoId, dataIso],
        (err3, sessaoRows) => {
          // Se não houver sessão, retornar exercícios sem séries
          if (err3 || sessaoRows.length === 0) {
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

// Alias para /api/treinos-admin (com 's')
app.get("/api/treinos-admin", (req, res) => {
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

    if (!treinosRows || treinosRows.length === 0) {
      return res.json([]);
    }

    // Para cada treino, obter os exercícios
    const resultado = [];
    let processados = 0;

    treinosRows.forEach(treino => {
      const sqlExercicios = `
        SELECT te.id_exercicio, te.ordem, e.nome, e.descricao, e.video, e.grupo_tipo, e.sub_tipo
        FROM treino_admin_exercicio te
        JOIN exercicios e ON te.id_exercicio = e.id_exercicio
        WHERE te.id_treino_admin = ?
        ORDER BY te.ordem ASC
      `;

      db.query(sqlExercicios, [treino.id_treino_admin], (err, exercicios) => {
        if (!err) {
          resultado.push({
            ...treino,
            exercicios: exercicios || []
          });
        }

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


// ============ RECUPERAÇÃO DE SENHA ============

// Armazenar códigos de recuperação temporariamente (em produção usar Redis ou BD)
const recoveryCodes = new Map();

// Solicitar recuperação de senha - gera código de 6 dígitos
app.post("/api/recuperar-senha", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: "Email é obrigatório." });
  }

  // Verificar se o email existe
  db.query("SELECT id_users, userName FROM users WHERE email = ?", [email], (err, rows) => {
    if (err) {
      console.error("Erro ao verificar email:", err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Email não encontrado." });
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar código com expiração de 15 minutos
    recoveryCodes.set(email, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      userId: rows[0].id_users
    });

    // Em produção, enviar email com o código
    // Por agora, retornar sucesso (código aparece no console do servidor)
    res.json({ 
      sucesso: true, 
      mensagem: "Código de recuperação enviado para o email.",
      // REMOVER EM PRODUÇÃO - apenas para testes
      codigo_teste: code
    });
  });
});

// Verificar código de recuperação
app.post("/api/verificar-codigo", (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ erro: "Email e código são obrigatórios." });
  }

  const recovery = recoveryCodes.get(email);

  if (!recovery) {
    return res.status(400).json({ erro: "Nenhum código de recuperação encontrado. Solicite um novo." });
  }

  if (Date.now() > recovery.expiresAt) {
    recoveryCodes.delete(email);
    return res.status(400).json({ erro: "Código expirado. Solicite um novo." });
  }

  if (recovery.code !== codigo) {
    return res.status(400).json({ erro: "Código inválido." });
  }

  res.json({ sucesso: true, mensagem: "Código válido." });
});

// Redefinir senha
app.post("/api/redefinir-senha", async (req, res) => {
  const { email, codigo, novaSenha } = req.body;

  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
  }

  const recovery = recoveryCodes.get(email);

  if (!recovery) {
    return res.status(400).json({ erro: "Nenhum código de recuperação encontrado." });
  }

  if (Date.now() > recovery.expiresAt) {
    recoveryCodes.delete(email);
    return res.status(400).json({ erro: "Código expirado. Solicite um novo." });
  }

  if (recovery.code !== codigo) {
    return res.status(400).json({ erro: "Código inválido." });
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

      // Remover código usado
      recoveryCodes.delete(email);

      res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });
    });
  } catch (error) {
    console.error("Erro ao fazer hash da senha:", error);
    return res.status(500).json({ erro: "Erro ao processar senha." });
  }
});


// 3. OBTER EXERCÍCIOS DE UM TREINO DO USER
app.get('/api/treino-user/:treino_id/exercicios', (req, res) => {
  const { treino_id } = req.params;

  console.log(`📋 Carregando exercícios do treino ID: ${treino_id}`);

  const sql = `
    SELECT 
      e.id_exercicio, 
      e.nome, 
      e.descricao, 
      e.grupo_tipo, 
      e.sub_tipo
    FROM treino_exercicio te 
    LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio 
    WHERE te.id_treino = ?`;

  db.query(sql, [treino_id], (err, rows) => {
    if (err) {
      console.error(`❌ Erro ao obter exercícios do treino ${treino_id}:`, err.message);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao obter exercícios',
        detalhes: err.message,
        treino_id
      });
    }

    console.log(`✅ Treino ${treino_id}: ${rows?.length || 0} exercícios encontrados`);
    
    res.json({
      sucesso: true,
      exercicios: rows || [],
      treino_id,
      total: rows?.length || 0
    });
  });
});

// 4. REMOVER EXERCÍCIO DO TREINO DO USER
app.delete('/api/treino-user/:treino_id/exercicios/:exercicio_id', (req, res) => {
  const { treino_id, exercicio_id } = req.params;

  const sql = 'DELETE FROM treino_exercicio WHERE id_treino = ? AND id_exercicio = ?';
  db.query(sql, [treino_id, exercicio_id], (err) => {
    if (err) {
      console.error('Erro ao remover exercício:', err);
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro ao remover exercício'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Exercício removido com sucesso'
    });
  });
});

// ================== ENDPOINTS DE COMUNIDADES ==================

// GET /api/comunidades - obter todas as comunidades verificadas
app.get("/api/comunidades", (req, res) => {
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    WHERE c.verificada = 1
    ORDER BY c.criada_em DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao obter comunidades:", err);
      return res.status(500).json({ erro: "Erro ao obter comunidades" });
    }
    res.json(results || []);
  });
});

// GET /api/comunidades/user/:userId - obter comunidades do utilizador
app.get("/api/comunidades/user/:userId", (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    INNER JOIN comunidade_membros cm ON c.id = cm.comunidade_id
    WHERE cm.user_id = ?
    ORDER BY c.criada_em DESC
  `;
  
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Erro ao obter comunidades do utilizador:", err);
      return res.status(500).json({ erro: "Erro ao obter comunidades" });
    }
    res.json(results || []);
  });
});

// POST /api/comunidades - criar comunidade
app.post("/api/comunidades", (req, res) => {
  const { nome, descricao, criador_id, pais, linguas, privada } = req.body;
  
  if (!nome || !descricao || !criador_id) {
    return res.status(400).json({ erro: "Nome, descrição e criador_id são obrigatórios" });
  }
  
  const sql = `
    INSERT INTO comunidades (nome, descricao, criador_id, pais, linguas, privada, verificada)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `;
  
  db.query(sql, [nome, descricao, criador_id, pais || null, linguas || null, privada ? 1 : 0], (err, result) => {
    if (err) {
      console.error("Erro ao criar comunidade:", err);
      return res.status(500).json({ erro: "Erro ao criar comunidade" });
    }
    
    // Auto-adicionar criador como membro
    const membersql = "INSERT INTO comunidade_membros (comunidade_id, user_id) VALUES (?, ?)";
    db.query(membersql, [result.insertId, criador_id], (err) => {
      if (err) console.error("Erro ao adicionar criador como membro:", err);
    });
    
    res.status(201).json({
      sucesso: true,
      id: result.insertId,
      mensagem: "Comunidade criada! Aguarde aprovação do admin."
    });
  });
});

// POST /api/comunidades/:id/join - entrar numa comunidade
app.post("/api/comunidades/:id/join", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ erro: "userId é obrigatório" });
  }
  
  const sql = "INSERT INTO comunidade_membros (comunidade_id, user_id) VALUES (?, ?)";
  
  db.query(sql, [id, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ erro: "Você já é membro desta comunidade" });
      }
      console.error("Erro ao entrar na comunidade:", err);
      return res.status(500).json({ erro: "Erro ao entrar na comunidade" });
    }
    res.json({ sucesso: true, mensagem: "Entrou na comunidade com sucesso" });
  });
});

// POST /api/comunidades/:id/leave - sair de uma comunidade
app.post("/api/comunidades/:id/leave", (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ erro: "userId é obrigatório" });
  }
  
  const sql = "DELETE FROM comunidade_membros WHERE comunidade_id = ? AND user_id = ?";
  
  db.query(sql, [id, userId], (err) => {
    if (err) {
      console.error("Erro ao sair da comunidade:", err);
      return res.status(500).json({ erro: "Erro ao sair da comunidade" });
    }
    res.json({ sucesso: true, mensagem: "Saiu da comunidade com sucesso" });
  });
});

// POST /api/comunidades/:id/mensagens - enviar mensagem
app.post("/api/comunidades/:id/mensagens", (req, res) => {
  const { id } = req.params;
  const { userId, mensagem } = req.body;
  
  if (!userId || !mensagem) {
    return res.status(400).json({ erro: "userId e mensagem são obrigatórios" });
  }
  
  const sql = "INSERT INTO comunidade_mensagens (comunidade_id, user_id, mensagem) VALUES (?, ?, ?)";
  
  db.query(sql, [id, userId, mensagem], (err, result) => {
    if (err) {
      console.error("Erro ao enviar mensagem:", err);
      return res.status(500).json({ erro: "Erro ao enviar mensagem" });
    }
    res.status(201).json({
      sucesso: true,
      id: result.insertId,
      mensagem: "Mensagem enviada com sucesso"
    });
  });
});

// GET /api/comunidades/:id/mensagens - obter mensagens
app.get("/api/comunidades/:id/mensagens", (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT cm.*, u.userName as user_nome
    FROM comunidade_mensagens cm
    LEFT JOIN users u ON cm.user_id = u.id_users
    WHERE cm.comunidade_id = ?
    ORDER BY cm.criada_em ASC
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Erro ao obter mensagens:", err);
      return res.status(500).json({ erro: "Erro ao obter mensagens" });
    }
    res.json(results || []);
  });
});

// GET /api/comunidades/:id/membros - obter membros
app.get("/api/comunidades/:id/membros", (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT cm.*, u.userName as user_nome, u.email
    FROM comunidade_membros cm
    LEFT JOIN users u ON cm.user_id = u.id_users
    WHERE cm.comunidade_id = ?
    ORDER BY cm.juntou_em ASC
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Erro ao obter membros:", err);
      return res.status(500).json({ erro: "Erro ao obter membros" });
    }
    res.json(results || []);
  });
});

// ================== ENDPOINTS DE ADMIN ==================

// GET /api/admin/comunidades/pendentes - obter comunidades não verificadas
app.get("/api/admin/comunidades/pendentes", (req, res) => {
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    WHERE c.verificada = 0
    ORDER BY c.criada_em ASC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao obter comunidades pendentes:", err);
      return res.status(500).json({ erro: "Erro ao obter comunidades pendentes" });
    }
    res.json(results || []);
  });
});

// POST /api/admin/comunidades/:id/verificar - verificar comunidade
app.post("/api/admin/comunidades/:id/verificar", (req, res) => {
  const { id } = req.params;
  
  const sql = "UPDATE comunidades SET verificada = 1 WHERE id = ?";
  
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Erro ao verificar comunidade:", err);
      return res.status(500).json({ erro: "Erro ao verificar comunidade" });
    }
    res.json({ sucesso: true, mensagem: "Comunidade verificada com sucesso" });
  });
});

// POST /api/admin/comunidades/:id/rejeitar - rejeitar comunidade
app.post("/api/admin/comunidades/:id/rejeitar", (req, res) => {
  const { id } = req.params;
  
  const sql = "DELETE FROM comunidades WHERE id = ?";
  
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Erro ao rejeitar comunidade:", err);
      return res.status(500).json({ erro: "Erro ao rejeitar comunidade" });
    }
    res.json({ sucesso: true, mensagem: "Comunidade rejeitada" });
  });
});

// POST /api/admin/comunidades/:id/toggle - toggle verificação
app.post("/api/admin/comunidades/:id/toggle", (req, res) => {
  const { id } = req.params;
  const { verificada } = req.body;
  
  const sql = "UPDATE comunidades SET verificada = ? WHERE id = ?";
  
  db.query(sql, [verificada ? 1 : 0, id], (err) => {
    if (err) {
      console.error("Erro ao toggle verificação:", err);
      return res.status(500).json({ erro: "Erro ao atualizar verificação" });
    }
    res.json({ sucesso: true, mensagem: "Status atualizado com sucesso" });
  });
});

// ================== RECUPERAÇÃO DE PASSWORD ==================

// Passo 1: Solicitar código de recuperação
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: "Email obrigatório" });

  const sql = "SELECT id_users FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados" });
    if (results.length === 0) {
      // Resposta genérica para não revelar se o email existe
      return res.json({ sucesso: true });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutos
    resetCodes.set(email.toLowerCase(), { code, expiry });

    // Enviar email
    try {
      await emailTransporter.sendMail({
        from: `"GoLift" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Código de Recuperação de Password — GoLift",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 12px;">
            <h2 style="color: #111; text-align: center;">Recuperação de Password</h2>
            <p style="color: #555;">Olá,</p>
            <p style="color: #555;">Recebemos um pedido para redefinir a password da tua conta GoLift.</p>
            <p style="color: #555;">Usa o seguinte código (válido por <strong>15 minutos</strong>):</p>
            <div style="text-align: center; margin: 32px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111; background: #e5e7eb; padding: 16px 24px; border-radius: 8px;">${code}</span>
            </div>
            <p style="color: #999; font-size: 12px;">Se não fizeste este pedido, podes ignorar este email.</p>
          </div>
        `,
      });

      console.log(`[Password Reset] Código enviado para ${email}`);
      res.json({ sucesso: true });
    } catch (emailErr) {
      console.error("[Password Reset] Erro ao enviar email:", emailErr.message);
      console.log(`[Password Reset] Código de teste para ${email}: ${code}`);
      res.json({ sucesso: true, codigo_teste: code });
    }
  });
});

// Passo 2: Verificar código
app.post("/api/auth/verify-reset-code", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ erro: "Email e código obrigatórios" });

  const entry = resetCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ erro: "Nenhum pedido de recuperação encontrado" });
  if (Date.now() > entry.expiry) {
    resetCodes.delete(email.toLowerCase());
    return res.status(400).json({ erro: "Código expirado. Solicita um novo." });
  }
  if (entry.code !== code) return res.status(400).json({ erro: "Código inválido" });

  res.json({ sucesso: true });
});

// Passo 3: Redefinir password
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ erro: "Dados incompletos" });
  if (newPassword.length < 6) return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres" });

  const entry = resetCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ erro: "Nenhum pedido de recuperação encontrado" });
  if (Date.now() > entry.expiry) {
    resetCodes.delete(email.toLowerCase());
    return res.status(400).json({ erro: "Código expirado. Solicita um novo." });
  }
  if (entry.code !== code) return res.status(400).json({ erro: "Código inválido" });

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE email = ?", [hash, email], (err) => {
      if (err) return res.status(500).json({ erro: "Erro ao atualizar password" });
      resetCodes.delete(email.toLowerCase());
      console.log(`[Password Reset] Password atualizada para ${email}`);
      res.json({ sucesso: true });
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

// ================== STRIPE CHECKOUT ==================

// Criar sessão de checkout
app.post("/api/stripe/checkout-session", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ erro: "userId obrigatório" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { userId: String(userId) },
      success_url: `${process.env.APP_URL}?pagamento=sucesso`,
      cancel_url: `${process.env.APP_URL}?pagamento=cancelado`,
    });
    res.json({ sucesso: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[Stripe] Erro ao criar sessão:", err.message);
    res.status(500).json({ erro: "Erro ao criar sessão de pagamento" });
  }
});

// Verificar plano do utilizador
app.get("/api/plano/:userId", (req, res) => {
  const { userId } = req.params;
  db.query(
    "SELECT plano, plano_ativo_ate FROM users WHERE id_users = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: "Erro na base de dados" });
      if (!rows.length) return res.status(404).json({ erro: "Utilizador não encontrado" });

      const user = rows[0];
      const agora = new Date();
      const ativo = user.plano === "pago" && (!user.plano_ativo_ate || new Date(user.plano_ativo_ate) > agora);

      // Se expirou, reverter para free
      if (user.plano === "pago" && !ativo) {
        db.query("UPDATE users SET plano = 'free' WHERE id_users = ?", [userId]);
      }

      res.json({ plano: ativo ? "pago" : "free", ativo_ate: user.plano_ativo_ate });
    }
  );
});

// ================== AI — RELATÓRIO SEMANAL ==================

// Obter relatório da semana passada (cached ou gerar)
app.get("/api/ai/report/:userId", limiterAI, async (req, res) => {
  const { userId } = req.params;

  // Verificar plano
  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate FROM users WHERE id_users = ?", [userId], (err, rows) => {
      resolve(err || !rows.length ? null : rows[0]);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });
  const agora = new Date();
  const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
  if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });

  // Calcular semana passada (segunda-feira anterior)
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom, 1=Seg...
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
  const segundaPassada = new Date(hoje);
  segundaPassada.setDate(hoje.getDate() - diasDesdeSegunda - 7);
  segundaPassada.setHours(0, 0, 0, 0);
  const domingoPassado = new Date(segundaPassada);
  domingoPassado.setDate(segundaPassada.getDate() + 6);
  domingoPassado.setHours(23, 59, 59, 999);
  const semanaInicio = segundaPassada.toISOString().split("T")[0];

  // Verificar cache
  const cached = await new Promise((resolve) => {
    db.query(
      "SELECT conteudo FROM ai_reports WHERE user_id = ? AND semana_inicio = ?",
      [userId, semanaInicio],
      (err, rows) => resolve(err || !rows.length ? null : rows[0].conteudo)
    );
  });
  if (cached) {
    try { return res.json({ sucesso: true, relatorio: JSON.parse(cached), semana_inicio: semanaInicio, cached: true }); }
    catch { return res.json({ sucesso: true, relatorio: cached, semana_inicio: semanaInicio, cached: true }); }
  }

  // Recolher dados da semana passada
  const treinos = await new Promise((resolve) => {
    db.query(
      `SELECT ts.id_sessao, ts.data_inicio, ts.duracao_segundos,
              t.nome AS nome_treino,
              GROUP_CONCAT(DISTINCT e.grupo_tipo ORDER BY e.grupo_tipo SEPARATOR ', ') AS musculos,
              COUNT(DISTINCT te.id_exercicio) AS num_exercicios,
              COALESCE(MAX(tse.peso), 0) AS peso_max
       FROM treino_sessao ts
       JOIN treino t ON ts.id_treino = t.id_treino
       LEFT JOIN treino_exercicio te ON te.id_treino = t.id_treino
       LEFT JOIN exercicios e ON e.id = te.id_exercicio
       LEFT JOIN treino_serie tse ON tse.id_sessao = ts.id_sessao AND tse.id_exercicio = te.id_exercicio
       WHERE ts.id_user = ? AND ts.data_inicio BETWEEN ? AND ? AND ts.concluido = 1
       GROUP BY ts.id_sessao, ts.data_inicio, ts.duracao_segundos, t.nome`,
      [userId, segundaPassada, domingoPassado],
      (err, rows) => resolve(err ? [] : rows)
    );
  });

  const perfil = await new Promise((resolve) => {
    db.query(
      "SELECT userName, objetivo, peso, altura, idade FROM users WHERE id_users = ?",
      [userId],
      (err, rows) => resolve(err || !rows.length ? {} : rows[0])
    );
  });

  if (treinos.length === 0) {
    return res.json({
      sucesso: true,
      relatorio: {
        avaliacao: "Não realizaste nenhum treino na semana passada.",
        equilibrio: "Sem dados para analisar.",
        progressao: "Sem dados para analisar.",
        descanso: "Sem dados para analisar.",
        melhorias: ["Começa a registar os teus treinos", "Define uma meta semanal", "Treina pelo menos 2 vezes esta semana"]
      },
      semana_inicio: semanaInicio,
      cached: false
    });
  }

  // Construir prompt
  const treinosSummary = treinos.map((t, i) => {
    const data = new Date(t.data_inicio).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit" });
    const duracao = t.duracao_segundos ? `${Math.round(t.duracao_segundos / 60)} min` : "duração desconhecida";
    return `  Treino ${i + 1} (${data}): "${t.nome_treino}", ${duracao}, músculos: ${t.musculos || "não registados"}, ${t.num_exercicios} exercícios, peso máximo: ${t.peso_max}kg`;
  }).join("\n");

  const prompt = `Analisa os dados de treino semanais de um utilizador da app GoLift e gera um relatório simples e motivador em português europeu.

Perfil: objetivo "${perfil.objetivo || "não definido"}", ${perfil.peso || "?"}kg, ${perfil.altura || "?"}cm, ${perfil.idade || "?"}anos.

Semana de ${semanaInicio}:
${treinosSummary}

Responde APENAS com JSON válido (sem markdown, sem código blocks) com exatamente esta estrutura:
{
  "avaliacao": "parágrafo curto de avaliação geral (máx 2 frases)",
  "equilibrio": "análise do equilíbrio muscular (máx 2 frases)",
  "progressao": "análise da progressão de cargas (máx 2 frases)",
  "descanso": "análise do descanso e recuperação (máx 2 frases)",
  "melhorias": ["melhoria concreta 1", "melhoria concreta 2", "melhoria concreta 3"]
}`;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    const relatorio = JSON.parse(text);

    // Guardar cache
    db.query(
      "INSERT INTO ai_reports (user_id, semana_inicio, conteudo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE conteudo = VALUES(conteudo)",
      [userId, semanaInicio, JSON.stringify(relatorio)]
    );

    console.log(`[AI] Relatório gerado para user ${userId} semana ${semanaInicio}`);
    res.json({ sucesso: true, relatorio, semana_inicio: semanaInicio, cached: false });
  } catch (err) {
    console.error("[AI] Erro ao gerar relatório:", err.message);
    res.status(500).json({ erro: "Erro ao gerar relatório. Tenta mais tarde." });
  }
});

// ================== AI — PLANO MENSAL ==================

// Obter plano do mês atual (cached ou null)
app.get("/api/ai/plan/:userId", limiterAI, async (req, res) => {
  const { userId } = req.params;

  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate, objetivo FROM users WHERE id_users = ?", [userId], (err, rows) => {
      resolve(err || !rows.length ? null : rows[0]);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });
  const agora = new Date();
  const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
  if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });

  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  const cached = await new Promise((resolve) => {
    db.query(
      "SELECT conteudo, criado_em FROM ai_planos WHERE user_id = ? AND mes = ?",
      [userId, mesAtual],
      (err, rows) => resolve(err || !rows.length ? null : rows[0])
    );
  });

  if (cached) {
    try { return res.json({ sucesso: true, plano: JSON.parse(cached.conteudo), mes: mesAtual, criado_em: cached.criado_em, pode_gerar: false }); }
    catch { return res.json({ sucesso: true, plano: cached.conteudo, mes: mesAtual, criado_em: cached.criado_em, pode_gerar: false }); }
  }

  res.json({ sucesso: true, plano: null, mes: mesAtual, pode_gerar: true });
});

// Gerar plano do mês
app.post("/api/ai/plan/:userId/generate", limiterAI, async (req, res) => {
  const { userId } = req.params;
  const { diasPorSemana = 4 } = req.body;

  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate, objetivo, peso, altura, idade FROM users WHERE id_users = ?", [userId], (err, rows) => {
      resolve(err || !rows.length ? null : rows[0]);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });
  const agora = new Date();
  const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
  if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });

  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const mesNome = agora.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  // Verificar se já gerou este mês
  const existe = await new Promise((resolve) => {
    db.query("SELECT id FROM ai_planos WHERE user_id = ? AND mes = ?", [userId, mesAtual], (err, rows) => {
      resolve(!err && rows.length > 0);
    });
  });
  if (existe) return res.status(400).json({ erro: "Já geraste o plano deste mês." });

  const prompt = `Cria um plano de treino semanal para ${mesNome} para um utilizador com:
- Objetivo: ${userRow.objetivo || "ganho de massa muscular"}
- Peso: ${userRow.peso || "?"}kg, Altura: ${userRow.altura || "?"}cm, Idade: ${userRow.idade || "?"}
- Disponibilidade: ${diasPorSemana} dias por semana

Responde APENAS com JSON válido (sem markdown, sem código blocks) com exatamente esta estrutura:
{
  "descricao": "breve descrição do método de treino escolhido (1-2 frases)",
  "split": [
    {
      "dia": "Segunda-feira",
      "foco": "nome do grupo muscular principal",
      "exercicios": [
        { "nome": "nome do exercício", "series": 4, "repeticoes": "8-12", "observacao": "dica curta opcional" }
      ]
    }
  ]
}
Inclui apenas os ${diasPorSemana} dias de treino (sem dias de descanso no array).`;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    const plano = JSON.parse(text);

    db.query(
      "INSERT INTO ai_planos (user_id, mes, conteudo) VALUES (?, ?, ?)",
      [userId, mesAtual, JSON.stringify(plano)],
      (err) => {
        if (err) { console.error("[AI] Erro ao guardar plano:", err); return res.status(500).json({ erro: "Erro ao guardar plano" }); }
        console.log(`[AI] Plano gerado para user ${userId} mês ${mesAtual}`);
        res.json({ sucesso: true, plano, mes: mesAtual, pode_gerar: false });
      }
    );
  } catch (err) {
    console.error("[AI] Erro ao gerar plano:", err.message);
    res.status(500).json({ erro: "Erro ao gerar plano. Tenta mais tarde." });
  }
});

// ================== 404 HANDLER ==================
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

// ================== INICIAR SERVIDOR ==================
// Iniciar servidor com informações de debug
app.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log("\n" + "=".repeat(70));
  console.log("✓ Servidor GoLift iniciado com sucesso!");
  console.log("=".repeat(70));
  console.log(`📍 IP Local do Servidor: ${SERVER_IP}`);
  console.log(`🔌 Porta: ${SERVER_PORT}`);
  console.log(`🌐 URL da API: http://${SERVER_IP}:${SERVER_PORT}`);
  console.log(`🔗 Localhost: http://localhost:${SERVER_PORT}`);
  console.log("");
  console.log("🤖 AUTO-CONFIGURAÇÃO DO CLIENTE:");
  console.log(`   📌 Rota: GET /api/server-info`);
  console.log(`   ℹ️  Retorna o IP correto e URL da API automaticamente`);
  console.log(`   🔗 Teste: http://${SERVER_IP}:${SERVER_PORT}/api/server-info`);
  console.log("=".repeat(70) + "\n");
  
  // Fazer um request de teste após 1 segundo para confirmar que está funcionando
  setTimeout(() => {
    const testUrl = `http://localhost:${SERVER_PORT}/api/health`;
    
    http.get(testUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          JSON.parse(data);
        } catch (e) {
          console.error(`⚠️ Erro ao parsear resposta: ${e.message}`);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Erro no request de teste: ${err.message}`);
    });
  }, 1000);
});
