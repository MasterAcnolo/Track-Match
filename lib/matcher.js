const path = require('path');
const stringSimilarity = require('string-similarity');
const { getSafeFilename, normalizeText } = require('./utils');

/**
 * Matches official API track titles to local filenames using a 2-pass system.
 *
 * PASS 1 (strict): exact substring or >= 50% similarity.
 * PASS 2 (deduction): process of elimination with >= 10% similarity fallback.
 *
 * Each result includes a confidence score (0.0 - 1.0) for display purposes.
 */
function matchTracksToFiles(apiTracks, localFiles, format) {
    const proposedRenames = [];
    let unmatchedFiles = [...localFiles];
    const matchedApiPositions = new Set();

    // Sort by longest title first to avoid short titles stealing matches
    const sortedTracks = [...apiTracks].sort((a, b) => b.title.length - a.title.length);

    // PASS 1: Strict matching
    for (const { position, title } of sortedTracks) {
        if (unmatchedFiles.length === 0) break;

        const apiTitleNorm = normalizeText(title);
        let matchedFile = null;
        let confidence = 0;

        // Method 1: Substring match
        for (const file of unmatchedFiles) {
            if (normalizeText(file).includes(apiTitleNorm)) {
                matchedFile = file;
                confidence = 1.0;
                break;
            }
        }

        // Method 2: Fuzzy match (threshold: 50%)
        if (!matchedFile) {
            const cleanLocalNames = unmatchedFiles.map(f => normalizeText(path.parse(f).name));
            const bestMatch = stringSimilarity.findBestMatch(apiTitleNorm, cleanLocalNames);

            if (bestMatch.bestMatch.rating >= 0.5) {
                matchedFile = unmatchedFiles[bestMatch.bestMatchIndex];
                confidence = bestMatch.bestMatch.rating;
            }
        }

        if (matchedFile) {
            unmatchedFiles = unmatchedFiles.filter(f => f !== matchedFile);
            matchedApiPositions.add(position);

            const ext = path.extname(matchedFile);
            const newName = buildFilename(format, position, title, ext);

            proposedRenames.push({ oldName: matchedFile, newName, position, apiTitle: title, confidence });
        }
    }

    // PASS 2: Deduction (process of elimination)
    if (unmatchedFiles.length > 0) {
        let remainingApiTracks = apiTracks.filter(t => !matchedApiPositions.has(t.position));

        for (const file of [...unmatchedFiles]) {
            if (remainingApiTracks.length === 0) break;

            const fileNorm = normalizeText(file);
            const apiTitlesNorm = remainingApiTracks.map(t => normalizeText(t.title));

            const bestMatch = stringSimilarity.findBestMatch(fileNorm, apiTitlesNorm);
            let matchedApiTrack = null;
            let confidence = 0;

            if (bestMatch.bestMatch.rating >= 0.1) {
                matchedApiTrack = remainingApiTracks[bestMatch.bestMatchIndex];
                confidence = bestMatch.bestMatch.rating;
            } else {
                // Fallback: check if the API title appears inside the filename
                const fallbackIndex = apiTitlesNorm.findIndex(apiName => fileNorm.includes(apiName));
                if (fallbackIndex !== -1) {
                    matchedApiTrack = remainingApiTracks[fallbackIndex];
                    confidence = 0.1;
                }
            }

            if (matchedApiTrack) {
                unmatchedFiles = unmatchedFiles.filter(f => f !== file);
                remainingApiTracks = remainingApiTracks.filter(t => t.position !== matchedApiTrack.position);

                const ext = path.extname(file);
                const newName = buildFilename(format, matchedApiTrack.position, matchedApiTrack.title, ext);

                proposedRenames.push({
                    oldName: file,
                    newName,
                    position: matchedApiTrack.position,
                    apiTitle: matchedApiTrack.title,
                    confidence
                });
            }
        }
    }

    proposedRenames.sort((a, b) => a.position - b.position);
    return { proposedRenames, unmatchedFiles };
}

/**
 * Builds the output filename from a format pattern.
 * Supported tokens: {pos}, {title}
 * The artist token is resolved upstream and passed as part of `title` if needed,
 * or the caller should use buildFilenameWithArtist instead.
 */
function buildFilename(format, position, title, ext) {
    const safeTitle = getSafeFilename(title);
    const pos = String(position).padStart(2, '0');

    const name = format
        .replace('{pos}', pos)
        .replace('{title}', safeTitle);

    return `${name}${ext}`;
}

module.exports = { matchTracksToFiles, buildFilename };
