// test-order-controller-email.js
// Test the actual orderController email functionality

require('dotenv').config();
const mongoose = require('mongoose');

async function testOrderControllerEmail() {
  try {
    // Connect to MongoDB  
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/souq');
    console.log('✅ Connected to MongoDB');

    const OrderController = require('./app/user/shipping/controllers/orderController');
    
    // Mock request and response objects
    const mockReq = {
      user: { _id: new mongoose.Types.ObjectId() }, // Mock user ID
      params: { orderId: 'test-order-id' },
      body: {
        status: 'shipped',
        notes: 'Package shipped via FedEx',
        shippingDetails: {
          trackingNumber: 'TRK123456789',
          provider: 'fedex',
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    };

    const mockRes = {
      status: function(code) { 
        this.statusCode = code; 
        return this; 
      },
      json: function(data) { 
        console.log('📊 Controller Response:', JSON.stringify(data, null, 2));
        return this; 
      }
    };

    console.log('🧪 Testing OrderController.updateOrderStatus email functionality...');
    console.log('📦 Mock request data:', {
      orderId: mockReq.params.orderId,
      status: mockReq.body.status,
      shippingDetails: mockReq.body.shippingDetails
    });

    // This will likely fail because the order ID doesn't exist, but we can see the email logic
    try {
      await OrderController.updateOrderStatus(mockReq, mockRes);
    } catch (error) {
      console.log('⚠️ Expected error (order not found):', error.message);
    }

    console.log('✅ Test completed - check logs above for email functionality');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run the test
testOrderControllerEmail().catch(console.error);