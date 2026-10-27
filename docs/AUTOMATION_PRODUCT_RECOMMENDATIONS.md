# SAHYAK CRM — Automation Future Product Recommendations

**Document Version:** 1.0.0  
**Date:** October 27, 2026  
**Auditor / Product Roles:** Principal SaaS Product Architect, Senior UX Designer, Workflow Automation Specialist  
**Purpose:** Comprehensive architectural and product evaluation of advanced automation capabilities evaluated during the v2 redesign. These features are documented separately with trade-off analysis, complexity ratings, and priority phasing.

---

## 1. Summary of Evaluated Candidates

During the architectural redesign, several advanced workflow automation concepts were evaluated for potential user value against operational risk and codebase complexity. The core workflow engine, canonical registry, multi-action builder, and durable execution pipeline are now live and fully verified. 

The following items are recommended for subsequent product releases.

---

## 2. Detailed Recommendation Profiles

### Recommendation 1: Visual Drag-and-Drop Node Graph Canvas (React Flow / BPMN)
- **Feature Description:** An interactive node-based visual flowchart canvas allowing users to drag and connect triggers, condition diamonds, and action boxes on an infinite canvas.
- **User Problem Solved:** Visual representation of complex branched logic for enterprise administrators accustomed to tools like Zapier or Make.
- **Expected Business Value:** High perceived enterprise appeal during product demonstrations and marketing collateral.
- **Complexity:** **High**
- **Dependencies:** React Flow or similar canvas library, touch-event polyfills for mobile CRM users, complex graph serialization schemas.
- **Risks & Trade-offs:** High mobile friction (Sahyak CRM is designed for mobile-first and tablet-first counseling operations where node graphs are notoriously difficult to navigate on small screens), substantial bundle size increase, high maintenance overhead for edge routing and zoom states.
- **Recommended Priority:** **Medium**
- **Phasing Verdict:** **Can Wait (Phase 3 Enterprise Tier)**. The current 5-step guided wizard provides vastly superior usability for 95% of education and real estate sales teams, especially on mobile devices.

---

### Recommendation 2: Conditional If/Else Action Branching
- **Feature Description:** Splitting a workflow into distinct `If Condition Matches ➔ Do Action A` vs `Else ➔ Do Action B` branches within a single rule.
- **User Problem Solved:** Reduces the need to create two complementary automation rules (e.g. one for "Source is Meta Ads" and another for "Source is Not Meta Ads").
- **Expected Business Value:** High. Simplifies rule management for organizations with divergent nurture paths based on high vs low lead budgets.
- **Complexity:** **Medium**
- **Dependencies:** Schema update to support tree-structured action branches in `AutomationRule.actions`, recursion-depth validation, branching execution runner in `AutomationEngine`.
- **Risks & Trade-offs:** Potential for nested branching confusion if not visually constrained to a single depth level.
- **Recommended Priority:** **High**
- **Phasing Verdict:** **Next Milestone (v2.2)**. The existing condition evaluator (`evaluateConditions`) already supports all required boolean operators; introducing branch routing is straightforward once users become accustomed to multi-action workflows.

---

### Recommendation 3: WhatsApp Interactive Quick-Reply Buttons & Native Lists
- **Feature Description:** Sending native WhatsApp interactive list pickers and button menus directly through Meta Cloud API for candidate inquiries.
- **User Problem Solved:** Replaces text-based "Reply 1 for Fees, Reply 2 for Campus Visit" prompts with clickable button chips on WhatsApp.
- **Expected Business Value:** Very High. Significantly increases candidate engagement and response rates for admissions offices.
- **Complexity:** **Medium**
- **Dependencies:** Verified Meta WhatsApp Business Account (WABA) with approved interactive templates and active phone number webhook.
- **Risks & Trade-offs:** Meta WhatsApp Cloud API imposes strict schema requirements (max 3 quick reply buttons, 10 list items, 24-hour customer service window). If a client is using a Baileys WhatsApp Web QR connection instead of Meta Cloud API, button clicks cannot be parsed reliably.
- **Recommended Priority:** **High**
- **Phasing Verdict:** **Next Milestone (v2.2 - Feature Gate for Meta Cloud API tenants)**.

---

### Recommendation 4: Webhook Trigger (Inbound Generic Webhook Ingestion)
- **Feature Description:** Generating a unique webhook URL for an automation rule to accept JSON payloads from external landing page builders (e.g. Unbounce, Webflow, Typeform, Elementor).
- **User Problem Solved:** Enables users to connect custom landing pages directly to an automation rule without going through Google Sheets or Zapier.
- **Expected Business Value:** High. Decreases time-to-value for performance marketing teams running independent landing pages.
- **Complexity:** **Low - Medium**
- **Dependencies:** Public webhook router, API key / signature verification service, field mapping UI in builder step 1.
- **Risks & Trade-offs:** Requires rate-limiting and payload sanitization to prevent Denial-of-Service attacks or cross-tenant spam.
- **Recommended Priority:** **High**
- **Phasing Verdict:** **Needed Soon (v2.3)**.

---

### Recommendation 5: Execution Replay / Resend with Historical Payload Snapshot
- **Feature Description:** Allowing an admin to re-run an entire workflow against a historical lead using the exact snapshot of data captured at the time of the original execution.
- **User Problem Solved:** Diagnosing why a specific lead failed to receive an offer letter or welcome sequence 3 weeks ago.
- **Expected Business Value:** Medium. Reduces support ticket resolution time for customer operations teams.
- **Complexity:** **Medium**
- **Dependencies:** Persisting sanitized `inputSnapshot` in `AutomationLog` for every trigger event.
- **Risks & Trade-offs:** Increases database storage requirements for high-volume tenants. Must scrub PII and sensitive payment tokens from stored snapshots.
- **Recommended Priority:** **Low**
- **Phasing Verdict:** **Can Wait (v3.0)**. The current manual Retry endpoint (`POST /api/automations/logs/:logId/retry`) already solves 90% of operational recovery needs.

---

### Recommendation 6: Workflow Version History & Rollback
- **Feature Description:** Storing historical revisions of an automation rule each time it is edited, with a visual diff and 1-click restore.
- **User Problem Solved:** Reverting an accidental change made by a junior counselor or admin that broke active lead distribution.
- **Expected Business Value:** Medium. Essential for large enterprises with multiple team administrators.
- **Complexity:** **Medium**
- **Dependencies:** `AutomationRuleVersion` model, revision tracking middleware, diff viewer component.
- **Risks & Trade-offs:** Increased database storage and modal UI complexity.
- **Recommended Priority:** **Low**
- **Phasing Verdict:** **Can Wait (Enterprise Roadmap)**.

---

## 3. Prioritized Phasing Roadmap

| Feature | Complexity | Value | Recommended Version | Phasing |
|---|---|---|---|---|
| **Conditional If/Else Branching** | Medium | High | v2.2 | **Next Sprint** |
| **Interactive WhatsApp Buttons (Meta WABA)** | Medium | Very High | v2.2 | **Next Sprint** |
| **Inbound Custom Webhook Trigger** | Low-Medium | High | v2.3 | **Quarterly Release** |
| **Visual Flowchart Canvas (Desktop Only)** | High | Medium | v3.0 | **Can Wait** |
| **Execution Replay from Payload Snapshot** | Medium | Medium | v3.0 | **Can Wait** |
| **Rule Version History & Rollback** | Medium | Medium | Enterprise Tier | **Can Wait** |
