import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { LythraValue } from '../interpreter/types.js';
import * as ast from '../parser/ast.js';

const CACHE_FILE = path.join(process.cwd(), '.lythra', 'cache.json');

export interface CacheEntry {
  hash: string;
  response: string; // The raw JSON string returned from Gemini
  timestamp: number;
}

/**
 * Generates a deterministic SHA-256 hash for a specific vision execution
 */
export function generateHash(prompt: string, context: string | null, typeAnnotation: ast.TypeAnnotation, modelOverride?: string): string {
  const payload = JSON.stringify({
    prompt,
    context,
    typeAnnotation,
    model: modelOverride || 'default'
  });

  return createHash('sha256').update(payload).digest('hex');
}

function ensureCacheDir() {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadCache(): Record<string, CacheEntry> {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {}; // Corrupted cache just drops empty
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

export function getCache(hash: string): CacheEntry | null {
  const cache = loadCache();
  return cache[hash] || null;
}

export function setCache(hash: string, response: string): void {
  const cache = loadCache();
  cache[hash] = {
    hash,
    response,
    timestamp: Date.now()
  };
  saveCache(cache);
}

export function clearCache(target?: string): void {
  if (!target || target === 'all') {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } else {
    // If target is a specific hash
    const cache = loadCache();
    if (cache[target]) {
      delete cache[target];
      saveCache(cache);
    }
  }
}
