#!/bin/bash

set -e  # Exit on error

echo "🚀 Astra Setup Script"
echo "===================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "app" ]; then
    echo -e "${RED}❌ Error: Please run this script from the astra project root${NC}"
    exit 1
fi

# Check if .env file exists in app directory
if [ ! -f "app/.env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f "app/.env.example" ]; then
        cp app/.env.example app/.env
        echo -e "${GREEN}✓ Created app/.env${NC}"
    else
        echo -e "${RED}❌ Error: app/.env.example not found${NC}"
        exit 1
    fi
fi

# Check for required environment variables
echo "📋 Checking environment variables..."
source app/.env 2>/dev/null || true

if [ -z "$JULEP_API_KEY" ]; then
    echo -e "${RED}❌ Error: JULEP_API_KEY not set in app/.env${NC}"
    echo "   Please add your Julep API key to app/.env:"
    echo "   JULEP_API_KEY=your_key_here"
    exit 1
fi

if [ -z "$MONGODB_URI" ] && ([ -z "$MONGODB_USERNAME" ] || [ -z "$MONGODB_PASSWORD" ]); then
    echo -e "${YELLOW}⚠️  Warning: MongoDB credentials not fully configured${NC}"
    echo "   Please ensure MongoDB connection is set up in app/.env"
fi

if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  Warning: ELEVENLABS_API_KEY not set${NC}"
    echo "   You'll need this for voice conversations"
fi

echo -e "${GREEN}✓ Environment variables checked${NC}"
echo ""

# Change to app directory
cd app

# Install dependencies
echo "📦 Installing dependencies..."
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Error: Bun not found. Please install Bun first:${NC}"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

bun install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Sync agents to Julep
echo "🤖 Syncing agents to Julep..."
echo "   This will create/update the Background Worker agent..."
echo ""

if bun run sync:agents; then
    echo ""
    echo -e "${GREEN}✓ Agents synced successfully!${NC}"
    echo ""

    # Extract agent ID from julep-lock.json
    if [ -f "../julep-lock.json" ]; then
        AGENT_ID=$(node -e "console.log(require('../julep-lock.json').agents['Astra Background Worker'] || '')")

        if [ -n "$AGENT_ID" ]; then
            echo -e "${GREEN}✓ Found agent ID: ${AGENT_ID}${NC}"

            # Update .env file with agent ID
            if grep -q "BACKGROUND_WORKER_AGENT_ID=" .env; then
                # Update existing line
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    sed -i '' "s/BACKGROUND_WORKER_AGENT_ID=.*/BACKGROUND_WORKER_AGENT_ID=${AGENT_ID}/" .env
                else
                    # Linux
                    sed -i "s/BACKGROUND_WORKER_AGENT_ID=.*/BACKGROUND_WORKER_AGENT_ID=${AGENT_ID}/" .env
                fi
                echo -e "${GREEN}✓ Updated BACKGROUND_WORKER_AGENT_ID in .env${NC}"
            else
                # Add new line
                echo "" >> .env
                echo "# Julep Background Worker Agent ID (auto-generated)" >> .env
                echo "BACKGROUND_WORKER_AGENT_ID=${AGENT_ID}" >> .env
                echo -e "${GREEN}✓ Added BACKGROUND_WORKER_AGENT_ID to .env${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Could not extract agent ID from julep-lock.json${NC}"
            echo "   Please add it manually to app/.env"
        fi
    else
        echo -e "${YELLOW}⚠️  julep-lock.json not found${NC}"
        echo "   Please check the sync output above for the agent ID"
    fi
else
    echo ""
    echo -e "${RED}❌ Agent sync failed${NC}"
    echo "   Please check the error messages above"
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Review your app/.env file and ensure all required variables are set"
echo "2. Start the development server:"
echo "   cd app && bun run dev"
echo ""
echo "3. Test the transcript processing API:"
echo "   curl -X POST http://localhost:3000/api/tasks/transcript \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"conversation_id\": \"your_conversation_id\"}'"
echo ""
echo "For more information, see docs/IMPLEMENTATION_CHECKLIST.md"
echo ""
