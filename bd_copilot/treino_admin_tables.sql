-- Tabela para armazenar treinos criados pelos admins
CREATE TABLE IF NOT EXISTS `treino_admin` (
  `id_treino_admin` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `nome` VARCHAR(255) NOT NULL,
  `criado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabela de junção entre treinos de admin e exercícios
CREATE TABLE IF NOT EXISTS `treino_admin_exercicio` (
  `id_treino_admin_exercicio` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `id_treino_admin` INT(11) NOT NULL,
  `id_exercicio` INT(11) NOT NULL,
  FOREIGN KEY (`id_treino_admin`) REFERENCES `treino_admin`(`id_treino_admin`) ON DELETE CASCADE,
  FOREIGN KEY (`id_exercicio`) REFERENCES `exercicios`(`id_exercicio`) ON DELETE CASCADE,
  UNIQUE KEY `unique_treino_exercicio` (`id_treino_admin`, `id_exercicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
