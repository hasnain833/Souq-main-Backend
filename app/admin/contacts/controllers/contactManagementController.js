const Contact = require('../../../../db/models/contactModel');
const { successResponse, errorResponse } = require('../../../../utils/responseHandler');

// Get all contact messages
exports.getAllContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    };

    // Build query
    let query = {};
    if (search && search.trim() !== '') {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const contacts = await Contact.find(query)
      .sort(options.sort)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit);

    const total = await Contact.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    return successResponse(res, 'Contacts fetched successfully', {
      contacts,
      pagination: {
        currentPage: options.page,
        totalPages,
        totalReports: total,   // renamed from total
        hasNext: options.page < totalPages,
        hasPrev: options.page > 1,
        limit: options.limit
      }
    });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch contacts', 500, error.message);
  }
};
// Delete a contact message
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return errorResponse(res, 'Contact not found', 404);
    }

    return successResponse(res, 'Contact deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete contact', 500, error.message);
  }
};

// Get a single contact message
exports.getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findById(id);

    if (!contact) {
      return errorResponse(res, 'Contact not found', 404);
    }

    return successResponse(res, 'Contact fetched successfully', contact);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch contact', 500, error.message);
  }
};

// Reply to a contact message
exports.replyToContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage, subject } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return errorResponse(res, 'Reply message is required', 400);
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return errorResponse(res, 'Contact not found', 404);
    }

    const { sendMail } = require('../../../../utils/senMail');
    
    // Prepare email content
    const emailSubject = subject || `Re: ${contact.subject}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #14b8a6; margin-bottom: 30px;">Reply from Habibi ماركت Support</h2>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600; font-size: 14px;">From You:</p>
          <p style="margin: 0; color: #6b7280; white-space: pre-wrap; line-height: 1.6;">${contact.message}</p>
        </div>
        
        <div style="background-color: #ecfdf5; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #14b8a6;">
          <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600; font-size: 14px;">From Habibi Market:</p>
          <p style="margin: 0; color: #1f2937; white-space: pre-wrap; line-height: 1.6;">${replyMessage}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Best regards,<br>
          <span style="color: #14b8a6; font-weight: 600;">Habibi ماركت Support Team</span>
        </p>
      </div>
    `;

    // Send email
    await sendMail(contact.email, emailSubject, emailBody);

    // Optionally, update contact with reply info
    contact.repliedAt = new Date();
    contact.repliedBy = req.admin?._id || req.admin?.id;
    await contact.save();

    return successResponse(res, 'Reply sent successfully', { sent: true });
  } catch (error) {
    return errorResponse(res, 'Failed to send reply', 500, error.message);
  }
};