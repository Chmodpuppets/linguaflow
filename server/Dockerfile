FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8787
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787

CMD ["npx", "tsx", "src/index.ts"]
