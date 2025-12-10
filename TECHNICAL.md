# Technical Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mastra Core                              │
├─────────────────────────────────────────────────────────────────┤
│  Workflows          │  Agents              │  Storage            │
│  ─────────          │  ──────              │  ───────            │
│  breachReportWF     │  breachIntelAgent    │  PostgresStore      │
│  researchWorkflow   │  webResearcherAgent  │  LibSQLStore        │
│  generateReportWF   │  reportFormatter     │                     │
│                     │  ragEnhancedAgent    │  PgVector           │
│                     │  workingMemoryAgent  │  LibSQLVector       │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agents

| Agent | Purpose | Tools |
|-------|---------|-------|
| `breachIntelAgent` | PDF-ready security reports | RAG tools, HTTP fetch |
| `webResearcherAgent` | Web research & CVE lookup | Web search, RAG retrieval |
| `reportFormatterAgent` | Professional report formatting | RAG tools |
| `ragEnhancedBreachIntelAgent` | RAG-augmented analysis | RAG retrieval, similarity search |
| `workingMemoryResearchAgent` | Context-aware research | Working memory tools |

### 2. RAG System

**Collections** (`src/mastra/config/rag.ts`):
- `breach_reports` - Historical breach analyses
- `cve_intelligence` - CVE data and vulnerabilities
- `threat_actors` - Threat actor profiles
- `security_advisories` - Security bulletins
- `mitre_attack_ttps` - MITRE ATT&CK mappings
- `indicators_of_compromise` - IOCs

**Tools** (`src/mastra/tools/ragTools.ts`):
```typescript
storeBreachIntelTool     // Store documents
retrieveBreachIntelTool  // Semantic search
findSimilarThreatsTool   // Similarity matching
```

### 3. Memory System

**Working Memory** (`src/mastra/memory/workingMemory.ts`):
- Tracks research progress, findings, queries
- Provides context to agents between steps
- Persists across workflow suspensions

**Semantic Memory** (`src/mastra/config/memory.ts`):
- Vector-based recall of similar conversations
- Auto-embeds messages for future retrieval
- Shared across agents via `analysisMemory`

### 4. Storage Backends

Auto-detected via `DATABASE_URL`:

| URL Prefix | Storage | Vector Store |
|------------|---------|--------------|
| `postgresql://` | PostgresStore | PgVector |
| `file:` / `libsql:` | LibSQLStore | LibSQLVector |

## Data Flow

```
User Input
    │
    ▼
┌──────────────────┐
│ breachReportWF   │ ◄── Workflow orchestration
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────────┐
│ RAG   │  │ Web       │ ◄── Parallel research
│ Query │  │ Search    │
└───┬───┘  └─────┬─────┘
    │            │
    └─────┬──────┘
          ▼
┌──────────────────┐
│ Working Memory   │ ◄── Context accumulation
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ breachIntelAgent │ ◄── Report generation
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ RAG Store        │ ◄── Persist for future queries
└──────────────────┘
```

## Key Files

```
src/mastra/
├── index.ts                    # Mastra instance & registration
├── config/
│   ├── rag.ts                  # Vector store & RAG functions
│   └── memory.ts               # Semantic memory configuration
├── agents/
│   ├── breachIntelAgent.ts     # Main analysis agent
│   ├── webResearcherAgent.ts   # Web research agent
│   └── ragEnhancedBreachIntelAgent.ts
├── tools/
│   ├── ragTools.ts             # RAG CRUD tools
│   ├── webSearchTool.ts        # Exa search integration
│   └── workingMemoryTools.ts   # Memory management
├── memory/
│   └── workingMemory.ts        # Working memory class
├── workflows/
│   └── breachReportWorkflow.ts # Main workflow
└── scripts/
    └── seedRAG.ts              # Seed sample data
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `EXASEARCH_API_KEY` | Yes | - | Exa search API key |
| `DATABASE_URL` | No | `file:./storage.db` | Storage connection |
| `MODEL` | No | `openai/gpt-4o` | LLM model |
| `EMBEDDINGS_MODEL` | No | `text-embedding-3-small` | Embedding model |
| `RAG_TOP_K` | No | `5` | Results per RAG query |
| `RAG_MIN_SCORE` | No | `0` | Minimum similarity score |

## Report Structure

Generated reports include:

1. **Executive Summary** - Non-technical overview
2. **Technical Analysis** - Attack chain, root cause, exploits
3. **Recommended Solutions**
   - A. Immediate Fixes (0-48h)
   - B. Short-Term (1-2 weeks)
   - C. Long-Term Strategic (1-3 months)
   - D. Automation Opportunities
   - E. Trend Predictions
4. **Working Memory & Research Journey**
5. **Final Recommendations**

## API Reference

### RAG Functions

```typescript
// Store documents
await breachIntelMemory.add({
  collection: 'breach_reports',
  documents: [{ content: '...', metadata: {...} }]
});

// Search documents
const results = await breachIntelMemory.search({
  collection: 'breach_reports',
  query: 'ransomware healthcare',
  topK: 5,
  minScore: 0.7
});

// Initialize collections
await breachIntelMemory.initialize();
```

### Working Memory

```typescript
const memory = new WorkingMemory(sessionId);

memory.addQuery('search query');
memory.addFinding({ title, content, url, relevance });
memory.getContextForAgent(); // Returns formatted context
memory.getStats(); // Returns { findings, queries, urls, duration }
```

## Testing

```bash
# Test database connection
npx tsx src/examples/testDbConnection.ts

# Run sanity tests
npx tsx src/examples/sanityTest.ts

# Seed RAG with sample data
npx tsx src/mastra/scripts/seedRAG.ts
```
