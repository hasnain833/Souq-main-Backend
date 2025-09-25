const mongoose = require('mongoose');
require('dotenv').config();

async function createSampleData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./db/models/userModel');
    const Product = require('./db/models/productModel');
    const Order = require('./db/models/orderModel');
    const Category = require('./db/models/categoryModel');
    const StandardPayment = require('./db/models/standardPaymentModel');
    const bcrypt = require('bcrypt');

    console.log('🔧 Creating sample data...');

    // Create sample categories first
    let category = await Category.findOne({ name: 'Electronics' });
    if (!category) {
      category = new Category({
        name: 'Electronics',
        description: 'Electronic devices and gadgets',
        isActive: true
      });
      await category.save();
      console.log('✅ Created Electronics category');
    }

    // Create sample users
    const users = [];
    for (let i = 1; i <= 5; i++) {
      let user = await User.findOne({ email: `user${i}@example.com` });
      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        user = new User({
          firstName: `User${i}`,
          lastName: `Test`,
          userName: `user${i}test`,
          email: `user${i}@example.com`,
          password: hashedPassword,
          emailVerifiedAt: new Date(),
          country: 'US',
          city: 'New York'
        });
        await user.save();
        console.log(`✅ Created user: ${user.email}`);
      }
      users.push(user);
    }

    // Create sample products
    const products = [];
    for (let i = 1; i <= 10; i++) {
      let product = await Product.findOne({ title: `Sample Product ${i}` });
      if (!product) {
        product = new Product({
          title: `Sample Product ${i}`,
          description: `This is a sample product ${i} for testing purposes`,
          price: Math.floor(Math.random() * 500) + 50, // Random price between 50-550
          currency: 'USD',
          category: category._id,
          user: users[Math.floor(Math.random() * users.length)]._id,
          status: Math.random() > 0.2 ? 'active' : 'draft', // 80% active, 20% draft
          condition: 'new',
          images: [`https://via.placeholder.com/400x400?text=Product+${i}`],
          location: {
            country: 'US',
            city: 'New York'
          },
          shipping: {
            freeShipping: Math.random() > 0.5,
            shippingCost: Math.floor(Math.random() * 20) + 5
          }
        });
        await product.save();
        console.log(`✅ Created product: ${product.title}`);
      }
      products.push(product);
    }

    // Create sample orders
    for (let i = 1; i <= 15; i++) {
      const orderNumber = `ORD-${Date.now()}-${i}`;
      let order = await Order.findOne({ orderNumber });
      if (!order) {
        const buyer = users[Math.floor(Math.random() * users.length)];
        const seller = users[Math.floor(Math.random() * users.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        
        // Make sure buyer and seller are different
        if (buyer._id.toString() === seller._id.toString()) continue;

        order = new Order({
          orderNumber,
          buyer: buyer._id,
          seller: seller._id,
          product: product._id,
          orderDetails: {
            productPrice: product.price,
            quantity: 1,
            currency: 'USD'
          },
          payment: {
            method: Math.random() > 0.5 ? 'escrow' : 'standard',
            status: Math.random() > 0.3 ? 'paid' : 'pending' // 70% paid
          },
          status: Math.random() > 0.3 ? 'delivered' : 'pending_payment',
          shipping: {
            method: 'delivery',
            toAddress: {
              fullName: `${buyer.firstName} ${buyer.lastName}`,
              street1: '123 Test Street',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'US',
              phoneNumber: '+1234567890'
            },
            cost: {
              total: 10,
              currency: 'USD'
            }
          }
        });
        await order.save();
        console.log(`✅ Created order: ${order.orderNumber}`);
      }
    }

    // Create sample standard payments
    for (let i = 1; i <= 20; i++) {
      const transactionId = `TXN-${Date.now()}-${i}`;
      let payment = await StandardPayment.findOne({ transactionId });
      if (!payment) {
        const buyer = users[Math.floor(Math.random() * users.length)];
        const seller = users[Math.floor(Math.random() * users.length)];
        const product = products[Math.floor(Math.random() * products.length)];

        // Make sure buyer and seller are different
        if (buyer._id.toString() === seller._id.toString()) continue;

        const productPrice = Math.floor(Math.random() * 1000) + 100; // Random price between 100-1100
        const shippingCost = Math.floor(Math.random() * 50) + 10; // Random shipping 10-60
        const totalAmount = productPrice + shippingCost;

        payment = new StandardPayment({
          transactionId,
          buyer: buyer._id,
          seller: seller._id,
          product: product._id,
          productPrice,
          shippingCost,
          totalAmount,
          currency: 'USD',
          paymentGateway: 'stripe',
          gatewayTransactionId: `pi_${Math.random().toString(36).substr(2, 9)}`,
          status: Math.random() > 0.2 ? 'completed' : 'pending', // 80% completed
          paymentMethod: 'credit_card',
          shippingAddress: {
            fullName: `${buyer.firstName} ${buyer.lastName}`,
            street1: '123 Test Street',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US'
          },
          metadata: {
            source: 'sample_data'
          }
        });
        await payment.save();
        console.log(`✅ Created payment: ${payment.transactionId} - $${payment.totalAmount}`);
      }
    }

    console.log('\n🎯 Sample data creation completed!');
    console.log('📊 You should now see data in the admin dashboard');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the script
createSampleData();
