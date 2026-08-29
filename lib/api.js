const { delay } = require('./utils');

const USER_AGENT = "AlbumSorter/1.0";
const BASE_URL = "https://musicbrainz.org/ws/2";

/**
 * Wrapper for API requests with an exponential backoff retry mechanism.
 * Retries on 429, 502, 503, 504.
 */
async function makeApiRequest(endpoint, params, maxRetries = 5) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: { "User-Agent": USER_AGENT, "Accept": "application/json" }
            });

            if (response.ok) {
                return await response.json();
            }

            if ([429, 502, 503, 504].includes(response.status)) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`[WARN] API busy (HTTP ${response.status}). Retrying in ${waitTime / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                await delay(waitTime);
            } else {
                throw new Error(`HTTP Error: ${response.status}`);
            }
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            await delay(Math.pow(2, attempt) * 1000);
        }
    }
    return null;
}

async function fetchAlbums(albumName, artistName = "") {
    let query = `release:"${albumName}"`;
    if (artistName) {
        query += ` AND artist:"${artistName}"`;
    }

    const data = await makeApiRequest("/release", { query, fmt: "json" });
    return data && data.releases ? data.releases.slice(0, 5) : [];
}

async function fetchTracklist(mbid) {
    const data = await makeApiRequest(`/release/${mbid}`, { inc: "recordings", fmt: "json" });
    const tracks = [];

    if (data && data.media) {
        for (const media of data.media) {
            for (const track of media.tracks) {
                tracks.push({
                    position: parseInt(track.position),
                    title: track.recording.title
                });
            }
        }
    }
    return tracks;
}

module.exports = { fetchAlbums, fetchTracklist };
