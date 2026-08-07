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
| `lookup_comprehensive_rule` | Returns a small chunk of the Magic Comprehensive Rules by rule number, subrule, or keyword. Use instead of fetching the full ~950KB document. |

**extract_strategy_from_card** — Input: `cardName` (string). Output: `colorIdentity`, `creatureTypes`, `mechanics`, `triggers`, `scryfallQueryFragments`, `suggestedQuery`, etc.

**lookup_comprehensive_rule** — Input: `ruleNumber` (optional, e.g. `"724"` for The Monarch) or `keyword` (optional, e.g. `"monarch"`, `"trample"`). Returns the matching rule section(s) as markdown.

`ruleNumber` also accepts a subrule, e.g. `"702.19"` for Trample. The two keyword sections are far too large to return whole (702 is ~145KB), so they return an outline of their subrules — which doubles as an index of every keyword ability — and you request the subrule you need from it. Keyword searches are capped at 12 sections and report how many were omitted.

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
4. This creates `resources/sections/` with one file per rule (e.g. `724-the-monarch.md`), a `glossary.md`, and an `index.json`. Lookups read only the needed file (~1–5 KB) instead of the full document.
5. Restart the MCP server (e.g. restart Cursor or reload MCP) so it picks up the split sections.

### Option B — Full file only

If you skip the split, save the rules as `magic-comprehensive-rules.txt` or `magic-comprehensive-rules.md` in `resources/`. The lookup tool will parse the full file on each request (slower, but works).

---

## Standalone Installation

This MCP works on its own.

1. **Copy the entire `deck-tutor-mcp` folder** (or clone the repo).

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

To verify a build, run the smoke test. It drives the built server as a real MCP client over stdio and checks the handshake, every resource, both tools, and their error paths. Card lookups hit the live Scryfall API, so it needs network access.

```bash
npm run build && npm run smoke
```

To check the published install path that `mcp.json` uses (`npx -y github:...`), run `npm run check-npx`.

3. **Required files to ship:**
   - `package.json`
   - `src/` (TypeScript source)
   - `resources/` (all markdown files, plus `sections/` if you ran the split)
   - `tsconfig.json`
   - After `npm run build`: `dist/` (compiled JS)

---

## Cursor Integration

Deck Tutor works in the **Cursor IDE**, **Agent Window**, **CLI**, **Cloud Agents**, and **mobile app**. Pick the setup that matches where you work.

### Quick install (desktop)

Run `npm run install-link` to print a one-click install deeplink, or open this link on a machine with Cursor installed:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=deck-tutor&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1YjplbGxlbnRoYW0vZGVjay10dXRvci1tY3AiXX0=
```

That registers a **user-level** MCP server (available in every workspace on that machine).

### General workspace (all projects on desktop)

**Option A — Cursor plugin (recommended):** Install the plugin from **Customize** in the Cursor sidebar. This repo includes a plugin manifest (`.cursor-plugin/plugin.json`) and bundled `mcp.json`, so Deck Tutor is available across your general workspace without per-repo setup.

1. Open **Customize** in the sidebar.
2. Install from this repository (local test: symlink to `~/.cursor/plugins/local/deck-tutor`, then reload Cursor).
3. Enable the **deck-tutor** MCP server in Customize.

**Option B — User-level `mcp.json`:** Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "npx",
      "args": ["-y", "github:ellentham/deck-tutor-mcp"]
    }
  }
}
```

After publishing to npm, you can use `"args": ["-y", "deck-tutor-mcp"]` instead.

### Mobile and Cloud Agents (iPhone, iPad, cursor.com/agents)

Cloud agents and the mobile app **do not** read `.cursor/mcp.json` from your repo. Add Deck Tutor as a **personal MCP server** in the Cursor web UI:

1. Open [cursor.com/agents](https://cursor.com/agents) and start or open an agent chat.
2. Click the **`+`** button to the left of the prompt bar.
3. Choose **Add files, skills, and MCP servers** → **MCP Servers** → **Add MCP**.
4. Add a **stdio** server named `deck-tutor` with this configuration:

```json
{
  "command": "npx",
  "args": ["-y", "github:ellentham/deck-tutor-mcp"]
}
```

5. On mobile, **enable `deck-tutor` when starting a run** via the same **`+`** menu (MCP servers are chosen per run on mobile).
6. No API keys are required. The server uses the public Scryfall API for card lookups.

> **Note:** MCP management lives on the web UI (`+` menu), not in the mobile app settings. Once configured, the same server is available on phone, web, and desktop cloud agents.
>
> **After updating this MCP server**, start a **new cloud agent run** so the VM installs the latest version (`npx` caches by package version).

### This repository (local development)

When working in a clone of this repo, `.cursor/mcp.json` runs the built server from the workspace:

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

Run `npm install && npm run build` first. For development without building:

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"]
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
