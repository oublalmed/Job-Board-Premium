/**
 * Activate a user account and grant ADMIN role in one step.
 *
 *   npm run activate:admin -- mhmdoublal@gmail.com
 *
 * Idempotent: safe to re-run.
 */
import 'reflect-metadata';
import dataSource from './data-source.js';
import { Role } from '../common/enums/role.enum.js';
import { User, UserStatus } from '../modules/users/entities/user.entity.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run activate:admin -- <email>');
  process.exit(1);
}

async function run() {
  await dataSource.initialize();

  const repo = dataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    await dataSource.destroy();
    process.exit(1);
  }

  user.status = UserStatus.ACTIVE;
  user.emailVerified = true;
  if (!user.roles.includes(Role.ADMIN)) {
    user.roles = [...user.roles, Role.ADMIN];
  }

  await repo.save(user);

  console.log(`User ${email} activated and promoted to ADMIN.`);
  console.log(`  Status : ${user.status}`);
  console.log(`  Roles  : ${user.roles.join(', ')}`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
