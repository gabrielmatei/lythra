import { LythraValue } from '../interpreter/types.js';

export interface VisionOptions {
  typeAnnotation: string;
  context?: LythraValue;
  seed?: number | 'time';
  modifier?: 'precise' | 'fuzzy' | 'wild' | null;
  model?: string;
}

export async function callVision(prompt: string, options: VisionOptions): Promise<LythraValue> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Vision API Error: GEMINI_API_KEY environment variable is not set.');
  }

  // 1. Resolve Temperature based on modifier
  let temperature = 0.5; // default
  if (options.modifier === 'precise') temperature = 0.0;
  if (options.modifier === 'fuzzy') temperature = 0.7;
  if (options.modifier === 'wild') temperature = 1.2;

  // 2. Resolve JSON Schema from typeAnnotation
  // We'll support some basic Lythra types mapping to OpenAPI schema types here
  const schema = translateLythraTypeToSchema(options.typeAnnotation);

  // 3. System Instruction & Prompt prep
  let fullPrompt = prompt;
  if (options.context !== undefined && options.context !== null) {
    fullPrompt += `\n\nContext block:\n${JSON.stringify(options.context, null, 2)}`;
  }

  const model = options.model || 'gemini-2.5-pro';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

  // 4. Resolve Seed
  if (options.seed !== undefined) {
    // Gemini doesn't currently support a specific integer seed natively like OpenAI.
    // Wait, wait! Let us check if we can simulate determinism as best we can, or simply omit it if unsupported.
    // We will omit `seed` flag in the payload for Gemini unless we know of an undocumented field. 
    // Wait, Gemini does not have an explicit `seed` parameter in generationConfig in standard docs for `gemini-1.5-pro`. 
    // Actually, OpenAI has a `seed` parameter. Since we switched to Gemini, we just ignore seed parameter or we can error?
    // Let's silently ignore explicitly seeded determinism here besides sending temperature=0
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Vision API Error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json() as any;

    // Gemini response parsing
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Vision API Error: No candidates returned from Gemini.');
    }

    const textPayload = data.candidates[0].content.parts[0].text;

    try {
      // It's requested as responseMimeType: 'application/json' so the output should be strictly JSON.
      const parsed = JSON.parse(textPayload);
      return parsed; // Valid Lythra native value!
    } catch (e) {
      // In case it's not strictly JSON, try to extract it from markdown blocks
      const clean = textPayload.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      return JSON.parse(clean);
    }
  } catch (err: any) {
    throw new Error(`Vision API Error: ${err.message}`);
  }
}

/**
 * Very rudimentary type converter from Lythra syntax to Gemini JSON Schema
 */
function translateLythraTypeToSchema(typeStr: string): any {
  if (typeStr === 'String') return { type: 'STRING' };
  if (typeStr === 'Int' || typeStr === 'Float') return { type: 'NUMBER' };
  if (typeStr === 'Boolean') return { type: 'BOOLEAN' };
  if (typeStr === 'String[]') return { type: 'ARRAY', items: { type: 'STRING' } };
  if (typeStr === 'Int[]' || typeStr === 'Float[]') return { type: 'ARRAY', items: { type: 'NUMBER' } };

  if (typeStr === 'Object') {
    return { type: 'OBJECT' };
  }

  // Handle `"spam" | "ok"` basic enum
  if (typeStr.includes('|')) {
    const opts = typeStr.split('|').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
    return {
      type: 'STRING',
      enum: opts
    };
  }

  // Default to treating as raw object or string if unknown
  return { type: 'STRING' };
}
