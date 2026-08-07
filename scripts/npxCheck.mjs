/**
 * Verifies the published install path from mcp.json works end to end:
 * npx installs from GitHub, builds, and serves resources from the packaged copy.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const ref = process.argv[2] ?? 'github:ellentham/deck-tutor-mcp'
const transport = new StdioClientTransport({ command: 'npx', args: ['-y', ref], stderr: 'pipe' })
const client = new Client({ name: 'npx-check', version: '1.0.0' })
await client.connect(transport)

console.log('version:', JSON.stringify(client.getServerVersion()))

const { resources } = await client.listResources()
let bad = 0
for (const res of resources) {
  const r = await client.readResource({ uri: res.uri })
  const text = r.contents?.[0]?.text ?? ''
  if (!text || text.startsWith('# Error loading resource')) {
    bad++
    console.log('  BROKEN RESOURCE:', res.uri)
  }
}
console.log(`resources: ${resources.length} listed, ${bad} broken`)

const rule = await client.callTool({ name: 'lookup_comprehensive_rule', arguments: { ruleNumber: '702.19' } })
console.log('702.19 ->', rule.content[0].text.slice(0, 80).replace(/\n/g, ' '))

const card = await client.callTool({ name: 'extract_strategy_from_card', arguments: { cardName: 'Kumena, Tyrant of Orazca' } })
console.log('Kumena ->', JSON.parse(card.content[0].text).suggestedQuery)

await client.close()
process.exit(bad > 0 ? 1 : 0)
