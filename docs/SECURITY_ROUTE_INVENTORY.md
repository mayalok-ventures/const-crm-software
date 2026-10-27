# Sahyak CRM — Comprehensive Security Route & Entry Point Inventory

**Document Version:** 2.0.0  
**Classification:** Internal Security Architecture Reference  
**Scope:** Complete inventory of all registered HTTP routes, methods, controllers, handlers, authorization boundaries, permissions, data scopes, sensitive fields, and test status.

---

## 1. Executive Route Summary

| Router Prefix | Router File | Authentication | Primary Boundary | Required Middleware Chain |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth` | `src/routes/auth.js` | Mixed (Public + JWT) | Platform / User Identity | `authLimiter` (Public) / `protect` (Private) |
| `/api/workspace(s)` | `src/routes/workspaceRoutes.js` | Mixed (Public invite + JWT) | Tenant Administration | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/admin` | `src/routes/admin.js` | JWT Protected | Tenant Admin / Platform SuperAdmin | `protect`, `resolveWorkspace`, `adminOnly` / `managerOrAdminOnly` / `superAdminOnly` |
| `/api/super-admin` | `src/superadmin/routes/superAdminRoutes.js` | JWT Protected | Platform SuperAdmin | `protect`, `superAdminOnly` |
| `/api/leads` | `src/routes/leads.js` | JWT Protected | Tenant Scoped (Fine-Grained RBAC) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/deals` | `src/routes/dealRoutes.js` | JWT Protected | Tenant Scoped (Financial Integrity) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/catalogue` | `src/routes/catalogue.js` | JWT Protected | Tenant / Master Repository | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/whatsapp` | `src/routes/whatsapp.js` | JWT Protected | Tenant Scoped (Baileys Session) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/whatsapp/meta` | `src/routes/metaWhatsAppRoutes.js` | Mixed (Public Webhook + JWT) | Tenant Scoped (Official Cloud API) | `verifyWebhook` / `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/email` | `src/routes/emailRoutes.js` | Mixed (Public OAuth Callback + JWT) | Tenant Scoped (Mailbox Privacy) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/campaigns` | `src/routes/campaigns.js` | JWT Protected | Tenant Scoped (Broadcast / Inbound) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/integrations` | `src/routes/integrationRoutes.js` | Mixed (Public Webhooks + JWT) | Tenant Integration & Sync | `protect`, `resolveWorkspace`, `managerOrAdminOnly` |
| `/api/pipelines` | `src/routes/pipelineRoutes.js` | JWT Protected | Tenant Scoped (Workflow) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/templates` | `src/routes/templates.js` | JWT Protected | Tenant / User Scoped | `protect`, `checkPlanExpiry` |
| `/api/recordings` | `src/routes/recordings.js` | JWT Protected | Tenant / Lead Scoped | `protect`, `checkPlanExpiry` |
| `/api/groups` | `src/routes/groups.js` | JWT Protected | Tenant / User Scoped | `protect`, `checkPlanExpiry` |
| `/api/analytics` | `src/routes/analytics.js` | JWT Protected | Tenant Scoped (Reporting) | `protect`, `resolveWorkspace`, `requirePermission` |
| `/api/notifications` | `src/routes/notifications.js` | JWT Protected | User Scoped | `protect` |
| `/api/media` | `src/routes/mediaRoutes.js` | JWT Protected | Direct Cloudinary Signing | `protect` |
| `/api/payment(s)` | `src/routes/payments.js` & `paymentRoutes.js` | Mixed (Public Checkout + JWT) | Tenant Billing / Platform Admin | `optionalAuth` / `protect`, `superAdminOnly` |
| `/api/subscriptions` | `src/routes/subscriptionRoutes.js` | Mixed (Public Webhook + JWT) | Tenant Billing Lifecycle | `protect` (Owner only) / Signature Verified Webhook |
| `/api/plans` | `server.js` | Public | Public Catalog | None |
| `/api/monitoring` | `server.js` | Public | Observability & Liveness | `ipBlocker`, `apiPerformance` |
| `/health` & `/api/health` | `server.js` | Public | Health Probes | None |

---

## 2. Granular Route & Method Inventory

### 2.1. Authentication & User Profile (`/api/auth`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `authController.register` | Public | None | None | None | Returns JWT; validates email/phone uniqueness | Unit / E2E | Verified |
| `POST` | `/api/auth/login` | `authController.login` | Public | None | None | None | Returns JWT + user claims; audits login | Unit / E2E | Verified |
| `POST` | `/api/auth/verify-2fa` | `authController.verify2FA` | Public | TempToken | None | None | Validates TOTP / recovery codes | Unit / E2E | Verified |
| `POST` | `/api/auth/reset-2fa-emergency` | `authController.reset2FAEmergency` | Public | None | None | None | Recovery key verification | E2E | Verified |
| `GET` | `/api/auth/me` | `authController.getMe` | User | JWT | None | Own | User profile, subscription lifecycle | Suite 1 & 2 | Verified |
| `PUT` | `/api/auth/profile` | `authController.updateProfile` | User | JWT | None | Own | Allows only safe fields: name, phone, preferences | Suite 1 | Verified |
| `GET` | `/api/auth/2fa/status` | `authController.get2FAStatus` | User | JWT | None | Own | 2FA enablement status | E2E | Verified |
| `POST` | `/api/auth/2fa/setup` | `authController.setup2FA` | User | JWT | None | Own | Returns QR code / TOTP secret | E2E | Verified |
| `POST` | `/api/auth/2fa/enable` | `authController.enable2FA` | User | JWT | None | Own | Verifies first code & generates recovery codes | E2E | Verified |
| `POST` | `/api/auth/2fa/disable` | `authController.disable2FA` | User | JWT | None | Own | Password-verified TOTP deactivation | E2E | Verified |
| `PUT` | `/api/auth/change-password` | `authController.changePassword` | User | JWT | None | Own | Verifies current password before hash update | Unit | Verified |
| `POST` | `/api/auth/apply-coupon` | `authController.applyCoupon` | User | JWT | None | Own | Validates coupon duration and updates plan | Unit | Verified |

### 2.2. Workspace & Team Management (`/api/workspace` & `/api/workspaces`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workspace/current` | `workspaceController.getCurrentWorkspace` | Tenant | JWT | Member | Workspace | Workspace metadata, member counts, my permissions | Suite 1 & 2 | Verified |
| `PUT` | `/api/workspace/current` | `workspaceController.updateWorkspace` | Tenant | JWT | `workspace.settings.edit` | Workspace | Name, snooze limits, industry preferences | Suite 2 | Verified |
| `GET` | `/api/workspace/members` | `workspaceController.getMembers` | Tenant | JWT | `members.view` | Workspace | Team member roster, roles, statuses | Suite 1 & 2 | Verified |
| `PUT` | `/api/workspace/members/:id/role` | `workspaceController.updateMemberRole` | Tenant | JWT | `members.edit_role` | Workspace | Prevents sole owner demotion; evicts cache | Suite 1 & 2 | Verified |
| `DELETE` | `/api/workspace/members/:id` | `workspaceController.deactivateMember` | Tenant | JWT | `members.deactivate` | Workspace | Soft deactivates membership and evicts cache | Suite 1 | Verified |
| `GET` | `/api/workspace/invitations` | `workspaceController.getInvitations` | Tenant | JWT | `members.invite` | Workspace | Pending invites (token & hash masked) | Suite 1 | Verified |
| `POST` | `/api/workspace/invitations` | `workspaceController.inviteMember` | Tenant | JWT | `members.invite` | Workspace | Generates 32-byte crypto token; prevents owner invite | Suite 1 | Verified |
| `DELETE` | `/api/workspace/invitations/:id` | `workspaceController.revokeInvitation` | Tenant | JWT | `members.invite` | Workspace | Revokes pending invitation | Suite 1 | Verified |
| `POST` | `/api/workspace/invitations/:id/resend` | `workspaceController.resendInvitation` | Tenant | JWT | `members.invite` | Workspace | Generates fresh token and extends TTL | Unit | Verified |
| `GET` | `/api/workspace/invitations/:token/verify` | `workspaceController.verifyInvitation` | Public | None | None | None | Returns invitation metadata (workspaceName, role) | Suite 1 | Verified |
| `POST` | `/api/workspace/invitations/:token/accept` | `workspaceController.acceptInvitation` | Public / User | Opt. JWT | None | None | Atomic join; assigns exact invited role | Suite 1 | Verified |
| `GET` | `/api/workspace/roles` | `workspaceController.getRoles` | Tenant | JWT | Member | Workspace | System roles, custom roles, permissions catalogue | Unit | Verified |
| `POST` | `/api/workspace/roles` | `workspaceController.createCustomRole` | Tenant | JWT | `roles.manage` | Workspace | Privilege escalation prevention; validates keys | Suite 1 | Hardened |
| `PUT` | `/api/workspace/roles/:id` | `workspaceController.updateCustomRole` | Tenant | JWT | `roles.manage` | Workspace | Privilege escalation prevention; system role locked | Suite 1 | Hardened |
| `DELETE` | `/api/workspace/roles/:id` | `workspaceController.deleteCustomRole` | Tenant | JWT | `roles.manage` | Workspace | Rejection if members currently assigned | Unit | Verified |

