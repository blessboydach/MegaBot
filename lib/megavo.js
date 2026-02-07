// lib/megavo.js

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile } = require('fs/promises');

const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

async function handleViewOnceSaver(sock, message, rawText) {
    const quotedContext = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedContext?.quotedMessage;

    if (!quotedMsg) return;

    const replyText = rawText.trim();

    // Trigger: reply ends with emoji
    const endsWithEmoji = /[\p{Emoji_Presentation}\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Extended_Pictographic}]$/u.test(replyText);

    if (!endsWithEmoji) return;

    try {
        let mediaObj = null;
        let mediaType = '';
        let ext = '';
        let mime = '';
        let ptt = false;

        const quotedImage = quotedMsg.imageMessage;
        const quotedVideo = quotedMsg.videoMessage;
        const quotedAudio = quotedMsg.audioMessage;

        if (quotedImage?.viewOnce) {
            mediaObj = quotedImage;
            mediaType = 'image';
            ext = 'jpg';
            mime = 'image/jpeg';
        } 
        else if (quotedVideo?.viewOnce) {
            mediaObj = quotedVideo;
            mediaType = 'video';
            ext = 'mp4';
            mime = 'video/mp4';
        } 
        else if (quotedAudio?.viewOnce) {
            mediaObj = quotedAudio;
            mediaType = 'audio';
            ext = 'ogg';
            mime = 'audio/ogg; codecs=opus';
            ptt = true;
        }

        if (!mediaObj) return;

        // Bot self number
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Original caption
        const originalCaption = mediaObj.caption
            ? `> CAPTION 》 ${mediaObj.caption}\n`
            : '';

        // Build context
        const sender = quotedContext.participant || message.key.remoteJid;
        const senderName = sender.split('@')[0];
        const isGroup = message.key.remoteJid.endsWith('@g.us');

        let context =
            `From: @${senderName}\n` +
            `Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })}\n`;

        if (isGroup) {
            try {
                const groupMeta = await sock.groupMetadata(message.key.remoteJid);
                const groupName = groupMeta.subject || 'Group';
                context += `Group: ${groupName} (${message.key.remoteJid})\n`;
            } catch {
                context += `Group: ${message.key.remoteJid}\n`;
            }
        }

        // Final caption logic
        const finalCaption = originalCaption
            ? `${originalCaption} ${context}`
            : `${context}`;

        // Temp file path
        const messageId = message.key.id || Date.now().toString();
        const mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);

        // Download media
        const stream = await downloadContentFromMessage(mediaObj, mediaType);
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length === 0) {
            console.log(`[MEGAVO] Empty buffer for ${mediaType}`);
            return;
        }

        await writeFile(mediaPath, buffer);

        // Send options
        const mediaOptions = {
            caption: finalCaption,
            mentions: sender ? [sender] : []
        };

        if (mediaType === 'image') {
            await sock.sendMessage(ownerNumber, {
                image: { url: mediaPath },
                ...mediaOptions
            });
        }
        else if (mediaType === 'video') {
            await sock.sendMessage(ownerNumber, {
                video: { url: mediaPath },
                ...mediaOptions
            });
        }
        else if (mediaType === 'audio') {
            await sock.sendMessage(ownerNumber, {
                audio: { url: mediaPath },
                mimetype: mime,
                ptt: ptt,
                seconds: mediaObj.seconds || 0,
                ...mediaOptions
            });
        }

        console.log(`[MEGAVO SAVED] → ${ownerNumber} | ${mediaType} | size: ${buffer.length}`);

        // Cleanup temp file
        try {
            fs.unlinkSync(mediaPath);
        } catch {}

    } catch (err) {
        console.error('[MEGAVO ERROR]', err.message || err);
    }
}

module.exports = {
    handleViewOnceSaver
};
