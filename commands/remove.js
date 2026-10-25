const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, safeUrl } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "remove <position>",
    examples: [
        "remove 3"
    ],

    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Removes a song from the queue.")
        .addIntegerOption((option) =>
            option
                .setName("position")
                .setDescription("Queue position (1 = next up)")
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        const raw = ctx.args[0]?.toString();
        const position = Number(raw);

        if (!Number.isInteger(position) || position < 1) {
            return fail(ctx, "Bad position", "Give me a queue position of 1 or higher.");
        }

        if (position > player.queue.tracks.length) {
            return fail(ctx, "Out of range", `The queue only has **${player.queue.tracks.length}** upcoming song(s).`);
        }

        const removed = player.queue.tracks[position - 1];
        await player.queue.splice(position - 1, 1);

        const url = safeUrl(removed.info?.uri);

        return done(ctx, {
            title: "🗑️ Removed",
            description: url
                ? `Removed [${removed.info?.title ?? "unknown song"}](${url}) from the queue.`
                : `Removed ${removed.info?.title ?? "the song"} from the queue.`
        });
    }
};
