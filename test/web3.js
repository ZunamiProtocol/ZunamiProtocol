const web3 = require('web3');
const hre = require("hardhat");
const { ethers } = require("hardhat");

const unlockAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
const MainAddress = '0x09635F643e140090A9A8Dcd712eD6285858ceBef'; // Заменить на новый адресс Main контракта!!!!!
const UsdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CerveAddress = '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE';
const CurveFiToken = '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900';
const AusdcAddress = '0xBcca60bB61934080951369a648Fb03DF4F96263C';

const MainAbi = require('../artifacts/contracts/Main.sol/Main.json');
const Stableabi = require('../OtherAbi/StableToken.json');
const CerveAbi = require('../OtherAbi/ICurveAavePool.json');
const CurveFiAbi = require('../OtherAbi/CurveFiAbi.json');
let Web3 = new web3('http://localhost:8545');


const main = new Web3.eth.Contract(MainAbi.abi, MainAddress);


const usdc = new Web3.eth.Contract(Stableabi, UsdcAddress);
const ausdc = new Web3.eth.Contract(Stableabi, AusdcAddress);
const CurveFi = new Web3.eth.Contract(CurveFiAbi ,CurveFiToken)
// const cerve = new Web3.eth.Contract(CerveAbi, CerveAddress);

const usdcTicker = web3.utils.fromAscii('usdc');


const InsideAddress = '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199';
( async () => {

    console.log('step 1: get USDC in Contract')
    console.log('Acc Balance USDC after => ',await usdc.methods.balanceOf(unlockAddress).call());
    console.log('Contract Balance USDC after => ',await usdc.methods.balanceOf(MainAddress).call());
    await usdc.methods.transfer(MainAddress, 10e6).send({from: unlockAddress})
    console.log('Acc Balance USDC before => ',await usdc.methods.balanceOf(unlockAddress).call());
    console.log('Contract Balance USDC before => ',await usdc.methods.balanceOf(MainAddress).call());
    console.log('------------')

    console.log('step 1: approve USDC to Contract')
    console.log(`tokens approve for Contract after => `, await usdc.methods.allowance(unlockAddress, MainAddress).call());
    await usdc.methods.approve(MainAddress, 4e6).send({from: unlockAddress});
    console.log(`tokens approve for Contract after => `, await usdc.methods.allowance(unlockAddress, MainAddress).call());
    console.log('------------')

    console.log('my contract balance curve Fi before =>', await CurveFi.methods.balanceOf(MainAddress).call());

    console.log('step 2: call function deposit')
    console.log(`tokens approve for Curve after => `, await usdc.methods.allowance(MainAddress, CerveAddress).call());
    console.log('Contract Balance USDC after => ',await usdc.methods.balanceOf(MainAddress).call());
    await main.methods.deposit(unlockAddress, 4e6, usdcTicker).send({from: unlockAddress, gas: '1314359'})
    console.log(`tokens approve for Curve before => `, await usdc.methods.allowance(MainAddress, CerveAddress).call());
    console.log('Acc Balance USDC before => ',await usdc.methods.balanceOf(MainAddress).call());
    console.log('------------')

    console.log('my contract balance curve Fi after deposit =>', await CurveFi.methods.balanceOf(MainAddress).call());

    console.log('step 3: call function withdraw');
    await main.methods.withdraw(unlockAddress, 1e6, usdcTicker).send({from: unlockAddress, gas: '1314359'});
    console.log('Contract AUSDC balance',await usdc.methods.balanceOf(MainAddress).call());
    console.log('------------');

    console.log('my contract balance curve Fi after withdraw =>', await CurveFi.methods.balanceOf(MainAddress).call());



})()



