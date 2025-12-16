# Project Cleanup Analysis Report

**Generated:** $(date)  
**Scope:** Full project scan for duplicates, legacy code, and unused files

---

## Executive Summary

This report identifies:
- **8 files/directories** safe to remove
- **5 files** needing review/refactoring
- **3 empty directories** to clean up
- **2 documentation files** with outdated references
- **Multiple duplicate schema/config files** with different purposes (KEEP - serve different needs)

---

## [REMOVE] - Safe to Delete

### 1. Empty Files
- **`src/db/client.ts`** - Empty file, imported by unused auth module
- **`src/mastra/memory/`** - Empty directory (no files)
- **`my-app/src/config/`** - Empty directory (no files)

### 2. Unused Legacy Auth Module
- **`src/db/auth/auth.ts`** - Better Auth config not used by my-app
  - Imports empty `src/db/client.ts`
  - my-app uses its own auth implementation in `my-app/src/auth/index.ts`
  - **Conflict:** Uses different schema (`src/db/schema/auth.ts`) than my-app

### 3. Unused Server File
- **`my-app/src/server.ts`** - Legacy server implementation
  - **Replaced by:** `my-app/src/index.ts` (main entry point)
  - **Also exists:** `my-app/src/hono-server.ts` (Mastra-specific server)
  - Not imported anywhere

### 4. Standalone Test Script (Not Imported)
- **`src/index.ts`** - Standalone database test script
  - Not imported by any other file
  - Can be moved to `src/examples/` or removed if no longer needed

### 5. Empty Relations Files
- **`drizzle/relations.ts`** - Empty relations file (only whitespace)
- **`src/db/relations.ts`** - Empty relations file (only comment)
  - Both can be removed or consolidated if no relations are needed

---

## [REFACTOR] - Needs Review/Consolidation

### 1. Duplicate Schema Files (Different Purposes - Review Needed)
- **`schema.sql`** (root) - Documentation for Mastra tables
- **`my-app/schema.sql`** - SQL for auth tables (users, sessions)
- **`drizzle/schema.ts`** - Mastra tables (auto-generated)
- **`src/db/schema.ts`** - Mastra tables (source of truth)
- **`my-app/src/db/schema.ts`** - Better Auth tables (users, sessions, oauth)
- **`src/db/schema/auth.ts`** - Different Better Auth schema (unused)

