require('dotenv').config();
const connectDB = require('../config/db');
const { buildFastifyApp } = require('./app');

async function start() {
  await connectDB();
  const app = buildFastifyApp({ logger: true });
  const PORT = process.env.FASTIFY_PORT || process.env.PORT || 5000;

  try {
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`⚡ [Fastify] High-Performance CRM Backend running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { start, buildFastifyApp };
