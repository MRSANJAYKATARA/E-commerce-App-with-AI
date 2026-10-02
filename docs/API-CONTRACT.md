# ExamLegacy API Contract v2.0.0

**Generated from:** `api/index.php`, `api/lib/*.php`  
**Last Updated:** 2026-10-02  
**Stack:** PHP 8 + PDO + Firebase Auth + Cashfree PG + Gemini 2.5 Flash

---

## Table of Contents
1. [Authentication Models](#authentication-models)
2. [Error Envelope](#error-envelope)
3. [Rate Limits](#rate-limits)
4. [Convention Notes](#convention-notes)
5. [Public Routes](#public-routes)
6. [Authenticated Routes](#authenticated-routes)
7. [Admin Routes](#admin-routes)

---

## Authentication Models

### Student/User Authentication
- **Header Priority** (tried in order):
  1. `Authorization: Bearer <id_token>` (RFC 6750)
  2. `X-Authorization: <id_token>` (Apache FastCGI fallback)
  3. `X-Firebase-Token: <id_token>` (Explicit Firebase)
  4. `authorization` query param fallback (?token=...)
  
- **Token Source:** Firebase ID token, verified server-side against Google public certs
- **Verification:** `Auth::verifyIdToken()` checks:
  - Signature (RS256 + Google kid)
  - Expiry (`exp` claim ≤ now)
  - Issued-at (`iat` claim ≤ now + 300s)
  - Audience (`aud` == FIREBASE_PROJECT_ID)
  - Issuer (`iss` == https://securetoken.google.com/{PROJECT_ID})
  
- **User Sync:** On first login, `Auth::syncUser()` creates MySQL user + grants 50 trial AI credits (configurable).
- **Profile Fallback:** If `/me` call fails offline, client uses local cached profile.

### Admin Authentication
- **Login Endpoint:** `POST /admin/auth/login` (email + password) → returns signed token
- **Token Format:** `eladm_` prefix + base64(userid|exp|hmac_sha256)
- **Expiry:** 30 days from issue
- **Sources Checked:**
  1. `X-Admin-Token` header
  2. `Authorization: Bearer eladm_...` header
  3. Direct ADMIN_SECRET match (master key for fresh deployments)
  
- **Admin Promotion:** Users matching `ADMIN_EMAILS` or `ADMIN_UIDS` env vars auto-promoted on login
- **Credentials Required (fail-closed if missing):**
  - `ADMIN_EMAILS` (comma-separated, lowercase)
  - `ADMIN_PASSWORD` (checked via hash_equals)
  - `ADMIN_SECRET` (32+ chars, not matching template patterns)

### Viewer Session (PDF Streaming)
- **Token Type:** Hashed session token (not Bearer), issued per `/viewer/session` POST
- **Sent As:** `X-Viewer-Token` header or `?token=` query param
- **TTL:** 2 hours (7200s)
- **Scope:** Tied to user + product_id (cannot stream different product with same token)

---

## Error Envelope

All API errors return:
```json
{
  "ok": false,
  "error": {
    "code": "error_code_snake_case",
    "message": "Human-readable message (no stack trace unless APP_DEBUG=1)"
  }
}
```

**Common Error Codes:**
- `unauthenticated` (401) — missing or invalid token
- `forbidden` (403) — authenticated but unauthorized (e.g., not admin)
- `not_found` (404) — resource not found
- `invalid_input` (400) — request validation failed
- `invalid_amount` (400) — money validation failed
- `invalid_token` (401) — Firebase token malformed/expired
- `token_expired` (401) — ID token expired
- `auth_not_configured` (500) — Firebase project not set up
- `admin_not_configured` (503) — ADMIN_* env vars missing
- `gateway_not_configured` (503) — Cashfree not configured
- `gateway_error` (502) — Cashfree API unreachable
- `phone_required` (422) — gateway payment needs phone on file
- `insufficient_balance` (400) — wallet or credit balance too low
- `conflict` (409) — duplicate entry (e.g., pack code)
- `invalid_state` (409) — order/intent in non-payable state
- `server_error` (500) — internal exception (message sanitized unless APP_DEBUG=1)

**HTTP Response Headers (all responses):**
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store` (all `/api/*`)

---

## Rate Limits

Enforced via sliding window (minute-based, per-user). Throws `ApiError('rate_limit_exceeded', ...)` on breach.

| Endpoint Group         | Limit | Window | Route(s)                        |
|:-----------------------|------:|-------:|:--------------------------------|
| AI Study               | 30    | 60s    | `POST /ai/study`                |
| AI Support             | 20    | 60s    | `POST /ai/support`              |
| AI Help                | 20    | 60s    | `POST /ai/help`                 |
| PDF Viewer Sessions    | 30    | 60s    | `POST /viewer/session`          |
| Orders                 | 15    | 60s    | `POST /orders`                  |
| Wallet Recharge        | 15    | 60s    | `POST /wallet/recharge`         |

**Rate Limit Storage:** `rate_limits` table (lookup: `user_id + key`)

---

## Convention Notes

### Money
- All amounts in **integer paise** (1 rupee = 100 paise)
- Example: ₹123.45 = `12345` paise
- Rounding: Banker's rounding (round-half-to-even) via `round($x / 100, 2) * 100`

### Idempotency
- **Webhook events:** idempotency_key stored in `payment_intents`; duplicate webhooks marked but not re-settled
- **Payments:** `Payments::settle()` locks intent row (SELECT...FOR UPDATE) before state change
- **Wallet & Credits:** Transactions reference ledger entry with unique `idempotency_key`

### Pagination
- Query params: `limit` (1–100, default 50/60), `offset` (default 0)
- Response: array directly (no wrapper); caller checks array length

### Caching
- **Cached by default:** Public covers (`/api/cover`), manifest, assets
- **Never cached:** All `/api/*` endpoints (Cache-Control: no-store in response)
- **Service Worker:** `sw.js` strictly blocks `/api/` from cache, only caches shell assets

### Clean URLs
- No `.html`, `.php` visible in paths (/privacy, not /privacy.html)
- Routes handled by router (server.php in dev, .htaccess in production)

---

## Public Routes

### Health & Config

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/health` | None | — | `{ status, version, database, timestamp, php_version }` | — |
| GET | `/config` | None | — | `{ config }` (Settings::publicConfig) | — |
| GET | `/legal/privacy` | None | — | `{ act, version, effective_date, data_fiduciary, grievance_officer, statutory_rights, policy_url }` (DPDP Act 2023) | — |

### Store / Catalog

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/categories` | Optional* | — | `{ categories: [string] }` | — |
| GET | `/products` | Optional* | `?search=<str>&category=<str>&limit=<1-100>&offset=<0+>` | `{ products: [{ id, slug, title, subtitle, description, category, language, price_paise, mrp_paise, currency, discount_pct, thumbnail_url, page_count, file_size_bytes, is_vip, owned }] }` | — |
| GET | `/products/{slug}` | Optional* | — | `{ product: {...} }` | `not_found` (404) |
| GET | `/vip/plans` | None | — | `{ plans: [{ id, code, name, interval, price_paise, currency, benefits, fair_use }] }` | — |
| GET | `/credits/packs` | None | — | `{ packs: [{ id, code, name, credits, bonus_credits, price_paise, currency }] }` | — |
| GET | `/cover?f={thumbnail_path}` | None | — | (binary image; Cache-Control: public, max-age=86400) | `not_found` (404) if traversal/missing |

**\*Optional Auth:** Sets `owned: true/false` in product if token provided; no owned flag if anon.

### Payment Webhook (Cashfree IPN)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/payments/webhook` | Signature only | `{ data: { order: {...}, payment: {...} } }` (Cashfree payload) + Header `X-Webhook-Signature` (HMAC-SHA256) | `{ ok: true }` or `{ ok: true, ignored: true }` (if intent not found) | `invalid_body` (400), `invalid_signature` (401) |

**Webhook Signature Verification:**
```
signed_string = X-Cashfree-Timestamp + raw_body
expected_sig = HMAC-SHA256(signed_string, CASHFREE_WEBHOOK_SECRET)
hash_equals(expected_sig, X-Webhook-Signature)
```

**Idempotency:** Multiple identical webhooks won't double-settle (intent locked, status checked first).

---

## Authenticated Routes

All require valid Firebase ID token. **User profile auto-synced on first login.**

### Profile Management

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/me` | Student | — | `{ user: { id, name, email, phone, avatar_url, role, status, wallet_balance_paise, ai_credit_balance, vip_active, vip_expires_at } }` | `unauthenticated` (401) |
| POST / PATCH | `/me` | Student | `{ name?: str, phone?: str }` | `{ user: {...} }` | `invalid_input` (400), `unauthenticated` (401) |
| POST | `/me/avatar` | Student | multipart `file` OR JSON `{ avatar_base64: "data:image/...;base64,..." }` | `{ user: {...with new avatar_url} }` | `invalid_input` (400), `upload_too_large` (413), `unsupported_type` (415) |

### PDF Library (User's Owned Access)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/library` | Student | — | `{ items: [{ product_id, slug, title, subtitle, category, page_count, file_size_bytes, thumbnail_url, download_allowed, granted_at, expires_at }] }` | `unauthenticated` (401) |

### Orders & Payments

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/orders` | Student | — | `{ orders: [{ id, order_code, status, payment_method, subtotal_paise, wallet_applied_paise, gateway_amount_paise, total_paise, currency, created_at, paid_at, items }] }` | `unauthenticated` (401) |
| POST | `/orders` | Student | `{ product_ids: [int], method: "wallet"|"cashfree"|"split", wallet_paise?: int }` | `{ order: {...}, payment: { intent_id, payment_session_id, provider_order_id } \| null }` | `invalid_input` (400), `invalid_amount` (400), `empty_cart` (400), `invalid_method` (400), `invalid_split` (400), `insufficient_balance` (400), `phone_required` (422), `invalid_product` (400) |
| GET | `/orders/{order_code}` | Student | — | `{ order: {...} }` | `not_found` (404), `forbidden` (403) |
| POST | `/payments/verify` | Student | `{ intent_id: int }` | `{ status: "paid"\|"pending"\|"failed"\|..., kind: "order"\|"recharge"\|"credit_pack"\|"vip", ref_id?: int }` | `not_found` (404), `gateway_error` (502) |

**Order Lifecycle:**
1. `POST /orders` → order created PENDING (locked by `FOR UPDATE` in transaction)
2. If `method="wallet"`: immediate `markPaid('wallet')` + PDF access granted
3. If `method="cashfree"` or `method="split"`: Cashfree intent created, client shown payment UI
4. Webhook `/payments/webhook` settles intent; `Orders::markPaid('gateway')` → PDF access + receipt email
5. Admin can refund: `POST /admin/orders/{id}/refund` → wallet credited, access revoked

**Money Split Logic:**
- User requests: `{ product_ids: [...], method: "split", wallet_paise: 5000 }`
- Cart total = 20000 paise
- Wallet applied = min(5000, wallet_balance, 20000)
- Gateway amount = 20000 - wallet_applied
- If gateway_amount = 0 → paid immediately (wallet only)
- If gateway_amount > 0 → Cashfree intent created

### Wallet Management

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/wallet` | Student | — | `{ balance_paise: int, currency: "INR", history: [{ type, amount_paise, balance_after, description, created_at }] }` | `unauthenticated` (401) |
| POST | `/wallet/recharge` | Student | `{ amount_paise: int }` | `{ intent_id, payment_session_id, provider_order_id }` (Cashfree intent) | `invalid_amount` (400), `gateway_not_configured` (503), `gateway_error` (502) |

**Wallet Ledger:**
- Type: `recharge`, `purchase`, `refund`, `admin_credit`, `admin_debit`
- Idempotency: Recharges keyed by `recharge:{provider_order_id}`

### AI Credits

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/credits` | Student | — | `{ balance: int, history: [{ type, amount, balance_after, description, created_at }] }` | `unauthenticated` (401) |
| POST | `/credits/purchase` | Student | `{ pack_id: int }` | `{ intent_id, payment_session_id, provider_order_id }` (Cashfree intent) | `not_found` (404), `gateway_not_configured` (503), `gateway_error` (502) |

**Auto-Grant on First Login:**
- 50 trial credits (configurable via Settings)
- Additional 10 daily auto-grant (if enabled)
- Never cold-start: if Gemini unavailable, offline fallback engine returns valid JSON

### AI Study (Multi-turn Chat)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/ai/study` | Student | `{ source_type: "product"\|"document"\|"text", product_id?: int, document_id?: int, text?: str, question: str, task?: "concept"\|"explanation"\|..., history?: [{ role: "user"\|"model"\|"assistant", text: str }] }` | `{ answer: str, tokens_used: int, credits_deducted: int, balance_after: int }` | `unauthenticated` (401), `rate_limit_exceeded` (429), `insufficient_balance` (402) |

**Rate Limit:** 30 per minute  
**Cost:** 2 credits per call (configurable: `ai_credit_cost_study`)  
**Fallback:** If Gemini timeout, returns offline-generated response (valid JSON)

### AI Support & Help

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/ai/support` | Student | `{ message: str }` | `{ response: str, category: str }` | `unauthenticated` (401), `rate_limit_exceeded` (429), `insufficient_balance` (402) |
| POST | `/ai/help` | Student | `{ message: str }` | `{ response: str }` | `unauthenticated` (401), `rate_limit_exceeded` (429), `insufficient_balance` (402) |

**Rate Limit:** 20 per minute each  
**Cost:** TBD (See StudyAi / Support classes for exact deduction)  
**Difference:** support = customer service; help = technical guidance

### User Uploads (for AI Study)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/uploads` | Student | multipart `file` (PDF or image, max 15 MB) | `{ document: { id, filename, mime, size_bytes } }` | `upload_failed` (400), `upload_too_large` (413), `unsupported_type` (415) |

**Stored in:** `storage/uploads/{user_id}/{random}.{ext}`  
**Indexed:** `ai_documents` table

### PDF Viewer Session (Token Issuance)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/viewer/session` | Student | `{ product_id: int }` | `{ session: { token: str, product_id, user_id, expires_at, watermark_text } }` | `not_found` (404), `forbidden` (403), `rate_limit_exceeded` (429) |

**Rate Limit:** 30 per minute  
**Token TTL:** 2 hours (7200s)  
**Usage:** Client sends token as `X-Viewer-Token` header to `GET /viewer/stream?token=...`  
**Streaming:** HTTP Range requests supported; watermark applied server-side

### PDF Streaming (Private)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/viewer/stream` | Viewer Token | Header `X-Viewer-Token` or `?token=` | (binary PDF; Content-Type: application/pdf; Range-friendly) | `unauthenticated` (401), `not_found` (404), `forbidden` (403) |

**DRM Enforcement:**
- Session binding: token = hash(user_id + product_id + exp)
- Watermark: User ID, email, timestamp on every page (server-side rendering)
- Download block: returned as `Content-Disposition: inline` (prevents direct save in most browsers)
- Revocation: session marked `revoked=1` → all subsequent streams 403

### Notifications

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/notifications` | Student | — | `{ notifications: [{ id, category, title, body, is_read, created_at }], unread: int }` | `unauthenticated` (401) |
| POST | `/notifications/read-all` | Student | — | `{ }` | `unauthenticated` (401) |
| POST | `/notifications/{id}/read` | Student | — | `{ }` | `not_found` (404), `unauthenticated` (401) |

**Categories:** purchase, order, payment, pdf, system, support, ai_response  
**Idempotency:** marking read twice is safe

### Support (Human)

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/support` | Student | — | `{ threads: [{ id, subject, status, created_at, updated_at }] }` | `unauthenticated` (401) |
| POST | `/support` | Student | `{ subject: str, message: str }` | `{ thread_id: int }` (201) | `invalid_input` (400), `unauthenticated` (401) |
| GET | `/support/{id}` | Student | — | `{ thread: { id, subject, status, messages: [...] } }` | `not_found` (404), `forbidden` (403) |
| POST | `/support/{id}/messages` | Student | `{ message: str }` | `{ }` | `not_found` (404), `unauthenticated` (401) |

**Status:** open, in_progress, resolved, closed  
**Messages:** User and admin replies (role field indicates author)

---

## Admin Routes

All require valid admin token (`X-Admin-Token` header or `Authorization: Bearer eladm_...`).

### Admin Auth

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/admin/auth/login` | None | `{ email: str, password: str }` | `{ token: str, user: { id, email, name, role } }` | `invalid_input` (400), `forbidden` (403), `invalid_credentials` (401), `admin_not_configured` (503) |

**Password Sources (checked in order):**
1. ADMIN_PASSWORD env var (hash_equals)
2. ADMIN_SECRET env var (hash_equals)
3. User password_hash (password_verify)

**User Auto-Provision:** If matching ADMIN_EMAILS but no DB row, created with superadmin defaults.

### Admin Stats & Users

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/stats` | Admin | — | `{ stats: { total_users, active_today, total_revenue_paise, pending_orders, ... } }` | `forbidden` (403) |
| GET | `/admin/users` | Admin | `?search=<str>&status=<active\|suspended\|disabled>&limit=<1-50>&offset=<0+>` | `{ users: [{ id, email, name, phone, role, status, wallet_balance_paise, ai_credit_balance, created_at, last_login_at }] }` | `forbidden` (403) |
| GET | `/admin/users/{id}` | Admin | — | `{ user: {...} }` | `not_found` (404), `forbidden` (403) |
| POST | `/admin/users/{id}/status` | Admin | `{ status: "active"\|"suspended"\|"disabled", reason?: str }` | `{ }` | `invalid_input` (400), `not_found` (404) |

### Admin Wallet & Credits

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/admin/users/{id}/wallet` | Admin | `{ amount_paise: int, reason?: str }` | `{ balance_paise: int }` | `invalid_input` (400), `not_found` (404) |
| POST | `/admin/users/{id}/credits` | Admin | `{ amount: int, reason?: str }` | `{ balance: int }` | `invalid_input` (400), `not_found` (404) |

**Amount Sign:** Positive = credit, negative = debit  
**Ledger Entry:** Auto-created with reason + admin_id

### Admin PDF Access

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/admin/users/{id}/pdf/grant` | Admin | `{ product_id: int }` | `{ }` | `not_found` (404), `invalid_input` (400) |
| POST | `/admin/users/{id}/pdf/revoke` | Admin | `{ product_id: int }` | `{ }` | `not_found` (404), `invalid_input` (400) |

**Grant:** Creates/updates `pdf_access` row with status=active  
**Revoke:** Sets status=revoked

### Admin VIP Membership

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/admin/users/{id}/vip` | Admin | `{ plan_id: int }` | `{ }` | `not_found` (404), `invalid_input` (400) |

**Effect:** Creates row in `vip_memberships`, sets `users.vip_active=1`, expires_at auto-calculated

### Admin Products

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/products` | Admin | — | `{ products: [{ id, slug, title, price_paise, mrp_paise, is_published, is_vip, ... }] }` (limit 200) | `forbidden` (403) |
| POST | `/admin/products` | Admin | `{ slug, title, subtitle?, description?, category?, language?, price_paise, mrp_paise?, currency?, thumbnail_path?, pdf_path, page_count?, file_size_bytes?, download_allowed?, is_published?, is_vip?, access_duration_days? }` | `{ id: int }` (201) | `invalid_input` (400), `forbidden` (403) |
| PATCH | `/admin/products/{id}` | Admin | (any of above fields) | `{ }` | `not_found` (404), `invalid_input` (400) |
| DELETE | `/admin/products/{id}` | Admin | — | `{ }` | `not_found` (404) (soft-deletes: sets is_published=0) |
| POST | `/admin/products/upload-pdf` | Admin | multipart `file` (PDF, max 60 MB) | `{ pdf_path: str, file_size_bytes: int, pdf_sha256: str }` | `upload_too_large` (413), `unsupported_type` (415) |
| POST | `/admin/products/upload-cover` | Admin | multipart `file` (PNG/JPG/WebP, max 5 MB) | `{ thumbnail_path: str }` | `upload_too_large` (413), `unsupported_type` (415) |

### Admin Credit Packs

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/credits/packs` | Admin | — | `{ packs: [{ id, code, name, credits, bonus_credits, price_paise, currency, is_active }] }` | `forbidden` (403) |
| POST | `/admin/credits/packs` | Admin | `{ code: str, name: str, credits: int, bonus_credits?: int, price_paise: int, currency?: "INR" }` | `{ pack: {...} }` (201) | `invalid_input` (400), `conflict` (409) (duplicate code) |
| PATCH | `/admin/credits/packs/{id}` | Admin | (any of above) | `{ pack: {...} }` | `not_found` (404), `invalid_input` (400) |
| DELETE | `/admin/credits/packs/{id}` | Admin | — | `{ }` | `not_found` (404) (soft-deletes: sets is_active=0) |

### Admin VIP Plans

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/vip/plans` | Admin | — | `{ plans: [{ id, code, name, interval, price_paise, currency, benefits, fair_use, is_active }] }` | `forbidden` (403) |
| POST | `/admin/vip/plans` | Admin | `{ id?: int, code?: str, name: str, interval: "monthly"\|"yearly", price_paise: int, benefits?: {}, fair_use?: {}, is_active?: bool }` | `{ id: int }` (201 if new, 200 if update) | `invalid_input` (400) |

**POST Logic:**
- If `id` present → UPDATE
- Else → INSERT (code auto-generated if omitted)

### Admin Orders

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/orders` | Admin | `?status=<pending\|paid\|failed\|refunded>` | `{ orders: [{ id, order_code, user_id, status, total_paise, payment_method, created_at, paid_at }] }` | `forbidden` (403) |
| POST | `/admin/orders/{id}/refund` | Admin | — | `{ }` | `not_found` (404), `invalid_state` (409) (only paid orders) |

**Refund:**
- Debits wallet_applied_paise back to wallet (type=refund)
- Adds full total_paise as store credit (idempotent via `refund:{order_id}` key)
- Revokes all PDF access for order items
- Emits refund notification

### Admin Support

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/support` | Admin | `?status=<open\|in_progress\|resolved\|closed>` | `{ threads: [{ id, user_id, subject, status, created_at, updated_at }] }` | `forbidden` (403) |
| GET | `/admin/support/{id}` | Admin | — | `{ thread: { id, user_id, subject, status, messages: [...] } }` | `not_found` (404) |
| POST | `/admin/support/{id}/reply` | Admin | `{ message: str }` | `{ }` | `not_found` (404), `invalid_input` (400) |
| POST | `/admin/support/{id}/status` | Admin | `{ status: "open"\|"in_progress"\|"resolved"\|"closed" }` | `{ }` | `not_found` (404) |

### Admin Notifications

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| POST | `/admin/notify` | Admin | `{ user_id: int, category: str, title: str, body: str }` | `{ }` | `not_found` (404), `invalid_input` (400) |
| POST | `/admin/broadcast` | Admin | `{ category: str, title: str, body: str }` | `{ }` | `invalid_input` (400) |

**Notify:** Single user  
**Broadcast:** All users

### Admin Settings

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/settings` | Admin | — | `{ settings: { key: value, ... } }` | `forbidden` (403) |
| POST | `/admin/settings` | Admin | `{ settings: { key: value, ... } }` | `{ }` | `invalid_input` (400) |

**Settings Table:** Flat key-value store (app-wide config)  
**Examples:** trial_ai_credits, grievance_officer_name, grievance_officer_email, ...

### Admin Audit Log

| METHOD | Path | Auth | Request | Response | Errors |
|:-------|:-----|:-----|:--------|:---------|:-------|
| GET | `/admin/audit` | Admin | — | `{ logs: [{ id, admin_id, action, table_name, record_id, before, after, created_at }] }` | `forbidden` (403) |

**Actions:** product_create, product_update, product_unpublish, order_refund, credit_pack_create, credit_pack_update, credit_pack_archive, vip_plan_create, vip_plan_update, ...

---

## Implementation Notes

### Request/Response Encoding
- All requests/responses: UTF-8, JSON only
- Request body: must be valid JSON or multipart/form-data (for file uploads)
- Response: `Content-Type: application/json; charset=utf-8`

### Timeouts & Limits
- Cashfree API calls: 20s timeout
- Gemini API calls: 30s timeout (falls back to offline engine on timeout)
- File uploads: max 60 MB (PDFs), 5 MB (covers), 15 MB (user uploads), 2 MB (avatars)
- Chat history: last 12 messages (capped server-side)
- Query strings: max 256 chars total query length

### Transaction Safety
- Wallet/order state changes: wrapped in `Db::transaction()`
- Intent settlements: locked via `SELECT...FOR UPDATE` before state update
- Idempotency keys: checked before insertion; duplicate calls return 409 Conflict (or settle silently if intent already paid)

### Offline Fallback
- AI study/support/help: If Gemini timeout, returns hardcoded response (valid JSON structure)
- Profile fallback: If `/me` fails, client cached profile remains valid
- No error surface to user in fallback mode; only valid JSON returned

### Secrets & .env Keys
- Never in response body (even on debug)
- Never in error messages (unless APP_DEBUG=1)
- `.env` blocked by `.htaccess` + server.php router
- Google certs cached in `/tmp/examlegacy_google_certs.json` (3600s TTL), fallback to bundled `config/google-certs.json`

---

## Production Deployment Checklist

- [ ] HTTPS enforced (no cleartext)
- [ ] `.env` present with all ADMIN_*, CASHFREE_*, GEMINI_*, DB_* keys
- [ ] `/admin/auth/login` tested with correct email+password
- [ ] Webhook URL registered with Cashfree (Settings → Webhook Configuration)
- [ ] SMTP credentials verified (welcome + receipt emails sent)
- [ ] Gemini API key active + fallback engine tested
- [ ] Rate limit table exists in DB
- [ ] Service Worker (`sw.js`) version bumped before deploy
- [ ] All static assets in precache list actually exist
- [ ] No console errors in browser DevTools on main flows
- [ ] `GET /api/health` returns `database: connected`
- [ ] Secret gate clean: no `.env`, service account, or PDFs in git

---

**End of API Contract v2.0.0**
