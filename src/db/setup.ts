import * as mysql from 'mysql2/promise';

// Load from environment variables - NEVER hardcode credentials
const DB_HOST = process.env.DB_HOST || "gateway01.ap-southeast-1.prod.aws.tidbcloud.com";
const DB_USER = process.env.DB_USER || "";
const DB_PASS = process.env.DB_PASS || "";
const DB_NAME = process.env.DB_NAME || "booking";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (!DB_USER || !DB_PASS) {
  console.error('Error: DB_USER and DB_PASS environment variables are required');
  console.error('Usage: DB_USER=xxx DB_PASS=xxx DB_NAME=booking bun run db:setup');
  process.exit(1);
}

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  console.error('Error: ADMIN_PASSWORD must be at least 8 characters');
  console.error('Usage: DB_USER=xxx DB_PASS=xxx ADMIN_PASSWORD=xxx bun run db:setup');
  process.exit(1);
}

// Password hashing using Node.js crypto
import * as crypto from 'crypto';
const { randomBytes, pbkdf2Sync } = crypto;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return salt.toString('hex') + ':' + hash.toString('hex');
}

async function setup() {
  const initConn = await mysql.createConnection({
    host: DB_HOST,
    port: 4000,
    user: DB_USER,
    password: DB_PASS,
    ssl: { rejectUnauthorized: true }
  });
  
  console.log('Creating database if not exists...');
  await initConn.execute(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
  await initConn.end();

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: 4000,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    ssl: { rejectUnauthorized: true }
  });
  
  console.log('Creating tables...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'staff',
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS subjects (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      teacher VARCHAR(255) NOT NULL,
      custom_fields JSON,
      description TEXT,
      color VARCHAR(20) DEFAULT '#4F46E5',
      location VARCHAR(255),
      active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS slots (
      id VARCHAR(36) PRIMARY KEY,
      subject_id VARCHAR(36) NOT NULL,
      start_time DATETIME NOT NULL,
      duration INT NOT NULL,
      max_capacity INT DEFAULT 1,
      current_bookings INT DEFAULT 0,
      location VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_subject (subject_id),
      INDEX idx_start_time (start_time)
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(36) PRIMARY KEY,
      slot_id VARCHAR(36) NOT NULL,
      subject_id VARCHAR(36) NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      student_id VARCHAR(100) NOT NULL,
      student_email VARCHAR(255) NOT NULL,
      custom_answers JSON,
      status VARCHAR(50) DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_slot (slot_id),
      INDEX idx_subject (subject_id)
    )
  `);

  // Create admin with hashed password
  const [existing] = await conn.execute("SELECT id FROM users WHERE username = 'admin'");
  if ((existing as any[]).length === 0) {
    const hashedPassword = hashPassword(ADMIN_PASSWORD);
    await conn.execute(
      "INSERT INTO users (id, username, password, role, name) VALUES (UUID(), 'admin', ?, 'admin', 'System Admin')",
      [hashedPassword]
    );
    console.log('Admin user created with provided password');
  } else {
    console.log('Admin user already exists');
  }

  console.log('Database setup complete!');
  await conn.end();
}

setup().catch(console.error);
