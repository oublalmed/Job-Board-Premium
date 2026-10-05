FROM node:20-alpine AS builder

WORKDIR /app

# The native `argon2` dependency is compiled by node-gyp when no prebuilt
# binary matches the platform (Alpine/musl), which needs Python and a C/C++
# toolchain — none are present in the base image.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src/ src/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# The runner reinstalls dependencies, which include the native `argon2`
# package, so it needs the same build toolchain to compile it. We install the
# full dependency set (not --omit=dev): the startup migration step loads the
# compiled data source, which pulls in `dotenv` and the TypeORM CLI — both
# otherwise absent in a production-only install.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY --from=builder /app/dist dist/

EXPOSE 3000

# Apply any pending database migrations, then start the API. Migrations run via
# the TypeORM CLI against the COMPILED data source (dist) — the `typeorm`
# package is a production dependency, so no ts-node/devDependencies are needed
# at runtime. If there are no pending migrations this is a no-op.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && node dist/main.js"]
