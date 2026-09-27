const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");

function parseDice(input) {
    const text = String(input ?? "").trim().toLowerCase();

    if (!text) return { count: 1, sides: 6, notation: "1d6" };

    const standard = text.match(/^(\d{1,3})?d(\d{1,4})$/);
    if (standard) {
        return {
            count: Math.min(Number(standard[1] ?? 1), 100),
            sides: Math.min(Number(standard[2]), 1000),
            notation: text
        };
    }

    if (/^\d{1,3}$/.test(text)) return { count: 1, sides: Math.min(Number(text), 1000), notation: `1d${text}` };

    return null;
}

module.exports = {
    group: "fun",
    usage: "roll [2d6|d20|10]",
    examples: [
        "roll",
        "roll d20",
        "roll 2d6"
    ],

    data: new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Rolls dice, e.g. 2d6, d20 or 10.")
        .addStringOption((option) =>
            option.setName("dice").setDescription("Dice to roll").setMaxLength(16)
        ),

    async execute(ctx) {
        const parsed = parseDice(ctx.args[0]);

        if (!parsed) {
            return fail(ctx, "Bad dice", "Try something like `2d6`, `d20`, or just `10` for a ten-sided die.");
        }

        const { count, sides, notation } = parsed;
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
        const total = rolls.reduce((sum, roll) => sum + roll, 0);

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: `🎲 ${notation}`,
                    description: count > 1 ? `**${rolls.join(" + ")}** = **${total}**` : `**${total}**`,
                    fields:
                        count > 1
                            ? [
                                  { name: "Rolls", value: rolls.join(", "), inline: false },
                                  { name: "Average", value: ((sides + 1) / 2).toFixed(1), inline: true }
                              ]
                            : null,
                    footer: `${ctx.author.tag} • rolled ${count}d${sides}`
                })
            ]
        });
    }
};
