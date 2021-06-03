const web3 = require('web3');

const pathAndAddress = require('./PathAndAddress.json');

const Web3 = new web3('http://localhost:8545');

const Contract = {
    'dai': new Web3.eth.Contract(require(pathAndAddress.path.StableTokenAbi),
        pathAndAddress.address.DaiAddress),
    'usdc': new Web3.eth.Contract(require(pathAndAddress.path.StableTokenAbi),
        pathAndAddress.address.UsdcAddress),
    'usdt': new Web3.eth.Contract(require(pathAndAddress.path.StableTokenAbi),
        pathAndAddress.address.UsdtAddress),
    'main': new Web3.eth.Contract(require(pathAndAddress.path.mainAbi).abi,
        pathAndAddress.address.mainAddress),
};

const Ticker = {
    'usdc': Web3.utils.fromAscii('usdc'),
    'curve': Web3.utils.fromAscii('a3CRV'),
    'yearn': Web3.utils.fromAscii('saCRV'),
    'SusdPool': Web3.utils.fromAscii('crvPlain3andSUSD'),
    'DusdPool': Web3.utils.fromAscii('dusd3CRV'),
    'Invalid_Ticker': Web3.utils.fromAscii('Invalid_Ticker'),
};

const faucetEther = async () => {
    if (await Web3.eth.getBalance(Contract.main._address) === '0') {
        const address = await Web3.eth.getAccounts();
        await Web3.eth.sendTransaction({
            from: address[0],
            to: Contract.main._address,
            value: 10e18,
        });
    }
};


module.exports = {
    Contract,
    Ticker,
    faucetEther,
};
