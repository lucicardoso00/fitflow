/** Optional local preview. Production is just the repository's static files. */
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC_PATH = /^(?:(?:index|workout|done)\.html|(?:css|js|assets)\/[^.].*)$/;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

export function createStaticServer({ basePath = '/' } = {}) {
  const base = `/${basePath.split('/').filter(Boolean).join('/')}/`.replace('//', '/');
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    function reply(status, content = '', type = 'text/plain; charset=utf-8') {
      response.writeHead(status, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : content);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      reply(405, 'Use GET or HEAD.');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (base !== '/' && pathname === base.slice(0, -1)) {
        response.setHeader('Location', base);
        reply(301);
        return;
      }
      if (!pathname.startsWith(base)) return reply(404, 'Not found.');
      const publicPath = pathname.slice(base.length) || 'index.html';
      const root = await realpath(ROOT);
      const filename = await realpath(resolve(root, publicPath));
      const resolvedPath = relative(root, filename).split(sep).join('/');
      if (!PUBLIC_PATH.test(resolvedPath) || resolvedPath.split('/').some((part) => part.startsWith('.'))
        || !CONTENT_TYPES[extname(filename)]) return reply(404, 'Not found.');
      reply(200, await readFile(filename), CONTENT_TYPES[extname(filename)]);
    } catch (error) {
      if (error instanceof URIError || ['ENOENT', 'ENOTDIR', 'EISDIR', 'EINVAL', 'ERR_INVALID_ARG_VALUE'].includes(error.code)) {
        reply(404, 'Not found.');
      } else {
        console.error(error);
        reply(500, 'Could not read this file.');
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? (process.argv.includes('--dev') ? 9999 : 3000));
  const host = process.env.HOST ?? '127.0.0.1';
  const basePath = process.env.BASE_PATH ?? '/';
  const server = createStaticServer({ basePath });
  server.on('error', (error) => {
    console.error(`Could not start preview: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log(`Forma: http://${host}:${server.address().port}${basePath}`));
}
