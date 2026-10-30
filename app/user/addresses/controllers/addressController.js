const Address = require('../../../../db/models/addressModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

/**
 * Add a new address
 * POST /user/addresses/add
 */
const addAddress = async (req, res) => {
  try {
    console.log('🔄 Add address request received');
    const userId = req.user._id;
    const {
      fullName,
      street1,
      street2,
      city,
      state,
      zipCode,
      country,
      phoneNumber,
      addressType,
      setAsDefault = false
    } = req.body;

    console.log('Address addition params:', {
      userId,
      fullName,
      city,
      zipCode,
      country,
      addressType
    });

    // Validate required fields
    if (!fullName || !street1 || !city || !zipCode || !country) {
      return errorResponse(res, 'Missing required address details', 400);
    }

    // Check if user already has 4 addresses (limit)
    const existingAddressCount = await Address.countDocuments({ 
      user: userId, 
      isActive: true 
    });

    if (existingAddressCount >= 4) {
      return errorResponse(res, 'Maximum of 4 addresses allowed per user', 400);
    }

    // If this is the first address or setAsDefault is true, make it default
    const shouldBeDefault = setAsDefault || existingAddressCount === 0;

    // Create new address
    const address = new Address({
      user: userId,
      fullName: fullName.trim(),
      street1: street1.trim(),
      street2: street2 ? street2.trim() : '',
      city: city.trim(),
      state: state ? state.trim() : '',
      zipCode: zipCode.trim(),
      country: country.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      addressType: addressType || 'home',
      isDefault: shouldBeDefault
    });

    const savedAddress = await address.save();
    console.log('✅ Address added successfully:', savedAddress._id);

    return successResponse(res, 'Address added successfully', {
      address: savedAddress
    });

  } catch (error) {
    console.error('❌ Error adding address:', error);
    return errorResponse(res, 'Failed to add address', 500);
  }
};

/**
 * Get user's addresses
 * GET /user/addresses
 */
const getUserAddresses = async (req, res) => {
  try {
    console.log('🔄 Get user addresses request received');
    const userId = req.user._id;

    const addresses = await Address.getUserAddresses(userId);
    console.log(`✅ Found ${addresses.length} addresses for user`);

    return successResponse(res, 'Addresses retrieved successfully', {
      addresses,
      count: addresses.length
    });

  } catch (error) {
    console.error('❌ Error getting addresses:', error);
    return errorResponse(res, 'Failed to retrieve addresses', 500);
  }
};

/**
 * Get user's default address
 * GET /user/addresses/default
 */
const getDefaultAddress = async (req, res) => {
  try {
    console.log('🔄 Get default address request received');
    const userId = req.user._id;

    const defaultAddress = await Address.getDefaultAddress(userId);
    
    if (!defaultAddress) {
      return errorResponse(res, 'No default address found', 404);
    }

    console.log('✅ Default address found:', defaultAddress._id);

    return successResponse(res, 'Default address retrieved successfully', {
      address: defaultAddress
    });

  } catch (error) {
    console.error('❌ Error getting default address:', error);
    return errorResponse(res, 'Failed to retrieve default address', 500);
  }
};

/**
 * Set address as default
 * PUT /user/addresses/:addressId/set-default
 */
const setDefaultAddress = async (req, res) => {
  try {
    console.log('🔄 Set default address request received');
    const userId = req.user._id;
    const { addressId } = req.params;

    // Find the address
    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true
    });

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Set as default
    await address.setAsDefault();
    console.log('✅ Address set as default:', addressId);

    return successResponse(res, 'Address set as default successfully', {
      address
    });

  } catch (error) {
    console.error('❌ Error setting default address:', error);
    return errorResponse(res, 'Failed to set default address', 500);
  }
};

/**
 * Update address
 * PUT /user/addresses/:addressId
 */
const updateAddress = async (req, res) => {
  try {
    console.log('🔄 Update address request received');
    const userId = req.user._id;
    const { addressId } = req.params;
    const updateData = req.body;

    // Find the address
    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true
    });

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Update allowed fields
    const allowedFields = [
      'fullName', 'street1', 'street2', 'city',
      'state', 'zipCode', 'country', 'phoneNumber', 'addressType'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        address[field] = updateData[field];
      }
    });

    const updatedAddress = await address.save();
    console.log('✅ Address updated successfully:', addressId);

    return successResponse(res, 'Address updated successfully', {
      address: updatedAddress
    });

  } catch (error) {
    console.error('❌ Error updating address:', error);
    return errorResponse(res, 'Failed to update address', 500);
  }
};

/**
 * Delete address
 * DELETE /user/addresses/:addressId
 */
const deleteAddress = async (req, res) => {
  try {
    console.log('🔄 Delete address request received');
    const userId = req.user._id;
    const { addressId } = req.params;

    // Find the address
    const address = await Address.findOne({
      _id: addressId,
      user: userId,
      isActive: true
    });

    if (!address) {
      return errorResponse(res, 'Address not found', 404);
    }

    // Check if this is the default address
    const isDefault = address.isDefault;

    // Soft delete the address
    address.isActive = false;
    await address.save();

    // If this was the default address, set another address as default
    if (isDefault) {
      const nextAddress = await Address.findOne({
        user: userId,
        isActive: true,
        _id: { $ne: addressId }
      }).sort({ createdAt: -1 });

      if (nextAddress) {
        await nextAddress.setAsDefault();
        console.log('✅ Set new default address:', nextAddress._id);
      }
    }

    console.log('✅ Address deleted successfully:', addressId);

    return successResponse(res, 'Address deleted successfully');

  } catch (error) {
    console.error('❌ Error deleting address:', error);
    return errorResponse(res, 'Failed to delete address', 500);
  }
};

module.exports = {
  addAddress,
  getUserAddresses,
  getDefaultAddress,
  setDefaultAddress,
  updateAddress,
  deleteAddress
};
