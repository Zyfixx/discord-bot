const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");
const { parseFields } = require("../utils/fields");

const ORDER = ["description", "title", "color", "footer", "image"];

const NAMED = {
    red: 0xed4245,
    green: 0x57f287,
    blue: 0x5865f2,
    yellow: 0xfee75c,
    orange: 0xfaa61a,
    purple: 0x9b59b6,
    pink: 0xf47bba,
    grey: 0x4e5058,
    gray: 0x4e5058,
    black: 0x000000,
    white: 0xffffff
};

function parseColor(input) {
    if (input === undefined || input === null || input === "") return config.colors.primary;

    const text = String(input).trim().toLowerCase();

    if (NAMED[text]) return NAMED[text];
    if (/^#?[0-9a-f]{6}$/.test(text)) return parseInt(text.replace("#", ""), 16);
    if (/^\d{1,8}$/.test(text)) {
        const value = Number(text);
        if (value >= 0 && value <= 0xffffff) return value;
    }

    return null;
}

function isUrl(value) {
    return /^https?:\/\/\S+$/i.test(String(value ?? "").trim());
}

/**
 * Slash options are not split, so `\|` would survive as a stray backslash.
 * Unescape it so both invocation styles behave the same.
 */
function unescape(value) {
    if (value === undefined || value === null) return undefined;
    return String(value).replace(/\\\|/g, "|");
}

module.exports = {
    group: "fun",
    usage: "embed <description> [title] [color] [footer] [image url]",
    examples: [
        "embed hello there",
        "embed hello || My Title",
        "embed hello | My Title | #ff0000"
    ],
    help: [
        "Split the parts with `|`, or label them so order does not matter: `description:… | color:red`.",
        "Short labels work too: `d:` `t:` `c:` `f:` `i:`.",
        "Leave a slot empty as `| |` to skip it, so you can set a colour without a title.",
        "Colours accept `red`, `#5865f2` or a decimal number.",
        "Write `\\|` for a literal pipe."
    ].join("\n"),

    data: new SlashCommandBuilder()
        .setName("embed")
        .setDescription("Builds a custom embed.")
        .addStringOption((option) =>
            option.setName("description").setDescription("Embed text").setMaxLength(4000).setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("title").setDescription("Embed title").setMaxLength(256)
        )
        .addStringOption((option) =>
            option
                .setName("color")
                .setDescription("Colour: #5865f2, red, green or a decimal value")
                .setMaxLength(32)
        )
        .addStringOption((option) =>
            option.setName("footer").setDescription("Footer text").setMaxLength(2048)
        )
        .addStringOption((option) =>
            option.setName("image").setDescription("Image URL").setMaxLength(1024)
        ),

    async execute(ctx) {
        // Slash commands already arrive as labelled options; prefix commands
        // get the pipe separated parser so each part can hold multiple words.
        const fields = ctx.slash
            ? {
                  description: unescape(ctx.args[0]),
                  title: unescape(ctx.args[1]),
                  color: unescape(ctx.args[2]),
                  footer: unescape(ctx.args[3]),
                  image: unescape(ctx.args[4])
              }
            : parseFields(ctx.text(), ORDER);

        const description = fields.description?.trim();
        const title = fields.title?.trim() || undefined;
        const colorInput = fields.color?.trim();
        const footer = fields.footer?.trim() || undefined;
        const image = fields.image?.trim() || undefined;

        if (!description) {
            return fail(ctx, "Nothing to embed", "The description can't be empty.");
        }

        if (description.length > 4096) {
            return fail(ctx, "Description too long", "Keep the description under 4096 characters.");
        }

        if (title && title.length > 256) {
            return fail(ctx, "Title too long", "Keep the title under 256 characters.");
        }

        const color = parseColor(colorInput);

        if (color === null) {
            return fail(ctx, "Bad colour", "Use a hex value like `#5865f2`, a name like `red`, or a decimal number.");
        }

        if (image && !isUrl(image)) {
            return fail(ctx, "Bad image", "The image must be a full URL starting with http:// or https://.");
        }

        await ctx.respond({
            embeds: [
                embed({
                    color,
                    title,
                    description,
                    image,
                    footer: footer || false,
                    timestamp: false
                })
            ]
        });
    }
};
