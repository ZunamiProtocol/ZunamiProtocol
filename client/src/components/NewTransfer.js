import React, {useState} from 'react';

const NewTransfer = ({sendTransfer}) => {
    const [amount, setAmount] = useState(undefined);

    const getAmount = (e) => {
        const amount = e.target.value;
        setAmount(amount);
    }

    return(
        <form onSubmit={e => sendTransfer(e, amount)} >
            <label htmlFor="amount" className="form-label">Amount</label>
            <input onChange={e => getAmount(e)} type="text" className="form-control" id="amount"/>
            <button type="submit" className="btn btn-primary">Submit</button>
        </form>
    )
}

export default NewTransfer;
