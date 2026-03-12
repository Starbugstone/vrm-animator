<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260310162000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add encrypted per-user LLM credential storage.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE llm_credential (id INT AUTO_INCREMENT NOT NULL, owner_id INT NOT NULL, provider VARCHAR(32) NOT NULL, encrypted_secret LONGTEXT NOT NULL, default_model VARCHAR(255) DEFAULT NULL, is_active TINYINT(1) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_AAB0E2257E3C61F9 (owner_id), UNIQUE INDEX uniq_llm_credential_owner_provider (owner_id, provider), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE llm_credential ADD CONSTRAINT FK_AAB0E2257E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE llm_credential DROP FOREIGN KEY FK_AAB0E2257E3C61F9');
        $this->addSql('DROP TABLE llm_credential');
    }
}
