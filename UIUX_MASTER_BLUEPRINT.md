# ExamLegacy — Complete UI/UX Master Blueprint & Journey Mindmap
> **Document Version:** 2.0.0 (Production Release)  
> **Brand Identity:** ExamLegacy (Powered by SANJAYXLEGACY)  
> **Target Platform:** Mobile-First Responsive PWA & Web SPA  
> **Target Audience:** Competitive Exam Aspirants (NEET, JEE, UPSC, SSC, University)

---

## 1. Executive Summary & Design System Architecture

ExamLegacy is a high-yield digital education platform engineered to provide:
1. **Frictionless Discovery & Commerce:** Instant search, categorical indexing, transparent pricing, and split/wallet payment support.
2. **Ironclad Digital Content Protection:** Private in-app PDF rendering via short-lived in-memory blob streaming with dynamic, purchaser-specific watermarking and right-click/print interceptors.
3. **Deep AI Learning Accelerator:** Gemini 2.5 Flash-powered Study AI capable of analyzing purchased PDFs, custom uploads, or pasted notes across 12 distinct exam formats with MathJax LaTeX typesetting.
4. **Fluid Native-Feel Experience:** 60fps micro-interactions, spring-physics bottom sheets, tactile button presses, pulsing VIP indicators, and celebratory completion modals.

### Core Design Tokens

| Token | Light Theme Value | Dark Theme Value | Purpose |
| :--- | :--- | :--- | :--- |
| `--primary` | `#4f46e5` (Indigo 600) | `#6366f1` (Indigo 500) | Primary Brand, Active CTAs, Highlights |
| `--primary-press` | `#4338ca` | `#4f46e5` | Active Button State |
| `--primary-soft` | `rgba(79, 70, 229, 0.10)` | `rgba(99, 102, 241, 0.16)` | Background Tints, Chips, Accents |
| `--accent` | `#06b6d4` (Cyan 500) | `#22d3ee` (Cyan 400) | Secondary Accent, Energy, Gradients |
| `--accent-soft` | `rgba(6, 182, 212, 0.12)` | `rgba(34, 211, 238, 0.14)` | AI Feature Badges, Highlights |
| `--bg` | `#f8fafc` (Slate 50) | `#0b1020` (Deep Space) | Canvas Background |
| `--surface` | `#ffffff` | `#141a2e` | Cards, Elevated Surfaces |
| `--surface-2` | `#f1f5f9` | `#1b2338` | Segmented Controls, Inactive Chips |
| `--border` | `rgba(15, 23, 42, 0.08)` | `rgba(255, 255, 255, 0.08)` | Subtle Dividers, Outlines |
| `--vip` | `#f59e0b` (Amber Gold) | `#f59e0b` | VIP Badges, Pulse Glow |
| `--success` | `#16a34a` (Green 600) | `#22c55e` | Success Modals, Paid Status |
| `--danger` | `#ef4444` (Red 500) | `#ef4444` | Errors, Sign Out, Expirations |
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | `cubic-bezier(0.16, 1, 0.3, 1)` | Sheet Slide-Up, View Transitions |

---

## 2. Complete UI/UX Master Mindmap

