# UAE Shipping & Tracking System API Documentation

## Overview

This document describes the comprehensive shipping and tracking system implemented for UAE-based e-commerce operations, with integration to AfterShip platform for enhanced tracking capabilities.

## Features

- ✅ **UAE Shipping Providers**: Support for 8 major UAE shipping providers
- ✅ **Order Tracking**: Complete order lifecycle tracking from shipped to delivered
- ✅ **AfterShip Integration**: Automatic tracking URL generation and webhook support
- ✅ **Multi-Order Support**: Works with Transaction, StandardPayment, and Order collections
- ✅ **Real-time Updates**: Webhook support for automatic status updates
- ✅ **Delivery Confirmation**: Buyer confirmation with rating system

## Supported Shipping Providers

| Provider | Code | Contact | Website |
|----------|------|---------|---------|
| Emirates Post | `emirates_post` | +971-600-599-999 | https://www.epg.gov.ae |
| Aramex | `aramex` | +971-600-544-000 | https://www.aramex.com |
| DHL Express | `dhl` | +971-800-4004 | https://www.dhl.com/ae-en |
| FedEx | `fedex` | +971-800-4050 | https://www.fedex.com/ae |
| UPS | `ups` | +971-800-877 | https://www.ups.com/ae |
| SMSA Express | `smsa` | +971-800-7672 | https://www.smsaexpress.com |
| Naqel Express | `naqel` | +971-800-62735 | https://www.naqelexpress.com |
| Zajil Express | `zajil` | +971-800-92445 | https://www.zajil.com |

## API Endpoints

### 1. Mark Order as Shipped

**Endpoint:** `POST /api/user/tracking/orders/:orderId/ship`

