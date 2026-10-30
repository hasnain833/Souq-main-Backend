const express = require('express');
const router = express.Router();
const countryController = require('../controllers/countryController');
const cityController = require('../controllers/cityController');
const { verifyAdminToken, checkPermission } = require('../../auth/middleware/adminAuthMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// Country routes (temporarily without permission checks for testing)
router.get('/countries', countryController.getAllCountries);
router.get('/countries/stats', countryController.getCountryStats);
router.get('/countries/:id', countryController.getCountryById);
router.post('/countries', countryController.createCountry);
router.put('/countries/:id', countryController.updateCountry);
router.delete('/countries/:id', countryController.deleteCountry);

// City routes (temporarily without permission checks for testing)
router.get('/cities', cityController.getAllCities);
router.get('/cities/stats', cityController.getCityStats);
router.get('/cities/:id', cityController.getCityById);
router.post('/cities', cityController.createCity);
router.put('/cities/:id', cityController.updateCity);
router.delete('/cities/:id', cityController.deleteCity);

module.exports = router;
