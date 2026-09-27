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

function runs(binary) {
    if (!binary || !fs.existsSync(binary)) return false;
    try {
        const result = spawnSync(binary, ["--version"], { timeout: 20000, encoding: "utf8" });
        return result.status === 0 && /\d/.test(result.stdout ?? "");
    } catch {
        return false;
    }
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
    const node = which("node");
    const jsFlag = node ? ` --js-runtimes node:${node}` : "";

    const dir = path.join(os.tmpdir(), "distube-ytdlp");
    const wrapper = path.join(dir, "yt-dlp");

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(wrapper, `#!/bin/sh\nexec ${JSON.stringify(python)} ${JSON.stringify(binary)}${jsFlag} "$@"\n`);
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
    if (!runs(binary)) {
        return Promise.reject(new Error("yt-dlp is not runnable; call setupYtDlp() before loading distube"));
    }

    return new Promise((resolve, reject) => {
        const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
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
            if (code !== 0) {
                const reason = (err || "").split("\n").find((line) => line.trim() && !line.startsWith("WARNING")) ?? "";
                return reject(new Error(reason.trim() || `yt-dlp exited with code ${code}`));
            }
            resolve(out);
        });
    });
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

module.exports = { setupYtDlp, which, runs, bundledBinary, activeBinary, runYtDlp, dumpJson, streamUrl };
