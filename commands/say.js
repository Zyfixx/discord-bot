const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { truncate } = require("../utils/format");
const { embed, fail, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "say <text> [channel]",
    examples: [
        "say hello there",
        "say hello there #general"
    ],
    help: "For prefix commands the channel goes **last**: `!say good morning #general`. The rest is sent as the message.",

    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Makes the bot say something.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption((option) =>
            option.setName("text").setDescription("What to say").setMaxLength(2000).setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Where to send it")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        ),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ManageMessages, "Manage Messages")) return;

        // `say <text> [channel]`: slash commands label both options; for
        // prefix commands a trailing channel reference is the destination
        // and everything before it is the message.
        let text;
        let channelArg;

        if (ctx.slash) {
            text = ctx.args[0]?.toString().trim() ?? "";
            channelArg = ctx.args[1];
        } else {
            text = ctx.text();
            channelArg = undefined;

            const tail = String(ctx.args[ctx.args.length - 1] ?? "");

            if (ctx.args.length > 1 && /^(?:<#\d+>|#[\w-]{1,100}|\d{15,22})$/.test(tail)) {
                channelArg = tail;
                text = text.replace(/\s*\S+\s*$/, "").trim();
            }
        }

        if (!text) return fail(ctx, "Nothing to say", "Give me some text to send.");

        const target = await resolve.channel(ctx.client, channelArg, ctx.guild);

        if (channelArg && !target) return fail(ctx, "Channel not found", "I could not find that channel.");

        if (target && !target.isTextBased()) {
            return fail(ctx, "Not a text channel", "I can only send messages in text channels.");
        }

        if (target?.permissionOverwrites?.for(ctx.guild.members.me)?.has(PermissionFlagsBits.SendMessages) === false) {
            return fail(ctx, "No access", `I can't send messages in ${target}.`);
        }

        const destination = target ?? ctx.channel;
        const sent = await destination.send({ content: truncate(text, 2000) }).catch((error) => error);

        if (sent instanceof Error) return fail(ctx, "Could not send", sent.message);

        if (destination.id === ctx.channel.id) {
            return ctx.respond({
                embeds: [embed({ color: config.colors.success, description: "Sent." })]
            });
        }

        return ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    description: `Sent to ${destination}.`,
                    fields: [{ name: "Message", value: truncate(text, 1024) }]
                })
            ]
        });
    }
};
