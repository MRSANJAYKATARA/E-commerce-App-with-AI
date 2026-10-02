# ExamLegacy — Product Requirements Document (PRD)

**Document Version:** 2.0.0  
**Status:** Approved & Implemented  
**Author & Architect:** SanjayxLegacy (`sanjaykatara59927@gmail.com`)  
**Ecosystem:** ExamLegacy PWA, InfinityFree Shared Hosting, MySQL + Google Cloud Firestore Hybrid  

---

## 1. Executive Summary & Vision
ExamLegacy is a high-performance, mobile-first Progressive Web Application (PWA) designed for competitive exam aspirants across India (UPSC, SSC, Banking, Railways, State PSCs, Engineering & Medical Entrance). It combines curated digital exam materials (PDF notes, solved question banks, mock exams) with an integrated AI-powered Study Arena, personalized student library (Vault), and an enterprise single-superadmin control center.

### 1.1 Core Value Proposition
- **Distraction-Free Native Feel:** 100% responsive, anti-zoom, anti-pinch viewport lock providing an experience indistinguishable from a high-end native iOS or Android app.
- **Instant Secure Access:** Google One-Tap / Firebase Auth, Cashfree PG instant UPI payment, zero-wait access to study materials.
- **In-App Protected Reading:** Secure PDF viewer preventing unauthorized URL extraction, leeching, or scraping.
- **Study AI Arena:** AI-assisted doubt solving, question practice, and concept explanations backed by Google Gemini.
- **Enterprise Single-Superadmin Console:** Bank-grade access control restricted exclusively to `sanjaykatara59927@gmail.com` (UID `2RyGoMqyjqcXiBrp5gH1VdSLWx72`) with real-time student balance controls, manual PDF licensing, and transaction auditing.

---

## 2. Target Audience & Personas

### Persona A: Competitive Exam Aspirant ("Arjun")
- **Profile:** 23 years old, preparing for UPSC/State PSC exams from a tier-2 city.
- **Needs:** Fast loading on mobile data, instant UPI purchases without clunky checkouts, reliable study notes readable on any phone.
- **Pain Points:** Clunky websites with annoying zoom glitches, lost download links, fear of payment failures.

### Persona B: Single Superadmin ("Sanjay Katara")
- **Profile:** Platform owner, publisher, and chief administrator.
- **Needs:** Complete control over product catalog, student wallet balances, AI credits, manual PDF grants, and revenue logs from a secure, isolated console.
- **Pain Points:** Clashing user sessions when testing student and admin accounts simultaneously, database credential exposure.

---

## 3. Product Principles & Architecture Directives

### 3.1 Absolute System Privacy & Zero Developer Jargon
- End-users must **never** see backend infrastructure terminology in UI elements, toast notifications, dialogs, or DOM labels.
- Banned terms in customer UI: `"MySQL"`, `"Firestore"`, `"PHP"`, `"cURL"`, `"FastCGI"`, `"Apache"`, `"Stack trace"`, `"API Key"`.
- Consumer-friendly replacements: *"Optimizing your study library..."*, *"Synchronizing materials..."*, *"Verified Study Notes"*.

### 3.2 Viewport Lock & Anti-Gravity Rules
- Prevent viewport scaling or pinch-to-zoom in Safari, Chrome, and PWA standalone mode.
- Strict meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">`.
- Root CSS constraints: `touch-action: pan-x pan-y; overscroll-behavior-y: contain; -webkit-text-size-adjust: 100%;`.
- Rigid layout: Fixed Topbar (`56px`, `z-index: 1000`) and Fixed Bottom Navigation (`64px`, `z-index: 1000`). Scrollable content container with calculated safe padding.

### 3.3 Single Superadmin Access Control
- Exact designated identity:
  - **Email:** `sanjaykatara59927@gmail.com`
  - **Firebase UID:** `2RyGoMqyjqcXiBrp5gH1VdSLWx72`
- All other Google accounts are automatically assigned the `user` role.
- Any attempt to open `/admin/` with an unauthorized Google account results in immediate session revocation and lockout.

---

## 4. Key Functional Modules

### 4.1 Authentication & Session
- **Engine:** Google Sign-In via Firebase Auth SDK (v10 compat).
- **Hybrid Bridge:** Client obtains Google ID token -> forwards via `Authorization: Bearer <token>`, `X-Authorization`, and `X-Firebase-Token` -> Backend verifies token (with local Google cert caching fallback for shared hosting) -> Auto-creates/syncs MySQL `users` record and dual-writes to Cloud Firestore.
- **Graceful Profile Fallback:** If MySQL `/me` call is pending or delayed, client immediately renders profile from Firebase session (`displayName`, `email`, `photoURL`), eliminating empty states or `"Please sign in to continue"` loops.

### 4.2 Store & Catalog
- **Products:** Categorized study materials, syllabus packs, solved papers, VIP bundles.
- **Pricing:** Dynamic dual pricing (MRP + Offer Price in INR).
- **Access Duration:** Lifetime access or configurable interval (days).
- **VIP Only Flag:** Products reserved exclusively for VIP Pass holders.

### 4.3 Payment & Checkout (Cashfree PG)
- **Flow:** User clicks "Buy Now" -> Client requests `/api/payment/order` -> Backend creates Cashfree order session -> Cashfree Web SDK opens seamless UPI / Card / Netbanking modal -> Post-payment verification updates MySQL `orders` to `paid` and grants `pdf_access`.
- **Store Wallet:** Users can apply their store balance (cashback/refunds) to offset order amounts.

### 4.4 Student Vault (Library)
- **Grid View:** Purchased materials with cover preview, page counts, purchase date.
- **Secure PDF Streaming:** PDFs are never served as static public files. Requests pass through `/api/pdf/view` which enforces `pdf_access` ownership verification, streaming the file dynamically with custom watermarking and non-caching headers.

### 4.5 Study Arena (AI Copilot)
- **Engine:** Google Gemini 2.5 Flash.
- **Capabilities:** Concept explanations, summary generation, practice problem explanation, study scheduler.
- **Credit Metering:** Users receive 50 welcome credits upon first login; each query deducts configurable credits (default: 1 credit). Additional credits can be purchased via Credit Packs.

### 4.6 Single-File Pro Control Center (`/admin/`)
- **App Isolation:** Operates under dedicated named Firebase app `ExamLegacyAdminApp` to prevent session overwrite with student app.
- **Dashboard:** Live KPIs (Total Students, Paid Revenue, Active Orders, Products, Credits).
- **Material Management:** Direct PDF drag-drop upload, thumbnail upload, slugification, pricing.
- **User Management:** Instant one-tap balance adjust (`+₹50`, `+₹100`, `+50 credits`, `+100 credits`), PDF grant/revoke dropdown, suspend/activate user.
- **Order Inspector:** Live transaction logs with Cashfree reference IDs and manual refund/re-verify triggers.
- **Audit Logs:** Immutable audit ledger tracking every superadmin action.

---

## 5. Non-Functional Requirements
- **Performance:** First Contentful Paint (FCP) < 1.2s; PWA shell cacheable offline via Service Worker (`sw.js`).
- **Compatibility:** Shared hosting LAMP stack (PHP 8.2+, MySQL 8.0/MariaDB 10.4+, Apache FastCGI).
- **Security:** CSRF protection, Prepared PDO Statements, strict XSS escaping, no plain-text credentials in client code.
- **Compliance:** Digital Personal Data Protection (DPDP) Act compliance with in-app Privacy Policy, data access rights, and contact details for the designated Data Grievance Officer.
