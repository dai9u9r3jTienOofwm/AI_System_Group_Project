# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package.json
COPY package.json ./

# Cài đặt bằng npm
RUN npm install

# Copy mã nguồn và build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ==========================================
# STAGE 2: RUNNER (Siêu nhẹ)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone yêu cầu copy thư mục public (nếu có ảnh, font...)
COPY --from=builder /app/public ./public

# Copy cấu trúc thư mục standalone đã được Next.js tối ưu sẵn
# Thư mục này CHỈ CHỨA NHỮNG GÌ CẦN THIẾT NHẤT để chạy app, tự động vứt bỏ devDependencies
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# Chạy trực tiếp file server.js sinh ra bởi standalone (Không cần npm start nữa)
CMD ["node", "server.js"]