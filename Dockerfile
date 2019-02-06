FROM node:alpine as base

FROM base as builder
RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install --only=prod

FROM base

COPY --from=builder /app /app
COPY bin/ /app/bin/
COPY lib/ /app/lib/
COPY public/ /app/public/
WORKDIR /app
EXPOSE 80
ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production
ENV PATH="${PATH}:/app/node_modules/.bin"
CMD ["node", "bin/server.js"]
