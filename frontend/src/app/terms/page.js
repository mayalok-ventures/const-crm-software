'use client';
import Link from 'next/link';
import Image from 'next/image';
import {
  FileText, ShieldCheck, Scale, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, RefreshCw, Smartphone, CreditCard
} from 'lucide-react';

export default function TermsOfServicePage() {
  const lastUpdated = 'August 16, 2026';
  const effectiveDate = 'August 16, 2026';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" style={{ background: '#020617', color: '#f8fafc' }}>
      {/* Header */}
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
                Terms of Service
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
            <Scale size={14} className="text-indigo-400" />
            <span>Enterprise SaaS User Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Terms of Service & Subscription Agreement
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Please read these Terms of Service carefully before utilizing CoreSetu SalesCRM. By creating an account or accessing the platform, you agree to be bound by this agreement.
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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-10 text-slate-300 text-sm sm:text-base leading-relaxed">

          {/* Section 1 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              1. Acceptance of Terms & Subscription Scope
            </h2>
            <p className="mb-3">
              By accessing, browsing, registering for, or using CoreSetu SalesCRM (the &ldquo;Service&rdquo;), operated by CoreSetu Technologies (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), you (&ldquo;Customer&rdquo;, &ldquo;Tenant&rdquo;, or &ldquo;User&rdquo;) agree to be legally bound by these Terms of Service.
            </p>
            <p>
              If you are accepting these terms on behalf of a company, organization, or agency, you represent and warrant that you possess full legal authority to bind said entity to these conditions.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              2. User Accounts & Multi-Tenant Boundaries
            </h2>
            <ul className="list-disc list-inside space-y-2 text-slate-300 pl-2">
              <li>
                <strong>Individual vs. Organization Tiers:</strong> Accounts are segregated into Individual Solo plans and Organization/Agency multi-agent plans. Account classifications cannot be swapped to prevent permission escalation.
              </li>
              <li>
                <strong>Account Credentials:</strong> You are solely responsible for maintaining the confidentiality of your authentication credentials and 2FA TOTP secrets.
              </li>
              <li>
                <strong>Multi-Tenant Isolation:</strong> You agree not to attempt to circumvent or reverse-engineer logical tenant boundaries or query structures.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              3. WhatsApp Usage & Anti-Spam Compliance
            </h2>
            <p className="mb-3">
              CoreSetu facilitates WhatsApp communication via multi-device WebSockets. Users must strictly comply with applicable anti-spam laws, consumer protection regulations, and acceptable use guidelines.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 pl-2">
              <li>You may only send messages to contacts who have explicitly opted in or requested communication.</li>
              <li>Unsolicited bulk spamming, harassing messages, or distribution of malicious links will result in immediate account suspension.</li>
              <li>Numbers associated with abusive or banned accounts are subject to a 90-day cooldown period.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              4. Billing, e-Mandates & 60-Day Data Deletion Rule
            </h2>
            <p className="mb-3">
              All subscription charges, renewals, and upgrades are securely processed via Razorpay.
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 pl-2">
              <li><strong>Proration on Upgrades:</strong> Immediate upgrades prorate the unused value of the current billing cycle.</li>
              <li><strong>Grace Period & Lockout:</strong> Payment failures trigger a 3-day grace period. If unfulfilled, the account enters <code className="text-indigo-300">PLAN_LOCKED</code>.</li>
              <li><strong>60-Day Purge:</strong> Inactive or expired accounts that remain unrenewed for 60 consecutive calendar days are permanently purged from database clusters.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              5. Contact & Support
            </h2>
            <p>
              For legal notices, terms inquiries, or enterprise agreement requests, email <a href="mailto:support@sahyak.com" className="text-indigo-400 hover:underline">support@sahyak.com</a>.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold">
              <ArrowLeft size={14} /> Return to Home
            </Link>
            <span>•</span>
            <Link href="/privacy" className="text-slate-400 hover:text-slate-200">
              Privacy Policy
            </Link>
          </div>
          <p>© {new Date().getFullYear()} CoreSetu Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
