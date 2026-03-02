// server.js — Clean, modular, professional
require('dotenv').config();
const fetch = require("node-fetch");

// --- Segurança: JWT_SECRET obrigatório ---
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'golift_super_secret') {
  console.error('[SECURITY] JWT_SECRET não definido ou inseguro.');
  process.exit(1);
}

// --- Dependências principais ---
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const http       = require('http');
const os         = require('os');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcrypt');
const mysql      = require('mysql2');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');

// --- isAdmin middleware (inline routes) ---
const { isAdmin } = require('./middleware/permissions.middleware');

// --- Rate limiter ---
const rateLimit = require('express-rate-limit');
const limiterAI = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { erro: 'Demasiados pedidos. Tenta novamente mais tarde.' }
});

// --- Constantes GORQ ---
const GORQ_API_KEY  = process.env.GORQ_API_KEY;
const GORQ_BASE_URL = "https://api.gorq.ai/v1";

// --- Inicialização do app ---
const app = express();
app.use(helmet());

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.CLIENT_URL, 'https://app.golift.pt']
  : undefined;

app.use(cors({ origin: allowedOrigins || '*', credentials: true }));
app.use(express.json());
app.set('trust proxy', 1);

// --- Middleware de autenticação JWT ---
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação em falta.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
};

// --- Ligação à base de dados ---
const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'golift',
  waitForConnections: true,
  connectionLimit: 10,
});

// --- Reset codes para recuperação de password (único Map consolidado) ---
const resetCodes = new Map();

// --- Nodemailer transporter (usa EMAIL_USER + EMAIL_APP_PASS do .env) ---
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS,
  },
});

async function sendRecoveryEmail(email, code) {
  await mailTransporter.sendMail({
    from:    `"GoLift" <${process.env.EMAIL_USER}>`,
    to:      email,
    subject: 'GoLift — Código de recuperação de password',
    text:    `O teu código de recuperação é: ${code}\nExpira em 15 minutos.`,
    html:    `<p>O teu código de recuperação é: <strong>${code}</strong></p><p>Expira em 15 minutos.</p>`,
  });
}

// --- SERVER_PORT / SERVER_IP ---
const SERVER_PORT = process.env.PORT || 5000;
const SERVER_IP = (() => {
  const interfaces = os.networkInterfaces();
  let wifiIP = null, ethernetIP = null, anyIP = null, virtualIP = null;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.56.') || iface.address.startsWith('10.0.2.') || iface.address.startsWith('172.')) {
          virtualIP = iface.address; continue;
        }
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) wifiIP = iface.address;
        else if (name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('eth')) ethernetIP = iface.address;
        else if (!anyIP) anyIP = iface.address;
      }
    }
  }
  return wifiIP || ethernetIP || anyIP || virtualIP || 'localhost';
})();

