const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const root = __dirname;
const apiHandlers = {
  '/api/bot-unified': require('./api/bot-unified'),
  '/api/dashboard': require('./api/dashboard')
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve(undefined);
      if ((req.headers['content-type'] || '').includes('application/json')) {
        try { return resolve(JSON.parse(body)); }
        catch { return reject(new Error('Invalid JSON request body.')); }
      }
      resolve(body);
    });
    req.on('error', reject);
  });
}

function sendError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = apiHandlers[url.pathname];

  if (handler) {
    try {
      req.query = Object.fromEntries(url.searchParams.entries());
      req.body = await parseBody(req);
      res.status = code => {
        res.statusCode = code;
        return res;
      };
      res.json = value => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(value));
        return res;
      };
      res.send = value => {
        res.end(value);
        return res;
      };
      return await handler(req, res);
    } catch (error) {
      console.error('Local API adapter error:', error.message);
      if (!res.headersSent) sendError(res, 500, 'Local API request failed.');
      return;
    }
  }

  const requestedPath = url.pathname === '/' ? '/ads.html' : url.pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(requestedPath)}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    return sendError(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return sendError(res, 404, 'Not found');
    res.statusCode = 200;
    res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`ZafaTools local development server listening on port ${process.env.PORT || 3000}`);
});
