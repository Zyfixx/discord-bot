const djs = require("discord.js");
const config = require("./config");
const { describeLavalink, initMusic } = require("./utils/music");
const { register, deploy, commands } = require("./handlers/commandHandler");

// Printed before login so the audio backend is visible even if login fails.
console.log(describeLavalink());

// lavalink-client throws from an async socket listener when a node is not a
// working v4 server, which would otherwise take the whole bot down.
process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);

    if (message.startsWith("Lavalink Node (") && message.includes("does not provide any /")) {
        console.error(`[lavalink] ${message}`);
        return;
    }

    throw reason;
});

const client = new djs.Client({
    intents: [
        djs.GatewayIntentBits.Guilds,
        djs.GatewayIntentBits.GuildMessages,
        djs.GatewayIntentBits.DirectMessages,
        djs.GatewayIntentBits.MessageContent,
        djs.GatewayIntentBits.GuildVoiceStates
    ]
});

register(client);

client.once(djs.Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Prefix "${config.prefix}" • ${commands.size} commands loaded`);
    console.log(`Groups: ${Object.entries(config.groups).filter(([, on]) => on).map(([g]) => g).join(", ") || "none"}`);
    initMusic(readyClient);
    await deploy(readyClient);
});

client.login(process.env.TOKEN);
