const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { confirm, cancelled } = require("../utils/confirm");
const { embed, fail, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "moderation",
    usage: "ban <user> [reason] [days]",
    examples: [
        "ban @spammer",
        "ban @spammer raiding 3"
    ],
    help: "For prefix commands the reason keeps its spaces and `days` goes **last**: `!ban @user spamming everywhere 3`.",

    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bans a user from the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption((option) => option.setName("user").setDescription("User to ban").setRequired(true))
        .addStringOption((option) => option.setName("reason").setDescription("Why").setMaxLength(512))
        .addIntegerOption((option) =>
            option
                .setName("days")
                .setDescription("Delete the user's recent messages (0-7 days)")
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        ),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.BanMembers, "Ban Members")) return;

        const target = await resolve.user(ctx.client, ctx.args[0], ctx.guild);

        if (!target) return fail(ctx, "User not found", "I could not find that user.");
        if (target.id === ctx.guild.ownerId) return fail(ctx, "Can't do that", "I can't ban the server owner.");
        if (target.id === ctx.author.id) return fail(ctx, "Can't do that", "You can't ban yourself.");
        if (target.id === ctx.client.user.id) return fail(ctx, "Can't do that", "I can't ban myself.");

        // `ban <user> [reason] [days]` puts free text before a number. Slash
        // commands label both options; for prefix commands a trailing number
        // is the deletion window and the rest is the reason.
        let days;
        let reason;

        if (ctx.slash) {
            reason = ctx.args[1]?.toString().trim() ?? "";
            days = Number(ctx.args[2]) || 0;
        } else {
            reason = ctx.rest(1);
            days = 0;

            const tail = String(ctx.args[ctx.args.length - 1] ?? "");

            if (ctx.args.length > 2 && /^\d+(?:\.\d+)?$/.test(tail)) {
                days = Number(tail);
                reason = reason.replace(/\s*\S+\s*$/, "").trim();
            }
        }

        if (!reason) reason = "No reason provided";
        days = Math.min(Math.max(days || 0, 0), 7);

        const member = await resolve.member(ctx, target.id);

        if (member && !member.bannable) {
            return fail(ctx, "Can't do that", `I can't ban ${target.username} — their role is above mine.`);
        }

        const existing = await ctx.guild.bans.fetch(target.id).then(() => true).catch(() => false);

        if (existing) return fail(ctx, "Already banned", `${target.tag} is already banned from this server.`);

        const { confirmed, timedOut } = await confirm(ctx, {
            title: `Ban ${target.tag}?`,
            description: `${target.tag} will not be able to rejoin **${ctx.guild.name}**.`,
            fields: [
                { name: "User", value: `${target.tag}\n${target.id}`, inline: true },
                { name: "Delete messages", value: days === 0 ? "No" : `Last ${days} day${days === 1 ? "" : "s"}`, inline: true },
                { name: "Reason", value: reason, inline: false }
            ],
            confirmLabel: "Ban"
        });

        if (timedOut) return;
        if (!confirmed) return cancelled(ctx, "Ban cancelled");

        await ctx.guild.members
            .ban(target.id, { reason: `${reason} | by ${ctx.author.tag}`, deleteMessageSeconds: days * 86400 })
            .catch((error) =>
                ctx.edit({
                    embeds: [
                        embed({ color: config.colors.danger, title: "Could not ban", description: error.message, timestamp: false })
                    ],
                    components: []
                })
            );

        return ctx.edit({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "User banned",
                    fields: [
                        { name: "User", value: `${target.tag}`, inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Messages deleted", value: days === 0 ? "No" : `Last ${days} day${days === 1 ? "" : "s"}`, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ],
            components: []
        });
    }
};
