const express = require('express');
const router = express.Router();
const { signDirectUpload } = require('../controllers/mediaController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Endpoint to generate direct upload signature for Cloudinary
router.post('/sign-upload', signDirectUpload);

module.exports = router;
