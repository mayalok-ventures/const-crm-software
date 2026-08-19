'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, ArrowRight, Sparkles, Crown } from 'lucide-react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';

export function getPlanTierInfo(user) {
  if (!user) return { plan: 'free', tierRank: 0, isFree: true, isMidTier: false, isHighest: false, daysLeft: 0, formattedName: 'Free' };

  const plan = user.plan || 'free';
  let tierRank = 0;
  let isHighest = false;
  let isMidTier = false;

  if (plan === 'free') {
    tierRank = 0;
  } else if (plan === 'basic_solo' || plan === 'team_starter') {
    tierRank = 1;
    isMidTier = true;
  } else if (plan === 'smart_solo' || plan === 'business') {
    tierRank = 2;
    isMidTier = true;
  } else if (plan === 'power_solo' || plan === 'enterprise' || plan === 'custom_enterprise') {
    tierRank = 3;
    isHighest = true;
  } else {
    // Legacy support
    if (plan.includes('power') || plan.includes('enterprise')) {
      tierRank = 3;
      isHighest = true;
    } else {
      tierRank = 1;
      isMidTier = true;
    }
  }

  const daysLeft = user.subscriptionLifecycle?.daysLeft ?? (
    user.planEndDate ? Math.max(0, Math.ceil((new Date(user.planEndDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0
  );

  const nameMap = {
    free: 'Free',
    basic_solo: 'Basic Solo',
    smart_solo: 'Smart Solo',
    power_solo: 'Power Solo',
    team_starter: 'Team Starter',
    business: 'Business',
    enterprise: 'Enterprise',
    custom_enterprise: 'Enterprise+',
  };

  return {
    plan,
    tierRank,
    isFree: tierRank === 0,
    isMidTier,
    isHighest,
    daysLeft,
    formattedName: nameMap[plan] || plan,
  };
}

export default function PlanStatusWidget({ className = '', style = {} }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initial read
    const local = getUser();
    if (local) setUser(local);

    // Sync live from server
    api.get('/auth/me')
      .then(res => {
        if (res.data) setUser(res.data);
      })
      .catch(() => { });
  }, []);

  if (!user || user.role === 'superadmin' || user.isAdmin) return null;

  const { isFree, isMidTier, isHighest, daysLeft, formattedName } = getPlanTierInfo(user);

  // CASE 1: Highest-Tier Plan (Very small, moved to the side, only displays remaining days)
  if (isHighest) {
    return (
      <Link
        href="/plans"
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981',
          fontSize: 10,
          fontWeight: 700,
          textDecoration: 'none',
          marginLeft: 'auto',
          lineHeight: 1.2,
          transition: 'all 0.15s ease',
          ...style
        }}
        title={`Highest Tier Plan Active: ${formattedName} (${daysLeft} days remaining). Click to manage.`}
      >
        <span style={{ fontSize: 11 }}>👑</span>
        <span>{daysLeft}d left</span>
      </Link>
    );
  }

  // CASE 2: Intermediate / Lower Paid Plan (Shrunk down, shows remaining days AND an Upgrade button)
  if (isMidTier) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          ...style
        }}
      >
        {/* Shrunk plan & days badge */}
        <Link
          href="/plans"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 8,
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#818cf8',
            fontSize: 11,
            fontWeight: 600,
            textDecoration: 'none',
            lineHeight: 1.2
          }}
          title={`Active: ${formattedName} (${daysLeft} days left)`}
        >
          <Zap size={11} />
          <span>{formattedName}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>• {daysLeft}d</span>
        </Link>

        {/* Upgrade Button for Lower Tier */}
        <Link
          href="/plans"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
            lineHeight: 1.2
          }}
        >
          <span>Upgrade</span>
          <ArrowRight size={11} />
        </Link>
      </div>
    );
  }

  // CASE 3: Free Plan (Full-sized prominent Upgrade button)
  return (
    <Link
      href="/plans"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 3px 10px rgba(99, 102, 241, 0.3)',
        lineHeight: 1.2,
        ...style
      }}
    >
      <Zap size={14} />
      <span>Upgrade Plan</span>
    </Link>
  );
}
