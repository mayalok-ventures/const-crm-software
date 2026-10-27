const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');
const c = require('../controllers/campaignController');
const inbound = require('../controllers/inboundCampaignController');

router.use(protect);
router.use(resolveWorkspace);

// Available source integrations & workspace counselors for campaign routing setup
router.get('/integrations/available-sources', requirePermission('campaigns.view'), inbound.getAvailableSources);

// Inbound Campaign Registry Endpoints
router.get('/inbound', requirePermission('campaigns.view'), inbound.getInboundCampaigns);
router.patch('/inbound/:id', requirePermission('campaigns.cancel'), inbound.updateCampaign);

// Campaign Operations
router.get('/', requirePermission('campaigns.view'), c.getCampaigns);
router.post('/', requirePermission('campaigns.launch'), c.createCampaign);

// Specific Campaign Details & Lead Attribution Tracking
router.get('/:id', requirePermission('campaigns.view'), c.getCampaign);
router.put('/:id', requirePermission('campaigns.launch'), inbound.updateCampaign);
router.patch('/:id', requirePermission('campaigns.launch'), inbound.updateCampaign);
router.patch('/:id/toggle', requirePermission('campaigns.cancel'), inbound.toggleCampaignStatus);
router.put('/:id/toggle', requirePermission('campaigns.cancel'), inbound.toggleCampaignStatus);
router.get('/:id/leads', requirePermission('campaigns.view'), inbound.getCampaignLeads);

router.post('/:id/pause', requirePermission('campaigns.cancel'), c.pauseCampaign);
router.post('/:id/resume', requirePermission('campaigns.launch'), c.resumeCampaign);
router.delete('/:id', requirePermission('campaigns.cancel'), c.cancelCampaign);
router.get('/:id/logs', requirePermission('campaigns.view'), c.getCampaignLogs);

module.exports = router;
