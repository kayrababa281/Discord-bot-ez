rst)
    trainedAttrs = trainedAttrs.sort((a, b) => {
      const aValue = player[a.dbField as keyof typeof player] as number;
      const bValue = player[b.dbField as keyof typeof player] as number;
      return bValue - aValue;
    });
  }

  // Calculate stats for header
  let maxValue = 0;
  let totalGains = 0;
  const differentStatsCount = trainedAttrs.length;
  
  for (const attr of trainedAttrs) {
    const value = player[attr.dbField as keyof typeof player] as number;
    const weeklyValue = player[attr.weeklyField as keyof typeof player] as number;
    if (value > maxValue) maxValue = value;
    if (showWeekly) {
      totalGains += weeklyValue;
    } else {
      totalGains += weeklyValue;
    }
  }

  // Get all players for ranking
  const allPlayers = await db.select().from(players);
  let playerRank = 1;
  
  if (showWeekly) {
    const rankedPlayers = allPlayers
      .map(p => {
        let weeklyTotal = 0;
        for (const attr of ATTRIBUTES) {
          const weeklyValue = p[attr.weeklyField as keyof typeof p] as number;
          weeklyTotal += weeklyValue || 0;
        }
        return { player: p, total: weeklyTotal };
      })
      .sort((a, b) => b.total - a.total);
    
    playerRank = rankedPlayers.findIndex(r => r.player.discordId === player.discordId) + 1;
  } else {
    const rankedPlayers = allPlayers
      .map(p => {
        let maxAttr = 0;
        for (const attr of ATTRIBUTES) {
          const value = p[attr.dbField as keyof typeof p] as number;
          if (value > maxAttr) maxAttr = value;
        }
        return { player: p, maxAttr };
      })
      .sort((a, b) => b.maxAttr - a.maxAttr);
    
    playerRank = rankedPlayers.findIndex(r => r.player.discordId === player.discordId) + 1;
  }

  const title = nickname ? `<@${player.discordId}> (${nickname})` : `<@${player.discordId}>`;
  const viewType = showWeekly ? "Haftalık" : "All-Time";
  const description = `${title} | Auren - ${viewType} İstatistikler`;

  const embed = new EmbedBuilder()
    .setColor(0xFFFF00)
    .setTitle(description)
    .setDescription(showWeekly ? "Haftalık Toplam Statlar:" : "All-Time Toplam Statlar:")
    .setFooter({ text: `Auren` })
    .setTimestamp();

  if (trainedAttrs.length === 0) {
    embed.addFields({ name: "Bilgi", value: "Henüz antrenman yapılmadı.", inline: false });
  } else {
    let statsText = "";
    const maxChars = 1024; // Discord field char limit
    
    // Build stats text for all attributes (with character limit)
    for (let i = 0; i < trainedAttrs.length; i++) {
      const attr = trainedAttrs[i];
      const value = player[attr.dbField as keyof typeof player] as number;
      const weeklyValue = player[attr.weeklyField as keyof typeof player] as number;
      
      let line = "";
      if (showWeekly) {
        line = `${i + 1}. +${weeklyValue} ${attr.displayName}\n`;
      } else {
        line = `${i + 1}. +${value} ${attr.displayName}\n`;
      }
      
      // Check if adding this line would exceed limit
      if ((statsText + line).length > maxChars) {
        // Don't add, we're at limit
        break;
      }
      
      statsText += line;
    }
    
    // Add all stats under the main header
    const headerName = showWeekly ? "Haftalık Toplam Statlar:" : "All-Time Toplam Statlar:";
    embed.addFields({ name: headerName, value: statsText.trim(), inline: false });

    // Add stats summary
    embed.addFields(
      { name: `Toplam Stat Sayısı:`, value: `${totalGains}`, inline: false },
      { name: `${viewType} Sıralaması:`, value: `${playerRank}. sırada (${allPlayers.length} oyuncu arasında)`, inline: false },
      { name: `${viewType} Gelişim:`, value: `${differentStatsCount} farklı stat türü\n${totalGains} toplam stat`, inline: false }
    );
  }
  
  return embed;
}

