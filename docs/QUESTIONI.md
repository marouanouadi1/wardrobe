# QUESTIONI — le scelte in sospeso

Le decisioni che l'utente ha **parcheggiato su cose già costruite**. Non è
`DOMANDE_APERTE.md`, che riguarda ciò che la specifica non dice ancora:

> **QUESTIONI** = *«è costruito — come lo vogliamo?»*
> **DOMANDE_APERTE** = *«la specifica non lo dice ancora»*

**Una questione ricordata a voce è una questione persa.** Si scrive nel momento in
cui emerge, non a fine sessione. Quando l'utente risponde, la voce **si sposta**
fra le chiuse con la sua data e la risposta testuale: non si cancella, perché una
risposta senza la sua domanda non si capisce.

Se stai per toccare qualcosa che una di queste voci nomina, **la decisione arriva
prima del codice**.

## Aperte

### Q-13 — Inviti con l'hook, o registrazioni chiuse sul progetto Supabase?
**Aperta il:** 2026-09-25 · **Tocca:** `supabase/migrations/` (hook e `privato.inviti`), il pannello di Supabase

Oggi chi può creare un account lo decide l'hook `privato.accetta_solo_invitati`, che
guarda la tabella `privato.inviti`: è `EMAIL_AMMESSE` portato nel database, e vale anche
per chi entra con Google. Ma **vale solo se l'hook è acceso sul progetto vero**:
`config.toml` accende quello locale, non l'altro, e un progetto nuovo nasce con le
registrazioni aperte. Spento per sbaglio, chiunque abbia la chiave pubblica dell'app — che
sta nell'APK — si registra, e con l'account usa l'IA a spese tue e le quote del piano Free.
Nessun controllo oggi se ne accorgerebbe (`T-56`).

