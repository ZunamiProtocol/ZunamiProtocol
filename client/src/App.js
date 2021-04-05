import React, {useEffect, useState} from 'react';

import { getWeb3 } from './tools/utils';


const App = () => {

    useEffect(() =>{
        (async () => {
            const web3 = await getWeb3();
        })();
    })

  return(
    <>
        <h1>Hello World</h1>
    </>
  )
}

export default App;
