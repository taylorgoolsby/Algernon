// src/agent/WebSearchTool.ts
// @flow

import WebScraper from '../rest/WebScraper.ts'
import type { ScrapedResult } from '../rest/WebScraper.ts'

export const WEB_SEARCH_TOOL_NAME = 'web_search'

// How many tool calls the model may make for one user message.
export const MAX_TOOL_CALLS = 2

const MAX_RESULTS = 3
const MAX_RESULT_CHARS = 800

export type ToolCall = {
  name: typeof WEB_SEARCH_TOOL_NAME,
  query: string,
}

// Goes in the system prompt. Llama 3.2 function calling: the tool is described
// as JSON and the model answers with {"name": ..., "parameters": {...}}.
export const WEB_SEARCH_TOOL_PROMPT = `You have access to one tool:

{"type": "function", "function": {"name": "web_search", "description": "Search the web for current events or facts you do not know.", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "The search query"}}, "required": ["query"]}}}

Only use the tool when the user needs current information or facts you are unsure about. Otherwise answer directly. To use it, respond with ONLY this JSON and nothing else: {"name": "web_search", "parameters": {"query": "<search query>"}}
The search results will come back in an ipython message. Then answer the user in plain text.`

// Appended to every tool result so the model answers instead of looping.
export const TOOL_RESULT_INSTRUCTION =
  '\n\nUse these results to answer the user in plain text. Do not call the tool again.'

const SPECIAL_TOKENS = /<\|(?:python_tag|eom_id|eot_id)\|>/g

/*
While streaming, text that starts with "{" might be a tool call. The caller
hides it from the UI until generation finishes and parseToolCall decides.
* */
export function looksLikeToolCall(text: string): boolean {
  return /^\s*(?:<\|python_tag\|>)?\s*\{/.test(text)
}

// First balanced {...} object in the text, ignoring braces inside strings.
function firstJSONObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
    } else if (c === '"') {
      inString = true
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export function parseToolCall(text: string): ToolCall | null {
  const cleaned = text.replace(SPECIAL_TOKENS, '').trim()
  const candidates = [cleaned, firstJSONObject(cleaned)]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const obj = JSON.parse(candidate)
      const name = obj?.name ?? obj?.function?.name
      let params = obj?.parameters ?? obj?.arguments ?? obj?.function?.arguments
      if (typeof params === 'string') params = JSON.parse(params)
      const query = params?.query
      if (name === WEB_SEARCH_TOOL_NAME && typeof query === 'string' && query.trim()) {
        return { name: WEB_SEARCH_TOOL_NAME, query: query.trim() }
      }
    } catch (err) {
      // Not JSON; try the next candidate.
    }
  }
  return null
}

const truncate = (text: string, max: number) => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max) + '…' : flat
}

/*
Runs the search and formats the results as the text of an ipython message.
Never throws: a failure is reported to the model as the tool result.
* */
export async function runWebSearch(query: string): Promise<string> {
  try {
    const results = await WebScraper.searchAndRead(
      query,
      MAX_RESULTS,
      MAX_RESULT_CHARS,
    )
    if (!results.length) {
      return `No web results were found for "${query}".`
    }
    return results
      .map(
        (r: ScrapedResult, i: number) =>
          `[${i + 1}] ${truncate(r.title, 120)}\n${r.url}\n${r.text.slice(0, MAX_RESULT_CHARS)}`,
      )
      .join('\n\n')
  } catch (err) {
    console.error('Web search failed:', err)
    return `The web search failed (${(err as Error)?.message ?? 'unknown error'}). Tell the user you could not search the web, and answer from what you already know if you can.`
  }
}