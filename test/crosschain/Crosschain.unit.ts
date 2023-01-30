import { ethers, waffle, artifacts } from 'hardhat';
import { Contract } from '@ethersproject/contracts';
import { MockContract } from 'ethereum-waffle';
import chai from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';

const { deployMockContract, provider } = waffle;
const [wallet, otherWallet] = provider.getWallets();
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = chai;

export const bn = (num: string | number) => new BigNumber(num);
export const decify = (value: any, decimals: any) =>
    bn(value).times(bn(10).pow(decimals)).integerValue();
export const undecify = (value: any, decimals: any) =>
    bn(value.toString()).dividedBy(bn(10).pow(decimals));
export const tokenify = (value: any) => decify(value, 18);

async function deployContract(name: string, admin: SignerWithAddress) {
    const Factory = await ethers.getContractFactory(name, admin);
    const contract = await Factory.deploy();
    await contract.deployed();
    return contract;
}

async function stubToken(decimals: number, admin: SignerWithAddress) {
    const StubToken = await ethers.getContractFactory('StubToken', admin);
    const token = await StubToken.deploy('StubToken', 'StubToken', decimals);
    await token.deployed();
    return token;
}

const mockContract = async (name: string) =>
    deployMockContract(wallet, (await artifacts.readArtifact(name)).abi);

const mockCurvePool = async () => mockContract('ICurvePool');

// const setTotalHoldings = async (strategy: MockContract, holdings: any) =>
//     await strategy.mock.totalHoldings.returns(bn(holdings).toFixed());

enum MessageType {
    Deposit,
    Withdrawal,
}

