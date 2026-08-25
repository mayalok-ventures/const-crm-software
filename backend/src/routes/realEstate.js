const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  scoreLead,
  matchProperties,
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getOpportunities,
  createOpportunity,
  updateOpportunityStage,
  getInventory,
  createInventory,
  updateInventoryStatus,
  getEOIs,
  createEOI,
  getBookings,
  createBooking,
  getBookingPaymentSchedule,
  recordPaymentReceipt,
  getRealEstateAnalytics,
} = require('../controllers/realEstateController');

// All Real Estate routes require authentication
router.use(protect);

// Lead Scoring & Temperature Engine
router.post('/leads/:id/score', scoreLead);

// Property Matching Engine
router.post('/match-properties', matchProperties);

// Requirements
router.route('/requirements')
  .get(getRequirements)
  .post(createRequirement);

router.route('/requirements/:id')
  .put(updateRequirement)
  .delete(deleteRequirement);

// Opportunities / Deals
router.route('/opportunities')
  .get(getOpportunities)
  .post(createOpportunity);

router.patch('/opportunities/:id/stage', updateOpportunityStage);

// Inventory
router.route('/inventory')
  .get(getInventory)
  .post(createInventory);

router.patch('/inventory/:id/status', updateInventoryStatus);

// Expressions of Interest (EOI)
router.route('/eois')
  .get(getEOIs)
  .post(createEOI);

// Bookings & Payment Schedules
router.route('/bookings')
  .get(getBookings)
  .post(createBooking);

router.get('/bookings/:id/payment-schedule', getBookingPaymentSchedule);
router.post('/bookings/schedules/:scheduleId/payments', recordPaymentReceipt);

// Analytics
router.get('/analytics/summary', getRealEstateAnalytics);

module.exports = router;
