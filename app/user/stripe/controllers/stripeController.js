const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const Order = require('../../../../db/models/orderModel');
const NotificationService = require('../../../../services/NotificationService');
const axios = require('axios');
const { errorResponse } = require('../../../../utils/responseHandler');
const { getOrderDetails } = require('../../shipping/controllers/orderController');

exports.createStripeOnboard = async (req, res) => {
  console.log("Create Stripe Onboard called", req.body);
  const { name, email, userId } = req.body.userData;
  console.log("Creating Stripe Onboard for user:", userId, email);
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // change as needed
      email,
      business_type: 'individual'
    });
    // save seller in DB
    const user = await User.findById(userId);
    console.log("User fetched for Stripe Onboard:", user);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    user.stripeAccountId = account.id;
    await user.save();

    // create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/stripe/onboard/refresh`,
      return_url: `${process.env.CLIENT_URL}/stripe/onboard/return`,
      type: 'account_onboarding'
    });
    console.log("Account Link URL:");
    res.json({ user, accountLinkUrl: accountLink.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}



exports.webhooks = async (req, res) => {
  // console.log("Stripe webhook received");
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature failed: ', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Checkout session completed id:', session.metadata.userId);
    // create record in DB
    try {
      const productId = session.metadata?.productId;
      const sellerId = session.metadata?.sellerId;

      //we require 
      // paymentMethod
      // paymentStatus
      // orderStatus
      // buyer
      // seller
      // product
      // totalAmount
      // orderDetails
      // shipping:{
      //   toAddress:{
      //     fullname:"",
      //     street1:"",
      //     street2:"",
      //     city:"",
      //     state:"",
      //     zipCode:"",
      //     country:"",
      //     phoneNumber:"",

      //   }
      //   method:"delivery",
      //   packageDetails:{
      //     dimensions:{
      //       unit:"cm",
      //     }
      //   },
      //   status:"pending_payment"
      // }
      // orderNumber:""

      const product = await Product.findById(productId);
      if (product) {
        if (product.quantity > 0) {
          product.quantity -= 1;

          // Optional: Mark as out of stock if quantity reaches 0
          if (product.quantity === 0) {
            product.status = 'sold out';
          }

          await product.save();
          console.log(`Product quantity decreased. New quantity: ${product.quantity}`);
        } else {
          console.warn('Product quantity is already 0, cannot decrease further');
        }
      } else {
        console.error('Product not found for quantity update');
      }
      // Generate unified transaction ID
      const { generateTransactionId } = require('../../../../utils/transactionUtils');
      const transactionId = generateTransactionId('TXN');

      const order = await Order.create({
        product: productId,
        buyerEmail: session.customer_email,
        paymentMethod: 'Stripe',
        paymentStatus: 'Paid',
        orderStatus: "Pending",
        buyer: session.metadata?.buyerId,
        seller: sellerId,
        product: productId,
        totalAmount: session.amount_total / 100, // convert cents to dollars
        shipping: {
          toAddress: JSON.parse(session.metadata.shippingAddress),
        },
        payment: {
          method: 'Stripe',
          status: 'Paid',
          transactionId: transactionId // Unified transaction ID
        },
        currency: session.currency,
        providerPaymentId: session.payment_intent,
        amount: session.amount_total,
        currency: session.currency,
        orderStatus: "Pending",
      });
      console.log('Order created', order._id);
      await NotificationService.notifyOrderPlaced(order);
    } catch (e) { console.error(e); }
  }
  res.json({ received: true });
}



