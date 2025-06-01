// Modified bot to support Fortnite Custom Match scheduling
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
const express = require('express');
const { Pool } = require('pg');
const schedule = require('node-schedule');

const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const ANNOUNCE_CHANNEL_ID = 'YOUR_ANNOUNCE_CHANNEL_ID'; // Replace with your channel ID

const db = new Pool({ connectionString: DATABASE_URL });
const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

const commands = [
  new SlashCommandBuilder().setName('createcustom').setDescription('Schedule a Fortnite custom match')
].map(c => c.toJSON());

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
})();

const customSessions = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user } = interaction;

  if (commandName === 'createcustom') {
    await interaction.reply({ content: 
      `📅 Let’s get your Fortnite custom match set up!
      You must schedule it **at least 24 hours in advance** and **between 11am–10pm UK time**.
      What time should the match start? (e.g. \`15:00\`)`, ephemeral: true });

    customSessions.set(user.id, { step: 'time' });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !customSessions.has(message.author.id)) return;

  const session = customSessions.get(message.author.id);
  const now = new Date();

  if (session.step === 'time') {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(message.content)) {
      return message.reply('❌ Invalid time format. Please use `HH:MM` format like `15:00`.');
    }
    session.time = message.content;
    session.step = 'day';
    return message.reply('📆 Great! What day should the custom run? (e.g. `2025-06-03`)');

  } else if (session.step === 'day') {
    const customDate = new Date(`${message.content}T${session.time}:00+01:00`);
    const delayMs = customDate - now;

    if (isNaN(customDate) || delayMs < 86400000 || customDate.getUTCHours() < 10 || customDate.getUTCHours() > 21) {
      return message.reply('❌ Date must be **at least 24 hours from now** and **between 11am–10pm UK time**.');
    }

    session.day = message.content;
    session.step = 'mode';
    return message.reply('🎮 Almost done! What gamemode? (e.g. `Solos`, `Duos`, `Trios`, `Squads`)');

  } else if (session.step === 'mode') {
    session.mode = message.content;
    session.step = 'done';
    customSessions.delete(message.author.id);

    const postTime = new Date(`${session.day}T${session.time}:00+01:00`);
    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

    schedule.scheduleJob(postTime, async () => {
      if (channel?.type === ChannelType.GuildText) {
        await channel.send({ content: 
          `📢 **Scheduled Fortnite Custom Match!**
👤 Host: <@${message.author.id}>
🕒 Time: **${session.time} UK** on **${session.day}**
🎮 Mode: **${session.mode}**

Please be ready in-game before the start time!` });
      }
    });

    return message.reply(`✅ Your custom match has been scheduled for **${session.time} UK** on **${session.day}**! We’ll remind everyone then.`);
  }
});

client.login(DISCORD_BOT_TOKEN);
