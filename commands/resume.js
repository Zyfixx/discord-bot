const { SlashCommandBuilder } = require("discord.js");
const { fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "resume",

    data: new SlashCommandBuilder().setName("resume").setDescription("Resumes the paused song."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        if (!player.paused) return fail(ctx, "Not paused", "The music is already playing.");

        const track = player.queue.current;
        await player.resume();

        return ctx.respond({
            embeds: [nowPlayingEmbed(track, player).setTitle("▶️ Resumed")]
        });
    }
};
