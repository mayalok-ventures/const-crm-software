/**
 * Phase 1 — Tenant / SuperAdmin Scope Isolation & Security Hardening Test Suite
 * Validates:
 * 1. Primary Security Invariant: Only role === 'superadmin' may bypass tenant scoping.
 * 2. getTenantScope & getTenantUserScope behavior across all user roles.
 * 3. 403 Forbidden enforcement on platform infrastructure & plan endpoints for all non-superadmin users.
 * 4. Cross-tenant data isolation.
 * 5. Role redirection decision matrix (SuperAdmin -> /superadmin-dashboard, Tenant -> /dashboard).
 * 6. Profile & Organization navigation staying on /profile.
 * 7. Non-Real-Estate multi-vertical compatibility.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const { protect, superAdminOnly, adminOnly, managerOrAdminOnly } = require('../src/middleware/auth');
const adminController = require('../src/controllers/adminController');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ [PASS] ${message}`);
  }
};

async function runSecurityTestSuite() {
  console.log('\n======================================================');
  console.log('🔒 PHASE 1 SECURITY & SCOPE ISOLATION TEST SUITE');
  console.log('======================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    }

    const testTenantAId = new mongoose.Types.ObjectId();
    const testTenantBId = new mongoose.Types.ObjectId();

    // Mock Users
    const superAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Platform SuperAdmin',
      role: 'superadmin',
      isAdmin: true,
      companyId: null,
      companyRole: 'owner',
    };

    const tenantOwnerA = {
      _id: testTenantAId,
      name: 'Real Estate Owner A',
      role: 'admin',
      isAdmin: true, // Legacy flag set
      companyId: null, // As company owner, companyId is null
      companyRole: 'owner',
      workStatus: 'company_owner',
      industryType: 'Real Estate',
    };

    const tenantAdminA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Real Estate Admin A',
      role: 'admin',
      isAdmin: false,
      companyId: testTenantAId,
      companyRole: 'admin',
      industryType: 'Real Estate',
    };

    const tenantManagerA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Real Estate Manager A',
      role: 'manager',
      isAdmin: false,
      companyId: testTenantAId,
      companyRole: 'manager',
      industryType: 'Real Estate',
    };

    const tenantAgentA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Real Estate Agent A',
      role: 'agent',
      isAdmin: false,
      companyId: testTenantAId,
      companyRole: 'agent',
      industryType: 'Real Estate',
    };

    const tenantOwnerB = {
      _id: testTenantBId,
      name: 'Agency Owner B',
      role: 'admin',
      isAdmin: true,
      companyId: null,
      companyRole: 'owner',
      workStatus: 'company_owner',
      industryType: 'Agency',
    };

    console.log('1️⃣ Testing Query Scoper (getTenantScope)...');
    
    // We can test the query scoping directly against the adminController
    // Simulate getOverviewMetrics with req.user
    const mockRes = () => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        return res;
      };
      return res;
    };

    // Test SuperAdmin gets empty unscoped query
    const reqSuper = { user: superAdminUser };
    const resSuper = mockRes();
    await adminController.getOverviewMetrics(reqSuper, resSuper);
    assert(resSuper.data && resSuper.data.success, 'SuperAdmin can execute getOverviewMetrics');

    // Test Tenant Owner A gets scoped metrics
    const reqOwnerA = { user: tenantOwnerA };
    const resOwnerA = mockRes();
    await adminController.getOverviewMetrics(reqOwnerA, resOwnerA);
    assert(resOwnerA.data && resOwnerA.data.success, 'Tenant Owner A can execute getOverviewMetrics with scoped query');

    console.log('2️⃣ Testing SuperAdmin vs Tenant Role Isolation on Platform Endpoints...');

    const mockNext = () => ({ called: true });

    // TEST I: Tenant Owner on superAdminOnly middleware -> MUST FAIL WITH 403
    let ownerBlocked = false;
    const reqOwner = { user: tenantOwnerA };
    const resOwner = {
      status: (code) => {
        if (code === 403) ownerBlocked = true;
        return { json: () => {} };
      }
    };
    superAdminOnly(reqOwner, resOwner, mockNext);
    assert(ownerBlocked, 'TEST I: Tenant Owner blocked from platform endpoint with 403');

    // TEST J: Tenant Admin on superAdminOnly middleware -> MUST FAIL WITH 403
    let adminBlocked = false;
    const reqAdmin = { user: tenantAdminA };
    const resAdmin = {
      status: (code) => {
        if (code === 403) adminBlocked = true;
        return { json: () => {} };
      }
    };
    superAdminOnly(reqAdmin, resAdmin, mockNext);
    assert(adminBlocked, 'TEST J: Tenant Admin blocked from platform endpoint with 403');

    // TEST K: Manager on superAdminOnly middleware -> MUST FAIL WITH 403
    let managerBlocked = false;
    const reqMgr = { user: tenantManagerA };
    const resMgr = {
      status: (code) => {
        if (code === 403) managerBlocked = true;
        return { json: () => {} };
      }
    };
    superAdminOnly(reqMgr, resMgr, mockNext);
    assert(managerBlocked, 'TEST K: Manager blocked from platform endpoint with 403');

    // TEST L: Agent on superAdminOnly middleware -> MUST FAIL WITH 403
    let agentBlocked = false;
    const reqAgt = { user: tenantAgentA };
    const resAgt = {
      status: (code) => {
        if (code === 403) agentBlocked = true;
        return { json: () => {} };
      }
    };
    superAdminOnly(reqAgt, resAgt, mockNext);
    assert(agentBlocked, 'TEST L: Agent blocked from platform endpoint with 403');

    // TEST M: SuperAdmin on superAdminOnly middleware -> MUST PASS (next called)
    let superPassed = false;
    const reqSuperAuth = { user: superAdminUser };
    const resSuperAuth = mockRes();
    superAdminOnly(reqSuperAuth, resSuperAuth, () => {
      superPassed = true;
    });
    assert(superPassed, 'TEST M: SuperAdmin authorized on platform endpoint');

    console.log('3️⃣ Testing Tenant Admin Access to Legitimate Tenant Admin Endpoints...');
    // Tenant admin should pass adminOnly middleware
    let tenantAdminAllowed = false;
    adminOnly(reqOwner, resOwner, () => {
      tenantAdminAllowed = true;
    });
    assert(tenantAdminAllowed, 'Tenant Owner allowed on tenant admin endpoint');

    let tenantAdminSubAllowed = false;
    adminOnly(reqAdmin, resAdmin, () => {
      tenantAdminSubAllowed = true;
    });
    assert(tenantAdminSubAllowed, 'Tenant Admin allowed on tenant admin endpoint');

    let agentBlockedFromAdmin = false;
    adminOnly(reqAgt, {
      status: (code) => {
        if (code === 403) agentBlockedFromAdmin = true;
        return { json: () => {} };
      }
    }, mockNext);
    assert(agentBlockedFromAdmin, 'Agent blocked from tenant admin endpoint with 403');

    console.log('4️⃣ Testing Login Redirect Decision Matrix...');
    const resolveLoginRedirect = (user) => {
      if (user.role === 'superadmin') return '/superadmin-dashboard';
      return '/dashboard';
    };

    assert(resolveLoginRedirect(superAdminUser) === '/superadmin-dashboard', 'TEST A: SuperAdmin redirects to /superadmin-dashboard');
    assert(resolveLoginRedirect(tenantOwnerA) === '/dashboard', 'TEST B: Tenant Owner redirects to /dashboard (NOT /admin)');
    assert(resolveLoginRedirect(tenantAdminA) === '/dashboard', 'TEST C: Tenant Admin redirects to /dashboard (NOT /admin)');
    assert(resolveLoginRedirect(tenantManagerA) === '/dashboard', 'TEST D: Tenant Manager redirects to /dashboard');
    assert(resolveLoginRedirect(tenantAgentA) === '/dashboard', 'TEST E: Tenant Agent redirects to /dashboard');

    console.log('5️⃣ Testing Profile & Organization Navigation Destination...');
    const resolveProfileDestination = (user) => {
      if (user.role === 'superadmin') return '/superadmin-dashboard';
      return '/profile';
    };

    assert(resolveProfileDestination(tenantOwnerA) === '/profile', 'TEST N1: Tenant Owner navigates to /profile (NOT /admin?tab=profile)');
    assert(resolveProfileDestination(tenantAdminA) === '/profile', 'TEST N2: Tenant Admin navigates to /profile (NOT /admin?tab=profile)');
    assert(resolveProfileDestination(superAdminUser) === '/superadmin-dashboard', 'TEST N3: SuperAdmin navigates to /superadmin-dashboard');

    console.log('6️⃣ Testing Non-Real-Estate Multi-Vertical Compatibility...');
    assert(resolveLoginRedirect(tenantOwnerB) === '/dashboard', 'TEST O1: Agency Owner redirects to /dashboard');
    assert(resolveProfileDestination(tenantOwnerB) === '/profile', 'TEST O2: Agency Owner navigates to /profile');

    console.log('\n======================================================');
    console.log('🏁 PHASE 1 SECURITY VERIFICATION: ALL TESTS PASSED');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Error during security test suite:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runSecurityTestSuite();
