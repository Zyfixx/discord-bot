const { LavalinkManager } = require("lavalink-client");
const config = require("../config");
const { embed, fail, requireGuild } = require("./feedback");

let manager = null;
let initStarted = false;

/**
 * The Lavalink manager for this process.
 *
 * Constructed lazily because it needs the Discord client for its voice payload
 * bridge, but everything that talks to Lavalink (the nodes) starts in
 * initMusic() once the bot is logged in.
 */
function getLavalink(client) {
    if (manager) return manager;
    if (!client) throw new Error("The music service is not ready yet.");

    const { host, port, password, secure, name, nodeType, search, volume } = config.lavalink;

    manager = new LavalinkManager({
        nodes: [
            {
                id: name,
                host,
                port,
                authorization: password,
                secure,
                nodeType,
                requestSignalTimeoutMS: 30000
            }
        ],
        sendToShard(guildId, payload) {
            const guild = client.guilds.cache.get(guildId);
            if (guild?.shard) guild.shard.send(payload);
            else client.ws.send(payload);
        },
        autoSkip: true,
        autoSkipOnResolveError: true,
        playerOptions: {
            defaultSearchPlatform: search,
            useUnresolvedData: true,
            volumeDecrementer: 1,
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false
            },
            onEmptyQueue: {
                autoPlayFunction: autoplay
            }
        },
        queueOptions: {
            maxPreviousTracks: 25
        }
    });

    manager.nodeManager.on("connect", (node) => {
        console.log(`[lavalink] connected to ${node.id} (${node.host}:${node.port})`);
    });

    manager.nodeManager.on("error", (node, error) => {
        console.error(`[lavalink] ${node.id}: ${error.message}`);
    });

    manager.nodeManager.on("disconnect", (node, reason) => {
        console.warn(`[lavalink] disconnected from ${node.id}${reason?.reason ? `: ${reason.reason}` : ""}`);
    });

    manager.on("trackError", (player, track, payload) => {
        const message = payload?.exception?.message || payload?.error || "That track could not be played.";
        console.error(`[lavalink] ${message}`);
        notify(client, player, config.colors.danger, "⚠️ Playback error", message);
    });

    manager.on("trackStuck", (player, track, payload) => {
        const seconds = Math.round((payload?.thresholdMs ?? 0) / 1000);
        notify(
            client,
            player,
            config.colors.warning,
            "⚠️ Playback stalled",
            `The track stopped responding and was skipped after ${seconds}s.`
        );
    });

    manager.on("queueEnd", (player, track, payload) => {
        // stop/leave clear the queue on purpose; those already answer the user.
        if (payload?.reason === "stopped") return;

        notify(
            client,
            player,
            config.colors.neutral,
            null,
            `🎧 Queue finished. Use \`${config.prefix}leave\` if you want me to disconnect.`
        );
    });

    return manager;
}

/** Starts the node connections and wires Lavalink's voice data into Discord. */
function initMusic(client) {
    const lavalink = getLavalink(client);

    if (!initStarted) {
        initStarted = true;

        client.on("raw", (data) => {
            lavalink.sendRawData(data).catch(() => {});
        });
    }

    if (!config.lavalink.password) {
        console.warn("[lavalink] LAVALINK_PASSWORD is empty; music will not connect until it is set in .env.");
        return lavalink;
    }

    if (!lavalink.initiated) {
        lavalink.init({ id: client.user.id, username: client.user.username }).catch((error) => {
            console.error(`[lavalink] could not connect: ${error.message}`);
        });
    }

    return lavalink;
}

function describeLavalink() {
    const { host, port, secure, password, nodeType } = config.lavalink;
    const scheme = secure ? "wss" : "ws";
    const note = password ? "" : " [no password set]";
    return `${nodeType.toLowerCase()}: ${scheme}://${host}:${port}${note}`;
}

function notify(client, player, color, title, description) {
    if (!player?.textChannelId) return;

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel?.send) return;

    channel.send({ embeds: [embed({ color, title, description, timestamp: false })] }).catch(() => {});
}

