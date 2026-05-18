function paginate(req, res, next) {
  if (!req.query.page && !req.query.limit) {
    req.pagination = null;
    return next();
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAGE', message: 'Page must be >= 1' }
    });
  }

  if (limit < 1 || limit > 1000) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_LIMIT', message: 'Limit must be between 1 and 1000' }
    });
  }

  req.pagination = { page, limit, offset };
  next();
}

function paginateResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

module.exports = { paginate, paginateResponse };
