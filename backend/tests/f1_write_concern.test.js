const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.2: Explicit Majority and Journal Write Concern', () => {
  it('Payment, FeeInstallment, and AdmissionDeal schemas must have explicit w:majority and j:true write concern', async () => {
    const Payment = require('../src/models/Payment');
    const FeeInstallment = require('../src/models/FeeInstallment');
    const AdmissionDeal = require('../src/models/AdmissionDeal');

    const paymentWc = Payment.schema.get('writeConcern') || Payment.schema.options.writeConcern;
    const feeWc = FeeInstallment.schema.get('writeConcern') || FeeInstallment.schema.options.writeConcern;
    const dealWc = AdmissionDeal.schema.get('writeConcern') || AdmissionDeal.schema.options.writeConcern;

    assert.ok(paymentWc, 'Payment schema must specify writeConcern');
    assert.strictEqual(paymentWc.w, 'majority', 'Payment writeConcern.w must be majority');
    assert.strictEqual(paymentWc.j, true, 'Payment writeConcern.j must be true');

    assert.ok(feeWc, 'FeeInstallment schema must specify writeConcern');
    assert.strictEqual(feeWc.w, 'majority', 'FeeInstallment writeConcern.w must be majority');
    assert.strictEqual(feeWc.j, true, 'FeeInstallment writeConcern.j must be true');

    assert.ok(dealWc, 'AdmissionDeal schema must specify writeConcern');
    assert.strictEqual(dealWc.w, 'majority', 'AdmissionDeal writeConcern.w must be majority');
    assert.strictEqual(dealWc.j, true, 'AdmissionDeal writeConcern.j must be true');
  });
});
