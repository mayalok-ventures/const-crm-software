const express = require('express');
const router = express.Router();
const {
  seedMasterCatalogue,
  getMasterColleges,
  getMasterCollegeById,
  importCollegeToCatalogue,
  getMyCatalogue,
  getTenantCatalogueItem,
  updateTenantCatalogueItem,
  deleteTenantCatalogueItem,
} = require('../controllers/catalogueController');
const { protect, checkPlanExpiry } = require('../middleware/auth');

router.use(protect);

// Master Repository (Read-only browsing for all tenants)
router.post('/seed-master', seedMasterCatalogue);
router.get('/master-colleges', getMasterColleges);
router.get('/master-colleges/:id', getMasterCollegeById);

// 1-Click Import into Tenant Catalogue
router.post('/import/:collegeId', checkPlanExpiry, importCollegeToCatalogue);

// Tenant Customized Catalogue
router.route('/my-catalogue')
  .get(getMyCatalogue);

router.route('/my-catalogue/:id')
  .get(getTenantCatalogueItem)
  .put(checkPlanExpiry, updateTenantCatalogueItem)
  .delete(checkPlanExpiry, deleteTenantCatalogueItem);

module.exports = router;