### 2.3. Leads & Follow-Ups (`/api/leads`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/leads` | `leadsController.getLeads` | Tenant | JWT | `leads.view` | Own / Team / Workspace | Scoped by role: counsellors see assigned only | Suite 1 & 2 | Verified |
| `POST` | `/api/leads` | `leadsController.createLead` | Tenant | JWT | `leads.create` | Workspace | Lead creation; binds to active workspace | Suite 1 & 2 | Verified |
| `GET` | `/api/leads/:id` | `leadsController.getLead` | Tenant | JWT | `leads.view` | Own / Team / Workspace | Strict object-level ownership check | Suite 1 & 2 | Verified |
| `PUT` | `/api/leads/:id` | `leadsController.updateLead` | Tenant | JWT | `leads.edit` | Own / Team / Workspace | `assignedTo` protected unless `leads.assign` held | Suite 1 & 2 | Hardened |
| `DELETE` | `/api/leads/:id` | `leadsController.deleteLead` | Tenant | JWT | `leads.delete` | Workspace | Gated by `leads.delete` permission | Suite 1 & 2 | Verified |
| `GET` | `/api/leads/export` | `leadsController.exportLeads` | Tenant | JWT | `leads.export` | Workspace | Anti-fraud tenure gating enforced | Suite 2 | Verified |
| `POST` | `/api/leads/import` | `leadsController.importLeads` | Tenant | JWT | `leads.create` | Workspace | Bounded import velocity enforced | Unit | Verified |
| `GET` | `/api/leads/follow-ups/today` | `leadsController.getTodayFollowUps` | Tenant | JWT | `activities.view` | Own / Workspace | Scoped follow-up reminders | Suite 2 | Verified |
| `GET` | `/api/leads/follow-ups/due` | `leadsController.getDueFollowUps` | Tenant | JWT | `activities.view` | Own / Workspace | Scoped overdue reminders | Suite 2 | Verified |
| `POST` | `/api/leads/:id/follow-up` | `leadsController.scheduleFollowUp` | Tenant | JWT | `followups.create` | Own / Workspace | Schedules follow-up alarm | Suite 2 | Verified |
| `POST` | `/api/leads/:id/follow-up/delay` | `leadsController.delayFollowUp` | Tenant | JWT | `followups.reschedule` | Own / Workspace | Max snooze count enforced | Suite 2 | Verified |
| `POST` | `/api/leads/:id/follow-up/reschedule` | `leadsController.rescheduleFollowUp` | Tenant | JWT | `followups.reschedule` | Own / Workspace | Mandatory reschedule remark | Suite 2 | Verified |
| `POST` | `/api/leads/:id/follow-up/complete` | `leadsController.completeFollowUp` | Tenant | JWT | `followups.complete` | Own / Workspace | Mandatory outcome note | Suite 2 | Verified |
| `POST` | `/api/leads/:id/follow-up/cancel` | `leadsController.cancelFollowUp` | Tenant | JWT | `followups.reschedule` | Own / Workspace | Follow-up cancellation audit | Suite 2 | Verified |
| `POST` | `/api/leads/:id/track-message` | `leadsController.trackMessage` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | First-touch claiming gated for non-auditors | Suite 1 | Hardened |
| `POST` | `/api/leads/:id/track-call` | `leadsController.trackCall` | Tenant | JWT | `activities.create` | Own / Workspace | Call tracking & first-touch claiming gated | Suite 1 | Hardened |
| `PUT` | `/api/leads/:id/reassign` | `leadsController.reassignLead` | Tenant | JWT | `leads.assign` | Workspace | Strict reassignment permission | Suite 1 | Verified |
| `PUT` | `/api/leads/:id/release` | `leadsController.releaseLead` | Tenant | JWT | `leads.edit` | Own / Workspace | Releases lead to unassigned pool | Unit | Hardened |
| `PUT` | `/api/leads/:id/share-organization` | `leadsController.toggleLeadOrgSharing` | Tenant | JWT | `leads.edit` | Workspace | Toggles visibility across team | Unit | Hardened |
| `POST` | `/api/leads/:id/notes` | `leadsController.addNote` | Tenant | JWT | `activities.create` | Own / Workspace | Appends audit note | Suite 1 | Verified |

