import { describe, it, expect } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Imports module system', () => {
  const tmpDir = path.join(process.cwd(), 'tests', 'tmp_imports');

  // Setup mock files
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  fs.writeFileSync(path.join(tmpDir, 'math.lth'), `
let pi = 3.1415
fn add(a, b):
  return a + b
  `);

  fs.writeFileSync(path.join(tmpDir, 'circular_a.lth'), `
import "circular_b.lth"
let a = 1
  `);

  fs.writeFileSync(path.join(tmpDir, 'circular_b.lth'), `
import "circular_a.lth"
let b = 2
  `);

  it('imports values mapped by alias namespace', async () => {
    const runtime = new LythraRuntime(tmpDir);
    const source = `
      import "math.lth" as math
      let result = math.add(10, 5)
    `;

    const res = await runtime.execute(source);
    expect(res.errors).toBeUndefined();

    // We expect result to be 15
    // @ts-ignore
    expect(runtime.interpreter.globals.get('result')).toBe(15);
  });

  it('imports values merged broadly into global scope', async () => {
    const runtime = new LythraRuntime(tmpDir);
    const source = `
      import "math.lth"
      let result = add(pi, 1)
    `;

    const res = await runtime.execute(source);
    expect(res.errors).toBeUndefined();

    // We expect result to be 4.1415
    // @ts-ignore
    expect(runtime.interpreter.globals.get('result')).toBeCloseTo(4.1415);
  });

  it('throws an error on circular dependencies', async () => {
    const runtime = new LythraRuntime(tmpDir);
    const source = `
      import "circular_a.lth"
    `;

    const res = await runtime.execute(source);
    expect(res.errors).toBeDefined();
    expect(res.errors![0]).toContain("Circular dependency detected");
  });

  it('throws an error if module file does not exist', async () => {
    const runtime = new LythraRuntime(tmpDir);
    const source = `
      import "does_not_exist.lth"
    `;

    const res = await runtime.execute(source);
    expect(res.errors).toBeDefined();
    expect(res.errors![0]).toContain("Module not found:");
  });
});
