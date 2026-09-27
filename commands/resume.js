const { SlashCommandBuilder } = require("discord.js");
const { fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "resume",

    data: new SlashCommandBuilder().setName("resume").setDescription("Resumes the paused song."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        if (!queue.paused) return fail(ctx, "Not paused", "The music is already playing.");

        const song = queue.songs[0];
        await queue.resume();

        return ctx.respond({
            embeds: [nowPlayingEmbed(song, queue).setTitle("▶️ Resumed")]
        });
    }
};
