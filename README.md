# Breach Intelligence Research Assistant

AI-powered security research system using Mastra. Generates professional, PDF-ready breach intelligence reports with RAG-augmented analysis.

## Features

- **RAG-Enhanced Analysis** - Queries historical breach data for context
- **Working Memory** - Tracks research journey across workflow steps
- **Dual Storage** - PostgreSQL (production) or LibSQL (local)
- **Vector Search** - Semantic similarity via PgVector/LibSQLVector
- **PDF-Ready Reports** - 5-section security intelligence format
- **Web Research** - Automated CVE/breach lookup via Exa API

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env
# Add: OPENAI_API_KEY, EXASEARCH_API_KEY

# Run
pnpm dev
```

## How It Works

```
1. User Input → "Analyze the Snowflake breach"
        │
2. RAG Query → Search historical breaches for similar incidents
        │
3. Web Research → Fetch latest CVEs, advisories, threat intel
        │
4. Working Memory → Accumulate findings + context
        │
5. Report Generation → PDF-ready 5-section report
        │
6. RAG Storage → Persist for future queries
```

## Report Structure

| Section | Contents |
|---------|----------|
| **1. Executive Summary** | Non-technical overview, key insights |
| **2. Technical Analysis** | Attack chain, root cause, exploit path |
| **3. Recommended Solutions** | Immediate → Short-term → Long-term fixes |
| **4. Research Journey** | Memory-driven reasoning, sources |
| **5. Final Recommendations** | Prioritized action plan |

### Solution Categories

- **A.** Immediate Fixes (0-48h) - Patches, containment, credential rotation
- **B.** Short-Term (1-2 weeks) - Hardening, logging, policy updates
- **C.** Long-Term (1-3 months) - Architecture, zero-trust, identity overhaul
- **D.** Automation - Detection agents, scanning workflows
- **E.** Predictions - Attack evolution, sector threats

## Architecture

```
Agents                    Tools                   Storage
──────                    ─────                   ───────
breachIntelAgent    →     ragTools          →     PgVector
webResearcherAgent  →     webSearchTool     →     PostgresStore
reportFormatter     →     workingMemoryTools      LibSQLVector
ragEnhancedAgent                                  LibSQLStore
```

## RAG Collections

| Collection | Data |
|------------|------|
| `breach_reports` | Historical breach analyses |
| `cve_intelligence` | CVE details & vulnerabilities |
| `threat_actors` | Threat actor profiles |
| `security_advisories` | Security bulletins |
| `mitre_attack_ttps` | MITRE ATT&CK mappings |
| `indicators_of_compromise` | IOCs |

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
EXASEARCH_API_KEY=...

# Optional
DATABASE_URL=file:./storage.db    # or postgresql://...
MODEL=openai/gpt-4o
EMBEDDINGS_MODEL=text-embedding-3-small
RAG_TOP_K=5
```

## Commands

```bash
pnpm dev              # Start Mastra dev server
pnpm build            # Build for production
pnpm start            # Run production build

# Testing
npx tsx src/examples/sanityTest.ts      # Full system test
npx tsx src/examples/testDbConnection.ts # DB connectivity
npx tsx src/mastra/scripts/seedRAG.ts    # Seed sample data
```

## Storage Modes

| `DATABASE_URL` | Storage | Vector |
|----------------|---------|--------|
| `postgresql://...` | PostgresStore | PgVector |
| `file:./storage.db` | LibSQLStore | LibSQLVector |

Auto-detected at startup. PostgreSQL recommended for production.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EXA_API_KEY not found` | Add to `.env`, restart server |
| `Model not found` | Use format `openai/gpt-4o` |
| Research too slow | Reduce `MAX_RESEARCH_STEPS` |
| DB connection error | Check `DATABASE_URL` format |

## Documentation

- [Technical Documentation](./TECHNICAL.md) - Architecture, API reference, data flow
- [Schema](./schema.sql) - Database schema for PostgreSQL

## License

Apache-2.0
