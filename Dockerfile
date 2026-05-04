# Base image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build step
RUN npm run build
# Ensure optional glob files exist so runner COPY doesn't fail
RUN ls *.csv 2>/dev/null | grep -q . || touch .placeholder.csv
RUN ls *.xlsx 2>/dev/null | grep -q . || touch .placeholder.xlsx

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME 0.0.0.0

# Copy necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/data ./data
COPY --from=builder /app/*.json ./
# xlsx and csv are optional (may not exist); placeholders ensure glob matches
COPY --from=builder /app/*.xlsx ./
COPY --from=builder /app/*.csv ./

EXPOSE 3000

CMD ["npm", "start"]
