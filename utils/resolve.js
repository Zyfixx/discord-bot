const djs = require("discord.js");

const USER_MENTION = /^<@!?(\d+)>$/;
const CHANNEL_MENTION = /^<#(\d+)>$/;
const ROLE_MENTION = /^<@&(\d+)>$/;
const SNOWFLAKE = /^\d{15,22}$/;

async function user(client, value, guild = null) {
    if (!value) return null;
    if (value instanceof djs.User) return value;
    if (value instanceof djs.GuildMember) return value.user;

    const id = String(value).match(USER_MENTION)?.[1] ?? String(value).match(SNOWFLAKE)?.[1];
    if (id) return client.users.fetch(id).catch(() => null);

    if (guild) {
        const name = String(value).replace(/^@/, "").trim();
        if (!name) return null;

        const cached = guild.members.cache.find(
            (member) => member.displayName === name || member.user.username === name || member.user.tag === name
        );
        if (cached) return cached.user;

        const found = await guild.members
            .fetch({ query: name.slice(0, 32), limit: 1 })
            .catch(() => null);

        return found?.first?.()?.user ?? null;
    }

    return null;
}

async function member(ctx, value) {
    if (!value) return null;
    if (value instanceof djs.GuildMember) return value;
    if (!ctx.guild) return null;

    const found = await user(ctx.client, value, ctx.guild);
    if (!found) return null;

    return ctx.guild.members.fetch(found.id).catch(() => null);
}

async function channel(client, value, guild = null) {
    if (!value) return null;
    if (value instanceof djs.Channel) return value;
    if (value instanceof djs.GuildChannel) return value;

    const id = String(value).match(CHANNEL_MENTION)?.[1] ?? String(value).match(SNOWFLAKE)?.[1];
    if (id) return client.channels.fetch(id).catch(() => null);

    if (guild) {
        const name = String(value).replace(/^#/, "").trim().toLowerCase();
        return guild.channels.cache.find((c) => c.name.toLowerCase() === name) ?? null;
    }

    return null;
}

async function role(client, value, guild = null) {
    if (!value) return null;
    if (value instanceof djs.Role) return value;

    const id = String(value).match(ROLE_MENTION)?.[1] ?? String(value).match(SNOWFLAKE)?.[1];
    if (id && guild) return guild.roles.cache.find((r) => r.id === id) ?? null;

    if (guild) {
        const name = String(value).replace(/^@/, "").trim().toLowerCase();
        return guild.roles.cache.find((r) => r.name.toLowerCase() === name && !r.managed) ?? null;
    }

    return null;
}

module.exports = { user, member, channel, role };
