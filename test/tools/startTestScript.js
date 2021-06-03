const fs = require('fs');
const readline = require('readline');
const {exec} = require('child_process');
const path = require('path');

require('colors');



const runConsoleAndTest = async () => {
    console.log('\n<=== Select file for test ===>'.cyan.italic);

    const getAllFilesForTest = fs.readdirSync(path.join(__dirname, '..'))
        .filter((item) => item.indexOf('test.js') !== -1);

    for (let i = 0; i < getAllFilesForTest.length; i++) {
        console.log(`${i}: ${getAllFilesForTest[i]}`.brightYellow);
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
        runTest('npx hardhat test ' +
            path.join(__dirname, `../${getAllFilesForTest[numberOfFile]}`));
    }
};

const askQuestion = (rl) => {
    return new Promise((resolve) => rl.question('Enter file number: '.green.italic,
        (answer) => resolve(answer)));
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

runConsoleAndTest();