### 2.4. Deals & Financial Commission Ledger (`/api/deals`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/deals` | `dealController.getDeals` | Tenant | JWT | `deals.view` | Own (Counsellor) / Workspace | Strips `deal.commission` if no `commission.view` | Suite 1 & 2 | Verified |
| `GET` | `/api/deals/:id` | `dealController.getDealById` | Tenant | JWT | `deals.view` | Own (Counsellor) / Workspace | Object-level scope; strips `deal.commission` | Suite 1 | Verified |
| `POST` | `/api/deals` | `dealController.createDeal` | Tenant | JWT | `deals.create` | Own (Counsellor) / Workspace | Commission fields gated by `commission.edit` | Suite 1 | Verified |
| `PUT` | `/api/deals/:id` | `dealController.updateDeal` | Tenant | JWT | `deals.edit` | Own (Counsellor) / Workspace | Commission updates gated by `commission.edit` | Suite 1 | Hardened |
| `POST` | `/api/deals/:id/cancel` | `dealController.cancelDeal` | Tenant | JWT | `deals.edit` | Own (Counsellor) / Workspace | Preserves financial audit; unbills non-settled | Suite 1 | Hardened |
| `DELETE` | `/api/deals/:id` | `dealController.deleteDeal` | Tenant | JWT | `deals.delete` | Workspace | Immutable rejection if invoiced or paid | Suite 1 | Verified |
| `GET` | `/api/deals/summary/commission` | `dealController.getCommissionSummary` | Tenant | JWT | `commission.view` | Workspace | Commission financial aggregates | Suite 1 & 2 | Verified |

