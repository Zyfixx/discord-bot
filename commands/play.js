const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, requireGuild } = require("../utils/feedback");
const {
    ensurePlayer,
    addTracks,
    formatDuration,
    normalizeQuery,
    queueList,
    resolveVoice,
    safeUrl,
    searchTracks
} = require("../utils/music");

module.exports = {
    group: "music",
    usage: "play <song url or search>",
    examples: [
        "play bohemian rhapsody",
        "play https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof",
        "play spotify:album:2guirTSEqLizK7j9i1MTTZ"
    ],
    help: [
        "Links and search terms are resolved by the Lavalink server.",
        "Spotify links need the LavaSrc plugin on that server."
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
        if (!query) {
            return ctx.respond({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Nothing to play",
                        description: "Give me a song name, link, or search term.",
                        timestamp: false
                    })
                ]
            });
        }

        const voice = resolveVoice(ctx);
        if (!voice) return;

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.info,
                    title: "🔎 Looking that up",
                    description: `Searching for **${query}**…`,
                    timestamp: false
                })
            ]
        });

        let player;

        try {
            player = await ensurePlayer(ctx, voice);
        } catch (error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Could not join",
                        description: error.message,
                        timestamp: false
                    })
                ]
            });
        }

        const position = player.queue.current ? player.queue.tracks.length + 1 : player.queue.tracks.length;

        let result;

        try {
            result = await searchTracks(player, query, ctx.author);
        } catch (error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Could not play that",
                        description: error.message,
                        timestamp: false
                    })
                ]
            });
        }

        const tracks = result.playlist ? result.tracks : [result.tracks[0]];

        try {
            await addTracks(player, tracks);
        } catch (error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Could not play that",
                        description: error.message,
                        timestamp: false
                    })
                ]
            });
        }

        const first = tracks[0];

        if (result.playlist) {
            const playlistUrl = safeUrl(result.playlist.uri);

            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.success,
                        title: "🎵 Playlist added",
                        description: playlistUrl
                            ? `[${result.playlist.name ?? "Playlist"}](${playlistUrl}) • ${tracks.length} tracks`
                            : `${result.playlist.name ?? "Playlist"} • ${tracks.length} tracks`,
                        thumbnail: safeUrl(result.playlist.thumbnail) ?? safeUrl(first.info.artworkUrl),
                        fields:
                            position > 0
                                ? [{ name: "Up next", value: queueList(player), inline: false }]
                                : null,
                        timestamp: false
                    })
                ]
            });
        }

        const url = safeUrl(first.info.uri);
        const name = first.info.title ?? query;
        const fields = [
            {
                name: "Duration",
                value: first.info.isStream ? "📡 Live stream" : formatDuration(first.info.duration),
                inline: true
            }
        ];

        if (position > 0) {
            fields.push({ name: "Up next", value: queueList(player), inline: false });
        }

        return ctx.edit({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: position === 0 ? "🎵 Added to queue" : "➕ Added to queue",
                    description: url ? `[${name}](${url})` : name,
                    thumbnail: safeUrl(first.info.artworkUrl),
                    fields,
                    timestamp: false
                })
            ]
        });
    }
};
