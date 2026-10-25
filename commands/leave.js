const { SlashCommandBuilder } = require("discord.js");
const { done, fail, requireGuild } = require("../utils/feedback");
const { getPlayer } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "leave",
    help: "I never leave on my own, so this is the only way to disconnect. The queue is cleared too.",

    data: new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Clears the queue and leaves the voice channel."),

    async execute(ctx) {
        if (!requireGuild(ctx)) return;

        const player = getPlayer(ctx);

        if (!player?.voiceChannelId) {
            return fail(ctx, "Not connected", "I am not in a voice channel in this server.");
        }

        await player.destroy("Left by command");

        return done(ctx, {
            title: "👋 Left",
            description: "Queue cleared and I left the voice channel."
        });
    }
};
