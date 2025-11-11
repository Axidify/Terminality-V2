import React, { useState, useEffect } from 'react'
import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import './BankWebsite.css'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
}

export const BankWebsite: React.FC = () => {
  const cached = getCachedDesktop()
  const [balance, setBalance] = useState<number>(() => cached?.credits ?? 1000)
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => cached?.bankTransactions ?? [
    {
      id: '1',
      date: new Date().toISOString().split('T')[0],
      description: 'Initial Deposit',
      amount: 1000,
      type: 'credit'
    }
  ])

  useEffect(() => {
    saveDesktopState({ credits: balance }).catch(() => {})
  }, [balance])

  useEffect(() => {
    saveDesktopState({ bankTransactions: transactions }).catch(() => {})
  }, [transactions])

  return (
    <div className="bank-website">
      <header className="bank-header">
        <div className="bank-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          AXI BANK
        </div>
        <nav className="bank-nav">
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            Accounts
          </span>
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Transfers
          </span>
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Statements
          </span>
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6m5.2-15.8l-4.2 4.2m0 5.2l4.2 4.2M23 12h-6m-6 0H5m15.8-5.2l-4.2 4.2m0 5.2l4.2 4.2"/>
            </svg>
            Settings
          </span>
        </nav>
      </header>

      <div className="bank-content">
        <div className="account-summary">
          <h2>Account Summary</h2>
          <div className="balance-card">
            <div className="balance-label">Available Balance</div>
            <div className="balance-amount">${balance.toLocaleString()}</div>
            <div className="account-number">Account: XXXX-XXXX-1234</div>
          </div>

          <div className="bank-info-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Your balance increases through quest rewards and mission completions
          </div>
        </div>

        <div className="transactions-section">
          <h2>Recent Transactions</h2>
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <div className="no-transactions">No transactions yet</div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className={`transaction-item ${tx.type}`}>
                  <div className="tx-info">
                    <div className="tx-description">{tx.description}</div>
                    <div className="tx-date">{tx.date}</div>
                  </div>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
