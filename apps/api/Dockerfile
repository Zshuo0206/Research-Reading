FROM node:22-alpine
WORKDIR /app
COPY package.json ./package.json
COPY apps/api ./apps/api
EXPOSE 4310
CMD ["node", "apps/api/src/server.mjs"]
