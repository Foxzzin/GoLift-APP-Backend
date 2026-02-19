-- Tabelas para o Sistema de Comunidades

-- Tabela de Comunidades
CREATE TABLE `comunidades` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `descricao` text NOT NULL,
  `criador_id` int(11) NOT NULL,
  `imagem_url` varchar(255),
  `pais` varchar(100),
  `linguas` varchar(255),
  `categoria` varchar(50),
  `privada` tinyint(1) DEFAULT 0,
  `verificada` tinyint(1) DEFAULT 0,
  `criada_em` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `criador_id` (`criador_id`),
  CONSTRAINT `comunidades_ibfk_1` FOREIGN KEY (`criador_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabela de Membros da Comunidade
CREATE TABLE `comunidade_membros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comunidade_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `juntou_em` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_membro` (`comunidade_id`, `user_id`),
  KEY `comunidade_id` (`comunidade_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comunidade_membros_ibfk_1` FOREIGN KEY (`comunidade_id`) REFERENCES `comunidades` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comunidade_membros_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabela de Mensagens da Comunidade
CREATE TABLE `comunidade_mensagens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comunidade_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `mensagem` text NOT NULL,
  `criada_em` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `comunidade_id` (`comunidade_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comunidade_mensagens_ibfk_1` FOREIGN KEY (`comunidade_id`) REFERENCES `comunidades` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comunidade_mensagens_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
