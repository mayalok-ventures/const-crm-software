/* global use, db */
// MongoDB Local Playground for Sahyak CRM
// Connects to local MongoDB server on 127.0.0.1:27017
// Click the "Play" (▶) button at top-right to execute.

// 1. Select the database to use.
use('mobile-crm');

// 2. Query summary metrics across the database collections.
console.log('=== LOCAL CORESETU CRM DATABASE (127.0.0.1:27017/mobile-crm) ===');

const totalLeads = db.getCollection('leads').countDocuments();
const totalUsers = db.getCollection('users').countDocuments();
const totalPlans = db.getCollection('plans').countDocuments();
const totalIntegrations = db.getCollection('integrations').countDocuments();

console.log(`- Total Leads: ${totalLeads}`);
console.log(`- Total Users: ${totalUsers}`);
console.log(`- Total Active Plans: ${totalPlans}`);
console.log(`- Total Integrations: ${totalIntegrations}`);

// 3. Inspect registered users & plans
db.getCollection('users').find({}, { name: 1, email: 1, role: 1, isAdmin: 1 }).toArray();
