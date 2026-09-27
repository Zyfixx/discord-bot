const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { parseDuration, duration } = require("../utils/format");
const { embed, fail, requirePermission } = require("../utils/feedback");

const MAX = config.maxMuteDays * 86400 * 1000;

module.exports = {
    group: "moderation",
    usage: "mute <user> [duration] [reason]",

    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Times a member out so they cannot speak.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption((option) => option.setName("user").setDescription("Member to mute").setRequired(true))
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription(`How long, e.g. 10m, 2h, 1d (max ${config.maxMuteDays}d)`)
                .setMaxLength(32)
        )
        .addStringOption((option) => option.setName("reason").setDescription("Why").setMaxLength(512)),

    async execute(ctx) {
        if (!requirePermission(ctx, PermissionFlagsBits.ModerateMembers, "Moderate Members")) return;

        const target = await resolve.member(ctx, ctx.args[0]);

        if (!target) return fail(ctx, "Member not found", "That member isn't in this server.");
        if (target.id === ctx.author.id) return fail(ctx, "Can't do that", "You can't mute yourself.");
        if (!target.moderatable) {
            return fail(ctx, "Can't do that", `I can't mute ${target.user.username} — their role is above mine.`);
        }

        const requested = ctx.args[1];
        const ms = requested === undefined ? 600e3 : parseDuration(requested);

        if (ms === null) {
            return fail(ctx, "Bad duration", "Use a duration like `10m`, `2h`, `1d` or a number of seconds.");
        }

        if (ms > MAX) {
            return fail(ctx, "Too long", `Timeouts are capped at ${config.maxMuteDays} days.`);
        }

        const reason = ctx.rest(2) || "No reason provided";

        await target.timeout(ms, `${reason} | by ${ctx.author.tag}`).catch((error) => error);

        return ctx.respond({
            embeds: [
                embed({
                    color: config.colors.success,
                    title: "Member timed out",
                    fields: [
                        { name: "User", value: `${target.user.tag}`, inline: true },
                        { name: "Duration", value: duration(ms), inline: true },
                        { name: "Moderator", value: ctx.author.tag, inline: true },
                        { name: "Reason", value: reason, inline: false }
                    ]
                })
            ]
        });
    }
};
