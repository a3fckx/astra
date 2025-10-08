# Session Tracking System

Astra uses `SESSION.md` to track work during development sessions.

## Purpose

Instead of creating multiple summary files (RESTRUCTURE_SUMMARY.md, MIGRATION_SUMMARY.md, etc.), we maintain a single `SESSION.md` file that:
- Tracks changes made during the current session
- Documents decisions and notes
- Lists next steps and blockers
- Provides quick command reference

## How It Works

### Starting a Session

```bash
./session.sh start
```

This creates `.sessions/SESSION.md` from `.sessions/template.md`. If SESSION.md exists, it's backed up first.

### During Development

Edit `.sessions/SESSION.md` as you work:
- ✅ Mark completed tasks
- 🚧 Note in-progress work
- 📝 Add notes and decisions
- 🚫 Document blockers

### Ending a Session

```bash
# Backup if you want to keep it (saves with timestamp)
./session.sh backup

# Or clear it (delete completely)
./session.sh clear
```

### Important

- `.sessions/SESSION.md` is **gitignored** (not committed)
- Use it for personal tracking only
- Clear or delete when starting fresh
- Template is at `.sessions/template.md`
- All files are in `.sessions/` directory

## Commands

```bash
./session.sh start   # Create new SESSION.md
./session.sh clear   # Delete SESSION.md
./session.sh backup  # Backup with timestamp
./session.sh view    # View current session
```

## Example Session Workflow

```bash
# 1. Start new work
./session.sh start

# 2. Edit SESSION.md throughout your work
vim SESSION.md

# 3. When done, either backup or clear
./session.sh backup  # Keep a copy
# OR
./session.sh clear   # Delete it

# 4. Commit your code changes
git add .
git commit -m "feat: implement new feature"
```

## Why This Approach?

**Before:**
- Multiple summary files pile up
- Hard to track what's from which session
- Files get committed accidentally

**After:**
- One active session file at a time
- Gitignored, so no accidental commits
- Clear when done, fresh start next time
- Can backup important sessions if needed

## Template Structure

`.session_template.md` includes:
- Session metadata (date, ID, status)
- Goals and objectives
- Changes made section
- Next steps
- Quick commands
- Notes and blockers
- End checklist

Copy and customize as needed for your workflow.
