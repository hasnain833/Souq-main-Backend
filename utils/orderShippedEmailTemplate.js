// utils/orderShippedEmailTemplate.js

exports.getOrderShippedEmailHTML = (orderData) => {
  const {
    orderNumber,
    buyerName,
    productTitle,
    trackingNumber,
    carrier,
    estimatedDelivery,
    sellerName
  } = orderData;

  return `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your Order Has Been Shipped - SOUQ</title>
  </head>
  <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; color: #333;">
    <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto;">
      <!-- Header -->
      <tr>
        <td style="background-color: #ffffff; padding: 20px 40px; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; color: #0f766e; font-family: Arial, sans-serif;">
            SOUQ
          </span>
        </td>
      </tr>

      <!-- Main Content -->
      <tr>
        <td style="background-color: #ffffff; padding: 30px 40px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">📦 Your Order Has Been Shipped!</h2>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Hi ${buyerName},
          </p>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Great news! Your order has been shipped by ${sellerName} and is on its way to you.
          </p>

          <!-- Order Details Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0f766e; margin-top: 0; margin-bottom: 15px;">Order Details</h3>
            <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 8px 0;"><strong>Product:</strong> ${productTitle}</p>
            <p style="margin: 8px 0;"><strong>Seller:</strong> ${sellerName}</p>
          </div>

          ${trackingNumber ? `
          <!-- Tracking Information Box -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0; margin-bottom: 15px;">📍 Tracking Information</h3>
            <p style="margin: 8px 0;"><strong>Tracking Number:</strong> <span style="font-family: monospace; background-color: #dcfce7; padding: 4px 8px; border-radius: 4px;">${trackingNumber}</span></p>
            ${carrier ? `<p style="margin: 8px 0;"><strong>Carrier:</strong> ${carrier.charAt(0).toUpperCase() + carrier.slice(1)}</p>` : ''}
            ${estimatedDelivery ? `<p style="margin: 8px 0;"><strong>Estimated Delivery:</strong> ${new Date(estimatedDelivery).toLocaleDateString()}</p>` : ''}
          </div>
          ` : ''}

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            ${trackingNumber ? 
              'You can track your package using the tracking number above on the carrier\'s website.' : 
              'The seller will provide tracking information soon, or the item will be delivered directly.'
            }
          </p>

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            Once you receive your order, don't forget to confirm delivery in your SOUQ account to complete the transaction.
          </p>

          <!-- Call to Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/orders" style="background-color: #0f766e; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
              View Order Details
            </a>
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; font-size: 12px; color: #777;">
          <p>SOUQ – The go-to marketplace for buying and selling secondhand fashion.</p>
          <p>Need help? <a href="${process.env.FRONTEND_URL}/help" style="color: #0f766e; text-decoration: none;">Visit our Help Center</a></p>
          <p>&copy; ${new Date().getFullYear()} SOUQ. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};