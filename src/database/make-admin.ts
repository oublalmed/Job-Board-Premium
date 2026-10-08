/**
 * Promote a user to ADMIN role (idempotent).
 *
 *   npm run make:admin -- mhmdoublal@gmail.com
 *
 * Safe to re-run: adding ADMIN to a user that already has it is a no-op.
 */
import 'reflect-metadata';
import dataSource from './data-source.js';
import { Role } from '../common/enums/role.enum.js';
import { User } from '../modules/users/entities/user.entity.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run make:admin -- <email>');
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

  if (user.roles.includes(Role.ADMIN)) {
    console.log(`User ${email} already has ADMIN role. Nothing to do.`);
    await dataSource.destroy();
    return;
  }

  user.roles = [...user.roles, Role.ADMIN];
  await repo.save(user);

  console.log(`✓ User ${email} promoted to ADMIN. Roles: ${user.roles.join(', ')}`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
