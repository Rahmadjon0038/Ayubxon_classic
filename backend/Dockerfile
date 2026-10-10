FROM node:20-alpine AS builder
WORKDIR /app

# Prisma engine uchun OpenSSL kerak (Alpine'da standart yoq)
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Production image ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Prisma engine uchun OpenSSL kerak (Alpine'da standart yoq)
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Avval eski single-tenant bazani Organization qatlamiga kochirish skripti ishga tushadi
# (organizationId ustuni allaqachon bor bolsa yoki baza bosh bolsa jim otkazib yuboradi),
# keyin schema DBga qollanadi (shundan keyingina PromptCategory jadvali mavjud boladi —
# seed skripti shu sabab db push'dan KEYIN chaqiriladi, ikkalasi ham idempotent), va server
# ishga tushadi.
# accept-data-loss: bu image yangi schema'ga moslashganda eski public ads ustunlarini olib tashlaydi.
CMD ["sh", "-c", "node dist/scripts/migrateToOrganizations.js && npx prisma db push --skip-generate --accept-data-loss && node dist/scripts/seedDokonCategory.js && node dist/index.js"]
