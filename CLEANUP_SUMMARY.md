# Cleanup Summary - Exact Paths

## [REMOVE] - Safe to Delete

### Empty Files
```
src/db/client.ts
```

### Empty Directories
```
src/mastra/memory/
my-app/src/config/
```

### Unused Legacy Files
```
src/db/auth/auth.ts                    # Unused Better Auth config (my-app has its own)
src/db/schema/auth.ts                  # Unused auth schema
my-app/src/server.ts                    # Unused server (replaced by index.ts)
drizzle/relations.ts                   # Empty relations file
src/db/relations.ts                    # Empty relations file (only comment)
```

### Standalone Script (Not Imported)
```
src/index.ts                           # Standalone DB test script (move to examples/ or remove)
```

---

## [REFACTOR] - Needs Review

### Documentation Updates Needed
```
MESSAGE_STORAGE_ANALYSIS.md            # References non-existent chatService.ts
  - Line 12: chatService.ts (doesn't exist)
  - Line 271: my-app/src/services/chatService.ts (doesn't exist)
  - Action: Update to reference memoryService.ts
```

### Schema Files (Different Purposes - Review)
```
schema.sql                              # [KEEP] Documentation for Mastra tables
my-app/schema.sql                       # [KEEP] SQL for auth tables
drizzle/schema.ts                       # [KEEP] Auto-generated Mastra schema
src/db/schema.ts                        # [KEEP] Source Mastra schema
my-app/src/db/schema.ts                 # [KEEP] Active Better Auth schema
src/db/schema/auth.ts                   # [REMOVE] Unused legacy auth schema
```

---

## [CHECK] - Verify Before Removing

### Database Files (LibSQL)
```
memory-storage.db                       # Check if needed for local dev
memory-storage.db-shm                   # Check if needed for local dev
memory-storage.db-wal                   # Check if needed for local dev
storage.db                              # Check if needed for local dev
```
**Action:** Add to `.gitignore` if using PostgreSQL in production

### Examples Directory (Not Imported but Useful)
```
src/examples/conversationDemo.ts        # [KEEP] Useful for testing
src/examples/sanityTest.ts              # [KEEP] Useful for testing
src/examples/testDbConnection.ts        # [KEEP] Useful for testing
```

---

## [KEEP] - Active Files (Do Not Remove)

### Template Agents (All Imported by src/mastra/index.ts)
```
template-agents/researchWorkflow.ts
template-agents/learningExtractionAgent.ts
template-agents/evaluationAgent.ts
template-agents/reportAgent.ts
template-agents/researchAgent.ts
template-agents/webSummarizationAgent.ts
template-agents/generateReportWorkflow.ts
```

### Active Services
```
my-app/src/services/memoryService.ts
my-app/src/services/workingMemoryService.ts
my-app/src/services/userService.ts
```

### Active Routes
```
my-app/src/routes/agent.ts
my-app/src/routes/api.ts
my-app/src/routes/auth.ts
```

### Active Config Files
```
src/mastra/config/config.ts
src/mastra/config/memory.ts
src/mastra/config/rag.ts
src/mastra/config/storage.ts
```

### Active Database Files
```
src/db/postgres.ts                     # PostgreSQL pool
my-app/src/db/drizzle.ts               # Drizzle client
my-app/src/db/migrate.ts                # Migration script
my-app/src/db/schema.ts                 # Better Auth schema
src/db/schema.ts                       # Mastra schema
```

### Active Entry Points
```
my-app/src/index.ts                    # Main entry point
my-app/src/hono-server.ts              # Mastra server
```

---

## Conflicts with Newer Implementations

### Auth Implementation Conflict
```
OLD (Unused):
  src/db/auth/auth.ts                  # Better Auth config
  src/db/schema/auth.ts                # Different schema

NEW (Active):
  my-app/src/auth/index.ts             # Better Auth implementation
  my-app/src/db/schema.ts              # Better Auth schema
```

