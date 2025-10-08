#!/bin/bash
# Session management helper script

SESSION_DIR=".sessions"
SESSION_FILE="${SESSION_DIR}/SESSION.md"
TEMPLATE_FILE="${SESSION_DIR}/template.md"

# Create sessions directory if it doesn't exist
mkdir -p "$SESSION_DIR"

case "$1" in
  start)
    echo "Starting new session..."
    if [ -f "$SESSION_FILE" ]; then
      echo "⚠️  SESSION.md already exists. Backing up to SESSION.backup.md"
      mv "$SESSION_FILE" "${SESSION_DIR}/SESSION.backup.md"
    fi
    cp "$TEMPLATE_FILE" "$SESSION_FILE"
    echo "✅ Created .sessions/SESSION.md from template"
    echo "📝 Edit .sessions/SESSION.md to track your work"
    ;;

  clear)
    echo "Clearing session..."
    if [ -f "$SESSION_FILE" ]; then
      rm "$SESSION_FILE"
      echo "✅ .sessions/SESSION.md cleared"
    else
      echo "ℹ️  No SESSION.md to clear"
    fi
    ;;

  backup)
    if [ -f "$SESSION_FILE" ]; then
      timestamp=$(date +%Y%m%d_%H%M%S)
      mv "$SESSION_FILE" "${SESSION_DIR}/SESSION_${timestamp}.md"
      echo "✅ Backed up to .sessions/SESSION_${timestamp}.md"
    else
      echo "ℹ️  No SESSION.md to backup"
    fi
    ;;

  view)
    if [ -f "$SESSION_FILE" ]; then
      cat "$SESSION_FILE"
    else
      echo "ℹ️  No SESSION.md found"
    fi
    ;;

  edit)
    if [ -f "$SESSION_FILE" ]; then
      ${EDITOR:-vim} "$SESSION_FILE"
    else
      echo "ℹ️  No SESSION.md found. Run './session.sh start' first."
    fi
    ;;

  *)
    echo "Session Management Helper"
    echo ""
    echo "Usage: ./session.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start   - Create SESSION.md from template (backs up existing)"
    echo "  clear   - Delete SESSION.md"
    echo "  backup  - Backup SESSION.md with timestamp"
    echo "  view    - View current SESSION.md"
    echo "  edit    - Edit SESSION.md in your editor"
    echo ""
    echo "Files are stored in .sessions/ directory (gitignored)."
    ;;
esac
