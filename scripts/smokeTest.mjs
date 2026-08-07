#!/usr/bin/env node
/**
 * End-to-end smoke test: drives the built server as a real MCP client over stdio.
 *
 * Usage:
 *   npm run build && npm run smoke
 *
 * Card lookups hit the live Scryfall API, so this needs network access.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const section = (t) => console.log(`\n${t}`)

const transport = new StdioClientTransport({
  command: 'node',
  args: [join(ROOT, 'dist', 'index.js')],
  stderr: 'pipe',
})
const client = new Client({ name: 'deck-tutor-smoke-test', version: '1.0.0' })
await client.connect(transport)

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args })
  return { text: r.content?.map((c) => c.text).join('\n') ?? '', isError: !!r.isError }
}

section('Handshake')
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'))
const advertised = client.getServerVersion()
check('server name is deck-tutor-mcp', advertised.name === 'deck-tutor-mcp')
check(
  'advertised version matches package.json',
  advertised.version === pkg.version,
  `advertised ${advertised.version}, package.json ${pkg.version}`
)

section('Tools')
const { tools } = await client.listTools()
check('both tools are listed', tools.length === 2, `got ${tools.length}`)
for (const t of tools) {
  check(`${t.name} has an object input schema`, t.inputSchema?.type === 'object')
}

section('Resources')
const { resources } = await client.listResources()
check('17 resources listed', resources.length === 17, `got ${resources.length}`)
for (const res of resources) {
  const r = await client.readResource({ uri: res.uri })
  const text = r.contents?.[0]?.text ?? ''
  check(`resource ${res.name} loads`, text.length > 0 && !text.startsWith('# Error loading resource'))
}

section('lookup_comprehensive_rule — sections')
const idx = JSON.parse(await readFile(join(ROOT, 'resources', 'sections', 'index.json'), 'utf-8'))
const numbered = Object.keys(idx).filter((n) => /^\d{3}$/.test(n))
let oversized = []
for (const num of numbered) {
  const { text } = await call('lookup_comprehensive_rule', { ruleNumber: num })
  if (text.length > 25000) oversized.push(`${num}=${text.length}`)
}
check('no section exceeds 25k chars', oversized.length === 0, oversized.join(', '))

const monarch = await call('lookup_comprehensive_rule', { ruleNumber: '724' })
check('724 returns The Monarch', monarch.text.includes('724.1.') && monarch.text.includes('monarch'))

const conspiracy = await call('lookup_comprehensive_rule', { ruleNumber: '905' })
check('905 does not swallow the Glossary/Credits', !conspiracy.text.includes('MARVEL') && conspiracy.text.length < 10000, `${conspiracy.text.length} chars`)

section('lookup_comprehensive_rule — oversized sections return an outline')
const outline = await call('lookup_comprehensive_rule', { ruleNumber: '702' })
check('702 returns an outline, not the full body', outline.text.includes('too large to return in full'))
check('702 outline lists Trample at 702.19', outline.text.includes('702.19. Trample'))
check(
  '702 outline has no foreign cross-references',
  !/^- (?!702\.)\d{3}\./m.test(outline.text)
)

section('lookup_comprehensive_rule — subrules')
const trample = await call('lookup_comprehensive_rule', { ruleNumber: '702.19' })
check('702.19 returns Trample only', trample.text.startsWith('702.19. Trample') && trample.text.length < 6000)
const flying = await call('lookup_comprehensive_rule', { ruleNumber: '702.9' })
check('702.9 returns Flying only', flying.text.startsWith('702.9. Flying'))
const badSub = await call('lookup_comprehensive_rule', { ruleNumber: '702.999' })
check('unknown subrule explains itself', badSub.text.includes('not found'))

section('lookup_comprehensive_rule — keyword search')
for (const kw of ['monarch', 'deathtouch', 'trample']) {
  const { text } = await call('lookup_comprehensive_rule', { keyword: kw })
  check(`keyword "${kw}" returns a usable result`, text.length > 100 && text.length < 25000, `${text.length} chars`)
}
const common = await call('lookup_comprehensive_rule', { keyword: 'the' })
check('common keyword is capped', common.text.length < 25000 && common.text.includes('showing the first'), `${common.text.length} chars`)
const monKw = await call('lookup_comprehensive_rule', { keyword: 'monarch' })
check('monarch keyword hits rule 724', monKw.text.includes('724. The Monarch'))
check('monarch keyword no longer mislabels glossary text as 905', !monKw.text.includes('905. Conspiracy Draft'))

section('lookup_comprehensive_rule — argument handling')
const noArgs = await call('lookup_comprehensive_rule', {})
check('no arguments returns guidance', noArgs.text.includes('Provide ruleNumber'))
const missing = await call('lookup_comprehensive_rule', { ruleNumber: '9999' })
check('unknown rule returns a clear message', missing.text.includes('not found'))

section('extract_strategy_from_card')
const expectations = [
  ['Kumena, Tyrant of Orazca', ['merfolk', 'shaman']],
  ['Sliver Overlord', ['sliver']],
  ['Gishath, Sun\u2019s Avatar', ['dinosaur']],
  ['Slimefoot, the Stowaway', ['fungus']],
  ['Edgar Markov', ['vampire']],
  ['Animar, Soul of Elements', ['elemental']],
  ['Atraxa, Praetors\u2019 Voice', ['phyrexian', 'angel', 'horror']],
]
for (const [name, expected] of expectations) {
  const { text, isError } = await call('extract_strategy_from_card', { cardName: name })
  const out = JSON.parse(text)
  const got = out.creatureTypes ?? []
  check(
    `${name} extracts ${expected.join('/')}`,
    !isError && expected.every((t) => got.includes(t)),
    `got [${got.join(', ')}]`
  )
  check(`${name} produces a Scryfall query`, typeof out.suggestedQuery === 'string' && out.suggestedQuery.includes('id:'))
}

const solRing = await call('extract_strategy_from_card', { cardName: 'Sol Ring' })
check('noncreature card yields no creature types', JSON.parse(solRing.text).creatureTypes.length === 0)

const land = await call('extract_strategy_from_card', { cardName: 'Urza\u2019s Power-Plant' })
check('land subtypes are not treated as creature types', JSON.parse(land.text).creatureTypes.length === 0, JSON.stringify(JSON.parse(land.text).creatureTypes))

const counters = await call('extract_strategy_from_card', { cardName: 'Animar, Soul of Elements' })
const animar = JSON.parse(counters.text)
check('"+1/+1 counter" does not emit a counterspell fragment', !animar.mechanics.includes('o:counter'), animar.mechanics.join(', '))

section('extract_strategy_from_card — error handling')
const missingCard = await call('extract_strategy_from_card', { cardName: 'zzzznotarealcard' })
check('unknown card reports isError', missingCard.isError && missingCard.text.includes('Card not found'))

let rejected = false
try {
  await client.callTool({ name: 'extract_strategy_from_card', arguments: {} })
} catch {
  rejected = true
}
const bad = await call('extract_strategy_from_card', {}).catch(() => ({ isError: true, text: '' }))
check('missing required argument is rejected', rejected || bad.isError)

console.log(`\n${'-'.repeat(50)}\n${passed} passed, ${failed} failed`)
await client.close()
process.exit(failed > 0 ? 1 : 0)
