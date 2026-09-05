import 'reflect-metadata';
import 'dotenv/config'; // must run before `./env` reads process.env
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { env } from './env';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  synchronize: env.db.synchronize,
  logging: env.db.logging,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
};

/** Used by the TypeORM CLI (`npm run typeorm ...`). */
export default new DataSource(dataSourceOptions);
