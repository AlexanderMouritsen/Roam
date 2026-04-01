# Kravspesifikasjon - Roam

## Hva er dette?

Roam er en reisedagbok. Du dokumenterer reiser du har vært på, skriver ned hva som skjedde, laster opp bilder, og ser det hele på et verdenskart. Landene du har besøkt lyser opp.

Det er ikke et sosialt medium. Ingen følgere, ingen likes, ingen algoritme. Det er heller ikke en planlegger. Fokuset er på det du allerede har opplevd.

## Hvem er det for?

Folk som reiser og vil huske mer enn bare bildene. Som vil skrive ned hvordan ting føltes, ikke bare hvor de var.

---

## Hva brukeren kan gjøre

### Konto og profil

- Registrere seg med e-post og passord
- Logge inn og ut
- Se og redigere profilen sin

### Verdenkartet

- Se et interaktivt verdenskart på forsiden
- Hjemland vises i blått
- Besøkte land vises i gull
- Klikke på et land for å markere det som besøkt
- Fjerne et land fra besøkte
- Se hvor mange land du har besøkt

### Reiser

- Lage en reise med tittel, beskrivelse, datoer og status
- Se alle reisene i en liste
- Åpne en reise og se alt som skjedde
- Redigere og slette reiser
- Laste opp forsidebilde

### Aktiviteter

- Legge til aktiviteter på en reise (en tur, et måltid, en opplevelse)
- Hver aktivitet har tittel, type, sted, dato og dagboknotater
- Markere favoritter som høydepunkt
- Laste opp ett bilde per aktivitet
- Aktiviteter vises i rekkefølge etter dato
- Redigere og slette

### Ønskeliste

- Legge til land du vil besøke
- Se listen
- Fjerne land fra listen

### Statistikk

- Se antall land, reiser og aktiviteter

---

## Sikkerhet

Passord håndteres av Supabase Auth. De lagres aldri i klartekst. Tokens sjekkes på serveren for hver forespørsel. Input valideres før noe lagres. Filopplasting sjekker filtype og størrelse. Row Level Security i databasen sørger for at du bare ser dine egne data.

## Personvern

Bare data som trengs samles inn. E-post brukes kun til innlogging. Du kan slette dine egne reiser, aktiviteter og bilder.

## Universell utforming

Semantisk HTML. Labels på alle skjemafelt. God fargekontrast. Tastaturnavigasjon fungerer. Bilder har alt-tekst.

---

## Ikke med i første versjon

- Vennskap og deling
- Kommentarer
- Varsler