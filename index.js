const { ethers } = require("ethers");
const { TelegramBot } = require('node-telegram-bot-api');

const PRIVATE_KEY ="0x6cad645473fa584928c41fcbdd80bab94cfe9fa7fb74c8b6de721a979ed053bb";
const TELEGRAM_BOT_TOKEN ="8620724435:AAG9IRFJ41RTWMCjX4mMDTIX5i_stef-iMk";
const ADMIN_CHAT_ID = 1809279512;

const RPC_URL = 'https://rpc.teqoin.io';

const MIN_DELAY = 5000;
const MAX_DELAY = 10000;

const MIN_AMOUNT = 0.000001;
const MAX_AMOUNT = 0.000009;

const TARGET_ADDRESSES = [
    "0xB981249292B9898994FF0b2Ae1dEa86e26f97Ec4"
];

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: true
});

let isBotRunning = false;
let globalTxCount = 1;

let monitorMessageId = null;

function getRandomAmount(min, max) {
    const random = Math.random() * (max - min) + min;
    return random.toFixed(6);
}

function getRandomDelay(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1) + min
    );
}

const mainMenuOptions = {
    reply_markup: {
        keyboard: [
            [
                { text: "▶️ START BOT" },
                { text: "⏹️ STOP BOT" }
            ],
            [
                { text: "📊 CEK STATUS & SALDO" }
            ]
        ],
        resize_keyboard: true
    }
};

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (chatId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(
            chatId,
            "❌ Akses ditolak!"
        );
    }

    if (text === "/start" || text === "Menu Utama") {
        return bot.sendMessage(
            chatId,
            "♐👊 Gunakan tombol di bawah untuk mengontrol bot.",
            mainMenuOptions
        );
    }

    if (text === "▶️ START BOT") {
        if (isBotRunning) {
            return bot.sendMessage(
                chatId,
                "⚠️ Bot sudah berjalan."
            );
        }

        isBotRunning = true;

        await bot.sendMessage(
            chatId,
            "🚀🤑💲 Bot Auto TX berhasil dihidupkan!"
        );

        startAutoTxProcess(chatId);
        return;
    }

    if (text === "⏹️ STOP BOT") {
        if (!isBotRunning) {
            return bot.sendMessage(
                chatId,
                "⚠️ Bot memang sedang mati."
            );
        }

        isBotRunning = false;

        return bot.sendMessage(
            chatId,
            "🛑 Bot berhasil dimatikan."
        );
    }

    if (text === "📊 CEK STATUS & SALDO") {
        try {
            const address = await wallet.getAddress();
            const balance = await provider.getBalance(address);
            const status = isBotRunning
                ? "🟢 RUNNING"
                : "🔴 STOPPED";

            const message =
                `ℹ️ *STATUS INFO*\n\n` +
                `📌 Wallet: \`${address}\`\n` +
                `💰 Saldo: ${ethers.utils.formatEther(balance)} Eth\n` +
                `⚡ Status: ${status}\n` +
                `🔢 Total Tx Berhasil: ${globalTxCount - 1}`;

            return bot.sendMessage(
                chatId,
                message,
                { parse_mode: "Markdown" }
            );
        } catch (err) {
            return bot.sendMessage(
                chatId,
                `❌ Gagal mengambil data saldo:\n${err.message}`
            );
        }
    }
});

async function startAutoTxProcess(chatId) {
    try {
        const senderAddress = await wallet.getAddress();

        while (isBotRunning) {
            for (const targetAddress of TARGET_ADDRESSES) {
                if (!isBotRunning) {
                    break;
                }

                const target = targetAddress.trim();

                if (!ethers.utils.isAddress(target)) {
                    continue;
                }

                const randomAmount = getRandomAmount(
                    MIN_AMOUNT,
                    MAX_AMOUNT
                );

                const randomDelay = getRandomDelay(
                    MIN_DELAY,
                    MAX_DELAY
                );

                console.log(
                    `\n[#] Tx #${globalTxCount} -> ${target}`
                );

                try {
                    const gasPrice =
                        await provider.getGasPrice();

                    const nonce =
                        await provider.getTransactionCount(
                            senderAddress,
                            "pending"
                        );

                    const transaction = await wallet.sendTransaction({
                        to: target,
                        value: ethers.utils.parseEther(
                            randomAmount
                        ),
                        gasLimit: 21000,
                        gasPrice,
                        nonce
                    });

                    await transaction.wait();

                    console.log(`[✓] Tx #${globalTxCount} berhasil`);

                    const nextAddress = await wallet.getAddress();
                    const nextBalance = await provider.getBalance(nextAddress);

                    const reportText = `🔄 **MONITORING AUTO TX TEQOIN** 🔄\n\n` +
                                       `⚡ Status Bot: 🟢 RUNNING\n` +
                                       `💰 Saldo Dompet: \`${ethers.utils.formatEther(nextBalance)} Eth\`\n` +
                                       `🔢 **Total Tx Sukses: ${globalTxCount} Tx**\n\n` +
                                       `📝 **Detail Transaksi Terakhir:**\n` +
                                       `➔ Ke: \`${target}\`\n` +
                                       `➔ Nominal: ${randomAmount} Eth\n` +
                                       `➔ [Lihat Explorer](https://teqoscan.io{transaction.hash})`;

                    if (!monitorMessageId) {
                        const sentMsg = await bot.sendMessage(chatId, reportText, { parse_mode: "Markdown", disable_web_page_preview: true });
                        monitorMessageId = sentMsg.message_id;
                    } else {
                        try {
                            await bot.editMessageText(reportText, {
                                chat_id: chatId,
                                message_id: monitorMessageId,
                                parse_mode: "Markdown",
                                disable_web_page_preview: true
                            });
                        } catch (editError) {
                            const sentMsg = await bot.sendMessage(chatId, reportText, { parse_mode: "Markdown", disable_web_page_preview: true });
                            monitorMessageId = sentMsg.message_id;
                        }
                    }

                    globalTxCount++;
                } catch (txError) {
                    console.error(
                        "Gagal kirim tx:",
                        txError.message
                    );

                    await bot.sendMessage(
                        chatId,
                        `⚠️ Gagal mengirim Tx ke ${target}:\n${txError.message}`
                    );
                }

                if (isBotRunning) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, randomDelay)
                    );
                }
            }
        }
    } catch (error) {
        await bot.sendMessage(
            chatId,
            `❌ Fatal error:\n${error.message}`
        );

        if (isBotRunning) {
            await new Promise((resolve) =>
                setTimeout(resolve, 10000)
            );

            startAutoTxProcess(chatId);
        }
    }
}

console.log(
    "[+] Telegram Controller aktif. Ketik /start di Telegram."
);
