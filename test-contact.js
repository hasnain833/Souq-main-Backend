const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

// Connect to database
const connectDB = require('./db');
connectDB();

// Import Contact model
const Contact = require('./db/models/contactModel');

// Test function to check contacts
async function testContacts() {
  try {
    console.log('Checking contacts in database...');
    
    // Find all contacts
    const contacts = await Contact.find({});
    console.log(`Found ${contacts.length} contacts:`);
    
    contacts.forEach((contact, index) => {
      console.log(`${index + 1}. Name: ${contact.name}, Email: ${contact.email}, Subject: ${contact.subject}`);
    });
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

testContacts();