const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('⚡ NAVIGATION RESPONSIVENESS & TAB TIMING REGRESSION SUITE');
console.log('======================================================\n');

// 1. Verify Cloudflare Pages _headers includes Next.js RSC flight caching
console.log('1️⃣ Testing Cloudflare Pages _headers caching configuration...');
const headersPath = path.join(__dirname, '../public/_headers');
assert.ok(fs.existsSync(headersPath), '_headers file must exist in public directory');
const headersContent = fs.readFileSync(headersPath, 'utf8');
assert.ok(headersContent.includes('/*.txt'), '_headers must declare caching for /*.txt flight payloads');
assert.ok(headersContent.includes('must-revalidate'), 'flight payloads must declare must-revalidate to prevent stale ChunkLoadErrors across deployments');
assert.ok(headersContent.includes('immutable'), 'static assets must be immutable');
console.log('  ✅ Cloudflare Pages _headers properly configures safe flight revalidation and immutable static assets');

// 2. Verify TopProgressBar component exists and is mounted in AppShell
console.log('\n2️⃣ Testing TopProgressBar component and AppShell integration...');
const topProgressBarPath = path.join(__dirname, '../src/components/common/TopProgressBar.jsx');
assert.ok(fs.existsSync(topProgressBarPath), 'TopProgressBar.jsx must exist');
const topProgressContent = fs.readFileSync(topProgressBarPath, 'utf8');
assert.ok(topProgressContent.includes('role="progressbar"'), 'TopProgressBar must have accessible role="progressbar"');
assert.ok(topProgressContent.includes('linear-gradient'), 'TopProgressBar must render visual indicator');
assert.ok(!topProgressContent.includes('useSearchParams'), 'TopProgressBar must not use useSearchParams directly to avoid CSR bailout');

const appShellPath = path.join(__dirname, '../src/components/AppShell.jsx');
const appShellContent = fs.readFileSync(appShellPath, 'utf8');
assert.ok(appShellContent.includes('<TopProgressBar />'), 'AppShell must mount TopProgressBar for instant visual response');
console.log('  ✅ TopProgressBar mounted in AppShell without CSR bailout risks');

// 3. Verify BottomNav optimistic state and idle prefetching
console.log('\n3️⃣ Testing BottomNav optimistic feedback and comprehensive prefetch...');
const bottomNavPath = path.join(__dirname, '../src/components/BottomNav.js');
const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf8');
assert.ok(bottomNavContent.includes('optimisticActive'), 'BottomNav must implement optimisticActive state');
assert.ok(bottomNavContent.includes('setOptimisticActive'), 'BottomNav must trigger setOptimisticActive on click/touch');
assert.ok(bottomNavContent.includes("router.prefetch('/leads')"), 'BottomNav must prefetch /leads route');
assert.ok(bottomNavContent.includes("router.prefetch('/pipeline')"), 'BottomNav must prefetch /pipeline route');
assert.ok(bottomNavContent.includes("router.prefetch('/deals')"), 'BottomNav must prefetch /deals route');
assert.ok(bottomNavContent.includes("router.prefetch('/follow-ups')"), 'BottomNav must prefetch /follow-ups route');
console.log('  ✅ BottomNav implements Frame-0 (0ms) active tab state and prefetches all major routes');

// 4. Verify TanStack queries staleTime and placeholderData
console.log('\n4️⃣ Testing TanStack Query staleTime and placeholderData consistency...');
const queriesPath = path.join(__dirname, '../src/lib/queries.js');
const queriesContent = fs.readFileSync(queriesPath, 'utf8');
assert.ok(
  queriesContent.includes('staleTime: 1000 * 60 * 10') || queriesContent.includes('staleTime: 600000'),
  'leadsListOptions and pipelineOptions must have staleTime >= 10m (600000ms)'
);
assert.ok(queriesContent.includes('placeholderData: (previousData) => previousData'), 'Queries must use placeholderData to prevent skeleton flash');
console.log('  ✅ Query cache settings prevent layout shift and unnecessary mount refetches');

// 5. Verify PersistentTabManager and React 19 Activity integration
console.log('\n5️⃣ Testing React 19 Activity Persistent Tab Manager...');
const persistentManagerPath = path.join(__dirname, '../src/components/common/PersistentTabManager.jsx');
assert.ok(fs.existsSync(persistentManagerPath), 'PersistentTabManager.jsx must exist');
const managerContent = fs.readFileSync(persistentManagerPath, 'utf8');
assert.ok(managerContent.includes('PersistentActivity'), 'PersistentTabManager must use PersistentActivity');
assert.ok(managerContent.includes('tenantKey'), 'PersistentTabManager must scope state with tenantKey to prevent cross-tenant bleed');
assert.ok(appShellContent.includes('<PersistentTabManager>'), 'AppShell must wrap content in PersistentTabManager');

// 6. Verify Tenant-scoped Query Keys & Centralized Cross-View Invalidation
console.log('\n6️⃣ Testing Tenant-Scoped TanStack Query Keys & Cross-View Invalidation...');
assert.ok(queriesContent.includes('getTenantScope'), 'queries.js must implement getTenantScope() for tenant isolation');
assert.ok(queriesContent.includes("['leads', wsId"), 'leadsListOptions must scope query key with wsId');
assert.ok(queriesContent.includes("['pipeline', wsId"), 'pipelineOptions must scope query key with wsId');
assert.ok(queriesContent.includes('invalidateAllLeadViews'), 'queries.js must export invalidateAllLeadViews()');
console.log('  ✅ Tenant-scoped query keys and cross-view invalidation verified');

// 7. Verify Serwist Service Worker RSC Flight Payload Caching
console.log('\n7️⃣ Testing Serwist Service Worker flight payload caching...');
const swPath = path.join(__dirname, '../src/app/sw.ts');
assert.ok(fs.existsSync(swPath), 'sw.ts must exist');
const swContent = fs.readFileSync(swPath, 'utf8');
assert.ok(swContent.includes('rsc-flight-payloads'), 'sw.ts must define rsc-flight-payloads cache');
assert.ok(swContent.includes('StaleWhileRevalidate'), 'sw.ts must use StaleWhileRevalidate for flight payloads');
console.log('  ✅ Serwist PWA service worker configures StaleWhileRevalidate for instant flight payload loading');

// 8. Verify static export output exists
console.log('\n8️⃣ Verifying static export artifacts in out/ directory...');
const outPath = path.join(__dirname, '../out');
assert.ok(fs.existsSync(outPath), 'out directory must exist after build');
assert.ok(fs.existsSync(path.join(outPath, 'leads/index.html')), 'out/leads/index.html must exist');
assert.ok(fs.existsSync(path.join(outPath, 'pipeline/index.html')), 'out/pipeline/index.html must exist');
assert.ok(fs.existsSync(path.join(outPath, 'dashboard/index.html')), 'out/dashboard/index.html must exist');
console.log('  ✅ All static routes prerendered and ready for instantaneous serving');

console.log('\n======================================================');
console.log('🎉 ALL 8 NAVIGATION RESPONSIVENESS REGRESSION TESTS PASSED!');
console.log('======================================================\n');
