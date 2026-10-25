const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

const LABELS = {
    off: "Repeat off",
    track: "Repeating the current song",
    queue: "Repeating the whole queue"
};

const ORDER = ["off", "track", "queue"];

module.exports = {
    group: "music",
    usage: "loop [off|song|queue]",
    examples: [
        "loop",
        "loop song",
        "loop off"
    ],

    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Sets the repeat mode.")
        .addStringOption((option) =>
            option
                .setName("mode")
                .setDescription("Repeat mode (omit to cycle)")
                .addChoices(
                    { name: "Off", value: "off" },
                    { name: "Song", value: "song" },
                    { name: "Queue", value: "queue" }
                )
        ),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        const mode = ctx.args[0]?.toString().toLowerCase();
        const resolved = mode === "off" ? "off" : mode === "song" ? "track" : mode === "queue" ? "queue" : undefined;

        if (mode && resolved === undefined) {
            return fail(ctx, "Bad repeat mode", "Use `off`, `song`, or `queue`.");
        }

        const next = resolved ?? ORDER[(ORDER.indexOf(player.repeatMode) + 1) % ORDER.length];
        await player.setRepeatMode(next);

        return done(ctx, {
            title: "🔁 Repeat updated",
            description: LABELS[next]
        });
    }
};
