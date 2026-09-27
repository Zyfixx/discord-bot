const djs = require("discord.js");
const config = require("../config");
const { embed } = require("./feedback");

function row(confirmLabel, cancelLabel) {
    return new djs.ActionRowBuilder().addComponents(
        new djs.ButtonBuilder()
            .setCustomId("confirm")
            .setLabel(confirmLabel)
            .setStyle(djs.ButtonStyle.Danger),
        new djs.ButtonBuilder()
            .setCustomId("cancel")
            .setLabel(cancelLabel)
            .setStyle(djs.ButtonStyle.Secondary)
    );
}

async function confirm(
    ctx,
    {
        title,
        description,
        fields,
        confirmLabel = "Confirm",
        cancelLabel = "Cancel",
        ephemeral = true,
        timeout = config.confirmTimeout
    } = {}
) {
    await ctx.respond({
        embeds: [
            embed({ color: config.colors.warning, title: `⚠ ${title}`, description, fields, timestamp: false })
        ],
        components: [row(confirmLabel, cancelLabel)],
        ephemeral
    });

    let button;

    try {
        button = await ctx.awaitComponent({ time: timeout });
    } catch {
        await ctx
            .edit({
                embeds: [
                    embed({
                        color: config.colors.neutral,
                        title: "⌛ Timed out",
                        description: "The confirmation expired, so nothing was changed.",
                        timestamp: false
                    })
                ],
                components: []
            })
            .catch(() => {});
        return { confirmed: false, timedOut: true };
    }

    await button.deferUpdate();
    return { confirmed: button.customId === "confirm", timedOut: false };
}

function cancelled(ctx, title = "Cancelled") {
    return ctx.edit({
        embeds: [
            embed({
                color: config.colors.neutral,
                title,
                description: "Nothing was changed.",
                timestamp: false
            })
        ],
        components: []
    });
}

module.exports = { confirm, cancelled };
