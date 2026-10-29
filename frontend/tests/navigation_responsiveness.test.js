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
assert.ok(
  swContent.includes('NetworkFirst') || swContent.includes('StaleWhileRevalidate'),
  'sw.ts must use a valid caching strategy for flight payloads'
);
console.log('  ✅ Serwist PWA service worker configures deployment-safe flight payload caching');

// 8. Verify static export artifacts and RSC flight payloads exist in out/ directory
console.log('\n8️⃣ Verifying static export artifacts and RSC flight payloads in out/ directory...');
const outPath = path.join(__dirname, '../out');
assert.ok(fs.existsSync(outPath), 'out directory must exist after build');
assert.ok(
  fs.existsSync(path.join(outPath, 'leads.html')) || fs.existsSync(path.join(outPath, 'leads/index.html')),
  'out/leads HTML must exist'
);
assert.ok(
  fs.existsSync(path.join(outPath, 'leads.txt')) || fs.existsSync(path.join(outPath, 'leads/index.txt')),
  'out/leads RSC flight payload (.txt) must exist for SPA navigation'
);
assert.ok(
  fs.existsSync(path.join(outPath, 'pipeline.html')) || fs.existsSync(path.join(outPath, 'pipeline/index.html')),
  'out/pipeline HTML must exist'
);
assert.ok(
  fs.existsSync(path.join(outPath, 'pipeline.txt')) || fs.existsSync(path.join(outPath, 'pipeline/index.txt')),
  'out/pipeline RSC flight payload (.txt) must exist for SPA navigation'
);
assert.ok(
  fs.existsSync(path.join(outPath, 'dashboard.html')) || fs.existsSync(path.join(outPath, 'dashboard/index.html')),
  'out/dashboard HTML must exist'
);
assert.ok(
  fs.existsSync(path.join(outPath, 'dashboard.txt')) || fs.existsSync(path.join(outPath, 'dashboard/index.txt')),
  'out/dashboard RSC flight payload (.txt) must exist for SPA navigation'
);
console.log('  ✅ Static HTML and RSC flight payloads exist for 0ms client-side SPA navigation');

// 9. Verify dynamic route rewrites in Cloudflare _redirects
console.log('\n9️⃣ Verifying Cloudflare Pages _redirects for dynamic routes...');
const redirectsPath = path.join(__dirname, '../public/_redirects');
assert.ok(fs.existsSync(redirectsPath), '_redirects must exist');
const redirectsContent = fs.readFileSync(redirectsPath, 'utf8');
assert.ok(redirectsContent.includes('/leads/* /leads/placeholder.html 200'), 'leads dynamic route must rewrite to placeholder.html');
assert.ok(redirectsContent.includes('/campaigns/* /campaigns/placeholder.html 200'), 'campaigns dynamic route must rewrite to placeholder.html');
assert.ok(redirectsContent.includes('/colleges/* /colleges/placeholder.html 200'), 'colleges dynamic route must rewrite to placeholder.html');
console.log('  ✅ Cloudflare Pages _redirects correctly rewrites all dynamic routes to exported static placeholders');

// 10. Verify BottomNav prevents default reload on persistent tab clicks
console.log('\n🔟 Verifying BottomNav preventDefault() on persistent tabs...');
assert.ok(
  bottomNavContent.includes('e.preventDefault()'),
  'BottomNav must call e.preventDefault() on persistent tabs to prevent Next.js from triggering MPA document reloads'
);
assert.ok(
  bottomNavContent.includes('isModifiedEvent'),
  'BottomNav must check isModifiedEvent to preserve modifier clicks / open-in-new-tab semantics'
);
console.log('  ✅ BottomNav prevents default browser/Next.js navigation while preserving modifier clicks');

// 11. Verify routeParams.js shared helper functions
console.log('\n1️⃣1️⃣ Testing shared routeParams.js dynamic parameter resolution...');
const { getResolvedRouteParam, isValidEntityId, isMongoId, isValidToken } = require('../src/lib/routeParams');
assert.strictEqual(typeof getResolvedRouteParam, 'function', 'getResolvedRouteParam must be a function');
assert.strictEqual(typeof isValidEntityId, 'function', 'isValidEntityId must be a function');
assert.strictEqual(typeof isMongoId, 'function', 'isMongoId must be a function');
assert.strictEqual(typeof isValidToken, 'function', 'isValidToken must be a function');

