const fs = require('fs');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');
const assert = require('assert');

const utils = require('./utils');

function loadConfigJsonData(logOutput) {
    const configLogMessage = `##vso[task.addattachment type=${utils.ATTACHMENT_TYPE};name=${utils.CONFIG_FILENAME};]`
    const configLogIndex = logOutput.indexOf(configLogMessage);
    assert.ok(configLogIndex >= 0, 'should be found');
    const configFilepath = logOutput.slice(configLogIndex + configLogMessage.length).split("\n", 1)[0].trim();
    return JSON.parse(fs.readFileSync(configFilepath));
}

function checkContentFiles(tr) {
    assert.equal(tr.succeeded, true, 'should have succeeded');
    assert.equal(tr.warningIssues.length, 0, "should have no warnings");
    assert.equal(tr.errorIssues.length, 0, "should have no errors");

    utils.CONTENT_FILES.forEach(item => {
        const [file, name] = item;
        const filepath = path.resolve(__dirname, "contents", file);
        const escapedFilepath = utils.escapeAttachmentFilepath(filepath);
        const message = `##vso[task.addattachment type=${utils.ATTACHMENT_TYPE};name=${name};]${escapedFilepath}`;
        assert.ok(tr.stdOutContained(message), 'All content files should be found.');
    });
    assert.equal(tr.stdout.match(/task\.addattachment/g).length, utils.CONTENT_FILES.length + 1, 'All attachments should be found.');
}

test('with contentPath', () => {
    let tp = path.join(__dirname, 'success_with_content_path.js');
    let tr = new ttm.MockTestRunner(tp);
    tr.run();

    // console.log(tr.stdout);
    checkContentFiles(tr);
    const configJsonData = loadConfigJsonData(tr.stdout);
    assert.deepStrictEqual(configJsonData, utils.DEFAULT_CONFIG_DATA);
});

test('with full params', () => {
    let tp = path.join(__dirname, 'success_with_full_params.js');
    let tr = new ttm.MockTestRunner(tp);
    tr.run();

    // console.log(tr.stdout);
    checkContentFiles(tr);

    const configJsonData = loadConfigJsonData(tr.stdout);
    const expectedJsonData = Object.assign({}, utils.DEFAULT_CONFIG_DATA, {
        index: "Dir1/main.md",
        headingId: "pythonmarkdown",
    });
    assert.deepStrictEqual(configJsonData, expectedJsonData);
});

test('with invalid params', () => {
    const failure_cases = [
        'failure_with_invalid_content_path.js',
        'failure_with_invalid_index_file.js',
    ];

    failure_cases.forEach(filename => {
        let tp = path.join(__dirname, filename);
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        assert.ok(!tr.succeeded, `should fail: ${filename}`);
    });
});
