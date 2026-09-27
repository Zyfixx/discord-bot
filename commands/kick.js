const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { confirm, cancelled } = require("../utils/confirm");
const { embed, fail, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "moderation",
    usage: "kick <user> [reason]",

    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kicks a member from the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption((option) => option.setName("user").setDescription("Member to kick").setRequired(true))
        .addStringOption((option) => option.setName("reason").setDescription("Why").setMaxLength(512)),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.KickMembers, "Kick Members")) return;

        const target = await resolve.member(ctx, ctx.args[0]);

        if (!target) return fail(ctx, "Member not found", "That member isn't in this server, or I couldn't find them.");
        if (target.id === ctx.guild.ownerId) return fail(ctx, "Can't do that", "I can't kick the server owner.");
        if (target.id === ctx.author.id) return fail(ctx, "Can't do that", "You can't kick yourself.");
        if (!target.kickable) return fail(ctx, "Can't do that", `I can't kick ${target.user.username} — their role is above mine.`);

        const reason = ctx.rest(1) || "No reason provided";

        const { confirmed, timedOut } = await confirm(ctx, {
            title: `Kick ${target.user.username}?`,
            description: `${target.user.tag} will be removed from **${ctx.guild.name}**.`,
            fields: [
                { name: "User", value: `${target.user.tag}\n${target.user.id}`, inline: true },
                { name: "Reason", value: reason, inline: true }
            ],
            confirmLabel: "Kick"
        });

        if (timedOut) return;
        if (!confirmed) return cancelled(ctx, "Kick cancelled");

        await target.kick(reason).catch((error) => {
            return ctx.edit({
                embeds: [
                    embed({ color: config.colors.danger, title: "Could not kick", description: error.message, timestamp: false })
                ],
                components: []
            });
        });

        return ctx.edit({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Member kicked",
                    fields: [
                        { name: "User", value: `${target.user.tag}`, inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ],
            components: []
        });
    }
};
