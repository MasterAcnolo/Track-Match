#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { parseArgs } = require('node:util');
const { fetchAlbums, fetchTracklist } = require('./lib/api');
const { matchTracksToFiles } = require('./lib/matcher');
const { updateMetadata } = require('./lib/metadata');
const { isAudioFile } = require('./lib/utils');
const { createInterface, askNumeric, askYesNo } = require('./lib/prompt');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatConfidence(score) {
    const pct = Math.round(score * 100);
    if (pct >= 50) return `[${pct}%]`;
    return `[${pct}% LOW]`;
}

function printUsage() {
    console.log(`
Usage: track-match <path> [options]

Arguments:
  path                    Path to the folder containing audio files

Options:
  --artist,  -a <name>    Artist or band name (used to refine the API search)
  --album,   -r <name>    Album name (defaults to the folder name)
  --output,  -o <dir>     Write renamed files to a separate output directory
  --format,  -f <pattern> Filename pattern (default: "{pos} - {title}")
                          Tokens: {pos}, {title}
                          Example: --format "{pos} - {title}"
  --auto-pick             Automatically select the top API result (skip manual selection)
  --no-tag                Rename files without updating metadata tags
  --dry                   Preview changes without writing anything to disk
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {

    if (process.argv.length <= 2) {
      printUsage();
      process.exit(0);
    }

    const options = {
        artist: { type: 'string',  short: 'a' },
        album: { type: 'string',  short: 'r' },
        output: { type: 'string',  short: 'o' },
        format: { type: 'string',  short: 'f' },
        'auto-pick': { type: 'boolean' },
        'no-tag': { type: 'boolean' },
        dry: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    };

    let args;
    try {
        const parsed = parseArgs({ options, allowPositionals: true });
        args = parsed.values;
        if (!args.path && parsed.positionals.length > 0) {
            args.path = parsed.positionals[0];
        }
    } catch (e) {
        console.error(`[ERROR] Invalid arguments: ${e.message}`);
        process.exit(1);
    }

    if (args.help) {
        printUsage();
        process.exit(0);
    }

    if (!args.path) {
        console.error('[ERROR] Missing required argument: path');
        printUsage();
        process.exit(1);
    }

    const folderPath = path.resolve(args.path);
    const artistName = args.artist || "";
    const autoPick = args['auto-pick'] || false;
    const noTag = args['no-tag'] || false;
    const dryRun = args.dry || false;
    const fileFormat = args.format || "{pos} - {title}";

    // Resolve output directory
    let outputDir = folderPath;
    if (args.output) {
        outputDir = path.resolve(args.output);
        if (!dryRun) {
            await fs.mkdir(outputDir, { recursive: true });
        }
    }

    // ---------------------------------------------------------------------------
    // Read local audio files
    // ---------------------------------------------------------------------------

    let files;
    try {
        files = await fs.readdir(folderPath);
    } catch {
        console.error(`[ERROR] Directory not found: ${folderPath}`);
        process.exit(1);
    }

    const localAudioFiles = files.filter(isAudioFile);

    if (localAudioFiles.length === 0) {
        console.log('No audio files found in the specified directory.');
        return;
    }

    const albumName = args.album || path.basename(folderPath);

    // ---------------------------------------------------------------------------
    // MusicBrainz album search
    // ---------------------------------------------------------------------------

    console.log(`\nSearching MusicBrainz for: '${albumName}'${artistName ? ` | Artist: '${artistName}'` : ''}...`);

    const albums = await fetchAlbums(albumName, artistName);
    if (albums.length === 0) {
        console.log('[ERROR] No releases found on MusicBrainz.');
        return;
    }

    // ---------------------------------------------------------------------------
    // Album selection
    // ---------------------------------------------------------------------------

    let selectedAlbum;

    if (autoPick) {
        selectedAlbum = albums[0];
        console.log(`\nAuto-selected: ${selectedAlbum.title} (${selectedAlbum.date || 'Unknown date'}) [${selectedAlbum.country || '?'}] - ${selectedAlbum['track-count'] || '?'} tracks`);
    } else {
        console.log('\nSelect the correct album:\n');
        albums.forEach((album, i) => {
            const date    = album.date || 'Unknown date';
            const country = album.country || '?';
            const tracks  = album['track-count'] || '?';
            const title   = album.title || 'Unknown title';
            console.log(`  ${i + 1} - ${title} (${date}) [${country}] - ${tracks} tracks`);
        });
        console.log('  0 - Cancel\n');

        const rl = createInterface();
        const choice = await askNumeric(rl, 'Choice: ', albums.length);
        rl.close();

        if (choice === 0) {
            console.log('Cancelled.');
            return;
        }

        selectedAlbum = albums[choice - 1];
    }

    // ---------------------------------------------------------------------------
    // Fetch tracklist & match
    // ---------------------------------------------------------------------------

    console.log('\nFetching tracklist...');
    const apiTracks = await fetchTracklist(selectedAlbum.id);

    const { proposedRenames, unmatchedFiles } = matchTracksToFiles(apiTracks, localAudioFiles, fileFormat);

    // ---------------------------------------------------------------------------
    // Display results
    // ---------------------------------------------------------------------------

    console.log('\n' + '-'.repeat(70));
    console.log('Proposed renames:\n');

    if (proposedRenames.length > 0) {
        proposedRenames.forEach(({ oldName, newName, confidence }) => {
            const conf = formatConfidence(confidence);
            console.log(`  ${conf.padEnd(10)} '${oldName}'`);
            console.log(`             --> '${newName}'`);
        });
    } else {
        console.log('  No files could be matched.');
    }

    if (unmatchedFiles.length > 0) {
        console.log('\nUnmatched files:');
        unmatchedFiles.forEach(f => console.log(`  - ${f}`));
    }

    console.log('-'.repeat(70));

    // ---------------------------------------------------------------------------
    // Dry run guard
    // ---------------------------------------------------------------------------

    if (dryRun) {
        console.log('\nDry run: no files were modified.');
        return;
    }

    if (proposedRenames.length === 0) {
        console.log('\nNothing to apply.');
        return;
    }

    // ---------------------------------------------------------------------------
    // Confirmation
    // ---------------------------------------------------------------------------

    const rl2 = createInterface();
    const confirmed = await askYesNo(rl2, '\nApply renames' + (noTag ? '' : ' and tags') + '?');
    rl2.close();

    if (!confirmed) {
        console.log('Aborted.');
        return;
    }

    // ---------------------------------------------------------------------------
    // Apply renames (and tags)
    // ---------------------------------------------------------------------------

    for (const { oldName, newName, position, apiTitle } of proposedRenames) {
        const srcPath = path.join(folderPath, oldName);
        const destPath = path.join(outputDir, newName);

        if (outputDir === folderPath) {
            await fs.rename(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }

        if (!noTag) {
            updateMetadata(
                destPath,
                apiTitle,
                artistName || 'Unknown Artist',
                selectedAlbum.title,
                position,
                selectedAlbum.date || ''
            );
        }
    }

    console.log(`\nDone. ${proposedRenames.length} file(s) processed.`);
    if (args.output) {
        console.log(`Output written to: ${outputDir}`);
    }
}

main().catch(err => {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
});
