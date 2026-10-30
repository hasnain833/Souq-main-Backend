const City = require('../../../../db/models/cityModel');
const Country = require('../../../../db/models/countryModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all cities with pagination and search
exports.getAllCities = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      country = '', 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;
    
    console.log('🏙️ Admin fetching cities with params:', { page, limit, search, country, sortBy, sortOrder });
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { countryCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by country if specified
    if (country) {
      searchQuery.country = country;
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get cities with pagination and populate country
    const cities = await City.find(searchQuery)
      .populate('country', 'name code flag')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const totalCities = await City.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCities / limitNum);
    
    console.log(`✅ Found ${cities.length} cities (${totalCities} total)`);
    
    return successResponse(res, 'Cities fetched successfully', {
      cities: cities.map(city => ({
        _id: city._id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        population: city.population,
        isCapital: city.isCapital,
        isActive: city.isActive,
        sortOrder: city.sortOrder,
        createdAt: city.createdAt,
        updatedAt: city.updatedAt
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCities,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching cities:', error);
    return errorResponse(res, 'Failed to fetch cities', 500);
  }
};

// Get city by ID
exports.getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🏙️ Admin fetching city by ID:', id);
    
    const city = await City.findById(id).populate('country', 'name code flag');
    
    if (!city) {
      return errorResponse(res, 'City not found', 404);
    }
    
    console.log('✅ City found:', city.name);
    
    return successResponse(res, 'City fetched successfully', {
      city: {
        _id: city._id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        population: city.population,
        isCapital: city.isCapital,
        isActive: city.isActive,
        sortOrder: city.sortOrder,
        createdAt: city.createdAt,
        updatedAt: city.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching city by ID:', error);
    return errorResponse(res, 'Failed to fetch city', 500);
  }
};

// Create new city
exports.createCity = async (req, res) => {
  try {
    const { 
      name, 
      country, 
      state = '', 
      latitude = null, 
      longitude = null, 
      population = 0, 
      isCapital = false, 
      isActive = true, 
      sortOrder = 0 
    } = req.body;
    
    console.log('🏙️ Admin creating city:', { name, country, state });
    
    // Validation
    if (!name || !country) {
      return errorResponse(res, 'Name and country are required', 400);
    }
    
    // Verify country exists
    const countryDoc = await Country.findById(country);
    if (!countryDoc) {
      return errorResponse(res, 'Country not found', 400);
    }
    
    // Check if city with same name already exists in the same country
    const existingCity = await City.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      country: country
    });
    
    if (existingCity) {
      return errorResponse(res, 'City with this name already exists in this country', 400);
    }
    
    // Create new city
    const city = new City({
      name: name.trim(),
      country: country,
      countryCode: countryDoc.code,
      state: state.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      population: parseInt(population) || 0,
      isCapital,
      isActive,
      sortOrder: parseInt(sortOrder) || 0
    });
    
    await city.save();
    
    // Populate country for response
    await city.populate('country', 'name code flag');
    
    console.log('✅ City created successfully:', city.name);
    
    return successResponse(res, 'City created successfully', {
      city: {
        _id: city._id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        population: city.population,
        isCapital: city.isCapital,
        isActive: city.isActive,
        sortOrder: city.sortOrder,
        createdAt: city.createdAt,
        updatedAt: city.updatedAt
      }
    }, 201);
    
  } catch (error) {
    console.error('❌ Error creating city:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'City with this name already exists in this country', 400);
    }
    return errorResponse(res, 'Failed to create city', 500);
  }
};

// Update city
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      country, 
      state, 
      latitude, 
      longitude, 
      population, 
      isCapital, 
      isActive, 
      sortOrder 
    } = req.body;
    
    console.log('🏙️ Admin updating city:', id);
    
    const city = await City.findById(id);
    if (!city) {
      return errorResponse(res, 'City not found', 404);
    }
    
    // If country is being changed, verify it exists
    if (country && country !== city.country.toString()) {
      const countryDoc = await Country.findById(country);
      if (!countryDoc) {
        return errorResponse(res, 'Country not found', 400);
      }
      city.country = country;
      city.countryCode = countryDoc.code;
    }
    
    // Check if another city with same name exists in the same country (excluding current)
    if (name) {
      const existingCity = await City.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        country: country || city.country
      });
      
      if (existingCity) {
        return errorResponse(res, 'Another city with this name already exists in this country', 400);
      }
    }
    
    // Update fields
    if (name) city.name = name.trim();
    if (state !== undefined) city.state = state.trim();
    if (latitude !== undefined) city.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) city.longitude = longitude ? parseFloat(longitude) : null;
    if (population !== undefined) city.population = parseInt(population) || 0;
    if (isCapital !== undefined) city.isCapital = isCapital;
    if (isActive !== undefined) city.isActive = isActive;
    if (sortOrder !== undefined) city.sortOrder = parseInt(sortOrder) || 0;
    
    await city.save();
    
    // Populate country for response
    await city.populate('country', 'name code flag');
    
    console.log('✅ City updated successfully:', city.name);
    
    return successResponse(res, 'City updated successfully', {
      city: {
        _id: city._id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        population: city.population,
        isCapital: city.isCapital,
        isActive: city.isActive,
        sortOrder: city.sortOrder,
        createdAt: city.createdAt,
        updatedAt: city.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating city:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'City with this name already exists in this country', 400);
    }
    return errorResponse(res, 'Failed to update city', 500);
  }
};

// Delete city
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🏙️ Admin deleting city:', id);
    
    const city = await City.findById(id).populate('country', 'name code');
    if (!city) {
      return errorResponse(res, 'City not found', 404);
    }
    
    await City.findByIdAndDelete(id);
    
    console.log('✅ City deleted successfully:', city.name);
    
    return successResponse(res, 'City deleted successfully', {
      deletedCity: {
        _id: city._id,
        name: city.name,
        country: city.country
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting city:', error);
    return errorResponse(res, 'Failed to delete city', 500);
  }
};

// Get city statistics
exports.getCityStats = async (req, res) => {
  try {
    console.log('🏙️ Admin fetching city statistics');
    
    const totalCities = await City.countDocuments();
    const activeCities = await City.countDocuments({ isActive: true });
    const inactiveCities = await City.countDocuments({ isActive: false });
    const capitalCities = await City.countDocuments({ isCapital: true });
    
    // Get cities count per country
    const citiesPerCountry = await City.aggregate([
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
    
    console.log('✅ City statistics fetched successfully');
    
    return successResponse(res, 'City statistics fetched successfully', {
      stats: {
        totalCities,
        activeCities,
        inactiveCities,
        capitalCities,
        citiesPerCountry
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching city statistics:', error);
    return errorResponse(res, 'Failed to fetch city statistics', 500);
  }
};
