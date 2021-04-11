const Balance = ({ZunamiAddress, Accounts, ZunamiBalance, AccountsBalance}) => {
    return (
      <ul>
          <li>Balance Mine Contract {ZunamiAddress} : {ZunamiBalance} ZUSD</li>
          <li>Balance Mine Account {Accounts} : {AccountsBalance} ZUSD</li>
      </ul>
    )
}

export default Balance;
