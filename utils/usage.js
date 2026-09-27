/**
 * Renders the usage information shown by /help.
 *
 * The argument reference is derived from each command's slash definition rather
 * than written by hand, so it cannot drift away from the options the command
 * actually accepts. Commands can still add hand written `examples`, which are
 * the part that cannot be derived.
 */

const { ApplicationCommandOptionType: OptionType, ChannelType } = require("discord.js");
const config = require("../config");

const MAX_FIELD = 1024;

const TYPE_LABELS = {
    [OptionType.String]: "text",
    [OptionType.Integer]: "whole number",
    [OptionType.Number]: "number",
    [OptionType.Boolean]: "yes/no",
    [OptionType.User]: "user",
    [OptionType.Channel]: "channel",
    [OptionType.Role]: "role",
    [OptionType.Mentionable]: "user or role",
    [OptionType.Attachment]: "file"
};

const CHANNEL_LABELS = {
    [ChannelType.GuildText]: "text",
    [ChannelType.GuildVoice]: "voice",
    [ChannelType.GuildCategory]: "category",
    [ChannelType.GuildAnnouncement]: "announcement",
    [ChannelType.GuildStageVoice]: "stage",
    [ChannelType.PublicThread]: "thread",
    [ChannelType.PrivateThread]: "thread",
    [ChannelType.GuildForum]: "forum",
    [ChannelType.GuildMedia]: "media"
};

function clamp(value, limit = MAX_FIELD) {
    const text = String(value ?? "");
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function limitsOf(option) {
    if (option.min_value != null && option.max_value != null) return `${option.min_value}–${option.max_value}`;
    if (option.min_value != null) return `min ${option.min_value}`;
    if (option.max_value != null) return `max ${option.max_value}`;
    if (option.min_length != null && option.max_length != null) return `${option.min_length}–${option.max_length} chars`;
    if (option.max_length != null) return `max ${option.max_length} chars`;
    return null;
}

/** One option rendered as a labelled line, with its limits and choices. */
function describeOption(option) {
    const header = [`\`${option.name}\``, TYPE_LABELS[option.type] ?? "value"];

    if (option.channel_types?.length) {
        const kinds = [...new Set(option.channel_types.map((type) => CHANNEL_LABELS[type]).filter(Boolean))];
        if (kinds.length) header.push(kinds.join("/"));
    }

    header.push(option.required ? "required" : "optional");

    const limits = limitsOf(option);
    if (limits) header.push(limits);

    let line = clamp(header.join(" · "), 300);
    if (option.description) line += `\n${clamp(option.description, 400)}`;

    if (option.choices?.length) {
        const choices = option.choices.map((choice) => `\`${clamp(choice.name, 60)}\``).join(", ");
        line += `\nChoices: ${clamp(choices, 300)}`;
    }

    return line;
}

/** The argument reference for a command, or null when it takes no options. */
function buildArguments(command) {
    const options = command.data.options ?? [];
    if (!options.length) return null;

    const required = options.filter((option) => option.required).map((option) => `\`${option.name}\``);
    const heading = required.length ? `Required: ${required.join(", ")}` : "Everything is optional.";

    return clamp([heading, "", ...options.map(describeOption)].join("\n"));
}

/** Both invocation styles, since every command accepts a prefix and a slash. */
function buildUsage(command) {
    const options = command.data.options ?? [];
    const prefix = `${config.prefix}${command.usage}`;

    const required = options.filter((option) => option.required).map((option) => `${option.name}:…`);
    const optional = options
        .filter((option) => !option.required)
        .map((option) => `${option.name}:…`);

    const slash = [`/${command.data.name}`, ...required].join(" ");
    const lines = [`\`${prefix}\``, `\`${slash}\``];

    if (optional.length) lines.push(`optional: ${optional.map((name) => `\`${name}\``).join(" ")}`);

    return clamp(lines.join("\n"), 500);}

/**
 * Hand written examples. They are given without a leading prefix so the
 * configured one is used, except where a slash form is being shown.
 */
function buildExamples(command) {
    if (!command.examples?.length) return null;

    return clamp(
        command.examples
            .map((example) => `\`${example.startsWith("/") ? example : config.prefix + example}\``)
            .join("\n"),
        MAX_FIELD
    );
}

module.exports = { buildUsage, buildArguments, buildExamples, describeOption, clamp };