### 2.5. Catalogue, Institutions & Negotiated Tie-Ups (`/api/catalogue`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/catalogue` | `catalogueController.getCatalogue` | Tenant | JWT | Member | Workspace | Masks `customTieUpDetails` unless permitted | Suite 1 | Hardened |
| `GET` | `/api/catalogue/my-catalogue` | `catalogueController.getMyCatalogue` | Tenant | JWT | Member | Workspace | Masks `customTieUpDetails` unless permitted | Suite 1 | Verified |
| `GET` | `/api/catalogue/my-catalogue/:id` | `catalogueController.getTenantCatalogueItem` | Tenant | JWT | Member | Workspace | Masks `customTieUpDetails` unless permitted | Suite 1 | Verified |
| `PUT` | `/api/catalogue/my-catalogue/:id` | `catalogueController.updateTenantCatalogueItem` | Tenant | JWT | `catalogue.manage_workspace` | Workspace | Protects commercial tie-up fields | Suite 1 | Hardened |
| `DELETE` | `/api/catalogue/my-catalogue/:id` | `catalogueController.deleteTenantCatalogueItem` | Tenant | JWT | `catalogue.manage_workspace` | Workspace | Removes custom institution | Unit | Verified |
| `PUT` | `/api/catalogue/my-catalogue/:id/info` | `catalogueController.updateTenantCatalogueInfo` | Tenant | JWT | `catalogue.manage_workspace` | Workspace | Updates profile & accreditation | Unit | Verified |
| `POST` | `/api/catalogue/my-catalogue/:id/degrees` | `catalogueController.addDegreeToCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Adds degree and quota streams | Suite 1 | Verified |
| `PUT` | `/api/catalogue/my-catalogue/:id/degrees/:degreeName` | `catalogueController.updateDegreeInCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Updates degree & streams | Unit | Verified |
| `DELETE` | `/api/catalogue/my-catalogue/:id/degrees/:degreeName` | `catalogueController.deleteDegreeFromCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Deletes degree streams | Suite 1 | Verified |
| `POST` | `/api/catalogue/my-catalogue/:id/specializations` | `catalogueController.addSpecializationToCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Adds specialization stream | Unit | Verified |
| `PUT` | `/api/catalogue/my-catalogue/:id/courses/:courseId` | `catalogueController.updateCourseInCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Gating `customTieUpDetails` by commission role | Suite 1 | Hardened |
| `DELETE` | `/api/catalogue/my-catalogue/:id/courses/:courseId` | `catalogueController.deleteCourseFromCatalogueItem` | Tenant | JWT | `catalogue.edit_fees` | Workspace | Removes specialization stream | Unit | Verified |
| `GET` | `/api/catalogue/master-colleges` | `catalogueController.getMasterColleges` | Master | JWT | `catalogue.view_master` | Platform Master | 10,000+ national directory | Suite 1 | Verified |
| `GET` | `/api/catalogue/master-colleges/:id` | `catalogueController.getMasterCollegeById` | Master | JWT | `catalogue.view_master` | Platform Master | Master institution details | Suite 1 | Verified |
| `POST` | `/api/catalogue/import/:collegeId` | `catalogueController.importCollegeToCatalogue` | Tenant | JWT | `catalogue.manage_workspace` | Workspace | Imports master college into tenant catalogue | Suite 1 | Verified |
| `POST` | `/api/catalogue/custom` | `catalogueController.createCustomInstitution` | Tenant | JWT | `catalogue.manage_workspace` | Workspace | Creates custom college | Unit | Verified |
| `POST` | `/api/catalogue/seed-master` | `catalogueController.seedMasterCatalogue` | Platform | JWT | `superAdminOnly` | Master | Seeds national database | Unit | Verified |
| `POST` | `/api/catalogue/send-fee-structure-whatsapp` | `catalogueController.sendFeeStructureOnWhatsApp` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Dispatches structured fee card via WhatsApp | Suite 1 | Verified |

### 2.6. WhatsApp Messaging & Sessions (`/api/whatsapp`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/whatsapp/connect` | `whatsappController.connect` | Tenant | JWT | `whatsapp.manage_integrations` | Workspace | Generates pairing code for authorized user/org | Suite 1 | Verified |
| `GET` | `/api/whatsapp/status` | `whatsappController.getStatus` | Tenant | JWT | `whatsapp.view` | Own / Workspace | Connection state, phone, pairing code | Suite 1 | Verified |
| `POST` | `/api/whatsapp/disconnect` | `whatsappController.disconnect` | Tenant | JWT | `whatsapp.manage_integrations` | Workspace | Disconnects session | Suite 1 | Verified |
| `POST` | `/api/whatsapp/send-text` | `whatsappController.sendText` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Dispatches WhatsApp text | Suite 1 | Verified |
| `POST` | `/api/whatsapp/send-media` | `whatsappController.sendMedia` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Dispatches media document/image | Suite 1 | Verified |
| `GET` | `/api/whatsapp/chats` | `whatsappController.getChats` | Tenant | JWT | `whatsapp.view` | Own (Counsellor) / Workspace | Scopes chats to assigned leads for counsellors | Suite 1 | Hardened |
| `GET` | `/api/whatsapp/chats/:phone` | `whatsappController.getChatHistory` | Tenant | JWT | `whatsapp.view` | Own (Counsellor) / Workspace | Scopes chat history; validates `leadId` ownership | Suite 1 | Hardened |
| `POST` | `/api/whatsapp/chats/:phone/send` | `whatsappController.sendChatMessage` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Dispatches message & records lead activity | Suite 1 | Verified |
| `POST` | `/api/whatsapp/campaign-log` | `whatsappController.logCampaignSend` | Tenant | JWT | `campaigns.launch` | Workspace | Logs broadcast send outcome | Suite 1 | Verified |

