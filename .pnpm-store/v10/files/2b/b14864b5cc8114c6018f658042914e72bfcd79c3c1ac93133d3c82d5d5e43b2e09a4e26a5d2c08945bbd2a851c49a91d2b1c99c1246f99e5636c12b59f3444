'use strict';

var error = require('@mastra/core/error');
var utils = require('@mastra/core/utils');
var vector = require('@mastra/core/vector');
var asyncMutex = require('async-mutex');
var pg = require('pg');
var xxhash = require('xxhash-wasm');
var filter = require('@mastra/core/vector/filter');
var storage = require('@mastra/core/storage');
var pgPromise = require('pg-promise');
var agent = require('@mastra/core/agent');
var scores = require('@mastra/core/scores');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var pg__namespace = /*#__PURE__*/_interopNamespace(pg);
var xxhash__default = /*#__PURE__*/_interopDefault(xxhash);
var pgPromise__default = /*#__PURE__*/_interopDefault(pgPromise);

// src/vector/index.ts

// src/shared/config.ts
var isConnectionStringConfig = (cfg) => {
  return "connectionString" in cfg;
};
var isHostConfig = (cfg) => {
  return "host" in cfg && "database" in cfg && "user" in cfg && "password" in cfg;
};
var isCloudSqlConfig = (cfg) => {
  return "stream" in cfg || "password" in cfg && typeof cfg.password === "function";
};
var validateConfig = (name, config) => {
  if (isConnectionStringConfig(config)) {
    if (!config.connectionString || typeof config.connectionString !== "string" || config.connectionString.trim() === "") {
      throw new Error(
        `${name}: connectionString must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`
      );
    }
  } else if (isCloudSqlConfig(config)) ; else if (isHostConfig(config)) {
    const required = ["host", "database", "user", "password"];
    for (const key of required) {
      if (!config[key] || typeof config[key] !== "string" || config[key].trim() === "") {
        throw new Error(
          `${name}: ${key} must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`
        );
      }
    }
  } else {
    throw new Error(
      `${name}: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with \`stream\`).`
    );
  }
};
var PGFilterTranslator = class extends filter.BaseFilterTranslator {
  getSupportedOperators() {
    return {
      ...filter.BaseFilterTranslator.DEFAULT_OPERATORS,
      custom: ["$contains", "$size"]
    };
  }
  translate(filter) {
    if (this.isEmpty(filter)) {
      return filter;
    }
    this.validateFilter(filter);
    return this.translateNode(filter);
  }
  translateNode(node, currentPath = "") {
    const withPath = (result2) => currentPath ? { [currentPath]: result2 } : result2;
    if (this.isPrimitive(node)) {
      return withPath({ $eq: this.normalizeComparisonValue(node) });
    }
    if (Array.isArray(node)) {
      return withPath({ $in: this.normalizeArrayValues(node) });
    }
    if (node instanceof RegExp) {
      return withPath(this.translateRegexPattern(node.source, node.flags));
    }
    const entries = Object.entries(node);
    const result = {};
    if (node && "$options" in node && !("$regex" in node)) {
      throw new Error("$options is not valid without $regex");
    }
    if (node && "$regex" in node) {
      const options = node.$options || "";
      return withPath(this.translateRegexPattern(node.$regex, options));
    }
    for (const [key, value] of entries) {
      if (key === "$options") continue;
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      if (this.isLogicalOperator(key)) {
        result[key] = Array.isArray(value) ? value.map((filter) => this.translateNode(filter)) : this.translateNode(value);
      } else if (this.isOperator(key)) {
        if (this.isArrayOperator(key) && !Array.isArray(value) && key !== "$elemMatch") {
          result[key] = [value];
        } else if (this.isBasicOperator(key) && Array.isArray(value)) {
          result[key] = JSON.stringify(value);
        } else {
          result[key] = value;
        }
      } else if (typeof value === "object" && value !== null) {
        const hasOperators = Object.keys(value).some((k) => this.isOperator(k));
        if (hasOperators) {
          result[newPath] = this.translateNode(value);
        } else {
          Object.assign(result, this.translateNode(value, newPath));
        }
      } else {
        result[newPath] = this.translateNode(value);
      }
    }
    return result;
  }
  translateRegexPattern(pattern, options = "") {
    if (!options) return { $regex: pattern };
    const flags = options.split("").filter((f) => "imsux".includes(f)).join("");
    return { $regex: flags ? `(?${flags})${pattern}` : pattern };
  }
};
var createBasicOperator = (symbol) => {
  return (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `CASE 
        WHEN $${paramIndex}::text IS NULL THEN metadata#>>'{${jsonPathKey}}' IS ${symbol === "=" ? "" : "NOT"} NULL
        ELSE metadata#>>'{${jsonPathKey}}' ${symbol} $${paramIndex}::text
      END`,
      needsValue: true
    };
  };
};
var createNumericOperator = (symbol) => {
  return (key, paramIndex, value) => {
    const jsonPathKey = parseJsonPathKey(key);
    const isNumeric = typeof value === "number" || typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "";
    if (isNumeric) {
      return {
        sql: `(metadata#>>'{${jsonPathKey}}')::numeric ${symbol} $${paramIndex}::numeric`,
        needsValue: true
      };
    } else {
      return {
        sql: `metadata#>>'{${jsonPathKey}}' ${symbol} $${paramIndex}::text`,
        needsValue: true
      };
    }
  };
};
function buildElemMatchConditions(value, paramIndex) {
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("$elemMatch requires an object with conditions");
  }
  const conditions = [];
  const values = [];
  Object.entries(value).forEach(([field, val]) => {
    const nextParamIndex = paramIndex + values.length;
    let paramOperator;
    let paramKey;
    let paramValue;
    if (field.startsWith("$")) {
      paramOperator = field;
      paramKey = "";
      paramValue = val;
    } else if (typeof val === "object" && !Array.isArray(val)) {
      const [op, opValue] = Object.entries(val || {})[0] || [];
      paramOperator = op;
      paramKey = field;
      paramValue = opValue;
    } else {
      paramOperator = "$eq";
      paramKey = field;
      paramValue = val;
    }
    const operatorFn = FILTER_OPERATORS[paramOperator];
    if (!operatorFn) {
      throw new Error(`Invalid operator: ${paramOperator}`);
    }
    const result = operatorFn(paramKey, nextParamIndex, paramValue);
    const sql = result.sql.replaceAll("metadata#>>", "elem#>>");
    conditions.push(sql);
    if (result.needsValue) {
      values.push(paramValue);
    }
  });
  return {
    sql: conditions.join(" AND "),
    values
  };
}
var FILTER_OPERATORS = {
  $eq: createBasicOperator("="),
  $ne: createBasicOperator("!="),
  $gt: createNumericOperator(">"),
  $gte: createNumericOperator(">="),
  $lt: createNumericOperator("<"),
  $lte: createNumericOperator("<="),
  // Array Operators
  $in: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(metadata->'${jsonPathKey}') as elem
              WHERE elem = ANY($${paramIndex}::text[])
            )
          ELSE metadata#>>'{${jsonPathKey}}' = ANY($${paramIndex}::text[])
        END
      )`,
      needsValue: true
    };
  },
  $nin: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(metadata->'${jsonPathKey}') as elem
              WHERE elem = ANY($${paramIndex}::text[])
            )
          ELSE metadata#>>'{${jsonPathKey}}' != ALL($${paramIndex}::text[])
        END
      )`,
      needsValue: true
    };
  },
  $all: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `CASE WHEN array_length($${paramIndex}::text[], 1) IS NULL THEN false 
            ELSE (metadata#>'{${jsonPathKey}}')::jsonb ?& $${paramIndex}::text[] END`,
      needsValue: true
    };
  },
  $elemMatch: (key, paramIndex, value) => {
    const { sql, values } = buildElemMatchConditions(value, paramIndex);
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
        CASE
          WHEN jsonb_typeof(metadata->'${jsonPathKey}') = 'array' THEN
            EXISTS (
              SELECT 1 
              FROM jsonb_array_elements(metadata->'${jsonPathKey}') as elem
              WHERE ${sql}
            )
          ELSE FALSE
        END
      )`,
      needsValue: true,
      transformValue: () => values
    };
  },
  // Element Operators
  $exists: (key) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `metadata ? '${jsonPathKey}'`,
      needsValue: false
    };
  },
  // Logical Operators
  $and: (key) => ({ sql: `(${key})`, needsValue: false }),
  $or: (key) => ({ sql: `(${key})`, needsValue: false }),
  $not: (key) => ({ sql: `NOT (${key})`, needsValue: false }),
  $nor: (key) => ({ sql: `NOT (${key})`, needsValue: false }),
  // Regex Operators
  $regex: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `metadata#>>'{${jsonPathKey}}' ~ $${paramIndex}`,
      needsValue: true
    };
  },
  $contains: (key, paramIndex, value) => {
    const jsonPathKey = parseJsonPathKey(key);
    let sql;
    if (Array.isArray(value)) {
      sql = `(metadata->'${jsonPathKey}') ?& $${paramIndex}`;
    } else if (typeof value === "string") {
      sql = `metadata->>'${jsonPathKey}' ILIKE '%' || $${paramIndex} || '%' ESCAPE '\\'`;
    } else {
      sql = `metadata->>'${jsonPathKey}' = $${paramIndex}`;
    }
    return {
      sql,
      needsValue: true,
      transformValue: () => Array.isArray(value) ? value.map(String) : typeof value === "string" ? escapeLikePattern(value) : value
    };
  },
  /**
   * $objectContains: Postgres-only operator for true JSONB object containment.
   * Usage: { field: { $objectContains: { ...subobject } } }
   */
  // $objectContains: (key, paramIndex) => ({
  //   sql: `metadata @> $${paramIndex}::jsonb`,
  //   needsValue: true,
  //   transformValue: value => {
  //     const parts = key.split('.');
  //     return JSON.stringify(parts.reduceRight((value, key) => ({ [key]: value }), value));
  //   },
  // }),
  $size: (key, paramIndex) => {
    const jsonPathKey = parseJsonPathKey(key);
    return {
      sql: `(
      CASE
        WHEN jsonb_typeof(metadata#>'{${jsonPathKey}}') = 'array' THEN 
          jsonb_array_length(metadata#>'{${jsonPathKey}}') = $${paramIndex}
        ELSE FALSE
      END
    )`,
      needsValue: true
    };
  }
};
var parseJsonPathKey = (key) => {
  const parsedKey = key !== "" ? utils.parseFieldKey(key) : "";
  return parsedKey.replace(/\./g, ",");
};
function escapeLikePattern(str) {
  return str.replace(/([%_\\])/g, "\\$1");
}
function buildDeleteFilterQuery(filter) {
  const values = [];
  function buildCondition(key, value, parentPath) {
    if (["$and", "$or", "$not", "$nor"].includes(key)) {
      return handleLogicalOperator(key, value);
    }
    if (!value || typeof value !== "object") {
      values.push(value);
      return `metadata#>>'{${parseJsonPathKey(key)}}' = $${values.length}`;
    }
    const [[operator, operatorValue] = []] = Object.entries(value);
    if (operator === "$not") {
      const entries = Object.entries(operatorValue);
      const conditions2 = entries.map(([nestedOp, nestedValue]) => {
        if (!FILTER_OPERATORS[nestedOp]) {
          throw new Error(`Invalid operator in $not condition: ${nestedOp}`);
        }
        const operatorFn2 = FILTER_OPERATORS[nestedOp];
        const operatorResult2 = operatorFn2(key, values.length + 1, nestedValue);
        if (operatorResult2.needsValue) {
          values.push(nestedValue);
        }
        return operatorResult2.sql;
      }).join(" AND ");
      return `NOT (${conditions2})`;
    }
    const operatorFn = FILTER_OPERATORS[operator];
    const operatorResult = operatorFn(key, values.length + 1, operatorValue);
    if (operatorResult.needsValue) {
      const transformedValue = operatorResult.transformValue ? operatorResult.transformValue() : operatorValue;
      if (Array.isArray(transformedValue) && operator === "$elemMatch") {
        values.push(...transformedValue);
      } else {
        values.push(transformedValue);
      }
    }
    return operatorResult.sql;
  }
  function handleLogicalOperator(key, value, parentPath) {
    if (key === "$not") {
      const entries = Object.entries(value);
      const conditions3 = entries.map(([fieldKey, fieldValue]) => buildCondition(fieldKey, fieldValue)).join(" AND ");
      return `NOT (${conditions3})`;
    }
    if (!value || value.length === 0) {
      switch (key) {
        case "$and":
        case "$nor":
          return "true";
        // Empty $and/$nor match everything
        case "$or":
          return "false";
        // Empty $or matches nothing
        default:
          return "true";
      }
    }
    const joinOperator = key === "$or" || key === "$nor" ? "OR" : "AND";
    const conditions2 = value.map((f) => {
      const entries = Object.entries(f || {});
      if (entries.length === 0) return "";
      const [firstKey, firstValue] = entries[0] || [];
      if (["$and", "$or", "$not", "$nor"].includes(firstKey)) {
        return buildCondition(firstKey, firstValue);
      }
      return entries.map(([k, v]) => buildCondition(k, v)).join(` ${joinOperator} `);
    });
    const joined = conditions2.join(` ${joinOperator} `);
    const operatorFn = FILTER_OPERATORS[key];
    return operatorFn(joined, 0, value).sql;
  }
  if (!filter) {
    return { sql: "", values };
  }
  const conditions = Object.entries(filter).map(([key, value]) => buildCondition(key, value)).filter(Boolean).join(" AND ");
  return { sql: conditions ? `WHERE ${conditions}` : "", values };
}
function buildFilterQuery(filter, minScore, topK) {
  const values = [minScore, topK];
  function buildCondition(key, value, parentPath) {
    if (["$and", "$or", "$not", "$nor"].includes(key)) {
      return handleLogicalOperator(key, value);
    }
    if (!value || typeof value !== "object") {
      values.push(value);
      return `metadata#>>'{${parseJsonPathKey(key)}}' = $${values.length}`;
    }
    const [[operator, operatorValue] = []] = Object.entries(value);
    if (operator === "$not") {
      const entries = Object.entries(operatorValue);
      const conditions2 = entries.map(([nestedOp, nestedValue]) => {
        if (!FILTER_OPERATORS[nestedOp]) {
          throw new Error(`Invalid operator in $not condition: ${nestedOp}`);
        }
        const operatorFn2 = FILTER_OPERATORS[nestedOp];
        const operatorResult2 = operatorFn2(key, values.length + 1, nestedValue);
        if (operatorResult2.needsValue) {
          values.push(nestedValue);
        }
        return operatorResult2.sql;
      }).join(" AND ");
      return `NOT (${conditions2})`;
    }
    const operatorFn = FILTER_OPERATORS[operator];
    const operatorResult = operatorFn(key, values.length + 1, operatorValue);
    if (operatorResult.needsValue) {
      const transformedValue = operatorResult.transformValue ? operatorResult.transformValue() : operatorValue;
      if (Array.isArray(transformedValue) && operator === "$elemMatch") {
        values.push(...transformedValue);
      } else {
        values.push(transformedValue);
      }
    }
    return operatorResult.sql;
  }
  function handleLogicalOperator(key, value, parentPath) {
    if (key === "$not") {
      const entries = Object.entries(value);
      const conditions3 = entries.map(([fieldKey, fieldValue]) => buildCondition(fieldKey, fieldValue)).join(" AND ");
      return `NOT (${conditions3})`;
    }
    if (!value || value.length === 0) {
      switch (key) {
        case "$and":
        case "$nor":
          return "true";
        // Empty $and/$nor match everything
        case "$or":
          return "false";
        // Empty $or matches nothing
        default:
          return "true";
      }
    }
    const joinOperator = key === "$or" || key === "$nor" ? "OR" : "AND";
    const conditions2 = value.map((f) => {
      const entries = Object.entries(f || {});
      if (entries.length === 0) return "";
      const [firstKey, firstValue] = entries[0] || [];
      if (["$and", "$or", "$not", "$nor"].includes(firstKey)) {
        return buildCondition(firstKey, firstValue);
      }
      return entries.map(([k, v]) => buildCondition(k, v)).join(` ${joinOperator} `);
    });
    const joined = conditions2.join(` ${joinOperator} `);
    const operatorFn = FILTER_OPERATORS[key];
    return operatorFn(joined, 0, value).sql;
  }
  if (!filter) {
    return { sql: "", values };
  }
  const conditions = Object.entries(filter).map(([key, value]) => buildCondition(key, value)).filter(Boolean).join(" AND ");
  return { sql: conditions ? `WHERE ${conditions}` : "", values };
}

