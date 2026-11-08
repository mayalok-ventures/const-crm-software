const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../../out');
const PORT = process.env.PLAYWRIGHT_PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Internal Server Error');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Default route
  if (pathname === '/') {
    pathname = '/dashboard';
  }

  let fullPath = path.join(OUT_DIR, pathname);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    const htmlFile = path.join(fullPath, 'index.html');
    if (fs.existsSync(htmlFile)) {
      return serveFile(res, htmlFile);
    }
  }

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return serveFile(res, fullPath);
  }

  // Try appending .html
  if (fs.existsSync(fullPath + '.html')) {
    return serveFile(res, fullPath + '.html');
  }

  // Fallback to 404.html
  const notFound = path.join(OUT_DIR, '404.html');
  if (fs.existsSync(notFound)) {
    return serveFile(res, notFound);
  }

  res.writeHead(404);
  res.end('Not Found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`E2E Static Server listening on http://localhost:${PORT}`);
  });
}

module.exports = server;
