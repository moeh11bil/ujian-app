const mariadb = require('mariadb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLogin() {
  let conn;
  try {
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123',
      database: process.env.DB_NAME || 'ujian_db',
    });

    console.log('Testing login for admin@example.com with password admin123');
    
    // Find user in database (same query as in auth route)
    const [users] = await conn.query('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
    
    if (!users.length) {
      console.log('No user found with that email');
      return;
    }

    const user = users[0];
    console.log('User found:', user.nama, user.email);

    // Compare password (same comparison as in auth route)
    const isMatch = await bcrypt.compare('admin123', user.password);
    console.log('Password match result:', isMatch);

    if (isMatch) {
      console.log('Login should succeed!');
    } else {
      console.log('Login will fail due to password mismatch');
      console.log('Stored hash:', user.password);
      // Let's also check what the hash of 'admin123' should be
      const testHash = await bcrypt.hash('admin123', 10);
      console.log('Correct hash for "admin123":', testHash);
    }

  } catch (error) {
    console.error('Error testing login:', error);
  } finally {
    if (conn) await conn.end();
  }
}

testLogin();