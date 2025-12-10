FROM node:18-slim

# Install ffmpeg and necessary system packages
RUN apt-get update && apt-get install -y ffmpeg wget ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.js"]
