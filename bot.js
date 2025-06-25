require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Use environment variable for the bot token
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('warn', (info) => {
    console.warn('Discord client warning:', info);
});

client.on('disconnect', () => {
    console.warn('Bot disconnected from Discord!');
});

if (!DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN is not set!');
    process.exit(1);
}

client.login(DISCORD_BOT_TOKEN);