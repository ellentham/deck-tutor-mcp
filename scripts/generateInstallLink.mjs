#!/usr/bin/env node
/**
 * Print a Cursor MCP install deeplink for Deck Tutor.
 * See https://cursor.com/docs/mcp/install-links
 */

const config = {
  command: 'npx',
  args: ['-y', 'github:ellentham/deck-tutor-mcp'],
}

const encoded = Buffer.from(JSON.stringify(config)).toString('base64')
const link = `cursor://anysphere.cursor-deeplink/mcp/install?name=deck-tutor&config=${encoded}`

console.log('Deck Tutor MCP install link (desktop IDE / Agent Window):\n')
console.log(link)
console.log('\nCloud agents / mobile: add the same config under Dashboard → Integrations & MCP')
console.log('or the MCP dropdown at https://cursor.com/agents\n')
console.log('Config JSON:')
console.log(JSON.stringify({ 'deck-tutor': config }, null, 2))
