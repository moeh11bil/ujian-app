const db = require('./config/database');

async function checkProcedure() {
  try {
    console.log('Checking sp_calculate_final_score procedure...\n');

    const result = await db.query(`
      SHOW CREATE PROCEDURE sp_calculate_final_score
    `);

    console.log('Procedure SQL:');
    console.log(result[0]['Create Procedure']);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

checkProcedure();