// --- gorqGenerate ---
async function gorqGenerate({ prompt, type = "plan", diasPorSemana = 4 }) {
  const url = GORQ_BASE_URL + (type === "plan" ? "/plan" : "/report");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GORQ_API_KEY}` },
    body: JSON.stringify({ prompt, diasPorSemana }),
  });
  if (!res.ok) throw new Error(`[GORQ] ${res.status} ${res.statusText}`);
  return res.json();
}

// --- geminiGenerate (usado em /api/daily-phrase) ---
async function geminiGenerate(prompt) {
  throw new Error("geminiGenerate não configurado");
}

// --- Modular route imports ---
// Rotas modulares sem conflito — mantidas activas
// const sessoesRoutes   = require('./routes/sessoes/sessoes.routes'); // rota inline em /api/sessoes/:userId sobrepõe-se
const utilsRoutes     = require('./routes/utils/utils.routes');
const treinoRoutes    = require('./routes/treino/treino.routes');
const authRoutes      = require('./routes/auth/auth.routes');
const userRoutes      = require('./routes/user/user.routes');
const adminRoutes     = require('./routes/admin/admin.routes');

// ⚠️ CONFLITO RESOLVIDO (02/03/2026): módulos abaixo interceptavam rotas inline com stubs/queries erradas
// const recordesRoutes  = require('./routes/recordes/recordes.routes');     // inline L1088 é a correcta
// const planoRoutes     = require('./routes/plano/plano.routes');           // inline L1701 é a correcta
// const aiRoutes        = require('./routes/ai/ai.routes');                 // inline L1724+ é a correcta
// const stripeRoutes    = require('./routes/stripe/stripe.routes');         // inline L1674, L2031 são as correctas
// const comunidadeRoutes= require('./routes/comunidade/comunidade.routes');// inline L1458+ é a correcta (excepto PUT /:id — migrado inline)

// --- Registo das rotas ---
app.use('/api',            utilsRoutes);
// app.use('/api/recordes',   recordesRoutes);  // CONFLITO — inline L1088
// app.use('/api/sessoes',    sessoesRoutes);    // rota inline em server.js linha ~532 é a correcta
// app.use('/api/plano',      planoRoutes);      // CONFLITO — inline L1701
// app.use('/api/ai',         aiRoutes);         // CONFLITO — inline L1724+
// app.use('/api/stripe',     stripeRoutes);     // CONFLITO — inline L1674, L2031
// app.use('/api/comunidades',comunidadeRoutes); // CONFLITO — inline L1458+
app.use('/api/treinos',    treinoRoutes);
app.use('/api',            authRoutes);
app.use('/api',            userRoutes);  // expõe /api/profile/:userId
app.use('/api/admin',      adminRoutes);

// ... resto das rotas inline a seguir ...

// Rota para obter informações do servidor (para auto-config no cliente)
app.get("/api/server-info", (req, res) => {
  let clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || "Desconhecido";
  
  if (clientIP.includes("::ffff:")) {
    clientIP = clientIP.split("::ffff:")[1];
  }
  
  let serverIPToReturn = SERVER_IP;
  
  if (clientIP && clientIP !== "Desconhecido" && !clientIP.includes("127.0.0.1")) {
    const clientSubnet = clientIP.substring(0, clientIP.lastIndexOf("."));
    const serverSubnet = SERVER_IP.substring(0, SERVER_IP.lastIndexOf("."));
    
    if (clientSubnet === serverSubnet) {
      serverIPToReturn = SERVER_IP;
    } else if (clientIP === "127.0.0.1" || clientIP === "localhost") {
      serverIPToReturn = "localhost";
    }
  }
  
  if (!serverIPToReturn || serverIPToReturn === "localhost") {
    serverIPToReturn = "localhost";
  }
  
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

// Rota de health check
app.get("/api/health", (req, res) => {
  res.json({ sucesso: true, mensagem: "Servidor online" });
});

// Rota para obter o streak de treinos do utilizador
app.get("/api/streak/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

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

    // --- currentStreak: dias consecutivos a partir de hoje ---
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (rows.length > 0) {
      const firstDate = new Date(rows[0].data_treino);
      firstDate.setHours(0, 0, 0, 0);
      const diffToday = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));

      if (diffToday <= 1) { // treinou hoje ou ontem — streak activo
        currentStreak = 1;
        for (let i = 1; i < rows.length; i++) {
          const prev = new Date(rows[i - 1].data_treino);
          const curr = new Date(rows[i].data_treino);
          prev.setHours(0, 0, 0, 0);
          curr.setHours(0, 0, 0, 0);
          const diff = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
          if (diff === 1) { currentStreak++; } else { break; }
        }
      }
    }

    // --- maxStreak: máximo histórico sobre todas as datas ---
    let maxStreak = 0;
    let tempStreak = rows.length > 0 ? 1 : 0;
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].data_treino);
      const curr = new Date(rows[i].data_treino);
      prev.setHours(0, 0, 0, 0);
      curr.setHours(0, 0, 0, 0);
      const diff = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;

    res.json({
      sucesso: true,
      streak: currentStreak,
      maxStreak
    });
  });
});

// ---------- Admin API routes ----------

app.get("/api/admin/stats", authenticateJWT, isAdmin, async (req, res) => {
  try {
    const pool = db.promise();

    const [
      [totalUsersRows],
      [totalTreinosRows],
      [totalExercisesRows],
      [totalAdminsRows],
      [proUsersRows],
      [newUsersRows],
      [sessionsRows],
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM users'),
      pool.query('SELECT COUNT(*) AS total FROM treino'),
      pool.query('SELECT COUNT(*) AS total FROM exercicios'),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE id_tipoUser = 1"),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE plano = 'pago' AND (plano_ativo_ate IS NULL OR plano_ativo_ate > NOW())"),
      pool.query('SELECT COUNT(*) AS total FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
      pool.query('SELECT COUNT(*) AS total FROM treino_sessao WHERE data_fim IS NOT NULL AND data_fim >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
    ]);

    res.json({
      totalUsers:       totalUsersRows[0].total,
      totalTreinos:     totalTreinosRows[0].total,
      totalExercises:   totalExercisesRows[0].total,
      totalAdmins:      totalAdminsRows[0].total,
      proUsers:         proUsersRows[0].total,
      newUsersThisWeek: newUsersRows[0].total,
      sessionsThisWeek: sessionsRows[0].total,
    });
  } catch (err) {
    console.error('[admin.stats]', err);
    res.status(500).json({ erro: 'Erro ao obter estatísticas' });
  }
});

app.get("/api/admin/exercicios", authenticateJWT, isAdmin, (req, res) => {
  const sql = "SELECT id_exercicio as id, nome, descricao, video, recorde_pessoal as recorde_pessoal, grupo_tipo, sub_tipo FROM exercicios ORDER BY nome ASC";
  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro ao obter exercícios." });
    }
    res.json(rows);
  });
});

app.post("/api/admin/exercicios", authenticateJWT, isAdmin, (req, res) => {
  const { nome, descricao, video, recorde_pessoal, grupo_tipo, sub_tipo } = req.body;
  if (!nome) return res.status(400).json({ erro: "Nome do exercício é obrigatório." });

  db.query("SELECT * FROM exercicios WHERE nome = ? LIMIT 1", [nome], (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados." });
    if (rows.length > 0) return res.status(409).json({ erro: "Exercício já existe." });

    db.query("INSERT INTO exercicios (nome, descricao, video, recorde_pessoal, grupo_tipo, sub_tipo) VALUES (?, ?, ?, ?, ?, ?)", [nome, descricao || null, video || null, recorde_pessoal || null, grupo_tipo || null, sub_tipo || null], (err2, result) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ erro: "Erro ao adicionar exercício." });
      }
      res.json({ sucesso: true, id: result.insertId, nome });
    });
  });
});

app.delete("/api/admin/exercicios/:nome", authenticateJWT, isAdmin, (req, res) => {
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

app.get("/api/exercicios", authenticateJWT, (req, res) => {
  if (!db) {
    return res.status(500).json({ erro: "Erro de conexão à base de dados.", detalhes: "Conexão não inicializada" });
  }

  const sql = "SELECT id_exercicio as id, nome, descricao, video, grupo_tipo as category, sub_tipo as subType FROM exercicios ORDER BY nome ASC";
  
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("[API] /api/exercicios - Erro na query:", err);
      return res.status(500).json({ erro: "Erro ao obter exercícios.", detalhes: err.sqlMessage || err.message, code: err.code });
    }
    
    const result = Array.isArray(rows) ? rows : [];
    res.json(result);
  });
});

app.post("/api/treino", authenticateJWT, (req, res) => {
  const userId = req.user.id;
  const { nome, exercicios, dataRealizacao } = req.body;

  if (!nome || !exercicios || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({ erro: "nome e lista de exercícios são obrigatórios." });
  }

  if (nome.trim().length === 0) {
    return res.status(400).json({ erro: "O nome do treino não pode estar vazio." });
  }

  console.log(`[TREINO] Criar: userId=${userId} nome="${nome}" exercicios=[${exercicios.join(',')}]`);

  db.query("SELECT id_users FROM users WHERE id_users = ?", [userId], (err, userRows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: "Erro na base de dados." });
    }
    if (userRows.length === 0) {
      return res.status(404).json({ erro: "Utilizador não encontrado." });
    }

    db.query("SELECT COALESCE(MAX(id_treino), 0) + 1 as nextId FROM treino", (err, idRows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: "Erro ao obter próximo ID de treino." });
      }

      const newTreinoId = idRows[0].nextId;
      const dataTreino = dataRealizacao || new Date().toISOString().split('T')[0];

      db.query("INSERT INTO treino (id_treino, id_users, nome, data_treino) VALUES (?, ?, ?, ?)", 
        [newTreinoId, userId, nome.trim(), dataTreino], (err, result) => {
        if (err) {
          console.error("[API] POST /api/treino - Erro ao inserir treino:", err);
          return res.status(500).json({ erro: "Erro ao criar treino.", detalhes: err.sqlMessage || err.message });
        }

        insertExercicios();

        function insertExercicios() {
          const exercicioValues = exercicios.map(exId => [newTreinoId, exId]);
          const placeholders = exercicios.map(() => "(?, ?)").join(", ");
          const values = exercicioValues.flat();

          db.query(`INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES ${placeholders}`,
            values, (err2) => {
            if (err2) {
              console.error("[API] POST /api/treino - Erro ao inserir exercícios:", err2);
              return res.status(500).json({ erro: "Treino criado mas erro ao guardar exercícios.", detalhes: err2.sqlMessage || err2.message });
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

app.get("/api/sessoes/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

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

app.get("/api/sessao/detalhes/:sessaoId", authenticateJWT, (req, res) => {
  const { sessaoId } = req.params;

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
    const exerciciosMap = {};
    const recordes = [];

    rows.forEach(row => {
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

app.get("/api/treino-com-data/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

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
      data_inicio: treino.data_treino,
      num_exercicios: treino.num_exercicios || 0,
      exercicios_nomes: treino.exercicios_nomes || "",
      grupo_tipo: treino.grupo_tipo || null
    }));

    res.json(treinos);
  });
});

app.get("/api/treino/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const sqlWithNome = `
    SELECT 
      t.id_treino,
      t.nome,
      t.data_treino,
      t.is_ia,
      COUNT(te.id_exercicio) as num_exercicios,
      GROUP_CONCAT(e.nome SEPARATOR ', ') as exercicios_nomes,
      GROUP_CONCAT(DISTINCT e.grupo_tipo SEPARATOR ', ') as grupo_tipo
    FROM treino t
    LEFT JOIN treino_exercicio te ON t.id_treino = te.id_treino
    LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio
    WHERE t.id_users = ?
    GROUP BY t.id_treino, t.nome, t.data_treino, t.is_ia
    ORDER BY t.data_treino DESC, t.id_treino DESC
  `;

  db.query(sqlWithNome, [userId], (err, rows) => {
    if (err) {
      console.error(`❌ Erro ao carregar treinos do user ${userId}:`, err.message);
      
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
            nome: `Treino ${treino.id_treino}`,
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
    
    const treinosComExercicios = rows.map(treino => ({
      id_treino: treino.id_treino,
      nome: treino.nome || `Treino ${treino.id_treino}`,
      data_treino: treino.data_treino,
      is_ia: treino.is_ia || 0,
      num_exercicios: treino.num_exercicios || 0,
      exercicios_nomes: treino.exercicios_nomes || "",
      grupo_tipo: treino.grupo_tipo || null
    }));

    res.json(treinosComExercicios);
  });
});

// IMPORTANTE: Esta rota DEVE estar ANTES de /api/treino/:userId/:treinoId
app.get("/api/treino/sessao/:sessaoId", authenticateJWT, (req, res) => {
  const { sessaoId } = req.params;

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

            const exerciciosComSeries = exercicios.map(ex => {
              const seriesDoExercicio = seriesAnteriores.filter(s => s.id_exercicio === ex.id);
              return { ...ex, series: seriesDoExercicio };
            });

            res.json({
              id_sessao: sessao.id_sessao,
              id_treino: sessao.id_treino,
              data_inicio: sessao.data_inicio,
              exercicios: exerciciosComSeries
            });
          });
        } else {
          const exerciciosComSeries = exercicios.map(ex => ({ ...ex, series: [] }));

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

app.get("/api/treino/:userId/:treinoId", authenticateJWT, (req, res) => {
  const { userId, treinoId } = req.params;

  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    const treino = treinoRows[0];

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

app.put("/api/treino/:userId/:treinoId", authenticateJWT, (req, res) => {
  const { userId, treinoId } = req.params;
  const { nome, exercicios } = req.body;

  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] PUT /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    if (nome && nome.trim().length > 0) {
      db.query("UPDATE treino SET nome = ? WHERE id_treino = ? AND id_users = ?", 
        [nome.trim(), treinoId, userId], (err2) => {
        if (err2) {
          console.error("[API] PUT /api/treino/:userId/:treinoId - Erro ao atualizar nome:", err2);
          return res.status(500).json({ erro: "Erro ao atualizar nome do treino.", detalhes: err2.sqlMessage });
        }
        atualizarExercicios();
      });
    } else {
      atualizarExercicios();
    }

    function atualizarExercicios() {
      if (exercicios && Array.isArray(exercicios)) {
        db.query("DELETE FROM treino_exercicio WHERE id_treino = ?", [treinoId], (err3) => {
          if (err3) {
            console.error("[API] PUT /api/treino/:userId/:treinoId - Erro ao apagar exercícios:", err3);
            return res.status(500).json({ erro: "Erro ao atualizar exercícios.", detalhes: err3.sqlMessage });
          }

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
        res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
      }
    }
  });
});

app.delete("/api/treino/:userId/:treinoId", authenticateJWT, (req, res) => {
  const { userId, treinoId } = req.params;

  db.query("SELECT * FROM treino WHERE id_treino = ? AND id_users = ?", [treinoId, userId], (err, treinoRows) => {
    if (err) {
      console.error("[API] DELETE /api/treino/:userId/:treinoId - Erro:", err);
      return res.status(500).json({ erro: "Erro ao verificar treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    db.query("SELECT id_sessao FROM treino_sessao WHERE id_treino = ?", [treinoId], (err2, sessoes) => {
      if (err2) {
        console.error("[API] DELETE /api/treino - Erro ao obter sessões:", err2);
        return res.status(500).json({ erro: "Erro ao apagar treino." });
      }

      const sessaoIds = sessoes.map(s => s.id_sessao);

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
        db.query("DELETE FROM treino_sessao WHERE id_treino = ?", [treinoId], (err4) => {
          if (err4) {
            console.error("[API] DELETE /api/treino - Erro ao apagar sessões:", err4);
            return res.status(500).json({ erro: "Erro ao apagar sessões do treino." });
          }

          db.query("DELETE FROM treino_exercicio WHERE id_treino = ?", [treinoId], (err5) => {
            if (err5) {
              console.error("[API] DELETE /api/treino - Erro ao apagar exercícios:", err5);
              return res.status(500).json({ erro: "Erro ao apagar exercícios do treino." });
            }

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

app.post("/api/treino/sessao/guardar", authenticateJWT, (req, res) => {
  const userId = req.user.id;
  const { treinoId, duracao_segundos, series } = req.body;

  if (!treinoId || !series || !Array.isArray(series) || series.length === 0) {
    return res.status(400).json({ erro: "treinoId e series são obrigatórios." });
  }

  console.log(`[SESSAO] Guardar: userId=${userId} treinoId=${treinoId} duracao=${duracao_segundos}s series=${series.length}`);

  db.query(
    "INSERT INTO treino_sessao (id_treino, id_users, data_fim, duracao_segundos) VALUES (?, ?, NOW(), ?)",
    [treinoId, userId, duracao_segundos || 0],
    (err, result) => {
      if (err) {
        console.error("[API] POST /api/treino/sessao/guardar - Erro ao criar sessão:", err);
        return res.status(500).json({ erro: "Erro ao guardar sessão." });
      }

      const sessaoId = result.insertId;

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

          db.query("UPDATE treino SET status = 'completed' WHERE id_treino = ?", [treinoId], (err3) => {
            if (err3) {
              console.warn("[API] POST /api/treino/sessao/guardar - Erro ao atualizar status:", err3);
            }
            console.log(`[SESSAO] userId=${userId} treinoId=${treinoId} sessaoId=${sessaoId} duracao=${duracao_segundos || 0}s series=${series.length}`);
            res.json({ sucesso: true, mensagem: "Treino guardado com sucesso!", id_sessao: sessaoId });
          });
        }
      );
    }
  );
});

app.get("/api/treino-sessao-detalhes/:sessaoId", authenticateJWT, (req, res) => {
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

app.get("/api/recordes/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: "Acesso negado." });
  }
  
  const sql = `
    SELECT 
      e.nome as nome_exercicio,
      MAX(ts.peso) as peso,
      MAX(ts.data_serie) as data_serie
    FROM treino_serie ts
    INNER JOIN treino_sessao sess ON ts.id_sessao = sess.id_sessao
    INNER JOIN exercicios e ON ts.id_exercicio = e.id_exercicio
    WHERE sess.id_users = ? AND ts.peso > 0
    GROUP BY ts.id_exercicio, e.nome
    ORDER BY MAX(ts.peso) DESC
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

