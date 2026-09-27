const ALIASES = {
    // full names
    description: "description",
    desc: "description",
    text: "description",
    isi: "description",
    title: "title",
    judul: "title",
    color: "color",
    colour: "color",
    warna: "color",
    footer: "footer",
    image: "image",
    gambar: "image",
    // single letter shorthands
    d: "description",
    t: "title",
    c: "color",
    f: "footer",
    i: "image"
};

/**
 * Splits on `|`, letting a literal pipe be written as `\|`.
 */
function splitSegments(input) {
    const segments = [];
    let current = "";

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];

        if (char === "\\" && input[i + 1] === "|") {
            current += "|";
            i += 1;
            continue;
        }

        if (char === "|") {
            segments.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    segments.push(current);
    return segments;
}

/**
 * Parses a pipe separated, optionally `key: value` labelled list.
 *
 * Two styles can be mixed in the same input:
 *
 *   "Hello there | My title | red"          positional, follows `order`
 *   "description:Hi | color:red"            named, order does not matter
 *   "Hi | | red"                           positional, title left empty
 *
 * Empty positional segments still consume a slot, which is what lets someone
 * set a colour or footer without having to supply a title first.
 *
 * @param {string} input raw text after the command name
 * @param {string[]} order field names for bare values, in order
 */
function parseFields(input, order = []) {
    const result = {};
    if (typeof input !== "string" || !input.trim()) return result;

    let slot = 0;

    for (const segment of splitSegments(input)) {
        const trimmed = segment.trim();
        const labelled = /^([a-zA-Z]+)\s*[:=]\s*([\s\S]*)$/.exec(trimmed);
        const key = labelled ? ALIASES[labelled[1].toLowerCase()] : undefined;

        if (key) {
            const value = labelled[2].trim();
            if (value) result[key] = value;
            continue;
        }

        while (slot < order.length && result[order[slot]] !== undefined) slot += 1;

        const target = order[slot];
        slot += 1;

        if (target && trimmed) result[target] = trimmed;
    }

    return result;
}

module.exports = { parseFields, splitSegments, ALIASES };
