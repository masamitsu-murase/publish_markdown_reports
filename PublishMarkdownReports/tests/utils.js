const ATTACHMENT_TYPE = 'publishmarkdownreports';
const CONFIG_FILENAME = 'config.json';
const DEFAULT_CONFIG_DATA = {
    index: "index.md",
    headingId: "none",
    latexFormula: true,
};

// See Path.ESCAPED_CHARACTERS.
//                              123456 789
// static ESCAPED_CHARACTERS = '<>|:*?\\/ ';
const CONTENT_FILES = [
    ["index.md", "md^08index.md"],
    ["Dir1/main.md", "md^08Dir1^08main.md"],
    ["Dir1/space 日本語 ; '/^ ~!#$%&')(-=`@][}{;+,._.txt", "md^08Dir1^08space^09日本語^09%3B^09'^08^00^09~!#$%AZP25&')(-=`@%5D[}{%3B+,._.txt"],
];

function escapeAttachmentFilepath(filepath) {
    return filepath.replace(/%/g, '%AZP25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

module.exports = {
    ATTACHMENT_TYPE,
    CONFIG_FILENAME,
    CONTENT_FILES,
    DEFAULT_CONFIG_DATA,
    escapeAttachmentFilepath,
};
