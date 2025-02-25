import { z } from "zod";
import fs from "fs/promises";

const ConfigSchema = z.object({
  lsps: z.array(z.object({
    id: z.string(),
    extensions: z.array(z.string()),
    languages: z.array(z.string()),
    command: z.string(),
    args: z.array(z.string()),
  })),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(path: string): Promise<Config> {
  const config = await fs.readFile(path, "utf8");
  return ConfigSchema.parse(JSON.parse(config));
}