function createPaginationButtons(page: number, totalPages: number, targetUserId: string): ActionRowBuilder<ButtonBuilder> {
  const prevButton = new ButtonBuilder()
    .setCustomId(`page_prev_${page}_${targetUserId}`)
    .setLabel("Önceki")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(page === 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(`page_next_${page}_${targetUserId}`)
    .setLabel("Sonraki")
    .setStyle(ButtonStyle.Success)
    .setDisabled(page === totalPages || totalPages === 1);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
}

function createViewButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("show_weekly")
      .setLabel("Haftalık")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("show_total")
      .setLabel("All-Time")
      .setStyle(ButtonStyle.Danger),
  );
}

function findAttribute(input: string): AttributeConfig | undefined {
  const normalizedInput = input.toLowerCase().trim();
  return ATTRIBUTES.find(attr => 
    attr.aliases.some(alias => normalizedInput === alias.toLowerCase())
  );
}

const trainingCooldown = new Map<string, number>(); // userId -> timestamp
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

async function handleResetAll(message: Message): Promise<boolean> {
  if (!message.content.toLowerCase().startsWith(".sıfırla")) return false;
  
  const member = message.member as GuildMember;
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız.");
    return true;
  }

  // Reset all players: set all attributes to 0
  const resetData: any = {};
  for (const attr of ATTRIBUTES) {
    resetData[attr.dbField] = 0;
    resetData[attr.weeklyField] = 0;
  }
  resetData.updatedAt = new Date();

  await db.update(players).set(resetData);
  
  await message.react("✅");
  await message.reply("Tüm oyuncuların nitelikleri sıfırlandı!");
  
  return true;
}

const pendingAddAttributeData = new Map<string, { userId: string; username: string; attributeDbField: string; amount: number }>();

async function handleAdminDelete(message: Message): Promise<boolean> {
  if (!message.content.toLowerCase().startsWith(".sil")) return false;
  
  const member = message.member as GuildMember;
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız.");
    return true;
  }

  const mentionedUser = message.mentions.users.first();
  if (!mentionedUser) {
    await message.reply("Kullanım: `.sil @kullanıcı nitelik [-sayı]`\nÖrnek: `.sil @Ali Hızlanma` veya `.sil @Ali Hızlanma -5` veya `.sil @Ali 1 -5`");
    return true;
  }

  const parts = message.content.split(/\s+/);
  const mentionIndex = parts.findIndex(p => p.startsWith("<@"));
  
  if (mentionIndex === -1 || parts.length < mentionIndex + 2) {
    await message.reply("Kullanım: `.sil @kullanıcı nitelik [-sayı]`\nÖrnek: `.sil @Ali Hızlanma` veya `.sil @Ali Hızlanma -5` veya `.sil @Ali 1 -5`");
    return true;
  }

  const attributeParts: string[] = [];
  let amountStr = "";
  
  for (let i = mentionIndex + 1; i < parts.length; i++) {
    if (parts[i].match(/^-\d+$/)) {
      amountStr = parts[i];
    } else {
      attributeParts.push(parts[i]);
    }
  }
  
  const attributeInput = attributeParts.join(" ");
  let attribute: AttributeConfig | undefined;
  const decreaseAmount = amountStr ? parseInt(amountStr) : 0; // negative number
  
  // Check if input is a number (for index)
  const numberInput = parseInt(attributeInput);
  if (!isNaN(numberInput) && numberInput > 0) {
    // Get trained attributes and find by index
    const player = await getOrCreatePlayer(mentionedUser.id, mentionedUser.username);
    let trainedAttrs = ATTRIBUTES.filter(attr => {
      const weeklyValue = player[attr.weeklyField as keyof typeof player] as number;
      return weeklyValue > 0;
    });
    
    // Sort by weekly gains (same as .s command)
    trainedAttrs = trainedAttrs.sort((a, b) => {
      const aWeekly = player[a.weeklyField as keyof typeof player] as number;
      const bWeekly = player[b.weeklyField as keyof typeof player] as number;
      return bWeekly - aWeekly;
    });
    
    if (numberInput > trainedAttrs.length) {
      await message.reply(`Geçersiz numara. ${mentionedUser.username} sadece ${trainedAttrs.length} niteliğe sahip.`);
      return true;
    }
    
    attribute = trainedAttrs[numberInput - 1];
  } else {
    // Try to find by name
    attribute = findAttribute(attributeInput);
  }
  
  if (!attribute) {
    await message.reply(`Geçersiz nitelik: "${attributeInput}"\nGeçerli nitelikler için \`.nitelikler\` yazın.`);
    return true;
  }

  try {
    const player = await getOrCreatePlayer(mentionedUser.id, mentionedUser.username);
    const currentValue = player[attribute.dbField as keyof typeof player] as number;
    const currentWeekly = player[attribute.weeklyField as keyof typeof player] as number;
    
    let newValue: number;
    let newWeekly: number;
    let actionText: string;
    
    if (decreaseAmount < 0) {
      // Decrease by amount
      newValue = Math.max(0, currentValue + decreaseAmount);
      newWeekly = Math.max(0, currentWeekly + decreaseAmount);
      actionText = `${mentionedUser.username}** için **${attribute.displayName}** niteliği **${Math.abs(decreaseAmount)}** azaltıldı! Yeni değer: **${newValue}`;
    } else {
      // Set to 0
      newValue = 0;
      newWeekly = 0;
      actionText = `${mentionedUser.username}** için **${attribute.displayName}** niteliği silindi!`;
    }
    
    const updateData: any = {
      [attribute.dbField]: newValue,
      [attribute.weeklyField]: newWeekly,
      updatedAt: new Date(),
    };
    
    await db.update(players).set(updateData).where(eq(players.id, player.id));
    
    await message.react("✅");
    await message.reply(`**${actionText}`);
    return true;
  } catch (error) {
    console.error("Nitelik silme hatası:", error);
    await message.reply("Nitelik silinirken hata oluştu.");
    return true;
  }
}

