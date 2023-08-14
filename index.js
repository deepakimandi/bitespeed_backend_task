require('dotenv').config(); 
const express = require('express');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const sequelize = require('./db'); 

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Define routes and logic in separate functions
app.post('/identify', identifyContact);

async function identifyContact(req, res) {
  const { email, phoneNumber } = req.body;

  let primaryContactId = null;
  let emails = [];
  let phoneNumbers = [];
  let secondaryContactIds = [];

  if (email || phoneNumber) {
    const emailPrimaryContact = await findPrimaryContact('email', email);
    const phonePrimaryContact = await findPrimaryContact('phoneNumber', phoneNumber);
  
    const isOneNull = (!email !== !phoneNumber);
    const isNewContact = !emailPrimaryContact && !phonePrimaryContact;
    const isSecondaryContact = !emailPrimaryContact || !phonePrimaryContact;

    if (isOneNull) {
      primaryContactId = emailPrimaryContact ? emailPrimaryContact.id : phonePrimaryContact ? 
        phonePrimaryContact.id : null;
    } else if (isNewContact) {
      primaryContactId = await createNewContact(email, phoneNumber, null, 'primary');
    } else if (isSecondaryContact) {
      primaryContactId = emailPrimaryContact ? emailPrimaryContact.id : phonePrimaryContact.id;
      await createNewContact(email, phoneNumber, primaryContactId, 'secondary');
    } else if (emailPrimaryContact.id !== phonePrimaryContact.id) {
      primaryContactId = await updateContacts(emailPrimaryContact, phonePrimaryContact);
    } else {
      primaryContactId = emailPrimaryContact.id;
    }
  
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
}

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
