// Script para resetar password de um utilizador
const bcrypt = require('bcrypt');
const db = require('./db');

const email = 'admin@gmail.com';
const newPassword = '123412';

async function resetPassword() {
  try {
    console.log("\n🔄 Resetando password...");
    console.log(`   Email: ${email}`);
    console.log(`   Nova password: ${newPassword}`);

    // Hash da nova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`\n✓ Password hashada com sucesso`);
    console.log(`   Hash: ${hashedPassword}`);
    console.log(`   Hash length: ${hashedPassword.length}`);

    // Atualizar a password na BD
    const sql = "UPDATE users SET password = ? WHERE email = ?";
    db.query(sql, [hashedPassword, email], (err, result) => {
      if (err) {
        console.error("❌ Erro ao atualizar BD:", err);
        process.exit(1);
      }

      console.log(`\n✅ Password atualizada com sucesso na BD!`);
      console.log(`   Linhas afetadas: ${result.affectedRows}`);

      // Verificar a password com o novo hash
      bcrypt.compare(newPassword, hashedPassword, (err, isMatch) => {
        if (err) {
          console.error("❌ Erro ao comparar:", err);
          process.exit(1);
        }

        console.log(`\n✅ Teste de bcrypt.compare: ${isMatch}`);
        console.log("\n🎉 Password resetada e testada com sucesso!");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

resetPassword();