async function handleAdminAdd(message: Message): Promise<boolean> {
  if (!message.content.toLowerCase().startsWith(".ekle")) return false;
  
  const member = message.member as GuildMember;
  if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız.");
    return true;
  }

  const mentionedUser = message.mentions.users.first();
  if (!mentionedUser) {
    await message.reply("Kullanım: `.ekle @kullanıcı nitelik +değer`\nÖrnek: `.ekle @Ali Hızlanma +5`");
    return true;
  }

  const parts = message.content.split(/\s+/);
  const mentionIndex = parts.findIndex(p => p.startsWith("<@"));
  
  if (mentionIndex === -1 || parts.length < mentionIndex + 3) {
    await message.reply("Kullanım: `.ekle @kullanıcı nitelik +değer`\nÖrnek: `.ekle @Ali Hızlanma +5`");
    return true;
  }

  const attributeParts: string[] = [];
  let amountStr = "";
  
  for (let i = mentionIndex + 1; i < parts.length; i++) {
    if (parts[i].match(/^[+-]?\d+$/)) {
      amountStr = parts[i];
      break;
    } else if (parts[i].match(/^[+-]\d+$/)) {
      amountStr = parts[i];
      break;
    } else {
      attributeParts.push(parts[i]);
    }
  }
  
  const attributeInput = attributeParts.join(" ");
  const amount = parseInt(amountStr.replace("+", ""));
  
  if (isNaN(amount) || amount === 0) {
    await message.reply("Geçerli bir değer girin. Örnek: `.ekle @Ali Hızlanma +5`");
    return true;
  }

  const attribute = findAttribute(attributeInput);
  if (!attribute) {
    await message.reply(`Geçersiz nitelik: "${attributeInput}"\nGeçerli nitelikler için \`.nitelikler\` yazın.`);
    return true;
  }

  // Store data temporarily and show button
  const storeKey = `ekle_${message.author.id}_${Date.now()}`;
  pendingAddAttributeData.set(storeKey, {
    userId: mentionedUser.id,
    username: mentionedUser.username,
    attributeDbField: attribute.dbField,
    amount
  });
  
  const confirmButton = new ButtonBuilder()
    .setCustomId(`ekle_confirm_${storeKey}`)
    .setLabel("Sebep ile Onayla")
    .setStyle(ButtonStyle.Primary);
  
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);
  
  await message.reply({
    content: `**${mentionedUser.username}** için **${attribute.displayName}** niteliği **+${amount}** eklenecektir.\nSebebi belirtmek için aşağıdaki butona tıklayın:`,
    components: [row],
  });
  
  return true;
}

