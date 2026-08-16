require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function runTests() {
  console.log("\n🔍 STARTING DIAGNOSTICS...\n");

  // 1. Test MongoDB
  try {
    console.log("⏳ Testing MongoDB Connection...");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB: Connected Successfully!");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
  }

  // 2. Test Cloudinary
  try {
    console.log("\n⏳ Testing Cloudinary Upload...");
    const dummyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const uploadRes = await cloudinary.uploader.upload(dummyImage, { folder: "test_crm" });
    console.log("✅ Cloudinary: Upload Successful!");
    console.log("🖼️  Test Image URL:", uploadRes.secure_url);
  } catch (err) {
    console.error("❌ Cloudinary Error:", err.message);
  }

  console.log("\n🏁 Diagnostics Complete.");
  process.exit(0);
}
runTests();
