# Pohoda Web

### Návod na změny

**Notace:**

```sh
V takových to blocích jsou příkazy, které je třeba spustit v příkazovém řádku
```

**Co je potřeba:**

- `git` [→ stáhnout][git]  
  Po instalaci je třeba se `git`u identifikovat:

  ```sh
  git config --global user.name "Jméno"
  ```

  ```sh
  git config --global user.email "E-mailová adresa"
  ```

- `git-lfs` [→ stáhnout][git-lfs]  
  Jde o rozšíření pro `git`, které umožňuje verzování i tak velkých souborů, jako jsou obrázky.  
  Po instalaci je třeba spustit:

  ```sh
  git lfs install
  ```

- `node` [→ stáhnout][node]  
  (Potřeba pro `netlify-cli`)

- `netlify-cli`
  Nainstalujeme přes `npm` (Node Package Manager)
  ```sh
  npm install -g netlify-cli
  ```
  Přihlásíme se KSPohoda učtem (mail: `quick.lion8956@fastmail.com`)  
  Měla by se otevřít přihlašovací stránka v prohlížeči
  ```sh
  netlify login
  ```
  Nastavíme `git` aby použil `netlify` pro autentikaci
  ```sh
  git config --global --add credential.helper netlify
  ```

**Jak na to:**

1. Nejdřív je třeba stáhnout si tento repozitář. K tomu použijeme `git`.
   ```sh
   git clone https://github.com/KSPohoda/web pohoda-web
   ```
   Takto jsme si ho stáhli do složky `pohoda-web`.
1. Nyní můžeme v této složce dělat jakékoliv změny chceme.
   1. Před provedením změn je dobré se ujistit, že máme nejnovější verzi všech souborů:
      ```sh
      git pull
      ```
1. Po po provedení změn musíme udělat následující:
   1. Označit `git`u jaké soubory se změnily
      ```sh
      git add -A
      ```
   1. Říct `git`u aby si uložil tyto změny
      ```sh
      git commit -m "Zde patří krátký popis změn"
      ```
   1. Nahrát změny do Githubu
      ```sh
      git push
      ```
1. A to je vše! Změny nahrané do Githubu by se měly více méně hned propsat na https://kspohoda.cz

**V případě problémů:**

- Google; `git` je jedním z nejpoužívanějších verzovacích systémů (a z daleka nejpoužívanější mezi programátory), takže vygooglení errorové hlášky obvykle navede k vyřešení problému.
- Atlassian; oficiální [git dokumentace][git-docs] je spíše nepřístupná, zato [Atlassian][atlassian] má sérii tutoriálů a referencí se srozumitelně popsanými běžnými situacemi.
- Atomová bomba; když nic jiného nepomůže, někdy je nejjednodušší prostě si překopírovat změny jinam, smazat `pohoda-web`, a stáhnout a zkusit to znova.

[atlassian]: https://www.atlassian.com/git
[git]: https://git-scm.com/downloads
[git-docs]: https://git-scm.com/doc
[git-lfs]: https://git-lfs.github.com/
[node]: https://nodejs.org/en/download/