async function handleFullUp(message: Message): Promise<boolean> {
  if (!message.content.toLowerCase().startsWith(".fulle")) return false;
  
  // Sadece alonedark13. kullanabilsin
  if (message.author.username !== "alonedark13.") {
    await message.reply("Bu komutu kullanma yetkisine sahip değilsiniz.");
    return true;
  }

  const mentionedUser = message.mentions.users.first();
  if (!mentionedUser) {
    await message.reply("Kullanım: `.fulle @kullanıcı`\nÖrnek: `.fulle @Ali`");
    return true;
  }

  // Set all attributes to 99
  const fullData: any = {};
  for (const attr of ATTRIBUTES) {
    fullData[attr.dbField] = 99;
    fullData[attr.weeklyField] = 99;
  }
  fullData.updatedAt = new Date();

  const player = await getOrCreatePlayer(mentionedUser.id, mentionedUser.username);
  await db.update(players).set(fullData).where(eq(players.id, player.id));
  
  await message.react("✅");
  await message.reply(`**${mentionedUser.username}** tüm nitelikleri maksimuma yükseltildi! (99/99)`);
  
  return true;
}

async function handleWeeklyRanking(message: Message): Promise<boolean> {
  if (message.content.toLowerCase() === ".haftalık") {
    try {
      const allPlayers = await db.select().from(players);
      
      // Calculate total weekly training for each player
      const playerStats = allPlayers.map(player => {
        let totalWeekly = 0;
        for (const attr of ATTRIBUTES) {
          const weeklyValue = player[attr.weeklyField as keyof typeof player] as number;
          totalWeekly += weeklyValue || 0;
        }
        return { player, totalWeekly };
      });

      // Sort by total weekly (descending) and filter those with training - TOP 5
      const ranked = playerStats
        .filter(p => p.totalWeekly > 0)
        .sort((a, b) => b.totalWeekly - a.totalWeekly)
        .slice(0, 5);

      if (ranked.length === 0) {
        await message.reply("Henüz antrenman yapan oyuncu yok!");
        return true;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle("🏆 Haftalık En Çok Başan Oyuncular")
        .setDescription("Bu haftanın en iyi eğitim yapan oyuncuları")
        .setTimestamp();

      let rankText = "";
      for (let i = 0; i < ranked.length; i++) {
        const { player, totalWeekly } = ranked[i];
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        rankText += `${medal} **${player.username}** - ${totalWeekly} puan\n`;
      }

      embed.addFields({ name: "Sırala", value: rankText, inline: false });

      await message.reply({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error("Weekly ranking error:", error);
      await message.reply("Haftalık sıralama alınırken hata oluştu.");
      return true;
    }
  }

  if (message.content.toLowerCase() !== ".sırala") return false;

  try {
    const allPlayers = await db.select().from(players);
    
    // Calculate total weekly training for each player
    const playerStats = allPlayers.map(player => {
      let totalWeekly = 0;
      for (const attr of ATTRIBUTES) {
        const weeklyValue = player[attr.weeklyField as keyof typeof player] as number;
        totalWeekly += weeklyValue || 0;
      }
      return { player, totalWeekly };
    });

    // Sort by total weekly (descending) and filter those with training
    const ranked = playerStats
      .filter(p => p.totalWeekly > 0)
      .sort((a, b) => b.totalWeekly - a.totalWeekly)
      .slice(0, 10);

    if (ranked.length === 0) {
      await message.reply("Henüz antrenman yapan oyuncu yok!");
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Haftalık En Çok Nitelik Basan Oyuncular")
      .setDescription("Bu haftanın en iyi eğitim yapan oyuncuları")
      .setTimestamp();

    let rankText = "";
    for (let i = 0; i < ranked.length; i++) {
      const { player, totalWeekly } = ranked[i];
      const position = `#${i + 1}`;
      rankText += `${position} **${player.username}** - ${totalWeekly} puan\n`;
    }

    embed.addFields({ name: "Sırala", value: rankText, inline: false });

    await message.reply({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error("Ranking error:", error);
    await message.reply("Sıralama alınırken hata oluştu.");
    return true;
  }
}

async function handleTraining(message: Message) {
  const content = message.content.toLowerCase();
  
  // Match format: +1 nitelik (ONLY +1 allowed)
  const match = content.match(/^\+1\s+(.+)$/);
  if (!match) return false;
  
  const attributeInput = match[1].trim();
  const attribute = findAttribute(attributeInput);
  
  if (!attribute) return false;

  const userId = message.author.id;
  const now = Date.now();
  const lastTrainingTime = trainingCooldown.get(userId);
  
  // Check cooldown
  if (lastTrainingTime && now - lastTrainingTime < COOLDOWN_MS) {
    const remainingMs = COOLDOWN_MS - (now - lastTrainingTime);
    const remainingMins = Math.ceil(remainingMs / 60000);
    await message.react("⏳");
    await message.reply(`Antrenman cooldown'ında. **${remainingMins} dakika** sonra tekrar antrenman yapabilirsiniz.`);
    return true;
  }

  const player = await getOrCreatePlayer(userId, message.author.username);
  
  const currentValue = player[attribute.dbField as keyof typeof player] as number;
  const currentWeekly = player[attribute.weeklyField as keyof typeof player] as number;
  
  let newValue = currentValue + 1;
  let newWeekly = currentWeekly + 1;
  
  // Max 99 limit (cap if exceeds)
  if (newValue > 99) {
    newValue = 99;
    newWeekly = 99;
    await message.react("⚠️");
    await message.reply(`**${attribute.displayName}** niteliği maksimuma (99) ulaştı!`);
  } else {
    await message.react("✅");
    await message.reply({
      content: `**${attribute.displayName}** niteliği **+1** arttı! Yeni değer: **${newValue}**`,
    });
  }
  
  const updateData: any = {
    [attribute.dbField]: newValue,
    [attribute.weeklyField]: newWeekly,
    updatedAt: new Date(),
  };
  
  await db.update(players).set(updateData).where(eq(players.id, player.id));
  
  await db.insert(trainingLogs).values({
    playerId: player.id,
    attribute: attribute.dbField,
    amount: 1,
  });
  
  // Update cooldown
  trainingCooldown.set(userId, now);
  
  return true;
}

const userStates = new Map<string, { showWeekly: boolean; targetUserId?: string }>();
const ticketCounters = new Map<string, number>(); // guildId -> counter
const userTickets = new Map<string, string>(); // userId -> channelId

client.on("ready", () => {
  console.log(`✅ Bot hazır! ${client.user?.tag} olarak giriş yapıldı.`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  try {
    if (message.content.toLowerCase() === ".komutlar") {
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle("Bot Komutları")
        .setDescription("Tüm mevcut komutlar:")
        .addFields(
          { name: ".komutlar", value: "Bu mesajı göster", inline: false },
          { name: ".nitelikler", value: "Antrenman yapılabilecek tüm nitelikleri göster", inline: false },
          { name: ".s", value: "Kendi niteliklerini göster", inline: false },
          { name: ".s @kullanıcı", value: "Başka bir oyuncunun niteliklerini göster", inline: false },
          { name: "+1 nitelik", value: "Nitelik antrenmanı yap  (1 saat cooldown)\nÖrnek: `+1 hızlanma` veya `+1 voleler`", inline: false },
          { name: ".haftalık", value: "Haftalık en çok başan oyuncular (Top 5)", inline: false },
          { name: ".sırala", value: "Haftalık leaderboard göster (Top 10)", inline: false },
          { name: ".ekle @kullanıcı nitelik +değer (ADMIN)", value: "Oyuncu niteliğine değer ekle (sebep ile modal)\nÖrnek: `.ekle @Ali Hızlanma +5`", inline: false },
          { name: ".sil @kullanıcı nitelik [-sayı] (ADMIN)", value: "Oyuncunun niteliğini sil veya azalt\nÖrnek: `.sil @Ali Hızlanma` veya `.sil @Ali Hızlanma -5` veya `.sil @Ali 1 -5`", inline: false },
          { name: ".sıfırla (ADMIN)", value: "Tüm oyuncuların niteliklerini sıfırla", inline: false },
          { name: ".fulle @kullanıcı (alonedark13. ONLY)", value: "Oyuncunun tüm niteliklerini 99'a çıkar", inline: false },
          { name: ".penaltı", value: "Rastgele penaltı sonucu (Gol, Kaleci, Aut, Direk, Defans)", inline: false },
          { name: ".ticketkur @rol", value: "Ticket sistemi mesajı gönder (rol zorunlu)", inline: false },
          { name: ".ticketsırala", value: "Ticket kapatma sıralaması (haftalık + tüm zamanlar)", inline: false }
        )
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    if (message.content.toLowerCase() === ".nitelikler") {
      const categories = [...new Set(ATTRIBUTES.map(a => a.category))];
      let response = "**Antrenman Yapılabilecek Nitelikler:**\n\n";
      for (const category of categories) {
        const attrs = ATTRIBUTES.filter(a => a.category === category);
        response += `**${category}**\n`;
        response += attrs.map(a => a.displayName).join(", ") + "\n\n";
      }
      response += "**Kullanım:** `+1 nitelik ismi`\n**Örnek:** `+1 voleler` veya `+1 hızlanma`";
      await message.reply(response);
      return;
    }

    if (message.content.toLowerCase() === ".s" || message.content.toLowerCase().startsWith(".s ")) {
      let targetUser = message.author;
      const mentionedUser = message.mentions.users.first();
      if (mentionedUser) targetUser = mentionedUser;
      
      const player = await getOrCreatePlayer(targetUser.id, targetUser.username);
      const guildMember = await message.guild?.members.fetch(targetUser.id).catch(() => null);
      const nickname = guildMember?.nickname || undefined;
      
      const embed = await createAllAttributesEmbed(player, false, nickname);
      const viewButtons = createViewButtons();
      userStates.set(message.author.id, { showWeekly: false, targetUserId: targetUser.id });
      await message.reply({ embeds: [embed], components: [viewButtons] });
      return;
    }

    if (message.content.toLowerCase().startsWith(".ticketkur")) {
      const mentionedRole = message.mentions.roles.first();
      
      if (!mentionedRole) {
        await message.reply("❌ Lütfen ticket yetkilisi rolünü etiketleyin!\n**Örnek:** `.ticketkur @Ticket Yetkilisi`");
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle("Ticket Sistemi")
        .setDescription("Aşağıdaki butonla kendine özel ticketını açabilirsin")
        .setTimestamp();
      const openButton = new ButtonBuilder()
        .setCustomId(`ticket_open_${mentionedRole.id}`)
        .setLabel("Ticket Aç")
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(openButton);
      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (message.content.toLowerCase() === ".penaltı") {
      const outcomes = ["Gol", "Kaleci", "Aut", "Direk", "Defans"];
      const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle("Penaltı")
        .setDescription(`**Sonuç: ${randomOutcome}**`)
        .setTimestamp();
      await message.reply({ embeds: [embed] });
      return;
    }

    if (message.content.toLowerCase() === ".ticketsırala") {
      const closedTickets = await db.select().from(tickets).where(eq(tickets.status, "closed"));
      
      if (closedTickets.length === 0) {
        await message.reply("Henüz kapalı ticket yok!");
        return;
      }

      // Haftalık (son 7 gün)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyTickets = closedTickets.filter(t => t.closedAt && t.closedAt > weekAgo);
      
      // Haftalık sıralama
      const weeklyStats = new Map<string, { name: string; count: number }>();
      weeklyTickets.forEach(t => {
        if (t.closedByName) {
          const current = weeklyStats.get(t.closedByName) || { name: t.closedByName, count: 0 };
          current.count++;
          weeklyStats.set(t.closedByName, current);
        }
      });

      // All-time sıralama
      const allTimeStats = new Map<string, { name: string; count: number }>();
      closedTickets.forEach(t => {
        if (t.closedByName) {
          const current = allTimeStats.get(t.closedByName) || { name: t.closedByName, count: 0 };
          current.count++;
          allTimeStats.set(t.closedByName, current);
        }
      });

      const weeklyRanked = Array.from(weeklyStats.values()).sort((a, b) => b.count - a.count);
      const allTimeRanked = Array.from(allTimeStats.values()).sort((a, b) => b.count - a.count);

      let weeklyText = "**Haftalık Ticket Kapatma Sıralaması:**\n";
      weeklyRanked.slice(0, 10).forEach((s, i) => {
        weeklyText += `${i + 1}. **${s.name}** - ${s.count} ticket\n`;
      });

      let allTimeText = "**Tüm Zamanlar Ticket Kapatma Sıralaması:**\n";
      allTimeRanked.slice(0, 10).forEach((s, i) => {
        allTimeText += `${i + 1}. **${s.name}** - ${s.count} ticket\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle("Ticket Kapatma Sıralaması")
        .addFields(
          { name: "📅 Haftalık", value: weeklyText || "Veri yok", inline: false },
          { name: "🏆 Tüm Zamanlar", value: allTimeText || "Veri yok", inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    const rankingHandled = await handleWeeklyRanking(message);
    if (rankingHandled) return;

    const resetHandled = await handleResetAll(message);
    if (resetHandled) return;

    const fullHandled = await handleFullUp(message);
    if (fullHandled) return;

    const deleteHandled = await handleAdminDelete(message);
    if (deleteHandled) return;

    const adminHandled = await handleAdminAdd(message);
    if (adminHandled) return;

    await handleTraining(message);
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

client.on("interactionCreate", async (interaction: Interaction) => {
  try {
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ekle_reason_")) {
      const storeKey = interaction.customId.replace("ekle_reason_", "");
      const data = pendingAddAttributeData.get(storeKey);
      
      if (!data) {
        await interaction.reply({ content: "Veri bulunamadı!", ephemeral: true });
        return;
      }
      
      const reason = interaction.fields.getTextInputValue("reason_input");
      const player = await getOrCreatePlayer(data.userId, data.username);
      const attribute = ATTRIBUTES.find(a => a.dbField === data.attributeDbField);
      
      if (!attribute) {
        await interaction.reply({ content: "Nitelik bulunamadı!", ephemeral: true });
        return;
      }
      
      const currentValue = player[attribute.dbField as keyof typeof player] as number;
      const currentWeekly = player[attribute.weeklyField as keyof typeof player] as number;
      let newValue = currentValue + data.amount;
      let newWeekly = currentWeekly + data.amount;
      
      if (newValue > 99) newValue = 99;
      if (newWeekly > 99) newWeekly = 99;
      
      const updateData: any = {
        [attribute.dbField]: newValue,
        [attribute.weeklyField]: newWeekly,
        updatedAt: new Date(),
      };
      
      await db.update(players).set(updateData).where(eq(players.id, player.id));
      await db.insert(trainingLogs).values({
        playerId: player.id,
        attribute: attribute.dbField,
        amount: data.amount,
      });
      
      await interaction.reply({
        content: `**${data.username}** için **${attribute.displayName}** niteliği **+${data.amount}** değiştirildi! Yeni değer: **${newValue}**\nSebep: ${reason}`,
        ephemeral: true,
      });
      
      pendingAddAttributeData.delete(storeKey);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("ekle_confirm_")) {
        const storeKey = interaction.customId.replace("ekle_confirm_", "");
        const data = pendingAddAttributeData.get(storeKey);
        
        if (!data) {
          await interaction.reply({ content: "Veri bulunamadı!", ephemeral: true });
          return;
        }
        
        const reasonModal = new ModalBuilder()
          .setCustomId(`ekle_reason_${storeKey}`)
          .setTitle("Nitelik Ekleme Sebebi");
        
        const reasonInput = new TextInputBuilder()
          .setCustomId("reason_input")
          .setLabel("Sebebi açıklayın...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(5)
          .setMaxLength(500);
        
        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        reasonModal.addComponents(row);
        
        await interaction.showModal(reasonModal);
        return;
      }

      if (interaction.customId.startsWith("ticket_open_")) {
        const roleId = interaction.customId.replace("ticket_open_", "");
        const guildId = interaction.guildId;
        if (!guildId) {
          await interaction.reply({ content: "Guild bulunamadı!", ephemeral: true });
          return;
        }

        const userId = interaction.user.id;
        const username = interaction.user.username;
        if (userTickets.has(userId)) {
          await interaction.reply({ content: "Zaten açık bir ticketın var!", ephemeral: true });
          return;
        }

        const currentCount = ticketCounters.get(guildId) || 0;
        const newCount = currentCount + 1;
        ticketCounters.set(guildId, newCount);

        const channel = await interaction.guild?.channels.create({
          name: `ticket-${newCount}`,
          type: ChannelType.GuildText,
        });

        if (!channel) {
          await interaction.reply({ content: "Kanal oluşturulamadı!", ephemeral: true });
          return;
        }

        userTickets.set(userId, channel.id);

        // Insert to database
        await db.insert(tickets).values({
          ticketNumber: `#${newCount}`,
          guildId: guildId,
          channelId: channel.id,
          createdBy: userId,
          createdByName: username,
          status: "open",
        });

        const closeButton = new ButtonBuilder()
          .setCustomId(`ticket_close_${channel.id}`)
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);
        const embed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle("Ticket")
          .setDescription(`Ticket **#${newCount}** açıldı. <@&${roleId}>`)
          .setTimestamp();

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `Ticketın açıldı: ${channel}`, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith("ticket_close_")) {
        const channelId = interaction.customId.replace("ticket_close_", "");
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) {
          await interaction.reply({ content: "Kanal bulunamadı!", ephemeral: true });
          return;
        }

        for (const [userId, ticketChannelId] of userTickets.entries()) {
          if (ticketChannelId === channelId) {
            userTickets.delete(userId);
            break;
          }
        }

        // Update in database
        await db.update(tickets)
          .set({
            status: "closed",
            closedBy: interaction.user.id,
            closedByName: interaction.user.username,
            closedAt: new Date(),
          })
          .where(eq(tickets.channelId, channelId));

        await interaction.reply({ content: "Ticket kapatılıyor...", ephemeral: true });
        setTimeout(async () => {
          await channel.delete().catch(console.error);
        }, 1000);
        return;
      }

      const userState = userStates.get(interaction.user.id) || { showWeekly: false };
      const targetUserId = userState.targetUserId || interaction.user.id;
      const player = await getOrCreatePlayer(targetUserId, interaction.user.username);
      
      if (interaction.customId === "show_weekly") {
        userState.showWeekly = true;
        userState.targetUserId = targetUserId;
        userStates.set(interaction.user.id, userState);
        const guildMember = await interaction.guild?.members.fetch(targetUserId).catch(() => null);
        const nickname = guildMember?.nickname || undefined;
        const embed = await createAllAttributesEmbed(player, true, nickname);
        const viewButtons = createViewButtons();
        await interaction.update({ embeds: [embed], components: [viewButtons] });
        return;
      }

      if (interaction.customId === "show_total") {
        userState.showWeekly = false;
        userState.targetUserId = targetUserId;
        userStates.set(interaction.user.id, userState);
        const guildMember = await interaction.guild?.members.fetch(targetUserId).catch(() => null);
        const nickname = guildMember?.nickname || undefined;
        const embed = await createAllAttributesEmbed(player, false, nickname);
        const viewButtons = createViewButtons();
        await interaction.update({ embeds: [embed], components: [viewButtons] });
        return;
      }
    }
  } catch (error) {
    console.error("Interaction handler error:", error);
  }
});

cron.schedule("0 0 * * 1", async () => {
  console.log("Haftalık nitelikler sıfırlanıyor...");
  
  const weeklyResetData: any = {};
  for (const attr of ATTRIBUTES) {
    weeklyResetData[attr.weeklyField] = 0;
  }
  
  await db.update(players).set(weeklyResetData);
  console.log("Haftalık nitelikler sıfırlandı!");
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("DISCORD_TOKEN bulunamadı!");
}

client.login(token);

// Web sunucusu - Health check for monitoring
const app = express();
const port = 3000;

app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: "ok", 
    bot_ready: client.isReady(),
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Sunucu ${port} numaralı bağlantı noktasında yürütülüyor.`);
});
        
