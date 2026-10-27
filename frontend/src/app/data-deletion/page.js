'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldAlert,
  Trash2,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Clock,
  Building2,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function DataDeletionInstructionsPage() {
  const lastUpdated = 'August 21, 2026';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="Sahyak CRM Logo"
              width={32}
              height={32}
              className="rounded-lg shadow-sm group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight block leading-none">
                Sahyak <span className="text-indigo-600 font-semibold text-sm">CRM</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                Privacy & Data Governance
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Document Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Facebook Platform Compliance • User Data Rights</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Sahyak CRM - Data Deletion Instructions
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
            At Sahyak CRM, we respect your fundamental right to privacy and data protection. In accordance with Meta (Facebook) Platform Policies and global data protection regulations (including GDPR and India&rsquo;s IT Act), you have full control over your personal data, integrated accounts, and lead records stored on our infrastructure.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Revised: <strong className="text-slate-700">{lastUpdated}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status: <strong className="text-slate-700">Active Public Policy</strong></span>
            </div>
          </div>
        </div>

        {/* Method 1 Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Method 1: Removing Sahyak CRM via Facebook
            </h2>
          </div>

          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            If you connected Sahyak CRM with your Facebook account (for Facebook Lead Ads, Page Messenger, or Instagram messaging) and wish to revoke access and remove the app permissions, follow these steps:
          </p>

          <ol className="space-y-3 pl-2 sm:pl-4 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                a
              </span>
              <span>Go to your Facebook Account&rsquo;s <strong>&ldquo;Settings &amp; Privacy&rdquo;</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                b
              </span>
              <span>Click <strong>&ldquo;Settings&rdquo;</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                c
              </span>
              <span>Scroll down the left sidebar and click <strong>&ldquo;Apps and Websites&rdquo;</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                d
              </span>
              <span>Find <strong>&ldquo;Sahyak CRM&rdquo;</strong> in the active applications list and click <strong>&ldquo;Remove&rdquo;</strong>.</span>
            </li>
          </ol>

          <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              Once removed, Facebook will immediately stop sending real-time webhook updates, lead events, or messages to Sahyak CRM.
            </span>
          </div>
        </section>

        {/* Method 2 Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Method 2: Requesting Complete Data Wipe from Our Servers
            </h2>
          </div>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            To request the permanent and irreversible deletion of all your stored leads, account profile details, integration tokens, message logs, and analytics from the Sahyak CRM databases, please follow our official data wipe protocol:
          </p>

          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-xl bg-rose-50/60 border border-rose-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-rose-600" />
                <span>Direct Support Contact</span>
              </h3>
              <p className="text-sm text-slate-800 mb-3">
                Send an email with the subject line <strong>&ldquo;Data Deletion Request - Sahyak CRM&rdquo;</strong> to our data compliance desk:
              </p>
              <a
                href="mailto:connect4adm@gmail.com?subject=Data%20Deletion%20Request%20-%20Sahyak%20CRM"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-rose-200 text-rose-700 font-bold text-sm hover:bg-rose-50 transition-colors shadow-sm"
              >
                <Mail className="w-4 h-4" />
                <span>connect4adm@gmail.com</span>
              </a>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-sm text-slate-700 space-y-2.5">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Please include the following information in your email:
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 pl-1">
                <li>Your registered <strong>account email address</strong> on Sahyak CRM.</li>
                <li>Your <strong>organization or company name</strong>.</li>
                <li>Your registered <strong>phone number or Usercode</strong> (if applicable).</li>
                <li>A clear statement requesting full data deletion under Meta Platform policies.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-emerald-900">
                <strong className="block font-bold mb-0.5">Processing Timeline & Confirmation:</strong>
                Our engineering team will verify your identity and process the complete data erasure within <strong>7&ndash;14 business days</strong>. A formal confirmation email will be dispatched to your registered address upon successful sanitization.
              </div>
            </div>
          </div>
        </section>

        {/* Scope of Deletion Notice */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-10">
          <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-slate-500" />
            <span>Scope of Deleted Data</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">
            Upon completion of your request, the following records are permanently purged from our production clusters and backup snapshots:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span>All ingested customer leads and phone numbers</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span>Meta Page tokens & OAuth credentials</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span>Campaign interaction logs & analytics</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <span>User profiles and team hierarchy records</span>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-600 font-medium">
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Home
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Sahyak Technologies. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
