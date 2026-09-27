const { ExtractorPlugin, PlayableExtractorPlugin, Playlist, Song } = require("distube");
const { dumpJson, streamUrlOnce } = require("./ytdlp");

const MAX_PLAYLIST_ITEMS = 50;

/**
 * Reading a playlist's entries is one yt-dlp call that resolves every track, so
 * it needs a far longer budget than a single lookup. The default is sized for a
 * slow mobile connection, and can be raised with YTDLP_TIMEOUT for very large
 * playlists on slower links.
 */
const PLAYLIST_TIMEOUT = Number.parseInt(process.env.YTDLP_TIMEOUT || "240000", 10);

/**
 * Playlists are requested with --flat-playlist.
 *
 * A plain -J on a playlist serialises every available format for every entry,
 * which for 50 tracks is tens of megabytes and takes minutes. Flat mode returns
 * just id/title/duration per entry, so the whole list arrives in seconds. The
 * audio stream URL is fetched later by getStreamURL() anyway, so the missing
 * format data costs nothing at playback time.
 */
function isPlaylistUrl(url) {
    return /[?&]list=/.test(url) || /\/playlist\b/.test(url);
}

/** Thumbnails are not listed in flat mode, but YouTube's URL is predictable. */
function thumbnailForId(id) {
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

/**
 * A full -J response already lists every stream, including resolved audio URLs.
 * Reading the stream straight out of it removes an entire second network round
 * trip per song, which is the single largest contributor to the wait before
 * audio starts. This is the same trick @distube/yt-dlp uses internally.
 */
function bestAudioStream(info) {
    const formats = Array.isArray(info?.formats) ? info.formats : [];
    let best = null;
    let bestScore = -1;

    for (const format of formats) {
        if (!format?.url || !/^https?:\/\//i.test(format.url)) continue;
        if (!format.acodec || format.acodec === "none") continue;

        // Audio-only streams are preferred, then the highest bitrate wins.
        const score = (format.vcodec && format.vcodec !== "none" ? 0 : 1000) + (format.abr ?? format.tbr ?? 0);

        if (score > bestScore) {
            bestScore = score;
            best = format;
        }
    }

    return best?.url ?? null;
}

/**
 * DisTube's Song only keeps its own known fields, so discovered stream URLs are
 * held here and looked up by page URL when the player asks for one.
 */
const STREAM_TTL = 5 * 60 * 1000;
const knownStreams = new Map();

function rememberStream(pageUrl, info) {
    if (!pageUrl) return null;

    const direct = bestAudioStream(info);
    if (direct) knownStreams.set(pageUrl, { url: direct, at: Date.now() });

    return direct;
}

function knownStream(pageUrl) {
    const hit = pageUrl ? knownStreams.get(pageUrl) : undefined;
    if (!hit) return null;

    if (Date.now() - hit.at > STREAM_TTL) {
        knownStreams.delete(pageUrl);
        return null;
    }

    return hit.url;
}

/**
 * Autoplay support.
 *
 * DisTube asks the song's own plugin for related tracks, and neither
 * @distube/spotify (which returns an empty list) nor the base extractor classes
 * provide any, so without this autoplay silently never starts. yt-dlp has no
 * similarity API either, so the closest available signal is the uploader's own
 * channel: other tracks from the same artist.
 */
const RELATED_TTL = 15 * 60 * 1000;
const RELATED_FETCH = 25;
const MIN_DURATION = 90;
const MAX_DURATION = 2 * 60 * 60;
const MAX_RELATED = 10;

const relatedCache = new Map();

/**
 * Uploads that are not the track itself: covers, karaoke, nightcore, lyric
 * videos, sped-up edits, subtitle rips and long looping uploads. Artists upload a
 * lot of these next to their real music, and autoplay should not reach for them.
 */
const UNUSABLE = new RegExp(
    "\\b(cover|karaoke|nightcore|instrumental|remix|mashup|parody|sped[\\s-]?up|slowed|reverb|8[\\s-]?bit" +
        "|lyric[\\s-]?video|with[\\s-]?lyrics|subtitles?|reaction|tutorial|sing[\\s-]?along|minus[\\s-]?one" +
        "|\\d+\\s*hours?|loop|extended)\\b|【",
    "i"
);

/** Shorts, live streams and uploads that are obviously not full tracks. */
function isPlayableTrack(entry) {
    if (!entry?.id || !entry?.title) return false;
    if (entry.live_status && entry.live_status !== "not_live") return false;
    if (entry.availability && entry.availability !== "public") return false;
    if (typeof entry.duration !== "number") return false;
    if (entry.duration < MIN_DURATION || entry.duration > MAX_DURATION) return false;
    if (UNUSABLE.test(entry.title)) return false;
    return true;
}

async function channelTracks(uploaderUrl) {
    if (!uploaderUrl) return [];

    const url = `${uploaderUrl.replace(/\/+$/, "")}/videos`;
    const cached = relatedCache.get(url);
    if (cached && Date.now() - cached.at < RELATED_TTL) return cached.entries;

    try {
        const info = await dumpJson(url, ["--flat-playlist", "--playlist-end", String(RELATED_FETCH)], {
            timeout: PLAYLIST_TIMEOUT
        });

        const entries = (Array.isArray(info?.entries) ? info.entries.filter(Boolean) : [])
            .filter(isPlayableTrack)
            .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
            .slice(0, MAX_RELATED);

        relatedCache.set(url, { entries, at: Date.now() });
        return entries;
    } catch {
        // A failed lookup must not break playback, so it is simply not cached.
        return cached?.entries ?? [];
    }
}

async function getRelatedSongs(song) {
    const candidates = await channelTracks(song.uploader?.url);

    // Flat channel listings carry no uploader name, but every candidate comes from
    // the same channel as the current song. Copying it across keeps the artist
    // visible in embeds and, more importantly, gives the next autoplay roll the
    // channel it needs to keep going.
    const uploader = { name: song.uploader?.name, url: song.uploader?.url };

    return candidates
        .filter((entry) => entry.id !== song.id)
        .slice(0, 5)
        .map((entry) => new Song(toSongInfo(this, entry, uploader)));
}

function bestThumbnail(info) {
    if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
        const best = info.thumbnails.reduce((a, b) => ((b.preference ?? 0) > (a.preference ?? 0) ? b : a));
        if (best?.url) return best.url;
    }
    return info.thumbnail ?? undefined;
}

function toSongInfo(plugin, info, uploader) {
    const id = String(info.id ?? info.display_id ?? "");

    return {
        plugin,
        source: "yt-dlp",
        playFromSource: true,
        id,
        name: info.title ?? info.fulltitle ?? "Unknown track",
        isLive: Boolean(info.is_live),
        duration: info.duration ?? 0,
        url: info.webpage_url ?? info.original_url ?? info.url,
        thumbnail: bestThumbnail(info) ?? thumbnailForId(id),
        views: info.view_count ?? undefined,
        likes: info.like_count ?? undefined,
        uploader: uploader ?? {
            name: info.uploader ?? info.channel ?? undefined,
            url: info.uploader_url ?? info.channel_url ?? undefined
        },
        ageRestricted: info.age_limit > 0
    };
}

/**
 * Resolves any link yt-dlp understands into a Song, and hands back a direct
 * audio stream URL so ffmpeg never has to re-encode.
 *
 * This replaces @distube/yt-dlp's YtDlpPlugin, which cannot be used reliably
 * here for two reasons: its constructor re-downloads the yt-dlp binary unless
 * `update: false` is passed (overwriting the executable shim on Termux), and
 * its JSON helper merges stderr into the buffer it parses, so any yt-dlp
 * warning makes it throw.
 */
class YtDlpPlayPlugin extends PlayableExtractorPlugin {
    /**
     * Spotify audio is DRM protected, so yt-dlp refuses it outright. This
     * plugin must decline those links and let SpotifyPlugin read the metadata
     * instead, otherwise it would claim the URL and fail with a DRM error.
     */
    async validate(url) {
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
        return !/(^|\/\/|\.)(open\.spotify\.com|spotify\.link|spoti\.fi)\//i.test(url);
    }

    async resolve(url, options = {}) {
        const extra = ["--playlist-end", String(MAX_PLAYLIST_ITEMS)];
        if (isPlaylistUrl(url)) extra.push("--flat-playlist");

        const info = await dumpJson(url, extra, { timeout: PLAYLIST_TIMEOUT });
        const entries = Array.isArray(info?.entries) ? info.entries.filter(Boolean) : null;

        if (entries && entries.length > 1) {
            return new Playlist(
                {
                    source: "yt-dlp",
                    name: info.title ?? "Playlist",
                    url: info.webpage_url ?? url,
                    thumbnail: bestThumbnail(info) ?? thumbnailForId(entries[0]?.id),
                    songs: entries.map((entry) => new Song(toSongInfo(this, entry), options))
                },
                options
            );
        }

        const single = entries?.[0] ?? info;
        const song = new Song(toSongInfo(this, single), options);

        rememberStream(song.url, single);

        return song;
    }

    /**
     * Uses the stream URL that came back with the metadata when there is one.
     * Flat playlist entries carry no format data, so those still need a lookup.
     */
    async getStreamURL(song) {
        return knownStream(song.url) ?? streamUrlOnce(song.url);
    }

    async getRelatedSongs(song) {
        return getRelatedSongs.call(this, song);
    }
}

/**
 * DisTube only runs searches through plugins of type `extractor`, and the
 * official packages ship none, so every plain-text query fails with
 * "Cannot find any song with this query". This bridges that gap: it runs a
 * `ytsearch1:` lookup and hands the winning link to the play plugin.
 */
/**
 * Search results, kept so a track that is already queued can be matched on
 * YouTube before it is due to play.
 *
 * The raw metadata is cached rather than the Song, because every caller needs
 * its own Song with its own metadata and member attached, while the expensive
 * part is the lookup itself.
 */
const SEARCH_TTL = 10 * 60 * 1000;
const searches = new Map();

function cachedSearch(query) {
    const hit = searches.get(query);
    if (!hit) return null;

    if (Date.now() - hit.at > SEARCH_TTL) {
        searches.delete(query);
        return null;
    }

    return hit;
}

function songFromSearch(plugin, video, options) {
    const song = new Song(toSongInfo(plugin, video), options);

    rememberStream(song.url, video);

    return song;
}

class YtDlpSearchPlugin extends ExtractorPlugin {
    constructor(playPlugin) {
        super();
        this.play = playPlugin ?? new YtDlpPlayPlugin();
    }

    init(distube) {
        super.init(distube);
        this.play.init(distube);
    }

    /** Never claim a link; the play plugin owns URL resolution. */
    async validate() {
        return false;
    }

    async searchSong(query, options = {}) {
        const hit = cachedSearch(query);
        if (hit) return songFromSearch(this.play, hit.video, options);

        const info = await dumpJson(`ytsearch1:${query}`);
        const video = Array.isArray(info?.entries) ? info.entries.find(Boolean) : info;
        if (!video?.id) return null;

        searches.set(query, { video, at: Date.now() });

        return songFromSearch(this.play, video, options);
    }

    /**
     * Starts the YouTube match for a queued track without waiting for it.
     *
     * DisTube resolves a song only once the previous one has finished, so without
     * this every Spotify or album track change is met with silence while YouTube
     * is searched.
     */
    prefetch(query) {
        if (!query) return Promise.resolve();

        const hit = cachedSearch(query);
        if (hit) return Promise.resolve();

        return this.searchSong(query, {}).catch(() => {
            searches.delete(query);
        });
    }

    async getStreamURL(song) {
        return this.play.getStreamURL(song);
    }

    async getRelatedSongs(song) {
        return this.play.getRelatedSongs(song);
    }
}

/** The search plugin registered on a DisTube instance, used for prefetching. */
function searchPluginOf(distube) {
    return distube.plugins.find((plugin) => plugin instanceof YtDlpSearchPlugin) ?? null;
}

module.exports = { YtDlpPlayPlugin, YtDlpSearchPlugin, searchPluginOf };
