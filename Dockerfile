FROM node:20-slim AS build

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build && npm test

FROM node:20-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash build-essential ca-certificates curl git libffi-dev python3 python3-dev xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/data \
    && curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh \
        | bash -s -- --skip-setup --hermes-home /app/data

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HERMES_HOME=/app/data


COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "dist/index.js"]
