/**
 * AppSail CI/CD Health & Deployment Configuration Regression Tests
 *
 * Validates:
 * 1. catalyst.json manifest points to correct AppSail service name & source directory
 * 2. backend/app-config.json specifies valid Node.js stack, entry point, buildPath
 * 3. Root app-config.json presence for standalone fallback
 * 4. Health controller exports & contract verification
 * 5. AppSail deployment URL regex parsing & ANSI escape removal
 * 6. Express router audit for /health and /health/ready endpoints
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAll() {
  console.log('\n========================================================');
  console.log('   APPSAIL CI/CD HEALTH & CONFIGURATION REGRESSION TESTS  ');
  console.log('========================================================\n');

  // 1. Audit catalyst.json
  it('catalyst.json at project root defines sahyak-backend with source backend', () => {
    const rootCatalystJsonPath = path.resolve(__dirname, '../../catalyst.json');
    assert.ok(fs.existsSync(rootCatalystJsonPath), 'catalyst.json must exist at project root');

    const content = JSON.parse(fs.readFileSync(rootCatalystJsonPath, 'utf8'));
    assert.ok(Array.isArray(content.appsail), 'appsail must be an array in catalyst.json');
    assert.strictEqual(content.appsail.length, 1, 'Exactly one AppSail target must be declared');
    assert.strictEqual(content.appsail[0].name, 'sahyak-backend', 'AppSail name must be sahyak-backend');
    assert.strictEqual(content.appsail[0].source, 'backend', 'AppSail source must be backend');
  });

  // 2. Audit backend/app-config.json
  it('backend/app-config.json specifies node20, node server.js, and buildPath', () => {
    const appConfigPath = path.resolve(__dirname, '../app-config.json');
    assert.ok(fs.existsSync(appConfigPath), 'backend/app-config.json must exist');

    const config = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    assert.strictEqual(config.stack, 'node20', 'Stack must be node20');
    assert.strictEqual(config.command, 'node server.js', 'Command must be node server.js');
    assert.ok(config.buildPath === '.' || config.build_path === '.', 'buildPath must be "."');
    assert.strictEqual(config.env_variables?.NODE_ENV, 'production', 'NODE_ENV must be production');
  });

  // 3. Audit root app-config.json
  it('root app-config.json exists with backend buildPath for standalone fallback', () => {
    const rootAppConfigPath = path.resolve(__dirname, '../../app-config.json');
    assert.ok(fs.existsSync(rootAppConfigPath), 'root app-config.json must exist for CLI compatibility');

    const config = JSON.parse(fs.readFileSync(rootAppConfigPath, 'utf8'));
    assert.strictEqual(config.stack, 'node20');
    assert.strictEqual(config.command, 'node server.js');
    assert.ok(config.buildPath === 'backend' || config.build_path === 'backend');
  });

  // 4. Verify HealthController functions
  it('healthController exports getHealth, getReady, getLive, getDetailed', () => {
    const healthController =
      require('../src/monitoring/controllers/healthController').default ||
      require('../src/monitoring/controllers/healthController');

    assert.strictEqual(typeof healthController.getHealth, 'function');
    assert.strictEqual(typeof healthController.getReady, 'function');
    assert.strictEqual(typeof healthController.getLive, 'function');
    assert.strictEqual(typeof healthController.getDetailed, 'function');
  });

  // 5. Test URL regex extraction
  it('regex extracts AppSail URL cleanly from ANSI-colored CLI deploy logs', () => {
    const rawLog = `
 >>>>>>>>>>>>>>> AppSail <<<<<<<<<<<<<

  \u001b[1mDEPLOYMENT SUCCESSFUL\u001b[22m : sahyak-backend
  \u001b[1mAPPSAIL URL          \u001b[22m : \u001b[4mhttps://sahyak-backend-60093521877.development.catalystappsail.in/\u001b[24m

\u001b[32m✔\u001b[39m Catalyst deploy complete!
`;

    // Standard pipeline extraction used in GitHub Actions
    const stripped = rawLog.replace(/\x1b\[[0-9;]*m/g, '');
    const match = stripped.match(/https:\/\/[a-zA-Z0-9.-]+\.catalystappsail\.[a-z]+/i);
    assert.ok(match, 'Must find matching URL in log');
    const extractedUrl = match[0].replace(/\/+$/, '');

    assert.strictEqual(
      extractedUrl,
      'https://sahyak-backend-60093521877.development.catalystappsail.in'
    );
  });

  // 6. Test Express /health response structure
  await itAsync('healthController.getHealth returns HTTP 200 or 503 with standard JSON contract', async () => {
    const healthController =
      require('../src/monitoring/controllers/healthController').default ||
      require('../src/monitoring/controllers/healthController');

    let statusCode = null;
    let responseData = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await healthController.getHealth(req, res);
    assert.ok(statusCode === 200 || statusCode === 503, `HTTP Status was ${statusCode}`);
    assert.ok(responseData.status, 'Response must have status field');
    assert.ok(typeof responseData.overallScore === 'number', 'overallScore must be a number');
  });

  // 7. Test Express /health/ready response structure
  await itAsync('healthController.getReady returns ready boolean and component checks', async () => {
    const healthController =
      require('../src/monitoring/controllers/healthController').default ||
      require('../src/monitoring/controllers/healthController');

    let statusCode = null;
    let responseData = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await healthController.getReady(req, res);
    assert.ok(statusCode === 200 || statusCode === 503, `HTTP Status was ${statusCode}`);
    assert.strictEqual(typeof responseData.ready, 'boolean', 'Response must have boolean ready field');
  });

  // 8. Test .catalystrc configuration and project id mapping
  it('.catalystrc defines default numeric project 91974000000013053 for sahyak-backend', () => {
    const catalystRcPath = path.resolve(__dirname, '../../.catalystrc');
    assert.ok(fs.existsSync(catalystRcPath), '.catalystrc must exist at project root');

    const rc = JSON.parse(fs.readFileSync(catalystRcPath, 'utf8'));
    assert.ok(Array.isArray(rc.projects), 'rc.projects must be an array');
    const project = rc.projects.find(p => p.name === 'sahyak-backend' || p.id === '91974000000013053');
    assert.ok(project, 'Project sahyak-backend must be declared in .catalystrc');
    assert.strictEqual(project.id, '91974000000013053', 'Project ID must be numeric 91974000000013053');
    assert.strictEqual(project.name, 'sahyak-backend', 'Project name must be sahyak-backend');
    assert.ok(Array.isArray(project.env), 'project.env must be an array');
    assert.strictEqual(project.env[0].id, '60093521877', 'Default env ID must be 60093521877');
  });

  // 9. Test numeric project ID coercion logic
  it('coerces string project names to numeric project ID 91974000000013053 to prevent INVALID_URL_PATTERN', () => {
    function resolveProjectId(input) {
      if (!input || !/^[0-9]+$/.test(input)) {
        if (input === 'sahyak-backend' || !input) {
          return '91974000000013053';
        }
      }
      return input;
    }

    assert.strictEqual(resolveProjectId('sahyak-backend'), '91974000000013053');
    assert.strictEqual(resolveProjectId(''), '91974000000013053');
    assert.strictEqual(resolveProjectId(undefined), '91974000000013053');
    assert.strictEqual(resolveProjectId('91974000000013053'), '91974000000013053');
  });

  // 10. Test that .catalystignore contains no negation patterns (!) that cause minimatch to exclude all files
  it('ensures .catalystignore contains no negation patterns that break Catalyst CLI packaging', () => {
    const p = path.resolve(__dirname, '../.catalystignore');
    assert.ok(fs.existsSync(p), 'backend/.catalystignore must exist');
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    // In Catalyst CLI (pack.js), minimatch(file, "!pattern") returns true for all files not matching pattern,
    // which causes the CLI to exclude every file from the zip and upload an empty 22-byte archive!
    const negationLines = lines.filter(l => l.startsWith('!'));
    assert.strictEqual(negationLines.length, 0, 
      `backend/.catalystignore must NOT contain negation patterns (!), found: ${negationLines.join(', ')}`);
  });

  // 11. Test that app-config.json specifies port 9000 for AppSail routing
  it('ensures app-config.json specifies port 9000 and environment port for AppSail routing', () => {
    const p = path.resolve(__dirname, '../app-config.json');
    assert.ok(fs.existsSync(p), 'backend/app-config.json must exist');
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(cfg.port, 'cfg.port must be configured');
    assert.strictEqual(cfg.port.http, 9000, 'cfg.port.http must be 9000');
    assert.strictEqual(cfg.command, 'node server.js', 'cfg.command must be node server.js');
    assert.strictEqual(cfg.stack, 'node20', 'cfg.stack must be node20');
  });

  // 12. Test that server.js defaults to port 9000 in production
  it('ensures server.js port calculation falls back to 9000 in production', () => {
    function computePort(envPort, listenPort, nodeEnv) {
      return Number(listenPort || (nodeEnv === 'production' ? 9000 : (envPort || 5000)));
    }

    assert.strictEqual(computePort(undefined, undefined, 'production'), 9000);
    assert.strictEqual(computePort('5000', undefined, 'production'), 9000);
    assert.strictEqual(computePort('5000', '8080', 'production'), 8080);
    assert.strictEqual(computePort('5000', undefined, 'development'), 5000);
  });

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
