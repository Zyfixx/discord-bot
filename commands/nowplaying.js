const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { fail } = require("../utils/feedback");
const { requireQueue, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "nowplaying",

    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Shows the song that is playing right now."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;

        const track = player.queue.current;
        if (!track) return fail(ctx, "Nothing playing", "The queue is empty.");

        const embed = nowPlayingEmbed(track, player);

        if (player.paused) embed.setTitle("⏸️ Paused").setColor(config.colors.warning);

        if (track.requester?.tag) {
            embed.setFooter({ text: `Requested by ${track.requester.tag}` });
        }

        return ctx.respond({ embeds: [embed] });
    }
};
