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
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        await queue.stop();

        return done(ctx, {
            title: "🛑 Stopped",
            description: `Queue cleared. Use \`${config.prefix}leave\` if you want me to disconnect.`
        });
    }
};
