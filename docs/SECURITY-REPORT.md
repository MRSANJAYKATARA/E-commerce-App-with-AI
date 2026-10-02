# ExamLegacy — Comprehensive Security & Protection Audit Report
> **Document:** `docs/SECURITY-REPORT.md`  
> **Classification:** Security Baseline & Verification  
> **Release Target:** ExamLegacy v2.0.0 Production  
> **Audit Status:** Verified & Hardened

---

## 1. Threat Model & Security Posture

ExamLegacy processes financial transactions (Cashfree PG, Store Wallet), handles AI credit allocations, and distributes proprietary digital study materials (copyrighted PDFs). Consequently, defense-in-depth is implemented across seven distinct security perimeters:

```
[1. Client Browser Shield] -> [2. HTTP Transport & CSP] -> [3. Web Server Access Rules]
       |
[4. Authentication & RBAC] -> [5. Transactional DB Ledger] -> [6. Private PDF Vault]
       |
[7. AI Output Sanitization & Rate Limits]
```

---

## 2. Hardening Measures Implemented & Verified

### A. Web Server Path Protection & Secret Isolation
- **Rule Verification:** Direct HTTP requests to sensitive configuration, migration files, internal libraries, and private vaults are completely blocked:
  - `/.env` -> `403 Forbidden` (Verified via `curl http://localhost:8000/.env`)
  - `/api/config.php` -> `403 Forbidden` (Verified via `curl http://localhost:8000/api/config.php`)
  - `/storage/*` -> `403 Forbidden`
  - `/migrations/*` -> `403 Forbidden`
  - `/docs/*` -> `403 Forbidden`
  - `/vendor/*` -> `403 Forbidden`
- **Dual-Layer Parity:** Protection is enforced both in `.htaccess` (for Apache / LiteSpeed in production) and programmatically inside `server.php` (for development / PHP CLI built-in server).

### B. Digital Content Protection & Anti-Theft Vault
1. **Physical Isolation:** PDF source files reside exclusively in `/storage/vault/` (outside public web paths).
2. **Ephemeral Viewer Tokens (`X-Viewer-Token`):**
   - The client never receives a direct download link.
   - When a student opens a purchased PDF, the client requests a session token via `POST /api/viewer/session`.
   - The server validates database ownership in `pdf_access`, generates a cryptographically secure random token, binds it to the user's ID, IP address, and User-Agent, and stores it in Redis / memory with a 300-second expiration.
   - Streaming is authorized strictly by presenting this `X-Viewer-Token`.
3. **In-Memory Blob Decoding:** The frontend fetches the encrypted stream into an ephemeral browser `Uint8Array` memory buffer, rendered directly onto an HTML5 `<canvas>` via PDF.js.
4. **Dynamic Purchaser Watermark:** An un-removable diagonal canvas watermark is drawn atop every rendered page displaying:
   - Student Full Name & Masked Email (`sa****@gmail.com`)
   - Unique User ID & Device IP
   - UTC Timestamp of viewing session
   - Unique Cryptographic Hash
5. **Print & Scraping Interception:**
   - `@media print` CSS sets PDF viewer canvas display to `none` with text "Protected Material - Printing Disabled".
   - Browser print shortcut (`Ctrl+P`, `Cmd+P`) is explicitly blocked via JavaScript event listeners.

### C. Client-Side Anti-Copy & Native Touch Protection
- **Global Text Shielding:** Applied `-webkit-user-select: none; user-select: none; -webkit-touch-callout: none;` across all web pages.
- **Form Input Exception:** Standard text selection and clipboard operations are explicitly preserved on `<input>`, `<textarea>`, and `[contenteditable="true"]` to avoid degrading form usability.
- **Context Menu & Shortcut Interception:** Right-click context menus, image dragging, developer tool inspect shortcuts (`F12`, `Ctrl+Shift+I`), and source viewing (`Ctrl+U`, `Ctrl+S`) are intercepted outside input fields.
- **Strict No-Zoom Lock:** Fixed viewport configuration prevents desktop-style accidental zoom or layout disruption:
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">`
  with touch-action constrained to standard two-axis panning (`touch-action: pan-x pan-y`).

### D. Financial Integrity & Transactional Concurrency
- **Integer Currency Representation:** All monetary balances and transactions are calculated and stored in integer `paise` (1 INR = 100 paise). Floating-point arithmetic errors are completely eliminated.
- **Atomic Concurrency Control:**
  ```php
  Db::transaction(function() use ($userId, $amountPaise) {
      $user = Db::one('SELECT wallet_paise FROM users WHERE id = :id FOR UPDATE', ['id' => $userId]);
      if ($user['wallet_paise'] < $amountPaise) {
          throw new ApiError('insufficient_balance', 'Insufficient wallet balance', 400);
      }
      // Deduct balance and insert immutable ledger row
  });
  ```
- **Append-Only Ledgers:** `wallet_transactions` and `ai_credit_transactions` tables are strictly append-only. Balance balances on the `users` table are verified against ledger sums during reconciliation audits.
- **Cashfree Webhook HMAC Verification:** Every incoming payment webhook computes HMAC-SHA256 over `${timestamp}${raw_body}` using `CASHFREE_SECRET_KEY` and compares it to the incoming `x-webhook-signature` header before granting content access.

### E. Rate Limiting & Denial-of-Service Defense
- Sliding-window rate limiters backed by MariaDB `rate_limits` table:
  - **Study AI Queries (`POST /api/ai/study`):** Max 20 requests per 10-minute window per user.
  - **Support Chat (`POST /api/ai/support`):** Max 30 requests per 10-minute window per user.
  - **Payment Intent Creation:** Max 10 requests per 10-minute window per IP.
  - **General API Traffic:** Global IP sliding window.

---

## 3. Security Header Verification

The following security response headers are active across all responses:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Permitted-Cross-Domain-Policies: none
```

---

## 4. Security Verification Conclusion

All critical attack surfaces have been identified, mitigated, and verified with live test requests. The system exhibits high resilience against data leakage, unauthorized content distribution, balance tampering, and API abuse.
