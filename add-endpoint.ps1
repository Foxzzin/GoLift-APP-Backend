# Script para adicionar o endpoint GET /api/treino/:userId/:workoutId ao server.js
# Execute este script no diretório C:\Users\rapos\Desktop\Progamação\PAP\GoLift-APP-Backend

$serverFile = Join-Path (Get-Location) "server.js"

Write-Host "================================"
Write-Host "Adicionando endpoint ao backend"
Write-Host "================================"
Write-Host ""

# Verificar se o arquivo existe
if (-not (Test-Path $serverFile)) {
    Write-Host "❌ Erro: server.js não encontrado em $(Get-Location)"
    exit 1
}

Write-Host "✓ Arquivo encontrado: $serverFile"

# Ler o arquivo
$content = Get-Content $serverFile -Raw

# Verificar se o endpoint já existe
if ($content -like '*app.get("/api/treino/:userId/:workoutId"*') {
    Write-Host "✓ Endpoint já existe no arquivo. Nada a fazer."
    exit 0
}

# Definir o novo endpoint
$newEndpoint = @"

// GET /api/treino/:userId/:workoutId - Get user workout details
app.get("/api/treino/:userId/:workoutId", (req, res) => {
  const { userId, workoutId } = req.params;

  console.log(`[API] GET /api/treino/:userId/:workoutId - userId: `${userId}, workoutId: `${workoutId}`);

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
        console.warn(`[API] Workout not found - workoutId: `${workoutId}, userId: `${userId}`);
        return res.status(404).json({ erro: "Treino não encontrado." });
      }

      const treino = treinoRows[0];
      console.log(`[API] Found workout: `${treino.nome}`);

      // Step 2: Get exercises for the workout
      const sqlExercicios = `
        SELECT 
          e.id_exercicio,
          e.nome
        FROM treino_exercicio te
        INNER JOIN exercicios e ON te.id_exercicio = e.id_exercicio
        WHERE te.id_treino = ?
        ORDER BY e.nome ASC
      `;

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

        console.log(`[API] Found `${exercicios.length} exercises for workout`);

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
"@

# Procurar por um bom local para inserir (antes de /api/treino-user)
$insertPattern = 'app.post\("/api/treino-user"'
$insertIndex = $content.IndexOf('app.post("/api/treino-user"')

if ($insertIndex -eq -1) {
    # Se não encontrar treino-user, tentar treino-admin
    $insertPattern = 'app.get\("/api/treino-admin"'
    $insertIndex = $content.IndexOf('app.get("/api/treino-admin"')
}

if ($insertIndex -eq -1) {
    Write-Host "❌ Erro: Não foi possível encontrar um local apropriado para inserir o endpoint"
    Write-Host "         (não encontrou /api/treino-user nem /api/treino-admin)"
    exit 1
}

# Encontrar o início da linha
$startOfLine = $content.LastIndexOf("`n", $insertIndex)
if ($startOfLine -eq -1) {
    $startOfLine = 0
}

# Inserir o novo endpoint
$newContent = $content.Substring(0, $startOfLine + 1) + $newEndpoint + "`n" + $content.Substring($startOfLine + 1)

# Salvar o arquivo
$newContent | Set-Content $serverFile -NoNewline

Write-Host ""
Write-Host "✓ Endpoint adicionado com sucesso!"
Write-Host ""
Write-Host "Próximos passos:"
Write-Host "1. Reinicie o servidor Node.js:"
Write-Host "   node server.js"
Write-Host "2. Teste a app - abra um workout e verifique se carrega sem erros"
Write-Host ""
