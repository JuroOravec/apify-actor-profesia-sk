import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { program } from 'commander';

import { findMigrationFileByVersion } from './utils/fs';

const pjson = require('../../package.json');

program //
  .name(pjson.name)
  .description('CLI to run and undo Apify actor migrations')
  .version(pjson.version);

program
  .command('migrate')
  .description('Run a migration script specified by the version number')
  .argument('<version>', 'migration version to execute, eg "v1"')
  .action(async (version, options) => {
    const migFile = await findMigrationFileByVersion(version);
    const { client } = setup();
    const { migrate } = require(migFile);
    await migrate(client);
  });

program
  .command('unmigrate')
  .description('Run an un-migration script specified by the version number')
  .argument('<version>', 'migration version to execute, eg "v1"')
  .action(async (version, options) => {
    const migFile = await findMigrationFileByVersion(version);
    const { client } = setup();
    const { unmigrate } = require(migFile);
    await unmigrate(client);
  });

program.parse();

const setup = () => {
  dotenv.config();
  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  });
  return { client };
};
