import type { ConnectionOptions } from 'tls';
import type { ClientConfig } from 'pg';
import type * as pg from 'pg';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';
/**
 * Generic PostgreSQL configuration type.
 * @template SSLType - The SSL configuration type (ISSLConfig for pg-promise, ConnectionOptions for pg)
 */
export type PostgresConfig<SSLType = ISSLConfig | ConnectionOptions> = {
    schemaName?: string;
    max?: number;
    idleTimeoutMillis?: number;
} & ({
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | SSLType;
} | {
    connectionString: string;
    ssl?: boolean | SSLType;
} | ClientConfig);
/**
 * PostgreSQL configuration for PostgresStore (uses pg-promise with ISSLConfig)
 */
export type PostgresStoreConfig = PostgresConfig<ISSLConfig>;
/**
 * PostgreSQL configuration for PgVector (uses pg with ConnectionOptions)
 */
export type PgVectorConfig = PostgresConfig<ConnectionOptions> & {
    pgPoolOptions?: Omit<pg.PoolConfig, 'connectionString'>;
};
export declare const isConnectionStringConfig: <SSLType>(cfg: PostgresConfig<SSLType>) => cfg is PostgresConfig<SSLType> & {
    connectionString: string;
    ssl?: boolean | SSLType;
};
export declare const isHostConfig: <SSLType>(cfg: PostgresConfig<SSLType>) => cfg is PostgresConfig<SSLType> & {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | SSLType;
};
export declare const isCloudSqlConfig: <SSLType>(cfg: PostgresConfig<SSLType>) => cfg is PostgresConfig<SSLType> & ClientConfig;
export declare const validateConfig: (name: string, config: PostgresConfig<ISSLConfig | ConnectionOptions>) => void;
//# sourceMappingURL=config.d.ts.map