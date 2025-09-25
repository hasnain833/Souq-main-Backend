const express = require('express');
const router = express.Router();
const seoController = require('../controllers/seoController');

// SEO routes (public - no authentication required)
router.get('/sitemap.xml', seoController.generateSitemap);
router.get('/robots.txt', seoController.generateRobotsTxt);

module.exports = router;
