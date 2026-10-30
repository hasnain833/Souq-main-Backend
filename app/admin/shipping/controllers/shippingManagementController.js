const ShippingProvider = require('../../../../db/models/shippingProviderModel');
const DeliveryOption = require('../../../../db/models/deliveryOptionModel');
const Shipment = require('../../../../db/models/shipmentModel');
const Order = require('../../../../db/models/orderModel');
const User = require('../../../../db/models/userModel');
const shippingFactory = require('../../../../services/shipping/ShippingServiceFactory');

class ShippingManagementController {
  /**
   * Get all shipping providers with pagination and filters
   */
  async getAllProviders(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Build filter query
      const filterQuery = {};
      
      if (search) {
        filterQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ];
      }

      if (status !== '') {
        filterQuery.isActive = status === 'active';
      }

      const [providers, totalCount] = await Promise.all([
        ShippingProvider.find(filterQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ShippingProvider.countDocuments(filterQuery)
      ]);

      // Add statistics for each provider
      const providersWithStats = await Promise.all(
        providers.map(async (provider) => {
          const shipmentCount = await Shipment.countDocuments({ 
            shippingProvider: provider._id 
          });
          
          const deliveryOptionCount = await DeliveryOption.countDocuments({ 
            shippingProvider: provider._id 
          });

          return {
            ...provider,
            statistics: {
              ...provider.statistics,
              totalShipments: shipmentCount,
              totalDeliveryOptions: deliveryOptionCount
            }
          };
        })
      );

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          providers: providersWithStats,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get all providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipping providers'
      });
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(req, res) {
    try {
      const [
        totalProviders,
        activeProviders,
        totalShipments,
        totalDeliveryOptions
      ] = await Promise.all([
        ShippingProvider.countDocuments(),
        ShippingProvider.countDocuments({ isActive: true }),
        Shipment.countDocuments(),
        DeliveryOption.countDocuments()
      ]);

      // Get provider distribution
      const providerDistribution = await ShippingProvider.aggregate([
        {
          $group: {
            _id: '$name',
            count: { $sum: 1 },
            displayName: { $first: '$displayName' },
            isActive: { $first: '$isActive' }
          }
        }
      ]);

      // Get recent shipments by provider
      const recentShipmentsByProvider = await Shipment.aggregate([
        {
          $lookup: {
            from: 'shippingproviders',
            localField: 'shippingProvider',
            foreignField: '_id',
            as: 'provider'
          }
        },
        {
          $unwind: '$provider'
        },
        {
          $group: {
            _id: '$provider.name',
            count: { $sum: 1 },
            displayName: { $first: '$provider.displayName' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalProviders,
            activeProviders,
            inactiveProviders: totalProviders - activeProviders,
            totalShipments,
            totalDeliveryOptions
          },
          providerDistribution,
          recentShipmentsByProvider
        }
      });
    } catch (error) {
      console.error('Get provider stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider statistics'
      });
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(req, res) {
    try {
      const { providerId } = req.params;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      // Get additional statistics
      const [shipmentCount, deliveryOptionCount, recentShipments] = await Promise.all([
        Shipment.countDocuments({ shippingProvider: providerId }),
        DeliveryOption.countDocuments({ shippingProvider: providerId }),
        Shipment.find({ shippingProvider: providerId })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('order', 'orderNumber status')
          .lean()
      ]);

      res.json({
        success: true,
        data: {
          provider: {
            ...provider.toObject(),
            statistics: {
              ...provider.statistics,
              totalShipments: shipmentCount,
              totalDeliveryOptions: deliveryOptionCount
            }
          },
          recentShipments
        }
      });
    } catch (error) {
      console.error('Get provider by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipping provider'
      });
    }
  }

  /**
   * Create new shipping provider
   */
  async createProvider(req, res) {
    try {
      const providerData = req.body;

      // Check if provider with same name already exists
      const existingProvider = await ShippingProvider.findOne({ 
        name: providerData.name 
      });
      
      if (existingProvider) {
        return res.status(400).json({
          success: false,
          error: 'Shipping provider with this name already exists'
        });
      }

      const provider = new ShippingProvider(providerData);
      await provider.save();

      // Reload shipping factory to include the new provider
      if (provider.isActive) {
        try {
          await shippingFactory.reloadProviders();
          console.log(`Shipping factory reloaded after creating ${provider.displayName}`);
        } catch (reloadError) {
          console.error('Failed to reload shipping factory:', reloadError);
        }
      }

      res.status(201).json({
        success: true,
        data: { provider },
        message: 'Shipping provider created successfully'
      });
    } catch (error) {
      console.error('Create provider error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create shipping provider'
      });
    }
  }

  /**
   * Update shipping provider
   */
  async updateProvider(req, res) {
    try {
      const { providerId } = req.params;
      const updateData = req.body;

      // Check if provider exists
      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      // If name is being changed, check for duplicates
      if (updateData.name && updateData.name !== provider.name) {
        const existingProvider = await ShippingProvider.findOne({ 
          name: updateData.name,
          _id: { $ne: providerId }
        });
        
        if (existingProvider) {
          return res.status(400).json({
            success: false,
            error: 'Shipping provider with this name already exists'
          });
        }
      }

      const updatedProvider = await ShippingProvider.findByIdAndUpdate(
        providerId,
        updateData,
        { new: true, runValidators: true }
      );

      // Reload shipping factory if provider status or configuration changed
      try {
        await shippingFactory.reloadProviders();
        console.log(`Shipping factory reloaded after updating ${updatedProvider.displayName}`);
      } catch (reloadError) {
        console.error('Failed to reload shipping factory:', reloadError);
      }

      res.json({
        success: true,
        data: { provider: updatedProvider },
        message: 'Shipping provider updated successfully'
      });
    } catch (error) {
      console.error('Update provider error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update shipping provider'
      });
    }
  }

  /**
   * Delete shipping provider
   */
  async deleteProvider(req, res) {
    try {
      const { providerId } = req.params;

      // Check if provider exists
      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      // Check if provider is being used in any shipments
      const shipmentCount = await Shipment.countDocuments({ 
        shippingProvider: providerId 
      });
      
      if (shipmentCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete provider. It is being used in ${shipmentCount} shipment(s)`
        });
      }

      // Check if provider is being used in any delivery options
      const deliveryOptionCount = await DeliveryOption.countDocuments({ 
        shippingProvider: providerId 
      });
      
      if (deliveryOptionCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete provider. It is being used in ${deliveryOptionCount} delivery option(s)`
        });
      }

      await ShippingProvider.findByIdAndDelete(providerId);

      // Reload shipping factory to remove the deleted provider
      try {
        await shippingFactory.reloadProviders();
        console.log(`Shipping factory reloaded after deleting ${provider.displayName}`);
      } catch (reloadError) {
        console.error('Failed to reload shipping factory:', reloadError);
      }

      res.json({
        success: true,
        message: 'Shipping provider deleted successfully'
      });
    } catch (error) {
      console.error('Delete provider error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete shipping provider'
      });
    }
  }

  /**
   * Toggle provider status (active/inactive)
   */
  async toggleProviderStatus(req, res) {
    try {
      const { providerId } = req.params;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      provider.isActive = !provider.isActive;
      await provider.save();

      // Reload shipping factory to reflect the status change
      try {
        await shippingFactory.reloadProviders();
        console.log(`Shipping factory reloaded after ${provider.displayName} status change`);
      } catch (reloadError) {
        console.error('Failed to reload shipping factory:', reloadError);
        // Don't fail the request if factory reload fails
      }

      res.json({
        success: true,
        data: { provider },
        message: `Shipping provider ${provider.isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Toggle provider status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle provider status'
      });
    }
  }

  /**
   * Get provider services
   */
  async getProviderServices(req, res) {
    try {
      const { providerId } = req.params;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      res.json({
        success: true,
        data: {
          services: provider.supportedServices,
          providerName: provider.displayName
        }
      });
    } catch (error) {
      console.error('Get provider services error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch provider services'
      });
    }
  }

  /**
   * Add service to provider
   */
  async addProviderService(req, res) {
    try {
      const { providerId } = req.params;
      const serviceData = req.body;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      // Check if service code already exists
      const existingService = provider.supportedServices.find(
        service => service.serviceCode === serviceData.serviceCode
      );

      if (existingService) {
        return res.status(400).json({
          success: false,
          error: 'Service with this code already exists'
        });
      }

      provider.supportedServices.push(serviceData);
      await provider.save();

      res.status(201).json({
        success: true,
        data: { provider },
        message: 'Service added successfully'
      });
    } catch (error) {
      console.error('Add provider service error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add service'
      });
    }
  }

  /**
   * Update provider service
   */
  async updateProviderService(req, res) {
    try {
      const { providerId, serviceId } = req.params;
      const updateData = req.body;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      const serviceIndex = provider.supportedServices.findIndex(
        service => service._id.toString() === serviceId
      );

      if (serviceIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      // Check for duplicate service code if it's being changed
      if (updateData.serviceCode &&
          updateData.serviceCode !== provider.supportedServices[serviceIndex].serviceCode) {
        const existingService = provider.supportedServices.find(
          (service, index) => service.serviceCode === updateData.serviceCode && index !== serviceIndex
        );

        if (existingService) {
          return res.status(400).json({
            success: false,
            error: 'Service with this code already exists'
          });
        }
      }

      // Update the service
      Object.assign(provider.supportedServices[serviceIndex], updateData);
      await provider.save();

      res.json({
        success: true,
        data: { provider },
        message: 'Service updated successfully'
      });
    } catch (error) {
      console.error('Update provider service error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update service'
      });
    }
  }

  /**
   * Delete provider service
   */
  async deleteProviderService(req, res) {
    try {
      const { providerId, serviceId } = req.params;

      const provider = await ShippingProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      const serviceIndex = provider.supportedServices.findIndex(
        service => service._id.toString() === serviceId
      );

      if (serviceIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      provider.supportedServices.splice(serviceIndex, 1);
      await provider.save();

      res.json({
        success: true,
        data: { provider },
        message: 'Service deleted successfully'
      });
    } catch (error) {
      console.error('Delete provider service error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete service'
      });
    }
  }

  /**
   * Get all delivery options
   */
  async getAllDeliveryOptions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        provider = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Build filter query
      const filterQuery = {};

      if (search) {
        filterQuery.$or = [
          { serviceName: { $regex: search, $options: 'i' } },
          { serviceCode: { $regex: search, $options: 'i' } }
        ];
      }

      if (provider) {
        filterQuery.shippingProvider = provider;
      }

      if (status !== '') {
        filterQuery.isActive = status === 'active';
      }

      const [deliveryOptions, totalCount] = await Promise.all([
        DeliveryOption.find(filterQuery)
          .populate('user', 'firstName lastName email')
          .populate('shippingProvider', 'name displayName')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        DeliveryOption.countDocuments(filterQuery)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          deliveryOptions,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get all delivery options error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery options'
      });
    }
  }

  /**
   * Get delivery options statistics
   */
  async getDeliveryOptionsStats(req, res) {
    try {
      const [
        totalOptions,
        activeOptions,
        defaultOptions,
        optionsByProvider
      ] = await Promise.all([
        DeliveryOption.countDocuments(),
        DeliveryOption.countDocuments({ isActive: true }),
        DeliveryOption.countDocuments({ isDefault: true }),
        DeliveryOption.aggregate([
          {
            $lookup: {
              from: 'shippingproviders',
              localField: 'shippingProvider',
              foreignField: '_id',
              as: 'provider'
            }
          },
          {
            $unwind: '$provider'
          },
          {
            $group: {
              _id: '$provider.name',
              count: { $sum: 1 },
              displayName: { $first: '$provider.displayName' }
            }
          },
          {
            $sort: { count: -1 }
          }
        ])
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalOptions,
            activeOptions,
            inactiveOptions: totalOptions - activeOptions,
            defaultOptions
          },
          optionsByProvider
        }
      });
    } catch (error) {
      console.error('Get delivery options stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery options statistics'
      });
    }
  }

  /**
   * Get delivery option by ID
   */
  async getDeliveryOptionById(req, res) {
    try {
      const { optionId } = req.params;

      const deliveryOption = await DeliveryOption.findById(optionId)
        .populate('user', 'firstName lastName email')
        .populate('shippingProvider', 'name displayName supportedServices');

      if (!deliveryOption) {
        return res.status(404).json({
          success: false,
          error: 'Delivery option not found'
        });
      }

      res.json({
        success: true,
        data: { deliveryOption }
      });
    } catch (error) {
      console.error('Get delivery option by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery option'
      });
    }
  }

  /**
   * Delete delivery option
   */
  async deleteDeliveryOption(req, res) {
    try {
      const { optionId } = req.params;

      const deliveryOption = await DeliveryOption.findById(optionId);
      if (!deliveryOption) {
        return res.status(404).json({
          success: false,
          error: 'Delivery option not found'
        });
      }

      await DeliveryOption.findByIdAndDelete(optionId);

      res.json({
        success: true,
        message: 'Delivery option deleted successfully'
      });
    } catch (error) {
      console.error('Delete delivery option error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete delivery option'
      });
    }
  }

  /**
   * Get all shipments
   */
  async getAllShipments(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        provider = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Build filter query
      const filterQuery = {};

      if (search) {
        filterQuery.$or = [
          { trackingNumber: { $regex: search, $options: 'i' } },
          { providerShipmentId: { $regex: search, $options: 'i' } }
        ];
      }

      if (provider) {
        filterQuery.shippingProvider = provider;
      }

      if (status) {
        filterQuery['tracking.status'] = status;
      }

      const [shipments, totalCount] = await Promise.all([
        Shipment.find(filterQuery)
          .populate('order', 'orderNumber status buyer seller')
          .populate('shippingProvider', 'name displayName')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Shipment.countDocuments(filterQuery)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        success: true,
        data: {
          shipments,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    } catch (error) {
      console.error('Get all shipments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipments'
      });
    }
  }

  /**
   * Get shipment statistics
   */
  async getShipmentStats(req, res) {
    try {
      const [
        totalShipments,
        shipmentsByStatus,
        shipmentsByProvider,
        recentShipments
      ] = await Promise.all([
        Shipment.countDocuments(),
        Shipment.aggregate([
          {
            $group: {
              _id: '$tracking.status',
              count: { $sum: 1 }
            }
          }
        ]),
        Shipment.aggregate([
          {
            $lookup: {
              from: 'shippingproviders',
              localField: 'shippingProvider',
              foreignField: '_id',
              as: 'provider'
            }
          },
          {
            $unwind: '$provider'
          },
          {
            $group: {
              _id: '$provider.name',
              count: { $sum: 1 },
              displayName: { $first: '$provider.displayName' }
            }
          },
          {
            $sort: { count: -1 }
          }
        ]),
        Shipment.find()
          .populate('order', 'orderNumber')
          .populate('shippingProvider', 'displayName')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalShipments
          },
          shipmentsByStatus,
          shipmentsByProvider,
          recentShipments
        }
      });
    } catch (error) {
      console.error('Get shipment stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipment statistics'
      });
    }
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(req, res) {
    try {
      const { shipmentId } = req.params;

      const shipment = await Shipment.findById(shipmentId)
        .populate('order', 'orderNumber status buyer seller')
        .populate('shippingProvider', 'name displayName');

      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: 'Shipment not found'
        });
      }

      res.json({
        success: true,
        data: { shipment }
      });
    } catch (error) {
      console.error('Get shipment by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipment'
      });
    }
  }

  /**
   * Update shipment status
   */
  async updateShipmentStatus(req, res) {
    try {
      const { shipmentId } = req.params;
      const { status, description } = req.body;

      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: 'Shipment not found'
        });
      }

      // Update tracking status
      shipment.tracking.status = status;
      shipment.tracking.lastUpdate = new Date();

      // Add tracking event
      shipment.tracking.events.push({
        timestamp: new Date(),
        status,
        description: description || `Status updated to ${status}`,
        eventType: 'admin_update'
      });

      await shipment.save();

      res.json({
        success: true,
        data: { shipment },
        message: 'Shipment status updated successfully'
      });
    } catch (error) {
      console.error('Update shipment status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update shipment status'
      });
    }
  }

  /**
   * Bulk actions on providers
   */
  async bulkProviderActions(req, res) {
    try {
      const { action, providerIds } = req.body;

      if (!action || !providerIds || !Array.isArray(providerIds)) {
        return res.status(400).json({
          success: false,
          error: 'Action and provider IDs are required'
        });
      }

      let result;
      switch (action) {
        case 'activate':
          result = await ShippingProvider.updateMany(
            { _id: { $in: providerIds } },
            { isActive: true }
          );
          break;
        case 'deactivate':
          result = await ShippingProvider.updateMany(
            { _id: { $in: providerIds } },
            { isActive: false }
          );
          break;
        case 'delete':
          // Check if any providers are being used
          const usageCount = await Shipment.countDocuments({
            shippingProvider: { $in: providerIds }
          });

          if (usageCount > 0) {
            return res.status(400).json({
              success: false,
              error: 'Cannot delete providers that are being used in shipments'
            });
          }

          result = await ShippingProvider.deleteMany({
            _id: { $in: providerIds }
          });
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid action'
          });
      }

      res.json({
        success: true,
        data: { result },
        message: `Bulk ${action} completed successfully`
      });
    } catch (error) {
      console.error('Bulk provider actions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk action'
      });
    }
  }

  /**
   * Bulk actions on delivery options
   */
  async bulkDeliveryOptionActions(req, res) {
    try {
      const { action, optionIds } = req.body;

      if (!action || !optionIds || !Array.isArray(optionIds)) {
        return res.status(400).json({
          success: false,
          error: 'Action and option IDs are required'
        });
      }

      let result;
      switch (action) {
        case 'delete':
          result = await DeliveryOption.deleteMany({
            _id: { $in: optionIds }
          });
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid action'
          });
      }

      res.json({
        success: true,
        data: { result },
        message: `Bulk ${action} completed successfully`
      });
    } catch (error) {
      console.error('Bulk delivery option actions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk action'
      });
    }
  }
}

module.exports = new ShippingManagementController();
