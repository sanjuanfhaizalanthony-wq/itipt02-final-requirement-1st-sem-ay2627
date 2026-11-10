CREATE DATABASE IF NOT EXISTS nutridorm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nutridorm_db;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  dorm_name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_id (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT NOT NULL,
  weekly_allowance DECIMAL(10, 2) NULL,
  emergency_fund_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  equipment JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category VARCHAR(40) NOT NULL,
  note VARCHAR(255) NULL,
  spent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_expenses_user_id (user_id),
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pantry_items (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(30) NOT NULL DEFAULT 'piece',
  category VARCHAR(60) NULL,
  expires_on DATE NULL,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_pantry_items_user_id (user_id),
  CONSTRAINT fk_pantry_items_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plans (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  week_start DATE NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT 'Weekly Meal Plan',
  plan_data JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_meal_plans_user_id (user_id),
  CONSTRAINT fk_meal_plans_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grocery_items (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  meal_plan_id INT NULL,
  name VARCHAR(120) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(30) NOT NULL DEFAULT 'piece',
  estimated_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  category VARCHAR(60) NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_grocery_items_user_id (user_id),
  KEY ix_grocery_items_meal_plan_id (meal_plan_id),
  CONSTRAINT fk_grocery_items_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_grocery_items_meal_plan FOREIGN KEY (meal_plan_id)
    REFERENCES meal_plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  logged_on DATE NOT NULL,
  meal_name VARCHAR(120) NULL,
  calories DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  protein_g DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  fiber_g DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_nutrition_logs_user_id (user_id),
  CONSTRAINT fk_nutrition_logs_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
