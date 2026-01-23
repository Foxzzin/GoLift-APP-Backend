-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 10-Dez-2025 às 05:21
-- Versão do servidor: 10.4.32-MariaDB
-- versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `golift`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `exercicios`
--

CREATE TABLE `exercicios` (
  `id_exercicio` int(11) NOT NULL,
  `nome` varchar(20) DEFAULT NULL,
  `descricao` text DEFAULT NULL,
  `video` varchar(20) NOT NULL,
  `recorde_pessoal` float DEFAULT NULL,
  `grupo_tipo` varchar(10) DEFAULT NULL,
  `sub_tipo` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `exercicios`
--

INSERT INTO `exercicios` (`id_exercicio`, `nome`, `descricao`, `video`, `recorde_pessoal`, `grupo_tipo`, `sub_tipo`) VALUES
(1, 'supinio reto', 'um exercicio para o peito com foco nas fibras centrais do peito', 'supinoreto', 12, 'peito', 'Medio'),
(2, 'Leg Press', 'Um exercicio usado para treinar toda a perna porem focado na parte posterior da perna.', 'https://youtu.be/q4W', NULL, 'Pernas', 'Posterior'),
(3, 'Lat PullDown', 'Exercicio indicado para as Lats', 'https://www.youtube.', NULL, 'Costas', 'Lats');

-- --------------------------------------------------------

--
-- Estrutura da tabela `tipo_user`
--

CREATE TABLE `tipo_user` (
  `id_tipoUser` int(11) NOT NULL,
  `descricao` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `tipo_user`
--

INSERT INTO `tipo_user` (`id_tipoUser`, `descricao`) VALUES
(1, 'Admin'),
(2, 'Cliente');

-- --------------------------------------------------------

--
-- Estrutura da tabela `treino`
--

CREATE TABLE `treino` (
  `id_treino` int(11) DEFAULT NULL,
  `nome` varchar(100) DEFAULT NULL,
  `id_users` int(11) DEFAULT NULL,
  `data_treino` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `treino`
--

INSERT INTO `treino` (`id_treino`, `nome`, `id_users`, `data_treino`) VALUES
(1, NULL, 1, '2025-12-04'),
(1, NULL, 1, '2025-12-04'),
(2, NULL, 1, '2025-12-05'),
(3, NULL, 7, '2025-12-10'),
(4, NULL, 7, '2025-12-10'),
(5, NULL, 7, '2025-12-10'),
(6, NULL, 7, '2025-12-10'),
(8, 'costas', 7, '2025-12-10');

-- --------------------------------------------------------

--
-- Estrutura da tabela `treino_exercicio`
--

CREATE TABLE `treino_exercicio` (
  `id_treino` int(11) DEFAULT NULL,
  `id_exercicio` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `treino_exercicio`
--

INSERT INTO `treino_exercicio` (`id_treino`, `id_exercicio`) VALUES
(3, 3),
(4, 3),
(5, 3),
(6, 3),
(8, 3),
(8, 2);

-- --------------------------------------------------------

--
-- Estrutura da tabela `treino_serie`
--

CREATE TABLE `treino_serie` (
  `id_serie` int(11) NOT NULL,
  `id_sessao` int(11) DEFAULT NULL,
  `id_exercicio` int(11) DEFAULT NULL,
  `numero_serie` int(11) DEFAULT NULL,
  `repeticoes` int(11) DEFAULT NULL,
  `peso` float DEFAULT NULL,
  `data_serie` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `treino_sessao`
--

CREATE TABLE `treino_sessao` (
  `id_sessao` int(11) NOT NULL,
  `id_treino` int(11) DEFAULT NULL,
  `id_users` int(11) DEFAULT NULL,
  `data_inicio` datetime DEFAULT current_timestamp(),
  `data_fim` datetime DEFAULT NULL,
  `duracao_segundos` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `treino_sessao`
--

INSERT INTO `treino_sessao` (`id_sessao`, `id_treino`, `id_users`, `data_inicio`, `data_fim`, `duracao_segundos`) VALUES
(28, 8, 7, '2025-12-10 02:56:43', NULL, NULL),
(29, 8, 7, '2025-12-10 02:56:43', NULL, NULL),
(30, 8, 7, '2025-12-10 02:57:04', NULL, NULL),
(31, 8, 7, '2025-12-10 02:57:04', NULL, NULL),
(32, 8, 7, '2025-12-10 02:58:21', NULL, NULL),
(33, 8, 7, '2025-12-10 02:58:21', NULL, NULL),
(34, 8, 7, '2025-12-10 02:58:25', NULL, NULL),
(35, 8, 7, '2025-12-10 02:58:25', '2025-12-10 02:58:29', 2),
(36, 8, 7, '2025-12-10 02:58:49', NULL, NULL),
(37, 8, 7, '2025-12-10 02:58:49', NULL, NULL),
(38, 8, 7, '2025-12-10 02:59:41', NULL, NULL),
(39, 8, 7, '2025-12-10 02:59:41', NULL, NULL),
(40, 8, 7, '2025-12-10 03:12:16', NULL, NULL),
(41, 8, 7, '2025-12-10 03:12:16', NULL, NULL);

-- --------------------------------------------------------

--
-- Estrutura da tabela `users`
--

CREATE TABLE `users` (
  `id_users` int(11) NOT NULL,
  `userName` varchar(10) DEFAULT NULL,
  `email` varchar(30) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `idade` int(2) DEFAULT NULL,
  `peso` float DEFAULT NULL,
  `altura` float DEFAULT NULL,
  `created_at` date NOT NULL DEFAULT current_timestamp(),
  `id_tipoUser` int(11) DEFAULT 2
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `users`
--

INSERT INTO `users` (`id_users`, `userName`, `email`, `password`, `idade`, `peso`, `altura`, `created_at`, `id_tipoUser`) VALUES
(7, 'admin', 'admin@gmail.com', '$2b$10$FGZSYxdDfyfk5zZc.XOWHOqrFA6n6EGkloo9xYYrAupfh8mFTR9qW', 23, 80, 187, '2025-11-19', 1),
(8, 'tomas', 'raposopvptomas@gmail.com', '$2b$10$Bc2wqxEyPmjtOA6zVulWwuYPKlND4OV4CmsLDBiyAIEIuINxKI3yu', 0, 0, 0, '2025-12-09', 2),
(9, 'victor', 'victor@gmail.com', '$2b$10$XFxRRfLyKf5nquThalSsc.V20nATU7eEUQjgqtR4E.wOR5A3pSRFK', 0, 0, 0, '2025-12-09', 2),
(10, 'andre', 'andre@gmail.com', '$2b$10$XHKjm2xbWaGtUgpTi.iaPu1RVDKMpagh5TfpdPWRHTiV7Ls8XWP0i', 0, 0, 0, '2025-12-09', 2),
(11, 'fernando', 'fernando@gmail.com', '$2b$10$FOQ8bw1f1jjfFBfznsSTz.js5YHEZfOExj2Qo6JaL/56QUKOUVhO2', 18, 80, 165, '2025-12-09', 2),
(12, 'alfredo', 'alfredo@gmail.com', '$2b$10$wW79Jx9kPr0bD8KANWrXLugY81K./CU3aJgtomFmw5mBvOoULLhiy', 77, 80, 150, '2025-12-09', 2),
(13, 'helder', 'helder@gmail.com', '$2b$10$oo.mGsWUJwgqa1oaynJDDOMv.6NHQLEvcPrnJykqRDHIrgysyIgbW', 51, 65, 124, '2025-12-09', 2),
(15, 'ana', 'ana@gmail.com', '$2b$10$4XULsV2KcElj7rPk5I69QOxCEKcrmlJtLSCtbzfv3E3M4nts96srm', 21, 60, 160, '2025-12-09', 2),
(16, 'lamine', 'lamine@gmail.com', '$2b$10$YgEkJCbzTQf3Rl/NK6B3FOPdAhgtIwxpRdzRDrVt2m2n5lTkSOvr2', 19, 80, 180, '2025-12-09', 2);

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `exercicios`
--
ALTER TABLE `exercicios`
  ADD PRIMARY KEY (`id_exercicio`);

--
-- Índices para tabela `tipo_user`
--
ALTER TABLE `tipo_user`
  ADD PRIMARY KEY (`id_tipoUser`);

--
-- Índices para tabela `treino`
--
ALTER TABLE `treino`
  ADD KEY `id_users` (`id_users`),
  ADD KEY `id_treino` (`id_treino`);

--
-- Índices para tabela `treino_exercicio`
--
ALTER TABLE `treino_exercicio`
  ADD KEY `id_treino` (`id_treino`),
  ADD KEY `id_exercicio` (`id_exercicio`);

--
-- Índices para tabela `treino_serie`
--
ALTER TABLE `treino_serie`
  ADD PRIMARY KEY (`id_serie`),
  ADD KEY `id_sessao` (`id_sessao`),
  ADD KEY `id_exercicio` (`id_exercicio`);

--
-- Índices para tabela `treino_sessao`
--
ALTER TABLE `treino_sessao`
  ADD PRIMARY KEY (`id_sessao`),
  ADD KEY `id_treino` (`id_treino`),
  ADD KEY `id_users` (`id_users`);

--
-- Índices para tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_users`),
  ADD KEY `id_tipoUser` (`id_tipoUser`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `exercicios`
--
ALTER TABLE `exercicios`
  MODIFY `id_exercicio` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de tabela `treino_serie`
--
ALTER TABLE `treino_serie`
  MODIFY `id_serie` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `treino_sessao`
--
ALTER TABLE `treino_sessao`
  MODIFY `id_sessao` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id_users` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