*Cosa cambia a seconda della risposta:*
- **Hook** (com'è oggi): si aggiungono gli inviti da SQL o dal pannello, e serve il
  controllo di `T-56` perché lo spegnimento non passi in silenzio.
- **Registrazioni chiuse** (`enable_signup = false`) e account creati o invitati dal
  pannello: sparisce l'hook con la sua tabella, la policy e lo step della CI. Il rimedio
  toglie righe. Va provato prima che l'accesso con Google di un utente già esistente si
  colleghi al suo account anche con le registrazioni chiuse.

### Q-08 — Il «+» della barra delle schede è l'unica azione tinta d'accento
**Aperta il:** 2026-09-22 · **Tocca:** `apps/mobile/app/(tabs)/_layout.tsx`

La regola nuova dice che l'azione è inchiostro. Il «+» centrale della barra la
viola, e la violava già prima con l'ambra: è dipinto `primario` perché la barra
**è** inchiostro, e un bottone d'inchiostro dentro una pillola d'inchiostro non
si vede. Nel deck è la stessa identica scelta, con lo stesso identico colore.

È scritta come eccezione dichiarata nel docblock di `tokens.ts` e in
`.claude/rules/react-native.md`. *Cosa cambia a seconda della risposta:* o
l'eccezione resta e questa voce si chiude, o il «+» va risolto altrimenti —
un contorno chiaro, o una barra che non è inchiostro.

### Q-01 — Chi è normativo: `CLAUDE.md` o il docblock della primitiva?
**Aperta il:** 2026-09-11 · **Tocca:** `CLAUDE.md`, `apps/mobile/src/ui/fondo.tsx`

`CLAUDE.md` ha descritto per due giorni la regola di `su` nella forma
pre-refactor («inoltra la prop»), mentre il commit `ee7f492` l'aveva già
sostituita con un contesto React (assert / inoltra / eredita). Il file che un
agente carica per primo diceva di scrivere codice vecchio.

*Nel frattempo:* vince il codice, e `CLAUDE.md` è stato allineato citando
`fondo.tsx` invece di riassumerlo.

*Cosa cambia a seconda della risposta:* se la regola generale è «il docblock
vince e il file di progetto lo cita», allora ogni convenzione che vive anche nel
codice va scritta come rimando, non come copia — e vale per tutte le rules, non
solo per questa.

### Q-02 — Un ADR che cita file rimossi si marca «superato» o resta immutabile?
**Aperta il:** 2026-09-11 · **Tocca:** `docs/adr/0004-l-avatar-veste-le-foto-non-i-colori.md`

L'ADR 0004 cita `MODI_AVATAR` e il manichino 3D, rimossi insieme al playground.
La decisione di prodotto che contiene è ancora valida; i riferimenti al codice no.

Pesa perché, non esistendo un `DECISION_LOG.md`, gli ADR sono **l'unico registro
delle decisioni**: se invecchiano in silenzio, non resta niente.

*Cosa cambia:* «immutabile» significa aggiungere un ADR nuovo che lo supera;
«si marca» significa una riga di stato in testa, e allora serve la convenzione.

### Q-03 — Si confermano gli id `gpt-5.1` e `gemini-2.5-pro`?
**Aperta il:** 2026-09-11 · **Tocca:** `services/api/src/adapters/llm/`

Non vengono da nessun SDK: sono i nomi indicati nel design. Quelli di Claude
arrivano dall'SDK ufficiale.

*Nel frattempo:* non bloccano — sono sovrascrivibili da `MODELLI_OPENAI` e
`MODELLI_GOOGLE`.

### Q-04 — `apps/web` resta un segnaposto o si toglie?
**Aperta il:** 2026-09-11 · **Tocca:** `apps/web/`, `package.json` (workspaces)

Due file, un `dev` che esce con 1, registrato nei workspace. Costa poco tenerlo e
confonde chi legge `## Struttura` del README.

*Nel frattempo:* nessun agente ci scrive — il quando e il perché riaprirlo
stanno in `apps/web/README.md`, che nomina perfino Next.js come candidato.

### Q-05 — I buchi di numerazione si documentano o si riempiono?
**Aperta il:** 2026-09-11 · **Tocca:** `services/api/migrations/`, `docs/adr/`

Le migrazioni saltano `0003` e `0004` (playground rimosso); gli ADR partono da
`0004` e i primi tre non sono mai esistiti in git. Oggi lo si scopre solo con un
`ls`.

*Nel frattempo:* i buchi restano — compattare la numerazione delle migrazioni
sarebbe **pericoloso**, perché l'ordine di esecuzione è lessicografico.

## Chiuse

### Q-12 — «Scarica i tuoi dati» passa da una credenziale al portatore
**Chiusa il:** 2026-09-23 · **Risposta:** *va bene così, niente `expo-sharing`*
· **Motivo dato:** l'app oggi la scarica **una persona sola**, il socio, da un
link di GitHub.

**La domanda era.** L'app chiede `POST /esportazione` col suo token, riceve un
indirizzo firmato valido 900 secondi, e lo apre nel browser di sistema. Il
browser non ha il nostro token: la firma è l'autorizzazione. Il prezzo,
misurato da un audit di `security` e non stimato: l'indirizzo è **rigiocabile**
per tutta la sua vita, **non revocabile** (cambiare password non lo annulla;
solo ruotare `JWT_SECRET`, che rompe le foto di tutti), e resta nella
cronologia del browser di sistema, che su Chrome e Safari si sincronizza sul
cloud. L'alternativa era `File.downloadFileAsync` di `expo-file-system` — già
installato, e sa scaricare col bearer token — più `expo-sharing` per far
arrivare il file alla persona invece che nella sandbox dell'app.

**Perché la risposta regge.** Le tre voci del costo valgono tutte *in
proporzione a quante persone hanno un account*. Con due account in
`EMAIL_AMMESSE`, entrambi di persone che si conoscono, una credenziale a un
quarto d'ora nella cronologia di un browser non è una superficie: è un
dettaglio. E `expo-sharing` è un costo **permanente** sul lock, dove questo repo
si è già fatto male tre volte (`T-03`, `T-23`, `T-31`).

**Quando si riapre**, e il segnale è preciso e non a sentimento: **quando
`EMAIL_AMMESSE` smette di essere una lista di persone che si conoscono**. Non
«al lancio», non «quando saremo tanti» — quella variabile. È lo stesso
interruttore che regge `T-46` e `T-47`, ed è il motivo per cui quelle due voci
non sono urgenti oggi e diventano bloccanti il giorno che qualcun altro si
registra.

### Q-11 — La barra delle schede resta accesa sulla scheda d'origine
**Chiusa il:** 2026-09-23 · **Risposta:** *sì, si adotta* · **Lavoro:** `T-40`,
da fare **dopo** `app/capo/[id].tsx`, come fetta a sé.

**La domanda.** Nel deck una vista fuori dalle schede tiene accesa la scheda da
cui ci si arriva: dettaglio capo → Armadio, chat → Oggi, calendario → Profilo.
L'app non illumina niente.

**Cosa è emerso verificando, e che la domanda non sapeva.** Non è una mappa: su
quelle schermate **la barra non c'è**. È disegnata dalla prop `tabBar` di
`<Tabs>` (`app/(tabs)/_layout.tsx:39`) e vive solo dentro il gruppo `(tabs)`;
`capo/[id]`, `suggeritore`, `chat`, `outfit`, `calendario` e `segnalazioni`
sono **fratelli** di `(tabs)` nello Stack di radice (`app/_layout.tsx:66-72`).
Adottare il comportamento del deck vuol dire tirare la barra fuori dal
navigatore — e toccare `Schermata`, che oggi riserva lo spazio in fondo solo
con la prop `tab`.

La scelta è stata confermata **sapendo** questo costo, e con la richiesta
esplicita di non mescolarla al dettaglio del capo.

**Dove ci siamo allontanati dal deck, di proposito.** Nel deck la barra non è
una regola ma un **elenco**: `CHROME` (`sorgenti/comp.js:62`) nomina le dodici
schermate che ce l'hanno, e `dettaglio`, `impostazioni`, `guidafoto`, `add` non
ci sono — lì la barra sparisce. La risposta data qui è invece una **regola**:
una vista raggiunta da una scheda tiene accesa quella scheda. Le due cose
coincidono quasi ovunque e divergono su `capo/[id]` e `impostazioni`, dove
l'app mostra la barra e il deck no. È la regola a vincere, perché è quella che
è stata scelta: un elenco di dodici nomi non dice cosa fare della tredicesima
schermata, e ogni schermata nuova tornerebbe a essere una decisione.
`SCHEDA_DI` in `src/ui/guscio.tsx` è quella regola scritta, e
`test/convenzioni/navigazione.test.ts` pretende che **ogni** rotta di primo
livello vi abbia una risposta — inclusa quella che qualcuno aggiungerà domani.

### Q-10 — Il suggeritore ha tre modi, il deck uno
**Chiusa il:** 2026-09-22 · **Risposta:** *solo la chat, come il deck.* ·
**Tocca:** `apps/mobile/app/suggeritore.tsx`

**La domanda.** `/suggeritore` aveva «Proposte», «Chat» e «Guidato». Il deck ha
la sola chat. Ma il deck è una proposta, e togliere una cosa da un mockup non è
la stessa cosa che togliere codice che gira.

**Cosa era stato detto prima di decidere**, perché la scelta non fosse al buio:
«Guidato» erano tre pillole — *dove vai, che tempo trovi, come ti senti* — che
componevano una frase e la mandavano **allo stesso endpoint della chat**. Non
una funzione a sé: un modo di non digitare.

**Cosa è stato fatto.** `suggeritore.tsx` da 396 righe a 214: via il segmento,
via le tre domande, via la lista di proposte. Restano gli **spunti** («Cosa
metto stasera?», «Fa più freddo, cambia», …), che erano già lì e portano ora
il peso che era di «Guidato»: una riga di pillole invece di tre domande.

**Cosa si è perso davvero**, detto qui e non altrove: chi non vuole scrivere ha
quattro spunti fissi invece di 5×4×4 combinazioni guidate. Nessuna capacità del
backend è andata via — l'endpoint è lo stesso di prima.

**Una conseguenza**: `MotiviProposta` (`src/ui/capi.tsx`) era usata **solo**
dalla lista di proposte, e adesso non ha lettori. Voce `T-39`.

### Q-06 — Il prodotto si chiama Aura: fin dove arriva il rename?
**Chiusa il:** 2026-09-22 · **Risposta:** *fino in fondo — anche pacchetti,
cartelle e tabelle.*

**Fatto adesso**, perché sta dentro il redesign e non costa niente: i **testi
visibili**. «Chiedi tu ad Aura», «Chiedi ad Aura», «proposto da Aura», e
`app.json` → `name: "Aura"` (il nome sotto l'icona).

**Non fatto**, e di proposito: gli **identificatori**. Gli scope `@wardrobe/*`,
le cartelle, il repo, i container, lo schema SQL, e in `app.json` lo `slug`, lo
`scheme`, il `bundleIdentifier` iOS e l'`android.package`. Attraversano
backend, contratti, CI e deploy, e uno di essi **non è reversibile**:
`com.wardrobe.armadio` è l'identità dell'app per lo store e per chi ce l'ha
installata — cambiarlo non rinomina l'app, ne pubblica un'altra. Va deciso a
parte, con il suo piano. Voce `T-38` in `docs/DA_FARE.md`.

*(La domanda, com'era posta:)*

**Aperta il:** 2026-09-18 · **Tocca:** `apps/mobile/app.json` (`name`, `slug`),
`package.json` dei workspace (`@wardrobe/*`), i testi delle schermate, il repo

Il nome del prodotto è **Aura** — deciso dall'utente il 2026-09-18, mentre si
disegnava l'avvio dell'app (`schermate/aura-avvio.html`, dove il wordmark è già
nel font vero dell'interfaccia, Bricolage Grotesque ExtraBold). Nel codice il
nome *Wardrobe* compare in posti di natura diversa, e non è detto che debbano
cambiare tutti insieme:

| Dove | Cosa comporta cambiarlo |
|---|---|
| i testi visibili («Chiedi tu a Wardrobe», l'intro, i titoli) | nessun rischio: è copy |
| `apps/mobile/app.json` → `name`, `slug` | è il nome sotto l'icona sul telefono; lo `slug` tocca EAS e il progetto Expo |
| gli scope npm `@wardrobe/contracts`, `@wardrobe/mobile` | rinominarli tocca ogni import e il lockfile — e non si vede da fuori |
| il nome del repo e delle cartelle | tocca i remote, i workflow e i percorsi in `docs/deploy.md` |

*Nel frattempo:* niente è stato rinominato. Le bozze mostrano «Aura» perché è il
prodotto, ma il codice dice ancora Wardrobe ovunque.

*Cosa cambia a seconda della risposta:* se il rename si ferma ai testi visibili è
mezz'ora di lavoro; se arriva agli scope dei pacchetti è una PR che tocca ogni
file che importa un contratto, e va fatta in un colpo solo.

### Q-09 — Gli outfit: segmento dentro l'Armadio, e `/outfit` resta
**Chiusa il:** 2026-09-22 · **Risposta:** *segmento dentro l'Armadio, rotta
conservata.* · **Tocca:** `apps/mobile/app/(tabs)/armadio.tsx`,
`app/outfit.tsx`, `src/ui/capi.tsx`, `src/ui/scheletri.tsx`

**La domanda.** Nel deck gli outfit salvati non sono una schermata a sé: sono
un segmento «Capi | Outfit» in cima all'Armadio, e la riga «Outfit salvati» ha
lasciato il Profilo. Nell'app `/outfit` è una rotta autonoma. Il deck è una
proposta, e togliere una cosa da un mockup non è la stessa cosa che togliere
una rotta che gira e che può stare in un link.

**Cosa è stato fatto.** Il segmento c'è, come nel deck. `/outfit` **resta**: il
rimando dal Profilo continua a funzionare e un link diretto arriva ancora da
qualche parte. Le due viste mostrano lo **stesso** `ElencoOutfit`
(`src/ui/capi.tsx`) — non due liste copiate, che divergerebbero in silenzio
come è già successo con le enum.

**Due divergenze dal deck, dichiarate.** La scheda di un outfit tiene la
**freccia** che veste l'avatar (nel deck la scheda porta a `outfitdet`, che
nell'app non esiste: senza freccia non porterebbe da nessuna parte) e mostra
l'**occasione**, che il deck in elenco non disegna ma è un dato vero già
salvato.

### Q-07 — La palette viene dal deck: cosa ne è del colore del modello?
**Chiusa il:** 2026-09-22 · **Risposta:** *come il deck, un colore solo.*

`colori.primario` fa **entrambi** i mestieri — il cromo e i luoghi dove parla il
modello — e nessun token si aggiunge. Il codice di oggi è già così: la voce si
chiude senza una modifica.

Quello che si perde, detto qui perché non si scopra fra sei mesi: un colore solo
non distingue più **a colpo d'occhio** ciò che ha scritto l'utente da ciò che ha
dedotto il modello. Restano le parole — «letto dalla foto», le confidenze — e
resta la possibilità di tornare indietro: i quattro componenti (`BadgeIa`,
`MotiviProposta`, `PuntiniAttesa`, `AttesaLunga`) leggono **un token solo**,
quindi ridarglielo è una riga in `tokens.ts` e quattro righe altrove, oggi come
fra un anno.

*(La domanda, com'era posta:)*

**Aperta il:** 2026-09-22 · **Tocca:** `apps/mobile/src/tema/tokens.ts`,
`src/ui/base.tsx` (`BadgeIa`, `PuntiniAttesa`), `src/ui/capi.tsx`
(`MotiviProposta`), `src/ui/stati.tsx` (`AttesaLunga`)

**La parte decisa, il 2026-09-22:** i colori vengono dal deck «Aura», nominati
per ruolo. `colori.ambra` non esiste più, e con lui l'invariante *«l'ambra è
dell'intelligenza artificiale, e in nessun altro posto»*, che viveva in tre
copie — `tokens.ts`, `CLAUDE.md`, `.claude/rules/react-native.md` — riscritte
tutte nella stessa modifica. Al suo posto: **l'azione è inchiostro, non
l'accento**, che è la regola vera del deck.

**Quello che resta da decidere.** Nel deck l'accento `#5566D6` fa **due**
mestieri: dove parla il modello (il badge `SICURO · 97`, `PROPOSTO DA AURA`, il
pallino di `IL CONSIGLIO`) **e** il cromo (link, progressi, spunte, la scheda
attiva). Presi i colori del deck alla lettera, il modello **non ha più un colore
suo**: `BadgeIa`, `MotiviProposta`, `PuntiniAttesa` e `AttesaLunga` dipingono lo
stesso `primario` dei link e della tab attiva.

*Cosa cambia a seconda della risposta:* niente di strutturale. I quattro
componenti leggono già **un token solo**, quindi ridare al modello un colore
proprio è aggiungere una riga a `tokens.ts` e cambiarne quattro — non è un
lavoro che cresce se si aspetta. Se invece la risposta è «va bene così», questa
voce si chiude e la regola resta quella che è scritta adesso.

