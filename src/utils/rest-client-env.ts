import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

type RestClientEnv = Record<string, Record<string, unknown>>;
type RestClientEnvValues = Record<string, string>;

async function readRestClientEnv(envName: string): Promise<RestClientEnvValues> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {};
  }

  const envPath = path.join(workspaceFolder.uri.fsPath, "rest-client.env.json");
  let parsed: RestClientEnv;

  try {
    const raw = await fs.readFile(envPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read rest-client.env.json", error);
    }
    return {};
  }

  const env = parsed?.[envName];
  if (!env || typeof env !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => typeof value === "string"),
  ) as RestClientEnvValues;
}

export async function loadRestClientEnvVariables(envName: string) {
  const env = await readRestClientEnv(envName);
  return Object.entries(env).map(([key, value]) => `@${key} = ${value}`);
}

export async function loadRestClientEnvEntries(envName: string) {
  const env = await readRestClientEnv(envName);
  return Object.entries(env).map(([key, value]) => ({
    key,
    value,
  }));
}
