exports.paginateQuery = async ({ model, query = {}, populate = '', select = '', sort = { createdAt: -1 }, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    model.find(query)
      .populate(populate)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit),
    model.countDocuments(query)
  ]);

  return {
    items,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total
  };
};