// src/vector/index.ts
var PgVector = class extends vector.MastraVector {
  pool;
  describeIndexCache = /* @__PURE__ */ new Map();
  createdIndexes = /* @__PURE__ */ new Map();
  mutexesByName = /* @__PURE__ */ new Map();
  schema;
  setupSchemaPromise = null;
  installVectorExtensionPromise = null;
  vectorExtensionInstalled = void 0;
  vectorExtensionSchema = null;
  schemaSetupComplete = void 0;
  cacheWarmupPromise = null;
  constructor(config) {
    try {
      validateConfig("PgVector", config);
      super();
      this.schema = config.schemaName;
      let poolConfig;
      if (isConnectionStringConfig(config)) {
        poolConfig = {
          connectionString: config.connectionString,
          ssl: config.ssl,
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 3e4,
          connectionTimeoutMillis: 2e3,
          ...config.pgPoolOptions
        };
      } else if (isCloudSqlConfig(config)) {
        poolConfig = {
          ...config,
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 3e4,
          connectionTimeoutMillis: 2e3,
          ...config.pgPoolOptions
        };
      } else if (isHostConfig(config)) {
        poolConfig = {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max ?? 20,
          idleTimeoutMillis: config.idleTimeoutMillis ?? 3e4,
          connectionTimeoutMillis: 2e3,
          ...config.pgPoolOptions
        };
      } else {
        throw new Error("PgVector: invalid configuration provided");
      }
      const basePool = new pg__namespace.Pool(poolConfig);
      const telemetry = this.__getTelemetry();
      this.pool = telemetry?.traceClass(basePool, {
        spanNamePrefix: "pg-vector",
        attributes: {
          "vector.type": "postgres"
        }
      }) ?? basePool;
      this.cacheWarmupPromise = (async () => {
        try {
          const existingIndexes = await this.listIndexes();
          await Promise.all(
            existingIndexes.map(async (indexName) => {
              const info = await this.getIndexInfo({ indexName });
              const key = await this.getIndexCacheKey({
                indexName,
                metric: info.metric,
                dimension: info.dimension,
                type: info.type
              });
              this.createdIndexes.set(indexName, key);
            })
          );
        } catch (error) {
          this.logger?.debug("Cache warming skipped or failed", { error });
        }
      })();
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_INITIALIZATION_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            schemaName: "schemaName" in config ? config.schemaName ?? "" : ""
          }
        },
        error$1
      );
    }
  }
  getMutexByName(indexName) {
    if (!this.mutexesByName.has(indexName)) this.mutexesByName.set(indexName, new asyncMutex.Mutex());
    return this.mutexesByName.get(indexName);
  }
  /**
   * Detects which schema contains the vector extension
   */
  async detectVectorExtensionSchema(client) {
    try {
      const result = await client.query(`
        SELECT n.nspname as schema_name
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'vector'
        LIMIT 1;
      `);
      if (result.rows.length > 0) {
        this.vectorExtensionSchema = result.rows[0].schema_name;
        this.logger.debug("Vector extension found in schema", { schema: this.vectorExtensionSchema });
        return this.vectorExtensionSchema;
      }
      return null;
    } catch (error) {
      this.logger.debug("Could not detect vector extension schema", { error });
      return null;
    }
  }
  /**
   * Gets the properly qualified vector type name
   */
  getVectorTypeName() {
    if (this.vectorExtensionSchema) {
      if (this.vectorExtensionSchema === "pg_catalog") {
        return "vector";
      }
      if (this.vectorExtensionSchema === (this.schema || "public")) {
        return "vector";
      }
      const validatedSchema = utils.parseSqlIdentifier(this.vectorExtensionSchema, "vector extension schema");
      return `${validatedSchema}.vector`;
    }
    return "vector";
  }
  getTableName(indexName) {
    const parsedIndexName = utils.parseSqlIdentifier(indexName, "index name");
    const quotedIndexName = `"${parsedIndexName}"`;
    const quotedSchemaName = this.getSchemaName();
    const quotedVectorName = `"${parsedIndexName}_vector_idx"`;
    return {
      tableName: quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName,
      vectorIndexName: quotedVectorName
    };
  }
  getSchemaName() {
    return this.schema ? `"${utils.parseSqlIdentifier(this.schema, "schema name")}"` : void 0;
  }
  transformFilter(filter) {
    const translator = new PGFilterTranslator();
    return translator.translate(filter);
  }
  async getIndexInfo({ indexName }) {
    if (!this.describeIndexCache.has(indexName)) {
      this.describeIndexCache.set(indexName, await this.describeIndex({ indexName }));
    }
    return this.describeIndexCache.get(indexName);
  }
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    minScore = -1,
    ef,
    probes
  }) {
    try {
      if (!Number.isInteger(topK) || topK <= 0) {
        throw new Error("topK must be a positive integer");
      }
      if (!Array.isArray(queryVector) || !queryVector.every((x) => typeof x === "number" && Number.isFinite(x))) {
        throw new Error("queryVector must be an array of finite numbers");
      }
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_QUERY_INVALID_INPUT",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const vectorStr = `[${queryVector.join(",")}]`;
      const translatedFilter = this.transformFilter(filter);
      const { sql: filterQuery, values: filterValues } = buildFilterQuery(translatedFilter, minScore, topK);
      const indexInfo = await this.getIndexInfo({ indexName });
      if (indexInfo.type === "hnsw") {
        const calculatedEf = ef ?? Math.max(topK, (indexInfo?.config?.m ?? 16) * topK);
        const searchEf = Math.min(1e3, Math.max(1, calculatedEf));
        await client.query(`SET LOCAL hnsw.ef_search = ${searchEf}`);
      }
      if (indexInfo.type === "ivfflat" && probes) {
        await client.query(`SET LOCAL ivfflat.probes = ${probes}`);
      }
      const { tableName } = this.getTableName(indexName);
      const vectorType = this.getVectorTypeName();
      const query = `
        WITH vector_scores AS (
          SELECT
            vector_id as id,
            1 - (embedding <=> '${vectorStr}'::${vectorType}) as score,
            metadata
            ${includeVector ? ", embedding" : ""}
          FROM ${tableName}
          ${filterQuery}
        )
        SELECT *
        FROM vector_scores
        WHERE score > $1
        ORDER BY score DESC
        LIMIT $2`;
      const result = await client.query(query, filterValues);
      await client.query("COMMIT");
      return result.rows.map(({ id, score, metadata, embedding }) => ({
        id,
        score,
        metadata,
        ...includeVector && embedding && { vector: JSON.parse(embedding) }
      }));
    } catch (error$1) {
      await client.query("ROLLBACK");
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_QUERY_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  async upsert({
    indexName,
    vectors,
    metadata,
    ids,
    deleteFilter
  }) {
    const { tableName } = this.getTableName(indexName);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (deleteFilter) {
        this.logger?.debug(`Deleting vectors matching filter before upsert`, { indexName, deleteFilter });
        const translatedFilter = this.transformFilter(deleteFilter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);
        const whereClause = filterQuery.trim().replace(/^WHERE\s+/i, "");
        if (whereClause) {
          const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereClause}`;
          const result = await client.query(deleteQuery, filterValues);
          this.logger?.debug(`Deleted ${result.rowCount || 0} vectors before upsert`, {
            indexName,
            deletedCount: result.rowCount || 0
          });
        }
      }
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());
      const vectorType = this.getVectorTypeName();
      for (let i = 0; i < vectors.length; i++) {
        const query = `
          INSERT INTO ${tableName} (vector_id, embedding, metadata)
          VALUES ($1, $2::${vectorType}, $3::jsonb)
          ON CONFLICT (vector_id)
          DO UPDATE SET
            embedding = $2::${vectorType},
            metadata = $3::jsonb
          RETURNING embedding::text
        `;
        await client.query(query, [vectorIds[i], `[${vectors[i]?.join(",")}]`, JSON.stringify(metadata?.[i] || {})]);
      }
      await client.query("COMMIT");
      this.logger?.debug(`Upserted ${vectors.length} vectors to ${indexName}`, {
        indexName,
        vectorCount: vectors.length,
        hadDeleteFilter: !!deleteFilter
      });
      return vectorIds;
    } catch (error$1) {
      await client.query("ROLLBACK");
      if (error$1 instanceof Error && error$1.message?.includes("expected") && error$1.message?.includes("dimensions")) {
        const match = error$1.message.match(/expected (\d+) dimensions, not (\d+)/);
        if (match) {
          const [, expected, actual] = match;
          const mastraError2 = new error.MastraError(
            {
              id: "MASTRA_STORAGE_PG_VECTOR_UPSERT_INVALID_INPUT",
              domain: error.ErrorDomain.MASTRA_VECTOR,
              category: error.ErrorCategory.USER,
              text: `Vector dimension mismatch: Index "${indexName}" expects ${expected} dimensions but got ${actual} dimensions. Either use a matching embedding model or delete and recreate the index with the new dimension.`,
              details: {
                indexName,
                expected: expected ?? "",
                actual: actual ?? ""
              }
            },
            error$1
          );
          this.logger?.trackException(mastraError2);
          throw mastraError2;
        }
      }
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_UPSERT_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  hasher = xxhash__default.default();
  async getIndexCacheKey({
    indexName,
    dimension,
    metric,
    type
  }) {
    const input = indexName + dimension + metric + (type || "ivfflat");
    return (await this.hasher).h32(input);
  }
  cachedIndexExists(indexName, newKey) {
    const existingIndexCacheKey = this.createdIndexes.get(indexName);
    return existingIndexCacheKey && existingIndexCacheKey === newKey;
  }
  async setupSchema(client) {
    if (!this.schema || this.schemaSetupComplete) {
      return;
    }
    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const schemaCheck = await client.query(
            `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.schemata 
              WHERE schema_name = $1
            )
          `,
            [this.schema]
          );
          const schemaExists = schemaCheck.rows[0].exists;
          if (!schemaExists) {
            try {
              await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.getSchemaName()}`);
              this.logger.info(`Schema "${this.schema}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schema}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schema}". This requires CREATE privilege on the database. Either create the schema manually or grant CREATE privilege to the user.`
              );
            }
          }
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${this.schema}" is ready for use`);
        } catch (error) {
          this.schemaSetupComplete = void 0;
          this.setupSchemaPromise = null;
          throw error;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }
    await this.setupSchemaPromise;
  }
  async createIndex({
    indexName,
    dimension,
    metric = "cosine",
    indexConfig = {},
    buildIndex = true
  }) {
    const { tableName } = this.getTableName(indexName);
    try {
      if (!indexName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        throw new Error("Invalid index name format");
      }
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error("Dimension must be a positive integer");
      }
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_CREATE_INDEX_INVALID_INPUT",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
    const indexCacheKey = await this.getIndexCacheKey({ indexName, dimension, type: indexConfig.type, metric });
    if (this.cachedIndexExists(indexName, indexCacheKey)) {
      return;
    }
    const mutex = this.getMutexByName(`create-${indexName}`);
    await mutex.runExclusive(async () => {
      if (this.cachedIndexExists(indexName, indexCacheKey)) {
        return;
      }
      const client = await this.pool.connect();
      try {
        await this.setupSchema(client);
        await this.installVectorExtension(client);
        if (this.schema && this.vectorExtensionSchema && this.schema !== this.vectorExtensionSchema && this.vectorExtensionSchema !== "pg_catalog") {
          await client.query(`SET search_path TO ${this.getSchemaName()}, "${this.vectorExtensionSchema}"`);
        }
        const vectorType = this.getVectorTypeName();
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            vector_id TEXT UNIQUE NOT NULL,
            embedding ${vectorType}(${dimension}),
            metadata JSONB DEFAULT '{}'::jsonb
          );
        `);
        this.createdIndexes.set(indexName, indexCacheKey);
        if (buildIndex) {
          await this.setupIndex({ indexName, metric, indexConfig }, client);
        }
      } catch (error) {
        this.createdIndexes.delete(indexName);
        throw error;
      } finally {
        client.release();
      }
    }).catch((error$1) => {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_CREATE_INDEX_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    });
  }
  async buildIndex({ indexName, metric = "cosine", indexConfig }) {
    const client = await this.pool.connect();
    try {
      await this.setupIndex({ indexName, metric, indexConfig }, client);
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_BUILD_INDEX_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  async setupIndex({ indexName, metric, indexConfig }, client) {
    const mutex = this.getMutexByName(`build-${indexName}`);
    await mutex.runExclusive(async () => {
      const isConfigEmpty = !indexConfig || Object.keys(indexConfig).length === 0 || !indexConfig.type && !indexConfig.ivf && !indexConfig.hnsw;
      const indexType = isConfigEmpty ? "ivfflat" : indexConfig.type || "ivfflat";
      const { tableName, vectorIndexName } = this.getTableName(indexName);
      let existingIndexInfo = null;
      let dimension = 0;
      try {
        existingIndexInfo = await this.getIndexInfo({ indexName });
        dimension = existingIndexInfo.dimension;
        if (isConfigEmpty && existingIndexInfo.metric === metric) {
          if (existingIndexInfo.type === "flat") {
            this.logger?.debug(`No index exists for ${vectorIndexName}, will create default ivfflat index`);
          } else {
            this.logger?.debug(
              `Index ${vectorIndexName} already exists (type: ${existingIndexInfo.type}, metric: ${existingIndexInfo.metric}), preserving existing configuration`
            );
            const cacheKey = await this.getIndexCacheKey({
              indexName,
              dimension,
              type: existingIndexInfo.type,
              metric: existingIndexInfo.metric
            });
            this.createdIndexes.set(indexName, cacheKey);
            return;
          }
        }
        let configMatches = existingIndexInfo.metric === metric && existingIndexInfo.type === indexType;
        if (indexType === "hnsw") {
          configMatches = configMatches && existingIndexInfo.config.m === (indexConfig.hnsw?.m ?? 8) && existingIndexInfo.config.efConstruction === (indexConfig.hnsw?.efConstruction ?? 32);
        } else if (indexType === "flat") {
          configMatches = configMatches && existingIndexInfo.type === "flat";
        } else if (indexType === "ivfflat" && indexConfig.ivf?.lists) {
          configMatches = configMatches && existingIndexInfo.config.lists === indexConfig.ivf?.lists;
        }
        if (configMatches) {
          this.logger?.debug(`Index ${vectorIndexName} already exists with same configuration, skipping recreation`);
          const cacheKey = await this.getIndexCacheKey({
            indexName,
            dimension,
            type: existingIndexInfo.type,
            metric: existingIndexInfo.metric
          });
          this.createdIndexes.set(indexName, cacheKey);
          return;
        }
        this.logger?.info(`Index ${vectorIndexName} configuration changed, rebuilding index`);
        await client.query(`DROP INDEX IF EXISTS ${vectorIndexName}`);
        this.describeIndexCache.delete(indexName);
      } catch {
        this.logger?.debug(`Index ${indexName} doesn't exist yet, will create it`);
      }
      if (indexType === "flat") {
        this.describeIndexCache.delete(indexName);
        return;
      }
      const metricOp = metric === "cosine" ? "vector_cosine_ops" : metric === "euclidean" ? "vector_l2_ops" : "vector_ip_ops";
      let indexSQL;
      if (indexType === "hnsw") {
        const m = indexConfig.hnsw?.m ?? 8;
        const efConstruction = indexConfig.hnsw?.efConstruction ?? 32;
        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${vectorIndexName} 
          ON ${tableName} 
          USING hnsw (embedding ${metricOp})
          WITH (
            m = ${m},
            ef_construction = ${efConstruction}
          )
        `;
      } else {
        let lists;
        if (indexConfig.ivf?.lists) {
          lists = indexConfig.ivf.lists;
        } else {
          const size = (await client.query(`SELECT COUNT(*) FROM ${tableName}`)).rows[0].count;
          lists = Math.max(100, Math.min(4e3, Math.floor(Math.sqrt(size) * 2)));
        }
        indexSQL = `
          CREATE INDEX IF NOT EXISTS ${vectorIndexName}
          ON ${tableName}
          USING ivfflat (embedding ${metricOp})
          WITH (lists = ${lists});
        `;
      }
      await client.query(indexSQL);
    });
  }
  async installVectorExtension(client) {
    if (this.vectorExtensionInstalled) {
      return;
    }
    if (!this.installVectorExtensionPromise) {
      this.installVectorExtensionPromise = (async () => {
        try {
          const existingSchema = await this.detectVectorExtensionSchema(client);
          if (existingSchema) {
            this.vectorExtensionInstalled = true;
            this.vectorExtensionSchema = existingSchema;
            this.logger.info(`Vector extension already installed in schema: ${existingSchema}`);
            return;
          }
          try {
            if (this.schema && this.schema !== "public") {
              try {
                await client.query(`CREATE EXTENSION IF NOT EXISTS vector SCHEMA ${this.getSchemaName()}`);
                this.vectorExtensionInstalled = true;
                this.vectorExtensionSchema = this.schema;
                this.logger.info(`Vector extension installed in schema: ${this.schema}`);
                return;
              } catch (schemaError) {
                this.logger.debug(`Could not install vector extension in schema ${this.schema}, trying public schema`, {
                  error: schemaError
                });
              }
            }
            await client.query("CREATE EXTENSION IF NOT EXISTS vector");
            const installedSchema = await this.detectVectorExtensionSchema(client);
            if (installedSchema) {
              this.vectorExtensionInstalled = true;
              this.vectorExtensionSchema = installedSchema;
              this.logger.info(`Vector extension installed in schema: ${installedSchema}`);
            }
          } catch (error) {
            this.logger.warn(
              "Could not install vector extension. This requires superuser privileges. If the extension is already installed, you can ignore this warning.",
              { error }
            );
            const existingSchema2 = await this.detectVectorExtensionSchema(client);
            if (existingSchema2) {
              this.vectorExtensionInstalled = true;
              this.vectorExtensionSchema = existingSchema2;
              this.logger.info(`Vector extension found in schema: ${existingSchema2}`);
            }
          }
        } catch (error) {
          this.logger.error("Error setting up vector extension", { error });
          this.vectorExtensionInstalled = void 0;
          this.installVectorExtensionPromise = null;
          throw error;
        } finally {
          this.installVectorExtensionPromise = null;
        }
      })();
    }
    await this.installVectorExtensionPromise;
  }
  async listIndexes() {
    const client = await this.pool.connect();
    try {
      const mastraTablesQuery = `
        SELECT DISTINCT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = $1
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'vector_id'
          AND c.data_type = 'text'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'embedding'
          AND c.udt_name = 'vector'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns c
          WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name = 'metadata'
          AND c.data_type = 'jsonb'
        );
      `;
      const mastraTables = await client.query(mastraTablesQuery, [this.schema || "public"]);
      return mastraTables.rows.map((row) => row.table_name);
    } catch (e) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_LIST_INDEXES_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY
        },
        e
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }) {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);
      const tableExistsQuery = `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND udt_name = 'vector'
        LIMIT 1;
      `;
      const tableExists = await client.query(tableExistsQuery, [this.schema || "public", indexName]);
      if (tableExists.rows.length === 0) {
        throw new Error(`Vector table ${tableName} does not exist`);
      }
      const dimensionQuery = `
                SELECT atttypmod as dimension
                FROM pg_attribute
                WHERE attrelid = $1::regclass
                AND attname = 'embedding';
            `;
      const countQuery = `
                SELECT COUNT(*) as count
                FROM ${tableName};
            `;
      const indexQuery = `
            SELECT
                am.amname as index_method,
                pg_get_indexdef(i.indexrelid) as index_def,
                opclass.opcname as operator_class
            FROM pg_index i
            JOIN pg_class c ON i.indexrelid = c.oid
            JOIN pg_am am ON c.relam = am.oid
            JOIN pg_opclass opclass ON i.indclass[0] = opclass.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE c.relname = $1
            AND n.nspname = $2;
            `;
      const [dimResult, countResult, indexResult] = await Promise.all([
        client.query(dimensionQuery, [tableName]),
        client.query(countQuery),
        client.query(indexQuery, [`${indexName}_vector_idx`, this.schema || "public"])
      ]);
      const { index_method, index_def, operator_class } = indexResult.rows[0] || {
        index_method: "flat",
        index_def: "",
        operator_class: "cosine"
      };
      const metric = operator_class.includes("l2") ? "euclidean" : operator_class.includes("ip") ? "dotproduct" : "cosine";
      const config = {};
      if (index_method === "hnsw") {
        const m = index_def.match(/m\s*=\s*'?(\d+)'?/)?.[1];
        const efConstruction = index_def.match(/ef_construction\s*=\s*'?(\d+)'?/)?.[1];
        if (m) config.m = parseInt(m);
        if (efConstruction) config.efConstruction = parseInt(efConstruction);
      } else if (index_method === "ivfflat") {
        const lists = index_def.match(/lists\s*=\s*'?(\d+)'?/)?.[1];
        if (lists) config.lists = parseInt(lists);
      }
      return {
        dimension: dimResult.rows[0].dimension,
        count: parseInt(countResult.rows[0].count),
        metric,
        type: index_method,
        config
      };
    } catch (e) {
      await client.query("ROLLBACK");
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_DESCRIBE_INDEX_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        e
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  async deleteIndex({ indexName }) {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);
      await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      this.createdIndexes.delete(indexName);
    } catch (error$1) {
      await client.query("ROLLBACK");
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_DELETE_INDEX_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  async truncateIndex({ indexName }) {
    const client = await this.pool.connect();
    try {
      const { tableName } = this.getTableName(indexName);
      await client.query(`TRUNCATE ${tableName}`);
    } catch (e) {
      await client.query("ROLLBACK");
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_TRUNCATE_INDEX_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        e
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client.release();
    }
  }
  async disconnect() {
    if (this.cacheWarmupPromise) {
      try {
        await this.cacheWarmupPromise;
      } catch {
      }
    }
    await this.pool.end();
  }
  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector({ indexName, id, filter, update }) {
    let client;
    try {
      if (!update.vector && !update.metadata) {
        throw new Error("No updates provided");
      }
      if (!id && !filter) {
        throw new error.MastraError({
          id: "MASTRA_STORAGE_PG_VECTOR_UPDATE_MISSING_PARAMS",
          text: "Either id or filter must be provided",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: { indexName }
        });
      }
      if (id && filter) {
        throw new error.MastraError({
          id: "MASTRA_STORAGE_PG_VECTOR_UPDATE_CONFLICTING_PARAMS",
          text: "Cannot provide both id and filter - they are mutually exclusive",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: { indexName }
        });
      }
      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);
      const vectorType = this.getVectorTypeName();
      let updateParts = [];
      let values = [];
      let valueIndex = 1;
      if (update.vector) {
        updateParts.push(`embedding = $${valueIndex}::${vectorType}`);
        values.push(`[${update.vector.join(",")}]`);
        valueIndex++;
      }
      if (update.metadata) {
        updateParts.push(`metadata = $${valueIndex}::jsonb`);
        values.push(JSON.stringify(update.metadata));
        valueIndex++;
      }
      if (updateParts.length === 0) {
        return;
      }
      let whereClause;
      let whereValues;
      if (id) {
        whereClause = `vector_id = $${valueIndex}`;
        whereValues = [id];
      } else {
        if (!filter || Object.keys(filter).length === 0) {
          throw new error.MastraError({
            id: "MASTRA_STORAGE_PG_VECTOR_UPDATE_EMPTY_FILTER",
            text: "Cannot update with empty filter",
            domain: error.ErrorDomain.MASTRA_VECTOR,
            category: error.ErrorCategory.USER,
            details: { indexName }
          });
        }
        const translatedFilter = this.transformFilter(filter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);
        whereClause = filterQuery.trim().replace(/^WHERE\s+/i, "");
        if (!whereClause) {
          throw new error.MastraError({
            id: "MASTRA_STORAGE_PG_VECTOR_UPDATE_INVALID_FILTER",
            text: "Filter produced empty WHERE clause",
            domain: error.ErrorDomain.MASTRA_VECTOR,
            category: error.ErrorCategory.USER,
            details: { indexName, filter: JSON.stringify(filter) }
          });
        }
        whereClause = whereClause.replace(/\$(\d+)/g, (match, num) => {
          const newIndex = parseInt(num) + valueIndex - 1;
          return `$${newIndex}`;
        });
        whereValues = filterValues;
      }
      const query = `
        UPDATE ${tableName}
        SET ${updateParts.join(", ")}
        WHERE ${whereClause}
      `;
      const result = await client.query(query, [...values, ...whereValues]);
      this.logger?.info(`Updated ${result.rowCount || 0} vectors in ${indexName}`, {
        indexName,
        id: id ? id : void 0,
        filter: filter ? filter : void 0,
        updatedCount: result.rowCount || 0
      });
    } catch (error$1) {
      if (error$1 instanceof error.MastraError) {
        throw error$1;
      }
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_UPDATE_VECTOR_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...id && { id },
            ...filter && { filter: JSON.stringify(filter) }
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }
  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }) {
    let client;
    try {
      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);
      const query = `
        DELETE FROM ${tableName}
        WHERE vector_id = $1
      `;
      await client.query(query, [id]);
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_DELETE_VECTOR_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            id
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }
  /**
   * Delete vectors matching a metadata filter.
   * @param indexName - The name of the index containing the vectors.
   * @param filter - The filter to match vectors for deletion.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVectors({ indexName, filter, ids }) {
    let client;
    try {
      client = await this.pool.connect();
      const { tableName } = this.getTableName(indexName);
      if (!filter && !ids) {
        throw new error.MastraError({
          id: "MASTRA_STORAGE_PG_VECTOR_DELETE_MISSING_PARAMS",
          text: "Either filter or ids must be provided",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: { indexName }
        });
      }
      if (filter && ids) {
        throw new error.MastraError({
          id: "MASTRA_STORAGE_PG_VECTOR_DELETE_CONFLICTING_PARAMS",
          text: "Cannot provide both filter and ids - they are mutually exclusive",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.USER,
          details: { indexName }
        });
      }
      let query;
      let values;
      if (ids) {
        if (ids.length === 0) {
          throw new error.MastraError({
            id: "MASTRA_STORAGE_PG_VECTOR_DELETE_EMPTY_IDS",
            text: "Cannot delete with empty ids array",
            domain: error.ErrorDomain.MASTRA_VECTOR,
            category: error.ErrorCategory.USER,
            details: { indexName }
          });
        }
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        query = `DELETE FROM ${tableName} WHERE vector_id IN (${placeholders})`;
        values = ids;
      } else {
        if (!filter || Object.keys(filter).length === 0) {
          throw new error.MastraError({
            id: "MASTRA_STORAGE_PG_VECTOR_DELETE_EMPTY_FILTER",
            text: "Cannot delete with empty filter. Use deleteIndex to delete all vectors.",
            domain: error.ErrorDomain.MASTRA_VECTOR,
            category: error.ErrorCategory.USER,
            details: { indexName }
          });
        }
        const translatedFilter = this.transformFilter(filter);
        const { sql: filterQuery, values: filterValues } = buildDeleteFilterQuery(translatedFilter);
        const whereClause = filterQuery.trim().replace(/^WHERE\s+/i, "");
        if (!whereClause) {
          throw new error.MastraError({
            id: "MASTRA_STORAGE_PG_VECTOR_DELETE_INVALID_FILTER",
            text: "Filter produced empty WHERE clause",
            domain: error.ErrorDomain.MASTRA_VECTOR,
            category: error.ErrorCategory.USER,
            details: { indexName, filter: JSON.stringify(filter) }
          });
        }
        query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
        values = filterValues;
      }
      const result = await client.query(query, values);
      this.logger?.info(`Deleted ${result.rowCount || 0} vectors from ${indexName}`, {
        indexName,
        filter: filter ? filter : void 0,
        ids: ids ? ids : void 0,
        deletedCount: result.rowCount || 0
      });
    } catch (error$1) {
      if (error$1 instanceof error.MastraError) {
        throw error$1;
      }
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_VECTOR_DELETE_VECTORS_FAILED",
          domain: error.ErrorDomain.MASTRA_VECTOR,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...filter && { filter: JSON.stringify(filter) },
            ...ids && { idsCount: ids.length }
          }
        },
        error$1
      );
      this.logger?.trackException(mastraError);
      throw mastraError;
    } finally {
      client?.release();
    }
  }
};
function getSchemaName(schema) {
  return schema ? `"${utils.parseSqlIdentifier(schema, "schema name")}"` : void 0;
}
function getTableName({ indexName, schemaName }) {
  const parsedIndexName = utils.parseSqlIdentifier(indexName, "index name");
  const quotedIndexName = `"${parsedIndexName}"`;
  const quotedSchemaName = schemaName;
  return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
}
function buildDateRangeFilter(dateRange, fieldName) {
  const filters = {};
  if (dateRange?.start) {
    filters[`${fieldName}_gte`] = dateRange.start;
  }
  if (dateRange?.end) {
    filters[`${fieldName}_lte`] = dateRange.end;
  }
  return filters;
}
function prepareWhereClause(filters, _schema) {
  const conditions = [];
  const args = [];
  let paramIndex = 1;
  Object.entries(filters).forEach(([key, value]) => {
    if (value === void 0) return;
    if (key.endsWith("_gte")) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${utils.parseSqlIdentifier(fieldName, "field name")}" >= $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    } else if (key.endsWith("_lte")) {
      const fieldName = key.slice(0, -4);
      conditions.push(`"${utils.parseSqlIdentifier(fieldName, "field name")}" <= $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    } else if (value === null) {
      conditions.push(`"${utils.parseSqlIdentifier(key, "field name")}" IS NULL`);
    } else {
      conditions.push(`"${utils.parseSqlIdentifier(key, "field name")}" = $${paramIndex++}`);
      args.push(value instanceof Date ? value.toISOString() : value);
    }
  });
  return {
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "",
    args
  };
}
function transformFromSqlRow({
  tableName,
  sqlRow
}) {
  const schema = storage.TABLE_SCHEMAS[tableName];
  const result = {};
  Object.entries(sqlRow).forEach(([key, value]) => {
    const columnSchema = schema?.[key];
    if (columnSchema?.type === "jsonb" && typeof value === "string") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (columnSchema?.type === "timestamp" && value && typeof value === "string") {
      result[key] = new Date(value);
    } else if (columnSchema?.type === "timestamp" && value instanceof Date) {
      result[key] = value;
    } else if (columnSchema?.type === "boolean") {
      result[key] = Boolean(value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

// src/storage/domains/legacy-evals/index.ts
function transformEvalRow(row) {
  let testInfoValue = null;
  if (row.test_info) {
    try {
      testInfoValue = typeof row.test_info === "string" ? JSON.parse(row.test_info) : row.test_info;
    } catch (e) {
      console.warn("Failed to parse test_info:", e);
    }
  }
  return {
    agentName: row.agent_name,
    input: row.input,
    output: row.output,
    result: row.result,
    metricName: row.metric_name,
    instructions: row.instructions,
    testInfo: testInfoValue,
    globalRunId: row.global_run_id,
    runId: row.run_id,
    createdAt: row.created_atZ || row.created_at
  };
}
var LegacyEvalsPG = class extends storage.LegacyEvalsStorage {
  client;
  schema;
  constructor({ client, schema }) {
    super();
    this.client = client;
    this.schema = schema;
  }
  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName, type) {
    try {
      const baseQuery = `SELECT * FROM ${getTableName({ indexName: storage.TABLE_EVALS, schemaName: getSchemaName(this.schema) })} WHERE agent_name = $1`;
      const typeCondition = type === "test" ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL" : type === "live" ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)" : "";
      const query = `${baseQuery}${typeCondition} ORDER BY created_at DESC`;
      const rows = await this.client.manyOrNone(query, [agentName]);
      return rows?.map((row) => transformEvalRow(row)) ?? [];
    } catch (error) {
      if (error instanceof Error && error.message.includes("relation") && error.message.includes("does not exist")) {
        return [];
      }
      console.error("Failed to get evals for the specified agent: " + error?.message);
      throw error;
    }
  }
  async getEvals(options = {}) {
    const tableName = getTableName({ indexName: storage.TABLE_EVALS, schemaName: getSchemaName(this.schema) });
    const { agentName, type, page = 0, perPage = 100, dateRange } = options;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const conditions = [];
    const queryParams = [];
    let paramIndex = 1;
    if (agentName) {
      conditions.push(`agent_name = $${paramIndex++}`);
      queryParams.push(agentName);
    }
    if (type === "test") {
      conditions.push(`(test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL)`);
    } else if (type === "live") {
      conditions.push(`(test_info IS NULL OR test_info->>'testPath' IS NULL)`);
    }
    if (fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      queryParams.push(fromDate);
    }
    if (toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      queryParams.push(toDate);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
    try {
      const countResult = await this.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);
      const currentOffset = page * perPage;
      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false
        };
      }
      const dataQuery = `SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.client.manyOrNone(dataQuery, [...queryParams, perPage, currentOffset]);
      return {
        evals: rows?.map((row) => transformEvalRow(row)) ?? [],
        total,
        page,
        perPage,
        hasMore: currentOffset + (rows?.length ?? 0) < total
      };
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_EVALS_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            agentName: agentName || "all",
            type: type || "all",
            page,
            perPage
          }
        },
        error$1
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }
};
var MemoryPG = class extends storage.MemoryStorage {
  client;
  schema;
  operations;
  constructor({
    client,
    schema,
    operations
  }) {
    super();
    this.client = client;
    this.schema = schema;
    this.operations = operations;
  }
  /**
   * Normalizes message row from database by applying createdAtZ fallback
   */
  normalizeMessageRow(row) {
    return {
      id: row.id,
      content: row.content,
      role: row.role,
      type: row.type,
      createdAt: row.createdAtZ || row.createdAt,
      threadId: row.threadId,
      resourceId: row.resourceId
    };
  }
  async getThreadById({ threadId }) {
    try {
      const tableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const thread = await this.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE id = $1`,
        [threadId]
      );
      if (!thread) {
        return null;
      }
      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === "string" ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_THREAD_BY_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId
          }
        },
        error$1
      );
    }
  }
  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  async getThreadsByResourceId(args) {
    const resourceId = args.resourceId;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);
    try {
      const tableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const baseQuery = `FROM ${tableName} WHERE "resourceId" = $1`;
      const queryParams = [resourceId];
      const dataQuery = `SELECT id, "resourceId", title, metadata, "createdAt", "updatedAt" ${baseQuery} ORDER BY "${orderBy}" ${sortDirection}`;
      const rows = await this.client.manyOrNone(dataQuery, queryParams);
      return (rows || []).map((thread) => ({
        ...thread,
        metadata: typeof thread.metadata === "string" ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt
      }));
    } catch (error) {
      this.logger.error(`Error getting threads for resource ${resourceId}:`, error);
      return [];
    }
  }
  async getThreadsByResourceIdPaginated(args) {
    const { resourceId, page = 0, perPage: perPageInput } = args;
    const orderBy = this.castThreadOrderBy(args.orderBy);
    const sortDirection = this.castThreadSortDirection(args.sortDirection);
    try {
      const tableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      const baseQuery = `FROM ${tableName} WHERE "resourceId" = $1`;
      const queryParams = [resourceId];
      const perPage = perPageInput !== void 0 ? perPageInput : 100;
      const currentOffset = page * perPage;
      const countQuery = `SELECT COUNT(*) ${baseQuery}`;
      const countResult = await this.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);
      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false
        };
      }
      const dataQuery = `SELECT id, "resourceId", title, metadata, "createdAt", "updatedAt" ${baseQuery} ORDER BY "${orderBy}" ${sortDirection} LIMIT $2 OFFSET $3`;
      const rows = await this.client.manyOrNone(dataQuery, [...queryParams, perPage, currentOffset]);
      const threads = (rows || []).map((thread) => ({
        ...thread,
        metadata: typeof thread.metadata === "string" ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        // Assuming already Date objects or ISO strings
        updatedAt: thread.updatedAt
      }));
      return {
        threads,
        total,
        page,
        perPage,
        hasMore: currentOffset + threads.length < total
      };
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
            page
          }
        },
        error$1
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { threads: [], total: 0, page, perPage: perPageInput || 100, hasMore: false };
    }
  }
  async saveThread({ thread }) {
    try {
      const tableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      await this.client.none(
        `INSERT INTO ${tableName} (
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "createdAtZ",
          "updatedAt",
          "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          "resourceId" = EXCLUDED."resourceId",
          title = EXCLUDED.title,
          metadata = EXCLUDED.metadata,
          "createdAt" = EXCLUDED."createdAt",
          "createdAtZ" = EXCLUDED."createdAtZ",
          "updatedAt" = EXCLUDED."updatedAt",
          "updatedAtZ" = EXCLUDED."updatedAtZ"`,
        [
          thread.id,
          thread.resourceId,
          thread.title,
          thread.metadata ? JSON.stringify(thread.metadata) : null,
          thread.createdAt,
          thread.createdAt,
          thread.updatedAt,
          thread.updatedAt
        ]
      );
      return thread;
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_SAVE_THREAD_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id
          }
        },
        error$1
      );
    }
  }
  async updateThread({
    id,
    title,
    metadata
  }) {
    const threadTableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new error.MastraError({
        id: "MASTRA_STORAGE_PG_STORE_UPDATE_THREAD_FAILED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          threadId: id,
          title
        }
      });
    }
    const mergedMetadata = {
      ...existingThread.metadata,
      ...metadata
    };
    try {
      const thread = await this.client.one(
        `UPDATE ${threadTableName}
                    SET 
                        title = $1,
                        metadata = $2,
                        "updatedAt" = $3,
                        "updatedAtZ" = $3
                    WHERE id = $4
                    RETURNING *
                `,
        [title, mergedMetadata, (/* @__PURE__ */ new Date()).toISOString(), id]
      );
      return {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: typeof thread.metadata === "string" ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAtZ || thread.createdAt,
        updatedAt: thread.updatedAtZ || thread.updatedAt
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_UPDATE_THREAD_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
            title
          }
        },
        error$1
      );
    }
  }
  async deleteThread({ threadId }) {
    try {
      const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const threadTableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      await this.client.tx(async (t) => {
        await t.none(`DELETE FROM ${tableName} WHERE thread_id = $1`, [threadId]);
        await t.none(`DELETE FROM ${threadTableName} WHERE id = $1`, [threadId]);
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_DELETE_THREAD_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId
          }
        },
        error$1
      );
    }
  }
  async _getIncludedMessages({
    threadId,
    selectBy,
    orderByStatement
  }) {
    if (!threadId.trim()) throw new Error("threadId must be a non-empty string");
    const include = selectBy?.include;
    if (!include) return null;
    const unionQueries = [];
    const params = [];
    let paramIdx = 1;
    const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const searchId = inc.threadId || threadId;
      unionQueries.push(
        `
            SELECT * FROM (
              WITH ordered_messages AS (
                SELECT 
                  *,
                  ROW_NUMBER() OVER (${orderByStatement}) as row_num
                FROM ${tableName}
                WHERE thread_id = $${paramIdx}
              )
              SELECT
                m.id,
                m.content,
                m.role,
                m.type,
                m."createdAt",
                m."createdAtZ",
                m.thread_id AS "threadId",
                m."resourceId"
              FROM ordered_messages m
              WHERE m.id = $${paramIdx + 1}
              OR EXISTS (
                SELECT 1 FROM ordered_messages target
                WHERE target.id = $${paramIdx + 1}
                AND (
                  -- Get previous messages based on the max withPreviousMessages
                  (m.row_num <= target.row_num + $${paramIdx + 2} AND m.row_num > target.row_num)
                  OR
                  -- Get next messages based on the max withNextMessages
                  (m.row_num >= target.row_num - $${paramIdx + 3} AND m.row_num < target.row_num)
                )
              )
            ) AS query_${paramIdx}
            `
        // Keep ASC for final sorting after fetching context
      );
      params.push(searchId, id, withPreviousMessages, withNextMessages);
      paramIdx += 4;
    }
    const finalQuery = unionQueries.join(" UNION ALL ") + ' ORDER BY "createdAt" ASC';
    const includedRows = await this.client.manyOrNone(finalQuery, params);
    const seen = /* @__PURE__ */ new Set();
    const dedupedRows = includedRows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return dedupedRows;
  }
  parseRow(row) {
    const normalized = this.normalizeMessageRow(row);
    let content = normalized.content;
    try {
      content = JSON.parse(normalized.content);
    } catch {
    }
    return {
      id: normalized.id,
      content,
      role: normalized.role,
      createdAt: new Date(normalized.createdAt),
      threadId: normalized.threadId,
      resourceId: normalized.resourceId,
      ...normalized.type && normalized.type !== "v2" ? { type: normalized.type } : {}
    };
  }
  async getMessages(args) {
    const { threadId, resourceId, format, selectBy } = args;
    const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
    const orderByStatement = `ORDER BY "createdAt" DESC`;
    const limit = storage.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    try {
      if (!threadId.trim()) throw new Error("threadId must be a non-empty string");
      let rows = [];
      const include = selectBy?.include || [];
      if (include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) {
          rows.push(...includeMessages);
        }
      }
      const excludeIds = rows.map((m) => m.id);
      const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const excludeIdsParam = excludeIds.map((_, idx) => `$${idx + 2}`).join(", ");
      let query = `${selectStatement} FROM ${tableName} WHERE thread_id = $1 
        ${excludeIds.length ? `AND id NOT IN (${excludeIdsParam})` : ""}
        ${orderByStatement}
        LIMIT $${excludeIds.length + 2}
        `;
      const queryParams = [threadId, ...excludeIds, limit];
      const remainingRows = await this.client.manyOrNone(query, queryParams);
      rows.push(...remainingRows);
      const fetchedMessages = (rows || []).map((row) => {
        const message = this.normalizeMessageRow(row);
        if (typeof message.content === "string") {
          try {
            message.content = JSON.parse(message.content);
          } catch {
          }
        }
        if (message.type === "v2") delete message.type;
        return message;
      });
      const sortedMessages = fetchedMessages.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      return format === "v2" ? sortedMessages.map(
        (m) => ({ ...m, content: m.content || { format: 2, parts: [{ type: "text", text: "" }] } })
      ) : sortedMessages;
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_MESSAGES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId ?? ""
          }
        },
        error$1
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }
  async getMessagesById({
    messageIds,
    format
  }) {
    if (messageIds.length === 0) return [];
    const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
    try {
      const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const query = `
        ${selectStatement} FROM ${tableName} 
        WHERE id IN (${messageIds.map((_, i) => `$${i + 1}`).join(", ")})
        ORDER BY "createdAt" DESC
      `;
      const resultRows = await this.client.manyOrNone(query, messageIds);
      const list = new agent.MessageList().add(
        resultRows.map((row) => this.parseRow(row)),
        "memory"
      );
      if (format === `v1`) return list.get.all.v1();
      return list.get.all.v2();
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_MESSAGES_BY_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            messageIds: JSON.stringify(messageIds)
          }
        },
        error$1
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }
  async getMessagesPaginated(args) {
    const { threadId, resourceId, format, selectBy } = args;
    const { page = 0, perPage: perPageInput, dateRange } = selectBy?.pagination || {};
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const selectStatement = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId"`;
    const orderByStatement = `ORDER BY "createdAt" DESC`;
    const messages = [];
    try {
      if (!threadId.trim()) throw new Error("threadId must be a non-empty string");
      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) {
          messages.push(...includeMessages);
        }
      }
      const perPage = perPageInput !== void 0 ? perPageInput : storage.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      const currentOffset = page * perPage;
      const conditions = [`thread_id = $1`];
      const queryParams = [threadId];
      let paramIndex = 2;
      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex++}`);
        queryParams.push(fromDate);
      }
      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex++}`);
        queryParams.push(toDate);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
      const countResult = await this.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);
      if (total === 0 && messages.length === 0) {
        return {
          messages: [],
          total: 0,
          page,
          perPage,
          hasMore: false
        };
      }
      const excludeIds = messages.map((m) => m.id);
      const excludeIdsParam = excludeIds.map((_, idx) => `$${idx + paramIndex}`).join(", ");
      paramIndex += excludeIds.length;
      const dataQuery = `${selectStatement} FROM ${tableName} ${whereClause} ${excludeIds.length ? `AND id NOT IN (${excludeIdsParam})` : ""}${orderByStatement} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.client.manyOrNone(dataQuery, [...queryParams, ...excludeIds, perPage, currentOffset]);
      messages.push(...rows || []);
      const messagesWithParsedContent = messages.map((row) => {
        const message = this.normalizeMessageRow(row);
        if (typeof message.content === "string") {
          try {
            return { ...message, content: JSON.parse(message.content) };
          } catch {
            return message;
          }
        }
        return message;
      });
      const list = new agent.MessageList().add(messagesWithParsedContent, "memory");
      let messagesToReturn = format === `v2` ? list.get.all.v2() : list.get.all.v1();
      messagesToReturn = messagesToReturn.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      return {
        messages: messagesToReturn,
        total,
        page,
        perPage,
        hasMore: currentOffset + rows.length < total
      };
    } catch (error$1) {
      const mastraError = new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_MESSAGES_PAGINATED_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId ?? "",
            page
          }
        },
        error$1
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { messages: [], total: 0, page, perPage: perPageInput || 40, hasMore: false };
    }
  }
  async saveMessages({
    messages,
    format
  }) {
    if (messages.length === 0) return messages;
    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new error.MastraError({
        id: "MASTRA_STORAGE_PG_STORE_SAVE_MESSAGES_FAILED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`
      });
    }
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new error.MastraError({
        id: "MASTRA_STORAGE_PG_STORE_SAVE_MESSAGES_FAILED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: {
          threadId
        }
      });
    }
    try {
      const tableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      await this.client.tx(async (t) => {
        const messageInserts = messages.map((message) => {
          if (!message.threadId) {
            throw new Error(
              `Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.`
            );
          }
          if (!message.resourceId) {
            throw new Error(
              `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`
            );
          }
          return t.none(
            `INSERT INTO ${tableName} (id, thread_id, content, "createdAt", "createdAtZ", role, type, "resourceId") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
              thread_id = EXCLUDED.thread_id,
              content = EXCLUDED.content,
              role = EXCLUDED.role,
              type = EXCLUDED.type,
              "resourceId" = EXCLUDED."resourceId"`,
            [
              message.id,
              message.threadId,
              typeof message.content === "string" ? message.content : JSON.stringify(message.content),
              message.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              message.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
              message.role,
              message.type || "v2",
              message.resourceId
            ]
          );
        });
        const threadTableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
        const threadUpdate = t.none(
          `UPDATE ${threadTableName} 
                        SET 
                            "updatedAt" = $1,
                            "updatedAtZ" = $1
                        WHERE id = $2
                    `,
          [(/* @__PURE__ */ new Date()).toISOString(), threadId]
        );
        await Promise.all([...messageInserts, threadUpdate]);
      });
      const messagesWithParsedContent = messages.map((message) => {
        if (typeof message.content === "string") {
          try {
            return { ...message, content: JSON.parse(message.content) };
          } catch {
            return message;
          }
        }
        return message;
      });
      const list = new agent.MessageList().add(messagesWithParsedContent, "memory");
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_SAVE_MESSAGES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            threadId
          }
        },
        error$1
      );
    }
  }
  async updateMessages({
    messages
  }) {
    if (messages.length === 0) {
      return [];
    }
    const messageIds = messages.map((m) => m.id);
    const selectQuery = `SELECT id, content, role, type, "createdAt", "createdAtZ", thread_id AS "threadId", "resourceId" FROM ${getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} WHERE id IN ($1:list)`;
    const existingMessagesDb = await this.client.manyOrNone(selectQuery, [messageIds]);
    if (existingMessagesDb.length === 0) {
      return [];
    }
    const existingMessages = existingMessagesDb.map((msg) => {
      if (typeof msg.content === "string") {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {
        }
      }
      return msg;
    });
    const threadIdsToUpdate = /* @__PURE__ */ new Set();
    await this.client.tx(async (t) => {
      const queries = [];
      const columnMapping = {
        threadId: "thread_id"
      };
      for (const existingMessage of existingMessages) {
        const updatePayload = messages.find((m) => m.id === existingMessage.id);
        if (!updatePayload) continue;
        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;
        threadIdsToUpdate.add(existingMessage.threadId);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        const updatableFields = { ...fieldsToUpdate };
        if (updatableFields.content) {
          const newContent = {
            ...existingMessage.content,
            ...updatableFields.content,
            // Deep merge metadata if it exists on both
            ...existingMessage.content?.metadata && updatableFields.content.metadata ? {
              metadata: {
                ...existingMessage.content.metadata,
                ...updatableFields.content.metadata
              }
            } : {}
          };
          setClauses.push(`content = $${paramIndex++}`);
          values.push(newContent);
          delete updatableFields.content;
        }
        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = columnMapping[key] || key;
            setClauses.push(`"${dbColumn}" = $${paramIndex++}`);
            values.push(updatableFields[key]);
          }
        }
        if (setClauses.length > 0) {
          values.push(id);
          const sql = `UPDATE ${getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) })} SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`;
          queries.push(t.none(sql, values));
        }
      }
      if (threadIdsToUpdate.size > 0) {
        queries.push(
          t.none(
            `UPDATE ${getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) })} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id IN ($1:list)`,
            [Array.from(threadIdsToUpdate)]
          )
        );
      }
      if (queries.length > 0) {
        await t.batch(queries);
      }
    });
    const updatedMessages = await this.client.manyOrNone(selectQuery, [messageIds]);
    return (updatedMessages || []).map((row) => {
      const message = this.normalizeMessageRow(row);
      if (typeof message.content === "string") {
        try {
          return { ...message, content: JSON.parse(message.content) };
        } catch {
        }
      }
      return message;
    });
  }
  async deleteMessages(messageIds) {
    if (!messageIds || messageIds.length === 0) {
      return;
    }
    try {
      const messageTableName = getTableName({ indexName: storage.TABLE_MESSAGES, schemaName: getSchemaName(this.schema) });
      const threadTableName = getTableName({ indexName: storage.TABLE_THREADS, schemaName: getSchemaName(this.schema) });
      await this.client.tx(async (t) => {
        const placeholders = messageIds.map((_, idx) => `$${idx + 1}`).join(",");
        const messages = await t.manyOrNone(
          `SELECT DISTINCT thread_id FROM ${messageTableName} WHERE id IN (${placeholders})`,
          messageIds
        );
        const threadIds = messages?.map((msg) => msg.thread_id).filter(Boolean) || [];
        await t.none(`DELETE FROM ${messageTableName} WHERE id IN (${placeholders})`, messageIds);
        if (threadIds.length > 0) {
          const updatePromises = threadIds.map(
            (threadId) => t.none(`UPDATE ${threadTableName} SET "updatedAt" = NOW(), "updatedAtZ" = NOW() WHERE id = $1`, [threadId])
          );
          await Promise.all(updatePromises);
        }
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_DELETE_MESSAGES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: { messageIds: messageIds.join(", ") }
        },
        error$1
      );
    }
  }
  async getResourceById({ resourceId }) {
    const tableName = getTableName({ indexName: storage.TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
    const result = await this.client.oneOrNone(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [resourceId]
    );
    if (!result) {
      return null;
    }
    return {
      id: result.id,
      createdAt: result.createdAtZ || result.createdAt,
      updatedAt: result.updatedAtZ || result.updatedAt,
      workingMemory: result.workingMemory,
      metadata: typeof result.metadata === "string" ? JSON.parse(result.metadata) : result.metadata
    };
  }
  async saveResource({ resource }) {
    await this.operations.insert({
      tableName: storage.TABLE_RESOURCES,
      record: {
        ...resource,
        metadata: JSON.stringify(resource.metadata)
      }
    });
    return resource;
  }
  async updateResource({
    resourceId,
    workingMemory,
    metadata
  }) {
    const existingResource = await this.getResourceById({ resourceId });
    if (!existingResource) {
      const newResource = {
        id: resourceId,
        workingMemory,
        metadata: metadata || {},
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      return this.saveResource({ resource: newResource });
    }
    const updatedResource = {
      ...existingResource,
      workingMemory: workingMemory !== void 0 ? workingMemory : existingResource.workingMemory,
      metadata: {
        ...existingResource.metadata,
        ...metadata
      },
      updatedAt: /* @__PURE__ */ new Date()
    };
    const tableName = getTableName({ indexName: storage.TABLE_RESOURCES, schemaName: getSchemaName(this.schema) });
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (workingMemory !== void 0) {
      updates.push(`"workingMemory" = $${paramIndex}`);
      values.push(workingMemory);
      paramIndex++;
    }
    if (metadata) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updatedResource.metadata));
      paramIndex++;
    }
    updates.push(`"updatedAt" = $${paramIndex}`);
    values.push(updatedResource.updatedAt.toISOString());
    updates.push(`"updatedAtZ" = $${paramIndex++}`);
    values.push(updatedResource.updatedAt.toISOString());
    paramIndex++;
    values.push(resourceId);
    await this.client.none(`UPDATE ${tableName} SET ${updates.join(", ")} WHERE id = $${paramIndex}`, values);
    return updatedResource;
  }
};
var ObservabilityPG = class extends storage.ObservabilityStorage {
  client;
  operations;
  schema;
  constructor({
    client,
    operations,
    schema
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }
  get aiTracingStrategy() {
    return {
      preferred: "batch-with-updates",
      supported: ["batch-with-updates", "insert-only"]
    };
  }
  async createAISpan(span) {
    try {
      const startedAt = span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt;
      const endedAt = span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt;
      const record = {
        ...span,
        startedAt,
        endedAt,
        startedAtZ: startedAt,
        endedAtZ: endedAt
        // Note: createdAt/updatedAt will be set by database triggers
      };
      return this.operations.insert({ tableName: storage.TABLE_AI_SPANS, record });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_CREATE_AI_SPAN_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER,
          details: {
            spanId: span.spanId,
            traceId: span.traceId,
            spanType: span.spanType,
            spanName: span.name
          }
        },
        error$1
      );
    }
  }
  async getAITrace(traceId) {
    try {
      const tableName = getTableName({
        indexName: storage.TABLE_AI_SPANS,
        schemaName: getSchemaName(this.schema)
      });
      const spans = await this.client.manyOrNone(
        `SELECT
          "traceId", "spanId", "parentSpanId", "name", "scope", "spanType",
          "attributes", "metadata", "links", "input", "output", "error", "isEvent",
          "startedAtZ" as "startedAt", "endedAtZ" as "endedAt",
          "createdAtZ" as "createdAt", "updatedAtZ" as "updatedAt"
        FROM ${tableName}
        WHERE "traceId" = $1
        ORDER BY "startedAtZ" DESC`,
        [traceId]
      );
      if (!spans || spans.length === 0) {
        return null;
      }
      return {
        traceId,
        spans: spans.map(
          (span) => transformFromSqlRow({
            tableName: storage.TABLE_AI_SPANS,
            sqlRow: span
          })
        )
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_GET_AI_TRACE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER,
          details: {
            traceId
          }
        },
        error$1
      );
    }
  }
  async updateAISpan({
    spanId,
    traceId,
    updates
  }) {
    try {
      const data = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString();
      }
      await this.operations.update({
        tableName: storage.TABLE_AI_SPANS,
        keys: { spanId, traceId },
        data
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_UPDATE_AI_SPAN_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER,
          details: {
            spanId,
            traceId
          }
        },
        error$1
      );
    }
  }
  async getAITracesPaginated({
    filters,
    pagination
  }) {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const { entityId, entityType, ...actualFilters } = filters || {};
    const filtersWithDateRange = {
      ...actualFilters,
      ...buildDateRangeFilter(pagination?.dateRange, "startedAtZ"),
      parentSpanId: null
      // Only get root spans for traces
    };
    const whereClause = prepareWhereClause(filtersWithDateRange);
    let actualWhereClause = whereClause.sql;
    let currentParamIndex = whereClause.args.length + 1;
    if (entityId && entityType) {
      let name = "";
      if (entityType === "workflow") {
        name = `workflow run: '${entityId}'`;
      } else if (entityType === "agent") {
        name = `agent run: '${entityId}'`;
      } else {
        const error$1 = new error.MastraError({
          id: "PG_STORE_GET_AI_TRACES_PAGINATED_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER,
          details: {
            entityType
          },
          text: `Cannot filter by entity type: ${entityType}`
        });
        this.logger?.trackException(error$1);
        throw error$1;
      }
      whereClause.args.push(name);
      const statement = `"name" = $${currentParamIndex++}`;
      if (actualWhereClause) {
        actualWhereClause += ` AND ${statement}`;
      } else {
        actualWhereClause = ` WHERE ${statement}`;
      }
    }
    const tableName = getTableName({
      indexName: storage.TABLE_AI_SPANS,
      schemaName: getSchemaName(this.schema)
    });
    try {
      const countResult = await this.client.oneOrNone(
        `SELECT COUNT(*) FROM ${tableName}${actualWhereClause}`,
        whereClause.args
      );
      const count = Number(countResult?.count ?? 0);
      if (count === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage,
            hasMore: false
          },
          spans: []
        };
      }
      const spans = await this.client.manyOrNone(
        `SELECT
          "traceId", "spanId", "parentSpanId", "name", "scope", "spanType",
          "attributes", "metadata", "links", "input", "output", "error", "isEvent",
          "startedAtZ" as "startedAt", "endedAtZ" as "endedAt",
          "createdAtZ" as "createdAt", "updatedAtZ" as "updatedAt"
        FROM ${tableName}${actualWhereClause}
        ORDER BY "startedAtZ" DESC
        LIMIT $${currentParamIndex} OFFSET $${currentParamIndex + 1}`,
        [...whereClause.args, perPage, page * perPage]
      );
      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: spans.length === perPage
        },
        spans: spans.map(
          (span) => transformFromSqlRow({
            tableName: storage.TABLE_AI_SPANS,
            sqlRow: span
          })
        )
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_GET_AI_TRACES_PAGINATED_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER
        },
        error$1
      );
    }
  }
  async batchCreateAISpans(args) {
    try {
      const records = args.records.map((record) => {
        const startedAt = record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt;
        const endedAt = record.endedAt instanceof Date ? record.endedAt.toISOString() : record.endedAt;
        return {
          ...record,
          startedAt,
          endedAt,
          startedAtZ: startedAt,
          endedAtZ: endedAt
          // Note: createdAt/updatedAt will be set by database triggers
        };
      });
      return this.operations.batchInsert({
        tableName: storage.TABLE_AI_SPANS,
        records
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_BATCH_CREATE_AI_SPANS_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER
        },
        error$1
      );
    }
  }
  async batchUpdateAISpans(args) {
    try {
      return this.operations.batchUpdate({
        tableName: storage.TABLE_AI_SPANS,
        updates: args.records.map((record) => {
          const data = {
            ...record.updates
          };
          if (data.endedAt instanceof Date) {
            const endedAt = data.endedAt.toISOString();
            data.endedAt = endedAt;
            data.endedAtZ = endedAt;
          }
          if (data.startedAt instanceof Date) {
            const startedAt = data.startedAt.toISOString();
            data.startedAt = startedAt;
            data.startedAtZ = startedAt;
          }
          return {
            keys: { spanId: record.spanId, traceId: record.traceId },
            data
          };
        })
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_BATCH_UPDATE_AI_SPANS_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER
        },
        error$1
      );
    }
  }
  async batchDeleteAITraces(args) {
    try {
      const tableName = getTableName({
        indexName: storage.TABLE_AI_SPANS,
        schemaName: getSchemaName(this.schema)
      });
      const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(", ");
      await this.client.none(`DELETE FROM ${tableName} WHERE "traceId" IN (${placeholders})`, args.traceIds);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "PG_STORE_BATCH_DELETE_AI_TRACES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER
        },
        error$1
      );
    }
  }
};
var StoreOperationsPG = class extends storage.StoreOperations {
  client;
  schemaName;
  setupSchemaPromise = null;
  schemaSetupComplete = void 0;
  constructor({ client, schemaName }) {
    super();
    this.client = client;
    this.schemaName = schemaName;
  }
  async hasColumn(table, column) {
    const schema = this.schemaName || "public";
    const result = await this.client.oneOrNone(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()]
    );
    return !!result;
  }
  /**
   * Prepares values for insertion, handling JSONB columns by stringifying them
   */
  prepareValuesForInsert(record, tableName) {
    return Object.entries(record).map(([key, value]) => {
      const schema = storage.TABLE_SCHEMAS[tableName];
      const columnSchema = schema?.[key];
      if (columnSchema?.type === "jsonb" && value !== null && value !== void 0) {
        return JSON.stringify(value);
      }
      return value;
    });
  }
  /**
   * Adds timestamp Z columns to a record if timestamp columns exist
   */
  addTimestampZColumns(record) {
    if (record.createdAt) {
      record.createdAtZ = record.createdAt;
    }
    if (record.created_at) {
      record.created_atZ = record.created_at;
    }
    if (record.updatedAt) {
      record.updatedAtZ = record.updatedAt;
    }
  }
  /**
   * Prepares a value for database operations, handling Date objects and JSON serialization
   * This is schema-aware and only stringifies objects for JSONB columns
   */
  prepareValue(value, columnName, tableName) {
    if (value === null || value === void 0) {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const schema = storage.TABLE_SCHEMAS[tableName];
    const columnSchema = schema?.[columnName];
    if (columnSchema?.type === "jsonb") {
      return JSON.stringify(value);
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value;
  }
  async setupSchema() {
    if (!this.schemaName || this.schemaSetupComplete) {
      return;
    }
    const schemaName = getSchemaName(this.schemaName);
    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const schemaExists = await this.client.oneOrNone(
            `
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.schemata
                  WHERE schema_name = $1
                )
              `,
            [this.schemaName]
          );
          if (!schemaExists?.exists) {
            try {
              await this.client.none(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
              this.logger.info(`Schema "${this.schemaName}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schemaName}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schemaName}". This requires CREATE privilege on the database. Either create the schema manually or grant CREATE privilege to the user.`
              );
            }
          }
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${schemaName}" is ready for use`);
        } catch (error) {
          this.schemaSetupComplete = void 0;
          this.setupSchemaPromise = null;
          throw error;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }
    await this.setupSchemaPromise;
  }
  async insert({ tableName, record }) {
    try {
      this.addTimestampZColumns(record);
      const schemaName = getSchemaName(this.schemaName);
      const columns = Object.keys(record).map((col) => utils.parseSqlIdentifier(col, "column name"));
      const values = this.prepareValuesForInsert(record, tableName);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: tableName, schemaName })} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
        values
      );
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_INSERT_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  async clearTable({ tableName }) {
    try {
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`TRUNCATE TABLE ${tableNameWithSchema} CASCADE`);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_CLEAR_TABLE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  getDefaultValue(type) {
    switch (type) {
      case "timestamp":
        return "DEFAULT NOW()";
      case "jsonb":
        return "DEFAULT '{}'::jsonb";
      default:
        return super.getDefaultValue(type);
    }
  }
  async createTable({
    tableName,
    schema
  }) {
    try {
      const timeZColumnNames = Object.entries(schema).filter(([_, def]) => def.type === "timestamp").map(([name]) => name);
      const timeZColumns = Object.entries(schema).filter(([_, def]) => def.type === "timestamp").map(([name]) => {
        const parsedName = utils.parseSqlIdentifier(name, "column name");
        return `"${parsedName}Z" TIMESTAMPTZ DEFAULT NOW()`;
      });
      const columns = Object.entries(schema).map(([name, def]) => {
        const parsedName = utils.parseSqlIdentifier(name, "column name");
        const constraints = [];
        if (def.primaryKey) constraints.push("PRIMARY KEY");
        if (!def.nullable) constraints.push("NOT NULL");
        return `"${parsedName}" ${def.type.toUpperCase()} ${constraints.join(" ")}`;
      });
      if (this.schemaName) {
        await this.setupSchema();
      }
      const finalColumns = [...columns, ...timeZColumns].join(",\n");
      const constraintPrefix = this.schemaName ? `${this.schemaName}_` : "";
      const sql = `
            CREATE TABLE IF NOT EXISTS ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (
              ${finalColumns}
            );
            ${tableName === storage.TABLE_WORKFLOW_SNAPSHOT ? `
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key'
              ) AND NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = '${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key'
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })}
                ADD CONSTRAINT ${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key
                UNIQUE (workflow_name, run_id);
              END IF;
            END $$;
            ` : ""}
          `;
      await this.client.none(sql);
      await this.alterTable({
        tableName,
        schema,
        ifNotExists: timeZColumnNames
      });
      if (tableName === storage.TABLE_AI_SPANS) {
        await this.setupTimestampTriggers(tableName);
      }
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_CREATE_TABLE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  /**
   * Set up timestamp triggers for a table to automatically manage createdAt/updatedAt
   */
  async setupTimestampTriggers(tableName) {
    const schemaName = getSchemaName(this.schemaName);
    const fullTableName = getTableName({ indexName: tableName, schemaName });
    const functionName = `${schemaName}.trigger_set_timestamps`;
    try {
      const triggerSQL = `
        -- Create or replace the trigger function in the schema
        CREATE OR REPLACE FUNCTION ${functionName}()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                NEW."createdAt" = NOW();
                NEW."updatedAt" = NOW();
                NEW."createdAtZ" = NOW();
                NEW."updatedAtZ" = NOW();
            ELSIF TG_OP = 'UPDATE' THEN
                NEW."updatedAt" = NOW();
                NEW."updatedAtZ" = NOW();
                -- Prevent createdAt from being changed
                NEW."createdAt" = OLD."createdAt";
                NEW."createdAtZ" = OLD."createdAtZ";
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Drop existing trigger if it exists
        DROP TRIGGER IF EXISTS ${tableName}_timestamps ON ${fullTableName};

        -- Create the trigger
        CREATE TRIGGER ${tableName}_timestamps
            BEFORE INSERT OR UPDATE ON ${fullTableName}
            FOR EACH ROW
            EXECUTE FUNCTION ${functionName}();
      `;
      await this.client.none(triggerSQL);
      this.logger?.debug?.(`Set up timestamp triggers for table ${fullTableName}`);
    } catch (error) {
      this.logger?.warn?.(`Failed to set up timestamp triggers for ${fullTableName}:`, error);
    }
  }
  /**
   * Alters table schema to add columns if they don't exist
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists
  }) {
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    try {
      for (const columnName of ifNotExists) {
        if (schema[columnName]) {
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type);
          const nullable = columnDef.nullable === false ? "NOT NULL" : "";
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : "";
          const parsedColumnName = utils.parseSqlIdentifier(columnName, "column name");
          const alterSql = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();
          await this.client.none(alterSql);
          if (sqlType === "TIMESTAMP") {
            const alterSql2 = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(alterSql2);
          }
          this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
        }
      }
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_ALTER_TABLE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  async load({ tableName, keys }) {
    try {
      const keyEntries = Object.entries(keys).map(([key, value]) => [utils.parseSqlIdentifier(key, "column name"), value]);
      const conditions = keyEntries.map(([key], index) => `"${key}" = $${index + 1}`).join(" AND ");
      const values = keyEntries.map(([_, value]) => value);
      const result = await this.client.oneOrNone(
        `SELECT * FROM ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} WHERE ${conditions} ORDER BY "createdAt" DESC LIMIT 1`,
        values
      );
      if (!result) {
        return null;
      }
      if (tableName === storage.TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result;
        if (typeof snapshot.snapshot === "string") {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return snapshot;
      }
      return result;
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_LOAD_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  async batchInsert({ tableName, records }) {
    try {
      await this.client.query("BEGIN");
      for (const record of records) {
        await this.insert({ tableName, record });
      }
      await this.client.query("COMMIT");
    } catch (error$1) {
      await this.client.query("ROLLBACK");
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_BATCH_INSERT_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: records.length
          }
        },
        error$1
      );
    }
  }
  async dropTable({ tableName }) {
    try {
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`DROP TABLE IF EXISTS ${tableNameWithSchema}`);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_DROP_TABLE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  /**
   * Create a new index on a table
   */
  async createIndex(options) {
    try {
      const {
        name,
        table,
        columns,
        unique = false,
        concurrent = true,
        where,
        method = "btree",
        opclass,
        storage,
        tablespace
      } = options;
      const schemaName = this.schemaName || "public";
      const fullTableName = getTableName({
        indexName: table,
        schemaName: getSchemaName(this.schemaName)
      });
      const indexExists = await this.client.oneOrNone(
        `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
        [name, schemaName]
      );
      if (indexExists) {
        return;
      }
      const uniqueStr = unique ? "UNIQUE " : "";
      const concurrentStr = concurrent ? "CONCURRENTLY " : "";
      const methodStr = method !== "btree" ? `USING ${method} ` : "";
      const columnsStr = columns.map((col) => {
        if (col.includes(" DESC") || col.includes(" ASC")) {
          const [colName, ...modifiers] = col.split(" ");
          if (!colName) {
            throw new Error(`Invalid column specification: ${col}`);
          }
          const quotedCol2 = `"${utils.parseSqlIdentifier(colName, "column name")}" ${modifiers.join(" ")}`;
          return opclass ? `${quotedCol2} ${opclass}` : quotedCol2;
        }
        const quotedCol = `"${utils.parseSqlIdentifier(col, "column name")}"`;
        return opclass ? `${quotedCol} ${opclass}` : quotedCol;
      }).join(", ");
      const whereStr = where ? ` WHERE ${where}` : "";
      const tablespaceStr = tablespace ? ` TABLESPACE ${tablespace}` : "";
      let withStr = "";
      if (storage && Object.keys(storage).length > 0) {
        const storageParams = Object.entries(storage).map(([key, value]) => `${key} = ${value}`).join(", ");
        withStr = ` WITH (${storageParams})`;
      }
      const sql = `CREATE ${uniqueStr}INDEX ${concurrentStr}${name} ON ${fullTableName} ${methodStr}(${columnsStr})${withStr}${tablespaceStr}${whereStr}`;
      await this.client.none(sql);
    } catch (error$1) {
      if (error$1 instanceof Error && error$1.message.includes("CONCURRENTLY")) {
        const retryOptions = { ...options, concurrent: false };
        return this.createIndex(retryOptions);
      }
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_INDEX_CREATE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName: options.name,
            tableName: options.table
          }
        },
        error$1
      );
    }
  }
  /**
   * Drop an existing index
   */
  async dropIndex(indexName) {
    try {
      const schemaName = this.schemaName || "public";
      const indexExists = await this.client.oneOrNone(
        `SELECT 1 FROM pg_indexes
         WHERE indexname = $1
         AND schemaname = $2`,
        [indexName, schemaName]
      );
      if (!indexExists) {
        return;
      }
      const sql = `DROP INDEX IF EXISTS ${getSchemaName(this.schemaName)}.${indexName}`;
      await this.client.none(sql);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_INDEX_DROP_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
    }
  }
  /**
   * List indexes for a specific table or all tables
   */
  async listIndexes(tableName) {
    try {
      const schemaName = this.schemaName || "public";
      let query;
      let params;
      if (tableName) {
        query = `
          SELECT
            i.indexname as name,
            i.tablename as table,
            i.indexdef as definition,
            ix.indisunique as is_unique,
            pg_size_pretty(pg_relation_size(c.oid)) as size,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
          FROM pg_indexes i
          JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
          JOIN pg_index ix ON ix.indexrelid = c.oid
          JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
          WHERE i.schemaname = $1
          AND i.tablename = $2
          GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid
        `;
        params = [schemaName, tableName];
      } else {
        query = `
          SELECT
            i.indexname as name,
            i.tablename as table,
            i.indexdef as definition,
            ix.indisunique as is_unique,
            pg_size_pretty(pg_relation_size(c.oid)) as size,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
          FROM pg_indexes i
          JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
          JOIN pg_index ix ON ix.indexrelid = c.oid
          JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
          WHERE i.schemaname = $1
          GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid
        `;
        params = [schemaName];
      }
      const results = await this.client.manyOrNone(query, params);
      return results.map((row) => {
        let columns = [];
        if (typeof row.columns === "string" && row.columns.startsWith("{") && row.columns.endsWith("}")) {
          const arrayContent = row.columns.slice(1, -1);
          columns = arrayContent ? arrayContent.split(",") : [];
        } else if (Array.isArray(row.columns)) {
          columns = row.columns;
        }
        return {
          name: row.name,
          table: row.table,
          columns,
          unique: row.is_unique || false,
          size: row.size || "0",
          definition: row.definition || ""
        };
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_INDEX_LIST_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: tableName ? {
            tableName
          } : {}
        },
        error$1
      );
    }
  }
  /**
   * Returns definitions for automatic performance indexes
   * These composite indexes cover both filtering and sorting in single index
   */
  getAutomaticIndexDefinitions() {
    const schemaPrefix = this.schemaName ? `${this.schemaName}_` : "";
    return [
      // Composite index for threads (filter + sort)
      {
        name: `${schemaPrefix}mastra_threads_resourceid_createdat_idx`,
        table: storage.TABLE_THREADS,
        columns: ["resourceId", "createdAt DESC"]
      },
      // Composite index for messages (filter + sort)
      {
        name: `${schemaPrefix}mastra_messages_thread_id_createdat_idx`,
        table: storage.TABLE_MESSAGES,
        columns: ["thread_id", "createdAt DESC"]
      },
      // Composite index for traces (filter + sort)
      {
        name: `${schemaPrefix}mastra_traces_name_starttime_idx`,
        table: storage.TABLE_TRACES,
        columns: ["name", "startTime DESC"]
      },
      // Composite index for evals (filter + sort)
      {
        name: `${schemaPrefix}mastra_evals_agent_name_created_at_idx`,
        table: storage.TABLE_EVALS,
        columns: ["agent_name", "created_at DESC"]
      },
      // Composite index for scores (filter + sort)
      {
        name: `${schemaPrefix}mastra_scores_trace_id_span_id_created_at_idx`,
        table: storage.TABLE_SCORERS,
        columns: ["traceId", "spanId", "createdAt DESC"]
      },
      // AI Spans indexes for optimal trace querying
      {
        name: `${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`,
        table: storage.TABLE_AI_SPANS,
        columns: ["traceId", "startedAt DESC"]
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: storage.TABLE_AI_SPANS,
        columns: ["parentSpanId", "startedAt DESC"]
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: storage.TABLE_AI_SPANS,
        columns: ["name"]
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: storage.TABLE_AI_SPANS,
        columns: ["spanType", "startedAt DESC"]
      }
    ];
  }
  /**
   * Creates automatic indexes for optimal query performance
   * Uses getAutomaticIndexDefinitions() to determine which indexes to create
   */
  async createAutomaticIndexes() {
    try {
      const indexes = this.getAutomaticIndexDefinitions();
      for (const indexOptions of indexes) {
        try {
          await this.createIndex(indexOptions);
        } catch (error) {
          this.logger?.warn?.(`Failed to create index ${indexOptions.name}:`, error);
        }
      }
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_CREATE_PERFORMANCE_INDEXES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  /**
   * Get detailed statistics for a specific index
   */
  async describeIndex(indexName) {
    try {
      const schemaName = this.schemaName || "public";
      const query = `
        SELECT
          i.indexname as name,
          i.tablename as table,
          i.indexdef as definition,
          ix.indisunique as is_unique,
          pg_size_pretty(pg_relation_size(c.oid)) as size,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
          am.amname as method,
          s.idx_scan as scans,
          s.idx_tup_read as tuples_read,
          s.idx_tup_fetch as tuples_fetched
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = i.schemaname)
        JOIN pg_index ix ON ix.indexrelid = c.oid
        JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
        JOIN pg_am am ON c.relam = am.oid
        LEFT JOIN pg_stat_user_indexes s ON s.indexrelname = i.indexname AND s.schemaname = i.schemaname
        WHERE i.schemaname = $1
        AND i.indexname = $2
        GROUP BY i.indexname, i.tablename, i.indexdef, ix.indisunique, c.oid, am.amname, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
      `;
      const result = await this.client.oneOrNone(query, [schemaName, indexName]);
      if (!result) {
        throw new Error(`Index "${indexName}" not found in schema "${schemaName}"`);
      }
      let columns = [];
      if (typeof result.columns === "string" && result.columns.startsWith("{") && result.columns.endsWith("}")) {
        const arrayContent = result.columns.slice(1, -1);
        columns = arrayContent ? arrayContent.split(",") : [];
      } else if (Array.isArray(result.columns)) {
        columns = result.columns;
      }
      return {
        name: result.name,
        table: result.table,
        columns,
        unique: result.is_unique || false,
        size: result.size || "0",
        definition: result.definition || "",
        method: result.method || "btree",
        scans: parseInt(result.scans) || 0,
        tuples_read: parseInt(result.tuples_read) || 0,
        tuples_fetched: parseInt(result.tuples_fetched) || 0
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_INDEX_DESCRIBE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            indexName
          }
        },
        error$1
      );
    }
  }
  /**
   * Update a single record in the database
   */
  async update({
    tableName,
    keys,
    data
  }) {
    try {
      const setColumns = [];
      const setValues = [];
      let paramIndex = 1;
      Object.entries(data).forEach(([key, value]) => {
        const parsedKey = utils.parseSqlIdentifier(key, "column name");
        setColumns.push(`"${parsedKey}" = $${paramIndex++}`);
        setValues.push(this.prepareValue(value, key, tableName));
      });
      const whereConditions = [];
      const whereValues = [];
      Object.entries(keys).forEach(([key, value]) => {
        const parsedKey = utils.parseSqlIdentifier(key, "column name");
        whereConditions.push(`"${parsedKey}" = $${paramIndex++}`);
        whereValues.push(this.prepareValue(value, key, tableName));
      });
      const tableName_ = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName)
      });
      const sql = `UPDATE ${tableName_} SET ${setColumns.join(", ")} WHERE ${whereConditions.join(" AND ")}`;
      const values = [...setValues, ...whereValues];
      await this.client.none(sql, values);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_UPDATE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName
          }
        },
        error$1
      );
    }
  }
  /**
   * Update multiple records in a single batch transaction
   */
  async batchUpdate({
    tableName,
    updates
  }) {
    try {
      await this.client.query("BEGIN");
      for (const { keys, data } of updates) {
        await this.update({ tableName, keys, data });
      }
      await this.client.query("COMMIT");
    } catch (error$1) {
      await this.client.query("ROLLBACK");
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_BATCH_UPDATE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: updates.length
          }
        },
        error$1
      );
    }
  }
  /**
   * Delete multiple records by keys
   */
  async batchDelete({ tableName, keys }) {
    try {
      if (keys.length === 0) {
        return;
      }
      const tableName_ = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName)
      });
      await this.client.tx(async (t) => {
        for (const keySet of keys) {
          const conditions = [];
          const values = [];
          let paramIndex = 1;
          Object.entries(keySet).forEach(([key, value]) => {
            const parsedKey = utils.parseSqlIdentifier(key, "column name");
            conditions.push(`"${parsedKey}" = $${paramIndex++}`);
            values.push(value);
          });
          const sql = `DELETE FROM ${tableName_} WHERE ${conditions.join(" AND ")}`;
          await t.none(sql, values);
        }
      });
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_BATCH_DELETE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: keys.length
          }
        },
        error$1
      );
    }
  }
};
function transformScoreRow(row) {
  const data = {
    ...row,
    input: row.input !== null ? storage.safelyParseJSON(row.input) : void 0,
    scorer: row.scorer !== null ? storage.safelyParseJSON(row.scorer) : void 0,
    preprocessStepResult: row.preprocessStepResult !== null ? storage.safelyParseJSON(row.preprocessStepResult) : void 0,
    analyzeStepResult: row.analyzeStepResult !== null ? storage.safelyParseJSON(row.analyzeStepResult) : void 0,
    output: row.output !== null ? storage.safelyParseJSON(row.output) : void 0,
    additionalContext: row.additionalContext !== null ? storage.safelyParseJSON(row.additionalContext) : void 0,
    runtimeContext: row.runtimeContext !== null ? storage.safelyParseJSON(row.runtimeContext) : void 0,
    entity: row.entity !== null ? storage.safelyParseJSON(row.entity) : void 0,
    createdAt: row.createdAtZ || row.createdAt,
    updatedAt: row.updatedAtZ || row.updatedAt
  };
  const result = {};
  for (const key in storage.SCORERS_SCHEMA) {
    result[key] = data[key];
  }
  return result;
}
var ScoresPG = class extends storage.ScoresStorage {
  client;
  operations;
  schema;
  constructor({
    client,
    operations,
    schema
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }
  async getScoreById({ id }) {
    try {
      const result = await this.client.oneOrNone(
        `SELECT * FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE id = $1`,
        [id]
      );
      return result ? transformScoreRow(result) : null;
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_SCORE_BY_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source
  }) {
    try {
      const conditions = [`"scorerId" = $1`];
      const queryParams = [scorerId];
      let paramIndex = 2;
      if (entityId) {
        conditions.push(`"entityId" = $${paramIndex++}`);
        queryParams.push(entityId);
      }
      if (entityType) {
        conditions.push(`"entityType" = $${paramIndex++}`);
        queryParams.push(entityType);
      }
      if (source) {
        conditions.push(`"source" = $${paramIndex++}`);
        queryParams.push(source);
      }
      const whereClause = conditions.join(" AND ");
      const total = await this.client.oneOrNone(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE ${whereClause}`,
        queryParams
      );
      if (total?.count === "0" || !total?.count) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false
          },
          scores: []
        };
      }
      const result = await this.client.manyOrNone(
        `SELECT * FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, pagination.perPage, pagination.page * pagination.perPage]
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage
        },
        scores: result.map(transformScoreRow)
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_SCORER_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async saveScore(score) {
    let parsedScore;
    try {
      parsedScore = scores.saveScorePayloadSchema.parse(score);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_SAVE_SCORE_FAILED_INVALID_SCORE_PAYLOAD",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER,
          details: {
            scorer: score.scorer.name,
            entityId: score.entityId,
            entityType: score.entityType,
            traceId: score.traceId || "",
            spanId: score.spanId || ""
          }
        },
        error$1
      );
    }
    try {
      const id = crypto.randomUUID();
      const {
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        metadata,
        input,
        output,
        additionalContext,
        runtimeContext,
        entity,
        ...rest
      } = parsedScore;
      await this.operations.insert({
        tableName: storage.TABLE_SCORERS,
        record: {
          id,
          ...rest,
          input: JSON.stringify(input) || "",
          output: JSON.stringify(output) || "",
          scorer: scorer ? JSON.stringify(scorer) : null,
          preprocessStepResult: preprocessStepResult ? JSON.stringify(preprocessStepResult) : null,
          analyzeStepResult: analyzeStepResult ? JSON.stringify(analyzeStepResult) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          additionalContext: additionalContext ? JSON.stringify(additionalContext) : null,
          runtimeContext: runtimeContext ? JSON.stringify(runtimeContext) : null,
          entity: entity ? JSON.stringify(entity) : null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      const scoreFromDb = await this.getScoreById({ id });
      return { score: scoreFromDb };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_SAVE_SCORE_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getScoresByRunId({
    runId,
    pagination
  }) {
    try {
      const total = await this.client.oneOrNone(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE "runId" = $1`,
        [runId]
      );
      if (total?.count === "0" || !total?.count) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false
          },
          scores: []
        };
      }
      const result = await this.client.manyOrNone(
        `SELECT * FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE "runId" = $1 LIMIT $2 OFFSET $3`,
        [runId, pagination.perPage, pagination.page * pagination.perPage]
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage
        },
        scores: result.map(transformScoreRow)
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_RUN_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getScoresByEntityId({
    entityId,
    entityType,
    pagination
  }) {
    try {
      const total = await this.client.oneOrNone(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE "entityId" = $1 AND "entityType" = $2`,
        [entityId, entityType]
      );
      if (total?.count === "0" || !total?.count) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false
          },
          scores: []
        };
      }
      const result = await this.client.manyOrNone(
        `SELECT * FROM ${getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema })} WHERE "entityId" = $1 AND "entityType" = $2 LIMIT $3 OFFSET $4`,
        [entityId, entityType, pagination.perPage, pagination.page * pagination.perPage]
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage
        },
        scores: result.map(transformScoreRow)
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_ENTITY_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getScoresBySpan({
    traceId,
    spanId,
    pagination
  }) {
    try {
      const tableName = getTableName({ indexName: storage.TABLE_SCORERS, schemaName: this.schema });
      const countSQLResult = await this.client.oneOrNone(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "traceId" = $1 AND "spanId" = $2`,
        [traceId, spanId]
      );
      const total = Number(countSQLResult?.count ?? 0);
      const result = await this.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "traceId" = $1 AND "spanId" = $2 ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4`,
        [traceId, spanId, pagination.perPage + 1, pagination.page * pagination.perPage]
      );
      const hasMore = result.length > pagination.perPage;
      const scores = result.slice(0, pagination.perPage).map((row) => transformScoreRow(row)) ?? [];
      return {
        scores,
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore
        }
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_SPAN_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
};
var TracesPG = class extends storage.TracesStorage {
  client;
  operations;
  schema;
  constructor({
    client,
    operations,
    schema
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }
  async getTraces(args) {
    if (args.fromDate || args.toDate) {
      args.dateRange = {
        start: args.fromDate,
        end: args.toDate
      };
    }
    try {
      const result = await this.getTracesPaginated(args);
      return result.traces;
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_TRACES_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getTracesPaginated(args) {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;
    const queryParams = [];
    const conditions = [];
    let paramIndex = 1;
    if (name) {
      conditions.push(`name LIKE $${paramIndex++}`);
      queryParams.push(`${name}%`);
    }
    if (scope) {
      conditions.push(`scope = $${paramIndex++}`);
      queryParams.push(scope);
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        const parsedKey = utils.parseFieldKey(key);
        conditions.push(`attributes->>'${parsedKey}' = $${paramIndex++}`);
        queryParams.push(value);
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const parsedKey = utils.parseFieldKey(key);
        conditions.push(`"${parsedKey}" = $${paramIndex++}`);
        queryParams.push(value);
      });
    }
    if (fromDate) {
      conditions.push(`"createdAt" >= $${paramIndex++}`);
      queryParams.push(fromDate);
    }
    if (toDate) {
      conditions.push(`"createdAt" <= $${paramIndex++}`);
      queryParams.push(toDate);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    try {
      const countResult = await this.client.oneOrNone(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: storage.TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause}`,
        queryParams
      );
      const total = Number(countResult?.count ?? 0);
      if (total === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false
        };
      }
      const dataResult = await this.client.manyOrNone(
        `SELECT * FROM ${getTableName({ indexName: storage.TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause} ORDER BY "startTime" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, perPage, currentOffset]
      );
      const traces = dataResult.map((row) => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: storage.safelyParseJSON(row.status),
        events: storage.safelyParseJSON(row.events),
        links: storage.safelyParseJSON(row.links),
        attributes: storage.safelyParseJSON(row.attributes),
        startTime: row.startTime,
        endTime: row.endTime,
        other: storage.safelyParseJSON(row.other),
        createdAt: row.createdAtZ || row.createdAt
      }));
      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total
      };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_TRACES_PAGINATED_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async batchTraceInsert({ records }) {
    this.logger.debug("Batch inserting traces", { count: records.length });
    await this.operations.batchInsert({
      tableName: storage.TABLE_TRACES,
      records
    });
  }
};
function parseWorkflowRun(row) {
  let parsedSnapshot = row.snapshot;
  if (typeof parsedSnapshot === "string") {
    try {
      parsedSnapshot = JSON.parse(row.snapshot);
    } catch (e) {
      console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
    }
  }
  return {
    workflowName: row.workflow_name,
    runId: row.run_id,
    snapshot: parsedSnapshot,
    resourceId: row.resourceId,
    createdAt: new Date(row.createdAtZ || row.createdAt),
    updatedAt: new Date(row.updatedAtZ || row.updatedAt)
  };
}
var WorkflowsPG = class extends storage.WorkflowsStorage {
  client;
  operations;
  schema;
  constructor({
    client,
    operations,
    schema
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }
  updateWorkflowResults({
    // workflowName,
    // runId,
    // stepId,
    // result,
    // runtimeContext,
  }) {
    throw new Error("Method not implemented.");
  }
  updateWorkflowState({
    // workflowName,
    // runId,
    // opts,
  }) {
    throw new Error("Method not implemented.");
  }
  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot
  }) {
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: storage.TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6`,
        [workflowName, runId, resourceId, JSON.stringify(snapshot), now, now]
      );
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async loadWorkflowSnapshot({
    workflowName,
    runId
  }) {
    try {
      const result = await this.operations.load({
        tableName: storage.TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId }
      });
      return result ? result.snapshot : null;
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  async getWorkflowRunById({
    runId,
    workflowName
  }) {
    try {
      const conditions = [];
      const values = [];
      let paramIndex = 1;
      if (runId) {
        conditions.push(`run_id = $${paramIndex}`);
        values.push(runId);
        paramIndex++;
      }
      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const query = `
          SELECT * FROM ${getTableName({ indexName: storage.TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;
      const queryValues = values;
      const result = await this.client.oneOrNone(query, queryValues);
      if (!result) {
        return null;
      }
      return parseWorkflowRun(result);
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowName: workflowName || ""
          }
        },
        error$1
      );
    }
  }
  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
    status
  } = {}) {
    try {
      const conditions = [];
      const values = [];
      let paramIndex = 1;
      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }
      if (status) {
        conditions.push(`snapshot::jsonb ->> 'status' = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }
      if (resourceId) {
        const hasResourceId = await this.operations.hasColumn(storage.TABLE_WORKFLOW_SNAPSHOT, "resourceId");
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
          values.push(resourceId);
          paramIndex++;
        } else {
          console.warn(`[${storage.TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }
      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex}`);
        values.push(fromDate);
        paramIndex++;
      }
      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      let total = 0;
      if (limit !== void 0 && offset !== void 0) {
        const countResult = await this.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: storage.TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })} ${whereClause}`,
          values
        );
        total = Number(countResult.count);
      }
      const query = `
          SELECT * FROM ${getTableName({ indexName: storage.TABLE_WORKFLOW_SNAPSHOT, schemaName: this.schema })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${limit !== void 0 && offset !== void 0 ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ""}
        `;
      const queryValues = limit !== void 0 && offset !== void 0 ? [...values, limit, offset] : values;
      const result = await this.client.manyOrNone(query, queryValues);
      const runs = (result || []).map((row) => {
        return parseWorkflowRun(row);
      });
      return { runs, total: total || runs.length };
    } catch (error$1) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_GET_WORKFLOW_RUNS_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY,
          details: {
            workflowName: workflowName || "all"
          }
        },
        error$1
      );
    }
  }
};

// src/storage/index.ts
var PostgresStore = class extends storage.MastraStorage {
  #db;
  #pgp;
  #config;
  schema;
  isConnected = false;
  stores;
  constructor(config) {
    try {
      validateConfig("PostgresStore", config);
      super({ name: "PostgresStore" });
      this.schema = config.schemaName || "public";
      if (isConnectionStringConfig(config)) {
        this.#config = {
          connectionString: config.connectionString,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
          ssl: config.ssl
        };
      } else if (isCloudSqlConfig(config)) {
        this.#config = {
          ...config,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis
        };
      } else if (isHostConfig(config)) {
        this.#config = {
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis
        };
      } else {
        throw new Error(
          "PostgresStore: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`)."
        );
      }
      this.stores = {};
    } catch (e) {
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_PG_STORE_INITIALIZATION_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.USER
        },
        e
      );
    }
  }
  async init() {
    if (this.isConnected) {
      return;
    }
    try {
      this.isConnected = true;
      this.#pgp = pgPromise__default.default();
      this.#db = this.#pgp(this.#config);
      const operations = new StoreOperationsPG({ client: this.#db, schemaName: this.schema });
      const scores = new ScoresPG({ client: this.#db, operations, schema: this.schema });
      const traces = new TracesPG({ client: this.#db, operations, schema: this.schema });
      const workflows = new WorkflowsPG({ client: this.#db, operations, schema: this.schema });
      const legacyEvals = new LegacyEvalsPG({ client: this.#db, schema: this.schema });
      const memory = new MemoryPG({ client: this.#db, schema: this.schema, operations });
      const observability = new ObservabilityPG({ client: this.#db, operations, schema: this.schema });
      this.stores = {
        operations,
        scores,
        traces,
        workflows,
        legacyEvals,
        memory,
        observability
      };
      await super.init();
      try {
        await operations.createAutomaticIndexes();
      } catch (indexError) {
        console.warn("Failed to create indexes:", indexError);
      }
    } catch (error$1) {
      this.isConnected = false;
      throw new error.MastraError(
        {
          id: "MASTRA_STORAGE_POSTGRES_STORE_INIT_FAILED",
          domain: error.ErrorDomain.STORAGE,
          category: error.ErrorCategory.THIRD_PARTY
        },
        error$1
      );
    }
  }
  get db() {
    if (!this.#db) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#db;
  }
  get pgp() {
    if (!this.#pgp) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#pgp;
  }
  get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      aiTracing: true,
      indexManagement: true,
      getScoresBySpan: true
    };
  }
  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName, type) {
    return this.stores.legacyEvals.getEvalsByAgentName(agentName, type);
  }
  async getEvals(options = {}) {
    return this.stores.legacyEvals.getEvals(options);
  }
  /**
   * @deprecated use getTracesPaginated instead
   */
  async getTraces(args) {
    return this.stores.traces.getTraces(args);
  }
  async getTracesPaginated(args) {
    return this.stores.traces.getTracesPaginated(args);
  }
  async batchTraceInsert({ records }) {
    return this.stores.traces.batchTraceInsert({ records });
  }
  async createTable({
    tableName,
    schema
  }) {
    return this.stores.operations.createTable({ tableName, schema });
  }
  async alterTable({
    tableName,
    schema,
    ifNotExists
  }) {
    return this.stores.operations.alterTable({ tableName, schema, ifNotExists });
  }
  async clearTable({ tableName }) {
    return this.stores.operations.clearTable({ tableName });
  }
  async dropTable({ tableName }) {
    return this.stores.operations.dropTable({ tableName });
  }
  async insert({ tableName, record }) {
    return this.stores.operations.insert({ tableName, record });
  }
  async batchInsert({ tableName, records }) {
    return this.stores.operations.batchInsert({ tableName, records });
  }
  async load({ tableName, keys }) {
    return this.stores.operations.load({ tableName, keys });
  }
  /**
   * Memory
   */
  async getThreadById({ threadId }) {
    return this.stores.memory.getThreadById({ threadId });
  }
  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  async getThreadsByResourceId(args) {
    return this.stores.memory.getThreadsByResourceId(args);
  }
  async getThreadsByResourceIdPaginated(args) {
    return this.stores.memory.getThreadsByResourceIdPaginated(args);
  }
  async saveThread({ thread }) {
    return this.stores.memory.saveThread({ thread });
  }
  async updateThread({
    id,
    title,
    metadata
  }) {
    return this.stores.memory.updateThread({ id, title, metadata });
  }
  async deleteThread({ threadId }) {
    return this.stores.memory.deleteThread({ threadId });
  }
  async getMessages(args) {
    return this.stores.memory.getMessages(args);
  }
  async getMessagesById({
    messageIds,
    format
  }) {
    return this.stores.memory.getMessagesById({ messageIds, format });
  }
  async getMessagesPaginated(args) {
    return this.stores.memory.getMessagesPaginated(args);
  }
  async saveMessages(args) {
    return this.stores.memory.saveMessages(args);
  }
  async updateMessages({
    messages
  }) {
    return this.stores.memory.updateMessages({ messages });
  }
  async deleteMessages(messageIds) {
    return this.stores.memory.deleteMessages(messageIds);
  }
  async getResourceById({ resourceId }) {
    return this.stores.memory.getResourceById({ resourceId });
  }
  async saveResource({ resource }) {
    return this.stores.memory.saveResource({ resource });
  }
  async updateResource({
    resourceId,
    workingMemory,
    metadata
  }) {
    return this.stores.memory.updateResource({ resourceId, workingMemory, metadata });
  }
  /**
   * Workflows
   */
  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    runtimeContext
  }) {
    return this.stores.workflows.updateWorkflowResults({ workflowName, runId, stepId, result, runtimeContext });
  }
  async updateWorkflowState({
    workflowName,
    runId,
    opts
  }) {
    return this.stores.workflows.updateWorkflowState({ workflowName, runId, opts });
  }
  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot
  }) {
    return this.stores.workflows.persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot });
  }
  async loadWorkflowSnapshot({
    workflowName,
    runId
  }) {
    return this.stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
  }
  async getWorkflowRuns(args = {}) {
    return this.stores.workflows.getWorkflowRuns(args);
  }
  async getWorkflowRunById({
    runId,
    workflowName
  }) {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowName });
  }
  async close() {
    this.pgp.end();
  }
  /**
   * AI Tracing / Observability
   */
  async createAISpan(span) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.createAISpan(span);
  }
  async updateAISpan({
    spanId,
    traceId,
    updates
  }) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.updateAISpan({ spanId, traceId, updates });
  }
  async getAITrace(traceId) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.getAITrace(traceId);
  }
  async getAITracesPaginated(args) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.getAITracesPaginated(args);
  }
  async batchCreateAISpans(args) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.batchCreateAISpans(args);
  }
  async batchUpdateAISpans(args) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.batchUpdateAISpans(args);
  }
  async batchDeleteAITraces(args) {
    if (!this.stores.observability) {
      throw new error.MastraError({
        id: "PG_STORE_OBSERVABILITY_NOT_INITIALIZED",
        domain: error.ErrorDomain.STORAGE,
        category: error.ErrorCategory.SYSTEM,
        text: "Observability storage is not initialized"
      });
    }
    return this.stores.observability.batchDeleteAITraces(args);
  }
  /**
   * Scorers
   */
  async getScoreById({ id }) {
    return this.stores.scores.getScoreById({ id });
  }
  async getScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source
  }) {
    return this.stores.scores.getScoresByScorerId({ scorerId, pagination, entityId, entityType, source });
  }
  async saveScore(score) {
    return this.stores.scores.saveScore(score);
  }
  async getScoresByRunId({
    runId,
    pagination
  }) {
    return this.stores.scores.getScoresByRunId({ runId, pagination });
  }
  async getScoresByEntityId({
    entityId,
    entityType,
    pagination
  }) {
    return this.stores.scores.getScoresByEntityId({
      entityId,
      entityType,
      pagination
    });
  }
  async getScoresBySpan({
    traceId,
    spanId,
    pagination
  }) {
    return this.stores.scores.getScoresBySpan({ traceId, spanId, pagination });
  }
};

