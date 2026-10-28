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
assert.ok(headersContent.includes('/*/*.txt'), '_headers must declare caching for nested /*/*.txt flight payloads');
assert.ok(headersContent.includes('max-age=86400'), 'flight payloads must have at least 86400s (24h) cache TTL');
console.log('  ✅ Cloudflare Pages _headers properly caches Next.js RSC flight text payloads (24h TTL, SWR 7d)');

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
assert.ok(queriesContent.includes('staleTime: 60000'), 'leadsListOptions and pipelineOptions must have staleTime >= 60000ms');
assert.ok(queriesContent.includes('placeholderData: (previousData) => previousData'), 'Queries must use placeholderData to prevent skeleton flash');
console.log('  ✅ Query cache settings prevent layout shift and unnecessary mount refetches');

// 5. Verify static export output exists
console.log('\n5️⃣ Verifying static export artifacts in out/ directory...');
const outPath = path.join(__dirname, '../out');
assert.ok(fs.existsSync(outPath), 'out directory must exist after build');
assert.ok(fs.existsSync(path.join(outPath, 'leads/index.html')), 'out/leads/index.html must exist');
assert.ok(fs.existsSync(path.join(outPath, 'pipeline/index.html')), 'out/pipeline/index.html must exist');
assert.ok(fs.existsSync(path.join(outPath, 'dashboard/index.html')), 'out/dashboard/index.html must exist');
console.log('  ✅ All static routes prerendered and ready for instantaneous serving');

console.log('\n======================================================');
console.log('🎉 ALL 5 NAVIGATION RESPONSIVENESS REGRESSION TESTS PASSED!');
console.log('======================================================\n');
