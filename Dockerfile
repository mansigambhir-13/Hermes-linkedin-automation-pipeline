# Rehearsal Social Studio — one image, two roles (bot | worker).
# tsx runs the TypeScript directly, so there is no separate build step.
FROM node:22-slim

WORKDIR /app
RUN corepack enable

# Install deps first (better layer caching). Copy manifests, then the rest.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

# Chromium for the deterministic HTML→PNG renderer (@rss/render) + its shared libraries.
# Fonts are bundled in-repo (packages/render/assets/fonts), so rendering needs no network at runtime.
# Pin a stable browsers path so the binary is found regardless of the runtime user (build + run must match).
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pnpm --filter @rss/render exec playwright install --with-deps chromium

# App code + runtime assets (brand docs, content/ready, locked config, web form).
COPY . .

ENV NODE_ENV=production
# Web-intake / health port (the host can override or map it).
EXPOSE 3002

# Default role = the Slack bot. The worker service overrides the command: `pnpm start:worker`.
CMD ["pnpm", "start:bot"]
