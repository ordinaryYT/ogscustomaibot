// Fortnite Custom Match Scheduler as a Command with Day Names
require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const express = require('express');
const axios = require('axios');
const schedule = require('node-schedule');

const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

const customCommand = new SlashCommandBuilder()
  .setName('createcustom')
  .setDescription('Schedule a Fortnite custom match')
  .addStringOption(option =>
    option.setName('time').setDescription('Start time (e.g. 15:00)').setRequired(true))
  .addStringOption(option =>
    option.setName('day').setDescription('Day of the week (e.g. Monday)').setRequired(true))
  .addStringOption(option =>
    option.setName('mode').setDescription('Game mode (e.g. Solos, Duos)').setRequired(true));

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [customCommand.toJSON()]
  });
})();

const dayMap = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  if (commandName === 'createcustom') {
    const time = interaction.options.getString('time');
    const day = interaction.options.getString('day').toLowerCase();
    const mode = interaction.options.getString('mode');

    const acceptedTimes = [
      '10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'
    ];

    if (!acceptedTimes.includes(time)) {
      return interaction.reply({ content: `❌ Invalid time. Accepted times: ${acceptedTimes.join(', ')}`, ephemeral: true });
    }

    if (!(day in dayMap)) {
      return interaction.reply({ content: `❌ Invalid day. Please use full day names like Monday, Tuesday, etc.`, ephemeral: true });
    }

    const now = new Date();
    let scheduledDate = new Date();
    const targetDay = dayMap[day];
    const daysUntil = (targetDay + 7 - now.getDay()) % 7 || 7;
    scheduledDate.setDate(now.getDate() + daysUntil);

    const [hour, minute] = time.split(':').map(Number);
    scheduledDate.setUTCHours(hour - 1, minute, 0, 0); // UK time (BST is UTC+1)

    if (scheduledDate - now < 86400000) {
      return interaction.reply({ content: '❌ You must schedule at least 24 hours in advance.', ephemeral: true });
    }

    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

    schedule.scheduleJob(scheduledDate, async () => {
      if (channel?.type === ChannelType.GuildText) {
        await channel.send({ content: 
          `📢 **Scheduled Fortnite Custom Match!**
👤 Host: <@${interaction.user.id}>
🕒 Time: **${time} UK** on **${day.charAt(0).toUpperCase() + day.slice(1)}**
🎮 Mode: **${mode}**

Please be ready in-game before the start time!` });
      }
    });

    return interaction.reply({ content: `✅ Your match is scheduled for **${time} UK** on **${day.charAt(0).toUpperCase() + day.slice(1)}**.`, ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(DISCORD_BOT_TOKEN);
