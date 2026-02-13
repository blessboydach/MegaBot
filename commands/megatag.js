const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function megaTagCommand(sock, chatId, senderId, userMessage, message) {
    try {

        if (chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: "❌ Use this command in bot DM."
            }, { quoted: message });
        }

        let content = userMessage.replace('.megatag', '').trim();

        // -------- Extract Group --------
        let groupId = null;

        const groupMatch = content.match(/\d+@g\.us/);
        if (groupMatch) {
            groupId = groupMatch[0];
            content = content.replace(groupId, '').trim();
        }

        const inviteMatch = content.match(/chat\.whatsapp\.com\/([\w\d]+)/);
        if (inviteMatch) {
            groupId = await sock.groupAcceptInvite(inviteMatch[1]);
            content = content.replace(inviteMatch[0], '').trim();
        }

        if (!groupId) {
            return sock.sendMessage(chatId, {
                text: "❌ Provide group JID or invite link."
            }, { quoted: message });
        }

        // -------- Detect All Phone Numbers --------
        const numberRegex = /\+?\d[\d\s]{7,18}\d/g;
        const foundNumbers = content.match(numberRegex) || [];

        if (!foundNumbers.length) {
            return sock.sendMessage(chatId, {
                text: "❌ No valid numbers found."
            }, { quoted: message });
        }

        let finalText = content;
        let numbers = [];

        // Replace numbers inline
        for (let rawNum of foundNumbers) {

            const cleanNum = rawNum.replace(/\D/g, '');

            if (cleanNum.length < 9 || cleanNum.length > 15) continue;

            numbers.push(cleanNum);

            // Replace only this exact occurrence inline
            finalText = finalText.replace(rawNum, `@${cleanNum}`);
        }

        // Remove duplicates
        numbers = [...new Set(numbers)];

        // Convert to JIDs
        const targetJids = numbers.map(num =>
            jidNormalizedUser(num + "@s.whatsapp.net")
        );

        // -------- Hidetag Everyone --------
        const groupMeta = await sock.groupMetadata(groupId);
        const participants = groupMeta.participants.map(p => p.id);

        await sock.sendMessage(groupId, {
            text: finalText,
            mentions: [...participants, ...targetJids]
        });

        await sock.sendMessage(chatId, {
            text: `✅ Megatag sent to ${numbers.length} user(s).`
        });

    } catch (err) {
        console.log(err);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to send megatag."
        }, { quoted: message });
    }
}

module.exports = megaTagCommand;