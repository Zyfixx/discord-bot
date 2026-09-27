const { setupYtDlp } = require("./utils/ytdlp");
const ytdlp = setupYtDlp();

const djs = require("discord.js");
const config = require("./config");
const { register, deploy, commands } = require("./handlers/commandHandler");

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
    console.log(`yt-dlp: ${ytdlp.patched ? `patched via ${ytdlp.wrapper}` : ytdlp.reason}`);
    await deploy(readyClient);
});

client.login(process.env.TOKEN);
