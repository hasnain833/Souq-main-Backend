const Contact = require('../../../../db/models/contactModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Create a new contact message
exports.createContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return errorResponse(res, 'All fields are required', 400);
    }

    // Create new contact message
    const contact = new Contact({
      name,
      email,
      subject,
      message
    });

    // Save to database
    const savedContact = await contact.save();

    return successResponse(res, 'Message sent successfully', savedContact, 201);
  } catch (error) {
    return errorResponse(res, 'Failed to send message', 500, error.message);
  }
};