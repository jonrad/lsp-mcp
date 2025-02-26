# Note: This Dockerfile is optimized for iterating, not for production.
# For production we can do a lot more to optimize the image size
FROM node:20 AS builder

RUN mkdir /app
RUN npm install -g typescript

WORKDIR /app

COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile --ignore-scripts

COPY . .
RUN yarn build
RUN npm prune --omit=dev

COPY dev/prod.config.json /app/dist/config.json

FROM node:20-slim
WORKDIR /app

RUN apt update

# Dependencies that will likely be needed by multiple LSPs
# RUN apt install -y python3 pip

# LSPs
RUN npm install -g typescript && npm install -g typescript-language-server
RUN apt install -y python3-pylsp

COPY --from=builder /app/dist /app
COPY --from=builder /app/node_modules /app/node_modules

# Cleanup
RUN apt clean && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["node", "index.js", "--config", "/app/config.json"]
