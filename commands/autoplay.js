const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { done } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "autoplay",
    examples: [
        "autoplay"
    ],
    help: "Toggles autoplay. When it is on, I keep playing similar tracks by the same artist once your queue runs out.",

    data: new SlashCommandBuilder()
        .setName("autoplay")
        .setDescription("Toggles autoplay, which keeps playing similar tracks when the queue ends."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        const enabled = queue.toggleAutoplay();
        const color = enabled ? config.colors.success : config.colors.neutral;

        const description = enabled
            ? "When your queue runs out I will keep playing similar tracks by the same artist. Run this again to switch it off."
            : "Autoplay is off. I will stop once your queue runs out.";

        return done(ctx, { title: enabled ? "🔁 Autoplay on" : "⏹️ Autoplay off", description, color });
    }
};
