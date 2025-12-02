import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  
  // Atak (Attack)
  ortaAcma: integer("orta_acma").notNull().default(50),
  bitiricilik: integer("bitiricilik").notNull().default(50),
  kafaIsabeti: integer("kafa_isabeti").notNull().default(50),
  kisaPas: integer("kisa_pas").notNull().default(50),
  voleler: integer("voleler").notNull().default(50),
  
  // Savunma (Defense)
  ayaktaMudahale: integer("ayakta_mudahale").notNull().default(50),
  kayarakMudahale: integer("kayarak_mudahale").notNull().default(50),
  
  // Beceri (Skill)
  dribbling: integer("dribbling").notNull().default(50),
  falso: integer("falso").notNull().default(50),
  serbestVurusIsabeti: integer("serbest_vurus_isabeti").notNull().default(50),
  uzunPas: integer("uzun_pas").notNull().default(50),
  topKontrolu: integer("top_kontrolu").notNull().default(50),
  
  // Güç (Power)
  sutGucu: integer("sut_gucu").notNull().default(50),
  ziplama: integer("ziplama").notNull().default(50),
  dayaniklilik: integer("dayaniklilik").notNull().default(50),
  guc: integer("guc").notNull().default(50),
  uzaktanSut: integer("uzaktan_sut").notNull().default(50),
  
  // Hareket (Movement)
  hizlanma: integer("hizlanma").notNull().default(50),
  sprintHizi: integer("sprint_hizi").notNull().default(50),
  ceviklik: integer("ceviklik").notNull().default(50),
  reaksiyonlar: integer("reaksiyonlar").notNull().default(50),
  denge: integer("denge").notNull().default(50),
  
  // Mentalite (Mentality)
  agresiflik: integer("agresiflik").notNull().default(50),
  topKesme: integer("top_kesme").notNull().default(50),
  pozisyonAlma: integer("pozisyon_alma").notNull().default(50),
  gorus: integer("gorus").notNull().default(50),
  penalti: integer("penalti").notNull().default(50),
  
  // Kaleci (Goalkeeper)
  kaleciAtlayisi: integer("kaleci_atlayisi").notNull().default(50),
  kaleciTopKontrolu: integer("kaleci_top_kontrolu").notNull().default(50),
  kaleciVurusu: integer("kaleci_vurusu").notNull().default(50),
  kaleciPozisyonAlma: integer("kaleci_pozisyon_alma").notNull().default(50),
  kaleciRefleksler: integer("kaleci_refleksler").notNull().default(50),
  
  // Weekly stats - Atak
  weeklyOrtaAcma: integer("weekly_orta_acma").notNull().default(0),
  weeklyBitiricilik: integer("weekly_bitiricilik").notNull().default(0),
  weeklyKafaIsabeti: integer("weekly_kafa_isabeti").notNull().default(0),
  weeklyKisaPas: integer("weekly_kisa_pas").notNull().default(0),
  weeklyVoleler: integer("weekly_voleler").notNull().default(0),
  
  // Weekly stats - Savunma
  weeklyAyaktaMudahale: integer("weekly_ayakta_mudahale").notNull().default(0),
  weeklyKayarakMudahale: integer("weekly_kayarak_mudahale").notNull().default(0),
  
  // Weekly stats - Beceri
  weeklyDribbling: integer("weekly_dribbling").notNull().default(0),
  weeklyFalso: integer("weekly_falso").notNull().default(0),
  weeklySerbestVurusIsabeti: integer("weekly_serbest_vurus_isabeti").notNull().default(0),
  weeklyUzunPas: integer("weekly_uzun_pas").notNull().default(0),
  weeklyTopKontrolu: integer("weekly_top_kontrolu").notNull().default(0),
  
  // Weekly stats - Güç
  weeklySutGucu: integer("weekly_sut_gucu").notNull().default(0),
  weeklyZiplama: integer("weekly_ziplama").notNull().default(0),
  weeklyDayaniklilik: integer("weekly_dayaniklilik").notNull().default(0),
  weeklyGuc: integer("weekly_guc").notNull().default(0),
  weeklyUzaktanSut: integer("weekly_uzaktan_sut").notNull().default(0),
  
  // Weekly stats - Hareket
  weeklyHizlanma: integer("weekly_hizlanma").notNull().default(0),
  weeklySprintHizi: integer("weekly_sprint_hizi").notNull().default(0),
  weeklyCeviklik: integer("weekly_ceviklik").notNull().default(0),
  weeklyReaksiyonlar: integer("weekly_reaksiyonlar").notNull().default(0),
  weeklyDenge: integer("weekly_denge").notNull().default(0),
  
  // Weekly stats - Mentalite
  weeklyAgresiflik: integer("weekly_agresiflik").notNull().default(0),
  weeklyTopKesme: integer("weekly_top_kesme").notNull().default(0),
  weeklyPozisyonAlma: integer("weekly_pozisyon_alma").notNull().default(0),
  weeklyGorus: integer("weekly_gorus").notNull().default(0),
  weeklyPenalti: integer("weekly_penalti").notNull().default(0),
  
  // Weekly stats - Kaleci
  weeklyKaleciAtlayisi: integer("weekly_kaleci_atlayisi").notNull().default(0),
  weeklyKaleciTopKontrolu: integer("weekly_kaleci_top_kontrolu").notNull().default(0),
  weeklyKaleciVurusu: integer("weekly_kaleci_vurusu").notNull().default(0),
  weeklyKaleciPozisyonAlma: integer("weekly_kaleci_pozisyon_alma").notNull().default(0),
  weeklyKaleciRefleksler: integer("weekly_kaleci_refleksler").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainingLogs = pgTable("training_logs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  attribute: text("attribute").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const playersRelations = relations(players, ({ many }) => ({
  trainingLogs: many(trainingLogs),
}));

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdByName: text("created_by_name").notNull(),
  ticketSpecialist: text("ticket_specialist"),
  attributes: text("attributes").notNull().default("[]"), // JSON array of attribute names
  reason: text("reason"), // Reason for adding attributes
  closingOrder: integer("closing_order"), // Order for closing queue
  status: text("status").notNull().default("open"), // open, closed
  closedBy: text("closed_by"), // Who closed the ticket
  closedByName: text("closed_by_name"), // Name of who closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const trainingLogsRelations = relations(trainingLogs, ({ one }) => ({
  player: one(players, {
    fields: [trainingLogs.playerId],
    references: [players.id],
  }),
}));

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;
export type TrainingLog = typeof trainingLogs.$inferSelect;
export type InsertTrainingLog = typeof trainingLogs.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
  
