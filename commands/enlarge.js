const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");

const CUSTOM = /<a?:([a-zA-Z0-9_]+):\d{15,22}>/;
const UNICODE = /<:(?:[a-zA-Z0-9_]+):(\d{15,22})>/;

module.exports = {
    group: "fun",
    usage: "enlarge <emoji>",
    examples: [
        "enlarge :blob:"
    ],

    data: new SlashCommandBuilder()
        .setName("enlarge")
        .setDescription("Shows a custom emoji in a larger size.")
        .addStringOption((option) =>
            option.setName("emoji").setDescription("A custom server emoji").setMaxLength(100).setRequired(true)
        ),

    async execute(ctx) {
        const input = ctx.args[0]?.toString() ?? "";
        const animated = input.match(CUSTOM)?.[1] ?? null;
        const id = input.match(animated ? CUSTOM : UNICODE)?.[2] ?? null;
        const name = animated ?? input.match(UNICODE)?.[1] ?? null;

        if (!id) {
            return fail(
                ctx,
                "Not a custom emoji",
                "Copy a server emoji from Discord — regular unicode emojis like 😀 don't work here."
            );
        }

        const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=512`;

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: `:${name}:`,
                    url,
                    image: url,
                    description: `[Open original](${url})`
                })
            ]
        });
    }
};
