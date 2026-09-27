const UNITS = [
    ["y", 31536e6],
    ["mo", 2592e6],
    ["d", 864e5],
    ["h", 36e5],
    ["m", 6e4],
    ["s", 1e3]
];

const MULTIPLIERS = {
    y: 31536e6,
    mo: 2592e6,
    d: 864e5,
    h: 36e5,
    m: 6e4,
    s: 1e3
};

function duration(ms) {
    if (!ms || ms < 0) return "0s";
    let rest = Math.floor(ms);
    let out = "";

    for (const [label, factor] of UNITS) {
        const value = Math.floor(rest / factor);
        if (value > 0) {
            out += `${value}${label} `;
            rest -= value * factor;
        }
    }

    return out.trim() || "0s";
}

function parseDuration(input) {
    if (input === null || input === undefined || input === "") return null;
    if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 1000) : null;

    const text = String(input).trim().toLowerCase();
    if (/^\d+$/.test(text)) return Number(text) * 1000;

    const pattern = /(\d+(?:\.\d+)?)\s*(mo|[ymdhms])/g;
    let total = 0;
    let found = false;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        total += Number(match[1]) * MULTIPLIERS[match[2]];
        found = true;
    }

    return found ? Math.round(total) : null;
}

function bytes(value) {
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function since(input) {
    const ms = Date.now() - new Date(input).getTime();
    if (Number.isNaN(ms)) return "unknown";

    const steps = [
        [31536e6, "year"],
        [2592e6, "month"],
        [864e5, "day"],
        [36e5, "hour"],
        [6e4, "minute"]
    ];

    for (const [factor, label] of steps) {
        const value = Math.floor(ms / factor);
        if (value >= 1) return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }

    return "just now";
}

function list(items, max = 10, empty = "none") {
    if (!items.length) return empty;
    const shown = items.slice(0, max);
    const extra = items.length - shown.length;
    return `${shown.join("\n")}${extra > 0 ? `\n…and ${extra} more` : ""}`;
}

function truncate(text, max = 1000) {
    const value = String(text ?? "");
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

module.exports = { duration, parseDuration, bytes, since, list, truncate };
