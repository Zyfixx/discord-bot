const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { done, fail, requireGuild } = require("../utils/feedback");
const { getDistube, normalizeQuery, resolveVoice, queueList, safeUrl } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "play <song url or search>",
    examples: [
        "play bohemian rhapsody",
        "play https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof",
        "play spotify:album:2guirTSEqLizK7j9i1MTTZ"
    ],
    help: [
        "Spotify track, album, playlist and artist links work, including `spotify:` share links.",
        "Only the details come from Spotify — the audio is matched on YouTube."
    ].join("\n"),

    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays a song or adds it to the queue.")
        .addStringOption((option) =>
            option
                .setName("query")
                .setDescription("Song name, playlist link, or search term")
                .setRequired(true)
                .setMaxLength(200)
        ),

    async execute(ctx) {
        if (!requireGuild(ctx)) return;

        const query = normalizeQuery(ctx.text());
        if (!query) return fail(ctx, "Nothing to play", "Give me a song name, link, or search term.");

        const voice = resolveVoice(ctx);
        if (!voice) return;

        const distube = getDistube(ctx.client);
        const existing = distube.getQueue(ctx.guild);
        const position = existing?.songs.length ?? 0;

        try {
            await distube.play(voice, query, {
                member: ctx.member,
                textChannel: ctx.channel
            });
        } catch (error) {
            return fail(ctx, "Could not play that", error.message);
        }

        const queue = distube.getQueue(ctx.guild);
        const song = queue?.songs?.[position];

        if (position === 0 && song) {
            return done(ctx, {
                title: "🎵 Added to queue",
                description: safeUrl(song.url) ? `[${song.name ?? query}](${song.url})` : (song.name ?? query),
                thumbnail: safeUrl(song.thumbnail),
                fields: song.formattedDuration
                    ? [{ name: "Duration", value: song.formattedDuration, inline: true }]
                    : null
            });
        }

        if (song) {
            return done(ctx, {
                title: "➕ Added to queue",
                description: safeUrl(song.url) ? `[${song.name ?? query}](${song.url})` : (song.name ?? query),
                thumbnail: safeUrl(song.thumbnail),
                fields: [{ name: "Up next", value: queueList(queue), inline: false }]
            });
        }
    }
};
