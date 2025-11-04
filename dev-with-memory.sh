#!/bin/bash
# Run Raycast dev server with increased memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
