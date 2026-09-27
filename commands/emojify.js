const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");

const NITRO = [":moneybag:", ":heavy_heart_exclamation_mark:", ":bug:", ":wastebasket:", ":pencil2:"];

module.exports = {
    group: "fun",
    usage: "emojify <text>",
    examples: [
        "emojify hello world"
    ],

    data: new SlashCommandBuilder()
        .setName("emojify")
        .setDescription("Turns text into regional indicator emojis.")
        .addStringOption((option) =>
            option.setName("text").setDescription("Text to emojify").setMaxLength(200).setRequired(true)
        ),

    async execute(ctx) {
        const text = ctx.text().toLowerCase().replace(/\s+/g, "");

        if (!text) return fail(ctx, "Nothing to emojify", "Give me some text.");

        const indicators = [...text]
            .filter((char) => /[a-z0-9]/.test(char))
            .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 97))
            .join(" ");

        if (!indicators) return fail(ctx, "Nothing to emojify", "That text has no letters or numbers.");

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: "Emojified",
                    description: `${indicators}\n\n${NITRO[Math.floor(Math.random() * NITRO.length)]}`
                })
            ]
        });
    }
};
