const fs = require('fs');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');
const assert = require('assert');

const utils = require('./utils');

const timeout = 30 * 1000;

function loadConfigJsonData(logOutput) {
    const configLogMessage = `##vso[task.addattachment type=${utils.ATTACHMENT_TYPE};name=${utils.CONFIG_FILENAME};]`
    const configLogIndex = logOutput.indexOf(configLogMessage);
    assert.ok(configLogIndex >= 0, 'should be found');
    const configFilepath = logOutput.slice(configLogIndex + configLogMessage.length).split("\n", 1)[0].trim();
    return JSON.parse(fs.readFileSync(configFilepath));
}

function checkContentFiles(tr, warningCount=0, errorCount=0) {
    assert.equal(tr.succeeded, true, 'should have succeeded');
    assert.equal(tr.warningIssues.length, warningCount, "should have no warnings");
    assert.equal(tr.errorIssues.length, errorCount, "should have no errors");

    utils.CONTENT_FILES.forEach(item => {
        const [file, name] = item;
        const filepath = path.resolve(__dirname, "contents", file);
        const escapedFilepath = utils.escapeAttachmentFilepath(filepath);
        const message = `##vso[task.addattachment type=${utils.ATTACHMENT_TYPE};name=${name};]${escapedFilepath}`;
        assert.ok(tr.stdOutContained(message), 'All content files should be found.');
    });
    assert.equal(tr.stdout.match(/task\.addattachment/g).length, utils.CONTENT_FILES.length + 1, 'All attachments should be found.');
}

test('with contentPath', async () => {
    let tp = path.join(__dirname, 'success_with_content_path.js');
    let tr = new ttm.MockTestRunner(tp);
    await tr.runAsync();

    checkContentFiles(tr);
    const configJsonData = loadConfigJsonData(tr.stdout);
    assert.deepStrictEqual(configJsonData, utils.DEFAULT_CONFIG_DATA);
}, timeout);

test('with full params', async () => {
    let tp = path.join(__dirname, 'success_with_full_params.js');
    let tr = new ttm.MockTestRunner(tp);
    await tr.runAsync();

    checkContentFiles(tr);

    const configJsonData = loadConfigJsonData(tr.stdout);
    const expectedJsonData = Object.assign({}, utils.DEFAULT_CONFIG_DATA, {
        index: "Dir1/main.md",
        headingId: "pythonmarkdown",
        latexFormula: false,
    });
    assert.deepStrictEqual(configJsonData, expectedJsonData);
}, timeout);

test('with warned params', async () => {
    let tp = path.join(__dirname, 'warning_with_full_params.js');
    let tr = new ttm.MockTestRunner(tp);
    await tr.runAsync();

    checkContentFiles(tr, 1);

    const configJsonData = loadConfigJsonData(tr.stdout);
    const expectedJsonData = Object.assign({}, utils.DEFAULT_CONFIG_DATA, {
        index: "Dir1/main.md",
        headingId: "doxybook2",
    });
    assert.deepStrictEqual(configJsonData, expectedJsonData);
}, timeout);

test('with invalid params', async () => {
    const failureCases = [
        'failure_with_invalid_content_path.js',
        'failure_with_invalid_index_file.js',
    ];

    for (const filename of failureCases) {
        let tp = path.join(__dirname, filename);
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        assert.ok(!tr.succeeded, `should fail: ${filename}`);
    }
}, timeout);
