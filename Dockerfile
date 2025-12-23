FROM node:20-bookworm-slim

WORKDIR /app

# Install server dependencies first (better layer caching)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy Prisma schema/migrations and generate client
COPY server/prisma ./server/prisma
RUN cd server && npm run prisma:generate

# Copy the rest of the project (frontend files + server source)
COPY . .

# Add entrypoint that applies migrations then starts the server
COPY server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/server
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
