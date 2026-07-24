FROM oven/bun:1
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY src ./src
ENV DB_PATH=/data/maps.db
EXPOSE 3103
CMD ["bun", "src/index.ts"]
