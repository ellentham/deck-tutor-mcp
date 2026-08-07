/**
 * Rule lookup for Magic: The Gathering Comprehensive Rules.
 * Prefers pre-split sections (from splitComprehensiveRules.ts) when available;
 * falls back to parsing the full document.
 */

import { readFile, access, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const RESOURCES_DIR = join(__dirname, '..', 'resources')
const SECTIONS_DIR = join(RESOURCES_DIR, 'sections')

/** Check if split sections exist (index.json + section files) */
async function hasSplitSections(): Promise<boolean> {
  try {
    await access(join(SECTIONS_DIR, 'index.json'))
    return true
  } catch {
    return false
  }
}

/** Load section index: rule number -> filename */
async function loadSectionIndex(): Promise<Record<string, string>> {
  const path = join(SECTIONS_DIR, 'index.json')
  const json = await readFile(path, 'utf-8')
  return JSON.parse(json) as Record<string, string>
}

/** Resolve path to full rules file; supports .md or .txt (Wizards provides TXT) */
async function getRulesPath(): Promise<string> {
  for (const ext of ['.md', '.txt']) {
    const p = join(RESOURCES_DIR, `magic-comprehensive-rules${ext}`)
    try {
      await access(p)
      return p
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Comprehensive Rules file not found. Add magic-comprehensive-rules.md or magic-comprehensive-rules.txt to deck-tutor-mcp/resources/. Download from Magic.Wizards.com/Rules (TXT format). Run "npx tsx scripts/splitComprehensiveRules.ts" after adding the file for faster lookups.'
  )
}

/** Build a regex to find the start of a section (e.g. 724) in the rules body (not TOC) */
function findSectionStart(content: string, ruleNum: string): number {
  // TOC has "724. The Monarch 725. The Initiative" with no subrules.
  // Rules body has "724. The Monarch 724.1." - so look for the pattern with subrule
  const marker = `${ruleNum}. `
  const withSubrule = `${ruleNum}.1.`
  const idx = content.indexOf(withSubrule)
  if (idx >= 0) {
    // Back up to find "724. The Monarch" before "724.1."
    const before = content.slice(0, idx)
    const lastMarker = before.lastIndexOf(marker)
    if (lastMarker >= 0) return lastMarker
  }
  // Fallback: first occurrence of "724. " that's followed by more rule content
  const fallback = content.indexOf(marker)
  return fallback >= 0 ? fallback : -1
}

/** Find the start of the next section after the given index */
function findNextSectionStart(content: string, afterIndex: number): number {
  // Match " XXX. " where XXX is 3 digits - start of next major section
  const re = /\s(\d{3})\.\s/g
  re.lastIndex = afterIndex
  const m = re.exec(content)
  if (m) return m.index + 1 // +1 to include the space
  // No further section: stop at the Glossary so the last numbered section
  // (905) doesn't swallow the Glossary and Credits.
  const glossary = /^Glossary[ \t]*$/m.exec(content.slice(afterIndex))
  return glossary ? afterIndex + glossary.index : content.length
}

/** Largest section body returned verbatim; beyond this an outline is returned instead. */
const MAX_SECTION_CHARS = 25000

/** Most keyword matches returned; common words otherwise match nearly every section. */
const MAX_KEYWORD_RESULTS = 12

/**
 * Split a section body into its subrule blocks, e.g. "702.9. Trample" and "702.9a ...".
 * Returns entries in document order with their numeric identity so ranges can be sliced.
 */
function parseSubrules(
  section: string
): Array<{ major: string; minor: number; letter: string; start: number; end: number; text: string }> {
  const re = /^(\d{3})\.(\d+)([a-z]?)\.?\s/gm
  const marks: Array<{ major: string; minor: number; letter: string; start: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(section)) !== null) {
    marks.push({ major: m[1], minor: Number(m[2]), letter: m[3] ?? '', start: m.index })
  }
  return marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : section.length
    return { ...mark, end, text: section.slice(mark.start, end).trim() }
  })
}

/** Outline of a section: its subrule numbers and first lines, for oversized sections. */
function buildOutline(ruleNum: string, section: string): string {
  // Cross-references to other sections ("See rule 120.3.") also start lines here,
  // so keep only subrules actually belonging to this section.
  const subrules = parseSubrules(section).filter((s) => s.letter === '' && s.major === ruleNum)
  const header = section.split('\n')[0]?.trim() || `${ruleNum}.`
  const lines = subrules.map((s) => {
    const firstLine = s.text.split('\n')[0].replace(/\s+/g, ' ').trim()
    return `- ${firstLine.slice(0, 120)}${firstLine.length > 120 ? '…' : ''}`
  })
  return [
    header,
    '',
    `This section is ${section.length.toLocaleString()} characters — too large to return in full.`,
    `Request a specific subrule instead, e.g. ruleNumber: "${ruleNum}.${subrules[1]?.minor ?? 1}".`,
    '',
    'Subrules:',
    ...lines,
  ].join('\n')
}

/** Extract a single subrule range (e.g. "702.9") including its lettered parts. */
function extractSubrule(section: string, major: string, minor: number): string | null {
  const subrules = parseSubrules(section)
  const matching = subrules.filter((s) => s.major === major && s.minor === minor)
  if (matching.length === 0) return null
  const start = matching[0].start
  const end = matching[matching.length - 1].end
  return section.slice(start, end).trim()
}

