const NodeID3 = require('node-id3');
const path = require('path');

/**
 * Updates the metadata tags of an audio file.
 * Currently supports MP3 only (via node-id3).
 * FLAC/M4A support requires an additional library (e.g. ffmetadata or metaflac-js).
 */
function updateMetadata(filePath, title, artist, album, trackNumber, date) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext !== '.mp3') {
        console.log(`[SKIP] Tagging not supported for ${path.basename(filePath)} (${ext}). Only MP3 is supported.`);
        return;
    }

    const tags = {
        title,
        artist,
        album,
        trackNumber: String(trackNumber),
        year: date ? date.substring(0, 4) : undefined
    };

    const success = NodeID3.update(tags, filePath);
    if (!success) {
        console.log(`[WARN] Failed to write tags to ${path.basename(filePath)}.`);
    }
}

module.exports = { updateMetadata };
