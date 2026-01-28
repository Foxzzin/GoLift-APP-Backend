-- SQL para atualizar a BD para integração com ExerciseDB API
-- Execute este script na sua BD 'golift'

-- 1. Adicionar campos à tabela exercicios (se ainda não existem)
ALTER TABLE `exercicios` 
ADD COLUMN `api_id` VARCHAR(255) UNIQUE NULL AFTER `sub_tipo`,
ADD COLUMN `origem` ENUM('local','api') DEFAULT 'local' AFTER `api_id`,
ADD COLUMN `atualizado_em` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `origem`,
MODIFY `nome` VARCHAR(255),
MODIFY `descricao` TEXT;

-- 2. Aumentar tamanhos de campos para compatibilidade
ALTER TABLE `exercicios` MODIFY `video` VARCHAR(500);

-- Pronto! A BD está atualizada para aceitar exercícios da API
