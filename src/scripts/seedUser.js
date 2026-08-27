// One-off CLI provisioning tool - NOT an API route, NOT reachable from
// the app, NOT invoked by the Admin role. This is the only way a user
// row is ever created, per the requirement that Admins cannot create
// users through the product itself.
//
// Usage:
//   node src/scripts/seedUser.js <employeeId> <Admin|User>
// Password is never taken as a CLI argument (it would leak into shell
// history / process list). It is prompted for interactively with the
// terminal echo suppressed.
//
// Example (the initial Admin):
//   node src/scripts/seedUser.js 10013705 Admin

const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../config/database');

const BCRYPT_COST_FACTOR = 12;

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '') {
        return;
      }
      readline.moveCursor(process.stdout, -1, 0);
      process.stdout.write('*');
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const [employeeId, role] = process.argv.slice(2);

  if (!/^[0-9]{8}$/.test(employeeId || '')) {
    console.error('Employee ID must be exactly 8 digits, e.g. 10013705');
    process.exitCode = 1;
    return;
  }

  if (role !== 'Admin' && role !== 'User') {
    console.error('Role must be exactly "Admin" or "User"');
    process.exitCode = 1;
    return;
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE employee_id = ?', [employeeId]);
  if (existing.length > 0) {
    console.error(`Employee ID ${employeeId} already has a user row. This script does not update existing users.`);
    process.exitCode = 1;
    return;
  }

  const password = await promptHidden(`Set Reporting Dashboard password for ${employeeId}: `);
  const confirm = await promptHidden('Confirm password: ');

  if (password !== confirm) {
    console.error('Passwords did not match. Nothing was written.');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  await pool.query(
    'INSERT INTO users (employee_id, password_hash, role) VALUES (?, ?, ?)',
    [employeeId, passwordHash, role]
  );

  console.log(`Created ${role} user for employee ID ${employeeId}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed user:', err.message);
  process.exitCode = 1;
});
