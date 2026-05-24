# ═══════════════════════════════════════════════════════════
# No Meu Bairro — Comandos úteis
# ═══════════════════════════════════════════════════════════

# Help
help:
	@echo "Comandos disponíveis:"
	@echo "  make dev          — Iniciar servidor de desenvolvimento"
	@echo "  make migrate      — Criar migration"
	@echo "  make upgrade      — Aplicar migrations"
	@echo "  make seed         — Popular banco com dados iniciais"
	@echo "  make docker-up    — Subir containers (PostgreSQL + API)"
	@echo "  make docker-down  — Parar containers"
	@echo "  make docker-logs  — Ver logs da API"
	@echo "  make shell        — Abrir Flask shell interativo"

# Desenvolvimento
dev:
	flask run --host=0.0.0.0 --port=5000 --debug

# Migrations
migrate:
	flask db migrate -m "$(msg)"

upgrade:
	flask db upgrade

seed:
	python seed.py

# Docker
docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api

# Utilitários
shell:
	flask shell

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .mypy_cache
