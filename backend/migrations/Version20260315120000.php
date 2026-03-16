<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260315120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add a persisted default facing yaw to avatars.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avatar ADD default_facing_yaw DOUBLE PRECISION NOT NULL DEFAULT 0');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avatar DROP default_facing_yaw');
    }
}
