const fs = require("fs").promises;
const { ethers } = require('hardhat');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const baseFixed = ethers.FixedNumber.from((Math.pow(10,18)).toString());
const base = ethers.BigNumber.from((Math.pow(10,18)).toString());
const zero = ethers.BigNumber.from(0);
function toDecimalStringified(amount) {
  return ethers.FixedNumber.fromString(amount.toString()).divUnsafe(baseFixed).toString();
}

function removeZeroBalances(balances) {
  const updated = {};
  for (const key in balances) {
    if(!balances[key].isZero()) {
      updated[key] = balances[key];
    }
  }
  return updated;
}

function getAllHoldersBy(transfers) {
  const holders = {};
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    const from = transfer.from;
    const to = transfer.to;
    holders[from] = true;
    holders[to] = true;
  }
  return Object.keys(holders);
}

async function getTokenBalancesByHoldersOnBlock(block, holders, token) {
  const balanceHash = {};
  const balancesAsync = holders.map((holder) => token.balanceOf(holder, {blockTag: block}));

  const chunkSize = 10;
  for (let i = 0; i < balancesAsync.length; i += chunkSize) {
    const chunk = balancesAsync.slice(i, i + chunkSize);
    const balances = await Promise.all(chunk);
    for (let j = 0; j < balances.length; j++) {
      balanceHash[holders[i + j]] = balances[j];
    }
  }
  return removeZeroBalances(balanceHash);
}

async function calcMinters(transfers, zaps, replacers) {
  const minters = {};
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    const event = transfer.event;
    let from = zaps.includes(transfer.from)
      ? (await event.getTransaction()).from
      : transfer.from;
    // if(from !== transfer.from) {
    //   console.debug(`ZAP FROM: ${transfer.from} -> ${from}`);
    // }
    if(!!replacers[from]) {
      // console.debug(`REPLACE FROM: ${from} -> ${replacers[from]}`);
      from = replacers[from];
    }

    let to = zaps.includes(transfer.to)
      ? (await event.getTransaction()).from
      : transfer.to;
    // if(to !== transfer.to) {
    //   console.debug(`ZAP TO: ${transfer.to} -> ${to}`);
    // }
    if(!!replacers[to]) {
      // console.debug(`REPLACE TO: ${to} -> ${replacers[to]}`);
      to = replacers[to];
    }

    const value = transfer.value;

    if(from === ethers.constants.AddressZero) {
      if(!minters[to]) minters[to] = ethers.BigNumber.from("0");
      minters[to] = minters[to].add(value);
    }

    if(to === ethers.constants.AddressZero) {
      if(!minters[from]) minters[from] = ethers.BigNumber.from("0");
      minters[from] = minters[from].sub(value);
    }
  }
  const minterKeys = Object.keys(minters)
  // console.log("minterKeys: ", minterKeys);
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    if(minterKeys.includes(transfer.from) && minterKeys.includes(transfer.to)) {
      minters[transfer.to] = minters[transfer.to].add(transfer.value);
      minters[transfer.from] = minters[transfer.from].sub(transfer.value);
      // console.log(`TRANSFER ${transfer.from} -> ${transfer.to} = ${transfer.value.toString()}`);
    }
  }
  return removeZeroBalances(minters);
}

async function writeCsv(balances, total, pie) {
  const csvWriter = createCsvWriter({
    path: './scripts/results/zunami_uzd_balances.csv',
    header: [
      {id: 'user', title: 'USER'},
      {id: 'balance', title: 'BALANCE'},
      {id: 'percent', title: 'PERCENT'},
      {id: 'value', title: 'VALUE'},
      {id: 'lost', title: 'LOST'}
    ]
  });

  const cvsRecords = Object.entries(balances).map(([key, balance]) => {
    const percent = balance.mul(base).div(total);
    const userValue = percent.mul(pie).div(base);
    const userLost = base.sub(userValue.mul(base).div(balance));
    return {
      user: key,
      balance: toDecimalStringified(balance),
      percent: toDecimalStringified(percent),
      value: toDecimalStringified(userValue),
      lost: toDecimalStringified(userLost),
    }
  });
  await csvWriter.writeRecords(cvsRecords);
  console.log(`Balances CSV saved!`);
}

async function writeJson(balances, total, pie) {
  const records = Object.entries(balances).map(([key, balance]) => {
    const percent = balance.mul(base).div(total);
    const userValue = percent.mul(pie).div(base);
    return [key, userValue.toString()];
  });

  await fs.writeFile("./scripts/results/zunami_uzd_balances.json", JSON.stringify(
    Object.fromEntries(records)
  ));
  console.log(`Balances JSON saved!`);
}

