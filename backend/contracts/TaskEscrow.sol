// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import 'hardhat/console.sol';

/**
 * @title Task Escrow Contract
 * @author Damien Schneider
 * @notice Manages secure fund distribution for task completion
 * @dev Handles escrow of funds between task provider, developer, and auditors
 */
contract TaskEscrow {
  address public immutable marketplace;
  address public immutable provider;
  address public immutable developer;
  uint256 public immutable taskId;
  uint256 public immutable reward;
  uint256 public immutable developerReward;
  uint256 public immutable auditorReward;

  mapping(address => bool) public hasWithdrawn;
  address[3] public firstThreeVoters;
  mapping(address => bool) public firstThreeVotes;

  event DeveloperPaid(address developer, uint256 amount);
  event AuditorPaid(address auditor, uint256 amount);
  event ProviderRefunded(address provider, uint256 amount);

  enum PaymentStatus {
    None, // Initial state
    WorkAccepted, // Work accepted without dispute
    DeveloperWon, // Developer won dispute
    ProviderWon, // Provider won dispute
    Cancelled // Task cancelled
  }

  PaymentStatus public paymentStatus;
  bool public isDisputed;

  /**
   * @notice Initializes the escrow with task participants and reward distribution
   * @dev Validates all parameters and sets up immutable contract state
   * @param _marketplace Address of the marketplace contract
   * @param _provider Address of the task provider
   * @param _developer Address of the assigned developer
   * @param _taskId ID of the task
   * @param _reward Total reward amount
   * @param _auditorReward Reward amount per auditor
   * @param _developerReward Developer's reward amount
   */
  constructor(
    address _marketplace,
    address _provider,
    address _developer,
    uint256 _taskId,
    uint256 _reward,
    uint256 _auditorReward,
    uint256 _developerReward
  ) payable {
    require(msg.value == _reward, 'Incorrect escrow amount');
    require(_marketplace != address(0), 'Invalid marketplace address');
    require(_provider != address(0), 'Invalid provider address');
    require(_developer != address(0), 'Invalid developer address');
    marketplace = _marketplace;
    provider = _provider;
    developer = _developer;
    taskId = _taskId;
    reward = _reward;
    developerReward = _developerReward;
    auditorReward = _auditorReward;
  }

  /**
   * @notice Allows developer to withdraw their earned reward
   * @dev Implements pull pattern for payment distribution
   * @return success Whether the withdrawal was successful
   */
  function withdrawDeveloperPayment() external returns (bool success) {
    require(msg.sender == marketplace, 'Only marketplace can withdraw developer payment');
    require(!hasWithdrawn[developer], 'Already withdrawn');
    require(
      paymentStatus == PaymentStatus.WorkAccepted || paymentStatus == PaymentStatus.DeveloperWon,
      'Not eligible for payment'
    );

    hasWithdrawn[developer] = true;
    uint256 amount = isDisputed ? developerReward : (developerReward + (auditorReward * 3));
    emit DeveloperPaid(developer, amount);

    (success, ) = developer.call{value: amount}('');
    require(success, 'Payment failed');
  }

  /**
   * @notice Allows auditors to withdraw their reward for dispute resolution
   * @dev Only available if task was disputed
   * @return success Whether the withdrawal was successful
   */
  function withdrawAuditorPayment(address auditor) external returns (bool success) {
    require(msg.sender == marketplace, 'Only marketplace can withdraw auditor payment');
    require(isDisputed, 'No dispute occurred');
    require(!hasWithdrawn[auditor], 'Already withdrawn');
    bool isEligible = false;
    for (uint256 i = 0; i < 3; i++) {
      if (firstThreeVoters[i] == auditor) {
        isEligible = true;
        break;
      }
    }
    require(isEligible, 'Not an eligible auditor');
    uint256 effectiveReward = calculateAuditorReward(auditor);
    require(effectiveReward > 0, 'No reward eligible');
    hasWithdrawn[auditor] = true;
    emit AuditorPaid(auditor, effectiveReward);
    (success, ) = auditor.call{value: effectiveReward}('');
    require(success, 'Payment failed');
  }

  /**
   * @notice Allows provider to withdraw funds in case of dispute win or cancellation
   * @dev Implements pull pattern for payment distribution
   * @return success Whether the withdrawal was successful
   */
  function withdrawProviderPayment() external returns (bool success) {
    require(msg.sender == marketplace, 'Only marketplace can withdraw provider payment');
    require(!hasWithdrawn[provider], 'Already refunded');
    require(
      paymentStatus == PaymentStatus.ProviderWon || paymentStatus == PaymentStatus.Cancelled,
      'Not eligible for payment'
    );
    hasWithdrawn[provider] = true;
    uint256 amount = paymentStatus == PaymentStatus.ProviderWon
      ? (reward - (auditorReward * 3))
      : reward;
    emit ProviderRefunded(provider, amount);
    (success, ) = provider.call{value: amount}('');
    require(success, 'Payment failed');
  }

  /**
   * @notice Gets the current balance of the escrow contract
   * @return uint256 Current balance in wei
   */
  function getBalance() external view returns (uint256) {
    return address(this).balance;
  }

  /**
   * @notice Sets the final payment status after task completion or dispute
   * @dev Can only be called by marketplace contract
   * @param status New payment status to set
   */
  function setPaymentStatus(PaymentStatus status) external {
    require(msg.sender == marketplace, 'Only marketplace can set payment status');
    require(paymentStatus == PaymentStatus.None, 'Status already set');
    paymentStatus = status;
    isDisputed = (status == PaymentStatus.DeveloperWon || status == PaymentStatus.ProviderWon);
  }

  /**
   * @notice Calculates the reward for an auditor based on the majority vote
   * @param auditor The address of the auditor
   * @return effectiveReward The calculated reward for the auditor
   */
  function calculateAuditorReward(address auditor) internal view returns (uint256 effectiveReward) {
    bool auditorVote = firstThreeVotes[auditor];
    uint256 votesInMajority = 0;
    for (uint256 i = 0; i < 3; i++) {
      if (firstThreeVotes[firstThreeVoters[i]] == auditorVote) {
        votesInMajority++;
      }
    }
    if (votesInMajority >= 2) {
      return (auditorReward * 3) / votesInMajority;
    }
    return 0;
  }

  /**
   * @notice Sets the voting results for the first three voters
   * @dev Can only be called by marketplace contract
   * @param voters The addresses of the first three voters
   * @param votes The votes of the first three voters
   */
  function setVotingResults(address[3] memory voters, bool[3] memory votes) external {
    require(msg.sender == marketplace, 'Only marketplace can set voting results');
    for (uint256 i = 0; i < 3; i++) {
      firstThreeVoters[i] = voters[i];
      firstThreeVotes[voters[i]] = votes[i];
    }
  }
}
