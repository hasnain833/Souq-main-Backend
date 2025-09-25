# Order Email Troubleshooting Guide

## Issue: Order shipped emails are not being sent

### Problem Description
When updating order status to 'shipped' in the orderController, the email notification to the buyer is not working.

### Root Causes Identified and Fixed

#### 1. Missing Email Field in Database Population
**Problem**: The order update queries were not populating the `email` field from the User model.
**Solution**: Updated all population queries to include the `email` field:

```javascript
// Before (WRONG)
.populate('buyer', 'username profile_picture firstName lastName')

// After (CORRECT)
.populate('buyer', 'userName profile email firstName lastName')
```

#### 2. Inconsistent Field Names
**Problem**: Some queries used `username` while the User model has `userName` (camelCase).
**Solution**: Standardized all field names to match the User model schema.

#### 3. Missing Environment Variables
**Problem**: Email configuration was missing (`EMAIL_USER`, `EMAIL_PASS`).
**Solution**: Created `.env.example` file with proper email configuration template.

### How to Configure Email

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure Gmail for sending emails:**
   - Set `EMAIL_USER` to your Gmail address
   - Set `EMAIL_PASS` to your Gmail App Password (NOT your regular password)
   - Set `DISABLE_EMAIL=false` (or remove this line)

3. **Get Gmail App Password:**
   - Go to Google Account settings
   - Enable 2-Factor Authentication
   - Go to Security > App Passwords  
   - Generate an app password for this application
   - Use that app password in `EMAIL_PASS`

### Testing the Email Functionality

Run the test script to verify email setup:
```bash
node test-order-email.js
```

This will:
- Check email configuration
- Send a test email with mock order data
- Show detailed debugging information
- Provide guidance if email is simulated vs actually sent

### Debugging Steps

1. **Check Email Configuration:**
   ```bash
   node -e "
   require('dotenv').config();
   console.log('EMAIL_USER:', process.env.EMAIL_USER);
   console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
   console.log('DISABLE_EMAIL:', process.env.DISABLE_EMAIL);
   "
   ```

2. **Check Database Population:**
   Look for console logs when updating order status:
   ```
   📧 Updated order data: {
     buyerEmail: 'buyer@example.com',  // Should not be null/undefined
     buyerFirstName: 'John',
     productTitle: 'Product Name'
   }
   ```

3. **Check Email Service Logs:**
   The email service now provides detailed logging:
   ```
   📧 Attempting to send email to: buyer@example.com
   📧 Email service status check:
      - isEmailDisabled: false
      - transporter exists: true
   ✅ Email sent successfully: <message-id>
   ```

### Common Issues and Solutions

#### Issue: "Cannot send email: Buyer or buyer email is missing"
**Cause**: Database population is not including the email field
**Solution**: Verify the populate query includes 'email' field

#### Issue: "Email sending is disabled - simulating email send"  
**Cause**: Environment variables not set or DISABLE_EMAIL=true
**Solution**: Configure .env file with proper email credentials

#### Issue: "Email authentication failed"
**Cause**: Using regular Gmail password instead of App Password
**Solution**: Generate and use Gmail App Password

#### Issue: "Email connection failed"
**Cause**: Network issues or Gmail service unavailable
**Solution**: Check internet connection and try again

### Code Changes Made

1. **Fixed population queries in orderController.js:**
   - Added `email` field to all buyer/seller population queries
   - Fixed field name inconsistencies (`username` → `userName`)

2. **Enhanced error handling:**
   - Added detailed logging for email data validation
   - Added checks for missing buyer email before attempting to send
   - Added clear indication when email is simulated vs actually sent

3. **Created configuration templates:**
   - `.env.example` with all required environment variables
   - Test script for validating email functionality

### Verification

After making these changes:

1. Update an order status to 'shipped'
2. Check console logs for detailed email debugging information
3. Verify email is sent to buyer (or simulated if not configured)
4. Check buyer's email inbox for the shipped notification

The email will include:
- Order number and product details
- Tracking information (if provided)
- Carrier/provider information
- Estimated delivery date
- Link to view order details in the frontend

### Environment Variables Required

```bash
# Required for email functionality
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
DISABLE_EMAIL=false

# Optional - for email template links
FRONTEND_URL=http://localhost:3000
```

### Next Steps

1. Configure your email credentials in `.env`
2. Test with the provided test script
3. Update an actual order to 'shipped' status
4. Verify the buyer receives the email notification