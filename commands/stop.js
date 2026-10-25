const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { done } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "stop",
    help: "Stops playback and clears the queue. I stay in the voice channel — use `leave` to disconnect.",

    data: new SlashCommandBuilder().setName("stop").setDescription("Stops the music and clears the queue."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        await player.stopPlaying(true);

        return done(ctx, {
            title: "🛑 Stopped",
            description: `Queue cleared. Use \`${config.prefix}leave\` if you want me to disconnect.`
        });
    }
};
