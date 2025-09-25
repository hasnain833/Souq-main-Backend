const express = require('express');
const router = express.Router();

// Import controllers
const countryController = require('../controllers/countryController');
const cityController = require('../controllers/cityController');

// Country routes (public - no authentication required)
router.get('/countries', countryController.getCountries);
router.get('/countries/search', countryController.searchCountries);
router.get('/countries/:id', countryController.getCountryById);
router.get('/countries/code/:code', countryController.getCountryByCode);

// City routes (public - no authentication required)
router.get('/cities/country/:countryId', cityController.getCitiesByCountry);
router.get('/cities/country-code/:countryCode', cityController.getCitiesByCountryCode);
router.get('/cities/search', cityController.searchCities);
router.get('/cities/:id', cityController.getCityById);

module.exports = router;
