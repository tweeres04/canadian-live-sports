ssh server -T <<'EOL'
	cd canadian-live-sports && \
	git fetch && git reset --hard origin/main && \
	docker compose up --build -d
EOL