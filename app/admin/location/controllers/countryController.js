const Country = require('../../../../db/models/countryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all countries with pagination and search
exports.getAllCountries = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    console.log('🌍 Admin fetching countries with params:', { page, limit, search, sortBy, sortOrder });
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { 'currency.name': { $regex: search, $options: 'i' } },
          { 'currency.code': { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get countries with pagination
    const countries = await Country.find(searchQuery)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const totalCountries = await Country.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCountries / limitNum);
    
    console.log(`✅ Found ${countries.length} countries (${totalCountries} total)`);
    
    return successResponse(res, 'Countries fetched successfully', {
      countries: countries.map(country => ({
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        isActive: country.isActive,
        sortOrder: country.sortOrder,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCountries,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    return errorResponse(res, 'Failed to fetch countries', 500);
  }
};

// Get country by ID
exports.getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🌍 Admin fetching country by ID:', id);
    
    const country = await Country.findById(id);
    
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
        isActive: country.isActive,
        sortOrder: country.sortOrder,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching country by ID:', error);
    return errorResponse(res, 'Failed to fetch country', 500);
  }
};

// Create new country
exports.createCountry = async (req, res) => {
  try {
    const { name, code, dialCode, flag, currency, isActive = true, sortOrder = 0 } = req.body;
    
    console.log('🌍 Admin creating country:', { name, code, dialCode });
    
    // Validation
    if (!name || !code || !dialCode || !currency) {
      return errorResponse(res, 'Name, code, dial code, and currency are required', 400);
    }
    
    if (!currency.code || !currency.name || !currency.symbol) {
      return errorResponse(res, 'Currency must include code, name, and symbol', 400);
    }
    
    // Check if country with same name or code already exists
    const existingCountry = await Country.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, 'i') } },
        { code: code.toUpperCase() }
      ]
    });
    
    if (existingCountry) {
      return errorResponse(res, 'Country with this name or code already exists', 400);
    }
    
    // Create new country
    const country = new Country({
      name: name.trim(),
      code: code.toUpperCase(),
      dialCode,
      flag: flag || '',
      currency: {
        code: currency.code.toUpperCase(),
        name: currency.name.trim(),
        symbol: currency.symbol.trim()
      },
      isActive,
      sortOrder: parseInt(sortOrder) || 0
    });
    
    await country.save();
    
    console.log('✅ Country created successfully:', country.name);
    
    return successResponse(res, 'Country created successfully', {
      country: {
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        isActive: country.isActive,
        sortOrder: country.sortOrder,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt
      }
    }, 201);
    
  } catch (error) {
    console.error('❌ Error creating country:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Country with this name or code already exists', 400);
    }
    return errorResponse(res, 'Failed to create country', 500);
  }
};

// Update country
exports.updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, dialCode, flag, currency, isActive, sortOrder } = req.body;
    
    console.log('🌍 Admin updating country:', id);
    
    const country = await Country.findById(id);
    if (!country) {
      return errorResponse(res, 'Country not found', 404);
    }
    
    // Check if another country with same name or code exists (excluding current)
    if (name || code) {
      const existingCountry = await Country.findOne({
        _id: { $ne: id },
        $or: [
          ...(name ? [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }] : []),
          ...(code ? [{ code: code.toUpperCase() }] : [])
        ]
      });
      
      if (existingCountry) {
        return errorResponse(res, 'Another country with this name or code already exists', 400);
      }
    }
    
    // Update fields
    if (name) country.name = name.trim();
    if (code) country.code = code.toUpperCase();
    if (dialCode) country.dialCode = dialCode;
    if (flag !== undefined) country.flag = flag;
    if (currency) {
      if (currency.code) country.currency.code = currency.code.toUpperCase();
      if (currency.name) country.currency.name = currency.name.trim();
      if (currency.symbol) country.currency.symbol = currency.symbol.trim();
    }
    if (isActive !== undefined) country.isActive = isActive;
    if (sortOrder !== undefined) country.sortOrder = parseInt(sortOrder) || 0;
    
    await country.save();
    
    console.log('✅ Country updated successfully:', country.name);
    
    return successResponse(res, 'Country updated successfully', {
      country: {
        _id: country._id,
        name: country.name,
        code: country.code,
        dialCode: country.dialCode,
        flag: country.flag,
        currency: country.currency,
        isActive: country.isActive,
        sortOrder: country.sortOrder,
        createdAt: country.createdAt,
        updatedAt: country.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating country:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Country with this name or code already exists', 400);
    }
    return errorResponse(res, 'Failed to update country', 500);
  }
};

// Delete country
exports.deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🌍 Admin deleting country:', id);
    
    const country = await Country.findById(id);
    if (!country) {
      return errorResponse(res, 'Country not found', 404);
    }
    
    // Check if country has associated cities
    const City = require('../../../../db/models/cityModel');
    const cityCount = await City.countDocuments({ country: id });
    
    if (cityCount > 0) {
      return errorResponse(res, `Cannot delete country. It has ${cityCount} associated cities. Please delete or reassign the cities first.`, 400);
    }
    
    await Country.findByIdAndDelete(id);
    
    console.log('✅ Country deleted successfully:', country.name);
    
    return successResponse(res, 'Country deleted successfully', {
      deletedCountry: {
        _id: country._id,
        name: country.name,
        code: country.code
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting country:', error);
    return errorResponse(res, 'Failed to delete country', 500);
  }
};

// Get country statistics
exports.getCountryStats = async (req, res) => {
  try {
    console.log('🌍 Admin fetching country statistics');
    
    const totalCountries = await Country.countDocuments();
    const activeCountries = await Country.countDocuments({ isActive: true });
    const inactiveCountries = await Country.countDocuments({ isActive: false });
    
    // Get cities count per country
    const City = require('../../../../db/models/cityModel');
    const countriesWithCities = await City.aggregate([
      {
        $group: {
          _id: '$country',
          cityCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'countries',
          localField: '_id',
          foreignField: '_id',
          as: 'country'
        }
      },
      {
        $unwind: '$country'
      },
      {
        $project: {
          countryName: '$country.name',
          countryCode: '$country.code',
          cityCount: 1
        }
      },
      {
        $sort: { cityCount: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    console.log('✅ Country statistics fetched successfully');
    
    return successResponse(res, 'Country statistics fetched successfully', {
      stats: {
        totalCountries,
        activeCountries,
        inactiveCountries,
        topCountriesWithCities: countriesWithCities
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching country statistics:', error);
    return errorResponse(res, 'Failed to fetch country statistics', 500);
  }
};
