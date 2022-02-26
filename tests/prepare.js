const fs = require("fs");
const path = require("path");


async function readFile(filename) {
    const filepath = path.resolve(__dirname, "..", "contents", filename);
    return await fs.promises.readFile(filepath);
}

async function main() {
    const files = [
        ["contents/highlight.min.js", "hljs"],
        ["node_modules/marked/marked.min.js", "marked"],
        ["node_modules/dompurify/dist/purify.min.js", "DOMPurify"],
    ];
    const absolutePaths = files.map(item => path.resolve(__dirname, "..", item[0]));
    const relativePaths = absolutePaths.map(filepath => path.relative(__dirname, filepath));
    const requirePaths = relativePaths.map(filepath => filepath.replace(/\\/g, "/").slice(0, -3));
    const requires = requirePaths.map((item, index) => {
        const name = files[index][1];
        return `const ${name} = require('${item}');`
    });
    const devops_marked_path = path.resolve(__dirname, "devops_marked.js");
    const content = requires.join("\n") + "\n" + await readFile("devops_marked.js") + "\n"
        + "module.exports = DevOpsMarked;\n";
    await fs.promises.writeFile(devops_marked_path, content);
}

main();
