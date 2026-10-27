# Sahyak CRM: Forensic Audit & System State Document (`CRM_AUDIT_STATE.md`)
*Generated: 2026-08-19 | Role: Principal Full-Stack Architect & UI/UX Lead*

---

## 1. Forensic Audit: Root Causes & Technical Debt

### A. Admin Panel Architecture & Routing
1. **Route Analysis**:
   - `/admin` (`frontend/src/app/admin/page.js`): Currently a thin client-side redirect component that forwards superadmins to `/superadmin-dashboard` and non-admins to `/login`.
   - `/superadmin-dashboard` (`frontend/src/app/superadmin-dashboard/page.js`): The unified master command center for platform owners (`ADMIN77` / `admin@crm.com`). Contains 5 core tabs: *Unified 5-Stage Pipeline, Platform Signups & Users, Team Agents Roster, Admin Review Alerts, and Live Audit Logs*.
   - `/dashboard` (`frontend/src/app/dashboard/page.js`): The multi-tenant daily driver workspace used by agency owners, solo agents, and team sales reps. Dynamically adapts pipeline stages, filters, custom fields, and lead schemas based on the tenant's `industryType` and `educationSubProfile`.
2. **Duplication & Confusion**:
   - There is no duplicate controller on the backend, but on the frontend, sidebar navigation and mobile bottom navigation previously exposed admin links unconditionally or with ambiguous labels.
   - On desktop, `/superadmin-dashboard` is conditionally rendered only for superadmins. However, on mobile, `Admin` button was appearing for regular users if local storage had stale admin flags.
3. **Action Plan**:
   - Keep `/admin` as a permanent seamless redirect to `/superadmin-dashboard`.
   - Strictly guard superadmin navigation elements using verified session role (`role === 'superadmin' || isAdmin === true`).
   - Clean up desktop and mobile headers to avoid overlapping action buttons.

---

### B. Catalogue vs. "Colleges & Courses" Overlap
1. **Current State in Navigation (`BottomNav.js`)**:
   - `DESKTOP_ITEMS` contains BOTH:
     - `/catalogue` (labeled *"Colleges & Courses"*)
     - `/projects` (labeled *"Products & Packages"*)
   - `MOBILE_ITEMS` statically points to `/catalogue` (labeled *"Colleges"*).
   - This creates severe cognitive overload:
     - An **Education Tenant** (e.g. Study Abroad, EdTech, Higher Ed) sees redundant standard "Products & Packages" tabs.
     - A **Non-Education Tenant** (e.g. Real Estate, SaaS, Event Management, Consulting) sees "Colleges & Courses" in their sidebar, which is completely irrelevant.
2. **Current State in Catalogue UI (`frontend/src/app/catalogue/page.js`)**:
   - In "My Active Catalogue", clicking an imported college currently opens an **inline accordion table** directly inside the card (`expandedCollegeId === item._id`).
   - This causes massive vertical clutter, awkward nested scrolling, broken table wrapping on mobile, and prevents deep-linking or sharing specific college pages.
3. **Action Plan**:
   - **Navigation Conditional Rule**: Inspect `user.industryType` in `BottomNav.js`:
     - If `user.industryType === 'Education'`: Show `/catalogue` (*"Colleges & Courses"*), HIDE `/projects` (*"Products & Packages"*).
     - If `user.industryType !== 'Education'`: Show `/projects` (*"Products & Catalogue"*), HIDE `/catalogue`.
     - Mobile navigation will mirror this dynamic industry check.
   - **College UI Dedicated Routing**:
     - Remove inline expanding accordion table in `catalogue/page.js`.
     - Clicking any college card will execute Next.js dynamic routing: `router.push('/colleges/' + college._id)`.
     - Create a brand new, dedicated, premium page: `frontend/src/app/colleges/[id]/page.js` with structured tabs: *Overview & Campus Info, Course Offerings & Degree Programs, Custom Fee Structure, Tie-Up / MOU Commission Terms, and Direct Actions (Share Brochure, Add Course)*.

---

