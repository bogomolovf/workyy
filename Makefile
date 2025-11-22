PNPM=pnpm

.PHONY: install
install:
	$(PNPM) install

.PHONY: dev
dev:
	$(PNPM) -r --filter web dev

.PHONY: dev:realtime
dev:realtime:
	$(PNPM) -r --filter realtime-server dev

.PHONY: lint
lint:
	$(PNPM) lint

.PHONY: test
test:
	$(PNPM) test

.PHONY: compose-up
compose-up:
	docker compose up --build

.PHONY: compose-down
compose-down:
	docker compose down -v

