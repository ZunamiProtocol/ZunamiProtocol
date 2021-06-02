const fs = require('fs');
const readline = require('readline');
const {exec} = require('child_process');
const path = require('path');

require('colors');

const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const getAllFilesForTest = fs.readdirSync(path.join(__dirname, '..'))
    .filter((item) => item.indexOf('test.js') !== -1);

const askQuestion = () => {
    return new Promise((resolve) =>
        readlineInterface.question('Enter file number: '.green.italic,
            (answer) => resolve(answer)));
};

const runConsoleAndTest = async (fielsInDir) => {
    console.log('\n<=== Select file for test ===>'.cyan.italic);

    for (let i = 0; i < fielsInDir.length; i++) {
        console.log(`${i}: ${fielsInDir[i]}`.brightYellow);
    }

    const numberFile = await askQuestion();
    readlineInterface.close();

    if (numberFile === '') {
        runTest('npx hardhat test');
    } else {
        runTest('npx hardhat test ' + path.join(__dirname, `../${fielsInDir[numberFile]}`));
    }
};

const runTest = (command) => {
    console.log('\n<=== Waiting for test results... ===>'.yellow.italic.bold);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log('\nSomething went wrong'.red.bold);
            console.log(error);
        }
        console.log(stdout);
        if (stderr) {
            console.log('\nSomething went wrong'.red.bold);
            console.log(stderr);
        }
    });
};

runConsoleAndTest(getAllFilesForTest);
