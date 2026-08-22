'use client';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck, Lock, Server, Globe, Database, Smartphone,
  FileText, Clock, RefreshCw, CheckCircle2, ArrowLeft, Mail, ChevronRight
} from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = 'August 16, 2026';
  const effectiveDate = 'August 16, 2026';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" style={{ background: '#020617', color: '#f8fafc' }}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-decoration-none group">
            <Image
              src="/logo.png"
              alt="CoreSetu Logo"
              width={34}
              height={34}
              className="rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight block leading-none">
                CoreSetu <span className="text-indigo-400 font-semibold text-sm">SalesCRM</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                Privacy & Trust Center
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg shadow-md shadow-indigo-600/30 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 sm:px-8 border-b border-slate-800/60 bg-gradient-to-b from-indigo-950/30 via-slate-950 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-wide uppercase mb-6">
            <ShieldCheck size={14} className="text-indigo-400" />
            <span>Official Legal Document • SaaS Enterprise Standard</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight sm:leading-tight mb-4">
            Privacy Policy & Data Processing Charter
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            This Privacy Policy governs how CoreSetu collects, processes, encrypts, and retains data across our multi-tenant SalesCRM platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg">
              <Clock size={14} className="text-indigo-400" />
              <span>Last Updated: <strong className="text-slate-200">{lastUpdated}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-lg">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Effective Date: <strong className="text-slate-200">{effectiveDate}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-12 text-slate-300 text-sm sm:text-base leading-relaxed">

          {/* Section 1: Introduction & Definitions */}
          <section id="section-1" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                1. Introduction & Definitions
              </h2>
            </div>
            <p className="mb-4">
              CoreSetu Technologies (referred to herein as <strong>&ldquo;CoreSetu&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong>, or <strong>&ldquo;our&rdquo;</strong>) operates the CoreSetu SalesCRM multi-tenant Software-as-a-Service (SaaS) web application accessible via mobile and desktop browsers. We are committed to protecting the privacy, security, and integrity of all personal, transactional, and customer data entrusted to our infrastructure.
            </p>
            <p className="mb-4">
              To establish complete transparency, the following terms are defined:
            </p>
            <ul className="list-disc list-inside space-y-2.5 pl-2 text-slate-300">
              <li>
                <strong className="text-white">&ldquo;Platform&rdquo;</strong>: The CoreSetu SalesCRM web application, API servers, background synchronization engines, and associated digital services.
              </li>
              <li>
                <strong className="text-white">&ldquo;User&rdquo; or &ldquo;Tenant&rdquo;</strong>: The account holder, business owner, agency administrator, or designated sales representative who registers on the Platform to manage leads and communication workflows.
              </li>
              <li>
                <strong className="text-white">&ldquo;Leads&rdquo; or &ldquo;End-Customers&rdquo;</strong>: Prospective clients, buyers, or individuals whose contact coordinates (names, phone numbers, deal notes) are uploaded, imported, or synchronized by Tenants into their isolated CRM workspace.
              </li>
              <li>
                <strong className="text-white">&ldquo;Data Controller vs. Data Processor&rdquo;</strong>: Under applicable data protection frameworks, the Tenant acts as the <em>Data Controller</em> for all Lead records uploaded to their CRM workspace. CoreSetu operates strictly as the <em>Data Processor</em>, handling Lead information solely pursuant to the Tenant&rsquo;s direct instructions and software workflows.
              </li>
            </ul>
          </section>

          {/* Section 2: Data We Collect */}
          <section id="section-2" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                2. Information We Collect
              </h2>
            </div>
            <p className="mb-4">
              We collect information strictly necessary to provide reliable CRM capabilities, billing verification, and anti-fraud platform security. The categories of collected data comprise:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Lock size={16} className="text-indigo-400" /> A. Account & Authentication Data
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Full name, corporate email address, normalized mobile phone number, bcrypt-hashed passwords (raw passwords are never stored), unique Usercode handle, industry vertical classification, and Time-based One-Time Password (TOTP) two-factor authentication secrets.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Server size={16} className="text-emerald-400" /> B. Billing & Transaction Ledgers
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Razorpay payment attempt logs, order identifiers, mandate subscription IDs, transaction amounts in INR (paise), billing cycles, and cryptographic HMAC SHA256 signature verification checksums. <em>We do not store or process raw credit/debit card numbers or netbanking passwords on our servers.</em>
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-amber-400" /> C. CRM Lead & Interaction Data
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Prospect names, phone numbers, custom pipeline stages (e.g., New Lead, Follow-up, Closed), estimated deal valuations, interaction notes, custom dynamic form values, and catalog product assignments created by the Tenant.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <Globe size={16} className="text-cyan-400" /> D. Security Logs & Telemetry
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Client IP addresses, browser user-agent signatures, request timestamps, API rate-limiting metrics, and automated anti-fraud abuse detection logs (<code className="text-indigo-300">AbuseLog</code>) to prevent brute-force attacks and credential stuffing.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: WhatsApp Multi-Device & Baileys Processing */}
          <section id="section-3" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                3. How We Process WhatsApp Data
              </h2>
            </div>
            <p className="mb-4">
              Our WhatsApp Hub integrates multi-device WebSocket connectivity (via open-source Baileys socket libraries) to allow sales agents to send personalized templates, follow-up messages, and catalog brochures directly from their CRM dashboard.
            </p>
            
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-5 rounded-xl my-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                <Smartphone size={16} /> Strict Principles Governing WhatsApp Data:
              </h3>
              <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-300">
                <li>
                  <strong>Client-Authorized Pairing:</strong> We connect to WhatsApp servers strictly upon explicit user authentication (via QR scan or pairing code verification).
                </li>
                <li>
                  <strong>No Sale or Monetization of Messages:</strong> We never sell, rent, monetize, or disclose your WhatsApp message content, recipient lists, or chat histories to third-party data brokers or marketing aggregators.
                </li>
                <li>
                  <strong>CRM-Centric Processing:</strong> Messages and templates are processed solely for CRM routing, scheduled follow-up notifications, and lead inbox visualization.
                </li>
                <li>
                  <strong>90-Day Anti-Fraud Cooldown:</strong> To prevent spam farming and platform abuse, phone numbers associated with terminated or fraudulent accounts are recorded with an immutable cryptographic fingerprint (<code className="text-emerald-300">WAFingerprint</code>) and restricted from re-registering for 90 days.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Third-Party Sub-Processors */}
          <section id="section-4" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                4. Third-Party Sub-Processors
              </h2>
            </div>
            <p className="mb-4">
              CoreSetu partners with globally recognized infrastructure providers to deliver maximum availability, security, and scalability. All sub-processors adhere to rigorous data privacy and encryption benchmarks:
            </p>

            <div className="overflow-x-auto my-6">
              <table className="w-full text-left text-xs sm:text-sm border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-200">
                    <th className="p-3 font-bold">Sub-Processor</th>
                    <th className="p-3 font-bold">Role & Purpose</th>
                    <th className="p-3 font-bold">Location / Encryption</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-400">
                  <tr>
                    <td className="p-3 font-semibold text-white">Amazon Web Services (AWS EC2)</td>
                    <td className="p-3">Core application hosting, backend API execution, and background worker queues.</td>
                    <td className="p-3">AWS Secure Data Centers, TLS 1.3 in transit.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Cloudflare Pages & Edge CDN</td>
                    <td className="p-3">Frontend edge delivery, DDoS mitigation, DNS security, and SSL termination.</td>
                    <td className="p-3">Global Edge Network, Full SSL/TLS Encryption.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">MongoDB Atlas</td>
                    <td className="p-3">Cloud database management, isolated document storage, and automated transactional backups.</td>
                    <td className="p-3">AES-256 Encryption-at-Rest & in-transit.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Cloudinary</td>
                    <td className="p-3">Secure media asset storage, WebP image compression, and brochure hosting.</td>
                    <td className="p-3">Encrypted Cloud Storage & HTTPS Delivery.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Razorpay Payments</td>
                    <td className="p-3">PCI-DSS Level 1 compliant gateway for credit/debit card, UPI, and recurring subscription processing.</td>
                    <td className="p-3">PCI-DSS Certified, Zero raw card storage on CoreSetu.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Data Security & Multi-Tenant Isolation */}
          <section id="section-5" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                5
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                5. Data Security & Multi-Tenant Isolation
              </h2>
            </div>
            <p className="mb-4">
              CoreSetu enforces defense-in-depth architectural safeguards to eliminate unauthorized data access or cross-tenant contamination:
            </p>
            <ul className="list-disc list-inside space-y-2.5 pl-2 text-slate-300">
              <li>
                <strong className="text-white">Strict Multi-Tenant Logical Separation:</strong> All database collections (<code className="text-indigo-300">Leads</code>, <code className="text-indigo-300">Templates</code>, <code className="text-indigo-300">Projects</code>, <code className="text-indigo-300">Groups</code>) enforce mandatory multi-tenant scoping via <code className="text-indigo-300">userId</code> and <code className="text-indigo-300">companyId</code> compound indexes. Tenant A cannot query, view, or modify Tenant B&rsquo;s records under any circumstance.
              </li>
              <li>
                <strong className="text-white">Cryptographic Bearer Authentication:</strong> Requests require digitally signed JSON Web Tokens (JWT) verified on every API invocation.
              </li>
              <li>
                <strong className="text-white">HMAC SHA256 Gateway Verification:</strong> All payment callbacks and webhooks require raw-body HMAC SHA256 cryptographic verification against secret keys to prevent financial forgery.
              </li>
              <li>
                <strong className="text-white">Time-based One-Time Passwords (2FA TOTP):</strong> Optional two-factor authentication provides hardware/authenticator app protection against unauthorized login attempts.
              </li>
            </ul>
          </section>

          {/* Section 6: Retention, Grace Period & 60-Day Purge */}
          <section id="section-6" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                6
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                6. Data Lifecycle, Grace Period & 60-Day Auto-Deletion
              </h2>
            </div>
            <p className="mb-4">
              We retain CRM records only as long as an active subscription or legitimate business relationship exists. In the event of subscription expiration or non-renewal, our automated lifecycle engine executes the following protocol:
            </p>
            
            <div className="space-y-4 my-6">
              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">Stage 1</span>
                <div>
                  <h3 className="font-bold text-white text-sm">3-Day Non-Destructive Grace Period</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    When a recurring billing charge fails or an account lapses, the account enters a 3-day grace period (<code className="text-amber-300">GRACE_PERIOD</code>) allowing the tenant to update payment methods without interrupting customer communication.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold shrink-0">Stage 2</span>
                <div>
                  <h3 className="font-bold text-white text-sm">Account Lock (PLAN_LOCKED)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Following the 3-day grace window, account features and WhatsApp broadcasts are locked. CRM records remain safely preserved and encrypted pending account reactivation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="px-2.5 py-1 rounded bg-slate-700 text-slate-200 text-xs font-bold shrink-0">Stage 3</span>
                <div>
                  <h3 className="font-bold text-white text-sm">60-Day Permanent Purge (ARCHIVED)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    If an account remains in a locked/expired state for <strong>60 consecutive calendar days</strong>, the automated reconciliation engine marks the account as <code className="text-slate-300">ARCHIVED</code> and permanently purges all customer lead lists, campaign logs, and session tokens from production clusters. <em>Archived data cannot be restored.</em>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: User Rights & Data Portability */}
          <section id="section-7" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                7
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                7. User Rights & Data Portability
              </h2>
            </div>
            <p className="mb-4">
              As a CoreSetu tenant, you maintain full control over your business data:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>
                <strong>Data Portability & Export:</strong> You may export your entire customer lead database in structured Excel (.xlsx), CSV (.csv), or PDF formats at any time directly from the dashboard (subject to 90-day anti-churn tenure verification on annual plans).
              </li>
              <li>
                <strong>Right to Rectification:</strong> You can update personal profile information, regional currencies, phone codes, and custom CRM form schemas in real-time.
              </li>
              <li>
                <strong>Account Deletion:</strong> You may submit an explicit account erasure request by emailing <code className="text-indigo-300">support@coresetu.com</code>. Upon verification, all active records will be permanently removed within 30 business days.
              </li>
            </ul>
          </section>

          {/* Section 8: Cookies & Local Storage */}
          <section id="section-8" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                8
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                8. Cookies, Local Storage & PWA Caching
              </h2>
            </div>
            <p className="mb-4">
              CoreSetu does not utilize invasive third-party cross-site advertising cookies. We use essential local browser storage strictly for application operations:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300 text-xs sm:text-sm">
              <li>
                <strong className="text-white">JWT Session Storage:</strong> Encrypted authentication tokens stored in browser <code className="text-indigo-300">localStorage</code> to maintain authenticated sessions across page transitions.
              </li>
              <li>
                <strong className="text-white">PWA Service Worker (<code className="text-indigo-300">/sw.js</code>):</strong> Static asset caching to ensure rapid page load speeds on mobile networks and offline form resilience.
              </li>
            </ul>
          </section>

          {/* Section 9: Governing Law & Jurisdiction */}
          <section id="section-9" className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
                9
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                9. Legal Compliance & Jurisdiction
              </h2>
            </div>
            <p className="mb-3">
              This Privacy Policy is framed in accordance with the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong> (India), and general data protection principles governing enterprise SaaS platforms.
            </p>
            <p>
              Any disputes arising under this Privacy Policy shall be subject to the exclusive jurisdiction of the competent courts in India.
            </p>
          </section>

          {/* Section 10: Grievance Officer & Contact */}
          <section id="section-10" className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-sm">
                10
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                10. Grievance Officer & Inquiries
              </h2>
            </div>
            <p className="mb-4">
              If you have any questions, concerns, or grievances regarding this Privacy Policy or our data processing practices, please contact our designated Grievance & Compliance Officer:
            </p>

            <div className="bg-slate-950/90 border border-slate-800 p-5 rounded-xl text-xs sm:text-sm space-y-2">
              <p><strong className="text-white">Grievance & Privacy Officer:</strong> CoreSetu Legal & Compliance Team</p>
              <p><strong className="text-white">Entity:</strong> CoreSetu Technologies</p>
              <p><strong className="text-white">Email:</strong> <a href="mailto:privacy@coresetu.com" className="text-indigo-400 hover:underline">privacy@coresetu.com</a></p>
              <p><strong className="text-white">Support Desk:</strong> <a href="mailto:support@coresetu.com" className="text-indigo-400 hover:underline">support@coresetu.com</a></p>
              <p><strong className="text-white">Response Window:</strong> Within 48 business hours.</p>
            </div>
          </section>

        </div>

        {/* Back navigation & Footer */}
        <div className="mt-16 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold">
              <ArrowLeft size={14} /> Return to Home
            </Link>
            <span>•</span>
            <Link href="/terms" className="text-slate-400 hover:text-slate-200">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/data-deletion" className="text-slate-400 hover:text-slate-200">
              Data Deletion Instructions
            </Link>
          </div>
          <p>© {new Date().getFullYear()} CoreSetu Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
