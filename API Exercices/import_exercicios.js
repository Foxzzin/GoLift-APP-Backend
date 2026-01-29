const fs = require('fs');
const mysql = require('mysql2/promise');

async function importar() {
    const data = JSON.parse(fs.readFileSync('exercicies.json', 'utf8'));

    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '', // mete a tua password
        database: 'golift'
    });

    for (const ex of data) {
        await conn.execute(
            `INSERT INTO exercicios 
            (nome, descricao, video, recorde_pessoal, grupo_tipo, sub_tipo)
            VALUES (?, ?, ?, NULL, ?, ?)`,
            [
                ex.name,
                `Exercise for ${ex.target}`,
                ex.gifUrl || null,
                ex.bodyPart,
                ex.target
            ]
        );
    }

    console.log('✅ Exercícios importados com sucesso!');
    await conn.end();
}

importar();
