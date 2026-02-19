-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 03/02/2026 às 00:07
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

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
-- Estrutura para tabela `exercicios`
--

CREATE TABLE `exercicios` (
  `id_exercicio` int(11) NOT NULL,
  `nome` varchar(20) DEFAULT NULL,
  `descricao` text DEFAULT NULL,
  `video` varchar(20) DEFAULT NULL,
  `recorde_pessoal` float DEFAULT NULL,
  `grupo_tipo` varchar(10) DEFAULT NULL,
  `sub_tipo` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `exercicios`
--

INSERT INTO `exercicios` (`id_exercicio`, `nome`, `descricao`, `video`, `recorde_pessoal`, `grupo_tipo`, `sub_tipo`) VALUES
(5, 'Barbell Bench Press', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(6, 'Incline Dumbbell Pre', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(7, 'Decline Bench Press', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(8, 'Chest Fly Machine', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(9, 'Push Up', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(10, 'Pull Up', 'Exercise for lats', NULL, NULL, 'back', 'lats'),
(11, 'Lat Pulldown', 'Exercise for lats', NULL, NULL, 'back', 'lats'),
(12, 'Seated Cable Row', 'Exercise for upper back', NULL, NULL, 'back', 'upper back'),
(13, 'Barbell Row', 'Exercise for upper back', NULL, NULL, 'back', 'upper back'),
(14, 'One Arm Dumbbell Row', 'Exercise for lats', NULL, NULL, 'back', 'lats'),
(15, 'Barbell Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(16, 'Leg Press', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(17, 'Walking Lunge', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(18, 'Leg Extension', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(19, 'Lying Leg Curl', 'Exercise for hamstrings', NULL, NULL, 'legs', 'hamstrings'),
(20, 'Romanian Deadlift', 'Exercise for hamstrings', NULL, NULL, 'legs', 'hamstrings'),
(21, 'Standing Calf Raise', 'Exercise for calves', NULL, NULL, 'legs', 'calves'),
(22, 'Seated Calf Raise', 'Exercise for calves', NULL, NULL, 'legs', 'calves'),
(23, 'Bulgarian Split Squa', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(24, 'Hack Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(25, 'Overhead Barbell Pre', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(26, 'Dumbbell Shoulder Pr', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(27, 'Lateral Raise', 'Exercise for lateral delts', NULL, NULL, 'shoulders', 'lateral delts'),
(28, 'Front Raise', 'Exercise for anterior delts', NULL, NULL, 'shoulders', 'anterior delts'),
(29, 'Rear Delt Fly', 'Exercise for posterior delts', NULL, NULL, 'shoulders', 'posterior delts'),
(30, 'Barbell Bicep Curl', 'Exercise for biceps', NULL, NULL, 'arms', 'biceps'),
(31, 'Dumbbell Bicep Curl', 'Exercise for biceps', NULL, NULL, 'arms', 'biceps'),
(32, 'Hammer Curl', 'Exercise for brachialis', NULL, NULL, 'arms', 'brachialis'),
(33, 'Preacher Curl', 'Exercise for biceps', NULL, NULL, 'arms', 'biceps'),
(34, 'Cable Curl', 'Exercise for biceps', NULL, NULL, 'arms', 'biceps'),
(35, 'Close Grip Bench Pre', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(36, 'Triceps Pushdown', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(37, 'Overhead Triceps Ext', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(38, 'Skull Crushers', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(39, 'Bench Dips', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(40, 'Plank', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(41, 'Hanging Leg Raise', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(42, 'Crunch', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(43, 'Cable Crunch', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(44, 'Russian Twist', 'Exercise for obliques', NULL, NULL, 'core', 'obliques'),
(45, 'Deadlift', 'Exercise for lower back', NULL, NULL, 'back', 'lower back'),
(46, 'Sumo Deadlift', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(47, 'Hip Thrust', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(48, 'Glute Bridge', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(49, 'Step Up', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(50, 'Face Pull', 'Exercise for rear delts', NULL, NULL, 'shoulders', 'rear delts'),
(51, 'Upright Row', 'Exercise for traps', NULL, NULL, 'shoulders', 'traps'),
(52, 'Shrug', 'Exercise for traps', NULL, NULL, 'shoulders', 'traps'),
(53, 'Arnold Press', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(54, 'Reverse Pec Deck', 'Exercise for rear delts', NULL, NULL, 'shoulders', 'rear delts'),
(55, 'Farmer Walk', 'Exercise for grip', NULL, NULL, 'full body', 'grip'),
(56, 'Battle Ropes', 'Exercise for full body', NULL, NULL, 'cardio', 'full body'),
(57, 'Jump Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(58, 'Mountain Climber', 'Exercise for core', NULL, NULL, 'cardio', 'core'),
(59, 'Burpee', 'Exercise for full body', NULL, NULL, 'cardio', 'full body'),
(60, 'Incline Push Up', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(61, 'Decline Push Up', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(62, 'Diamond Push Up', 'Exercise for triceps', NULL, NULL, 'arms', 'triceps'),
(63, 'Wide Grip Pull Up', 'Exercise for lats', NULL, NULL, 'back', 'lats'),
(64, 'Chin Up', 'Exercise for biceps', NULL, NULL, 'back', 'biceps'),
(65, 'Ab Wheel Rollout', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(66, 'Side Plank', 'Exercise for obliques', NULL, NULL, 'core', 'obliques'),
(67, 'Flutter Kicks', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(68, 'Toe Touches', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(69, 'Bicycle Crunch', 'Exercise for abs', NULL, NULL, 'core', 'abs'),
(70, 'Sled Push', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(71, 'Sled Pull', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(72, 'Box Jump', 'Exercise for power', NULL, NULL, 'legs', 'power'),
(73, 'Kettlebell Swing', 'Exercise for glutes', NULL, NULL, 'full body', 'glutes'),
(74, 'Goblet Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(75, 'Kettlebell Clean', 'Exercise for power', NULL, NULL, 'full body', 'power'),
(76, 'Kettlebell Press', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(77, 'Cable Lateral Raise', 'Exercise for lateral delts', NULL, NULL, 'shoulders', 'lateral delts'),
(78, 'Smith Machine Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(79, 'Smith Machine Bench ', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(80, 'Incline Cable Fly', 'Exercise for upper chest', NULL, NULL, 'chest', 'upper chest'),
(81, 'Crossover Fly', 'Exercise for pectorals', NULL, NULL, 'chest', 'pectorals'),
(82, 'Single Leg Leg Press', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(83, 'Reverse Lunge', 'Exercise for glutes', NULL, NULL, 'legs', 'glutes'),
(84, 'Stepper Machine', 'Exercise for legs', NULL, NULL, 'cardio', 'legs'),
(85, 'Rowing Machine', 'Exercise for full body', NULL, NULL, 'cardio', 'full body'),
(86, 'Treadmill Run', 'Exercise for legs', NULL, NULL, 'cardio', 'legs'),
(87, 'Cycling', 'Exercise for legs', NULL, NULL, 'cardio', 'legs'),
(88, 'Jump Rope', 'Exercise for full body', NULL, NULL, 'cardio', 'full body'),
(89, 'Elliptical Trainer', 'Exercise for full body', NULL, NULL, 'cardio', 'full body'),
(90, 'Landmine Press', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(91, 'Landmine Row', 'Exercise for upper back', NULL, NULL, 'back', 'upper back'),
(92, 'Z Press', 'Exercise for delts', NULL, NULL, 'shoulders', 'delts'),
(93, 'Good Morning', 'Exercise for hamstrings', NULL, NULL, 'legs', 'hamstrings'),
(94, 'Reverse Hyperextensi', 'Exercise for lower back', NULL, NULL, 'back', 'lower back'),
(95, 'Wrist Curl', 'Exercise for forearms', NULL, NULL, 'arms', 'forearms'),
(96, 'Reverse Wrist Curl', 'Exercise for forearms', NULL, NULL, 'arms', 'forearms'),
(97, 'Farmer Carry', 'Exercise for grip', NULL, NULL, 'full body', 'grip'),
(98, 'Zercher Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(99, 'Overhead Squat', 'Exercise for full body', NULL, NULL, 'legs', 'full body'),
(100, 'Clean And Press', 'Exercise for power', NULL, NULL, 'full body', 'power'),
(101, 'Snatch', 'Exercise for power', NULL, NULL, 'full body', 'power'),
(102, 'Wall Sit', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(103, 'Pistol Squat', 'Exercise for quadriceps', NULL, NULL, 'legs', 'quadriceps'),
(104, 'Bear Crawl', 'Exercise for core', NULL, NULL, 'full body', 'core');

-- --------------------------------------------------------

--
-- Estrutura para tabela `tipo_user`
--

CREATE TABLE `tipo_user` (
  `id_tipoUser` int(11) NOT NULL,
  `descricao` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `tipo_user`
--

INSERT INTO `tipo_user` (`id_tipoUser`, `descricao`) VALUES
(1, 'Admin'),
(2, 'Cliente');

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino`
--

CREATE TABLE `treino` (
  `id_treino` int(11) DEFAULT NULL,
  `nome` varchar(100) DEFAULT NULL,
  `id_users` int(11) DEFAULT NULL,
  `data_treino` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `treino`
--

INSERT INTO `treino` (`id_treino`, `nome`, `id_users`, `data_treino`) VALUES
(1, NULL, 1, '2025-12-04'),
(1, NULL, 1, '2025-12-04'),
(2, NULL, 1, '2025-12-05'),
(3, 'Costas', 7, '2026-01-28'),
(4, 'Peito', 7, '2026-01-28'),
(5, 'Treino de perna', 7, '2026-01-28');

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino_admin`
--

CREATE TABLE `treino_admin` (
  `id_treino_admin` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `atualizado_em` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino_admin_exercicio`
--

CREATE TABLE `treino_admin_exercicio` (
  `id_treino_admin_exercicio` int(11) NOT NULL,
  `id_treino_admin` int(11) NOT NULL,
  `id_exercicio` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino_exercicio`
--

CREATE TABLE `treino_exercicio` (
  `id_treino` int(11) DEFAULT NULL,
  `id_exercicio` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `treino_exercicio`
--

INSERT INTO `treino_exercicio` (`id_treino`, `id_exercicio`) VALUES
(3, 13),
(3, 11),
(3, 10),
(4, 5),
(5, 15),
(5, 72),
(5, 23),
(5, 98);

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino_serie`
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

--
-- Despejando dados para a tabela `treino_serie`
--

INSERT INTO `treino_serie` (`id_serie`, `id_sessao`, `id_exercicio`, `numero_serie`, `repeticoes`, `peso`, `data_serie`) VALUES
(1, 42, 2, 1, 12, 18, '2025-12-10 17:29:46'),
(2, 42, 2, 2, 12, 20, '2025-12-10 17:30:03'),
(3, 42, 2, 3, 12, 25, '2025-12-10 17:30:04'),
(4, 45, 3, 1, 15, 12, '2025-12-10 17:38:14'),
(5, 45, 3, 2, 15, 13, '2025-12-10 17:38:15'),
(6, 45, 3, 3, 15, 13, '2025-12-10 17:38:16'),
(7, 45, 3, 4, 15, 13, '2025-12-10 17:38:17'),
(8, 47, 3, 1, 12, 1, '2025-12-10 18:42:22'),
(9, 47, 3, 2, 12, 12, '2025-12-10 18:42:42'),
(10, 47, 3, 3, 12, 12, '2025-12-10 18:42:44'),
(11, 47, 3, 4, 12, 12, '2025-12-10 18:42:45'),
(12, 50, 3, 1, 12, 2, '2025-12-10 18:58:51'),
(13, 52, 3, 1, 12, 40, '2025-12-10 21:49:04'),
(14, 52, 3, 2, 12, 50, '2025-12-10 21:49:05'),
(15, 52, 3, 3, 12, 60, '2025-12-10 21:49:05'),
(16, 52, 3, 4, 12, 70, '2025-12-10 21:49:06'),
(17, 54, 1, 1, 12, 30, '2025-12-10 23:05:47'),
(18, 54, 1, 2, 12, 35, '2025-12-10 23:05:48'),
(19, 54, 1, 3, 12, 40, '2025-12-10 23:05:48'),
(20, 54, 1, 4, 12, 45, '2025-12-10 23:05:48'),
(21, 54, 2, 1, 12, 100, '2025-12-10 23:06:02'),
(22, 54, 2, 2, 12, 120, '2025-12-10 23:06:02'),
(23, 54, 2, 3, 12, 150, '2025-12-10 23:06:02'),
(24, 54, 2, 4, 12, 180, '2025-12-10 23:06:10'),
(25, 54, 3, 1, 12, 50, '2025-12-10 23:06:25'),
(26, 54, 3, 2, 12, 12, '2025-12-10 23:06:25'),
(27, 54, 3, 3, 12, 12, '2025-12-10 23:06:26'),
(28, 56, 1, 1, 12, 30, '2025-12-11 16:17:26'),
(29, 56, 1, 2, 12, 35, '2025-12-11 16:17:26'),
(30, 56, 1, 3, 12, 40, '2025-12-11 16:17:26'),
(31, 56, 1, 4, 12, 45, '2025-12-11 16:17:27'),
(32, 56, 2, 1, 12, 100, '2025-12-11 16:17:28'),
(33, 56, 2, 2, 12, 120, '2025-12-11 16:17:29'),
(34, 56, 2, 3, 12, 150, '2025-12-11 16:17:29'),
(35, 56, 2, 4, 12, 180, '2025-12-11 16:17:29'),
(36, 56, 3, 1, 12, 50, '2025-12-11 16:17:33'),
(37, 56, 3, 2, 12, 12, '2025-12-11 16:17:33'),
(38, 56, 3, 3, 12, 12, '2025-12-11 16:17:34'),
(39, 58, 1, 1, 12, 15, '2025-12-12 16:44:02'),
(40, 58, 1, 2, 12, 20, '2025-12-12 16:44:02'),
(41, 58, 1, 3, 12, 25, '2025-12-12 16:44:03'),
(42, 58, 1, 4, 12, 30, '2025-12-12 16:44:03'),
(43, 59, 1, 1, 12, 15, '2025-12-12 17:10:25'),
(44, 59, 1, 2, 12, 20, '2025-12-12 17:10:25'),
(45, 59, 1, 3, 12, 25, '2025-12-12 17:10:25'),
(46, 59, 1, 4, 12, 30, '2025-12-12 17:10:26'),
(47, 59, 1, 5, 12, 12, '2025-12-12 17:10:37'),
(48, 61, 3, 1, 12, 12, '2025-12-12 19:12:44'),
(49, 61, 3, 2, 12, 12, '2025-12-12 19:12:44'),
(50, 61, 3, 3, 12, 12, '2025-12-12 19:12:44'),
(51, 61, 3, 4, 12, 12, '2025-12-12 19:12:45'),
(52, 62, 3, 1, 12, 12, '2025-12-12 19:13:02'),
(53, 62, 3, 2, 12, 12, '2025-12-12 19:13:03'),
(54, 62, 3, 3, 12, 12, '2025-12-12 19:13:03'),
(55, 62, 3, 4, 12, 12, '2025-12-12 19:13:04'),
(56, 69, 1, 1, 12, 12, '2025-12-12 19:50:56'),
(57, 69, 1, 2, 12, 12, '2025-12-12 19:50:56'),
(58, 69, 1, 3, 12, 12, '2025-12-12 19:50:57'),
(59, 69, 1, 4, 12, 12, '2025-12-12 19:50:57'),
(61, 72, 1, 1, 13, 13, '2026-01-04 10:12:32'),
(62, 72, 1, 2, 13, 13, '2026-01-04 10:12:32'),
(63, 72, 1, 3, 13, 13, '2026-01-04 10:12:33'),
(64, 72, 1, 4, 13, 31, '2026-01-04 10:12:33'),
(65, 73, 1, 1, 13, 13, '2026-01-04 10:12:43'),
(66, 73, 1, 2, 13, 13, '2026-01-04 10:12:43'),
(67, 73, 1, 3, 13, 13, '2026-01-04 10:12:44'),
(68, 73, 1, 4, 13, 31, '2026-01-04 10:12:44'),
(69, 75, 1, 1, 13, 13, '2026-01-14 09:27:19'),
(70, 75, 1, 2, 13, 13, '2026-01-14 09:27:20'),
(71, 75, 1, 3, 13, 13, '2026-01-14 09:27:21'),
(72, 75, 1, 4, 13, 31, '2026-01-14 09:27:22'),
(73, 77, 1, 1, 8, 40, '2026-01-28 11:01:34'),
(74, 77, 1, 2, 8, 50, '2026-01-28 11:01:34'),
(75, 77, 1, 3, 8, 60, '2026-01-28 11:01:35'),
(76, 78, 1, 1, 5, 100, '2026-01-28 11:04:47'),
(77, 78, 1, 2, 3, 120, '2026-01-28 11:04:47'),
(78, 78, 1, 3, 2, 180, '2026-01-28 11:04:47'),
(79, 80, 1, 1, 3, 20, '2026-01-28 11:08:39'),
(80, 82, 1, 1, 8, 80, '2026-01-28 11:28:55'),
(81, 95, 15, 1, 12, 25, '2026-01-28 17:07:01'),
(82, 103, 5, 1, 8, 12, '2026-01-29 09:34:20');

-- --------------------------------------------------------

--
-- Estrutura para tabela `treino_sessao`
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
-- Despejando dados para a tabela `treino_sessao`
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
(41, 8, 7, '2025-12-10 03:12:16', NULL, NULL),
(42, 8, 7, '2025-12-10 17:29:36', '2025-12-10 17:30:15', 37),
(43, 8, 7, '2025-12-10 17:32:06', NULL, NULL),
(44, 8, 7, '2025-12-10 17:35:03', NULL, NULL),
(45, 8, 7, '2025-12-10 17:37:41', '2025-12-10 17:38:21', 38),
(46, 8, 7, '2025-12-10 17:38:25', NULL, NULL),
(47, 8, 7, '2025-12-10 18:42:14', '2025-12-10 18:42:50', 33),
(48, 8, 7, '2025-12-10 18:42:53', NULL, NULL),
(49, 8, 7, '2025-12-10 18:43:46', NULL, NULL),
(50, 8, 7, '2025-12-10 18:58:40', NULL, NULL),
(51, 8, 7, '2025-12-10 18:58:58', NULL, NULL),
(52, 8, 7, '2025-12-10 21:48:37', '2025-12-10 21:49:08', 29),
(53, 8, 7, '2025-12-10 21:49:19', '2025-12-10 21:49:31', 10),
(54, 8, 7, '2025-12-10 23:05:16', '2025-12-10 23:06:29', 72),
(56, 8, 7, '2025-12-11 16:17:24', '2025-12-11 16:17:45', 19),
(57, 9, 7, '2025-12-11 22:30:30', NULL, NULL),
(58, 10, 7, '2025-12-12 16:43:34', '2025-12-12 16:44:08', 32),
(59, 10, 7, '2025-12-12 17:10:23', '2025-12-12 17:10:41', 16),
(60, 10, 7, '2025-12-12 18:54:06', NULL, NULL),
(61, 11, 7, '2025-12-12 19:12:29', '2025-12-12 19:12:47', 14),
(62, 11, 7, '2025-12-12 19:13:00', '2025-12-12 19:13:06', 5),
(64, 13, 7, '2025-12-12 19:43:00', NULL, NULL),
(65, 13, 7, '2025-12-12 19:44:15', NULL, NULL),
(66, 13, 7, '2025-12-12 19:44:21', NULL, NULL),
(69, 12, 7, '2025-12-12 19:50:46', '2025-12-12 19:50:59', 11),
(70, 13, 7, '2025-12-12 19:51:03', '2025-12-12 19:51:10', 5),
(72, 13, 7, '2026-01-04 10:12:24', '2026-01-04 10:12:35', 9),
(73, 13, 7, '2026-01-04 10:12:41', '2026-01-04 10:12:46', 4),
(75, 13, 7, '2026-01-14 09:27:11', '2026-01-14 09:27:31', 16),
(76, 14, 7, '2026-01-28 10:53:53', NULL, NULL),
(77, 14, 7, '2026-01-28 11:01:14', '2026-01-28 11:01:35', 19),
(78, 14, 7, '2026-01-28 11:04:17', '2026-01-28 11:04:47', 27),
(79, 14, 7, '2026-01-28 11:05:19', NULL, NULL),
(80, 14, 7, '2026-01-28 11:07:56', '2026-01-28 11:08:39', 39),
(81, 14, 7, '2026-01-28 11:28:45', NULL, NULL),
(82, 14, 7, '2026-01-28 11:28:45', '2026-01-28 11:28:55', 9),
(83, 14, 7, '2026-01-28 11:28:59', NULL, NULL),
(84, 14, 7, '2026-01-28 11:28:59', NULL, NULL),
(85, 14, 7, '2026-01-28 12:02:21', NULL, NULL),
(86, 14, 7, '2026-01-28 12:10:22', NULL, NULL),
(87, 14, 7, '2026-01-28 12:10:22', NULL, NULL),
(88, 4, 7, '2026-01-28 16:24:07', NULL, NULL),
(89, 4, 7, '2026-01-28 16:24:07', NULL, NULL),
(90, 3, 7, '2026-01-28 16:24:40', NULL, NULL),
(91, 3, 7, '2026-01-28 16:24:40', NULL, NULL),
(92, 3, 7, '2026-01-28 16:36:31', NULL, NULL),
(93, 3, 7, '2026-01-28 16:36:31', NULL, NULL),
(94, 5, 7, '2026-01-28 17:06:06', NULL, NULL),
(95, 5, 7, '2026-01-28 17:06:06', '2026-01-28 17:07:01', 52),
(96, 4, 7, '2026-01-28 17:07:11', NULL, NULL),
(97, 4, 7, '2026-01-28 17:07:11', NULL, NULL),
(98, 5, 7, '2026-01-28 17:07:22', NULL, NULL),
(99, 5, 7, '2026-01-28 17:07:22', NULL, NULL),
(100, 5, 7, '2026-01-28 17:07:40', NULL, NULL),
(101, 5, 7, '2026-01-28 17:07:40', NULL, NULL),
(102, 4, 7, '2026-01-29 09:34:01', NULL, NULL),
(103, 4, 7, '2026-01-29 09:34:01', '2026-01-29 09:34:20', 17),
(104, 5, 7, '2026-01-29 10:27:41', NULL, NULL),
(105, 5, 7, '2026-01-29 10:27:41', NULL, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
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
-- Despejando dados para a tabela `users`
--

INSERT INTO `users` (`id_users`, `userName`, `email`, `password`, `idade`, `peso`, `altura`, `created_at`, `id_tipoUser`) VALUES
(7, 'admin', 'admin@gmail.com', '$2b$10$BF6BTITNiScVEzDHQ46sy.IasCJxm3hSa0i7N8ucWfS1nclS30RgC', 23, 80, 187, '2025-06-10', 1),
(8, 'tomas', 'raposopvptomas@gmail.com', '$2b$10$Bc2wqxEyPmjtOA6zVulWwuYPKlND4OV4CmsLDBiyAIEIuINxKI3yu', 0, 0, 0, '2025-12-09', 2),
(9, 'victor', 'victor@gmail.com', '$2b$10$XFxRRfLyKf5nquThalSsc.V20nATU7eEUQjgqtR4E.wOR5A3pSRFK', 0, 0, 0, '2025-12-09', 2),
(10, 'andre', 'andre@gmail.com', '$2b$10$XHKjm2xbWaGtUgpTi.iaPu1RVDKMpagh5TfpdPWRHTiV7Ls8XWP0i', 0, 0, 0, '2025-12-09', 2),
(11, 'fernando', 'fernando@gmail.com', '$2b$10$FOQ8bw1f1jjfFBfznsSTz.js5YHEZfOExj2Qo6JaL/56QUKOUVhO2', 18, 80, 165, '2025-12-09', 2),
(12, 'alfredo', 'alfredo@gmail.com', '$2b$10$wW79Jx9kPr0bD8KANWrXLugY81K./CU3aJgtomFmw5mBvOoULLhiy', 77, 80, 150, '2025-12-09', 2),
(13, 'helder', 'helder@gmail.com', '$2b$10$oo.mGsWUJwgqa1oaynJDDOMv.6NHQLEvcPrnJykqRDHIrgysyIgbW', 51, 65, 124, '2025-12-09', 2),
(15, 'ana', 'ana@gmail.com', '$2b$10$4XULsV2KcElj7rPk5I69QOxCEKcrmlJtLSCtbzfv3E3M4nts96srm', 21, 60, 160, '2025-12-09', 2),
(16, 'lamine', 'lamine@gmail.com', '$2b$10$YgEkJCbzTQf3Rl/NK6B3FOPdAhgtIwxpRdzRDrVt2m2n5lTkSOvr2', 19, 80, 180, '2025-12-09', 2),
(17, 'afam', 'afam@gmail.com', '$2b$10$bdahp0Chzm55G7OIE6aGfuXUC893skM2qJDhKWVrjmnROz8IZtwrG', 25, 45, 150, '2025-12-12', 2),
(18, 'Raposo', 'Raposo@gmail.com', '$2b$10$aNT6GBzcZVf.9ywvWC7ybO3yOVO21KVae6JizEp1yzbe73CTJQgPa', 17, 73, 189, '2026-01-28', 2);

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `exercicios`
--
ALTER TABLE `exercicios`
  ADD PRIMARY KEY (`id_exercicio`);

--
-- Índices de tabela `tipo_user`
--
ALTER TABLE `tipo_user`
  ADD PRIMARY KEY (`id_tipoUser`);

--
-- Índices de tabela `treino`
--
ALTER TABLE `treino`
  ADD KEY `id_users` (`id_users`),
  ADD KEY `id_treino` (`id_treino`);

--
-- Índices de tabela `treino_admin`
--
ALTER TABLE `treino_admin`
  ADD PRIMARY KEY (`id_treino_admin`);

--
-- Índices de tabela `treino_admin_exercicio`
--
ALTER TABLE `treino_admin_exercicio`
  ADD PRIMARY KEY (`id_treino_admin_exercicio`),
  ADD UNIQUE KEY `unique_treino_exercicio` (`id_treino_admin`,`id_exercicio`),
  ADD KEY `id_exercicio` (`id_exercicio`);

--
-- Índices de tabela `treino_exercicio`
--
ALTER TABLE `treino_exercicio`
  ADD KEY `id_treino` (`id_treino`),
  ADD KEY `id_exercicio` (`id_exercicio`);

--
-- Índices de tabela `treino_serie`
--
ALTER TABLE `treino_serie`
  ADD PRIMARY KEY (`id_serie`),
  ADD KEY `id_sessao` (`id_sessao`),
  ADD KEY `id_exercicio` (`id_exercicio`);

--
-- Índices de tabela `treino_sessao`
--
ALTER TABLE `treino_sessao`
  ADD PRIMARY KEY (`id_sessao`),
  ADD KEY `id_treino` (`id_treino`),
  ADD KEY `id_users` (`id_users`);

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_users`),
  ADD KEY `id_tipoUser` (`id_tipoUser`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `exercicios`
--
ALTER TABLE `exercicios`
  MODIFY `id_exercicio` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=105;

--
-- AUTO_INCREMENT de tabela `treino_admin`
--
ALTER TABLE `treino_admin`
  MODIFY `id_treino_admin` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de tabela `treino_admin_exercicio`
--
ALTER TABLE `treino_admin_exercicio`
  MODIFY `id_treino_admin_exercicio` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de tabela `treino_serie`
--
ALTER TABLE `treino_serie`
  MODIFY `id_serie` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT de tabela `treino_sessao`
--
ALTER TABLE `treino_sessao`
  MODIFY `id_sessao` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=106;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id_users` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `treino_admin_exercicio`
--
ALTER TABLE `treino_admin_exercicio`
  ADD CONSTRAINT `treino_admin_exercicio_ibfk_1` FOREIGN KEY (`id_treino_admin`) REFERENCES `treino_admin` (`id_treino_admin`) ON DELETE CASCADE,
  ADD CONSTRAINT `treino_admin_exercicio_ibfk_2` FOREIGN KEY (`id_exercicio`) REFERENCES `exercicios` (`id_exercicio`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
