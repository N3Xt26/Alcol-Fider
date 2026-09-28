# 🍺 Alcol Finder

Un'applicazione web progressiva che ti guida al pub o bar più vicino utilizzando la bussola e la rotazione della bottiglia, completa di feature sociale "Cin-Cin Bump" via Firebase Realtime Database.

## ✨ Caratteristiche

- 🧭 **Bussola Interattiva a Bottiglia**: Navigazione in tempo reale verso locali nelle vicinanze o selezionati casualmente.
- ⚙️ **Modalità Bussola**: Scegli tra navigazione **Normale** (linea d'aria) e **Step-by-Step** (svolte stradali lungo il percorso) dall'hamburger menu.
- 🍻 **Cin-Cin Bump (Shake Matching)**: Scuoti lo smartphone vicino a un altro dispositivo entro 100m per brindare insieme! Sincronizzazione P2P serverless via Firebase Realtime Database.
- 🔊 **Audio & Feedback Aptico**: Clink dei calici generato via Web Audio API e vibrazioni tattili.
- 📱 **Hamburger Menu Glassmorphism**: Impostazioni pulite ed eleganti per audio e modalità di puntamento.

---

## 🚀 Deploy su Vercel

Il progetto è configurato per il deploy istantaneo su **Vercel** come applicazione statica ad alte prestazioni.

### Metodo 1: Da Dashboard Vercel (Consigliato)
1. Vai su [Vercel](https://vercel.com) e accedi con il tuo account GitHub.
2. Clicca su **"Add New..."** -> **"Project"**.
3. Seleziona il repository `Alcol-Fider`.
4. Vercel rileverà automaticamente la configurazione tramite `vercel.json` (Framework Preset: **Other**).
5. Clicca su **"Deploy"**.

### Metodo 2: Tramite Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 🔒 Permessi e Privacy

Il file `vercel.json` configura automaticamente l'header `Permissions-Policy` per consentire l'accesso a:
- `geolocation`: Per calcolare direzione e distanza dal locale.
- `accelerometer` & `gyroscope`: Per orientare la bottiglia e rilevare lo shake del Cin-Cin.