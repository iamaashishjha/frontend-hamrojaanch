FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=https://api.hamrojaanch.aashishjha.com.np/api
ARG VITE_SIGNALING_URL=wss://ws.hamrojaanch.aashishjha.com.np/ws
ARG VITE_SIGNALING_HTTP_URL=https://ws.hamrojaanch.aashishjha.com.np
ARG VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SIGNALING_URL=${VITE_SIGNALING_URL}
ENV VITE_SIGNALING_HTTP_URL=${VITE_SIGNALING_HTTP_URL}
ENV VITE_ICE_SERVERS=${VITE_ICE_SERVERS}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
