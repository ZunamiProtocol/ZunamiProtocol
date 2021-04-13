const AllTransfer = ({arrTransfer}) => {
    return(
        <div className='col-9 TableTransfer'>
            <h6>All Transfer</h6>
            <ul>
                {arrTransfer.map((item, index) => {
                    return <li key={index}>
                       №{index + 1} from {item.from} - to {item.to} : amount {item.amount}
                    </li>
                })}
            </ul>
        </div>
    )
}

export default AllTransfer;
