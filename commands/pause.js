const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "pause",

    data: new SlashCommandBuilder().setName("pause").setDescription("Pauses the current song."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        if (queue.paused) return fail(ctx, "Already paused", "The music is already paused.");

        const song = queue.songs[0];
        await queue.pause();

        return ctx.respond({
            embeds: [nowPlayingEmbed(song, queue, config.colors.warning).setTitle("⏸️ Paused")]
        });
    }
};
