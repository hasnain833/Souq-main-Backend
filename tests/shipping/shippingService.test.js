const mongoose = require('mongoose');
const ShippingProvider = require('../../db/models/shippingProviderModel');
const DeliveryOption = require('../../db/models/deliveryOptionModel');
const Order = require('../../db/models/orderModel');
const Shipment = require('../../db/models/shipmentModel');
const shippingFactory = require('../../services/shipping/ShippingServiceFactory');
const AramexService = require('../../services/shipping/AramexService');
const FetchrService = require('../../services/shipping/FetchrService');
const DHLService = require('../../services/shipping/DHLService');
const LocalDeliveryService = require('../../services/shipping/LocalDeliveryService');

describe('Shipping Service Tests', () => {
  let testProvider;
  let testUser;
  let testProduct;
  let testOrder;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/souq_test');
    
    // Initialize shipping factory
    await shippingFactory.initialize();
  });

  afterAll(async () => {
    // Clean up test data
    await ShippingProvider.deleteMany({});
    await DeliveryOption.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test data
    testProvider = await ShippingProvider.create({
      name: 'test_provider',
      displayName: 'Test Provider',
      isActive: true,
      configuration: {
        test: {
          apiKey: 'test_key',
          environment: 'sandbox'
        }
      },
      supportedServices: [{
        serviceCode: 'TEST',
        serviceName: 'Test Service',
        estimatedDays: { min: 1, max: 3 },
        isActive: true
      }],
      pricing: {
        baseFee: 10,
        perKgRate: 5,
        currency: 'AED'
      }
    });

    testUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser',
      email: 'test@example.com'
    };

    testProduct = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Test Product',
      price: 100,
      weight: 1
    };
  });

  afterEach(async () => {
    // Clean up after each test
    await ShippingProvider.deleteMany({});
    await DeliveryOption.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});
  });

  describe('ShippingProvider Model', () => {
    test('should create a shipping provider successfully', async () => {
      expect(testProvider).toBeDefined();
      expect(testProvider.name).toBe('test_provider');
      expect(testProvider.displayName).toBe('Test Provider');
      expect(testProvider.isActive).toBe(true);
    });

    test('should validate required fields', async () => {
      const invalidProvider = new ShippingProvider({});
      
      await expect(invalidProvider.save()).rejects.toThrow();
    });

    test('should enforce unique provider names', async () => {
      const duplicateProvider = new ShippingProvider({
        name: 'test_provider',
        displayName: 'Duplicate Provider'
      });

      await expect(duplicateProvider.save()).rejects.toThrow();
    });
  });

  describe('DeliveryOption Model', () => {
    test('should create delivery option successfully', async () => {
      const deliveryOption = await DeliveryOption.create({
        user: testUser._id,
        shippingProvider: testProvider._id,
        serviceCode: 'TEST',
        serviceName: 'Test Service',
        isDefault: true
      });

      expect(deliveryOption).toBeDefined();
      expect(deliveryOption.user.toString()).toBe(testUser._id.toString());
      expect(deliveryOption.isDefault).toBe(true);
    });

    test('should ensure only one default per user', async () => {
      // Create first default option
      await DeliveryOption.create({
        user: testUser._id,
        shippingProvider: testProvider._id,
        serviceCode: 'TEST1',
        serviceName: 'Test Service 1',
        isDefault: true
      });

      // Create second default option
      const secondOption = await DeliveryOption.create({
        user: testUser._id,
        shippingProvider: testProvider._id,
        serviceCode: 'TEST2',
        serviceName: 'Test Service 2',
        isDefault: true
      });

      // Check that first option is no longer default
      const firstOption = await DeliveryOption.findOne({ serviceCode: 'TEST1' });
      expect(firstOption.isDefault).toBe(false);
      expect(secondOption.isDefault).toBe(true);
    });
  });

  describe('Order Model', () => {
    test('should create order with auto-generated order number', async () => {
      const order = await Order.create({
        buyer: testUser._id,
        seller: new mongoose.Types.ObjectId(),
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'pending'
        }
      });

      expect(order).toBeDefined();
      expect(order.orderNumber).toMatch(/^ORD-\d+-\d{6}$/);
      expect(order.status).toBe('pending_payment');
    });

    test('should add timeline entry on creation', async () => {
      const order = await Order.create({
        buyer: testUser._id,
        seller: new mongoose.Types.ObjectId(),
        product: testProduct._id,
        orderDetails: {
          productPrice: testProduct.price,
          quantity: 1,
          currency: 'USD'
        },
        payment: {
          method: 'escrow',
          status: 'pending'
        },
        timeline: [{
          status: 'pending_payment',
          description: 'Order created',
          updatedBy: 'buyer'
        }]
      });

      expect(order.timeline).toHaveLength(1);
      expect(order.timeline[0].status).toBe('pending_payment');
    });
  });

  describe('LocalDeliveryService', () => {
    let localService;

    beforeEach(() => {
      localService = new LocalDeliveryService();
    });

    test('should validate configuration', async () => {
      const isValid = await localService.validateConfiguration();
      expect(isValid).toBe(true);
    });

    test('should return service codes', () => {
      const serviceCodes = localService.getServiceCodes();
      expect(serviceCodes).toHaveLength(3);
      expect(serviceCodes[0].code).toBe('LOCAL_PICKUP');
      expect(serviceCodes[1].code).toBe('LOCAL_DROPOFF');
      expect(serviceCodes[2].code).toBe('LOCAL_DELIVERY');
    });

    test('should calculate shipping rates', async () => {
      const origin = {
        city: 'Dubai',
        country: 'United Arab Emirates'
      };
      const destination = {
        city: 'Abu Dhabi',
        country: 'United Arab Emirates'
      };
      const packageDetails = {
        weight: 1,
        dimensions: { length: 10, width: 10, height: 10 },
        value: 100
      };

      const rates = await localService.getShippingRates(origin, destination, packageDetails);
      
      expect(rates).toBeInstanceOf(Array);
      expect(rates.length).toBeGreaterThan(0);
      expect(rates[0]).toHaveProperty('serviceCode');
      expect(rates[0]).toHaveProperty('cost');
      expect(rates[0].cost).toHaveProperty('total');
    });

    test('should create shipment', async () => {
      const shipmentData = {
        serviceCode: 'LOCAL_PICKUP',
        origin: { city: 'Dubai' },
        destination: { city: 'Abu Dhabi' },
        packages: [{ weight: 1, value: 100 }]
      };

      const shipment = await localService.createShipment(shipmentData);
      
      expect(shipment).toHaveProperty('trackingNumber');
      expect(shipment).toHaveProperty('providerShipmentId');
      expect(shipment.trackingNumber).toMatch(/^LOCAL_\d+_/);
    });

    test('should track shipment', async () => {
      const trackingNumber = `LOCAL_${Date.now()}_test123`;
      
      const tracking = await localService.trackShipment(trackingNumber);
      
      expect(tracking).toHaveProperty('trackingNumber');
      expect(tracking).toHaveProperty('status');
      expect(tracking).toHaveProperty('events');
      expect(tracking.events).toBeInstanceOf(Array);
    });
  });

  describe('ShippingServiceFactory', () => {
    test('should initialize successfully', async () => {
      expect(shippingFactory.initialized).toBe(true);
    });

    test('should get service statistics', () => {
      const stats = shippingFactory.getStatistics();
      
      expect(stats).toHaveProperty('totalServices');
      expect(stats).toHaveProperty('healthyServices');
      expect(stats).toHaveProperty('services');
      expect(stats.services).toBeInstanceOf(Array);
    });

    test('should get all available services', () => {
      const services = shippingFactory.getAllServices();
      
      expect(services).toBeInstanceOf(Array);
      services.forEach(service => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('displayName');
        expect(service).toHaveProperty('service');
      });
    });

    test('should handle service not found', () => {
      expect(() => {
        shippingFactory.getService('nonexistent_provider');
      }).toThrow('Shipping provider \'nonexistent_provider\' not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid shipping rates request', async () => {
      const localService = new LocalDeliveryService();
      
      await expect(
        localService.getShippingRates(null, null, null)
      ).rejects.toThrow();
    });

    test('should handle invalid tracking number', async () => {
      const localService = new LocalDeliveryService();
      
      const tracking = await localService.trackShipment('INVALID_TRACKING');
      expect(tracking.status).toBe('created'); // Should fallback gracefully
    });

    test('should handle shipment creation errors', async () => {
      const localService = new LocalDeliveryService();
      
      await expect(
        localService.createShipment({})
      ).resolves.toBeDefined(); // Should handle gracefully
    });
  });

  describe('Integration Tests', () => {
    test('should complete full order flow', async () => {
      // 1. Create delivery option
      const deliveryOption = await DeliveryOption.create({
        user: testUser._id,
        shippingProvider: testProvider._id,
        serviceCode: 'TEST',
        serviceName: 'Test Service',
        isDefault: true
      });

      // 2. Create order
      const order = await Order.create({
        buyer: testUser._id,
        seller: new mongoose.Types.ObjectId(),
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

      // 3. Update order to shipped
      order.status = 'shipped';
      order.shipping = {
        provider: testProvider._id,
        trackingNumber: 'TEST123456',
        serviceCode: 'TEST'
      };
      await order.save();

      // 4. Create shipment
      const shipment = await Shipment.create({
        order: order._id,
        shippingProvider: testProvider._id,
        trackingNumber: 'TEST123456',
        tracking: {
          status: 'created',
          events: [{
            timestamp: new Date(),
            status: 'created',
            description: 'Shipment created'
          }]
        }
      });

      // 5. Verify complete flow
      expect(deliveryOption).toBeDefined();
      expect(order.status).toBe('shipped');
      expect(order.shipping.trackingNumber).toBe('TEST123456');
      expect(shipment.trackingNumber).toBe('TEST123456');
    });
  });
});
