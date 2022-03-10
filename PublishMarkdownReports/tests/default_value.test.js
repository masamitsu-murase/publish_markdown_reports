const fs = require('fs');
const path = require('path');
const assert = require('assert');

test('default input definitions', () => {
    const taskJsonFilePath = path.join(__dirname, '..', 'task.json');
    const taskJsonData = JSON.parse(fs.readFileSync(taskJsonFilePath));
    const inputsWithDefaultValue = [
        "contentPath",
        "indexFile",
        "headingId",
    ];
    inputsWithDefaultValue.forEach(name => {
        const inputDefinition = taskJsonData.inputs.find(input => input.name == name);
        if (!inputDefinition.required) {
            const envName = "INPUT_" + name.toUpperCase();
            assert.equal(process.env[envName], inputDefinition.defaultValue, `Default value for ${name}`);
        }
    });
});
