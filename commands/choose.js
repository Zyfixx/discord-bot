const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");

module.exports = {
    group: "fun",
    usage: "choose <a, b, c>",
    examples: [
        "choose pizza, sushi, tacos"
    ],

    data: new SlashCommandBuilder()
        .setName("choose")
        .setDescription("Picks one option from a comma separated list.")
        .addStringOption((option) =>
            option
                .setName("options")
                .setDescription("Comma separated choices")
                .setMaxLength(1000)
                .setRequired(true)
        ),

    async execute(ctx) {
        const options = ctx.text()
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean);

        if (options.length < 2) {
            return fail(ctx, "Need more options", "Give me at least two choices, separated by commas.");
        }

        const pick = options[Math.floor(Math.random() * options.length)];

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "I pick…",
                    description: `**${pick}**`,
                    fields: [{ name: `Chosen from ${options.length} options`, value: options.join(", ") }],
                    footer: ctx.author.tag
                })
            ]
        });
    }
};
