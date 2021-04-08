import React, {useEffect, useState} from 'react';

import NewTransfer from './components/NewTransfer';

import { getWeb3, getZunami } from './tools/utils';

const App = () => {
    const [web3, setWeb3] = useState(undefined);
    const [accounts, setAccounts] = useState(undefined);
    const [zunami, setZunami] = useState(undefined);
    const [zunamiAddress, setZunamiAddress] = useState(undefined);
    const [arrTransfer, setArrTransfer] = useState([]);

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

    const sendTransferToContract = async () => {
        await zunami.methods.mint(zunamiAddress, 10000).send({from: accounts[0]});
        await zunami.methods.mint(accounts[0], 10000).send({from: accounts[0]});
    }

    const getBalance = async () => {
        let balance = await zunami.methods.balanceOf(zunamiAddress).call();
        console.log(balance,'balance contract');
    }

    const sendTransfer = async (e, amount) => {
        e.preventDefault();
        const walletAddress = await window.ethereum.enable();
        zunami.methods.transfer(zunamiAddress, amount).send({from: walletAddress[0]})
        .then(result => {
            if(result.status){
                setArrTransfer([...arrTransfer, {address: walletAddress[0], amount}]);
            }
        })
        .catch(e => console.log(e, 'error'));
    }

  return(
      <div>
        <div>
          <button onClick={sendTransferToContract} >transfer</button>
          <button onClick={getBalance} >balance</button>
        </div>
        <NewTransfer sendTransfer={sendTransfer} />
      </div>
  )
}

export default App;
