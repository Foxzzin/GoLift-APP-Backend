# FORGE PLAN — Backend GoLift

Plano de correcções e melhorias para o backend (`server.js`).  
Ordenado por prioridade: Segurança → Correctness → Features → Limpeza.

---

## PRIORIDADE 1 — SEGURANÇA (CRÍTICO)

Três rotas estão expostas sem autenticação ou com autenticação insuficiente.

### 1.1 — `GET /api/treino/sessao/:sessaoId` — sem autenticação

**Localização:** server.js, ~linha 791  
**Problema:** Qualquer pessoa sem token pode aceder aos dados de uma sessão de treino.  
**Fix:**

```js
// ANTES
app.get('/api/treino/sessao/:sessaoId', async (req, res) => {

// DEPOIS
app.get('/api/treino/sessao/:sessaoId', authenticateJWT, async (req, res) => {
```

---

### 1.2 — `GET /api/treino-user/:treino_id/exercicios` — sem autenticação

**Localização:** server.js, ~linha 1508  
**Problema:** Lista os exercícios de um treino de utilizador sem verificar identidade.  
**Fix:**

```js
// ANTES
app.get('/api/treino-user/:treino_id/exercicios', async (req, res) => {

// DEPOIS
app.get('/api/treino-user/:treino_id/exercicios', authenticateJWT, async (req, res) => {
```

---

### 1.3 — `GET /api/treino-admin` — falta `isAdmin`

**Localização:** server.js, ~linha 1281  
**Problema:** Qualquer utilizador com JWT pode ler os treinos recomendados de admin (dados que devem ser internos até serem servidos ao utilizador via lógica controlada).  
**Fix:**

```js
// ANTES
app.get('/api/treino-admin', authenticateJWT, async (req, res) => {

// DEPOIS
app.get('/api/treino-admin', authenticateJWT, isAdmin, async (req, res) => {
```

> **Nota:** Verificar se a app cliente precisa desta rota directamente — se os treinos recomendados são servidos via outro endpoint dedicado ao utilizador, esta rota pode não precisar de `isAdmin`. Confirmar com arquitectura de planos.

---

## PRIORIDADE 2 — CORRECTNESS (BUG CONFIRMADO)

### 2.1 — `maxStreak` está errado em `GET /api/streak/:userId`

**Localização:** server.js, ~linhas 330–382  
**Problema:** A implementação actual só conta o streak *para a frente* a partir de hoje e faz `maxStreak = currentStreak` no final. Isto significa que `maxStreak` nunca é o máximo histórico — é apenas o streak actual.

**Implementação actual (resumo):**
```js
// Conta dias consecutivos a partir de hoje para trás
let currentStreak = 0;
let maxStreak = 0;
// loop que só conta o streak actual...
maxStreak = currentStreak; // ← BUG: isto não é o máximo histórico
```

**Fix — calcular maxStreak sobre todas as datas:**
```js
// Após receber as rows ordenadas DESC por data_treino:
// Passo 1: calcular currentStreak (streak mais recente)
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
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
}

// Passo 2: calcular maxStreak sobre todas as datas (ordem DESC)
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

res.json({ currentStreak, maxStreak });
```

---

## PRIORIDADE 3 — FEATURES (DASHBOARD ADMIN)

### 3.1 — `GET /api/admin/stats` — campos em falta

**Localização:** server.js, ~linhas 386–450  
**Problema:** O endpoint actual devolve apenas `totalUsers`, `totalTreinos`, `totalExercises`, `totalAdmins`. O dashboard precisa também de `proUsers`, `newUsersThisWeek`, `sessionsThisWeek`.

**Estrutura actual (com callbacks aninhados):**
```js
db.query('SELECT COUNT(*) ...', (err, result) => {
  db.query('SELECT COUNT(*) ...', (err2, result2) => {
    // ... etc
  });
});
```

**Fix — usar `Promise.all` com pool de promessas:**
```js
app.get('/api/admin/stats', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const pool = db.promise(); // assumindo mysql2

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
      pool.query('SELECT COUNT(*) AS total FROM treino_admin'),
      pool.query('SELECT COUNT(*) AS total FROM exercicios'),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE id_tipoUser = 1"),
      pool.query("SELECT COUNT(*) AS total FROM subscricoes WHERE estado = 'ativo'"),
      pool.query('SELECT COUNT(*) AS total FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
      pool.query('SELECT COUNT(*) AS total FROM treino_sessao WHERE data_fim IS NOT NULL AND data_fim >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
    ]);

    res.json({
      totalUsers: totalUsersRows[0].total,
      totalTreinos: totalTreinosRows[0].total,
      totalExercises: totalExercisesRows[0].total,
      totalAdmins: totalAdminsRows[0].total,
      proUsers: proUsersRows[0].total,
      newUsersThisWeek: newUsersRows[0].total,
      sessionsThisWeek: sessionsRows[0].total,
    });
  } catch (err) {
    console.error('Erro em /api/admin/stats:', err);
    res.status(500).json({ erro: 'Erro ao obter estatísticas' });
  }
});
```

> **Verificar:** nomes exactos das tabelas (`subscricoes`, `treino_sessao`, campo `created_at` em `users`, campo `data_fim` em `treino_sessao`). Ajustar conforme o schema real.

---

## PRIORIDADE 4 — LIMPEZA (LOW)

### 4.1 — Rota duplicada `GET /api/profile/:userId`

**Localização:** server.js, ~linha 296  
**Problema:** Existe uma rota `app.get('/api/profile/:userId', ...)` inline no `server.js` que duplica o comportamento já tratado pelos `userRoutes` modulares.  
**Fix:** Remover a rota inline. Confirmar que `userRoutes` já expõe o mesmo endpoint antes de remover.

---

### 4.2 — Registo duplicado de `userRoutes`

**Localização:** server.js  
**Problema:** `app.use('/api/user', userRoutes)` e `app.use('/api', userRoutes)` podem estar ambos registados, criando rotas duplicadas com prefixos diferentes.  
**Fix:** Manter apenas uma das registações, de acordo com os prefixos que a app cliente usa.

---

## RESUMO DE ACÇÕES

| # | Ficheiro | Linha aprox. | Acção | Prioridade |
|---|----------|-------------|-------|-----------|
| 1 | server.js | 791 | Adicionar `authenticateJWT` | 🔴 Crítico |
| 2 | server.js | 1508 | Adicionar `authenticateJWT` | 🔴 Crítico |
| 3 | server.js | 1281 | Adicionar `isAdmin` | 🔴 Crítico |
| 4 | server.js | 330–382 | Corrigir cálculo `maxStreak` | 🟠 Alto |
| 5 | server.js | 386–450 | Expandir `/api/admin/stats` + refactor para `Promise.all` | 🟡 Médio |
| 6 | server.js | ~296 | Remover rota `GET /api/profile/:userId` inline duplicada | 🟢 Baixo |
| 7 | server.js | início | Limpar registo duplicado de `userRoutes` | 🟢 Baixo |
