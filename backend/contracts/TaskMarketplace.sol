// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import './SoulBoundTokens/SoulBoundAchievement.sol';
import './SoulBoundTokens/SoulBoundTokenRole.sol';
import './SoulBoundTokens/SoulBoundRedflag.sol';
import './TaskEscrow.sol';
import './interfaces/ITaskEvents.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import 'hardhat/console.sol';

/**
 * @title Task Marketplace Contract
 * @author Damien Schneider
 * @notice Manages the creation, assignment and completion of tasks
 * @dev Implements task management with role-based access control via SoulBound tokens
 * @custom:security Timestamp usage: This contract uses block.timestamp for deadline management.
 * These timestamps are used for long-duration operations (days/weeks) where minor manipulations
 * (few seconds) do not impact the security of the system.
 * If the scale of your time-dependent event can vary by 15 seconds and maintain integrity, it is safe to use a block.timestamp.
 */
contract TaskMarketplace is ReentrancyGuard, ITaskEvents {
  SoulBoundTokenRole public immutable sbtContract;
  SoulBoundAchievement public immutable achievementContract;
  SoulBoundRedflag public immutable redflagContract;

  address public immutable protocolTreasury;

  uint8 private constant DEVELOPER_SHARE = 67;
  uint8 private constant AUDITOR_SHARE = 10; // 10% * 3 auditors = 30%
  uint8 private constant PROTOCOL_FEE = 3; // 3% for the protocol
  uint8 private constant MAX_DEVELOPER_CANDIDATES = 15;
  uint8 private constant MAX_AUDITOR_CANDIDATES = 15;
  uint8 private constant MAX_TASKS_PER_REQUEST = 100;
  uint256 public taskCount;

  struct Task {
    uint256 id;
    uint96 reward;
    uint96 auditorReward;
    uint96 developerReward;
    uint32 deadline;
    uint32 votingDeadline;
    uint32 votesCount;
    address escrowAddress;
    address provider;
    address developer;
    address[] auditors;
    string title;
    string description;
    TaskStatus status;
  }

  struct AuditVote {
    bool hasVoted;
    bool supportsDeveloper;
    uint256 voteOrder;
  }

  mapping(uint256 => Task) public tasks;
  mapping(uint256 => address[]) private developerCandidates;
  mapping(uint256 => mapping(address => AuditVote)) public auditVotes;
  mapping(uint256 => mapping(address => bool)) public firstThreeVotes;
  mapping(uint256 => address[3]) public firstThreeVoters;
  mapping(address => uint256[]) public providerTasks;
  mapping(address => uint256[]) public developerTasks;
  mapping(address => uint256[]) public auditorTasks;

  error InvalidSBTAddress();
  error AddressAlreadyHasSBT();
  error NotTaskProvider();
  error NotTaskDeveloper();
  error NotTaskAuditor();
  error InvalidAchievementAddress();
  error InvalidRedflagAddress();
  error InvalidTreasuryAddress();
  error InvalidReward();
  error InvalidDeadline();
  error EmptyTitle();
  error EmptyDescription();
  error TaskNotOpen();
  error MaxDevelopersReached();
  error AlreadyApplied();
  error MaxAuditorsReached();
  error DeveloperNotAssigned();
  error NotEnoughAuditors();
  error PaymentMismatch();
  error TaskNotInProgress();
  error DeadlinePassed();
  error NotAuthorized();
  error TaskNotDisputed();
  error AlreadyVoted();
  error VotingPeriodEnded();
  error TaskNotCompleted();
  error ProtocolFeeTransferFailed();
  error DeveloperNotApplied();
  error NoDeveloperCandidates();
  error InvalidTaskParameters();
  error InvalidRoleForWithdrawal();
  error PaymentWithdrawalFailed();
  /**
   * @notice Initializes the marketplace with required contracts
   * @dev Sets up contract references and validates addresses
   * @param _sbtAddress Address of the SoulBoundTokenRole contract
   * @param _achievementAddress Address of the SoulBoundAchievement contract
   * @param _redflagAddress Address of the SoulBoundRedflag contract
   * @param _protocolTreasury Address of the Treasury contract
   */
  constructor(
    address _sbtAddress,
    address _achievementAddress,
    address _redflagAddress,
    address _protocolTreasury
  ) {
    if (_sbtAddress == address(0)) revert InvalidSBTAddress();
    if (_achievementAddress == address(0)) revert InvalidAchievementAddress();
    if (_redflagAddress == address(0)) revert InvalidRedflagAddress();
    if (_protocolTreasury == address(0)) revert InvalidTreasuryAddress();

    sbtContract = SoulBoundTokenRole(_sbtAddress);
    achievementContract = SoulBoundAchievement(_achievementAddress);
    redflagContract = SoulBoundRedflag(_redflagAddress);
    protocolTreasury = _protocolTreasury;
  }

  modifier onlyTaskProvider() {
    SoulBoundTokenRole.Role role = sbtContract.getRole(msg.sender);
    if (role != SoulBoundTokenRole.Role.TaskProvider) revert NotTaskProvider();
    _;
  }

  modifier onlyTaskDeveloper() {
    SoulBoundTokenRole.Role role = sbtContract.getRole(msg.sender);
    if (role != SoulBoundTokenRole.Role.TaskDeveloper) revert NotTaskDeveloper();
    _;
  }

  modifier onlyTaskAuditor() {
    SoulBoundTokenRole.Role role = sbtContract.getRole(msg.sender);
    if (role != SoulBoundTokenRole.Role.TaskAuditor) revert NotTaskAuditor();
    _;
  }

  /**
   * @notice Requests a new SoulBound token for role-based access
   * @dev Mints a new SBT if caller doesn't already have one
   * @param role Role to be assigned to the token
   */
  function requestSBT(SoulBoundTokenRole.Role role) public {
    if (sbtContract.hasToken(msg.sender)) revert AddressAlreadyHasSBT();
    sbtContract.safeMint(msg.sender, role);
  }

  /**
   * @notice Creates a new task in the marketplace
   * @dev Only callable by task providers
   * @param _title Title of the task
   * @param _description Description of the task
   * @param _deadline Deadline for task completion
   * @param _reward Reward amount in ETH
   */
  function createTask(
    string memory _title,
    string memory _description,
    uint32 _deadline,
    uint96 _reward
  ) public onlyTaskProvider {
    if (!_validateTaskCreation(_reward, _deadline, _title, _description))
      revert InvalidTaskParameters();

    uint256 newTaskId = taskCount;
    unchecked {
      taskCount = newTaskId + 1;
    }

    Task storage task = tasks[newTaskId];
    task.id = newTaskId;
    task.provider = msg.sender;
    task.title = _title;
    task.description = _description;
    task.reward = _reward;
    task.deadline = _deadline;
    task.status = TaskStatus.Created;

    unchecked {
      task.developerReward = (_reward * DEVELOPER_SHARE) / 100;
      task.auditorReward = (_reward * AUDITOR_SHARE) / 100;
    }

    providerTasks[msg.sender].push(newTaskId);

    emit TaskCreated(newTaskId, msg.sender, _title, _reward);
  }

  /**
   * @notice Allows developers to apply for a task
   * @dev Only callable by addresses with TaskDeveloper role
   * @param taskId ID of the task to apply for
   */
  function applyForTaskAsDeveloper(uint256 taskId) public onlyTaskDeveloper {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Created) revert TaskNotOpen();
    if (developerCandidates[taskId].length >= MAX_DEVELOPER_CANDIDATES)
      revert MaxDevelopersReached();
    if (_contains(developerCandidates[taskId], msg.sender)) revert AlreadyApplied();
    developerCandidates[taskId].push(msg.sender);
    emit DeveloperSubmitted(taskId, msg.sender);
  }

  /**
   * @notice Allows auditors to apply for a task
   * @dev Only callable by addresses with TaskAuditor role
   * @param taskId ID of the task to apply for
   */
  function applyForTaskAsAuditor(uint256 taskId) public onlyTaskAuditor {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Created) revert TaskNotOpen();
    if (task.auditors.length >= MAX_AUDITOR_CANDIDATES) revert MaxAuditorsReached();
    if (_contains(task.auditors, msg.sender)) revert AlreadyApplied();

    task.auditors.push(msg.sender);
    auditorTasks[msg.sender].push(taskId);
    emit AuditorSubmitted(taskId, msg.sender);
  }

  /**
   * @notice Assigns a developer to a task
   * @dev Only callable by task provider
   * @param taskId ID of the task
   * @param developer Address of the developer to assign
   */
  function assignDeveloper(uint256 taskId, address developer) public onlyTaskProvider {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Created) revert TaskNotOpen();
    if (developerCandidates[taskId].length == 0) revert NoDeveloperCandidates();
    if (!_contains(developerCandidates[taskId], developer)) revert DeveloperNotApplied();

    task.developer = developer;
    developerTasks[developer].push(taskId);

    emit DeveloperAssigned(taskId, developer);
  }

  /**
   * @notice Starts a task by funding the escrow contract
   * @dev Only callable by task provider, implements reentrancy protection
   * @param taskId ID of the task to start
   */
  function startTask(uint256 taskId) public payable onlyTaskProvider nonReentrant {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Created) revert TaskNotOpen();
    if (task.developer == address(0)) revert DeveloperNotAssigned();
    if (task.auditors.length < 3) revert NotEnoughAuditors();
    if (msg.value != task.reward) revert PaymentMismatch();

    task.status = TaskStatus.InProgress;

    uint256 protocolFee;
    uint256 remainingAmount;
    unchecked {
      protocolFee = (msg.value * PROTOCOL_FEE) / 100;
      remainingAmount = msg.value - protocolFee;
    }

    emit TaskStatusUpdated(taskId, TaskStatus.InProgress);

    (bool success, ) = protocolTreasury.call{value: protocolFee}('');
    if (!success) revert ProtocolFeeTransferFailed();

    createEscrow(task, remainingAmount, taskId);

    emit TaskStarted(taskId, task.reward, task.escrowAddress);
  }

  /**
   * @notice Creates an escrow contract for a task
   * @dev Internal function to handle escrow creation and funding
   * @param task Task struct containing task details
   * @param amount Amount to be escrowed
   * @param taskId ID of the task
   */
  function createEscrow(Task storage task, uint256 amount, uint256 taskId) internal {
    TaskEscrow escrow = new TaskEscrow{value: amount}(
      address(this),
      task.provider,
      task.developer,
      taskId,
      amount,
      task.auditorReward,
      task.developerReward
    );
    task.escrowAddress = address(escrow);
  }

  /**
   * @notice Marks a task as completed
   * @dev Only callable by task provider, triggers achievement updates
   * @param taskId ID of the task to complete
   */
  function completeTask(uint256 taskId) public onlyTaskProvider {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.InProgress) revert TaskNotInProgress();
    task.status = TaskStatus.Completed;
    emit TaskStatusUpdated(taskId, TaskStatus.Completed);
    achievementContract.taskCompleted(task.developer);
  }

  /**
   * @notice Allows participants to withdraw their payments
   * @dev Handles both developer and auditor withdrawals
   * @param taskId ID of the completed task
   */
  function withdrawPayment(uint256 taskId) external {
    Task storage task = tasks[taskId];
    if (
      task.status != TaskStatus.Completed &&
      task.status != TaskStatus.CompletedWithDeveloperWon &&
      task.status != TaskStatus.CompletedWithProviderWon
    ) revert TaskNotCompleted();
    TaskEscrow escrow = TaskEscrow(task.escrowAddress);

    if (sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskDeveloper) {
      if (msg.sender != task.developer) revert NotTaskDeveloper();
      if (!escrow.withdrawDeveloperPayment()) revert PaymentWithdrawalFailed();
    } else if (sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskAuditor) {
      if (!_contains(task.auditors, msg.sender)) revert NotTaskAuditor();
      if (!escrow.withdrawAuditorPayment(msg.sender)) revert PaymentWithdrawalFailed();
    } else {
      revert InvalidRoleForWithdrawal();
    }
  }

  /**
   * @notice Allows provider to refund the escrow when task is cancelled or completed
   * @dev Only callable by task provider
   * @param taskId ID of the task
   */
  function refundProvider(uint256 taskId) external onlyTaskProvider {
    Task storage task = tasks[taskId];
    require(
      task.status == TaskStatus.Cancelled || task.status == TaskStatus.CompletedWithProviderWon,
      'Task not cancelled or completed'
    );
    TaskEscrow escrow = TaskEscrow(task.escrowAddress);
    bool success = escrow.withdrawProviderPayment();
    require(success, 'Provider payment withdrawal failed');
  }

  /**
   * @notice Allows developer to submit their completed work
   * @dev Can only be called by the assigned developer when task is in progress
   * @param taskId ID of the task being submitted
   */
  function submitWork(uint256 taskId) external onlyTaskDeveloper {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.InProgress, 'Task not in progress');
    require(msg.sender == task.developer, 'Not task developer');
    // slither-disable-next-line timestamp
    require(block.timestamp <= task.deadline, 'Task deadline passed');
    task.status = TaskStatus.Submitted;
    emit WorkSubmitted(taskId, msg.sender, block.timestamp);
  }

  /**
   * @notice Allows provider to accept submitted work
   * @dev Sets task as completed and enables developer payment
   * @param taskId ID of the task to accept
   */
  function acceptWork(uint256 taskId) external onlyTaskProvider {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.Submitted, 'Work not submitted');
    task.status = TaskStatus.Completed;
    emit WorkAccepted(taskId, msg.sender, block.timestamp);
    TaskEscrow(task.escrowAddress).setPaymentStatus(TaskEscrow.PaymentStatus.WorkAccepted);
  }

  /**
   * @notice Initiates a dispute for a submitted task
   * @dev Can be called by either provider or developer
   * @param taskId ID of the task to dispute
   */
  function initiateDispute(uint256 taskId) external {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.Submitted, 'Work not submitted');
    require(msg.sender == task.provider || msg.sender == task.developer, 'Not authorized');
    task.status = TaskStatus.Disputed;
    task.votingDeadline = uint32(block.timestamp + 1 weeks);
    emit DisputeInitiated(taskId, msg.sender, block.timestamp);
  }

  /**
   * @notice Allows auditors to cast their vote in a dispute
   * @dev Only assigned auditors can vote once per task
   * @param taskId ID of the disputed task
   * @param supportsDeveloper True if voting in favor of developer, false otherwise
   */
  function submitAuditVote(uint256 taskId, bool supportsDeveloper) external onlyTaskAuditor {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Disputed) revert TaskNotDisputed();
    // slither-disable-next-line timestamp
    if (block.timestamp > task.votingDeadline) revert VotingPeriodEnded();
    if (!_contains(task.auditors, msg.sender)) revert NotTaskAuditor();

    AuditVote storage vote = auditVotes[taskId][msg.sender];
    if (vote.hasVoted) revert AlreadyVoted();

    uint32 currentVoteCount = task.votesCount;

    vote.hasVoted = true;
    vote.supportsDeveloper = supportsDeveloper;
    vote.voteOrder = currentVoteCount + 1;

    emit AuditorVoteSubmitted(taskId, msg.sender, supportsDeveloper);

    if (currentVoteCount < 3) {
      firstThreeVoters[taskId][currentVoteCount] = msg.sender;
      firstThreeVotes[taskId][msg.sender] = supportsDeveloper;
      unchecked {
        task.votesCount = currentVoteCount + 1;
      }

      if (currentVoteCount == 2) {
        _resolveDispute(taskId);
      }
    }
  }

  /**
   * @notice Internal function to resolve disputes based on auditor votes
   * @dev Requires all three auditors to have voted, implements majority voting
   * @param taskId ID of the disputed task
   */
  function _resolveDispute(uint256 taskId) internal {
    Task storage task = tasks[taskId];
    if (task.status != TaskStatus.Disputed) revert('Task not disputed');
    if (task.votesCount != 3) revert('Not enough votes');

    address[3] memory voters = firstThreeVoters[taskId];
    uint256 votesForDev;

    for (uint256 i = 0; i < 3; ) {
      if (firstThreeVotes[taskId][voters[i]]) {
        unchecked {
          ++votesForDev;
        }
      }
      unchecked {
        ++i;
      }
    }

    bool developerWon = votesForDev >= 2;
    task.status = developerWon
      ? TaskStatus.CompletedWithDeveloperWon
      : TaskStatus.CompletedWithProviderWon;

    emit DisputeResolved(taskId, developerWon);

    if (developerWon) {
      achievementContract.taskCompleted(task.developer);
    } else {
      redflagContract.recordLostDispute(task.developer);
    }

    TaskEscrow(task.escrowAddress).setPaymentStatus(
      developerWon ? TaskEscrow.PaymentStatus.DeveloperWon : TaskEscrow.PaymentStatus.ProviderWon
    );
    TaskEscrow(task.escrowAddress).setVotingResults(
      voters,
      [
        firstThreeVotes[taskId][voters[0]],
        firstThreeVotes[taskId][voters[1]],
        firstThreeVotes[taskId][voters[2]]
      ]
    );
  }

  /**
   * @notice Allows provider to cancel a task before it starts
   * @dev Can only be called for tasks in Created state
   * @param taskId ID of the task to cancel
   */
  function cancelTask(uint256 taskId) external onlyTaskProvider {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.Created, 'Cannot cancel task');
    task.status = TaskStatus.Cancelled;
    emit TaskCancelled(taskId);
  }

  /**
   * @notice Gets the status of votes for a task
   * @param taskId ID of the task
   * @return votesFor Number of votes in favor of the developer
   * @return totalVotes Total number of votes cast
   * @return isComplete Whether all votes have been cast
   */
  function getVoteStatus(
    uint256 taskId
  ) external view returns (uint32 votesFor, uint32 totalVotes, bool isComplete) {
    Task storage task = tasks[taskId];
    uint32 votesForDev;
    uint32 voteCount = task.votesCount;
    uint32 maxVotes = voteCount < 3 ? voteCount : 3;

    for (uint32 i = 0; i < maxVotes; ) {
      if (firstThreeVotes[taskId][firstThreeVoters[taskId][i]]) {
        unchecked {
          ++votesForDev;
        }
      }
      unchecked {
        ++i;
      }
    }

    return (votesForDev, voteCount, voteCount == 3);
  }

  /**
   * @notice Gets the candidates for a task
   * @param taskId ID of the task
   * @return developers Array of developer candidates' addresses
   */
  function getDeveloperCandidates(
    uint256 taskId
  ) external view returns (address[] memory developers) {
    return (developerCandidates[taskId]);
  }

  /**
   * @notice Gets the auditors assigned to a task
   * @param taskId ID of the task
   * @return auditors Array of auditor addresses
   */
  function getTaskAuditors(uint256 taskId) public view returns (address[] memory auditors) {
    Task storage task = tasks[taskId];
    return (task.auditors);
  }

  /**
   * @notice Gets all tasks for a provider
   * @param provider Address of the provider
   * @return tasks Array of task IDs
   */
  function getAllProviderTasks(address provider) external view returns (uint256[] memory) {
    return providerTasks[provider];
  }

  /**
   * @notice Gets all tasks for an auditor
   * @param auditor Address of the auditor
   * @return tasks Array of task IDs
   */
  function getAllAuditorTasks(address auditor) external view returns (uint256[] memory) {
    return auditorTasks[auditor];
  }

  /**
   * @notice Gets all tasks for a developer
   * @param developer Address of the developer
   * @return tasks Array of task IDs
   */
  function getAllDeveloperTasks(address developer) external view returns (uint256[] memory) {
    return developerTasks[developer];
  }

  /**
   * @notice Updates the deadline for a task
   * @dev Only callable by task provider
   * @param taskId ID of the task
   * @param deadline New deadline timestamp
   */
  function updateTaskDeadline(uint256 taskId, uint32 deadline) public onlyTaskProvider {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.Created, 'Task not in correct state');
    task.deadline = deadline;
    emit TaskDeadlineUpdated(taskId, deadline);
  }

  /**
   * @notice Checks if the deadline has passed and penalizes the developer
   * @dev Called by the provider to penalize the developer if the deadline is passed
   * @param taskId ID of the task
   */
  function checkDeadlineAndPenalize(uint256 taskId) public onlyTaskProvider {
    Task storage task = tasks[taskId];
    require(task.status == TaskStatus.InProgress, 'Task not in progress');
    // slither-disable-next-line timestamp
    require(block.timestamp > task.deadline, 'Deadline not passed yet');
    task.status = TaskStatus.Cancelled;
    emit DeveloperPenalized(taskId, task.developer);

    redflagContract.recordLostDispute(task.developer);
    TaskEscrow(task.escrowAddress).setPaymentStatus(TaskEscrow.PaymentStatus.Cancelled);
  }

  /**
   * @notice Checks if an element is in an array
   * @param array The array to check
   * @param element The element to check for
   * @return bool True if the element is in the array, false otherwise
   */
  function _contains(address[] storage array, address element) internal view returns (bool) {
    uint256 length = array.length;
    for (uint256 i = 0; i < length; ) {
      if (array[i] == element) {
        return true;
      }
      unchecked {
        ++i;
      }
    }
    return false;
  }

  /**
   * @notice Gets multiple tasks details at once
   * @param taskIds Array of task IDs to fetch
   * @return Task[] Array of task details
   */
  function getTasksDetails(uint256[] calldata taskIds) external view returns (Task[] memory) {
    require(taskIds.length <= MAX_TASKS_PER_REQUEST, 'Too many tasks requested');
    Task[] memory tasksList = new Task[](taskIds.length);
    uint256 length = taskIds.length;
    for (uint256 i = 0; i < length; ) {
      require(taskIds[i] < taskCount, 'Invalid task ID');
      tasksList[i] = tasks[taskIds[i]];
      unchecked {
        ++i;
      }
    }

    return tasksList;
  }

  /**
   * @notice Validates task creation parameters
   * @dev Checks if all task creation parameters are valid
   * @param _reward Reward amount in ETH
   * @param _deadline Deadline for task completion
   * @param _title Title of the task
   * @param _description Description of the task
   * @return bool True if all parameters are valid, false otherwise
   */
  function _validateTaskCreation(
    uint96 _reward,
    uint32 _deadline,
    string memory _title,
    string memory _description
  ) internal view returns (bool) {
    return (_reward > 0 &&
      _deadline > block.timestamp &&
      bytes(_title).length > 0 &&
      bytes(_description).length > 0);
  }
}
