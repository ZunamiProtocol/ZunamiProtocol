module.exports = {
    'parser': 'babel-eslint',
    'extends': 'google',
    'rules': {
        'indent': ['error', 4],
        'max-len': ['error', {'code': 100}],
    },
    'parserOptions': {
        'ecmaVersion': 6,
    },
};
