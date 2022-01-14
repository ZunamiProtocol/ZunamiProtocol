module.exports = {
    skipFiles: ['interfaces/', 'mock/'],
    mocha: {
        grep: '@skip-on-coverage',
        invert: true,
    },
};
