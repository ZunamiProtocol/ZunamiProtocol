import React, {useState} from 'react';

const CrateCoints = ({createCoints}) => {
    const [amount, setAmount] = useState(undefined);

    const getAmount = (e) => {
        const amount = e.target.value;
        setAmount(amount);
    }

    return(
        <div>
            <h6>Get ZUSD Coints</h6>
            <form onSubmit={e => createCoints(e, amount)} id='transfer'>
                <input onChange={e => getAmount(e)} placeholder='amount' value={amount} type='number'/ >
                <button>Create Coints</button>
            </form>
        </div>
    )
}

export default CrateCoints;