### C. Mobile Responsiveness & Layout Breakdown
1. **Identified Mobile Bottlenecks**:
   - **Header Action Bars**: Top toolbars in `superadmin-dashboard` and `dashboard` have up to 5-6 horizontal action buttons (*Refresh, CSV Audit, Clean Test Data, Add Lead, Onboard Agent*). On `< 640px` screens, they cause horizontal overflow or unreadable squished text.
   - **Data Tables**: Kanban/table views lack horizontal overflow wrapping (`overflow-x-auto` with clean touch scrolling), causing tables to push page containers beyond 100vw.
   - **Modal Form Footers**: Action buttons in modals sometimes overflow horizontally without `flex-col sm:flex-row` stacking.
   - **Bottom Navigation Overlap**: Fixed bottom nav (`bottom-nav`) requires consistent padding bottom (`pb-24` on mobile) on page containers to prevent bottom action buttons from being blocked.
2. **Action Plan**:
   - Refactor header toolbars using Tailwind responsive patterns: compact icon-first buttons on mobile, full text on `sm:`/`md:`.
   - Wrap all tables in touch-friendly responsive wrappers with mobile card fallback for small screens.
   - Standardize modal footers to use full-width stacked buttons on mobile and inline flex on desktop.

---

### D. Phase 3: "Event Management & Exhibitions" Industry Vertical
1. **Industry Identifier**: `'Event Management'` (with sub-types: `exhibitions_trade_fairs`, `corporate_conferences`, `wedding_social_events`).
2. **Dual Pipeline Architecture**:
   - **Pipeline A (Stall Booking / Exhibitors)**:
     `Lead Captured` ➔ `Floor Plan Shared` ➔ `Stall Blocked` ➔ `Quotation Sent` ➔ `Advance Paid` ➔ `Onboarded`
   - **Pipeline B (Corporate Sponsorship)**:
     `Prospecting` ➔ `Pitch Deck Sent` ➔ `Meeting Scheduled` ➔ `Custom Proposal Sent` ➔ `Contract Signed`
3. **Custom Lead Form Schema**:
   - **Exhibitors**: `companyName`, `exhibitorIndustry`, `stallSizeSqm`, `stallCategoryPreference` (*Shell Scheme, Raw Space, Premium Corner*), `pastParticipation` (Boolean).
   - **Attendees / Visitors**: `visitorType` (*Trade Buyer, Delegate, VIP, General Visitor*), `purposeOfVisit`.
4. **Product Catalog Default Seeding (`Project` model)**:
   - **Stall Spaces**:
     - *Shell Scheme Stall (9 sqm)* — Modular setup with carpet, fascia board, lights, and power socket.
     - *Raw Space Bare Plot (per sqm / 36 sqm min)* — Customized booth construction space.
     - *Premium 3-Side Open Island Stall (18 sqm)* — Prime front-aisle exhibitor placement.
   - **Sponsorship Packages**:
     - *Title Sponsor Package* — Keynote address, prime branding, lanyard logo, 10 VIP passes.
     - *Gold Sponsor Package* — Session sponsorship, entrance signage, 5 delegate passes.
     - *Silver Sponsor Package* — Badge logo, promotional insert, 2 passes.
   - **Add-on Rentals**:
     - *Extra Furniture & LED Display Kit*
     - *High-Power 3-Phase Electrical Supply (5kW)*
5. **Event-Driven Automation Hooks**:
   - **Event `stall.blocked`**: When a lead reaches `"Stall Blocked"`, locks the requested stall ID/number in `lead.customData.stallInventoryLock` and logs an activity notification.
   - **Event `attendee.onboarded`**: When a lead reaches `"Onboarded"` or `"Contract Signed"`, generates a digital Entry QR Access Pass and triggers automated WhatsApp dispatch with event venue instructions.

---

