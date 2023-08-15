require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./db'); 

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Define routes and logic in separate functions
app.post('/identify', identifyContact);

// Core logic to identify related contacts
async function identifyContact(req, res) {
  try {
    const { email, phoneNumber } = req.body;

    let primaryContactId = null;
    let emails = [];
    let phoneNumbers = [];
    let secondaryContactIds = [];
    
    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phone number is required.' });
    }

    // Retrieve the primary records corresponding to the request email and phoneNumber
    const emailPrimaryContact = email ? await findPrimaryContact('email', email) : null;
    const phonePrimaryContact = phoneNumber ? await findPrimaryContact('phoneNumber', phoneNumber) : null;
  
    const isOneNull = (!email !== !phoneNumber);
    const isNewContact = !emailPrimaryContact && !phonePrimaryContact;
    const isSecondaryContact = !emailPrimaryContact || !phonePrimaryContact;

    if (isOneNull) { // Check if exactly one of the request fields is NULL
      primaryContactId = emailPrimaryContact ? emailPrimaryContact.id : phonePrimaryContact ? 
        phonePrimaryContact.id : null;
    } else if (isNewContact) { // Check if a new primary contact has to be created
      primaryContactId = await createNewContact(email, phoneNumber, null, 'primary');
    } else if (isSecondaryContact) { // Check if a new secondary contact has to be created
      primaryContactId = emailPrimaryContact ? emailPrimaryContact.id : phonePrimaryContact.id;
      await createNewContact(email, phoneNumber, primaryContactId, 'secondary');
    } else if (emailPrimaryContact.id !== phonePrimaryContact.id) { // Check if a primary has to be turned to secondary
      primaryContactId = await updateContacts(emailPrimaryContact, phonePrimaryContact);
    } else {
      primaryContactId = emailPrimaryContact.id;
    }
  
    if(primaryContactId) { // Retrieve the contacts related to the primaryContactId 
      const relatedContacts = await findRelatedContacts(primaryContactId);
      emails = [...new Set(relatedContacts.map(item => item.email))];
      phoneNumbers = [...new Set(relatedContacts.map(item => item.phoneNumber))];
      secondaryContactIds = relatedContacts.filter(item => item.id !== primaryContactId).map(item => item.id);
    }

    const response = {
      contact: {
        primaryContactId,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
}

// Function to retrieve the primary contact record
async function findPrimaryContact(field, value) {
  const query = `
    SELECT *
    FROM Contact
    WHERE id = (
      SELECT CASE
          WHEN linkedId IS NULL THEN id
          ELSE linkedId
      END
      FROM Contact
      WHERE ${field} = :value
      LIMIT 1
    )
    AND deletedAt IS NULL;
  `;

  const result = await sequelize.query(query, {
    replacements: { value },
    type: sequelize.QueryTypes.SELECT
  });
  return result[0];
}

// Function to insert a new contact
async function createNewContact(email, phoneNumber, linkedId, linkPrecedence) {
  const newContact = {
    email,
    phoneNumber: phoneNumber,
    linkedId: linkedId,
    linkPrecedence: linkPrecedence
  };

  const insertQuery = `
    INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence)
    VALUES (:email, :phoneNumber, :linkedId, :linkPrecedence);
  `;

  const [result] = await sequelize.query(insertQuery, {
    replacements: newContact,
    type: sequelize.QueryTypes.INSERT
  });
  return result;
}

// Function to turn primary to secondary and relink appropriately based on the creation time
async function updateContacts(emailPrimaryContact, phonePrimaryContact) {
  const olderContactId = emailPrimaryContact.createdAt > phonePrimaryContact.createdAt ?
    phonePrimaryContact.id : emailPrimaryContact.id;
  const newerContactId = emailPrimaryContact.createdAt < phonePrimaryContact.createdAt ?
    phonePrimaryContact.id : emailPrimaryContact.id;
    
  const updateQuery = `
    UPDATE Contact
    SET linkedId = :olderContactId, linkPrecedence = 'secondary'
    WHERE id = :newerContactId OR linkedId = :newerContactId;
  `;

  await sequelize.query(updateQuery, {
    replacements: { olderContactId, newerContactId },
    type: sequelize.QueryTypes.UPDATE
  });
  return olderContactId;
}

// Function to retrieve the primary contact record
async function findRelatedContacts(primaryContactId) {
  const queryFinal = `
    SELECT id, email, phoneNumber
    FROM Contact
    WHERE (id = :primaryContactId OR linkedId = :primaryContactId) AND deletedAt IS NULL
  `;

  const result = await sequelize.query(queryFinal, {
    replacements: { primaryContactId },
    type: sequelize.QueryTypes.SELECT
  });
  return result;
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
