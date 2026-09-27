const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed } = require("../utils/feedback");

module.exports = {
    group: "fun",
    usage: "coinflip",

    data: new SlashCommandBuilder().setName("coinflip").setDescription("Flips a coin."),

    async execute(ctx) {
        const heads = Math.random() < 0.5;

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.info,
                    title: heads ? "🪙 Heads" : "🪙 Tails",
                    description: heads ? "The coin landed on heads." : "The coin landed on tails.",
                    footer: ctx.author.tag
                })
            ]
        });
    }
};
