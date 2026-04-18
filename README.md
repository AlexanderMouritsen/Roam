# Roam

Roam er en app for å samle og bevare reiseminner. Målet er å gi brukere et meningsfullt sted å dokumentere reisene sine, ikke bare gjennom bilder, men også gjennom historiene, stedene og følelsene bak dem.

## Teknologi

- Node.js med Express
- Supabase (PostgreSQL, Auth, Storage)
- Vanilla HTML, CSS og JavaScript

## Kom i gang

1. Klon repoet
2. Kjør `npm install`
3. Lag en `.env.local` fil med:
   ```
   PORT=3000
   SUPABASE_URL=din-url
   SUPABASE_ANON_KEY=din-anon-key 
   SUPABASE_SERVICE_ROLE_KEY=din-nøkkel
   ```
4. Kjør `npm start`

> `npm start` er definert i `package.json` og laster miljøvariabler automatisk.

## Supabase i Roam

Roam bruker Supabase som database og autentisering. Her er det Supabase tar seg av:

- **Database:** PostgreSQL, med fem tabeller (countries, profiles, trip, activities, photos). Hele oppsettet finner du i `db/roam-supabase.sql`. For å fylle ut land-listen bruker du `db/seed-countries.sql`. 
- **Autentisering:** Registrering, innlogging og e-postbekreftelse. Alt av brukerhåndtering går via Supabase Auth.
- **E-postbekreftelse:** Etter at du har registrert deg, får du en e-post med bekreftelseslenke. Du må bekrefte før du kan logge inn.
- **Row Level Security (RLS):** Alle tabeller har RLS-policyer, slik at brukere kun får tilgang til egne data. Dette gir et ekstra sikkerhetslag.
- **Storage:** Bilder lastes opp til Supabase Storage. Kun URL-er lagres i databasen.
- **Automatisk profilopprettelse:** Når en bruker registrerer seg, opprettes det automatisk en rad i `profiles`-tabellen via en trigger.

Supabase-klienten settes opp i `config/supabase.js` og brukes i alle ruter som trenger database- eller auth-tilgang.

## Datamodell

Databasen har 5 tabeller. Full SQL ligger i `db/roam-supabase.sql`.

![Database diagram](docs/Roam-dbschema.png)

[Se interaktivt diagram på dbdiagram.io](https://dbdiagram.io/d/Roam-69cd0b2078c6c4bc7abcf90f)

### profiles
Brukerinfo som utvider Supabase Auth. Lagrer brukernavn, bio, hjemland og avatar.

### trip
En reise til ett land. Har tittel, beskrivelse, datoer, status (planned/ongoing/completed) og referanse til landet.

### activities
Opplevelser på en reise. Har type (hike, food, museum osv.), sted, notater og tidspunkt. Kan markeres som høydepunkt.

### photos
Bilder knyttet til reiser eller aktiviteter. Lagres i Supabase Storage, URL-er i databasen.

### countries
Referansedata med alle land. Brukes for verdenskartet og som foreign key i trip-tabellen.

## Fremtidige funksjoner (utenfor MVP)

Følgende funksjoner er planlagt for fremtidige versjoner:

- **Bucket list**: Land brukeren ønsker å besøke, med prioritering og notater
- **Reiser over flere land**: Støtte for at én reise kan dekke flere land
- **Deling av reiser**: Mulighet for å dele reiser med andre brukere

## Sikkerhet

- Row Level Security (RLS) på alle tabeller
- Brukere ser kun egne data
- Passord håndteres av Supabase Auth
- Service role key brukes kun server-side

## API-endepunkter

Alle API-endepunkter ligger under `/api/`. Per nå er følgende ruter implementert:

- **POST `/api/auth/signup`** — Registrerer ny bruker (e-post og passord). Sender bekreftelsesepost via Supabase.
- **POST `/api/auth/login`** — Logger inn bruker og returnerer session-token.
- **GET `/api/countries`** — Returnerer alle land fra countries-tabellen (brukes til kart og valg av hjemland).
- **GET `/api/users/me`** — Henter profilinfo for innlogget bruker (krever JWT).
- **PUT `/api/users/me`** — Oppdaterer profilinfo for innlogget bruker (validerer input, krever JWT).

Flere endepunkter (trips, activities, photos) er planlagt, men ikke ferdig implementert.


## Frontend

Frontend ligger i `public/` og består av statiske HTML-filer og vanilla JavaScript:

- **auth.html:** Innlogging og registrering. Bruker JS (`public/js/auth.js`) for å håndtere skjema, tab-switching og API-kall til backend.
- **confirm.html:** Viser bekreftelse etter e-postverifisering. Håndteres av `public/js/confirm.js`.
