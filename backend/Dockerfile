# ==============================================================================
# MediFlow AI - Backend Dockerfile
# Optimized for AMD Developer Cloud (ROCm 6.x), Python 3.11 & FastAPI
# ==============================================================================

FROM rocm/dev-ubuntu-22.04:6.0 AS base

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Hardware Portability:
# Parameterize HSA_OVERRIDE_GFX_VERSION via ARG/ENV so AMD Instinct MI-series
# (MI210, MI250X, MI300X with native gfx90a/gfx940/gfx942) are NOT forced to RDNA3 (11.0.0).
ARG HSA_OVERRIDE_GFX_VERSION=""
ENV HSA_OVERRIDE_GFX_VERSION=${HSA_OVERRIDE_GFX_VERSION}

# AMD ROCm Environment Configuration
ENV ROCM_PATH=/opt/rocm
ENV HIP_VISIBLE_DEVICES=0
ENV PATH="${ROCM_PATH}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${ROCM_PATH}/lib:${LD_LIBRARY_PATH}"

WORKDIR /app

# Install system dependencies:
# - Python 3.11 and development packages
# - poppler-utils for PDF image rendering
# - tesseract-ocr with English and Urdu language support
# - libgl1 and libglib2.0-0 for OpenCV / image processing
# - libpq-dev for PostgreSQL asyncpg compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    build-essential \
    curl \
    git \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-urd \
    && add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3.11-distutils \
    python3.11-venv \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set python3.11 as default python
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Upgrade pip and install wheel
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install Python requirements
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

# Create non-root system user for security & PHI safety
RUN groupadd -g 1000 mediflow && \
    useradd -u 1000 -g mediflow -m -s /bin/bash mediflow && \
    mkdir -p /app/uploads && \
    chown -R mediflow:mediflow /app

# Copy application source code
COPY --chown=mediflow:mediflow . /app

USER mediflow

# Expose FastAPI HTTP port (8080 avoids collision with local vLLM on port 8000)
EXPOSE 8080

# Health check against ROCm & API status on port 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/v1/health || exit 1

# Production Uvicorn command on port 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2", "--proxy-headers"]