app.get("/api/treino/detalhes/:treinoId/:dataIso", authenticateJWT, (req, res) => {
  const { treinoId, dataIso } = req.params;

  db.query("SELECT * FROM treino WHERE id_treino = ?", [treinoId], (err, treinoRows) => {
    if (err) {
      console.error("[API] /api/treino/detalhes - Erro:", err);
      return res.status(500).json({ erro: "Erro ao obter treino." });
    }

    if (treinoRows.length === 0) {
      return res.status(404).json({ erro: "Treino não encontrado." });
    }

    const treino = treinoRows[0];

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
        return res.json({ nome: treino.nome || "Treino", data: treino.data_treino, exercicios: [] });
      }

      db.query(
        "SELECT id_sessao, data_inicio FROM treino_sessao WHERE id_treino = ? AND DATE(data_inicio) = ? ORDER BY data_inicio DESC LIMIT 1",
        [treinoId, dataIso],
        (err3, sessaoRows) => {
          if (err3 || sessaoRows.length === 0) {
            const exercicios = exerciciosRows.map(ex => ({ nome: ex.exercicio, series: [] }));
            return res.json({ nome: treino.nome || "Treino", data: treino.data_treino, exercicios: exercicios });
          }

          const sessaoId = sessaoRows[0].id_sessao;

          const sqlSeries = `
            SELECT ts.id_exercicio, ts.numero_serie, ts.repeticoes, ts.peso
            FROM treino_serie ts
            WHERE ts.id_sessao = ?
            ORDER BY ts.numero_serie ASC
          `;

          db.query(sqlSeries, [sessaoId], (err4, seriesRows) => {
            if (err4) {
              console.error("[API] /api/treino/detalhes - Erro ao buscar séries:", err4);
            }

            const seriesMap = {};
            (seriesRows || []).forEach(row => {
              if (!seriesMap[row.id_exercicio]) {
                seriesMap[row.id_exercicio] = [];
              }
              seriesMap[row.id_exercicio].push({ numero: row.numero_serie, repeticoes: row.repeticoes, peso: row.peso });
            });

            const exercicios = exerciciosRows.map(ex => ({
              nome: ex.exercicio,
              series: seriesMap[ex.id_exercicio] || []
            }));

            res.json({ nome: treino.nome || "Treino", data: treino.data_treino, exercicios: exercicios });
          });
        }
      );
    });
  });
});

