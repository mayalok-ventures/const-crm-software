const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://mayalokventures:Mflica2026crm@cluster0.j988j68.mongodb.net/mobile-crm?retryWrites=true&w=majority';

async function initCleanProductionDb() {
  console.log('====================================================');
  console.log('🚀 INITIALIZING CLEAN PRODUCTION DATABASE: mobile-crm');
  console.log('====================================================');

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Connected to MongoDB Atlas: ${conn.connection.host}`);
    console.log(`✅ Target Database Name: ${conn.connection.db.databaseName}`);

    const db = conn.connection.db;

    // 1. Clean / Drop old "test" database if requested
    try {
      const testDb = conn.connection.client.db('test');
      const testCollections = await testDb.listCollections().toArray();
      if (testCollections.length > 0) {
        console.log(`🧹 Dropping old test database collections: ${testCollections.map(c => c.name).join(', ')}...`);
        await testDb.dropDatabase();
        console.log('✅ Old test database dropped successfully!');
      }
    } catch (e) {
      console.log('Note on test db drop:', e.message);
    }

    // 2. Initialize Clean Collections in "mobile-crm"
    const collectionsToCreate = [
      'users',
      'leads',
      'pipelines',
      'plans',
      'integrations',
      'broadcasts',
      'templates',
      'groups',
      'payments',
      'auditlogs'
    ];

    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    for (const colName of collectionsToCreate) {
      if (!existingCollections.includes(colName)) {
        await db.createCollection(colName);
        console.log(`✅ Created collection: mobile-crm.${colName}`);
      } else {
        console.log(`ℹ️ Collection mobile-crm.${colName} already exists`);
      }
    }

    // 3. Create High-Scale Compound Indexes in "mobile-crm.leads"
    const leadsCollection = db.collection('leads');
    await leadsCollection.createIndex({ userId: 1, createdAt: -1 });
    await leadsCollection.createIndex({ userId: 1, deletedAt: 1, status: 1 });
    await leadsCollection.createIndex({ userId: 1, deletedAt: 1, createdAt: -1 });
    await leadsCollection.createIndex({ companyId: 1, deletedAt: 1, status: 1 });
    await leadsCollection.createIndex({ companyId: 1, deletedAt: 1, createdAt: -1 });
    await leadsCollection.createIndex({ assignedTo: 1, deletedAt: 1, status: 1 });
    await leadsCollection.createIndex({ assignedTo: 1, deletedAt: 1, createdAt: -1 });
    await leadsCollection.createIndex({ sharedWithCompanyId: 1, deletedAt: 1 });
    await leadsCollection.createIndex({ followUpDate: 1, deletedAt: 1 });
    await leadsCollection.createIndex({ 'leadActivities.timestamp': -1 });
    console.log('✅ High-scale compound indexes built on mobile-crm.leads');

    // 4. Seed Clean Production Default Pipeline Stages
    const pipelinesCollection = db.collection('pipelines');
    const defaultPipelineCount = await pipelinesCollection.countDocuments({ isDefault: true });
    if (defaultPipelineCount === 0) {
      await pipelinesCollection.insertOne({
        name: 'Default Sales Pipeline',
        isDefault: true,
        stages: [
          { id: 'new_lead', name: 'New Lead', color: '#3B82F6', order: 0 },
          { id: 'contacted', name: 'Contacted', color: '#EAB308', order: 1 },
          { id: 'follow_up', name: 'Follow Up', color: '#F97316', order: 2 },
          { id: 'site_visit', name: 'Site Visit / Demo', color: '#8B5CF6', order: 3 },
          { id: 'negotiation', name: 'Negotiation', color: '#EC4899', order: 4 },
          { id: 'closed_won', name: 'Deal Won', color: '#10B981', order: 5 },
          { id: 'closed_lost', name: 'Deal Lost', color: '#EF4444', order: 6 },
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Default Sales Pipeline stages initialized in mobile-crm.pipelines');
    }

    // 5. Seed Clean Super Admin User
    const usersCollection = db.collection('users');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@coresetu.com';
    const existingAdmin = await usersCollection.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', salt);

      await usersCollection.insertOne({
        name: 'Sahyak Super Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'superadmin',
        isAdmin: true,
        workStatus: 'company_owner',
        companyRole: 'owner',
        isActive: true,
        plan: 'enterprise',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Super Admin created in mobile-crm.users: ${adminEmail}`);
    } else {
      console.log(`ℹ️ Super Admin already exists in mobile-crm.users: ${adminEmail}`);
    }

    // 6. Summary of clean database state
    const summary = {
      database: db.databaseName,
      totalUsers: await usersCollection.countDocuments(),
      totalLeads: await leadsCollection.countDocuments(),
      totalPipelines: await pipelinesCollection.countDocuments(),
      totalIntegrations: await db.collection('integrations').countDocuments()
    };

    console.log('\n====================================================');
    console.log('🎉 mobile-crm PRODUCTION DATABASE READY & VERIFIED:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize clean database:', error.message);
    process.exit(1);
  }
}

initCleanProductionDb();
