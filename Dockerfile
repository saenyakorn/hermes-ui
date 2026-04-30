FROM node:24-alpine AS build

WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run typecheck && npm run build && npm test

FROM node:24-alpine AS runtime

ARG HERMES_VERSION=main

# bash: Hermes install.sh; build-base + headers: uv/pip native wheels; rest: git/clone, libffi, xz (Node tarballs if ever needed)
RUN apk add --no-cache \
    bash \
    build-base \
    ca-certificates \
    curl \
    git \
    libffi-dev \
    linux-headers \
    openssl-dev \
    python3 \
    python3-dev \
    ripgrep \
    xz

RUN mkdir -p /app/data \
    && curl -fsSL "https://raw.githubusercontent.com/NousResearch/hermes-agent/${HERMES_VERSION}/scripts/install.sh" \
    | bash -s -- --skip-setup --hermes-home /app/data

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HERMES_HOME=/app/data
ARG ADMIN_USERNAME
ARG ADMIN_PASSWORD

COPY package*.json ./
RUN npm i --production
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "dist/index.js"]
