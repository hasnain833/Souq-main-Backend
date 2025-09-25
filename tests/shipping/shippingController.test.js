const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const shippingController = require('../../app/user/shipping/controllers/shippingController');
const orderController = require('../../app/user/shipping/controllers/orderController');
const ShippingProvider = require('../../db/models/shippingProviderModel');
const DeliveryOption = require('../../db/models/deliveryOptionModel');
const Order = require('../../db/models/orderModel');
const User = require('../../db/models/userModel');
const Product = require('../../db/models/productModel');

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { id: testUserId };
  next();
};

describe('Shipping Controller Tests', () => {
  let app;
  let testUserId;
  let testSellerId;
  let testProductId;
  let testProvider;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/souq_test');
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(mockVerifyToken);
    
    // Setup routes
    app.get('/shipping/providers', shippingController.getProviders);
    app.post('/shipping/rates', shippingController.getShippingRates);
    app.post('/shipping/shipments', shippingController.createShipment);
    app.get('/shipping/track/:trackingNumber', shippingController.trackShipment);
    app.get('/shipping/delivery-options', shippingController.getDeliveryOptions);
    app.post('/shipping/delivery-options', shippingController.saveDeliveryOption);
    app.delete('/shipping/delivery-options/:deliveryOptionId', shippingController.deleteDeliveryOption);
    app.put('/shipping/delivery-options/:deliveryOptionId/default', shippingController.setDefaultDeliveryOption);
    
    // Order routes
    app.get('/orders', orderController.getUserOrders.bind(orderController));
    app.post('/orders', orderController.createOrder.bind(orderController));
    app.get('/orders/:orderId', orderController.getOrderDetails.bind(orderController));
    app.put('/orders/:orderId/status', orderController.updateOrderStatus.bind(orderController));
    app.post('/orders/:orderId/confirm-delivery', orderController.confirmDelivery.bind(orderController));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up and create test data
    await ShippingProvider.deleteMany({});
    await DeliveryOption.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});

    testUserId = new mongoose.Types.ObjectId();
    testSellerId = new mongoose.Types.ObjectId();
    testProductId = new mongoose.Types.ObjectId();

    // Create test user
    await User.create({
      _id: testUserId,
      username: 'testbuyer',
      email: 'buyer@test.com',
      password: 'hashedpassword'
    });

    await User.create({
      _id: testSellerId,
      username: 'testseller',
      email: 'seller@test.com',
      password: 'hashedpassword'
    });

    // Create test product
    await Product.create({
      _id: testProductId,
      title: 'Test Product',
      price: 100,
      user: testSellerId,
      product_photos: ['test-image.jpg']
    });

    // Create test provider
    testProvider = await ShippingProvider.create({
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

    authToken = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET || 'test_secret');
  });

  describe('GET /shipping/providers', () => {
    test('should return available shipping providers', async () => {
      const response = await request(app)
        .get('/shipping/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toBeInstanceOf(Array);
      expect(response.body.data.providers.length).toBeGreaterThan(0);
      expect(response.body.data.providers[0]).toHaveProperty('name');
      expect(response.body.data.providers[0]).toHaveProperty('displayName');
    });
  });

  describe('POST /shipping/rates', () => {
    test('should calculate shipping rates successfully', async () => {
      const rateRequest = {
        origin: {
          fullName: 'Seller Name',
          addressLine1: 'Dubai Mall',
          city: 'Dubai',
          country: 'United Arab Emirates'
        },
        destination: {
          fullName: 'Buyer Name',
          addressLine1: 'Abu Dhabi Mall',
          city: 'Abu Dhabi',
          country: 'United Arab Emirates'
        },
        packageDetails: {
          weight: 1,
          dimensions: { length: 10, width: 10, height: 10 },
          value: 100,
          currency: 'USD'
        }
      };

      const response = await request(app)
        .post('/shipping/rates')
        .send(rateRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rates).toBeInstanceOf(Array);
    });

    test('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/shipping/rates')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Delivery Options Management', () => {
    test('should create delivery option successfully', async () => {
      const deliveryOptionData = {
        shippingProvider: testProvider._id,
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        isDefault: true
      };

      const response = await request(app)
        .post('/shipping/delivery-options')
        .send(deliveryOptionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deliveryOption).toHaveProperty('_id');
      expect(response.body.data.deliveryOption.isDefault).toBe(true);
    });

    test('should get user delivery options', async () => {
      // Create a delivery option first
      await DeliveryOption.create({
        user: testUserId,
        shippingProvider: testProvider._id,
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        isDefault: true
      });

      const response = await request(app)
        .get('/shipping/delivery-options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deliveryOptions).toBeInstanceOf(Array);
      expect(response.body.data.deliveryOptions.length).toBe(1);
    });

    test('should set default delivery option', async () => {
      const deliveryOption = await DeliveryOption.create({
        user: testUserId,
        shippingProvider: testProvider._id,
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        isDefault: false
      });

      const response = await request(app)
        .put(`/shipping/delivery-options/${deliveryOption._id}/default`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deliveryOption.isDefault).toBe(true);
    });

    test('should delete delivery option', async () => {
      const deliveryOption = await DeliveryOption.create({
        user: testUserId,
        shippingProvider: testProvider._id,
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup'
      });

      const response = await request(app)
        .delete(`/shipping/delivery-options/${deliveryOption._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedOption = await DeliveryOption.findById(deliveryOption._id);
      expect(deletedOption).toBeNull();
    });
  });

  describe('Order Management', () => {
    test('should create order successfully', async () => {
      const orderData = {
        productId: testProductId,
        sellerId: testSellerId,
        paymentMethod: 'escrow',
        shippingAddress: {
          fullName: 'Test Buyer',
          addressLine1: 'Test Address',
          city: 'Dubai',
          country: 'United Arab Emirates'
        }
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order).toHaveProperty('orderNumber');
      expect(response.body.data.order.status).toBe('pending_payment');
    });

    test('should get user orders', async () => {
      // Create test order
      await Order.create({
        buyer: testUserId,
        seller: testSellerId,
        product: testProductId,
        orderDetails: {
          productPrice: 100,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        }
      });

      const response = await request(app)
        .get('/orders?role=buyer')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toBeInstanceOf(Array);
      expect(response.body.data.orders.length).toBe(1);
    });

    test('should get order details', async () => {
      const order = await Order.create({
        buyer: testUserId,
        seller: testSellerId,
        product: testProductId,
        orderDetails: {
          productPrice: 100,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        }
      });

      const response = await request(app)
        .get(`/orders/${order._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order._id).toBe(order._id.toString());
    });

    test('should update order status', async () => {
      const order = await Order.create({
        buyer: testUserId,
        seller: testSellerId,
        product: testProductId,
        orderDetails: {
          productPrice: 100,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        status: 'paid'
      });

      const response = await request(app)
        .put(`/orders/${order._id}/status`)
        .send({ status: 'processing', notes: 'Order is being processed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('processing');
    });

    test('should confirm delivery', async () => {
      const order = await Order.create({
        buyer: testUserId,
        seller: testSellerId,
        product: testProductId,
        orderDetails: {
          productPrice: 100,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        status: 'shipped'
      });

      const response = await request(app)
        .post(`/orders/${order._id}/confirm-delivery`)
        .send({ rating: 5, feedback: 'Great delivery!' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('delivered');
    });
  });

  describe('Error Handling', () => {
    test('should handle unauthorized access', async () => {
      // Remove auth middleware temporarily
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.get('/shipping/providers', shippingController.getProviders);

      const response = await request(appNoAuth)
        .get('/shipping/providers')
        .expect(500); // Should fail without auth

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid order ID', async () => {
      const response = await request(app)
        .get('/orders/invalid_id')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle missing shipping provider', async () => {
      const deliveryOptionData = {
        shippingProvider: new mongoose.Types.ObjectId(),
        serviceCode: 'INVALID',
        serviceName: 'Invalid Service'
      };

      const response = await request(app)
        .post('/shipping/delivery-options')
        .send(deliveryOptionData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Validation Tests', () => {
    test('should validate shipping rates request', async () => {
      const invalidRequest = {
        origin: null,
        destination: null,
        packageDetails: null
      };

      const response = await request(app)
        .post('/shipping/rates')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should validate order creation', async () => {
      const invalidOrder = {
        productId: null,
        sellerId: null,
        paymentMethod: null
      };

      const response = await request(app)
        .post('/orders')
        .send(invalidOrder)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should validate order status transitions', async () => {
      const order = await Order.create({
        buyer: testUserId,
        seller: testSellerId,
        product: testProductId,
        orderDetails: {
          productPrice: 100,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        status: 'delivered' // Already delivered
      });

      const response = await request(app)
        .put(`/orders/${order._id}/status`)
        .send({ status: 'processing' }) // Invalid transition
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('transition');
    });
  });
});
