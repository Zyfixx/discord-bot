const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { bytes } = require("../utils/format");
const { embed } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "servercount",

    data: new SlashCommandBuilder()
        .setName("servercount")
        .setDescription("Shows how many servers the bot is in."),

    async execute(ctx) {
        const guilds = ctx.client.guilds.cache;
        const totalMembers = guilds.reduce((total, guild) => total + (guild.memberCount ?? 0), 0);
        const largest = [...guilds.values()].sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))[0];

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: "Server count",
                    fields: [
                        { name: "Servers", value: `${guilds.size}`, inline: true },
                        { name: "Total members", value: `${totalMembers}`, inline: true },
                        { name: "Largest server", value: largest ? `${largest.name} (${largest.memberCount})` : "none", inline: true },
                        { name: "Cache size", value: bytes(guilds.cacheSize ?? 0), inline: true }
                    ]
                })
            ]
        });
    }
};
