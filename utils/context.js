const djs = require("discord.js");

function split(payload) {
    if (!payload) return {};
    const { ephemeral, ...rest } = payload;
    return rest;
}

function createContext({ client, raw, args, command, argString }) {
    const slash = typeof raw.isChatInputCommand === "function";
    const tokens = args ?? [];
    let sent = null;

    /**
     * Everything after the command name, as one string.
     *
     * Prefix commands are split on whitespace, so `ctx.args[0]` alone would
     * truncate "say hello there" to "hello". This keeps the spacing intact.
     */
    const text = () => {
        if (slash) return tokens.map((arg) => (arg ?? "").toString()).join(" ").trim();
        return (argString ?? tokens.join(" ")).trim();
    };

    /**
     * Free text starting at token `skip`, keeping inner spacing.
     *
     * `ctx.rest(1)` on `!ban @spammer being very rude today` returns
     * "being very rude today" rather than just the second word.
     */
    const rest = (skip = 0) => {
        if (slash) return tokens.slice(skip).map((arg) => (arg ?? "").toString()).join(" ").trim();
        if (skip <= 0) return text();

        const source = argString ?? tokens.join(" ");
        const pattern = new RegExp(`^(?:\\S+\\s+){${skip}}`);

        // Not enough tokens to skip, so there is nothing left to return.
        if (!pattern.test(source)) return "";

        return source.replace(pattern, "").trim();
    };

    const ctx = {
        client,
        raw,
        command,
        slash,
        args: tokens,
        text,
        rest,
        guild: raw.guild ?? null,
        channel: raw.channel,
        author: slash ? raw.user : raw.author,
        member: slash ? (raw.guild?.members?.cache?.get(raw.user.id) ?? null) : (raw.member ?? null),

        get permissions() {
            if (slash) return raw.memberPermissions ?? null;
            return raw.member?.permissions ?? null;
        },

        async respond(payload = {}) {
            const body = split(payload);

            if (slash) {
                if (raw.deferred || raw.replied) return raw.editReply(body);
                await raw.deferReply({ ephemeral: Boolean(payload.ephemeral) });
                return raw.editReply(body);
            }

            sent = await raw.channel.send(body);
            return sent;
        },

        async edit(payload = {}) {
            const body = split(payload);

            if (slash) {
                if (!raw.deferred && !raw.replied) return ctx.respond(payload);
                return raw.editReply(body);
            }

            if (!sent) return ctx.respond(payload);
            return sent.edit(body);
        },

        async follow(payload = {}) {
            const body = split(payload);

            if (slash) return raw.followUp({ ...body, ephemeral: Boolean(payload.ephemeral) });
            return raw.channel.send(body);
        },

        async awaitComponent({ time, filter } = {}) {
            if (slash) return raw.awaitMessageComponent({ time, filter });

            if (!sent) throw new Error("awaitComponent() requires respond() to be called first");

            return sent.awaitMessageComponent({
                time,
                filter: (i) =>
                    i.user.id === ctx.author.id &&
                    i.channelId === sent.channelId &&
                    (typeof filter === "function" ? filter(i) : true)
            });
        }
    };

    return ctx;
}

module.exports = { createContext };