```mermaid
flowchart TD
    %% Entry Point
    Start([User Opens ExamLegacy Web App]) --> ShellInit[Initialize App Shell & Check Auth/Config]
    
    %% Shell and Routing
    ShellInit --> RouteDecide{Route / State Check}
    
    %% Primary Navigation Tabs
    RouteDecide -->|Default| ScreenHome[Screen: Home]
    RouteDecide -->|#store| ScreenStore[Screen: Store Catalog]
    RouteDecide -->|#study| ScreenStudy[Screen: Study AI Hub]
    RouteDecide -->|#support| ScreenSupport[Screen: Support Center]
    RouteDecide -->|#account| ScreenAccount[Screen: Account & Wallet]
    RouteDecide -->|#library| ScreenLibrary[Screen: My Library]
    
    %% Home Screen Flow
    subgraph Home_Screen_Journey [Home Screen: Discovery & Orientation]
        ScreenHome --> TopBarHome[Topbar: Brand Mark + Theme Toggle + Notification Bell]
        ScreenHome --> HeroSec[Hero Section: Learn Practice Master + CTA Browse Store]
        ScreenHome --> AcceleratorBanner[🔥 2026/27 Exam Accelerator PYQ Banner with Pulse Glow]
        ScreenHome --> FeaturesRow[Value Props: Secure Library · Study AI · Store Wallet]
        ScreenHome --> FeaturedGrid[Featured PDF Materials Grid]
        FeaturedGrid -->|Click Card| NavPDP[Navigate to #product?slug=xxx]
    end
    
    %% Store Catalog Journey
    subgraph Store_Catalog_Journey [Store Catalog: Search & Filter]
        ScreenStore --> SearchInput[Instant Search Bar: Subject, Exam, Keyword]
        ScreenStore --> CategoryPills[Horizontal Category Filter: All, Physics, Chemistry, Biology, Zoology...]
        ScreenStore --> CatalogGrid[Responsive Grid: Discount Pills, VIP Tags, Price vs MRP]
        CatalogGrid -->|Click Card| NavPDP
    end
    
    %% Product Detail Journey
    subgraph Product_Detail_Journey [Product Detail & Conversion]
        NavPDP --> FetchProduct[/api/products/slug]
        FetchProduct --> RenderPDP[Cover Thumbnail + Title + Subtitle + Stats + Formatted Description]
        RenderPDP --> CheckAccessState{User Status & Access}
        CheckAccessState -->|Not Logged In| BtnSignIn[CTA: 'Sign in to purchase' -> Opens Auth Modal]
        CheckAccessState -->|Logged In & Owned| BtnReadNow[CTA: 'Read in secure viewer' -> Opens Viewer Overlay]
        CheckAccessState -->|Logged In & Not Owned| BtnBuyNow[CTA: 'Buy now · ₹XX' -> Opens Checkout Bottom Sheet]
    end
    
    %% Checkout and Payment Journey
    subgraph Checkout_Payment_Flow [Checkout & Transaction Engine]
        BtnBuyNow --> SheetCheckout[Bottom Sheet: Order Summary + Wallet Balance Check]
        SheetCheckout --> SelectPaymentMethod{Payment Mode Selector}
        SelectPaymentMethod -->|Mode: Wallet| PayWallet[100% Wallet Balance: Instant Unlock]
        SelectPaymentMethod -->|Mode: Cashfree| PayGateway[Card / UPI / NetBanking via Cashfree Modal]
        SelectPaymentMethod -->|Mode: Split| PaySplit[Partial Wallet + Balance via Gateway]
        
        PayWallet --> OrderSuccessDirect[Order Status = Paid]
        PayGateway --> CashfreeModal[Cashfree PG SDK Modal]
        PaySplit --> CashfreeModal
        
        CashfreeModal --> PollVerify{Polling /api/payments/verify every 2.5s}
        PollVerify -->|Paid| OrderSuccessGateway[Payment Verified!]
        PollVerify -->|Failed / Timeout| OrderFailToast[Toast: Payment Not Completed]
        
        OrderSuccessDirect --> CelebrationPop[🎉 Success Celebration Modal: Animated Green Checkmark]
        OrderSuccessGateway --> CelebrationPop
        CelebrationPop --> RedirectLib[Navigate to #library with Instant Document Access]
    end
    
    %% Secure In-App Viewer Journey
    subgraph Secure_Viewer_Journey [Secure In-App PDF Reader]
        BtnReadNow --> RequestSession[/api/viewer/session with product_id]
        RedirectLib --> OpenLibDoc[Tap Document in Library]
        OpenLibDoc --> RequestSession
        
        RequestSession --> StreamBytes[/api/viewer/stream via X-Viewer-Token]
        StreamBytes --> MemoryBlob[In-Memory Blob URL - No Public Link Exists]
        MemoryBlob --> RenderCanvas[PDF.js Canvas Renderer with Device-Scaled Viewport]
        RenderCanvas --> DynamicWatermark[Overlay Dynamic Diagonal Purchaser Watermark: Name + Email + ID + Timestamp]
        RenderCanvas --> DRMInterceptors[Deterrence: Block Context Menu + Intercept Ctrl+P / Ctrl+S]
        RenderCanvas --> ExitViewer[Back Arrow Button -> Closes Overlay smoothly]
    end
    
    %% Study AI Revision Journey
    subgraph Study_AI_Journey [Study AI Learning Loop]
        ScreenStudy --> SourceSelector{Select Study Source}
        SourceSelector -->|My PDFs| SelectPurchasedDoc[Dropdown: Choose from My Purchased Library]
        SourceSelector -->|Upload| UploadDoc[Private File Upload: PDF or Image max 15MB]
        SourceSelector -->|Paste Text| PasteNotes[Textarea: Paste Raw Notes / Formula / Questions]
        
        SelectPurchasedDoc --> TaskSelector
        UploadDoc --> TaskSelector
        PasteNotes --> TaskSelector
        
        TaskSelector[Select Task: Concept, Solve, MCQ, Flashcards, Mock Test, Weak Topics, etc.]
        TaskSelector --> PromptInput[Enter Question or Specific Instruction]
        PromptInput --> ClickAsk[Click 'Ask Study AI']
        ClickAsk --> TypingIndicator[3-Dot Bouncing Wave Animation: 'Study AI is analyzing...']
        TypingIndicator --> CallGemini[/api/ai/study via Gemini 2.5 Flash]
        CallGemini --> RenderAIOutput[Display Formatted Response + MathJax 3 LaTeX Formulas + Deduct Credits]
    end
    
    %% Support & Community Journey
    subgraph Support_Journey [Support Center & Community Hub]
        ScreenSupport --> SupportTabs{Select Support Mode}
        SupportTabs -->|AI Help| SupportAIPanel[Support AI for Orders/Viewer + Help AI for Platform Queries]
        SupportTabs -->|Human Support| HumanTicketPanel[Live Ticket List + 'New Conversation' Sheet]
        
        SupportAIPanel --> AIAnswer[Instant AI Response with Actionable Solutions]
        HumanTicketPanel --> TicketChat[Real-time Ticket Conversation with Admin/Support Team]
        
        ScreenSupport --> SocialLinks[Official Telegram · Instagram · YouTube · WhatsApp Channel]
    end
    
    %% Account, Wallet & Monetization Journey
    subgraph Account_Monetization_Journey [Account & Profile Management]
        ScreenAccount --> ProfileHeader[User Avatar + Change Camera Badge + Name + Email + VIP Status]
        ProfileHeader -->|Click Camera| UploadAvatar[Upload Custom Profile Photo -> /api/me/avatar]
        ScreenAccount --> StatBalances[Wallet Balance Card + AI Credits Balance Card]
        
        StatBalances -->|Tap Wallet| SheetWallet[Store Wallet Sheet: Recharge ₹10 - ₹5000 + History Ledger]
        StatBalances -->|Tap Credits| SheetCredits[AI Credits Sheet: Starter/Scholar/Master Packs + History]
        
        ScreenAccount --> MenuAccount[Menu Options: VIP Pass, Library, Appearance, Notifications, Security, Legal]
        MenuAccount -->|VIP PASS| SheetVIP[VIP Plans: Monthly/Quarterly/Annual + VIP PDF Unlocks]
        MenuAccount -->|Appearance| SheetTheme[Theme Selector: Light / Dark / Device System]
        MenuAccount -->|Sign Out| DoSignOut[Clear Session -> Toast Goodbye -> Navigate Home]
    end
```