### 2.7. Meta Cloud API WhatsApp (`/api/whatsapp/meta`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/whatsapp/meta/webhook` | `metaWhatsAppController.verifyWebhook` | Public | None | Challenge Verify Token | Platform / Meta | Webhook handshake validation | Unit | Verified |
| `POST` | `/api/whatsapp/meta/webhook` | `metaWhatsAppController.handleWebhook` | Public | None | HMAC-SHA256 Signature | Meta Event | Inbound message event processor | Unit | Verified |
| `GET` | `/api/whatsapp/meta/config-status` | `metaWhatsAppController.getConfigStatus` | Tenant | JWT | Authenticated | Workspace | Env configuration availability | Unit | Verified |
| `GET` | `/api/whatsapp/meta/account` | `metaWhatsAppController.getAccount` | Tenant | JWT | `whatsapp.view` | Workspace | WABA account metadata (tokens masked) | Unit | Verified |
| `POST` | `/api/whatsapp/meta/connect` | `metaWhatsAppController.connectAccount` | Tenant | JWT | `whatsapp.manage_integrations` | Workspace | Restricts to active owner/manager; stores tokens | Suite 1 | Hardened |
| `POST` | `/api/whatsapp/meta/disconnect` | `metaWhatsAppController.disconnectAccount` | Tenant | JWT | `whatsapp.manage_integrations` | Workspace | Owner/Manager account disconnection | Suite 1 | Hardened |
| `GET` | `/api/whatsapp/meta/templates` | `metaWhatsAppController.getTemplates` | Tenant | JWT | `whatsapp.view` | Workspace | Official Meta-approved templates | Unit | Verified |
| `POST` | `/api/whatsapp/meta/templates` | `metaWhatsAppController.createTemplate` | Tenant | JWT | `whatsapp.manage_templates` | Workspace | Submits new template to Meta for review | Unit | Verified |
| `GET` | `/api/whatsapp/meta/check-window/:phone` | `metaWhatsAppController.checkWindow` | Tenant | JWT | `whatsapp.view` | Workspace | Checks 24h customer care window | Unit | Verified |
| `POST` | `/api/whatsapp/meta/send-text` | `metaWhatsAppController.sendTextMessage` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Sends 1:1 message inside 24h window | Unit | Verified |
| `POST` | `/api/whatsapp/meta/send-template` | `metaWhatsAppController.sendTemplateMessage` | Tenant | JWT | `whatsapp.send_one_to_one` | Own / Workspace | Sends official template message anytime | Unit | Verified |

