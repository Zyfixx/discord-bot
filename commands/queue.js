const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { requireQueue, nowPlayingEmbed, queueList, totalDuration } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "queue",

    data: new SlashCommandBuilder().setName("queue").setDescription("Shows the songs lined up next."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;

        const song = queue.songs[0];
        if (!song) return;

        const nowPlaying = nowPlayingEmbed(song, queue).setTitle("🎶 Queue");
        nowPlaying.addFields({
            name: `Up next (${Math.max(queue.songs.length - 1, 0)})`,
            value: queueList(queue),
            inline: false
        });

        if (queue.songs.length > 1) {
            nowPlaying.addFields({
                name: "Total length",
                value: totalDuration(queue),
                inline: true
            });
        }

        return ctx.respond({ embeds: [nowPlaying] });
    }
};
