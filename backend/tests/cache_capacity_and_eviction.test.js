const assert = require('assert');

async function runTest() {
  console.log('🧪 Running Test: Cache Capacity Limits and Periodic Sweeps (R7)...');

  const { cacheService } = require('../src/config/redis');
  const { _countCache, _sweepExpiredCountCacheKeys } = require('../src/controllers/leadsController');

  // 1. Test fallbackMemoryCache capacity limit (5,000 max)
  const initialSize = cacheService.getMemoryCacheSize();
  console.log(`Initial fallbackMemoryCache size: ${initialSize}`);

  // Insert 5,050 items into fallback cache
  for (let i = 0; i < 5050; i++) {
    await cacheService.setJson(`test_key_${i}`, { val: i }, 60);
  }

  const boundedSize = cacheService.getMemoryCacheSize();
  assert.strictEqual(boundedSize, 5000, `fallbackMemoryCache size must be strictly capped at 5000 (actual: ${boundedSize})`);
  console.log('✅ Step 1: fallbackMemoryCache strictly capped at 5,000 entries (FIFO eviction works).');

  // Verify oldest key was evicted and newest exists
  const oldest = await cacheService.getJson('test_key_0');
  const newest = await cacheService.getJson('test_key_5049');
  assert.strictEqual(oldest, null, 'Oldest key must have been evicted');
  assert.deepStrictEqual(newest, { val: 5049 }, 'Newest key must be retained');
  console.log('✅ Step 2: FIFO eviction verified (oldest evicted, newest retained).');

  // 3. Test sweep of expired keys in fallbackMemoryCache
  await cacheService.setJson('short_lived_key', { data: 'temp' }, 1); // 1 second TTL
  // Wait 1.1s for expiration
  await new Promise((r) => setTimeout(r, 1100));

  const sweptCount = cacheService.sweepExpiredMemoryKeys();
  assert.ok(sweptCount >= 1, 'Sweep must remove at least 1 expired key');
  console.log(`✅ Step 3: sweepExpiredMemoryKeys successfully swept ${sweptCount} expired key(s).`);

  // 4. Test leadsController countCache sweep
  _countCache.set('active_count_1', { count: 10, expiresAt: Date.now() + 10000 });
  _countCache.set('expired_count_1', { count: 20, expiresAt: Date.now() - 500 });
  _countCache.set('expired_count_2', { count: 30, expiresAt: Date.now() - 100 });

  const sweptCounts = _sweepExpiredCountCacheKeys();
  assert.ok(sweptCounts >= 2, `Count cache sweep must remove expired keys (swept: ${sweptCounts})`);
  assert.ok(_countCache.has('active_count_1'), 'Active count must be retained');
  assert.ok(!_countCache.has('expired_count_1'), 'Expired count must be removed');
  console.log('✅ Step 4: countCache periodic sweep cleaned expired query counts.');

  console.log('🎉 ALL R7 CACHE CAPACITY & EVICTION TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
