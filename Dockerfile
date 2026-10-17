FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && mkdir -p /app/node_modules \
 && chown -R node:node /app

COPY --chown=node:node . .

USER node
EXPOSE 3000

CMD ["node", "dev-server.js"]
