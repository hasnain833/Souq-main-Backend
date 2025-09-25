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