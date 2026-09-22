FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PROJECT_DATA_DIR=/app/data
COPY --from=build /app/.output ./.output
COPY --from=build /app/templates ./templates
COPY --from=build /app/Dashboard/via ./Dashboard/via
COPY --from=build ["/app/Dashboard/Raysut dashboard.html", "./Dashboard/Raysut dashboard.html"]
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
