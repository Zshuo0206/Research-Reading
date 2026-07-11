FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
COPY apps/worker ./apps/worker
CMD ["node", "apps/worker/src/worker.mjs"]
