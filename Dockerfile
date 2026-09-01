# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY serverend/package.json ./serverend/
RUN npm ci --workspace=frontend

COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM node:20-bookworm-slim AS server-build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY serverend/package.json ./serverend/
RUN npm ci --workspace=serverend

COPY serverend ./serverend
RUN npm run build --workspace=serverend

FROM node:20-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY serverend/package.json ./serverend/
RUN npm ci --workspace=serverend --omit=dev

COPY --from=server-build /app/serverend/dist ./serverend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN mkdir -p serverend/data

EXPOSE 3000

CMD ["node", "serverend/dist/main.js"]
