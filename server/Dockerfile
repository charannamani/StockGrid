FROM node:20-alpine

WORKDIR /app

# Copy package files first to cache layer
COPY package*.json ./

# Install dependencies (utilizes cache if package.json hasn't changed)
RUN npm install

# Copy the rest of backend source code
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]