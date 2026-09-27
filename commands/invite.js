const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const { duration } = require("../utils/format");
const { embed, fail, requireGuild, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "invite",

    data: new SlashCommandBuilder()
        .setName("invite")
        .setDescription("Creates an invite link to this channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.CreateInstantInvite)
        .addStringOption((option) =>
            option.setName("reason").setDescription("Why the invite is needed").setMaxLength(256)
        ),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.CreateInstantInvite, "Create Invite")) return;

        if (!ctx.channel.isTextBased() || ctx.channel.isDMBased?.()) {
            return fail(ctx, "Server only", "I can only create invites in server channels.");
        }

        const reason = ctx.text() || `Invite requested by ${ctx.author.tag}`;
        const invite = await ctx.channel.createInvite({ reason, maxAge: 86400, maxUses: 0 }).catch((error) => error);

        if (invite instanceof Error) return fail(ctx, "Could not create invite", invite.message);

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Invite created",
                    description: `[${invite.code}](${invite.url})`,
                    fields: [
                        { name: "Channel", value: `${ctx.channel}`, inline: true },
                        { name: "Expires in", value: duration(86400 * 1000), inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ]
        });
    }
};
