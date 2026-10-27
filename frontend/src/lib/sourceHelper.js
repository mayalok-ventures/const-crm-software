'use client';

/**
 * Parses and returns formatted badge styling & hierarchical metadata for lead sources
 * Normalized source hierarchy: platform -> connectionId/name -> campaign -> adset/ad
 */
export function getLeadSourceTag(lead) {
  if (!lead) {
    return {
      label: 'Direct / Manual',
      icon: '📝',
      bg: 'rgba(100, 116, 139, 0.1)',
      border: 'rgba(100, 116, 139, 0.25)',
      color: '#64748b',
      hierarchy: ['Manual Entry'],
      detail: 'Manual Entry',
      isTest: false
    };
  }

  const ls = lead.leadSource || {};
  const platform = String(ls.platform || lead.source || ls.provider || lead.utmSource || '').toLowerCase().trim();
  const connection = ls.connectionName || ls.formName || ls.pageName || '';
  const campaign = ls.campaignName || lead.utmCampaign || '';
  const adset = ls.adSetName || ls.adGroupName || '';
  const ad = ls.adName || '';
  const isTest = Boolean(ls.isTest || lead.isTest);

  // Build hierarchy chain
  const hierarchy = [];

  // 1. Meta Ads (Facebook & Instagram)
  if (platform === 'meta' || platform === 'facebook' || platform === 'instagram' || platform === 'meta_ads') {
    hierarchy.push('Meta Ads');
    if (connection) hierarchy.push(connection);
    if (campaign) hierarchy.push(campaign);
    if (adset || ad) hierarchy.push(ad || adset);

    return {
      label: 'Meta Ads',
      icon: '🔵',
      bg: 'rgba(37, 99, 235, 0.1)',
      border: 'rgba(37, 99, 235, 0.25)',
      color: '#2563eb',
      platform: 'meta',
      connection,
      campaign,
      adset,
      ad,
      hierarchy,
      detail: campaign || connection || 'Meta Lead Form',
      isTest
    };
  }

  // 2. Google Ads
  if (platform === 'google' || platform === 'google_ads' || platform === 'adwords' || platform === 'gads') {
    hierarchy.push('Google Ads');
    if (connection) hierarchy.push(connection);
    if (campaign) hierarchy.push(campaign);
    if (adset || ad) hierarchy.push(ad || adset);

    return {
      label: 'Google Ads',
      icon: '🔴',
      bg: 'rgba(234, 67, 53, 0.1)',
      border: 'rgba(234, 67, 53, 0.25)',
      color: '#ea4335',
      platform: 'google',
      connection,
      campaign,
      adset,
      ad,
      hierarchy,
      detail: campaign || connection || 'Search / PMax Asset',
      isTest
    };
  }

  // 3. Google Sheets
  if (platform === 'sheets' || platform === 'google_sheets' || platform === 'sheet') {
    hierarchy.push('Google Sheets');
    if (connection) hierarchy.push(connection);
    if (campaign) hierarchy.push(campaign);

    return {
      label: 'Google Sheets',
      icon: '📊',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)',
      color: '#10b981',
      platform: 'sheets',
      connection,
      campaign,
      hierarchy,
      detail: campaign || connection || 'Apps Script Sync',
      isTest
    };
  }

  // 4. Website Forms
  if (platform === 'website' || platform === 'organic' || platform === 'web') {
    hierarchy.push('Website');
    if (connection) hierarchy.push(connection);
    if (campaign) hierarchy.push(campaign);

    return {
      label: 'Website Form',
      icon: '🌐',
      bg: 'rgba(99, 102, 241, 0.1)',
      border: 'rgba(99, 102, 241, 0.25)',
      color: '#6366f1',
      platform: 'website',
      connection,
      campaign,
      hierarchy,
      detail: campaign || connection || 'Website Inbound',
      isTest
    };
  }

  // 5. Custom Webhooks (Zapier, Make, APIs)
  if (platform === 'custom' || platform === 'custom_webhook' || platform === 'webhook' || platform === 'zapier') {
    hierarchy.push('Custom Webhook');
    if (connection) hierarchy.push(connection);
    if (campaign) hierarchy.push(campaign);

    return {
      label: 'Custom Webhook',
      icon: '⚡',
      bg: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.25)',
      color: '#a855f7',
      platform: 'custom',
      connection,
      campaign,
      hierarchy,
      detail: campaign || connection || 'Webhook Ingestion',
      isTest
    };
  }

  // 6. Manual Entry / Walk-In
  hierarchy.push(platform ? platform.toUpperCase() : 'Manual');
  if (campaign) hierarchy.push(campaign);

  return {
    label: platform ? platform.toUpperCase() : 'Manual Direct',
    icon: '📝',
    bg: 'rgba(100, 116, 139, 0.1)',
    border: 'rgba(100, 116, 139, 0.25)',
    color: '#64748b',
    platform: platform || 'manual',
    connection,
    campaign,
    hierarchy,
    detail: campaign || 'Direct Entry',
    isTest
  };
}

export function SourcePill({ lead, showDetail = true, showHierarchy = false }) {
  const tag = getLeadSourceTag(lead);
  if (!tag) return null;

  const tooltipText = tag.hierarchy && tag.hierarchy.length > 1
    ? tag.hierarchy.join('  ➔  ')
    : `${tag.label}${tag.detail ? `: ${tag.detail}` : ''}`;

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className="inline-flex items-center gap-1 flex-shrink-0"
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
        title={tooltipText}
      >
        <span style={{ fontSize: 10 }}>{tag.icon}</span>
        <span className="truncate">{tag.label}</span>
        {showDetail && tag.detail && tag.detail !== tag.label && (
          <span
            className="truncate max-w-[120px] hidden sm:inline"
            style={{ opacity: 0.8, fontWeight: 600, fontSize: 10.5 }}
          >
            › {tag.detail}
          </span>
        )}
      </span>

      {/* Test Lead Badge */}
      {tag.isTest && (
        <span
          className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 tracking-wider"
          title="Simulated / Test Inbound Payload"
        >
          TEST
        </span>
      )}
    </div>
  );
}

/**
 * Full hierarchical breadcrumb block for Lead Profile
 * platform > connection > campaign > adset / ad
 */
export function SourceHierarchyBreadcrumb({ lead }) {
  const tag = getLeadSourceTag(lead);
  if (!tag) return null;

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
          Normalized Source Attribution
        </span>
        {tag.isTest && (
          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
            TEST PAYLOAD
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span
          className="px-2 py-0.5 rounded-md font-bold flex items-center gap-1"
          style={{ background: tag.bg, color: tag.color, border: `1px solid ${tag.border}` }}
        >
          <span>{tag.icon}</span> {tag.label}
        </span>

        {tag.connection && (
          <>
            <span className="text-[var(--text-muted)]">›</span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--card)] border border-[var(--border)] font-semibold text-[var(--text)]">
              {tag.connection}
            </span>
          </>
        )}

        {tag.campaign && (
          <>
            <span className="text-[var(--text-muted)]">›</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 font-bold text-indigo-700">
              {tag.campaign}
            </span>
          </>
        )}

        {(tag.adset || tag.ad) && (
          <>
            <span className="text-[var(--text-muted)]">›</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 font-medium text-purple-700">
              {tag.ad || tag.adset}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
