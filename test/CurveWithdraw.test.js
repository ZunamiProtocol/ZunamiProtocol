require('dotenv').config();
const {expect} = require('chai');
const {network} = require('hardhat');
const erc20TokenABI = require('human-standard-token-abi');
const Web3 = require('web3');
const web3 = new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`);

// The abi for the 3pool contract
// eslint-disable-next-line max-len
const threePoolContractABI = [{"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false},{"type":"uint256","name":"future_time","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}];

// The Whale Address to get some 3CRV from
// i.e. https://etherscan.io/address/0x11c9ac11ce9913e26faa7a9ee5b07c92b0c8c372
const whaleAddress = '0x11c9ac11ce9913e26faa7a9ee5b07c92b0c8c372';
const threeCRVTokenAddress = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
const threePoolContractAddress = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

// stable coin addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const usdtAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

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
        curveWithdrawContract = new ethers.Contract(threePoolContractAddress, threePoolContractABI, owner);
    });

    describe('Get 3CRV price  + check contract deployment', () => {
        it('Should get the 3crv token price from the 3pool contract', async function() {
            const threecrvUSDPriceInWei = await curveWithdrawContract.get_virtual_price();
            threecrvUSDPrice = ethers.utils.formatEther(threecrvUSDPriceInWei);
            console.log(threecrvUSDPrice);
        });
        it('Should correctly deploy the curve test withdrawal contract', async function() {
            expect(curveWithdrawContract).to.not.be.null;
        });
    });

    describe('Impersonate a 3CRV whale account + transfer the 3CRV + do withdrawal', () => {
        const threeCRVToSend = 1000;
        const usdAmountToWithdraw = 100;
        before(async () => {
            await impersonateThreeCRVWhale();
        });

        it(`Whale should transfer ${threeCRVToSend} 3CRV tokens to user`, async function() {
            const owner = (await ethers.getSigners())[0];
            const signer = await ethers.getSigner(whaleAddress);
            const erc20 = new ethers.Contract(threeCRVTokenAddress, erc20TokenABI, signer);
            // transfer 10000 3CRV from the whale account to owner
            const transferAmountInWei = ethers.utils.parseEther(String(threeCRVToSend));
            const {status} = await(await erc20
                .transfer(owner.address, transferAmountInWei)).wait();
            // check if the transfer is successful
            expect(status).to.equal(1);
            // check the 3CRV balance of the user
            const userThreeCRVTokenBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('User 3CRV balance is ', userThreeCRVTokenBalance);
            // The 3CRV balance should be equal to the amount sent from whale account
            expect(userThreeCRVTokenBalance).to.be.equal(threeCRVToSend);
        });

        // eslint-disable-next-line max-len
        it(`Contract should be able to partially withdraw $${usdAmountToWithdraw} in DAI from 3pool curve contract`, async function() {
            const owner = (await ethers.getSigners())[0];
            const erc20 = new ethers.Contract(daiAddress, erc20TokenABI, owner);
            const intialDaiBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('Initial DAI Balance is ', intialDaiBalance);
      
            // THIS IS THE FORMULA FOR CALCULATE THE AMOUNT OF TOKENS TO SEND TO CURVE CONTRACT FOR WITHDRAWAL
            const threeCRVTokensToWithdraw = parseFloat(usdAmountToWithdraw) /
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
            const {status} = await(await curveWithdrawContract.remove_liquidity_one_coin(threeCRVTokensToWithdrawInWei , coinIndex, slippageAmountInWei)).wait();

            // check if the transfer is successful
            expect(status).to.equal(1);

            const finalDaiBalance = Number(ethers.utils
                .formatEther(await erc20.balanceOf(owner.address)));
            console.log('Final DAI Balance is ', finalDaiBalance);

            expect(finalDaiBalance).to.be.gt(intialDaiBalance);
        });

         // eslint-disable-next-line max-len
        it(`Contract should be able to partially withdraw $${usdAmountToWithdraw} in mixed amounts from 3pool curve contract`, async function() {
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
      
            // THIS IS THE FORMULA FOR CALCULATE THE AMOUNT OF 3CRV TOKENS TO SEND TO CURVE CONTRACT FOR WITHDRAWAL OF MIXED BALANCES
            const maxLPTokenBurnAmount = parseFloat(usdAmountToWithdraw) / parseFloat(threecrvUSDPrice);
            console.log('3CRV tokens to withdraw / Max LP token burn amount is ', maxLPTokenBurnAmount);
            const maxLPTokenBurnAmountInWei = ethers.utils.parseEther(String(maxLPTokenBurnAmount));

            
            // DOING IT LIKE THIS CAUSES A TransactionExecutionError: Transaction ran out of gas with ethers.js, so I had to switch to web3
            // const balance0 = await curveWithdrawContract.balances(0);
            // console.log(balance0);
            
            // THIS WORKS :)
            // The indexes are for DAI, USDC and USDT respectively
            const curveContract = new web3.eth.Contract(threePoolContractABI, threePoolContractAddress);
            const balanceDAIWei = ethers.BigNumber.from(await curveContract.methods.balances(0).call());
            // because USDC and USDT are in 6 decimal places we have to convert them to standard wei numbers for easier addition
            const balanceUSDCWei = ethers.BigNumber.from(await curveContract.methods.balances(1).call()).mul(1000000000000);
            const balanceUSDTWei = ethers.BigNumber.from(await curveContract.methods.balances(2).call()).mul(1000000000000);


            const balances = [balanceDAIWei, balanceUSDCWei, balanceUSDTWei];

            let totalReservesWei = ethers.BigNumber.from('0');

            // GET TOTAL RESERVES OF THE TRI-POOL IN USDs
            balances.forEach((bal) => {
                totalReservesWei = totalReservesWei.add(bal);
            });

            const totalReserves = Number(ethers.utils.formatEther(totalReservesWei));
            const balanceDAI = Number(ethers.utils.formatEther(balanceDAIWei));
            const balanceUSDC = Number(ethers.utils.formatEther(balanceUSDCWei));
            const balanceUSDT  = Number(ethers.utils.formatEther(balanceUSDTWei ));

            console.log(totalReserves);
            console.log(balanceDAI);
            console.log(balanceUSDC);
            console.log(balanceUSDT);

            const daiReservePercentage = balanceDAI / totalReserves;
            const usdcReservePercentage = balanceUSDC / totalReserves;
            const usdtReservePercentage = balanceUSDT / totalReserves;

            console.log(daiReservePercentage);
            console.log(usdcReservePercentage);
            console.log(usdtReservePercentage);


            const singleAmountDai = usdAmountToWithdraw * daiReservePercentage;
            console.log(singleAmountDai);
            const singleAmountUsdc = usdAmountToWithdraw * usdcReservePercentage;
            console.log(singleAmountUsdc);
            const singleAmountUsdt = usdAmountToWithdraw * usdtReservePercentage;
            console.log(singleAmountUsdt);
            const amounts = [ethers.utils.parseEther(String(singleAmountDai)), 
                        // we pass USDC and USDT in 6 decimals instead of 18
                        singleAmountUsdc * 10000000, 
                        singleAmountUsdt * 10000000];


            // withdraw all the amounts from the contract
            const {status} = await(await curveWithdrawContract.remove_liquidity_imbalance(amounts, maxLPTokenBurnAmountInWei)).wait();

            // check if the withdraw is successful
            expect(status).to.equal(1);

            const finalDaiBalance = Number(ethers.utils
                .formatEther(await erc20DAI.balanceOf(owner.address)));
            console.log('Final DAI Balance is ', finalDaiBalance);

            const finalUSDTBalance = Number(ethers.utils
                .formatEther(await erc20USDT.balanceOf(owner.address)));
            console.log('Final USDT Balance is ', finalUSDTBalance);

            const finalUSDCBalance = Number(ethers.utils
                .formatEther(await erc20USDC.balanceOf(owner.address)));
            console.log('Final USDC Balance is ', finalUSDCBalance);

            expect(finalDaiBalance).to.be.gt(intialDaiBalance); 
        });
    });
});