exports.createCheckoutSession = async (req, res) => {
  console.log("Create checkout session called");
  const { productId, buyerEmail, prodQuantity, price, shippingAddress, userId } = req.body;
  console.log("Request body:", req.body);
  console.log("Product ID:", productId);
  console.log("buyerEmail :", buyerEmail);
  console.log("prodQuantity ID:", prodQuantity);
  console.log("user ID:", userId);
  try {
    const product = await Product.findById(productId).populate('user').exec();
    console.log("Product fetched:", product);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.user || !product.user.stripeAccountId) {
      return res.status(400).json({ error: 'Seller not onboarded to Stripe' });
    }

    // amount in cents
    const amount = Math.round(price * 100);
    if (!product.user.stripeAccountId) {
      return res.status(400).json({ error: 'Seller not onboarded to Stripe' });
    }
    console.log("Creating session for amount:", amount);

    // Create Checkout Session with transfer_data
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: product.currency || 'usd',
          product_data: { name: product.title },
          unit_amount: amount
        },
        quantity: prodQuantity || 1
      }],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      customer_email: buyerEmail,
      payment_intent_data: {
        // transfer the funds to the seller's connected account
        transfer_data: {
          destination: product.user.stripeAccountId,
        },
        // optional: application_fee_amount: 500 // cents, your platform fee
      },

      // buyerId:userId, 


      metadata: { productId: product._id.toString(), buyerId: userId?.toString(), sellerId: product.user._id.toString(), prodQuantity: prodQuantity || 1, price: price, shippingAddress: JSON.stringify(shippingAddress) }
    });


    res.json({ sessionId: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


exports.registerPaypalEmail = async (req, res) => {
  console.log("Register PayPal Email called", req.body);
  try {
    const { userId, paypalEmail } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.paypalEmail = paypalEmail;
    await user.save();

    res.json({ success: true, message: 'PayPal email registered successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


async function getPaypalToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const tokenRes = await axios({
    url: (process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com') + '/v1/oauth2/token',
    method: 'post',
    auth: { username: clientId, password: secret },
    params: { grant_type: 'client_credentials' }
  });
  return tokenRes.data.access_token;
}


exports.createPaypalOrder = async (req, res) => {
  try {
    const { productId, buyerId, buyerEmail, shippingAddress, amount } = req.body;
    const product = await Product.findById(productId).populate('user').exec();

    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.user?.paypalEmail) return res.status(400).json({ error: 'Seller not registered with PayPal' });

    const accessToken = await getPaypalToken();

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: product.currency || 'USD',
          value: amount.toFixed(2)
        },
        payee: { email_address: product.user.paypalEmail },
        description: product.title
      }],
      application_context: {
        return_url: `${process.env.CLIENT_URL}/paypal/success`,
        cancel_url: `${process.env.CLIENT_URL}/paypal/cancel`
      }
    };

    const { data } = await axios.post(`${process.env.PAYPAL_BASE}/v2/checkout/orders`, payload, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const approvalLink = data.links.find(link => link.rel === 'approve').href;

    res.json({
      orderId: data.id,
      approveUrl: approvalLink,
      metadata: { productId, buyerId, buyerEmail, shippingAddress }
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};


// exports.capturePaypalOrder = async (req, res) => {
//   try {
//     const { orderId, metadata } = req.body; // frontend sends metadata from previous step

//     const accessToken = await getPaypalToken();
//     const { data: captureData } = await axios.post(
//       `${process.env.PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
//       {},
//       { headers: { Authorization: `Bearer ${accessToken}` } }
//     );

//     const { productId, buyerId, buyerEmail, shippingAddress } = metadata;

//     const order = await Order.create({
//       product: productId,
//       buyer: buyerId,
//       buyerEmail: buyerEmail,
//       paymentMethod: 'PayPal',
//       paymentStatus: 'Paid',
//       orderStatus: 'Pending',
//       totalAmount: captureData.purchase_units[0].payments.captures[0].amount.value,
//       shipping: {
//         toAddress: shippingAddress,
//       },
//       payment: {
//         method: 'PayPal',
//         status: 'Paid',
//       },
//       providerPaymentId: orderId,
//       currency: captureData.purchase_units[0].payments.captures[0].amount.currency_code,
//     });


//     res.json({ success: true, captureData, order });
//   } catch (err) {
//     console.error(err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// };

exports.capturePaypalOrder = async (req, res) => {
  try {
    const { orderId, metadata } = req.body;

    const accessToken = await getPaypalToken();

    // Attempt to capture the payment
    const { data: captureData } = await axios.post(
      `${process.env.PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Prefer': 'return=representation'
        }
      }
    );

    // Only create order if payment was successful
    if (captureData.status === 'COMPLETED') {
      const { productId, buyerId, buyerEmail, shippingAddress } = metadata;
      
      // Validate required metadata
      if (!productId || !buyerId || !buyerEmail) {
        console.error('Missing required metadata:', { productId, buyerId, buyerEmail });
        return res.status(400).json({
          success: false,
          error: 'Missing required payment information',
          message: 'Payment was successful but order could not be created due to missing information.'
        });
      }

      const product = await Product.findById(productId).populate('user');
      if (!product) {
        console.error('Product not found:', productId);
        return res.status(404).json({
          success: false,
          error: 'Product not found',
          message: 'The product for this order could not be found.'
        });
      }

      // Get capture ID from PayPal response
      const captureId = captureData.purchase_units[0]?.payments?.captures?.[0]?.id || orderId;
      const amount = captureData.purchase_units[0]?.payments?.captures?.[0]?.amount?.value;
      const currency = captureData.purchase_units[0]?.payments?.captures?.[0]?.amount?.currency_code || 'USD';
      
      // Generate unified transaction ID
      const { generateTransactionId } = require('../../../../utils/transactionUtils');
      const transactionId = generateTransactionId('TXN');

      // Update product quantity
      if (product.quantity > 0) {
        product.quantity -= 1;

        // Optional: Mark as out of stock if quantity reaches 0
        if (product.quantity === 0) {
          product.status = 'sold out';
        }

        await product.save();
      } else {
        console.warn('⚠️ Product quantity is already 0, cannot decrease further');
      }

      // Create order
      try {
        const order = await Order.create({
          product: productId,
          buyer: buyerId,
          buyerEmail: buyerEmail,
          seller: product.user._id,
          paymentMethod: 'PayPal',
          paymentStatus: 'Paid',
          orderStatus: 'Pending',
          totalAmount: parseFloat(amount),
          shipping: {
            toAddress: shippingAddress || {},
          },
          payment: {
            method: 'PayPal',
            status: 'Paid',
            transactionId: transactionId, // Unified transaction ID
          },
          providerPaymentId: orderId,
          currency: currency,
        });

        await NotificationService.notifyOrderPlaced(order);

        return res.json({
          success: true,
          captureData,
          order
        });
      } catch (orderError) {
        console.error('❌ Error creating order:', orderError);
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
      message: 'Payment not completed',
      captureData
    });

  } catch (err) {
    console.error('PayPal Capture Error:', err.response?.data || err.message);

    // Handle specific PayPal errors
    if (err.response?.data?.name === 'UNPROCESSABLE_ENTITY') {
      const errorDetails = err.response.data.details[0];

      if (errorDetails.issue === 'PAYER_ACCOUNT_LOCKED_OR_CLOSED') {
        return res.status(400).json({
          success: false,
          error: 'PAYER_ACCOUNT_LOCKED_OR_CLOSED',
          message: 'The PayPal account cannot be used for this transaction. Please use a different payment method.',
          userMessage: 'Your PayPal account cannot process this payment. Please try a different PayPal account or payment method.',
          debug_id: err.response.data.debug_id
        });
      }

      // Handle other PayPal issues
      return res.status(400).json({
        success: false,
        error: errorDetails.issue,
        message: err.response.data.message,
        userMessage: getFriendlyErrorMessage(errorDetails.issue),
        debug_id: err.response.data.debug_id
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.response?.data || err.message,
      userMessage: 'An unexpected error occurred. Please try again.'
    });
  }
};

// Helper function for user-friendly error messages
function getFriendlyErrorMessage(issue) {
  const errorMessages = {
    'PAYER_ACCOUNT_LOCKED_OR_CLOSED': 'Your PayPal account cannot process this payment. Please try a different PayPal account or payment method.',
    'INSTRUMENT_DECLINED': 'Your payment was declined. Please try a different payment method.',
    'PAYER_CANNOT_PAY': 'This payment cannot be processed with your account.',
    'TRANSACTION_REFUSED': 'The transaction was refused. Please try again or use a different payment method.',
    'DUPLICATE_TRANSACTION': 'A similar transaction was recently processed.',
    'INTERNAL_SERVER_ERROR': 'Temporary issue with payment processor. Please try again.',
  };

  return errorMessages[issue] || 'Payment failed. Please try again or use a different payment method.';
}

exports.disconnectStripe = async (req, res) => {
  try {
    const data = req.body;
    console.log("Disconnect Stripe called for user:", req.body);
    const user = await User.findById(data.userId);

    if (!user || !user.stripeAccountId) {
      return res.status(400).json({ message: 'No Stripe account linked.' });
    }

    // Remove local reference
    user.stripeAccountId = null;
    await user.save();

    res.json({ success: true, message: 'Stripe account disconnected successfully.', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to disconnect Stripe account.' });
  }
};

exports.disconnectPaypal = async (req, res) => {
  try {
    const data = req.body;
    const user = await User.findById(data.userId);

    if (!user || !user.paypalEmail) {
      return res.status(400).json({ message: 'No Stripe account linked.' });
    }

    // Remove local reference
    user.paypalEmail = null;
    await user.save();

    res.json({ success: true, message: 'Stripe account disconnected successfully.', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to disconnect Stripe account.' });
  }
};

