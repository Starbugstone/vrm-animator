<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260311101500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add avatar personas, animation emotion tags, and conversation persona linkage.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE avatar_persona (id INT AUTO_INCREMENT NOT NULL, owner_id INT NOT NULL, avatar_id INT NOT NULL, llm_credential_id INT DEFAULT NULL, name VARCHAR(255) NOT NULL, description LONGTEXT DEFAULT NULL, personality LONGTEXT DEFAULT NULL, system_prompt LONGTEXT DEFAULT NULL, is_primary TINYINT(1) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX IDX_A295A8297E3C61F9 (owner_id), INDEX IDX_A295A82986383B10 (avatar_id), INDEX IDX_A295A829483E376E (llm_credential_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci`');
        $this->addSql('ALTER TABLE avatar_persona ADD CONSTRAINT FK_A295A8297E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE avatar_persona ADD CONSTRAINT FK_A295A82986383B10 FOREIGN KEY (avatar_id) REFERENCES avatar (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE avatar_persona ADD CONSTRAINT FK_A295A829483E376E FOREIGN KEY (llm_credential_id) REFERENCES llm_credential (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE animation ADD emotion_tags JSON DEFAULT NULL');
        $this->addSql("UPDATE animation SET emotion_tags = '[]' WHERE emotion_tags IS NULL");
        $this->addSql('ALTER TABLE animation MODIFY emotion_tags JSON NOT NULL');
        $this->addSql('ALTER TABLE conversation ADD persona_id INT DEFAULT NULL, ADD CONSTRAINT FK_8B158FDEAA6D2D43 FOREIGN KEY (persona_id) REFERENCES avatar_persona (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_8B158FDEAA6D2D43 ON conversation (persona_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE conversation DROP FOREIGN KEY FK_8B158FDEAA6D2D43');
        $this->addSql('DROP INDEX IDX_8B158FDEAA6D2D43 ON conversation');
        $this->addSql('ALTER TABLE conversation DROP persona_id');
        $this->addSql('ALTER TABLE avatar_persona DROP FOREIGN KEY FK_A295A8297E3C61F9');
        $this->addSql('ALTER TABLE avatar_persona DROP FOREIGN KEY FK_A295A82986383B10');
        $this->addSql('ALTER TABLE avatar_persona DROP FOREIGN KEY FK_A295A829483E376E');
        $this->addSql('DROP TABLE avatar_persona');
        $this->addSql('ALTER TABLE animation DROP emotion_tags');
    }
}
