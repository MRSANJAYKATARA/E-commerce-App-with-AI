-- ============================================================================
-- ExamLegacy v2.0.0 — Complete Database Schema & Seed Data
-- Platform: ExamLegacy (Powered by SANJAYXLEGACY)
-- Compatible with: MariaDB 10.5+, MariaDB 11.x, MySQL 8.0+, MySQL 5.7+
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. Table structure for table `users`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `name` VARCHAR(190) NOT NULL DEFAULT '',
  `phone` VARCHAR(24) DEFAULT NULL,
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `role` ENUM('user','admin') NOT NULL DEFAULT 'user',
  `status` ENUM('active','suspended','disabled') NOT NULL DEFAULT 'active',
  `wallet_balance_paise` BIGINT NOT NULL DEFAULT 0,
  `ai_credit_balance` BIGINT NOT NULL DEFAULT 0,
  `trial_credits_given` TINYINT(1) NOT NULL DEFAULT 0,
  `vip_active` TINYINT(1) NOT NULL DEFAULT 0,
  `vip_expires_at` DATETIME DEFAULT NULL,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_firebase` (`firebase_uid`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Table structure for table `products`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(190) NOT NULL,
  `title` VARCHAR(190) NOT NULL,
  `subtitle` VARCHAR(255) NOT NULL DEFAULT '',
  `description` TEXT,
  `category` VARCHAR(120) NOT NULL DEFAULT 'General',
  `language` VARCHAR(60) NOT NULL DEFAULT 'English',
  `price_paise` BIGINT NOT NULL DEFAULT 0,
  `mrp_paise` BIGINT NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `thumbnail_path` VARCHAR(500) DEFAULT NULL,
  `pdf_path` VARCHAR(500) NOT NULL,
  `pdf_sha256` CHAR(64) DEFAULT NULL,
  `page_count` INT NOT NULL DEFAULT 0,
  `file_size_bytes` BIGINT NOT NULL DEFAULT 0,
  `download_allowed` TINYINT(1) NOT NULL DEFAULT 0,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `is_vip` TINYINT(1) NOT NULL DEFAULT 0,
  `access_duration_days` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  KEY `idx_products_published` (`is_published`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_vip` (`is_vip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Table structure for table `orders`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_code` VARCHAR(40) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('pending','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  `payment_method` ENUM('cashfree','wallet','split') NOT NULL DEFAULT 'cashfree',
  `subtotal_paise` BIGINT NOT NULL DEFAULT 0,
  `wallet_applied_paise` BIGINT NOT NULL DEFAULT 0,
  `gateway_amount_paise` BIGINT NOT NULL DEFAULT 0,
  `total_paise` BIGINT NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `provider` VARCHAR(30) DEFAULT NULL,
  `provider_order_id` VARCHAR(120) DEFAULT NULL,
  `failure_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_code` (`order_code`),
  KEY `idx_orders_user` (`user_id`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_provider` (`provider_order_id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. Table structure for table `order_items`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `title_snapshot` VARCHAR(190) NOT NULL,
  `price_paise` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_items_order` (`order_id`),
  KEY `idx_items_product` (`product_id`),
  CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. Table structure for table `payment_intents`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `payment_intents`;
CREATE TABLE `payment_intents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `kind` ENUM('order','recharge','credit_pack','vip') NOT NULL,
  `ref_id` BIGINT UNSIGNED DEFAULT NULL,
  `amount_paise` BIGINT NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `status` ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  `provider` VARCHAR(30) NOT NULL DEFAULT 'cashfree',
  `provider_order_id` VARCHAR(120) DEFAULT NULL,
  `idempotency_key` VARCHAR(160) NOT NULL,
  `meta` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_intent_idem` (`idempotency_key`),
  KEY `idx_intent_user` (`user_id`,`id`),
  KEY `idx_intent_provider_order` (`provider_order_id`),
  CONSTRAINT `fk_intent_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Table structure for table `credit_packs`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `credit_packs`;
CREATE TABLE `credit_packs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `credits` BIGINT NOT NULL DEFAULT 0,
  `bonus_credits` BIGINT NOT NULL DEFAULT 0,
  `price_paise` BIGINT NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_packs_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. Table structure for table `ai_credit_transactions`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `ai_credit_transactions`;
CREATE TABLE `ai_credit_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('trial','purchase','usage','adjustment') NOT NULL,
  `amount` BIGINT NOT NULL,
  `balance_after` BIGINT NOT NULL,
  `usage_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_intent_id` BIGINT UNSIGNED DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_ledger_user` (`user_id`,`id`),
  CONSTRAINT `fk_ai_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Table structure for table `ai_usage`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `ai_usage`;
CREATE TABLE `ai_usage` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `module` ENUM('study','support','exam_accelerator') NOT NULL,
  `credits_deducted` INT NOT NULL DEFAULT 0,
  `tokens_in` INT NOT NULL DEFAULT 0,
  `tokens_out` INT NOT NULL DEFAULT 0,
  `model` VARCHAR(60) NOT NULL DEFAULT 'gemini-2.5-flash',
  `document_id` BIGINT UNSIGNED DEFAULT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_usage_user` (`user_id`,`created_at`),
  CONSTRAINT `fk_ai_usage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9. Table structure for table `ai_documents`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `ai_documents`;
CREATE TABLE `ai_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `source_type` ENUM('product_pdf','user_upload','paste') NOT NULL,
  `product_id` BIGINT UNSIGNED DEFAULT NULL,
  `original_filename` VARCHAR(255) DEFAULT NULL,
  `storage_path` VARCHAR(500) DEFAULT NULL,
  `extracted_text` MEDIUMTEXT,
  `char_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('ready','processing','failed') NOT NULL DEFAULT 'ready',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_user` (`user_id`),
  CONSTRAINT `fk_doc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 10. Table structure for table `wallet_transactions`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `wallet_transactions`;
CREATE TABLE `wallet_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('recharge','purchase','refund','bonus','adjustment') NOT NULL,
  `amount_paise` BIGINT NOT NULL,
  `balance_after_paise` BIGINT NOT NULL,
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_intent_id` BIGINT UNSIGNED DEFAULT NULL,
  `idempotency_key` VARCHAR(160) NOT NULL,
  `description` VARCHAR(255) DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wallet_idem` (`idempotency_key`),
  KEY `idx_wallet_user` (`user_id`,`id`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 11. Table structure for table `pdf_access`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `pdf_access`;
CREATE TABLE `pdf_access` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `source` ENUM('order','vip','grant') NOT NULL DEFAULT 'order',
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `access_start` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `access_end` DATETIME DEFAULT NULL,
  `is_revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_access_user_prod` (`user_id`,`product_id`),
  KEY `idx_access_prod` (`product_id`),
  CONSTRAINT `fk_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_access_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 12. Table structure for table `pdf_access_logs`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `pdf_access_logs`;
CREATE TABLE `pdf_access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT '',
  `watermark_applied` VARCHAR(255) NOT NULL,
  `accessed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_access_log_user` (`user_id`,`accessed_at`),
  CONSTRAINT `fk_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 13. Table structure for table `viewer_sessions`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `viewer_sessions`;
CREATE TABLE `viewer_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` CHAR(64) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT '',
  `expires_at` DATETIME NOT NULL,
  `stream_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_viewer_token` (`token_hash`),
  KEY `idx_viewer_user` (`user_id`),
  KEY `idx_viewer_exp` (`expires_at`),
  CONSTRAINT `fk_viewer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_viewer_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 14. Table structure for table `vip_plans`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `vip_plans`;
CREATE TABLE `vip_plans` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `interval` ENUM('monthly','yearly','unlimited') NOT NULL,
  `price_paise` BIGINT NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'INR',
  `benefits` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `fair_use` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vip_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 15. Table structure for table `vip_memberships`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `vip_memberships`;
CREATE TABLE `vip_memberships` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `plan_id` BIGINT UNSIGNED NOT NULL,
  `payment_intent_id` BIGINT UNSIGNED DEFAULT NULL,
  `status` ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  `starts_at` DATETIME NOT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vip_user` (`user_id`),
  CONSTRAINT `fk_vip_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vip_plan` FOREIGN KEY (`plan_id`) REFERENCES `vip_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 16. Table structure for table `support_threads`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `support_threads`;
CREATE TABLE `support_threads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `subject` VARCHAR(190) NOT NULL,
  `status` ENUM('open','waiting_user','resolved','closed') NOT NULL DEFAULT 'open',
  `assigned_admin_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_support_user` (`user_id`),
  CONSTRAINT `fk_supp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 17. Table structure for table `support_messages`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `support_messages`;
CREATE TABLE `support_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `sender_type` ENUM('user','admin','system') NOT NULL,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `attachment_path` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_thread` (`thread_id`,`id`),
  CONSTRAINT `fk_msg_thread` FOREIGN KEY (`thread_id`) REFERENCES `support_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 18. Table structure for table `notifications`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `category` ENUM('account','purchase','payment','order','pdf','support','product','system') NOT NULL DEFAULT 'system',
  `title` VARCHAR(190) NOT NULL,
  `body` TEXT,
  `link_url` VARCHAR(500) DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `idempotency_key` VARCHAR(160) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notif_idem` (`idempotency_key`),
  KEY `idx_notif_user` (`user_id`,`is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 19. Table structure for table `audit_logs`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_type` ENUM('user','admin','system','webhook') NOT NULL,
  `actor_id` BIGINT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(40) DEFAULT NULL,
  `target_id` BIGINT UNSIGNED DEFAULT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `payload` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_type`,`actor_id`),
  KEY `idx_audit_action` (`action`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 20. Table structure for table `settings`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(80) NOT NULL,
  `value` TEXT,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 21. Table structure for table `rate_limits`
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `rate_limits`;
CREATE TABLE `rate_limits` (
  `key` VARCHAR(190) NOT NULL,
  `hits` INT NOT NULL DEFAULT 0,
  `reset_at` INT NOT NULL,
  PRIMARY KEY (`key`),
  KEY `idx_rate_limits_reset` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SEED DATA INSERTIONS
-- ============================================================================

-- Settings Seed Data (Safe Defaults, DPDP Act Grievance Officer, Brand Tags)
INSERT INTO `settings` (`id`, `key`, `value`) VALUES
  (1, 'support_email', 'sanjayxlegacysupport@gmail.com'),
  (2, 'telegram', 'https://t.me/sanjayx_legacy01'),
  (3, 'telegram_channel', 'https://t.me/examlegacy'),
  (4, 'instagram', 'https://instagram.com/sanjayx_legacy01'),
  (5, 'youtube', 'https://youtube.com/@sanjayxlagacy'),
  (6, 'whatsapp_channel', 'https://whatsapp.com/channel/0029VbDBSLU65yDGKoSljB3v'),
  (7, 'whatsapp_support_enabled', '0'),
  (8, 'whatsapp_support_link', ''),
  (9, 'brand_powered_by', 'Powered by SANJAYXLEGACY'),
  (10, 'trial_ai_credits', '50'),
  (11, 'ai_credit_cost_study', '2'),
  (12, 'ai_credit_cost_support', '1'),
  (13, 'currency', 'INR')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- VIP PASS Plans
INSERT INTO `vip_plans` (`id`, `code`, `name`, `interval`, `price_paise`, `currency`, `benefits`, `fair_use`, `is_active`) VALUES
  (1, 'vip_monthly', 'VIP PASS Monthly', 'monthly', 19900, 'INR',
     '{"premium_ai": true, "vip_pdfs": true, "member_discount_pct": 10, "vip_badge": true, "priority_support": true, "early_access": true}',
     '{"note": "Fair-use: reasonable personal study use. Rate limits apply to prevent abuse."}',
     1),
  (2, 'vip_yearly', 'VIP PASS Yearly', 'yearly', 99900, 'INR',
     '{"premium_ai": true, "vip_pdfs": true, "member_discount_pct": 15, "vip_badge": true, "priority_support": true, "early_access": true}',
     '{"note": "Fair-use: reasonable personal study use. Rate limits apply to prevent abuse."}',
     1),
  (3, 'vip_unlimited', 'VIP PASS Unlimited', 'unlimited', 499900, 'INR',
     '{"premium_ai": true, "vip_pdfs": true, "member_discount_pct": 20, "vip_badge": true, "priority_support": true, "early_access": true}',
     '{"unlimited_scope": "Unlimited applies to included VIP PDFs and standard AI usage within fair-use limits.", "rate_limit": {"study_ai_per_minute": 20, "burst": 40}, "anti_abuse": "Automated scraping, resale, or credential sharing violates fair use and may suspend access.", "note": "Not truly infinite: security, rate-limits and anti-abuse rules always apply."}',
     1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price_paise` = VALUES(`price_paise`), `benefits` = VALUES(`benefits`), `fair_use` = VALUES(`fair_use`), `is_active` = VALUES(`is_active`);

-- AI Credit Packs
INSERT INTO `credit_packs` (`id`, `code`, `name`, `credits`, `bonus_credits`, `price_paise`, `currency`, `is_active`) VALUES
  (1, 'credits_starter', 'Starter Pack', 100, 0, 4900, 'INR', 1),
  (2, 'credits_plus', 'Plus Pack', 300, 30, 12900, 'INR', 1),
  (3, 'credits_pro', 'Pro Pack', 1000, 150, 39900, 'INR', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `credits` = VALUES(`credits`), `bonus_credits` = VALUES(`bonus_credits`), `price_paise` = VALUES(`price_paise`), `is_active` = VALUES(`is_active`);

-- Educational Products (Published Notes & Formulas)
INSERT INTO `products` (`id`, `slug`, `title`, `subtitle`, `description`, `category`, `language`, `price_paise`, `mrp_paise`, `currency`, `thumbnail_path`, `pdf_path`, `pdf_sha256`, `page_count`, `file_size_bytes`, `download_allowed`, `is_published`, `is_vip`, `access_duration_days`) VALUES
  (1, 'botany-physiology-kit', 'Botany & Plant Physiology Master Kit', 'High-yield diagrams, cycles, and NCERT tabular summary', 'Comprehensive coverage of Photosynthesis, Respiration, Plant Growth and Mineral Nutrition with NEET/AIPMT 15-year trend analysis.', 'Biology', 'English', 14900, 39900, 'INR', NULL, 'botany-physiology-kit.pdf', NULL, 68, 18874368, 1, 1, 1, 0),
  (2, 'organic-chemistry-pyq', 'Organic Chemistry 15-Yr Solved PYQs', 'Reaction mechanisms, named reactions & shortcut tricks', 'Chapter-wise compilation of past 15 years JEE & NEET questions with step-by-step mechanism explanations and common examiner traps.', 'Chemistry', 'English', 19900, 49900, 'INR', NULL, 'organic-chemistry-pyq.pdf', NULL, 124, 24117248, 1, 1, 1, 0),
  (3, 'physics-formula-guide', 'Physics Formula Handbook & Cheat Sheet', 'All 28 chapters quick-revision pocket handbook', 'Covers Mechanics, Electrodynamics, Optics, Thermodynamics and Modern Physics with dimension checks, unit conversions and graph patterns.', 'Physics', 'English', 12900, 29900, 'INR', NULL, 'physics-formula-guide.pdf', NULL, 84, 15728640, 1, 1, 0, 0),
  (4, 'zoology-sem4-notes', 'Zoology Animal Physiology & Genetics', 'Cell signaling, immunology and heredity quick-notes', 'Curated summary notes designed for rapid pre-exam recall with mnemonic devices, flowcharts and labeled biological illustrations.', 'Zoology', 'English', 17900, 39900, 'INR', NULL, 'zoology-sem4-notes.pdf', NULL, 96, 21495808, 1, 1, 1, 0)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `price_paise` = VALUES(`price_paise`), `is_published` = VALUES(`is_published`);

-- Superadmin Account Seed
INSERT INTO `users` (`id`, `firebase_uid`, `email`, `email_verified`, `name`, `phone`, `avatar_url`, `role`, `status`, `wallet_balance_paise`, `ai_credit_balance`, `trial_credits_given`, `vip_active`) VALUES
  (1, '2RyGoMqyjqcXiBrp5gH1VdSLWx72', 'sanjaykatara59927@gmail.com', 1, 'Sanjay Katara', NULL, NULL, 'admin', 'active', 50000, 1000, 1, 1),
  (2, 'Zis8R7bZQshbbFa6mJdRfFk6rWk2', 'gangakatara125@gmail.com', 1, 'Sanjay katara', NULL, NULL, 'admin', 'active', 32100, 493, 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `role` = VALUES(`role`), `status` = VALUES(`status`), `email` = VALUES(`email`);

SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================================
-- End of ExamLegacy Database Setup
-- ============================================================================
