
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
    emailVerifiedAt: user.emailVerifiedAt || null,
    phoneVerifiedAt: user.phoneVerifiedAt || null,
    about: user.about || '',
    country: user.country || null,
    city: user.city || null,
    countryId: user.countryId || null,
    cityId: user.cityId || null,
    followers: Array.isArray(user.followers) ? user.followers.filter(f => !f?.deletedAt).length : 0,
    following: Array.isArray(user.following) ? user.following.filter(f => !f?.deletedAt).length : 0,
    language: user.language || 'en',
    vacationMode: !!user.vacationMode,
    cityShow: user.cityShow ?? true,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    userNameUpdatedAt: user.userNameUpdatedAt || null,
    stripeAccountId: user.stripeAccountId || null,
    paypalEmail: user.paypalEmail || null,

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
    countryId,
    cityId,
    language,
    cityShow,
    vacationMode,
  } = body;

  const [firstName, ...lastParts] = fullName.trim().split(' ');
  const lastName = lastParts.length > 0 ? lastParts.join(' ') : '-';

  let formattedDate = null;
  if (dateOfBirth) {
    // Handle both DD/MM/YYYY format and ISO date strings
    if (typeof dateOfBirth === 'string' && dateOfBirth.includes('/')) {
      const [day, month, year] = dateOfBirth.split('/');
      formattedDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      formattedDate = new Date(dateOfBirth);
    }
  }

  const updateData = {
    firstName,
    lastName,
    updatedAt: new Date(),
  };

  // Only include fields that are provided (not undefined)
  if (gender !== undefined) updateData.gender = gender || null;
  if (dateOfBirth !== undefined) updateData.dateOfBirth = formattedDate;
  if (profile !== undefined) updateData.profile = profile;
  if (userName !== undefined) updateData.userName = userName;
  if (about !== undefined) updateData.about = about || '';
  if (country !== undefined) updateData.country = country || null;
  if (city !== undefined) updateData.city = city || null;
  if (countryId !== undefined) updateData.countryId = countryId || null;
  if (cityId !== undefined) updateData.cityId = cityId || null;
  if (language !== undefined) updateData.language = language;
  if (cityShow !== undefined) updateData.cityShow = cityShow;
  if (vacationMode !== undefined) updateData.vacationMode = vacationMode;

  return updateData;
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
    gender: user.gender || null,
    dateOfBirth: user.dateOfBirth ? moment(user.dateOfBirth).format('DD/MM/YYYY') : null,
    about: user.about || '',
    country: user.country || null,
    city: user.city || null,
    countryId: user.countryId || null,
    cityId: user.cityId || null,
    language: user.language || 'en',
    cityShow: user.cityShow ?? true,
    vacationMode: user.vacationMode || false,
    updatedAt: user.updatedAt,
  },
});

exports.getAnotherUserProfileRes = (user, isFollowingUser = false, ratingsData = null) => {
  return {
    data: {
      id: user._id,
      firstName: user?.firstName || "Unknown",
      lastName: user?.lastName || "",
      userName: user?.userName || "Unknown",
      email: user?.email || "Unknown",
      profile: user?.profile || "/default-avatar.png",
      gender: user?.gender || "Unknown",
      loginWithGoogle: user?.loginWithGoogle ?? false,
      loginWithFacebook: user?.loginWithFacebook ?? false,
      about: user?.about || "Unknown",
      country: user?.country || "Unknown",
      city: user?.city || "Unknown",
      followers: Array.isArray(user?.followers)
        ? user.followers.filter(f => !f.deletedAt).length
        : 0,
      following: Array.isArray(user?.following)
        ? user.following.filter(f => !f.deletedAt).length
        : 0,
      language: user?.language || "Unknown",
      cityShow: user?.cityShow ?? true,
      lastLoginAt: user?.lastLoginAt || null,
      createdAt: user?.createdAt || null,
      isFollowingUser: Boolean(isFollowingUser),
      ratings:
        ratingsData || {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
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
    paypalEmail: user.paypalEmail || null,
    stripeAccountId: user.stripeAccountId || null,
  };
};