/** True when nobody but the bot is sitting in the channel. */
function isChannelEmpty(channel) {
    const members = channel?.members;
    if (!members || typeof members.filter !== "function") return false;
    return members.filter((member) => !member.user?.bot).size === 0;
}

function getPlayer(ctx) {
    if (!ctx?.guild) return undefined;
    return getLavalink(ctx.client).getPlayer(ctx.guild.id);
}

/**
 * Gets the player for this guild or creates one, then makes sure it is
 * connected to the requested voice channel.
 */
async function ensurePlayer(ctx, voice) {
    const lavalink = getLavalink(ctx.client);
    let player = lavalink.getPlayer(ctx.guild.id);

    if (!player) {
        player = lavalink.createPlayer({
            guildId: ctx.guild.id,
            voiceChannelId: voice.id,
            textChannelId: ctx.channel.id,
            volume: config.lavalink.volume,
            selfDeaf: true,
            selfMute: false
        });
    } else {
        player.textChannelId = ctx.channel.id;

        if (player.voiceChannelId !== voice.id) {
            if (player.voiceChannelId) await player.changeVoiceState({ voiceChannelId: voice.id });
            else player.options.voiceChannelId = voice.id;
        }
    }

    if (!player.connected) await player.connect();

    return player;
}

/**
 * Resolves a search term or link and returns Lavalink's result.
 *
 * Plain text goes through LAVALINK_SEARCH; links are handed to Lavalink as-is,
 * so whichever source plugins the server has decide what can be played.
 */
async function searchTracks(player, query, requester) {
    const result = await player.search(query, requester);

    if (result.loadType === "error") {
        throw new Error(result.exception?.message || "The music server could not resolve that link.");
    }

    if (!result.tracks?.length) {
        throw new Error("No results were found for that search.");
    }

    return result;
}

/** Adds tracks and starts playback when the player was idle. */
async function addTracks(player, tracks) {
    player.queue.add(tracks);

    if (!player.queue.current && !player.paused) await player.play();
}

/**
 * Keeps the music going when the queue runs out and the user enabled autoplay.
 *
 * Lavalink has no cross-source recommendation API, so the closest signal is the
 * artist of the last track. Duplicates already seen in this session are
 * filtered out, and failures are swallowed so autoplay can never break the
 * player.
 */
async function autoplay(player, lastTrack) {
    if (!player.getData("autoplay") || !lastTrack?.info) return;

    const query = lastTrack.info.author || lastTrack.info.title;
    if (!query) return;

    try {
        const result = await player.search(query, lastTrack.requester ?? {});
        const known = new Set(
            [lastTrack, ...player.queue.previous, ...player.queue.tracks].map((track) => track.info?.identifier)
        );

        const picks = result.tracks
            .filter(
                (track) =>
                    track.info &&
                    !track.info.isStream &&
                    track.info.duration >= 60_000 &&
                    !known.has(track.info.identifier)
            )
            .slice(0, 5);

        if (picks.length) player.queue.add(picks);
    } catch {
        /* autoplay is best effort */
    }
}

