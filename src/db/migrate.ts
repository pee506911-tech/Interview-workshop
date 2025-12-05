import * as mysql from 'mysql2/promise';

// Load from environment variables - NEVER hardcode credentials
const DB_HOST = process.env.DB_HOST || "gateway01.ap-southeast-1.prod.aws.tidbcloud.com";
const DB_USER = process.env.DB_USER || "";
const DB_PASS = process.env.DB_PASS || "";
const DB_NAME = process.env.DB_NAME || "booking";

if (!DB_USER || !DB_PASS) {
  console.error('Error: DB_USER and DB_PASS environment variables are required');
  console.error('Usage: DB_USER=xxx DB_PASS=xxx bun run db:migrate');
  process.exit(1);
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: 4000,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    ssl: { rejectUnauthorized: true }
  });

  console.log('Running migrations...');

  // Add new columns to subjects table
  const subjectColumns = [
    { name: 'description', sql: 'ALTER TABLE subjects ADD COLUMN description TEXT' },
    { name: 'color', sql: "ALTER TABLE subjects ADD COLUMN color VARCHAR(20) DEFAULT '#4F46E5'" },
    { name: 'location', sql: 'ALTER TABLE subjects ADD COLUMN location VARCHAR(255)' },
    { name: 'active', sql: 'ALTER TABLE subjects ADD COLUMN active TINYINT DEFAULT 1' },
  ];

  for (const col of subjectColumns) {
    try {
      await conn.execute(col.sql);
      console.log(`Added subjects.${col.name}`);
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`subjects.${col.name} already exists`);
      } else {
        console.error(`Error adding subjects.${col.name}:`, e.message);
      }
    }
  }

  // Add location to slots table
  try {
    await conn.execute('ALTER TABLE slots ADD COLUMN location VARCHAR(255)');
    console.log('Added slots.location');
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('slots.location already exists');
    } else {
      console.error('Error adding slots.location:', e.message);
    }
  }

  // Add email to users table
  try {
    await conn.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    console.log('Added users.email');
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('users.email already exists');
    } else {
      console.error('Error adding users.email:', e.message);
    }
  }

  console.log('Migration complete!');
  await conn.end();
}

migrate().catch(console.error);
