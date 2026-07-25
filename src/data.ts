import type { LeaderboardEntry, Submission } from "./types";

export const submissions: Submission[] = [
  { id: "s1", number: 1, title: "Работа #01", producer: "Kite", duration: "01:18", seed: 4, baseScore: 8.24, rating: 1214 },
  { id: "s2", number: 2, title: "Работа #02", producer: "Sable", duration: "01:27", seed: 7, baseScore: 7.71, rating: 1098 },
  { id: "s3", number: 3, title: "Работа #03", producer: "Noiseform", duration: "01:11", seed: 12, baseScore: 6.92, rating: 1042 },
  { id: "s4", number: 4, title: "Работа #04", producer: "Rin", duration: "01:29", seed: 16, baseScore: 8.57, rating: 1320 },
  { id: "s5", number: 5, title: "Работа #05", producer: "Moss", duration: "00:58", seed: 21, baseScore: 7.46, rating: 1155 },
  { id: "s6", number: 6, title: "Работа #06", producer: "Aster", duration: "01:20", seed: 27, baseScore: 6.75, rating: 1014 },
  { id: "s7", number: 7, title: "Работа #07", producer: "Lowkey", duration: "01:24", seed: 33, baseScore: 8.08, rating: 1261 },
  { id: "s8", number: 8, title: "Работа #08", producer: "Toma", duration: "01:14", seed: 38, baseScore: 7.18, rating: 1127 },
  { id: "s9", number: 9, title: "Работа #09", producer: "Nox", duration: "01:30", seed: 44, baseScore: 7.88, rating: 1193 },
];

export const userSubmission: Submission = {
  id: "me",
  number: 10,
  title: "Midnight Bounce",
  producer: "abdy",
  duration: "01:22",
  seed: 51,
  baseScore: 7.96,
  rating: 1000,
};

export const leaders: LeaderboardEntry[] = [
  { id: "1", name: "Mirae", handle: "@mirae.wav", rating: 1684, wins: 12, battles: 38, trend: 24, avatar: "MI" },
  { id: "2", name: "Northside", handle: "@northside", rating: 1619, wins: 9, battles: 31, trend: 12, avatar: "NS" },
  { id: "3", name: "SP404kid", handle: "@sp404kid", rating: 1587, wins: 7, battles: 26, trend: -3, avatar: "SP" },
  { id: "4", name: "Rin", handle: "@rinmakesnoise", rating: 1512, wins: 6, battles: 34, trend: 18, avatar: "RN" },
  { id: "5", name: "afterhours", handle: "@afterhours", rating: 1478, wins: 5, battles: 22, trend: 7, avatar: "AH" },
  { id: "6", name: "Kite", handle: "@kitebeats", rating: 1431, wins: 5, battles: 29, trend: -8, avatar: "KT" },
  { id: "7", name: "Nox", handle: "@nox.audio", rating: 1398, wins: 3, battles: 17, trend: 15, avatar: "NX" },
  { id: "8", name: "Lowkey", handle: "@lowkey.wav", rating: 1366, wins: 4, battles: 35, trend: 4, avatar: "LK" },
];