**Description:** Seller marks an order as shipped and creates tracking record.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "trackingId": "ARX12345678ABCD",
  "shippingProvider": "aramex",
  "trackingUrl": "https://www.aramex.com/track/results?ShipmentNumber=ARX12345678ABCD",
  "estimatedDelivery": "2025-08-30T12:00:00Z",
  "serviceType": "express",
  "packageDetails": {
    "weight": 2.5,
    "dimensions": {
      "length": 30,
      "width": 20,
      "height": 10,
      "unit": "cm"
    },
    "description": "Electronics item",
    "value": 150,
    "currency": "AED"
  },
  "sellerNotes": "Handle with care",
  "shippingInstructions": "Call before delivery"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order marked as shipped successfully",
  "data": {
    "tracking": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "orderId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "orderType": "transaction",
      "transactionId": "TXN_1756209973799_ABC123",
      "trackingId": "ARX12345678ABCD",
      "trackingUrl": "https://www.aramex.com/track/results?ShipmentNumber=ARX12345678ABCD",
      "status": "shipped",
      "shippingProvider": {
        "name": "aramex",
        "serviceType": "express",
        "website": "https://www.aramex.com",
        "contactNumber": "+971-600-544-000"
      },
      "aftershipTracking": {
        "slug": "aramex",
        "trackingNumber": "ARX12345678ABCD",
        "trackingUrl": "https://track.aftership.com/aramex/ARX12345678ABCD",
        "isActive": true
      }
    },
    "aftershipUrl": "https://track.aftership.com/aramex/ARX12345678ABCD"
  }
}
```

### 2. Get Order Tracking

**Endpoint:** `GET /api/user/tracking/orders/:orderId/tracking`

**Description:** Get tracking information for a specific order.

**Response:**
```json
{
  "success": true,
  "data": {
    "tracking": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "trackingId": "ARX12345678ABCD",
      "status": "in_transit",
      "shippingProvider": {
        "name": "aramex",
        "website": "https://www.aramex.com"
      },
      "trackingEvents": [
        {
          "timestamp": "2025-08-26T10:00:00Z",
          "status": "shipped",
          "description": "Package shipped by seller",
          "source": "manual"
        },
        {
          "timestamp": "2025-08-26T14:30:00Z",
          "status": "in_transit",
          "description": "Package in transit to destination",
          "location": {
            "city": "Dubai",
            "country": "UAE"
          },
          "source": "api_sync"
        }
      ]
    },
    "trackingUrl": "https://www.aramex.com/track/results?ShipmentNumber=ARX12345678ABCD",
    "aftershipUrl": "https://track.aftership.com/aramex/ARX12345678ABCD"
  }
}
```

### 3. Get User Shipments

**Endpoint:** `GET /api/user/tracking/shipments`

**Description:** Get all shipments for a user (buyer or seller).

**Query Parameters:**
- `role`: `buyer` | `seller` | `both` (default: `buyer`)
- `status`: `shipped` | `in_transit` | `delivered` | etc.
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "shipments": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "trackingId": "ARX12345678ABCD",
        "status": "in_transit",
        "buyer": {
          "userName": "john_doe",
          "profile": {
            "firstName": "John",
            "lastName": "Doe"
          }
        },
        "seller": {
          "userName": "tech_seller",
          "profile": {
            "firstName": "Tech",
            "lastName": "Store"
          }
        },
        "product": {
          "title": "iPhone 13 Pro",
          "price": 3500,
          "product_photos": ["photo1.jpg"]
        },
        "shippingProvider": {
          "name": "aramex"
        },
        "createdAt": "2025-08-26T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalShipments": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 4. Confirm Delivery

**Endpoint:** `POST /api/user/tracking/tracking/:trackingId/confirm-delivery`

**Description:** Buyer confirms delivery and optionally rates the service.

**Request Body:**
```json
{
  "rating": 5,
  "feedback": "Excellent delivery service, package arrived on time",
  "deliveryProof": "https://example.com/delivery-photo.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery confirmed successfully",
  "data": {
    "tracking": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "status": "delivered",
      "deliveryConfirmation": {
        "isDelivered": true,
        "deliveredAt": "2025-08-28T15:30:00Z",
        "confirmedBy": "buyer",
        "confirmationDate": "2025-08-28T15:30:00Z"
      }
    }
  }
}
```

### 5. Get Shipping Providers

**Endpoint:** `GET /api/user/tracking/providers`

**Description:** Get list of all available shipping providers.

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "code": "aramex",
        "name": "Aramex",
        "trackingUrl": "https://www.aramex.com/track/results",
        "website": "https://www.aramex.com",
        "contact": "+971-600-544-000"
      }
    ]
  }
}
```

### 6. Get Shipping Options

**Endpoint:** `POST /api/user/tracking/shipping-options`

**Description:** Get available shipping options for a destination.

**Request Body:**
```json
{
  "destination": {
    "country": "UAE",
    "city": "Dubai"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "options": [
      {
        "provider": "emirates_post",
        "name": "Emirates Post Standard",
        "estimatedDays": 3,
        "cost": 15,
        "currency": "AED"
      },
      {
        "provider": "aramex",
        "name": "Aramex Express",
        "estimatedDays": 2,
        "cost": 25,
        "currency": "AED"
      }
    ],
    "destination": {
      "country": "UAE",
      "city": "Dubai"
    }
  }
}
```

### 7. Update Tracking Status

**Endpoint:** `PUT /api/user/tracking/tracking/:trackingId/status`

**Description:** Update tracking status (for webhooks or manual updates).

**Request Body:**
```json
{
  "status": "out_for_delivery",
  "description": "Package is out for delivery",
  "location": {
    "city": "Dubai",
    "state": "Dubai",
    "country": "UAE"
  },
  "eventCode": "OFD",
  "source": "webhook"
}
```

### 8. Sync Tracking with Provider

**Endpoint:** `POST /api/user/tracking/tracking/:trackingId/sync`

**Description:** Manually sync tracking information with shipping provider.

**Response:**
```json
{
  "success": true,
  "message": "Tracking synced successfully",
  "data": {
    "tracking": {
      "trackingEvents": [
        // Updated events from provider
      ]
    },
    "providerData": {
      "status": "in_transit",
      "events": [
        // Raw provider data
      ]
    }
  }
}
```

