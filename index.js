require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  Events,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CONTROL_CHANNEL_ID = process.env.CONTROL_CHANNEL_ID;

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;

const headers = {
  Authorization: `Bearer ${RENDER_API_KEY}`,
  'Content-Type': 'application/json',
};

// Build control buttons
const buildControls = () => {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start')
      .setLabel('Start')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('stop')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('restart')
      .setLabel('Restart')
      .setStyle(ButtonStyle.Primary)
  );
};

// Post control panel on bot ready
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(CONTROL_CHANNEL_ID);
  if (channel && channel.type === ChannelType.GuildText) {
    await channel.send({
      content: '**🤖 Bot Controller Panel**',
      components: [buildControls()],
    });
  }
});

// Handle button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.customId;
  let method, url;

  try {
    if (id === 'start') {
      method = 'POST';
      url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/resume`;
    } else if (id === 'stop') {
      method = 'PUT';
      url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/suspend`;
    } else if (id === 'restart') {
      method = 'POST';
      url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/restart`;
    } else {
      return interaction.editReply('⚠️ Unknown action.');
    }

    const response = await axios({ method, url, headers, data: null });

    if (response.status >= 200 && response.status < 300) {
      return interaction.editReply(`✅ Successfully executed **${id}** command.`);
    } else {
      return interaction.editReply('⚠️ Failed to execute the command.');
    }
  } catch (err) {
    console.error('❌ Render API Error:', err?.response?.data || err.message);
    return interaction.editReply('❌ Failed to contact bot server.');
  }
});

client.login(TOKEN);
