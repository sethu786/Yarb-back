const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const cors = require('cors'); 
const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

const dbPath = path.join(__dirname, 'transactionManager.db');
let db = null;

// Initialize DB and Server
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create the tables if they don't exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS category (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL
      );
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS \`transaction\` (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id INTEGER,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES category (category_id)
      );
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS budget (
        budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL,
        FOREIGN KEY (category_id) REFERENCES category (category_id)
      );
    `);

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/');
    });

  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// API: Create a Transaction
app.post('/api/transactions', async (request, response) => {
  const { title, amount, categoryId, type, date } = request.body;

  try {
    // Check if the categoryId exists in the category table
    const categoryQuery = `SELECT * FROM category WHERE category_id = ?;`;
    const category = await db.get(categoryQuery, [categoryId]);

    if (!category) {
      return response.status(400).send('Invalid category ID');
    }

    const query = `
      INSERT INTO \`transaction\` (title, amount, category_id, type, date)
      VALUES (?, ?, ?, ?, ?);
    `;
    const result = await db.run(query, [title, amount, categoryId, type, date]);

    if (result.lastID) {
      response.status(201).send('Transaction Created Successfully');
    } else {
      response.status(500).send('Failed to create transaction');
    }
  } catch (error) {
    console.error(error);
    response.status(500).send('Error creating transaction');
  }
});

// API: Get All Transactions
app.get('/api/transactions', async (request, response) => {
  try {
    const query = `SELECT * FROM \`transaction\`;`;
    const data = await db.all(query);
    console.log(data);  // Log the result
    response.status(200).json(data);  // Ensure the response is sent as JSON
  } catch (error) {
    console.error(error);
    response.status(500).send('Error fetching transactions');
  }
});

// API: Update Transaction
app.put('/api/transactions/:transactionId', async (request, response) => {
  const { transactionId } = request.params;
  const { title, amount, categoryId, type, date } = request.body;

  try {
    // Check if the categoryId exists in the category table
    const categoryQuery = `SELECT * FROM category WHERE category_id = ?;`;
    const category = await db.get(categoryQuery, [categoryId]);

    if (!category) {
      return response.status(400).send('Invalid category ID');
    }

    const query = `
      UPDATE \`transaction\`
      SET title = ?, amount = ?, category_id = ?, type = ?, date = ?
      WHERE transaction_id = ?;
    `;
    const result = await db.run(query, [title, amount, categoryId, type, date, transactionId]);

    if (result.changes === 0) {
      return response.status(404).send('Transaction not found');
    }

    response.status(200).send('Transaction Updated Successfully');
  } catch (error) {
    console.error(error);
    response.status(500).send('Error updating transaction');
  }
});

// API: Delete Transaction
app.delete('/api/transactions/:transactionId', async (request, response) => {
  const { transactionId } = request.params;

  try {
    const query = `DELETE FROM \`transaction\` WHERE transaction_id = ?;`;
    const result = await db.run(query, [transactionId]);

    if (result.changes === 0) {
      return response.status(404).send('Transaction not found');
    }

    response.status(200).send('Transaction Deleted Successfully');
  } catch (error) {
    console.error(error);
    response.status(500).send('Error deleting transaction');
  }
});

// API: Get All Categories
app.get('/api/categories', async (request, response) => {
  try {
    const query = `SELECT * FROM category;`;
    const data = await db.all(query);
    response.status(200).send(data);
  } catch (error) {
    console.error(error);
    response.status(500).send('Error fetching categories');
  }
});

// API: Add New Category
app.post('/api/categories', async (request, response) => {
  const { name, type } = request.body;

  try {
    const query = `
      INSERT INTO category (name, type)
      VALUES (?, ?);
    `;
    const result = await db.run(query, [name, type]);
    response.status(201).send(`Category Added Successfully with ID: ${result.lastID}`);
  } catch (error) {
    console.error(error);
    response.status(500).send('Error adding category');
  }
});

// API: Create/Update Budget
app.post('/api/budgets', async (request, response) => {
  const { categoryId, amount } = request.body;

  try {
    const getBudgetQuery = `SELECT * FROM budget WHERE category_id = ?;`;
    const existingBudget = await db.get(getBudgetQuery, [categoryId]);

    if (existingBudget === undefined) {
      const createBudgetQuery = `
        INSERT INTO budget (category_id, amount)
        VALUES (?, ?);
      `;
      const result = await db.run(createBudgetQuery, [categoryId, amount]);
      response.status(201).send(`Budget Created Successfully with ID: ${result.lastID}`);
    } else {
      const updateBudgetQuery = `
        UPDATE budget
        SET amount = ?
        WHERE categxory_id = ?;
      `;
      await db.run(updateBudgetQuery, [amount, categoryId]);
      response.status(200).send('Budget Updated Successfully');
    }
  } catch (error) {
    console.error(error);
    response.status(500).send('Error creating/updating budget');
  }
});

// API: Get All Budgets
app.get('/api/budgets', async (request, response) => {
  try {
    const query = `
      SELECT category.Id AS categoryName, budget.amount
      FROM budget
      INNER JOIN category ON budget.category_id = category.category_id;
    `;
    const data = await db.all(query);
    response.status(200).send(data);
  } catch (error) {
    console.error(error);
    response.status(500).send('Error fetching budgets');
  }
});
// DELETE a budget by ID
// DELETE a budget by category name
app.delete('/api/budgets/:categoryName', async (req, res) => {
  const { categoryName } = req.params;
  try {
    await db.run(`
      DELETE FROM budget 
      WHERE category_id = (SELECT category_id FROM category WHERE Id = ?)
    `, categoryName);
    res.status(200).send(`Budget for category '${categoryName}' deleted successfully.`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting budget by category name');
  }
});

// DELETE all budgets
app.delete('/api/budgets', async (req, res) => {
  try {
    await db.run(`DELETE FROM budget`);
    res.status(200).send('All budgets deleted successfully.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting all budgets');
  }
});



module.exports = app;
