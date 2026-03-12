<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260310183000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add conversation and conversation message persistence for avatar chat.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE conversation (id INT AUTO_INCREMENT NOT NULL, owner_id INT NOT NULL, avatar_id INT NOT NULL, provider VARCHAR(32) NOT NULL, model VARCHAR(255) DEFAULT NULL, title VARCHAR(255) DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_8B158FDE7E3C61F9 (owner_id), INDEX IDX_8B158FDE86383B10 (avatar_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('CREATE TABLE conversation_message (id INT AUTO_INCREMENT NOT NULL, conversation_id INT NOT NULL, role VARCHAR(16) NOT NULL, content LONGTEXT NOT NULL, raw_provider_content LONGTEXT DEFAULT NULL, parsed_text LONGTEXT DEFAULT NULL, parsed_emotion_tags JSON NOT NULL, parsed_animation_tags JSON NOT NULL, created_at DATETIME NOT NULL, INDEX IDX_579F1E6B8D93D649 (conversation_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE conversation ADD CONSTRAINT FK_8B158FDE7E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE conversation ADD CONSTRAINT FK_8B158FDE86383B10 FOREIGN KEY (avatar_id) REFERENCES avatar (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE conversation_message ADD CONSTRAINT FK_579F1E6B8D93D649 FOREIGN KEY (conversation_id) REFERENCES conversation (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE conversation DROP FOREIGN KEY FK_8B158FDE7E3C61F9');
        $this->addSql('ALTER TABLE conversation DROP FOREIGN KEY FK_8B158FDE86383B10');
        $this->addSql('ALTER TABLE conversation_message DROP FOREIGN KEY FK_579F1E6B8D93D649');
        $this->addSql('DROP TABLE conversation');
        $this->addSql('DROP TABLE conversation_message');
    }
}
