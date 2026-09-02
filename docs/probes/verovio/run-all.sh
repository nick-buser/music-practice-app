#!/bin/sh
# Re-runs every experiment against app/node_modules/verovio (4.5.1) and writes results.txt beside this script.
cd "$(dirname "$0")"
: > results.txt
for f in exp*.mjs; do
  echo "##### $f" >> results.txt
  node "$f" >> results.txt 2>&1
  echo >> results.txt
done
echo "wrote $(pwd)/results.txt ($(wc -l < results.txt) lines)"
