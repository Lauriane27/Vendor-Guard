import { Client, Events, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const page = process.env.VENDORGARD_URL || "http://127.0.0.1:5173";

if (!token) {
  console.error("Set DISCORD_BOT_TOKEN, then run: npm run discord");
  console.error("In the Discord developer portal, enable the Message Content intent.");
  process.exit(1);
}

function instruction(text) {
  const cleaned = text.replace(/<@!?\d+>/g, "").trim();
  if (/^(internal|policy)\b/i.test(cleaned)) return { destination: "internal" };
  const vendor = cleaned.match(/^(?:vendor|contract)\b[:\s-]*(.+)$/i);
  if (vendor?.[1]?.trim()) return { destination: "vendor", vendorName: vendor[1].trim() };
  return { destination: "ask" };
}

function isPdf(file) {
  const name = file.name?.toLowerCase() ?? "";
  return name.endsWith(".pdf") || file.contentType === "application/pdf";
}

async function fileOnPage(payload) {
  const response = await fetch(`${page}/api/discord/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `VendorGuard returned ${response.status}`);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (ready) => {
  console.log(`Discord bot @${ready.user.tag} is filing documents on ${page}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.attachments.size === 0) return;
  try {
    await fileMessage(message);
  } catch (error) {
    console.error(error);
    await message.reply("VendorGuard could not file that document. Check that the review page is running.").catch(() => {});
  }
});

async function fileMessage(message) {
  const pdfs = [...message.attachments.values()].filter(isPdf);
  if (pdfs.length === 0) {
    await message.reply("VendorGuard can file PDF documents. Attach a PDF and say where it belongs.");
    return;
  }

  const where = instruction(message.content);
  const filed = [];
  for (const file of pdfs) {
    await fileOnPage({
      name: file.name,
      size: file.size,
      destination: where.destination,
      vendorName: where.vendorName ?? "",
      author: message.author.username,
    });
    filed.push(file.name);
  }

  const names = filed.join(", ");
  if (where.destination === "internal") {
    await message.reply(`Filed ${names} on the review screen. It replaces the internal policy.`);
    return;
  }
  if (where.destination === "vendor") {
    await message.reply(`Filed ${names} on the review screen under ${where.vendorName}.`);
    return;
  }
  await message.reply(`Sent ${names} to the review screen. Choose internal documents or a vendor there.`);
}

setInterval(() => {
  fetch(`${page}/api/discord/heartbeat`, { method: "POST" }).catch(() => {});
}, 4000);

client.login(token);
