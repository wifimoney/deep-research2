import { pgTable, unique, text, timestamp, jsonb, index, integer, bigint, doublePrecision, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const mastraWorkflowSnapshot = pgTable("mastra_workflow_snapshot", {
	workflowName: text("workflow_name").notNull(),
	runId: text("run_id").notNull(),
	resourceId: text(),
	snapshot: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("public_mastra_workflow_snapshot_workflow_name_run_id_key").on(table.workflowName, table.runId),
]);

export const mastraResources = pgTable("mastra_resources", {
	id: text().primaryKey().notNull(),
	workingMemory: text(),
	metadata: jsonb(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
});

export const mastraTraces = pgTable("mastra_traces", {
	id: text().primaryKey().notNull(),
	parentSpanId: text(),
	name: text().notNull(),
	traceId: text().notNull(),
	scope: text().notNull(),
	kind: integer().notNull(),
	attributes: jsonb(),
	status: jsonb(),
	events: jsonb(),
	links: jsonb(),
	other: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startTime: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endTime: bigint({ mode: "number" }).notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_traces_name_starttime_idx").using("btree", table.name.asc().nullsLast().op("int8_ops"), table.startTime.desc().nullsFirst().op("int8_ops")),
]);

export const mastraEvals = pgTable("mastra_evals", {
	input: text().notNull(),
	output: text().notNull(),
	result: jsonb().notNull(),
	agentName: text("agent_name").notNull(),
	metricName: text("metric_name").notNull(),
	instructions: text().notNull(),
	testInfo: jsonb("test_info"),
	globalRunId: text("global_run_id").notNull(),
	runId: text("run_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	createdAtZ: timestamp("created_atZ", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_evals_agent_name_created_at_idx").using("btree", table.agentName.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
]);

export const mastraThreads = pgTable("mastra_threads", {
	id: text().primaryKey().notNull(),
	resourceId: text().notNull(),
	title: text().notNull(),
	metadata: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_threads_resourceid_createdat_idx").using("btree", table.resourceId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
]);

export const mastraMessages = pgTable("mastra_messages", {
	id: text().primaryKey().notNull(),
	threadId: text("thread_id").notNull(),
	content: text().notNull(),
	role: text().notNull(),
	type: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	resourceId: text(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_messages_thread_id_createdat_idx").using("btree", table.threadId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
]);

export const mastraScorers = pgTable("mastra_scorers", {
	id: text().primaryKey().notNull(),
	scorerId: text().notNull(),
	traceId: text(),
	spanId: text(),
	runId: text().notNull(),
	scorer: jsonb().notNull(),
	preprocessStepResult: jsonb(),
	extractStepResult: jsonb(),
	analyzeStepResult: jsonb(),
	score: doublePrecision().notNull(),
	reason: text(),
	metadata: jsonb(),
	preprocessPrompt: text(),
	extractPrompt: text(),
	generateScorePrompt: text(),
	generateReasonPrompt: text(),
	analyzePrompt: text(),
	reasonPrompt: text(),
	input: jsonb().notNull(),
	output: jsonb().notNull(),
	additionalContext: jsonb(),
	runtimeContext: jsonb(),
	entityType: text(),
	entity: jsonb(),
	entityId: text(),
	source: text().notNull(),
	resourceId: text(),
	threadId: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_scores_trace_id_span_id_created_at_idx").using("btree", table.traceId.asc().nullsLast().op("text_ops"), table.spanId.asc().nullsLast().op("timestamp_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
]);

export const mastraAiSpans = pgTable("mastra_ai_spans", {
	traceId: text().notNull(),
	spanId: text().notNull(),
	parentSpanId: text(),
	name: text().notNull(),
	scope: jsonb(),
	spanType: text().notNull(),
	attributes: jsonb(),
	metadata: jsonb(),
	links: jsonb(),
	input: jsonb(),
	output: jsonb(),
	error: jsonb(),
	startedAt: timestamp({ mode: 'string' }).notNull(),
	endedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }),
	isEvent: boolean().notNull(),
	startedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	endedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	createdAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAtZ: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("public_mastra_ai_spans_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("public_mastra_ai_spans_parentspanid_startedat_idx").using("btree", table.parentSpanId.asc().nullsLast().op("text_ops"), table.startedAt.desc().nullsFirst().op("timestamp_ops")),
	index("public_mastra_ai_spans_spantype_startedat_idx").using("btree", table.spanType.asc().nullsLast().op("timestamp_ops"), table.startedAt.desc().nullsFirst().op("timestamp_ops")),
	index("public_mastra_ai_spans_traceid_startedat_idx").using("btree", table.traceId.asc().nullsLast().op("timestamp_ops"), table.startedAt.desc().nullsFirst().op("text_ops")),
]);