---

## 3. Screen-by-Screen User Journey: Exactly What Appears When

### Step 1: Visitor / Discovery Flow (Screen: Home & Store)
1. **Initial Screen:** User lands on `/` (Home Screen).
2. **Components Rendered:**
   - **Sticky Glass Topbar:** Brand Logo (`EL`), title ("ExamLegacy"), Brand Powered By credit ("SANJAYXLEGACY"), Theme switcher (`#btn-theme`), and Notification icon (`#btn-notif`) with an active unread indicator dot.
   - **Hero Accelerator Banner:** Highlights the 2026/27 NEET & JEE High-Yield PYQ Accelerator with an amber-glowing pulse tag.
   - **Core Value Propositions:** 3 compact feature tiles:
     1. *Secure Library:* Watermarked, private PDFs.
     2. *Study AI:* Concept explanation, MCQ generator, and doubt solver.
     3. *Store Wallet & Credits:* Transparent ledger with instant zero-fee checkout.
   - **Featured Products Carousel/Grid:** Skeletons shimmer (`@keyframes shimmer`) while fetching `/api/products?limit=8`.
3. **Transition to Store:**
   - Clicking "Browse the Store" or the bottom navigation "Store" tab smoothly loads the Store Catalog with a 240ms native view transition (`.screen-enter`).
   - Category chips (Physics, Chemistry, Biology, Zoology, etc.) filter products in real-time.
   - Debounced search bar (300ms) matches titles, subtitles, and descriptions.

