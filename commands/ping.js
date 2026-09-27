const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { duration } = require("../utils/format");
const { embed } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "ping",

    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong and latency!"),

    async execute(ctx) {
        const sent = await ctx.respond({ content: "Pinging..." });
        const latency = sent.createdTimestamp - ctx.raw.createdTimestamp;

        await sent.edit({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: "Pong! 🏓",
                    fields: [
                        { name: "Round trip", value: `${latency}ms`, inline: true },
                        { name: "Websocket", value: `${Math.round(ctx.client.ws.ping)}ms`, inline: true },
                        { name: "Uptime", value: duration(ctx.client.uptime ?? 0), inline: true }
                    ]
                })
            ]
        });
    }
};