/**
 * Extract a section by rule number (e.g. "724", "701"), a subrule (e.g. "702.9"),
 * or the Glossary ("glossary"). Oversized sections return an outline instead of
 * their full body so callers aren't handed tens of thousands of tokens.
 */
export async function lookupRuleByNumber(ruleNum: string): Promise<string> {
  const raw = ruleNum.trim()

  if (/^glossary$/i.test(raw)) {
    return 'The Glossary is large; search it with the keyword argument instead, e.g. keyword: "monarch".'
  }

  // "702.9" / "702.9a" -> section 702, subrule 9
  const subruleMatch = /^(\d{1,3})\.(\d+)[a-z]?\.?$/.exec(raw)
  const sectionPart = subruleMatch ? subruleMatch[1] : raw.replace(/\.$/, '')
  const requestedMinor = subruleMatch ? Number(subruleMatch[2]) : null

  const normalized = sectionPart.replace(/^0+/, '') || '0'
  const padded = normalized.padStart(3, '0') // "724" or "24" -> "724", "024"

  let section: string | null = null

  if (await hasSplitSections()) {
    const index = await loadSectionIndex()
    const filename = index[padded]
    if (filename) {
      try {
        section = await readFile(join(SECTIONS_DIR, filename), 'utf-8')
      } catch {
        /* fall through to full-file parsing */
      }
    }
  }

  if (section === null) {
    const path = await getRulesPath()
    const content = await readFile(path, 'utf-8')
    const start = findSectionStart(content, padded)
    if (start < 0) {
      return `Rule ${padded} not found in the Comprehensive Rules.`
    }
    const end = findNextSectionStart(content, start + 1)
    section = content.slice(start, end).trim()
    // Add some breathing room - insert newlines between subrules for readability
    section = section.replace(/\s+(\d{3}\.\d+[a-z]?\.)\s+/g, '\n\n$1 ')
    section = section.replace(/\s+(\d{3}\.\d+\.)\s+/g, '\n\n$1 ')
  }

  if (requestedMinor !== null) {
    const subrule = extractSubrule(section, padded, requestedMinor)
    if (subrule) return subrule
    return `Rule ${padded}.${requestedMinor} not found. Look up ruleNumber "${padded}" for the section outline.`
  }

  if (section.length > MAX_SECTION_CHARS) {
    return buildOutline(padded, section)
  }

  return section
}

/** Search for sections mentioning a keyword (e.g. "monarch", "trample") */
export async function lookupRuleByKeyword(keyword: string): Promise<string> {
  const lower = keyword.toLowerCase().trim()
  const results: Array<{ rule: string; snippet: string }> = []

  if (await hasSplitSections()) {
    const index = await loadSectionIndex()
    const files = await readdir(SECTIONS_DIR)
    for (const [num, filename] of Object.entries(index)) {
      if (!files.includes(filename)) continue
      const content = await readFile(join(SECTIONS_DIR, filename), 'utf-8')
      if (!content.toLowerCase().includes(lower)) continue
      const firstLine = content.split('\n')[0] ?? ''
      const title = firstLine.replace(/^\d{3}\.\s+/, '').trim()
      const idx = content.toLowerCase().indexOf(lower)
      const from = Math.max(0, idx - 100)
      const to = Math.min(content.length, idx + 400)
      let snippet = content.slice(from, to).trim()
      if (from > 0) snippet = '...' + snippet
      if (to < content.length) snippet = snippet + '...'
      const label = /^\d{3}$/.test(num) ? `${num}. ${title}` : title || num
      results.push({ rule: label, snippet })
    }
  } else {
    const path = await getRulesPath()
    const content = await readFile(path, 'utf-8')
    const sectionRe = /\s(\d{3})\.\s+([^.]+?)(?=\s+\d{3}\.\d|$)/g
    let m: RegExpExecArray | null
    const sections: Array<{ num: string; title: string; start: number }> = []
    while ((m = sectionRe.exec(content)) !== null) {
      sections.push({ num: m[1], title: m[2].trim(), start: m.index + 1 })
    }
    for (let i = 0; i < sections.length; i++) {
      const { num, title, start } = sections[i]
      const end = i + 1 < sections.length ? sections[i + 1].start : content.length
      const sectionText = content.slice(start, end)
      if (sectionText.toLowerCase().includes(lower)) {
        const idx = sectionText.toLowerCase().indexOf(lower)
        const from = Math.max(0, idx - 100)
        const to = Math.min(sectionText.length, idx + 400)
        let snippet = sectionText.slice(from, to).trim()
        if (from > 0) snippet = '...' + snippet
        if (to < sectionText.length) snippet = snippet + '...'
        results.push({ rule: `${num}. ${title}`, snippet })
      }
    }
  }

  if (results.length === 0) {
    return `No Comprehensive Rules sections found mentioning "${keyword}".`
  }

  const shown = results.slice(0, MAX_KEYWORD_RESULTS)
  const lines = shown.map((r) => `**${r.rule}**\n${r.snippet}`)
  if (results.length > shown.length) {
    lines.push(
      `_${results.length} sections mention "${keyword}"; showing the first ${shown.length}. ` +
        `Use a more specific term, or ruleNumber for a known section._`
    )
  }
  return lines.join('\n\n---\n\n')
}
