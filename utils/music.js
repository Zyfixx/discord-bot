require("./ytdlp").setupYtDlp();

const { DisTube, Events, formatDuration } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { YtDlpPlayPlugin, YtDlpSearchPlugin } = require("./ytdlpPlugin");
const config = require("../config");
const { embed, fail, requireGuild } = require("./feedback");

let distube = null;

/**
 * True when nobody but the bot is sitting in the channel.
 *
 * An unreadable member list counts as occupied so a missing cache can never be
 * used to take the bot away from an audience.
 */
function isChannelEmpty(channel) {
    const members = channel?.members;
    if (!members || typeof members.filter !== "function") return false;
    return members.filter((member) => !member.user?.bot).size === 0;
}

function getDistube(client) {
    if (distube) return distube;

    const ytdlp = new YtDlpPlayPlugin();
    const spotify = new SpotifyPlugin({
        api: {
            clientId: config.spotify.clientId ?? undefined,
            clientSecret: config.spotify.clientSecret ?? undefined,
            topTracksCountry: config.spotify.topTracksCountry
        }
    });

    distube = new DisTube(client, {
        // Order matters. SpotifyPlugin is an info-extractor: it only reads
        // metadata and hands the real audio off to the search plugin, because
        // Spotify streams are DRM protected and cannot be downloaded directly.
        // The YouTube play plugin must stay last so it is consulted for links.
        plugins: [spotify, new YtDlpSearchPlugin(ytdlp), ytdlp],
        emitAddSongWhenCreatingQueue: false,
        emitAddListWhenCreatingQueue: false,
        savePreviousSongs: true,
        joinNewVoiceChannel: true,
        nsfw: false
    });

    distube.on(Events.ERROR, (error, queue) => {
        console.error(`[music] ${error.message}`);

        queue?.textChannel
            ?.send({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "⚠️ Playback error",
                        description: `${error.message}`,
                        timestamp: false
                    })
                ]
            })
            .catch(() => {});
    });

    distube.on(Events.FINISH, (queue) => {
        if (queue.songs.length) return;

        queue.textChannel
            ?.send({
                embeds: [
                    embed({
                        color: config.colors.neutral,
                        description: `🎧 Queue finished. Use \`${config.prefix}leave\` if you want me to disconnect.`,
                        timestamp: false
                    })
                ]
            })
            .catch(() => {});
    });

    return distube;
}

function getQueue(ctx) {
    if (!ctx.guild) return undefined;
    return getDistube(ctx.client).getQueue(ctx.guild);
}

function requireQueue(ctx) {
    if (!requireGuild(ctx)) return null;

    const queue = getQueue(ctx);
    if (queue) return queue;

    fail(ctx, "Nothing playing", "There is no active music queue in this server.");
    return null;
}

function requireVoice(ctx) {
    if (!requireGuild(ctx)) return null;

    const channel = ctx.member?.voice?.channel;
    if (channel) return channel;

    fail(ctx, "Not in a voice channel", "Join a voice channel first, then run the command again.");
    return null;
}

function requireSameVoice(ctx, queue) {
    const userChannel = ctx.member?.voice?.channelId;
    const botChannel = queue?.voice?.channel?.id ?? queue?.voiceChannel?.id;

    if (!userChannel) {
        fail(ctx, "Not in a voice channel", "Join a voice channel first, then run the command again.");
        return false;
    }

    if (userChannel !== botChannel) {
        fail(ctx, "Different voice channel", `Join <#${botChannel}> to control the music.`);
        return false;
    }

    return true;
}

/**
 * Picks the voice channel playback should use.
 *
 * While songs are loaded the bot holds its position, so somebody in another
 * channel cannot pull the music away from an audience. It only lets go when its
 * own channel is empty, or once the queue runs dry.
 */
