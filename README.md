# ♥ LDR Photo Booth ♥

A cute 8-bit pixel-art photo booth for long-distance couples. Two people on two
different computers each take **4 webcam photos** with a 3-second countdown, and
the app stitches everyone's shots into a single vertical **2×4 photo-strip** —
just like the print-out from a real booth.

## Features
- 📷 Webcam capture with a big 3-2-1 countdown + camera flash
- 💞 Real cross-machine sync (peer-to-peer via WebRTC / PeerJS) using a shared **love code**
- 🎀 Cute strip frames: Hearts, Stars, Flowers, Rainbow, Sweet, Dreamy
- 🖼️ Combined strip: your 4 shots on the left, your partner's 4 on the right
- 💾 Save the finished strip as a PNG (or screenshot it)
- 🕹️ Lovey-dovey 8-bit pixel-art UI
- ✦ Solo mode to try it out on one machine

## How two people use it
1. Both open the site and type the **same** love code (e.g. `SNUGGLEBUG`).
2. **Person A** clicks **CREATE ROOM**. **Person B** clicks **JOIN ROOM**.
3. Either of you picks a frame (it syncs to both).
4. Each person clicks **START 4 SHOTS** and poses through the countdowns.
5. Once *both* sides have taken their 4 photos, the combined strip appears on
   both screens — hit **SAVE STRIP** to download.

## Running it
The webcam only works over `https://` or `http://localhost`, so serve the folder:

```bash
# any one of these from inside the project folder:
python3 -m http.server 8000
# then open http://localhost:8000
```

For two *different* machines to connect, host it somewhere with HTTPS
(GitHub Pages, Netlify, Vercel, etc.) and share the URL + love code.

## Files
- `index.html` — markup / screens
- `styles.css` — pixel-art styling
- `app.js` — webcam, countdown, PeerJS sync, strip rendering
