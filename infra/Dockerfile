FROM node:24-alpine
WORKDIR /workspace
COPY package.json package-lock.json .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tests ./tests
COPY tsconfig.json biome.json playwright.config.ts .env.example ./
RUN npm ci
RUN npm run build
