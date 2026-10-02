# ==============================================================================
# 🚀 EXAMLEGACY — MASTER PRD & BUILD PROMPT (FOR AI / DEVELOPER)
# ==============================================================================
# Use this exact prompt in any AI Coding Assistant (Antigravity, Claude, ChatGPT,
# Cursor, etc.) to construct the complete ExamLegacy application from scratch.
# ==============================================================================

Act as a Principal Full-Stack Architect, Senior PWA Systems Engineer, and Strict UI/UX Designer.
Your objective is to construct a production-ready, enterprise-grade digital education Progressive Web App (PWA) called **"ExamLegacy"** (Powered by SANJAYXLEGACY).

Follow all architectural directives, security standards, data models, and UI/UX specifications outlined below with zero shortcuts, zero placeholders, and zero developer jargon in the client application.

---

## 1. PROJECT OVERVIEW & VALUE PROPOSITION
ExamLegacy is a high-performance, mobile-first educational marketplace and learning accelerator tailored for competitive exam aspirants (NEET, JEE, UPSC, SSC, Banking, State PSCs, CBSE).
It combines:
1. **Curated Digital Store & Library (Vault):** High-yield PDF revision handbooks, chapter-wise solved PYQs (15 years), and formula kits.
2. **In-App Digital Content Protection (DRM):** In-memory blob streaming with dynamic purchaser watermarks. Raw PDF files are NEVER publicly accessible or downloadable without authorization.
3. **Study AI Arena:** Gemini 2.5 Flash-powered academic copilot with step-by-step LaTeX formulas, 12 competitive exam study formats, and an offline smart fallback engine.
4. **Store Wallet & Instant UPI Payments:** Cashfree Payment Gateway (UPI, Google Pay, PhonePe, Cards) with automated wallet balance split support.
5. **Single-Superadmin Enterprise Console (`/admin/`):** Dedicated, Google-independent administrative command center for user balances, PDF uploading, order inspection, and system metrics.

---

## 2. STRICT SYSTEM ARCHITECTURAL & UI/UX RULES

### A. Absolute Privacy & Data Abstraction (No Developer Jargon)
- NEVER expose backend infrastructure details in the User Interface, alerts, toasts, or public logs.
- BANNED terms in student DOM/text: `"MySQL"`, `"Firestore"`, `"PHP"`, `"Apache"`, `"cURL"`, `"API Key"`, `"Database error"`, `"Stack trace"`.
- User-facing messages must always be polite and consumer-friendly (e.g., *"Updating your study library..."*, *"Synchronizing materials..."*).

