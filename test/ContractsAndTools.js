const web3 = require('web3');

const pathAndAddress = require('./PathAndAddress.json');

const Web3 = new web3('http://localhost:8545');

const Contract = {
    'usdc': new Web3.eth.Contract(require(pathAndAddress.path.stabeTokrnAbi),
        pathAndAddress.address.UsdcAddress),
    'main': new Web3.eth.Contract(require(pathAndAddress.path.mainAbi).abi,
        pathAndAddress.address.mainAddress),
};

const Ticker = {
    'usdc': Web3.utils.fromAscii('USDC'),
    'aave': Web3.utils.fromAscii('a3CRV'),
    'SucdPool': Web3.utils.fromAscii('crvPlain3andSUSD'),
    'DusdPool': Web3.utils.fromAscii('dusd3CRV'),
    'Invalid_Ticker': Web3.utils.fromAscii('Invalid_Ticker'),
};

const sendEther = async () => {
    if (await Web3.eth.getBalance(Contract.main._address) === '0') {
        await Web3.eth.sendTransaction({
            from: '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199',
            to: Contract.main._address,
            value: 2e10,
        });
    }
};


module.exports = {
    Contract,
    Ticker,
    sendEther,
};
