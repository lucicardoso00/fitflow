/** One HTTP server: the plan API, then the app's own public files. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_PART_IDS } from '../js/data/body-parts.js';
import { EXERCISES_PER_WORKOUT, EQUIPMENT_SUMMARY } from '../js/data/settings.js';
import { buildPlan } from './planner.js';

// The real location of the project, so a symlinked checkout still serves its files.
const ROOT = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const PUBLIC_PATH = /^\/(index|workout|done)\.html$|^\/(css|js|assets)\//;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const NOT_FOUND = { error: 'Not found.' };

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(data));
}

function parseChoices(params) {
  const parts = params.get('parts')?.split(',').filter(Boolean) ?? [];
  const minutes = params.get('minutes');
  const equipment = params.get('equipment');

  if (!parts.every((part) => ALL_PART_IDS.includes(part))) {
    return { error: `parts must contain only: ${ALL_PART_IDS.join(', ')}.` };
  }
  if (!Object.hasOwn(EXERCISES_PER_WORKOUT, minutes)) {
    return { error: `minutes must be one of: ${Object.keys(EXERCISES_PER_WORKOUT).join(', ')}.` };
  }
  if (!Object.hasOwn(EQUIPMENT_SUMMARY, equipment)) {
    return { error: `equipment must be one of: ${Object.keys(EQUIPMENT_SUMMARY).join(', ')}.` };
  }
  return { parts, minutes: Number(minutes), equipment };
}

// The path is resolved first, so `..` and symlinks cannot reach outside the public folders.
async function sendFile(request, response, pathname, reloadScript) {
  const filename = await realpath(resolve(ROOT, `.${decodeURIComponent(pathname)}`));
  const publicPath = `/${relative(ROOT, filename).split(sep).join('/')}`;
  const contentType = CONTENT_TYPES[extname(publicPath)];
  if (!PUBLIC_PATH.test(publicPath) || !contentType) {
    sendJson(response, 404, NOT_FOUND);
    return;
  }

  let content = await readFile(filename);
  if (reloadScript && extname(publicPath) === '.html') {
    content = content.toString().replace('</body>', `${reloadScript}</body>`);
  }
  response.writeHead(200, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff' });
  response.end(request.method === 'HEAD' ? undefined : content);
}

export function createApp({ development = false } = {}) {
  // Reconnecting browsers compare this version with the one in their page.
  const version = randomUUID();
  const reloadScript = development ? `<script>
    (() => {
      const events = new EventSource('/__dev/events');
      events.onmessage = ({ data }) => {
        if (data !== ${JSON.stringify(version)}) {
          events.close();
          location.reload();
        }
      };
    })();
  </script>` : '';

  return createServer(async (request, response) => {
    try {
      if (development) response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.setHeader('Allow', 'GET, HEAD');
        sendJson(response, 405, { error: 'Use GET or HEAD.' });
        return;
      }

      const url = new URL(request.url, 'http://localhost');
      if (development && url.pathname === '/__dev/events') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          'Connection': 'keep-alive',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        response.write(`retry: 500\ndata: ${version}\n\n`);
        const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 15000);
        response.on('close', () => clearInterval(heartbeat));
        return;
      }
      if (url.pathname === '/v1/plan') {
        const choices = parseChoices(url.searchParams);
        if (choices.error) {
          sendJson(response, 400, choices);
          return;
        }
        sendJson(response, 200, { plan: buildPlan(choices) });
        return;
      }

      await sendFile(request, response, url.pathname === '/' ? '/index.html' : url.pathname, reloadScript);
    } catch (error) {
      // A path that cannot be decoded, does not exist, or is not a file
      const isBadPath = error instanceof URIError
        || ['ENOENT', 'ENOTDIR', 'EISDIR', 'EINVAL', 'ERR_INVALID_ARG_VALUE'].includes(error.code);
      if (isBadPath) {
        sendJson(response, 404, NOT_FOUND);
      } else {
        console.error(error);
        sendJson(response, 500, { error: 'Something went wrong.' });
      }
    }
  });
}
