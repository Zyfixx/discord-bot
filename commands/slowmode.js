const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { parseDuration, duration } = require("../utils/format");
const { embed, fail, requirePermission } = require("../utils/feedback");

const MAX = 21600;

module.exports = {
    group: "moderation",
    usage: "slowmode <duration> [channel]",

    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Sets the slowmode delay, or disables it with 0.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription("Delay like 10s, 2m, or 0 to disable (max 6h)")
                .setMaxLength(16)
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Channel to change")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia)
                .setRequired(false)
        ),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ManageChannels, "Manage Channels")) return;

        const requested = ctx.args[0];
        const ms = requested === undefined ? 0 : parseDuration(requested);

        if (ms === null) {
            return fail(ctx, "Bad duration", "Use something like `10s`, `2m`, `1h`, or `0` to turn slowmode off.");
        }

        const seconds = Math.round(ms / 1000);

        if (seconds < 0 || seconds > MAX) {
            return fail(ctx, "Out of range", `Slowmode can be between 0 and ${MAX / 3600} hours.`);
        }

        const target = await resolve.channel(ctx.client, ctx.args[1], ctx.guild);

        if (ctx.args[1] && !target) return fail(ctx, "Channel not found", "I could not find that channel.");
        if (target && typeof target.setRateLimitPerUser !== "function") {
            return fail(ctx, "Unsupported channel", "Slowmode only works in text, news, forum and media channels.");
        }

        const channel = target ?? ctx.channel;

        await channel.setRateLimitPerUser(seconds, `by ${ctx.author.tag}`).catch((error) => error);

        return ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: seconds === 0 ? "Slowmode disabled" : "Slowmode enabled",
                    description: seconds === 0
                        ? `Members can post freely in ${channel}.`
                        : `Members must wait **${duration(seconds * 1000)}** between messages in ${channel}.`,
                    fields: [
                        { name: "Channel", value: `${channel}`, inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true }
                    ]
                })
            ]
        });
    }
};
