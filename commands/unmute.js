const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { embed, fail, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "moderation",
    usage: "unmute <user> [reason]",
    examples: [
        "unmute @someone"
    ],

    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Removes a member's timeout.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("user").setDescription("Member to unmute").setRequired(true))
        .addStringOption((option) => option.setName("reason").setDescription("Why").setMaxLength(512)),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ModerateMembers, "Moderate Members")) return;

        const target = await resolve.member(ctx, ctx.args[0]);

        if (!target) return fail(ctx, "Member not found", "That member isn't in this server.");
        if (!target.isCommunicationDisabled()) {
            return fail(ctx, "Not muted", `${target.user.username} isn't timed out.`);
        }
        if (!target.moderatable) {
            return fail(ctx, "Can't do that", `I can't unmute ${target.user.username} — their role is above mine.`);
        }

        const reason = ctx.rest(1) || "No reason provided";

        await target.timeout(null, `${reason} | by ${ctx.author.tag}`).catch((error) => error);

        return ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Timeout removed",
                    fields: [
                        { name: "User", value: `${target.user.tag}`, inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ]
        });
    }
};
