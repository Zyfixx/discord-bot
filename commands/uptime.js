const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { duration, bytes, since } = require("../utils/format");
const { embed } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "uptime",

    data: new SlashCommandBuilder().setName("uptime").setDescription("Shows how long the bot has been running."),

    async execute(ctx) {
        const { client } = ctx;
        const memory = process.memoryUsage();
        const uptime = client.uptime ?? 0;

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Uptime",
                    fields: [
                        { name: "Online for", value: duration(uptime), inline: true },
                        { name: "Websocket ping", value: `${Math.round(client.ws.ping)}ms`, inline: true },
                        { name: "Heap", value: bytes(memory.heapUsed), inline: true },
                        { name: "External", value: bytes(memory.external), inline: true },
                        { name: "Process id", value: `${process.pid}`, inline: true },
                        { name: "Platform", value: `${process.platform} ${process.arch}`, inline: true }
                    ],
                    footer: `Started ${since(Date.now() - uptime)}`
                })
            ]
        });
    }
};
