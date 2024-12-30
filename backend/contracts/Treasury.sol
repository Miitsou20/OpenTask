// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title Treasury Contract
 * @author Damien Schneider
 * @notice This contract manages the protocol's treasury, handling incoming funds and withdrawals
 * @dev Implements basic treasury functionality with tracking of received and withdrawn funds
 */
contract Treasury is Ownable {
  uint256 public totalReceived;
  uint256 public totalWithdrawn;

  mapping(address => uint256) public totalReceivedByAddress;
  mapping(address => uint256) public totalWithdrawnByAddress;

  event FundsReceived(address indexed from, uint256 amount, uint256 newTotal);
  event FundsWithdrawn(
    address indexed to,
    uint256 amount,
    uint256 remainingBalance,
    uint256 totalWithdrawn
  );

  /**
   * @notice Initializes the Treasury contract
   * @dev Sets the contract owner using OpenZeppelin's Ownable
   */
  constructor() Ownable(msg.sender) {}

  /**
   * @notice Handles incoming ETH transfers
   * @dev Updates total received amounts and emits event
   */
  receive() external payable {
    totalReceived += msg.value;
    totalReceivedByAddress[msg.sender] += msg.value;

    emit FundsReceived(msg.sender, msg.value, totalReceived);
  }

  /**
   * @notice Allows owner to withdraw funds from treasury
   * @dev Implements CEI pattern
   * @param amount Amount of ETH to withdraw
   */
  function withdraw(uint256 amount) external onlyOwner {
    require(amount > 0, 'Amount must be greater than 0');
    require(amount <= address(this).balance, 'Insufficient balance');

    totalWithdrawn += amount;
    totalWithdrawnByAddress[owner()] += amount;
    emit FundsWithdrawn(owner(), amount, address(this).balance - amount, totalWithdrawn);

    (bool success, ) = owner().call{value: amount}('');
    require(success, 'Withdrawal failed');
  }

  /**
   * @notice Returns current contract balance
   * @return uint256 Current balance in wei
   */
  function getBalance() public view returns (uint256) {
    return address(this).balance;
  }

  /**
   * @notice Gets transaction history for an account
   * @param account Address to check history for
   * @return received Total amount received by account
   * @return withdrawn Total amount withdrawn by account
   * @return currentBalance Current contract balance
   */
  function getTransactionHistory(
    address account
  ) public view returns (uint256 received, uint256 withdrawn, uint256 currentBalance) {
    return (
      totalReceivedByAddress[account],
      totalWithdrawnByAddress[account],
      address(this).balance
    );
  }
}

//  CEI (Checks-Effects-Interactions)
// Les deux approches sont valides, mais la seconde est plus simple et consomme moins de gas.
// Dans ce cas spécifique, comme nous suivons le pattern CEI et que seul le owner peut retirer les fonds,
// la protection contre la réentrance n'est pas strictement nécessaire.
