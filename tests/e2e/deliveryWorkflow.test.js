const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import all required models and services
const User = require('../../db/models/userModel');
const Product = require('../../db/models/productModel');
const Order = require('../../db/models/orderModel');
const Shipment = require('../../db/models/shipmentModel');
const ShippingProvider = require('../../db/models/shippingProviderModel');
const DeliveryOption = require('../../db/models/deliveryOptionModel');
const shippingFactory = require('../../services/shipping/ShippingServiceFactory');

// Import controllers
const shippingController = require('../../app/user/shipping/controllers/shippingController');
const orderController = require('../../app/user/shipping/controllers/orderController');

describe('End-to-End Delivery Workflow Tests', () => {
  let app;
  let buyer, seller, product, shippingProvider;
  let buyerToken, sellerToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/souq_test');
    
    // Setup Express app with all routes
    app = express();
    app.use(express.json());
    
    // Auth middleware
    app.use('/api/user', (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test_secret');
          req.user = { id: decoded.userId };
        } catch (error) {
          return res.status(401).json({ success: false, error: 'Invalid token' });
        }
      }
      next();
    });

    // Setup all shipping routes
    app.get('/api/user/shipping/providers', shippingController.getProviders);
    app.post('/api/user/shipping/rates', shippingController.getShippingRates);
    app.post('/api/user/shipping/shipments', shippingController.createShipment);
    app.get('/api/user/shipping/track/:trackingNumber', shippingController.trackShipment);
    app.get('/api/user/shipping/delivery-options', shippingController.getDeliveryOptions);
    app.post('/api/user/shipping/delivery-options', shippingController.saveDeliveryOption);
    app.put('/api/user/shipping/delivery-options/:deliveryOptionId/default', shippingController.setDefaultDeliveryOption);
    
    // Setup order routes
    app.get('/api/user/orders', orderController.getUserOrders.bind(orderController));
    app.post('/api/user/orders', orderController.createOrder.bind(orderController));
    app.get('/api/user/orders/:orderId', orderController.getOrderDetails.bind(orderController));
    app.put('/api/user/orders/:orderId/status', orderController.updateOrderStatus.bind(orderController));
    app.post('/api/user/orders/:orderId/confirm-delivery', orderController.confirmDelivery.bind(orderController));

    // Initialize shipping factory
    await shippingFactory.initialize();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
    await ShippingProvider.deleteMany({});
    await DeliveryOption.deleteMany({});

    // Create test users
    buyer = await User.create({
      username: 'testbuyer',
      email: 'buyer@test.com',
      password: 'hashedpassword',
      profile_picture: 'buyer.jpg'
    });

    seller = await User.create({
      username: 'testseller',
      email: 'seller@test.com',
      password: 'hashedpassword',
      profile_picture: 'seller.jpg'
    });

    // Create test product
    product = await Product.create({
      title: 'Premium Sneakers',
      price: 200,
      brand: 'Nike',
      size: '42',
      condition: 'New',
      material: 'Leather',
      colors: ['White', 'Black'],
      product_photos: ['sneaker1.jpg', 'sneaker2.jpg'],
      user: seller._id,
      shipping_cost: 0
    });

    // Create shipping provider
    shippingProvider = await ShippingProvider.create({
      name: 'local_pickup',
      displayName: 'Local Pickup',
      isActive: true,
      supportedServices: [{
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        estimatedDays: { min: 0, max: 1 },
        isActive: true
      }],
      pricing: {
        baseFee: 0,
        currency: 'AED'
      }
    });

    // Generate auth tokens
    buyerToken = jwt.sign({ userId: buyer._id }, process.env.JWT_SECRET || 'test_secret');
    sellerToken = jwt.sign({ userId: seller._id }, process.env.JWT_SECRET || 'test_secret');

    // Reload shipping factory
    await shippingFactory.reloadProviders();
  });

  describe('Complete Delivery Workflow', () => {
    test('should complete full order lifecycle from creation to delivery confirmation', async () => {
      // Step 1: Buyer configures delivery preferences
      console.log('Step 1: Configuring delivery preferences...');
      
      const deliveryOptionResponse = await request(app)
        .post('/api/user/shipping/delivery-options')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          shippingProvider: shippingProvider._id,
          serviceCode: 'LOCAL_PICKUP',
          serviceName: 'Local Pickup',
          isDefault: true,
          preferences: {
            includeInsurance: false,
            requireSignature: false,
            allowCashOnDelivery: true
          }
        })
        .expect(200);

      expect(deliveryOptionResponse.body.success).toBe(true);
      expect(deliveryOptionResponse.body.data.deliveryOption.isDefault).toBe(true);

      // Step 2: Get shipping rates
      console.log('Step 2: Getting shipping rates...');
      
      const ratesResponse = await request(app)
        .post('/api/user/shipping/rates')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          origin: {
            fullName: seller.username,
            addressLine1: 'Dubai Mall',
            city: 'Dubai',
            country: 'United Arab Emirates'
          },
          destination: {
            fullName: buyer.username,
            addressLine1: 'Abu Dhabi Mall',
            city: 'Abu Dhabi',
            country: 'United Arab Emirates'
          },
          packageDetails: {
            weight: 1,
            dimensions: { length: 30, width: 20, height: 10 },
            value: product.price,
            currency: 'USD',
            description: product.title
          }
        })
        .expect(200);

      expect(ratesResponse.body.success).toBe(true);
      expect(ratesResponse.body.data.rates).toBeInstanceOf(Array);
      expect(ratesResponse.body.data.rates.length).toBeGreaterThan(0);

      const selectedRate = ratesResponse.body.data.rates[0];

      // Step 3: Create order
      console.log('Step 3: Creating order...');
      
      const orderResponse = await request(app)
        .post('/api/user/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: product._id,
          sellerId: seller._id,
          paymentMethod: 'escrow',
          shippingAddress: {
            fullName: buyer.username,
            addressLine1: 'Abu Dhabi Mall',
            city: 'Abu Dhabi',
            state: 'Abu Dhabi',
            zipCode: '00000',
            country: 'United Arab Emirates',
            phoneNumber: '+971501234567'
          },
          selectedShippingRate: selectedRate
        })
        .expect(200);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.order.status).toBe('pending_payment');
      
      const orderId = orderResponse.body.data.order._id;

      // Step 4: Simulate payment completion
      console.log('Step 4: Processing payment...');
      
      await request(app)
        .put(`/api/user/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          status: 'paid',
          notes: 'Payment completed via escrow'
        })
        .expect(200);

      // Step 5: Seller processes order
      console.log('Step 5: Seller processing order...');
      
      await request(app)
        .put(`/api/user/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status: 'processing',
          notes: 'Order is being prepared'
        })
        .expect(200);

      // Step 6: Create shipment
      console.log('Step 6: Creating shipment...');
      
      const shipmentResponse = await request(app)
        .post('/api/user/shipping/shipments')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          orderId: orderId,
          providerName: 'local_pickup',
          serviceCode: 'LOCAL_PICKUP',
          shipmentData: {
            serviceName: 'Local Pickup',
            description: 'Premium Sneakers for pickup',
            origin: {
              fullName: seller.username,
              addressLine1: 'Dubai Mall',
              city: 'Dubai',
              country: 'United Arab Emirates'
            },
            destination: {
              fullName: buyer.username,
              addressLine1: 'Abu Dhabi Mall',
              city: 'Abu Dhabi',
              country: 'United Arab Emirates'
            },
            packages: [{
              weight: 1,
              dimensions: { length: 30, width: 20, height: 10 },
              value: product.price,
              contents: product.title
            }]
          }
        })
        .expect(200);

      expect(shipmentResponse.body.success).toBe(true);
      expect(shipmentResponse.body.data.shipment.trackingNumber).toMatch(/^LOCAL_\d+_/);
      
      const trackingNumber = shipmentResponse.body.data.shipment.trackingNumber;

      // Step 7: Track shipment
      console.log('Step 7: Tracking shipment...');
      
      const trackingResponse = await request(app)
        .get(`/api/user/shipping/track/${trackingNumber}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(trackingResponse.body.success).toBe(true);
      expect(trackingResponse.body.data.tracking.trackingNumber).toBe(trackingNumber);
      expect(trackingResponse.body.data.tracking.events).toBeInstanceOf(Array);

      // Step 8: Get order details
      console.log('Step 8: Checking order details...');
      
      const orderDetailsResponse = await request(app)
        .get(`/api/user/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(orderDetailsResponse.body.success).toBe(true);
      expect(orderDetailsResponse.body.data.order.status).toBe('shipped');
      expect(orderDetailsResponse.body.data.order.shipping.trackingNumber).toBe(trackingNumber);

      // Step 9: Confirm delivery
      console.log('Step 9: Confirming delivery...');
      
      const confirmResponse = await request(app)
        .post(`/api/user/orders/${orderId}/confirm-delivery`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 5,
          feedback: 'Excellent pickup experience!'
        })
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      expect(confirmResponse.body.data.order.status).toBe('delivered');
      expect(confirmResponse.body.data.order.delivery.confirmedBy).toBe('buyer');

      // Step 10: Verify final order state
      console.log('Step 10: Verifying final state...');
      
      const finalOrderResponse = await request(app)
        .get(`/api/user/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const finalOrder = finalOrderResponse.body.data.order;
      expect(finalOrder.status).toBe('delivered');
      expect(finalOrder.timeline).toHaveLength(5); // All status transitions
      expect(finalOrder.delivery.rating.deliveryRating).toBe(5);
      expect(finalOrder.delivery.rating.feedback).toBe('Excellent pickup experience!');

      console.log('✅ Complete delivery workflow test passed!');
    });

    test('should handle multiple shipping options and rate comparison', async () => {
      // Create additional shipping providers
      const aramexProvider = await ShippingProvider.create({
        name: 'aramex',
        displayName: 'Aramex',
        isActive: true,
        supportedServices: [{
          serviceCode: 'PPX',
          serviceName: 'Priority Parcel Express',
          estimatedDays: { min: 1, max: 3 },
          isActive: true
        }],
        pricing: {
          baseFee: 25,
          currency: 'AED'
        }
      });

      const dropoffProvider = await ShippingProvider.create({
        name: 'local_dropoff',
        displayName: 'Drop-off Point',
        isActive: true,
        supportedServices: [{
          serviceCode: 'LOCAL_DROPOFF',
          serviceName: 'Drop-off Point',
          estimatedDays: { min: 0, max: 1 },
          isActive: true
        }],
        pricing: {
          baseFee: 5,
          currency: 'AED'
        }
      });

      await shippingFactory.reloadProviders();

      // Get rates from all providers
      const ratesResponse = await request(app)
        .post('/api/user/shipping/rates')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          origin: {
            fullName: seller.username,
            addressLine1: 'Dubai Mall',
            city: 'Dubai',
            country: 'United Arab Emirates'
          },
          destination: {
            fullName: buyer.username,
            addressLine1: 'Abu Dhabi Mall',
            city: 'Abu Dhabi',
            country: 'United Arab Emirates'
          },
          packageDetails: {
            weight: 1,
            dimensions: { length: 30, width: 20, height: 10 },
            value: product.price,
            currency: 'USD'
          }
        })
        .expect(200);

      expect(ratesResponse.body.success).toBe(true);
      const rates = ratesResponse.body.data.rates;
      
      // Should have rates from multiple providers
      expect(rates.length).toBeGreaterThan(1);
      
      // Verify rate structure
      rates.forEach(rate => {
        expect(rate).toHaveProperty('serviceCode');
        expect(rate).toHaveProperty('serviceName');
        expect(rate).toHaveProperty('cost');
        expect(rate.cost).toHaveProperty('total');
        expect(rate).toHaveProperty('provider');
      });

      // Rates should be sorted by price (cheapest first)
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i].cost.total).toBeGreaterThanOrEqual(rates[i-1].cost.total);
      }

      console.log('✅ Multiple shipping options test passed!');
    });

    test('should handle order status validation and error cases', async () => {
      // Create order
      const orderResponse = await request(app)
        .post('/api/user/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: product._id,
          sellerId: seller._id,
          paymentMethod: 'escrow',
          shippingAddress: {
            fullName: buyer.username,
            addressLine1: 'Test Address',
            city: 'Dubai',
            country: 'United Arab Emirates'
          }
        })
        .expect(200);

      const orderId = orderResponse.body.data.order._id;

      // Try invalid status transition (skip payment)
      const invalidTransitionResponse = await request(app)
        .put(`/api/user/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status: 'shipped', // Can't ship without payment
          notes: 'Invalid transition'
        })
        .expect(400);

      expect(invalidTransitionResponse.body.success).toBe(false);
      expect(invalidTransitionResponse.body.error).toContain('transition');

      // Try accessing order with wrong user
      const unauthorizedResponse = await request(app)
        .get(`/api/user/orders/${orderId}`)
        .set('Authorization', `Bearer ${sellerToken}`) // Seller trying to access buyer's order details
        .expect(403);

      expect(unauthorizedResponse.body.success).toBe(false);

      // Try invalid shipping rates request
      const invalidRatesResponse = await request(app)
        .post('/api/user/shipping/rates')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);

      expect(invalidRatesResponse.body.success).toBe(false);

      console.log('✅ Error handling test passed!');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent order creation', async () => {
      const concurrentOrders = 5;
      const orderPromises = [];

      for (let i = 0; i < concurrentOrders; i++) {
        const orderPromise = request(app)
          .post('/api/user/orders')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            productId: product._id,
            sellerId: seller._id,
            paymentMethod: 'escrow',
            shippingAddress: {
              fullName: `Buyer ${i}`,
              addressLine1: `Address ${i}`,
              city: 'Dubai',
              country: 'United Arab Emirates'
            }
          });
        
        orderPromises.push(orderPromise);
      }

      const responses = await Promise.all(orderPromises);
      
      // All orders should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // All orders should have unique order numbers
      const orderNumbers = responses.map(r => r.body.data.order.orderNumber);
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      expect(uniqueOrderNumbers.length).toBe(concurrentOrders);

      console.log('✅ Concurrent order creation test passed!');
    });

    test('should handle multiple rate requests efficiently', async () => {
      const startTime = Date.now();
      const rateRequests = 10;
      const ratePromises = [];

      for (let i = 0; i < rateRequests; i++) {
        const ratePromise = request(app)
          .post('/api/user/shipping/rates')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            origin: {
              fullName: seller.username,
              addressLine1: 'Dubai Mall',
              city: 'Dubai',
              country: 'United Arab Emirates'
            },
            destination: {
              fullName: buyer.username,
              addressLine1: 'Abu Dhabi Mall',
              city: 'Abu Dhabi',
              country: 'United Arab Emirates'
            },
            packageDetails: {
              weight: 1,
              dimensions: { length: 20, width: 15, height: 10 },
              value: 100,
              currency: 'USD'
            }
          });
        
        ratePromises.push(ratePromise);
      }

      const responses = await Promise.all(ratePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      console.log(`✅ Rate request performance test passed! (${duration}ms for ${rateRequests} requests)`);
    });
  });
});
