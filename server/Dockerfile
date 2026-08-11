FROM node:20-slim

RUN apt-get update && apt-get install -y libcurl4 ca-certificates openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV MONGOMS_DISABLE_POSTINSTALL=1

COPY package*.json ./

RUN npm config set maxsockets 5 && \
    npm config set fetch-retries 5 && \
    npm ci --ignore-scripts --no-audit --no-fund

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]