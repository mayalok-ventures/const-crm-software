'use client';

/**
 * Parses and returns formatted badge styling & metadata for lead sources
 * Supports Meta Ads, Google Ads, Organic/Website, Referral, Spreadsheet, Platform Signup, and Direct.
 */
export function getLeadSourceTag(lead) {
  if (!lead) {
    return {
      label: 'Direct / Manual',
      icon: '🟡',
      bg: 'rgba(234, 179, 8, 0.12)',
      border: 'rgba(234, 179, 8, 0.3)',
      color: '#ca8a04',
      detail: 'Manual Entry'
    };
  }

  const src = String(lead.source || lead.leadSource?.provider || lead.utmSource || '').toLowerCase().trim();
  const tags = Array.isArray(lead.tags) ? lead.tags.map(t => String(t).toLowerCase()) : [];
  const campaign = lead.leadSource?.campaignName || lead.utmCampaign || '';
  const form = lead.leadSource?.formName || '';

  // 1. Meta / Facebook / Instagram Ads
  if (
    src === 'meta' || src === 'facebook' || src === 'instagram' || src === 'meta_ads' || src === 'fb' || src === 'ig' ||
    tags.some(t => ['meta', 'facebook', 'instagram', 'meta_ads', 'fb_lead', 'ig_lead'].includes(t))
  ) {
    return {
      label: 'Meta Ads',
      icon: '🔵',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      color: '#2563eb',
      detail: campaign || form || 'Facebook / IG Lead Gen'
    };
  }

  // 2. Google Ads / Search / PMax
  if (
    src === 'google' || src === 'google_ads' || src === 'adwords' || src === 'gads' || src === 'cpc' ||
    tags.some(t => ['google', 'google_ads', 'gads', 'adwords'].includes(t))
  ) {
    return {
      label: 'Google Ads',
      icon: '🔴',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      color: '#dc2626',
      detail: campaign || 'Search & PMax Forms'
    };
  }

  // 3. Website / Organic Web Form
  if (
    src === 'website' || src === 'organic' || src === 'web' || src === 'landing_page' ||
    tags.some(t => ['website', 'organic', 'web_inquiry', 'contact_form'].includes(t))
  ) {
    return {
      label: 'Organic / Web',
      icon: '🟢',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      color: '#059669',
      detail: campaign || 'Website Form'
    };
  }

  // 4. Referral / Partner Network
  if (
    src === 'referral' || src === 'partner' || src === 'affiliate' ||
    tags.some(t => ['referral', 'partner', 'affiliate'].includes(t))
  ) {
    return {
      label: 'Referral',
      icon: '🟣',
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.3)',
      color: '#9333ea',
      detail: campaign || 'Partner Network'
    };
  }

  // 5. Spreadsheet / CSV Import
  if (
    src === 'import' || src === 'spreadsheet' || src === 'excel' || src === 'csv' ||
    tags.some(t => ['import', 'bulk_import', 'spreadsheet'].includes(t))
  ) {
    return {
      label: 'Spreadsheet Import',
      icon: '🟠',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.3)',
      color: '#ea580c',
      detail: 'Batch Ingestion'
    };
  }

  // 6. Platform Signup
  if (
    src === 'signup' || tags.includes('platform_signup') || tags.includes('new_user')
  ) {
    return {
      label: 'Platform Signup',
      icon: '⚡',
      bg: 'rgba(99, 102, 241, 0.12)',
      border: 'rgba(99, 102, 241, 0.3)',
      color: '#4f46e5',
      detail: 'Inbound Portal'
    };
  }

  // 7. Default Direct / Manual
  return {
    label: src ? src.toUpperCase() : 'Direct / Manual',
    icon: '🟡',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.3)',
    color: '#ca8a04',
    detail: campaign || 'Manual Entry'
  };
}

export function SourcePill({ lead, showDetail = true }) {
  const tag = getLeadSourceTag(lead);
  if (!tag) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '2.5px 8px',
        borderRadius: 20,
        background: tag.bg,
        border: `1px solid ${tag.border}`,
        color: tag.color,
        letterSpacing: '0.2px',
        maxWidth: '100%',
      }}
      title={tag.detail ? `${tag.label}: ${tag.detail}` : tag.label}
    >
      <span style={{ fontSize: 10 }}>{tag.icon}</span>
      <span className="truncate">{tag.label}</span>
      {showDetail && tag.detail && tag.detail !== tag.label && (
        <span
          className="truncate max-w-[110px] hidden sm:inline"
          style={{ opacity: 0.75, fontWeight: 500, fontSize: 10.5 }}
        >
          • {tag.detail}
        </span>
      )}
    </span>
  );
}
