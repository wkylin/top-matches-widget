FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/src/types.ts ./src/types.ts

EXPOSE 8080

CMD ["pnpm", "start"]
