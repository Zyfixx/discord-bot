const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const resolve = require("../utils/resolve");
const { embed, fail } = require("../utils/feedback");

module.exports = {
    group: "utility",
    usage: "avatar [user] [server]",
    examples: [
        "avatar",
        "avatar @someone",
        "avatar @someone server"
    ],

    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Shows a user's avatar, and their banner if they have one.")
        .addUserOption((option) => option.setName("user").setDescription("User").setRequired(false))
        .addBooleanOption((option) =>
            option
                .setName("server")
                .setDescription("Show the server-specific avatar instead")
                .setRequired(false)
        ),

    async execute(ctx) {
        const target = await resolve.user(ctx.client, ctx.args[0], ctx.guild) ?? ctx.author;

        if (!target) return fail(ctx, "User not found", "I could not find that user.");

        const member = ctx.guild?.members.cache.get(target.id) ?? null;
        const useServerAvatar = Boolean(ctx.args[1]) && Boolean(member?.avatar);
        const avatar = useServerAvatar ? member.avatarURL({ size: 512 }) : target.displayAvatarURL({ size: 512 });
        const banner = target.bannerURL({ size: 600 });

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: `${target.username}'s ${useServerAvatar ? "server avatar" : "avatar"}`,
                    url: avatar,
                    image: avatar,
                    description: `[Open original](${avatar})`
                })
            ]
        });

        if (banner) {
            await ctx.follow({
                embeds: [embed({ color: config.colors.info, title: "Banner", url: banner, image: banner })]
            });
        }
    }
};
