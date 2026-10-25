const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail, requireGuild } = require("../utils/feedback");
const { addTracks, buildAlbumTracks, ensurePlayer, resolveVoice, safeUrl } = require("../utils/music");
const { searchAlbum, albumTracks } = require("../utils/albums");

const SUBSTITUTION_NOTE = ""
    // "Only the tracklist comes from the album lookup — every track is matched through Lavalink when it starts.";

function formatLength(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

module.exports = {
    group: "music",
    usage: "album <album name>",
    examples: [
        "album random access memories",
        "album daft punk - random access memories"
    ],
    help: [
        //"Searches for an album and adds the whole tracklist to the queue.",
        //SUBSTITUTION_NOTE
    ].join("\n"),

    data: new SlashCommandBuilder()
        .setName("album")
        .setDescription("Searches for an album and queues every track on it.")
        .addStringOption((option) =>
            option
                .setName("query")
                .setDescription("Album name, or artist and album name")
                .setRequired(true)
                .setMaxLength(200)
        ),

    async execute(ctx) {
        if (!requireGuild(ctx)) return;

        if (!config.albums.enabled) {
            return fail(ctx, "Album search is off", "This server has album search disabled.");
        }

        const query = ctx.text();
        if (!query) {
            return fail(ctx, "Nothing to search", "Give me an album name to look for.");
        }

        const voice = resolveVoice(ctx);
        if (!voice) return;

        // Matching the opening track takes as long as any other lookup, so
        // acknowledge the request before starting it.
        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.info,
                    title: "🔎 Looking that up",
                    description: `Searching for the album **${query}**…`,
                    timestamp: false
                })
            ]
        });

        let album;
        let tracks;

        try {
            album = await searchAlbum(query);
            if (album) tracks = await albumTracks(album.id);
        } catch (error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Album lookup failed",
                        description: error.message,
                        timestamp: false
                    })
                ]
            });
        }

        if (!album) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ No album found",
                        description: `Nothing matched **${query}**. Try adding the artist name too.`,
                        timestamp: false
                    })
                ]
            });
        }

        if (!tracks?.length) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ No tracklist",
                        description: `I found **${album.name}** but it has no tracks listed.`,
                        timestamp: false
                    })
                ]
            });
        }

        // Each track is queued as an unresolved entry: the album metadata is
        // kept, and Lavalink only searches for a match when that track starts.
        const capped = tracks.slice(0, config.albums.maxTracks);
        const albumTracks = buildAlbumTracks(ctx.client, album, capped, ctx.author);

        // The album is known by now, so the waiting message can name it while the
        // opening track is matched by Lavalink.
        await ctx.edit({
            embeds: [
                embed({
                    color: config.colors.info,
                    title: `💿 ${album.name}`,
                    description: `Adding ${capped.length} tracks, matching the first one…`,
                    thumbnail: safeUrl(album.thumbnail),
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

        try {
            await addTracks(player, albumTracks);
        } catch (error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "✗ Could not queue that album",
                        description: error.message,
                        timestamp: false
                    })
                ]
            });
        }

        const added = (player.queue.current ? player.queue.tracks.length + 1 : player.queue.tracks.length) - position;

        const fields = [
            { name: "Artist", value: album.artist || "Unknown", inline: true },
            { name: "Tracks", value: `${added} added`, inline: true },
            { name: "Length", value: formatLength(capped.reduce((sum, t) => sum + (t.duration || 0), 0)), inline: true }
        ];

        if (tracks.length > capped.length) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.warning,
                        title: `💿 ${album.name}`,
                        description: `Added the first ${capped.length} of ${tracks.length} tracks. ${SUBSTITUTION_NOTE}`,
                        thumbnail: safeUrl(album.thumbnail),
                        fields
                    })
                ]
            });
        }

        return ctx.edit({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: `💿 ${album.name}`,
                    description: `Added ${added} ${added === 1 ? "track" : "tracks"}. ${SUBSTITUTION_NOTE}`,
                    thumbnail: safeUrl(album.thumbnail),
                    fields
                })
            ]
        });
    }
};
