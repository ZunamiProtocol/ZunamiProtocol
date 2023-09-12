const { ethers } = require('hardhat');

const baseFixed = ethers.FixedNumber.from((Math.pow(10,18)).toString());
const base = ethers.BigNumber.from((Math.pow(10,18)).toString());

function toDecimalStringified(amount) {
  return ethers.FixedNumber.fromString(amount.toString()).divUnsafe(baseFixed).toString();
}

async function calcCurvePoolTvl(poolAddr, block) {
  const pool = await ethers.getContractAt("ICurvePool", poolAddr);
  const virtualPrice = await pool.get_virtual_price({blockTag: block});
  const poolLP = await ethers.getContractAt("ERC20", poolAddr);
  const totalSupply = await poolLP.totalSupply({blockTag: block});
  console.log(`Curve pool ${poolAddr}: supply ${toDecimalStringified(totalSupply)}, price ${toDecimalStringified(virtualPrice)}`);
  return (totalSupply.mul(virtualPrice).div(base));
}

async function main() {
  // UZD
  const uzdBlock = 17908949;

  const uzdOmnipoolAddress = "0x2ffCC661011beC72e1A9524E12060983E74D14ce";
  const uzdAddress = "0xb40b6608B2743E691C9B54DdBDEe7bf03cd79f1c";
  const uzdFraxBpPoolAddress = "0x68934F60758243eafAf4D2cFeD27BF8010bede3a";
  const uzdCrvUsdPoolAddress = "0xfC636D819d1a98433402eC9dEC633d864014F28C";
  const uzdApsVaultAddress = "0xdC1AEb773Bd7dEd31170C1Ffe54Dd3639459bE07";

  const uzdOmnipool = await ethers.getContractAt('Zunami', uzdOmnipoolAddress);

  const uzdOmnipoolHoldings = (await uzdOmnipool.totalHoldings({blockTag: uzdBlock}));
  console.log("UZD omnipool holdings:", toDecimalStringified(uzdOmnipoolHoldings));
  const fraxBpPoolTVL = (await calcCurvePoolTvl(uzdFraxBpPoolAddress, uzdBlock));
  console.log("TVL FraxBP pool:", toDecimalStringified(fraxBpPoolTVL));
  const crvUsdPoolTVL = (await calcCurvePoolTvl(uzdCrvUsdPoolAddress, uzdBlock));
  console.log("TVL crvUSD pool:", toDecimalStringified(crvUsdPoolTVL));

  const uzd = await ethers.getContractAt('ERC20', uzdAddress);

  const uzdTotalSupply = (await uzd.totalSupply({blockTag: uzdBlock}));
  console.log("UZD total supply:", toDecimalStringified(uzdTotalSupply));

  const frzBpUZDBalance = (await uzd.balanceOf(uzdFraxBpPoolAddress, {blockTag: uzdBlock}));
  const crvUsdUZDBalance = (await uzd.balanceOf(uzdCrvUsdPoolAddress, {blockTag: uzdBlock}));
  const uzdApsVaultUZDBalance = (await uzd.balanceOf(uzdApsVaultAddress, {blockTag: uzdBlock}));

  const totalUZDPoolsBalance = (frzBpUZDBalance.add(crvUsdUZDBalance).add(uzdApsVaultUZDBalance));
  console.log("UZD total pools balance:", toDecimalStringified(totalUZDPoolsBalance));

  const UZDOutPoolsBalance = uzdTotalSupply.sub(totalUZDPoolsBalance);
  console.log("UZD out of pools balance:", toDecimalStringified(UZDOutPoolsBalance));

  const uzdAllHoldings = UZDOutPoolsBalance.add(fraxBpPoolTVL).add(crvUsdPoolTVL).add(uzdApsVaultUZDBalance);
  console.log("All uzd holdings:", toDecimalStringified(uzdAllHoldings));

  const hackAmountUZD = uzdAllHoldings.sub(uzdOmnipoolHoldings);
  console.log("Hack amount UZD:", toDecimalStringified(hackAmountUZD));
  console.log("");


  // zETH
  const zethBlock = 17908908;

  const zethOmnipoolAddress = "0x9dE83985047ab3582668320A784F6b9736c6EEa7";
  const zethAddress = "0xe47f1CD2A37c6FE69e3501AE45ECA263c5A87b2b";
  const zethFrxEthPoolAddress = "0xfc89b519658967fcbe1f525f1b8f4bf62d9b9018";
  const zethApsVaultAddress = "0xDc0B52c04CdC0099aeFcCa8B0675A00cF8f6d7dC";

  const zethOmnipool = await ethers.getContractAt('Zunami', zethOmnipoolAddress);

  const zethOmnipoolHoldings = (await zethOmnipool.totalHoldings({blockTag: zethBlock}));
  console.log("zETH omnipool holdings:", toDecimalStringified(zethOmnipoolHoldings));

  const frxETHPoolTVL = (await calcCurvePoolTvl(zethFrxEthPoolAddress, zethBlock));
  console.log("TVL frxETH pool:", toDecimalStringified(frxETHPoolTVL));

  const zeth = await ethers.getContractAt('ERC20', zethAddress);

  const zethTotalSupply = (await zeth.totalSupply({blockTag: zethBlock}));
  console.log("zeth total supply:", toDecimalStringified(zethTotalSupply));

  const zethApsVaultUZDBalance = (await uzd.balanceOf(zethApsVaultAddress, {blockTag: zethBlock}));


  const totalZETHPoolsBalance = (await zeth.balanceOf(zethFrxEthPoolAddress, {blockTag: zethBlock})).add(zethApsVaultUZDBalance);
  console.log("ZETH total pools balance:", toDecimalStringified(totalZETHPoolsBalance));



  const ZETHOutPoolsBalance = zethTotalSupply.sub(totalZETHPoolsBalance);
  console.log("ZETH out of pools balance:", toDecimalStringified(ZETHOutPoolsBalance));


  const zethAllHoldings = ZETHOutPoolsBalance.add(frxETHPoolTVL).add(zethApsVaultUZDBalance);
  console.log("All zeth holdings:", toDecimalStringified(uzdAllHoldings));

  const hackAmountZETH = zethAllHoldings.sub(zethOmnipoolHoldings);
  console.log("Hack amount ZETH:", toDecimalStringified(hackAmountZETH));
  console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
