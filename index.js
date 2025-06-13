require('dotenv').config();
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const deployHookUrl = process.env.RENDER_DEPLOY_HOOK;
const channelId = process.env.DISCORD_CHANNEL_ID;

client.once(Events.ClientReady, async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error("❌ Channel not found!");
      return;
    }

    const button = new ButtonBuilder()
      .setCustomId('restart_service')
      .setLabel('Restart')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
      content: 'Click the button below to restart the bots:',
      components: [row]
    });

    console.log("✅ Restart button sent to the channel.");
  } catch (err) {
    console.error("Error sending button:", err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'restart_service') {
    try {
      const response = await axios.post(deployHookUrl, {}, {
        headers: {
          'Authorization': `Bearer ${process.env.RENDER_API_KEY}`
        }
      });

      if (response.status === 200) {
        await interaction.reply({ content: '✅ Service restarted successfully!', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to restart service.', ephemeral: true });
      }
    } catch (error) {
      console.error("Error during restart:", error);
      await interaction.reply({ content: '❌ Error triggering deploy hook.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
