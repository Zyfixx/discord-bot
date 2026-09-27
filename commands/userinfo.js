const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { since, list } = require("../utils/format");
const { embed, fail } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "userinfo [user]",

    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Shows information about a user.")
        .addUserOption((option) =>
            option.setName("user").setDescription("User to look up").setRequired(false)
        ),

    async execute(ctx) {
        const target = await resolve.user(ctx.client, ctx.args[0], ctx.guild) ?? ctx.author;

        if (!target) return fail(ctx, "User not found", "I could not find that user.");

        const member = ctx.guild?.members.cache.get(target.id) ?? null;
        const banner = target.bannerURL({ size: 512 });
        const roles = member
            ? list(
                  [...member.roles.cache.values()]
                      .filter((role) => role.id !== ctx.guild.id)
                      .sort((a, b) => b.position - a.position)
                      .map((role) => role.name),
                  12,
                  "none"
              )
            : null;

        const fields = [
            { name: "Username", value: `${target.username}`, inline: true },
            { name: "Display name", value: member?.displayName ?? target.globalName ?? target.username, inline: true },
            { name: "Bot", value: target.bot ? "Yes" : "No", inline: true },
            { name: "ID", value: `${target.id}`, inline: true },
            { name: "Account created", value: since(target.createdAt), inline: true },
            { name: "Discriminator", value: target.discriminator === "0" ? "none" : target.discriminator, inline: true }
        ];

        if (member) {
            fields.push({ name: "Joined server", value: since(member.joinedAt), inline: true });
            fields.push({ name: "Nickname", value: member.nickname ?? "none", inline: true });
            fields.push({ name: "Boosting since", value: member.premiumSince ? since(member.premiumSince) : "no", inline: true });
            fields.push({ name: `Roles (${member.roles.cache.size - 1})`, value: roles });
            fields.push({
                name: "Timeout",
                value: member.communicationDisabledUntilMillis
                    ? `until <t:${Math.floor(member.communicationDisabledUntilMillis / 1000)}:R>`
                    : "none",
                inline: true
            });
        }

        await ctx.respond({
            embeds: [
                embed({
                    color: member?.displayHexColor && member.displayHexColor !== "#000000" ? member.displayHexColor : config.colors.info,
                    author: { name: target.tag, iconURL: target.displayAvatarURL() },
                    thumbnail: target.displayAvatarURL({ size: 512 }),
                    image: banner ?? undefined,
                    fields
                })
            ]
        });
    }
};
