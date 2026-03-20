<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260319120503 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add avatar speech mode and persist spoken message content for text-only chat rendering.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE avatar ADD speech_mode VARCHAR(16) NOT NULL DEFAULT 'auto'");
        $this->addSql('ALTER TABLE conversation_message ADD spoken_content LONGTEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE conversation_message DROP spoken_content');
        $this->addSql('ALTER TABLE avatar DROP speech_mode');
    }
}
