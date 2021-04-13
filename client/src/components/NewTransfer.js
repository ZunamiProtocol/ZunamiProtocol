import React, {useState} from 'react';

const NewTransfer = ({sendTransfer}) => {
    const [amount, setAmount] = useState(undefined);

    const getAmount = (e) => {
        const amount = e.target.value;
        setAmount(amount);
    }

    return(
        <div>
            <h6>Send Transfer to  1 Accaunt</h6>
            <form onSubmit={e => sendTransfer(e, amount)} >
                <input placeholder='Amount' onChange={e => getAmount(e)} type="number"/>
                <button type="submit" >Submit</button>
            </form>
        </div>
    )
}

export default NewTransfer;
