import Web3 from 'web3';

import ZunamiStablecoin from '../contracts/ZunamiStablecoin';

const getWeb3 = () => {
    return new Promise( (resolve, reject) => {
        window.addEventListener('load', async () =>{
            if (window.ethereum){
                const web3 = new Web3(window.ethereum);
                try {
                    await window.ethereum.enable();
                    resolve(web3);
                }catch (e) {
                    reject(e);
                }
            }else if(window.web3){
                resolve(window.web3);
            }else {
                reject('install MetaMsk');
            }
        })
    })
}

const getZunami = async web3 => {
    const networkId = await web3.eth.net.getId();
    const deploydNetwork = ZunamiStablecoin.networks[networkId];
    return new web3.eth.Contract(
        ZunamiStablecoin.abi, deploydNetwork && deploydNetwork.address
    );
}

export { getWeb3, getZunami };
