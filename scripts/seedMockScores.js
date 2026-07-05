import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "../.env");
if (!fs.existsSync(envPath)) {
  console.error("Fichier .env introuvable !");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL ou Anon Key manquante dans le fichier .env !");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FAKE_PLAYERS = [
  { username: "NeoInvader", avatarId: "invader_1", color: "cyan" },
  { username: "ArcadeKing", avatarId: "invader_2", color: "magenta" },
  { username: "PixelQueen", avatarId: "invader_3", color: "green" },
  { username: "GeoWizard", avatarId: "invader_4", color: "yellow" },
  { username: "ChronoMapper", avatarId: "invader_5", color: "purple" },
  { username: "Atlas_99", avatarId: "invader_6", color: "orange" },
  { username: "VectorBoy", avatarId: "invader_7", color: "blue" },
  { username: "StarLord", avatarId: "invader_8", color: "lime" },
  { username: "MsPacman", avatarId: "invader_9", color: "pink" },
  { username: "RetroRacer", avatarId: "invader_10", color: "amber" },
  { username: "CyberTrotter", avatarId: "invader_11", color: "violet" },
  { username: "ZeroCool", avatarId: "invader_12", color: "red" }
];

const GAME_MODES = ["countries", "capitals", "departments", "rivers_mountains"];

// Helper to generate UUID v4
const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

async function seed() {
  console.log("Démarrage de la génération des scores de test...");
  
  for (const player of FAKE_PLAYERS) {
    const profileId = uuidv4();
    
    // 1. Create Profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: profileId,
        username: player.username,
        avatar_id: player.avatarId,
        avatar_color: player.color,
        updated_at: new Date().toISOString()
      });
      
    if (profileError) {
      console.error(`Erreur création profil ${player.username}:`, profileError.message);
      continue;
    }
    
    console.log(`Profil créé: ${player.username}`);
    
    // 2. Insert 1 to 3 random scores for this player
    const numScores = Math.floor(1 + Math.random() * 3);
    const selectedModes = [...GAME_MODES].sort(() => 0.5 - Math.random()).slice(0, numScores);
    
    for (const mode of selectedModes) {
      let maxScoreVal = 100;
      if (mode === "countries") maxScoreVal = 197;
      else if (mode === "capitals") maxScoreVal = 197;
      else if (mode === "departments") maxScoreVal = 101;
      else if (mode === "rivers_mountains") maxScoreVal = 50;
      
      const score = Math.floor(5 + Math.random() * (maxScoreVal - 5));
      const timeSpentSeconds = Math.floor(30 + Math.random() * 270);
      
      const { error: scoreError } = await supabase
        .from("leaderboards")
        .insert({
          profile_id: profileId,
          game_mode: mode,
          score,
          time_spent_seconds: timeSpentSeconds,
          created_at: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000).toISOString()
        });
        
      if (scoreError) {
        console.error(`Erreur score pour ${player.username} en mode ${mode}:`, scoreError.message);
      } else {
        console.log(`  Score inséré: ${mode} -> ${score} pts en ${timeSpentSeconds}s`);
      }
    }
  }
  
  console.log("Génération terminée !");
}

seed();
