USE chefmate_db;

CREATE TABLE IF NOT EXISTS UserDietNotes (
  noteId INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  noteType ENUM('allergy', 'restriction', 'preference', 'health_note') NOT NULL,
  label VARCHAR(255) NOT NULL,
  keywordsJson JSON NULL,
  instruction TEXT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  startAt DATETIME NULL,
  endAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_diet_note_user FOREIGN KEY (userId) REFERENCES Users(userId)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_user_diet_note_user_active (userId, isActive),
  INDEX idx_user_diet_note_period (startAt, endAt)
);
