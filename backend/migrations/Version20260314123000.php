<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260314123000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add ElevenLabs TTS credentials and avatar voice configuration';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE tts_credential (id INT AUTO_INCREMENT NOT NULL, owner_id INT NOT NULL, name VARCHAR(255) NOT NULL, encrypted_secret LONGTEXT NOT NULL, default_model VARCHAR(64) DEFAULT NULL, is_active TINYINT(1) NOT NULL, created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', INDEX IDX_78EC550B7E3C61F9 (owner_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE tts_credential ADD CONSTRAINT FK_78EC550B7E3C61F9 FOREIGN KEY (owner_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE avatar ADD presentation_gender VARCHAR(16) DEFAULT NULL, ADD tts_credential_id INT DEFAULT NULL, ADD tts_voice_id VARCHAR(128) DEFAULT NULL, ADD tts_voice_name VARCHAR(255) DEFAULT NULL, ADD tts_voice_gender_tag VARCHAR(16) DEFAULT NULL');
        $this->addSql('ALTER TABLE avatar ADD CONSTRAINT FK_86383B1067293075 FOREIGN KEY (tts_credential_id) REFERENCES tts_credential (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_86383B1067293075 ON avatar (tts_credential_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avatar DROP FOREIGN KEY FK_86383B1067293075');
        $this->addSql('DROP TABLE tts_credential');
        $this->addSql('DROP INDEX IDX_86383B1067293075 ON avatar');
        $this->addSql('ALTER TABLE avatar DROP presentation_gender, DROP tts_credential_id, DROP tts_voice_id, DROP tts_voice_name, DROP tts_voice_gender_tag');
    }
}
