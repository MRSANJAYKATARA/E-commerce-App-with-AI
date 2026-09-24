# ExamLegacy — Architecture & Data Model

## Principles

1. **Server is the only authority.** The browser sends a Firebase ID token; the PHP API verifies
   the token's signature and claims against Google's public keys, maps the UID to a MySQL user, and
   re-checks authorization for every protected resource. No product id, order id, token or
   `localStorage` value is ever trusted on its own.
2. **MySQL is authoritative** for money and access. Balances are cached on `users` but every
   mutation also writes an immutable ledger row inside the same transaction.
3. **Idempotency everywhere** money or notifications are involved (unique keys on intents, ledger
   entries and notifications) so retries and duplicate webhooks are safe.
4. **Least exposure.** Protected PDFs and uploads live outside the web-servable tree (or behind a
   deny-all `.htaccess`) and are streamed only through the API after authorization.

## Request lifecycle (protected endpoint)

```
Client                      API (api/index.php)                 MySQL
  |  Authorization: Bearer <Firebase ID token>                     |
  |------------------------------> Auth::authenticate()            |
  |                                verifyIdToken()  (Google certs) |
  |                                syncUser()     ---------------> | users
  |                                status/role checks              |
  |                                handler + per-resource checks--> | orders/ledger/access
  |<----------------------------- JSON (safe shapes only) ---------|
```

## Money & credits

- **Store Wallet** (`wallet_transactions`) — append-only, signed `amount_paise`, `balance_after_paise`,
  unique `idempotency_key`. Used only for ExamLegacy purchases. No withdrawal/transfer.
- **AI Credits** (`ai_credit_transactions`) — a separate append-only ledger (not money). Trial
  credits are granted exactly once on first login; packs are purchased via a verified gateway;
  each AI request records an `ai_usage` row and deducts credits atomically.
- Mutations use `Db::transaction()` + `SELECT … FOR UPDATE` so balances can never be manipulated
  from the client or raced into a negative value.

## Payments (Cashfree)

A single `payment_intents` table drives every paid action (`order`, `recharge`, `credit_pack`,
`vip`). Flow:

1. Server creates the intent + a Cashfree order, returns only the `payment_session_id` to the
   browser to launch checkout.
2. The browser returns / polls; the server **fetches the order from Cashfree**, and/or the
   **signed webhook** arrives: it verifies the signature, checks the amount, and settles the intent
   exactly once (idempotent). Only then does the business effect happen:
   - `order` → debit wallet portion, grant PDF access, emit notifications, email receipt.
   - `recharge` → credit wallet.
   - `credit_pack` → credit AI credits.
   - `vip` → activate membership.
3. The browser's own success callback is **never** the authority.

## Secure PDF pipeline

```
paid order ──> pdf_access (active)            [ownership]
                     |
issueViewerSession ──> random token (returned once), stored as SHA-256 hash, TTL ~15 min
                     |
/viewer/stream (X-Viewer-Token) ──> resolveViewerSession:
        token hash exists? not revoked? not expired?
        AND pdf_access still active & not expired?   <-- re-validated every request
                     |
        stream bytes (HTTP Range aware) ──> PDF.js renders in-app
                     |
        dynamic purchaser watermark (name/email/userId/issuedAt)
```

- Revoke/refund/expiry sets `pdf_access.status` and revokes viewer sessions; the next stream
  attempt fails because authorization is re-checked each time.
- `pdf_access_logs` records grants, streams, ranges and denied attempts.

## Study AI authorization

`StudyAi::resolveSource()` only ever loads content that the verified user is entitled to:
- `purchased` → requires active `pdf_access`, then reads the protected file **server-side**.
- `upload` → requires an `ai_documents` row owned by the user, then reads the protected upload.
- `text` → the user's own pasted input.

Content is sent to Gemini from the server (the API key never reaches the browser). Small files go
inline; oversized PDFs fall back to best-effort text extraction. There is no path by which the
model can read another user's files, unpublished PDFs, arbitrary URLs, or list the server directory.

## Support

- **Support AI** is grounded in a JSON blob of the user's *verified* data (orders, wallet, credits,
  access) and is instructed to never invent statuses.
- **Help AI** is general product/usage guidance with no personal data.
- **Human support** uses `support_threads` + `support_messages` with the status workflow and
  in-app notifications on replies.

## Notifications

`notifications.event_key` is unique; inserts that collide (duplicate webhook/event) are ignored, so
the same event never produces two notifications. `user_id IS NULL` broadcasts to all users.

## Frontend

Vanilla JS SPA: hash router (`ui.js`), a thin `api.js` that attaches the ID token, `auth.js` for
Firebase, `viewer.js` for the secure PDF viewer (PDF.js + watermark), and `app.js` for screens.
The design system (`assets/css/app.css`) implements the brand tokens, light/dark/system theming,
native-style bottom sheets, bottom navigation (mobile) + side rail (desktop), safe-area insets,
selective liquid glass, and `prefers-reduced-motion` support. The admin dashboard is a separate
app under `/admin` that requires an `admin`-role user.

## Design decisions & scope notes

- **Firestore:** the brief lists MySQL + Firestore. MySQL is the authoritative store for all
  financial/access data. Firestore is intentionally *not* duplicated into a parallel source of
  truth (that would violate the "no duplicate systems" rule); it is available for optional future
  realtime features. No fake Firestore usage is included.
- **Screenshot protection:** not claimed. Layered deterrence is used instead (see README).
- **PDF text extraction** (`PdfText`) is a best-effort fallback for oversized PDFs; the primary
  path sends the document inline to Gemini.
