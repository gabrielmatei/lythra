import { LythraValue } from '../interpreter/types.js';
import * as ast from '../parser/ast.js';

export interface VisionOptions {
  typeAnnotation: ast.TypeAnnotation;
  context?: LythraValue;
  seed?: number | 'time';
  modifier?: 'precise' | 'fuzzy' | 'wild' | null;
  model?: string;
  temperature?: number;
}

export async function callVision(prompt: string, options: VisionOptions): Promise<LythraValue> {
  // 1. Resolve Temperature based on modifier or explicit override
  let temperature = 0.5; // default
  if (options.temperature !== undefined && options.temperature !== null) {
    temperature = options.temperature;
  } else {
    if (options.modifier === 'precise') temperature = 0.0;
    if (options.modifier === 'fuzzy') temperature = 0.7;
    if (options.modifier === 'wild') temperature = 1.2;
  }

  // 2. Resolve JSON Schema from typeAnnotation
  // We'll support some basic Lythra types mapping to OpenAPI schema types here
  const rawSchema = translateLythraTypeToSchema(options.typeAnnotation);
  const isObjectRoot = rawSchema.type === 'OBJECT';
  
  // Wrap top-level schemas into an object because LLMs strongly prefer JSON objects
  const schema = isObjectRoot ? rawSchema : {
    type: 'OBJECT',
    properties: { result: rawSchema },
    required: ['result']
  };

  // 3. System Instruction & Prompt prep
  let fullPrompt = prompt;
  if (options.context !== undefined && options.context !== null) {
    fullPrompt += `\n\nContext block:\n${JSON.stringify(options.context, null, 2)}`;
  }

  const model = options.model || 'gemini-2.5-pro';

  // Support for local Gemma 4 (via Ollama)
  if (model.toLowerCase().includes('gemma')) {
    const ollamaEndpoint = 'http://localhost:11434/api/generate';
    // Append the expected JSON schema to the prompt so the local model knows how to structure it
    fullPrompt += `\n\nIMPORTANT: You must respond ONLY with valid JSON that matches the following schema. Strictly adhere to this schema and do not output any other text:\n${JSON.stringify(schema, null, 2)}`;

    const requestBody = {
      model: model,
      prompt: fullPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature
      }
    };

    try {
      const res = await fetch(ollamaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Local Vision API Error (Ollama): ${res.status} ${res.statusText} - ${errorText}\nMake sure Ollama is running locally with the '${model}' model installed.`);
      }

      const data = await res.json() as any;
      const textPayload = data.response;

      try {
        const parsed = JSON.parse(textPayload);
        if (!isObjectRoot && parsed && typeof parsed === 'object') {
          const vals = Object.values(parsed);
          if (vals.length > 0) return vals[0] as LythraValue;
        }
        return parsed;
      } catch (e) {
        const clean = textPayload.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(clean);
        if (!isObjectRoot && parsed && typeof parsed === 'object') {
          const vals = Object.values(parsed);
          if (vals.length > 0) return vals[0] as LythraValue;
        }
        return parsed;
      }
    } catch (err: any) {
      if (err.message.includes('fetch') || err.message.includes('ECONNREFUSED')) {
        throw new Error(`Local Vision API Error (Ollama): Could not connect to local Ollama on port 11434. Please ensure Ollama is running.`);
      }
      throw new Error(`Local Vision API Error (Ollama): ${err.message}`);
    }
  }

  // Default to Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Vision API Error: GEMINI_API_KEY environment variable is not set.');
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };

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
      if (!isObjectRoot && parsed && typeof parsed === 'object') {
        const vals = Object.values(parsed);
        if (vals.length > 0) return vals[0] as LythraValue;
      }
      return parsed; // Valid Lythra native value!
    } catch (e) {
      // In case it's not strictly JSON, try to extract it from markdown blocks
      const clean = textPayload.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      if (!isObjectRoot && parsed && typeof parsed === 'object') {
        const vals = Object.values(parsed);
        if (vals.length > 0) return vals[0] as LythraValue;
      }
      return parsed;
    }
  } catch (err: any) {
    throw new Error(`Vision API Error: ${err.message}`);
  }
}

/**
 * Very rudimentary type converter from Lythra syntax to Gemini JSON Schema
 */
export function translateLythraTypeToSchema(typeExpr: ast.TypeAnnotation): any {
  if (typeExpr.kind === 'PlainTypeAnnotation') {
    const name = typeExpr.name;
    if (name === 'String') return { type: 'STRING' };
    if (name === 'Int') return { type: 'INTEGER' };
    if (name === 'Float') return { type: 'NUMBER' };
    if (name === 'Boolean') return { type: 'BOOLEAN' };
    if (name === 'Object') return { type: 'OBJECT' };
    return { type: 'STRING' };
  }

  if (typeExpr.kind === 'ArrayTypeAnnotation') {
    return {
      type: 'ARRAY',
      items: translateLythraTypeToSchema(typeExpr.element)
    };
  }

  if (typeExpr.kind === 'UnionTypeAnnotation') {
    return {
      type: 'STRING',
      enum: typeExpr.variants
    };
  }

  if (typeExpr.kind === 'ConstrainedTypeAnnotation') {
    const base = translateLythraTypeToSchema({ kind: 'PlainTypeAnnotation', name: typeExpr.base });
    if (base.type === 'STRING' || base.type === 'INTEGER' || base.type === 'NUMBER') {
      if (typeExpr.constraints['max'] !== undefined) base.maxLength = typeExpr.constraints['max'];
      if (typeExpr.constraints['min'] !== undefined) base.minLength = typeExpr.constraints['min'];
    }
    return base;
  }

  return { type: 'STRING' };
}
