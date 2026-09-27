const { SlashCommandBuilder, ChannelType, GuildVerificationLevel } = require("discord.js");
const config = require("../config");
const { since } = require("../utils/format");
const { embed, requireGuild } = require("../utils/feedback");

const CHANNEL_TYPES = [
    [ChannelType.GuildText, "Text"],
    [ChannelType.GuildVoice, "Voice"],
    [ChannelType.GuildStageVoice, "Stages"],
    [ChannelType.GuildForum, "Forums"],
    [ChannelType.GuildMedia, "Media"],
    [ChannelType.GuildAnnouncement, "News"],
    [ChannelType.GuildCategory, "Categories"]
];

module.exports = {
    group: "utility",
    usage: "serverinfo",

    data: new SlashCommandBuilder().setName("serverinfo").setDescription("Shows information about this server."),

    async execute(ctx) {
        if (!requireGuild(ctx)) return;

        const { guild } = ctx;
        const owner = await guild.fetchOwner().catch(() => null);

        const counts = new Map(CHANNEL_TYPES.map(([type]) => [type, 0]));
        let threads = 0;

        for (const channel of guild.channels.cache.values()) {
            if (counts.has(channel.type)) counts.set(channel.type, counts.get(channel.type) + 1);
            if (channel.isThread?.()) threads += 1;
        }

        const channelFields = CHANNEL_TYPES.filter(([type]) => type !== ChannelType.GuildCategory).map(
            ([type, label]) => ({
                name: label,
                value: `${counts.get(type)}`,
                inline: true
            })
        );

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.info,
                    author: { name: guild.name, iconURL: guild.iconURL({ size: 128 }) ?? undefined },
                    thumbnail: guild.iconURL({ size: 512 }) ?? undefined,
                    fields: [
                        { name: "Owner", value: owner ? owner.user.tag : "unknown", inline: true },
                        { name: "Created", value: since(guild.createdAt), inline: true },
                        { name: "ID", value: `${guild.id}`, inline: true },
                        { name: "Members", value: `${guild.memberCount}`, inline: true },
                        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
                        { name: "Emojis", value: `${guild.emojis.cache.size}`, inline: true },
                        { name: "Stickers", value: `${guild.stickers.cache.size}`, inline: true },
                        { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
                        { name: "Boost tier", value: `${guild.premiumTier ?? 0}`, inline: true },
                        { name: "Verification", value: `${GuildVerificationLevel[guild.verificationLevel] ?? "None"}`, inline: true },
                        ...channelFields,
                        { name: "Categories", value: `${counts.get(ChannelType.GuildCategory)}`, inline: true },
                        { name: "Threads", value: `${threads}`, inline: true }
                    ]
                })
            ]
        });
    }
};
