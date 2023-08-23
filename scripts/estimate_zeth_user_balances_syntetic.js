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
    path: './scripts/results/zunami_zeth_balances.csv',
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

  const safeOwnerReplacer = {};

  const configs = [
    // address, from, to, name, min_amount, type
    ["0xe47f1CD2A37c6FE69e3501AE45ECA263c5A87b2b", 17485100, 17908908, "zETH", 500000000000000, "token"],
    ["0x8fc72dcfbf39FE686c96f47C697663EE08C78380", 17879518, 17908908, "zETH aps", 500000000000000, "token"],
    ["0xfC89b519658967fCBE1f525f1b8f4bf62d9b9018", 17514692, 17908908, "zETH/FrxETH", 500000000000000, "pool"],
  ];

  const zethConfig =  configs[0];
  const zethApsConfig =  configs[1];
  const zethFrxEthConfig =  configs[2];

  console.log("Processing ZETH ", zethConfig[0]);
  const {transfers:zethTransfers, token: zethToken, totalSupply: zethTotalSupply} = await getTransfersBy(zethConfig);

  console.log("ZETH total supply: ", toDecimalStringified(zethTotalSupply));
  const zethAllHolders = getAllHoldersBy(zethTransfers);
  const zethBalances = await getTokenBalancesByHoldersOnBlock(zethConfig[2], zethAllHolders, zethToken);

  const zethApsVaultAddress = "0xDc0B52c04CdC0099aeFcCa8B0675A00cF8f6d7dC";
  const zethPools = [zethApsVaultAddress, zethFrxEthConfig[0]];
  const zethApsVaultBalance = zethBalances[zethApsVaultAddress];
  const zethFrxEthBalance = zethBalances[zethFrxEthConfig[0]];

  const zethTotalCounted = countTotalByBalances(zethBalances);
  console.log("ZETH counted: ", toDecimalStringified(zethTotalCounted));
  console.log("ZETH curve pools counted: ", toDecimalStringified(zethFrxEthBalance))
  console.log("ZETH aps vault balance: ", toDecimalStringified(zethApsVaultBalance))

  const zethBalancesUsers = Object.fromEntries(Object.entries(zethBalances).filter(
    ([key]) => !zethPools.includes(key))
  );
  const zethUsersCounted = countTotalByBalances(zethBalancesUsers)
  console.log("ZETH users counted: ", toDecimalStringified(zethUsersCounted));
  printTokenBalances(zethConfig[3], zethBalancesUsers);


  console.log("Processing frxEthPool ", zethFrxEthConfig[0]);
  const {transfers: frxEthTransfers, token: frxEthPoolToken, totalSupply: frxEthPoolTotalSupply} =
    await getTransfersBy(zethFrxEthConfig);
  console.log("frxEth Pool total supply: ", toDecimalStringified(frxEthPoolTotalSupply));
  const frxEthBalances = await calcMinters(frxEthTransfers, curveZaps, safeOwnerReplacer);

  const frxEthPoolTotalCounted = countTotalByBalances(frxEthBalances);
  console.log("frxEth Pool total counted: ", toDecimalStringified(frxEthPoolTotalCounted));

  const zEthFrxEthCurveConvex = "0x7226836d03229Be7625682E51CE7187254034170";

  const zethApsPools = [zEthFrxEthCurveConvex];
  const zethApsPoolsBalance = zethApsPools.map((address)=> frxEthBalances[address]);

  const frxzethApsStrategiesCounted = zethApsPoolsBalance.reduce((previous, current) => previous.add(current), zero);
  console.log("frxEth aps strategies counted: ", toDecimalStringified(frxzethApsStrategiesCounted)
  );

  const frxEthBalancesUsers = Object.fromEntries(Object.entries(frxEthBalances).filter(
    ([key]) => !zethApsPools.includes(key))
  );

  const frxEthUsersCounted = countTotalByBalances(frxEthBalancesUsers)
  console.log("frxEth users counted: ", toDecimalStringified(frxEthUsersCounted));

  const {totalSupply: frxEthPoolTotalSupply2, lpPrice: frxEthPoolVirtualPrice, poolValue: frxEthPoolValue} =
    await calcCurvePoolTvl(zethFrxEthConfig[0], zethFrxEthConfig[2]);

  const frxEthHoldings = Object.fromEntries(Object.entries(frxEthBalancesUsers).map(
      ([key, value]) => [key, pricify(value, frxEthPoolVirtualPrice)]
    ),
  );

  console.log("frxEth total holdings: ", toDecimalStringified(pricify(frxEthPoolTotalSupply, frxEthPoolVirtualPrice)));
  console.log("frxEth aps strategies holdings: ", toDecimalStringified(pricify(frxzethApsStrategiesCounted, frxEthPoolVirtualPrice)));

  const frxEthPoolHoldingsCounted = countTotalByBalances(frxEthHoldings);
  console.log("frxEth user holdings: ", toDecimalStringified(frxEthPoolHoldingsCounted));
  printTokenBalances(zethFrxEthConfig[3], frxEthHoldings);


  console.log("Processing ZETH APS", zethApsConfig[0]);
  const {transfers: zethApsTransfers, token: zethApsToken, totalSupply: zethApsTotalSupply} = await getTransfersBy(zethApsConfig);

  console.log("UZD aps total supply: ", toDecimalStringified(zethApsTotalSupply));
  const zethApsAllHolders = getAllHoldersBy(zethApsTransfers);
  const zethApsBalances = await getTokenBalancesByHoldersOnBlock(zethApsConfig[2], zethApsAllHolders, zethApsToken);

  const zethApsTotalCounted = countTotalByBalances(zethApsBalances);
  console.log("UZD aps counted: ", toDecimalStringified(zethApsTotalCounted));

  const {totalSupply: zethApsTotalSupply2, lpPrice: zethApsVirtualPrice, poolValue: zethApsValue} =
    await calcZunamiPoolTvl(zethApsConfig[0], zethApsConfig[2]);

  const zethApsHoldings = Object.fromEntries(Object.entries(zethApsBalances).map(
      ([key, value]) => [key, pricify(value, zethApsVirtualPrice)]
    ),
  );

  console.log("UZD aps total total holdings: ", toDecimalStringified(pricify(zethApsTotalSupply, zethApsVirtualPrice)));

  const zethApsHoldingsCounted = countTotalByBalances(zethApsHoldings);
  console.log("UZD aps user holdings: ", toDecimalStringified(zethApsHoldingsCounted));
  printTokenBalances(zethApsConfig[3], zethApsHoldings);


  const usersBalances = mergeBalances(
    mergeBalances(
      zethBalancesUsers,
      frxEthHoldings
    ),
    zethApsHoldings
  );
  printTokenBalances("United balances", usersBalances);

  const usersBalancesCounted = countTotalByBalances(usersBalances);
  console.log("United balances counted: ", toDecimalStringified(usersBalancesCounted));

  const totalHoldings = zethUsersCounted
    .add(frxEthPoolHoldingsCounted)
    .add(zethApsHoldingsCounted);

  console.log("Total holdings: ", toDecimalStringified(totalHoldings));

  const zethOmnipoolAddress = "0x9dE83985047ab3582668320A784F6b9736c6EEa7";
  const zethOmnipool = await ethers.getContractAt('Zunami', zethOmnipoolAddress);

  const uzdOmnipoolHoldings = (await zethOmnipool.totalHoldings({blockTag: zethApsConfig[2]}));
  console.log("ZETH omnipool holdings:", toDecimalStringified(uzdOmnipoolHoldings));

  await writeCsv(usersBalances, totalHoldings, uzdOmnipoolHoldings);

  console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
