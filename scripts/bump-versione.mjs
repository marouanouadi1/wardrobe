#!/usr/bin/env node
// Bump semver di un target del monorepo, con il *livello* (major/minor/patch)
// dedotto dai commit invece che fissato a "patch". Prima di questo script la
// versione dell'app contava i merge, non i cambiamenti: una feature intera e
// un fix CSS di una riga alzavano entrambi il patch. Il perché sta in
// docs/adr/0005-le-versioni-vengono-dai-commit.md.
//
//   node scripts/bump-versione.mjs mobile            scrive i file, stampa la versione
//   node scripts/bump-versione.mjs api --prova       non scrive niente
//
// stdout = solo la nuova versione (la CI la legge in $GITHUB_OUTPUT).
// stderr = il livello scelto e il perché, così nel log di Actions si vede.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const radice = fileURLToPath(new URL("..", import.meta.url));
const percorso = (relativo) => fileURLToPath(new URL(relativo, import.meta.url));

// I `percorsi` di ogni target sono gli stessi del filtro `paths:` del workflow
// che lo rilascia. È il punto che tiene separate le due versioni: un `feat:`
// solo backend non deve alzare il minor dell'app, e viceversa.
const TARGET = {
  mobile: {
    prefissoTag: "mobile-v",
    percorsi: ["apps/mobile", "packages/contracts"],
    // Unica fonte di verità: apps/mobile/app.json (expo.version).
    // apps/mobile/package.json viene tenuto sincronizzato.
    leggi: () => leggiJson(percorso("../apps/mobile/app.json")).expo.version,
    scrivi(nuova) {
      const app = percorso("../apps/mobile/app.json");
      const pkg = percorso("../apps/mobile/package.json");
      const appJson = leggiJson(app);
      const pkgJson = leggiJson(pkg);
      appJson.expo.version = nuova;
      pkgJson.version = nuova;
      scriviJson(app, appJson);
      scriviJson(pkg, pkgJson);
    },
  },
  api: {
    prefissoTag: "api-v",
    percorsi: ["services/api", "packages/contracts"],
    // Unica fonte di verità: la `version` del blocco [project]. L'ancora a
    // inizio riga è quello che la distingue da `target-version` e
    // `python_version`, che stanno nello stesso file.
    leggi: () => versioneDiPyproject(readFileSync(pyproject(), "utf8")),
    scrivi(nuova) {
      const file = pyproject();
      const testo = readFileSync(file, "utf8");
      versioneDiPyproject(testo); // rifà il controllo di unicità prima di scrivere
      writeFileSync(file, testo.replace(RE_VERSIONE_PYPROJECT, `version = "${nuova}"`));
    },
  },
};

const RE_VERSIONE_PYPROJECT = /^version = "(\d+\.\d+\.\d+)"$/m;
const pyproject = () => percorso("../services/api/pyproject.toml");

function leggiJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function scriviJson(file, contenuto) {
  writeFileSync(file, JSON.stringify(contenuto, null, 2) + "\n");
}

function versioneDiPyproject(testo) {
  const trovate = testo.match(new RegExp(RE_VERSIONE_PYPROJECT.source, "gm")) ?? [];
  if (trovate.length !== 1) {
    throw new Error(
      `services/api/pyproject.toml: attesa una sola riga \`version = "x.y.z"\`, trovate ${trovate.length}`,
    );
  }
  return RE_VERSIONE_PYPROJECT.exec(testo)[1];
}

const git = (argomenti, opzioni = {}) =>
  execFileSync("git", argomenti, { cwd: radice, encoding: "utf8", ...opzioni });

