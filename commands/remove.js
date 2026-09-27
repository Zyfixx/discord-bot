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
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        const raw = ctx.args[0]?.toString();
        const position = Number(raw);

        if (!Number.isInteger(position) || position < 1) {
            return fail(ctx, "Bad position", "Give me a queue position of 1 or higher.");
        }

        if (position > queue.songs.length - 1) {
            return fail(ctx, "Out of range", `The queue only has **${queue.songs.length - 1}** upcoming song(s).`);
        }

        const [removed] = queue.songs.splice(position, 1);

        return done(ctx, {
            title: "🗑️ Removed",
            description: safeUrl(removed.url)
                ? `Removed [${removed.name ?? "unknown song"}](${removed.url}) from the queue.`
                : `Removed ${removed.name ?? "the song"} from the queue.`
        });
    }
};
