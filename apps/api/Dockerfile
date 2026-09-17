FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm install
COPY apps/api apps/api
RUN npm run build --workspace apps/api

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/uploads ./apps/api/uploads
COPY apps/api/package.json apps/api/package.json
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