---

### Step 2: Product Detail Page & Conversion (Screen: Product)
1. **Trigger:** User taps any product card from Home or Store.
2. **Screen Transition:** URL updates to `#/product?slug={slug}`. Screen slides into view.
3. **Content Hierarchy:**
   - High-resolution cover art / document mockup.
   - Category badge & glowing Amber VIP pill (if VIP-exclusive).
   - Document Title and Subtitle.
   - Price block: Selling price, MRP with strikethrough (`<s>`), and percentage savings tag (`-XX%`).
   - Technical metadata: Page count, verified file size, language, and curriculum year.
   - Description block: Syllabus topics covered, question count, and solutions breakdown.
4. **Conditional CTA Matrix (Strict Logic):**
   - **Case A: Not Logged In:** Button reads `Sign in to purchase`. Clicking triggers the Google Firebase Authentication popup.
   - **Case B: Logged In & Already Purchased:** Button turns Green with Book-Open icon: `Read in secure viewer`. Clicking opens the in-app secure viewer instantly.
   - **Case C: Logged In & Not Purchased:** Primary action button reads `Buy now · ₹XX`. Clicking opens the native Bottom Sheet Checkout.

---

### Step 3: Checkout & Payment Modal Flow (Native Bottom Sheet)
1. **Trigger:** User taps `Buy now · ₹XX`.
2. **Micro-Interaction:** 
   - Scrim darkens with `backdrop-filter: blur(8px)`.
   - Bottom sheet slides up from `translateY(102%)` to `translateY(0)` with spring curve `cubic-bezier(0.16, 1, 0.3, 1)`.
3. **Sheet Contents:**
   - Document title, quantity, and total amount.
   - User's available Store Wallet balance.
   - Segmented Method Picker:
     - **Wallet:** Enabled if `wallet_balance >= total`. Instantly completes order with zero gateway latency.
     - **Card / UPI (Cashfree):** Opens Cashfree payment gateway modal.
     - **Split Payment:** Deducts all available wallet balance and generates a Cashfree session for only the remaining amount.
4. **Execution & Confirmation:**
   - If paid via Wallet: Sheet closes immediately -> Celebratory Pop (`EL.ui.celebration`) -> Instant navigation to `#/library`.
   - If Cashfree: Cashfree JS SDK modal appears -> User approves UPI intent / enters card -> Background polling checks `/api/payments/verify` every 2.5s -> On success: Celebratory Pop -> Library.

---

### Step 4: Digital Library & Document Access (Screen: Library)
1. **Trigger:** Navigation to `#/library` or automatic post-purchase redirect.
2. **Auth Guard:** If not logged in, gracefully directs user to sign in.
3. **Components:**
   - Active document count.
   - Clean list of cards with PDF icon, document title, page count, and access license ("lifetime" or expiry date).
   - Empty state illustration (`EL.ui.empty`) if user has no documents yet, with a direct CTA to "Browse the Store".
4. **Action:** Tapping any document row initiates the In-App Viewer flow.

---

### Step 5: Secure In-App PDF Viewer (Modal Overlay)
1. **Trigger:** Tapping a purchased document in Library or PDP.
2. **Security & DRM Lifecycle:**
   - Step A: Frontend calls `POST /api/viewer/session` with `product_id`.
   - Step B: Server verifies active ownership and creates a 2-hour single-user viewer session token (`X-Viewer-Token`).
   - Step C: Viewer fetches stream via `GET /api/viewer/stream`. Raw bytes are loaded into an in-memory `Blob` and fed to `pdfjsLib`. **No public PDF download URL is ever exposed in the DOM or network inspect.**
   - Step D: Dynamic purchaser watermark is overlaid diagonally (-24° rotation) over all canvas pages:
     ```text
     Licensed to {User Name} · {User Email} · ID {User ID}
     Issued {Timestamp} · ExamLegacy — do not redistribute
     ```
   - Step E: Keyboard shortcuts (`Ctrl+P`, `Ctrl+S`, `Cmd+P`, `Cmd+S`) and browser context menus are strictly suppressed.
   - Step F: Close button in the viewer header cleanly disposes the blob and returns to the app shell.

