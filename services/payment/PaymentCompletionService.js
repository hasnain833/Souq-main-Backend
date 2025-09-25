const { creditWalletExternal: creditWalletInternal } = require('../../utils/walletUtils');
const StandardPayment = require('../../db/models/standardPaymentModel');
const EscrowTransaction = require('../../db/models/escrowTransactionModel');
const Product = require('../../db/models/productModel');
const { findEscrowTransaction, findStandardPayment } = require('../../utils/transactionUtils');
const NotificationService = require('../NotificationService');
const OrderCreationService = require('../order/OrderCreationService');

/**
 * Payment Completion Service
 * Handles wallet crediting and other post-payment actions
 */
class PaymentCompletionService {
  
  /**
   * Process standard payment completion
   */
  static async processStandardPaymentCompletion(paymentId) {
    try {
      console.log('🔄 Processing standard payment completion:', paymentId);
      
      const payment = await StandardPayment.findById(paymentId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
      
      if (!payment) {
        throw new Error('Standard payment not found');
      }
      
      // Check if already completed
      if (payment.status === 'completed') {
        console.log('⚠️ Payment already completed:', paymentId);
        return { success: true, alreadyCompleted: true };
      }
      
      // Update payment status
      payment.status = 'completed';
      payment.completedAt = new Date();
      await payment.save();
      
      // Credit seller's wallet
      const sellerAmount = payment.productPrice - (payment.platformFeeAmount || 0);
      
      if (sellerAmount > 0) {
        const walletResult = await creditWalletInternal(
          payment.seller._id,
          sellerAmount,
          payment.currency,
          `Payment for product: ${payment.product?.title || 'Product'}`,
          {
            relatedTransaction: payment._id,
            relatedProduct: payment.product,
            metadata: {
              transactionId: payment.transactionId,
              originalAmount: payment.productPrice,
              platformFee: payment.platformFeeAmount,
              netAmount: sellerAmount,
              paymentType: 'standard',
              buyerName: `${payment.buyer?.firstName} ${payment.buyer?.lastName}`,
              buyerEmail: payment.buyer?.email,
              completedAt: new Date().toISOString()
            }
          }
        );
        
        if (walletResult.success) {
          console.log(`✅ Standard payment completed and wallet credited: ${payment.currency} ${sellerAmount}`);

          // Mark product as sold
          try {
            const productDoc = await Product.findById(payment.product?._id || payment.product);
            if (productDoc && productDoc.status !== 'sold') {
              await productDoc.updateStatus('sold', payment.seller._id, 'Marked as sold after standard payment completion');
              console.log('🛍️ Product marked as sold:', productDoc._id.toString());
            }
          } catch (prodErr) {
            console.warn('⚠️ Failed to mark product as sold (standard):', prodErr?.message);
          }

          // Create order from completed payment
          try {
            console.log('📦 Creating order for completed standard payment...');
            const orderResult = await OrderCreationService.createOrderFromStandardPayment(payment);

            if (orderResult.success) {
              if (orderResult.alreadyExists) {
                console.log('ℹ️ Order already exists for this payment');
              } else {
                console.log('✅ Order created successfully:', orderResult.order.orderNumber);
              }
            } else {
              console.error('❌ Failed to create order:', orderResult.error);
              // Don't fail the payment completion if order creation fails
            }
          } catch (orderError) {
            console.error('❌ Error creating order for standard payment:', orderError);
            // Don't fail the payment completion if order creation fails
          }

          // Send payment received notification to seller
          try {
            await NotificationService.notifyPaymentReceived(
              payment,
              payment.buyer,
              payment.seller,
              payment.product
            );
          } catch (notificationError) {
            console.error('Error sending payment received notification:', notificationError);
            // Don't fail the payment completion if notification fails
          }
          return {
            success: true,
            payment,
            walletCredited: true,
            sellerAmount,
            currency: payment.currency
          };
        } else {
          console.error('❌ Failed to credit wallet for standard payment:', walletResult.error);
          return {
            success: false,
            error: 'Failed to credit seller wallet',
            payment
          };
        }
      }
      
      return {
        success: true,
        payment,
        walletCredited: false,
        message: 'Payment completed but no wallet credit needed'
      };
      
    } catch (error) {
      console.error('❌ Error processing standard payment completion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process escrow payment completion (when delivery is confirmed)
   */
  static async processEscrowPaymentCompletion(escrowId) {
    try {
      console.log('🔄 Processing escrow payment completion:', escrowId);
      
      const escrow = await EscrowTransaction.findById(escrowId)
        .populate('buyer', 'firstName lastName email')
        .populate('seller', 'firstName lastName email')
        .populate('product', 'title price product_photos');
      
      if (!escrow) {
        throw new Error('Escrow transaction not found');
      }
      
      // Check if already completed
      if (escrow.status === 'completed') {
        console.log('⚠️ Escrow already completed:', escrowId);
        return { success: true, alreadyCompleted: true };
      }
      
      // Credit seller's wallet
      const sellerAmount = escrow.productPrice - (escrow.platformFeeAmount || 0);
      
      if (sellerAmount > 0) {
        const walletResult = await creditWalletInternal(
          escrow.seller._id,
          sellerAmount,
          escrow.currency,
          `Escrow payment for product: ${escrow.product?.title || 'Product'}`,
          {
            relatedEscrowTransaction: escrow._id,
            relatedProduct: escrow.product,
            metadata: {
              transactionId: escrow.transactionId,
              originalAmount: escrow.productPrice,
              platformFee: escrow.platformFeeAmount,
              netAmount: sellerAmount,
              paymentType: 'escrow',
              buyerName: `${escrow.buyer?.firstName} ${escrow.buyer?.lastName}`,
              buyerEmail: escrow.buyer?.email,
              completedAt: new Date().toISOString()
            }
          }
        );
        
        if (walletResult.success) {
          console.log(`✅ Escrow payment completed and wallet credited: ${escrow.currency} ${sellerAmount}`);

          // Mark product as sold
          try {
            const productDoc = await Product.findById(escrow.product?._id || escrow.product);
            if (productDoc && productDoc.status !== 'sold') {
              await productDoc.updateStatus('sold', escrow.seller._id, 'Marked as sold after escrow completion');
              console.log('🛍️ Product marked as sold (escrow):', productDoc._id.toString());
            }
          } catch (prodErr) {
            console.warn('⚠️ Failed to mark product as sold (escrow):', prodErr?.message);
          }

          // Create or update order from completed escrow payment
          try {
            console.log('📦 Creating/updating order for completed escrow payment...');
            const orderResult = await OrderCreationService.createOrderFromEscrowPayment(escrow);

            if (orderResult.success) {
              if (orderResult.alreadyExists) {
                console.log('ℹ️ Order already exists for this escrow payment');
                // Update order status to delivered since escrow is completed
                await OrderCreationService.updateOrderFromPayment(
                  escrow.transactionId,
                  'delivered',
                  'escrow'
                );
              } else {
                console.log('✅ Order created successfully:', orderResult.order.orderNumber);
              }
            } else {
              console.error('❌ Failed to create order:', orderResult.error);
              // Don't fail the payment completion if order creation fails
            }
          } catch (orderError) {
            console.error('❌ Error creating order for escrow payment:', orderError);
            // Don't fail the payment completion if order creation fails
          }

          // Send payment received notification to seller
          try {
            await NotificationService.notifyPaymentReceived(
              escrow,
              escrow.buyer,
              escrow.seller,
              escrow.product
            );
          } catch (notificationError) {
            console.error('Error sending escrow payment received notification:', notificationError);
            // Don't fail the payment completion if notification fails
          }

          return {
            success: true,
            escrow,
            walletCredited: true,
            sellerAmount,
            currency: escrow.currency
          };
        } else {
          console.error('❌ Failed to credit wallet for escrow payment:', walletResult.error);
          return {
            success: false,
            error: 'Failed to credit seller wallet',
            escrow
          };
        }
      }
      
      return {
        success: true,
        escrow,
        walletCredited: false,
        message: 'Escrow completed but no wallet credit needed'
      };
      
    } catch (error) {
      console.error('❌ Error processing escrow payment completion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process payment completion by transaction ID and type
   */
  static async processPaymentCompletionByTransaction(transactionId, transactionType = 'standard') {
    try {
      console.log(`🔄 Processing ${transactionType} payment completion by transaction ID:`, transactionId);
      console.log('🔍 Checking transaction utils availability:', {
        findStandardPayment: !!findStandardPayment,
        findEscrowTransaction: !!findEscrowTransaction
      });

      let payment = null;
      let escrow = null;

      if (transactionType === 'standard') {
        console.log('💳 Looking for standard payment...');
        payment = await findStandardPayment(transactionId, true);
        console.log('💳 Standard payment found:', !!payment);

        if (payment) {
          console.log('💳 Processing standard payment completion for ID:', payment._id);
          return await this.processStandardPaymentCompletion(payment._id);
        } else {
          console.log('❌ Standard payment not found, trying escrow as fallback...');
          // Try escrow as fallback
          escrow = await findEscrowTransaction(transactionId, true);
          if (escrow) {
            console.log('✅ Found as escrow transaction instead, processing escrow completion');
            return await this.processEscrowPaymentCompletion(escrow._id);
          }
        }
      } else if (transactionType === 'escrow') {
        console.log('🛡️ Looking for escrow transaction...');
        escrow = await findEscrowTransaction(transactionId, true);
        console.log('🛡️ Escrow transaction found:', !!escrow);

        if (escrow) {
          console.log('🛡️ Processing escrow payment completion for ID:', escrow._id);
          return await this.processEscrowPaymentCompletion(escrow._id);
        } else {
          console.log('❌ Escrow transaction not found, trying standard as fallback...');
          // Try standard as fallback
          payment = await findStandardPayment(transactionId, true);
          if (payment) {
            console.log('✅ Found as standard payment instead, processing standard completion');
            return await this.processStandardPaymentCompletion(payment._id);
          }
        }
      }

      // If we get here, neither type was found
      // const errorMsg = `Transaction not found in either standard or escrow: ${transactionId}`;
      // console.error('❌', errorMsg);
      // return {
      //   success: false,
      //   error: errorMsg
      // };

    } catch (error) {
      console.error('❌ Error processing payment completion by transaction:', error);
      console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PaymentCompletionService;
