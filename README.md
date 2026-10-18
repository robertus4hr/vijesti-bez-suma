# Vijesti bez šuma

Mala web-aplikacija za brzo pregledavanje Index.hr vijesti iz RSS feeda, bez učitavanja naslovnice, oglasa i fotografija.

## Lokalno pokretanje

Za pregled stranice pokrenite lokalni web-poslužitelj iz korijena projekta, primjerice:

```bash
python3 -m http.server 8000
```

Zatim otvorite `http://localhost:8000`. Datoteka `data/feed.json` sadrži zadnji pripremljeni feed i omogućuje rad prikaza bez izravnog RSS poziva iz preglednika.

Za ručno osvježavanje podataka:

```bash
python3 scripts/update_feed.py
```

Skripta koristi samo Pythonovu standardnu biblioteku.

## Objavljivanje na GitHub Pages

1. Postavite sadržaj ovog projekta u GitHub repozitorij.
2. U **Settings → Pages → Build and deployment** odaberite **GitHub Actions**.
3. Pokrenite workflow **Update Index feed and deploy** jednom ručno iz kartice **Actions**.

Workflow nakon toga osvježava feed svakih 10 minuta i objavljuje statičnu stranicu. GitHub Actions raspored nije jamstvo točnog vremena; kašnjenje može biti dulje od 10 minuta. Ručno osvježavanje u stranici ponovno učitava zadnji objavljeni JSON, ali ne pokreće RSS dohvat.

## Sadržaj feeda

Indexov RSS sadrži naslov, kategoriju, vrijeme, poveznicu i kratak opis/teaser. Ne sadrži puni tekst članaka. Gumb **Otvori članak** vodi na izvornu stranicu portala. Aplikacija namjerno ne učitava RSS slike.

## Privatnost i promet

Pročitano, spremljeno, kategorija i način prikaza čuvaju se samo u lokalnoj pohrani preglednika. Ne postoji korisnički račun ni analitika. Feed preuzima GitHub Actions, a mobitelu se poslužuje sažeti JSON.

Ako je repozitorij javan, izvorni kod i objavljeni feed javno su dostupni. Nemojte u repozitorij stavljati tajne ili privatne podatke.
