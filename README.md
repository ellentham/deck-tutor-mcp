# Deck Tutor MCP Server

MCP server that provides Magic: The Gathering deck-building context for AI agents. Exposes synergy criteria, format rules, and comparison priorities as resources, plus a tool to extract strategy from card oracle text. Provides context for deck/card recommendations and help with rules.

**Author:** [@ellentham](https://github.com/ellentham)

**Standalone** — This package works on its own. No API keys required. Scryfall API is used for card lookups (public, no key needed).

> Deck Tutor MCP is unofficial Fan Content permitted under the [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

---

## Requirements

- Node.js 18+
- npm

---

## Tools

| Tool | Description |
|------|--------------|
| `extract_strategy_from_card` | Fetches a card from Scryfall by name and extracts deck-building strategy from its oracle text. Returns creature types, mechanics, triggers, power/toughness, and Scryfall query fragments. Use for Commander (extract from commander) or any deck where a key card defines the strategy. |
| `lookup_comprehensive_rule` | Returns a small chunk of the Magic Comprehensive Rules by rule number or keyword. Use instead of fetching the full ~950KB document. |

**extract_strategy_from_card** — Input: `cardName` (string). Output: `colorIdentity`, `creatureTypes`, `mechanics`, `triggers`, `scryfallQueryFragments`, `suggestedQuery`, etc.

**lookup_comprehensive_rule** — Input: `ruleNumber` (optional, e.g. `"724"` for The Monarch) or `keyword` (optional, e.g. `"monarch"`, `"trample"`). Returns the matching rule section(s) as markdown.

---

## Resources

| Resource | URI | Description |
|----------|-----|--------------|
| Synergy Criteria | `deck-tutor://resources/synergy-criteria` | What counts as synergy when comparing oracle text |
| Strategy Examples | `deck-tutor://resources/strategy-examples` | Examples of extracting strategy from commanders and archetypes |
| Comparison Priorities | `deck-tutor://resources/comparison-priorities` | What to weight when evaluating cards |
| Commander Brackets | `deck-tutor://resources/commander-brackets` | Power level brackets (Exhibition through cEDH) |
| Commander Rules | `deck-tutor://resources/format-rules/commander` | Commander (EDH) format structure and rules |
| Modern Rules | `deck-tutor://resources/format-rules/modern` | Modern format |
| Standard Rules | `deck-tutor://resources/format-rules/standard` | Standard (rotating) |
| Pioneer Rules | `deck-tutor://resources/format-rules/pioneer` | Pioneer format |
| Pauper Rules | `deck-tutor://resources/format-rules/pauper` | Pauper (commons only) |
| Legacy Rules | `deck-tutor://resources/format-rules/legacy` | Legacy format |
| Vintage Rules | `deck-tutor://resources/format-rules/vintage` | Vintage format |
| Brawl Rules | `deck-tutor://resources/format-rules/brawl` | Brawl (60-card Commander) |
| Oathbreaker Rules | `deck-tutor://resources/format-rules/oathbreaker` | Oathbreaker format |
| Booster Draft Rules | `deck-tutor://resources/format-rules/booster-draft` | Booster Draft (limited) |
| Sealed Deck Rules | `deck-tutor://resources/format-rules/sealed-deck` | Sealed Deck (limited) |
| Comprehensive Rules | `deck-tutor://resources/magic-comprehensive-rules` | Official MTG rules for rule lookups |
| Scryfall Keywords | `deck-tutor://resources/scryfall-keywords` | When and how to use `kw:` in Scryfall queries |

---

## Comprehensive Rules (lookup tool)

The `lookup_comprehensive_rule` tool returns small chunks instead of the full ~950KB document. **Recommended: pre-split for fast lookups.**

### Option A — Pre-split sections (recommended)

1. Download the [Comprehensive Rules](https://magic.wizards.com/en/rules) (TXT format) from Magic.Wizards.com/Rules.
2. Save as `deck-tutor-mcp/resources/magic-comprehensive-rules.txt`.
3. Run the split script:
   ```bash
   cd deck-tutor-mcp && npm run split-rules
   ```
   Or: `npx tsx scripts/splitComprehensiveRules.ts`
4. This creates `resources/sections/` with one file per rule (e.g. `724-the-monarch.md`) and an `index.json`. Lookups read only the needed file (~1–5 KB) instead of the full document.
5. Restart the MCP server (e.g. restart Cursor or reload MCP) so it picks up the split sections.

### Option B — Full file only

If you skip the split, save the rules as `magic-comprehensive-rules.txt` or `magic-comprehensive-rules.md` in `resources/`. The lookup tool will parse the full file on each request (slower, but works).

---

## Standalone Installation

This MCP works on its own.

**Install from npm:**

```bash
npm install deck-tutor-mcp
```

Then add to Cursor MCP settings (see [Cursor Integration](#cursor-integration) below), using `npx deck-tutor-mcp` as the command or pointing to `node_modules/deck-tutor-mcp/dist/index.js`.

**Or copy/clone and run locally:**

1. **Copy the entire `deck-tutor-mcp` folder** (or clone a repo containing only this package).

2. **Install and run:**

```bash
cd deck-tutor-mcp
npm install
npm run build
npm start
```

Or for development (no build step):

```bash
cd deck-tutor-mcp
npm install
npm run dev
```

3. **Required files to ship:**
   - `package.json`
   - `src/` (TypeScript source)
   - `resources/` (all markdown files, plus `sections/` if you ran the split)
   - `tsconfig.json`
   - After `npm run build`: `dist/` (compiled JS)

---

## Cursor Integration

Add to Cursor MCP settings (`.cursor/mcp.json` or Cursor Settings → MCP).

**Option A — Installed via npm (in your project):**

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "npx",
      "args": ["deck-tutor-mcp"]
    }
  }
}
```

**Option B — Run from deck-tutor-mcp directory (standalone):**

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/deck-tutor-mcp"
    }
  }
}
```

Run `npm run build` first, or use `tsx` to run without building:

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/deck-tutor-mcp"
    }
  }
}
```

---

## Transport

- **stdio** — Designed for Cursor, Claude Desktop, and other MCP clients that spawn processes and communicate over stdin/stdout.

---

## External Dependencies

- **Scryfall API** — Used by `extract_strategy_from_card` for card lookups. Public API, no key required. See [Scryfall API](https://scryfall.com/docs/api).
