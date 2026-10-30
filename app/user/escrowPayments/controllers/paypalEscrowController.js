// controllers/paypalEscrowController.js - FIXED VERSION

// controllers/paypalEscrowController.js
const EscrowPayment = require('../../../../db/models/EscrowPayment');
const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const Order = require('../../../../db/models/orderModel');
const NotificationService = require('../../../../services/NotificationService');
const axios = require('axios');
const {
  calculatePlatformCommission,
  recordPlatformFeeUsage,
} = require('../../../../services/platformFee/PlatformFeeService');

async function getPaypalToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const tokenRes = await axios({
    url: process.env.PAYPAL_BASE + '/v1/oauth2/token',
    method: 'post',
    auth: { username: clientId, password: secret },
    params: { grant_type: 'client_credentials' }
  });
  return tokenRes.data.access_token;
}

exports.createPaypalEscrowOrder = async (req, res) => {
  try {
    const { productId, buyerId, buyerEmail, shippingAddress, amount } = req.body;

    const product = await Product.findById(productId).populate('user').exec();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.user?.paypalEmail) {
      return res.status(400).json({ error: 'Seller not registered with PayPal' });
    }

    const feeInfo = await calculatePlatformCommission({
      amount,
      currency: product.currency || 'USD',
      categoryId: product.category || product.categoryId,
      userId: product.user?._id,
    });
    const commission = feeInfo.commissionAmount;
    const netAmount = amount - commission;

    const accessToken = await getPaypalToken();

    // Create PayPal order with CAPTURE intent
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: product.currency || 'USD',
          value: amount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: product.currency || 'USD',
              value: amount.toFixed(2)
            }
          }
        },
        payee: {
          email_address: product.user.paypalEmail
        },
        items: [{
          name: product.title.substring(0, 127), // Prevent long names
          description: (product.description || product.title).substring(0, 127),
          quantity: '1',
          unit_amount: {
            currency_code: product.currency || 'USD',
            value: amount.toFixed(2)
          },
          category: 'PHYSICAL_GOODS'
        }],
        custom_id: `escrow_${productId}_${buyerId}`,
        invoice_id: `escrow_${Date.now()}`
      }],
      application_context: {
        return_url: `${process.env.CLIENT_URL}/order-success?method=paypal_escrow`,
        cancel_url: `${process.env.CLIENT_URL}/paypal/escrow/cancel`,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW'
      }
    };

    const { data } = await axios.post(
      `${process.env.PAYPAL_BASE}/v2/checkout/orders`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    // Create escrow payment record
    const escrowPayment = new EscrowPayment({
      buyer: buyerId,
      seller: product.user._id,
      product: productId,
      totalAmount: amount,
      commission: commission,
      netAmount: netAmount,
      paymentProvider: 'paypal',
      paypalOrderId: data.id,
      productDetails: {
        title: product.title,
        price: amount,
        quantity: 1
      },
      shippingAddress: shippingAddress,
      status: 'pending',
      platformFeeConfig: {
        configId: feeInfo.configId,
        version: feeInfo.configVersion,
        percentage: feeInfo.commissionPercentage,
      }
    });

    await escrowPayment.save();

    const approvalLink = data.links.find(link => link.rel === 'approve').href;

    res.json({
      orderId: data.id,
      approveUrl: approvalLink,
      escrowId: escrowPayment._id,
      metadata: {
        productId,
        buyerId,
        buyerEmail,
        shippingAddress,
        escrowId: escrowPayment._id,
        orderId: data.id
      }
    });

  } catch (err) {
    console.error('PayPal Escrow Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};

exports.capturePaypalEscrowPayment = async (req, res) => {
  try {
    const { orderId, metadata } = req.body;

    const escrowPayment = await EscrowPayment.findOne({
      paypalOrderId: metadata.orderId
    });

    if (escrowPayment && escrowPayment.status === 'held') {
      return res.json({
        success: true,
        alreadyProcessed: true,
        escrowPayment,
        message: 'Payment was already captured via webhook'
      });
    }
    const accessToken = await getPaypalToken();

    // Capture the payment
    const { data: captureData } = await axios.post(
      `${process.env.PAYPAL_BASE}/v2/checkout/orders/${metadata.orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Prefer': 'return=representation',
          'Content-Type': 'application/json'
        }
      }
    );


    // Check if capture was successful
    const captureStatus = captureData.purchase_units[0]?.payments?.captures?.[0]?.status;

    if (captureStatus === 'COMPLETED' || captureStatus === 'PENDING') {
      const { productId, buyerId, buyerEmail, shippingAddress, escrowId } = metadata;

      // Validate required metadata
      if (!productId || !buyerId || !buyerEmail || !escrowId) {
        console.error('Missing required metadata:', { productId, buyerId, buyerEmail, escrowId });
        return res.status(400).json({
          success: false,
          error: 'Missing required payment information',
          message: 'Payment was successful but order could not be created due to missing information.'
        });
      }

      const productDoc = await Product.findById(productId);

      // Get the capture ID from the response
      const captureId = captureData.purchase_units[0]?.payments?.captures?.[0]?.id;
      const resolvedFeeInfo =
        escrowPayment.platformFeeConfig?.configId
          ? {
              commissionAmount: escrowPayment.commission,
              commissionPercentage: escrowPayment.platformFeeConfig.percentage,
              configId: escrowPayment.platformFeeConfig.configId,
            }
          : await calculatePlatformCommission({
              amount: escrowPayment.totalAmount,
              currency: captureData.purchase_units[0]?.amount?.currency_code || 'USD',
              categoryId: productDoc?.category || productDoc?.categoryId,
              userId: escrowPayment.seller,
            });
      
      // Generate unified transaction ID
      const { generateTransactionId } = require('../../../../utils/transactionUtils');
      const transactionId = generateTransactionId('TXN');

      // Update escrow payment
      const updatedEscrow = await EscrowPayment.findByIdAndUpdate(
        escrowId,
        {
          status: 'held',
          paymentHeldAt: new Date(),
          paypalCaptureId: captureId, // Store the capture ID
          paypalOrderStatus: captureData.status,
          captureDetails: captureData // Store full capture details for reference
        },
        { new: true }
      );

      if (!updatedEscrow) {
        console.error('Escrow payment not found:', escrowId);
        return res.status(404).json({
          success: false,
          error: 'Escrow payment not found',
          message: 'The escrow payment for this order could not be found.'
        });
      }
      if (productDoc) {
        if (productDoc.quantity > 0) {
          productDoc.quantity -= 1;

          // Optional: Mark as out of stock if quantity reaches 0
          if (productDoc.quantity === 0) {
            productDoc.status = 'sold out';
          }

          await productDoc.save();
        } else {
          console.warn('Product quantity is already 0, cannot decrease further');
        }
      } else {
        console.error('Product not found for quantity update');
      }
      // Create order record
      try {
        const order = await Order.create({
          product: productId,
          buyer: buyerId,
        seller: updatedEscrow.seller,
          buyerEmail: buyerEmail,
          paymentMethod: 'PayPal Escrow',
          paymentStatus: 'Held in Escrow',
          orderStatus: 'Pending Delivery',
          totalAmount: escrowPayment.totalAmount,
          shipping: {
            toAddress: shippingAddress || {},
          },
          payment: {
            method: 'PayPal Escrow',
            status: 'Held',
            transactionId: transactionId, // Unified transaction ID
          },
          providerPaymentId: orderId,
          currency: captureData.purchase_units[0]?.amount?.currency_code || 'USD',
          escrowPayment: escrowPayment._id,
          commissionBreakdown: {
          platformCommission: resolvedFeeInfo?.commissionAmount || updatedEscrow.commission || 0,
            transactionFee: 0,
            netAmountToSeller: updatedEscrow.netAmount || 0,
            totalAmount: updatedEscrow.totalAmount,
          }
        });

        await recordPlatformFeeUsage({
          configId: resolvedFeeInfo?.configId || updatedEscrow.platformFeeConfig?.configId,
          feeAmount: resolvedFeeInfo?.commissionAmount || updatedEscrow.commission || 0,
          feePercentage: resolvedFeeInfo?.commissionPercentage || updatedEscrow.platformFeeConfig?.percentage || null,
        });

        await NotificationService.notifyOrderPlaced(order);

        return res.json({
          success: true,
          captureData,
          escrowPayment: updatedEscrow,
          order
        });
      } catch (orderError) {
        console.error('❌ Error creating escrow order:', orderError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create order',
          message: orderError.message || 'Order creation failed',
          details: orderError.errors
        });
      }
    }

    res.json({
      success: false,
      message: 'Payment capture not completed',
      captureData
    });

  } catch (err) {
    console.error('❌ PayPal Escrow Capture Error:', err.response?.data || err.message);
    console.error('Error stack:', err.stack);
    
    // Return a properly structured error response
    const errorMessage = err.response?.data?.message || err.message || 'Failed to capture payment';
    const errorDetails = err.response?.data || { message: errorMessage };
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
      details: errorDetails
    });
  }
};

// FIXED: Release function for CAPTURE intent
exports.releasePaypalEscrowPayment = async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user._id || req.user.id;

    // FIXED: Correct field names
    const escrowPayment = await EscrowPayment.findOne({
      _id: escrowId,
      buyer: userId,
      status: 'held', // FIXED: was escrowStatus
      paymentMethod: 'PayPal Escrow' // FIXED: was paymentMethod
    }).populate('seller');


    if (!escrowPayment) {
      return res.status(404).json({
        error: 'Escrow payment not found or not in held status'
      });
    }

    if (!escrowPayment.paypalCaptureId) {
      return res.status(400).json({
        error: 'No capture ID found for this escrow payment'
      });
    }

    // IMPORTANT: With CAPTURE intent, the money is already with PayPal
    // We need to create a PAYOUT to the seller instead of capturing authorization

    const accessToken = await getPaypalToken();

    // Option 1: Create a payout to the seller (Recommended)
    const payoutPayload = {
      sender_batch_header: {
        sender_batch_id: `payout_${escrowId}_${Date.now()}`,
        email_subject: "You have a payment from escrow",
        email_message: "Your escrow payment has been released successfully."
      },
      items: [{
        recipient_type: "EMAIL",
        amount: {
          value: escrowPayment.netAmount.toFixed(2),
          currency: "USD"
        },
        receiver: escrowPayment.seller.paypalEmail, // You need to store this
        note: `Escrow release for order: ${escrowPayment.paypalOrderId}`,
        sender_item_id: `release_${escrowId}`
      }]
    };

    const { data: payoutData } = await axios.post(
      `${process.env.PAYPAL_BASE}/v1/payments/payouts`,
      payoutPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );


    // Update escrow payment
    escrowPayment.status = 'released';
    escrowPayment.buyerApproved = true;
    escrowPayment.releasedAt = new Date();
    escrowPayment.payoutBatchId = payoutData.batch_header.payout_batch_id;
    await escrowPayment.save();

    // Update order status
    await Order.findOneAndUpdate(
      { escrowPayment: escrowId },
      {
        paymentStatus: 'Completed',
        orderStatus: 'Completed',
        completedAt: new Date()
      }
    );

    res.json({
      message: 'Payment released to seller successfully',
      escrowPayment,
      payoutData
    });

  } catch (err) {
    console.error('PayPal Escrow Release Error:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data || err.message
    });
  }
};



// controllers/paypalEscrowController.js
// const EscrowPayment = require('../../../../db/models/EscrowPayment');
// const User = require('../../../../db/models/userModel');
// const Product = require('../../../../db/models/productModel');
// const Order = require('../../../../db/models/orderModel');
// const axios = require('axios');

// async function getPaypalToken() {
//   const clientId = process.env.PAYPAL_CLIENT_ID;
//   const secret = process.env.PAYPAL_CLIENT_SECRET;
//   const tokenRes = await axios({
//     url: process.env.PAYPAL_BASE + '/v1/oauth2/token',
//     method: 'post',
//     auth: { username: clientId, password: secret },
//     params: { grant_type: 'client_credentials' }
//   });
//   return tokenRes.data.access_token;
// }

// // controllers/paypalEscrowController.js - Update createPaypalEscrowOrder
// exports.createPaypalEscrowOrder = async (req, res) => {
//   try {
//     const { productId, buyerId, buyerEmail, shippingAddress, amount } = req.body;

//     const product = await Product.findById(productId).populate('user').exec();
//     if (!product) return res.status(404).json({ error: 'Product not found' });
//     if (!product.user?.paypalEmail) {
//       return res.status(400).json({ error: 'Seller not registered with PayPal' });
//     }

//     const commission = amount * 0.10;
//     const netAmount = amount - commission;

//     const accessToken = await getPaypalToken();

//     // Create PayPal order with CAPTURE intent for immediate capture
//     const payload = {
//       intent: 'CAPTURE', // Changed to CAPTURE for immediate capture
//       purchase_units: [{
//         amount: {
//           currency_code: product.currency || 'USD',
//           value: amount.toFixed(2),
//           breakdown: {
//             item_total: {
//               currency_code: product.currency || 'USD',
//               value: amount.toFixed(2)
//             }
//           }
//         },
//         payee: {
//           email_address: product.user.paypalEmail
//         },
//         items: [{
//           name: product.title,
//           description: product.description || product.title,
//           quantity: '1',
//           unit_amount: {
//             currency_code: product.currency || 'USD',
//             value: amount.toFixed(2)
//           }
//         }],
//         custom_id: `escrow_${productId}_${buyerId}`,
//         invoice_id: `escrow_${Date.now()}`
//       }],
//       application_context: {
//         return_url: `${process.env.CLIENT_URL}/order-success?method=paypal_escrow`,
//         cancel_url: `${process.env.CLIENT_URL}/paypal/escrow/cancel`,
//         shipping_preference: 'NO_SHIPPING',
//         user_action: 'PAY_NOW'
//       }
//     };

//     const { data } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'Prefer': 'return=representation'
//         }
//       }
//     );

//     // Create escrow payment record
//     const escrowPayment = new EscrowPayment({
//       buyer: buyerId,
//       seller: product.user._id,
//       product: productId,
//       totalAmount: amount,
//       commission: commission,
//       netAmount: netAmount,
//       paymentProvider: 'paypal',
//       paypalOrderId: data.id,
//       productDetails: {
//         title: product.title,
//         price: amount,
//         quantity: 1
//       },
//       shippingAddress: shippingAddress,
//       status: 'pending'
//     });

//     await escrowPayment.save();

//     const approvalLink = data.links.find(link => link.rel === 'approve').href;

//     res.json({
//       orderId: data.id,
//       approveUrl: approvalLink,
//       escrowId: escrowPayment._id,
//       metadata: {
//         productId,
//         buyerId,
//         buyerEmail,
//         shippingAddress,
//         escrowId: escrowPayment._id,
//         orderId: data.id // Include orderId in metadata
//       }
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Error:', err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// };

// // controllers/paypalEscrowController.js - Update capturePaypalEscrowPayment
// exports.capturePaypalEscrowPayment = async (req, res) => {
//   try {
//     const { orderId, metadata } = req.body;


//     const accessToken = await getPaypalToken();

//     // Capture the payment directly (since we're using CAPTURE intent)
//     const { data: captureData } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders/${metadata.orderId}/capture`,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Prefer': 'return=representation',
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     console.log('PayPal Capture Response:', captureData);

//     if (captureData.status === 'COMPLETED') {
//       const { productId, buyerId, buyerEmail, shippingAddress, escrowId } = metadata;

//       // Update escrow payment
//       const escrowPayment = await EscrowPayment.findByIdAndUpdate(
//         escrowId,
//         {
//           status: 'held',
//           paymentHeldAt: new Date(),
//           paypalCaptureId: captureData.id,
//           paypalOrderStatus: captureData.status
//         },
//         { new: true }
//       );

//       // Create order record
//       const order = await Order.create({
//         product: productId,
//         buyer: buyerId,
//         seller: escrowPayment.seller,
//         buyerEmail: buyerEmail,
//         paymentMethod: 'PayPal Escrow',
//         paymentStatus: 'Held in Escrow',
//         orderStatus: 'Pending Delivery',
//         totalAmount: escrowPayment.totalAmount,
//         shipping: {
//           toAddress: shippingAddress,
//         },
//         payment: {
//           method: 'PayPal Escrow',
//           status: 'Held'
//         },
//         providerPaymentId: orderId,
//         currency: captureData.purchase_units[0].amount.currency_code,
//         escrowPayment: escrowPayment._id
//       });

//       return res.json({
//         success: true,
//         captureData,
//         escrowPayment,
//         order
//       });
//     }

//     res.json({
//       success: false,
//       message: 'Payment capture not completed',
//       captureData
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Capture Error:', err.response?.data || err.message);
//     res.status(500).json({
//       success: false,
//       error: err.response?.data || err.message
//     });
//   }
// };


// exports.releasePaypalEscrowPayment = async (req, res) => {
//   try {
//     const { escrowId } = req.body;
//     const userId = req.user._id || req.user.id;

//     const escrowPayment = await EscrowPayment.findOne({
//       _id: escrowId,
//       buyer: userId,
//       escrowStatus: 'held',
//       paymentMethod: 'PayPal Escrow'
//     });
//     console.log('Escrow Payment to Release:', escrowPayment);

//     if (!escrowPayment) {
//       return res.status(404).json({ error: 'Escrow payment not found or not authorized' });
//     }

//     const accessToken = await getPaypalToken();

//     // Capture the authorized payment (release to seller)
//     const { data: captureData } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/payments/authorizations/${escrowPayment.paypalCaptureId}/capture`,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'Prefer': 'return=representation'
//         }
//       }
//     );
//     console.log('PayPal Capture Response on Release:', captureData);
//     // Update escrow payment
//     escrowPayment.status = 'released';
//     escrowPayment.buyerApproved = true;
//     escrowPayment.releasedAt = new Date();
//     await escrowPayment.save();

//     // Update order status
//     await Order.findOneAndUpdate(
//       { escrowPayment: escrowId },
//       {
//         paymentStatus: 'Completed',
//         orderStatus: 'Completed'
//       }
//     );

//     res.json({
//       message: 'Payment released to seller successfully',
//       escrowPayment,
//       captureData
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Release Error:', err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// };


// // FIXED: Update createPaypalEscrowOrder to use AUTHORIZE intent
// exports.createPaypalEscrowOrder = async (req, res) => {
//   try {
//     const { productId, buyerId, buyerEmail, shippingAddress, amount } = req.body;

//     const product = await Product.findById(productId).populate('user').exec();
//     if (!product) return res.status(404).json({ error: 'Product not found' });
//     if (!product.user?.paypalEmail) {
//       return res.status(400).json({ error: 'Seller not registered with PayPal' });
//     }

//     const commission = (amount * 0.10).toFixed(2);
//     const netAmount = (amount - commission).toFixed(2);

//     const accessToken = await getPaypalToken();

//     // FIXED: Use AUTHORIZE intent for escrow payments
//     const payload = {
//       intent: 'AUTHORIZE', // Changed to AUTHORIZE for escrow
//       purchase_units: [{
//         amount: {
//           currency_code: product.currency || 'USD',
//           value: amount.toFixed(2),
//           breakdown: {
//             item_total: {
//               currency_code: product.currency || 'USD',
//               value: amount.toFixed(2)
//             }
//           }
//         },
//         payee: {
//           email_address: product.user.paypalEmail
//         },
//         items: [{
//           name: product.title,
//           description: product.description || product.title,
//           quantity: '1',
//           unit_amount: {
//             currency_code: product.currency || 'USD',
//             value: amount.toFixed(2)
//           }
//         }],
//         custom_id: `escrow_${productId}_${buyerId}`,
//         invoice_id: `escrow_${Date.now()}`
//       }],
//       application_context: {
//         return_url: `${process.env.CLIENT_URL}/order-success?method=paypal_escrow`,
//         cancel_url: `${process.env.CLIENT_URL}/paypal/escrow/cancel`,
//         shipping_preference: 'NO_SHIPPING',
//         user_action: 'PAY_NOW'
//       }
//     };

//     const { data } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders`,
//       payload,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'Prefer': 'return=representation'
//         }
//       }
//     );

//     // Create escrow payment record
//     const escrowPayment = new EscrowPayment({
//       buyer: buyerId,
//       seller: product.user._id,
//       product: productId,
//       totalAmount: amount,
//       commission: commission,
//       netAmount: netAmount,
//       paymentProvider: 'paypal',
//       paypalOrderId: data.id,
//       productDetails: {
//         title: product.title,
//         price: amount,
//         quantity: 1
//       },
//       shippingAddress: shippingAddress,
//       status: 'pending'
//     });

//     await escrowPayment.save();

//     const approvalLink = data.links.find(link => link.rel === 'approve').href;

//     res.json({
//       orderId: data.id,
//       approveUrl: approvalLink,
//       escrowId: escrowPayment._id,
//       metadata: {
//         productId,
//         buyerId,
//         buyerEmail,
//         shippingAddress,
//         escrowId: escrowPayment._id,
//         orderId: data.id
//       }
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Error:', err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// };

// // FIXED: Update capturePaypalEscrowPayment to authorize instead of capture
// exports.capturePaypalEscrowPayment = async (req, res) => {
//   try {
//     const { orderId, metadata } = req.body;

//     console.log('Authorizing payment for order:', orderId);

//     const accessToken = await getPaypalToken();

//     // First, check the order status
//     const { data: orderData } = await axios.get(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders/${orderId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     console.log('Order Status:', orderData.status);

//     if (orderData.status !== 'APPROVED') {
//       return res.status(400).json({
//         error: `Order not in APPROVED state. Current status: ${orderData.status}`
//       });
//     }

//     // Then authorize
//     const { data: authData } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders/${orderId}/authorize`,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'Prefer': 'return=representation'
//         }
//       }
//     );

//     console.log('PayPal Authorization Response:', authData);

//     // Rest of your authorization logic...
//     const authorization = authData.purchase_units[0]?.payments?.authorizations?.[0];

//     if (authorization && authorization.status === 'AUTHORIZED') {
//       const { productId, buyerId, buyerEmail, shippingAddress, escrowId } = metadata;

//       const escrowPayment = await EscrowPayment.findByIdAndUpdate(
//         escrowId,
//         {
//           status: 'held',
//           paymentHeldAt: new Date(),
//           paypalAuthorizationId: authorization.id,
//           paypalOrderStatus: authData.status,
//           paypalCaptureId: null
//         },
//         { new: true }
//       );

//       const order = await Order.create({
//         product: productId,
//         buyer: buyerId,
//         seller: escrowPayment.seller,
//         buyerEmail: buyerEmail,
//         paymentMethod: 'PayPal Escrow',
//         paymentStatus: 'Held in Escrow',
//         orderStatus: 'Pending Delivery',
//         totalAmount: escrowPayment.totalAmount,
//         shipping: { toAddress: shippingAddress },
//         payment: { method: 'PayPal Escrow', status: 'Held' },
//         providerPaymentId: orderId,
//         currency: authorization.amount.currency_code,
//         escrowPayment: escrowPayment._id
//       });

//       return res.json({ success: true, authData, escrowPayment, order });
//     }


//     res.json({
//       success: false,
//       message: 'Payment authorization not completed',
//       authData
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Authorization Error:', err.response?.data || err.message);
//     res.status(500).json({
//       success: false,
//       error: err.response?.data || err.message
//     });
//   }
// };

// // FIXED: Correct releasePaypalEscrowPayment function
// exports.releasePaypalEscrowPayment = async (req, res) => {
//   try {
//     const { escrowId } = req.body;
//     const userId = req.user._id || req.user.id;

//     const escrowPayment = await EscrowPayment.findOne({
//       _id: escrowId,
//       buyer: userId,
//       status: 'held',
//       paymentProvider: 'paypal'
//     });

//     console.log('Escrow Payment to Release:', escrowPayment);

//     if (!escrowPayment) {
//       return res.status(404).json({ error: 'Escrow payment not found or not authorized' });
//     }

//     if (!escrowPayment.paypalAuthorizationId) {
//       return res.status(400).json({ error: 'No authorization ID found for this escrow payment' });
//     }

//     const accessToken = await getPaypalToken();

//     // FIXED: Capture the authorized payment using the correct endpoint
//     const { data: captureData } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/payments/authorizations/${escrowPayment.paypalAuthorizationId}/capture`,
//       {},
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//           'Prefer': 'return=representation'
//         }
//       }
//     );

//     console.log('PayPal Capture Response on Release:', captureData);

//     // Update escrow payment
//     escrowPayment.status = 'released';
//     escrowPayment.buyerApproved = true;
//     escrowPayment.releasedAt = new Date();
//     escrowPayment.paypalCaptureId = captureData.id; // Store the capture ID
//     await escrowPayment.save();

//     // Update order status
//     await Order.findOneAndUpdate(
//       { escrowPayment: escrowId },
//       {
//         paymentStatus: 'Completed',
//         orderStatus: 'Completed'
//       }
//     );

//     res.json({
//       message: 'Payment released to seller successfully',
//       escrowPayment,
//       captureData
//     });

//   } catch (err) {
//     console.error('PayPal Escrow Release Error:', err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// };