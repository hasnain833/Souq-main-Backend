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
      const regex = new RegExp(q, 'i');

      const users = await User.find({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { userName: regex }
        ],
        deletedAt: null
      })
        .limit(10)
        .select('id firstName lastName userName profile');

      const results = users.map(user => ({
        id: user._id,
        fullName: `${user.firstName} ${user.lastName}`,
        userName: user.userName,
        profile: user.profile ? user.profile : null
      }));

      return res.json(results);
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
