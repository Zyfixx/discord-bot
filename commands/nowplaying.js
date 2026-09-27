const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { fail } = require("../utils/feedback");
const { requireQueue, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "nowplaying",

    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Shows the song that is playing right now."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;

        const song = queue.songs[0];
        if (!song) return fail(ctx, "Nothing playing", "The queue is empty.");

        const embed = nowPlayingEmbed(song, queue);

        if (queue.paused) embed.setTitle("⏸️ Paused").setColor(config.colors.warning);

        if (song.requestedBy) {
            embed.setFooter({ text: `Requested by ${song.requestedBy.tag}` });
        }

        return ctx.respond({ embeds: [embed] });
    }
};
