// controllers/suggestionController.js
const User = require('../../../../db/models/userModel');
const Product = require('../../../../db/models/productModel');
const { buildSearchQuery } = require('../../../../utils/searchQueryBuilder');

const CDN_BASE_URL = process.env.BASE_URL 

const getSuggestions = async (req, res) => {
  try {
    const { q, type } = req.query;
                                                                                  
    if (!q || !type) {
      return res.status(400).json({ message: 'Missing query (q) or type parameter' });
    }

    // ===================== MEMBER SUGGESTIONS =====================
    if (type === 'member') {
      const searchQuery = q.trim();
      if (!searchQuery) {
        return res.json([]);
      }
      
      const keywords = searchQuery.split(/\s+/).filter(word => word.length > 0);
      
      // Build search query for user names - use simple regex for partial matching
      const searchConditions = [];
      
      if (keywords.length === 1) {
        // Single word: search in firstName, lastName, userName (partial match)
        const regex = new RegExp(keywords[0], 'i');
        searchConditions.push(
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
          { userName: { $regex: regex } }
        );
      } else {
        // Multiple words: search for combinations
        // For "John Doe", match firstName contains "John" AND lastName contains "Doe" (or vice versa)
        const firstNameRegex = new RegExp(keywords[0], 'i');
        const lastNameRegex = new RegExp(keywords[keywords.length - 1], 'i');
        
        // Match first word in firstName and last word in lastName
        searchConditions.push({
          $and: [
            { firstName: { $regex: firstNameRegex } },
            { lastName: { $regex: lastNameRegex } }
          ]
        });
        
        // Also try reverse (first word in lastName, last word in firstName)
        searchConditions.push({
          $and: [
            { firstName: { $regex: lastNameRegex } },
            { lastName: { $regex: firstNameRegex } }
          ]
        });
        
        // Also search each word individually in any name field
        keywords.forEach(keyword => {
          const wordRegex = new RegExp(keyword, 'i');
          searchConditions.push(
            { firstName: { $regex: wordRegex } },
            { lastName: { $regex: wordRegex } },
            { userName: { $regex: wordRegex } }
          );
        });
      }

      const users = await User.find({
        $or: searchConditions,
        deletedAt: null
      })
        .limit(50)
        .select('id firstName lastName userName profile');

      const results = users.map(user => ({
        id: user._id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userName: user.userName,
        profile: user.profile ? user.profile : null
      }));
      
      // Remove duplicates based on id
      const uniqueResults = results.filter((user, index, self) =>
        index === self.findIndex(u => u.id.toString() === user.id.toString())
      );

      return res.json(uniqueResults);
    }

    // ===================== CATALOG SUGGESTIONS =====================
    if (type === 'catalog') {
      const searchQuery = buildSearchQuery(q);

      const products = await Product.find({
        ...searchQuery,
        hide: false,
        status: 'active'
      })
        .limit(10)
        .select('id title product_photos');

      const results = products.map(product => ({
        id: product.id,
        title: product.title,
        image: product.product_photos?.[0]
          ? `${CDN_BASE_URL}${product.product_photos[0]}`
          : null
      }));

      return res.json(results);
    }

    return res.status(400).json({ message: 'Invalid type. Use "member" or "catalog".' });

  } catch (err) {
    console.error('Suggestion error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getSuggestions };
