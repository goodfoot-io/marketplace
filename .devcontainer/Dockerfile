FROM node:24

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and iptables/ipset
RUN apt update && export DEBIAN_FRONTEND=noninteractive && apt install -y less \
  git \
  procps \
  chromium \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  tree \
  locales \
  musl \
  postgresql-client \
  ripgrep \
  dbus \
  dbus-x11 \
  xvfb \
  bc \
  bat \
  direnv

# Configure locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
  locale-gen
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace, config directories, and worktrees directory with permissions
RUN mkdir -p /workspace /home/node/.claude /workspace/.worktrees && \
  chown -R node:node /workspace /home/node/.claude /workspace/.worktrees

WORKDIR /workspace

RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_0.18.2_${ARCH}.deb" && \
  rm "git-delta_0.18.2_${ARCH}.deb"

# Install Rust toolchain (as root for system-wide installation)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
  . /root/.cargo/env && \
  rustup default stable

# Build and install FTA from source
RUN . /root/.cargo/env && \
  git clone https://github.com/sgb-io/fta.git /tmp/fta && \
  cd /tmp/fta && \
  cargo build --release --package fta && \
  mv target/release/fta /usr/local/bin/fta && \
  chmod +x /usr/local/bin/fta && \
  cd / && \
  rm -rf /tmp/fta /root/.cargo /root/.rustup

# Set up non-root user
USER node

# Configure Yarn to use workspace-local directories
ENV YARN_CACHE_FOLDER=/workspace/.yarn/cache
ENV YARN_GLOBAL_FOLDER=/workspace/.yarn/global

RUN mkdir -p /home/node/.cache/ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright
# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Default powerline10k theme
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -a "eval \"\$(direnv hook zsh)\"" \
  -x

ENV CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1
# Install Claude optional dependencies as the node user
RUN npm install -g claude-code-templates @sasazame/ccresume @img/sharp-linux-arm64 @anthropic-ai/claude-code

# Install tsx for running TypeScript scripts
RUN npm install -g tsx

# Install tools for code analysis
RUN npm install -g @ast-grep/cli ts-morph cyclomatic-complexity fast-check eslintcc typescript-language-server typescript @phenomnomnominal/tsquery chokidar-cli ts-morph

# Install dotenv-cli for loading environment variables
RUN npm install -g dotenv-cli


# Install uv for package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/

USER root

RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

RUN corepack enable
RUN npx playwright install-deps

RUN chmod +rx /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  echo "node ALL=(root) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/bin/dpkg" > /etc/sudoers.d/node-packages && \
  echo "node ALL=(root) NOPASSWD: /usr/bin/dbus-daemon, /usr/bin/mkdir, /usr/bin/chmod, /usr/bin/chown, /usr/bin/pgrep, /usr/bin/sleep" > /etc/sudoers.d/node-dbus && \
  chmod 0440 /etc/sudoers.d/node-firewall /etc/sudoers.d/node-packages /etc/sudoers.d/node-dbus

# Create dbus directories with proper permissions
RUN mkdir -p /run/dbus /var/run/dbus && \
  chmod 755 /run/dbus /var/run/dbus
USER node
RUN npx playwright install
