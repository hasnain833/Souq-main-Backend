const Country = require('../../../../db/models/countryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all active countries
const getCountries = async (req, res) => {
  try {
    console.log('📍 Fetching all active countries...');
    
    const countries = await Country.getActiveCountries();
    
    console.log(`✅ Found ${countries.length} active countries`);
    
    return successResponse(res, 'Countries fetched successfully', {
      countries: countries.map(country => ({
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        displayName: country.displayName
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    return errorResponse(res, 'Failed to fetch countries', 500);
  }
};

// Get country by ID
const getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📍 Fetching country by ID:', id);
    
    const country = await Country.findById(id);
    
    if (!country) {
      return errorResponse(res, 'Country not found', 404);
    }
    
    if (!country.isActive) {
      return errorResponse(res, 'Country is not active', 400);
    }
    
    console.log('✅ Country found:', country.name);
    
    return successResponse(res, 'Country fetched successfully', {
      country: {
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        displayName: country.displayName
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching country:', error);
    return errorResponse(res, 'Failed to fetch country', 500);
  }
};

// Get country by code
const getCountryByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    console.log('📍 Fetching country by code:', code);
    
    const country = await Country.findByCode(code);
    
    if (!country) {
      return errorResponse(res, 'Country not found', 404);
    }
    
    console.log('✅ Country found:', country.name);
    
    return successResponse(res, 'Country fetched successfully', {
      country: {
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        displayName: country.displayName
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching country by code:', error);
    return errorResponse(res, 'Failed to fetch country', 500);
  }
};

// Search countries
const searchCountries = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return errorResponse(res, 'Search query must be at least 2 characters', 400);
    }
    
    console.log('📍 Searching countries with query:', q);
    
    const countries = await Country.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    }).sort({ name: 1 }).limit(20);
    
    console.log(`✅ Found ${countries.length} countries matching query`);
    
    return successResponse(res, 'Countries search completed', {
      countries: countries.map(country => ({
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        displayName: country.displayName
      }))
    });
    
  } catch (error) {
    console.error('❌ Error searching countries:', error);
    return errorResponse(res, 'Failed to search countries', 500);
  }
};

module.exports = {
  getCountries,
  getCountryById,
  getCountryByCode,
  searchCountries
};
