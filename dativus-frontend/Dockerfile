# ── Stage 1: 빌드 ──────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=
ARG VITE_AI_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AI_BASE_URL=$VITE_AI_BASE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Nginx 서브 ─────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
