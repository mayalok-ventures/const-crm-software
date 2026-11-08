/**
 * Lightweight BDD Environment Shim for Standalone Node.js Test Execution
 * Enables test suites authored with describe/it/before/after to run directly with `node <file.js>`
 * without requiring external test runners while maintaining full compatibility with Mocha/Jest.
 */

if (!global.describe) {
  const rootSuite = {
    name: 'root',
    parent: null,
    before: [],
    after: [],
    beforeEach: [],
    afterEach: [],
    tests: [],
    children: [],
  };

  let currentSuite = rootSuite;

  function describe(name, fn) {
    const parent = currentSuite;
    const suite = {
      name,
      parent,
      before: [],
      after: [],
      beforeEach: [],
      afterEach: [],
      tests: [],
      children: [],
    };
    parent.children.push(suite);
    currentSuite = suite;
    try {
      if (typeof fn === 'function') {
        fn.call({ timeout: () => {} });
      }
    } finally {
      currentSuite = parent;
    }
  }

  function it(name, fn) {
    currentSuite.tests.push({ name, fn });
  }

  function before(fn) {
    currentSuite.before.push(fn);
  }

  function after(fn) {
    currentSuite.after.push(fn);
  }

  function beforeEach(fn) {
    currentSuite.beforeEach.push(fn);
  }

  function afterEach(fn) {
    currentSuite.afterEach.push(fn);
  }

  global.describe = describe;
  global.it = it;
  global.test = it;
  global.before = before;
  global.after = after;
  global.beforeAll = before;
  global.afterAll = after;
  global.beforeEach = beforeEach;
  global.afterEach = afterEach;

  function invokeFn(fn, ctx) {
    return new Promise((resolve, reject) => {
      if (!fn || typeof fn !== 'function') return resolve();
      if (fn.length >= 1) {
        try {
          fn.call(ctx, (err) => {
            if (err) reject(err);
            else resolve();
          });
        } catch (err) {
          reject(err);
        }
      } else {
        try {
          const res = fn.call(ctx);
          if (res && typeof res.then === 'function') {
            res.then(resolve, reject);
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  let executionScheduled = false;

  function scheduleRunner() {
    if (executionScheduled) return;
    executionScheduled = true;

    setImmediate(async () => {
      // If no BDD tests or suites were declared, do not interfere with standard scripts
      if (rootSuite.children.length === 0 && rootSuite.tests.length === 0) {
        return;
      }

      let passedCount = 0;
      let failedCount = 0;

      async function runHookList(hooks) {
        for (const hook of hooks) {
          await invokeFn(hook, { timeout: () => {} });
        }
      }

      function getAncestorBeforeEach(suite) {
        const list = [];
        let curr = suite;
        while (curr) {
          list.unshift(...curr.beforeEach);
          curr = curr.parent;
        }
        return list;
      }

      function getAncestorAfterEach(suite) {
        const list = [];
        let curr = suite;
        while (curr) {
          list.push(...curr.afterEach);
          curr = curr.parent;
        }
        return list;
      }

      async function runSuiteTree(suite, prefix = '') {
        const suiteLabel = prefix ? `${prefix} > ${suite.name}` : (suite.name !== 'root' ? suite.name : '');
        if (suiteLabel) {
          console.log(`\n📦 ${suiteLabel}`);
        }

        try {
          await runHookList(suite.before);
        } catch (err) {
          console.error(`❌ before() hook failed in suite "${suite.name}":`, err.message || err);
          failedCount++;
          throw err;
        }

        const beforeEaches = getAncestorBeforeEach(suite);
        const afterEaches = getAncestorAfterEach(suite);

        for (const test of suite.tests) {
          try {
            await runHookList(beforeEaches);
            await invokeFn(test.fn, { timeout: () => {} });
            await runHookList(afterEaches);
            console.log(`   ✅ ${test.name}`);
            passedCount++;
          } catch (err) {
            console.error(`   ❌ ${test.name} FAILED:`, err.message || err);
            failedCount++;
            try {
              await runHookList(afterEaches);
            } catch (ignore) {}
          }
        }

        for (const child of suite.children) {
          await runSuiteTree(child, suiteLabel);
        }

        try {
          await runHookList(suite.after);
        } catch (err) {
          console.error(`❌ after() hook failed in suite "${suite.name}":`, err.message || err);
          failedCount++;
        }
      }

      try {
        await runSuiteTree(rootSuite);
        console.log(`\n📊 Tests: ${passedCount} passed, ${failedCount} failed`);
        if (failedCount > 0) {
          process.exit(1);
        } else {
          process.exit(0);
        }
      } catch (err) {
        console.error('\n💥 Suite runner aborted with error:', err.message || err);
        process.exit(1);
      }
    });
  }

  scheduleRunner();
}

module.exports = {};
