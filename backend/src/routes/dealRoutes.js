const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

// List all deals
router.get('/', requirePermission('deals.view'), dealController.getDeals);

// Financial / commission summary
router.get('/summary/commission', requirePermission('commission.view'), dealController.getCommissionSummary);

// Single deal details
router.get('/:id', requirePermission('deals.view'), dealController.getDealById);

// Create new admission deal
router.post('/', requirePermission('deals.create'), dealController.createDeal);

// Update deal (status, student details, commission info)
router.put('/:id', requirePermission('deals.edit'), dealController.updateDeal);

// Cancel / void deal with audit preservation
router.post('/:id/cancel', requirePermission('deals.edit'), dealController.cancelDeal);

// Delete deal (with settled commission protection)
router.delete('/:id', requirePermission('deals.delete'), dealController.deleteDeal);

module.exports = router;