### B. Anti-Gravity Native Viewport Lock (No-Zoom / No-Pinch)
- Force the app layout to act strictly like a static native mobile app:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  ```
- Root CSS constraints:
  ```css
  html, body {
    width: 100%; height: 100%;
    position: fixed; overflow: hidden;
    touch-action: pan-y;
    -webkit-text-size-adjust: 100%;
    overscroll-behavior-y: contain;
  }
  ```
- Rigid layout:
  - `.topbar`: Fixed at top (`height: 56px; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.05);`).
  - `.bottomnav`: Fixed at bottom (`height: 64px; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.05);`).
  - `.main-content`: The ONLY scrollable element (`margin-top: 56px; margin-bottom: 64px; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y !important;`).
- Universal scrollbar suppression (hide vertical scrollbar line during scroll):
  ```css
  * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  *::-webkit-scrollbar, ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  ```

---

## 3. TECHNOLOGY STACK & RUNTIME ENVIRONMENT

- **Frontend:**
  - Vanilla HTML5 Single-Page Application (SPA) + Modern CSS3 Design Tokens.
  - Vanilla JavaScript ES6+ (Modular `window.EL` namespace).
  - Service Worker (`sw.js`) for offline caching (App Shell, CSS, JS, icons).
  - MathJax 3.x for mathematical & chemical LaTeX formula typesetting.
  - PDF.js / In-memory canvas rendering for DRM document viewing.
- **Backend API:**
  - PHP 8.2+ REST API front controller (`api/index.php`).
  - PDO with 100% prepared SQL statements.
  - Compatible with shared hosting (InfinityFree, cPanel, Hostinger) and localhost/Termux.
  - Smart database failover: if remote MySQL host is unreachable locally, automatically failover to `127.0.0.1:3306`.
- **Databases (Hybrid Dual-Engine):**
  - **Relational Master:** MySQL 8.0+ / MariaDB 10.5+ (21 tables for financial integrity and DRM).
  - **Real-Time Secondary:** Google Cloud Firestore (`examlegacy-19d4b`) for instant cross-device state mirroring.
- **Third-Party Integrations:**
  - Firebase Authentication (Google Sign-In for students).
  - Cashfree Payment Gateway (PG API version `2023-08-01`).
  - Google Gemini 2.5 Flash API (AI Study Tutor).
  - Gmail SMTP (Transactional purchase and welcome emails).

---

## 4. DUAL-STREAM AUTHENTICATION & ACCESS CONTROL

### 1. Student Flow (Google Sign-In)
- Uses Firebase Web SDK (v10 compat).
- Client obtains ID token -> passes via `Authorization: Bearer <token>`, `X-Authorization`, and `X-Firebase-Token`.
- Backend verifies cryptographic signature (with local Google cert caching for shared hosting).
- Auto-provisions user row in MySQL and grants **50 Free AI Welcome Credits**.

### 2. Superadmin Flow (Dedicated Email + Password)
- **Zero Google Dependency:** Completely independent of Google OAuth to prevent lockouts if Google accounts are restricted.
- Superadmin Credentials:
  - **Email:** `sanjaykatara59927@gmail.com`
  - **Password:** `change_this_strong_admin_password` (or configurable server secret).
- Backend issues a 30-day cryptographically signed token (`eladm_<base64_payload>|<hmac_sha256_signature>`).
- Auto-restores session from `localStorage.getItem('el_admin_secret')`.

---

## 5. DATABASE SCHEMA (21 TABLES SPECIFICATION)

Implement the complete SQL schema with `utf8mb4_unicode_ci` and `InnoDB`:
1. `users`: `id`, `firebase_uid`, `email`, `name`, `phone`, `avatar_url`, `role` (user/admin), `status` (active/suspended), `wallet_balance_paise`, `ai_credit_balance`, `vip_active`, `vip_expires_at`, `created_at`.
2. `products`: `id`, `slug`, `title`, `subtitle`, `description`, `category`, `language`, `price_paise`, `mrp_paise`, `currency`, `thumbnail_path`, `pdf_path`, `page_count`, `file_size_bytes`, `download_allowed`, `is_published`, `is_vip`, `access_duration_days`.
3. `orders`: `id`, `order_code`, `user_id`, `status` (pending/paid/failed), `total_paise`, `wallet_spent_paise`, `gateway_spent_paise`, `payment_method`, `paid_at`, `created_at`.
4. `order_items`: `id`, `order_id`, `product_id`, `price_paise`.
5. `payment_intents`: `id`, `order_id`, `user_id`, `cf_order_id`, `payment_session_id`, `status`.
6. `credit_packs`: `id`, `code`, `name`, `credits`, `bonus_credits`, `price_paise`.
7. `ai_credit_transactions`: `id`, `user_id`, `type` (trial/purchase/usage), `amount`, `balance_after`, `idempotency_key`, `description`.
8. `ai_usage`: `id`, `user_id`, `kind` (study/support/help), `document_id`, `product_id`, `credits_spent`, `status`.
9. `ai_documents`: `id`, `user_id`, `file_name`, `file_path`, `file_size_bytes`, `mime_type`.
10. `wallet_transactions`: `id`, `user_id`, `type` (credit/debit), `amount_paise`, `balance_after`, `idempotency_key`.
11. `pdf_access`: `id`, `user_id`, `product_id`, `order_id`, `status` (active/revoked/expired), `expires_at`.
12. `vip_subscriptions`: `id`, `user_id`, `plan_code`, `status`, `starts_at`, `expires_at`.
13. `support_threads`: `id`, `user_id`, `subject`, `status` (waiting_admin/waiting_user/resolved/closed).
14. `support_messages`: `id`, `thread_id`, `sender` (user/admin), `body`, `read_by_user`, `read_by_admin`.
15. `notifications`: `id`, `user_id`, `title`, `body`, `type`, `read`, `created_at`.
16. `site_settings`: `key`, `value`, `description`, `updated_at`.
17. `admin_audit_logs`: `id`, `admin_user_id`, `action`, `target_type`, `target_id`, `details`, `ip`.
18. `study_topics`: `id`, `category`, `topic_name`, `summary`.
19. `user_notes`: `id`, `user_id`, `product_id`, `page_number`, `note_text`.
20. `user_bookmarks`: `id`, `user_id`, `product_id`, `page_number`, `label`.
21. `webhook_events`: `id`, `event_id`, `source`, `payload_hash`, `processed_at`.

---

## 6. IN-APP SECURE PDF VIEWER (DRM SHIELD)

- Raw PDF files reside in `storage/pdfs/` outside the web root.
- **Access Pipeline:**
  1. Student requests viewer session: `POST /api/viewer/session { product_id }`.
  2. Server verifies active row in `pdf_access` and signs a short-lived Viewer Token (TTL: 120 mins).
  3. Client fetches binary stream: `GET /api/viewer/stream` with header `X-Viewer-Token`.
  4. Server streams binary chunks to client memory; client creates ephemeral `URL.createObjectURL(blob)`.
- **Anti-Piracy Controls:**
  - Context menu, right-click, text selection disabled.
  - Print hotkeys (`Ctrl+P`, `Cmd+P`) and save hotkeys (`Ctrl+S`) intercepted.
  - Canvas dynamic diagonal watermark overlay showing:
    `[Purchaser Name] · [Email] · [Licensed Date] · [IP Address]`.

---

## 7. STUDY AI ARENA & ACADEMIC COPILOT

- Powered by Gemini 2.5 Flash via REST API.
- **Source Selection Modes:**
  1. *General Competitive Exam Curriculum* (Any subject, free query).
  2. *Analyze Purchased Note* (Strictly grounded in selected Vault PDF).
  3. *Analyze Uploaded Notes* (User uploaded PDF/TXT).
- **12 Academic Study Formats:**
  - `concept`: Explain concept simply with mnemonic and one-line summary.
  - `solve`: Solve numerical/question step-by-step with final answer.
  - `mcq`: Generate 4-option exam-level MCQs with answer explanation.
  - `short`: High-yield short revision answer.
  - `long`: Structured subjective model answer with headings.
  - `notes`: Bulleted rapid-revision notes.
  - `revision`: Key points summary.
  - `flashcards`: Q&A pairs for active recall.
  - `mock`: Mini mock test with answer key.
  - `weak`: Identify weak conceptual topics and study plan.
- **Safety & Fallback:**
  - If user balance < cost, auto-grant 50 Welcome credits or daily study boost (never throw cold `402`).
  - If Gemini API is unreachable, engage smart offline concept engine for instant notes.

---

## 8. COMPLETE SCREEN-BY-SCREEN UI/UX SPECIFICATIONS

### Screen 1: Home (`#home`)
- **Topbar:** App brand name `ExamLegacy`, Theme Toggle button (Moon/Sun), Notification Bell with unread counter badge.
- **Hero Section:** "Learn · Practice · Master" headline, high-yield notes subtitle, 2 pill CTAs: "Explore Store" & "Start Study AI".
- **2026/27 Accelerator Banner:** Gold glowing card highlighting 15-year solved PYQs.
- **Core Pillars:** 3 interactive feature cards: In-App Vault, Gemini AI Tutor, Store Wallet.
- **Featured Materials Grid:** Cards displaying cover thumbnail, subject badge, title, price (₹), MRP strikethrough, discount %, and Buy/Read button.
- **Trust Badges:** Verified Content, 100% In-App Safe, DPDP Act 2023 Compliant.

