import { describe, it, expect } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';

describe('Pipeline Flow Control', () => {

  it('runs pipelines explicitly using consult', async () => {
    const runtime = new LythraRuntime();
    // We mock vision context by overriding native fetch or just pure logic
    const source = `
      pipeline Multiply(x: Int, y: Int) -> Int:
        return x * y

      let result = consult Multiply(5, 4)
      log result
    `;

    const logs: any[] = [];
    const origConsole = console.log;
    console.log = (...args) => logs.push(...args);

    const res = await runtime.execute(source);
    if (res.errors && res.errors.length > 0) throw new Error(res.errors.join('\\n'));

    console.log = origConsole;
    expect(logs).toContain('20');
  });

  it('streams pipeline chunk yields synchronously to observer block', async () => {
    const runtime = new LythraRuntime();

    // We mock streaming tokens inside a local pipeline flow
    const source = `
      pipeline MockStreamer():
        emit "A"
        emit " "
        emit "bright"
        emit " "
        emit "day"

      let sentence = ""
      stream MockStreamer() as chunk:
        sentence = sentence + chunk
        
      log sentence
    `;

    const logs: any[] = [];
    const origConsole = console.log;
    console.log = (...args) => logs.push(...args);

    const res = await runtime.execute(source);
    if (res.errors && res.errors.length > 0) throw new Error(res.errors.join('\\n'));

    console.log = origConsole;
    expect(logs).toContain("A bright day");
  });
});
