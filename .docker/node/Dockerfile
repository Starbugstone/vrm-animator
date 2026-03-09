FROM node:22-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package.json package-lock.json* ./
RUN npm install

# Default command: start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
