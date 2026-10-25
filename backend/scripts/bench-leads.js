const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');

async function runBenchmark() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  console.log(`Connecting to: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  // Find or create test benchmark workspace and owner
  let user = await User.findOne({ email: 'bench_owner@example.com' });
  if (!user) {
    user = await User.create({
      name: 'Benchmark Owner',
      email: 'bench_owner@example.com',
      phone: '9999900001',
      password: 'BenchmarkPassword123!',
      role: 'owner',
      workStatus: 'company_owner',
      industryType: 'Education',
    });
  }

  let workspace = await Workspace.findOne({ ownerId: user._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: 'Benchmark Workspace',
      ownerId: user._id,
      industryType: 'Education',
    });
  }

  const existingLeads = await Lead.countDocuments({ workspaceId: workspace._id });
  console.log(`Current benchmark leads in workspace: ${existingLeads}`);

  if (existingLeads < 10000) {
    const needed = 10000 - existingLeads;
    console.log(`Seeding ${needed} benchmark leads (idempotent)...`);
    const batchSize = 1000;
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Ananya', 'Riya', 'Navya', 'Sneha'];
    const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Mishra', 'Joshi', 'Mehta', 'Nair', 'Bose', 'Das', 'Pandey', 'Yadav'];
    const courses = ['B.Tech CSE', 'MBA Finance', 'MBBS Abroad', 'BBA International', 'B.Sc Data Science', 'M.Tech AI'];
    const cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'];
    const statuses = ['new_lead', 'contacted', 'interested', 'application_started', 'admitted', 'closed_lost'];

    for (let b = 0; b < Math.ceil(needed / batchSize); b++) {
      const docs = [];
      const currentBatchCount = Math.min(batchSize, needed - (b * batchSize));
      for (let i = 0; i < currentBatchCount; i++) {
        const idx = b * batchSize + i;
        const fn = firstNames[idx % firstNames.length];
        const ln = lastNames[(idx * 3) % lastNames.length];
        const city = cities[idx % cities.length];
        const course = courses[idx % courses.length];
        const status = statuses[idx % statuses.length];
        const phone = `98${String(10000000 + idx).padStart(8, '0')}`;

        docs.push({
          workspaceId: workspace._id,
          userId: user._id,
          name: `${fn} ${ln}`,
          phone,
          email: `lead_${idx}@benchtest.com`,
          company: `${course} Aspirant`,
          location: city,
          project: course,
          status,
          isTestLead: false,
          createdAt: new Date(Date.now() - (idx * 60000)),
          updatedAt: new Date(Date.now() - (idx * 30000)),
        });
      }
      await Lead.insertMany(docs, { ordered: false });
      process.stdout.write(`Seeded ${(b + 1) * batchSize > needed ? needed : (b + 1) * batchSize}/${needed} leads...\r`);
    }
    console.log('\nSeeding complete.');
  }

  const totalLeads = await Lead.countDocuments({ workspaceId: workspace._id });
  console.log(`Total benchmark leads ready: ${totalLeads}`);

  console.log('\n--- 1. EXPLAIN ANALYSIS: Standard List Query (Page 1: workspaceId + sort updatedAt -1 + limit 25) ---');
  const listExplain = await Lead.find({
    workspaceId: workspace._id
  })
    .sort({ updatedAt: -1 })
    .skip(0)
    .limit(25)
    .explain('executionStats');

  const listStats = listExplain.executionStats;
  console.log(`Stage: ${listExplain.queryPlanner?.winningPlan?.stage || listExplain.queryPlanner?.winningPlan?.inputStage?.stage}`);
  console.log(`docsExamined: ${listStats.totalDocsExamined}, nReturned: ${listStats.nReturned}`);
  console.log(`executionTimeMillis: ${listStats.executionTimeMillis} ms`);

  console.log('\n--- 2. EXPLAIN ANALYSIS: Regex Search Query (search: "Aarav" case-insensitive RegExp) ---');
  const searchRegex = new RegExp('Aarav', 'i');
  const searchExplain = await Lead.find({
    $and: [
      { workspaceId: workspace._id },
      {
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { company: searchRegex },
          { project: searchRegex },
          { location: searchRegex }
        ]
      }
    ]
  })
    .sort({ updatedAt: -1 })
    .skip(0)
    .limit(25)
    .explain('executionStats');

  const searchStats = searchExplain.executionStats;
  console.log(`Stage: ${searchExplain.queryPlanner?.winningPlan?.stage || searchExplain.queryPlanner?.winningPlan?.inputStage?.stage}`);
  console.log(`docsExamined: ${searchStats.totalDocsExamined}, nReturned: ${searchStats.nReturned}`);
  console.log(`executionTimeMillis: ${searchStats.executionTimeMillis} ms`);

  console.log('\n--- 3. TIMING BENCHMARKS (10 runs average) ---');
  // Benchmark 1: GET Leads Page 1
  let sumP1 = 0;
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await Lead.find({ workspaceId: workspace._id })
      .select('-leadActivities -editHistory')
      .sort({ updatedAt: -1 })
      .skip(0)
      .limit(25)
      .lean();
    sumP1 += (performance.now() - t0);
  }
  console.log(`Avg Lead List Page 1 Query Time: ${(sumP1 / 10).toFixed(2)} ms`);

  // Benchmark 2: GET Leads Page 2
  let sumP2 = 0;
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await Lead.find({ workspaceId: workspace._id })
      .select('-leadActivities -editHistory')
      .sort({ updatedAt: -1 })
      .skip(25)
      .limit(25)
      .lean();
    sumP2 += (performance.now() - t0);
  }
  console.log(`Avg Lead List Page 2 Query Time: ${(sumP2 / 10).toFixed(2)} ms`);

  // Benchmark 3: Search Query with countDocuments
  let sumSearch = 0;
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const q = {
      $and: [
        { workspaceId: workspace._id },
        {
          $or: [
            { name: searchRegex },
            { phone: searchRegex },
            { company: searchRegex },
            { project: searchRegex },
            { location: searchRegex }
          ]
        }
      ]
    };
    await Promise.all([
      Lead.find(q)
        .select('-leadActivities -editHistory')
        .sort({ updatedAt: -1 })
        .skip(0)
        .limit(25)
        .lean(),
      Lead.countDocuments(q)
    ]);
    sumSearch += (performance.now() - t0);
  }
  console.log(`Avg Lead Search + Count Query Time: ${(sumSearch / 10).toFixed(2)} ms`);

  await mongoose.disconnect();
  console.log('\nBenchmark completed successfully.');
}

runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
