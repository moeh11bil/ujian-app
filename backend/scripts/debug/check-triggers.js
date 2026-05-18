const db = require('./config/database');

async function checkTriggers() {
  try {
    console.log('Checking triggers on essay_grading table...\n');

    const triggers = await db.query(`
      SHOW TRIGGERS WHERE \`Table\` = 'essay_grading'
    `);

    console.log('Triggers found:', triggers.length);
    triggers.forEach(trigger => {
      console.log(`\n--- Trigger: ${trigger.Trigger} ---`);
      console.log(`Event: ${trigger.Event}`);
      console.log(`Timing: ${trigger.Timing}`);
      console.log(`Statement: ${trigger.Statement?.substring(0, 500)}...`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.end();
  }
}

checkTriggers();
