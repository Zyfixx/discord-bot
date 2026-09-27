const djs = require("discord.js");
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { confirm, cancelled } = require("../utils/confirm");
const { embed, fail, requirePermission } = require("../utils/feedback");

const FILTER_HELP = "Filters: `bots`, `humans`, `links`, or `contains:<text>` (combine with `+`, e.g. `bots+contains:spam`).";

module.exports = {
    group: "moderation",
    usage: "clear [amount] [filters]",

    data: new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Bulk deletes recent messages.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("How many messages to delete (1-100)")
                .setMinValue(1)
                .setMaxValue(config.purgeLimit)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option.setName("filters").setDescription("Only delete matching messages").setMaxLength(100)
        ),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ManageMessages, "Manage Messages")) return;
        if (!ctx.channel.bulkDelete) {
            return fail(ctx, "Unsupported channel", "I can only bulk delete in text channels.");
        }

        const amount = Math.min(Math.max(Number(ctx.args[0]) || 10, 1), config.purgeLimit);
        const rawFilters = ctx.rest(1).toLowerCase();
        const wantsBots = rawFilters.includes("bots");
        const wantsHumans = rawFilters.includes("humans");
        const wantsLinks = rawFilters.includes("links");
        const contains = rawFilters.match(/contains:([^+\s]+)/)?.[1]?.toLowerCase() ?? null;
        const LINK = /https?:\/\/\S+/i;

        const fetched = await ctx.channel.messages.fetch({ limit: amount }).catch(() => null);

        if (!fetched) return fail(ctx, "Could not read messages", "I can't fetch messages in this channel.");

        const targets = [...fetched.values()].filter((message) => {
            if (wantsBots && !message.author.bot) return false;
            if (wantsHumans && message.author.bot) return false;
            if (wantsLinks && !LINK.test(message.content)) return false;
            if (contains && !message.content.toLowerCase().includes(contains)) return false;
            return true;
        });

        if (!targets.length) {
            return fail(ctx, "Nothing matched", `No messages matched in the last ${amount}.`);
        }

        const { confirmed, timedOut } = await confirm(ctx, {
            title: `Delete ${targets.length} message${targets.length === 1 ? "" : "s"}?`,
            description: `This cannot be undone. Messages older than two weeks are skipped automatically.`,
            fields: [
                { name: "Requested", value: `${amount}`, inline: true },
                { name: "Matching", value: `${targets.length}`, inline: true },
                { name: "Filters", value: rawFilters || "none", inline: true }
            ],
            confirmLabel: "Delete"
        });

        if (timedOut) return;
        if (!confirmed) return cancelled(ctx, "Clear cancelled");

        const deleted = await ctx.channel.bulkDelete(targets, true).catch((error) => error);

        if (deleted instanceof Error) {
            return ctx.edit({
                embeds: [
                    embed({
                        color: config.colors.danger,
                        title: "Could not delete",
                        description: deleted.message,
                        timestamp: false
                    })
                ],
                components: []
            });
        }

        return ctx.edit({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Messages deleted",
                    description: `Removed **${deleted.size}** of **${targets.length}** matched messages.`,
                    fields: [
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Channel", value: `${ctx.channel}`, inline: true }
                    ]
                })
            ],
            components: []
        });
    }
};
