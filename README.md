Track Match

A CLI tool that renames and tags a local music folder using the [MusicBrainz](https://musicbrainz.org/) API - with fuzzy matching, confidence scoring, and interactive album selection.

> [!NOTE]
> - This Project does not download any content, if you are looking for one, you can use yt-dlp (CLI) or Freedom Loader (GUI)
> - The project don't handle folder with like 25+ albums inside. The Album need to be "Sorted", like every music from an album should be inside the folder. This is what the project aims in. Add an index to music files form album so you can use any music player and listen for an album in the right order.

```
  [98%]      'daft punk - one more time.mp3'
             --> '01 - One More Time.mp3'
  [76%]      'track02.mp3'
             --> '02 - Aerodynamic.mp3'
  [14% LOW]  'audio_rip_03.flac'
             --> '03 - Digital Love.flac'

Apply renames and tags? (y/n):
```

---

## Requirements

- Node.js 18+ (uses native `fetch` and `node:util` `parseArgs`)

## Installation

### Via npm (recommended)
```bash
npm install -g @masteracnolo/track-match
```
Then use it anywhere:
```bash
track-match <path> [options]
```

### From source
```bash
git clone https://github.com/MasterAcnolo/Track-Match
cd Track-Match
npm install
node index.js <path> [options]
```

---

## Usage

```
node index.js <path> [options]
```

| Argument | Short | Type | Description |
|---|---|---|---|
| `path` | - | positional | **Required.** Path to the folder containing audio files. |
| `--artist` | `-a` | string | Artist or band name. Strongly recommended to narrow the search. |
| `--album` | `-r` | string | Album name. Defaults to the folder name if omitted. |
| `--output` | `-o` | string | Write renamed files to a separate directory. Originals are untouched. |
| `--format` | `-f` | string | Filename pattern. Default: `{pos} - {title}`. Tokens: `{pos}`, `{title}`. |
| `--auto-pick` | - | boolean | Skip interactive selection; auto-select the top API result. |
| `--no-tag` | - | boolean | Rename files without updating metadata tags. |
| `--dry` | - | boolean | Preview proposed renames without writing anything to disk. |
| `--help` | `-h` | boolean | Print usage and exit. |

### Examples

```bash
# Standard rename + tag
node index.js ~/Music/Discovery --artist "Linkin Park"

# Preview without writing anything
node index.js ~/Music/Discovery --artist "Linkin Park" --dry

# Rename only, skip metadata
node index.js ~/Music/Discovery --artist "Linkin Park" --no-tag

# Keep originals, write to a separate folder
node index.js ~/Music/Discovery --artist "Linkin Park" --output ~/Music/Discovery-clean

# Custom filename format (include artist in filename)
node index.js ~/Music/Discovery --artist "Linkin Park" --format "{pos} - Linkin Park - {title}"
# 01 - Linkin Park - Somewhere I Belong.mp3

# Skip manual selection
node index.js ~/Music/Discovery --artist "Linkin Park" --auto-pick

# Folder name doesn't match album name
node index.js ~/Music/rip_2003 --artist "Linkin Park" --album "Meteora"
```

---

## How it works

The tool operates in four steps:

1. **Search** - queries MusicBrainz for the album (using the folder name by default if no one is provided)
2. **Select** - displays the top 5 results and asks you to pick one (or auto-selects with `--auto-pick`)
3. **Match** - fuzzy-matches API track titles against local filenames using a 2-pass algorithm
4. **Apply** - renames files and writes ID3 tags after a confirmation prompt

### Matching algorithm

Matching runs in two passes using the [Dice coefficient](https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient) (via `string-similarity`).

`Before both passes, API tracks are **sorted by title length (longest first)** to prevent short titles like *"Love"* from stealing matches meant for *"Digital Love"*.
`
**Pass 1 - Strict** (threshold: 50%): for each API track, try a substring match first, then a fuzzy match. Files matched here get a confidence score of 0.5–1.0.

**Pass 2 - Deduction** (threshold: 10%): for the remaining unmatched files, run a second sweep with a looser threshold. At this stage the pool is small, so even a low-confidence match is meaningful. These matches are flagged as `LOW` in the output.

All comparisons go through `normalizeText()` first, which collapses apostrophe variants (`'`, `´`, `'`) and lowercases everything - avoiding false mismatches on punctuation differences.

### Confidence scores

| Score | Meaning |
|---|---|
| `[90%+]` | Substring or near-exact fuzzy match. Very reliable. |
| `[50–89%]` | Good fuzzy match. Title was probably abbreviated or slightly altered. |
| `[< 50%] LOW` | Pass 2 deduction. Review carefully before confirming. |

### Format tokens

| Token | Resolves to | Example |
|---|---|---|
| `{pos}` | Track position, zero-padded to 2 digits | `01`, `12` |
| `{title}` | Official track title from MusicBrainz (sanitized) | `One More Time` |

The file extension is always appended automatically.

---

## Project structure

```
Track-Match/
├── index.js          # Entry point - CLI parsing, orchestration, I/O
└── lib/
    ├── api.js         # MusicBrainz HTTP client + exponential backoff retry
    ├── matcher.js     # 2-pass fuzzy matching engine
    ├── metadata.js    # ID3 tag writer (MP3 only)
    ├── prompt.js      # readline helpers (ask, askNumeric, askYesNo)
    └── utils.js       # Shared pure functions
```

---

## Dependencies

| Package | Role |
|---|---|
| [`string-similarity`](https://www.npmjs.com/package/string-similarity) | Dice coefficient fuzzy matching |
| [`node-id3`](https://www.npmjs.com/package/node-id3) | Read/write ID3 tags on MP3 files |

---

## Known limitations

- **MP3-only tagging** - `node-id3` only supports `.mp3`. FLAC, M4A, OGG and WAV files are renamed but not tagged.
- **Top 5 results only** - if the correct release isn't in the top 5 MusicBrainz results, narrow the search with `--artist` and `--album`.
- **Multi-disc albums** - track positions are read globally across all discs, which can produce duplicate position numbers on 2-disc releases.
- **Exotic Artist Name** - For artists with non-ASCII characters in their name, the search may not be accurate. Use `--artist` to specify the exact name.

---

## Tips

If you are looking for a software to download audio and/or video, you can try [Freedom-Loader]("https://github.com/MasterAcnolo/Freedom-Loader"). It's a projected powered by yt-dlp am creating for like a year. If you need it !
