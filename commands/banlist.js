const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const { since, list } = require("../utils/format");
const { embed, fail, requirePermission } = require("../utils/feedback");

module.exports = {
    group: "moderation",
    usage: "banlist",

    data: new SlashCommandBuilder()
        .setName("banlist")
        .setDescription("Lists the users banned from this server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.BanMembers, "Ban Members")) return;

        const bans = await ctx.guild.bans.fetch({ limit: 100 }).catch(() => null);

        if (!bans) return fail(ctx, "Could not fetch bans", "I couldn't read the ban list.");

        if (!bans.size) {
            return ctx.respond({
                embeds: [
                    embed({
                        color: config.colors.info,
                        title: "Ban list",
                        description: "Nobody is banned from this server."
                    })
                ]
            });
        }

        const lines = [...bans.values()].map(
            (ban) =>
                `\`${ban.user.id}\` ${ban.user.tag}${ban.reason ? ` — ${ban.reason}` : ""}`
        );

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.danger,
                    title: `Ban list (${bans.size})`,
                    description: list(lines, 15),
                    fields: [
                        { name: "Server", value: `${ctx.guild.name}`, inline: true },
                        { name: "Total", value: `${bans.size}${bans.size === 100 ? "+" : ""}`, inline: true }
                    ]
                })
            ]
        });
    }
};
