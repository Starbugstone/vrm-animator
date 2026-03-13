<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260313102000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add avatar speech voice gender and speech language preferences';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE avatar ADD speech_voice_gender VARCHAR(16) DEFAULT NULL, ADD speech_language VARCHAR(16) NOT NULL DEFAULT 'auto'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avatar DROP speech_voice_gender, DROP speech_language');
    }
}
