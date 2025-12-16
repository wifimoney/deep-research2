#!/bin/bash

# Project Cleanup Script
# Review CLEANUP_REPORT.md before running
# Run with: bash cleanup.sh [--dry-run] [--confirm]

set -e

DRY_RUN=false
CONFIRM=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --confirm)
      CONFIRM=true
      shift
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--dry-run] [--confirm]"
      exit 1
      ;;
  esac
done

echo "=========================================="
echo "Project Cleanup Script"
echo "=========================================="
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "🔍 DRY RUN MODE - No files will be deleted"
  echo ""
fi

# Files to remove (safe deletions)
FILES_TO_REMOVE=(
  "src/db/client.ts"
  "src/db/auth/auth.ts"
  "src/db/schema/auth.ts"
  "my-app/src/server.ts"
  "drizzle/relations.ts"
  "src/db/relations.ts"
)

# Directories to remove (empty)
DIRS_TO_REMOVE=(
  "src/mastra/memory"
  "my-app/src/config"
)

# Function to check if file exists and remove it
remove_file() {
  local file="$1"
  if [ -f "$file" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would remove: $file"
    else
      rm "$file"
      echo "  ✅ Removed: $file"
    fi
  else
    echo "  ⚠️  Not found (may already be removed): $file"
  fi
}

# Function to check if directory exists and remove it
remove_dir() {
  local dir="$1"
  if [ -d "$dir" ]; then
    if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "  [DRY RUN] Would remove empty directory: $dir"
      else
        rmdir "$dir"
        echo "  ✅ Removed empty directory: $dir"
      fi
    else
      echo "  ⚠️  Directory not empty: $dir"
    fi
  else
    echo "  ⚠️  Directory not found: $dir"
  fi
}

# Confirm before proceeding (unless --confirm flag is set)
if [ "$DRY_RUN" = false ] && [ "$CONFIRM" = false ]; then
  echo "⚠️  WARNING: This will delete files!"
  echo ""
  echo "Files to be removed:"
  for file in "${FILES_TO_REMOVE[@]}"; do
    echo "  - $file"
  done
  echo ""
  echo "Directories to be removed:"
  for dir in "${DIRS_TO_REMOVE[@]}"; do
    echo "  - $dir"
  done
  echo ""
  read -p "Continue? (yes/no): " response
  if [ "$response" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

echo "Removing files..."
echo "-------------------"
for file in "${FILES_TO_REMOVE[@]}"; do
  remove_file "$file"
done

echo ""
echo "Removing empty directories..."
echo "-------------------------------"
for dir in "${DIRS_TO_REMOVE[@]}"; do
  remove_dir "$dir"
done

echo ""
echo "=========================================="
if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry run complete - no files were deleted"
  echo "Run with --confirm to actually delete files"
else
  echo "✅ Cleanup complete!"
fi
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review CLEANUP_REPORT.md for manual actions"
echo "2. Update MESSAGE_STORAGE_ANALYSIS.md (references outdated files)"
echo "3. Consider moving src/index.ts to src/examples/ or removing it"
echo "4. Review LibSQL database files (.db, .db-shm, .db-wal) - add to .gitignore if needed"

