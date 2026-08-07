# Marketplace devcontainer — builds on the shared local base image.
# The base (devcontainer-base:node24.16-trixie) is built on demand by the
# initializeCommand in devcontainer.json (see ../../devcontainer-base).
FROM devcontainer-base:node24.16-trixie

ARG TZ
ENV TZ="$TZ"

# Repo-specific system packages on top of the base: the headless-browser stack,
# networking tools, musl, and the postgres client.
USER root
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && apt-get install -y \
  chromium \
  dbus-x11 \
  xvfb \
  aggregate \
  ipset \
  iptables \
  musl \
  postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Build and install FTA from source (root Rust; not kept on the image).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
  . /root/.cargo/env && \
  rustup default stable && \
  git clone https://github.com/sgb-io/fta.git /tmp/fta && \
  cd /tmp/fta && \
  cargo build --release --package fta && \
  mv target/release/fta /usr/local/bin/fta && \
  chmod +x /usr/local/bin/fta && \
  cd / && \
  rm -rf /tmp/fta /root/.cargo /root/.rustup

# Azure CLI.
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

USER node

# Yarn workspace-local caches + a larger Node heap.
ENV YARN_CACHE_FOLDER=/workspace/.yarn/cache
ENV YARN_GLOBAL_FOLDER=/workspace/.yarn/global
ENV NODE_OPTIONS=--max-old-space-size=4096

# Repo dev CLIs (installed to the base's system npm prefix, so they survive the
# /home/node bind mount).
RUN npm install -g claude-code-templates @sasazame/ccresume @img/sharp-linux-arm64 @anthropic-ai/claude-code @openai/codex && \
  npm install -g tsx && \
  npm install -g @ast-grep/cli ts-morph cyclomatic-complexity fast-check eslintcc typescript-language-server typescript @phenomnomnominal/tsquery chokidar-cli && \
  npm install -g dotenv-cli && \
  npm install -g agent-browser git-span
