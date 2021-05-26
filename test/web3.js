const web3 = require('web3');

const unlockAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC';

// Заменить на новый адресс Main контракта!!!!!
const MainAddress = '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB';

const UsdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CurveLPToken = '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900';

const MainAbi = require('../artifacts/contracts/Main.sol/Main.json');
const Stableabi = require('../OtherAbi/StableToken.json');
const CurveLPAbi = require('../OtherAbi/CurveLPAbi.json');
const Web3 = new web3('http://localhost:8545');


const main = new Web3.eth.Contract(MainAbi.abi, MainAddress);


const usdc = new Web3.eth.Contract(Stableabi, UsdcAddress);
const CurveLP = new Web3.eth.Contract(CurveLPAbi, CurveLPToken);
const usdcTicker = web3.utils.fromAscii('usdc');

const approveUsdc = async (message) => {
    console.log(message);
    console.log(`USDC which has already been approved for the Contract => `,
        await usdc.methods.allowance(unlockAddress, MainAddress).call());

    await usdc.methods.approve(MainAddress, 4e6).send({from: unlockAddress});
    console.log(`New amount of the USDC approved for the Contract => `,
        await usdc.methods.allowance(unlockAddress, MainAddress).call());
    console.log('------------');
};

const deposit = async (message) => {
    console.log(message);
    await getCurveLPBalance();

    console.log(`Deposited ${4e6} USDC`);
    await main.methods.deposit(unlockAddress, 4e6, usdcTicker)
        .send({from: unlockAddress, gas: '1314359'});

    await getCurveLPBalance();
    console.log('------------');
};

const getCurveLPBalance = async () => {
    console.log('Current balance of the Curve Token =>',
        await CurveLP.methods.balanceOf(MainAddress).call());
};

const withdraw = async (message) => {
    console.log(message);
    console.log(`Withdrawed ${3e6} USDC`);
    await getCurveLPBalance();
    await main.methods.withdraw(unlockAddress, 3e6, usdcTicker)
        .send({from: unlockAddress, gas: '1314359'});
    await getCurveLPBalance();
    console.log('------------');
};

const mainTest = async () => {
    await approveUsdc('Step 1: approve USDC for our Contract');

    await deposit('Step 2: call a deposit function');

    await withdraw('Step 3: call a withdraw function');
};

mainTest();
