const mysql = require('mysql2/promise');

async function capitalizarExercicios() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'golift'
    });

    try {
        // Obter todos os exercícios
        const [exercises] = await conn.execute('SELECT id_exercicio as id, nome FROM exercicios');
        
        console.log(`📝 Capitalizando ${exercises.length} exercícios...`);
        
        for (const exercise of exercises) {
            const nomeCapitalizado = exercise.nome
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            
            if (nomeCapitalizado !== exercise.nome) {
                await conn.execute(
                    'UPDATE exercicios SET nome = ? WHERE id_exercicio = ?',
                    [nomeCapitalizado, exercise.id]
                );
                console.log(`✓ ${exercise.nome} → ${nomeCapitalizado}`);
            }
        }
        
        console.log('✅ Todos os exercícios foram capitalizados com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await conn.end();
    }
}

capitalizarExercicios();