function requireQueue(ctx) {
    if (!requireGuild(ctx)) return null;

    const player = getPlayer(ctx);
    if (player && (player.queue.current || player.queue.tracks.length)) return player;

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

function requireSameVoice(ctx, player) {
    const userChannel = ctx.member?.voice?.channelId;
    const botChannel = player?.voiceChannelId;

    if (!userChannel) {
        fail(ctx, "Not in a voice channel", "Join a voice channel first, then run the command again.");
        return false;
    }

    if (!botChannel) {
        fail(ctx, "Not connected", "I am not connected to a voice channel. Use `play` to start some music.");
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

    const player = getPlayer(ctx);
    const current = player?.voiceChannelId ? ctx.guild.channels.cache.get(player.voiceChannelId) : null;
    const busy = Boolean(current) && Boolean(player?.queue.current || player?.queue.tracks.length);

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
    if (!ctx.guild) return false;
    return Boolean(getLavalink(ctx.client).getPlayer(ctx.guild.id)?.voiceChannelId);
}

/**
 * Turns an album and its tracklist into Lavalink unresolved tracks.
 *
 * Nothing is looked up here: each track keeps the album title, artist and
 * duration, and Lavalink matches it against the default search source only
 * when it is about to play. That is what lets a whole album queue immediately.
 */
function buildAlbumTracks(client, album, tracks, requester) {
    const lavalink = getLavalink(client);

    return tracks.map((track) =>
        lavalink.utils.buildUnresolvedTrack(
            {
                info: {
                    title: track.name,
                    author: track.artist || album.artist || "Unknown artist",
                    duration: (track.duration || 0) * 1000,
                    artworkUrl: track.thumbnail ?? album.thumbnail ?? null
                }
            },
            requester
        )
    );
}

function formatDuration(ms) {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function progressBar(current, total, size = 14) {
    const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
    const filled = Math.round(ratio * size);
    return `${"█".repeat(filled)}${"░".repeat(size - filled)}`;
}

function safeUrl(url) {
    return typeof url === "string" && /^https?:\/\/\S+$/i.test(url) ? url : null;
}

function trackFields(track, player) {
    const info = track?.info ?? {};
    const fields = [];
    const url = safeUrl(info.uri);

    if (url) {
        fields.push({ name: "Link", value: `[${info.title ?? "Open in browser"}](${url})`, inline: false });
    }

    fields.push({
        name: "Duration",
        value: info.isStream ? "📡 Live stream" : formatDuration(info.duration),
        inline: true
    });

    if (info.author) {
        fields.push({ name: "Artist", value: String(info.author).slice(0, 100), inline: true });
    }

    if (player?.queue.current === track && !info.isStream && info.duration > 0) {
        fields.push({
            name: "Progress",
            value: `${progressBar(player.position, info.duration)} ${formatDuration(player.position)} / ${formatDuration(info.duration)}`,
            inline: false
        });
    }

    return fields;
}

function nowPlayingEmbed(track, player, color = config.colors.primary) {
    const info = track?.info ?? {};

    return embed({
        color,
        title: "🎵 Now playing",
        url: safeUrl(info.uri),
        thumbnail: safeUrl(info.artworkUrl),
        fields: trackFields(track, player),
        timestamp: false
    });
}

function songLine(track, label) {
    const info = track?.info ?? {};
    const url = safeUrl(info.uri);
    const title = info.title ?? "Unknown";
    const when = info.isStream ? "live" : formatDuration(info.duration);
    const by = track?.requester?.tag ? ` • ${track.requester.tag}` : "";

    return url ? `**${label}.** [${title}](${url}) • ${when}${by}` : `**${label}.** ${title} • ${when}${by}`;
}

function queueList(player, max = 10) {
    const upcoming = player?.queue?.tracks ?? [];
    if (!upcoming.length) return "Nothing else is queued.";

    const lines = upcoming.slice(0, max).map((track, index) => songLine(track, index + 1));

    if (upcoming.length > max) lines.push(`…and ${upcoming.length - max} more`);

    return lines.join("\n");
}

function totalDuration(player) {
    const tracks = [player?.queue?.current, ...(player?.queue?.tracks ?? [])].filter(Boolean);
    const milliseconds = tracks.reduce((sum, track) => sum + (track.info?.duration || 0), 0);

    return formatDuration(milliseconds);
}

const SPOTIFY_URI = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{10,})$/i;
/**
 * Rewrites `spotify:playlist:ID` share links to their open.spotify.com form.
 *
 * Lavalink source plugins match on HTTP links, so the bare URI form would
 * otherwise be treated as a search term and fail.
 */
function normalizeQuery(query) {
    const match = SPOTIFY_URI.exec(String(query ?? "").trim());

    if (!match) return query;

    return `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}`;
}

module.exports = {
    getLavalink,
    initMusic,
    describeLavalink,
    getPlayer,
    ensurePlayer,
    searchTracks,
    addTracks,
    requireQueue,
    requireVoice,
    requireSameVoice,
    resolveVoice,
    isConnected,
    buildAlbumTracks,
    normalizeQuery,
    nowPlayingEmbed,
    queueList,
    totalDuration,
    progressBar,
    safeUrl,
    songLine,
    formatDuration
};
