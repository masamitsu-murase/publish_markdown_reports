const fs = require("fs");
const path = require("path");


async function readFile(filename) {
    const filepath = path.resolve(__dirname, "..", "contents", filename);
    return await fs.promises.readFile(filepath);
}

async function prepareCssFiles() {
    const cssFiles = [
        "contents/highlight.min.css",
        "contents/highlight.dark.min.css",
        "node_modules/@exampledev/new.css/new.css",
        "contents/frame.css",
    ];
    let cssContent = "";
    for (let i=0; i<cssFiles.length; i++) {
        const filename = path.resolve(__dirname, "..", cssFiles[i]);
        cssContent += await readFile(filename) + "\n";
    }
    const cssOutputFilepath = path.resolve(__dirname, "..", "contents", "frame_all.css");
    await fs.promises.writeFile(cssOutputFilepath, cssContent);
}

async function prepareJsFiles() {
    const jsFiles = [
        "contents/highlight.min.js",
        "node_modules/marked/marked.min.js",
        "node_modules/dompurify/dist/purify.min.js",
        "contents/devops_marked.js",
        "contents/frame.js",
    ];
    let jsContent = "";
    for (let i=0; i<jsFiles.length; i++) {
        const filename = path.resolve(__dirname, "..", jsFiles[i]);
        jsContent += await fs.promises.readFile(filename) + "\n";
    }
    const jsOutputFilepath = path.resolve(__dirname, "..", "contents", "frame_all.js");
    await fs.promises.writeFile(jsOutputFilepath, jsContent);
}

async function main() {
    await prepareCssFiles();
    await prepareJsFiles();
}

main();
