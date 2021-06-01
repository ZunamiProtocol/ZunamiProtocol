const {exec} = require('child_process');

exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
    if (error) {
        console.log(error);
    }
    exec(`git push --follow-tags origin ${stdout.replace('\n', '')}`, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
        }
        if (stderr) {
            console.log(stderr);
        }
    });
    if (stderr) {
        console.log(stderr);
    }
});
