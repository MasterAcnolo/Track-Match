const readline = require('readline');

/**
 * Creates a readline interface bound to stdin/stdout.
 * Call .close() when done.
 */
function createInterface() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

/**
 * Prompts the user with a question and returns their answer as a string.
 */
function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

/**
 * Asks for a numeric choice within [0, max].
 * Keeps asking until a valid integer is entered.
 */
async function askNumeric(rl, question, max) {
    while (true) {
        const raw = await ask(rl, question);
        const n = parseInt(raw.trim(), 10);
        if (!isNaN(n) && n >= 0 && n <= max) return n;
        console.log(`[ERROR] Please enter a number between 0 and ${max}.`);
    }
}

/**
 * Asks a yes/no question. Returns true for 'y', false for 'n'.
 * Keeps asking until a valid answer is given.
 */
async function askYesNo(rl, question) {
    while (true) {
        const raw = await ask(rl, `${question} (y/n): `);
        const answer = raw.trim().toLowerCase();
        if (answer === 'y') return true;
        if (answer === 'n') return false;
        console.log("[ERROR] Please enter 'y' or 'n'.");
    }
}

module.exports = { createInterface, askNumeric, askYesNo };
