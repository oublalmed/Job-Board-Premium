/**
 * Reset a user's password and activate the account.
 *
 *   npm run reset:password -- <email> <newPassword>
 *
 * Example:
 *   npm run reset:password -- mhmdoublal@gmail.com Admin2026!
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import dataSource from './data-source.js';
import { Role } from '../common/enums/role.enum.js';
import { User, UserStatus } from '../modules/users/entities/user.entity.js';

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error('Usage: npm run reset:password -- <email> <newPassword>');
  process.exit(1);
}

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    console.error(`No user found: ${email}`);
    await dataSource.destroy();
    process.exit(1);
  }

  user.passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  user.status = UserStatus.ACTIVE;
  user.emailVerified = true;
  if (!user.roles.includes(Role.ADMIN)) {
    user.roles = [...user.roles, Role.ADMIN];
  }

  await repo.save(user);
  console.log(`Done. ${email} → status=${user.status}, roles=${user.roles.join(',')}`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
