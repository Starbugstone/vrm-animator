<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260311124500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Allow multiple named LLM credentials per provider and owner';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE llm_credential DROP INDEX uniq_llm_credential_owner_provider');
        $this->addSql("ALTER TABLE llm_credential ADD name VARCHAR(255) DEFAULT NULL");
        $this->addSql("UPDATE llm_credential SET name = CONCAT(UPPER(LEFT(provider, 1)), SUBSTRING(provider, 2), ' credential') WHERE name IS NULL");
        $this->addSql('ALTER TABLE llm_credential MODIFY name VARCHAR(255) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE c1 FROM llm_credential c1 INNER JOIN llm_credential c2 ON c1.owner_id = c2.owner_id AND c1.provider = c2.provider AND c1.id > c2.id');
        $this->addSql('ALTER TABLE llm_credential DROP COLUMN name');
        $this->addSql('ALTER TABLE llm_credential ADD CONSTRAINT uniq_llm_credential_owner_provider UNIQUE (owner_id, provider)');
    }
}
