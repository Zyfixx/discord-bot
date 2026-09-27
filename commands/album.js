const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { done, fail, requireGuild, warn } = require("../utils/feedback");
const { getDistube, resolveVoice, safeUrl, buildAlbumPlaylist } = require("../utils/music");
const { searchAlbum, albumTracks } = require("../utils/albums");

const SUBSTITUTION_NOTE = ""
    // "Only the tracklist comes from the album lookup — every track is matched on YouTube when it starts.";

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
        if (!query) return fail(ctx, "Nothing to search", "Give me an album name to look for.");

        const voice = resolveVoice(ctx);
        if (!voice) return;

        let album;
        let tracks;

        try {
            album = await searchAlbum(query);
            if (album) tracks = await albumTracks(album.id);
        } catch (error) {
            return fail(ctx, "Album lookup failed", error.message);
        }

        if (!album) {
            return fail(ctx, "No album found", `Nothing matched **${query}**. Try adding the artist name too.`);
        }

        if (!tracks?.length) {
            return fail(ctx, "No tracklist", `I found **${album.name}** but it has no tracks listed.`);
        }

        // Building every track as a Song here is instant, because they carry no
        // audio data. YouTube is only searched for a track as it starts playing,
        // so a full album is queued immediately instead of after a long wait.
        const playlist = buildAlbumPlaylist(ctx.client, album, tracks.slice(0, config.albums.maxTracks));

        if (!playlist) {
            return fail(ctx, "Album unavailable", "The music plugins are not ready yet, try again in a moment.");
        }

        const distube = getDistube(ctx.client);
        const existing = distube.getQueue(ctx.guild);
        const position = existing?.songs.length ?? 0;
        const capped = tracks.slice(0, config.albums.maxTracks);

        try {
            await distube.play(voice, playlist, {
                member: ctx.member,
                textChannel: ctx.channel
            });
        } catch (error) {
            return fail(ctx, "Could not queue that album", error.message);
        }

        const queue = distube.getQueue(ctx.guild);
        const added = (queue?.songs.length ?? 0) - position;

        const fields = [
            { name: "Artist", value: album.artist || "Unknown", inline: true },
            { name: "Tracks", value: `${added} added`, inline: true },
            { name: "Length", value: formatLength(capped.reduce((sum, t) => sum + (t.duration || 0), 0)), inline: true }
        ];

        if (tracks.length > capped.length) {
            return warn(ctx, {
                title: `💿 ${album.name}`,
                description: `Added the first ${capped.length} of ${tracks.length} tracks. ${SUBSTITUTION_NOTE}`,
                thumbnail: safeUrl(album.thumbnail),
                fields
            });
        }

        return done(ctx, {
            title: `💿 ${album.name}`,
            description: `Added ${added} ${added === 1 ? "track" : "tracks"}. ${SUBSTITUTION_NOTE}`,
            thumbnail: safeUrl(album.thumbnail),
            fields
        });
    }
};
