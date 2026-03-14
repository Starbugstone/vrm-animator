<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260314104500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add provider options to LLM credentials for provider-specific connection settings.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE llm_credential ADD provider_options JSON DEFAULT NULL');
        $this->addSql('UPDATE llm_credential SET provider_options = \'[]\' WHERE provider_options IS NULL');
        $this->addSql('ALTER TABLE llm_credential MODIFY provider_options JSON NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE llm_credential DROP provider_options');
    }
}
