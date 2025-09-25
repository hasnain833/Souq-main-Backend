const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set test environment variables
  process.env.MONGO_TEST_URI = mongoUri;
  process.env.JWT_SECRET = 'test_jwt_secret';
  process.env.NODE_ENV = 'test';
  
  // Mock external API calls
  jest.mock('axios', () => ({
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
    get: jest.fn(() => Promise.resolve({ data: { success: true } })),
    put: jest.fn(() => Promise.resolve({ data: { success: true } })),
    delete: jest.fn(() => Promise.resolve({ data: { success: true } }))
  }));
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Setup before each test
beforeEach(async () => {
  // Clear all collections
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});

// Global test utilities
global.createTestUser = (overrides = {}) => ({
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  ...overrides
});

global.createTestProduct = (overrides = {}) => ({
  title: 'Test Product',
  price: 100,
  brand: 'Test Brand',
  size: 'M',
  condition: 'New',
  product_photos: ['test.jpg'],
  ...overrides
});

global.createTestOrder = (overrides = {}) => ({
  orderDetails: {
    productPrice: 100,
    quantity: 1,
    currency: 'USD'
  },
  payment: {
    method: 'escrow',
    status: 'pending'
  },
  status: 'pending_payment',
  ...overrides
});

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}
