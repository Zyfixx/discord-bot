const { SlashCommandBuilder } = require("discord.js");
const { embed, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed, safeUrl } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "skip",

    data: new SlashCommandBuilder().setName("skip").setDescription("Skips the current song."),

    async execute(ctx) {
        const queue = requireQueue(ctx);
        if (!queue) return;
        if (!requireSameVoice(ctx, queue)) return;

        const current = queue.songs[0];

        if (queue.songs.length <= 1) {
            await queue.stop();
            return fail(ctx, "Queue finished", "That was the last song, so I stopped the music.");
        }

        await queue.skip();

        const next = queue.songs[0];
        const nowPlaying = nowPlayingEmbed(next, queue);
        const skipped = safeUrl(current?.url)
            ? `[${current?.name ?? "unknown"}](${current.url})`
            : (current?.name ?? "the current song");

        nowPlaying.setDescription(`⏭️ Skipped ${skipped}.\n\nNow playing **${next.name ?? "unknown"}**.`);

        return ctx.respond({ embeds: [nowPlaying] });
    }
};
