# ExamLegacy — Complete Application Flow & Architecture (APP_FLOW)

**Document Version:** 2.0.0  
**Ecosystem:** Student PWA + Single-Superadmin Enterprise Console  

---

## 1. Student Application Flow

### 1.1 First Launch & Initialization
```
App Open (index.html)
   │
   ├─► Service Worker checks cache (Offline shell ready)
   │
   ├─► Splash Screen displayed (Anti-gravity viewport lock active)
   │
   ├─► Firebase Auth initial handshake (IndexedDB session check)
   │      │
   │      ├─► [User Found] ──► Fetch /api/me (Sync with MySQL)
   │      │                      │
   │      │                      ├─► Success: populate full profile, wallet, credits
   │      │                      └─► Offline/Lag: graceful fallback to Firebase cache
   │      │
   │      └─► [No User] ──────► Ready for guest exploration (Store & Home unlocked)
   │
   └─► Splash fades out smoothly (Route: #home)
```

---

### 1.2 Authentication & Protected Route Guard Flow
```
User navigates to Protected Route (Vault, Study AI, Account)
   │
   ├─► requireAuth() Check
   │      │
   │      ├─► Auth State Pending? ──► Render Skeleton Loader (Never flash premature login)
   │      │
   │      ├─► Authenticated? ───────► Proceed to requested screen
   │      │
   │      └─► Unauthenticated? ────► Render Auth Screen:
   │                                   │
   │                                   ├─► "Continue with Google" (4-Color SVG Button)
   │                                   ├─► Terms of Service modal
   │                                   └─► DPDP Act Privacy Policy modal
   │
   └─► Google Sign-In Success
          │
          ├─► Multi-header Token Emission (Authorization + X-Authorization + X-Firebase-Token)
          ├─► Backend verifies signature (Live certs or local cached bundle)
          ├─► MySQL user updated/created; Dual-sync to Cloud Firestore
          └─► Instant return to requested route with welcome toast
```

---

### 1.3 Store, Checkout & PDF License Fulfillment Flow
```
Store Catalog (#store)
   │
   ├─► Browse Categories / Search materials
   │
   └─► Select Material (#product?id=XXX)
          │
          ├─► Check if already owned?
          │      │
          │      ├─► YES: Show "Open in Vault" button (Instant reading)
          │      │
          │      └─► NO: Show "Buy Now — ₹XXX" button
          │
          └─► Click "Buy Now"
                 │
                 ├─► Auth verification
                 ├─► POST /api/payment/order (Server creates trusted Cashfree Order)
                 ├─► Cashfree Web Checkout Modal opens (UPI / Card / Netbanking)
                 │      │
                 │      ├─► Payment Completed
                 │      │      │
                 │      │      ├─► Server Webhook receives HMAC-SHA256 event
                 │      │      ├─► Order status set to 'paid'
                 │      │      ├─► License row inserted into 'pdf_access' table
                 │      │      └─► Student redirected to #vault with success alert
                 │      │
                 │      └─► Payment Dismissed / Failed
                 │             │
                 │             └─► Helpful friendly notification, retry option
```

---

### 1.4 Student Vault & Reading Flow
```
Vault (#vault)
   │
   ├─► Display all active licenses from 'pdf_access'
   │
   └─► Click "Read Material"
          │
          ├─► Open in-app PDF Reader Modal
          ├─► Stream dynamically via /api/pdf/view?token=...
          ├─► Watermark dynamically with student UID/email
          └─► Prevent unauthorized download/export/context menu
```

---

### 1.5 Study Arena (AI Doubt Solver) Flow
```
Study Arena (#study)
   │
   ├─► Check AI Credit Balance
   │      │
   │      ├─► Balance > 0: Open prompt input
   │      │
   │      └─► Balance = 0: Show "Top-up Credits" sheet with Credit Packs
   │
   └─► Submit Academic Question
          │
          ├─► POST /api/ai/ask with Bearer token
          ├─► Backend deducts credit from MySQL ledger
          ├─► Gemini 2.5 Flash processes query with exam-focused system prompt
          └─► Formatted markdown response streamed to conversation view
```

---

## 2. Superadmin Control Center Flow (`/admin/`)

```
Open /admin/
   │
   ├─► Isolated Named App initialized: "ExamLegacyAdminApp"
   │
   ├─► Check Stored Master Secret Key
   │      │
   │      ├─► Valid: Direct entry into Admin Shell
   │      │
   │      └─► None / Invalid: Render Enterprise Gatekeeper
   │
   └─► Enterprise Gatekeeper Screen
          │
          ├─► Method 1: "Continue with Google"
          │      │
          │      ├─► Check Identity:
          │      │      Email === 'sanjaykatara59927@gmail.com' OR UID === '2RyGoMqyjqcXiBrp5gH1VdSLWx72'
          │      │      │
          │      │      ├─► MATCH: Grant access, render Admin Shell
          │      │      │
          │      │      └─► MISMATCH: Immediate signOut(), display red Access Denied banner
          │
          └─► Method 2: "Master Admin Key"
                 │
                 ├─► POST /api/admin/stats with key
                 ├─► Valid: Auto-provision superadmin row in MySQL if needed; grant access
                 └─► Invalid: Error toast
```

---

### 2.1 Admin Console Operations Tree
```
Admin Shell
   │
   ├── [OVERVIEW]
   │     ├── Dashboard: Realtime KPIs, recent audit events, quick actions
   │     ├── Products & Materials: Material catalog, drag-drop PDF upload, cover upload, pricing
   │     ├── Orders & Sales: Paid/pending transactions, customer detail, manual refund
   │     └── Users & Balances: Student list, search by phone/email/name
   │           │
   │           └── Manage User Modal:
   │                 ├── Instant Wallet Adjust (+₹50, +₹100, +₹500, -₹50)
   │                 ├── Instant AI Credit Adjust (+50, +100, +500, -50)
   │                 ├── PDF License Grant/Revoke (Dropdown product selector)
   │                 ├── Account Status (Active / Suspended / Disabled)
   │                 └── Direct In-App Push Notification
   │
   ├── [OPERATIONS]
   │     ├── Study Arena & Support: AI conversation logs, support tickets, admin replies
   │     ├── Push Broadcasts: Send global alerts to all students
   │     ├── VIP Pass Plans: Configure subscription intervals and pricing
   │     └── AI Credit Packs: Create and price credit bundle SKUs
   │
   └── [SYSTEM]
         ├── Platform Settings: Support channels (WhatsApp, Telegram, Email), AI credit costs
         └── Security & Audit Log: Immutable chronological ledger of every superadmin action
```
