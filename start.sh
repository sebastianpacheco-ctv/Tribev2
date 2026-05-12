#!/bin/bash
# NeuralSeed — production startup script
#
# CLIP model (~600MB) is loaded lazily on first request.
# Keep workers at 1-2 to avoid OOM on typical cloud instances (4-8GB RAM).
# For machines with 16GB+ RAM, --workers 2 is safe.

set -e

WORKERS=${NEURALSEED_WORKERS:-1}
PORT=${NEURALSEED_PORT:-8000}

echo "Starting NeuralSeed backend — workers=$WORKERS port=$PORT"

source venv/bin/activate

uvicorn core_engine.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers "$WORKERS" \
  --log-level info