// src/vector/prompt.ts
var PGVECTOR_PROMPT = `When querying PG Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $all: Match all values in array
  Example: { "tags": { "$all": ["premium", "sale"] } }
- $elemMatch: Match array elements that meet all specified conditions
  Example: { "items": { "$elemMatch": { "price": { "$gt": 100 } } } }
- $contains: Check if array contains value
  Example: { "tags": { "$contains": "premium" } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }
- $nor: Logical NOR
  Example: { "$nor": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Element Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Special Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }

Restrictions:
- Regex patterns are not supported
- Direct RegExp patterns will throw an error
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported with both implicit and explicit $and
- Array operations work on array fields only
- Basic operators handle array values as JSON strings
- Empty arrays in conditions are handled gracefully
- Only logical operators ($and, $or, $not, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$contains": "value" }
- Logical operators must contain field conditions, not direct operators
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- $not operator:
  - Must be an object
  - Cannot be empty
  - Can be used at field level or top level
  - Valid: { "$not": { "field": "value" } }
  - Valid: { "field": { "$not": { "$eq": "value" } } }
- Other logical operators ($and, $or, $nor):
  - Can only be used at top level or nested within other logical operators
  - Can not be used on a field level, or be nested inside a field
  - Can not be used inside an operator
  - Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  - Valid: { "$or": [{ "$and": [{ "field": { "$gt": 100 } }] }] }
  - Invalid: { "field": { "$and": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$or": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$gt": { "$and": [{...}] } } }
- $elemMatch requires an object with conditions
  Valid: { "array": { "$elemMatch": { "field": "value" } } }
  Invalid: { "array": { "$elemMatch": "value" } }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium"] } },
    { "rating": { "$exists": true, "$gt": 4 } },
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": true }
    ]}
  ]
}`;

exports.PGVECTOR_PROMPT = PGVECTOR_PROMPT;
exports.PgVector = PgVector;
exports.PostgresStore = PostgresStore;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map