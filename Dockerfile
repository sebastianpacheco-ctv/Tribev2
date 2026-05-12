FROM python:3.11-slim

# System deps for OpenCV, pyzbar, Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzbar0 \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # Playwright Chromium deps
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY core_engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium
RUN playwright install chromium --with-deps

# Copy source — preserve core_engine/ package structure
COPY core_engine/ ./core_engine/

# Persistent storage mount point for diagnostics
RUN mkdir -p /app/tmp/diagnostics

ENV PORT=8080
EXPOSE 8080

# 1 worker — CLIP model is ~600MB, keep memory usage predictable
CMD ["uvicorn", "core_engine.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
