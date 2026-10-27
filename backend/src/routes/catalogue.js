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
  sendFeeStructureOnWhatsApp,
  getCatalogue,
} = require('../controllers/catalogueController');
const { protect, checkPlanExpiry, superAdminOnly } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

// Unified Catalogue Route (Dropdowns & Modals)
router.get('/', getCatalogue);

// Master Repository (Browse & search with high-scale pagination)
router.post('/seed-master', superAdminOnly, seedMasterCatalogue);
router.get('/master-colleges', requirePermission('catalogue.view_master'), getMasterColleges);
router.get('/master-colleges/:id', requirePermission('catalogue.view_master'), getMasterCollegeById);

// 1-Click Import into Tenant Catalogue
router.post('/import/:collegeId', requirePermission('catalogue.manage_workspace'), checkPlanExpiry, importCollegeToCatalogue);

// PHASE 3: Custom Institution Creator
router.post('/custom', requirePermission('catalogue.manage_workspace'), checkPlanExpiry, createCustomInstitution);

// Tenant Customized Catalogue Main Route
router.route('/my-catalogue')
  .get(getMyCatalogue);

router.route('/my-catalogue/:id')
  .get(getTenantCatalogueItem)
  .put(requirePermission('catalogue.manage_workspace'), checkPlanExpiry, updateTenantCatalogueItem)
  .delete(requirePermission('catalogue.manage_workspace'), checkPlanExpiry, deleteTenantCatalogueItem);

// PHASE 2: Deep Drill-Down Degree & Specialization Management Routes
router.put('/my-catalogue/:id/info', requirePermission('catalogue.manage_workspace'), checkPlanExpiry, updateTenantCatalogueInfo);
router.post('/my-catalogue/:id/degrees', requirePermission('catalogue.edit_fees'), checkPlanExpiry, addDegreeToCatalogueItem);
router.put('/my-catalogue/:id/degrees/:degreeName', requirePermission('catalogue.edit_fees'), checkPlanExpiry, updateDegreeInCatalogueItem);
router.delete('/my-catalogue/:id/degrees/:degreeName', requirePermission('catalogue.edit_fees'), checkPlanExpiry, deleteDegreeFromCatalogueItem);
router.post('/my-catalogue/:id/specializations', requirePermission('catalogue.edit_fees'), checkPlanExpiry, addSpecializationToCatalogueItem);
router.put('/my-catalogue/:id/courses/:courseId', requirePermission('catalogue.edit_fees'), checkPlanExpiry, updateCourseInCatalogueItem);
router.delete('/my-catalogue/:id/courses/:courseId', requirePermission('catalogue.edit_fees'), checkPlanExpiry, deleteCourseFromCatalogueItem);

// PHASE 4: WhatsApp Direct Fee Structure Dispatch
router.post('/send-fee-structure-whatsapp', requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendFeeStructureOnWhatsApp);

module.exports = router;
