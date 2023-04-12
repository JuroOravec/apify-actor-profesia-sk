import fsp from 'fs/promises';
import path from 'path';
import { cwd } from 'process';
import type { Actor, ActorClient } from 'apify-client';
import { glob } from 'glob';

// This file is an example of how to make changes to the actors
// programmatically in a documented way.
// https://docs.apify.com/academy/getting-started/apify-client

const MIGRATION_STATE_DIR = path.join(`${cwd()}`, 'src/actor-migrations/states');
const MIGRATION_FILES_DIR = path.join(`${cwd()}`, 'src/actor-migrations/migrations');

const genStateFilepath = (migrationFilename: string) => {
  const filenameNoExt = path.parse(migrationFilename).name;
  const stateFilename = `${filenameNoExt}.json`;
  const stateFilepath = path.join(MIGRATION_STATE_DIR, stateFilename);
  return stateFilepath;
};

export const saveState = async (migrationFilename: string, actor: ActorClient): Promise<void> => {
  const stateFilepath = genStateFilepath(migrationFilename);
  const actorData = JSON.stringify(await actor.get());

  await fsp.mkdir(path.dirname(stateFilepath), { recursive: true });
  await fsp.writeFile(stateFilepath, actorData, 'utf-8');
};

export const loadState = async (migrationFilename: string): Promise<Actor> => {
  const stateFilepath = genStateFilepath(migrationFilename);
  const fileContent = await fsp.readFile(stateFilepath, 'utf-8');
  const actorData = JSON.parse(fileContent) as Actor;
  return actorData;
};

export const findMigrationFileByVersion = async (version: string): Promise<string> => {
  const files = await glob(path.join(MIGRATION_FILES_DIR, `${version}_*`));
  if (!files.length) {
    throw Error(`No migration file matched version "${version}"`);
  }
  if (files.length > 1) {
    throw Error(
      `Ambiguous migration version. Version "${version}" matched multiple migration files`
    );
  }
  return files[0];
};
