const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');

// Ler o arquivo
let content = fs.readFileSync(serverFile, 'utf8');

// Verificar se o endpoint já existe
if (content.includes('app.get("/api/treino/:userId/:workoutId"')) {
  console.log('✓ Endpoint já existe no arquivo');
  process.exit(0);
}

// Novo endpoint a adicionar
const newEndpoint = `
// GET /api/treino/:userId/:workoutId - Get user workout details
app.get("/api/treino/:userId/:workoutId", (req, res) => {
  const { userId, workoutId } = req.params;

  console.log(\`[API] GET /api/treino/:userId/:workoutId - userId: \${userId}, workoutId: \${workoutId}\`);

  // Step 1: Get workout info - verify it belongs to the user
  db.query(
    "SELECT * FROM treino WHERE id_treino = ? AND id_users = ?",
    [workoutId, userId],
    (err, treinoRows) => {
      if (err) {
        console.error("[API] GET /api/treino/:userId/:workoutId - Database error:", err);
        return res.status(500).json({ erro: "Erro ao obter treino." });
      }

      if (!treinoRows || treinoRows.length === 0) {
        console.warn(\`[API] Workout not found - workoutId: \${workoutId}, userId: \${userId}\`);
        return res.status(404).json({ erro: "Treino não encontrado." });
      }

      const treino = treinoRows[0];
      console.log(\`[API] Found workout: \${treino.nome}\`);

      // Step 2: Get exercises for the workout
      const sqlExercicios = \`
        SELECT 
          e.id_exercicio,
          e.nome
        FROM treino_exercicio te
        INNER JOIN exercicios e ON te.id_exercicio = e.id_exercicio
        WHERE te.id_treino = ?
        ORDER BY e.nome ASC
      \`;

      db.query(sqlExercicios, [workoutId], (err2, exerciciosRows) => {
        if (err2) {
          console.error("[API] GET /api/treino/:userId/:workoutId - Error fetching exercises:", err2);
          return res.status(500).json({ erro: "Erro ao buscar exercícios." });
        }

        const exercicios = (exerciciosRows || []).map((ex) => ({
          id: ex.id_exercicio,
          id_exercicio: ex.id_exercicio,
          nome: ex.nome,
        }));

        console.log(\`[API] Found \${exercicios.length} exercises for workout\`);

        res.json({
          id_treino: treino.id_treino,
          nome: treino.nome || "Treino",
          data_treino: treino.data_treino,
          exercicios: exercicios,
        });
      });
    }
  );
});
`;

// Encontrar a linha para inserir (antes de /api/treino-user ou no final)
let insertIndex = -1;

// Procurar por /api/treino-user
if (content.includes('app.post("/api/treino-user"')) {
  insertIndex = content.indexOf('app.post("/api/treino-user"');
} else if (content.includes('app.get("/api/treino-admin"')) {
  // Se não encontrar treino-user, procurar por treino-admin
  insertIndex = content.indexOf('app.get("/api/treino-admin"');
} else {
  // Fallback: procurar pela última ocorrência de app.get ou app.post relacionada a treino
  const lastTreinoIndex = content.lastIndexOf('app.');
  if (lastTreinoIndex > -1) {
    insertIndex = content.indexOf('\n', lastTreinoIndex) + 1;
  }
}

if (insertIndex === -1) {
  console.log('Erro: Não foi possível encontrar um local apropriado para inserir o endpoint');
  process.exit(1);
}

// Encontrar o início da linha
const startOfLine = content.lastIndexOf('\n', insertIndex);
insertIndex = startOfLine + 1;

// Inserir o novo endpoint
const newContent = content.slice(0, insertIndex) + newEndpoint + '\n' + content.slice(insertIndex);

// Salvar o arquivo
fs.writeFileSync(serverFile, newContent, 'utf8');

console.log('✓ Endpoint adicionado com sucesso ao server.js');
console.log('Não esquecer de reiniciar o servidor Node.js!');
