const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { commands } = require("../handlers/commandHandler");
const { embed, fail, respond } = require("../utils/feedback");

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
            const options = data.options?.length
                ? data.options
                      .map((o) => `\`${o.name}\` — ${o.description} (${o.type === 6 ? "user" : o.type === 7 ? "channel" : o.type === 3 ? "text" : "number"}${o.required ? "" : ", optional"})`)
                      .join("\n")
                : null;

            return respond(ctx, {
                title: `/${data.name}`,
                description: command.help ? `${data.description}\n${command.help}` : data.description,
                fields: [
                    { name: "Category", value: GROUP_LABELS[command.group] ?? "General", inline: true },
                    { name: "Prefix", value: `\`${config.prefix}${data.name}\``, inline: true },
                    ...(options ? [{ name: "Options", value: options }] : [])
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
                value: sorted
                    .map((c) => `\`/${c.data.name}\` — ${c.data.description}`)
                    .join("\n")
            });
        }

        return respond(ctx, {
            color: config.colors.info,
            title: "Command list",
            description: `${total} commands • prefix \`${config.prefix}\` • every command works with both \`/name\` and \`${config.prefix}name\``,
            fields
        });
    }
};
