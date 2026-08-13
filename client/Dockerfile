FROM node:20-alpine

WORKDIR /app

# Copy package files first to cache layer
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]