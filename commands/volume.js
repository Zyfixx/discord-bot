const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, progressBar } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "volume [0-100]",
    examples: [
        "volume 50",
        "volume 0",
        "volume 100"
    ],

    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Sets the playback volume.")
        .addIntegerOption((option) =>
            option
                .setName("level")
                .setDescription("Volume from 0 to 100")
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(true)
        ),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        const raw = ctx.args[0]?.toString();
        if (raw === undefined) return fail(ctx, "No volume given", "Tell me a number between 0 and 100.");

        const level = Math.min(Math.max(Number(raw), 0), 100);
        if (Number.isNaN(level)) return fail(ctx, "Bad volume", "Volume must be a number between 0 and 100.");

        await player.setVolume(level);

        return done(ctx, {
            title: "🔊 Volume updated",
            description: `${progressBar(level, 100, 20)} **${level}%**`
        });
    }
};
