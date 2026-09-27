const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "shuffle",

    data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffles the upcoming songs."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        if (queue.songs.length <= 1) return fail(ctx, "Nothing to shuffle", "There are no upcoming songs.");

        await queue.shuffle();

        return done(ctx, {
            title: "🔀 Shuffled",
            description: `The next **${queue.songs.length - 1}** songs are now in a random order.`
        });
    }
};
