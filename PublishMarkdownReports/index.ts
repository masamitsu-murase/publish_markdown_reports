import fs = require('fs');
import path = require('path');
import process = require('process');
import tl = require('azure-pipelines-task-lib/task');


const ATTACHMENT_TYPE = 'publishmarkdownreports';
const CONFIG_FILENAME = 'config.json';

async function getFiles(dir: string): Promise<string[]> {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : [res];
    }));
    return Array.prototype.concat(...files);
}

function replaceAll(text: string, pattern: string, replacement: string) {
    return text.split(pattern).join(replacement);
}

function escapeFilename(filename: string): string {
    const ESCAPED_CHARACTERS = '<>|:*?\\/ ';
    const LOG_ESCAPE_CHARACTER = "^";

    filename = "md/" + replaceAll(filename, "\\", "/");

    const chars = LOG_ESCAPE_CHARACTER + ESCAPED_CHARACTERS;
    for (let i = 0; i < chars.length; i++) {
        const num = `${i}`.padStart(2, "0");
        filename = replaceAll(filename, chars[i], `${LOG_ESCAPE_CHARACTER}${num}`);
    }
    return filename;
}

function getPredefinedVariable(name: string) {
    name = replaceAll(name, ".", "_");
    name = replaceAll(name, " ", "_");
    return process.env[name];
}

async function saveConfigData(configData: object) {
    const jsonData = JSON.stringify(configData);
    const tempBaseDir = getPredefinedVariable("Agent.TempDirectory") || getPredefinedVariable("Agent.workFolder") || process.cwd();
    const tempDir = await fs.promises.mkdtemp(path.join(tempBaseDir, "publishmarkdownreports-"));
    const configFilePath = path.join(tempDir, "config.json");
    await fs.promises.writeFile(configFilePath, jsonData);
    tl.addAttachment(ATTACHMENT_TYPE, CONFIG_FILENAME, configFilePath);
}

function addAttachments(files: string[], baseDir: string) {
    const absoluteFiles = files.map(file => path.resolve(baseDir, file));
    const relativeFiles = files.map(file => path.relative(baseDir, file));
    absoluteFiles.forEach((absoluteFile, index) => {
        const relativeFile = relativeFiles[index];
        const name = escapeFilename(relativeFile);
        tl.addAttachment(ATTACHMENT_TYPE, name, absoluteFile);
    });
}

function getHeadingIdInput(): string
{
    const headerId = tl.getInput("headerId");
    if (headerId) {
        tl.warning("'headerId' is deprecated. Use 'headingId' instead.");
    }

    const headingId = headerId || tl.getInput("headingId");
    if (headingId) {
        return headingId;
    }
    return "none";
}

async function run() {
    try {
        const contentPath = tl.getInput('contentPath', true);
        if (!contentPath) {
            tl.setResult(tl.TaskResult.Failed, 'Bad contentPath');
            return;
        }

        const baseDir = contentPath as string;
        if (!fs.statSync(baseDir).isDirectory()) {
            tl.setResult(tl.TaskResult.Failed, `contentPath, "${baseDir}", is not a directory.`);
            return;
        }
        if (!path.isAbsolute(baseDir)) {
            tl.setResult(tl.TaskResult.Failed, `contentPath, "${baseDir}", is not absolute.`);
            return;
        }

        const indexFile = tl.getInput('indexFile');
        if (!indexFile) {
            tl.setResult(tl.TaskResult.Failed, 'Bad index File');
            return;
        }
        let indexFilePath = indexFile as string;
        indexFilePath = path.resolve(baseDir, indexFilePath);
        if (!fs.statSync(indexFilePath).isFile()) {
            tl.setResult(tl.TaskResult.Failed, 'indexFile is not a valid file.');
            return;
        }
        indexFilePath = path.relative(baseDir, indexFilePath);
        if (indexFilePath.split(path.sep, 1)[0] == "..") {
            tl.setResult(tl.TaskResult.Failed, 'indexFile is not included in contentPath.');
            return;
        }
        if (path.sep != "/") {
            indexFilePath = replaceAll(indexFilePath, path.sep, "/");
        }

        const latexFormula = tl.getInput("latexFormula");
        if (latexFormula === undefined) {
            tl.setResult(tl.TaskResult.Failed, 'Bad latexFormula.');
            return;
        }

        const headingId = getHeadingIdInput();
        const configData = {
            "index": indexFilePath,
            "headingId": headingId,
            "latexFormula": latexFormula,
        };
        saveConfigData(configData);

        const files = await getFiles(baseDir);
        addAttachments(files, baseDir);
    }
    catch (err) {
        if (err instanceof Error) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        } else {
            tl.setResult(tl.TaskResult.Failed, `err: ${err}`);
        }
    }
}

run();