### Server Implementation Conflict
```
OLD (Unused):
  my-app/src/server.ts                 # Legacy server

NEW (Active):
  my-app/src/index.ts                  # Main entry point
  my-app/src/hono-server.ts           # Mastra server
```

---

## Redundant Duplicates (Choose Preferred Version)

### Relations Files (Both Empty)
```
Preferred: Remove both (no relations defined)
Alternative: Keep one (drizzle/relations.ts) for future use

drizzle/relations.ts                   # Empty
src/db/relations.ts                    # Empty (only comment)
```

### Database Client Files
```
Preferred: src/db/postgres.ts          # Active PostgreSQL pool
Remove: src/db/client.ts               # Empty file

src/db/postgres.ts                     # [KEEP] Active
src/db/client.ts                       # [REMOVE] Empty
```

---

## Unused Libraries / Orphaned Imports

### No Unused Libraries Found
All dependencies in `package.json` and `my-app/package.json` appear to be used.

### Orphaned Imports Found
```
src/db/auth/auth.ts                    # Imports empty src/db/client.ts
  → Remove both files
```

---

## Old Backend Services

### No Old Services Found
- ✅ No `agentService.ts` found
- ✅ No `chatService.ts` found (referenced in docs but doesn't exist)
- ✅ `memoryService.ts` is active and used
- ✅ `workingMemoryService.ts` is active and used
- ✅ `userService.ts` is active and used

---

## Old Docker Configs or Env Files

### No Docker Files Found
- ✅ No `Dockerfile` found
- ✅ No `docker-compose.yml` found
- ✅ No `.dockerignore` found

### Env Files
```
rag.env.example                         # [KEEP] Example env file
.env                                    # [KEEP] Local env (should be in .gitignore)
```

---

## Directories Not Referenced by Imports

### Empty Directories (Safe to Remove)
```
src/mastra/memory/                      # Empty directory
my-app/src/config/                      # Empty directory
```

### Directories with Unimported Files (Review)
```
src/examples/                           # Not imported but useful for testing
  → Keep but consider documenting usage
```

---

## Automated Fixes Available

### Script: cleanup.sh
```bash
# Dry run (preview changes)
bash cleanup.sh --dry-run

# Execute cleanup
bash cleanup.sh --confirm
```

### Manual Actions Required
1. Update `MESSAGE_STORAGE_ANALYSIS.md`:
   - Replace `chatService.ts` → `memoryService.ts`
   - Update file paths

2. Review `src/index.ts`:
   - Move to `src/examples/db-test.ts` OR
   - Remove if no longer needed

3. Database files:
   - Add `.db`, `.db-shm`, `.db-wal` to `.gitignore` if using PostgreSQL

---

## Summary Statistics

- **Files safe to remove:** 8
- **Empty directories:** 2
- **Files needing review:** 5
- **Documentation updates:** 1
- **No Next.js API routes** (uses Hono)
- **No Docker configs**
- **No unused libraries**

---

## Quick Reference: File Status

| Path | Status | Action |
|------|--------|--------|
| `src/db/client.ts` | Empty | REMOVE |
| `src/db/auth/auth.ts` | Unused | REMOVE |
| `src/db/schema/auth.ts` | Unused | REMOVE |
| `my-app/src/server.ts` | Unused | REMOVE |
| `drizzle/relations.ts` | Empty | REMOVE |
| `src/db/relations.ts` | Empty | REMOVE |
| `src/mastra/memory/` | Empty dir | REMOVE |
| `my-app/src/config/` | Empty dir | REMOVE |
| `src/index.ts` | Standalone | MOVE/REMOVE |
| `MESSAGE_STORAGE_ANALYSIS.md` | Outdated refs | UPDATE |
| `template-agents/*` | Active | KEEP |
| `src/examples/*` | Useful | KEEP |

---

**Review CLEANUP_REPORT.md for detailed analysis**  
**Run cleanup.sh for automated cleanup**