**Analysis:**
- Root `schema.sql` is documentation only - **KEEP**
- `my-app/schema.sql` is SQL migration - **KEEP** (or migrate to drizzle)
- `drizzle/schema.ts` is auto-generated - **KEEP** (don't edit)
- `src/db/schema.ts` is Mastra schema - **KEEP**
- `my-app/src/db/schema.ts` is Better Auth schema - **KEEP**
- `src/db/schema/auth.ts` is unused legacy - **REMOVE**

### 2. Duplicate Drizzle Configs (Both Needed)
- **`drizzle.config.ts`** (root) - Points to `src/db/schema.ts`
- **`my-app/drizzle.config.ts`** - Points to `my-app/src/db/schema.ts`

**Status:** Both serve different schemas - **KEEP BOTH**

### 3. Documentation with Outdated References
- **`MESSAGE_STORAGE_ANALYSIS.md`** - References non-existent `chatService.ts`
  - Line 12: References `chatService.ts` (doesn't exist)
  - Line 271: References `my-app/src/services/chatService.ts` (doesn't exist)
  - **Action:** Update to reference `memoryService.ts` instead

---

## [CHECK] - Verify Before Removing

### 1. Database Files (LibSQL)
- **`memory-storage.db`** - LibSQL database file
- **`memory-storage.db-shm`** - LibSQL shared memory
- **`memory-storage.db-wal`** - LibSQL write-ahead log
- **`storage.db`** - Another LibSQL database file

**Status:** May be needed for local development. Check if using PostgreSQL in production.
- If using PostgreSQL: Can add to `.gitignore` and remove
- If using LibSQL: Keep but add to `.gitignore`

### 2. Examples Directory
- **`src/examples/`** - Test/example scripts
  - `conversationDemo.ts` - Not imported
  - `sanityTest.ts` - Not imported
  - `testDbConnection.ts` - Not imported

**Status:** Useful for testing/debugging. **KEEP** but consider moving to `scripts/` or documenting usage.

### 3. Template Agents (ACTIVELY USED)
- **`template-agents/`** - All files imported by `src/mastra/index.ts`
  - ✅ `researchWorkflow.ts` - Used
  - ✅ `learningExtractionAgent.ts` - Used
  - ✅ `evaluationAgent.ts` - Used
  - ✅ `reportAgent.ts` - Used
  - ✅ `researchAgent.ts` - Used
  - ✅ `webSummarizationAgent.ts` - Used
  - ✅ `generateReportWorkflow.ts` - Used

**Status:** **KEEP** - All actively used

---

## [KEEP] - Active Files (Do Not Remove)

### Active Services
- ✅ `my-app/src/services/memoryService.ts` - Used by routes
- ✅ `my-app/src/services/workingMemoryService.ts` - Used by routes
- ✅ `my-app/src/services/userService.ts` - Used by routes

### Active Routes
- ✅ `my-app/src/routes/agent.ts` - Agent API endpoints
- ✅ `my-app/src/routes/api.ts` - General API endpoints
- ✅ `my-app/src/routes/auth.ts` - Auth routes

### Active Config
- ✅ `src/mastra/config/` - All config files actively used
- ✅ `my-app/src/db/drizzle.ts` - Database client
- ✅ `my-app/src/db/migrate.ts` - Migration script

### Active Agents/Workflows
- ✅ `src/mastra/agents/` - All agents used
- ✅ `src/mastra/workflows/` - All workflows used
- ✅ `src/mastra/tools/` - All tools used

---

## Detailed File Analysis

### Duplicate Patterns Found

#### Pattern 1: Auth Implementations
```
src/db/auth/auth.ts          [REMOVE] - Unused Better Auth config
src/db/schema/auth.ts        [REMOVE] - Unused schema
my-app/src/auth/index.ts     [KEEP] - Active Better Auth implementation
my-app/src/db/schema.ts      [KEEP] - Active Better Auth schema
```

#### Pattern 2: Server Entry Points
```
my-app/src/index.ts          [KEEP] - Main entry point
my-app/src/hono-server.ts    [KEEP] - Mastra server
my-app/src/server.ts         [REMOVE] - Unused legacy
```

#### Pattern 3: Database Clients
```
src/db/client.ts            [REMOVE] - Empty file
src/db/postgres.ts           [KEEP] - Active PostgreSQL pool
my-app/src/db/drizzle.ts     [KEEP] - Active Drizzle client
```

#### Pattern 4: Relations Files
```
drizzle/relations.ts         [REMOVE] - Empty
src/db/relations.ts         [REMOVE] - Empty (only comment)
```

---

## Import Dependency Analysis

### Files Importing from Root `src/`
- `my-app/src/services/memoryService.ts` → `../../../src/mastra/config/`
- `my-app/src/services/workingMemoryService.ts` → `../../../src/mastra/config/storage.js`
- `my-app/src/index.ts` → `../../src/db/postgres.js`, `../../src/mastra/config/config.js`
- `my-app/src/mastra.ts` → `../../src/mastra/config/`
- `my-app/src/agents/chatAgent.ts` → `../../../src/mastra/config/memory.js`
- `my-app/src/utils/auth.ts` → `../../../src/mastra/config/config.js`
- `my-app/src/hono-server.ts` → `../../src/mastra/config/config.js`

**Conclusion:** Root `src/` directory is actively used by `my-app/` - **KEEP**

### Files NOT Imported Anywhere
- `src/index.ts` - Standalone script
- `src/db/auth/auth.ts` - Unused module
- `src/db/client.ts` - Empty file
- `my-app/src/server.ts` - Unused server

---

## Recommended Actions

### Phase 1: Safe Removals (No Breaking Changes)
1. Delete empty files:
   - `src/db/client.ts`
   - `drizzle/relations.ts` (or keep if planning to add relations)
   - `src/db/relations.ts` (or keep if planning to add relations)

2. Delete empty directories:
   - `src/mastra/memory/`
   - `my-app/src/config/`

3. Delete unused files:
   - `src/db/auth/auth.ts`
   - `src/db/schema/auth.ts`
   - `my-app/src/server.ts`

### Phase 2: Documentation Updates
1. Update `MESSAGE_STORAGE_ANALYSIS.md`:
   - Replace `chatService.ts` references with `memoryService.ts`
   - Update file paths to match current structure

2. Consider moving `src/index.ts` to `src/examples/` or documenting it

### Phase 3: Database Files (Manual Review)
1. Check if LibSQL files are needed:
   - If using PostgreSQL: Add to `.gitignore`, remove from repo
   - If using LibSQL: Keep but add to `.gitignore`

### Phase 4: Consolidation (Optional)
1. Consider consolidating empty relations files
2. Review if `my-app/schema.sql` should be migrated to Drizzle migrations

---

## Automated Cleanup Script

The following files can be safely deleted:

```bash
# Empty files and directories
rm src/db/client.ts
rm -rf src/mastra/memory/
rm -rf my-app/src/config/

# Unused legacy files
rm src/db/auth/auth.ts
rm src/db/schema/auth.ts
rm my-app/src/server.ts

# Empty relations (optional - keep if planning to add relations)
rm drizzle/relations.ts
rm src/db/relations.ts

# Standalone script (move to examples or remove)
# mv src/index.ts src/examples/db-test.ts  # OR
# rm src/index.ts
```

---

## Files Requiring Manual Review

1. **`MESSAGE_STORAGE_ANALYSIS.md`** - Update references
2. **LibSQL database files** - Decide on `.gitignore` strategy
3. **`src/index.ts`** - Move to examples or remove
4. **`my-app/schema.sql`** - Consider migrating to Drizzle

---

## Summary Statistics

- **Total files scanned:** ~100+
- **Files safe to remove:** 8
- **Files needing review:** 5
- **Empty directories:** 3
- **Documentation updates needed:** 1
- **Duplicate patterns found:** 4 major patterns
- **No Next.js API routes found** (project uses Hono, not Next.js)

---

## Notes

- No Next.js API routes detected (project uses Hono framework)
- Template agents are actively used - do not remove
- Root `src/` directory is shared by `my-app/` - keep structure
- Two separate auth implementations exist (legacy unused vs active)
- Database files may be needed for local development

---

**Report generated by automated analysis**  
**Review recommended before executing deletions**

