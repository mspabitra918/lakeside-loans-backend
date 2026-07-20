require('dotenv').config();

/**
 * sequelize-cli configuration.
 *
 * `migrationStorageTableName` is set explicitly so the bookkeeping table has an
 * obvious name in a database that may hold other schemas.
 */
const base = {
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || null,
  database: process.env.DB_NAME || 'lakeside_loans',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  migrationStorageTableName: 'sequelize_migrations',
  seederStorage: 'sequelize',
  seederStorageTableName: 'sequelize_seeds',
};

/** Managed Postgres almost always terminates TLS, so require it off-localhost. */
const ssl =
  process.env.DB_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};

module.exports = {
  development: { ...base, logging: console.log },
  test: {
    ...base,
    database: process.env.DB_NAME_TEST || `${base.database}_test`,
    logging: false,
  },
  production: {
    ...base,
    logging: false,
    dialectOptions: { ...ssl.ssl ? { ssl: ssl.ssl } : {} },
  },
};
