#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Install Python dependencies for the AI image search engine
echo "Installing Python dependencies..."
python3 -m pip install -r artifacts/api-server/python_scripts/requirements.txt --quiet --disable-pip-version-check
echo "Python dependencies installed"

# Push DB schema if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter db push
fi
