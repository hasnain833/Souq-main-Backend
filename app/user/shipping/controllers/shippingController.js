const shippingFactory = require('../../../../services/shipping/ShippingServiceFactory');
const DeliveryOption = require('../../../../db/models/deliveryOptionModel');
const ShippingProvider = require('../../../../db/models/shippingProviderModel');
const Order = require('../../../../db/models/orderModel');
const Shipment = require('../../../../db/models/shipmentModel');

class ShippingController {
  /**
   * Get available shipping providers
   */
  async getProviders(req, res) {
    try {
      const providers = await ShippingProvider.find({ isActive: true })
        .select('name displayName supportedServices supportedCountries pricing features limits');
      
      res.json({
        success: true,
        data: { providers }
      });
    } catch (error) {
      console.error('Get providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch shipping providers'
      });
    }
  }

  /**
   * Get shipping rates for a route
   */
  async getShippingRates(req, res) {
    try {
      const { origin, destination, packageDetails, providerName } = req.body;

      // Validate required fields
      if (!origin || !destination || !packageDetails) {
        return res.status(400).json({
          success: false,
          error: 'Origin, destination, and package details are required'
        });
      }

      let rates;
      
      if (providerName) {
        // Get rates from specific provider
        const service = shippingFactory.getService(providerName);
        rates = await service.getShippingRates(origin, destination, packageDetails);
        rates = rates.map(rate => ({
          ...rate,
          provider: { name: providerName, displayName: providerName }
        }));
      } else {
        // Get rates from all providers
        rates = await shippingFactory.getAllRates(origin, destination, packageDetails);
      }

      res.json({
        success: true,
        data: { rates }
      });
    } catch (error) {
      console.error('Get shipping rates error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate shipping rates'
      });
    }
  }

  /**
   * Create a shipment
   */
  async createShipment(req, res) {
    try {
      const { orderId, providerName, serviceCode, shipmentData } = req.body;

      // Validate required fields
      if (!orderId || !providerName || !serviceCode) {
        return res.status(400).json({
          success: false,
          error: 'Order ID, provider name, and service code are required'
        });
      }

      // Get the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if user is the seller
      if (order.seller.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Only the seller can create shipments'
        });
      }

      // Get shipping provider
      const provider = await ShippingProvider.findOne({ name: providerName, isActive: true });
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Shipping provider not found'
        });
      }

      // Create shipment with provider
      const service = shippingFactory.getService(providerName);
      const shipmentResult = await service.createShipment({
        ...shipmentData,
        serviceCode,
        reference: order.orderNumber
      });

      // Save shipment to database
      const shipment = new Shipment({
        order: orderId,
        shippingProvider: provider._id,
        providerShipmentId: shipmentResult.providerShipmentId,
        trackingNumber: shipmentResult.trackingNumber,
        shipmentDetails: {
          serviceCode,
          serviceName: shipmentData.serviceName,
          reference: order.orderNumber,
          description: shipmentData.description,
          packages: shipmentData.packages,
          origin: shipmentData.origin,
          destination: shipmentData.destination
        },
        tracking: {
          status: 'created',
          lastUpdate: new Date(),
          events: [{
            timestamp: new Date(),
            status: 'created',
            description: 'Shipment created',
            eventCode: 'CREATED'
          }],
          estimatedDelivery: shipmentResult.estimatedDelivery
        },
        costs: {
          total: shipmentResult.cost.total,
          currency: shipmentResult.cost.currency
        },
        documentation: {
          shippingLabel: {
            url: shipmentResult.labelUrl,
            format: 'PDF',
            generated: new Date()
          }
        },
        providerData: shipmentResult.providerData
      });

      await shipment.save();

      // Update order with shipping information
      await Order.findByIdAndUpdate(orderId, {
        'shipping.provider': provider._id,
        'shipping.serviceCode': serviceCode,
        'shipping.trackingNumber': shipmentResult.trackingNumber,
        'shipping.trackingUrl': shipmentResult.trackingUrl,
        'shipping.estimatedDelivery': shipmentResult.estimatedDelivery,
        'shipping.cost.total': shipmentResult.cost.total,
        'shipping.cost.currency': shipmentResult.cost.currency,
        status: 'shipped',
        $push: {
          timeline: {
            status: 'shipped',
            timestamp: new Date(),
            description: 'Package shipped',
            updatedBy: 'seller'
          }
        }
      });

      res.json({
        success: true,
        data: {
          shipment: {
            id: shipment._id,
            trackingNumber: shipmentResult.trackingNumber,
            trackingUrl: shipmentResult.trackingUrl,
            labelUrl: shipmentResult.labelUrl,
            estimatedDelivery: shipmentResult.estimatedDelivery
          }
        }
      });
    } catch (error) {
      console.error('Create shipment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create shipment'
      });
    }
  }

  /**
   * Track a shipment
   */
  async trackShipment(req, res) {
    try {
      const { trackingNumber } = req.params;

      // Find shipment in database
      const shipment = await Shipment.findOne({ trackingNumber })
        .populate('shippingProvider', 'name displayName')
        .populate('order', 'orderNumber buyer seller');

      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: 'Shipment not found'
        });
      }

      // Check if user has access to this shipment
      const userId = req.user._id; // Use MongoDB ObjectId
      if (shipment.order.buyer.toString() !== userId.toString() && shipment.order.seller.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Get tracking information from provider
      const service = shippingFactory.getService(shipment.shippingProvider.name);
      const trackingInfo = await service.trackShipment(trackingNumber);

      // Update shipment tracking information
      await Shipment.findByIdAndUpdate(shipment._id, {
        'tracking.status': trackingInfo.status,
        'tracking.lastUpdate': new Date(),
        'tracking.events': trackingInfo.events,
        'tracking.actualDelivery': trackingInfo.actualDelivery
      });

      // Update order status if delivered
      if (trackingInfo.status === 'delivered' && shipment.order.status !== 'delivered') {
        await Order.findByIdAndUpdate(shipment.order._id, {
          status: 'delivered',
          'delivery.confirmationDate': trackingInfo.actualDelivery,
          'delivery.confirmedBy': 'shipping_provider',
          $push: {
            timeline: {
              status: 'delivered',
              timestamp: trackingInfo.actualDelivery,
              description: 'Package delivered',
              updatedBy: 'shipping_provider'
            }
          }
        });
      }

      res.json({
        success: true,
        data: {
          tracking: {
            trackingNumber,
            status: trackingInfo.status,
            events: trackingInfo.events,
            estimatedDelivery: trackingInfo.estimatedDelivery,
            actualDelivery: trackingInfo.actualDelivery,
            provider: {
              name: shipment.shippingProvider.name,
              displayName: shipment.shippingProvider.displayName
            }
          }
        }
      });
    } catch (error) {
      console.error('Track shipment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to track shipment'
      });
    }
  }

  /**
   * Get user's delivery options
   */
  async getDeliveryOptions(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId

      const deliveryOptions = await DeliveryOption.find({ user: userId, isActive: true })
        .populate({
          path: 'shippingProvider',
          select: 'name displayName supportedServices isActive',
          match: { isActive: true } // Only populate if shipping provider is active
        })
        .sort({ isDefault: -1, createdAt: -1 });

      // Filter out delivery options where shipping provider is inactive or null
      const activeDeliveryOptions = deliveryOptions.filter(option =>
        option.shippingProvider && option.shippingProvider.isActive
      );

      res.json({
        success: true,
        data: { deliveryOptions: activeDeliveryOptions }
      });
    } catch (error) {
      console.error('Get delivery options error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch delivery options'
      });
    }
  }

  /**
   * Create or update delivery option
   */
  async saveDeliveryOption(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId
      const { deliveryOptionId, ...deliveryOptionData } = req.body;

      // Debug logging
      console.log('🔍 Save delivery option request:', {
        userId,
        deliveryOptionId,
        shippingProvider: deliveryOptionData.shippingProvider,
        shippingProviderType: typeof deliveryOptionData.shippingProvider,
        method: req.method,
        url: req.url
      });

      // Handle shippingProvider - convert string names to ObjectId, validate ObjectIds
      if (deliveryOptionData.shippingProvider) {
        if (typeof deliveryOptionData.shippingProvider === 'string') {
          // Check if it's a valid ObjectId string
          if (deliveryOptionData.shippingProvider.match(/^[0-9a-fA-F]{24}$/)) {
            // It's already an ObjectId string, validate it exists
            const provider = await ShippingProvider.findById(deliveryOptionData.shippingProvider);
            if (!provider || !provider.isActive) {
              return res.status(400).json({
                success: false,
                error: `Shipping provider with ID '${deliveryOptionData.shippingProvider}' not found or inactive`
              });
            }
            console.log('✅ Found shipping provider by ID:', provider.displayName);
          } else {
            // It's a provider name, look up the ObjectId
            const provider = await ShippingProvider.findOne({
              name: deliveryOptionData.shippingProvider,
              isActive: true
            });

            if (!provider) {
              return res.status(400).json({
                success: false,
                error: `Shipping provider '${deliveryOptionData.shippingProvider}' not found`
              });
            }

            console.log('✅ Found shipping provider by name:', provider.displayName);
            deliveryOptionData.shippingProvider = provider._id;
          }
        } else if (deliveryOptionData.shippingProvider._id) {
          // It's a populated object, extract the ID
          console.log('📦 Shipping provider is populated object, extracting ID');
          deliveryOptionData.shippingProvider = deliveryOptionData.shippingProvider._id;
        }
        // If it's already an ObjectId object, leave it as is
      }

      if (deliveryOptionId) {
        // Update existing delivery option
        const deliveryOption = await DeliveryOption.findOneAndUpdate(
          { _id: deliveryOptionId, user: userId },
          deliveryOptionData,
          { new: true }
        ).populate('shippingProvider', 'name displayName');

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
      } else {
        // Create new delivery option
        const deliveryOption = new DeliveryOption({
          user: userId,
          ...deliveryOptionData
        });

        await deliveryOption.save();
        await deliveryOption.populate('shippingProvider', 'name displayName');

        res.json({
          success: true,
          data: { deliveryOption }
        });
      }
    } catch (error) {
      console.error('Save delivery option error:', error);

      // Provide more specific error messages
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: `Validation error: ${error.message}`
        });
      }

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: `Invalid ID format: ${error.message}`
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to save delivery option'
      });
    }
  }

  /**
   * Delete delivery option
   */
  async deleteDeliveryOption(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId (consistent with other methods)
      const { deliveryOptionId } = req.params;

      // Validate deliveryOptionId format
      if (!deliveryOptionId || !deliveryOptionId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid delivery option ID format'
        });
      }

      const deliveryOption = await DeliveryOption.findOneAndDelete({
        _id: deliveryOptionId,
        user: userId
      });

      if (!deliveryOption) {
        return res.status(404).json({
          success: false,
          error: 'Delivery option not found or you do not have permission to delete it'
        });
      }

      res.json({
        success: true,
        message: 'Delivery option deleted successfully'
      });
    } catch (error) {
      console.error('Delete delivery option error:', error);

      // Provide more specific error messages
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid delivery option ID'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete delivery option'
      });
    }
  }

  /**
   * Set default delivery option
   */
  async setDefaultDeliveryOption(req, res) {
    try {
      const userId = req.user._id; // Use MongoDB ObjectId
      const { deliveryOptionId } = req.params;

      // Remove default from all user's delivery options
      await DeliveryOption.updateMany(
        { user: userId },
        { isDefault: false }
      );

      // Set the specified option as default
      const deliveryOption = await DeliveryOption.findOneAndUpdate(
        { _id: deliveryOptionId, user: userId },
        { isDefault: true },
        { new: true }
      ).populate('shippingProvider', 'name displayName');

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
      console.error('Set default delivery option error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set default delivery option'
      });
    }
  }
}

module.exports = new ShippingController();
