import React, {useEffect, useState} from 'react';

import { getWeb3, getZunami } from './tools/utils';

const App = () => {
    const [web3, setWeb3] = useState(undefined);
    const [accounts, setAccounts] = useState(undefined);
    const [zunami, setZunami] = useState(undefined);
    const [zunamiAddress, setZunamiAddress] = useState(undefined);

    useEffect(() =>{
        (async () => {
            const web3 = await getWeb3();
            const accounts = await web3.eth.getAccounts();
            const zunami = await getZunami(web3);

            setWeb3(web3);
            setAccounts(accounts);
            setZunami(zunami);
            setZunamiAddress(zunami._address);
        })();
    })

    const sendTransfer = async () => {
        await zunami.methods.mint(zunamiAddress, 10000).send({from: accounts[0]});
    }

    const getBalance = async () => {
        let balance = await zunami.methods.balanceOf(zunamiAddress).call();
        console.log(balance,'balance contract');
    }

  return(
    <>
        <button onClick={sendTransfer} >transfer</button>
        <button onClick={getBalance} >balance</button>
    </>
  )
}

export default App;
