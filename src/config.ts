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
  methods: z.optional(z.array(z.string()), {
    description: "LSP methods to enable, if not provided, all methods will be enabled",
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(path: string): Promise<Config> {
  const stripJsonComments = await import("strip-json-comments");
  const contents = await fs.readFile(path, "utf8");
  const config = stripJsonComments.default(contents);

  return await ConfigSchema.parseAsync(JSON.parse(config));
}