// ============ ROTAS DE TREINOS PARA ADMINS ============

app.get("/api/treino-admin", authenticateJWT, isAdmin, (req, res) => {
  const sql = `SELECT ta.id_treino_admin, ta.nome, ta.criado_em FROM treino_admin ta ORDER BY ta.criado_em DESC`;
  
  db.query(sql, (err, treinosRows) => {
    if (err) {
      console.error("Erro ao obter treinos de admin:", err);
      return res.status(500).json({ erro: "Erro ao obter treinos." });
    }

    if (treinosRows.length === 0) return res.json([]);

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
        if (err) { console.error("Erro ao obter exercícios do treino admin:", err); exerciciosRows = []; }

        resultado.push({
          id_treino_admin: treino.id_treino_admin,
          nome: treino.nome,
          exercicios: exerciciosRows.map((ex) => ({ id: ex.id_exercicio, name: ex.nome, category: ex.grupo_tipo })),
          criado_em: treino.criado_em,
        });

        processados++;
        if (processados === treinosRows.length) res.json(resultado);
      });
    });
  });
});

app.get("/api/treinos-admin", authenticateJWT, isAdmin, (req, res) => {
  const sql = `SELECT ta.id_treino_admin, ta.nome, ta.criado_em FROM treino_admin ta ORDER BY ta.criado_em DESC`;
  
  db.query(sql, (err, treinosRows) => {
    if (err) { console.error("Erro ao obter treinos de admin:", err); return res.status(500).json({ erro: "Erro ao obter treinos." }); }
    if (!treinosRows || treinosRows.length === 0) return res.json([]);

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
        if (!err) resultado.push({ ...treino, exercicios: exercicios || [] });
        processados++;
        if (processados === treinosRows.length) res.json(resultado);
      });
    });
  });
});

app.get("/api/treino-admin/:id", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;

  db.query("SELECT ta.id_treino_admin, ta.nome FROM treino_admin ta WHERE ta.id_treino_admin = ?", [id], (err, treinosRows) => {
    if (err) { console.error("Erro ao obter treino admin:", err); return res.status(500).json({ erro: "Erro ao obter treino." }); }
    if (treinosRows.length === 0) return res.status(404).json({ erro: "Treino não encontrado." });

    const treino = treinosRows[0];

    const sqlExercicos = `
      SELECT e.id_exercicio, e.nome, e.grupo_tipo
      FROM exercicios e
      INNER JOIN treino_admin_exercicio tae ON e.id_exercicio = tae.id_exercicio
      WHERE tae.id_treino_admin = ?
      ORDER BY tae.id_treino_admin_exercicio ASC
    `;

    db.query(sqlExercicos, [id], (err, exerciciosRows) => {
      if (err) { console.error("Erro ao obter exercícios:", err); exerciciosRows = []; }

      res.json({
        id_treino_admin: treino.id_treino_admin,
        nome: treino.nome,
        exercicios: exerciciosRows.map((ex) => ({ id: ex.id_exercicio, name: ex.nome, category: ex.grupo_tipo })),
      });
    });
  });
});

app.post("/api/treino-admin", authenticateJWT, isAdmin, (req, res) => {
  const { nome, exercicios } = req.body;

  if (!nome || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({ sucesso: false, erro: "Nome e exercícios são obrigatórios." });
  }

  db.query("INSERT INTO treino_admin (nome, criado_em) VALUES (?, NOW())", [nome], (err, result) => {
    if (err) { console.error("Erro ao criar treino admin:", err); return res.status(500).json({ sucesso: false, erro: "Erro ao criar treino." }); }

    const treinoAdminId = result.insertId;
    let inseridos = 0;
    let erroOcorreu = false;

    exercicios.forEach((exercicioId) => {
      db.query("INSERT INTO treino_admin_exercicio (id_treino_admin, id_exercicio) VALUES (?, ?)", [treinoAdminId, exercicioId], (err) => {
        if (err) { console.error("Erro ao inserir exercício no treino admin:", err); erroOcorreu = true; }
        inseridos++;
        if (inseridos === exercicios.length) {
          if (erroOcorreu) return res.status(500).json({ sucesso: false, erro: "Erro ao adicionar alguns exercícios ao treino." });
          res.json({ sucesso: true, mensagem: "Treino criado com sucesso!", id_treino_admin: treinoAdminId });
        }
      });
    });
  });
});

app.put("/api/treino-admin/:id", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nome, exercicios } = req.body;

  if (!nome || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({ sucesso: false, erro: "Nome e exercícios são obrigatórios." });
  }

  db.query("UPDATE treino_admin SET nome = ?, atualizado_em = NOW() WHERE id_treino_admin = ?", [nome, id], (err) => {
    if (err) { console.error("Erro ao atualizar treino admin:", err); return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar treino." }); }

    db.query("DELETE FROM treino_admin_exercicio WHERE id_treino_admin = ?", [id], (err) => {
      if (err) { console.error("Erro ao deletar exercícios antigos:", err); return res.status(500).json({ sucesso: false, erro: "Erro ao atualizar exercícios." }); }

      if (exercicios.length === 0) return res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!", id_treino_admin: id });

      let inseridos = 0;
      let erroOcorreu = false;
      const erros = [];

      exercicios.forEach((exercicioId) => {
        db.query("INSERT INTO treino_admin_exercicio (id_treino_admin, id_exercicio) VALUES (?, ?)", [id, exercicioId], (err) => {
          if (err) { console.error(`Erro ao inserir exercício ${exercicioId}:`, err); erroOcorreu = true; erros.push(exercicioId); }
          inseridos++;
          if (inseridos === exercicios.length) {
            if (erroOcorreu) return res.status(500).json({ sucesso: false, erro: `Erro ao adicionar exercícios: ${erros.join(', ')}` });
            res.json({ sucesso: true, mensagem: "Treino atualizado com sucesso!" });
          }
        });
      });
    });
  });
});

app.delete("/api/treino-admin/:id", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM treino_admin WHERE id_treino_admin = ?", [id], (err) => {
    if (err) { console.error("Erro ao deletar treino admin:", err); return res.status(500).json({ sucesso: false, erro: "Erro ao deletar treino." }); }
    res.json({ sucesso: true, mensagem: "Treino deletado com sucesso!" });
  });
});

// ============ RECUPERAÇÃO DE SENHA ============

app.post("/api/recuperar-senha", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ erro: "Email é obrigatório." });

  db.query("SELECT id_users, userName FROM users WHERE email = ?", [email], async (err, rows) => {
    if (err) { console.error("Erro ao verificar email:", err); return res.status(500).json({ erro: "Erro na base de dados." }); }
    if (rows.length === 0) return res.status(404).json({ erro: "Email não encontrado." });

    const code = crypto.randomInt(100000, 999999).toString();
    resetCodes.set(email, { code, expiresAt: Date.now() + 15 * 60 * 1000, userId: rows[0].id_users });

    try {
      await sendRecoveryEmail(email, code);
    } catch (mailErr) {
      console.error('[recuperar-senha] Erro ao enviar email:', mailErr.message);
      return res.status(500).json({ erro: 'Erro ao enviar email de recuperação.' });
    }

    res.json({ sucesso: true, mensagem: "Código de recuperação enviado para o email." });
  });
});

app.post("/api/verificar-codigo", (req, res) => {
  const { email, codigo } = req.body;
  if (!email || !codigo) return res.status(400).json({ erro: "Email e código são obrigatórios." });

  const recovery = resetCodes.get(email);
  if (!recovery) return res.status(400).json({ erro: "Nenhum código de recuperação encontrado. Solicite um novo." });
  if (Date.now() > recovery.expiresAt) { resetCodes.delete(email); return res.status(400).json({ erro: "Código expirado. Solicite um novo." }); }
  if (recovery.code !== codigo) return res.status(400).json({ erro: "Código inválido." });

  res.json({ sucesso: true, mensagem: "Código válido." });
});