function calcBalancesBy(transfers) {
  const balances = {};
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    const from = transfer.from;
    const to = transfer.to;
    const value = transfer.value;

    if(!balances[to]) balances[to] = ethers.BigNumber.from("0");
    balances[to] = balances[to].add(value);

    if(!balances[from]) balances[from] = ethers.BigNumber.from("0");;
    balances[from] = balances[from].sub(value);
  }
  return removeZeroBalances(balances);
}

function filterBy(address, transfers) {
  return transfers.filter((tr) => tr.from === address || tr.to === address);
}

async function getTransfersBy(config) {
  const Token = await ethers.getContractFactory('ERC20');
  const token = await Token.attach(config[0]);
  const fromBlock = config[1];
  const toBlock = config[2];
  const tokenName = config[3];
  // const minAmount = ethers.BigNumber.from(config[4].toString());
  // const type = config[5];
  const blocks = toBlock - fromBlock;
  const totalSupply = await token.totalSupply({blockTag: toBlock});

  console.log("transfers blocks count: ", blocks);
  const events = await token.queryFilter("Transfer", fromBlock, toBlock);
  const transfers = events.map((event) => ({
    from: event.args.from,
    to: event.args.to,
    value: event.args.value,
    event: event
  }));
  console.log(`Transfers before ${toBlock}: ${transfers.length}`);

  // const checker = (addr) => [].includes(addr.toLowerCase())
  // for (const transfer of transfers) {
  //   if(checker(transfer.from) || checker(transfer.to)) {
  //     console.log(`Find Transfer ${transfer.event.transactionHash} : ${transfer.from} -> ${transfer.to} with ${transfer.value}`)
  //   }
  // }

  return {transfers, token, totalSupply};
}

function printTokenBalances(name, balances) {
  console.log(`${name} balances:`);
  for (const balancesKey in balances) {
    console.log(balancesKey,':',  toDecimalStringified(balances[balancesKey]));
  }
}

function countTotalByBalances(balances) {
  return Object.values(balances).reduce(
    (previous, current) => previous.add(current), zero
  );
}

async function calcCurvePoolTvl(poolAddr, block) {
  const pool = await ethers.getContractAt("ICurvePool", poolAddr);
  const virtualPrice = await pool.get_virtual_price({blockTag: block});
  const poolLP = await ethers.getContractAt("ERC20", poolAddr);
  const totalSupply = await poolLP.totalSupply({blockTag: block});
  console.log(`Curve pool ${poolAddr}: supply ${toDecimalStringified(totalSupply)}, price ${toDecimalStringified(virtualPrice)}`);
  return {totalSupply: totalSupply, lpPrice: virtualPrice, poolValue:  (totalSupply.mul(virtualPrice).div(base))};
}

async function calcZunamiPoolTvl(zunamiAddr, block) {
  const pool = await ethers.getContractAt("Zunami", zunamiAddr);
  const price = await pool.lpPrice({blockTag: block});
  const poolLP = await ethers.getContractAt("ERC20", zunamiAddr);
  const totalSupply = await poolLP.totalSupply({blockTag: block});
  console.log(`Zunami ${zunamiAddr}: supply ${toDecimalStringified(totalSupply)}, price ${toDecimalStringified(price)}`);
  return {totalSupply: totalSupply, lpPrice: price, poolValue:  (totalSupply.mul(price).div(base))};
}

async function calcZunamiPoolTvl(poolAddr, block) {
  const pool = await ethers.getContractAt("Zunami", poolAddr);
  const price = await pool.lpPrice({blockTag: block});
  const poolLP = await ethers.getContractAt("ERC20", poolAddr);
  const totalSupply = await poolLP.totalSupply({blockTag: block});
  console.log(`Curve pool ${poolAddr}: supply ${toDecimalStringified(totalSupply)}, price ${toDecimalStringified(price)}`);
  return {totalSupply: totalSupply, lpPrice: price, poolValue:  (totalSupply.mul(price).div(base))};
}

function mergeBalances(balances1, balances2) {
  const balances = balances1;
  for (const [key, value] of Object.entries(balances2)) {
    if(!balances[key]) balances[key] = zero;
    balances[key] = balances[key].add(value);
  }
  return balances;
}

function pricify(number, price) {
  return number.mul(price).div(base)
}

