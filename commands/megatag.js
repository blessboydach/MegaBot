const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function megaTagCommand(sock, chatId, senderId, userMessage, message) {
    try {
        // ❌ Block group usage
        if (chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: "> MF please use this command in bot DM only 🙏."
            }, { quoted: message });
        }

        let content = userMessage.replace('.megatag', '').trim();

        // -------- Extract Group From JID or Link --------
        let groupId = null;

        const jidMatch = content.match(/\d+@g\.us/);
        if (jidMatch) {
            groupId = jidMatch[0];
            content = content.replace(groupId, '').trim();
        }

        const inviteMatch = content.match(/chat\.whatsapp\.com\/([\w\d]+)/);
        if (inviteMatch) {
            try {
                groupId = await sock.groupAcceptInvite(inviteMatch[1]);
                content = content.replace(inviteMatch[0], '').trim();
            } catch {
                return sock.sendMessage(chatId, {
                    text: "> Invalid or expired group link."
                }, { quoted: message });
            }
        }

        if (!groupId) {
            return sock.sendMessage(chatId, {
                text: "> Provide a group link or group JID."
            }, { quoted: message });
        }

        // -------- Detect Numbers (Optional) --------
        const numberRegex = /\+?\d[\d\s]{7,18}\d/g;
        const foundNumbers = content.match(numberRegex) || [];
        let finalText = content;
        let numbers = [];

        for (let rawNum of foundNumbers) {
            const cleanNum = rawNum.replace(/\D/g, '');
            if (cleanNum.length < 9 || cleanNum.length > 15) continue;
            numbers.push(cleanNum);
            finalText = finalText.replace(rawNum, `@${cleanNum}`);
        }

        numbers = [...new Set(numbers)];
        const targetJids = numbers.map(num => jidNormalizedUser(num + "@s.whatsapp.net"));

        // -------- Fetch Group Participants for hidetag --------
        const groupMeta = await sock.groupMetadata(groupId);
        const participants = groupMeta.participants.map(p => p.id);

        // -------- Check for Replied Message (Media or Sticker) --------
        const quoted = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (quoted) {
            const typeMap = {
                stickerMessage: 'sticker',
                imageMessage: 'image',
                videoMessage: 'video',
                audioMessage: 'audio',
                documentMessage: 'document'
            };

            const msgType = Object.keys(quoted)[0];
            const sendType = typeMap[msgType];

            if (!sendType) {
                return sock.sendMessage(chatId, {
                    text: "> Unsupported media type."
                }, { quoted: message });
            }

            const mediaContent = quoted[msgType];

            // Send media to group with hidetag mentions
            await sock.sendMessage(groupId, {
                [sendType]: mediaContent,
                mentions: [...participants, ...targetJids]
            });

            // Also send text if user typed extra text
            if (finalText) {
                await sock.sendMessage(groupId, {
                    text: finalText,
                    mentions: [...participants, ...targetJids]
                });
            }

        } else {
            // Normal text-only megatag
            await sock.sendMessage(groupId, {
                text: finalText || "> ",
                mentions: [...participants, ...targetJids]
            });
        }

        await sock.sendMessage(chatId, {
            text: `> ✅ Megatag sent to ${numbers.length} user(s).`
        });

    } catch (err) {
        console.log("MEGATAG ERROR:", err);
        await sock.sendMessage(chatId, {
            text: `> Failed to send megatag.\n${err.message}`
        }, { quoted: message });
    }
}

module.exports = megaTagCommand;