app.post("/api/redefinir-senha", async (req, res) => {
  const { email, codigo, novaSenha } = req.body;
  if (!email || !codigo || !novaSenha) return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  if (novaSenha.length < 6) return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });

  const recovery = resetCodes.get(email);
  if (!recovery) return res.status(400).json({ erro: "Nenhum código de recuperação encontrado." });
  if (Date.now() > recovery.expiresAt) { resetCodes.delete(email); return res.status(400).json({ erro: "Código expirado. Solicite um novo." }); }
  if (recovery.code !== codigo) return res.status(400).json({ erro: "Código inválido." });

  try {
    const hashedPassword = await bcrypt.hash(novaSenha, 10);
    db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email], (err) => {
      if (err) { console.error("Erro ao atualizar senha:", err); return res.status(500).json({ erro: "Erro ao atualizar senha." }); }
      resetCodes.delete(email);
      res.json({ sucesso: true, mensagem: "Senha alterada com sucesso!" });
    });
  } catch (error) {
    console.error("Erro ao fazer hash da senha:", error);
    return res.status(500).json({ erro: "Erro ao processar senha." });
  }
});

app.get('/api/treino-user/:treino_id/exercicios', authenticateJWT, (req, res) => {
  const { treino_id } = req.params;

  console.log(`📋 Carregando exercícios do treino ID: ${treino_id}`);

  const sql = `
    SELECT e.id_exercicio, e.nome, e.descricao, e.grupo_tipo, e.sub_tipo
    FROM treino_exercicio te 
    LEFT JOIN exercicios e ON te.id_exercicio = e.id_exercicio 
    WHERE te.id_treino = ?`;

  db.query(sql, [treino_id], (err, rows) => {
    if (err) {
      console.error(`❌ Erro ao obter exercícios do treino ${treino_id}:`, err.message);
      return res.status(500).json({ sucesso: false, erro: 'Erro ao obter exercícios', detalhes: err.message, treino_id });
    }

    console.log(`✅ Treino ${treino_id}: ${rows?.length || 0} exercícios encontrados`);
    res.json({ sucesso: true, exercicios: rows || [], treino_id, total: rows?.length || 0 });
  });
});

app.delete('/api/treino-user/:treino_id/exercicios/:exercicio_id', authenticateJWT, (req, res) => {
  const { treino_id, exercicio_id } = req.params;

  db.query('DELETE FROM treino_exercicio WHERE id_treino = ? AND id_exercicio = ?', [treino_id, exercicio_id], (err) => {
    if (err) { console.error('Erro ao remover exercício:', err); return res.status(500).json({ sucesso: false, erro: 'Erro ao remover exercício' }); }
    res.json({ sucesso: true, mensagem: 'Exercício removido com sucesso' });
  });
});

// ================== ENDPOINTS DE COMUNIDADES ==================

app.get("/api/comunidades", authenticateJWT, (req, res) => {
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    WHERE c.verificada = 1
    ORDER BY c.criada_em DESC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.error("Erro ao obter comunidades:", err); return res.status(500).json({ erro: "Erro ao obter comunidades" }); }
    res.json(results || []);
  });
});

app.get("/api/comunidades/user/:userId", authenticateJWT, (req, res) => {
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
    if (err) { console.error("Erro ao obter comunidades do utilizador:", err); return res.status(500).json({ erro: "Erro ao obter comunidades" }); }
    res.json(results || []);
  });
});

app.post("/api/comunidades", authenticateJWT, (req, res) => {
  const criador_id = req.user.id;
  const { nome, descricao, pais, linguas, privada } = req.body;
  if (!nome || !descricao) return res.status(400).json({ erro: "Nome e descrição são obrigatórios" });

  db.query("INSERT INTO comunidades (nome, descricao, criador_id, pais, linguas, privada, verificada) VALUES (?, ?, ?, ?, ?, ?, 0)",
    [nome, descricao, criador_id, pais || null, linguas || null, privada ? 1 : 0], (err, result) => {
    if (err) { console.error("Erro ao criar comunidade:", err); return res.status(500).json({ erro: "Erro ao criar comunidade" }); }
    db.query("INSERT INTO comunidade_membros (comunidade_id, user_id) VALUES (?, ?)", [result.insertId, criador_id], (err) => {
      if (err) console.error("Erro ao adicionar criador como membro:", err);
    });
    res.status(201).json({ sucesso: true, id: result.insertId, mensagem: "Comunidade criada! Aguarde aprovação do admin." });
  });
});

app.post("/api/comunidades/:id/join", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query("INSERT INTO comunidade_membros (comunidade_id, user_id) VALUES (?, ?)", [id, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: "Você já é membro desta comunidade" });
      console.error("Erro ao entrar na comunidade:", err);
      return res.status(500).json({ erro: "Erro ao entrar na comunidade" });
    }
    res.json({ sucesso: true, mensagem: "Entrou na comunidade com sucesso" });
  });
});

app.post("/api/comunidades/:id/leave", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.query("DELETE FROM comunidade_membros WHERE comunidade_id = ? AND user_id = ?", [id, userId], (err) => {
    if (err) { console.error("Erro ao sair da comunidade:", err); return res.status(500).json({ erro: "Erro ao sair da comunidade" }); }
    res.json({ sucesso: true, mensagem: "Saiu da comunidade com sucesso" });
  });
});

app.post("/api/comunidades/:id/mensagens", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { mensagem } = req.body;
  if (!mensagem) return res.status(400).json({ erro: "mensagem é obrigatória" });

  db.query("INSERT INTO comunidade_mensagens (comunidade_id, user_id, mensagem) VALUES (?, ?, ?)", [id, userId, mensagem], (err, result) => {
    if (err) { console.error("Erro ao enviar mensagem:", err); return res.status(500).json({ erro: "Erro ao enviar mensagem" }); }
    res.status(201).json({ sucesso: true, id: result.insertId, mensagem: "Mensagem enviada com sucesso" });
  });
});

app.get("/api/comunidades/:id/mensagens", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const sql = `SELECT cm.*, u.userName as user_nome FROM comunidade_mensagens cm LEFT JOIN users u ON cm.user_id = u.id_users WHERE cm.comunidade_id = ? ORDER BY cm.criada_em ASC`;
  db.query(sql, [id], (err, results) => {
    if (err) { console.error("Erro ao obter mensagens:", err); return res.status(500).json({ erro: "Erro ao obter mensagens" }); }
    res.json(results || []);
  });
});

app.get("/api/comunidades/:id/membros", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const sql = `SELECT cm.*, u.userName as user_nome, u.email FROM comunidade_membros cm LEFT JOIN users u ON cm.user_id = u.id_users WHERE cm.comunidade_id = ? ORDER BY cm.juntou_em ASC`;
  db.query(sql, [id], (err, results) => {
    if (err) { console.error("Erro ao obter membros:", err); return res.status(500).json({ erro: "Erro ao obter membros" }); }
    res.json(results || []);
  });
});

// Atualizar comunidade (migrado de comunidade.routes.js — 02/03/2026)
app.put("/api/comunidades/:id", authenticateJWT, (req, res) => {
  const { id } = req.params;
  const { nome, descricao } = req.body;
  const userId = req.user.id;

  if (!id || isNaN(id)) {
    return res.status(400).json({ erro: "ID de comunidade inválido." });
  }
  if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
    return res.status(400).json({ erro: "Nome é obrigatório e deve ter pelo menos 2 caracteres." });
  }

  // Verificar se o utilizador é o criador da comunidade ou admin
  db.query("SELECT criador_id FROM comunidades WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados." });
    if (!rows.length) return res.status(404).json({ erro: "Comunidade não encontrada." });
    if (rows[0].criador_id !== userId && req.user.tipo !== 1) {
      return res.status(403).json({ erro: "Acesso negado." });
    }

    db.query("UPDATE comunidades SET nome = ?, descricao = ? WHERE id = ?",
      [nome.trim(), descricao != null ? descricao : null, id], (err2) => {
      if (err2) return res.status(500).json({ erro: "Erro ao atualizar comunidade." });
      res.json({ sucesso: true, mensagem: "Comunidade atualizada." });
    });
  });
});