---

### Step 6: Study AI Learning Loop (Screen: Study AI)
1. **Trigger:** Tapping `Study AI` in the bottom navigation.
2. **Components:**
   - Real-time AI Credit Balance pill (updates dynamically).
   - **Source Tabs (Segmented Control):**
     1. *My PDFs:* Dropdown populated with user's purchased materials.
     2. *Upload:* Native file picker for private PDF or Image (up to 15MB).
     3. *Paste text:* Textarea for raw notes, exam questions, or summaries.
   - **Exam Task Selector (12 High-Yield Modes):**
     - Explain concept
     - Solve question step-by-step
     - Generate practice MCQs with explanations
     - Short revision answer
     - Detailed long exam answer
     - Structured notes generator
     - Quick revision summary
     - Printable flashcard maker
     - Timed mock test simulator
     - Identify weak topics & common traps
     - Deep chapter analysis
   - **Question/Instruction Field:** Multiline text input for user's specific query.
   - **Ask Button:** Initiates query with micro-interaction:
     - Button disables to prevent duplicate submissions.
     - Thinking state renders three animated wave-bouncing dots (`.typing-wave`).
     - Gemini 2.5 Flash processes the prompt against the document content.
   - **Response Panel:**
     - Shows Task badge, Credits spent, and remaining balance.
     - Text renders with full markdown formatting.
     - MathJax V3 renders all inline and block mathematical and chemical formulas:
       $$\int_{0}^{\pi} \sin(x) dx = 2, \quad \Delta G^\circ = -RT \ln K_{eq}$$

---

### Step 7: Multi-Tier Support Center (Screen: Support)
1. **Trigger:** Tapping `Support` in navigation.
2. **Segmented Modes:**
   - **Tab 1: AI Help (Instant Self-Serve):**
     - *Support AI:* Handles account, order lookup, payment status, and PDF viewer access questions.
     - *Help AI:* Guides users on platform features, wallet mechanics, and credit packs.
   - **Tab 2: Talk to a Human (Ticket System):**
     - Lists all active and past ticket threads with status badges: `Open`, `Waiting for admin`, `Waiting for you`, `Resolved`.
     - `+ New conversation` button opens a slide-up sheet to submit a subject and description.
     - Live message thread view allows ongoing back-and-forth communication with support admins.
3. **Official Community Links:** Verified links to Official Telegram Channel, Discussion Group, Instagram, YouTube, and WhatsApp Community.

---

### Step 8: Account, Wallet & Profile Customization (Screen: Account)
1. **Trigger:** Tapping `Account` in navigation.
2. **User Profile Card:**
   - Interactive profile photo with camera overlay badge (`#btn-change-avatar`). Clicking allows instant upload of a new profile avatar (`POST /api/me/avatar`).
   - User Name, Email, and VIP Member indicator.
3. **Financial Balances:**
   - **Store Wallet Card:** Displays available funds in ₹. Tapping opens the Wallet Recharge Sheet (select or type ₹10 to ₹5,000, trigger Cashfree, view credit/debit transaction history).
   - **AI Credits Card:** Displays available balance. Tapping opens the Credits Store Sheet with 3 packs (Starter 100 cr, Scholar 350 cr, Master 1,000 cr with bonus credits).
4. **Settings & Utilities Menu:**
   - **VIP PASS:** Sheet showing monthly, quarterly, and annual subscription tiers with benefits.
   - **Appearance:** Sheet to toggle between Light, Dark, or System mode.
   - **Edit Profile:** Update display name and payment phone number.
   - **Privacy & Security:** Overview of DRM protection and personal data retention policies.
   - **About & Legal:** Terms of Service, Privacy Policy, and Refund Policy dialogs.
   - **Sign Out:** Secure sign-out with session destruction and return to Home screen.

---

## 4. Motion Design & Animation Specifications

Every animation in ExamLegacy is tuned to 60fps, GPU-accelerated (`transform`, `opacity`), and adheres to `prefers-reduced-motion`.

