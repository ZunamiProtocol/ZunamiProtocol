module.exports = {
    'parser': 'babel-eslint',
    'extends': 'google',
    'rules': {
        'indent': ['error', 4],
        'max-len': ['error', {'code': 100}],
        'new-cap': ['error', {'newIsCap': false}],
    },
    'parserOptions': {
        'ecmaVersion': 6,
    },
};
