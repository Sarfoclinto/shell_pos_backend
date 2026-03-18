import { connectDB, query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { seedUsers } from './seeds/001_seed_users.js';

const seeds = [seedUsers];

const run = async () => {
  await connectDB();
  logger.info('🌱 Running seeds...');

  for (const seed of seeds) {
    await seed(query);
  }

  logger.info('✅ Seeding complete.');
  // eslint-disable-next-line no-undef
  process.exit(0);
};

// eslint-disable-next-line no-undef
run().catch((e) => { logger.error(e); process.exit(1); });