### 1. View Transitions (`.screen-enter`)
```css
.screen-enter {
  animation: screenEnter 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes screenEnter {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 2. Spring Bottom Sheet (`.sheet` & `.scrim`)
- **Scrim:** Fades from `opacity: 0` to `opacity: 1` over `220ms` with `backdrop-filter: blur(8px)`.
- **Sheet:** Slides up from `translateY(102%)` to `translateY(0)` over `340ms` using `cubic-bezier(0.16, 1, 0.3, 1)`.

### 3. Tactile Press Feedback
- **Buttons (`.btn`):** `transition: transform 140ms ease;` -> `:active { transform: scale(0.97); }`
- **Cards (`.card.tap`):** `transition: transform 140ms ease;` -> `:active { transform: scale(0.985); }`
- **List items (`.rowitem`):** `:active { transform: scale(0.985); background: var(--surface-2); }`

### 4. High-Yield VIP Pulsing Glow (`.pulse-glow`, `.tag.vip`)
```css
@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45);
  }
  50% {
    box-shadow: 0 0 12px 3px rgba(245, 158, 11, 0.25);
  }
}
```

### 5. AI Thinking Wave Dots (`.typing-wave`)
Three staggered dots animating with a wave effect:
```css
@keyframes waveBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.35;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}
.typing-wave span:nth-child(1) { animation-delay: 0s; }
.typing-wave span:nth-child(2) { animation-delay: 0.18s; }
.typing-wave span:nth-child(3) { animation-delay: 0.36s; }
```

### 6. Payment Success Celebration Pop (`.celebration-overlay`)
A full-screen modal with an animated pop checkmark that triggers upon order completion or payment verification:
```css
@keyframes checkmarkPop {
  0% { transform: scale(0.3); opacity: 0; }
  70% { transform: scale(1.22); }
  100% { transform: scale(1); opacity: 1; }
}
```

---

## 5. Screen & State Machine Matrix

| Screen Name | Route Hash | Auth Required | Loading State | Empty State | Error State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Home** | `#/home` | No | 4 Card Skeletons | "No material published yet" | Offline Alert Banner |
| **Store** | `#/store` | No | 8 Grid Skeletons | "No results found for query" | Retry error box |
| **Product** | `#/product?slug=xxx` | No | 2 Split Skeletons | "Product not found (404)" | Error message with back CTA |
| **Library** | `#/library` | **Yes** | 6 List Skeletons | "Your library is empty" + Store CTA | Error box |
| **Study AI** | `#/study` | **Yes** | AI Wave Dots | "No purchased PDFs to select" | Red alert box with credits refunded |
| **Support** | `#/support` | **Yes** | 2 Thread Skeletons | "No conversations yet" | Error box |
| **Account** | `#/account` | **Yes** | Card Skeletons | N/A | Toast error notification |
| **Notifications** | `#/notifications` | **Yes** | 4 Row Skeletons | "No notifications" | Error box |

---

## 6. Developer & AI Implementation Master Prompt

When extending or maintaining this project, always adhere to the following master prompt instructions:

```text
You are maintaining and enhancing the ExamLegacy platform (Powered by SANJAYXLEGACY).
The app runs on vanilla JavaScript (ES6+), CSS custom properties, and a modular PHP/MariaDB backend.

Core Architecture Rules:
1. Shell & Routing: All views are driven by hashchange events handled in assets/js/app.js and assets/js/ui.js.
   Never navigate using hard page reloads. Always use EL.ui.navigate(screenName, params).
2. Screen Transitions: Every dispatch() in ui.js MUST apply the .screen-enter class to #content to maintain the 240ms native view animation.
3. Bottom Sheets & Modals: Always use EL.ui.sheet({ title, sub, body, actions }) for input dialogs and EL.ui.celebration({ title, message, buttonLabel }) for transaction confirmations.
4. AI Interactions: Always render EL.ui.aiTyping(label) during asynchronous AI queries, and invoke MathJax.typesetPromise([host]) after updating the DOM with AI responses.
5. In-App Viewer Security: PDFs must only be rendered through EL.viewer.open(productId, title), which fetches short-lived session tokens and streams in-memory blobs with dynamic user watermarking. Never create or link to direct public PDF URLs.
6. Design Integrity: Maintain consistent design tokens defined in assets/css/app.css. Support both Light and Dark themes via :root[data-theme="dark"].
7. Brand Consistency: Preserve the 'Powered by SANJAYXLEGACY' branding across topbars, hero banners, and legal sections. WhatsApp support must remain admin-controlled via the backend config.
```
