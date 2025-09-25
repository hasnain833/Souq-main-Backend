const mongoose = require('mongoose');
require('dotenv').config();

async function createShipmentData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ShippingProvider = require('./db/models/shippingProviderModel');
    const Shipment = require('./db/models/shipmentModel');
    const Order = require('./db/models/orderModel');
    const User = require('./db/models/userModel');

    console.log('🔧 Creating shipment data...');

    // First, check if we have shipping providers
    let providers = await ShippingProvider.find();
    console.log(`📦 Found ${providers.length} shipping providers`);

    // Create sample shipping providers if none exist
    if (providers.length === 0) {
      console.log('🚚 Creating sample shipping providers...');
      
      const sampleProviders = [
        {
          name: 'fedex',
          displayName: 'FedEx',
          description: 'Fast and reliable shipping worldwide',
          isActive: true,
          supportedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          supportedServices: [
            {
              serviceCode: 'FEDEX_GROUND',
              serviceName: 'FedEx Ground',
              description: 'Economical ground shipping',
              estimatedDays: '1-5',
              isActive: true
            },
            {
              serviceCode: 'FEDEX_EXPRESS',
              serviceName: 'FedEx Express',
              description: 'Fast express shipping',
              estimatedDays: '1-3',
              isActive: true
            }
          ],
          pricing: {
            baseFee: 9.99,
            currency: 'USD',
            weightMultiplier: 1.5,
            dimensionalWeight: true
          },
          apiConfiguration: {
            endpoint: 'https://api.fedex.com',
            version: 'v1',
            testMode: true
          }
        },
        {
          name: 'ups',
          displayName: 'UPS',
          description: 'United Parcel Service - Reliable delivery',
          isActive: true,
          supportedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          supportedServices: [
            {
              serviceCode: 'UPS_GROUND',
              serviceName: 'UPS Ground',
              description: 'Standard ground shipping',
              estimatedDays: '1-5',
              isActive: true
            },
            {
              serviceCode: 'UPS_EXPRESS',
              serviceName: 'UPS Express',
              description: 'Express shipping service',
              estimatedDays: '1-3',
              isActive: true
            }
          ],
          pricing: {
            baseFee: 8.99,
            currency: 'USD',
            weightMultiplier: 1.4,
            dimensionalWeight: true
          },
          apiConfiguration: {
            endpoint: 'https://api.ups.com',
            version: 'v1',
            testMode: true
          }
        },
        {
          name: 'dhl',
          displayName: 'DHL Express',
          description: 'International express shipping',
          isActive: true,
          supportedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IN', 'AE'],
          supportedServices: [
            {
              serviceCode: 'DHL_EXPRESS',
              serviceName: 'DHL Express Worldwide',
              description: 'Fast international shipping',
              estimatedDays: '1-4',
              isActive: true
            }
          ],
          pricing: {
            baseFee: 15.99,
            currency: 'USD',
            weightMultiplier: 2.0,
            dimensionalWeight: true
          },
          apiConfiguration: {
            endpoint: 'https://api.dhl.com',
            version: 'v1',
            testMode: true
          }
        }
      ];

      for (const providerData of sampleProviders) {
        const provider = new ShippingProvider(providerData);
        await provider.save();
        console.log(`✅ Created provider: ${provider.displayName}`);
      }

      providers = await ShippingProvider.find();
    }

    // Get some orders to create shipments for
    const orders = await Order.find({ status: { $in: ['paid', 'processing', 'delivered'] } }).limit(20);
    console.log(`📋 Found ${orders.length} orders for shipments`);

    if (orders.length === 0) {
      console.log('⚠️  No suitable orders found. Please create some orders first.');
      return;
    }

    // Create sample shipments
    const shipmentStatuses = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception'];
    
    for (let i = 0; i < Math.min(orders.length, 15); i++) {
      const order = orders[i];
      const provider = providers[Math.floor(Math.random() * providers.length)];
      const service = provider.supportedServices[Math.floor(Math.random() * provider.supportedServices.length)];
      const status = shipmentStatuses[Math.floor(Math.random() * shipmentStatuses.length)];
      
      // Check if shipment already exists for this order
      const existingShipment = await Shipment.findOne({ order: order._id });
      if (existingShipment) {
        console.log(`⏭️  Shipment already exists for order ${order.orderNumber}`);
        continue;
      }

      const trackingNumber = `${provider.name.toUpperCase()}${Date.now()}${i}`;
      
      const shipment = new Shipment({
        order: order._id,
        shippingProvider: provider._id,
        providerShipmentId: `${provider.name}_${Date.now()}_${i}`,
        trackingNumber,
        
        shipmentDetails: {
          serviceCode: service.serviceCode,
          serviceName: service.serviceName,
          reference: `REF-${order.orderNumber}`,
          description: 'Package shipment',
          
          packages: [{
            packageId: `PKG-${i + 1}`,
            weight: Math.random() * 5 + 0.5, // 0.5 to 5.5 kg
            dimensions: {
              length: Math.floor(Math.random() * 30) + 10, // 10-40 cm
              width: Math.floor(Math.random() * 20) + 10,  // 10-30 cm
              height: Math.floor(Math.random() * 15) + 5,  // 5-20 cm
              unit: 'cm'
            },
            value: Math.floor(Math.random() * 500) + 50, // $50-550
            currency: 'USD',
            contents: 'General merchandise'
          }],
          
          fromAddress: {
            name: 'Souq Marketplace',
            company: 'Souq Inc.',
            street1: '123 Warehouse St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
            phone: '+1-555-0123'
          },
          
          toAddress: order.shipping?.toAddress || {
            name: 'Customer Name',
            street1: '456 Customer Ave',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
            phone: '+1-555-0456'
          }
        },
        
        tracking: {
          status,
          lastUpdate: new Date(),
          events: [
            {
              timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
              status: 'created',
              description: 'Shipment created',
              location: {
                city: 'New York',
                state: 'NY',
                country: 'US',
                facility: 'Origin facility'
              },
              eventCode: 'CR',
              eventType: 'shipment_created'
            }
          ],
          estimatedDelivery: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000)
        },
        
        costs: {
          shippingCost: Math.floor(Math.random() * 50) + 10, // $10-60
          insurance: Math.floor(Math.random() * 20) + 5,     // $5-25
          currency: 'USD'
        },
        

        
        metadata: {
          source: 'sample_data',
          createdBy: 'system'
        }
      });

      // Add more events for non-created shipments
      if (status !== 'created') {
        const statusFlow = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
        const currentIndex = statusFlow.indexOf(status);

        for (let j = 1; j <= currentIndex; j++) {
          shipment.tracking.events.push({
            timestamp: new Date(Date.now() - (7 - j) * 24 * 60 * 60 * 1000),
            status: statusFlow[j],
            description: `Package ${statusFlow[j].replace('_', ' ')}`,
            location: {
              city: j === 1 ? 'New York' : j === 2 ? 'Chicago' : j === 3 ? 'Los Angeles' : 'Los Angeles',
              state: j === 1 ? 'NY' : j === 2 ? 'IL' : j === 3 ? 'CA' : 'CA',
              country: 'US',
              facility: j === 1 ? 'Pickup location' : j === 2 ? 'Transit hub' : j === 3 ? 'Local facility' : 'Delivery address'
            },
            eventCode: statusFlow[j].substring(0, 2).toUpperCase(),
            eventType: `shipment_${statusFlow[j]}`
          });
        }
      }

      await shipment.save();
      console.log(`✅ Created shipment: ${trackingNumber} (${status}) for order ${order.orderNumber}`);
    }

    console.log('\n🎯 Shipment data creation completed!');
    console.log('📊 You should now see shipment data in the admin shipping page');

  } catch (error) {
    console.error('❌ Error creating shipment data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the script
createShipmentData();
