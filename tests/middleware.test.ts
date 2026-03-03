import { describe, it, expect } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';
import http from 'http';

describe('Web Server Middleware (Filters)', () => {
  const makeRequest = (port: number, path: string, headers: Record<string, string> = {}) => {
    return new Promise<{ status: number, body: string }>((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port,
        path,
        method: 'GET',
        headers
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });

      req.on('error', reject);
      req.end();
    });
  };

  it('runs filter middleware and correctly halts or passes through', async () => {
    const runtime = new LythraRuntime();
    process.env.API_KEY = 'secret123';

    const source = `
      server MiddlewareApi on 4570:
        filter all:
          inspect headers as { authorization: String }
          if authorization != "Bearer " + env.API_KEY:
            transmit 401 "Unauthorized"
            stop

        filter "/admin/*":
          # Just an artificial side-effect injection to test if it runs
          let adminAccessed = true

        channel "/public":
          on call GET:
            transmit "Welcome to public!"

        channel "/admin/data":
          on call GET:
            transmit "Admin secret data"

      open doors
    `;

    const execPromise = runtime.execute(source).then(res => {
      if (res.errors) throw new Error(res.errors.join('\\n'));
    });

    // Give OS time to bind port
    await new Promise(r => setTimeout(r, 500));

    // 1. Missing Authorization -> 401 Unauthorized
    const noAuth = await makeRequest(4570, '/public');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body).toBe('Unauthorized');

    // 2. Wrong Authorization -> 401 Unauthorized
    const badAuth = await makeRequest(4570, '/public', { authorization: 'Bearer wrong' });
    expect(badAuth.status).toBe(401);
    expect(badAuth.body).toBe('Unauthorized');

    // 3. Correct auth to public channel
    const pubReq = await makeRequest(4570, '/public', { authorization: 'Bearer secret123' });
    expect(pubReq.status).toBe(200);
    expect(pubReq.body).toBe('Welcome to public!');

    // 4. Correct auth to admin channel
    const adminReq = await makeRequest(4570, '/admin/data', { authorization: 'Bearer secret123' });
    expect(adminReq.status).toBe(200);
    expect(adminReq.body).toBe('Admin secret data');

    // Clean up
    await runtime.execute('stop');
    await execPromise;
  });
});
