#!/usr/bin/env bash
until npm run start:sshtunnel; do
    echo "SSH-tunnel crashed with exit code $?.  Respawningâ€¦" >&2
    sleep 1
done
