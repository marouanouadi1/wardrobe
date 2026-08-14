#!/usr/bin/env node
// Bump del patch semver dell'app mobile. Fonte di verità: apps/mobile/app.json
// (expo.version); apps/mobile/package.json viene tenuto sincronizzato.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appJsonPath = fileURLToPath(new URL("../apps/mobile/app.json", import.meta.url));
const pkgJsonPath = fileURLToPath(new URL("../apps/mobile/package.json", import.meta.url));

const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

const current = appJson.expo.version;
const [major, minor, patch] = current.split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;

appJson.expo.version = next;
pkgJson.version = next;

writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");

process.stdout.write(next);
