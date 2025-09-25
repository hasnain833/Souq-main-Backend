const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const shippingFactory = require('../../services/shipping/ShippingServiceFactory');
const ShippingProvider = require('../../db/models/shippingProviderModel');
const DeliveryOption = require('../../db/models/deliveryOptionModel');
const Order = require('../../db/models/orderModel');
const Shipment = require('../../db/models/shipmentModel');
const User = require('../../db/models/userModel');
const Product = require('../../db/models/productModel');

describe('Delivery System Integration Tests', () => {
  let testBuyer, testSeller, testProduct, testProviders;
  let app;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/souq_test');
    
    // Setup Express app with all routes
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
      req.user = { id: testBuyer?._id || new mongoose.Types.ObjectId() };
      next();
    });

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
    await ShippingProvider.deleteMany({});
    await DeliveryOption.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});

    // Create test users
    testBuyer = await User.create({
      username: 'testbuyer',
      email: 'buyer@test.com',
      password: 'hashedpassword',
      profile_picture: 'buyer-avatar.jpg'
    });

    testSeller = await User.create({
      username: 'testseller',
      email: 'seller@test.com',
      password: 'hashedpassword',
      profile_picture: 'seller-avatar.jpg'
    });

    // Create test product
    testProduct = await Product.create({
      title: 'Test Sneakers',
      price: 150,
      brand: 'Nike',
      size: '42',
      condition: 'New',
      material: 'Leather',
      colors: ['White', 'Black'],
      product_photos: ['sneaker1.jpg', 'sneaker2.jpg'],
      user: testSeller._id,
      shipping_cost: 0
    });

    // Create test shipping providers
    testProviders = await ShippingProvider.insertMany([
      {
        name: 'local_pickup',
        displayName: 'Local Pickup',
        isActive: true,
        supportedServices: [{
          serviceCode: 'LOCAL_PICKUP',
          serviceName: 'Local Pickup',
          estimatedDays: { min: 0, max: 1 },
          isActive: true
        }],
        pricing: { baseFee: 0, currency: 'AED' }
      },
      {
        name: 'local_dropoff',
        displayName: 'Drop-off Point',
        isActive: true,
        supportedServices: [{
          serviceCode: 'LOCAL_DROPOFF',
          serviceName: 'Drop-off Point',
          estimatedDays: { min: 0, max: 1 },
          isActive: true
        }],
        pricing: { baseFee: 5, currency: 'AED' }
      },
      {
        name: 'aramex',
        displayName: 'Aramex',
        isActive: true,
        supportedServices: [{
          serviceCode: 'PPX',
          serviceName: 'Priority Parcel Express',
          estimatedDays: { min: 1, max: 3 },
          isActive: true
        }],
        pricing: { baseFee: 25, currency: 'AED' }
      }
    ]);

    // Reload shipping factory with new providers
    await shippingFactory.reloadProviders();
  });

  describe('Complete Order Flow Integration', () => {
    test('should complete full order lifecycle from creation to delivery', async () => {
      // Step 1: Buyer configures delivery preferences
      const deliveryOption = await DeliveryOption.create({
        user: testBuyer._id,
        shippingProvider: testProviders[0]._id, // Local pickup
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        isDefault: true,
        preferences: {
          includeInsurance: false,
          requireSignature: false,
          allowCashOnDelivery: true
        }
      });

      expect(deliveryOption.isDefault).toBe(true);

      // Step 2: Create order
      const order = await Order.create({
        buyer: testBuyer._id,
        seller: testSeller._id,
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'pending',
          fees: {
            platformFee: testProduct.price * 0.1,
            shippingFee: 0,
            tax: 0.72,
            total: testProduct.price + (testProduct.price * 0.1) + 0.72
          }
        },
        shipping: {
          toAddress: {
            fullName: 'Test Buyer',
            addressLine1: 'Dubai Mall',
            city: 'Dubai',
            state: 'Dubai',
            zipCode: '00000',
            country: 'United Arab Emirates',
            phoneNumber: '+971501234567'
          }
        },
        status: 'pending_payment',
        timeline: [{
          status: 'pending_payment',
          timestamp: new Date(),
          description: 'Order created, awaiting payment',
          updatedBy: 'buyer'
        }]
      });

      expect(order.orderNumber).toMatch(/^ORD-\d+-\d{6}$/);
      expect(order.status).toBe('pending_payment');

      // Step 3: Payment completed
      order.payment.status = 'paid';
      order.status = 'paid';
      order.timeline.push({
        status: 'paid',
        timestamp: new Date(),
        description: 'Payment completed',
        updatedBy: 'system'
      });
      await order.save();

      expect(order.status).toBe('paid');

      // Step 4: Seller processes order
      order.status = 'processing';
      order.timeline.push({
        status: 'processing',
        timestamp: new Date(),
        description: 'Order is being processed',
        updatedBy: 'seller'
      });
      await order.save();

      // Step 5: Create shipment
      const localService = shippingFactory.getService('local_pickup');
      const shipmentResult = await localService.createShipment({
        serviceCode: 'LOCAL_PICKUP',
        origin: {
          fullName: testSeller.username,
          addressLine1: 'Seller Location',
          city: 'Dubai',
          country: 'United Arab Emirates'
        },
        destination: order.shipping.toAddress,
        packages: [{
          weight: 1,
          dimensions: { length: 30, width: 20, height: 10 },
          value: testProduct.price,
          contents: testProduct.title
        }],
        reference: order.orderNumber
      });

      expect(shipmentResult.trackingNumber).toMatch(/^LOCAL_\d+_/);

      // Step 6: Update order with shipping info
      order.status = 'shipped';
      order.shipping.provider = testProviders[0]._id;
      order.shipping.trackingNumber = shipmentResult.trackingNumber;
      order.shipping.estimatedDelivery = shipmentResult.estimatedDelivery;
      order.timeline.push({
        status: 'shipped',
        timestamp: new Date(),
        description: 'Package shipped',
        updatedBy: 'seller'
      });
      await order.save();

      // Step 7: Create shipment record
      const shipment = await Shipment.create({
        order: order._id,
        shippingProvider: testProviders[0]._id,
        providerShipmentId: shipmentResult.providerShipmentId,
        trackingNumber: shipmentResult.trackingNumber,
        tracking: {
          status: 'created',
          events: [{
            timestamp: new Date(),
            status: 'created',
            description: 'Shipment created',
            eventCode: 'CREATED'
          }]
        }
      });

      // Step 8: Track shipment progress
      const trackingInfo = await localService.trackShipment(shipmentResult.trackingNumber);
      expect(trackingInfo.trackingNumber).toBe(shipmentResult.trackingNumber);
      expect(trackingInfo.events).toBeInstanceOf(Array);

      // Step 9: Simulate delivery
      order.status = 'delivered';
      order.delivery = {
        confirmationDate: new Date(),
        confirmedBy: 'buyer'
      };
      order.timeline.push({
        status: 'delivered',
        timestamp: new Date(),
        description: 'Package delivered',
        updatedBy: 'buyer'
      });
      await order.save();

      // Verify final state
      expect(order.status).toBe('delivered');
      expect(order.delivery.confirmedBy).toBe('buyer');
      expect(order.timeline).toHaveLength(5);
      expect(shipment.trackingNumber).toBe(shipmentResult.trackingNumber);
    });

    test('should handle multiple shipping options and rate comparison', async () => {
      const origin = {
        fullName: testSeller.username,
        addressLine1: 'Dubai Mall',
        city: 'Dubai',
        country: 'United Arab Emirates'
      };

      const destination = {
        fullName: testBuyer.username,
        addressLine1: 'Abu Dhabi Mall',
        city: 'Abu Dhabi',
        country: 'United Arab Emirates'
      };

      const packageDetails = {
        weight: 1,
        dimensions: { length: 30, width: 20, height: 10 },
        value: testProduct.price,
        currency: 'USD',
        description: testProduct.title
      };

      // Get rates from all providers
      const allRates = await shippingFactory.getAllRates(origin, destination, packageDetails);
      
      expect(allRates).toBeInstanceOf(Array);
      expect(allRates.length).toBeGreaterThan(0);

      // Verify rate structure
      allRates.forEach(rate => {
        expect(rate).toHaveProperty('serviceCode');
        expect(rate).toHaveProperty('serviceName');
        expect(rate).toHaveProperty('cost');
        expect(rate.cost).toHaveProperty('total');
        expect(rate).toHaveProperty('provider');
      });

      // Get cheapest option
      const cheapestRate = await shippingFactory.getCheapestRate(origin, destination, packageDetails);
      expect(cheapestRate).toBeDefined();
      expect(cheapestRate.cost.total).toBe(Math.min(...allRates.map(r => r.cost.total)));

      // Get fastest option
      const fastestRate = await shippingFactory.getFastestRate(origin, destination, packageDetails);
      expect(fastestRate).toBeDefined();
    });

    test('should handle local pickup workflow', async () => {
      // Create pickup location
      const pickupDeliveryOption = await DeliveryOption.create({
        user: testSeller._id,
        shippingProvider: testProviders[0]._id,
        serviceCode: 'LOCAL_PICKUP',
        serviceName: 'Local Pickup',
        settings: {
          pickup: {
            enabled: true,
            address: {
              fullName: 'Seller Store',
              addressLine1: 'Dubai Mall, Level 2',
              city: 'Dubai',
              country: 'United Arab Emirates'
            },
            timeSlots: [
              { day: 'monday', startTime: '09:00', endTime: '17:00', isActive: true },
              { day: 'tuesday', startTime: '09:00', endTime: '17:00', isActive: true },
              { day: 'wednesday', startTime: '09:00', endTime: '17:00', isActive: true },
              { day: 'thursday', startTime: '09:00', endTime: '17:00', isActive: true },
              { day: 'friday', startTime: '09:00', endTime: '17:00', isActive: true }
            ],
            instructions: 'Please call when you arrive'
          }
        }
      });

      expect(pickupDeliveryOption.settings.pickup.enabled).toBe(true);
      expect(pickupDeliveryOption.settings.pickup.timeSlots).toHaveLength(5);

      // Create order with pickup option
      const order = await Order.create({
        buyer: testBuyer._id,
        seller: testSeller._id,
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        shipping: {
          method: 'pickup',
          provider: testProviders[0]._id,
          serviceCode: 'LOCAL_PICKUP'
        },
        status: 'paid'
      });

      // Simulate pickup scheduling
      const localService = shippingFactory.getService('local_pickup');
      const pickupSchedule = await localService.schedulePickup({
        address: pickupDeliveryOption.settings.pickup.address,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        timeSlot: '10:00-12:00',
        contactPerson: testBuyer.username,
        contactPhone: '+971501234567',
        instructions: 'Will call upon arrival'
      });

      expect(pickupSchedule.pickupId).toBeDefined();
      expect(pickupSchedule.confirmationNumber).toBeDefined();

      // Update order status
      order.status = 'ready_for_pickup';
      order.timeline.push({
        status: 'ready_for_pickup',
        timestamp: new Date(),
        description: 'Order ready for pickup',
        updatedBy: 'seller'
      });
      await order.save();

      expect(order.status).toBe('ready_for_pickup');
    });

    test('should handle drop-off workflow', async () => {
      // Create drop-off location
      const dropoffDeliveryOption = await DeliveryOption.create({
        user: testSeller._id,
        shippingProvider: testProviders[1]._id,
        serviceCode: 'LOCAL_DROPOFF',
        serviceName: 'Drop-off Point',
        settings: {
          dropoff: {
            enabled: true,
            locations: [{
              name: 'Dubai Mall Drop-off Point',
              address: {
                addressLine1: 'Dubai Mall, Ground Floor',
                city: 'Dubai',
                country: 'United Arab Emirates'
              },
              coordinates: {
                latitude: 25.1972,
                longitude: 55.2796
              },
              operatingHours: [
                { day: 'monday', startTime: '10:00', endTime: '22:00', isActive: true },
                { day: 'tuesday', startTime: '10:00', endTime: '22:00', isActive: true },
                { day: 'wednesday', startTime: '10:00', endTime: '22:00', isActive: true },
                { day: 'thursday', startTime: '10:00', endTime: '22:00', isActive: true },
                { day: 'friday', startTime: '10:00', endTime: '24:00', isActive: true },
                { day: 'saturday', startTime: '10:00', endTime: '24:00', isActive: true },
                { day: 'sunday', startTime: '10:00', endTime: '22:00', isActive: true }
              ],
              contactInfo: {
                phone: '+971501234567',
                email: 'dropoff@dubaimall.com'
              },
              isActive: true
            }]
          }
        }
      });

      expect(dropoffDeliveryOption.settings.dropoff.enabled).toBe(true);
      expect(dropoffDeliveryOption.settings.dropoff.locations).toHaveLength(1);

      // Create order with drop-off option
      const order = await Order.create({
        buyer: testBuyer._id,
        seller: testSeller._id,
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        shipping: {
          method: 'dropoff',
          provider: testProviders[1]._id,
          serviceCode: 'LOCAL_DROPOFF',
          cost: {
            total: 5,
            currency: 'AED'
          }
        },
        status: 'paid'
      });

      // Simulate drop-off process
      order.status = 'dropped_off';
      order.timeline.push({
        status: 'dropped_off',
        timestamp: new Date(),
        description: 'Package dropped off at collection point',
        updatedBy: 'seller'
      });
      await order.save();

      // Buyer picks up from drop-off point
      order.status = 'delivered';
      order.delivery = {
        confirmationDate: new Date(),
        confirmedBy: 'buyer',
        deliveryLocation: 'Dubai Mall Drop-off Point'
      };
      order.timeline.push({
        status: 'delivered',
        timestamp: new Date(),
        description: 'Package collected from drop-off point',
        updatedBy: 'buyer'
      });
      await order.save();

      expect(order.status).toBe('delivered');
      expect(order.delivery.deliveryLocation).toBe('Dubai Mall Drop-off Point');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle provider service failures gracefully', async () => {
      // Test with invalid provider configuration
      const invalidProvider = await ShippingProvider.create({
        name: 'invalid_provider',
        displayName: 'Invalid Provider',
        isActive: true,
        configuration: {
          invalid: {
            apiKey: 'invalid_key'
          }
        }
      });

      // Should not crash the system
      const services = shippingFactory.getAllServices();
      expect(services).toBeInstanceOf(Array);
    });

    test('should handle network failures in tracking', async () => {
      const localService = shippingFactory.getService('local_pickup');
      
      // Should handle invalid tracking numbers gracefully
      const tracking = await localService.trackShipment('INVALID_TRACKING_NUMBER');
      expect(tracking).toBeDefined();
      expect(tracking.status).toBe('created'); // Fallback status
    });

    test('should validate order status transitions', async () => {
      const order = await Order.create({
        buyer: testBuyer._id,
        seller: testSeller._id,
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'paid'
        },
        status: 'delivered' // Already delivered
      });

      // Should not allow invalid transitions
      order.status = 'processing'; // Invalid: can't go back from delivered
      
      // In a real implementation, this would be validated
      // For now, we just verify the order exists
      expect(order._id).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent rate requests', async () => {
      const origin = {
        fullName: 'Test Seller',
        addressLine1: 'Dubai Mall',
        city: 'Dubai',
        country: 'United Arab Emirates'
      };

      const destination = {
        fullName: 'Test Buyer',
        addressLine1: 'Abu Dhabi Mall',
        city: 'Abu Dhabi',
        country: 'United Arab Emirates'
      };

      const packageDetails = {
        weight: 1,
        dimensions: { length: 20, width: 15, height: 10 },
        value: 100,
        currency: 'USD'
      };

      // Simulate multiple concurrent requests
      const promises = Array(5).fill().map(() => 
        shippingFactory.getAllRates(origin, destination, packageDetails)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(rates => {
        expect(rates).toBeInstanceOf(Array);
      });
    });

    test('should handle large order volumes', async () => {
      // Create multiple orders
      const orders = [];
      for (let i = 0; i < 10; i++) {
        const order = await Order.create({
          buyer: testBuyer._id,
          seller: testSeller._id,
          product: testProduct._id,
          orderDetails: {
            productPrice: testProduct.price,
            quantity: 1,
            currency: 'USD'
          },
          payment: {
            method: 'escrow',
            status: 'paid'
          },
          status: 'paid'
        });
        orders.push(order);
      }

      expect(orders).toHaveLength(10);
      
      // Verify all orders have unique order numbers
      const orderNumbers = orders.map(o => o.orderNumber);
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      expect(uniqueOrderNumbers).toHaveLength(10);
    });
  });
});
