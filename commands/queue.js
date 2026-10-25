const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { requireQueue, nowPlayingEmbed, queueList, totalDuration } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "queue",

    data: new SlashCommandBuilder().setName("queue").setDescription("Shows the songs lined up next."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;

        const track = player.queue.current;
        if (!track) return;

        const nowPlaying = nowPlayingEmbed(track, player).setTitle("🎶 Queue");
        nowPlaying.addFields({
            name: `Up next (${player.queue.tracks.length})`,
            value: queueList(player),
            inline: false
        });

        if (player.queue.tracks.length > 0) {
            nowPlaying.addFields({
                name: "Total length",
                value: totalDuration(player),
                inline: true
            });
        }

        return ctx.respond({ embeds: [nowPlaying] });
    }
};
