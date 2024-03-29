const tmrm = require('azure-pipelines-task-lib/mock-run');
const path = require('path');

const taskPath = path.join(__dirname, '..', 'index.js');
let tmr = new tmrm.TaskMockRunner(taskPath);

const contentPath = path.resolve(__dirname, 'contents');
tmr.setInput('contentPath', contentPath);
const indexFile = 'Dir1/main.md';
tmr.setInput('indexFile', indexFile);
const headingId = 'pythonmarkdown';
tmr.setInput('headingId', headingId);
const latexFormula = false;
tmr.setInput('latexFormula', latexFormula);

tmr.run();
