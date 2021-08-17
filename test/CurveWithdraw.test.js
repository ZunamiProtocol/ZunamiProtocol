require('dotenv').config();
const {expect} = require('chai');
const {network} = require('hardhat');
const erc20TokenABI = require('human-standard-token-abi');
const Web3 = require('web3');
const web3 = new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);

// The abi for the 3pool contract
const threePoolContractABI = require('./abi/threePool.json');

// The Whale Address to get some 3CRV from
// i.e. https://etherscan.io/address/0x1eb5115ACb95487B6A1Bd7c894fF3C7c886BA06A
const whaleAddress = '0x1eb5115ACb95487B6A1Bd7c894fF3C7c886BA06A';
const threeCRVTokenAddress = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
const threePoolContractAddress = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

// stable coin addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const usdtAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

// withdraw params
const threeCRVToSendFromWhaleAccount = 1000;
const usdAmountToWithdrawFromCurvePool = 100;

const impersonateThreeCRVWhale = async () => {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [whaleAddress],
    });
};

describe('Fetching 3crv price + Checking contract deployment ', () => {
    let threecrvUSDPrice = 0;
    let curveWithdrawContract = null;

    before(async () => {
        // init the 3 pool contract
        const owner = (await ethers.getSigners())[0];
        curveWithdrawContract = new ethers
            .Contract(threePoolContractAddress, threePoolContractABI, owner);
    });

    describe('Get 3CRV price + check 3pool contract initialization', () => {
        it('Should get the 3crv token price from the 3pool contract', async function() {
            const threecrvUSDPriceInWei = await curveWithdrawContract.get_virtual_price();
            threecrvUSDPrice = ethers.utils.formatEther(threecrvUSDPriceInWei);
            console.log(threecrvUSDPrice);
        });
        it('Should correctly deploy the curve test withdrawal contract', async function() {
            expect(curveWithdrawContract).to.not.be.null;
        });
    });

    describe('Impersonate a 3CRV whale account + transfer the 3CRV to current user ' +
    ' + do withdrawal of 3CRV token in stable coins', () => {
        before(async () => {
            await impersonateThreeCRVWhale();
        });

        it(`Whale should transfer ${threeCRVToSendFromWhaleAccount} ` +
            ` 3CRV tokens to user`, async function() {
            const owner = (await ethers.getSigners())[0];
            const signer = await ethers.getSigner(whaleAddress);
            const erc20 = new ethers.Contract(threeCRVTokenAddress, erc20TokenABI, signer);
            // transfer 3CRV from the whale account to owner
            const transferAmountInWei = ethers.utils
                .parseEther(String(threeCRVToSendFromWhaleAccount));
            const {status} = await(await erc20
                .transfer(owner.address, transferAmountInWei)).wait();
            // check if the transfer is successful
            expect(status).to.equal(1);
            // check the 3CRV balance of the user
            const userThreeCRVTokenBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('User 3CRV balance is ', userThreeCRVTokenBalance);
            // The 3CRV balance should be equal to the amount sent from whale account
            expect(userThreeCRVTokenBalance).to.be.equal(threeCRVToSendFromWhaleAccount);
        });

        it(`User should be able to partially withdraw $${usdAmountToWithdrawFromCurvePool} ` +
         ` in DAI from 3pool curve contract`, async function() {
            const owner = (await ethers.getSigners())[0];
            const erc20 = new ethers.Contract(daiAddress, erc20TokenABI, owner);
            const intialDaiBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('Initial DAI Balance is ', intialDaiBalance);

            // THIS IS THE FORMULA FOR CALCULATE,
            // THE AMOUNT OF TOKENS TO SEND TO CURVE CONTRACT FOR WITHDRAWAL
            const threeCRVTokensToWithdraw = parseFloat(usdAmountToWithdrawFromCurvePool) /
                parseFloat(threecrvUSDPrice);
            console.log('3CRV tokens to withdraw ', threeCRVTokensToWithdraw);
            const threeCRVTokensToWithdrawInWei = ethers.utils
                .parseEther(String(threeCRVTokensToWithdraw));
            const coinIndex = 0;

            // allow 2% slippage or the txn reverts
            const slippageAmount = 0.98 * threeCRVTokensToWithdraw;
            console.log('Minimum DAI amount to receive ', slippageAmount);
            const slippageAmountInWei = ethers.utils.parseEther(String(slippageAmount));

            // withdraw DAI from the contract
            const {status} = await(await curveWithdrawContract
                .remove_liquidity_one_coin(threeCRVTokensToWithdrawInWei ,
                    coinIndex, slippageAmountInWei)).wait();

            // check if the transfer is successful
            expect(status).to.equal(1);

            const finalDaiBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('Final DAI Balance is ', finalDaiBalance);

            expect(finalDaiBalance).to.be.gt(intialDaiBalance);
        });

        it(`User should be able to partially withdraw $${usdAmountToWithdrawFromCurvePool} ` +
        `in mixed amounts from 3pool curve contract`, async function() {
            const owner = (await ethers.getSigners())[0];
            const erc20DAI = new ethers.Contract(daiAddress, erc20TokenABI, owner);
            const intialDaiBalance = Number(ethers.utils
                .formatEther(await erc20DAI.balanceOf(owner.address)));
            console.log('Initial DAI Balance is ', intialDaiBalance);

            const erc20USDT = new ethers.Contract(usdtAddress, erc20TokenABI, owner);
            const intialUSDTBalance = Number(ethers.utils
                .formatEther(await erc20USDT.balanceOf(owner.address)));
            console.log('Initial USDT Balance is ', intialUSDTBalance);

            const erc20USDC = new ethers.Contract(usdcAddress, erc20TokenABI, owner);
            const intialUSDCBalance = Number(ethers.utils
                .formatEther(await erc20USDC.balanceOf(owner.address)));
            console.log('Initial USDC Balance is ', intialUSDCBalance);
            // THIS IS THE FORMULA FOR CALCULATE,
            // THE AMOUNT OF 3CRV TOKENS TO SEND TO CURVE CONTRACT FOR WITHDRAWAL OF MIXED BALANCES
            const maxLPTokenBurnAmount = parseFloat(usdAmountToWithdrawFromCurvePool) /
                parseFloat(threecrvUSDPrice);
            console.log('3CRV tokens to withdraw is ', maxLPTokenBurnAmount);
            const maxLPTokenBurnAmountInWei = ethers.utils.parseEther(String(maxLPTokenBurnAmount));

            // DOING IT LIKE THIS CAUSES an error,
            // TransactionExecutionError: Transaction ran out of gas with ethers.js,
            // so I had to switch to web3
            // const balance0 = await curveWithdrawContract.balances(0);
            // console.log(balance0);

            // THIS WORKS :)
            const decimalPadding = ethers.BigNumber.from(1000000000000);
            // The indexes are for DAI, USDC and USDT respectively
            const curveContract = new web3.eth.Contract(threePoolContractABI,
                threePoolContractAddress);
            const balanceDAIWei = ethers.BigNumber
                .from(await curveContract.methods.balances(0).call());
            // because USDC and USDT are in 6 decimal places,
            // we have to convert them to standard wei numbers for easier addition
            const balanceUSDCWei = ethers.BigNumber
                .from(await curveContract.methods.balances(1).call()).mul(decimalPadding);
            const balanceUSDTWei = ethers.BigNumber
                .from(await curveContract.methods.balances(2).call()).mul(decimalPadding);


            const balances = [balanceDAIWei, balanceUSDCWei, balanceUSDTWei];

            let totalReservesWei = ethers.BigNumber.from('0');

            // GET TOTAL RESERVES OF THE TRI-POOL IN USDs
            balances.forEach((bal) => {
                totalReservesWei = totalReservesWei.add(bal);
            });

            const totalReserves = Number(ethers.utils.formatEther(totalReservesWei));
            const balanceDAI = Number(ethers.utils.formatEther(balanceDAIWei));
            const balanceUSDC = Number(ethers.utils.formatEther(balanceUSDCWei));
            const balanceUSDT = Number(ethers.utils.formatEther(balanceUSDTWei ));

            const daiReservePercentage = balanceDAI / totalReserves;
            const usdcReservePercentage = balanceUSDC / totalReserves;
            const usdtReservePercentage = balanceUSDT / totalReserves;

            const singleAmountDai = usdAmountToWithdrawFromCurvePool * daiReservePercentage;
            const singleAmountUsdc = usdAmountToWithdrawFromCurvePool * usdcReservePercentage;
            const singleAmountUsdt = usdAmountToWithdrawFromCurvePool * usdtReservePercentage;
            const amounts = [ethers.utils.parseEther(String(singleAmountDai)),
                // we pass USDC and USDT in 6 decimals instead of 18
                ethers.utils.parseEther(String(singleAmountUsdc)).div(decimalPadding),
                ethers.utils.parseEther(String(singleAmountUsdt)).div(decimalPadding)];

            // THIS IS WHERE WE NOW WITHDRAW,
            // ALL STABLE COINS IN PROPORTION TO THEIR POOL PERCENTAGES
            const {status} = await (await curveWithdrawContract
                .remove_liquidity_imbalance(amounts, maxLPTokenBurnAmountInWei)).wait();

            // check if the withdraw is successful
            expect(status).to.equal(1);

            const finalDaiBalance = Number(ethers.utils
                .formatEther(await erc20DAI.balanceOf(owner.address)));
            console.log('Final DAI Balance is ', finalDaiBalance);

            const finalUSDCBalance = Number(ethers.utils
                .formatEther((await erc20USDC.balanceOf(owner.address)).mul(decimalPadding)));
            console.log('Final USDC Balance is ', finalUSDCBalance);

            const finalUSDTBalance = Number(ethers.utils
                .formatEther((await erc20USDT.balanceOf(owner.address)).mul(decimalPadding)));
            console.log('Final USDT Balance is ', finalUSDTBalance);
            expect(finalDaiBalance).to.be.gt(intialDaiBalance); 
            expect(finalUSDTBalance).to.be.gt(intialUSDTBalance); 
            expect(finalUSDCBalance).to.be.gt(intialUSDCBalance);
        });
    });
});