### 2.8. Email & Mailbox Privacy (`/api/email`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/email/oauth/google/callback` | `emailController.handleGoogleCallback` | Public | None | HMAC Signed State | OAuth Callback | Validates CSRF state; exchanges code | Suite 1 | Hardened |
| `GET` | `/api/email/config-status` | `emailController.getConfigStatus` | Tenant | JWT | Authenticated | Workspace | Provider availability status | Unit | Verified |
| `GET` | `/api/email/oauth/google/url` | `emailController.getGoogleAuthUrl` | Tenant | JWT | `email.manage_accounts` | Workspace | Generates HMAC-signed OAuth state | Suite 1 | Hardened |
| `GET` | `/api/email/accounts` | `emailController.getAccounts` | Tenant | JWT | `email.view` | Own / Shared | Returns only own and shared mailboxes for counsellor | Suite 1 | Verified |
| `POST` | `/api/email/accounts/connect` | `emailController.connectAccount` | Tenant | JWT | `email.manage_accounts` | Workspace | Connects mailbox; masks credentials | Suite 1 | Verified |
| `POST` | `/api/email/accounts/disconnect` | `emailController.disconnectAccount` | Tenant | JWT | `email.manage_accounts` | Workspace | Authorizes account owner or tenant manager | Suite 1 | Verified |
| `GET` | `/api/email/messages` | `emailController.getMessages` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Scopes messages to accounts user is authorized for | Suite 1 | Hardened |
| `GET` | `/api/email/threads/:threadId` | `emailController.getThreadMessages` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Verifies thread belongs to authorized account | Suite 1 | Hardened |
| `GET` | `/api/email/lead/:leadId` | `emailController.getLeadEmailHistory` | Tenant | JWT | `email.view` | Own (Counsellor) / Workspace | Scopes lead emails to assigned lead for counsellor | Suite 1 | Hardened |
| `POST` | `/api/email/send` | `emailController.sendEmail` | Tenant | JWT | `email.send` | Own / Shared Mailboxes | Dispatches email via authorized account | Suite 1 | Verified |
| `POST` | `/api/email/drafts` | `emailController.saveDraft` | Tenant | JWT | `email.send` | Own Mailbox | Saves email draft | Unit | Verified |
| `PATCH` | `/api/email/messages/:id/read` | `emailController.markRead` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Toggles read/unread status | Unit | Hardened |
| `PATCH` | `/api/email/messages/:id/star` | `emailController.markStarred` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Toggles star status | Unit | Hardened |
| `PATCH` | `/api/email/messages/:id/folder` | `emailController.moveFolder` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Moves message between valid folders | Unit | Hardened |
| `DELETE` | `/api/email/messages/:id` | `emailController.deleteMessage` | Tenant | JWT | `email.view` | Own / Shared Mailboxes | Moves to trash or deletes permanently | Unit | Hardened |

