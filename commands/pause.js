const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "pause",

    data: new SlashCommandBuilder().setName("pause").setDescription("Pauses the current song."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        if (player.paused) return fail(ctx, "Already paused", "The music is already paused.");

        const track = player.queue.current;
        await player.pause();

        return ctx.respond({
            embeds: [nowPlayingEmbed(track, player, config.colors.warning).setTitle("⏸️ Paused")]
        });
    }
};
