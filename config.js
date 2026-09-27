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

    // Optional. Without these the Spotify plugin falls back to scraping public
    // metadata, which works but caps playlists and albums at 100 tracks.
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || null,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || null,
        topTracksCountry: process.env.SPOTIFY_TOP_TRACKS_COUNTRY || "US"
    },

    colors: {
        primary: 0x5865f2,
        success: 0x57f287,
        danger: 0xed4245,
        warning: 0xfee75c,
        info: 0x5eb5f7,
        neutral: 0x4e5058
    }
};
