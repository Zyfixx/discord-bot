const { SlashCommandBuilder } = require("discord.js");
const { done, fail, requireGuild } = require("../utils/feedback");
const { getDistube } = require("../utils/music");

module.exports = {
    group: "music",
    usage: "leave",
    help: "I never leave on my own, so this is the only way to disconnect. The queue is cleared too.",

    data: new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Clears the queue and leaves the voice channel."),

    async execute(ctx) {
        if (!requireGuild(ctx)) return;

        const distube = getDistube(ctx.client);
        const guild = ctx.guild;

        // A finished or stopped queue leaves the connection behind, so check the
        // voice manager as well as the queue before reporting nothing to do.
        const connected = distube.getQueue(guild)?.voice ?? distube.voices?.get(guild.id);

        if (!connected) {
            return fail(ctx, "Not connected", "I am not in a voice channel in this server.");
        }

        // DisTubeBase has no leave(); it lives on the voice manager, which also
        // handles the case where the queue is gone but the connection remains.
        distube.voices.leave(guild);

        return done(ctx, {
            title: "👋 Left",
            description: "Queue cleared and I left the voice channel."
        });
    }
};
