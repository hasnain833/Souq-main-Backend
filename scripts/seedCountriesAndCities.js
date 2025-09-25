const mongoose = require('mongoose');
require('dotenv').config();

const Country = require('../db/models/countryModel');
const City = require('../db/models/cityModel');

// Sample country data with major countries
const countriesData = [
  {
    name: 'United States',
    code: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    currency: { code: 'USD', name: 'US Dollar', symbol: '$' },
    sortOrder: 1
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    dialCode: '+44',
    flag: '🇬🇧',
    currency: { code: 'GBP', name: 'British Pound', symbol: '£' },
    sortOrder: 2
  },
  {
    name: 'Canada',
    code: 'CA',
    dialCode: '+1',
    flag: '🇨🇦',
    currency: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    sortOrder: 3
  },
  {
    name: 'Australia',
    code: 'AU',
    dialCode: '+61',
    flag: '🇦🇺',
    currency: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    sortOrder: 4
  },
  {
    name: 'Germany',
    code: 'DE',
    dialCode: '+49',
    flag: '🇩🇪',
    currency: { code: 'EUR', name: 'Euro', symbol: '€' },
    sortOrder: 5
  },
  {
    name: 'France',
    code: 'FR',
    dialCode: '+33',
    flag: '🇫🇷',
    currency: { code: 'EUR', name: 'Euro', symbol: '€' },
    sortOrder: 6
  },
  {
    name: 'India',
    code: 'IN',
    dialCode: '+91',
    flag: '🇮🇳',
    currency: { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    sortOrder: 7
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    dialCode: '+971',
    flag: '🇦🇪',
    currency: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    sortOrder: 8
  },
  {
    name: 'Japan',
    code: 'JP',
    dialCode: '+81',
    flag: '🇯🇵',
    currency: { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    sortOrder: 9
  },
  {
    name: 'China',
    code: 'CN',
    dialCode: '+86',
    flag: '🇨🇳',
    currency: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    sortOrder: 10
  }
];

// Sample cities data for each country
const citiesData = {
  'US': [
    { name: 'New York', state: 'New York', isCapital: false, population: 8336817 },
    { name: 'Los Angeles', state: 'California', isCapital: false, population: 3979576 },
    { name: 'Chicago', state: 'Illinois', isCapital: false, population: 2693976 },
    { name: 'Houston', state: 'Texas', isCapital: false, population: 2320268 },
    { name: 'Washington', state: 'District of Columbia', isCapital: true, population: 705749 }
  ],
  'GB': [
    { name: 'London', state: 'England', isCapital: true, population: 9648110 },
    { name: 'Birmingham', state: 'England', isCapital: false, population: 1141816 },
    { name: 'Manchester', state: 'England', isCapital: false, population: 547899 },
    { name: 'Glasgow', state: 'Scotland', isCapital: false, population: 635640 },
    { name: 'Edinburgh', state: 'Scotland', isCapital: false, population: 518500 }
  ],
  'CA': [
    { name: 'Toronto', state: 'Ontario', isCapital: false, population: 2930000 },
    { name: 'Montreal', state: 'Quebec', isCapital: false, population: 1780000 },
    { name: 'Vancouver', state: 'British Columbia', isCapital: false, population: 675218 },
    { name: 'Ottawa', state: 'Ontario', isCapital: true, population: 994837 },
    { name: 'Calgary', state: 'Alberta', isCapital: false, population: 1336000 }
  ],
  'AU': [
    { name: 'Sydney', state: 'New South Wales', isCapital: false, population: 5312163 },
    { name: 'Melbourne', state: 'Victoria', isCapital: false, population: 5078193 },
    { name: 'Brisbane', state: 'Queensland', isCapital: false, population: 2560720 },
    { name: 'Perth', state: 'Western Australia', isCapital: false, population: 2125114 },
    { name: 'Canberra', state: 'Australian Capital Territory', isCapital: true, population: 431380 }
  ],
  'DE': [
    { name: 'Berlin', state: 'Berlin', isCapital: true, population: 3669491 },
    { name: 'Hamburg', state: 'Hamburg', isCapital: false, population: 1899160 },
    { name: 'Munich', state: 'Bavaria', isCapital: false, population: 1484226 },
    { name: 'Cologne', state: 'North Rhine-Westphalia', isCapital: false, population: 1085664 },
    { name: 'Frankfurt', state: 'Hesse', isCapital: false, population: 753056 }
  ],
  'FR': [
    { name: 'Paris', state: 'Île-de-France', isCapital: true, population: 2161000 },
    { name: 'Marseille', state: 'Provence-Alpes-Côte d\'Azur', isCapital: false, population: 861635 },
    { name: 'Lyon', state: 'Auvergne-Rhône-Alpes', isCapital: false, population: 513275 },
    { name: 'Toulouse', state: 'Occitanie', isCapital: false, population: 479553 },
    { name: 'Nice', state: 'Provence-Alpes-Côte d\'Azur', isCapital: false, population: 342637 }
  ],
  'IN': [
    { name: 'Mumbai', state: 'Maharashtra', isCapital: false, population: 12442373 },
    { name: 'Delhi', state: 'Delhi', isCapital: false, population: 11007835 },
    { name: 'Bangalore', state: 'Karnataka', isCapital: false, population: 8443675 },
    { name: 'Hyderabad', state: 'Telangana', isCapital: false, population: 6809970 },
    { name: 'New Delhi', state: 'Delhi', isCapital: true, population: 249998 }
  ],
  'AE': [
    { name: 'Dubai', state: 'Dubai', isCapital: false, population: 3331420 },
    { name: 'Abu Dhabi', state: 'Abu Dhabi', isCapital: true, population: 1482816 },
    { name: 'Sharjah', state: 'Sharjah', isCapital: false, population: 1274749 },
    { name: 'Al Ain', state: 'Abu Dhabi', isCapital: false, population: 766936 },
    { name: 'Ajman', state: 'Ajman', isCapital: false, population: 504846 }
  ],
  'JP': [
    { name: 'Tokyo', state: 'Tokyo', isCapital: true, population: 13960000 },
    { name: 'Yokohama', state: 'Kanagawa', isCapital: false, population: 3726167 },
    { name: 'Osaka', state: 'Osaka', isCapital: false, population: 2691185 },
    { name: 'Nagoya', state: 'Aichi', isCapital: false, population: 2295638 },
    { name: 'Sapporo', state: 'Hokkaido', isCapital: false, population: 1952356 }
  ],
  'CN': [
    { name: 'Shanghai', state: 'Shanghai', isCapital: false, population: 24870895 },
    { name: 'Beijing', state: 'Beijing', isCapital: true, population: 21893095 },
    { name: 'Shenzhen', state: 'Guangdong', isCapital: false, population: 12356820 },
    { name: 'Guangzhou', state: 'Guangdong', isCapital: false, population: 11346000 },
    { name: 'Chengdu', state: 'Sichuan', isCapital: false, population: 10152632 }
  ]
};

async function seedCountriesAndCities() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📍 Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing countries and cities...');
    await City.deleteMany({});
    await Country.deleteMany({});

    // Insert countries
    console.log('🌍 Inserting countries...');
    const insertedCountries = await Country.insertMany(countriesData);
    console.log(`✅ Inserted ${insertedCountries.length} countries`);

    // Insert cities
    console.log('🏙️ Inserting cities...');
    let totalCities = 0;

    for (const country of insertedCountries) {
      const countryCode = country.code;
      const cities = citiesData[countryCode];

      if (cities && cities.length > 0) {
        const cityDocuments = cities.map(city => ({
          ...city,
          country: country._id,
          countryCode: countryCode
        }));

        await City.insertMany(cityDocuments);
        totalCities += cityDocuments.length;
        console.log(`✅ Inserted ${cityDocuments.length} cities for ${country.name}`);
      }
    }

    console.log(`🎉 Successfully seeded ${insertedCountries.length} countries and ${totalCities} cities`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📍 Disconnected from MongoDB');
  }
}

// Run the seeding function
if (require.main === module) {
  seedCountriesAndCities();
}

module.exports = { seedCountriesAndCities };
