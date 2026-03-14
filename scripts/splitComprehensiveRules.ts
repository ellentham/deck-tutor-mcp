#!/usr/bin/env npx tsx
/**
 * Splits the Magic Comprehensive Rules into individual section files.
 * Run after downloading the rules TXT from Magic.Wizards.com/Rules.
 *
 * Usage:
 *   1. Save the rules as deck-tutor-mcp/resources/magic-comprehensive-rules.txt
 *   2. npx tsx scripts/splitComprehensiveRules.ts
 *
 * Creates:
 *   - resources/sections/724-the-monarch.md (one file per major section)
 *   - resources/sections/index.json (rule number -> filename mapping)
 */

import { readFile, mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCES = join(__dirname, '..', 'resources')
const RULES_PATH = join(RESOURCES, 'magic-comprehensive-rules.txt')
const SECTIONS_DIR = join(RESOURCES, 'sections')

/** Slugify "724. The Monarch" -> "724-the-monarch" */
function slugify(num: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  return `${num}-${slug}`
}

async function main() {
  let content: string
  try {
    content = await readFile(RULES_PATH, 'utf-8')
  } catch {
    console.error(
      'Rules file not found. Download from Magic.Wizards.com/Rules (TXT) and save as:\n  ' +
        RULES_PATH
    )
    process.exit(1)
  }

  await mkdir(SECTIONS_DIR, { recursive: true })

  // Normalize line endings and match section headers at start of line.
  // Format: "724. The Monarch" (3 digits, dot, space, title) — NOT "724.1." (subrule)
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const sectionRe = /^(\d{3})\.\s+([^\n]+)/gm
  const sections: Array<{ num: string; title: string; start: number; end: number }> = []
  let m: RegExpExecArray | null

  while ((m = sectionRe.exec(normalized)) !== null) {
    const num = m[1]
    const title = m[2].trim()
    const start = m.index
    sections.push({ num, title, start, end: 0 })
  }

  // Set end index for each section (start of next, or end of file)
  for (let i = 0; i < sections.length; i++) {
    sections[i].end = i + 1 < sections.length ? sections[i + 1].start : normalized.length
  }

  const index: Record<string, string> = {}
  let written = 0

  for (const { num, title, start, end } of sections) {
    let sectionText = normalized.slice(start, end).trim()
    // Skip TOC entries: real sections have subrules (e.g. "724.1.")
    if (!new RegExp(`\\b${num}\\.1\\.`).test(sectionText)) continue
    // Add newlines between subrules for readability
    sectionText = sectionText.replace(/\s+(\d{3}\.\d+[a-z]?\.)\s+/g, '\n\n$1 ')
    sectionText = sectionText.replace(/\s+(\d{3}\.\d+\.)\s+/g, '\n\n$1 ')

    const filename = `${slugify(num, title)}.md`
    const filepath = join(SECTIONS_DIR, filename)
    await writeFile(filepath, sectionText, 'utf-8')
    index[num] = filename
    written++
  }

  await writeFile(join(SECTIONS_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8')

  console.log(`Split ${written} sections into ${SECTIONS_DIR}`)
  console.log('Index: sections/index.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
