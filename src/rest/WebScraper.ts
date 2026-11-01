// src/rest/WebScraper.ts
// A rudimentary, key-less web search: scrape DuckDuckGo's HTML results page,
// fetch the top result pages, and reduce each page to plain text.
//
// This is regex-based on purpose (no DOM or extra dependencies in React Native),
// so it is best-effort: DuckDuckGo can change its markup or block automated
// requests, and some pages are rendered by JavaScript and have no text to scrape.

const SEARCH_URL = 'https://html.duckduckgo.com/html/'
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const SEARCH_TIMEOUT_MS = 8000
const PAGE_TIMEOUT_MS = 6000
const MAX_HTML_CHARS = 600_000

// Sites that need JavaScript or a login. Their snippet is used instead.
const UNSCRAPEABLE_HOSTS = /(^|\.)(youtube\.com|youtu\.be|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com|pinterest\.com)$/i

export type SearchHit = {
  title: string,
  url: string,
  snippet: string,
}

export type ScrapedResult = {
  title: string,
  url: string,
  // Page text most relevant to the query, or the search snippet if the page
  // could not be read.
  text: string,
}

// ---------- HTML helpers ----------

const NAMED_ENTITIES: { [name: string]: string } = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™',
  bull: '•', middot: '·', laquo: '«', raquo: '»', deg: '°',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : match
      } catch (err) {
        return match
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ''))
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim()

export function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? collapse(stripTags(match[1])) : ''
}

/*
Reduces a page to its readable text, one paragraph per line.
Drops scripts, styles, navigation, and lines too short to be prose.
* */
export function htmlToText(html: string): string {
  let h = html.slice(0, MAX_HTML_CHARS)

  h = h.replace(/<!--[\s\S]*?-->/g, ' ')
  h = h.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
  h = h.replace(/<(nav|header|footer|aside|form|button|select|dialog)\b[\s\S]*?<\/\1>/gi, ' ')

  // Prefer the main article when the page marks one.
  const main =
    /<article\b[\s\S]*?<\/article>/i.exec(h) ?? /<main\b[\s\S]*?<\/main>/i.exec(h)
  if (main && stripTags(main[0]).trim().length > 400) {
    h = main[0]
  }

  h = h.replace(/<br\s*\/?>/gi, '\n')
  h = h.replace(
    /<\/(p|div|li|h[1-6]|tr|section|article|blockquote|pre|table|ul|ol|dd|dt|figcaption)>/gi,
    '\n',
  )

  const lines: Array<string> = []
  for (const raw of stripTags(h).split('\n')) {
    const line = collapse(raw)
    if (line.split(' ').length < 5) continue // menus, labels, buttons
    if (lines[lines.length - 1] === line) continue
    lines.push(line)
  }
  return lines.join('\n')
}

/*
Picks the lines that mention the most query words, in their original order,
up to `maxChars`. Falls back to the start of the page when nothing matches.
* */
export function extractRelevant(text: string, query: string, maxChars: number): string {
  const lines = text.split('\n').filter(Boolean)
  if (!lines.length) return ''

  const words = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 2),
    ),
  )
  const scored = lines.map((line, index) => {
    const lower = line.toLowerCase()
    return { line, index, score: words.filter(w => lower.includes(w)).length }
  })

  const ranked = scored.some(s => s.score > 0)
    ? [...scored].sort((a, b) => b.score - a.score || a.index - b.index)
    : scored // nothing matched: keep page order

  const chosen: typeof scored = []
  let used = 0
  for (const item of ranked) {
    if (used >= maxChars) break
    chosen.push(item)
    used += item.line.length + 1
  }

  const joined = chosen
    .sort((a, b) => a.index - b.index)
    .map(s => s.line)
    .join('\n')
  return joined.length > maxChars ? joined.slice(0, maxChars) + '…' : joined
}

// ---------- Network ----------

async function fetchText(
  url: string,
  timeoutMs: number,
  htmlOnly: boolean,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get('content-type') ?? ''
    if (htmlOnly && !/html|xml/i.test(type)) {
      throw new Error(`Not an HTML page (${type || 'unknown type'})`)
    }
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// DuckDuckGo wraps result links: //duckduckgo.com/l/?uddg=<encoded real url>&rut=...
function resolveResultUrl(href: string): string | null {
  const raw = decodeEntities(href)
  if (/duckduckgo\.com\/y\.js/.test(raw)) return null // ad

  const wrapped = /[?&]uddg=([^&]+)/.exec(raw)
  let url = wrapped ? decodeURIComponent(wrapped[1]) : raw
  if (url.startsWith('//')) url = 'https:' + url
  // iOS blocks plain http (App Transport Security), so try https.
  url = url.replace(/^http:\/\//i, 'https://')
  return /^https:\/\//i.test(url) ? url : null
}

export function parseSearchResults(html: string): Array<SearchHit> {
  const anchor = /<a\b([^>]*\bresult__a\b[^>]*)>([\s\S]*?)<\/a>/gi
  const matches: Array<{ start: number, end: number, attrs: string, inner: string }> = []
  let m: RegExpExecArray | null
  while ((m = anchor.exec(html))) {
    matches.push({ start: m.index, end: m.index + m[0].length, attrs: m[1], inner: m[2] })
  }

  const hits: Array<SearchHit> = []
  const seen = new Set<string>()
  matches.forEach((match, i) => {
    const href = /href="([^"]*)"/i.exec(match.attrs)?.[1]
    const url = href ? resolveResultUrl(href) : null
    if (!url || seen.has(url)) return
    seen.add(url)

    // The snippet sits between this result's link and the next result's link.
    const segment = html.slice(match.end, matches[i + 1]?.start ?? html.length)
    const snippet = /<a\b[^>]*\bresult__snippet\b[^>]*>([\s\S]*?)<\/a>/i.exec(segment)

    hits.push({
      title: collapse(stripTags(match.inner)),
      url,
      snippet: snippet ? collapse(stripTags(snippet[1])) : '',
    })
  })
  return hits
}

export default class WebScraper {
  static async search(query: string): Promise<Array<SearchHit>> {
    const html = await fetchText(
      `${SEARCH_URL}?q=${encodeURIComponent(query)}`,
      SEARCH_TIMEOUT_MS,
      true,
    )
    const hits = parseSearchResults(html)
    if (!hits.length) {
      throw new Error(
        /anomaly|captcha|blocked/i.test(html)
          ? 'The search engine blocked the request.'
          : 'The search engine returned no results.',
      )
    }
    return hits
  }

  static async readPage(url: string): Promise<string> {
    const html = await fetchText(url, PAGE_TIMEOUT_MS, true)
    return htmlToText(html)
  }

  /*
  Searches, then reads the top pages in parallel. A page that fails to load
  falls back to its search snippet, so one bad site doesn't lose the result.
  * */
  static async searchAndRead(
    query: string,
    maxResults: number,
    charsPerResult: number,
  ): Promise<Array<ScrapedResult>> {
    const hits = (await WebScraper.search(query)).slice(0, maxResults)

    return Promise.all(
      hits.map(async (hit): Promise<ScrapedResult> => {
        let pageText = ''
        const host = hit.url.replace(/^https:\/\//i, '').split('/')[0]
        if (!UNSCRAPEABLE_HOSTS.test(host)) {
          try {
            pageText = extractRelevant(
              await WebScraper.readPage(hit.url),
              query,
              charsPerResult,
            )
          } catch (err) {
            // Fall back to the snippet below.
          }
        }
        return {
          title: hit.title,
          url: hit.url,
          text: pageText || hit.snippet,
        }
      }),
    )
  }
}