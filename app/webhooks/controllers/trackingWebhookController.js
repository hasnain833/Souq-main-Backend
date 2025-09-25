const Tracking = require('../../../db/models/trackingModel');
const AfterShipService = require('../../../services/shipping/AfterShipService');

class TrackingWebhookController {
  
  /**
   * Handle AfterShip webhook updates
   */
  async handleAfterShipWebhook(req, res) {
    try {
      console.log('📨 AfterShip webhook received');

      // Validate webhook signature if secret is configured
      const webhookSecret = process.env.AFTERSHIP_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['aftership-hmac-sha256'];
        const payload = JSON.stringify(req.body);
        
        if (!AfterShipService.validateWebhookSignature(payload, signature, webhookSecret)) {
          console.error('❌ Invalid AfterShip webhook signature');
          return res.status(401).json({
            success: false,
            error: 'Invalid webhook signature'
          });
        }
      }

      // Process webhook data
      const webhookResult = await AfterShipService.handleWebhook(req.body);
      
      if (!webhookResult.success) {
        console.error('❌ Failed to process AfterShip webhook:', webhookResult.error);
        return res.status(400).json({
          success: false,
          error: webhookResult.error
        });
      }

      const trackingInfo = webhookResult.data;

      // Find tracking record by AfterShip ID or tracking number
      let tracking = await Tracking.findOne({
        $or: [
          { 'aftershipTracking.aftershipId': trackingInfo.aftershipId },
          { trackingId: trackingInfo.trackingNumber }
        ],
        isActive: true
      });

      if (!tracking) {
        console.warn('⚠️ Tracking not found for AfterShip webhook:', trackingInfo.trackingNumber);
        return res.status(404).json({
          success: false,
          error: 'Tracking not found'
        });
      }

      // Update tracking status
      const internalStatus = AfterShipService.mapAfterShipStatus(trackingInfo.status);
      
      // Add tracking event
      const eventData = {
        timestamp: new Date(),
        status: internalStatus,
        description: trackingInfo.statusDescription,
        source: 'aftership'
      };

      // Add location if available from last checkpoint
      if (trackingInfo.lastCheckpoint) {
        eventData.location = {
          city: trackingInfo.lastCheckpoint.city,
          state: trackingInfo.lastCheckpoint.state,
          country: trackingInfo.lastCheckpoint.country_name
        };
      }

      await tracking.addTrackingEvent(eventData);

      // Handle special status updates
      if (internalStatus === 'delivered') {
        await this.handleDeliveryWebhook(tracking);
      }

      console.log('✅ AfterShip webhook processed successfully');

      res.json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      console.error('❌ AfterShip webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
        details: error.message
      });
    }
  }

  /**
   * Handle delivery webhook updates
   */
  async handleDeliveryWebhook(tracking) {
    try {
      console.log('📦 Processing delivery webhook for:', tracking.trackingId);

      // Mark as delivered if not already
      if (!tracking.deliveryConfirmation.isDelivered) {
        await tracking.markAsDelivered({
          confirmedBy: 'shipping_provider'
        });
      }

      // Update order status in the appropriate collection
      await this.updateOrderStatusToDelivered(tracking);

      // Send notifications
      await this.sendDeliveryNotifications(tracking);

    } catch (error) {
      console.error('❌ Error handling delivery webhook:', error);
    }
  }

  /**
   * Update order status to delivered
   */
  async updateOrderStatusToDelivered(tracking) {
    const Transaction = require('../../../db/models/transactionModel');
    const StandardPayment = require('../../../db/models/standardPaymentModel');
    const Order = require('../../../db/models/orderModel');

    const updateData = {
      orderStatus: 'delivered',
      deliveryConfirmedAt: new Date(),
      deliveryConfirmedBy: 'shipping_provider',
      $push: {
        statusHistory: {
          status: 'delivered',
          timestamp: new Date(),
          description: 'Package delivered (confirmed by shipping provider)',
          updatedBy: 'shipping_provider'
        }
      }
    };

    try {
      if (tracking.orderType === 'transaction') {
        await Transaction.findByIdAndUpdate(tracking.orderId, updateData);
      } else if (tracking.orderType === 'standardPayment') {
        await StandardPayment.findByIdAndUpdate(tracking.orderId, updateData);
      } else if (tracking.orderType === 'order') {
        await Order.findByIdAndUpdate(tracking.orderId, {
          status: 'delivered',
          'delivery.confirmationDate': new Date(),
          'delivery.confirmedBy': 'shipping_provider',
          $push: {
            timeline: {
              status: 'delivered',
              timestamp: new Date(),
              description: 'Package delivered (confirmed by shipping provider)',
              updatedBy: 'shipping_provider'
            }
          }
        });
      }

      console.log('✅ Order status updated to delivered');

    } catch (error) {
      console.error('❌ Error updating order status:', error);
    }
  }

  /**
   * Send delivery notifications
   */
  async sendDeliveryNotifications(tracking) {
    try {
      // This would integrate with your notification service
      console.log('📧 Sending delivery notifications for:', tracking.transactionId);

      // Example notification data
      const notifications = [
        {
          type: 'order_delivered',
          recipient: tracking.buyer,
          title: 'Your order has been delivered!',
          message: `Your order ${tracking.transactionId} has been delivered successfully.`,
          data: {
            orderId: tracking.orderId,
            trackingId: tracking.trackingId,
            transactionId: tracking.transactionId
          }
        },
        {
          type: 'order_delivered',
          recipient: tracking.seller,
          title: 'Order delivered successfully!',
          message: `Your sold item from order ${tracking.transactionId} has been delivered.`,
          data: {
            orderId: tracking.orderId,
            trackingId: tracking.trackingId,
            transactionId: tracking.transactionId
          }
        }
      ];

      // Send notifications using your notification service
      // for (const notification of notifications) {
      //   await NotificationService.sendNotification(notification);
      // }

    } catch (error) {
      console.error('❌ Error sending delivery notifications:', error);
    }
  }

  /**
   * Handle provider-specific webhooks (Aramex, DHL, etc.)
   */
  async handleProviderWebhook(req, res) {
    try {
      const { provider } = req.params;
      console.log(`📨 ${provider} webhook received`);

      // This would handle provider-specific webhook formats
      // For now, we'll return a generic response
      
      res.json({
        success: true,
        message: `${provider} webhook received`
      });

    } catch (error) {
      console.error(`❌ ${req.params.provider} webhook error:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }
}

module.exports = new TrackingWebhookController();