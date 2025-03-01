import fs from "node:fs";
import { spawn } from "node:child_process";

for (const folder of fs.readdirSync("./").filter((file) => !file.includes("."))) {
    fs.copyFileSync(`./${folder}/1_64.dds`, `./${folder}.dds`);
    fs.rmdirSync(`./${folder}`, { recursive: true });
    spawn("convert", [`${folder}.dds`, `${folder}.png`])
}
