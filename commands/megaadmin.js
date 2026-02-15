const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function megaAdminCommand(sock, chatId, senderId, userMessage, message) {
    try {

        if (chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, {
                text: "> MF please Use this command in bots DM🙏."
            }, { quoted: message });
        }

        let content = userMessage.replace('.megaadmin', '').trim();

        // -------- Extract Group From JID --------
        let groupId = null;

        const groupMatch = content.match(/\d+@g\.us/);
        if (groupMatch) {
            groupId = groupMatch[0];
            content = content.replace(groupId, '').trim();
        }

        // -------- Extract Group From Link --------
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
                text: "> Provide group link or group JID."
            }, { quoted: message });
        }

        // -------- Detect Phone Numbers (Optional Now) --------
        const numberRegex = /\+?\d[\d\s]{7,18}\d/g;
        const foundNumbers = content.match(numberRegex) || [];

        let finalText = content;
        let numbers = [];

        // Replace numbers only if they exist
        for (let rawNum of foundNumbers) {

            const cleanNum = rawNum.replace(/\D/g, '');

            if (cleanNum.length < 9 || cleanNum.length > 15) continue;

            numbers.push(cleanNum);

            finalText = finalText.replace(rawNum, `@${cleanNum}`);
        }

        numbers = [...new Set(numbers)];

        // Convert numbers → JIDs
        const targetJids = numbers.map(num =>
            jidNormalizedUser(num + "@s.whatsapp.net")
        );

        // -------- Hidetag ONLY ADMINS --------
        const groupMeta = await sock.groupMetadata(groupId);

        const adminParticipants = groupMeta.participants
            .filter(p => p.admin)
            .map(p => p.id);

        await sock.sendMessage(groupId, {
            text: finalText || "> ", // prevents empty message crash
            mentions: [...adminParticipants, ...targetJids]
        });

        await sock.sendMessage(chatId, {
            text: `> ✅ Megatag sent to ${numbers.length} user(s).`
        });

    } catch (err) {
        console.log(err);
        await sock.sendMessage(chatId, {
            text: "> Failed to send megatag."
        }, { quoted: message });
    }
}

module.exports = megaAdminCommand;