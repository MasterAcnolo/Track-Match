const path = require('path');

const VALID_AUDIO_EXTENSIONS = [".mp3", ".flac", ".m4a", ".wav", ".ogg"];

function getSafeFilename(title) {
    return title.replace(/[\\/:*?"<>|]/g, "");
}

function normalizeText(text) {
    return text.replace(/['´']/g, "'").toLowerCase();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isAudioFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return VALID_AUDIO_EXTENSIONS.includes(ext);
}

module.exports = {
    getSafeFilename,
    normalizeText,
    delay,
    isAudioFile,
    VALID_AUDIO_EXTENSIONS
};
