const successResponse = (res, message, data = null, code = 200) => {
    return res.status(code).json({
        success: true,
        message,
        data
    });
};


const errorResponse = (res, message = 'Something went wrong', statusCode = 500, error = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};

module.exports = {
    successResponse,
    errorResponse
};