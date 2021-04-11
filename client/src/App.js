import React, {useEffect, useState} from 'react';

import { getWeb3, getZunami } from './tools/utils';

import NewTransfer from './components/NewTransfer';
import AllTransfer from './components/AllTransfer';
import Balance from './components/Balance';
import CrateCoints from './components/CrateCoints';


const App = () => {
    const [web3, setWeb3] = useState(undefined);
    const [accounts, setAccounts] = useState(undefined);
    const [zunami, setZunami] = useState(undefined);
    const [zunamiAddress, setZunamiAddress] = useState(undefined);
    const [zunamiBalance, setZunamiBalance] = useState(0);
    const [accountsBalance, setAccounsBalance] = useState(0);
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

    const getCurrentAccount = async () => {
        const walletAddress = await window.ethereum.enable();
        return walletAddress[0];
    }

    const createCoints = async (e, amount) => {
        e.preventDefault();
        const walletAddress = await getCurrentAccount();
        await zunami.methods.mint(walletAddress, amount).send({from: accounts[0]});
        getBalance();
    }

    const getBalance = async () => {
        console.log(accountsBalance, zunamiBalance, zunamiAddress);
        let balance = await zunami.methods.balanceOf(zunamiAddress).call();
        let balanceAcc = await zunami.methods.balanceOf(accounts[0]).call();
        setAccounsBalance(balanceAcc);
        setZunamiBalance(balance);
    }

    const sendTransfer = async (e, amount) => {
        e.preventDefault();
        const walletAddress = await window.ethereum.enable();
        zunami.methods.transfer(zunamiAddress, Number(amount)).send({from: walletAddress[0]})
        .then(result => {
            if(result.status){
                setArrTransfer([...arrTransfer, {from: walletAddress[0], to: walletAddress[0],  amount}]);
                getBalance();
            }
        })
        .catch(e => console.log(e, 'error'));
    }

    return(
    <div className='container'>
      <div className='row'>
          <div className='col-4'>
              <CrateCoints createCoints={createCoints} />
          </div>
          <div className='col-6'>
              <NewTransfer sendTransfer={sendTransfer} />
          </div>
          <div className='col-9'>
              <Balance ZunamiAddress={zunamiAddress} Accounts={accounts} ZunamiBalance={zunamiBalance} AccountsBalance={ accountsBalance}/>
          </div>
      </div>
      <div className='row'>
          <AllTransfer arrTransfer={arrTransfer} />
      </div>
    </div>
  )
}

export default App;