## Webhook Endpoints

### AfterShip Webhook

**Endpoint:** `POST /api/webhooks/tracking/aftership`

**Description:** Receives tracking updates from AfterShip.

**Headers:**
```
aftership-hmac-sha256: <signature>
Content-Type: application/json
```

### Provider Webhooks

**Endpoint:** `POST /api/webhooks/tracking/provider/:provider`

**Description:** Receives tracking updates from shipping providers.

## Database Schema

### Tracking Model

```javascript
{
  orderId: ObjectId,           // Reference to order
  orderType: String,           // 'transaction' | 'standardPayment' | 'order'
  transactionId: String,       // Transaction ID for reference
  buyer: ObjectId,             // Buyer user ID
  seller: ObjectId,            // Seller user ID
  product: ObjectId,           // Product ID
  
  shippingProvider: {
    name: String,              // Provider code
    serviceType: String,       // Service type
    website: String,           // Provider website
    contactNumber: String      // Contact number
  },
  
  trackingId: String,          // Tracking number
  trackingUrl: String,         // Provider tracking URL
  
  aftershipTracking: {
    slug: String,              // AfterShip courier slug
    trackingNumber: String,    // Tracking number
    aftershipId: String,       // AfterShip tracking ID
    trackingUrl: String,       // AfterShip tracking URL
    isActive: Boolean          // Whether AfterShip tracking is active
  },
  
  status: String,              // Current status
  trackingEvents: [{
    timestamp: Date,
    status: String,
    description: String,
    location: Object,
    eventCode: String,
    source: String             // 'manual' | 'webhook' | 'api_sync' | 'aftership'
  }],
  
  deliveryConfirmation: {
    isDelivered: Boolean,
    deliveredAt: Date,
    confirmedBy: String,
    confirmationDate: Date
  }
}
```

## Integration Guide

### Frontend Integration

1. **Mark as Shipped Button**: Add to seller's order management page
2. **Tracking Display**: Show tracking information on order details page
3. **Delivery Confirmation**: Add confirmation button for buyers
4. **AfterShip Widget**: Embed AfterShip tracking widget for enhanced UX

### Example Frontend Code

```javascript
// Mark order as shipped
const markAsShipped = async (orderId, trackingData) => {
  const response = await fetch(`/api/user/tracking/orders/${orderId}/ship`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(trackingData)
  });
  
  return response.json();
};

// Get tracking information
const getTracking = async (orderId) => {
  const response = await fetch(`/api/user/tracking/orders/${orderId}/tracking`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

## Environment Variables

Add these to your `.env` file:

```env
# AfterShip Configuration
AFTERSHIP_API_KEY=your_aftership_api_key
AFTERSHIP_WEBHOOK_SECRET=your_webhook_secret

# Shipping Provider API Keys (if available)
ARAMEX_API_KEY=your_aramex_api_key
DHL_API_KEY=your_dhl_api_key
FEDEX_API_KEY=your_fedex_api_key
```

## Testing

Run the test script to verify the system:

```bash
cd backend
node test-tracking-system.js
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

Common error codes:
- `400`: Bad Request (missing required fields, invalid data)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (access denied)
- `404`: Not Found (order/tracking not found)
- `500`: Internal Server Error

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own orders/shipments
3. **Webhook Validation**: AfterShip webhooks are validated using HMAC signature
4. **Input Validation**: All inputs are validated and sanitized
5. **Rate Limiting**: Consider implementing rate limiting for API endpoints

## Future Enhancements

1. **Real Provider APIs**: Integrate with actual shipping provider APIs
2. **SMS Notifications**: Send SMS updates to buyers
3. **Delivery Scheduling**: Allow buyers to schedule delivery times
4. **Return Tracking**: Handle return shipments
5. **Bulk Shipping**: Support for bulk order shipping
6. **Analytics**: Shipping performance analytics and reporting