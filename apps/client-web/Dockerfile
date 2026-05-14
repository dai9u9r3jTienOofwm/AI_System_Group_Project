FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["pnpm", "start"]
