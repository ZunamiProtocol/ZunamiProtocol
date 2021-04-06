import React, {useEffect, useState} from 'react';

import { getWeb3, getZunami } from './tools/utils';


const App = () => {
    const [web3, setWeb3] = useState(undefined);
    const [accounts, setAccounts] = useState(undefined);
    const [zunami, setZunami] = useState(undefined);

    useEffect(() =>{
        (async () => {
            const web3 = await getWeb3();
            const accounts = await web3.eth.getAccounts();
            const zunami = await getZunami(web3);
            setWeb3(web3);
            setAccounts(accounts);
            setZunami(zunami);
        })();
    })

    console.log(web3, 'web3');
    console.log(accounts, 'acc');
    console.log(zunami, 'zunami');

  return(
    <>
        <h1>Hello World</h1>
    </>
  )
}

export default App;
