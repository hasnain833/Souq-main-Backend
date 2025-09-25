// utils/searchQueryBuilder.js
exports.buildSearchQuery = (q) => {
  if (!q || q.trim() === '') return {};

  const keywords = q.trim().split(/\s+/); // split by space

  const regexQueries = keywords.map((word) => {
    const regex = new RegExp(word, 'i'); // case-insensitive partial match
    return {
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { brand: { $regex: regex } }
      ]
    };
  });

  return { $and: regexQueries };
};
