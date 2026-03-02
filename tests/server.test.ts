import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';
import http from 'http';

describe('Web Server Integration', () => {
  const runtime = new LythraRuntime();

  // Make a helper request to avoid raw curl dependencies
  const makeRequest = (path: string, method: string = 'GET', body?: any) => {
    return new Promise<{ status: number, body: string }>((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 4567,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  it('evaluates server block and mounts endpoints safely', async () => {
    const source = `
      server TestApi on 4567:
        channel "/ping":
          on call GET:
            transmit "pong"
            
        channel "/echo":
          on call POST:
            receive body as { msg: String }
            transmit { result: msg }

      open doors
    `;

    // Execute in background
    const execPromise = runtime.execute(source).then(res => {
      if (res.errors) throw new Error(res.errors.join('\n'));
    });

    // Give it a split second to bind the port
    await new Promise(r => setTimeout(r, 500));

    // Test GET ping
    const pingRes = await makeRequest('/ping', 'GET');
    expect(pingRes.status).toBe(200);
    expect(pingRes.body).toBe('pong'); // Text stringify output

    // Test POST echo (JSON injection and response payload)
    const echoRes = await makeRequest('/echo', 'POST', { msg: "Hello Lythra" });
    expect(echoRes.status).toBe(200);

    // Test JSON responses
    const jsonBody = JSON.parse(echoRes.body);
    expect(jsonBody.result).toBe("Hello Lythra");

    // Clean up server to end process loop
    const stopSource = `stop`;
    await runtime.execute(stopSource);
    await execPromise;
  });

  it('handles 404 for unknown channels', async () => {
    const source = `
      server Test2 on 4568:
        channel "/":
          on call GET:
            transmit "index"
      open doors
    `;

    const execPromise = runtime.execute(source).then(res => {
      if (res.errors) throw new Error(res.errors.join('\n'));
    });
    await new Promise(r => setTimeout(r, 500));

    const badRes = await new Promise<{ status: number, body: string }>((resolve, reject) => {
      http.get('http://localhost:4568/unknown', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      }).on('error', reject);
    });

    expect(badRes.status).toBe(404);
    expect(badRes.body).toBe('Not Found');

    await runtime.execute(`stop`);
    await execPromise;
  });

  it('rejects improperly shaped schemas', async () => {
    const source = `
      server Test3 on 4569:
        channel "/strict":
          on call POST:
            receive body as { requiredField: String }
            transmit "ok"
      open doors
    `;

    const execPromise = runtime.execute(source).then(res => {
      if (res.errors) throw new Error(res.errors.join('\n'));
    });
    await new Promise(r => setTimeout(r, 500));

    // Omit `requiredField` from JSON Payload
    const reqRes = await new Promise<{ status: number, body: string }>((resolve, reject) => {
      const options = { hostname: 'localhost', port: 4569, path: '/strict', method: 'POST', headers: { 'Content-Type': 'application/json' } };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ wrongField: 123 }));
      req.end();
    });

    // Our AST validator in Interpreter throws 400 Bad Request
    expect(reqRes.status).toBe(400);
    expect(reqRes.body).toContain('Missing field requiredField');

    await runtime.execute(`stop`);
    await execPromise;
  });
});
