const { SlashCommandBuilder } = require("discord.js");
const { done, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "shuffle",

    data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffles the upcoming songs."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        if (!player.queue.tracks.length) return fail(ctx, "Nothing to shuffle", "There are no upcoming songs.");

        const count = player.queue.tracks.length;
        await player.queue.shuffle();

        return done(ctx, {
            title: "🔀 Shuffled",
            description: `The next **${count}** songs are now in a random order.`
        });
    }
};
