require("dotenv").config();

module.exports = {
    prefix: process.env.COMMAND_PREFIX || "!",

    groups: {
        utility: process.env.GROUP_UTILITY !== "false",
        moderation: process.env.GROUP_MODERATION !== "false",
        fun: process.env.GROUP_FUN !== "false",
        music: process.env.GROUP_MUSIC !== "false"
    },

    disabled: (process.env.DISABLED_COMMANDS || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),

    confirmTimeout: Number(process.env.CONFIRM_TIMEOUT || 15000),
    purgeLimit: 100,
    maxMuteDays: 28,
    footer: process.env.FOOTER_TEXT || null,

    colors: {
        primary: 0x5865f2,
        success: 0x57f287,
        danger: 0xed4245,
        warning: 0xfee75c,
        info: 0x5eb5f7,
        neutral: 0x4e5058
    },

    albums: {
        // The Deezer lookup is a third-party service; allow disabling it and
        // tune how many tracks a single /album may add to the queue.
        enabled: (process.env.ALBUM_SEARCH || "true").toLowerCase() !== "false",
        maxTracks: Math.max(1, Number.parseInt(process.env.ALBUM_MAX_TRACKS || "50", 10) || 50)
    },

    lavalink: {
        // Address and password of the Lavalink v4 server that does the audio
        // work. The bot never downloads or transcodes audio itself; it only
        // asks Lavalink to resolve and play tracks.
        host: process.env.LAVALINK_HOST || "127.0.0.1",
        port: Math.max(1, Number.parseInt(process.env.LAVALINK_PORT || "2333", 10) || 2333),
        password: process.env.LAVALINK_PASSWORD || "",
        secure: (process.env.LAVALINK_SECURE || "false").toLowerCase() === "true",
        name: process.env.LAVALINK_NAME || "main",

        // Lavalink and NodeLink expose the same v4 API but NodeLink needs its
        // own client class for voice and track handling.
        nodeType: process.env.LAVALINK_NODE_TYPE || "Lavalink",

        // Source Lavalink uses for plain text searches. YouTube Music
        // ("ytmsearch") gives better music results when the server has it
        // enabled; "ytsearch" is the safest default.
        search: process.env.LAVALINK_SEARCH || "ytsearch",

        // Volume new players start at, from 0 to 100.
        volume: Math.min(Math.max(Number.parseInt(process.env.LAVALINK_VOLUME || "100", 10) || 100, 0), 100)
    }
};
