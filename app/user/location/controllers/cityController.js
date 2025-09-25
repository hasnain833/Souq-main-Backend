const City = require('../../../../db/models/cityModel');
const Country = require('../../../../db/models/countryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get cities by country ID
const getCitiesByCountry = async (req, res) => {
  try {
    const { countryId } = req.params;
    
    console.log('🏙️ Fetching cities for country ID:', countryId);
    
    // Verify country exists and is active
    const country = await Country.findById(countryId);
    if (!country || !country.isActive) {
      return errorResponse(res, 'Country not found or inactive', 404);
    }
    
    const cities = await City.getCitiesByCountry(countryId);
    
    console.log(`✅ Found ${cities.length} cities for ${country.name}`);
    
    return successResponse(res, 'Cities fetched successfully', {
      cities: cities.map(city => ({
        _id: city._id,
        name: city.name,
        state: city.state,
        fullLocation: city.fullLocation,
        isCapital: city.isCapital,
        population: city.population
      })),
      country: {
        _id: country._id,
        name: country.name,
        code: country.code
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching cities by country:', error);
    return errorResponse(res, 'Failed to fetch cities', 500);
  }
};

// Get cities by country code
const getCitiesByCountryCode = async (req, res) => {
  try {
    const { countryCode } = req.params;
    
    console.log('🏙️ Fetching cities for country code:', countryCode);
    
    // Verify country exists and is active
    const country = await Country.findByCode(countryCode);
    if (!country) {
      return errorResponse(res, 'Country not found', 404);
    }
    
    const cities = await City.getCitiesByCountryCode(countryCode);
    
    console.log(`✅ Found ${cities.length} cities for ${country.name}`);
    
    return successResponse(res, 'Cities fetched successfully', {
      cities: cities.map(city => ({
        _id: city._id,
        name: city.name,
        state: city.state,
        fullLocation: city.fullLocation,
        isCapital: city.isCapital,
        population: city.population
      })),
      country: {
        _id: country._id,
        name: country.name,
        code: country.code
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching cities by country code:', error);
    return errorResponse(res, 'Failed to fetch cities', 500);
  }
};

// Search cities
const searchCities = async (req, res) => {
  try {
    const { q, countryId } = req.query;
    
    if (!q || q.trim().length < 2) {
      return errorResponse(res, 'Search query must be at least 2 characters', 400);
    }
    
    console.log('🏙️ Searching cities with query:', q, 'Country ID:', countryId);
    
    let cities;
    if (countryId) {
      // Search within specific country
      cities = await City.searchCities(q, countryId);
    } else {
      // Global city search
      cities = await City.find({
        name: { $regex: q, $options: 'i' },
        isActive: true
      }).populate('country', 'name code flag').sort({ 
        isCapital: -1, 
        population: -1, 
        name: 1 
      }).limit(50);
    }
    
    console.log(`✅ Found ${cities.length} cities matching query`);
    
    return successResponse(res, 'Cities search completed', {
      cities: cities.map(city => ({
        _id: city._id,
        name: city.name,
        state: city.state,
        fullLocation: city.fullLocation,
        isCapital: city.isCapital,
        population: city.population,
        country: city.country ? {
          _id: city.country._id,
          name: city.country.name,
          code: city.country.code,
          flag: city.country.flag
        } : null
      }))
    });
    
  } catch (error) {
    console.error('❌ Error searching cities:', error);
    return errorResponse(res, 'Failed to search cities', 500);
  }
};

// Get city by ID
const getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🏙️ Fetching city by ID:', id);
    
    const city = await City.findById(id).populate('country', 'name code flag dialCode');
    
    if (!city) {
      return errorResponse(res, 'City not found', 404);
    }
    
    if (!city.isActive) {
      return errorResponse(res, 'City is not active', 400);
    }
    
    console.log('✅ City found:', city.name);
    
    return successResponse(res, 'City fetched successfully', {
      city: {
        _id: city._id,
        name: city.name,
        state: city.state,
        fullLocation: city.fullLocation,
        isCapital: city.isCapital,
        population: city.population,
        latitude: city.latitude,
        longitude: city.longitude,
        country: city.country ? {
          _id: city.country._id,
          name: city.country.name,
          code: city.country.code,
          flag: city.country.flag,
          dialCode: city.country.dialCode
        } : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching city:', error);
    return errorResponse(res, 'Failed to fetch city', 500);
  }
};

module.exports = {
  getCitiesByCountry,
  getCitiesByCountryCode,
  searchCities,
  getCityById
};