### Screen 2: Store Catalog (`#store`)
- **Sticky Search Bar:** Instant debounced (200ms) search input with clear button.
- **Horizontal Category Pills:** All, Biology, Chemistry, Physics, Zoology, etc.
- **Catalog Cards:** Responsive grid with discount pills, VIP tags, and dynamic "Open in Vault" (if owned) or "Buy Now" CTA.

### Screen 3: Product Detail (`#product?slug=xxx`)
- Cover thumbnail showcase, pricing box with discount calculator, chapter syllabus accordion, and sticky floating action bar (Buy Now or Read).

### Screen 4: Secure PDF Viewer (`#viewer`)
- Fullscreen overlay with top DRM toolbar (document title, page 14/84, zoom controls, close button), diagonal dynamic watermark, and bottom navigation slider.

### Screen 5: Study AI Arena (`#study`)
- Source selector dropdown, 12 academic task chips, chat bubble stream with MathJax LaTeX formula typesetting, and credit balance indicator with top-up button.

### Screen 6: Student Vault / Library (`#library`)
- Grid of all owned materials with "Read Now" button and "Ask AI About This" shortcut. Clean empty state with store CTA.

### Screen 7: Account & Wallet Hub (`#account`)
- Student profile card (Avatar, Name, Email, Role), Wallet Balance Card (`₹ Balance` + `Add Money`), AI Credits Card (`Credits` + `Buy Pack`), VIP Pass status card, recent orders with invoice downloads, DPDP Privacy Policy link, and Sign Out.

