const djs = require("discord.js");
const { getDistube } = require("./utils/music");

const client = new djs.Client({
    intents: [djs.GatewayIntentBits.Guilds, djs.GatewayIntentBits.GuildVoiceStates]
});
const distube = getDistube(client);

console.log("registered plugins (in order):");
for (const p of distube.plugins) console.log("   ", p.constructor.name, "(" + p.type + ")");

async function full(label, input) {
    console.log("\n=== " + label + " ===");
    console.log("  input:", input);
    try {
        const resolved = await distube.handler.resolve(input);
        const isList = Array.isArray(resolved.songs);
        const first = isList ? resolved.songs[0] : resolved;
        console.log("  type      :", isList ? "Playlist" : "Song");
        console.log("  source    :", resolved.source);
        console.log("  name      :", first.name);
        console.log("  artist    :", first.uploader?.name);
        console.log("  duration  :", first.formattedDuration);
        console.log("  songs     :", isList ? resolved.songs.length : 1);

        // This is the real handoff: info-extractor -> search extractor -> stream
        const playable = isList ? resolved.songs[0] : resolved;
        await distube.handler.attachStreamInfo(playable);
        const target = playable.stream.playFromSource ? playable : playable.stream.song;

        console.log("  matched YT:", target?.name);
        console.log("  YT url    :", target?.url);
        console.log("  dur match :", playable.formattedDuration, "vs", target?.formattedDuration);
        return { ok: true, matched: target?.name, yt: target?.url };
    } catch (error) {
        console.log("  FAILED    :", error.errorCode || error.name, "-", error.message);
        return { ok: false, code: error.errorCode || error.name };
    }
}

(async () => {
    const results = [];

    results.push(await full("Spotify track", "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"));
    results.push(await full("Spotify track (mobile share link)", "https://spotify.link/abc123"));

    // Regression: the YouTube paths must still work with Spotify registered.
    results.push(await full("YouTube link (regression)", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
    results.push(await full("Plain search (regression)", "titik nadir"));

    console.log("\n================ SUMMARY ================");
    for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + (r.matched || r.code || r.yt));
})();
