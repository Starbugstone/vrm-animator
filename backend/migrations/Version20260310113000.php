<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260310113000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add Google auth fields, avatar persona storage, animations, and avatar memory tables.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE `user` ADD google_subject VARCHAR(255) DEFAULT NULL, ADD google_linked_at DATETIME DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_8D93D649274A50A6 ON `user` (google_subject)');

        $this->addSql('ALTER TABLE avatar ADD backstory LONGTEXT DEFAULT NULL, ADD personality LONGTEXT DEFAULT NULL, ADD system_prompt LONGTEXT DEFAULT NULL, ADD stored_filename VARCHAR(255) DEFAULT NULL, ADD mime_type VARCHAR(255) DEFAULT NULL, ADD size_bytes INT DEFAULT NULL');

        $this->addSql('CREATE TABLE animation (id INT AUTO_INCREMENT NOT NULL, owner_id INT NOT NULL, avatar_id INT DEFAULT NULL, name VARCHAR(255) NOT NULL, filename VARCHAR(255) NOT NULL, stored_filename VARCHAR(255) DEFAULT NULL, mime_type VARCHAR(255) DEFAULT NULL, size_bytes INT DEFAULT NULL, description LONGTEXT DEFAULT NULL, keywords JSON NOT NULL, kind VARCHAR(32) NOT NULL, is_default TINYINT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_5F4A3BBD7E3C61F9 (owner_id), INDEX IDX_5F4A3BBD86383B10 (avatar_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE animation ADD CONSTRAINT FK_5F4A3BBD7E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE animation ADD CONSTRAINT FK_5F4A3BBD86383B10 FOREIGN KEY (avatar_id) REFERENCES avatar (id) ON DELETE SET NULL');

        $this->addSql('CREATE TABLE avatar_memory (id INT AUTO_INCREMENT NOT NULL, avatar_id INT NOT NULL, owner_id INT NOT NULL, markdown_content LONGTEXT NOT NULL, revision INT NOT NULL, last_updated_by VARCHAR(32) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_F4E9D7E386383B10 (avatar_id), INDEX IDX_F4E9D7E37E3C61F9 (owner_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE avatar_memory ADD CONSTRAINT FK_F4E9D7E386383B10 FOREIGN KEY (avatar_id) REFERENCES avatar (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE avatar_memory ADD CONSTRAINT FK_F4E9D7E37E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');

        $this->addSql('CREATE TABLE avatar_memory_revision (id INT AUTO_INCREMENT NOT NULL, avatar_memory_id INT NOT NULL, revision INT NOT NULL, markdown_snapshot LONGTEXT NOT NULL, source VARCHAR(32) NOT NULL, created_at DATETIME NOT NULL, INDEX IDX_3294E5536532B9D5 (avatar_memory_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE avatar_memory_revision ADD CONSTRAINT FK_3294E5536532B9D5 FOREIGN KEY (avatar_memory_id) REFERENCES avatar_memory (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE animation DROP FOREIGN KEY FK_5F4A3BBD7E3C61F9');
        $this->addSql('ALTER TABLE animation DROP FOREIGN KEY FK_5F4A3BBD86383B10');
        $this->addSql('ALTER TABLE avatar_memory DROP FOREIGN KEY FK_F4E9D7E386383B10');
        $this->addSql('ALTER TABLE avatar_memory DROP FOREIGN KEY FK_F4E9D7E37E3C61F9');
        $this->addSql('ALTER TABLE avatar_memory_revision DROP FOREIGN KEY FK_3294E5536532B9D5');

        $this->addSql('DROP TABLE animation');
        $this->addSql('DROP TABLE avatar_memory');
        $this->addSql('DROP TABLE avatar_memory_revision');

        $this->addSql('DROP INDEX UNIQ_8D93D649274A50A6 ON `user`');
        $this->addSql('ALTER TABLE `user` DROP google_subject, DROP google_linked_at');

        $this->addSql('ALTER TABLE avatar DROP backstory, DROP personality, DROP system_prompt, DROP stored_filename, DROP mime_type, DROP size_bytes');
    }
}
