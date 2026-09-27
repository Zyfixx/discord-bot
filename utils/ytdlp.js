const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

function which(command) {
    for (const dir of (process.env.PATH || "").split(path.delimiter)) {
        if (!dir) continue;
        const candidate = path.join(dir, command);
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
        } catch {
            /* keep looking */
        }
    }
    return null;
}

function bundledBinary() {
    try {
        const entry = require.resolve("@distube/yt-dlp");
        return path.resolve(path.dirname(entry), "..", "bin", process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
    } catch {
        return null;
    }
}

/**
 * Verifying a yt-dlp zipapp is expensive: booting the Python interpreter and
 * unpacking the archive to read `--version` costs seconds. One probe is cached
 * per binary so playback only ever pays for it once per process.
 */
const probed = new Map();

function probe(binary) {
    if (!binary) return { ok: false, version: null, error: "no yt-dlp binary found" };

    const cached = probed.get(binary);
    if (cached) return cached;

    let result;

    if (!fs.existsSync(binary)) {
        result = { ok: false, version: null, error: `yt-dlp binary is missing at ${binary}` };
    } else {
        try {
            const out = spawnSync(binary, ["--version"], { timeout: 60000, encoding: "utf8" });
            const version = (out.stdout ?? "").trim();

            if (out.error) result = { ok: false, version: null, error: out.error.message };
            else if (out.status !== 0) result = { ok: false, version: null, error: `yt-dlp exited with code ${out.status}` };
            else if (!/\d/.test(version)) result = { ok: false, version: null, error: "yt-dlp produced no version" };
            else result = { ok: true, version, error: null };
        } catch (error) {
            result = { ok: false, version: null, error: error.message };
        }
    }

    probed.set(binary, result);
    return result;
}

/** Cached "can this binary run?" check. */
function runs(binary) {
    return probe(binary).ok;
}

/** Cached yt-dlp version string, or null when unknown. */
function ytDlpVersion() {
    return probe(activeBinary()).version;
}

/**
 * `@distube/yt-dlp` spawns its bundled `yt-dlp` file directly. That file is a
 * Python zipapp with a `#!/usr/bin/env python3` shebang, which cannot exec on
 * Termux/Android because `/usr/bin/env` does not exist there. When that is the
 * case we generate a tiny shell wrapper that calls the same zipapp through a
 * real python, and point the library at it.
 *
 * Must run before `require("distube")`, because the library reads these
 * environment variables once at import time.
 */
function setupYtDlp() {
    if (process.env.YTDLP_DIR) return { patched: false, reason: "YTDLP_DIR already set" };

    const binary = bundledBinary();

    if (runs(binary)) return { patched: false, reason: "bundled yt-dlp is executable" };

    const python = which("python3") || which("python");
    if (!python || !binary) {
        return { patched: false, reason: "no python interpreter available for the yt-dlp zipapp" };
    }

    const shell = which("sh");
    if (!shell) return { patched: false, reason: "no sh available to build a yt-dlp wrapper" };

    // yt-dlp needs a JS runtime for YouTube extraction; node is always present here.
    // The flag is added by runYtDlp() rather than baked in here, so that a native
    // yt-dlp binary (used in Docker, where Python is absent) gets it too.
    const node = which("node");

    const dir = path.join(os.tmpdir(), "distube-ytdlp");
    const wrapper = path.join(dir, "yt-dlp");

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(wrapper, `#!/bin/sh\nexec ${JSON.stringify(python)} ${JSON.stringify(binary)} "$@"\n`);
    fs.chmodSync(wrapper, 0o755);

    if (!runs(wrapper)) {
        return { patched: false, reason: `generated wrapper at ${wrapper} is not runnable` };
    }

    process.env.YTDLP_DIR = dir;
    process.env.YTDLP_FILENAME = "yt-dlp";

    return { patched: true, wrapper, python, jsRuntime: Boolean(node) };
}

/** Absolute path to the yt-dlp executable that @distube/yt-dlp will spawn. */
function activeBinary() {
    const dir = process.env.YTDLP_DIR;
    if (dir) return path.join(dir, process.env.YTDLP_FILENAME || "yt-dlp");
    return bundledBinary();
}

/**
 * Runs yt-dlp with the given arguments and resolves its stdout.
 *
 * We deliberately do not use the `json()` helper exported by @distube/yt-dlp:
 * it appends stderr into the same buffer it JSON.parses, so a single warning
 * (for example "Deprecated Feature: --no-call-home", which yt-dlp prints on
 * stderr) makes parsing throw. Keeping the streams separate is what makes
 * playback work at all.
 */
function runYtDlp(args, { timeout = 90000 } = {}) {
    const binary = activeBinary();
    const status = probe(binary);

    if (!status.ok) {
        return Promise.reject(new Error(`yt-dlp cannot run: ${status.error}. See YTDLP_DIR in utils/ytdlp.js.`));
    }

    // Recent yt-dlp refuses to extract YouTube without a JS runtime. The flag only
    // exists in newer builds, so it is gated on the probed version.
    const node = which("node");
    const major = Number.parseInt(String(status.version).split(".")[0], 10);
    const needsJsRuntime = node && Number.isFinite(major) && major >= 2025 && !args.includes("--js-runtimes");

    let finalArgs = needsJsRuntime ? ["--js-runtimes", `node:${node}`, ...args] : args;

    /**
     * Metadata lookups skip YouTube's player script.
     *
     * Solving that challenge in Node measured at about half of a full lookup,
     * and the stream URLs that came back were identical and decoded the same.
     * This is a second extractor argument, so a yt-dlp that does not recognise
     * it fails cleanly and the plain call is retried underneath.
     */
    const canSkipPlayerJs = !process.argv.join(" ").includes("yt-dlp") && process.env.YTDLP_SKIP_PLAYER_JS !== "0";
    const skipPlayerJs = canSkipPlayerJs && !args.some((arg) => arg.startsWith("youtube:player_skip"));

    if (skipPlayerJs) finalArgs = [...finalArgs, "--extractor-args", "youtube:player_skip=js"];

    const attempt = (commandArgs, retried) =>
        new Promise((resolve, reject) => {
            const child = spawn(binary, commandArgs, { stdio: ["ignore", "pipe", "pipe"] });
            let out = "";
            let err = "";

            const timer = setTimeout(() => {
                child.kill("SIGKILL");
                reject(new Error("yt-dlp timed out, try again in a moment"));
            }, timeout);

            child.stdout.on("data", (chunk) => { out += chunk; });
            child.stderr.on("data", (chunk) => { err += chunk; });
            child.on("error", (error) => { clearTimeout(timer); reject(error); });
            child.on("close", (code) => {
                clearTimeout(timer);

                if (code === 0) return resolve(out);

                const reason = (err || "").split("\n").find((line) => line.trim() && !line.startsWith("WARNING")) ?? "";

                if (skipPlayerJs && !retried) {
                    finalArgs = finalArgs.filter((arg) => arg !== "youtube:player_skip=js");
                    return attempt(finalArgs, true).then(resolve, reject);
                }

                reject(new Error(reason.trim() || `yt-dlp exited with code ${code}`));
            });
        });

    return attempt(finalArgs, false);
}

/** Resolves a URL's metadata as JSON. */
function dumpJson(query, extraArgs = [], options = {}) {
    return runYtDlp(["-J", "-q", "--no-warnings", ...extraArgs, query], options).then((out) => {
        try {
            return JSON.parse(out);
        } catch {
            throw new Error("Could not read yt-dlp's response for that link");
        }
    });
}

/** Resolves the direct audio stream URL for a page URL. */
function streamUrl(url, { timeout = 90000 } = {}) {
    return runYtDlp(
        ["-f", "bestaudio/best", "-g", "--no-warnings", "--no-playlist", "--no-part", url],
        { timeout }
    ).then((out) => {
        const line = out.split("\n").map((l) => l.trim()).find(Boolean);
        if (!line || !/^https?:\/\//i.test(line)) throw new Error("Could not get a playable stream for that link");
        return line;
    });
}

/**
 * Caches stream lookups by page URL.
 *
 * Most songs get their stream URL from the metadata response and never reach
 * this function. It matters for flat playlist entries, which carry no format
 * data, and for a song that is re-added or repeated: without this, each replay
 * would pay another full yt-dlp round trip. Failures are never cached.
 */
const STREAM_TTL = 5 * 60 * 1000;
const MAX_INFLIGHT = 4;

const streamCache = new Map();
const waiting = [];
let inflight = 0;

function withLimit(task) {
    return new Promise((resolve, reject) => {
        const run = () => {
            inflight += 1;
            task().then(resolve, reject).finally(() => {
                inflight -= 1;
                waiting.shift()?.();
            });
        };

        if (inflight < MAX_INFLIGHT) run();
        else waiting.push(run);
    });
}

function streamUrlOnce(url, options) {
    const hit = streamCache.get(url);
    if (hit && Date.now() - hit.at < STREAM_TTL) return hit.promise;

    const promise = withLimit(() => streamUrl(url, options));
    streamCache.set(url, { promise, at: Date.now() });

    // Swallow the rejection here so a failed prefetch can never surface as an
    // unhandled rejection; the real caller still sees the original error.
    promise.catch(() => streamCache.delete(url));

    return promise;
}

/** True when a stream URL for this page is already resolved and still fresh. */
function hasKnownStream(url) {
    return streamCache.has(url);
}

module.exports = {
    setupYtDlp,
    which,
    runs,
    probe,
    ytDlpVersion,
    bundledBinary,
    activeBinary,
    runYtDlp,
    dumpJson,
    streamUrl,
    streamUrlOnce,
    hasKnownStream
};
