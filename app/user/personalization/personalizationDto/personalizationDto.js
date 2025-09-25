exports.createPersonalizationDto = (data) => {
  return {
    followedCategories: data.followedCategories || [],
    followedBrands: data.followedBrands || [],
  };
};
