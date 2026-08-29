const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  scoreLead,
  matchProperties,
  getRequirements,
  createRequirement,
  updateRequirement,
  toggleRequirementStatus,
  deleteRequirement,
  getOpportunities,
  createOpportunity,
  updateOpportunityStage,
  deleteOpportunity,
  getInventory,
  createInventory,
  bulkCreateInventory,
  updateInventoryStatus,
  holdInventoryUnit,
  releaseInventoryHold,
  releaseExpiredHolds,
  getEOIs,
  createEOI,
  confirmEOI,
  cancelEOI,
  getBookings,
  createBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingPaymentSchedule,
  recordPaymentReceipt,
  getPaymentsSummary,
  getOffers,
  createOffer,
  deleteOffer,
  getRealEstateAnalytics,
  getManagerTeamMembers,
  getManagerTeamPerformance,
  getManagerTeamWorkload,
} = require('../controllers/realEstateController');

// All Real Estate routes require authentication
router.use(protect);

// 1. Lead Scoring & Temperature Engine
router.post('/leads/:id/score', scoreLead);

// 2. Property Matching Engine
router.post('/match-properties', matchProperties);

// 3. Requirements
router.route('/requirements')
  .get(getRequirements)
  .post(createRequirement);

router.route('/requirements/:id')
  .put(updateRequirement)
  .delete(deleteRequirement);

router.patch('/requirements/:id/status', toggleRequirementStatus);

// 4. Opportunities / Deals
router.route('/opportunities')
  .get(getOpportunities)
  .post(createOpportunity);

router.patch('/opportunities/:id/stage', updateOpportunityStage);
router.delete('/opportunities/:id', deleteOpportunity);

// 5. Inventory & Atomic Concurrency Hold/Release
router.route('/inventory')
  .get(getInventory)
  .post(createInventory);

router.post('/inventory/bulk', bulkCreateInventory);
router.patch('/inventory/:id/status', updateInventoryStatus);
router.post('/inventory/:id/hold', holdInventoryUnit);
router.post('/inventory/:id/release', releaseInventoryHold);
router.post('/inventory/release-expired-holds', releaseExpiredHolds);

// 6. Expressions of Interest (EOI)
router.route('/eois')
  .get(getEOIs)
  .post(createEOI);

router.post('/eois/:id/confirm', confirmEOI);
router.post('/eois/:id/cancel', cancelEOI);

// 7. Bookings, Cancellation & Agreement Status
router.route('/bookings')
  .get(getBookings)
  .post(createBooking);

router.patch('/bookings/:id/status', updateBookingStatus);
router.post('/bookings/:id/cancel', cancelBooking);

// 8. Payment Schedules & Receipts
router.get('/bookings/:id/payment-schedule', getBookingPaymentSchedule);
router.post('/bookings/schedules/:scheduleId/payments', recordPaymentReceipt);
router.get('/payments/summary', getPaymentsSummary);

// 9. Offers & Schemes
router.route('/offers')
  .get(getOffers)
  .post(createOffer);

router.delete('/offers/:id', deleteOffer);

// 10. Analytics
router.get('/analytics/summary', getRealEstateAnalytics);

// 11. Team Management, Workload & Performance
router.get('/team/members', getManagerTeamMembers);
router.get('/team/performance', getManagerTeamPerformance);
router.get('/team/workload', getManagerTeamWorkload);

module.exports = router;