app.get("/api/admin/comunidades", authenticateJWT, isAdmin, (req, res) => {
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    ORDER BY c.verificada ASC, c.criada_em ASC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.error("Erro ao obter comunidades:", err); return res.status(500).json({ erro: "Erro ao obter comunidades" }); }
    res.json(results || []);
  });
});

app.get("/api/admin/comunidades/pendentes", authenticateJWT, isAdmin, (req, res) => {
  const sql = `
    SELECT c.*, u.userName as criador_nome,
           (SELECT COUNT(*) FROM comunidade_membros WHERE comunidade_id = c.id) as membros
    FROM comunidades c
    LEFT JOIN users u ON c.criador_id = u.id_users
    WHERE c.verificada = 0
    ORDER BY c.criada_em ASC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.error("Erro ao obter comunidades pendentes:", err); return res.status(500).json({ erro: "Erro ao obter comunidades pendentes" }); }
    res.json(results || []);
  });
});

app.post("/api/admin/comunidades/:id/verificar", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;
  db.query("UPDATE comunidades SET verificada = 1 WHERE id = ?", [id], (err) => {
    if (err) { console.error("Erro ao verificar comunidade:", err); return res.status(500).json({ erro: "Erro ao verificar comunidade" }); }
    res.json({ sucesso: true, mensagem: "Comunidade verificada com sucesso" });
  });
});

app.post("/api/admin/comunidades/:id/rejeitar", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM comunidades WHERE id = ?", [id], (err) => {
    if (err) { console.error("Erro ao rejeitar comunidade:", err); return res.status(500).json({ erro: "Erro ao rejeitar comunidade" }); }
    res.json({ sucesso: true, mensagem: "Comunidade rejeitada" });
  });
});

app.post("/api/admin/comunidades/:id/toggle", authenticateJWT, isAdmin, (req, res) => {
  const { id } = req.params;
  const { verificada } = req.body;
  db.query("UPDATE comunidades SET verificada = ? WHERE id = ?", [verificada ? 1 : 0, id], (err) => {
    if (err) { console.error("Erro ao toggle verificação:", err); return res.status(500).json({ erro: "Erro ao atualizar verificação" }); }
    res.json({ sucesso: true, mensagem: "Status atualizado com sucesso" });
  });
});

// ================== RECUPERAÇÃO DE PASSWORD (novo fluxo) ==================

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: "Email obrigatório" });

  db.query("SELECT id_users FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados" });
    if (results.length === 0) return res.json({ sucesso: true });

    const code = crypto.randomInt(100000, 999999).toString();
    const expiry = Date.now() + 15 * 60 * 1000;
    resetCodes.set(email.toLowerCase(), { code, expiry });

    try {
      await sendRecoveryEmail(email, code);
    } catch (mailErr) {
      console.error('[forgot-password] Erro ao enviar email:', mailErr.message);
      return res.status(500).json({ erro: 'Erro ao enviar email de recuperação.' });
    }

    res.json({ sucesso: true });
  });
});

app.post("/api/auth/verify-reset-code", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ erro: "Email e código obrigatórios" });

  const entry = resetCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ erro: "Nenhum pedido de recuperação encontrado" });
  if (Date.now() > entry.expiry) { resetCodes.delete(email.toLowerCase()); return res.status(400).json({ erro: "Código expirado. Solicita um novo." }); }
  if (entry.code !== code) return res.status(400).json({ erro: "Código inválido" });

  res.json({ sucesso: true });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ erro: "Dados incompletos" });
  if (newPassword.length < 6) return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres" });

  const entry = resetCodes.get(email.toLowerCase());
  if (!entry) return res.status(400).json({ erro: "Nenhum pedido de recuperação encontrado" });
  if (Date.now() > entry.expiry) { resetCodes.delete(email.toLowerCase()); return res.status(400).json({ erro: "Código expirado. Solicita um novo." }); }
  if (entry.code !== code) return res.status(400).json({ erro: "Código inválido" });

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE email = ?", [hash, email], (err) => {
      if (err) return res.status(500).json({ erro: "Erro ao atualizar password" });
      resetCodes.delete(email.toLowerCase());
      res.json({ sucesso: true });
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao processar pedido" });
  }
});

// ================== STRIPE CHECKOUT ==================

app.post("/api/stripe/checkout-session", authenticateJWT, async (req, res) => {
  const userId = req.user.id;

  const baseUrl = process.env.SERVER_URL ||
    (process.env.APP_URL && process.env.APP_URL.startsWith("https://")
      ? process.env.APP_URL
      : `${req.protocol}://${req.get("host")}`);

  console.log("[Stripe] Base URL para redirect:", baseUrl);

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { userId: String(userId) },
      success_url: `${baseUrl}/payment-return?status=sucesso`,
      cancel_url: `${baseUrl}/payment-return?status=cancelado`,
    });
    res.json({ sucesso: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[Stripe] Erro ao criar sessão:", err.message);
    res.status(500).json({ erro: "Erro ao criar sessão de pagamento" });
  }
});

app.get("/api/plano/:userId", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  db.query("SELECT plano, plano_ativo_ate FROM users WHERE id_users = ?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro na base de dados" });
    if (!rows.length) return res.status(404).json({ erro: "Utilizador não encontrado" });

    const user = rows[0];
    const agora = new Date();
    const ativo = user.plano === "pago" && (!user.plano_ativo_ate || new Date(user.plano_ativo_ate) > agora);

    if (user.plano === "pago" && !ativo) {
      db.query("UPDATE users SET plano = 'free' WHERE id_users = ?", [userId]);
    }

    res.json({ plano: ativo ? "pago" : "free", ativo_ate: user.plano_ativo_ate });
  });
});

// ================== AI — RELATÓRIO SEMANAL ==================

