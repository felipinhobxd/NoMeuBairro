# ═══════════════════════════════════════════════════════════
# No Meu Bairro — Vitória Régia
# Dockerfile (Produção)
# ═══════════════════════════════════════════════════════════

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Produção ─────────────────────────────────────────────
FROM base AS production

COPY . .

RUN mkdir -p /app/uploads /app/keys

# Usuário não-root
RUN groupadd -r anb && useradd -r -g anb -d /app -s /sbin/nologin anb
RUN chown -R anb:anb /app
USER anb

EXPOSE 5000

# Usa wsgi.py como entrypoint (compatível com Gunicorn)
CMD ["gunicorn", \
     "--workers", "4", \
     "--worker-class", "gthread", \
     "--threads", "2", \
     "--timeout", "120", \
     "--bind", "0.0.0.0:5000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "wsgi:app"]