async function acceptTransferredValue(balances, transfers, exceptions) {
  const minters = Object.keys(balances);
  for (const minter of minters) {
    const transfersByAddress = transfers.filter((tr)=> tr.from === minter);
    for (const transfer of transfersByAddress) {
      if(!exceptions.includes(transfer.to)) {
        if(!balances[transfer.to]) balances[transfer.to] = zero;
        console.log(`Accept Transfer from ${minter} to ${transfer.to} value ${toDecimalStringified(balances[minter])}`);
        balances[transfer.to] = balances[transfer.to].add(balances[minter]);
        delete balances[minter];
      }
    }
  }
  return balances;
}

async function main() {
  const curveZaps = ["0x08780fb7E580e492c1935bEe4fA5920b94AA95Da", "0x271fbE8aB7f1fB262f81C77Ea5303F03DA9d3d6A"];

  const safeOwnerReplacer = {
    "0xeB33BFFa3CEE6E94667625663094Fe2BA3CBd66A": "0x9f4be89cF01f7A038e0b9015b6b3A354Ff169CA2",
    "0x8f4A7b7AeaA5c0E01b7b3c0e966D8E62e7b3cBf6": "0x3dFc49e5112005179Da613BdE5973229082dAc35",
    "0xA849456125301De7DedA49c09a65B673C115Cf37": "0x3dFc49e5112005179Da613BdE5973229082dAc35",
    "0x2B10AfF9c2F2e167bd263DDa581ecE825B56b1D6": "0x3E7bFa35D6d76076482ED6b627FE862098a7da15"
  };

  const configs = [
    // address, from, to, name, min_amount, type
    ["0xb40b6608B2743E691C9B54DdBDEe7bf03cd79f1c", 16775408, 17908949, "uzd", 1000000000000000000, "token"],
    ["0xCaB49182aAdCd843b037bBF885AD56A3162698Bd", 17206823, 17908949, "uzd aps", 1000000000000000000, "token"],
    ["0x68934F60758243eafAf4D2cFeD27BF8010bede3a", 16791061, 17908949, "UZD/FraxBP", 1000000000000000000, "pool"],
    ["0xfC636D819d1a98433402eC9dEC633d864014F28C", 17701058, 17908949, "UZD/CrvUSD", 1000000000000000000, "pool"],
    ["0x2ffCC661011beC72e1A9524E12060983E74D14ce", 14403415, 17908949, "omnipool", 1000000000000000000, "token"],
  ];

  const uzdConfig =  configs[0];
  const uzdApsConfig =  configs[1];
  const uzdFraxBpConfig =  configs[2];
  const uzdCrvUsdBpConfig =  configs[3];
  const omnipoolConfig =  configs[4];

  console.log("Processing Omnipool ", omnipoolConfig[0]);
  const {transfers: omnipoolTransfers, token: omnipoolToken, totalSupply: omnipoolTotalSupply} = await getTransfersBy(omnipoolConfig);

  console.log("Omnipool total supply: ", toDecimalStringified(omnipoolTotalSupply));
  const omnipoolAllHolders = getAllHoldersBy(omnipoolTransfers);

  const omnipoolBalances = await getTokenBalancesByHoldersOnBlock(omnipoolConfig[2], omnipoolAllHolders, omnipoolToken);
  // printTokenBalances(omnipoolConfig[3], omnipoolBalances);

  const uzdAddress = uzdConfig[0];
  const omnipoolStrategies = [uzdAddress];
  const uzdOmnipoolBalance = omnipoolBalances[uzdAddress];


  const omnipoolTotalCounted = countTotalByBalances(omnipoolBalances);
  console.log("Omnipool counted: ", toDecimalStringified(omnipoolTotalCounted));
  console.log("Omnipool uzd vault balance: ", toDecimalStringified(uzdOmnipoolBalance))

  const omnipoolBalancesUsers = Object.fromEntries(Object.entries(omnipoolBalances).filter(
    ([key]) => !omnipoolStrategies.includes(key))
  );
  const omnipoolUsersCounted = countTotalByBalances(omnipoolBalancesUsers)
  console.log("Omnipool users counted: ", toDecimalStringified(omnipoolUsersCounted));
  // printTokenBalances(omnipoolConfig[3], omnipoolBalancesUsers);

  const {totalSupply: omnipoolTotalSupply2, lpPrice: omnipoolTokenPrice, poolValue: omnipoolValue} =
    await calcZunamiPoolTvl(omnipoolConfig[0], omnipoolConfig[2]);

  let omnipoolHoldings = Object.fromEntries(Object.entries(omnipoolBalancesUsers).map(
      ([key, value]) => [key, pricify(value, omnipoolTokenPrice)]
    ),
  );
  omnipoolHoldings = removeZeroBalances(omnipoolHoldings)

  console.log("Omnipool total holdings: ", toDecimalStringified(pricify(omnipoolTotalSupply, omnipoolTokenPrice)));
  const omnipoolHoldingsCounted = countTotalByBalances(omnipoolHoldings);
  console.log("Omnipool users holdings: ", toDecimalStringified(omnipoolHoldingsCounted));
  // printTokenBalances(omnipoolConfig[3], omnipoolHoldings);



  console.log("Processing UZD ", uzdConfig[0]);
  const {transfers: uzdTransfers, token: uzdToken, totalSupply: uzdTotalSupply} = await getTransfersBy(uzdConfig);

  console.log("UZD total supply: ", toDecimalStringified(uzdTotalSupply));
  const uzdAllHolders = getAllHoldersBy(uzdTransfers);
  const uzdBalances = await getTokenBalancesByHoldersOnBlock(uzdConfig[2], uzdAllHolders, uzdToken);

  const uzdApsVaultAddress = "0xdC1AEb773Bd7dEd31170C1Ffe54Dd3639459bE07";
  const uzdPools = [uzdApsVaultAddress, uzdFraxBpConfig[0], uzdCrvUsdBpConfig[0]];
  const uzdApsVaultBalance = uzdBalances[uzdApsVaultAddress];
  const uzdFraxBpBalance = uzdBalances[uzdFraxBpConfig[0]];
  const uzdCrvUsdBalance = uzdBalances[uzdCrvUsdBpConfig[0]];

  const uzdTotalCounted = countTotalByBalances(uzdBalances);
  console.log("UZD counted: ", toDecimalStringified(uzdTotalCounted));
  console.log("UZD curve pools counted: ", toDecimalStringified(uzdFraxBpBalance.add(uzdCrvUsdBalance)))
  console.log("UZD aps vault balance: ", toDecimalStringified(uzdApsVaultBalance))

  const uzdBalancesUsers = Object.fromEntries(Object.entries(uzdBalances).filter(
    ([key]) => !uzdPools.includes(key))
  );
  const uzdUsersCounted = countTotalByBalances(uzdBalancesUsers)
  console.log("UZD users counted: ", toDecimalStringified(uzdUsersCounted));
  // printTokenBalances(uzdConfig[3], uzdBalancesUsers);



  console.log("Processing crvUsdPool ", uzdCrvUsdBpConfig[0]);
  const {transfers: crvUsdTransfers, token: crvUsdPoolToken, totalSupply: crvUsdPoolTotalSupply} =
    await getTransfersBy(uzdCrvUsdBpConfig);
  console.log("crvUSD Pool total supply: ", toDecimalStringified(crvUsdPoolTotalSupply));
  let crvUsdBalances = await calcMinters(crvUsdTransfers, curveZaps, safeOwnerReplacer);
  crvUsdBalances = await acceptTransferredValue(
    crvUsdBalances,
    crvUsdTransfers,
    [
      "0x0000000000000000000000000000000000000000",
      "0xe39c817fe25Ac1A8Bd343A74037E3C90b09bEeEF", // curve gauge
      "0x989AEb4d175e16225E39E87d0D97A3360524AD80", // convex
      "0x1Be554D7eD9DEdd39cd949a3cF1AE8D4A12bD7C4", // stakeDAO
    ]
  );

  const crvUSDPoolTotalCounted = countTotalByBalances(crvUsdBalances);
  console.log("crvUSD Pool counted: ", toDecimalStringified(crvUSDPoolTotalCounted));

  const {totalSupply: crvUsdPoolTotalSupply2, lpPrice: crvUsdPoolVirtualPrice, poolValue: crvUsdPoolValue} =
    await calcCurvePoolTvl(uzdCrvUsdBpConfig[0], uzdCrvUsdBpConfig[2]);

  const crvUsdHoldings = Object.fromEntries(Object.entries(crvUsdBalances).map(
      ([key, value]) => [key, pricify(value, crvUsdPoolVirtualPrice)]
    ),
  );

  console.log("crvUSD Pool total holdings: ", toDecimalStringified(pricify(crvUsdPoolTotalSupply, crvUsdPoolVirtualPrice)));
  const crvUSDPoolHoldingsCounted = countTotalByBalances(crvUsdHoldings);
  console.log("crvUSD Pool holdings: ", toDecimalStringified(crvUSDPoolHoldingsCounted));
  // printTokenBalances(uzdCrvUsdBpConfig[3], crvUsdHoldings);



  console.log("Processing fraxBpPool ", uzdFraxBpConfig[0]);
  const {transfers: fraxBpTransfers, token: fraxBpPoolToken, totalSupply: fraxBpPoolTotalSupply} =
    await getTransfersBy(uzdFraxBpConfig);
  console.log("fraxBp Pool total supply: ", toDecimalStringified(fraxBpPoolTotalSupply));
  let fraxBpBalances = await calcMinters(fraxBpTransfers, curveZaps, safeOwnerReplacer);
  fraxBpBalances = await acceptTransferredValue(
    fraxBpBalances,
    fraxBpTransfers,
    [
      "0x0000000000000000000000000000000000000000",
      "0x08780fb7E580e492c1935bEe4fA5920b94AA95Da", // zap
      "0xBdCA4F610e7101Cc172E2135ba025737B99AbD30", // curve gauge
      "0x989AEb4d175e16225E39E87d0D97A3360524AD80", // convex
      "0xDe0fE7E57d56190F43C57541a886ec3AdCC91C86", // convex stacking
      "0x6A7e696ca09E92efc64515856dfD9c95a2ad3f52", // convex stacking
      "0x569DBCcCd24f8CA2C002243d1e0bb6fb70cC6127", // convex stacking
      "0xB2991b85FC27FA1Ff27C59dCD7767A6312840d45", // convex stacking
      "0xf2b086747E86A5928a02082fB4eCcCaE3e5c94a3", // convex stacking
      "0xFcc5D5b01Ff2dC1ac2d9D82C30aE1178a63268a1", // convex stacking
      "0xb3D2Bc2437d12d386Ad2D9Fc06F9410eDCdCda93", // convex stacking
      "0x57Fb068BDa27351EF0913113264Ce3EF4EeA3316", // convex stacking
      "0xCb698FB42a5eAeB8711286829Fb5391890Ad10c4", // convex stacking
      "0x4Cb37Bb40bf658F17c47B7bF9BbDe8f7D938Fd2c", // convex stacking
      "0x6CdED68Aed664e1d9977239C505448D07E97F6BB", // convex stacking
      "0x0b2005845061DF695D543888e309ae8d9672604c", // convex stacking
      "0x006FeD3dD802761BA2A7843df80Cdc55Bc1Ff624", // convex stacking
      "0x78CA6E015CaC5E97B14eB93d2A2D5155314ea321", // convex stacking
      "0xEc50a402D6B00D97bCd8050723ACc7DBC4F965f4", // convex stacking
      "0x5836200c034ddA13549e9cda340bF3b4DE2a2F3F", // convex stacking
      "0x1C00908a6d8f31CbfA74c48d628b42A4A7624065", // convex stacking
      "0xbc61f6973cE564eFFB16Cd79B5BC3916eaD592E2", // stakeDAO,
      "0x3Cf54F3A1969be9916DAD548f3C084331C4450b5", // сoncentrator
    ]
  );

  const fraxBpPoolTotalCounted = countTotalByBalances(fraxBpBalances);
  console.log("fraxBp Pool total counted: ", toDecimalStringified(fraxBpPoolTotalCounted));

  const UzdStakingFraxCurveConvexAddress = "0x5bC926B2A5FcF521B7d1cfD4d0BC265eF00AB2F1";
  const UzdFraxCurveStakeDaoAddress = "0x63A771C4077B3eAe3d17b633d87e23Ab7Dbbe54b";
  const UzdFraxCurveConcentrator = "0xbF7a41f8E57a9940951Fdd266f30EfbAf9a3A138";

  const uzdApsPools = [UzdStakingFraxCurveConvexAddress, UzdFraxCurveStakeDaoAddress, UzdFraxCurveConcentrator];
  const uzdApsPoolsBalance = uzdApsPools.map((address)=> fraxBpBalances[address]);

  const fraxBpApsStrategiesCounted = uzdApsPoolsBalance.reduce((previous, current) => previous.add(current), zero);
  console.log("fraxBp aps strategies counted: ", toDecimalStringified(fraxBpApsStrategiesCounted)
  );

  const fraxBpBalancesUsers = Object.fromEntries(Object.entries(fraxBpBalances).filter(
    ([key]) => !uzdApsPools.includes(key))
  );

  const fraxBpUsersCounted = countTotalByBalances(fraxBpBalancesUsers)
  console.log("fraxBp users counted: ", toDecimalStringified(fraxBpUsersCounted));

  const {totalSupply: fraxBpPoolTotalSupply2, lpPrice: fraxBpPoolVirtualPrice, poolValue: fraxBpPoolValue} =
    await calcCurvePoolTvl(uzdFraxBpConfig[0], uzdFraxBpConfig[2]);

  const fraxBpHoldings = Object.fromEntries(Object.entries(fraxBpBalancesUsers).map(
      ([key, value]) => [key, pricify(value, fraxBpPoolVirtualPrice)]
    ),
  );

  console.log("fraxBp total holdings: ", toDecimalStringified(pricify(fraxBpPoolTotalSupply, fraxBpPoolVirtualPrice)));
  console.log("fraxBp aps strategies holdings: ", toDecimalStringified(pricify(fraxBpApsStrategiesCounted, fraxBpPoolVirtualPrice)));

  const fraxBpPoolHoldingsCounted = countTotalByBalances(fraxBpHoldings);
  console.log("fraxBp user holdings: ", toDecimalStringified(fraxBpPoolHoldingsCounted));
  // printTokenBalances(uzdFraxBpConfig[3], fraxBpHoldings);


  console.log("Processing UZD APS", uzdApsConfig[0]);
  const {transfers: uzdApsTransfers, token: uzdApsToken, totalSupply: uzdApsTotalSupply} = await getTransfersBy(uzdApsConfig);

  console.log("UZD aps total supply: ", toDecimalStringified(uzdApsTotalSupply));
  const uzdApsAllHolders = getAllHoldersBy(uzdApsTransfers);
  const uzdApsBalances = await getTokenBalancesByHoldersOnBlock(uzdApsConfig[2], uzdApsAllHolders, uzdApsToken);

  const uzdApsTotalCounted = countTotalByBalances(uzdApsBalances);
  console.log("UZD aps counted: ", toDecimalStringified(uzdApsTotalCounted));

  const {totalSupply: uzdApsTotalSupply2, lpPrice: uzdApsVirtualPrice, poolValue: uzdApsValue} =
    await calcZunamiPoolTvl(uzdApsConfig[0], uzdApsConfig[2]);

  const uzdApsHoldings = Object.fromEntries(Object.entries(uzdApsBalances).map(
      ([key, value]) => [key, pricify(value, uzdApsVirtualPrice)]
    ),
  );

  console.log("UZD aps total total holdings: ", toDecimalStringified(pricify(uzdApsTotalSupply, uzdApsVirtualPrice)));

  const uzdApsHoldingsCounted = countTotalByBalances(uzdApsHoldings);
  console.log("UZD aps user holdings: ", toDecimalStringified(uzdApsHoldingsCounted));
  // printTokenBalances(uzdApsConfig[3], uzdApsHoldings);

  const usersBalances =
    mergeBalances(
      mergeBalances(
        mergeBalances(
          mergeBalances(
            uzdBalancesUsers,
            crvUsdHoldings
          ),
          fraxBpHoldings
        ),
        uzdApsHoldings
      ),
      omnipoolHoldings
    );
  // printTokenBalances("United balances", usersBalances);

  const usersBalancesCounted = countTotalByBalances(usersBalances);
  console.log("United balances counted: ", toDecimalStringified(usersBalancesCounted));

  const totalHoldings =
    omnipoolUsersCounted
    .add(uzdUsersCounted)
    .add(crvUSDPoolHoldingsCounted)
    .add(fraxBpPoolHoldingsCounted)
    .add(uzdApsHoldingsCounted);

  console.log("Total holdings: ", toDecimalStringified(totalHoldings));

  const uzdOmnipoolAddress = "0x2ffCC661011beC72e1A9524E12060983E74D14ce";
  const uzdOmnipool = await ethers.getContractAt('Zunami', uzdOmnipoolAddress);

  const uzdOmnipoolHoldings = (await uzdOmnipool.totalHoldings({blockTag: uzdApsConfig[2]}));
  console.log("UZD omnipool holdings:", toDecimalStringified(uzdOmnipoolHoldings));

  await writeCsv(usersBalances, totalHoldings, uzdOmnipoolHoldings);

  await writeJson(usersBalances, totalHoldings, uzdOmnipoolHoldings);

  console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
