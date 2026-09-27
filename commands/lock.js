const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { confirm, cancelled } = require("../utils/confirm");
const { embed, fail, requirePermission } = require("../utils/feedback");

const LOCKABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia];

module.exports = {
    group: "moderation",
    usage: "lock <lock|unlock> [channel] [reason]",
    examples: [
        "lock",
        "lock unlock",
        "lock lock #general spoilers"
    ],

    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Locks or unlocks a channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("What to do")
                .setRequired(true)
                .addChoices({ name: "lock", value: "lock" }, { name: "unlock", value: "unlock" })
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Channel to change")
                .addChannelTypes(...LOCKABLE)
                .setRequired(false)
        )
        .addStringOption((option) => option.setName("reason").setDescription("Why").setMaxLength(256)),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ManageChannels, "Manage Channels")) return;

        const action = ctx.args[0]?.toString().toLowerCase();

        if (action !== "lock" && action !== "unlock") {
            return fail(ctx, "Pick an action", "Use `lock` or `unlock`.");
        }

        const target = await resolve.channel(ctx.client, ctx.args[1], ctx.guild);

        if (ctx.args[1] && !target) return fail(ctx, "Channel not found", "I could not find that channel.");
        if (target && !LOCKABLE.includes(target.type)) {
            return fail(ctx, "Unsupported channel", "I can only lock text, news, forum and media channels.");
        }

        const channel = target ?? ctx.channel;
        const reason = ctx.rest(2) || "No reason provided";
        const locking = action === "lock";

        if (locking) {
            const { confirmed, timedOut } = await confirm(ctx, {
                title: `Lock ${channel}?`,
                description: `**@everyone** will no longer be able to send messages in ${channel}.`,
                fields: [{ name: "Reason", value: reason }],
                confirmLabel: "Lock"
            });

            if (timedOut) return;
            if (!confirmed) return cancelled(ctx, "Lock cancelled");
        }

        await channel.permissionOverwrites
            .edit(
                ctx.guild.roles.everyone,
                { SendMessages: !locking, SendMessagesInThreads: !locking, AddReactions: !locking },
                { reason: `${locking ? "Lock" : "Unlock"} by ${ctx.author.tag}: ${reason}` }
            )
            .catch((error) => error);

        return ctx.edit({
            embeds: [
                embed({
                    color: locking ? config.colors.danger : config.colors.success,
                    title: locking ? "Channel locked" : "Channel unlocked",
                    description: locking
                        ? `${channel} is now locked.`
                        : `${channel} is open again.`,
                    fields: [
                        { name: "Channel", value: `${channel}`, inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ],
            components: []
        });
    }
};
