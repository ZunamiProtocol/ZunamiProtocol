const fs = require('fs');
const readline = require('readline');
const {exec} = require('child_process');
const path = require('path');

require('colors');

const getAllFilesForTest = fs.readdirSync(path.join(__dirname, '..'))
    .filter((item) => item.indexOf('test.js') !== -1);

const askQuestion = (rl) => {
    return new Promise((resolve) => rl.question('Enter file number: '.green.italic,
        (answer) => resolve(answer)));
};

const runConsoleAndTest = async (filesInDir) => {
    console.log('\n<=== Select file for test ===>'.cyan.italic);

    for (let i = 0; i < filesInDir.length; i++) {
        console.log(`${i}: ${filesInDir[i]}`.brightYellow);
    }

    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const numberOfFile = await askQuestion(readlineInterface);
    readlineInterface.close();

    if (numberOfFile === '') {
        runTest('npx hardhat test');
    } else {
        runTest('npx hardhat test ' + path.join(__dirname, `../${filesInDir[numberOfFile]}`));
    }
};

const runTest = (command) => {
    console.log('\n<=== Waiting for test results... ===>'.yellow.italic.bold);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            throw error;
        }
        console.log(stdout);
        if (stderr) {
            console.log('\nSomething went wrong'.red.bold);
            console.log(stderr);
        }
    });
};

runConsoleAndTest(getAllFilesForTest);