app.get("/api/ai/report/:userId", authenticateJWT, limiterAI, async (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate FROM users WHERE id_users = ?", [userId], (err, rows) => {
      if (err) { console.error("[AI report] DB err:", err.message); return resolve(null); }
      resolve(rows.length ? rows[0] : null);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });
  const agora = new Date();
  const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
  if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
  const segundaPassada = new Date(hoje);
  segundaPassada.setDate(hoje.getDate() - diasDesdeSegunda - 7);
  segundaPassada.setHours(0, 0, 0, 0);
  const domingoPassado = new Date(segundaPassada);
  domingoPassado.setDate(segundaPassada.getDate() + 6);
  domingoPassado.setHours(23, 59, 59, 999);
  const semanaInicio = segundaPassada.toISOString().split("T")[0];

  const cached = await new Promise((resolve) => {
    db.query("SELECT conteudo FROM ai_reports WHERE user_id = ? AND semana_inicio = ?", [userId, semanaInicio],
      (err, rows) => resolve(err || !rows.length ? null : rows[0].conteudo));
  });
  if (cached) {
    try { return res.json({ sucesso: true, relatorio: JSON.parse(cached), semana_inicio: semanaInicio, cached: true }); }
    catch { return res.json({ sucesso: true, relatorio: cached, semana_inicio: semanaInicio, cached: true }); }
  }

  const treinos = await new Promise((resolve) => {
    db.query(
      `SELECT ts.id_sessao, ts.data_fim AS data_inicio, ts.duracao_segundos,
              t.nome AS nome_treino,
              GROUP_CONCAT(DISTINCT e.grupo_tipo ORDER BY e.grupo_tipo SEPARATOR ', ') AS musculos,
              COUNT(DISTINCT te.id_exercicio) AS num_exercicios,
              COALESCE(MAX(tse.peso), 0) AS peso_max
       FROM treino_sessao ts
       JOIN treino t ON ts.id_treino = t.id_treino
       LEFT JOIN treino_exercicio te ON te.id_treino = t.id_treino
       LEFT JOIN exercicios e ON e.id_exercicio = te.id_exercicio
       LEFT JOIN treino_serie tse ON tse.id_sessao = ts.id_sessao AND tse.id_exercicio = te.id_exercicio
       WHERE ts.id_users = ? AND ts.data_fim BETWEEN ? AND ? AND ts.data_fim IS NOT NULL
       GROUP BY ts.id_sessao, ts.data_fim, ts.duracao_segundos, t.nome`,
      [userId, segundaPassada, domingoPassado],
      (err, rows) => { if (err) { console.error('[AI report] Query err:', err.message); return resolve([]); } resolve(rows); }
    );
  });

  const perfil = await new Promise((resolve) => {
    db.query("SELECT userName, peso, altura, idade FROM users WHERE id_users = ?", [userId],
      (err, rows) => resolve(err || !rows.length ? {} : rows[0]));
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
    const gorqResp = await gorqGenerate({ prompt, type: "report" });
    const relatorio = gorqResp.relatorio || gorqResp;
    db.query("INSERT INTO ai_reports (user_id, semana_inicio, conteudo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE conteudo = VALUES(conteudo)",
      [userId, semanaInicio, JSON.stringify(relatorio)]);
    res.json({ sucesso: true, relatorio, semana_inicio: semanaInicio, cached: false });
  } catch (err) {
    console.error("[AI][GORQ] Erro ao gerar relatório:", err.message);
    res.status(500).json({ erro: "Erro ao gerar relatório com Gorq." });
  }
});

// ================== AI — PLANO MENSAL ==================

app.get("/api/ai/plan/:userId", authenticateJWT, limiterAI, async (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate FROM users WHERE id_users = ?", [userId], (err, rows) => {
      if (err) { console.error("[AI plan GET] DB err:", err.message); return resolve(null); }
      resolve(rows.length ? rows[0] : null);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });
  const agora = new Date();
  const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
  if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });

  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  const cached = await new Promise((resolve) => {
    db.query("SELECT conteudo, criado_em FROM ai_planos WHERE user_id = ? AND mes = ?", [userId, mesAtual],
      (err, rows) => resolve(err || !rows.length ? null : rows[0]));
  });

  if (cached) {
    try { return res.json({ sucesso: true, plano: JSON.parse(cached.conteudo), mes: mesAtual, criado_em: cached.criado_em, pode_gerar: false }); }
    catch { return res.json({ sucesso: true, plano: cached.conteudo, mes: mesAtual, criado_em: cached.criado_em, pode_gerar: false }); }
  }

  res.json({ sucesso: true, plano: null, mes: mesAtual, pode_gerar: true });
});

