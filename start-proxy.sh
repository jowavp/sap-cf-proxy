#!/usr/bin/env bash
until npm start; do
    echo "Proxy crashed with exit code $?.  Respawning…" >&2
    sleep 1
done
