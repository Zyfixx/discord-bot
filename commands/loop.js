const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

const LABELS = {
    0: "Repeat off",
    1: "Repeating the current song",
    2: "Repeating the whole queue"
};

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
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        const mode = ctx.args[0]?.toString().toLowerCase();
        const resolved = mode === "off" ? 0 : mode === "song" ? 1 : mode === "queue" ? 2 : undefined;

        if (mode && resolved === undefined) {
            return fail(ctx, "Bad repeat mode", "Use `off`, `song`, or `queue`.");
        }

        const result = queue.setRepeatMode(resolved);

        return done(ctx, {
            title: "🔁 Repeat updated",
            description: LABELS[result]
        });
    }
};
