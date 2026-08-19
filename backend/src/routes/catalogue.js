const express = require('express');
const router = express.Router();
const {
  seedMasterCatalogue,
  getMasterColleges,
  getMasterCollegeById,
  importCollegeToCatalogue,
  createCustomInstitution,
  getMyCatalogue,
  getTenantCatalogueItem,
  updateTenantCatalogueInfo,
  addDegreeToCatalogueItem,
  updateDegreeInCatalogueItem,
  deleteDegreeFromCatalogueItem,
  addSpecializationToCatalogueItem,
  updateCourseInCatalogueItem,
  deleteCourseFromCatalogueItem,
  updateTenantCatalogueItem,
  deleteTenantCatalogueItem,
} = require('../controllers/catalogueController');
const { protect, checkPlanExpiry } = require('../middleware/auth');

router.use(protect);

// Master Repository (Browse & search with high-scale pagination)
router.post('/seed-master', seedMasterCatalogue);
router.get('/master-colleges', getMasterColleges);
router.get('/master-colleges/:id', getMasterCollegeById);

// 1-Click Import into Tenant Catalogue
router.post('/import/:collegeId', checkPlanExpiry, importCollegeToCatalogue);

// PHASE 3: Custom Institution Creator
router.post('/custom', checkPlanExpiry, createCustomInstitution);

// Tenant Customized Catalogue Main Route
router.route('/my-catalogue')
  .get(getMyCatalogue);

router.route('/my-catalogue/:id')
  .get(getTenantCatalogueItem)
  .put(checkPlanExpiry, updateTenantCatalogueItem)
  .delete(checkPlanExpiry, deleteTenantCatalogueItem);

// PHASE 2: Deep Drill-Down Degree & Specialization Management Routes
router.put('/my-catalogue/:id/info', checkPlanExpiry, updateTenantCatalogueInfo);
router.post('/my-catalogue/:id/degrees', checkPlanExpiry, addDegreeToCatalogueItem);
router.put('/my-catalogue/:id/degrees/:degreeName', checkPlanExpiry, updateDegreeInCatalogueItem);
router.delete('/my-catalogue/:id/degrees/:degreeName', checkPlanExpiry, deleteDegreeFromCatalogueItem);
router.post('/my-catalogue/:id/specializations', checkPlanExpiry, addSpecializationToCatalogueItem);
router.put('/my-catalogue/:id/courses/:courseId', checkPlanExpiry, updateCourseInCatalogueItem);
router.delete('/my-catalogue/:id/courses/:courseId', checkPlanExpiry, deleteCourseFromCatalogueItem);

module.exports = router;
