// utils/orderDeliveredEmailTemplate.js

/**
 * Generate HTML template for buyer delivery confirmation email (Thank you email)
 */
exports.getBuyerDeliveryConfirmationEmailHTML = (orderData) => {
  const {
    orderNumber,
    buyerName,
    productTitle,
    sellerName,
    deliveryDate,
    rating,
    feedback
  } = orderData;

  return `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Thank You for Your Order - SOUQ</title>
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
          <h2 style="color: #0f766e; margin-bottom: 20px;">🎉 Thank You for Confirming Your Delivery!</h2>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Hi ${buyerName},
          </p>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Thank you for confirming that you received your order! We hope you're happy with your purchase.
          </p>

          <!-- Order Details Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0f766e; margin-top: 0; margin-bottom: 15px;">Order Summary</h3>
            <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 8px 0;"><strong>Product:</strong> ${productTitle}</p>
            <p style="margin: 8px 0;"><strong>Seller:</strong> ${sellerName}</p>
            <p style="margin: 8px 0;"><strong>Delivery Confirmed:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>
          </div>

          ${rating ? `
          <!-- Rating Box -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0; margin-bottom: 15px;">⭐ Your Review</h3>
            <p style="margin: 8px 0;"><strong>Rating:</strong> ${'⭐'.repeat(rating)} (${rating}/5)</p>
            ${feedback ? `<p style="margin: 8px 0;"><strong>Feedback:</strong> "${feedback}"</p>` : ''}
            <p style="margin: 8px 0; font-size: 14px; color: #92400e;">Thank you for taking the time to rate this transaction!</p>
          </div>
          ` : ''}

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            Your feedback helps improve our marketplace and assists other buyers in making informed decisions.
          </p>

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            We hope you'll continue shopping with SOUQ for all your fashion needs!
          </p>

          <!-- Call to Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/" style="background-color: #0f766e; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin: 0 10px;">
              Shop More
            </a>
            <a href="${process.env.FRONTEND_URL}/orders" style="background-color: #6b7280; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin: 0 10px;">
              View Orders
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

/**
 * Generate HTML template for seller delivery notification email
 */
exports.getSellerDeliveryNotificationEmailHTML = (orderData) => {
  const {
    orderNumber,
    buyerName,
    productTitle,
    sellerName,
    deliveryDate,
    rating,
    feedback,
    orderValue
  } = orderData;

  return `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Order Delivered Successfully - SOUQ</title>
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
          <h2 style="color: #0f766e; margin-bottom: 20px;">✅ Order Successfully Delivered!</h2>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Hi ${sellerName},
          </p>
          
          <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
            Great news! Your buyer has confirmed delivery of their order. The transaction is now complete.
          </p>

          <!-- Order Details Box -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0; margin-bottom: 15px;">📦 Delivery Confirmed</h3>
            <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 8px 0;"><strong>Product:</strong> ${productTitle}</p>
            <p style="margin: 8px 0;"><strong>Buyer:</strong> ${buyerName}</p>
            <p style="margin: 8px 0;"><strong>Delivery Confirmed:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>
            ${orderValue ? `<p style="margin: 8px 0;"><strong>Order Value:</strong> $${orderValue}</p>` : ''}
          </div>

          ${rating ? `
          <!-- Rating Box -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #92400e; margin-top: 0; margin-bottom: 15px;">⭐ Buyer's Review</h3>
            <p style="margin: 8px 0;"><strong>Rating:</strong> ${'⭐'.repeat(rating)} (${rating}/5)</p>
            ${feedback ? `<p style="margin: 8px 0;"><strong>Feedback:</strong> "${feedback}"</p>` : ''}
            <p style="margin: 8px 0; font-size: 14px; color: #92400e;">This rating helps build your seller reputation!</p>
          </div>
          ` : ''}

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            🎉 <strong>Congratulations!</strong> You've successfully completed another sale on SOUQ. Keep up the great work!
          </p>

          <p style="font-size: 16px; color: #555; margin: 20px 0;">
            Your earnings from this transaction will be processed according to your payout settings.
          </p>

          <!-- Call to Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/seller/dashboard" style="background-color: #0f766e; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin: 0 10px;">
              Seller Dashboard
            </a>
            <a href="${process.env.FRONTEND_URL}/orders" style="background-color: #6b7280; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin: 0 10px;">
              View All Orders
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