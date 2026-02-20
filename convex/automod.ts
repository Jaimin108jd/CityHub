
function normalizeWord(word: string): string {
    return word
        .toLowerCase()
        .replace(/[0оО]/g, "o")
        .replace(/[1!|l]/g, "i")
        .replace(/[@àáâãäå]/g, "a")
        .replace(/[3èéêë€]/g, "e")
        .replace(/[$§5]/g, "s")
        .replace(/[7†]/g, "t")
        .replace(/[*_\-.]/g, "")
        .replace(/(.)\1{2,}/g, "$1$1"); // fuuuck → fuuck
}

function stripPunctuation(word: string): string {
    return word.replace(/[^a-z0-9]/g, "");
}

// ─── Blocked word lists by category ─────────────────────────────────

interface BlockedWordEntry {
    words: string[];
    category: "slur" | "threat" | "profanity" | "sexual";
}

const BLOCKED_WORDS: BlockedWordEntry[] = [
    {
        category: "slur",
        words: [
            "nigger", "nigga", "nigg3r", "n1gger", "n1gga",
            "faggot", "fagg0t", "f4ggot",
            "retard", "retarded", "r3tard",
            "tranny", "tr4nny",
            "chink", "ch1nk",
            "spic", "spick",
            "kike", "k1ke",
            "wetback",
            "coon", "c00n",
            "beaner",
            "gook",
        ],
    },
    {
        category: "threat",
        words: [
            "kys",
        ],
    },
    {
        category: "profanity",
        words: [
            "fuck", "fucker", "fuckin", "fucking", "fucked", "fck", "fuk", "fuq",
            "shit", "shitty", "bullshit", "sh1t",
            "asshole", "a55hole",
            "bitch", "bitches", "bitching", "b1tch",
            "bastard", "b4stard",
            "motherfucker", "motherfucking", "mfer",
            "stfu", "gtfo",
            "cunt", "c0nt",
            "twat",
            "dickhead", "d1ckhead",
            "whore", "wh0re",
        ],
    },
    {
        category: "sexual",
        words: [
            "porn", "porno", "p0rn",
            "nudes",
            "dildo", "d1ldo",
            "blowjob", "bl0wjob",
            "handjob",
            "jerkoff", "jackoff",
            "hentai",
        ],
    },
];

// Phrases that require multi-word matching
const BLOCKED_PHRASES: { phrase: string; category: "slur" | "threat" | "profanity" | "sexual" }[] = [
    { phrase: "kill yourself", category: "threat" },
    { phrase: "kill urself", category: "threat" },
    { phrase: "i will kill you", category: "threat" },
    { phrase: "ill kill you", category: "threat" },
    { phrase: "gonna kill you", category: "threat" },
    { phrase: "go kill yourself", category: "threat" },
    { phrase: "go die", category: "threat" },
];

// ─── Filter result type ─────────────────────────────────────────────

export interface FilterResult {
    isBlocked: boolean;
    category: string;
    matchedWord: string;
    reason: string;
}

// ─── Main content filter ─────────────────────────────────────────────

export function checkContentFilter(content: string): FilterResult {
    // 1. Split into words, normalize each individually
    const words = content.split(/\s+/);
    const normalizedWords = words.map((w) => stripPunctuation(normalizeWord(w)));

    // Check each word against blocked lists
    for (const { words: blockedWords, category } of BLOCKED_WORDS) {
        for (const blocked of blockedWords) {
            const normalizedBlocked = stripPunctuation(normalizeWord(blocked));
            if (normalizedWords.some((nw) => nw === normalizedBlocked)) {
                return {
                    isBlocked: true,
                    category,
                    matchedWord: blocked,
                    reason: getCategoryMessage(category),
                };
            }
        }
    }

    // 2. Check multi-word phrases against full normalized text
    const normalizedFull = content
        .toLowerCase()
        .replace(/[*_\-.]/g, "")
        .replace(/(.)\1{2,}/g, "$1$1");

    for (const { phrase, category } of BLOCKED_PHRASES) {
        if (normalizedFull.includes(phrase)) {
            return {
                isBlocked: true,
                category,
                matchedWord: phrase,
                reason: getCategoryMessage(category),
            };
        }
    }

    return { isBlocked: false, category: "clean", matchedWord: "", reason: "" };
}

// ─── Human-readable category messages ────────────────────────────────

function getCategoryMessage(category: string): string {
    switch (category) {
        case "profanity":
            return "Message contains profanity";
        case "slur":
            return "Message contains a slur";
        case "sexual":
            return "Message contains sexual content";
        case "threat":
            return "Message contains a threat";
        default:
            return "Message contains prohibited content";
    }
}

// ─── Timeout escalation schedule ─────────────────────────────────────
// Returns null (no timeout) or { duration, label } based on warning count

export function getTimeoutDuration(
    warningCount: number
): { duration: number; label: string } | null {
    switch (warningCount) {
        case 1:
            return null; // First warning — just a warning, no timeout
        case 2:
            return { duration: 5 * 60 * 1000, label: "5 minutes" };
        case 3:
            return { duration: 30 * 60 * 1000, label: "30 minutes" };
        default:
            return { duration: 60 * 60 * 1000, label: "1 hour" }; // 4+ warnings
    }
}
