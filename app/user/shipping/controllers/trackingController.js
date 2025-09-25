const Tracking = require('../../../../db/models/trackingModel');
const Transaction = require('../../../../db/models/transactionModel');
const StandardPayment = require('../../../../db/models/standardPaymentModel');
const Order = require('../../../../db/models/orderModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const NotificationService = require('../../../../services/NotificationService');
const UAEShippingService = require('../../../../services/shipping/UAEShippingService');
const AfterShipService = require('../../../../services/shipping/AfterShipService');

class TrackingController {
  
  /**
   * Mark order as shipped and create tracking record
   * This is called when seller clicks "Mark as Shipped" button
   */
  async markAsShipped(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;
      const {
        trackingId,
        shippingProvider,
        trackingUrl,
        estimatedDelivery,
        packageDetails,
        sellerNotes,
        shippingInstructions
      } = req.body;

      console.log('🚚 Marking order as shipped:', { orderId, trackingId, shippingProvider });

      // Validate required fields
      if (!trackingId || !shippingProvider || !trackingUrl) {
        return res.status(400).json({
          success: false,
          error: 'Tracking ID, shipping provider, and tracking URL are required'
        });
      }

      // Find the order in any collection
      let order = null;
      let orderType = null;

      // Try Transaction collection first
      order = await Transaction.findById(orderId)
        .populate('product', 'title price product_photos')
        .populate('buyer', 'userName profile email phone')
        .populate('seller', 'userName profile email phone');
      
      if (order) {
        orderType = 'transaction';
      } else {
        // Try StandardPayment collection
        order = await StandardPayment.findById(orderId)
          .populate('product', 'title price product_photos')
          .populate('buyer', 'userName profile email phone')
          .populate('seller', 'userName profile email phone');
        
        if (order) {
          orderType = 'standardPayment';
        } else {
          // Try Order collection
          order = await Order.findById(orderId)
            .populate('product', 'title price product_photos')
            .populate('buyer', 'userName profile email phone')
            .populate('seller', 'userName profile email phone');
          
          if (order) {
            orderType = 'order';
          }
        }
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Verify seller permission
      const sellerId = order.seller?._id || order.seller;
      if (!sellerId || sellerId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Only the seller can mark order as shipped'
        });
      }

      // Check if order is in a shippable state
      let currentStatus = order.orderStatus || order.status;
      if (orderType === 'transaction' || orderType === 'standardPayment') {
        // Map payment status to order status if needed
        if (!order.orderStatus) {
          if (order.status === 'completed' || order.status === 'paid' || order.status === 'processing') {
            currentStatus = 'paid';
          } else {
            currentStatus = 'pending_payment';
          }
        }
      }

      if (!['paid', 'processing'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          error: `Cannot ship order with status: ${currentStatus}. Order must be paid or processing.`
        });
      }

      // Check if tracking already exists
      const existingTracking = await Tracking.findByOrderId(orderId, orderType);
      if (existingTracking) {
        return res.status(400).json({
          success: false,
          error: 'Order already has tracking information'
        });
      }

      // Validate tracking number format
      if (!UAEShippingService.validateTrackingNumber(shippingProvider, trackingId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tracking number format for the selected provider'
        });
      }

      // Generate provider tracking URL
      const providerTrackingUrl = UAEShippingService.generateTrackingUrl(shippingProvider, trackingId);
      
      // Generate AfterShip tracking URL
      const aftershipUrl = AfterShipService.generateTrackingUrl(shippingProvider, trackingId);

      // Create tracking record
      const trackingData = {
        orderId,
        orderType,
        transactionId: order.transactionId,
        buyer: order.buyer._id || order.buyer,
        seller: order.seller._id || order.seller,
        product: order.product._id || order.product,
        
        shippingProvider: {
          name: shippingProvider,
          serviceType: req.body.serviceType || 'standard',
          website: UAEShippingService.getProvider(shippingProvider)?.website || '',
          contactNumber: UAEShippingService.getProvider(shippingProvider)?.contact || ''
        },
        
        trackingId,
        trackingUrl: providerTrackingUrl,
        
        aftershipTracking: {
          slug: AfterShipService.getCourierSlug(shippingProvider),
          trackingNumber: trackingId,
          trackingUrl: aftershipUrl,
          isActive: true
        },
        
        shippingDetails: {
          shippedDate: new Date(),
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
          packageDetails: packageDetails || {},
          fromAddress: this.extractSellerAddress(order.seller),
          toAddress: this.extractShippingAddress(order)
        },
        
        status: 'shipped',
        
        trackingEvents: [{
          timestamp: new Date(),
          status: 'shipped',
          description: 'Package shipped by seller',
          source: 'manual'
        }],
        
        metadata: {
          sellerNotes: sellerNotes || '',
          shippingInstructions: shippingInstructions || ''
        },
        
        createdBy: userId
      };

      const tracking = new Tracking(trackingData);
      await tracking.save();

      // Update order status to 'shipped'
      await this.updateOrderStatus(order, orderType, 'shipped', 'Order marked as shipped by seller');

      // Populate tracking for response
      await tracking.populate([
        { path: 'buyer', select: 'userName profile email' },
        { path: 'seller', select: 'userName profile email' },
        { path: 'product', select: 'title price product_photos' }
      ]);

      console.log('✅ Order marked as shipped successfully');

      // Create AfterShip tracking (optional, don't fail if it doesn't work)
      try {
        const aftershipResult = await AfterShipService.createTracking({
          providerCode: shippingProvider,
          trackingNumber: trackingId,
          orderData: {
            orderId: order._id,
            transactionId: order.transactionId,
            buyer: order.buyer,
            seller: order.seller,
            product: order.product
          }
        });

        if (aftershipResult.success) {
          tracking.aftershipTracking.aftershipId = aftershipResult.aftershipId;
          await tracking.save();
          console.log('✅ AfterShip tracking created successfully');
        }
      } catch (aftershipError) {
        console.error('⚠️ AfterShip tracking creation failed (non-critical):', aftershipError);
      }

      // Send notification to buyer
      try {
        await this.notifyBuyerOrderShipped(tracking);
      } catch (notificationError) {
        console.error('Error sending shipping notification:', notificationError);
      }

      res.json({
        success: true,
        message: 'Order marked as shipped successfully',
        data: {
          tracking,
          aftershipUrl
        }
      });

    } catch (error) {
      console.error('❌ Mark as shipped error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark order as shipped',
        details: error.message
      });
    }
  }

  /**
   * Get tracking information for an order
   */
  async getOrderTracking(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      console.log('🔍 Getting tracking for order:', orderId);

      // Find tracking record
      let tracking = await Tracking.findOne({ 
        $or: [
          { orderId },
          { transactionId: orderId }
        ],
        isActive: true 
      })
      .populate('buyer', 'userName profile email')
      .populate('seller', 'userName profile email')
      .populate('product', 'title price product_photos');

      if (!tracking) {
        return res.status(404).json({
          success: false,
          error: 'Tracking information not found'
        });
      }

      // Check user permission
      const buyerId = tracking.buyer._id.toString();
      const sellerId = tracking.seller._id.toString();
      
      if (buyerId !== userId.toString() && sellerId !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          tracking,
          trackingUrl: tracking.fullTrackingUrl,
          aftershipUrl: tracking.aftershipTracking.trackingUrl
        }
      });

    } catch (error) {
      console.error('❌ Get tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tracking information',
        details: error.message
      });
    }
  }

  /**
   * Update tracking status (for webhooks or manual updates)
   */
  async updateTrackingStatus(req, res) {
    try {
      const { trackingId } = req.params;
      const { status, description, location, eventCode, source = 'manual' } = req.body;

      console.log('🔄 Updating tracking status:', { trackingId, status });

      const tracking = await Tracking.findByTrackingId(trackingId);
      if (!tracking) {
        return res.status(404).json({
          success: false,
          error: 'Tracking not found'
        });
      }

      // Add tracking event
      await tracking.addTrackingEvent({
        status,
        description,
        location,
        eventCode,
        source
      });

      // If delivered, update order status and send notifications
      if (status === 'delivered') {
        await this.handleDeliveryUpdate(tracking);
      }

      res.json({
        success: true,
        message: 'Tracking status updated successfully',
        data: { tracking }
      });

    } catch (error) {
      console.error('❌ Update tracking status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tracking status',
        details: error.message
      });
    }
  }

  /**
   * Get user's shipments (buyer or seller)
   */
  async getUserShipments(req, res) {
    try {
      const userId = req.user._id;
      const { role = 'buyer', status, page = 1, limit = 10 } = req.query;

      console.log('📦 Getting shipments for user:', userId, 'role:', role);

      const query = { isActive: true };
      
      if (role === 'buyer') {
        query.buyer = userId;
      } else if (role === 'seller') {
        query.seller = userId;
      } else {
        query.$or = [{ buyer: userId }, { seller: userId }];
      }

      if (status) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      const [shipments, totalCount] = await Promise.all([
        Tracking.find(query)
          .populate('buyer', 'userName profile email')
          .populate('seller', 'userName profile email')
          .populate('product', 'title price product_photos')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        
        Tracking.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          shipments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limitNum),
            totalShipments: totalCount,
            hasNext: skip + shipments.length < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('❌ Get user shipments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get shipments',
        details: error.message
      });
    }
  }

  /**
   * Confirm delivery (buyer only)
   */
  async confirmDelivery(req, res) {
    try {
      const { trackingId } = req.params;
      const userId = req.user._id;
      const { rating, feedback, deliveryProof } = req.body;

      console.log('✅ Confirming delivery:', trackingId);

      const tracking = await Tracking.findByTrackingId(trackingId)
        .populate('buyer', 'userName profile email')
        .populate('seller', 'userName profile email');

      if (!tracking) {
        return res.status(404).json({
          success: false,
          error: 'Tracking not found'
        });
      }

      // Only buyer can confirm delivery
      if (tracking.buyer._id.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Only the buyer can confirm delivery'
        });
      }

      // Mark as delivered
      await tracking.markAsDelivered({
        deliveredTo: tracking.buyer.userName,
        deliveryProof,
        confirmedBy: 'buyer'
      });

      // Update the original order status
      await this.updateOrderStatusToDelivered(tracking, rating, feedback);

      res.json({
        success: true,
        message: 'Delivery confirmed successfully',
        data: { tracking }
      });

    } catch (error) {
      console.error('❌ Confirm delivery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm delivery',
        details: error.message
      });
    }
  }

  /**
   * Get available shipping providers
   */
  async getShippingProviders(req, res) {
    try {
      const providers = UAEShippingService.getAllProviders();
      
      res.json({
        success: true,
        data: {
          providers
        }
      });

    } catch (error) {
      console.error('❌ Get shipping providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get shipping providers',
        details: error.message
      });
    }
  }

  /**
   * Get shipping options for destination
   */
  async getShippingOptions(req, res) {
    try {
      const { destination } = req.body;

      if (!destination || !destination.country) {
        return res.status(400).json({
          success: false,
          error: 'Destination country is required'
        });
      }

      const options = UAEShippingService.getShippingOptions(destination);
      
      res.json({
        success: true,
        data: {
          options,
          destination
        }
      });

    } catch (error) {
      console.error('❌ Get shipping options error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get shipping options',
        details: error.message
      });
    }
  }

  /**
   * Sync tracking with provider API
   */
  async syncTrackingWithProvider(req, res) {
    try {
      const { trackingId } = req.params;

      const tracking = await Tracking.findByTrackingId(trackingId);
      if (!tracking) {
        return res.status(404).json({
          success: false,
          error: 'Tracking not found'
        });
      }

      // Try to get updated tracking from provider
      const providerData = await UAEShippingService.trackShipment(
        tracking.shippingProvider.name,
        tracking.trackingId
      );

      // Update tracking events
      if (providerData.events && providerData.events.length > 0) {
        for (const event of providerData.events) {
          // Check if event already exists
          const existingEvent = tracking.trackingEvents.find(e => 
            e.timestamp.getTime() === new Date(event.timestamp).getTime() &&
            e.description === event.description
          );

          if (!existingEvent) {
            tracking.trackingEvents.push({
              timestamp: new Date(event.timestamp),
              status: event.status,
              description: event.description,
              location: event.location,
              source: 'api_sync'
            });
          }
        }

        // Update main status
        if (providerData.status) {
          tracking.status = providerData.status;
        }

        await tracking.save();
      }

      res.json({
        success: true,
        message: 'Tracking synced successfully',
        data: {
          tracking,
          providerData
        }
      });

    } catch (error) {
      console.error('❌ Sync tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync tracking',
        details: error.message
      });
    }
  }

  // Helper methods

  /**
   * Extract seller address from user profile
   */
  extractSellerAddress(seller) {
    // This would extract from seller's profile/address
    // For now, return basic structure
    return {
      fullName: seller.userName || seller.profile?.firstName + ' ' + seller.profile?.lastName,
      city: seller.profile?.city || 'Dubai',
      country: 'UAE'
    };
  }

  /**
   * Extract shipping address from order
   */
  extractShippingAddress(order) {
    let shippingAddress = null;
    
    if (order.shippingAddress) {
      shippingAddress = order.shippingAddress;
    } else if (order.escrowTransaction?.shippingAddress) {
      shippingAddress = order.escrowTransaction.shippingAddress;
    }
    
    if (shippingAddress) {
      return {
        fullName: shippingAddress.fullName,
        street1: shippingAddress.street1,
        street2: shippingAddress.street2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zip || shippingAddress.zipCode,
        country: shippingAddress.country,
        phoneNumber: shippingAddress.phoneNumber || shippingAddress.phone
      };
    }
    
    return {};
  }

  /**
   * Update order status in the appropriate collection
   */
  async updateOrderStatus(order, orderType, status, description) {
    const updateData = {
      orderStatus: status,
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          description,
          updatedBy: 'seller'
        }
      }
    };

    if (orderType === 'transaction') {
      await Transaction.findByIdAndUpdate(order._id, updateData);
    } else if (orderType === 'standardPayment') {
      await StandardPayment.findByIdAndUpdate(order._id, updateData);
    } else if (orderType === 'order') {
      await Order.findByIdAndUpdate(order._id, {
        status,
        $push: {
          timeline: {
            status,
            timestamp: new Date(),
            description,
            updatedBy: 'seller'
          }
        }
      });
    }
  }

  /**
   * Update order status to delivered
   */
  async updateOrderStatusToDelivered(tracking, rating, feedback) {
    const updateData = {
      orderStatus: 'delivered',
      deliveryConfirmedAt: new Date(),
      deliveryConfirmedBy: 'buyer',
      $push: {
        statusHistory: {
          status: 'delivered',
          timestamp: new Date(),
          description: 'Delivery confirmed by buyer',
          updatedBy: 'buyer'
        }
      }
    };

    if (rating) {
      updateData.deliveryRating = rating;
      updateData.deliveryFeedback = feedback;
      updateData.ratedAt = new Date();
    }

    if (tracking.orderType === 'transaction') {
      await Transaction.findByIdAndUpdate(tracking.orderId, updateData);
    } else if (tracking.orderType === 'standardPayment') {
      await StandardPayment.findByIdAndUpdate(tracking.orderId, updateData);
    } else if (tracking.orderType === 'order') {
      await Order.findByIdAndUpdate(tracking.orderId, {
        status: 'delivered',
        'delivery.confirmationDate': new Date(),
        'delivery.confirmedBy': 'buyer',
        'delivery.rating.deliveryRating': rating,
        'delivery.rating.feedback': feedback,
        'delivery.rating.ratedAt': new Date(),
        $push: {
          timeline: {
            status: 'delivered',
            timestamp: new Date(),
            description: 'Delivery confirmed by buyer',
            updatedBy: 'buyer'
          }
        }
      });
    }
  }

  /**
   * Handle delivery status update
   */
  async handleDeliveryUpdate(tracking) {
    // Update order status to delivered
    await this.updateOrderStatus(
      { _id: tracking.orderId }, 
      tracking.orderType, 
      'delivered', 
      'Package delivered successfully'
    );

    // Send notifications
    try {
      await this.notifyDeliveryComplete(tracking);
    } catch (error) {
      console.error('Error sending delivery notification:', error);
    }
  }

  /**
   * Send notification to buyer when order is shipped
   */
  async notifyBuyerOrderShipped(tracking) {
    // This would integrate with your notification service
    console.log('📧 Sending shipping notification to buyer:', tracking.buyer.userName);
    
    // Example notification data
    const notificationData = {
      type: 'order_shipped',
      recipient: tracking.buyer._id,
      title: 'Your order has been shipped!',
      message: `Your order for ${tracking.product.title} has been shipped. Track it here: ${tracking.fullTrackingUrl}`,
      data: {
        orderId: tracking.orderId,
        trackingId: tracking.trackingId,
        trackingUrl: tracking.fullTrackingUrl,
        aftershipUrl: tracking.aftershipTracking.trackingUrl
      }
    };

    // Send notification using your notification service
    // await NotificationService.sendNotification(notificationData);
  }

  /**
   * Send notification when delivery is complete
   */
  async notifyDeliveryComplete(tracking) {
    console.log('📧 Sending delivery notification:', tracking.transactionId);
    
    // Notify both buyer and seller
    const notifications = [
      {
        type: 'order_delivered',
        recipient: tracking.buyer._id,
        title: 'Your order has been delivered!',
        message: `Your order for ${tracking.product.title} has been delivered successfully.`
      },
      {
        type: 'order_delivered',
        recipient: tracking.seller._id,
        title: 'Order delivered successfully!',
        message: `Your sold item ${tracking.product.title} has been delivered to the buyer.`
      }
    ];

    // Send notifications
    // for (const notification of notifications) {
    //   await NotificationService.sendNotification(notification);
    // }
  }
}

module.exports = new TrackingController();