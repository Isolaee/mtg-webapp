# ── Stage 1: dependency cache ────────────────────────────────────────────────
FROM rust:1-slim-bookworm AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
# Compile a stub to pre-build all dependencies (maximises Docker layer cache)
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src target/release/deps/tcg_backend* target/release/tcg_backend*

# ── Stage 2: build real binary ────────────────────────────────────────────────
FROM deps AS builder

COPY src ./src
RUN cargo build --release

# ── Stage 3: minimal runtime ──────────────────────────────────────────────────
# gcr.io/distroless/cc-debian12 contains only glibc + libstdc++ — no shell,
# no package manager, no extra attack surface.
# SQLite is compiled into the binary (libsqlite3-sys bundled feature),
# so no system library is required at runtime.
FROM gcr.io/distroless/cc-debian12 AS runtime

COPY --from=builder /app/target/release/tcg-backend /usr/local/bin/tcg-backend

# DATABASE_URL: override to point at a mounted volume or external SQLite path.
# For AWS ECS, mount the DB file via EFS or use an external database.
ENV DATABASE_URL=sqlite:/data/mtg_card_db.db
ENV RUST_LOG=tcg_backend=info,tower_http=warn

EXPOSE 8080

# Health checks are done by the ALB/ECS target group via HTTP GET /health.
# Configure your ECS task definition or ALB target group to check:
#   Protocol: HTTP  Path: /health  Port: 8080

ENTRYPOINT ["/usr/local/bin/tcg-backend"]