## 2. Implementation Strategy for Phases 2 & 3

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2 EXECUTION PLAN                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. BottomNav.js: Add dynamic user industryType detection.              │
│    - If Education: Show /catalogue ("Colleges & Courses"), Hide /projects.│
│    - If Non-Education: Show /projects ("Products & Packages"), Hide /catalogue.│
│ 2. Create /colleges/[id]/page.js: Full dedicated Next.js dynamic page  │
│    for college details, course catalog, custom tie-up rates & fees.     │
│ 3. Update /catalogue/page.js: Replace inline accordion with           │
│    router.push('/colleges/[id]').                                      │
│ 4. Mobile Responsiveness Pass: Audit globals.css, superadmin-dashboard,│
│    dashboard, and catalogue layouts for mobile-first breakpoints.      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 3 EXECUTION PLAN                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. backend/src/utils/industryTemplates.js:                            │
│    Add 'Event Management' templates with Dual Pipelines, Custom       │
│    Fields, and Default Event Product Catalog.                         │
│ 2. backend/src/models/TenantConfig.js:                                 │
│    Support 'Event Management' in industryType enum & seedWorkspace.    │
│ 3. backend/src/services/automationHandlers.js:                        │
│    Add handleStallInventoryLock and handleEventPassGeneration.         │
│ 4. Test Suite & Deployment:                                            │
│    Write backend/tests/event_management_vertical.test.js, run full     │
│    test suite, build frontend, push git commit, deploy to EC2.        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Execution Log & Verification (Phases 2 & 3 Completed)

### Phase 2: UI/UX Restoration & Catalogue Fixes
- ✅ **Navigation Deduplication (`BottomNav.js`)**: Dynamically reads `user.industryType`.
  - For **Education** users: Exclusively displays `/catalogue` (*"Colleges & Courses"*) and hides `/projects`.
  - For **Non-Education** users: Exclusively displays `/projects` (*"Products & Packages"*) and hides `/catalogue`.
- ✅ **Dedicated College Route (`/colleges/[id]/page.js` & `CollegeDetailClient.js`)**:
  - Removed clunky inline accordion in `catalogue/page.js`.
  - Clicking any college navigates to a dedicated, high-performance Next.js dynamic route (`/colleges/[id]`).
  - Features tabbed navigation: *Courses & Customized Fee Structures (with inline custom fee modal), Tie-Up / MOU Commission Details, and Campus Info*.
- ✅ **Mobile Responsiveness Pass**:
  - Refactored `superadmin-dashboard` header toolbars with mobile-first responsive flex wrapping and icon-first button labels.
  - Enhanced touch scrolling and horizontal overflow containment on tables and modal forms.

### Phase 3: "Event Management & Exhibitions" Industry Vertical
- ✅ **Dual Pipelines Added (`industryTemplates.js` & `TenantConfig.js`)**:
  - **Pipeline A (Stall Booking)**: `Lead Captured` ➔ `Floor Plan Shared` ➔ `Stall Blocked` ➔ `Quotation Sent` ➔ `Advance Paid` ➔ `Onboarded`
  - **Pipeline B (Corporate Sponsorship)**: `Prospecting` ➔ `Pitch Deck Sent` ➔ `Meeting Scheduled` ➔ `Custom Proposal Sent` ➔ `Contract Signed`
- ✅ **Exhibitor & Attendee Form Schemas**: Configured `companyName`, `exhibitorIndustry`, `stallSizeSqm`, `stallCategoryPreference`, `pastParticipation`, `visitorType`, `purposeOfVisit`.
- ✅ **Default Product Catalog Auto-Seeding**: Seeds 8 standard exhibition products into `Project` model on workspace initialization:
  - *Shell Scheme Stall (9 sqm)*, *Raw Space Bare Plot (36 sqm)*, *Premium 3-Side Open Island Stall (18 sqm)*, *Title Sponsor Package (₹15L)*, *Gold Sponsor Package (₹7.5L)*, *Silver Sponsor Package (₹3.5L)*, *Extra Furniture & LED Display*, *High-Power 3-Phase Electrical Supply*.
- ✅ **Event Automation Handlers (`automationHandlers.js`)**:
  - `handleStallInventoryLock`: Automatically locks stall floor plan inventory upon entering `"Stall Blocked"` and generates audit notification.
  - `handleEventPassGeneration`: Automatically generates digital Entry QR Access Code and WhatsApp ticket confirmation upon entering `"Onboarded"` or `"Contract Signed"`.

### Test & Deployment Status
- **Test Results**: All 9 Test Suites (130+ integration tests) passing 100%.
- **Build Status**: Next.js production build succeeded with 26/26 static/dynamic routes.
- **Git Push**: Commit `7912131` pushed to GitHub `origin main`.
- **AWS EC2 Production (`13.51.219.53`)**: PM2 service `crm-backend` (PID 75923) restarted and online. Live health check: `200 OK`.

---
*Status: Phase 1, Phase 2, and Phase 3 Fully Executed and Deployed Live.*