describe('Cross-chain', () => {
    let admin: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let rosa: SignerWithAddress;

    let zunami: Contract;
    let strategy: Contract;
    let curvePool: Contract;
    let layerzero: Contract;
    let stargate: Contract;
    let gateway: Contract;
    let forwarder: Contract;

    let usdt: Contract;
    let usdc: Contract;
    let dai: Contract;

    let gatewayTrustedAddress: string;
    let forwarderTrustedAddress: string;

    const masterChainId = 1;
    const otherChainId = 2;
    const masterUSDTPoolId = 3;
    const otherUSDTPoolId = 4;

    async function mintAndApproveTokenTo(
        spenderAddress: string,
        token: Contract,
        user: SignerWithAddress,
        tokenAmount: number,
        tokenDecimals: number
    ) {
        const tokenBalance = decify(tokenAmount, tokenDecimals).toFixed();

        await token.mint(user.address, tokenBalance);
        await token.connect(user).approve(spenderAddress, tokenBalance);

        return tokenBalance;
    }

    async function mintAndApproveTokensTo(
        spenderAddress: string,
        user: SignerWithAddress,
        tokenAmounts: number[]
    ) {
        const tokenBalances = [];
        tokenBalances[0] = await mintAndApproveTokenTo(
            spenderAddress,
            dai,
            user,
            tokenAmounts[0],
            18
        );
        tokenBalances[1] = await mintAndApproveTokenTo(
            spenderAddress,
            usdc,
            user,
            tokenAmounts[1],
            6
        );
        tokenBalances[2] = await mintAndApproveTokenTo(
            spenderAddress,
            usdt,
            user,
            tokenAmounts[2],
            6
        );
        return tokenBalances;
    }

    beforeEach(async () => {
        [admin, alice, bob, carol, rosa] = await ethers.getSigners();

        usdt = await stubToken(6, admin);
        usdc = await stubToken(6, admin);
        dai = await stubToken(18, admin);

        curvePool = await mockCurvePool();

        layerzero = await deployContract('LayerZeroEndpointStab', admin);
        stargate = await deployContract('StargateRouterStab', admin);

        const Zunami = await ethers.getContractFactory('Zunami', admin);
        zunami = await Zunami.deploy([dai.address, usdc.address, usdt.address]);
        await zunami.deployed();

        const RebalancingStrat = await ethers.getContractFactory('RebalancingStrat', admin);
        strategy = await RebalancingStrat.deploy([dai.address, usdc.address, usdt.address]);
        await strategy.deployed();

        await zunami.addPool(strategy.address);
        await strategy.setZunami(zunami.address);
        await zunami.setDefaultDepositPid(0);
        await zunami.setDefaultWithdrawPid(0);

        const ZunamiForwarder = await ethers.getContractFactory('ZunamiForwarder', admin);
        forwarder = await ZunamiForwarder.deploy(
            [dai.address, usdc.address, usdt.address],
            masterUSDTPoolId,
            zunami.address,
            curvePool.address,
            stargate.address,
            layerzero.address
        );
        await forwarder.deployed();
        expect(forwarder.address).to.properAddress;

        const ZunamiGateway = await ethers.getContractFactory('ZunamiGateway', admin);
        gateway = await ZunamiGateway.deploy(
            usdt.address,
            otherUSDTPoolId,
            stargate.address,
            layerzero.address
        );
        await gateway.deployed();
        expect(gateway.address).to.properAddress;

        gatewayTrustedAddress = ethers.utils.solidityPack(
            ['address', 'address'],
            [gateway.address, forwarder.address]
        );
        forwarderTrustedAddress = ethers.utils.solidityPack(
            ['address', 'address'],
            [forwarder.address, gateway.address]
        );

        await forwarder.setGatewayParams(otherChainId, gateway.address, otherUSDTPoolId);

        await forwarder.setTrustedRemote(otherChainId, gatewayTrustedAddress);
        await forwarder.setTrustedRemote(masterChainId, forwarderTrustedAddress);

        await gateway.setForwarderParams(masterChainId, forwarder.address, masterUSDTPoolId);

        await gateway.setTrustedRemote(otherChainId, gatewayTrustedAddress);
        await gateway.setTrustedRemote(masterChainId, forwarderTrustedAddress);
    });

    it('should be created rightly', async () => {
        await expect(await forwarder.tokens(0)).to.be.equal(dai.address);
        await expect(await forwarder.tokens(1)).to.be.equal(usdc.address);
        await expect(await forwarder.tokens(2)).to.be.equal(usdt.address);

        await expect(await forwarder.tokenPoolId()).to.be.equal(masterUSDTPoolId);
        await expect(await forwarder.zunami()).to.be.equal(zunami.address);
        await expect(await forwarder.stargateRouter()).to.be.equal(stargate.address);
        await expect(await forwarder.lzEndpoint()).to.be.equal(layerzero.address);
        await expect(await forwarder.curveExchange()).to.be.equal(curvePool.address);

        await expect(await forwarder.gatewayChainId()).to.be.equal(otherChainId);
        await expect(await forwarder.gatewayAddress()).to.be.equal(gateway.address);
        await expect(await forwarder.gatewayTokenPoolId()).to.be.equal(otherUSDTPoolId);

        await expect(await gateway.tokenPoolId()).to.be.equal(otherUSDTPoolId);
        await expect(await gateway.stargateRouter()).to.be.equal(stargate.address);
        await expect(await gateway.lzEndpoint()).to.be.equal(layerzero.address);

        await expect(await gateway.forwarderChainId()).to.be.equal(masterChainId);
        await expect(await gateway.forwarderAddress()).to.be.equal(forwarder.address);
        await expect(await gateway.forwarderTokenPoolId()).to.be.equal(masterUSDTPoolId);
    });

    it('should make deposit and withdrawal in gateway', async () => {
        const usdtAmounts = [100, 200, 300];
        const usdtTotal = 600;
        const users = [alice, bob, carol];

        // deposit
        for (let i = 0; i < users.length; i++) {
            await mintAndApproveTokensTo(gateway.address, users[i], [0, 0, usdtAmounts[i]]);
            await gateway.connect(users[i]).delegateDeposit(decify(usdtAmounts[i], 6).toFixed());
        }

        await gateway.sendCrossDeposit(users.map((user) => user.address));
        const depositId = await ethers.provider.getBlockNumber();

        // emulate USDT bakance removal on cross-deposit
        await gateway.withdrawStuckToken(usdt.address);

        // await expectRevert(
        //   gateway.sendCrossDeposit(users.map(user => user.address)),
        //   'Gateway: deposit was sent'
        // );

        //TODO: return 500 instead of 600 zlp
        let message = ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'uint256', 'uint256', 'uint8'],
            [MessageType.Deposit, depositId, tokenify(usdtTotal).toFixed(), 18]
        );
        await layerzero.lzReceive(
            gateway.address,
            masterChainId,
            forwarderTrustedAddress,
            0,
            message
        );
        await gateway.finalizeCrossDeposit();

        for (let i = 0; i < users.length; i++) {
            await expect(await gateway.balanceOf(users[i].address)).to.be.equal(
                tokenify(usdtAmounts[i]).toFixed()
            );
        }

        // //deposit can be sent again
        // for (let i = 0; i < users.length; i++) {
        //     await mintAndApproveTokensTo(gateway.address, users[i], [0,0,usdtAmounts[i]]);
        //     await gateway.connect(users[i]).delegateDeposit(decify(usdtAmounts[i], 6).toFixed());
        // }
        //
        // await gateway.sendCrossDeposit(users.map(user => user.address));

        // withdrawal half
        for (let i = 0; i < users.length; i++) {
            const tokenBalance = decify(usdtAmounts[i] / 2, 18).toFixed();
            await gateway.connect(users[i]).approve(gateway.address, tokenBalance);
            await gateway.connect(users[i]).delegateWithdrawal(tokenBalance);
        }

        // withdrawal second half
        for (let i = 0; i < users.length; i++) {
            const tokenBalance = decify(usdtAmounts[i] / 2, 18).toFixed();
            await gateway.connect(users[i]).approve(gateway.address, tokenBalance);
            await gateway.connect(users[i]).delegateWithdrawal(tokenBalance);
        }

        for (let i = 0; i < users.length; i++) {
            await expect(await gateway.pendingWithdrawals(users[i].address)).to.be.equal(
                tokenify(usdtAmounts[i]).toFixed()
            );
        }

        await gateway.sendCrossWithdrawal(users.map((user) => user.address));
        const withdrawalId = await ethers.provider.getBlockNumber();

        // await expectRevert(
        //   gateway.sendCrossWithdrawal(users.map(user => user.address)),
        //   'Gateway: withdrawal was sent'
        // );

        //emulate USDT balance increasing by
        const cameTokens = decify(usdtTotal, 6).toFixed();
        await usdt.mint(gateway.address, cameTokens);
        message = ethers.utils.defaultAbiCoder.encode(['uint'], [withdrawalId]);
        await stargate.sgReceive(
            gateway.address,
            masterChainId,
            '',
            0,
            usdt.address,
            cameTokens,
            message
        );

        message = ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'uint256', 'uint256', 'uint8'],
            [MessageType.Withdrawal, withdrawalId, cameTokens, 6]
        );
        await layerzero.lzReceive(
            gateway.address,
            masterChainId,
            forwarderTrustedAddress,
            0,
            message
        );

        await gateway.finalizeCrossWithdrawal();

        for (let i = 0; i < users.length; i++) {
            await expect(await usdt.balanceOf(users[i].address)).to.be.equal(
                decify(usdtAmounts[i], 6).toFixed()
            );
        }

        // // withdrawal can be sent again
        // for (let i = 0; i < users.length; i++) {
        //     const tokenBalance = decify(gzlpAmounts[i], 18).toFixed();
        //     await gateway.connect(users[i]).approve(gateway.address, tokenBalance);
        //     await gateway.connect(users[i]).delegateWithdrawal(tokenBalance);
        // }
        //
        // await gateway.sendCrossWithdrawal(users.map(user => user.address));
    });

    it('should make deposit and withdrawal in forwarder', async () => {
        const depositId = 1234;
        const usdtTotal = 600;
        const usdtTotalMinimals = decify(600, 6).toFixed();

        // deposit
        await usdt.mint(forwarder.address, usdtTotalMinimals);
        let message = ethers.utils.defaultAbiCoder.encode(['uint256'], [depositId]);
        await stargate.sgReceive(
            forwarder.address,
            otherChainId,
            '',
            0,
            usdt.address,
            usdtTotalMinimals,
            message
        );

        message = ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'uint256', 'uint256', 'uint8'],
            [MessageType.Deposit, depositId, tokenify(usdtTotal).toFixed(), 18]
        );
        await layerzero.lzReceive(
            forwarder.address,
            otherChainId,
            gatewayTrustedAddress,
            0,
            message
        );

        await forwarder.delegateCrossDeposit();
        await expect(await usdt.balanceOf(zunami.address)).to.be.equal(usdtTotalMinimals);
        await expect(await usdt.balanceOf(forwarder.address)).to.be.equal(0);

        await zunami.completeDeposits([forwarder.address]);
        await expect(await usdt.balanceOf(strategy.address)).to.be.equal(usdtTotalMinimals);
        await expect(await usdt.balanceOf(zunami.address)).to.be.equal(0);
        await expect(await zunami.balanceOf(forwarder.address)).to.be.equal(
            decify(600, 18).toFixed()
        );

        await forwarder.completeCrossDeposit();

        // withdrawal
        const witdrawalId = 4321;
        const zlpTotalHalf = tokenify(600 / 2).toFixed();
        message = ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'uint256', 'uint256', 'uint8'],
            [MessageType.Withdrawal, witdrawalId, zlpTotalHalf, 18]
        );
        await layerzero.lzReceive(
            forwarder.address,
            otherChainId,
            gatewayTrustedAddress,
            0,
            message
        );

        await zunami.completeWithdrawals([forwarder.address]);
        await expect(await zunami.balanceOf(forwarder.address)).to.be.equal(zlpTotalHalf);
        await expect(await usdt.balanceOf(strategy.address)).to.be.equal(
            decify(600 / 2, 6).toFixed()
        );
        await expect(await usdt.balanceOf(forwarder.address)).to.be.equal(
            decify(600 / 2, 6).toFixed()
        );

        await forwarder.completeCrossWithdrawal();
    });

    // it('should withdraw stuck native coin', async () => {
    //     await alice.sendTransaction({
    //         to: gateway.address,
    //         value: ethers.utils.parseEther("1"),
    //     });
    //     await expect(await provider.getBalance(gateway.address)).to.be.equal(ethers.utils.parseEther("1"));
    //
    //     await gateway.withdrawStuckNative();
    //
    //     await expect(await provider.getBalance(gateway.address)).to.be.equal(0);
    // });
});
