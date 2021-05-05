FROM node:14.16.1-alpine3.13
WORKDIR /app

RUN apk add --no-cache git

COPY package.json \
  package-lock.json \
  ./
RUN npm ci --production && rm -rf ~/.npm

COPY src src
COPY config.json ./
COPY views views

EXPOSE 8080
CMD ["npm", "run", "start"]
