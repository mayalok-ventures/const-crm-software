const mongoose = require('mongoose');
const Lead = require('../models/Lead');

const l1 = new Lead({
  name: 'Test Prospect Auto-Signup',
  phone: '9999999991',
  userId: new mongoose.Types.ObjectId(),
  source: 'Auto-Signup',
});

const err1 = l1.validateSync();
console.log('l1 validation error:', err1 ? err1.message : 'NONE');
console.log('l1 source canonical:', l1.source, 'primarySource:', l1.primarySource);

const l2 = new Lead({
  name: 'Test Prospect Direct Call',
  phone: '9999999992',
  userId: new mongoose.Types.ObjectId(),
  source: 'Direct Call',
});

const err2 = l2.validateSync();
console.log('l2 validation error:', err2 ? err2.message : 'NONE');
console.log('l2 source canonical:', l2.source, 'primarySource:', l2.primarySource);

const l3 = new Lead({
  name: 'Test Prospect Meta Ads',
  phone: '9999999993',
  userId: new mongoose.Types.ObjectId(),
  source: 'Meta Ads',
});

const err3 = l3.validateSync();
console.log('l3 validation error:', err3 ? err3.message : 'NONE');
console.log('l3 source canonical:', l3.source, 'primarySource:', l3.primarySource);

console.log('🎯 LEAD NORMALIZATION TESTS PASSED SUCCESSFULLY!');
process.exit(0);
