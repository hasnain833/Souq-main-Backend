const Tracking = require('../../../../db/models/trackingModel');
const Order = require('../../../../db/models/orderModel');
const Product = require('../../../../db/models/productModel');
const User = require('../../../../db/models/userModel');
const NotificationService = require('../../../../services/NotificationService');
const OrderEmailService = require('../../../../services/OrderEmailService');
const UAEShippingService = require('../../../../services/shipping/UAEShippingService');
// OLD: AfterShip Service (commented out - replaced with manual tracking)
// const AfterShipService = require('../../../../services/shipping/AfterShipService');
// NEW: 17Track Service (optional helper for URL generation)
const SeventeenTrackService = require('../../../../services/shipping/SeventeenTrackService');

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

      // Relax validation: allow marking shipped without tracking details
      if (!trackingId) {
        console.warn('No tracking ID provided, marking as shipped manually');
      }

      // COD-only: find the order directly in Orders collection
      let order = await Order.findById(orderId)
        .populate('product', 'title price product_photos')
        .populate('buyer', 'userName profile email phone firstName lastName')
        .populate('seller', 'userName profile email phone firstName lastName')
        .populate('escrowPayment');

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

      // COD-only: allow shipping when status is Pending or Paid
      const currentStatus = order.status || 'Pending';
      if (!['Pending', 'Paid'].includes(currentStatus)) {
        return res.status(400).json({ success: false, error: `Cannot ship order with status: ${currentStatus}.` });
      }

      // Check if tracking already exists (only when trackingId provided)
      if (trackingId) {
        const existingTracking = await Tracking.findByOrderId(orderId, 'order');
        if (existingTracking) {
          return res.status(400).json({ success: false, error: 'Order already has tracking information' });
        }
      }

      // Validate tracking number format only if provided
      // Allow any tracking ID format for testing (relaxed validation)
      // In production, you may want to enforce strict format validation
      if (trackingId && trackingId.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Tracking ID must be at least 3 characters long' });
      }

      // Optional: Strict validation (uncomment for production)
      // if (trackingId && !UAEShippingService.validateTrackingNumber(shippingProvider, trackingId)) {
      //   return res.status(400).json({ success: false, error: 'Invalid tracking number format for the selected provider' });
      // }

      // OLD: Generate provider tracking URL automatically (commented out)
      // const providerTrackingUrl = (trackingId && shippingProvider)
      //   ? UAEShippingService.generateTrackingUrl(shippingProvider, trackingId)
      //   : null;

      // OLD: Generate AfterShip tracking URL automatically (commented out)
      // const aftershipUrl = trackingId
      //   ? AfterShipService.generateTrackingUrl(shippingProvider, trackingId)
      //   : null;

      // NEW: Use seller-provided tracking URL (primary method)
      // Seller manually provides tracking URL from courier
      const sellerProvidedTrackingUrl = trackingUrl || null;

      // Optional: Generate provider tracking URL as fallback if seller didn't provide URL
      const providerTrackingUrl = (!sellerProvidedTrackingUrl && trackingId && shippingProvider)
        ? UAEShippingService.generateTrackingUrl(shippingProvider, trackingId)
        : null;

      // Use seller-provided URL, fallback to generated provider URL, or null
      const finalTrackingUrl = sellerProvidedTrackingUrl || providerTrackingUrl || null;

      // Optional: Generate 17Track URL if needed (for reference/display)
      const seventeenTrackUrl = trackingId
        ? SeventeenTrackService.generateTrackingUrl(trackingId, shippingProvider)
        : null;

      // Extract addresses before creating tracking data
      // Define helper functions inline to avoid 'this' context issues
      const extractSellerAddress = (seller) => {
        if (!seller) {
          return {
            fullName: 'Seller',
            street1: '',
            street2: '',
            city: 'Dubai',
            state: '',
            zipCode: '',
            country: 'UAE',
            phoneNumber: ''
          };
        }

        const firstName = seller?.firstName || seller?.profile?.firstName || '';
        const lastName = seller?.lastName || seller?.profile?.lastName || '';
        const fullName = seller?.userName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : 'Seller');

        return {
          fullName: fullName || 'Seller',
          street1: seller?.profile?.street1 || seller?.address?.street1 || '',
          street2: seller?.profile?.street2 || seller?.address?.street2 || '',
          city: seller?.profile?.city || seller?.address?.city || 'Dubai',
          state: seller?.profile?.state || seller?.address?.state || '',
          zipCode: seller?.profile?.zipCode || seller?.address?.zipCode || '',
          country: seller?.profile?.country || seller?.address?.country || 'UAE',
          phoneNumber: seller?.phoneNumber || seller?.phone || seller?.profile?.phoneNumber || ''
        };
      };

      const extractShippingAddress = (order) => {
        let shippingAddress = null;

        // Check multiple possible locations for shipping address
        if (order.shipping?.toAddress) {
          // COD orders store address in order.shipping.toAddress
          shippingAddress = order.shipping.toAddress;
        } else if (order.shippingAddress) {
          shippingAddress = order.shippingAddress;
        } else if (order.escrowTransaction?.shippingAddress) {
          shippingAddress = order.escrowTransaction.shippingAddress;
        }

        if (shippingAddress) {
          return {
            fullName: shippingAddress.fullName || shippingAddress.name || '',
            street1: shippingAddress.street1 || shippingAddress.street || shippingAddress.addressLine1 || '',
            street2: shippingAddress.street2 || shippingAddress.addressLine2 || '',
            city: shippingAddress.city || '',
            state: shippingAddress.state || shippingAddress.province || '',
            zipCode: shippingAddress.zip || shippingAddress.zipCode || shippingAddress.postalCode || '',
            country: shippingAddress.country || '',
            phoneNumber: shippingAddress.phoneNumber || shippingAddress.phone || ''
          };
        }

        // Return empty object if no address found (don't fail the request)
        return {
          fullName: '',
          street1: '',
          street2: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
          phoneNumber: ''
        };
      };

      const sellerAddress = extractSellerAddress(order.seller);
      const shippingAddress = extractShippingAddress(order);

      // Create tracking record only if tracking info is provided
      // Get transaction ID from various possible locations
      const transactionId = order.payment?.transactionId ||
        order.payment?.providerPaymentId ||
        order.escrowPayment?.stripePaymentIntentId ||
        order.escrowPayment?.paypalCaptureId ||
        order.escrowPayment?.paypalOrderId ||
        order.providerPaymentId ||
        order.transactionId ||
        order.orderNumber ||
        `TXN-${order._id}-${Date.now()}`;

      // NEW: Create tracking record when trackingId is provided (trackingUrl is optional but recommended)
      // OLD: Only create a tracking record when both trackingId and provider are present
      // const shouldCreateTracking = Boolean(trackingId && shippingProvider);
      const shouldCreateTracking = Boolean(trackingId); // Now only requires trackingId
      const trackingData = shouldCreateTracking ? {
        orderId,
        orderType: 'order', // Set orderType to 'order' for COD orders
        transactionId: transactionId, // Use orderNumber or payment transactionId for COD orders
        buyer: order.buyer._id || order.buyer,
        seller: order.seller._id || order.seller,
        product: order.product._id || order.product,

        shippingProvider: {
          name: shippingProvider || 'other',
          serviceType: req.body.serviceType || 'standard',
          website: shippingProvider ? (UAEShippingService.getProvider(shippingProvider)?.website || '') : '',
          contactNumber: shippingProvider ? (UAEShippingService.getProvider(shippingProvider)?.contact || '') : ''
        },

        trackingId,
        // NEW: Use seller-provided tracking URL (primary) or fallback to generated URL
        trackingUrl: finalTrackingUrl,

        // OLD: AfterShip tracking (commented out - replaced with manual tracking)
        // aftershipTracking: {
        //   slug: AfterShipService.getCourierSlug(shippingProvider),
        //   trackingNumber: trackingId,
        //   trackingUrl: aftershipUrl,
        //   isActive: true
        // },
        
        // NEW: Optional 17Track reference (for display/reference only)
        // Note: This is optional since sellers provide URLs manually
        seventeenTrackTracking: {
          trackingUrl: seventeenTrackUrl,
          isActive: Boolean(seventeenTrackUrl)
        },

        shippingDetails: {
          shippedDate: new Date(),
          estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
          packageDetails: packageDetails || {},
          fromAddress: sellerAddress,
          toAddress: shippingAddress
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
      } : null;

      let tracking = null;
      if (trackingData) {
        tracking = new Tracking(trackingData);
        await tracking.save();
      }

      // Update order status and timeline as canonical path
      // Update both status fields to ensure consistency
      order.status = 'Shipped';
      order.orderStatus = 'Shipped';
      // Default tracking number if missing (manual shipment)
      const generatedTracking = `TRK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      // Ensure nested structures exist
      order.shipping = order.shipping || {};
      order.timeline = Array.isArray(order.timeline) ? order.timeline : [];
      order.shipping.trackingNumber = trackingId || order.shipping.trackingNumber || generatedTracking;
      // NEW: Use seller-provided tracking URL or fallback
      if (finalTrackingUrl) order.shipping.trackingUrl = finalTrackingUrl;
      // OLD: if (providerTrackingUrl) order.shipping.trackingUrl = providerTrackingUrl;
      if (estimatedDelivery) order.shipping.estimatedDelivery = new Date(estimatedDelivery);
      order.timeline.push({
        status: 'Shipped',
        timestamp: new Date(),
        description: 'Seller marked order as shipped',
        updatedBy: 'seller'
      });
      await order.save();

      // Populate tracking for response
      if (tracking) {
        await tracking.populate([
          { path: 'buyer', select: 'userName profile email' },
          { path: 'seller', select: 'userName profile email' },
          { path: 'product', select: 'title price product_photos' }
        ]);
      }

      // OLD: Create AfterShip tracking automatically via API (commented out)
      // if (tracking) {
      //   try {
      //     const aftershipResult = await AfterShipService.createTracking({
      //       providerCode: shippingProvider,
      //       trackingNumber: trackingId,
      //       orderData: { orderId: order._id, transactionId: order.transactionId, buyer: order.buyer, seller: order.seller, product: order.product }
      //     });
      //     if (aftershipResult.success) {
      //       tracking.aftershipTracking.aftershipId = aftershipResult.aftershipId;
      //       await tracking.save();
      //     }
      //   } catch (aftershipError) {
      //     console.error('⚠️ AfterShip tracking creation failed (non-critical):', aftershipError);
      //   }
      // }

      // NEW: Optional 17Track tracking creation (if using API - currently disabled)
      // Note: Sellers provide tracking URLs manually, so API calls are optional
      // if (tracking && process.env.SEVENTEENTRACK_API_KEY) {
      //   try {
      //     const seventeenTrackResult = await SeventeenTrackService.createTracking({
      //       providerCode: shippingProvider,
      //       trackingNumber: trackingId,
      //       orderData: { orderId: order._id, transactionId: order.transactionId, buyer: order.buyer, seller: order.seller, product: order.product }
      //     });
      //     if (seventeenTrackResult.success) {
      //     }
      //   } catch (seventeenTrackError) {
      //     console.error('⚠️ 17Track tracking creation failed (non-critical):', seventeenTrackError);
      //   }
      // }

      // Send notification + socket event to buyer
      try {
        await NotificationService.notifyOrderShipped(order, order.seller, order.buyer);
        const { getSocketIO } = require('../../../../app/user/notifications/controllers/notificationController');
        const io = getSocketIO && getSocketIO();
        if (io) {
          io.to(`user_${order.buyer._id}`).emit('orderShipped', { orderId: order._id });
        }
      } catch (notificationError) {
        console.error('Error sending shipping notification:', notificationError);
      }

      // Send order shipped email to buyer
      try {
        const shippingDetails = {
          trackingNumber: trackingId || order.shipping?.trackingNumber,
          provider: shippingProvider,
          carrier: shippingProvider,
          estimatedDelivery: estimatedDelivery || order.shipping?.estimatedDelivery
        };
        
        await OrderEmailService.sendOrderShippedEmail(
          order,
          order.buyer,
          order.seller,
          order.product,
          shippingDetails
        );
      } catch (emailError) {
        console.error('Error sending order shipped email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: 'Order marked as shipped successfully',
        data: {
          tracking,
          trackingUrl: finalTrackingUrl, // NEW: Return seller-provided or generated tracking URL
          // OLD: aftershipUrl (commented out)
          // aftershipUrl
          seventeenTrackUrl: seventeenTrackUrl // NEW: Optional 17Track URL for reference
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
          trackingUrl: tracking.fullTrackingUrl || tracking.trackingUrl, // NEW: Use tracking URL (seller-provided or generated)
          // OLD: aftershipUrl: tracking.aftershipTracking.trackingUrl (commented out)
          // aftershipUrl: tracking.aftershipTracking?.trackingUrl
          seventeenTrackUrl: tracking.seventeenTrackTracking?.trackingUrl // NEW: Optional 17Track URL
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

      // Send delivery confirmation emails to buyer and seller
      try {
        // Fetch the order with populated data for email
        const order = await Order.findById(tracking.orderId)
          .populate('buyer', 'userName email firstName lastName')
          .populate('seller', 'userName email firstName lastName')
          .populate('product', 'title');

        if (order) {
          const deliveryDetails = {
            deliveryDate: new Date(),
            rating: rating,
            feedback: feedback,
            orderValue: order.totalAmount || order.orderDetails?.productPrice || 0
          };

          await OrderEmailService.sendDeliveryConfirmationEmails(
            order,
            order.buyer,
            order.seller,
            order.product,
            deliveryDetails
          );
        }
      } catch (emailError) {
        console.error('Error sending delivery confirmation emails:', emailError);
        // Don't fail the request if email fails
      }

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
    // For now, return basic structure with safe defaults
    if (!seller) {
      return {
        fullName: 'Seller',
        street1: '',
        street2: '',
        city: 'Dubai',
        state: '',
        zipCode: '',
        country: 'UAE',
        phoneNumber: ''
      };
    }

    const firstName = seller?.firstName || seller?.profile?.firstName || '';
    const lastName = seller?.lastName || seller?.profile?.lastName || '';
    const fullName = seller?.userName || (firstName && lastName ? `${firstName} ${lastName}`.trim() : 'Seller');

    return {
      fullName: fullName || 'Seller',
      street1: seller?.profile?.street1 || seller?.address?.street1 || '',
      street2: seller?.profile?.street2 || seller?.address?.street2 || '',
      city: seller?.profile?.city || seller?.address?.city || 'Dubai',
      state: seller?.profile?.state || seller?.address?.state || '',
      zipCode: seller?.profile?.zipCode || seller?.address?.zipCode || '',
      country: seller?.profile?.country || seller?.address?.country || 'UAE',
      phoneNumber: seller?.phoneNumber || seller?.phone || seller?.profile?.phoneNumber || ''
    };
  }

  /**
   * Extract shipping address from order
   */
  extractShippingAddress(order) {
    let shippingAddress = null;

    // Check multiple possible locations for shipping address
    if (order.shipping?.toAddress) {
      // COD orders store address in order.shipping.toAddress
      shippingAddress = order.shipping.toAddress;
    } else if (order.shippingAddress) {
      shippingAddress = order.shippingAddress;
    } else if (order.escrowTransaction?.shippingAddress) {
      shippingAddress = order.escrowTransaction.shippingAddress;
    }

    if (shippingAddress) {
      return {
        fullName: shippingAddress.fullName || shippingAddress.name || '',
        street1: shippingAddress.street1 || shippingAddress.street || shippingAddress.addressLine1 || '',
        street2: shippingAddress.street2 || shippingAddress.addressLine2 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || shippingAddress.province || '',
        zipCode: shippingAddress.zip || shippingAddress.zipCode || shippingAddress.postalCode || '',
        country: shippingAddress.country || '',
        phoneNumber: shippingAddress.phoneNumber || shippingAddress.phone || ''
      };
    }

    // Return empty object if no address found (don't fail the request)
    return {
      fullName: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      phoneNumber: ''
    };
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