# ExamLegacy — Technical Requirements Document (TRD)

**Document Version:** 2.0.0  
**Stack:** PHP 8.2+ (Vanilla/PDO), MySQL 8.0/MariaDB, Google Cloud Firestore, Firebase Auth v10 Compat, Cashfree PG v2023-08-01, Google Gemini 2.5 Flash, Vanilla JS PWA (No heavy frameworks).  
**Hosting Target:** InfinityFree Shared Hosting (`sql210.infinityfree.com` / `examlegacy.my-board.org`) / Any Standard cPanel/LAMP Server.

---

## 1. System Architecture Diagram

```
                                      +-------------------------------+
                                      |   Browser / PWA Client        |
                                      |   (Service Worker, App Shell) |
                                      +---------------+---------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                                                     |
                   v (REST JSON + Bearer/X-Token)                                        v (Firebase SDK)
     +-----------------------------+                                       +-----------------------------+
     | Apache Web Server (.htaccess)|                                       | Firebase Auth Service       |
     | - FastCGI Header Forwarding |                                       | - Google Identity Provider  |
     +--------------+--------------+                                       +-----------------------------+
                    |
                    v
     +-----------------------------+
     | api/index.php (Front Router)|
     +--------------+--------------+
                    |
     +--------------+----------------------------------+----------------------------------+
     |                                                 |                                  |
     v                                                 v                                  v
+------------------------+                 +------------------------+        +------------------------+
| api/lib/Auth.php       |                 | api/lib/Payment.php    |        | api/lib/Ai.php         |
| - Offline Cert Cache   |                 | - Cashfree API v2023   |        | - Gemini 2.5 Flash     |
| - Multi-Header Extractor|                | - Webhook Signature    |        | - Credit Metering      |
+-----------+------------+                 +-----------+------------+        +-----------+------------+
            |                                          |                                 |
            +--------------------+---------------------+---------------------------------+
                                 |
                                 v
                 +-------------------------------+
                 | api/lib/Db.php (PDO Singleton)|
                 +---------------+---------------+
                                 |
                   +-------------+-------------+
                   |                           |
                   v                           v
     +--------------------------+  +--------------------------+
     | MySQL Primary Database   |  | Google Cloud Firestore   |
     | (Relational, Financial,  |  | (Dual-Sync Realtime      |
     | Users, Orders, PDFs)     |  | Backup & User Mirror)    |
     +--------------------------+  +--------------------------+
```

---

## 2. Authentication & Header Forwarding Architecture

### 2.1 The Shared-Hosting FastCGI Authorization Problem
On shared hosting environments like InfinityFree, Apache FastCGI strips the standard HTTP `Authorization` header by default before passing the request to PHP. This caused `$_SERVER['HTTP_AUTHORIZATION']` to be missing, resulting in `401 Unauthorized ("Please sign in to continue.")` even after successful Google sign-in.

### 2.2 Triple-Redundant Header Extraction Solution
To permanently resolve this:
1. **Apache `.htaccess` Rewrites:**
   ```apache
   RewriteCond %{HTTP:Authorization} ^(.*)
   RewriteRule .* - [e=HTTP_AUTHORIZATION:%1]
   RewriteCond %{HTTP:X-Authorization} ^(.*)
   RewriteRule .* - [e=HTTP_X_AUTHORIZATION:%1]
   RewriteCond %{HTTP:X-Firebase-Token} ^(.*)
   RewriteRule .* - [e=HTTP_X_FIREBASE_TOKEN:%1]
   ```
2. **Client-Side Multi-Header Emission (`assets/js/api.js`):**
   ```javascript
   function authHeader() {
     var t = EL.auth.token();
     return t ? {
       'Authorization': 'Bearer ' + t,
       'X-Authorization': 'Bearer ' + t,
       'X-Firebase-Token': t
     } : {};
   }
   ```
