const {exec} = require('child_process');

const executeСommand = (command) => {
    return new Promise((resolve, rejects) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return rejects(error);
            }
            if (stdout) {
                return resolve(stdout);
            }
            if (stderr) {
                console.log(stderr);
            }
        });
    });
};

const getNameBranchAndPush = async () => {
    const nameBranch = await executeСommand('git rev-parse --abbrev-ref HEAD');
    await executeСommand(`git push --follow-tags origin ${nameBranch.replace('\n', '')} `);
};

getNameBranchAndPush();
