#!/usr/bin/env bash
until npm start; do
    echo "Proxy crashed with exit code $?.  Respawningâ€¦" >&2
    sleep 1
done
