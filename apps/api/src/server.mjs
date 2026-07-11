import http from 'node:http';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 4310);

if (host !== '127.0.0.1') {
  console.error(JSON.stringify({ error: 'API_HOST must be 127.0.0.1' }));
  process.exit(1);
}

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'api-platform-shell',
      wave: 1,
      schema_version: 'api.v1',
    });
    return;
  }

  sendJson(response, 404, {
    error: {
      code: 'NOT_FOUND',
      message: 'Wave 1 platform shell exposes only the health endpoint.',
    },
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'server_started', service: 'api-placeholder', host, port }));
});

const shutdown = (signal) => {
  server.close(() => {
    console.log(JSON.stringify({ event: 'server_stopped', signal }));
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
