const fs = require('fs');
const jsnes = require('jsnes');
console.log(Object.keys(jsnes));
const NES = jsnes.NES || jsnes.default || jsnes;
console.log(typeof NES);
const romData = fs.readFileSync('public/roms/super-homebrew.nes', 'binary');
const nes = new NES();
try {
  nes.loadROM(romData);
  nes.frame();
  console.log("Success");
} catch (e) {
  console.log("Error:", e);
}
