#!/bin/bash

# ==============================================================================
# RGGAMER Panel - Start with Auto-Update Check on Restart
# ==============================================================================

cd "$(dirname "$0")/.." || exit 1

echo "[RGGAMER Panel] Checking for updates from repository on restart..."

REPO_URL="https://github.com/RG1GAMER/PERSNOLY-PANEL3.git"

if command -v git &> /dev/null && [ -d ".git" ]; then
    # Ensure remote points to RG1GAMER repo
    git remote set-url origin "$REPO_URL" 2>/dev/null || true
    
    # Fetch latest remote changes quietly
    git fetch origin main 2>/dev/null || git fetch origin master 2>/dev/null || git fetch "$REPO_URL" 2>/dev/null || true
    
    LOCAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git rev-parse @{u} 2>/dev/null || echo "")

    if [ -n "$LOCAL_COMMIT" ] && [ -n "$REMOTE_COMMIT" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        echo "[RGGAMER Panel] Updates detected ($LOCAL_COMMIT -> $REMOTE_COMMIT)! Pulling changes from $REPO_URL..."
        git pull --ff-only origin main 2>/dev/null || git pull --ff-only origin master 2>/dev/null || git pull "$REPO_URL" main 2>/dev/null || git pull || true
        
        echo "[RGGAMER Panel] Installing updated dependencies..."
        npm install --no-audit --no-fund || true
        
        echo "[RGGAMER Panel] Compiling production build..."
        npm run build || true
        echo "[RGGAMER Panel] Update successfully applied!"
    else
        echo "[RGGAMER Panel] Panel is up-to-date (commit: ${LOCAL_COMMIT:0:7})."
    fi
else
    echo "[RGGAMER Panel] Git repository not detected or git command unavailable, skipping auto-pull."
fi

# Ensure dist exists
if [ ! -f "dist/server.cjs" ]; then
    echo "[RGGAMER Panel] Compiling initial build..."
    npm run build
fi

echo "[RGGAMER Panel] Launching RGGAMER Server Management Panel..."
exec node dist/server.cjs