3. **Server-Side Multi-Channel Ingestion (`api/lib/Http.php`):**
   `Http::bearerToken()` sequentially inspects:
   - `$_SERVER['HTTP_AUTHORIZATION']`
   - `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`
   - `$_SERVER['HTTP_X_AUTHORIZATION']`
   - `$_SERVER['HTTP_X_FIREBASE_TOKEN']`
   - `apache_request_headers()['Authorization']` / `getallheaders()`
   - Query parameter `?token=` (for PDF streaming downloads)

### 2.3 Shared Hosting Google Public Key Verification (`api/lib/Auth.php`)
Shared hosts frequently block or throttle outgoing cURL requests to Google's public x509 cert endpoint (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`).
- **Resilience Engine:** `Auth::certForKid()` fetches live keys with `CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4` and a 4-second timeout.
- **Offline Fallback Bundle:** If cURL fails or times out, it seamlessly falls back to `config/google-certs.json` (pre-cached valid public certificates), guaranteeing zero 500 errors during authentication.

---

## 3. Database & Dual-Sync Architecture

### 3.1 Primary Store: Relational MySQL / MariaDB
- Tables:
  - `users`: UID, email, name, role (`user`/`admin`), wallet balance, AI credits, VIP status.
  - `products`: Title, slug, category, price, MRP, PDF path, cover path, access days, VIP flag.
  - `orders`: Order code, user ID, status (`pending`, `paid`, `failed`, `refunded`), total paise.
  - `order_items`: Order ID, product ID, item price.
  - `payment_intents`: Gateway reference, Cashfree session ID, status.
  - `pdf_access`: User ID, product ID, granted date, expiration date, access status.
  - `ai_credit_transactions`: Ledger of credit grants and usage.
  - `wallet_transactions`: Ledger of store wallet credits and debits.
  - `audit_logs`: Immutable ledger of administrative operations.

### 3.2 Mirror Store: Google Cloud Firestore
- Collection `users`: Mirrored user document containing profile, role, wallet balance, and timestamp.
- Non-blocking sync via `Firestore::syncUser($user)` so transient cloud network lags do not impact user request latency.

---

## 4. Payment Gateway Integration (Cashfree PG)

### 4.1 Order Creation Flow
1. Client calls `POST /api/payment/order` with `product_id`.
2. Backend calculates trusted price from MySQL `products` table (client-supplied prices are strictly ignored).
3. Backend calls Cashfree API:
   - Endpoint: `https://api.cashfree.com/pg/orders` (or sandbox)
   - Headers: `x-client-id`, `x-client-secret`, `x-api-version: 2023-08-01`
4. Cashfree returns `payment_session_id`.
5. Client invokes Cashfree Web SDK:
   ```javascript
   const cashfree = Cashfree({ mode: 'production' });
   cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_modal' });
   ```

### 4.2 Webhook & Post-Payment Verification
- Endpoint: `POST /api/payment/webhook` (directly accessible, verifies `X-Webhook-Signature` using HMAC-SHA256).
- Verification calls update MySQL `orders` to `paid` and call `OrderService::grantPdfAccess` idempotently.

---

## 5. Security & Isolation Directives

### 5.1 Admin Console Named App Isolation
The Admin panel (`/admin/`) initializes Firebase under a dedicated named instance:
```javascript
const adminApp = firebase.initializeApp(config, "ExamLegacyAdminApp");
const adminAuth = adminApp.auth();
```
This isolates the Superadmin session from the student web session, allowing simultaneous testing and administration without session conflict.

### 5.2 Superadmin Identity Hard-Lock
- Designated Superadmin Email: `sanjaykatara59927@gmail.com`
- Designated Superadmin UID: `2RyGoMqyjqcXiBrp5gH1VdSLWx72`
- Verified in both PHP backend (`Auth::authenticateAdmin()`) and JavaScript client.
- Emergency Master Key authentication backed by server-side `ADMIN_SECRET` environment variable with auto-provisioning of the Superadmin database record.

### 5.3 Protected PDF Streaming
- PDFs are stored outside the public document root or protected via `.htaccess` in `storage/pdfs/`.
- File streaming is handled via `PdfService::streamPdf()` with byte-range support, `Content-Disposition: inline`, and memory-safe `readfile()`.
