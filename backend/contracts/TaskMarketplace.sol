// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./SoulBoundTokens/SoulBoundAchievement.sol";
import "./SoulBoundTokens/SoulBoundTokenRole.sol";
import "./TaskEscrow.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SoulBoundTokens/SoulBoundRedflag.sol";
import "hardhat/console.sol";

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
contract TaskMarketplace is ReentrancyGuard {
    SoulBoundTokenRole public immutable sbtContract;
    SoulBoundAchievement public immutable achievementContract;
    SoulBoundRedflag public immutable redflagContract;
    
    address public immutable protocolTreasury;
    
    uint256 private constant DEVELOPER_SHARE = 67;
    uint256 private constant AUDITOR_SHARE = 10;  // 10% * 3 auditors = 30%
    uint256 private constant PROTOCOL_FEE = 3;    // 3% for the protocol
    uint256 private constant MAX_DEVELOPER_CANDIDATES = 15;
    uint256 private constant MAX_AUDITOR_CANDIDATES = 15;

    struct Task {
        address provider;
        address developer;
        address[] auditors;
        string description;
        uint256 reward;
        uint256 auditorReward;
        uint256 developerReward;
        TaskStatus status;
        address escrowAddress;
        uint256 deadline;
        uint256 votingDeadline;
        uint256 votesCount;
    }

    struct AuditVote {
        bool hasVoted;
        bool supportsDeveloper;
        uint256 voteOrder;
    }

    enum TaskStatus {
        Created,
        InProgress,
        Submitted,
        Disputed,
        Completed,
        Cancelled
    }

    uint256 public taskCount;

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => address[]) private developerCandidates;
    mapping(uint256 => mapping(address => AuditVote)) public auditVotes;
    mapping(uint256 => mapping(address => bool)) public firstThreeVotes;
    mapping(uint256 => address[3]) public firstThreeVoters;

    event TaskCreated(uint256 indexed taskId, address indexed provider, uint256 reward);
    event TaskStarted(uint256 indexed taskId, uint256 reward, address escrowAddress);
    event TaskStatusUpdated(uint256 indexed taskId, TaskStatus status);
    event TaskCancelled(uint256 indexed taskId);
    event DeveloperSubmitted(uint256 indexed taskId, address indexed developer);
    event AuditorSubmitted(uint256 indexed taskId, address indexed auditor);
    event DeveloperAssigned(uint256 indexed taskId, address indexed developer);
    event AuditorAssigned(uint256 indexed taskId, address indexed auditor);
    event WorkSubmitted(uint256 indexed taskId, address indexed developer, uint256 submissionTime);
    event WorkAccepted(uint256 indexed taskId, address indexed provider, uint256 acceptanceTime);
    event DisputeInitiated(uint256 indexed taskId, address indexed initiator, uint256 disputeTime);
    event AuditorVoteSubmitted(uint256 indexed taskId, address indexed auditor, bool supportsDeveloper);
    event DisputeResolved(uint256 indexed taskId, bool developerWon);
    event TaskDeadlineUpdated(uint256 indexed taskId, uint256 newDeadline);

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
        require(_sbtAddress != address(0), "Invalid SBT address");
        require(_achievementAddress != address(0), "Invalid achievement address");
        require(_redflagAddress != address(0), "Invalid redflag address");
        require(_protocolTreasury != address(0), "Invalid treasury address");
        
        sbtContract = SoulBoundTokenRole(_sbtAddress);
        achievementContract = SoulBoundAchievement(_achievementAddress);
        redflagContract = SoulBoundRedflag(_redflagAddress);
        protocolTreasury = _protocolTreasury;
    }

    modifier onlyTaskProvider() {
        require(sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskProvider, 
                "Sender must be a TaskProvider");
        _;
    }

    modifier onlyTaskDeveloper() {
        require(sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskDeveloper, 
                "Sender must be a TaskDeveloper");
        _;
    }

    modifier onlyTaskAuditor() {
        require(sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskAuditor, 
                "Sender must be a TaskAuditor");
        _;
    }

    /**
     * @notice Requests a new SoulBound token for role-based access
     * @dev Mints a new SBT if caller doesn't already have one
     * @param role Role to be assigned to the token
     */
    function requestSBT(SoulBoundTokenRole.Role role) public {
        require(!sbtContract.hasToken(msg.sender), "Address already has a SBT");
        sbtContract.safeMint(msg.sender, role);
    }

    /**
     * @notice Creates a new task in the marketplace
     * @dev Only callable by task providers
     * @param description Task description
     * @param deadline Task deadline timestamp
     * @param reward Task reward in wei
     */
    function createTask(string memory description, uint256 deadline, uint256 reward) public onlyTaskProvider {
        require(reward > 0, "Reward must be greater than 0");
        
        uint256 taskId = taskCount++;
        Task storage newTask = tasks[taskId];
        
        newTask.provider = msg.sender;
        newTask.description = description;
        newTask.reward = reward;
        newTask.developerReward = (reward * DEVELOPER_SHARE) / 100;
        newTask.auditorReward = (reward * AUDITOR_SHARE) / 100;
        newTask.status = TaskStatus.Created;
        newTask.deadline = deadline;

        emit TaskCreated(taskId, msg.sender, reward);
    }

    /**
     * @notice Allows developers to apply for a task
     * @dev Only callable by addresses with TaskDeveloper role
     * @param taskId ID of the task to apply for
     */
    function applyForTaskAsDeveloper(uint256 taskId) public onlyTaskDeveloper {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not open for developer applications");
        require(developerCandidates[taskId].length < MAX_DEVELOPER_CANDIDATES, "Maximum developer candidates reached");
        require(!_contains(developerCandidates[taskId], msg.sender), "Already applied for this task");
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
        require(task.status == TaskStatus.Created, "Task not open for auditor applications");
        require(task.auditors.length < MAX_AUDITOR_CANDIDATES, "Maximum auditors candidates reached");
        require(!_contains(task.auditors, msg.sender), "Already applied for this task");
        
        task.auditors.push(msg.sender);
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
        require(task.status == TaskStatus.Created, "Task not in correct state");
        require(developerCandidates[taskId].length > 0, "No developer candidates");
        require(_contains(developerCandidates[taskId], developer), "Developer has not applied for this task");
        
        task.developer = developer;
        emit DeveloperAssigned(taskId, developer);
    }

    /**
     * @notice Starts a task by funding the escrow contract
     * @dev Only callable by task provider, implements reentrancy protection
     * @param taskId ID of the task to start
     */
    function startTask(uint256 taskId) public payable onlyTaskProvider nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not in correct state");
        require(task.developer != address(0), "Developer not assigned");
        require(task.auditors.length >= 3, "Not enough auditors assigned");
        require(msg.value == task.reward, "Payment must match announced reward");

        task.status = TaskStatus.InProgress;

        uint256 protocolFee = (msg.value * PROTOCOL_FEE) / 100;
        uint256 remainingAmount = msg.value - protocolFee;

        emit TaskStatusUpdated(taskId, TaskStatus.InProgress);
        (bool success, ) = protocolTreasury.call{value: protocolFee}("");
        require(success, "Protocol fee transfer failed");

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
        require(task.status == TaskStatus.InProgress, "Task not in correct state");
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
        require(task.status == TaskStatus.Completed, "Task not completed");
        TaskEscrow escrow = TaskEscrow(task.escrowAddress);

        if (sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskDeveloper) {
            require(msg.sender == task.developer, "Not the task developer");
            bool success = escrow.withdrawDeveloperPayment();
            require(success, "Developer payment withdrawal failed");
        } 
        else if (sbtContract.getRole(msg.sender) == SoulBoundTokenRole.Role.TaskAuditor) {
            require(_contains(task.auditors, msg.sender), "Not an auditor of this task");
            bool success = escrow.withdrawAuditorPayment(msg.sender);
            require(success, "Auditor payment withdrawal failed");
        } else {
            revert("Invalid role for withdrawal");
        }
    }

    /**
     * @notice Allows provider to refund the escrow when task is cancelled or completed
     * @dev Only callable by task provider
     * @param taskId ID of the task
     */
    function refundProvider(uint256 taskId) external onlyTaskProvider {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Cancelled || task.status == TaskStatus.Completed, "Task not cancelled or completed");
        TaskEscrow escrow = TaskEscrow(task.escrowAddress);
        bool success = escrow.withdrawProviderPayment();
        require(success, "Provider payment withdrawal failed");
    }

    /**
     * @notice Allows developer to submit their completed work
     * @dev Can only be called by the assigned developer when task is in progress
     * @param taskId ID of the task being submitted
     */
    function submitWork(uint256 taskId) external onlyTaskDeveloper {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "Task not in progress");
        require(msg.sender == task.developer, "Not task developer");
        // slither-disable-next-line timestamp
        require(block.timestamp <= task.deadline, "Task deadline passed");
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
        require(task.status == TaskStatus.Submitted, "Work not submitted");
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
        require(task.status == TaskStatus.Submitted, "Work not submitted");
        require(msg.sender == task.provider || msg.sender == task.developer, "Not authorized");
        task.status = TaskStatus.Disputed;
        task.votingDeadline = block.timestamp + 1 weeks;
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
        require(task.status == TaskStatus.Disputed, "Task not disputed");
        // slither-disable-next-line timestamp
        require(block.timestamp <= task.votingDeadline, "Voting period has ended");
        require(_contains(task.auditors, msg.sender), "Not an eligible auditor");
        
        AuditVote storage vote = auditVotes[taskId][msg.sender];
        require(!vote.hasVoted, "Already voted");

        vote.hasVoted = true;
        vote.supportsDeveloper = supportsDeveloper;
        
        emit AuditorVoteSubmitted(taskId, msg.sender, supportsDeveloper);
        
        if(task.votesCount < 3) {
            vote.voteOrder = task.votesCount + 1;
            firstThreeVoters[taskId][task.votesCount] = msg.sender;
            firstThreeVotes[taskId][msg.sender] = supportsDeveloper;
            task.votesCount++;
            
            if(task.votesCount == 3) {
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
        require(task.status == TaskStatus.Disputed, "Task not disputed");
        require(task.votesCount == 3, "Not enough votes");
        
        address[3] memory voters = firstThreeVoters[taskId];
        bool[3] memory votes = [false, false, false];
        uint256 votesForDev = 0;

        for(uint256 i = 0; i < 3; i++) {
            votes[i] = firstThreeVotes[taskId][voters[i]];
            if(votes[i]) votesForDev++;
        }

        bool developerWon = votesForDev >= 2;
        task.status = TaskStatus.Completed;
        
        emit DisputeResolved(taskId, developerWon);
        
        if (developerWon) {
            achievementContract.taskCompleted(task.developer);
        } else {
            redflagContract.recordLostDispute(task.developer);
        }

        TaskEscrow(task.escrowAddress).setPaymentStatus(
            developerWon ? TaskEscrow.PaymentStatus.DeveloperWon : TaskEscrow.PaymentStatus.ProviderWon
        );
        TaskEscrow(task.escrowAddress).setVotingResults(voters, votes);
    }

    /**
     * @notice Allows provider to cancel a task before it starts
     * @dev Can only be called for tasks in Created state
     * @param taskId ID of the task to cancel
     */
    function cancelTask(uint256 taskId) external onlyTaskProvider {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Cannot cancel task");
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
    function getVoteStatus(uint256 taskId) external view returns (
        uint256 votesFor,
        uint256 totalVotes,
        bool isComplete
    ) {
        Task storage task = tasks[taskId];
        uint256 votesForDev = 0;
        
        for(uint256 i = 0; i < task.votesCount && i < 3; i++) {
            if(firstThreeVotes[taskId][firstThreeVoters[taskId][i]]) {
                votesForDev++;
            }
        }
        
        return (votesForDev, task.votesCount, task.votesCount == 3);
    }

    /**
     * @notice Gets the candidates for a task
     * @param taskId ID of the task
     * @return developers Array of developer candidates' addresses
     */
    function getDeveloperCandidates(uint256 taskId) external view returns (
        address[] memory developers
    ) {
        return (developerCandidates[taskId]);
    }

    /**
     * @notice Gets the auditors assigned to a task
     * @param taskId ID of the task
     * @return auditors Array of auditor addresses
     */
    function getTaskAuditors(uint256 taskId) public view returns (
        address[] memory auditors
    ) {
        Task storage task = tasks[taskId];
        return (task.auditors);
    }

    /**
     * @notice Updates the deadline for a task
     * @dev Only callable by task provider
     * @param taskId ID of the task
     * @param deadline New deadline timestamp
     */
    function updateTaskDeadline(uint256 taskId, uint256 deadline) public onlyTaskProvider { 
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not in correct state");
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
        require(task.status == TaskStatus.InProgress, "Task not in progress");
        // slither-disable-next-line timestamp    
        require(block.timestamp > task.deadline, "Deadline not passed yet");
        task.status = TaskStatus.Cancelled;
        emit TaskCancelled(taskId);
        
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
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == element) {
                return true;
            }
        }
        return false;
    }
} 