app.post("/api/ai/plan/:userId/generate", limiterAI, authenticateJWT, async (req, res) => {
  const { userId } = req.params;
  const { diasPorSemana = 4 } = req.body;
  const agora = new Date(); // ← CORRIGIDO: declarado localmente

  const userRow = await new Promise((resolve) => {
    db.query("SELECT plano, plano_ativo_ate, peso, altura, idade, id_tipoUser FROM users WHERE id_users = ?", [userId], (err, rows) => {
      if (err) { console.error("[AI plan POST] DB err:", err.message); return resolve(null); }
      resolve(rows.length ? rows[0] : null);
    });
  });
  if (!userRow) return res.status(404).json({ erro: "Utilizador não encontrado" });

  if (!(req.user && req.user.tipo === 1)) {
    const temPlano = userRow.plano === "pago" && (!userRow.plano_ativo_ate || new Date(userRow.plano_ativo_ate) > agora);
    if (!temPlano) return res.status(403).json({ erro: "Plano GoLift Pro necessário", codigo: "PLANO_NECESSARIO" });
  }

  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const mesNome = agora.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  const existe = await new Promise((resolve) => {
    db.query("SELECT id FROM ai_planos WHERE user_id = ? AND mes = ?", [userId, mesAtual],
      (err, rows) => resolve(!err && rows.length > 0));
  });
  if (existe) return res.status(400).json({ erro: "Já geraste o plano deste mês." });

  const prompt = `Cria um plano de treino semanal para ${mesNome} para um utilizador com ${userRow.peso || "?"}kg, ${userRow.altura || "?"}cm, ${userRow.idade || "?"}anos.

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
    const gorqResp = await gorqGenerate({ prompt, type: "plan", diasPorSemana });
    const plano = gorqResp.plano || gorqResp;
    db.query("INSERT INTO ai_planos (user_id, mes, conteudo) VALUES (?, ?, ?)",
      [userId, mesAtual, JSON.stringify(plano)],
      (err) => {
        if (err) { console.error("[AI][GORQ] Erro ao guardar plano:", err); return res.status(500).json({ erro: "Erro ao guardar plano" }); }
        res.json({ sucesso: true, plano, mes: mesAtual, pode_gerar: false });
      }
    );
  } catch (err) {
    console.error("[AI][GORQ] Erro ao gerar plano:", err.message);
    res.status(500).json({ erro: "Erro ao gerar plano com Gorq." });
  }
});

function detectarGrupoMuscular(nome) {
  const n = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map = [
    { grupo: "Peito",         sub: "Peito Médio",        kw: ["peito","press de peito","flexao de peito","supino"] },
    { grupo: "Peito",         sub: "Peito Superior",     kw: ["peito superior","inclinado","incline","upper chest"] },
    { grupo: "Peito",         sub: "Peito Inferior",     kw: ["peito inferior","declinado","decline"] },
    { grupo: "Costas",        sub: "Dorsal",             kw: ["puxada","remada","lat pull","pulley","dorsal","grande dorsal"] },
    { grupo: "Costas",        sub: "Trapézio",           kw: ["trapezio","encolhimento","shrug"] },
    { grupo: "Costas",        sub: "Rombóide",           kw: ["romboide","face pull","retração"] },
    { grupo: "Ombros",        sub: "Deltóide Anterior",  kw: ["elevacao frontal","deltoi anterior","front raise"] },
    { grupo: "Ombros",        sub: "Deltóide Lateral",   kw: ["elevacao lateral","crucifixo invertido","lateral raise"] },
    { grupo: "Ombros",        sub: "Deltóide Posterior", kw: ["deltoi posterior","bird","reverse fly","posterior"] },
    { grupo: "Ombros",        sub: "Ombros",             kw: ["ombro","press de ombros","desenvolvimento","military press","press arnold","upright row"] },
    { grupo: "Bíceps",        sub: "Bíceps",             kw: ["bicep","curl","martelo","rosca"] },
    { grupo: "Tríceps",       sub: "Tríceps",            kw: ["tricep","extensao","testa","skull","dips","mergulho","push down","kickback"] },
    { grupo: "Antebraços",    sub: "Antebraços",         kw: ["antebraco","pulso","wrist","grip"] },
    { grupo: "Quadríceps",    sub: "Quadríceps",         kw: ["quadricep","agachamento","leg press","extensao de pernas","lunges","afundo","hack squat","goblet","sissy"] },
    { grupo: "Isquiotibiais", sub: "Isquiotibiais",      kw: ["isquio","peso morto romeno","leg curl","flexao de pernas","deadlift romeno","hamstring"] },
    { grupo: "Glúteos",       sub: "Glúteos",            kw: ["gluteo","hip thrust","pontes","elevacao de quadril","abducao","kickback glut","donkey"] },
    { grupo: "Gémeos",        sub: "Gémeos",             kw: ["gemeo","panturrilha","calf","plantarflexao"] },
    { grupo: "Abdómen",       sub: "Abdómen",            kw: ["abdomen","abdominal","prancha","plank","crunch","sit up","russian twist","rollout","hollow","mountain climber","leg raise","elevacao de pernas"] },
    { grupo: "Lombar",        sub: "Lombar",             kw: ["lombar","hiperextensao","deadlift","peso morto","superman","bird dog","back extension"] },
    { grupo: "Full Body",     sub: "Funcional",          kw: ["burpee","clean","snatch","thruster","turkish","kettlebell","kettlebell swing","wall ball","box jump","swing","bear crawl"] },
    { grupo: "Cardio",        sub: "Cardio",             kw: ["corrida","bicicleta","remo ergometro","passadeira","eliptica","cardio","hiit","salto","corda","spinning","jump rope","step"] },
  ];
  for (const entry of map) {
    for (const kw of entry.kw) {
      if (n.includes(kw)) return { grupo_tipo: entry.grupo, sub_tipo: entry.sub };
    }
  }
  return { grupo_tipo: "Outros", sub_tipo: "Geral" };
}

app.post("/api/ai/plan/:userId/import-day", authenticateJWT, (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.tipo !== 1) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }
  const { dia, foco, exercicios } = req.body;

  if (!dia || !exercicios || !Array.isArray(exercicios) || exercicios.length === 0) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }

  const nomeTreino = `${dia} — ${foco || "IA"}`;

  const getOrCreateExercicio = (nome, cb) => {
    db.query("SELECT id_exercicio FROM exercicios WHERE nome = ? LIMIT 1", [nome], (err, rows) => {
      if (err) return cb(err);
      if (rows.length > 0) return cb(null, rows[0].id_exercicio);
      const { grupo_tipo, sub_tipo } = detectarGrupoMuscular(nome);
      db.query("INSERT INTO exercicios (nome, grupo_tipo, sub_tipo) VALUES (?, ?, ?)", [nome, grupo_tipo, sub_tipo], (err2, result) => {
        if (err2) return cb(err2);
        cb(null, result.insertId);
      });
    });
  };

  db.query("SELECT IFNULL(MAX(id_treino), 0) + 1 AS next_id FROM treino", (err, rows) => {
    if (err) return res.status(500).json({ erro: "Erro DB" });
    const nextId = rows[0].next_id;

    db.query("INSERT INTO treino (id_treino, id_users, nome, data_treino, is_ia) VALUES (?, ?, ?, NOW(), 1)",
      [nextId, userId, nomeTreino], (err2) => {
      if (err2) return res.status(500).json({ erro: "Erro ao criar treino" });

      let index = 0;
      const processNext = () => {
        if (index >= exercicios.length) {
          return res.json({ sucesso: true, id_treino: nextId, nome: nomeTreino });
        }
        const ex = exercicios[index++];
        getOrCreateExercicio(ex.nome || ex.exercicio, (err3, idExercicio) => {
          if (err3) return res.status(500).json({ erro: "Erro ao criar exercício" });
          db.query("INSERT INTO treino_exercicio (id_treino, id_exercicio) VALUES (?, ?)", [nextId, idExercicio], (err4) => {
            if (err4) return res.status(500).json({ erro: "Erro ao associar exercício" });
            processNext();
          });
        });
      };
      processNext();
    });
  });
});

app.get("/api/daily-phrase", async (req, res) => {
  db.query("SELECT frase FROM daily_phrases WHERE data = CURDATE()", (err, rows) => {
    if (err) console.error("[daily-phrase] Erro DB ao verificar cache:", err.message);
    if (!err && rows.length > 0) return res.json({ frase: rows[0].frase, cached: true });

    const mockFrases = [
      "O teu único limite és tu mesmo. Vai mais além.",
      "Cada treino é um passo rumo à melhor versão de ti.",
      "A consistência supera a intensidade. Aparece todos os dias.",
      "Não treinas para ontem. Treinas para o que ainda está por vir.",
      "Força não é o que consegues fazer. É superar o que pensavas não conseguir."
    ];
    const frase = mockFrases[new Date().getDate() % mockFrases.length];
    db.query("INSERT INTO daily_phrases (data, frase) VALUES (CURDATE(), ?) ON DUPLICATE KEY UPDATE frase = VALUES(frase)",
      [frase], () => res.json({ frase, cached: false, mock: true }));
  });
});

app.post("/api/stripe/portal", authenticateJWT, async (req, res) => {
  const userId = req.user.id;

  db.query("SELECT stripe_customer_id FROM users WHERE id_users = ?", [userId], async (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ erro: "Utilizador não encontrado" });
    const customerId = rows[0].stripe_customer_id;
    if (!customerId) return res.status(400).json({ erro: "Sem subscrição ativa" });

    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: "exp://localhost:8081"
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error("[Stripe Portal]", e.message);
      res.status(500).json({ erro: "Erro ao criar portal" });
    }
  });
});

app.get("/payment-return", (req, res) => {
  const status = req.query.status === "sucesso" ? "sucesso" : "cancelado";
  const isSucesso = status === "sucesso";

  res.send(`<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GoLift — Pagamento ${isSucesso ? "Confirmado" : "Cancelado"}</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #0f0f0f; color: #fff; text-align: center; }
    .card { background: #1a1a1a; border-radius: 16px; padding: 40px; max-width: 360px; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { color: #aaa; margin: 0 0 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSucesso ? "✅" : "❌"}</div>
    <h1>${isSucesso ? "Pagamento Confirmado!" : "Pagamento Cancelado"}</h1>
    <p>${isSucesso
      ? "A tua subscrição GoLift Pro está ativa. Podes fechar esta página e voltar à app."
      : "O pagamento foi cancelado. Podes fechar esta página e tentar novamente na app."}</p>
    <p style="font-size:13px;color:#555;">Podes fechar esta janela.</p>
  </div>
</body>
</html>`);
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ erro: err.message || 'Erro interno do servidor.' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Start server
app.listen(SERVER_PORT, '0.0.0.0', () => {
  const env       = process.env.NODE_ENV || 'development';
  const dbHost    = process.env.DB_HOST  || 'localhost';
  const dbName    = process.env.DB_NAME  || 'golift';
  const startedAt = new Date().toISOString();

  const check = (val) => (val ? '✅' : '❌ NÃO CONFIGURADO');

  console.log('\n' + '='.repeat(70));
  console.log('  GoLift Backend — Servidor iniciado');
  console.log('='.repeat(70));
  console.log(`  Ambiente      : ${env.toUpperCase()}`);
  console.log(`  Porta         : ${SERVER_PORT}`);
  console.log(`  PID           : ${process.pid}`);
  console.log(`  Node.js       : ${process.version}`);
  console.log(`  Iniciado em   : ${startedAt}`);
  console.log('─'.repeat(70));
  console.log(`  Base de dados : ${dbHost} / ${dbName}`);
  console.log(`  JWT Secret    : ${check(process.env.JWT_SECRET)}`);
  console.log(`  SMTP (email)  : ${check(process.env.EMAIL_USER && process.env.EMAIL_APP_PASS)}`);
  console.log(`  Stripe        : ${check(process.env.STRIPE_SECRET_KEY)}`);
  console.log(`  AI (GORQ)     : ${check(process.env.GORQ_API_KEY)}`);
  console.log('='.repeat(70) + '\n');

  setTimeout(() => {
    const testUrl = `http://localhost:${SERVER_PORT}/api/health`;
    http.get(testUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { JSON.parse(data); } catch (e) { console.error(`⚠️ Erro ao parsear resposta: ${e.message}`); } });
    }).on('error', (err) => { console.error(`❌ Erro no request de teste: ${err.message}`); });
  }, 1000);
});