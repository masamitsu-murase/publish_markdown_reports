const tmrm = require('azure-pipelines-task-lib/mock-run');
const path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let tmr = new tmrm.TaskMockRunner(taskPath);

let contentPath = path.resolve(__dirname, 'contents');
tmr.setInput('contentPath', contentPath);
let indexFile = 'invalid_index.md';
tmr.setInput('indexFile', indexFile);

tmr.run();
