exports.getResendVerificationEmailHTML = (otp) => {
  return `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Resend Verification Code - SOUQ</title>
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

      <!-- Content -->
      <tr>
        <td style="background-color: #f1f5f9; padding: 30px 40px; text-align: center;">
          <h2 style="color: #0f766e; margin-bottom: 10px;">Here’s your verification code</h2>
          <p style="font-size: 16px; color: #555;">As requested, we’ve re-sent your code. It is valid for 10 minutes.</p>
        </td>
      </tr>

      <!-- OTP -->
      <tr>
        <td style="background-color: #ffffff; padding: 30px 40px; text-align: center;">
          <p style="font-size: 18px; margin-bottom: 10px;">Your verification code is:</p>
          <div style="font-size: 28px; font-weight: bold; background-color: #f0fdf4; color: #166534; padding: 15px 25px; border-radius: 8px; display: inline-block;">
            ${otp}
          </div>
          <p style="margin-top: 20px; font-size: 14px; color: #888;">Please use this code within 10 minutes. If you didn’t request it, ignore this email.</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; font-size: 12px; color: #777;">
          <p>SOUQ – The go-to marketplace for buying and selling secondhand fashion.</p>
          <p>Need help? <a href="https://souq-fashion-staging-web.netlify.app/help" style="color: #0f766e; text-decoration: none;">Visit our Help Center</a></p>
          <p>&copy; ${new Date().getFullYear()} SOUQ. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};
