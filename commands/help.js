const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { commands } = require("../handlers/commandHandler");
const { embed, fail, respond } = require("../utils/feedback");
const { buildUsage, buildArguments, buildExamples, clamp } = require("../utils/usage");

const GROUP_LABELS = {
    utility: "Utility",
    moderation: "Moderation",
    fun: "Fun",
    music: "Music"
};

/**
 * Lets `help server info` or `help now playing` find a command when the whole
 * phrase is not a literal command name.
 */
function fuzzyMatch(query) {
    const words = query.split(/\s+/).filter(Boolean);
    const matches = [...commands.values()].filter(({ data }) => {
        const haystack = `${data.name} ${data.description}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
    });

    if (matches.length === 1) return matches[0];
    return matches.length > 1 ? matches : null;
}

module.exports = {
    group: "utility",
    usage: "help [command]",
    examples: [
        "help",
        "help play",
        "help server info"
    ],

    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Shows every command, or details for one command.")
        .addStringOption((option) =>
            option.setName("command").setDescription("Command name").setMaxLength(32)
        ),

    async execute(ctx) {
        const query = ctx.text().toLowerCase().replace(/^\//, "");

        if (query) {
            const command = commands.get(query) ?? fuzzyMatch(query);

            if (Array.isArray(command)) {
                return respond(ctx, {
                    title: "Several commands match",
                    description: `More than one command matches \`${query}\`.`,
                    fields: command
                        .slice(0, 10)
                        .map((c) => ({ name: `/${c.data.name}`, value: c.data.description, inline: true }))
                });
            }

            if (!command) return fail(ctx, "Unknown command", `There is no command called \`${query}\`.`);

            const { data } = command;
            const usage = buildUsage(command);
            const args = buildArguments(command);
            const examples = buildExamples(command);

            return respond(ctx, {
                title: `/${data.name}`,
                description: command.help ? `${data.description}\n${command.help}` : data.description,
                fields: [
                    { name: "Usage", value: usage, inline: false },
                    ...(args ? [{ name: "Arguments", value: args, inline: false }] : []),
                    ...(examples ? [{ name: "Examples", value: examples, inline: false }] : []),
                    { name: "Category", value: GROUP_LABELS[command.group] ?? "General", inline: true },
                    { name: "Cooldown", value: command.cooldown ? `${command.cooldown}s` : "None", inline: true }
                ]
            });
        }

        const groups = new Map();

        for (const command of commands.values()) {
            const key = command.group ?? "utility";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(command);
        }

        const total = commands.size;
        const fields = [];

        for (const [group, list] of groups) {
            const sorted = [...list].sort((a, b) => a.data.name.localeCompare(b.data.name));

            fields.push({
                name: `${GROUP_LABELS[group] ?? group} (${sorted.length})`,
                value: clamp(
                    sorted
                        .map((c) => {
                            const required = (c.data.options ?? []).some((option) => option.required);
                            return `\`/${c.data.name}\`${required ? " ✱" : ""} — ${c.data.description}`;
                        })
                        .join("\n")
                )
            });
        }

        return respond(ctx, {
            color: config.colors.info,
            title: "Command list",
            description: [
                `${total} commands • prefix \`${config.prefix}\``,
                "Every command works as `/name` or with the prefix.",
                "✱ marks commands that need at least one argument.",
                "Run `/help <command>` for arguments and examples."
            ].join("\n"),
            fields
        });
    }
};