// git describe esce con errore (non con una stringa vuota) se nessun tag col
// prefisso è raggiungibile: è il caso del primo rilascio di un target. Il suo
// stderr è silenziato perché quel "fatal:" non è un guasto, è la risposta.
function ultimoTag(prefisso) {
  try {
    return git(["describe", "--tags", "--match", `${prefisso}*`, "--abbrev=0"], {
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const RE_CONVENTIONAL = /^([a-z]+)(?:\(([^)]*)\))?(!)?: .+/;
const RE_MERGE = /^Merge (pull request|branch|remote-tracking branch)\b/;
const RE_BUMP_BOT = /^chore\([a-z0-9-]+\): bump versione\b/;
const RE_ROTTURA = /(^|\n)BREAKING[ -]CHANGE[:!]/;

const ORDINE = ["patch", "minor", "major"];

// I merge qui non sono squash: il subject di un merge commit è
// "Merge pull request #N from <branch>", e il titolo della PR — che è il
// conventional commit vero — finisce nel *corpo*. Leggere solo il subject
// classificherebbe ogni merge come patch.
function livelloDi({ subject, corpo }) {
  if (RE_BUMP_BOT.test(subject)) return null;
  const titolo = RE_MERGE.test(subject)
    ? (corpo.split("\n").find((riga) => riga.trim()) ?? "").trim()
    : subject;
  if (RE_ROTTURA.test(`\n${subject}\n${corpo}`)) return { livello: "major", titolo };
  const conventional = RE_CONVENTIONAL.exec(titolo);
  if (!conventional) return { livello: "patch", titolo };
  const [, tipo, , rottura] = conventional;
  if (rottura) return { livello: "major", titolo };
  return { livello: tipo === "feat" ? "minor" : "patch", titolo };
}

const CAMPO = "\x1f";
const RECORD = "\x1e";

function commitDa(tag, percorsi) {
  const grezzo = git([
    "log",
    tag ? `${tag}..HEAD` : "HEAD",
    `--format=%s${CAMPO}%b${RECORD}`,
    "--",
    ...percorsi,
  ]);
  return grezzo
    .split(RECORD)
    .map((record) => record.replace(/^\n+/, ""))
    .filter((record) => record.trim())
    .map((record) => {
      const [subject, corpo = ""] = record.split(CAMPO);
      return { subject: subject.trim(), corpo };
    });
}

function livelloDaiCommit(prefissoTag, percorsi) {
  const tag = ultimoTag(prefissoTag);
  if (!tag) {
    // Primo rilascio del target: la storia intera non è il changelog di
    // questo rilascio, quindi si parte da un patch e da lì si conta.
    return { livello: "patch", motivo: `nessun tag ${prefissoTag}*: primo rilascio, patch` };
  }

  const valutati = commitDa(tag, percorsi)
    .map((c) => livelloDi(c))
    .filter((c) => c !== null);

  if (valutati.length === 0) {
    return { livello: "patch", motivo: `nessun commit rilevante dopo ${tag}: patch` };
  }

  const vincente = valutati.reduce((a, b) =>
    ORDINE.indexOf(b.livello) > ORDINE.indexOf(a.livello) ? b : a,
  );
  return {
    livello: vincente.livello,
    motivo: `${valutati.length} commit dopo ${tag}; vince ${vincente.livello} da «${vincente.titolo}»`,
  };
}

function prossima(corrente, livello) {
  // Senza questo controllo una versione malformata diventerebbe "NaN.NaN.NaN"
  // e verrebbe scritta nei file senza che nessuno protesti.
  if (!/^\d+\.\d+\.\d+$/.test(corrente)) {
    throw new Error(`versione corrente non semver: «${corrente}»`);
  }
  const [major, minor, patch] = corrente.split(".").map(Number);
  // Regola 0.x: finché il major è 0, semver dice che tutto può rompersi, e
  // un `feat!:` non è la decisione di dichiarare l'API stabile. Un livello
  // major diventa un bump minor; il salto a 1.0.0 resta un commit a mano.
  if (livello === "major" && major === 0) {
    process.stderr.write(
      `regola 0.x: breaking change su ${corrente} -> bump minor, non 1.0.0 (il passaggio a 1.0.0 si fa a mano)\n`,
    );
    livello = "minor";
  }
  if (livello === "major") return `${major + 1}.0.0`;
  if (livello === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const [nomeTarget, ...resto] = process.argv.slice(2);
const prova = resto.includes("--prova");
// Object.hasOwn e non `TARGET[nomeTarget]` da solo: "constructor" e compagnia
// risolverebbero su un membro del prototipo, e l'errore arriverebbe più tardi e
// più confuso.
const target = Object.hasOwn(TARGET, nomeTarget ?? "") ? TARGET[nomeTarget] : null;

if (!target) {
  process.stderr.write(
    `uso: node scripts/bump-versione.mjs <${Object.keys(TARGET).join("|")}> [--prova]\n`,
  );
  process.exit(1);
}

const corrente = target.leggi();
const { livello, motivo } = livelloDaiCommit(target.prefissoTag, target.percorsi);
process.stderr.write(`${nomeTarget}: ${motivo}\n`);

const nuova = prossima(corrente, livello);
process.stderr.write(
  `${nomeTarget}: ${corrente} -> ${nuova}${prova ? " (prova, niente scritto)" : ""}\n`,
);

if (!prova) target.scrivi(nuova);

process.stdout.write(nuova);
