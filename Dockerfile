FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci && npm --prefix web ci

COPY tsconfig.json ./
COPY src ./src
COPY web ./web
RUN npm run build:all

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /app/data

EXPOSE 6446

CMD ["node", "dist/main.js"]