// Test isMongoId (strict 24-character hexadecimal ObjectId)
assert.strictEqual(isMongoId('67104f123456789012345678'), true, 'Valid 24-char hex must pass isMongoId');
assert.strictEqual(isMongoId('placeholder'), false, 'placeholder must fail isMongoId');
assert.strictEqual(isMongoId('camp_123'), false, 'Non-hex string must fail isMongoId');
assert.strictEqual(isMongoId('123'), false, 'Short string must fail isMongoId');

// Test isValidEntityId (supports 24-char ObjectIds AND valid non-ObjectId identifiers like camp_1, col_123, lead_1)
assert.strictEqual(isValidEntityId('67104f123456789012345678'), true, 'ObjectId must pass isValidEntityId');
assert.strictEqual(isValidEntityId('camp_123'), true, 'camp_123 must pass isValidEntityId');
assert.strictEqual(isValidEntityId('col_123'), true, 'col_123 must pass isValidEntityId');
assert.strictEqual(isValidEntityId('cat_123'), true, 'cat_123 must pass isValidEntityId');
assert.strictEqual(isValidEntityId('lead_1'), true, 'lead_1 must pass isValidEntityId');
assert.strictEqual(isValidEntityId('placeholder'), false, 'placeholder must fail isValidEntityId');
assert.strictEqual(isValidEntityId('[id]'), false, '[id] must fail isValidEntityId');
assert.strictEqual(isValidEntityId('undefined'), false, 'undefined must fail isValidEntityId');
assert.strictEqual(isValidEntityId('null'), false, 'null must fail isValidEntityId');
assert.strictEqual(isValidEntityId(''), false, 'empty string must fail isValidEntityId');
assert.strictEqual(isValidEntityId('<script>alert(1)</script>'), false, 'XSS input must fail isValidEntityId');

// Test isValidToken
assert.strictEqual(isValidToken('token_abc_123'), true, 'Valid token must pass');
assert.strictEqual(isValidToken('550e8400-e29b-41d4-a716-446655440000'), true, 'UUID token must pass');
assert.strictEqual(isValidToken('a'.repeat(64)), true, '64-character crypto hex token must pass');
assert.strictEqual(isValidToken(''), false, 'Empty string must fail isValidToken');
assert.strictEqual(isValidToken('placeholder'), false, 'placeholder must fail isValidToken');
assert.strictEqual(isValidToken('[token]'), false, '[token] must fail isValidToken');
assert.strictEqual(isValidToken('bad<token>'), false, 'Illegal chars must fail isValidToken');

// Test getResolvedRouteParam with mock Next.js params
assert.strictEqual(
  getResolvedRouteParam({ id: '67104f123456789012345678' }, 'id', 'leads', isValidEntityId),
  '67104f123456789012345678',
  'Should return valid param from params object'
);
assert.strictEqual(
  getResolvedRouteParam({ id: 'camp_123' }, 'id', 'campaigns', isValidEntityId),
  'camp_123',
  'Should return valid alphanumeric campaign ID'
);
assert.strictEqual(
  getResolvedRouteParam({ id: 'placeholder' }, 'id', 'leads', isValidEntityId),
  '',
  'Should reject placeholder from params object when no window.location exists'
);
assert.strictEqual(
  getResolvedRouteParam({ id: '[id]' }, 'id', 'leads', isValidEntityId),
  '',
  'Should reject [id] from params object'
);
console.log('  ✅ routeParams helper correctly resolves valid parameters and rejects placeholders');

// 12. Verify genuine 404 preservation (absence of unconditional /* /index.html 200)
console.log('\n1️⃣2️⃣ Verifying genuine 404 preservation in Cloudflare _redirects...');
assert.ok(
  !redirectsContent.includes('/* /index.html 200'),
  '_redirects must NOT have an unconditional catch-all (/* /index.html 200) so unknown routes return genuine 404s'
);
console.log('  ✅ Cloudflare Pages _redirects preserves genuine 404s for unknown routes');

console.log('\n======================================================');
console.log('🎉 ALL 12 NAVIGATION RESPONSIVENESS REGRESSION TESTS PASSED!');
console.log('======================================================\n');
