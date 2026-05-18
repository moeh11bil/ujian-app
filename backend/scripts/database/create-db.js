const mariadb = require('mariadb');
require('dotenv').config();

async function createDatabase() {
  let conn;

  try {
    // Connect without specifying database
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123',
    });

    console.log('Connected to MariaDB server');

    // Create database if it doesn't exist
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ujian_db'}\``);
    console.log('Database created or already exists');

    // Switch to the database
    await conn.query(`USE \`${process.env.DB_NAME || 'ujian_db'}\``);

    // Read the schema file
    const fs = require('fs');
    let schema = fs.readFileSync('./models/schema.sql', 'utf8');

    // Split the schema into individual statements
    const statements = schema
      .split(/;\s*(?=\n|$)/) // Split on semicolon followed by whitespace and newline or end of string
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--')); // Remove empty statements and comments

    // Execute each statement individually
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await conn.query(statement);
      }
    }

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (conn) await conn.end();
  }
}

createDatabase();