function resolveVoice(ctx) {
    if (!requireGuild(ctx)) return null;

    const target = ctx.member?.voice?.channel;

    if (!target) {
        fail(ctx, "Not in a voice channel", "Join a voice channel first, then run the command again.");
        return null;
    }

    const queue = getQueue(ctx);
    const current = queue?.voice?.channel;
    const busy = Boolean(current) && (queue.songs?.length > 0 || queue.current);

    if (busy && current.id !== target.id && !isChannelEmpty(current)) {
        fail(
            ctx,
            "Already playing elsewhere",
            `I'm playing in <#${current.id}>. Join that channel to add songs, or use \`${config.prefix}leave\` to bring me over.`
        );
        return null;
    }

    return target;
}

function isConnected(ctx) {
    const distube = getDistube(ctx.client);
    return Boolean(distube.getQueue(ctx.guild)?.voice ?? distube.voices?.get(ctx.guild?.id));
}

function progressBar(current, total, size = 14) {
    const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
    const filled = Math.round(ratio * size);
    return `${"█".repeat(filled)}${"░".repeat(size - filled)}`;
}

function safeUrl(url) {
    return typeof url === "string" && /^https?:\/\/\S+$/i.test(url) ? url : null;
}

function songFields(song, queue) {
    const fields = [];
    const url = safeUrl(song.url);

    if (url) {
        fields.push({ name: "Link", value: `[${song.name ?? "Open in browser"}](${url})`, inline: false });
    }

    fields.push({
        name: "Duration",
        value: song.isLive ? "📡 Live stream" : (song.formattedDuration || formatDuration(song.duration)),
        inline: true
    });

    if (song.uploader?.name) {
        fields.push({ name: "Uploader", value: song.uploader.name.slice(0, 100), inline: true });
    }

    if (queue) {
        fields.push({
            name: "Progress",
            value: `${progressBar(queue.currentTime, song.duration)} ${queue.formattedCurrentTime} / ${song.formattedDuration}`,
            inline: false
        });
    }

    return fields;
}

function nowPlayingEmbed(song, queue, color = config.colors.primary) {
    return embed({
        color,
        title: "🎵 Now playing",
        url: safeUrl(song.url),
        thumbnail: safeUrl(song.thumbnail),
        fields: songFields(song, queue),
        timestamp: false
    });
}

function songLine(song, label) {
    const url = safeUrl(song.url);
    const title = song.name ?? "Unknown";
    const when = song.isLive ? "live" : (song.formattedDuration ?? "unknown length");
    const by = song.requestedBy?.tag ? ` • ${song.requestedBy.tag}` : "";
    return url ? `**${label}.** [${title}](${url}) • ${when}${by}` : `**${label}.** ${title} • ${when}${by}`;
}

function queueList(queue, max = 10) {
    const upcoming = queue.songs.slice(1);
    if (!upcoming.length) return "Nothing else is queued.";

    const lines = upcoming.slice(0, max).map((song, index) => songLine(song, index + 1));

    if (upcoming.length > max) lines.push(`…and ${upcoming.length - max} more`);

    return lines.join("\n");
}

function totalDuration(queue) {
    const seconds = queue.songs.reduce((sum, song) => sum + (song.duration || 0), 0);
    return formatDuration(seconds);
}

const SPOTIFY_URI = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{10,})$/i;
/**
 * Rewrites `spotify:playlist:ID` share links to their open.spotify.com form.
 *
 * DisTube only consults URL plugins when the input passes `isURL()`, which
 * rejects every `spotify:` URI, so those links would otherwise be treated as
 * a search term and fail with CANNOT_RESOLVE_SONG. Spotify share links are
 * common on mobile, so they need converting before playback.
 */
function normalizeQuery(query) {
    const match = SPOTIFY_URI.exec(String(query ?? "").trim());

    if (!match) return query;

    return `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}`;
}

module.exports = {
    getDistube,
    getQueue,
    requireQueue,
    requireVoice,
    requireSameVoice,
    resolveVoice,
    isConnected,
    normalizeQuery,
    nowPlayingEmbed,
    queueList,
    totalDuration,
    progressBar,
    safeUrl,
    songLine
};
