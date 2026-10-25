const { SlashCommandBuilder } = require("discord.js");
const { embed, fail } = require("../utils/feedback");
const { requireQueue, requireSameVoice, nowPlayingEmbed, safeUrl } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "skip",

    data: new SlashCommandBuilder().setName("skip").setDescription("Skips the current song."),

    async execute(ctx) {
        const player = requireQueue(ctx);
        if (!player) return;
        if (!requireSameVoice(ctx, player)) return;

        const current = player.queue.current;

        if (!player.queue.tracks.length) {
            await player.stopPlaying(true);
            return fail(ctx, "Queue finished", "That was the last song, so I stopped the music.");
        }

        const next = player.queue.tracks[0];
        await player.skip();

        const nowPlaying = nowPlayingEmbed(next, player);
        const currentUrl = safeUrl(current?.info?.uri);
        const skipped = currentUrl
            ? `[${current?.info?.title ?? "unknown"}](${currentUrl})`
            : (current?.info?.title ?? "the current song");

        nowPlaying.setDescription(`⏭️ Skipped ${skipped}.\n\nNow playing **${next?.info?.title ?? "unknown"}**.`);

        return ctx.respond({ embeds: [nowPlaying] });
    }
};
