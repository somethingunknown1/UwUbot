require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

client.on('guildMemberAdd', async (member) => {
    const joinDate = new Date();
    const note = `Joined ${joinDate.getDate().toString().padStart(2, '0')}/${
        (joinDate.getMonth() + 1).toString().padStart(2, '0')
    }/${joinDate.getFullYear()}`;
    try {
        await fetch('https://uwu23-production.up.railway.app/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: member.user.username,
                userId: member.user.id,
                notes: [note]
            })
        });
        console.log(`Added ${member.user.username} (${member.user.id}) with join note.`);
    } catch (err) {
        console.error('Failed to add new member to website:', err);
    }
});

if (!DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN is not set!');
    process.exit(1);
}

client.login(DISCORD_BOT_TOKEN);