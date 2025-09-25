// utils/emailTemplates.js

exports.getForgotPasswordEmailHTML = (resetLink) => {
  return `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Password Reset - SOUQ</title>
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
        <td style="background-color: #ffffff; padding: 30px 40px;">
          <h2 style="color: #0f766e;">Reset Your Password</h2>
          <p style="font-size: 16px; color: #555;">
            We received a request to reset your SOUQ account password. Click the button below to proceed.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #0f766e; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 14px; color: #888; margin-top: 20px;">
            This link will expire in 15 minutes. If you didn’t request this, you can safely ignore this email.
          </p>
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
