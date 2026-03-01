import { z } from "zod";
import fs from "fs/promises";

const ConfigSchema = z.object({
  lsps: z.array(
    z.object({
      id: z.string(),
      extensions: z.array(z.string()),
      languages: z.array(z.string()),
      command: z.string(),
      args: z.array(z.string()),
      settings: z.optional(z.any(), {
        description:
          "Settings to provide to the LSP server via workspace/configuration",
      }),
    }),
  ),
  methods: z.optional(z.array(z.string()), {
    description:
      "LSP methods to enable, if not provided, all methods will be enabled",
  }),
  workspace: z.optional(z.string(), {
    description: "Path to the workspace to use for the LSP. Defaults to /",
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(path: string): Promise<Config> {
  const stripJsonComments = await import("strip-json-comments");
  const contents = await fs.readFile(path, "utf8");
  const config = stripJsonComments.default(contents);

  return await ConfigSchema.parseAsync(JSON.parse(config));
}