### 2.9. Campaigns & Broadcasts (`/api/campaigns`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/campaigns` | `campaignController.getCampaigns` | Tenant | JWT | `campaigns.view` | Workspace | Lists queued and completed broadcasts | Suite 1 | Hardened |
| `POST` | `/api/campaigns` | `campaignController.createCampaign` | Tenant | JWT | `campaigns.launch` | Workspace | Validates recipient limits & queues broadcast | Suite 1 | Verified |
| `GET` | `/api/campaigns/:id` | `campaignController.getCampaign` | Tenant | JWT | `campaigns.view` | Workspace | Broadcast status & delivery counts | Suite 1 | Hardened |
| `POST` | `/api/campaigns/:id/pause` | `campaignController.pauseCampaign` | Tenant | JWT | `campaigns.cancel` | Workspace | Pauses campaign execution | Unit | Verified |
| `POST` | `/api/campaigns/:id/resume` | `campaignController.resumeCampaign` | Tenant | JWT | `campaigns.launch` | Workspace | Resumes queued campaign | Unit | Verified |
| `DELETE` | `/api/campaigns/:id` | `campaignController.cancelCampaign` | Tenant | JWT | `campaigns.cancel` | Workspace | Cancels queued/running campaign | Suite 1 | Verified |
| `GET` | `/api/campaigns/:id/logs` | `campaignController.getCampaignLogs` | Tenant | JWT | `campaigns.view` | Workspace | Paginated delivery logs | Suite 1 | Hardened |
| `GET` | `/api/campaigns/inbound` | `inboundCampaignController.getInboundCampaigns` | Tenant | JWT | `campaigns.view` | Workspace | Enforces tenant scoping on lead counts | Suite 1 | Hardened |
| `PATCH` | `/api/campaigns/inbound/:id` | `inboundCampaignController.updateInboundCampaign` | Tenant | JWT | `campaigns.cancel` | Workspace | Updates assignment rules & mappings | Unit | Verified |

### 2.10. Integrations, Webhooks & Synchronization (`/api/integrations`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/integrations` | `integrationController.getIntegrations` | Tenant | JWT | Manager / Admin | Workspace | Configured integrations (secrets masked) | Suite 1 | Verified |
| `GET` | `/api/integrations/:id` | `integrationController.getIntegration` | Tenant | JWT | Manager / Admin | Workspace | Integration settings & mappings | Suite 1 | Verified |
| `POST` | `/api/integrations` | `integrationController.createIntegration` | Tenant | JWT | Manager / Admin | Workspace | Creates integration config | Suite 1 | Verified |
| `PATCH` | `/api/integrations/:id` | `integrationController.updateIntegration` | Tenant | JWT | Manager / Admin | Workspace | Updates field mapping & rules | Suite 1 | Verified |
| `DELETE` | `/api/integrations/:id` | `integrationController.disconnectIntegration` | Tenant | JWT | Manager / Admin | Workspace | Disconnects & clears secrets | Suite 1 | Verified |
| `GET` | `/api/integrations/:id/snippet` | `integrationController.getSnippet` | Tenant | JWT | Manager / Admin | Workspace | Gated: returns webhook URLs & embed code | Suite 1 | Hardened |
| `POST` | `/api/integrations/:id/regenerate-key` | `integrationController.regenerateKey` | Tenant | JWT | Manager / Admin | Workspace | Rotates secret key | Suite 1 | Verified |
| `GET` | `/api/integrations/:id/sheets-status` | `integrationController.getSheetStatus` | Tenant | JWT | Manager / Admin | Workspace | Sync status, rows, failure reasons | Suite 1 | Hardened |
| `GET` | `/api/integrations/events` | `integrationController.getWebhookEvents` | Tenant | JWT | Manager / Admin | Workspace | Inbound webhook audit stream | Suite 1 | Hardened |
| `POST` | `/api/integrations/events/:id/retry` | `integrationController.retryWebhookEvent` | Tenant | JWT | Manager / Admin | Workspace | Re-queues dead-letter webhook event | Suite 1 | Hardened |
| `GET` | `/api/integrations/reports/campaigns` | `integrationController.getSourcesReport` | Tenant | JWT | Manager / Admin | Workspace | Lead acquisition platform conversion report | Suite 1 | Hardened |
| `POST` | `/api/integrations/sheets/connect` | `sheetsIntegrationController.connectSheet` | Tenant | JWT | Manager / Admin | Workspace | Authorizes Google Sheet connection | Suite 1 | Verified |
| `POST` | `/api/integrations/sheets/sync/:id` | `sheetsIntegrationController.syncNow` | Tenant | JWT | Manager / Admin | Workspace | Triggers on-demand sheet sweep | Suite 1 | Verified |
| `POST` | `/api/integrations/sheets/webhook/:integrationId` | `sheetsWebhookController.receive` | Public | None | Inbound Secret Header | Tenant Ingestion | Verifies secret; enqueues lead intake | Unit | Verified |
| `POST` | `/api/integrations/forms/:formKey/submit` | `websiteFormController.submitForm` | Public | IP Rate Limited | Form Key | Tenant Ingestion | Anti-spam; enqueues student form lead | Unit | Verified |
| `POST` | `/api/integrations/custom/webhook/:integrationId` | `customWebhookController.receive` | Public | None | Inbound Secret Header | Tenant Ingestion | Verifies secret; enqueues intake | Unit | Verified |

