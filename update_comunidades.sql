-- Script para atualizar a tabela de comunidades com novos campos
-- Execute isso se a tabela já existe

ALTER TABLE `comunidades` ADD COLUMN `imagem_url` varchar(255) AFTER `descricao`;
ALTER TABLE `comunidades` ADD COLUMN `pais` varchar(100) AFTER `imagem_url`;
ALTER TABLE `comunidades` ADD COLUMN `linguas` varchar(255) AFTER `pais`;
ALTER TABLE `comunidades` ADD COLUMN `categoria` varchar(50) AFTER `linguas`;
ALTER TABLE `comunidades` ADD COLUMN `privada` tinyint(1) DEFAULT 0 AFTER `categoria`;
