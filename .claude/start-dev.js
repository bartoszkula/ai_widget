const { createServer } = require('vite');

async function start() {
  const server = await createServer({
    server: { host: true, port: 5173 }
  });
  await server.listen();
  server.printUrls();
}

start();
