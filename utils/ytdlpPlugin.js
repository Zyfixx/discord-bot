const { ExtractorPlugin, PlayableExtractorPlugin, Playlist, Song } = require("distube");
const { dumpJson, streamUrl } = require("./ytdlp");

const MAX_PLAYLIST_ITEMS = 50;

function bestThumbnail(info) {
    if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
        const best = info.thumbnails.reduce((a, b) => ((b.preference ?? 0) > (a.preference ?? 0) ? b : a));
        if (best?.url) return best.url;
    }
    return info.thumbnail ?? undefined;
}

function toSongInfo(plugin, info) {
    return {
        plugin,
        source: "yt-dlp",
        playFromSource: true,
        id: String(info.id ?? info.display_id ?? ""),
        name: info.title ?? info.fulltitle ?? "Unknown track",
        isLive: Boolean(info.is_live),
        duration: info.duration ?? 0,
        url: info.webpage_url ?? info.original_url ?? info.url,
        thumbnail: bestThumbnail(info),
        views: info.view_count ?? undefined,
        likes: info.like_count ?? undefined,
        uploader: {
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
        const info = await dumpJson(url, ["--playlist-end", String(MAX_PLAYLIST_ITEMS)]);
        const entries = Array.isArray(info?.entries) ? info.entries.filter(Boolean) : null;

        if (entries && entries.length > 1) {
            return new Playlist(
                {
                    source: "yt-dlp",
                    name: info.title ?? "Playlist",
                    url: info.webpage_url ?? url,
                    thumbnail: bestThumbnail(info),
                    songs: entries.map((entry) => new Song(toSongInfo(this, entry), options))
                },
                options
            );
        }

        const single = entries?.[0] ?? info;
        return new Song(toSongInfo(this, single), options);
    }

    async getStreamURL(song) {
        return streamUrl(song.url);
    }
}

/**
 * DisTube only runs searches through plugins of type `extractor`, and the
 * official packages ship none, so every plain-text query fails with
 * "Cannot find any song with this query". This bridges that gap: it runs a
 * `ytsearch1:` lookup and hands the winning link to the play plugin.
 */
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
        const info = await dumpJson(`ytsearch1:${query}`);
        const video = Array.isArray(info?.entries) ? info.entries.find(Boolean) : info;
        if (!video?.id) return null;

        return this.play.resolve(video.webpage_url ?? `https://www.youtube.com/watch?v=${video.id}`, options);
    }

    async getStreamURL(song) {
        return this.play.getStreamURL(song);
    }
}

module.exports = { YtDlpPlayPlugin, YtDlpSearchPlugin };