### Screen 8: Superadmin Console (`/admin/`)
- Dedicated Email (`sanjaykatara59927@gmail.com`) + Password (`change_this_strong_admin_password`) login screen.
- Dashboard with live KPI counters (Total Users, Paid Revenue, Total Products, Active Licenses).
- Drag-and-drop PDF and cover uploader with progress indicator.
- User management table with 1-tap balance buttons (`+₹50`, `+100 AI credits`), PDF license grants, and account suspension toggle.
- Order inspector with Cashfree reference IDs and manual verify buttons.

---

## 9. STEP-BY-STEP IMPLEMENTATION & REPOSITORY STRUCTURE

Generate the codebase following this exact directory layout:

```text
├── .env.example              # Environment variables template
├── .htaccess                 # Apache security rules & API rewrite
├── composer.json             # PHP dependencies
├── database.sql              # Master SQL schema (21 tables + seed data)
├── index.html                # Main Student PWA SPA entry point
├── install.php               # 1-Click Database Setup & Migrations utility
├── manifest.json             # PWA Web App Manifest
├── privacy.html              # DPDP Act 2023 Privacy Policy page
├── server.php                # Local dev router (php -S 0.0.0.0:8000 server.php)
├── sw.js                     # PWA Service Worker (Cache-first offline strategy)
├── admin/                    # Superadmin Control Center
│   ├── index.html            # Admin dashboard shell
│   └── assets/
│       ├── css/admin.css     # Clean admin panel styles
│       └── js/admin.js       # Admin panel client logic (Email+Password auth)
├── api/                      # Backend REST API
│   ├── .htaccess             # Dedicated API routing rules
│   ├── config.php            # Environment loader & constants
│   ├── index.php             # Master REST front controller
│   └── lib/                  # Core PHP service classes
│       ├── Admin.php         # Superadmin operations & KPIs
│       ├── AiCredits.php     # AI credits atomic ledger
│       ├── Auth.php          # Firebase Auth & Admin HMAC token auth
│       ├── Db.php            # PDO singleton with smart local/remote failover
│       ├── Firestore.php     # Google Cloud Firestore dual-sync
│       ├── Gemini.php        # Gemini 2.5 Flash API + smart fallback
│       ├── Http.php          # Request/response security & helpers
│       ├── Mailer.php        # SMTP transactional emails
│       ├── Notifications.php # User notifications engine
│       ├── Orders.php        # Orders & checkout fulfillment
│       ├── Payments.php      # Cashfree PG & Webhook verification
│       ├── PdfVault.php      # Secure in-memory PDF DRM streaming
│       ├── Settings.php      # Dynamic site settings
│       ├── Store.php         # Products catalog & search
│       ├── StudyAi.php       # Study AI 12-format query engine
│       ├── Support.php       # Human support tickets & Support AI
│       └── Wallet.php        # Store currency wallet ledger
└── assets/
    ├── css/
    │   └── app.css           # Complete design system & anti-gravity CSS
    └── js/
        ├── api.js            # Unified API fetch client with error handling
        ├── app.js            # Master PWA state, routing & interaction logic
        ├── auth.js           # Firebase Auth client
        ├── config.js         # Client runtime configuration
        └── viewer.js         # DRM PDF reader with dynamic canvas watermarking
```

Begin implementation by ensuring all 21 tables are created in the database, the API front-controller handles all routes cleanly, the student PWA strictly enforces the anti-gravity viewport lock, and the admin panel functions independently with email and password.
