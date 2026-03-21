import bcrypt from 'bcryptjs';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Admin';

if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> [name]');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

try {
  const result = await db
    .insert(users)
    .values({
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role: 'admin',
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  console.log('Admin user created:', result[0]);
} catch (e: any) {
  if (e.message?.includes('users_email_unique')) {
    console.error('A user with this email already exists');
  } else {
    console.error('Error:', e.message);
  }
  process.exit(1);
}
