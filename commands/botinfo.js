const { SlashCommandBuilder, version } = require("discord.js");
const config = require("../config");
const { duration, bytes } = require("../utils/format");
const { embed } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "botinfo",

    data: new SlashCommandBuilder().setName("botinfo").setDescription("Shows info about the bot."),

    async execute(ctx) {
        const { client } = ctx;
        const memory = process.memoryUsage();
        const users = client.users.cache.size;

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    author: { name: client.user.tag, iconURL: client.user.displayAvatarURL() },
                    thumbnail: client.user.displayAvatarURL({ size: 512 }),
                    fields: [
                        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
                        { name: "Cached users", value: `${users}`, inline: true },
                        {
                            name: "Members",
                            value: `${client.guilds.cache.reduce((total, g) => total + g.memberCount, 0)}`,
                            inline: true
                        },
                        { name: "Uptime", value: duration(client.uptime ?? 0), inline: true },
                        { name: "Websocket", value: `${Math.round(client.ws.ping)}ms`, inline: true },
                        { name: "Node", value: process.version, inline: true },
                        { name: "Memory", value: bytes(memory.heapUsed), inline: true },
                        { name: "RSS", value: bytes(memory.rss), inline: true },
                        { name: "Library", value: `discord.js v${version}`, inline: true }
                    ]
                })
            ]
        });
    }
};
