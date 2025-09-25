const Product = require('../../../../db/models/productModel');
const Category = require('../../../../db/models/categoryModel');

// Generate XML sitemap
exports.generateSitemap = async (req, res) => {
  try {
    console.log('🔍 Generating sitemap...');
    
    // Get base URL from environment or request
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    
    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/about', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact', priority: '0.8', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.5', changefreq: 'yearly' },
      { url: '/terms', priority: '0.5', changefreq: 'yearly' }
    ];

    // Get active products (limit to recent 1000 for performance)
    const products = await Product.find({ 
      isActive: true,
      isHidden: false 
    })
    .select('_id title updatedAt')
    .sort({ updatedAt: -1 })
    .limit(1000);

    // Get active categories
    const categories = await Category.find({ isActive: true })
    .select('_id name updatedAt');

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    staticPages.forEach(page => {
      sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // Add product pages
    products.forEach(product => {
      const lastmod = product.updatedAt ? product.updatedAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      sitemap += `
  <url>
    <loc>${baseUrl}/product-details/${product._id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Add category pages (if you have category listing pages)
    categories.forEach(category => {
      const lastmod = category.updatedAt ? category.updatedAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      sitemap += `
  <url>
    <loc>${baseUrl}/category/${category._id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    console.log(`✅ Generated sitemap with ${staticPages.length + products.length + categories.length} URLs`);

    // Set proper headers
    res.set({
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });

    res.send(sitemap);

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${req.protocol}://${req.get('host')}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  }
};

// Generate robots.txt
exports.generateRobotsTxt = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    
    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Disallow admin and private areas
Disallow: /admin/
Disallow: /api/
Disallow: /settings/
Disallow: /profile/edit/
Disallow: /checkout/
Disallow: /payment/

# Allow product and category pages
Allow: /product-details/
Allow: /category/
Allow: /profile/

# Crawl delay (optional)
Crawl-delay: 1`;

    res.set({
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });

    res.send(robotsTxt);

  } catch (error) {
    console.error('❌ Error generating robots.txt:', error);
    res.status(500).send('User-agent: *\nAllow: /');
  }
};
