// Generiert die App-Icons (Hub-Emblem: goldener Ring + Kernpunkt auf dunklem Grund).
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#100f0e"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#c9a84c" stroke-width="42"/>
  <circle cx="256" cy="256" r="62" fill="#c9a84c"/>
</svg>`

await sharp(Buffer.from(svg)).png().toFile('public/icon-512.png')
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('Icons erstellt: icon-512.png, icon-192.png, apple-touch-icon.png')
