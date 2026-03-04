#!/bin/bash
tail -n 20 ~/.npm/_logs/*-debug-0.log 2>/dev/null || true
ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | xargs -I {} lsof -p {} | grep tmp
