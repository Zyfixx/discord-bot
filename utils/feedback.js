const djs = require("discord.js");
const config = require("../config");

function embed({
    title,
    description,
    fields,
    color = config.colors.primary,
    thumbnail,
    image,
    author,
    url,
    footer = true,
    timestamp = true
} = {}) {
    const built = new djs.EmbedBuilder().setColor(color);

    if (title) built.setTitle(truncateTitle(title));
    if (description) built.setDescription(description);
    if (url) built.setURL(url);
    if (author) built.setAuthor(author);
    if (thumbnail) built.setThumbnail(thumbnail);
    if (image) built.setImage(image);
    if (fields?.length) built.addFields(fields.filter(Boolean).slice(0, 25));

    const footerText = footer === true ? config.footer : footer;
    if (footerText) built.setFooter({ text: truncateTitle(footerText) });

    if (timestamp) built.setTimestamp();

    return built;
}

function truncateTitle(title) {
    const value = String(title);
    return value.length > 256 ? `${value.slice(0, 255)}…` : value;
}

const respond = (ctx, options) => ctx.respond({ embeds: [embed(options)] });

const done = (ctx, options) => respond(ctx, { color: config.colors.success, ...options });
const info = (ctx, options) => respond(ctx, { color: config.colors.info, ...options });
const warn = (ctx, options) => respond(ctx, { color: config.colors.warning, ...options });

function fail(ctx, title, description) {
    return respond(ctx, { color: config.colors.danger, title: `✗ ${title}`, description, timestamp: false });
}

function denied(ctx, label) {
    return fail(ctx, "Missing permission", `You need the **${label}** permission to do that.`);
}

function botDenied(ctx, label) {
    return fail(ctx, "I'm missing permission", `I need the **${label}** permission to do that.`);
}

function notGuild(ctx) {
    return fail(ctx, "Server only", "This command only works inside a server.");
}

function requireGuild(ctx) {
    if (ctx.guild) return true;
    notGuild(ctx);
    return false;
}

function requirePermission(ctx, flag, label) {
    if (!requireGuild(ctx)) return false;

    if (!ctx.permissions?.has(flag)) {
        denied(ctx, label);
        return false;
    }

    if (!ctx.guild.members.me?.permissions.has(flag)) {
        botDenied(ctx, label);
        return false;
    }

    return true;
}

module.exports = {
    embed,
    respond,
    done,
    info,
    warn,
    fail,
    denied,
    botDenied,
    notGuild,
    requireGuild,
    requirePermission
};
