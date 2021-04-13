import React, {useState} from 'react';

const CreateCoins = ({createCoins}) => {
    const [amount, setAmount] = useState(undefined);

    const getAmount = (e) => {
        const amount = e.target.value;
        setAmount(amount);
    }

    return(
        <div>
            <h6>Get ZUSD Coins</h6>
            <form onSubmit={e => createCoins(e, amount)} id='transfer'>
                <input onChange={e => getAmount(e)} placeholder='amount' type='number'/ >
                <button>Create Coins</button>
            </form>
        </div>
    )
}

export default CreateCoins;
