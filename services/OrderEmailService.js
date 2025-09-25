// services/OrderEmailService.js

const sendMail = require('../utils/senMail');
const { getOrderShippedEmailHTML } = require('../utils/orderShippedEmailTemplate');
const { 
  getBuyerDeliveryConfirmationEmailHTML, 
  getSellerDeliveryNotificationEmailHTML 
} = require('../utils/orderDeliveredEmailTemplate');

class OrderEmailService {
  /**
   * Send email notification when order is shipped
   * @param {Object} orderData - Order information
   * @param {Object} buyer - Buyer information
   * @param {Object} seller - Seller information
   * @param {Object} product - Product information
   * @param {Object} shippingDetails - Shipping details (tracking, carrier, etc.)
   */
  static async sendOrderShippedEmail(orderData, buyer, seller, product, shippingDetails = {}) {
    try {
      console.log('📧 Preparing to send order shipped email...');
      console.log('📧 Order data:', {
        orderId: orderData._id,
        orderNumber: orderData.orderNumber || orderData.transactionId,
        buyerEmail: buyer?.email,
        productTitle: product?.title
      });
      
      console.log('📧 Buyer data:', {
        id: buyer?._id,
        email: buyer?.email,
        firstName: buyer?.firstName,
        userName: buyer?.userName
      });
      
      console.log('📧 Seller data:', {
        id: seller?._id,
        email: seller?.email,
        firstName: seller?.firstName,
        userName: seller?.userName
      });
      
      console.log('📧 Product data:', {
        id: product?._id,
        title: product?.title
      });
      
      console.log('📧 Shipping details:', shippingDetails);

      if (!buyer || !buyer.email) {
        console.error('❌ Cannot send shipped email: Buyer or buyer email is missing');
        console.error('❌ Buyer object:', buyer);
        return { success: false, error: 'Buyer email is missing' };
      }

      // Prepare email data
      const emailData = {
        orderNumber: orderData.orderNumber || orderData.transactionId || `ORD-${orderData._id}`,
        buyerName: buyer.firstName || buyer.userName || 'Customer',
        productTitle: product.title || 'Your Item',
        trackingNumber: shippingDetails.trackingNumber || null,
        carrier: shippingDetails.provider || shippingDetails.carrier || null,
        estimatedDelivery: shippingDetails.estimatedDelivery || null,
        sellerName: seller.firstName || seller.userName || 'Seller'
      };

      console.log('📧 Email data prepared:', emailData);

      // Generate HTML content
      const htmlContent = getOrderShippedEmailHTML(emailData);

      // Send email
      const subject = `📦 Your Order ${emailData.orderNumber} Has Been Shipped!`;
      
      console.log('📧 Sending email to:', buyer.email);
      const result = await sendMail(buyer.email, subject, htmlContent);

      console.log('✅ Order shipped email sent successfully:', {
        messageId: result.messageId,
        buyerEmail: buyer.email,
        orderNumber: emailData.orderNumber
      });

      return { 
        success: true, 
        messageId: result.messageId,
        simulated: result.simulated || false
      };

    } catch (error) {
      console.error('❌ Failed to send order shipped email:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send email notifications when delivery is confirmed by buyer
   * Sends thank you email to buyer and notification email to seller
   * @param {Object} orderData - Order information
   * @param {Object} buyer - Buyer information
   * @param {Object} seller - Seller information
   * @param {Object} product - Product information
   * @param {Object} deliveryDetails - Delivery details (rating, feedback, etc.)
   */
  static async sendDeliveryConfirmationEmails(orderData, buyer, seller, product, deliveryDetails = {}) {
    try {
      console.log('📧 Preparing to send delivery confirmation emails...');
      console.log('📧 Order data:', {
        orderId: orderData._id,
        orderNumber: orderData.orderNumber || orderData.transactionId,
        buyerEmail: buyer?.email,
        sellerEmail: seller?.email,
        productTitle: product?.title
      });
      
      console.log('📧 Delivery details:', deliveryDetails);

      const results = {
        buyerEmail: { success: false },
        sellerEmail: { success: false }
      };

      // Prepare common email data
      const commonEmailData = {
        orderNumber: orderData.orderNumber || orderData.transactionId || `ORD-${orderData._id}`,
        buyerName: buyer?.firstName || buyer?.userName || 'Customer',
        sellerName: seller?.firstName || seller?.userName || 'Seller',
        productTitle: product?.title || 'Item',
        deliveryDate: deliveryDetails.deliveryDate || new Date(),
        rating: deliveryDetails.rating || null,
        feedback: deliveryDetails.feedback || null,
        orderValue: deliveryDetails.orderValue || null
      };

      // Send thank you email to buyer
      if (buyer && buyer.email) {
        try {
          console.log('📧 Sending thank you email to buyer:', buyer.email);
          
          const buyerEmailHTML = getBuyerDeliveryConfirmationEmailHTML(commonEmailData);
          const buyerSubject = `🎉 Thank You for Your Order ${commonEmailData.orderNumber}!`;
          
          const buyerResult = await sendMail(buyer.email, buyerSubject, buyerEmailHTML);
          
          results.buyerEmail = {
            success: true,
            messageId: buyerResult.messageId,
            simulated: buyerResult.simulated || false
          };
          
          console.log('✅ Buyer thank you email sent successfully:', {
            messageId: buyerResult.messageId,
            buyerEmail: buyer.email
          });
          
        } catch (buyerError) {
          console.error('❌ Failed to send buyer thank you email:', buyerError);
          results.buyerEmail = {
            success: false,
            error: buyerError.message
          };
        }
      } else {
        console.error('❌ Cannot send buyer email: Buyer or buyer email is missing');
        results.buyerEmail = {
          success: false,
          error: 'Buyer email is missing'
        };
      }

      // Send notification email to seller
      if (seller && seller.email) {
        try {
          console.log('📧 Sending delivery notification email to seller:', seller.email);
          
          const sellerEmailHTML = getSellerDeliveryNotificationEmailHTML(commonEmailData);
          const sellerSubject = `✅ Order ${commonEmailData.orderNumber} Delivered Successfully!`;
          
          const sellerResult = await sendMail(seller.email, sellerSubject, sellerEmailHTML);
          
          results.sellerEmail = {
            success: true,
            messageId: sellerResult.messageId,
            simulated: sellerResult.simulated || false
          };
          
          console.log('✅ Seller notification email sent successfully:', {
            messageId: sellerResult.messageId,
            sellerEmail: seller.email
          });
          
        } catch (sellerError) {
          console.error('❌ Failed to send seller notification email:', sellerError);
          results.sellerEmail = {
            success: false,
            error: sellerError.message
          };
        }
      } else {
        console.error('❌ Cannot send seller email: Seller or seller email is missing');
        results.sellerEmail = {
          success: false,
          error: 'Seller email is missing'
        };
      }

      // Return overall success status
      const overallSuccess = results.buyerEmail.success || results.sellerEmail.success;
      
      console.log('📊 Delivery confirmation emails summary:', {
        buyerEmailSent: results.buyerEmail.success,
        sellerEmailSent: results.sellerEmail.success,
        overallSuccess
      });

      return {
        success: overallSuccess,
        results,
        message: `Emails sent - Buyer: ${results.buyerEmail.success ? 'Success' : 'Failed'}, Seller: ${results.sellerEmail.success ? 'Success' : 'Failed'}`
      };

    } catch (error) {
      console.error('❌ Failed to send delivery confirmation emails:', error);
      return {
        success: false,
        error: error.message,
        results: {
          buyerEmail: { success: false, error: error.message },
          sellerEmail: { success: false, error: error.message }
        }
      };
    }
  }

  /**
   * Send email notification when order is delivered (legacy method - now calls new method)
   * @param {Object} orderData - Order information
   * @param {Object} buyer - Buyer information
   * @param {Object} seller - Seller information
   * @param {Object} product - Product information
   * @param {Object} deliveryDetails - Delivery details
   */
  static async sendOrderDeliveredEmail(orderData, buyer, seller, product, deliveryDetails = {}) {
    try {
      console.log('📧 Legacy sendOrderDeliveredEmail called - redirecting to new method');
      return await this.sendDeliveryConfirmationEmails(orderData, buyer, seller, product, deliveryDetails);
    } catch (error) {
      console.error('❌ Failed to send order delivered email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = OrderEmailService;