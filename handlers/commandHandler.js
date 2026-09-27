const fs = require("node:fs");
const path = require("node:path");
const djs = require("discord.js");
const config = require("../config");
const { createContext } = require("../utils/context");
const { embed } = require("../utils/feedback");

const COMMANDS_DIR = path.join(__dirname, "..", "commands");
const commands = new Map();

function isEnabled(command) {
    if (command.group && config.groups[command.group] === false) return false;
    if (config.disabled.includes(command.data.name)) return false;
    return true;
}

function load() {
    commands.clear();

    for (const file of fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"))) {
        const command = require(path.join(COMMANDS_DIR, file));

        if (!command.data || typeof command.execute !== "function") {
            console.warn(`Skipped ${file}: command must export "data" and "execute".`);
            continue;
        }

        if (!isEnabled(command)) {
            console.log(`Skipped /${command.data.name} (disabled in config).`);
            continue;
        }

        commands.set(command.data.name, command);
    }

    return commands;
}

function optionArgs(interaction) {
    return interaction.options.data
        .filter((option) => option.type !== djs.ApplicationCommandOptionType.Subcommand)
        .map((option) => option.value);
}

async function deploy(client) {
    const body = [...commands.values()].map((command) => command.data.toJSON());
    const rest = new djs.REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        console.log("Started refreshing application (/) commands.");
        await rest.put(djs.Routes.applicationCommands(client.user.id), { body });
        console.log(`Successfully registered: ${body.map((c) => `/${c.name}`).join(", ")}`);
    } catch (error) {
        console.error("Failed to register slash commands:", error);
    }
}

async function run(command, ctx) {
    try {
        await command.execute(ctx);
    } catch (error) {
        console.error(`Command /${command.data.name} failed:`, error);

        const payload = {
            embeds: [
                embed({
                    color: config.colors.danger,
                    title: "Something went wrong",
                    description: `\`${error.message}\``,
                    timestamp: false
                })
            ],
            ephemeral: true
        };

        if (ctx.slash && (ctx.raw.replied || ctx.raw.deferred)) return ctx.follow(payload);
        return ctx.respond(payload);
    }
}

function register(client) {
    load();

    for (const command of commands.values()) {
        for (const [event, handler] of Object.entries(command.events ?? {})) {
            client.on(event, (...args) => handler(client, ...args));
        }
    }

    client.on(djs.Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = commands.get(interaction.commandName);
        if (!command) return;

        await run(
            command,
            createContext({ client, raw: interaction, args: optionArgs(interaction), command })
        );
    });

    client.on(djs.Events.MessageCreate, async (message) => {
        if (message.author.bot || !message.content.startsWith(config.prefix)) return;

        const body = message.content.slice(config.prefix.length).trim();
        if (!body) return;

        const [name, ...args] = body.split(/ +/);
        const command = commands.get(name.toLowerCase());
        if (!command) return;

        // Keep the untouched remainder so commands can read multi word text
        // ("say hello there") with its original spacing intact.
        const argString = body.slice(name.length).trim();

        await run(command, createContext({ client, raw: message, args, argString, command }));
    });
}

module.exports = { register, deploy, load, commands, config };
