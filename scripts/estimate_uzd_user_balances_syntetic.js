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
  const balances = {};
  for (let i = 0; i < holders.length; i++) {
    const owner = holders[i];

    balances[owner] = await token.balanceOf(owner, {blockTag: block});
  }
  return removeZeroBalances(balances);
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
    path: './scrips/results/zunami_uzd_balances.csv',
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
  console.log(`Balances saved!`);
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

async function main() {
  const curveZaps = ["0x08780fb7E580e492c1935bEe4fA5920b94AA95Da", "0x271fbE8aB7f1fB262f81C77Ea5303F03DA9d3d6A"];

  const safeOwnerReplacer = {
    "0xeB33BFFa3CEE6E94667625663094Fe2BA3CBd66A": "0x9f4be89cF01f7A038e0b9015b6b3A354Ff169CA2",
    "0x8f4A7b7AeaA5c0E01b7b3c0e966D8E62e7b3cBf6": "0x3dFc49e5112005179Da613BdE5973229082dAc35",
    "0xA849456125301De7DedA49c09a65B673C115Cf37": "0x3dFc49e5112005179Da613BdE5973229082dAc35",
  };

  const configs = [
    // address, from, to, name, min_amount, type
    ["0xb40b6608B2743E691C9B54DdBDEe7bf03cd79f1c", 16775408, 17908949, "uzd", 1000000000000000000, "token"],
    ["0xCaB49182aAdCd843b037bBF885AD56A3162698Bd", 17206823, 17908949, "uzd aps", 1000000000000000000, "token"],
    ["0x68934F60758243eafAf4D2cFeD27BF8010bede3a", 16791061, 17908949, "UZD/FraxBP", 1000000000000000000, "pool"],
    ["0xfC636D819d1a98433402eC9dEC633d864014F28C", 17701058, 17908949, "UZD/CrvUSD", 1000000000000000000, "pool"],
  ];

  const uzdConfig =  configs[0];
  const uzdApsConfig =  configs[1];
  const uzdFraxBpConfig =  configs[2];
  const uzdCrvUsdBpConfig =  configs[3];

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
  const crvUsdBalances = await calcMinters(crvUsdTransfers, curveZaps, safeOwnerReplacer);

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
  const fraxBpBalances = await calcMinters(fraxBpTransfers, curveZaps, safeOwnerReplacer);

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


  const usersBalances = mergeBalances(
    mergeBalances(
      mergeBalances(
        uzdBalancesUsers,
        crvUsdHoldings
      ),
      fraxBpHoldings
    ),
    uzdApsHoldings
  );
  // printTokenBalances("United balances", usersBalances);

  const usersBalancesCounted = countTotalByBalances(usersBalances);
  console.log("United balances counted: ", toDecimalStringified(usersBalancesCounted));

  const totalHoldings = uzdUsersCounted
    .add(crvUSDPoolHoldingsCounted)
    .add(fraxBpPoolHoldingsCounted)
    .add(uzdApsHoldingsCounted);

  console.log("Total holdings: ", toDecimalStringified(totalHoldings));

  const uzdOmnipoolAddress = "0x2ffCC661011beC72e1A9524E12060983E74D14ce";
  const uzdOmnipool = await ethers.getContractAt('Zunami', uzdOmnipoolAddress);

  const uzdOmnipoolHoldings = (await uzdOmnipool.totalHoldings({blockTag: uzdApsConfig[2]}));
  console.log("UZD omnipool holdings:", toDecimalStringified(uzdOmnipoolHoldings));

  await writeCsv(usersBalances, totalHoldings, uzdOmnipoolHoldings);

  console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
