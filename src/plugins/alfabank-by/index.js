import * as bank from './api'
import * as converters from './converters'

export async function scrape ({ preferences, fromDate, toDate }) {
  let loginData = await bank.login(preferences.isResident)
  var accounts = mergeAllAccounts(
    await bank.fetchAccounts(loginData.deviceID, loginData.sessionID),
    await bank.fetchCards(loginData.sessionID),
    await bank.fetchDeposits(loginData.sessionID)
  )
    .map(converters.convertAccount)
    .filter(account => account !== null)
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].type === 'card') {
      let detail = await bank.fetchCardDetail(loginData.sessionID, accounts[i].id)
      if (detail.status !== 'ACTIVE') {
        accounts[i] = null // заблокированные и выключенные карты незачем обрабатывать
      }
    }
  }
  accounts = accounts.filter(account => account !== null)
  await bank.fetchCredits(loginData.sessionID) // для временного перехвата логов
  const transactions = (await bank.fetchTransactions(loginData.sessionID, accounts, fromDate))
    .map(transaction => converters.convertTransaction(transaction, accounts))
    .filter(transaction => transaction !== null)
  return {
    accounts: accounts,
    transactions: transactions
  }
}

function mergeAllAccounts (accounts, cards, deposits) {
  return accounts.filter(function (account) {
    cards.forEach(function (card) {
      if (card.id.indexOf(account.id) >= 0) {
        return true
      }
    })
    return false
  })
    .concat(cards)
    .concat(deposits)
}