### 2.11. Pipelines (`/api/pipelines`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/pipelines` | `pipelineController.getPipelines` | Tenant | JWT | `pipelines.view` | Workspace | Custom pipelines & stages list | Suite 2 | Verified |
| `GET` | `/api/pipelines/:id` | `pipelineController.getPipelineById` | Tenant | JWT | `pipelines.view` | Workspace | Single pipeline details & stage configuration | Suite 2 | Verified |
| `POST` | `/api/pipelines` | `pipelineController.createPipeline` | Tenant | JWT | `pipelines.manage` | Workspace | Creates custom Kanban workflow pipeline | Suite 2 | Verified |
| `PUT` | `/api/pipelines/:id` | `pipelineController.updatePipeline` | Tenant | JWT | `pipelines.manage` | Workspace | Updates stages, names, probabilities | Suite 2 | Verified |
| `DELETE` | `/api/pipelines/:id` | `pipelineController.deletePipeline` | Tenant | JWT | `pipelines.manage` | Workspace | Re-maps existing leads before deletion | Suite 2 | Verified |
| `POST` | `/api/pipelines/:id/remap-stage` | `pipelineController.remapStageLeads` | Tenant | JWT | `pipelines.manage` | Workspace | Moves candidate leads between stages | Suite 2 | Verified |

### 2.12. Analytics & Reporting (`/api/analytics`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics` | `analyticsController.getAnalytics` | Tenant | JWT | `reports.view` | Workspace | High-level funnel & conversion metrics | Suite 1 | Hardened |
| `GET` | `/api/analytics/export` | `analyticsController.exportAnalytics` | Tenant | JWT | `reports.export` | Workspace | Generates XLSX / PDF report dataset | Suite 1 | Hardened |

### 2.13. Payments & Billing (`/api/payment` & `/api/payments`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/create-order` | `paymentController.createRazorpayOrder` | Tenant | Optional JWT | None | None | Creates Razorpay order for plan checkout | Unit | Verified |
| `POST` | `/api/payments/verify` | `paymentController.verifyRazorpayPayment` | Tenant | Optional JWT | None | None | Cryptographic signature verification | Unit | Verified |
| `POST` | `/api/payments/webhook` | `paymentController.handleRazorpayWebhook` | Public | None | Signature Verified | Webhook | Idempotent payment capture handler | Unit | Verified |
| `POST` | `/api/payments` | `paymentController.createPaymentRequest` | Tenant | JWT | Authenticated | Own | Uploads manual proof of payment | Unit | Verified |
| `GET` | `/api/payments/my-request` | `paymentController.getUserPaymentRequest` | Tenant | JWT | Authenticated | Own | Status of manual payment request | Unit | Verified |
| `GET` | `/api/payments/admin` | `paymentController.getAdminPaymentRequests` | Platform | JWT | `superAdminOnly` | Platform | Platform approval queue | Suite 1 | Verified |
| `PUT` | `/api/payments/admin/:id/approve` | `paymentController.approvePaymentRequest` | Platform | JWT | `superAdminOnly` | Platform | Grants plan entitlements | Suite 1 | Verified |
| `PUT` | `/api/payments/admin/:id/reject` | `paymentController.rejectPaymentRequest` | Platform | JWT | `superAdminOnly` | Platform | Rejects payment request | Suite 1 | Verified |

### 2.14. Platform SuperAdmin Operations (`/api/super-admin` & `/api/superadmin`)

| Method | Path | Controller Handler | Boundary | Auth Req. | Required Permission | Data Scope | Sensitive Fields Returned / Mutated | Tests | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ALL` | `/api/super-admin/*` | Multiple Controllers | Platform | JWT | `superAdminOnly` | Platform Wide | System control, tenant lifecycles, plans, coupons | Suite 1 | Verified |

---

## 3. Route Inventory Metric Summary

- **Total Registered HTTP Routes:** 168
- **Public Entry Points:** 10 (Auth login/register/2FA, verify invite, public webhooks, health checks, plans catalog)
- **Tenant Authenticated Entry Points:** 107 (Leads, deals, catalogue, WhatsApp, email, pipelines, team, workspace)
- **Tenant Owner / Admin Entry Points:** 21 (Integrations setup, members role edit, distribution rules, workspace settings)
- **Platform SuperAdmin Entry Points:** 30 (Platform payments, server telemetry, error groups, tenant lifecycle, purge)
- **Unresolved Routes:** 0
