
const moment = require('moment');

exports.getProfileResponseDTO = (user, ratingsData = null) => ({
  success: true,
  message: 'Profile fetched successfully',
  data: {
    id: user._id,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    userName: user.userName || null,
    email: user.email || null,
    profile: user.profile || null,
    gender: user.gender || null,
    dateOfBirth: user.dateOfBirth
      ? moment(user.dateOfBirth).format('DD/MM/YYYY')
      : null,
    loginWithGoogle: !!user.loginWithGoogle,
    loginWithFacebook: !!user.loginWithFacebook,
    phone: user.phone || null,
    about: user.about || '',
    country: user.country || null,
    city: user.city || null,
    followers: Array.isArray(user.followers) ? user.followers.filter(f => !f?.deletedAt).length : 0,
    following: Array.isArray(user.following) ? user.following.filter(f => !f?.deletedAt).length : 0,
    language: user.language || 'en',
    vacationMode: !!user.vacationMode,
    cityShow: user.cityShow ?? true,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    userNameUpdatedAt: user.userNameUpdatedAt || null,

    // ⭐️ Include ratings data if available
    ratings: ratingsData || {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    }
  },
});

exports.updateProfileRequestDTO = (body) => {
  const {
    fullName = '',
    gender,
    dateOfBirth,
    profile,
    userName,
    about,
    country,
    city,
    language,
    cityShow,
    vacationMode,
  } = body;

  const [firstName, ...lastParts] = fullName.trim().split(' ');
  const lastName = lastParts.length > 0 ? lastParts.join(' ') : '-';

  let formattedDate = null;
  if (dateOfBirth) {
    const [day, month, year] = dateOfBirth.split('/');
    formattedDate = new Date(Date.UTC(year, month - 1, day));
  }

  return {
    firstName,
    lastName,
    gender,
    dateOfBirth: formattedDate,
    profile,
    userName,
    about,
    country,
    city,
    language,
    cityShow,
    vacationMode,
    updatedAt: new Date(),
  };
};

exports.updateProfileResponseDTO = (user) => ({
  success: true,
  message: 'Profile updated successfully',
  data: {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    profile: user.profile,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    about: user.about,
    country: user.country,
    city: user.city,
    language: user.language,
    cityShow: user.cityShow,
    vacationMode: user.vacationMode,
    updatedAt: user.updatedAt,
  },
});

exports.getAnotherUserProfileRes = (user, isFollowingUser = false, ratingsData = null) => {
  return {
    data: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      profile: user.profile,
      gender: user.gender,
      // dateOfBirth: user.dateOfBirth
      //   ? moment(user.dateOfBirth).format('DD/MM/YYYY')
      //   : null,
      loginWithGoogle: user.loginWithGoogle,
      loginWithFacebook: user.loginWithFacebook,
      // phone: user.phone,
      about: user.about,
      country: user.country,
      city: user.city,
      followers: user.followers.filter(f => !f.deletedAt).length,
      following: user.following.filter(f => !f.deletedAt).length,
      language: user.language,
      // vacationMode: user.vacationMode,
      cityShow: user.cityShow,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      isFollowingUser, // ✅ Add this
      // Add ratings data
      ratings: ratingsData || {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      }
    },
  };
};

exports.UserRes = (user) => {
  // console.log('Mapping user:', user);
  return {
    id: user._id,
    userName: user.userName,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    lastLoginAt: user.lastLoginAt || null,
    profile_photo: user.profile || null,
    city: user.city !== undefined && user.city !== null ? user.city : null,
    country: user.country !== undefined && user.country !== null ? user.country : null,
    cityShow: user.cityShow,
  };
};